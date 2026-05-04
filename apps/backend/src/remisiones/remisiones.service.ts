import { Injectable, Inject, Logger } from '@nestjs/common';
import { SoftSegurosApi } from '../lib/soft-seguros-api';
import { ComparadorService } from '../cotizador/comparador.service';
import { getInstantAdmin } from '../lib/instant-admin';
import { tx, id } from '@instantdb/admin';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class RemisionesService {
  private readonly logger = new Logger(RemisionesService.name);
  private db = getInstantAdmin();

  constructor(
    @Inject('SOFT_SEGUROS_API') private readonly softApi: SoftSegurosApi,
    private readonly comparadorService: ComparadorService,
  ) {}

  async buscarCliente(documento: string) {
    this.logger.log(`Buscando cliente en Soft Seguros: ${documento}`);
    try {
      const cliente = await this.softApi.getClientByDocument(documento);
      return {
        found: !!cliente,
        cliente: cliente ?? null,
        message: cliente
          ? `Cliente encontrado en Soft Seguros (ID: ${cliente.id})`
          : 'Cliente no encontrado — se creará al remisionar.',
      };
    } catch (error) {
      // If it's an auth error, propagate it — don't mask as "not found"
      const isAuthError = error.message?.includes('authenticate') ||
        error.response?.status === 401 || error.response?.status === 403;
      if (isAuthError) {
        this.logger.error(`Error de autenticación con Soft Seguros: ${error.message}`);
        throw new Error('Error de autenticación con Soft Seguros. Verifique las credenciales del servidor.');
      }
      // 404 or network errors — assume not found
      this.logger.warn(`Error buscando cliente ${documento}: ${error.message}. Asumiendo no existe.`);
      return { found: false, cliente: null, message: 'Cliente no encontrado — se creará al remisionar.' };
    }
  }

  async parsearDocumentos(
    files: { buffer: Buffer; mimeType: string; nombre: string; tipo: 'CEDULA' | 'RUT' | 'SARLAFT' | 'POLIZA' }[],
  ) {
    this.logger.log(`Procesando ${files.length} documentos con IA`);
    const result: Record<string, any> = {};

    for (const file of files) {
      try {
        const extracted = await this.comparadorService.parsearDocumentoLegal(
          file.buffer,
          file.mimeType,
          file.tipo,
        );
        result[file.tipo] = extracted;
        this.logger.log(`Extraído ${file.tipo}: ${JSON.stringify(extracted)}`);
      } catch (err) {
        this.logger.error(`Error parseando ${file.tipo}: ${err.message}`);
        result[file.tipo] = { error: err.message };
      }
    }

    return result;
  }

  async remisionar(data: {
    soft_cliente_id?: string;
    clientData: {
      numero_documento: string;
      tipo_documento?: string;
      nombres?: string;
      apellidos?: string;
      fecha_nacimiento?: string;
      genero?: string;
      email?: string;
      telefono?: string;
      direccion?: string;
      ciudad?: string;
      provincia?: string;
      ocupacion_descripcion?: string;
      otra_ocupacion?: string;
    };
    policyData: {
      numero_poliza?: string;
      aseguradora?: string;
      ramo?: string;
      ramo_soft_id?: number;
      fecha_inicio?: string;
      fecha_fin?: string;
      prima_neta?: number;
      prima_total?: number;
      iva?: number;
      gastos_expedicion?: number;
      objeto_asegurado?: string;
      placa?: string;
      moneda?: string;
      nombre_tomador?: string;
      apellido_tomador?: string;
      cedula_tomador?: string;
      nombre_asegurado?: string;
      cedula_asegurado?: string;
      vendedor_id?: number | string;
      beneficiarios?: Array<{
        nombres?: string;
        numero_documento?: string;
        parentesco?: string;
        porcentaje_beneficio?: number;
      }>;
      crear_pago?: boolean;
      forma_pago?: string;
      periodicidad?: string;
      poliza_padre_id?: number | string;
      numero_renovacion?: number;
    };
    files: { buffer: Buffer; mimeType: string; nombre: string; tipo: 'CEDULA' | 'RUT' | 'SARLAFT' | 'POLIZA' }[];
  }) {
    const { clientData, policyData, files } = data;
    let soft_cliente_id = data.soft_cliente_id;
    const steps: Record<string, any> = {};

    // STEP A: Create client if not found, otherwise update with extracted data
    if (!soft_cliente_id) {
      this.logger.log('SYNC-2: Creando cliente en Soft Seguros');
      try {
        // Determine tipo_cliente from tipo_documento:
        // '02' = NIT → persona Jurídica ('J'), otherwise persona Física ('F')
        const isJuridica = clientData.tipo_documento === '02';
        const tipoCliente = 'Cliente'; // Valid API values: 'Prospecto', 'Cliente', 'Cliente perdido'
        const tipoDocumento = isJuridica ? 'nit' : (clientData.tipo_documento || '01');

        const clientPayload: Record<string, any> = {
          numero_documento: clientData.numero_documento,
          tipo_documento: tipoDocumento,
          tipo_cliente: tipoCliente,
          nombres: clientData.nombres || '',
          apellidos: clientData.apellidos || '',
          correo: clientData.email,
          celular: clientData.telefono,
          telefono: clientData.telefono,
          direccion: clientData.direccion,
          ciudad: clientData.ciudad,
          provincia: clientData.provincia,
          otra_ocupacion: clientData.otra_ocupacion,
        };

        // Persona natural requires genero & fecha_nacimiento; juridica uses fecha_nacimiento as fecha_constitucion
        if (!isJuridica) {
          clientPayload.genero = clientData.genero || 'MASCULINO';
          clientPayload.fecha_nacimiento = clientData.fecha_nacimiento || '1990-01-01';
        } else if (clientData.fecha_nacimiento) {
          // For juridica: fecha_nacimiento = fecha_constitucion (from RUT)
          clientPayload.fecha_nacimiento = clientData.fecha_nacimiento;
        }

        const newClient = await this.softApi.createClient(clientPayload);
        soft_cliente_id = String(newClient.id);
        steps.clientCreate = { soft_cliente_id };
        this.logger.log(`Cliente creado con ID: ${soft_cliente_id}`);
      } catch (createErr: any) {
        // Si la creación falla (p.ej. el cliente ya existe), buscarlo por documento
        this.logger.warn(`SYNC-2 falló: ${createErr.message}. Intentando buscar por documento...`);
        const existing = await this.softApi.getClientByDocument(clientData.numero_documento);
        if (existing) {
          soft_cliente_id = String(existing.id);
          steps.clientFoundOnRetry = { soft_cliente_id };
          this.logger.log(`Cliente recuperado por documento: ${soft_cliente_id}`);
        } else {
          throw createErr; // No existe → relanzar el error original
        }
      }
    } else {
      this.logger.log(`Actualizando cliente ${soft_cliente_id} con datos más recientes`);
      const clientUpdate: Record<string, any> = {};
      // Datos personales — la info nueva siempre sobrescribe la existente
      if (clientData.nombres) clientUpdate.nombres = clientData.nombres;
      if (clientData.apellidos) clientUpdate.apellidos = clientData.apellidos;
      if (clientData.fecha_nacimiento) clientUpdate.fecha_nacimiento = clientData.fecha_nacimiento;
      if (clientData.genero) clientUpdate.genero = clientData.genero;
      if (clientData.email) clientUpdate.correo = clientData.email;
      if (clientData.telefono) { clientUpdate.celular = clientData.telefono; clientUpdate.telefono = clientData.telefono; }
      if (clientData.direccion) clientUpdate.direccion = clientData.direccion;
      if (clientData.ciudad) clientUpdate.ciudad = clientData.ciudad;
      if (clientData.provincia) clientUpdate.provincia = clientData.provincia;
      if (clientData.ocupacion_descripcion) clientUpdate.ocupacion_descripcion = clientData.ocupacion_descripcion;
      if (clientData.otra_ocupacion) clientUpdate.otra_ocupacion = clientData.otra_ocupacion;

      if (Object.keys(clientUpdate).length > 0) {
        try {
          steps.clientUpdate = await this.softApi.updateClient(soft_cliente_id, clientUpdate);
        } catch (updateErr: any) {
          const detail = updateErr.response?.data ? JSON.stringify(updateErr.response.data) : updateErr.message;
          this.logger.error(`Error actualizando cliente ${soft_cliente_id}: ${detail}`);
          throw new Error(`Error actualizando cliente en Soft Seguros: ${detail}`);
        }
      }
    }

    // STEP B: Create policy (SYNC-4)
    this.logger.log(`SYNC-4: Creando póliza para cliente ${soft_cliente_id}`);

    // Map ramo text labels to ramo_marca IDs (from soft-catalogs/ramos.json)
    const RAMO_MARCA_MAP: Record<string, number> = {
      auto: 90828,
      soat: 90838,
      hogar: 90835,
      vida: 90830,
      salud: 90832,          // 90832 = salud (Suramericana); 90831 = Medical (Bolivar)
      medical: 90831,
      empresarial: 90847,    // 90847 = Empresarial; 90850 = pyme (different!)
      pyme: 90850,
      cumplimiento: 90829,
      responsabilidad_civil: 90836,
      rc_medica: 90837,
      exequias: 90843,
      copropiedades: 90844,
      arrendamiento: 90845,
      transportes: 90840,
      incendio: 90842,
      sustraccion: 90839,
      arl: 91285,
    };

    // Load real ramo IDs from catalog (ramo = ramo_marca + aseguradora combination)
    let ramoId: number | undefined = policyData.ramo_soft_id;
    if (!ramoId) {
      try {
        // Try multiple paths: compiled dist/lib/... and fallback to process.cwd()/src/lib/...
        const candidatePaths = [
          path.join(__dirname, '../lib/soft-catalogs/ramos.json'),
          path.join(process.cwd(), 'src/lib/soft-catalogs/ramos.json'),
          path.join(process.cwd(), 'dist/lib/soft-catalogs/ramos.json'),
        ];
        let catalogRaw: string | null = null;
        let resolvedPath = '';
        for (const p of candidatePaths) {
          if (fs.existsSync(p)) {
            catalogRaw = fs.readFileSync(p, 'utf-8');
            resolvedPath = p;
            break;
          }
        }
        if (!catalogRaw) {
          this.logger.warn(`Catálogo ramos.json no encontrado. Rutas buscadas: ${candidatePaths.join(', ')}`);
        } else {
          this.logger.log(`Catálogo ramos cargado desde: ${resolvedPath}`);
          const ramos: Array<{ id: number; ramo_marca: number; aseguradora_id: number; aseguradora_nombre: string }> =
            JSON.parse(catalogRaw);

          const ramoClave = (policyData.ramo || '').toLowerCase();
          const ramaMarca = RAMO_MARCA_MAP[ramoClave];
          const aseguradoraNombre = (policyData.aseguradora || '').toUpperCase();

          this.logger.log(`RAMO lookup: clave='${ramoClave}' marca=${ramaMarca} aseguradora='${aseguradoraNombre}'`);

          if (ramaMarca) {
            // Try exact match: same ramo_marca AND aseguradora name contains search term
            const exactMatch = aseguradoraNombre
              ? ramos.find(
                  (r) =>
                    r.ramo_marca === ramaMarca &&
                    (r.aseguradora_nombre || '').toUpperCase().includes(aseguradoraNombre),
                )
              : null;

            // Fallback: first ramo with the correct marca. BUT only if aseguradora is missing or we couldn't match
            const fallback = ramos.find((r) => r.ramo_marca === ramaMarca);

            const match = exactMatch || fallback;
            if (exactMatch) {
              this.logger.log(`Exact RAMO match found for '${aseguradoraNombre}'`);
            } else if (aseguradoraNombre && fallback) {
              this.logger.warn(`No exact match for aseguradora='${aseguradoraNombre}'. Falling back to ${fallback.aseguradora_nombre}`);
            }
            if (match) {
              ramoId = match.id;
              this.logger.log(
                `RAMO match: '${ramoClave}' + '${aseguradoraNombre}' → ID=${ramoId} (${match.aseguradora_nombre})`,
              );
            } else {
              this.logger.warn(`No se encontró ramo en catálogo para marca=${ramaMarca}, aseguradora='${aseguradoraNombre}'`);
            }
          } else {
            this.logger.warn(`Ramo clave '${ramoClave}' no tiene ramo_marca configurado en RAMO_MARCA_MAP`);
          }
        }
      } catch (catalogErr: any) {
        this.logger.warn(`Error leyendo catálogo de ramos: ${catalogErr.message}`);
      }
    }

    // Auto-fill tomador/asegurado from client data if not explicitly provided
    const fullName = [clientData.nombres, clientData.apellidos].filter(Boolean).join(' ') || 'Sin nombre';

    const isVehiclePolicy = ['auto', 'soat'].includes((policyData.ramo || '').toLowerCase());
    const objetoAseguradoFinal = (isVehiclePolicy && policyData.placa) 
      ? policyData.placa 
      : (policyData.objeto_asegurado || clientData.direccion || 'N/A');

    const policyPayload: Record<string, any> = {
      id_cliente: Number(soft_cliente_id),
      renovable: true,
      estado_poliza: { codigo_generico: '01' },
      // Required fields — auto-filled from client data
      nombre_tomador: policyData.nombre_tomador || fullName,
      cedula_tomador: policyData.cedula_tomador || clientData.numero_documento,
      nombre_asegurado: policyData.nombre_asegurado || fullName,
      cedula_asegurado: policyData.cedula_asegurado || clientData.numero_documento,
      codio_objeto_asegurado: objetoAseguradoFinal,
      
      // Payment & Notifications defaults
      forma_pago: policyData.forma_pago || 'Contado',
      periodicidad: policyData.periodicidad || 'Anual',
      activar_notificaciones_asistente_virtual: true,
      enviar_correo_notificacion_renovacion: true,
      enviar_whatsapp_poliza_por_vencer: true,
      enviar_correo_pagos_vencidos: true,
      enviar_whatsapp_pagos_vencidos: true,
    };

    if (policyData.poliza_padre_id) {
      policyPayload.poliza_padre = Number(policyData.poliza_padre_id);
      policyPayload.numero_renovacion = policyData.numero_renovacion || 1;
      const anoFin = policyData.fecha_fin ? new Date(policyData.fecha_fin).getFullYear() : new Date().getFullYear() + 1;
      policyPayload.observaciones = `renovacion poliza ${anoFin}`;
    }
    if (ramoId) policyPayload.ramo = ramoId;
    if (policyData.numero_poliza) policyPayload.numero_poliza = policyData.numero_poliza;
    if (policyData.fecha_inicio) policyPayload.fecha_inicio = policyData.fecha_inicio;
    if (policyData.fecha_fin) policyPayload.fecha_fin = policyData.fecha_fin;
    if (policyData.prima_neta !== undefined) policyPayload.prima = policyData.prima_neta;
    if (policyData.prima_total !== undefined) policyPayload.total = policyData.prima_total;
    if (policyData.iva !== undefined) policyPayload.iva = policyData.iva;
    if (policyData.gastos_expedicion) policyPayload.gastos_expedicion = policyData.gastos_expedicion;
    if (policyData.apellido_tomador) policyPayload.apellido_tomador = policyData.apellido_tomador;
    if (policyData.moneda) policyPayload.moneda = policyData.moneda;
    // Vendedor: explicit from form OR fallback to corporate
    if (policyData.vendedor_id) policyPayload.vendedor = Number(policyData.vendedor_id);

    this.logger.log(`SYNC-4 payload: ${JSON.stringify(policyPayload)}`);
    let soft_poliza_id: string;
    try {
      const policy = await this.softApi.createPolicy(policyPayload);
      soft_poliza_id = String(policy.id);
      steps.policyCreate = { soft_poliza_id };
    } catch (policyErr: any) {
      const detail = policyErr.response?.data ? JSON.stringify(policyErr.response.data) : policyErr.message;
      this.logger.error(`SYNC-4 falló: ${detail}`);
      throw new Error(`Error creando póliza en Soft Seguros: ${detail}`);
    }
    this.logger.log(`Póliza creada con ID: ${soft_poliza_id}`);

    // STEP B.5: SYNC-3 — Vehicle extra data for auto/soat policies
    const isVehicle = ['auto', 'soat'].includes((policyData.ramo || '').toLowerCase());
    if (isVehicle && policyData.placa) {
      try {
        this.logger.log(`SYNC-3: Creando datos extras vehículo para cliente ${soft_cliente_id}`);
        const vehicleData = {
          placa_dato_extra: policyData.placa,
          fecha_soat_dato_extra: null,
          fecha_impuestos_dato_extra: null,
          fecha_tecnomecanica_dato_extra: null,
        };
        steps.datosExtras = await this.softApi.createDatosExtras(Number(soft_cliente_id), 6, vehicleData);
        this.logger.log(`Datos extras vehículo creados`);
      } catch (extrasErr) {
        this.logger.warn(`SYNC-3 falló (no crítico): ${extrasErr.message}`);
        steps.datosExtrasError = extrasErr.message;
      }
    }

    // STEP B.6: SYNC-5 — Beneficiarios
    if (Array.isArray(policyData.beneficiarios) && policyData.beneficiarios.length > 0) {
      this.logger.log(`SYNC-5: Creando ${policyData.beneficiarios.length} beneficiarios para póliza ${soft_poliza_id}`);
      steps.beneficiarios = [];
      for (const ben of policyData.beneficiarios) {
        try {
          const benResult = await this.softApi.createBeneficiario({
            poliza: Number(soft_poliza_id),
            nombres: ben.nombres,
            numero_documento: ben.numero_documento || 'No especificado',
            parentesco: ben.parentesco,
            porcentaje_beneficio: ben.porcentaje_beneficio,
          });
          steps.beneficiarios.push(benResult);
        } catch (benErr) {
          this.logger.warn(`Error creando beneficiario (no crítico): ${benErr.message}`);
          steps.beneficiarios.push({ error: benErr.message });
        }
      }
    }

    // STEP C: Upload each file as anexo (SYNC-6)
    steps.anexos = [];
    for (const file of files) {
      try {
        const isPoliza = file.tipo === 'POLIZA' && soft_poliza_id;
        const anexoResult = await this.softApi.createAnexo({
          id_entidad: isPoliza ? Number(soft_poliza_id) : Number(soft_cliente_id),
          tipo_entidad: isPoliza ? 'P' : 'C',
          nombre_archivo: file.nombre,
          archivo_base64: file.buffer.toString('base64'),
        });
        steps.anexos.push({ tipo: file.tipo, result: anexoResult });
        this.logger.log(`Anexo ${file.tipo} subido correctamente`);
      } catch (err) {
        this.logger.error(`Error subiendo anexo ${file.tipo}: ${err.message}`);
        steps.anexos.push({ tipo: file.tipo, error: err.message });
      }
    }

    // STEP C.5: Create payment in Soft Seguros (SYNC-7)
    // Create payment if specifically requested, or if form of payment is Contado
    const isContado = (policyData.forma_pago === 'Contado' || !policyData.forma_pago);
    if ((policyData.crear_pago !== false && isContado) && policyData.prima_total) {
      try {
        this.logger.log(`SYNC-7: Creando pago pendiente para póliza ${soft_poliza_id}`);
        const pagoResult = await this.softApi.createPago({
          poliza: Number(soft_poliza_id),
          valor_a_pagar: policyData.prima_total,
          valor_pagado: 0,
        });
        steps.pago = pagoResult;
      } catch (pagoErr: any) {
        this.logger.warn(`Error creando pago (no crítico): ${pagoErr.message}`);
        steps.pago = { error: pagoErr.message };
      }
    }

    // STEP D: Create lead in InstantDB for CRM traceability
    // Non-blocking: if InstantDB is not configured locally, remision still succeeds
    let leadId: string | null = null;
    try {
      leadId = id();
      await this.db.transact([
        tx.leads[leadId].update({
          name: fullName,
          documento: clientData.numero_documento,
          tipo_documento: clientData.tipo_documento || '01',
          phone: clientData.telefono || '',
          email: clientData.email || '',
          city: clientData.ciudad || '',
          type: policyData.ramo || 'auto',
          source: 'Remisión directa',
          status: 'Sincronizado ✓',
          pipeline_tipo: 'preventa',
          soft_cliente_id,
          soft_poliza_id,
          sincronizado_soft: true,
          numero_poliza: policyData.numero_poliza || '',
          aseguradora: policyData.aseguradora || '',
          fecha_inicio_poliza: policyData.fecha_inicio || '',
          fecha_fin_poliza: policyData.fecha_fin || '',
          prima_actual: policyData.prima_total || 0,
          prima_neta: policyData.prima_neta || 0,
          iva: policyData.iva || 0,
          gastos_expedicion: policyData.gastos_expedicion || 0,
          objeto_asegurado: policyData.objeto_asegurado || '',
          // Datos personales del cliente (para cumpleaños y perfil)
          fecha_nacimiento: clientData.fecha_nacimiento || '',
          genero: clientData.genero || '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }),
      ]);
      steps.leadCreated = { leadId };
      this.logger.log(`Lead CRM creado: ${leadId}`);
    } catch (dbErr: any) {
      this.logger.error(`Error creando lead en InstantDB (no crítico): ${dbErr.message}`);
      steps.leadCreated = { error: dbErr.message };
    }

    return { success: true, leadId, soft_cliente_id, soft_poliza_id, steps };
  }

  /**
   * Returns catalog data (vendedores, ramos) from local JSON files
   */
  getCatalogs(): { vendedores: any[]; ramos: any[] } {
    const candidatePaths = (filename: string) => [
      path.join(__dirname, `../lib/soft-catalogs/${filename}`),
      path.join(process.cwd(), `src/lib/soft-catalogs/${filename}`),
      path.join(process.cwd(), `dist/lib/soft-catalogs/${filename}`),
    ];

    const loadJson = (filename: string): any[] => {
      for (const p of candidatePaths(filename)) {
        if (fs.existsSync(p)) {
          try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { /* skip */ }
        }
      }
      return [];
    };

    return {
      vendedores: loadJson('vendedores.json'),
      ramos: loadJson('ramos.json'),
    };
  }
}

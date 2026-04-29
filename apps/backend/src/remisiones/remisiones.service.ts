import { Injectable, Inject, Logger } from '@nestjs/common';
import { SoftSegurosApi } from '../lib/soft-seguros-api';
import { ComparadorService } from '../cotizador/comparador.service';
import { getInstantAdmin } from '../lib/instant-admin';
import { tx, id } from '@instantdb/admin';

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
      prima_total?: number;
      objeto_asegurado?: string;
      placa?: string;
      nombre_tomador?: string;
      apellido_tomador?: string;
      cedula_tomador?: string;
      nombre_asegurado?: string;
      cedula_asegurado?: string;
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
        const newClient = await this.softApi.createClient({
          numero_documento: clientData.numero_documento,
          tipo_documento: clientData.tipo_documento || '01',
          nombres: clientData.nombres || '',
          apellidos: clientData.apellidos || '',
          correo: clientData.email,
          celular: clientData.telefono,
          telefono: clientData.telefono,
          genero: clientData.genero || 'MASCULINO',
          fecha_nacimiento: clientData.fecha_nacimiento || '1990-01-01',
          direccion: clientData.direccion,
          ciudad: clientData.ciudad,
          provincia: clientData.provincia,
          otra_ocupacion: clientData.otra_ocupacion,
        });
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
      this.logger.log(`Actualizando cliente ${soft_cliente_id} con datos extraídos`);
      const clientUpdate: Record<string, any> = {};
      if (clientData.nombres) clientUpdate.nombres = clientData.nombres;
      if (clientData.apellidos) clientUpdate.apellidos = clientData.apellidos;
      if (clientData.fecha_nacimiento) clientUpdate.fecha_nacimiento = clientData.fecha_nacimiento;
      if (clientData.genero) clientUpdate.genero = clientData.genero;
      if (clientData.direccion) clientUpdate.direccion = clientData.direccion;
      if (clientData.ciudad) clientUpdate.ciudad = clientData.ciudad;
      if (clientData.provincia) clientUpdate.provincia = clientData.provincia;
      if (clientData.ocupacion_descripcion) clientUpdate.ocupacion_descripcion = clientData.ocupacion_descripcion;
      if (clientData.otra_ocupacion) clientUpdate.otra_ocupacion = clientData.otra_ocupacion;

      if (Object.keys(clientUpdate).length > 0) {
        steps.clientUpdate = await this.softApi.updateClient(soft_cliente_id, clientUpdate);
      }
    }

    // STEP B: Create policy (SYNC-4)
    this.logger.log(`SYNC-4: Creando póliza para cliente ${soft_cliente_id}`);
    const policyPayload: Record<string, any> = {
      id_cliente: Number(soft_cliente_id),
      renovable: true,
      estado_poliza: { codigo_generico: '01' },
    };
    if (policyData.ramo_soft_id) policyPayload.ramo_soft_id = policyData.ramo_soft_id;
    if (policyData.numero_poliza) policyPayload.numero_poliza = policyData.numero_poliza;
    if (policyData.fecha_inicio) policyPayload.fecha_inicio = policyData.fecha_inicio;
    if (policyData.fecha_fin) policyPayload.fecha_fin = policyData.fecha_fin;
    if (policyData.prima_total) policyPayload.prima = policyData.prima_total;
    if (policyData.objeto_asegurado) policyPayload.codio_objeto_asegurado = policyData.objeto_asegurado;
    if (policyData.nombre_tomador) policyPayload.nombre_tomador = policyData.nombre_tomador;
    if (policyData.apellido_tomador) policyPayload.apellido_tomador = policyData.apellido_tomador;
    if (policyData.cedula_tomador) policyPayload.cedula_tomador = policyData.cedula_tomador;
    if (policyData.nombre_asegurado) policyPayload.nombre_asegurado = policyData.nombre_asegurado;
    if (policyData.cedula_asegurado) policyPayload.cedula_asegurado = policyData.cedula_asegurado;

    const policy = await this.softApi.createPolicy(policyPayload);
    const soft_poliza_id = String(policy.id);
    steps.policyCreate = { soft_poliza_id };
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

    // STEP C: Upload each file as anexo (SYNC-6)
    steps.anexos = [];
    for (const file of files) {
      try {
        const isPoliza = file.tipo === 'POLIZA';
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

    // STEP D: Create lead in InstantDB for CRM traceability
    const leadId = id();
    const fullName = [clientData.nombres, clientData.apellidos].filter(Boolean).join(' ') || 'Sin nombre';
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
        objeto_asegurado: policyData.objeto_asegurado || '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    ]);
    steps.leadCreated = { leadId };
    this.logger.log(`Lead CRM creado: ${leadId}`);

    return { success: true, leadId, soft_cliente_id, soft_poliza_id, steps };
  }
}

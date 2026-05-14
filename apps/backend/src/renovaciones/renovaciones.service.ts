import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { SoftSegurosApi } from '../lib/soft-seguros-api';
import { getInstantAdmin } from '../lib/instant-admin';
import { tx, id } from '@instantdb/admin';

const SOFT_RAMO_TO_TYPE: Record<number | string, string> = {
  90828: 'auto',
  90838: 'soat',
  90835: 'hogar',
  90830: 'vida',
  90831: 'salud',
  90850: 'empresarial',
  90829: 'cumplimiento',
  'Autos': 'auto',
  'SOAT': 'soat',
  'Hogar': 'hogar',
  'Vida': 'vida',
  'Salud': 'salud',
  'Pyme': 'pyme',
  'Empresarial': 'empresarial',
  'Cumplimiento': 'cumplimiento',
};

function derivarTipo(poliza: any): string {
  // 1. Por ID de ramo (más preciso)
  const ramoId = poliza.ramo?.id || poliza.codigo_ramo;
  if (ramoId && SOFT_RAMO_TO_TYPE[ramoId]) return SOFT_RAMO_TO_TYPE[ramoId];

  // 2. Por nombre de ramo
  const ramoNombre = poliza.ramo?.nombre || poliza.ramo_nombre;
  if (ramoNombre) {
    const keys = Object.keys(SOFT_RAMO_TO_TYPE);
    const found = keys.find(k => String(k).toLowerCase() === String(ramoNombre).toLowerCase());
    if (found) return SOFT_RAMO_TO_TYPE[found];
  }

  // 3. Por objeto asegurado (heurística de placa)
  const objeto = poliza.codio_objeto_asegurado || '';
  if (typeof objeto === 'string' && /^[A-Z]{3}\d{3}$/i.test(objeto.trim())) {
    return 'auto';
  }

  return 'auto';
}

export interface ImportJobResult {
  ejecutadoEn: number;
  mesImportado: string;
  totalConsultadas: number;
  nuevasCreadas: number;
  actualizadas: number;
  ignoradas: number;
  errores: number;
  detalleErrores: string[];
  duracionMs: number;
}

@Injectable()
export class RenovacionesService {
  private readonly logger = new Logger(RenovacionesService.name);
  private db = getInstantAdmin();

  constructor(
    @Inject('SOFT_SEGUROS_API') private readonly softApi: SoftSegurosApi,
    @InjectQueue('renovaciones') private readonly renovacionesQueue: Queue,
  ) {}

  /**
   * Trigger the daily import job manually or via cron
   */
  async triggerImport(): Promise<{ jobId: string; message: string }> {
    const job = await this.renovacionesQueue.add(
      'import-renovaciones',
      {},
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30000 },
        removeOnComplete: 10,
        removeOnFail: 20,
      },
    );
    this.logger.log(`Import job queued: ${job.id}`);
    return { jobId: String(job.id), message: 'Job de importación encolado correctamente.' };
  }

  /**
   * Core import logic — called by the BullMQ processor
   */
  async runImportJob(): Promise<ImportJobResult> {
    const startTime = Date.now();

    // Próximo mes calendario completo
    const hoy = new Date();
    const inicioProximoMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
    const finProximoMes = new Date(hoy.getFullYear(), hoy.getMonth() + 2, 0, 23, 59, 59, 999);
    const mesLabel = inicioProximoMes.toLocaleString('es-CO', { month: 'long', year: 'numeric' });

    const result: ImportJobResult = {
      ejecutadoEn: startTime,
      mesImportado: mesLabel,
      totalConsultadas: 0,
      nuevasCreadas: 0,
      actualizadas: 0,
      ignoradas: 0,
      errores: 0,
      detalleErrores: [],
    } as any;

    this.logger.log(`Importando pólizas que vencen en: ${inicioProximoMes.toLocaleDateString('es-CO')} — ${finProximoMes.toLocaleDateString('es-CO')}`);

    try {
      // ── PASO 1: Paginar todas las pólizas de Soft Seguros ──────────────────
      const allPolizas = await this.fetchAllPolizas();
      this.logger.log(`Total polizas fetched from Soft Seguros: ${allPolizas.length}`);

      // ── PASO 2: Filtrar por fecha_fin dentro del próximo mes calendario ────
      // Usamos comparación de cadenas YYYY-MM para evitar problemas de zona horaria con objetos Date
      const targetYear = inicioProximoMes.getFullYear();
      const targetMonth = inicioProximoMes.getMonth() + 1;
      const targetYearMonth = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
      
      const polizasAVencer = allPolizas.filter((poliza: any) => {
        if (!poliza.fecha_fin) return false;
        
        // Formato esperado: YYYY-MM-DD
        const [year, month] = poliza.fecha_fin.split('-');
        const polizaYearMonth = `${year}-${month}`;
        
        const dentroDelRango = polizaYearMonth === targetYearMonth;

        const estadoPoliza = poliza.estado_poliza;
        const esVigente = 
          estadoPoliza?.codigo_generico === '01' || 
          String(estadoPoliza?.codigo_generico) === '01' ||
          estadoPoliza?.id === 45909 ||
          (typeof estadoPoliza === 'object' && estadoPoliza?.id === 45909) ||
          estadoPoliza === 45909 ||
          (typeof estadoPoliza === 'string' && (estadoPoliza.toLowerCase() === 'vigente' || estadoPoliza === '45909'));

        const esRenovable = poliza.renovable === true || poliza.renovable === 1 || String(poliza.renovable) === 'true';

        return esVigente && esRenovable && dentroDelRango;
      });

      result.totalConsultadas = polizasAVencer.length;
      this.logger.log(`Pólizas a vencer en ${mesLabel}: ${polizasAVencer.length}`);
      
      let skippedByRange = 0;
      let skippedByRenovable = 0;
      let totalVigentes = allPolizas.length;

      allPolizas.forEach((p: any) => {
        if (!p.fecha_fin) return;
        const [year, month] = p.fecha_fin.split('-');
        const polizaYearMonth = `${year}-${month}`;
        
        if (polizaYearMonth !== targetYearMonth) skippedByRange++;
        else if (!(p.renovable === true || p.renovable === 1 || String(p.renovable) === 'true')) skippedByRenovable++;
      });

      this.logger.log(
        `Stats del set "Vigente": Total=${totalVigentes}, ` +
        `En rango ${mesLabel}=${polizasAVencer.length}, ` +
        `Fuera de rango=${skippedByRange}, ` +
        `No renovables en rango=${skippedByRenovable}`
      );

      // ── PASO 3: Traer renovaciones existentes en InstantDB ─────────────────
      const existingData = await this.db.query({ leads: { $: { where: { pipeline_tipo: 'renovacion' } } } });
      const existingRenovaciones = (existingData as any)?.leads || [];
      const existingPolizaIds = new Set(existingRenovaciones.map((r: any) => String(r.soft_poliza_id)).filter(Boolean));

      // ── PASO 4: Procesar cada póliza ───────────────────────────────────────
      for (const poliza of polizasAVencer) {
        try {
          const polizaIdStr = String(poliza.id);
          const fechaFin = new Date(poliza.fecha_fin);
          const diasParaVencer = Math.ceil((fechaFin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

          // Score de renovación según PRD
          const score = this.calcularScoreRenovacion(diasParaVencer, poliza.prima || 0);

          // Documento: Priorizar campo de la póliza (tomador), fallback al ID cliente
          const documentoPoliza = poliza.cedula_tomador || String(poliza.cliente || '');

          if (existingPolizaIds.has(polizaIdStr)) {
            // ── Actualizar si cambió la prima o fecha ────────────────────────
            const existing = existingRenovaciones.find((r: any) => String(r.soft_poliza_id) === polizaIdStr);
            if (existing) {
              const tipo = derivarTipo(poliza);
              const isVehicle = tipo === 'auto' || tipo === 'soat';
              const placa = isVehicle ? (poliza.codio_objeto_asegurado || '') : '';

              // Re-enriquecer datos del cliente (puede haberse actualizado en Soft)
              let clienteDataUpd: any = {};
              // Si cedula_tomador está vacío, documentoPoliza es el ID interno → buscar por ID directamente
              if (documentoPoliza && !/^\d{1,8}$/.test(documentoPoliza)) {
                try { clienteDataUpd = await this.softApi.getClientByDocument(documentoPoliza) || {}; } catch { /* non-fatal */ }
              }
              if (!clienteDataUpd.id && poliza.cliente) {
                try { clienteDataUpd = await this.softApi.getClientById(poliza.cliente) || {}; } catch { /* non-fatal */ }
              }

              await this.db.transact([
                tx.leads[existing.id].update({
                  prima_actual: Number(poliza.prima || poliza.total || 0),
                  dias_para_vencer: diasParaVencer,
                  score,
                  // Mantener info actualizada
                  documento: documentoPoliza || existing.documento || '',
                  numero_poliza: poliza.numero_poliza || existing.numero_poliza || '',
                  aseguradora: poliza.aseguradora?.nombre ||
                               poliza.aseguradora?.razon_social ||
                               (typeof poliza.aseguradora === 'string' ? poliza.aseguradora : '') ||
                               existing.aseguradora || '',
                  fecha_fin_poliza: poliza.fecha_fin || existing.fecha_fin_poliza || '',
                  objeto_asegurado: poliza.codio_objeto_asegurado || existing.objeto_asegurado || '',
                  placa: placa || existing.placa || '',
                  vehiclePlate: placa || existing.vehiclePlate || '',
                  // Datos del cliente
                  email: clienteDataUpd.correo || existing.email || '',
                  city: clienteDataUpd.municipio_expedicion?.nombre ||
                        clienteDataUpd.ciudad ||
                        clienteDataUpd.municipio ||
                        existing.city || '',
                  phone: clienteDataUpd.celular || clienteDataUpd.telefono || existing.phone || '',
                  fecha_nacimiento: clienteDataUpd.fecha_nacimiento || existing.fecha_nacimiento || '',
                  genero: clienteDataUpd.genero || existing.genero || '',
                  updatedAt: Date.now(),
                }),
              ]);
              result.actualizadas++;
            }
          } else {
            // ── PASO 3: Enriquecer con datos del cliente ─────────────────────
            let clienteData: any = {};
            // Usar búsqueda por documento solo si parece un número de cedula real (>8 dígitos)
            if (documentoPoliza && !/^\d{1,8}$/.test(documentoPoliza)) {
              try {
                clienteData = await this.softApi.getClientByDocument(documentoPoliza) || {};
              } catch {
                this.logger.warn(`Could not fetch client data for poliza ${poliza.id} with doc ${documentoPoliza}`);
              }
            }
            // Fallback: buscar por ID interno de Soft Seguros
            if (!clienteData.id && poliza.cliente) {
              try {
                clienteData = await this.softApi.getClientById(poliza.cliente) || {};
              } catch {
                this.logger.warn(`Could not fetch client by ID for poliza ${poliza.id}, cliente=${poliza.cliente}`);
              }
            }

            // ── Crear nueva oportunidad de renovación ────────────────────────
            const newId = id();
            const tipo = derivarTipo(poliza);
            const isVehicle = tipo === 'auto' || tipo === 'soat';
            const placa = isVehicle ? (poliza.codio_objeto_asegurado || '') : '';

            const renovacionData = {
              // Lead base fields
              type: tipo,
              name: poliza.nombre_tomador || clienteData.nombres || `Cliente ${poliza.id}`,
              documento: poliza.cedula_tomador || clienteData.numero_documento || documentoPoliza || '',
              phone: clienteData.celular || clienteData.telefono || '',
              email: clienteData.correo || clienteData.email || '',
              city: clienteData.municipio_expedicion?.nombre ||
                    clienteData.ciudad ||
                    clienteData.municipio ||
                    '',
              fecha_nacimiento: clienteData.fecha_nacimiento || '',
              genero: clienteData.genero || '',
              pipeline_tipo: 'renovacion',
              status: 'Importada',
              score,
              // Soft Seguros references
              soft_poliza_id: polizaIdStr,
              soft_cliente_id: String(poliza.cliente || ''),
              sincronizado_soft: true,
              // Renovation-specific
              numero_poliza: poliza.numero_poliza || '',
              aseguradora: poliza.aseguradora?.nombre ||
                           poliza.aseguradora?.razon_social ||
                           (typeof poliza.aseguradora === 'string' ? poliza.aseguradora : '') ||
                           '',
              fecha_fin_poliza: poliza.fecha_fin || '',
              prima_actual: Number(poliza.prima || poliza.total || 0),
              dias_para_vencer: diasParaVencer,
              objeto_asegurado: poliza.codio_objeto_asegurado || '',
              placa: placa,
              vehiclePlate: placa,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };

            await this.db.transact([
              tx.leads[newId].update(renovacionData),
            ]);
            result.nuevasCreadas++;
          }
        } catch (polizaError: any) {
          result.errores++;
          result.detalleErrores.push(`Póliza ${poliza.id}: ${polizaError.message}`);
          this.logger.error(`Error processing poliza ${poliza.id}: ${polizaError.message}`);
        }
      }

      result.ignoradas = result.totalConsultadas - result.nuevasCreadas - result.actualizadas - result.errores;

    } catch (error: any) {
      this.logger.error(`Fatal error in import job: ${error.message}`);
      result.errores++;
      result.detalleErrores.push(`Error fatal: ${error.message}`);
    }

    const duracionMs = Date.now() - startTime;
    (result as any).duracionMs = duracionMs;

    // ── Log del job en InstantDB ───────────────────────────────────────────────
    try {
      const logId = id();
      await this.db.transact([
        (tx.job_importaciones as any)[logId].update({
          ejecutadoEn: result.ejecutadoEn,
          mesImportado: result.mesImportado,
          totalConsultadas: result.totalConsultadas,
          nuevasCreadas: result.nuevasCreadas,
          actualizadas: result.actualizadas,
          ignoradas: result.ignoradas,
          errores: result.errores,
          detalleErrores: JSON.stringify(result.detalleErrores),
          duracionMs,
        }),
      ]);
    } catch (logError: any) {
      this.logger.warn(`Could not save job log: ${logError.message}`);
    }

    this.logger.log(
      `Import job completed in ${duracionMs}ms. ` +
      `New: ${result.nuevasCreadas}, Updated: ${result.actualizadas}, ` +
      `Skipped: ${result.ignoradas}, Errors: ${result.errores}`
    );

    return result;
  }

  /**
   * Paginate all polizas from Soft Seguros
   */
  private async fetchAllPolizas(): Promise<any[]> {
    const allPolizas: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      try {
        const response = await this.softApi['request']('GET', '/api/poliza/', undefined, {
          order_by: 'id',
          sort_by: 'desc', // Recent first
          estado_poliza: 45909, // Solo pólizas VIGENTES (ID confirmado en Soft Seguros)
          page,
          page_size: 100,
        });

        // Soft Seguros can return { results: [...] } or just [...]
        const items = response.results || (Array.isArray(response) ? response : []);
        if (Array.isArray(items)) {
          allPolizas.push(...items);
        }

        // Check if there is a next page
        hasMore = !!response.next;
        
        if (hasMore) {
          page++;
          // Safe limit to avoid infinite loops in case of API issues, but much higher than 500
          if (page > 2000) {
            this.logger.warn('Reached safety page limit (2000). Stopping pagination.');
            hasMore = false;
          }
        }
      } catch (error: any) {
        this.logger.error(`Error fetching page ${page}: ${error.message}`);
        hasMore = false;
      }
    }

    return allPolizas;
  }

  /**
   * Score de renovación según PRD v2.0
   */
  private calcularScoreRenovacion(diasParaVencer: number, prima: number): number {
    let score = 0;

    // Urgencia por días
    if (diasParaVencer <= 15) score += 40;
    else if (diasParaVencer <= 30) score += 25;
    else if (diasParaVencer <= 45) score += 10;

    // Valor de la prima
    if (prima >= 2_000_000) score += 20;

    return Math.min(score, 100);
  }

  /**
   * Get import job status
   */
  async getJobStatus(jobId: string) {
    const job = await this.renovacionesQueue.getJob(jobId);
    if (!job) return { status: 'not_found' };

    const state = await job.getState();
    return {
      id: job.id,
      status: state,
      progress: job.progress,
      data: job.data,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
    };
  }

  /**
   * Get last import logs from InstantDB
   */
  async getImportLogs(limit: number = 10) {
    const result = await this.db.query({
      job_importaciones: {
        $: { limit },
      },
    });
    return (result as any)?.job_importaciones || [];
  }

  async confirmarRenovacion(
    leadId: string,
    nuevaPrima: number,
    nuevaFechaFin: string,
  ): Promise<{ success: boolean; message: string; soft_poliza_id?: string }> {
    const queryResult = await this.db.query({ leads: { $: { where: { id: leadId } } } });
    const lead = (queryResult as any)?.leads?.[0];
    if (!lead) throw new Error(`Lead ${leadId} no encontrado`);
    if (!lead.soft_poliza_id) throw new Error('Esta renovación no tiene ID de póliza en Soft Seguros');

    const fechaInicioDate = lead.fecha_fin_poliza
      ? new Date(new Date(lead.fecha_fin_poliza).getTime() + 86_400_000)
      : new Date();
    const nuevaFechaInicio = fechaInicioDate.toISOString().split('T')[0];

    await this.softApi['request']('PUT', `/api/poliza/${lead.soft_poliza_id}/`, {
      fecha_fin: nuevaFechaFin,
      fecha_inicio: nuevaFechaInicio,
      prima: nuevaPrima,
      total: nuevaPrima,
    });

    await this.db.transact([
      tx.leads[leadId].update({
        status: 'Renovada en Soft ✓',
        prima_actual: nuevaPrima,
        fecha_fin_poliza: nuevaFechaFin,
        fecha_inicio_poliza: nuevaFechaInicio,
        dias_para_vencer: 365,
        sincronizado_soft: true,
        updatedAt: Date.now(),
      } as any),
    ]);

    this.logger.log(`Renovación confirmada en Soft Seguros: póliza ${lead.soft_poliza_id}`);
    return {
      success: true,
      message: `Póliza ${lead.numero_poliza} renovada hasta ${nuevaFechaFin}`,
      soft_poliza_id: lead.soft_poliza_id,
    };
  }
}

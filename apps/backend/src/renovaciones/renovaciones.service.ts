import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { SoftSegurosApi } from '../lib/soft-seguros-api';
import { getInstantAdmin } from '../lib/instant-admin';
import { tx, id } from '@instantdb/admin';

export interface ImportJobResult {
  ejecutadoEn: number;
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
  async triggerImport(diasRango: number = 60): Promise<{ jobId: string; message: string }> {
    const job = await this.renovacionesQueue.add(
      'import-renovaciones',
      { diasRango },
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
  async runImportJob(diasRango: number = 60): Promise<ImportJobResult> {
    const startTime = Date.now();
    const result: ImportJobResult = {
      ejecutadoEn: startTime,
      totalConsultadas: 0,
      nuevasCreadas: 0,
      actualizadas: 0,
      ignoradas: 0,
      errores: 0,
      detalleErrores: [],
    } as any;

    this.logger.log(`Starting daily renovation import job. Range: ${diasRango} days`);

    try {
      // ── PASO 1: Paginar todas las pólizas de Soft Seguros ──────────────────
      const allPolizas = await this.fetchAllPolizas();
      this.logger.log(`Total polizas fetched from Soft Seguros: ${allPolizas.length}`);

      // ── PASO 2: Filtrar por fecha_fin dentro del rango ─────────────────────
      const hoy = new Date();
      const limiteFecha = new Date();
      limiteFecha.setDate(limiteFecha.getDate() + diasRango);

      const polizasAVencer = allPolizas.filter((poliza: any) => {
        const fechaFin = poliza.fecha_fin ? new Date(poliza.fecha_fin) : null;
        if (!fechaFin) return false;

        // Vigente (codigo_generico = "01") y renovable
        const esVigente = poliza.estado_poliza?.codigo_generico === '01' || poliza.estado_poliza === 'Vigente';
        const esRenovable = poliza.renovable === true;
        const dentroDelRango = fechaFin >= hoy && fechaFin <= limiteFecha;

        return esVigente && esRenovable && dentroDelRango;
      });

      result.totalConsultadas = polizasAVencer.length;
      this.logger.log(`Polizas a vencer en ${diasRango} dias: ${polizasAVencer.length}`);

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

          if (existingPolizaIds.has(polizaIdStr)) {
            // ── Actualizar si cambió la prima o fecha ────────────────────────
            const existing = existingRenovaciones.find((r: any) => String(r.soft_poliza_id) === polizaIdStr);
            if (existing) {
              await this.db.transact([
                tx.leads[existing.id].update({
                  prima_actual: poliza.prima || poliza.total || 0,
                  dias_para_vencer: diasParaVencer,
                  score,
                  updatedAt: Date.now(),
                }),
              ]);
              result.actualizadas++;
            }
          } else {
            // ── PASO 3: Enriquecer con datos del cliente ─────────────────────
            let clienteData: any = {};
            try {
              clienteData = await this.softApi.getClientByDocument(
                poliza.cedula_tomador || String(poliza.cliente)
              ) || {};
            } catch {
              this.logger.warn(`Could not fetch client data for poliza ${poliza.id}`);
            }

            // ── Crear nueva oportunidad de renovación ────────────────────────
            const newId = id();
            const renovacionData = {
              // Lead base fields
              name: poliza.nombre_tomador || clienteData.nombres || `Cliente ${poliza.id}`,
              phone: clienteData.celular || clienteData.telefono || '',
              email: clienteData.correo || '',
              pipeline_tipo: 'renovacion',
              status: 'Importada',
              score,
              // Soft Seguros references
              soft_poliza_id: polizaIdStr,
              soft_cliente_id: String(poliza.cliente || ''),
              sincronizado_soft: true,
              // Renovation-specific
              numero_poliza: poliza.numero_poliza || '',
              aseguradora: poliza.aseguradora?.nombre || '',
              fecha_fin_poliza: poliza.fecha_fin || '',
              prima_actual: poliza.prima || poliza.total || 0,
              dias_para_vencer: diasParaVencer,
              objeto_asegurado: poliza.codio_objeto_asegurado || '',
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
          sort_by: 'asc',
          page,
        });

        const items = response.results || response;
        if (Array.isArray(items)) {
          allPolizas.push(...items);
        }

        hasMore = !!response.next;
        page++;

        if (page > 500) {
          this.logger.warn('Reached page limit (500). Stopping pagination.');
          break;
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
}

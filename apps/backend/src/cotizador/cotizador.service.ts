import { Inject, Injectable, Logger } from '@nestjs/common';
import { QualitasApi, CotizarDto } from '../lib/qualitas-api';
import { AllianzApi } from '../lib/allianz-api';
import { SBSApi } from '../lib/sbs-api';
import { ComparadorService } from './comparador.service';
import { generarCorreo, GenerarCorreoParams } from './email-generator';

@Injectable()
export class CotizadorService {
  private readonly logger = new Logger(CotizadorService.name);

  constructor(
    @Inject('QUALITAS_API') private readonly qualitasApi: QualitasApi,
    @Inject('ALLIANZ_API') private readonly allianzApi: AllianzApi,
    @Inject('SBS_API') private readonly sbsApi: SBSApi,
    private readonly comparadorService: ComparadorService,
  ) {}

  async cotizarQualitas(dto: CotizarDto) {
    return this.qualitasApi.cotizar(dto);
  }

  async cotizarAllianz(dto: CotizarDto) {
    return this.allianzApi.cotizar(dto);
  }

  async cotizarSBS(dto: CotizarDto) {
    return this.sbsApi.cotizar(dto);
  }

  async cotizarTodo(dto: CotizarDto) {
    const [qualitas, allianz, sbs] = await Promise.allSettled([
      this.qualitasApi.cotizar(dto),
      this.allianzApi.cotizar(dto),
      this.sbsApi.cotizar(dto),
    ]);

    const result: Record<string, any> = {};

    if (qualitas.status === 'fulfilled') {
      result.qualitas = qualitas.value;
    } else {
      this.logger.warn(`Qualitas falló: ${qualitas.reason?.message}`);
      result.qualitas = { error: qualitas.reason?.message ?? 'Error desconocido' };
    }

    if (allianz.status === 'fulfilled') {
      result.allianz = allianz.value;
    } else {
      this.logger.warn(`Allianz falló: ${allianz.reason?.message}`);
      result.allianz = { error: allianz.reason?.message ?? 'Error desconocido' };
    }

    if (sbs.status === 'fulfilled') {
      result.sbs = sbs.value;
    } else {
      this.logger.warn(`SBS falló: ${sbs.reason?.message}`);
      result.sbs = { error: sbs.reason?.message ?? 'Error desconocido' };
    }

    return result;
  }

  async compararCotizaciones(cotizaciones: any[], forzar_recomendada?: string) {
    return this.comparadorService.compararCotizaciones(cotizaciones, forzar_recomendada);
  }

  generarCorreoCliente(params: GenerarCorreoParams) {
    return generarCorreo(params);
  }

  async parsearPdfCotizacion(buffer: Buffer, mimeType: string) {
    return this.comparadorService.parsearPdfCotizacion(buffer, mimeType);
  }

  async parsearMultiplesPdfsCotizacion(files: any[]) {
    return this.comparadorService.parsearMultiplesPdfsCotizacion(files);
  }
}

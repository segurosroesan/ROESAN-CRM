import { Inject, Injectable, Logger } from '@nestjs/common';
import { QualitasApi, CotizarDto } from '../lib/qualitas-api';
import { AllianzApi } from '../lib/allianz-api';

@Injectable()
export class CotizadorService {
  private readonly logger = new Logger(CotizadorService.name);

  constructor(
    @Inject('QUALITAS_API') private readonly qualitasApi: QualitasApi,
    @Inject('ALLIANZ_API') private readonly allianzApi: AllianzApi,
  ) {}

  async cotizarQualitas(dto: CotizarDto) {
    return this.qualitasApi.cotizar(dto);
  }

  async cotizarAllianz(dto: CotizarDto) {
    return this.allianzApi.cotizar(dto);
  }

  async cotizarTodo(dto: CotizarDto) {
    const [qualitas, allianz] = await Promise.allSettled([
      this.qualitasApi.cotizar(dto),
      this.allianzApi.cotizar(dto),
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

    return result;
  }
}

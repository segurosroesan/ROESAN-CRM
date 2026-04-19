import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RenovacionesService } from './renovaciones.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RenovacionesCronService {
  private readonly logger = new Logger(RenovacionesCronService.name);

  constructor(
    private readonly renovacionesService: RenovacionesService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Daily cron job — runs at 7:00 AM Colombia time (UTC-5 = 12:00 UTC)
   * Override with IMPORT_CRON env var (cron expression)
   *
   * Default: '0 12 * * *' (7 AM UTC-5 = 12 PM UTC)
   */
  @Cron(process.env.IMPORT_CRON || '0 12 * * *')
  async handleDailyImport() {
    const diasRango = parseInt(
      process.env.IMPORT_DIAS_RANGO || '60',
      10,
    );

    this.logger.log(
      `[CRON] Starting daily renovation import. Range: ${diasRango} days.`
    );

    try {
      const result = await this.renovacionesService.triggerImport(diasRango);
      this.logger.log(`[CRON] Job enqueued: ${result.jobId}`);
    } catch (error) {
      this.logger.error(`[CRON] Failed to enqueue import job: ${error.message}`);
    }
  }
}

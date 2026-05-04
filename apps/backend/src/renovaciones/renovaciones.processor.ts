import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { RenovacionesService } from './renovaciones.service';

@Processor('renovaciones')
export class RenovacionesProcessor extends WorkerHost {
  private readonly logger = new Logger(RenovacionesProcessor.name);

  constructor(private readonly renovacionesService: RenovacionesService) {
    super();
  }

  async process(job: Job) {
    this.logger.log(`Processing renovation import job ${job.id}.`);

    await job.updateProgress(5);

    const result = await this.renovacionesService.runImportJob();

    await job.updateProgress(100);

    this.logger.log(
      `Job ${job.id} completed. New: ${result.nuevasCreadas}, Updated: ${result.actualizadas}`
    );

    return result;
  }
}

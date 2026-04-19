import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RenovacionesService } from './renovaciones.service';
import { RenovacionesController } from './renovaciones.controller';
import { RenovacionesProcessor } from './renovaciones.processor';
import { RenovacionesCronService } from './renovaciones.cron';
import { SoftSegurosApi } from '../lib/soft-seguros-api';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'renovaciones' }),
    ScheduleModule.forRoot(),
  ],
  controllers: [RenovacionesController],
  providers: [
    {
      provide: 'SOFT_SEGUROS_API',
      useFactory: (configService: ConfigService) =>
        new SoftSegurosApi(
          configService.get<string>('SOFT_SEGUROS_API_URL', 'https://app.softseguros.com'),
          configService.get<string>('SOFT_SEGUROS_USERNAME'),
          configService.get<string>('SOFT_SEGUROS_PASSWORD'),
        ),
      inject: [ConfigService],
    },
    RenovacionesService,
    RenovacionesProcessor,
    RenovacionesCronService,
  ],
  exports: [RenovacionesService],
})
export class RenovacionesModule {}

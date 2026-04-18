import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SyncService } from './sync.service';
import { SoftSegurosApi } from '../lib/soft-seguros-api';
import { SyncController } from './sync.controller';

@Module({
  controllers: [SyncController],
  providers: [
    SyncService,
    {
      provide: 'SOFT_SEGUROS_API',
      useFactory: (configService: ConfigService) => {
        return new SoftSegurosApi(
          configService.get('SOFT_SEGUROS_API_URL', 'https://app.softseguros.com'),
          configService.get('SOFT_SEGUROS_USERNAME'),
          configService.get('SOFT_SEGUROS_PASSWORD'),
        );
      },
      inject: [ConfigService],
    },
  ],
  exports: [SyncService],
  controllers: [SyncController],
})
export class SyncModule {}

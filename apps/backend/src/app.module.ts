import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LeadsModule } from './leads/leads.module';
import { SyncModule } from './sync/sync.module';
import { CotizacionesModule } from './cotizaciones/cotizaciones.module';
import { RenovacionesModule } from './renovaciones/renovaciones.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
        },
      }),
      inject: [ConfigService],
    }),
    LeadsModule,
    SyncModule,
    CotizacionesModule,
    RenovacionesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}


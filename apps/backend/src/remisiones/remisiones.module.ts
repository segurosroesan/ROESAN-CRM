import { Module } from '@nestjs/common';
import { RemisionesController } from './remisiones.controller';
import { RemisionesService } from './remisiones.service';
import { SyncModule } from '../sync/sync.module';
import { CotizadorModule } from '../cotizador/cotizador.module';

@Module({
  imports: [SyncModule, CotizadorModule],
  controllers: [RemisionesController],
  providers: [RemisionesService],
})
export class RemisionesModule {}

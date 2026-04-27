import { Module } from '@nestjs/common';
import { DocumentosController } from './documentos.controller';
import { DocumentosService } from './documentos.service';
import { CotizadorModule } from '../cotizador/cotizador.module';
import { SyncModule } from '../sync/sync.module';

@Module({
  imports: [CotizadorModule, SyncModule],
  controllers: [DocumentosController],
  providers: [DocumentosService],
  exports: [DocumentosService],
})
export class DocumentosModule {}

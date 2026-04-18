import { Injectable, Logger } from '@nestjs/common';
import { getInstantAdmin } from '../lib/instant-admin';
import { tx, id } from '@instantdb/admin';

@Injectable()
export class CotizacionesService {
  private readonly logger = new Logger(CotizacionesService.name);
  private db = getInstantAdmin();

  async syncCotizacion(data: any) {
    this.logger.log(`Procesando sincronizacion de cotizacion para lead ${data.leadId}`);
    
    const newCotizacionId = id();

    const cotizacion = {
      leadId: data.leadId,
      aseguradora: data.aseguradora || '',
      prima: data.prima || data.monto || 0,
      cobertura: data.cobertura || '',
      deducible: data.deducible || '',
      pdfUrl: data.pdfUrl || data.urlPdf || '',
      detalles: data.detalles || '',
      fuente: data.fuente || 'Agente IA',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    const updates: any[] = [
      tx.cotizaciones[newCotizacionId].update(cotizacion)
    ];

    if (data.leadId) {
       // Opcional: Linkear a nivel de schema de InstantDB
       updates.push(tx.cotizaciones[newCotizacionId].link({ lead: data.leadId }));
       
       // Actualizar estado del lead a "Cotización enviada" (Pipeline de Pre-venta)
       updates.push(tx.leads[data.leadId].update({ 
         status: 'Cotización enviada', 
         updatedAt: Date.now() 
       }));
    }

    try {
      await this.db.transact(updates);
      this.logger.log(`Sincronizada cotizacion ${newCotizacionId} correctamente`);
      return { id: newCotizacionId, ...cotizacion };
    } catch (error) {
      this.logger.error(`Error sincronizando cotizacion: ${error.message}`);
      throw error;
    }
  }
}

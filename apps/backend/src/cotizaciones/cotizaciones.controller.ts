import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { CotizacionesService } from './cotizaciones.service';

@Controller('cotizaciones')
export class CotizacionesController {
  constructor(private readonly cotizacionesService: CotizacionesService) {}

  /**
   * Endpoint for external agents to sync created quotes into the CRM
   */
  @Post('sync')
  async syncQuote(@Body() quoteData: any) {
    if (!quoteData || !quoteData.leadId) {
      throw new HttpException('El campo leadId es requerido para sincronizar la cotización.', HttpStatus.BAD_REQUEST);
    }
    
    try {
      return await this.cotizacionesService.syncCotizacion(quoteData);
    } catch (error) {
      throw new HttpException(
        `Error al sincronizar cotización: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

import { Controller, Post, Body, Param, HttpException, HttpStatus } from '@nestjs/common';
import { SyncService } from './sync.service';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  /**
   * Triggers SYNC-1 and SYNC-2 for a specific lead.
   */
  @Post('softseguros/:leadId')
  async syncWithSoft(
    @Param('leadId') leadId: string,
    @Body('leadData') leadData: any,
  ) {
    if (!leadData || (!leadData.documento && !leadData.companyNit)) {
      throw new HttpException('Los datos del lead con un número de documento son requeridos.', HttpStatus.BAD_REQUEST);
    }
    
    try {
      return await this.syncService.syncClientStatus(leadId, leadData);
    } catch (error) {
      throw new HttpException(
        `Error en la sincronización: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

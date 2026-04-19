import { Controller, Get, Post, Query, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { RenovacionesService } from './renovaciones.service';

@Controller('renovaciones')
export class RenovacionesController {
  constructor(private readonly renovacionesService: RenovacionesService) {}

  /**
   * POST /renovaciones/import
   * Trigger the import job manually (admin/cron use only)
   */
  @Post('import')
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerImport(@Body('diasRango') diasRango?: number) {
    return this.renovacionesService.triggerImport(diasRango || 60);
  }

  /**
   * GET /renovaciones/import/status/:jobId
   * Poll import job status
   */
  @Get('import/status/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    return this.renovacionesService.getJobStatus(jobId);
  }

  /**
   * GET /renovaciones/logs
   * Get last N import execution logs
   */
  @Get('logs')
  async getLogs(@Query('limit') limit?: string) {
    return this.renovacionesService.getImportLogs(Number(limit) || 10);
  }
}

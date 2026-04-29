import {
  Body, Controller, Post, HttpCode, Logger,
  UseInterceptors, UploadedFiles, BadRequestException, HttpException, HttpStatus,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { RemisionesService } from './remisiones.service';

const MULTER_OPTS = {
  storage: memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB por archivo
};

@Controller('remisiones')
export class RemisionesController {
  private readonly logger = new Logger(RemisionesController.name);

  constructor(private readonly remisionesService: RemisionesService) {}

  @Post('buscar-cliente')
  @HttpCode(200)
  async buscarCliente(@Body('documento') documento: string) {
    if (!documento) throw new BadRequestException('documento es requerido');
    return this.remisionesService.buscarCliente(documento);
  }

  /**
   * Temporary diagnostic endpoint to debug Soft Seguros connectivity from Render.
   * TODO: Remove after debugging is complete.
   */
  @Post('diagnostico')
  @HttpCode(200)
  async diagnostico(@Body('documento') documento: string) {
    const results: Record<string, any> = { timestamp: new Date().toISOString() };
    
    // Check env vars
    results.env = {
      SOFT_SEGUROS_API_URL: process.env.SOFT_SEGUROS_API_URL || 'NOT SET',
      SOFT_SEGUROS_USERNAME: process.env.SOFT_SEGUROS_USERNAME ? `${process.env.SOFT_SEGUROS_USERNAME.substring(0, 4)}...` : 'NOT SET',
      SOFT_SEGUROS_PASSWORD: process.env.SOFT_SEGUROS_PASSWORD ? '***SET***' : 'NOT SET',
    };

    // Test auth directly
    const axios = require('axios');
    try {
      const authResp = await axios.post(
        `${process.env.SOFT_SEGUROS_API_URL || 'https://app.softseguros.com'}/api-token-auth/`,
        {
          username: process.env.SOFT_SEGUROS_USERNAME,
          password: process.env.SOFT_SEGUROS_PASSWORD,
        },
      );
      results.auth = { success: true, tokenPrefix: authResp.data.token?.substring(0, 10) };

      // If documento provided, test search
      if (documento) {
        try {
          const searchResp = await axios.get(
            `${process.env.SOFT_SEGUROS_API_URL || 'https://app.softseguros.com'}/api/cliente/listar_cliente_por_documento/`,
            {
              params: { numero_documento: documento },
              headers: { Authorization: `Token ${authResp.data.token}` },
            },
          );
          results.search = {
            status: searchResp.status,
            dataType: typeof searchResp.data,
            hasResults: searchResp.data?.results !== undefined,
            hasId: !!searchResp.data?.id,
            clientId: searchResp.data?.id,
            clientName: searchResp.data?.nombres ? `${searchResp.data.nombres} ${searchResp.data.apellidos}` : null,
          };
        } catch (searchErr) {
          results.search = {
            error: true,
            status: searchErr.response?.status,
            data: searchErr.response?.data,
            message: searchErr.message,
          };
        }
      }
    } catch (authErr) {
      results.auth = {
        success: false,
        status: authErr.response?.status,
        data: authErr.response?.data,
        message: authErr.message,
      };
    }

    // Also test via the injected SOFT_SEGUROS_API instance
    try {
      const clientViaService = await this.remisionesService.buscarCliente(documento || '27567880');
      results.serviceResult = clientViaService;
    } catch (serviceErr) {
      results.serviceResult = { error: true, message: serviceErr.message };
    }

    return results;
  }

  @Post('parsear')
  @HttpCode(200)
  @UseInterceptors(FilesInterceptor('files', 4, MULTER_OPTS))
  async parsearDocumentos(
    @UploadedFiles() files: any[],
    @Body('tipos') tiposRaw: string,
  ) {
    if (!files?.length) throw new BadRequestException('No se proporcionaron archivos');
    let tipos: string[];
    try {
      tipos = JSON.parse(tiposRaw);
    } catch {
      throw new BadRequestException('tipos debe ser un array JSON: ["CEDULA","POLIZA",...]');
    }
    if (tipos.length !== files.length) {
      throw new BadRequestException('La cantidad de tipos debe coincidir con la cantidad de archivos');
    }
    const mapped = files.map((f, i) => ({
      buffer: f.buffer,
      mimeType: f.mimetype,
      nombre: f.originalname,
      tipo: tipos[i] as 'CEDULA' | 'RUT' | 'SARLAFT' | 'POLIZA',
    }));
    try {
      return await this.remisionesService.parsearDocumentos(mapped);
    } catch (e: any) {
      throw new HttpException({ error: e.message }, HttpStatus.BAD_GATEWAY);
    }
  }

  @Post('remisionar')
  @HttpCode(200)
  @UseInterceptors(FilesInterceptor('files', 4, MULTER_OPTS))
  async remisionar(
    @UploadedFiles() files: any[],
    @Body('soft_cliente_id') soft_cliente_id: string,
    @Body('tipos') tiposRaw: string,
    @Body('clientData') clientDataRaw: string,
    @Body('policyData') policyDataRaw: string,
  ) {
    if (!clientDataRaw) throw new BadRequestException('clientData es requerido');
    if (!policyDataRaw) throw new BadRequestException('policyData es requerido');

    let clientData: any, policyData: any;
    try {
      clientData = JSON.parse(clientDataRaw);
      policyData = JSON.parse(policyDataRaw);
    } catch {
      throw new BadRequestException('clientData y policyData deben ser JSON válido');
    }

    const tipos: string[] = files?.length && tiposRaw ? JSON.parse(tiposRaw) : [];
    const mappedFiles = (files || []).map((f: any, i: number) => ({
      buffer: f.buffer,
      mimeType: f.mimetype,
      nombre: f.originalname,
      tipo: (tipos[i] || 'CEDULA') as 'CEDULA' | 'RUT' | 'SARLAFT' | 'POLIZA',
    }));

    try {
      return await this.remisionesService.remisionar({
        soft_cliente_id: soft_cliente_id || undefined,
        clientData,
        policyData,
        files: mappedFiles,
      });
    } catch (e: any) {
      this.logger.error(`Error en remisionar: ${e.message}`);
      throw new HttpException({ error: e.message }, HttpStatus.BAD_GATEWAY);
    }
  }
}

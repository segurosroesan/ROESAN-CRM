import {
  Body, Controller, Get, Post, HttpCode, Logger,
  UseInterceptors, UploadedFiles, BadRequestException, HttpException, HttpStatus,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { RemisionesService } from './remisiones.service';

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

const MULTER_OPTS = {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB por archivo
  fileFilter: (_req: any, file: Express.Multer.File, cb: (error: Error | null, accept: boolean) => void) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestException(`Tipo de archivo no permitido: ${file.mimetype}. Solo PDF, JPEG y PNG.`), false);
    }
  },
};

@Controller('remisiones')
export class RemisionesController {
  private readonly logger = new Logger(RemisionesController.name);

  constructor(private readonly remisionesService: RemisionesService) {}

  @Get('catalogs')
  getCatalogs() {
    return this.remisionesService.getCatalogs();
  }

  @Post('buscar-cliente')
  @HttpCode(200)
  async buscarCliente(@Body('documento') documento: string) {
    if (!documento) throw new BadRequestException('documento es requerido');
    return this.remisionesService.buscarCliente(documento);
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

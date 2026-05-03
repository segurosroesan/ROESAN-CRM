import { Body, Controller, Post, Logger, HttpCode, UseInterceptors, UploadedFile, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DocumentosService } from './documentos.service';

const DOC_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const docFilter = (_req: any, file: Express.Multer.File, cb: (e: Error | null, ok: boolean) => void) => {
  if (DOC_MIME_TYPES.includes(file.mimetype)) cb(null, true);
  else cb(new BadRequestException(`Solo PDF o imágenes. Recibido: ${file.mimetype}`), false);
};
const DOC_OPTS = { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: docFilter };

@Controller('documentos')
export class DocumentosController {
  private readonly logger = new Logger(DocumentosController.name);

  constructor(private readonly documentosService: DocumentosService) {}

  @Post('parse')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', DOC_OPTS))
  async parseDocumento(
    @UploadedFile() file: any,
    @Body('tipo') tipo: 'CEDULA' | 'RUT' | 'SARLAFT' | 'POLIZA'
  ) {
    if (!file) throw new BadRequestException('Archivo no proporcionado');
    if (!tipo) throw new BadRequestException('Tipo de documento no proporcionado');

    this.logger.log(`Solicitud de parseo de documento: ${file.originalname} tipo ${tipo}`);
    try {
      return await this.documentosService.parsearDocumento(file.buffer, file.mimetype, tipo);
    } catch (e: any) {
      throw new HttpException({ error: e.message }, HttpStatus.BAD_GATEWAY);
    }
  }

  @Post('sync')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', DOC_OPTS))
  async syncToSoft(
    @UploadedFile() file: any,
    @Body('leadId') leadId: string,
    @Body('tipo') tipo: 'CEDULA' | 'RUT' | 'SARLAFT' | 'POLIZA',
    @Body('extractedData') extractedDataRaw: string,
    @Body('softClientId') softClientId?: string,
    @Body('softPolicyId') softPolicyId?: string
  ) {
    if (!leadId) throw new BadRequestException('leadId no proporcionado');
    
    let extractedData = {};
    try {
      extractedData = JSON.parse(extractedDataRaw);
    } catch (e) {
      this.logger.warn('Failed to parse extractedData JSON string');
    }

    this.logger.log(`Solicitud de sincronización de ${tipo} para lead ${leadId}`);
    
    return await this.documentosService.syncToSoft({
      leadId,
      tipo,
      extractedData,
      softClientId,
      softPolicyId,
      fileBuffer: file?.buffer,
      fileName: file?.originalname,
      mimeType: file?.mimetype
    });
  }
}

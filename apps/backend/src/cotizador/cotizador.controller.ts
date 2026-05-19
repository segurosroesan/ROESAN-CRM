import { Body, Controller, Post, Logger, HttpCode, UseInterceptors, UploadedFile, UploadedFiles, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CotizadorService } from './cotizador.service';
import { CotizarDto } from '../lib/qualitas-api';
import type { GenerarCorreoParams } from './email-generator';

const PDF_MIME_TYPES = ['application/pdf'];
const pdfFilter = (_req: any, file: Express.Multer.File, cb: (e: Error | null, ok: boolean) => void) => {
  if (PDF_MIME_TYPES.includes(file.mimetype)) cb(null, true);
  else cb(new BadRequestException(`Solo se aceptan archivos PDF. Recibido: ${file.mimetype}`), false);
};
const PDF_OPTS = { storage: memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 }, fileFilter: pdfFilter };

@Controller('cotizador')
export class CotizadorController {
  private readonly logger = new Logger(CotizadorController.name);

  constructor(private readonly cotizadorService: CotizadorService) {}

  @Post('qualitas')
  @HttpCode(200)
  async cotizarQualitas(@Body() dto: CotizarDto) {
    this.logger.log(`Solicitud cotización Qualitas — doc: ${dto.documento}`);
    try {
      return await this.cotizadorService.cotizarQualitas(dto);
    } catch (e: any) {
      this.logger.error(`Qualitas falló: ${e.message}`);
      throw new HttpException({ error: e.message }, HttpStatus.UNPROCESSABLE_ENTITY);
    }
  }

  @Post('allianz')
  @HttpCode(200)
  async cotizarAllianz(@Body() dto: CotizarDto) {
    this.logger.log(`Solicitud cotización Allianz — placa: ${dto.placa}`);
    try {
      return await this.cotizadorService.cotizarAllianz(dto);
    } catch (e: any) {
      this.logger.error(`Allianz falló: ${e.message}`);
      throw new HttpException({ error: e.message }, HttpStatus.UNPROCESSABLE_ENTITY);
    }
  }

  @Post('sbs')
  @HttpCode(200)
  async cotizarSBS(@Body() dto: CotizarDto) {
    this.logger.log(`Solicitud cotización SBS — doc: ${dto.documento}`);
    try {
      return await this.cotizadorService.cotizarSBS(dto);
    } catch (e: any) {
      this.logger.error(`SBS falló: ${e.message}`);
      throw new HttpException({ error: e.message }, HttpStatus.UNPROCESSABLE_ENTITY);
    }
  }

  @Post('all')
  @HttpCode(200)
  async cotizarTodo(@Body() dto: CotizarDto) {
    this.logger.log(`Solicitud cotización múltiple — doc: ${dto.documento}`);
    return this.cotizadorService.cotizarTodo(dto);
  }

  @Post('comparar')
  @HttpCode(200)
  async compararCotizaciones(@Body() body: { cotizaciones: any[]; forzar_recomendada?: string }) {
    const { cotizaciones, forzar_recomendada } = body;
    this.logger.log(`Solicitud de comparación IA para ${cotizaciones?.length || 0} cotizaciones${forzar_recomendada ? ` (forzando ${forzar_recomendada})` : ''}`);
    try {
      return await this.cotizadorService.compararCotizaciones(cotizaciones, forzar_recomendada);
    } catch (e: any) {
      this.logger.error(`Comparador IA falló: ${e.message}`);
      throw new HttpException({ error: e.message }, HttpStatus.UNPROCESSABLE_ENTITY);
    }
  }

  @Post('email')
  @HttpCode(200)
  async generarCorreo(@Body() params: GenerarCorreoParams) {
    this.logger.log(`Solicitud para generar correo al cliente`);
    return this.cotizadorService.generarCorreoCliente(params);
  }

  @Post('parse-pdf')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', PDF_OPTS))
  async parsePdfCotizacion(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('Archivo no proporcionado');
    }
    this.logger.log(`Solicitud de parseo de PDF: ${file.originalname}`);
    try {
      return await this.cotizadorService.parsearPdfCotizacion(file.buffer, file.mimetype);
    } catch (e: any) {
      this.logger.error(`Parse PDF falló: ${e.message}`);
      throw new HttpException({ error: e.message }, HttpStatus.UNPROCESSABLE_ENTITY);
    }
  }

  @Post('parse-pdfs')
  @HttpCode(200)
  @UseInterceptors(FilesInterceptor('files', 20, PDF_OPTS))
  async parsePdfsCotizacion(@UploadedFiles() files: any[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Archivos no proporcionados');
    }
    this.logger.log(`Solicitud de parseo de ${files.length} PDFs`);
    try {
      return await this.cotizadorService.parsearMultiplesPdfsCotizacion(files);
    } catch (e: any) {
      this.logger.error(`Parse PDFs falló: ${e.message}`);
      throw new HttpException({ error: e.message }, HttpStatus.UNPROCESSABLE_ENTITY);
    }
  }
}

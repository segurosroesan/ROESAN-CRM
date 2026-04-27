import { Body, Controller, Post, Logger, HttpCode, UseInterceptors, UploadedFile, UploadedFiles, BadRequestException } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { CotizadorService } from './cotizador.service';
import { CotizarDto } from '../lib/qualitas-api';
import type { GenerarCorreoParams } from './email-generator';

@Controller('cotizador')
export class CotizadorController {
  private readonly logger = new Logger(CotizadorController.name);

  constructor(private readonly cotizadorService: CotizadorService) {}

  @Post('qualitas')
  @HttpCode(200)
  async cotizarQualitas(@Body() dto: CotizarDto) {
    this.logger.log(`Solicitud cotización Qualitas — doc: ${dto.documento}`);
    return this.cotizadorService.cotizarQualitas(dto);
  }

  @Post('allianz')
  @HttpCode(200)
  async cotizarAllianz(@Body() dto: CotizarDto) {
    this.logger.log(`Solicitud cotización Allianz — placa: ${dto.placa}`);
    return this.cotizadorService.cotizarAllianz(dto);
  }

  @Post('all')
  @HttpCode(200)
  async cotizarTodo(@Body() dto: CotizarDto) {
    this.logger.log(`Solicitud cotización múltiple — doc: ${dto.documento}`);
    return this.cotizadorService.cotizarTodo(dto);
  }

  @Post('comparar')
  @HttpCode(200)
  async compararCotizaciones(@Body('cotizaciones') cotizaciones: any[]) {
    this.logger.log(`Solicitud de comparación IA para ${cotizaciones?.length || 0} cotizaciones`);
    return this.cotizadorService.compararCotizaciones(cotizaciones);
  }

  @Post('email')
  @HttpCode(200)
  async generarCorreo(@Body() params: GenerarCorreoParams) {
    this.logger.log(`Solicitud para generar correo al cliente`);
    const body = this.cotizadorService.generarCorreoCliente(params);
    return { body };
  }

  @Post('parse-pdf')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file'))
  async parsePdfCotizacion(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('Archivo no proporcionado');
    }
    this.logger.log(`Solicitud de parseo de PDF: ${file.originalname}`);
    return this.cotizadorService.parsearPdfCotizacion(file.buffer, file.mimetype);
  }

  @Post('parse-pdfs')
  @HttpCode(200)
  @UseInterceptors(FilesInterceptor('files'))
  async parsePdfsCotizacion(@UploadedFiles() files: any[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Archivos no proporcionados');
    }
    this.logger.log(`Solicitud de parseo de ${files.length} PDFs`);
    return this.cotizadorService.parsearMultiplesPdfsCotizacion(files);
  }
}

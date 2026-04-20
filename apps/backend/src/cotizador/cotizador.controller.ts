import { Body, Controller, Post, Logger, HttpCode } from '@nestjs/common';
import { CotizadorService } from './cotizador.service';
import { CotizarDto } from '../lib/qualitas-api';

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
}

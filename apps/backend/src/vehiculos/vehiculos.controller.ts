import { Controller, Get, Param, Logger } from '@nestjs/common';
import { VehiculosService } from './vehiculos.service';

@Controller('vehiculos')
export class VehiculosController {
  private readonly logger = new Logger(VehiculosController.name);

  constructor(private readonly vehiculosService: VehiculosService) {}

  @Get('placa/:placa')
  async consultarPlaca(@Param('placa') placa: string) {
    this.logger.log(`Petición para consultar placa: ${placa}`);
    return await this.vehiculosService.consultarPorPlaca(placa);
  }
}

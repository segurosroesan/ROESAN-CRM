import { Controller, Post, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { PropuestaTrackingService } from './propuesta-tracking.service';

@Controller('propuestas')
export class PropuestaTrackingController {
  constructor(private readonly trackingService: PropuestaTrackingService) {}

  @Post(':id/vista')
  @HttpCode(HttpStatus.OK)
  registrarVista(@Param('id') id: string) {
    return this.trackingService.registrarVista(id);
  }
}

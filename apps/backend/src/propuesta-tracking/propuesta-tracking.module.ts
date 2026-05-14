import { Module } from '@nestjs/common';
import { PropuestaTrackingController } from './propuesta-tracking.controller';
import { PropuestaTrackingService } from './propuesta-tracking.service';

@Module({
  controllers: [PropuestaTrackingController],
  providers: [PropuestaTrackingService],
})
export class PropuestaTrackingModule {}

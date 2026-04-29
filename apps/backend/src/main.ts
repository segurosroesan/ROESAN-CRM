import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for frontend integration
  app.enableCors();
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3002;
  await app.listen(port);
  logger.log(`Backend CRM running on: http://localhost:${port}`);
}
bootstrap();

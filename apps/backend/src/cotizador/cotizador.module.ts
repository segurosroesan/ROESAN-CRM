import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CotizadorController } from './cotizador.controller';
import { CotizadorService } from './cotizador.service';
import { ComparadorService } from './comparador.service';
import { QualitasApi } from '../lib/qualitas-api';
import { AllianzApi } from '../lib/allianz-api';
import { SBSApi } from '../lib/sbs-api';

@Module({
  imports: [ConfigModule],
  controllers: [CotizadorController],
  providers: [
    CotizadorService,
    ComparadorService,
    {
      provide: 'QUALITAS_API',
      useFactory: (config: ConfigService) =>
        new QualitasApi(
          config.get('QUALITAS_URL', 'https://serviciosqa.qualitascolombia.com.co/Emision_QA/api/Emision'),
          config.get('QUALITAS_USER', ''),
          config.get('QUALITAS_PASSWORD', ''),
          config.get('QUALITAS_NO_NEGOCIO', '00003'),
          config.get('QUALITAS_AGENTE', '20001'),
        ),
      inject: [ConfigService],
    },
    {
      provide: 'ALLIANZ_API',
      useFactory: (config: ConfigService) =>
        new AllianzApi(
          config.get('ALLIANZ_URL', 'https://secure-eu-uat-colombia.apis.allianz.com/drswoc16/services/AutosIndividualWS'),
          config.get('ALLIANZ_PARTNER_ID', ''),
          config.get('ALLIANZ_AGENT_ID', ''),
          config.get('ALLIANZ_PARTNER_CODE', ''),
          config.get('ALLIANZ_AGENT_CODE', ''),
          config.get('ALLIANZ_CERT_PATH', './certs/CP100074_Int_PruebasRN2026.pfx'),
          config.get('ALLIANZ_CERT_PASSWORD', ''),
        ),
      inject: [ConfigService],
    },
    {
      provide: 'SBS_API',
      useFactory: (config: ConfigService) =>
        new SBSApi(
          config.get('SBS_URL', 'https://test.cotizadoresgenerales.com/wsCotizaAutos/CotizaAutos.asmx'),
          config.get('SBS_USER', ''),
          config.get('SBS_PASSWORD', ''),
        ),
      inject: [ConfigService],
    },
  ],
  exports: [ComparadorService],
})
export class CotizadorModule {}

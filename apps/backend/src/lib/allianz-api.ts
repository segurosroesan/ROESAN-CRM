import axios from 'axios';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import { parseStringPromise } from 'xml2js';
import { CotizarDto } from './qualitas-api';

export interface AllianzCobertura {
  id: string;
  nombre: string;
  sumaAsegurada: string;
  deducible: string;
}

export interface AllianzPaquete {
  id: string;
  nombre: string;
  coberturas: AllianzCobertura[];
  primaNeta: number;
  primaTotal: number;
}

export interface AllianzQuoteResult {
  aseguradora: 'Allianz';
  noCotizacion: string;
  vehiculo: {
    marca: string;
    tipo: string;
    version: string;
    año: string;
  };
  paquetes: AllianzPaquete[];
}

export class AllianzApi {
  private httpsAgent: https.Agent;
  private logger = new Logger('AllianzApi');

  constructor(
    private readonly url: string,
    private readonly partnerid: string,
    private readonly agentid: string,
    private readonly partnercode: string,
    private readonly agentcode: string,
    certPath: string,
    certPassword: string,
    certBase64?: string,
  ) {
    const resolvedCertPath = path.isAbsolute(certPath)
      ? certPath
      : path.resolve(process.cwd(), certPath);

    let certBuffer: Buffer | undefined;
    if (certPath && fs.existsSync(resolvedCertPath)) {
      certBuffer = fs.readFileSync(resolvedCertPath);
    } else if (certBase64) {
      certBuffer = Buffer.from(certBase64, 'base64');
      this.logger.log('Allianz: cargando certificado desde variable de entorno base64');
    } else {
      this.logger.warn(`Cert no encontrado en ${resolvedCertPath} y sin ALLIANZ_CERT_BASE64. mTLS deshabilitado — Allianz fallará.`);
    }

    this.httpsAgent = new https.Agent({
      ...(certBuffer ? { pfx: certBuffer, passphrase: certPassword } : {}),
      rejectUnauthorized: false,
    });

    this.logger.log(
      `Allianz config: partnerId=${this.partnerid ? 'SET' : 'EMPTY'}, ` +
      `agentId=${this.agentid ? 'SET' : 'EMPTY'}, ` +
      `partnerCode=${this.partnercode ? 'SET' : 'EMPTY'}, ` +
      `agentCode=${this.agentcode ? 'SET' : 'EMPTY'}, ` +
      `cert=${certBuffer ? 'LOADED' : 'MISSING'}`
    );
  }

  async cotizar(dto: CotizarDto): Promise<AllianzQuoteResult> {
    if (!dto.placa) {
      throw new Error('Allianz requiere placa del vehículo para cotizar');
    }

    const transactionNumber = String(Date.now()).slice(-11);
    const effectiveDate = dto.fechaInicio.replace(/-/g, '');
    const termDate = dto.fechaFin.replace(/-/g, '');

    const soapEnvelope = this.buildSoapEnvelope({
      transactionNumber,
      effectiveDate,
      termDate,
      dto,
    });

    this.logger.log(`Cotizando en Allianz — Placa: ${dto.placa}, Fasecolda: ${dto.claveFasecolda}`);

    let response: any;
    try {
      response = await axios.post(`${this.url}?codCia=3`, soapEnvelope, {
        httpsAgent: this.httpsAgent,
        headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: 'urn:call4' },
        timeout: 60000,
      });
    } catch (axiosError: any) {
      if (axiosError.response) {
        const data: string = typeof axiosError.response.data === 'string' ? axiosError.response.data : '';
        this.logger.error(`Allianz HTTP ${axiosError.response.status}: ${data.slice(0, 500)}`);
        const faultMatch = data.match(/<faultstring[^>]*>([\s\S]*?)<\/faultstring>/i);
        if (faultMatch) throw new Error(`Allianz error: ${faultMatch[1].trim()}`);
        throw new Error(`Allianz HTTP ${axiosError.response.status}: ${data.slice(0, 300) || 'Error del servidor'}`);
      }
      throw axiosError;
    }

    return this.parseResponse(response.data);
  }

  private buildSoapEnvelope(params: {
    transactionNumber: string;
    effectiveDate: string;
    termDate: string;
    dto: CotizarDto;
  }): string {
    const { transactionNumber, effectiveDate, termDate, dto } = params;

    const ownerBornDate = dto.fechaNacimiento
      ? dto.fechaNacimiento.replace(/-/g, '')
      : '19850101';

    const ownerSex = dto.sexo || 'M';

    const TIPO_DOC_MAPPING: Record<string, string> = {
      'CC': 'C',
      'CE': 'E',
      'NIT': 'N',
      'PP': 'P',
    };
    const docType = TIPO_DOC_MAPPING[dto.tipoDocumento] || 'C';

    const chargeXml =
      `<chargerequest>` +
      `<transactionnumber>${transactionNumber}</transactionnumber>` +
      `<authentication>` +
      `<company>COL</company>` +
      `<partnerid>${this.partnerid}</partnerid>` +
      `<agentid>${this.agentid}</agentid>` +
      `<partnercode>${this.partnercode}</partnercode>` +
      `<agentcode>${this.agentcode}</agentcode>` +
      `</authentication>` +
      `<operationheaders>` +
      `<operationtypecode>TA</operationtypecode>` +
      `<productcode>1243</productcode>` +
      `</operationheaders>` +
      `<cap>0</cap>` +
      `<effectivedate>${effectiveDate}</effectivedate>` +
      `<TermDate>${termDate}</TermDate>` +
      `<firstbill>0</firstbill>` +
      `<successive>0</successive>` +
      `<holderdoctype>${docType}</holderdoctype>` +
      `<holderdocnumber>${dto.documento}</holderdocnumber>` +
      `<ownerdoctype>${docType}</ownerdoctype>` +
      `<ownerdocnumber>${dto.documento}</ownerdocnumber>` +
      `<isholderdriver>S</isholderdriver>` +
      `<isholderowner>S</isholderowner>` +
      `<isnewowner>N</isnewowner>` +
      `<risktype>L0008</risktype>` +
      `<vehicleplate>${dto.placa!.toUpperCase()}</vehicleplate>` +
      `<vehicleorigin>480</vehicleorigin>` +
      `<vehiclefasecoldacode>${dto.claveFasecolda}</vehiclefasecoldacode>` +
      `<vehicleyear>${dto.modelo}</vehicleyear>` +
      `<riskdata>` +
      `<ownerborndate>${ownerBornDate}</ownerborndate>` +
      `<ownersex>${ownerSex}</ownersex>` +
      `<repowered>N</repowered>` +
      `<protectiondevicecode>4</protectiondevicecode>` +
      `<accessoriesvalue>0</accessoriesvalue>` +
      `<shieldingvalue>0</shieldingvalue>` +
      `<gassystemvalue>0</gassystemvalue>` +
      `<isnewvehicle>N</isnewvehicle>` +
      `<insuredvalue>0</insuredvalue>` +
      `<continuity>${dto.continuidad ?? 'N'}</continuity>` +
      `<circulationareadanecode>${dto.municipio}</circulationareadanecode>` +
      `<discountextension>N</discountextension>` +
      `<providefrom>0</providefrom>` +
      `<typedocdiscount></typedocdiscount>` +
      `<numdocdiscount></numdocdiscount>` +
      `</riskdata>` +
      `</chargerequest>`;

    const escaped = chargeXml
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    return (
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.allianz.com">` +
      `<soapenv:Header/>` +
      `<soapenv:Body><ws:call4><ws:xml>${escaped}</ws:xml></ws:call4></soapenv:Body>` +
      `</soapenv:Envelope>`
    );
  }

  private async parseResponse(soapResponse: string): Promise<AllianzQuoteResult> {
    // namespace prefix can vary (ns, ns2, return, etc.) — match any or none
    const match = soapResponse.match(/(?:[a-zA-Z0-9]*:)?return>([\s\S]*?)<\/(?:[a-zA-Z0-9]*:)?return/);
    if (!match) {
      const snippet = soapResponse.slice(0, 500);
      this.logger.error(`Allianz SOAP sin return tag. Fragmento: ${snippet}`);
      throw new Error(`Respuesta inesperada de Allianz: sin return en SOAP. Inicio: ${snippet}`);
    }
    const xml = match[1]
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/^﻿/, '')
      .trim();

    if (!xml.startsWith('<')) {
      this.logger.error(`Allianz return tag contiene texto plano (no XML): ${xml.slice(0, 300)}`);
      throw new Error(`Allianz error: ${xml}`);
    }

    const parsed = await parseStringPromise(xml, { explicitArray: false });
    // Root element can be ChargeResponse or chargerequest depending on env
    const res = parsed?.ChargeResponse ?? parsed?.chargerequest ?? Object.values(parsed ?? {})[0];

    if (!res) {
      this.logger.error(`Allianz XML parseado sin ChargeResponse: ${JSON.stringify(parsed).slice(0, 500)}`);
      throw new Error(`Respuesta inesperada de Allianz: sin ChargeResponse. Keys: ${Object.keys(parsed ?? {}).join(', ')}`);
    }

    if (res.Status === 'E') {
      const errMsg = res.Errors?.Error ?? 'Error desconocido de Allianz';
      throw new Error(`Allianz error: ${JSON.stringify(errMsg)}`);
    }

    const vehicle = res.VehicleDetails ?? {};
    const rawPaquetes = Array.isArray(res.Package) ? res.Package : res.Package ? [res.Package] : [];

    const paquetes: AllianzPaquete[] = rawPaquetes.map((pkg: any) => {
      const rawCoberturas = Array.isArray(pkg.Coverage) ? pkg.Coverage : pkg.Coverage ? [pkg.Coverage] : [];
      const coberturas: AllianzCobertura[] = rawCoberturas.map((c: any) => ({
        id: c.CoverageId ?? '',
        nombre: c.CoverageName ?? '',
        sumaAsegurada: c.InsuredValue ?? '0',
        deducible: c.Deductible ?? '0',
      }));

      const rawPayments = Array.isArray(pkg.Payment) ? pkg.Payment : pkg.Payment ? [pkg.Payment] : [];
      const anual = rawPayments.find((p: any) => String(p.PaymentId ?? '').toUpperCase() === 'ANUAL') ?? rawPayments[0];
      const primaTotal = parseFloat(anual?.PremiumValue ?? '0');

      return {
        id: pkg.PackageId ?? '',
        nombre: pkg.PackageName ?? '',
        coberturas,
        primaNeta: primaTotal / 1.19,
        primaTotal,
      };
    });

    return {
      aseguradora: 'Allianz',
      noCotizacion: res.QuotationNumber ?? '',
      vehiculo: {
        marca: vehicle.Brand ?? '',
        tipo: vehicle.Type ?? '',
        version: vehicle.Version ?? '',
        año: vehicle.VehicleYear ?? '',
      },
      paquetes,
    };
  }
}

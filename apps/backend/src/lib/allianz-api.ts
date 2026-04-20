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
  ) {
    const resolvedCertPath = path.isAbsolute(certPath)
      ? certPath
      : path.resolve(process.cwd(), certPath);

    this.httpsAgent = new https.Agent({
      pfx: fs.readFileSync(resolvedCertPath),
      passphrase: certPassword,
      rejectUnauthorized: false, // UAT usa certificado autofirmado de Allianz
    });
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

    const response = await axios.post(`${this.url}?codCia=3`, soapEnvelope, {
      httpsAgent: this.httpsAgent,
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: 'urn:call4' },
      timeout: 60000,
    });

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
      : '';

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
      `<holderdoctype>C</holderdoctype>` +
      `<holderdocnumber>${dto.documento}</holderdocnumber>` +
      `<isholderdriver>S</isholderdriver>` +
      `<isholderowner>S</isholderowner>` +
      `<ownerdoctype>C</ownerdoctype>` +
      `<ownerdocnumber>${dto.documento}</ownerdocnumber>` +
      `<risktype>L0008</risktype>` +
      `<vehicleplate>${dto.placa!.toUpperCase()}</vehicleplate>` +
      `<vehicleorigin>480</vehicleorigin>` +
      `<vehiclefasecoldacode>${dto.claveFasecolda}</vehiclefasecoldacode>` +
      `<vehicleyear>${dto.modelo}</vehicleyear>` +
      `<riskdata>` +
      (ownerBornDate ? `<ownerborndate>${ownerBornDate}</ownerborndate>` : '') +
      (dto.sexo ? `<ownersex>${dto.sexo}</ownersex>` : '') +
      `<repowered>N</repowered>` +
      `<protectiondevicecode>4</protectiondevicecode>` +
      `<accessoriesvalue>0</accessoriesvalue>` +
      `<shieldingvalue>0</shieldingvalue>` +
      `<gassystemvalue>0</gassystemvalue>` +
      `<isnewvehicle>N</isnewvehicle>` +
      `<insuredvalue>0</insuredvalue>` +
      `<continuity>${dto.continuidad ?? 'S'}</continuity>` +
      `<circulationareadanecode>${dto.municipio}</circulationareadanecode>` +
      `<discountextension>N</discountextension>` +
      `<providefrom>0</providefrom>` +
      `<typedocdiscount></typedocdiscount>` +
      `<numdocdiscount></numdocdiscount>` +
      `</riskdata>` +
      `<isnewowner>N</isnewowner>` +
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
    // Extract inner XML string from SOAP call4Response wrapper
    const match = soapResponse.match(/ns:return>([\s\S]*?)<\/ns:return/);
    if (!match) {
      throw new Error('Respuesta inesperada de Allianz: sin ns:return en SOAP response');
    }
    const xml = match[1]
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"');

    const parsed = await parseStringPromise(xml, { explicitArray: false });
    const res = parsed?.ChargeResponse;

    if (!res) {
      throw new Error('Respuesta inesperada de Allianz: sin ChargeResponse');
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
      const anual = rawPayments.find((p: any) => p.PaymentId === 'ANUAL');
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

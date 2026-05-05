import axios from 'axios';
import { Logger } from '@nestjs/common';
import { parseStringPromise } from 'xml2js';
import { CotizarDto } from './qualitas-api';

export interface SBSQuoteResult {
  aseguradora: 'SBS';
  noCotizacion: string;
  primaTotal: number;
  coberturas: Array<{
    nombre: string;
    sumaAsegurada: string;
    deducible: string;
  }>;
}

export class SBSApi {
  private readonly logger = new Logger('SBSApi');

  constructor(
    private readonly url: string,
    private readonly user: string,
    private readonly pass: string,
  ) {}

  async cotizar(dto: CotizarDto): Promise<SBSQuoteResult> {
    // 1. Crear Sesión
    const sessionId = await this.crearSesion(dto);
    
    // 2. Cotizar y Cerrar Sesión
    return this.cotizarYCerrar(sessionId, dto);
  }

  private async crearSesion(dto: CotizarDto): Promise<string> {
    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://schemas.xmlsoap.org/soap/envelope/">
  <soap12:Body>
    <SBSAutos_CrearSesion_Paquete xmlns="http://tempuri.org/">
      <NomUsu>${this.user}</NomUsu>
      <Passwd>${this.pass}</Passwd>
      <TipoDocAseg>${this.mapTipoDoc(dto.tipoDocumento)}</TipoDocAseg>
      <NumDocAseg>${dto.documento}</NumDocAseg>
      <Apellido1Aseg>PROSPECTO</Apellido1Aseg>
      <Apellido2Aseg></Apellido2Aseg>
      <NombresAseg>CLIENTE CRM</NombresAseg>
      <IdNacionalidad>1</IdNacionalidad>
      <IdPaisNacimiento>1</IdPaisNacimiento>
      <IdGeneroAseg>${dto.sexo?.toUpperCase() === 'F' ? 2 : 1}</IdGeneroAseg>
      <FechaNacimientoAseg>${dto.fechaNacimiento ? dto.fechaNacimiento + 'T00:00:00' : '1985-01-01T00:00:00'}</FechaNacimientoAseg>
      <CelularContacto>3000000000</CelularContacto>
      <MailContacto>comercial@roesan.com</MailContacto>
      <CodFasecolda>${dto.claveFasecolda}</CodFasecolda>
      <Modelo>${dto.modelo}</Modelo>
      <autoEsCeroKm>0</autoEsCeroKm>
      <idCiudad>${this.mapCiudad(dto.municipio)}</idCiudad>
      <placa>${dto.placa || 'PROVIS'}</placa>
      <valAccesorios>0</valAccesorios>
      <valVehiculoOpcional>0</valVehiculoOpcional>
      <IdPaqueteSugerido>1</IdPaqueteSugerido>
      <idOpcionRC>1</idOpcionRC>
      <idOpcionRCExceso>1</idOpcionRCExceso>
      <idOpcionDeducPPD>1</idOpcionDeducPPD>
      <idOpcionDeducPTD>1</idOpcionDeducPTD>
      <idOpcionDeducPPH>1</idOpcionDeducPPH>
      <idOpcionDeducPTH>1</idOpcionDeducPTH>
    </SBSAutos_CrearSesion_Paquete>
  </soap12:Body>
</soap12:Envelope>`;

    try {
      const response = await axios.post(this.url, soapEnvelope, {
        headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      });

      const parsed = await parseStringPromise(response.data, { explicitArray: false, ignoreNamespaces: true });
      const result = parsed.Envelope.Body.SBSAutos_CrearSesion_PaqueteResponse.SBSAutos_CrearSesion_PaqueteResult;

      if (result.Mensaje_Validacion && result.Mensaje_Validacion !== 'OK') {
        throw new Error(`SBS CrearSesion: ${result.Mensaje_Validacion}`);
      }

      return result.No_Sesion;
    } catch (error: any) {
      this.logger.error(`Error en SBS CrearSesion: ${error.message}`);
      throw error;
    }
  }

  private async cotizarYCerrar(sessionId: string, dto: CotizarDto): Promise<SBSQuoteResult> {
    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://schemas.xmlsoap.org/soap/envelope/">
  <soap12:Body>
    <SBSAutos_CotizaryCerrarSesion_Paquete xmlns="http://tempuri.org/">
      <NomUsu>${this.user}</NomUsu>
      <Passwd>${this.pass}</Passwd>
      <No_Sesion>${sessionId}</No_Sesion>
      <IdPaqueteSugerido>1</IdPaqueteSugerido>
    </SBSAutos_CotizaryCerrarSesion_Paquete>
  </soap12:Body>
</soap12:Envelope>`;

    try {
      const response = await axios.post(this.url, soapEnvelope, {
        headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      });

      const parsed = await parseStringPromise(response.data, { explicitArray: false, ignoreNamespaces: true });
      const res = parsed.Envelope.Body.SBSAutos_CotizaryCerrarSesion_PaqueteResponse.SBSAutos_CotizaryCerrarSesion_PaqueteResult;

      if (res.Mensaje_Validacion && res.Mensaje_Validacion !== 'OK') {
        throw new Error(`SBS Cotizar: ${res.Mensaje_Validacion}`);
      }

      const cotizacion = res.cotizaciones.stResultadoCotizacion;
      const primaTotal = parseFloat(cotizacion.PrimaTotal);

      return {
        aseguradora: 'SBS',
        noCotizacion: cotizacion.NoCotizacion,
        primaTotal: primaTotal,
        coberturas: [] // SBS devuelve un PDF usualmente, o coberturas en el XML si se requiere parsear mas a fondo
      };
    } catch (error: any) {
      this.logger.error(`Error en SBS Cotizar: ${error.message}`);
      throw error;
    }
  }

  private mapTipoDoc(tipo: string): number {
    const map: Record<string, number> = { 'CC': 1, 'NIT': 2, 'CE': 3, 'PP': 4 };
    return map[tipo] || 1;
  }

  private mapCiudad(municipio: string): number {
    // TODO: Usar el excel de homologación de SBS si es necesario.
    // Por ahora, SBS suele usar códigos DANE o internos. Bogota suele ser 1.
    if (municipio === '11001') return 1;
    return 1; // Default Bogota
  }
}

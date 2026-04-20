import axios, { AxiosInstance } from 'axios';
import { Logger } from '@nestjs/common';

export class CotizarDto {
  claveFasecolda: string;
  modelo: number;
  placa?: string;
  uso?: string;
  servicio?: string;
  tipoDocumento: string;
  documento: string;
  fechaNacimiento?: string;
  sexo?: string;
  departamento: string;
  municipio: string;
  fechaInicio: string;
  fechaFin: string;
  formaPago?: string;
  paquete?: string;
  sumaAsegurada?: number;
  continuidad?: 'S' | 'N'; // S = renovación/tiene póliza previa, N = primera vez (vehículo nuevo)
  leadId?: string;
}

export interface QualitasCobertura {
  codigo: string;
  nombre: string;
  sumaAsegurada: string;
  prima: string;
  deducible: string;
}

export interface QualitasQuoteResult {
  aseguradora: 'Qualitas';
  noCotizacion: string;
  primaNeta: number;
  primaTotal: number;
  iva: number;
  gastoExpedicion: number;
  coberturas: QualitasCobertura[];
}

const COBERTURAS_NOMBRES: Record<string, string> = {
  '01': 'Pérdida Parcial por Daños',
  '02': 'Pérdida Total por Daños',
  '03': 'Pérdida Parcial por Hurto',
  '04': 'Responsabilidad Civil',
  '05': 'Gastos Médicos',
  '07': 'Abogados',
  '14': 'Asistencia en Viaje',
  '15': 'Pérdida de Llaves',
  '17': 'Gastos de Transporte PT',
  '28': 'Gastos de Transporte PP',
  '43': 'Llantas Estalladas',
  '48': 'Rotura de Vidrios',
  '74': 'Pérdida Total por Hurto',
  '75': 'Afectaciones Accidente Tránsito',
  '76': 'Gastos Mascotas Accidente',
  '77': 'Pequeños Accesorios',
};

const COBERTURAS_PLAN_AMPLIO = [
  { NoCobertura: '01', SumaAsegurada: '0', Deducible: 'M|0|1500000', TipoSuma: '02', Prima: '' },
  { NoCobertura: '02', SumaAsegurada: '0', Deducible: 'P|C|0', TipoSuma: '02', Prima: '' },
  { NoCobertura: '03', SumaAsegurada: '0', Deducible: 'P|C|0', TipoSuma: '02', Prima: '' },
  { NoCobertura: '04', SumaAsegurada: '2000000000', Deducible: '', TipoSuma: '', Prima: '' },
  { NoCobertura: '74', SumaAsegurada: '0', Deducible: 'P|C|0', TipoSuma: '02', Prima: '' },
  { NoCobertura: '14', SumaAsegurada: '01', Deducible: '0', TipoSuma: '1', Prima: '' },
  { NoCobertura: '15', SumaAsegurada: '01', Deducible: '0', TipoSuma: '1', Prima: '' },
  { NoCobertura: '48', SumaAsegurada: '01', Deducible: '0', TipoSuma: '1', Prima: '' },
];

export class QualitasApi {
  private client: AxiosInstance;
  private logger = new Logger('QualitasApi');

  constructor(
    private readonly url: string,
    private readonly user: string,
    private readonly password: string,
    private readonly noNegocio: string,
    private readonly agente: string,
  ) {
    this.client = axios.create({
      auth: { username: user, password },
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async cotizar(dto: CotizarDto): Promise<QualitasQuoteResult> {
    const correlationalID = `CRM-${Date.now()}`;

    const consideracionesDA: any[] = [];
    if (dto.fechaNacimiento) {
      consideracionesDA.push({ NoConsideracion: '40', TipoRegla: '19', ValorRegla: '1' });
      consideracionesDA.push({ NoConsideracion: '40', TipoRegla: '20', ValorRegla: dto.fechaNacimiento });
    }
    if (dto.sexo) {
      consideracionesDA.push({ NoConsideracion: '40', TipoRegla: '56', ValorRegla: dto.sexo });
    }

    const payload = {
      correlationalID,
      Movimientos: [
        {
          Movimiento: {
            referencialID: '01',
            TipoMovimiento: '02',
            NoNegocio: this.noNegocio,
            DatosAsegurado: {
              Departamento: dto.departamento,
              CodigoMunicipio: dto.municipio,
              ...(consideracionesDA.length > 0 && { ConsideracionesAdicionalesDA: consideracionesDA }),
            },
            DatosVehiculo: [
              {
                NoInciso: '1',
                ClaveFasecolda: dto.claveFasecolda,
                Modelo: dto.modelo,
                Uso: dto.uso ?? '1',
                Servicio: dto.servicio ?? '1',
                Paquete: dto.paquete ?? '01',
                Coberturas: COBERTURAS_PLAN_AMPLIO,
              },
            ],
            DatosGenerales: {
              FechaEmision: new Date().toISOString().split('T')[0],
              FechaInicio: dto.fechaInicio,
              FechaTermino: dto.fechaFin,
              Moneda: '00',
              Agente: this.agente,
              FormaPago: dto.formaPago ?? 'A',
            },
          },
        },
      ],
    };

    this.logger.log(`Cotizando en Qualitas — Fasecolda: ${dto.claveFasecolda}, Modelo: ${dto.modelo}`);

    const response = await this.client.post(this.url, payload);
    return this.parseResponse(response.data);
  }

  private parseResponse(data: any): QualitasQuoteResult {
    const movimiento = data?.Movimientos?.[0]?.Movimiento;
    if (!movimiento) {
      throw new Error('Respuesta inesperada de Qualitas: sin movimiento');
    }

    const primas = movimiento.Primas ?? {};
    const coberturas: QualitasCobertura[] = (movimiento.DatosVehiculo?.[0]?.Coberturas ?? [])
      .filter((c: any) => parseFloat(c.Prima) > 0)
      .map((c: any) => ({
        codigo: c.NoCobertura,
        nombre: COBERTURAS_NOMBRES[c.NoCobertura] ?? `Cobertura ${c.NoCobertura}`,
        sumaAsegurada: c.SumaAsegurada,
        prima: c.Prima,
        deducible: c.Deducible,
      }));

    return {
      aseguradora: 'Qualitas',
      noCotizacion: movimiento.NoCotizacion ?? '',
      primaNeta: primas.PrimaNeta ?? 0,
      primaTotal: primas.PrimaTotal ?? 0,
      iva: primas.IVA ?? 0,
      gastoExpedicion: primas.GastoExpedicion ?? 0,
      coberturas,
    };
  }
}

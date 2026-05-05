import { Inject, Injectable, Logger } from '@nestjs/common';
import { ComparadorService } from '../cotizador/comparador.service';
import { SoftSegurosApi } from '../lib/soft-seguros-api';

@Injectable()
export class DocumentosService {
  private readonly logger = new Logger(DocumentosService.name);

  constructor(
    private readonly comparadorService: ComparadorService,
    @Inject('SOFT_SEGUROS_API') private readonly softApi: SoftSegurosApi,
  ) {}

  async parsearDocumento(buffer: Buffer, mimeType: string, tipo: 'CEDULA' | 'RUT' | 'SARLAFT' | 'POLIZA') {
    this.logger.log(`Solicitando parseo de documento tipo: ${tipo}`);
    return this.comparadorService.parsearDocumentoLegal(buffer, mimeType, tipo);
  }

  async syncToSoft(data: {
    leadId: string;
    tipo: 'CEDULA' | 'RUT' | 'SARLAFT' | 'POLIZA';
    extractedData: any;
    softClientId?: string;
    softPolicyId?: string;
    fileBuffer?: Buffer;
    fileName?: string;
    mimeType?: string;
  }) {
    const { tipo, extractedData, softClientId, softPolicyId, fileBuffer, fileName } = data;
    this.logger.log(`Sincronizando ${tipo} a Soft Seguros para lead ${data.leadId}`);

    let syncResult: any = {};

    try {
      // 1. Update Client if applicable
      if (softClientId && (tipo === 'CEDULA' || tipo === 'RUT' || tipo === 'SARLAFT')) {
        const clientPayload: any = {};
        if (tipo === 'CEDULA') {
          clientPayload.nombres = extractedData.nombres;
          clientPayload.apellidos = extractedData.apellidos;
          clientPayload.fecha_nacimiento = extractedData.fecha_nacimiento;
          clientPayload.genero = extractedData.genero;
        } else if (tipo === 'RUT') {
          clientPayload.direccion = extractedData.direccion;
          clientPayload.ciudad = extractedData.ciudad;
          clientPayload.provincia = extractedData.departamento;
        } else if (tipo === 'SARLAFT') {
          // Map occupation if needed
          if (extractedData.ocupacion) clientPayload.ocupacion_descripcion = extractedData.ocupacion;
        }

        if (Object.keys(clientPayload).length > 0) {
          syncResult.clientUpdate = await this.softApi.updateClient(softClientId, clientPayload);
        }
      }

      // 2. Update/Create Policy if applicable
      if (tipo === 'POLIZA' && softPolicyId) {
        const policyPayload: Record<string, any> = {};
        if (extractedData.numero_poliza) policyPayload.numero_poliza = extractedData.numero_poliza;
        if (extractedData.fecha_inicio) policyPayload.fecha_inicio = extractedData.fecha_inicio;
        if (extractedData.fecha_fin) policyPayload.fecha_fin = extractedData.fecha_fin;
        // prima is the correct Soft Seguros field name (not valor_prima)
        if (extractedData.prima_total) policyPayload.prima = extractedData.prima_total;
        if (extractedData.tomador_nombres) policyPayload.nombre_tomador = extractedData.tomador_nombres;
        if (extractedData.tomador_apellidos) policyPayload.apellido_tomador = extractedData.tomador_apellidos;
        if (extractedData.tomador_documento) policyPayload.cedula_tomador = extractedData.tomador_documento;
        if (extractedData.nombre_asegurado) policyPayload.nombre_asegurado = extractedData.nombre_asegurado;
        if (extractedData.cedula_asegurado) policyPayload.cedula_asegurado = extractedData.cedula_asegurado;
        if (extractedData.objeto_asegurado) policyPayload.codio_objeto_asegurado = extractedData.objeto_asegurado;

        syncResult.policyUpdate = await this.softApi.updatePolicy(softPolicyId, policyPayload);
      }

      // 3. Upload Attachment (SYNC-6)
      if (fileBuffer && fileName) {
        const isPolicyFile = tipo === 'POLIZA';
        
        if (isPolicyFile && !softPolicyId) {
          throw new Error('No se puede subir una carátula de póliza sin un ID de póliza en Soft Seguros. Sincroniza la póliza primero.');
        }

        const id_entidad = isPolicyFile ? Number(softPolicyId) : Number(softClientId);
        const tipo_entidad = isPolicyFile ? 'P' : 'C';

        if (id_entidad) {
          this.logger.log(`Subiendo anexo ${tipo} a entidad ${tipo_entidad}:${id_entidad}`);
          syncResult.attachment = await this.softApi.createAnexo({
            id_entidad,
            tipo_entidad,
            nombre_archivo: fileName,
            archivo_base64: fileBuffer.toString('base64'),
          });
        } else {
          this.logger.warn(`No se pudo determinar el ID de la entidad para subir el anexo ${tipo}`);
        }
      }

      return { success: true, ...syncResult };
    } catch (error) {
      this.logger.error(`Error sincronizando a Soft Seguros: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

import { Injectable, Inject, Logger } from '@nestjs/common';
import { SoftSegurosApi } from '../lib/soft-seguros-api';
import { getInstantAdmin } from '../lib/instant-admin';
import { tx } from '@instantdb/admin';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private db = getInstantAdmin();

  constructor(
    @Inject('SOFT_SEGUROS_API') private readonly softApi: SoftSegurosApi,
  ) {}

  /**
   * SYNC-1 & SYNC-2: Check if client exists, otherwise create it.
   * Updates the lead record with the soft_cliente_id.
   */
  async syncClientStatus(leadId: string, leadData: any) {
    const documento = leadData.documento || leadData.companyNit;
    this.logger.log(`Checking Soft Seguros for client with document: ${documento}`);
    
    try {
      const softClient = await this.softApi.getClientByDocument(documento);
      
      if (softClient) {
        this.logger.log(`Client found in Soft Seguros (SYNC-1): ID ${softClient.id}`);
        
        await this.db.transact([
          tx.leads[leadId].update({
            soft_cliente_id: String(softClient.id),
            sincronizado_soft: true,
            updatedAt: Date.now(),
          })
        ]);
        
        return { success: true, softClient, message: 'Cliente encontrado en Soft Seguros.' };
      }
      
      this.logger.log(`Client ${documento} not found in Soft Seguros. Executing SYNC-2...`);
      return await this.createClientInSoft(leadId, leadData);
    } catch (error) {
      this.logger.error(`Error in SYNC process: ${error.message}`);
      throw error;
    }
  }

  /**
   * SYNC-2: Create Client logic
   */
  async createClientInSoft(leadId: string, data: any) {
    try {
      // Create using the API library
      const newSoftClient = await this.softApi.createClient({
        numero_documento: data.documento || data.companyNit,
        nombres: data.name,
        correo: data.email,
        celular: data.phone,
      });

      // Update InstantDB with the new Soft Seguros reference
      await this.db.transact([
        tx.leads[leadId].update({
          soft_cliente_id: String(newSoftClient.id),
          sincronizado_soft: true,
          updatedAt: Date.now(),
        })
      ]);

      return { success: true, softClient: newSoftClient, message: 'Nuevo cliente creado en Soft Seguros (SYNC-2).' };
    } catch (error) {
      this.logger.error('SYNC-2 error: ', error);
      return { success: false, message: 'No se pudo crear el cliente en Soft Seguros. Verifica los datos requeridos.' };
    }
  }
}

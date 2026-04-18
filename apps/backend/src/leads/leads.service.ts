import { Injectable, Logger } from '@nestjs/common';
import { getInstantAdmin } from '../lib/instant-admin';
import { tx, id } from '@instantdb/admin';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);
  private db = getInstantAdmin();

  async create(leadData: any) {
    this.logger.log(`Processing new lead from ${leadData.source || 'Unknown'}`);

    const newLeadId = id();
    
    // Normalize phone to E.164 Colombia if possible
    let normalizedPhone = leadData.phone || leadData.celular || '';
    if (normalizedPhone && !normalizedPhone.startsWith('+')) {
      // Basic normalization for Colombia
      const numbersOnly = normalizedPhone.replace(/\D/g, '');
      if (numbersOnly.length === 10) {
        normalizedPhone = `+57${numbersOnly}`;
      }
    }

    // Mapping fields from common sources (like the Roesan website)
    const lead = {
      name: leadData.name || leadData.nombre || 'Lead sin nombre',
      phone: normalizedPhone,
      email: leadData.email || '',
      city: leadData.city || leadData.ciudad || '',
      type: leadData.type || leadData.ramo || 'otro',
      source: leadData.source || 'Sitio Web',
      
      // Dynamic fields from website schemas
      vehiclePlate: leadData.vehiclePlate || leadData.placa || undefined,
      vehicleBrand: leadData.vehicleBrand || undefined,
      vehicleModel: leadData.vehicleModel || undefined,
      vehicleYear: leadData.vehicleYear || undefined,
      
      // CRM status
      status: 'Nuevo',
      priority: 'Media',
      score: 0,
      
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    try {
      await this.db.transact([
        tx.leads[newLeadId].update(lead)
      ]);
      this.logger.log(`Successfully created lead ${newLeadId}`);
      return { id: newLeadId, ...lead };
    } catch (error) {
      this.logger.error(`Error creating lead: ${error.message}`);
      throw error;
    }
  }

  async findAll() {
    // In a real scenario, we might want to query through Admin SDK 
    // but InstantDB is usually queried from frontend. 
    // We'll expose this for internal backend use or sync checks.
    return []; 
  }
}

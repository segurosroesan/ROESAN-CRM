import { Injectable, Logger } from '@nestjs/common';
import { getInstantAdmin } from '../lib/instant-admin';
import { tx, id } from '@instantdb/admin';
import { GmailService } from '../gmail/gmail.service';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);
  private db = getInstantAdmin();

  constructor(private readonly gmailService: GmailService) {}

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

      const notifUserId = process.env.NOTIFICATION_USER_ID;
      if (notifUserId) {
        this.sendLeadNotification(notifUserId, lead).catch(err =>
          this.logger.warn(`Notificación de lead fallida: ${err.message}`)
        );
      }

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

  private async sendLeadNotification(userId: string, lead: any) {
    const subject = `Nuevo lead: ${lead.name} — ${lead.type}`;
    const fecha = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
    const body = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <h2 style="color:#1e40af">Nuevo lead en el CRM</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#64748b;width:120px">Nombre</td><td><strong>${lead.name}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Teléfono</td><td>${lead.phone || '—'}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Email</td><td>${lead.email || '—'}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Ramo</td><td>${lead.type}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Fuente</td><td>${lead.source}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Ciudad</td><td>${lead.city || '—'}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Recibido</td><td>${fecha}</td></tr>
        </table>
      </div>
    `;
    await this.gmailService.sendEmail(userId, 'comercial@roesan.com', subject, body);
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { getInstantAdmin } from '../lib/instant-admin';
import { tx } from '@instantdb/admin';

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);
  private db = getInstantAdmin();

  constructor(private configService: ConfigService) {}

  getOAuth2Client() {
    return new google.auth.OAuth2(
      this.configService.get('GOOGLE_CLIENT_ID'),
      this.configService.get('GOOGLE_CLIENT_SECRET'),
      this.configService.get('GOOGLE_CALLBACK_URL'),
    );
  }

  getAuthUrl(userId: string) {
    const oauth2Client = this.getOAuth2Client();
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/gmail.compose',
      ],
      state: userId,
    });
  }

  async handleCallback(code: string, userId: string) {
    const oauth2Client = this.getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      this.logger.warn(`No se recibió refresh_token para el usuario ${userId}. ¿Ya estaba vinculado?`);
    }

    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    await this.db.transact([
      tx.users[userId].update({
        googleEmail: userInfo.data.email,
        googleRefreshToken: tokens.refresh_token || undefined,
        updatedAt: Date.now(),
      }),
    ]);

    this.logger.log(`Gmail vinculado exitosamente para usuario ${userId}: ${userInfo.data.email}`);
    return userInfo.data;
  }

  /**
   * Envía un correo vía Resend API (HTTP, sin SMTP).
   * Requiere RESEND_API_KEY y RESEND_FROM en variables de entorno.
   */
  private async sendViaResend(
    to: string,
    from: string,
    subject: string,
    html: string,
    cc?: string,
  ): Promise<string> {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (!apiKey) throw new Error('RESEND_API_KEY no configurado en el servidor.');

    const payload: Record<string, unknown> = { from, to: [to], subject, html };
    if (cc) payload.cc = [cc];

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as { message?: string };
      throw new Error(`Resend: ${err.message || response.statusText}`);
    }

    const result = await response.json() as { id: string };
    return result.id;
  }

  /**
   * Envía un correo de propuesta al cliente.
   */
  async sendEmail(userId: string, to: string, subject: string, body: string, leadId?: string) {
    const from =
      this.configService.get<string>('RESEND_FROM') ||
      'Seguros Roesan <noreply@segurosroesan.com>';

    const id = await this.sendViaResend(to, from, subject, body);
    this.logger.log(`Correo de propuesta enviado a ${to}: ${subject} (${id})`);

    if (leadId) {
      await this.db.transact([
        tx.interacciones[crypto.randomUUID()].update({
          tipo: 'email',
          notas: `Enviado: ${subject}`,
          leadId,
          createdAt: Date.now(),
          metadata: { resendId: id, to, subject },
        }),
      ]);
    }

    return { id };
  }

  /**
   * Envía un correo de sistema (notificaciones internas).
   */
  async sendNotificationEmail(to: string, subject: string, html: string, cc?: string): Promise<void> {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY no configurado — notificación omitida.');
      return;
    }

    const from =
      this.configService.get<string>('RESEND_FROM') ||
      'CRM Roesan <noreply@segurosroesan.com>';

    try {
      await this.sendViaResend(to, from, subject, html, cc);
      this.logger.log(`Notificación enviada a ${to}: ${subject}`);
    } catch (err) {
      this.logger.error(`Error enviando notificación a ${to}: ${err}`);
    }
  }
}

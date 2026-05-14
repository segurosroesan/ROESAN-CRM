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
   * Envía un correo de propuesta desde el Gmail del asesor (OAuth).
   * El asesor debe haber vinculado su cuenta en Configuración.
   */
  async sendEmail(userId: string, to: string, subject: string, body: string, leadId?: string) {
    // Obtener el refresh_token del asesor desde InstantDB
    const result = await this.db.query({
      users: { $: { where: { id: userId } } },
    });
    const userData = (result as { data: { users: Array<{ googleRefreshToken?: string; googleEmail?: string }> } })
      .data?.users?.[0];

    if (!userData?.googleRefreshToken) {
      throw new Error(
        'Vincula tu cuenta de Gmail en Configuración antes de enviar correos desde tu dirección personal.',
      );
    }

    const oauth2Client = this.getOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: userData.googleRefreshToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Construir mensaje RFC 2822 con asunto codificado en UTF-8
    const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`;
    const raw = Buffer.from(
      [`To: ${to}`, `Subject: ${encodedSubject}`, 'MIME-Version: 1.0', 'Content-Type: text/html; charset=UTF-8', '', body].join('\r\n'),
    ).toString('base64url');

    const sent = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    this.logger.log(`Correo enviado desde ${userData.googleEmail} a ${to}: ${subject} (${sent.data.id})`);

    if (leadId) {
      await this.db.transact([
        tx.interacciones[crypto.randomUUID()].update({
          tipo: 'email',
          notas: `Enviado: ${subject}`,
          leadId,
          createdAt: Date.now(),
          metadata: { gmailMessageId: sent.data.id, to, subject },
        }),
      ]);
    }

    return { id: sent.data.id };
  }

  /**
   * Envía un correo de sistema (notificaciones internas) vía Resend HTTP API.
   * No depende de ningún usuario OAuth — remitente único configurado en RESEND_FROM.
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

    const payload: Record<string, unknown> = { from, to: [to], subject, html };
    if (cc) payload.cc = [cc];

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as { message?: string };
      this.logger.error(`Error Resend al enviar notificación a ${to}: ${err.message || response.statusText}`);
      return;
    }

    this.logger.log(`Notificación enviada a ${to}: ${subject}`);
  }
}

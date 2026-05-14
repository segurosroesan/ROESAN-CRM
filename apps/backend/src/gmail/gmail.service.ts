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
   * Envía un correo usando el Gmail OAuth del asesor.
   * Lanza error si el asesor no tiene Gmail vinculado.
   */
  private async sendViaGmailOAuth(
    userId: string,
    to: string,
    subject: string,
    html: string,
  ): Promise<string> {
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

    const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`;
    const raw = Buffer.from(
      [`To: ${to}`, `Subject: ${encodedSubject}`, 'MIME-Version: 1.0', 'Content-Type: text/html; charset=UTF-8', '', html].join('\r\n'),
    ).toString('base64url');

    const sent = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    this.logger.log(`Correo enviado desde ${userData.googleEmail} a ${to}: ${subject} (${sent.data.id})`);
    return sent.data.id ?? '';
  }

  /**
   * Envía un correo de propuesta al cliente desde el Gmail del asesor (OAuth).
   */
  async sendEmail(userId: string, to: string, subject: string, body: string, leadId?: string) {
    const id = await this.sendViaGmailOAuth(userId, to, subject, body);

    if (leadId) {
      await this.db.transact([
        tx.interacciones[crypto.randomUUID()].update({
          tipo: 'email',
          notas: `Enviado: ${subject}`,
          leadId,
          createdAt: Date.now(),
          metadata: { gmailMessageId: id, to, subject },
        }),
      ]);
    }

    return { id };
  }

  /**
   * Envía un correo de sistema o notificación.
   * Si se pasa userId → intenta Gmail OAuth del asesor; si falla o no hay userId → Resend.
   */
  async sendNotificationEmail(
    to: string,
    subject: string,
    html: string,
    cc?: string,
    userId?: string,
  ): Promise<void> {
    // Intentar Gmail OAuth del asesor si hay contexto de usuario
    if (userId) {
      try {
        await this.sendViaGmailOAuth(userId, to, subject, html);
        return;
      } catch (e) {
        this.logger.warn(`Gmail OAuth no disponible para notificación (${userId}), usando Resend: ${e}`);
      }
    }

    // Fallback: Resend HTTP API
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

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import * as nodemailer from 'nodemailer';
import { getInstantAdmin } from '../lib/instant-admin';
import { tx } from '@instantdb/admin';

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);
  private db = getInstantAdmin();

  constructor(private configService: ConfigService) {}

  /**
   * Obtiene un cliente OAuth2 configurado con las credenciales de la app.
   */
  getOAuth2Client() {
    return new google.auth.OAuth2(
      this.configService.get('GOOGLE_CLIENT_ID'),
      this.configService.get('GOOGLE_CLIENT_SECRET'),
      this.configService.get('GOOGLE_CALLBACK_URL'),
    );
  }

  /**
   * Genera la URL de autenticación para que el usuario vincule su cuenta.
   * IMPORTANTE: 'offline' y 'consent' son necesarios para obtener el refresh_token.
   */
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
      state: userId, // Pasamos el ID del usuario para saber de quién es el token al volver
    });
  }

  /**
   * Intercambia el código de autorización por tokens y los guarda en InstantDB.
   */
  async handleCallback(code: string, userId: string) {
    const oauth2Client = this.getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.refresh_token) {
      this.logger.warn(`No se recibió refresh_token para el usuario ${userId}. ¿Ya estaba vinculado?`);
    }

    // Obtener el correo vinculado
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    // Guardar en InstantDB
    await this.db.transact([
      tx.users[userId].update({
        googleEmail: userInfo.data.email,
        googleRefreshToken: tokens.refresh_token || undefined, // Solo lo actualizamos si viene nuevo
        updatedAt: Date.now(),
      }),
    ]);

    this.logger.log(`Gmail vinculado exitosamente para usuario ${userId}: ${userInfo.data.email}`);
    return userInfo.data;
  }

  /**
   * Envía un correo electrónico a nombre del asesor vinculado.
   */
  async sendEmail(userId: string, to: string, subject: string, body: string, leadId?: string) {
    // 1. Obtener el refresh token del usuario
    const userData = await this.db.query({ users: { $: { where: { id: userId } } } });
    const user = (userData as any)?.users?.[0];

    if (!user || !user.googleRefreshToken) {
      throw new Error('El usuario no tiene una cuenta de Gmail vinculada.');
    }

    // 2. Configurar cliente con el refresh token
    const oauth2Client = this.getOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: user.googleRefreshToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // 3. Construir el correo en formato RFC 2822
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
    const messageParts = [
      `To: ${to}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${utf8Subject}`,
      '',
      body,
    ];
    const message = messageParts.join('\n');

    // Codificar en Base64 seguro para URL
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // 4. Enviar
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    // 5. Registrar en el timeline del lead
    if (leadId) {
      await this.db.transact([
        tx.interacciones[crypto.randomUUID()].update({
          tipo: 'email',
          notas: `Enviado: ${subject}`,
          leadId,
          createdAt: Date.now(),
          metadata: {
            gmailMessageId: res.data.id,
            to,
            subject,
          }
        }),
      ]);
    }

    return res.data;
  }

  /**
   * Envía un correo de sistema (notificaciones internas) usando SMTP propio.
   * No depende de ningún usuario OAuth del CRM.
   * Variables necesarias: SMTP_USER, SMTP_PASS (Gmail app password).
   */
  async sendNotificationEmail(to: string, subject: string, html: string): Promise<void> {
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');

    if (!smtpUser || !smtpPass) {
      this.logger.warn('SMTP_USER o SMTP_PASS no configurados — notificación omitida.');
      return;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `"CRM Roesan" <${smtpUser}>`,
      to,
      subject,
      html,
    });

    this.logger.log(`Notificación enviada a ${to}: ${subject}`);
  }
}

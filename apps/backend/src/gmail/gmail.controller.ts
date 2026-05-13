import { Controller, Get, Post, Query, Res, Body, Param, HttpStatus, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import type { Response } from 'express';
import { GmailService } from './gmail.service';

@Controller('auth/google')
export class GmailController {
  constructor(private readonly gmailService: GmailService) {}

  /**
   * Redirige al usuario a la página de login de Google.
   * GET /api/auth/google/login?userId=...
   */
  @Get('login')
  async login(@Query('userId') userId: string, @Res() res: Response) {
    if (!userId) {
      throw new BadRequestException('userId is required to link account');
    }
    const url = this.gmailService.getAuthUrl(userId);
    return res.redirect(url);
  }

  /**
   * Callback de Google después de que el usuario autoriza.
   * GET /api/auth/google/callback?code=...&state=userId
   */
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') userId: string,
    @Res() res: Response,
  ) {
    try {
      await this.gmailService.handleCallback(code, userId);
      // Redirigir de vuelta al frontend (página de configuración)
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3003';
      return res.redirect(`${frontendUrl}/config?gmail=success`);
    } catch (error) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3003'}/config?gmail=error`);
    }
  }

  /**
   * Endpoint para enviar un correo desde un lead.
   * POST /api/auth/google/send
   */
  @Post('send')
  async sendEmail(
    @Body() body: { userId: string; to: string; subject: string; content: string; leadId: string },
  ) {
    try {
      return await this.gmailService.sendEmail(
        body.userId,
        body.to,
        body.subject,
        body.content,
        body.leadId,
      );
    } catch (error) {
      throw new InternalServerErrorException(error instanceof Error ? error.message : 'Error enviando correo');
    }
  }
}

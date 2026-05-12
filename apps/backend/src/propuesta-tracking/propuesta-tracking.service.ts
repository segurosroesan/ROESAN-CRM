import { Injectable, Logger } from '@nestjs/common';
import { getInstantAdmin } from '../lib/instant-admin';

const DESTINATARIOS = ['comercial@roesan.com', 'seguros@roesan.com', 'jorge.jaime.henao.romero@gmail.com'];
const DEDUP_WINDOW_MS = 60 * 60 * 1000; // 60 minutos

@Injectable()
export class PropuestaTrackingService {
  private readonly logger = new Logger(PropuestaTrackingService.name);

  async registrarVista(propuestaId: string): Promise<{ ok: boolean }> {
    const db = getInstantAdmin();

    // Consultar la propuesta para obtener los datos del cliente y vehículo
    const propuestaResult = await db.query({
      propuestas: { $: { where: { id: propuestaId } } },
    });

    const propuesta = propuestaResult.propuestas?.[0];
    if (!propuesta) {
      this.logger.warn(`Propuesta no encontrada: ${propuestaId}`);
      return { ok: false };
    }

    const ext = propuesta.extracted as any;
    const leadId = propuesta.leadId as string | undefined;
    const folio = ext?.folio || propuestaId.slice(0, 6).toUpperCase();
    const clienteNombre = ext?.cliente?.nombre || 'Cliente';
    const vehiculoMarca = ext?.vehiculo?.marca || '';
    const vehiculoAno = ext?.vehiculo?.año || '';

    // Verificar si hubo vista reciente (deduplicación)
    const vistasResult = await db.query({
      propuesta_vistas: { $: { where: { propuestaId } } },
    });

    const ahora = Date.now();
    const vistaReciente = (vistasResult.propuesta_vistas || []).find(
      (v: any) => ahora - v.createdAt < DEDUP_WINDOW_MS,
    );

    // Siempre registrar la vista (auditoría)
    const vistaId = crypto.randomUUID();
    const ops: any[] = [
      db.tx.propuesta_vistas[vistaId].update({
        propuestaId,
        leadId: leadId ?? null,
        createdAt: ahora,
      }),
    ];

    // Crear notificaciones solo si no hay vista reciente
    if (!vistaReciente) {
      const mensaje = `👁 ${clienteNombre} abrió la propuesta Folio ${folio}${vehiculoMarca ? ` — ${vehiculoMarca} ${vehiculoAno}` : ''}`;

      for (const email of DESTINATARIOS) {
        const notifId = crypto.randomUUID();
        ops.push(
          db.tx.notificaciones[notifId].update({
            tipo: 'propuesta_vista',
            mensaje,
            propuestaId,
            leadId: leadId ?? null,
            leida: false,
            destinatarioEmail: email,
            createdAt: ahora,
          }),
        );
      }

      this.logger.log(`Notificaciones enviadas para propuesta ${propuestaId} — ${clienteNombre}`);
    } else {
      this.logger.debug(`Vista deduplicada para propuesta ${propuestaId} (última hace ${Math.round((ahora - vistaReciente.createdAt) / 60000)} min)`);
    }

    await db.transact(ops);
    return { ok: true };
  }
}

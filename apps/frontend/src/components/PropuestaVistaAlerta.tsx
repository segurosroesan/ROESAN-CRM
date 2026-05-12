"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/instant-db";
import { X, Eye, MessageCircle } from "lucide-react";

interface Notificacion {
  id: string;
  mensaje: string;
  leadId?: string | null;
  propuestaId?: string | null;
  clienteNombre?: string | null;
  clienteTelefono?: string | null;
  createdAt: number;
}

function playChime() {
  try {
    const ctx = new AudioContext();
    // Melodía pentatónica ascendente-descendente ~5s (10 notas × 0.5s)
    const notes = [523, 659, 784, 988, 1047, 988, 784, 659, 523, 659];
    const step = 0.5;
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      const t = ctx.currentTime + i * step;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + step - 0.02);
      osc.start(t);
      osc.stop(t + step);
    });
  } catch {
    // El navegador puede bloquear AudioContext sin interacción previa
  }
}

interface ToastItem {
  notif: Notificacion;
  timer: ReturnType<typeof setTimeout>;
}

export function PropuestaVistaAlerta({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const seenIds = useRef<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Notificacion[]>([]);

  const { data } = db.useQuery({
    notificaciones: {
      $: {
        where: { destinatarioEmail: userEmail, leida: false },
        order: { serverCreatedAt: "desc" },
      },
    },
  });

  useEffect(() => {
    const notifs: Notificacion[] = (data?.notificaciones ?? []) as Notificacion[];

    // Detectar IDs no vistas en esta sesión (incluye las pendientes al cargar/refrescar)
    const nuevas = notifs.filter((n) => !seenIds.current.has(n.id));
    if (nuevas.length === 0) return;

    nuevas.forEach((n) => seenIds.current.add(n.id));
    playChime();
    setToasts((prev) => [...prev, ...nuevas]);
  }, [data]);

  function cerrarToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    marcarLeida(id);
  }

  function marcarLeida(id: string) {
    db.transact([db.tx.notificaciones[id].update({ leida: true })]);
  }

  function irAlLead(notif: Notificacion) {
    cerrarToast(notif.id);
    if (notif.leadId) {
      router.push(`/leads/${notif.leadId}`);
    }
  }

  return (
    <>
      {/* Contenedor de toasts — esquina inferior derecha */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((notif) => (
          <ToastCard
            key={notif.id}
            notif={notif}
            onClose={() => cerrarToast(notif.id)}
            onVerLead={() => irAlLead(notif)}
          />
        ))}
      </div>
    </>
  );
}

function ToastCard({
  notif,
  onClose,
  onVerLead,
}: {
  notif: Notificacion;
  onClose: () => void;
  onVerLead: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 15000);
    return () => clearTimeout(timer);
  }, [onClose]);

  // Extraer vehículo/folio del mensaje ("👁 Nombre abrió la propuesta Folio XX — Marca Año")
  const vehiculoMatch = notif.mensaje.match(/—\s*(.+)$/);
  const vehiculoInfo = vehiculoMatch ? vehiculoMatch[1].trim() : null;
  const folioMatch = notif.mensaje.match(/Folio\s+([A-Z0-9]+)/);
  const folio = folioMatch ? folioMatch[1] : null;

  const nombre = notif.clienteNombre || "Cliente";

  const waPhone = notif.clienteTelefono?.replace(/\D/g, "");
  const waMsg = encodeURIComponent(
    `Hola ${nombre}, vi que estás revisando tu propuesta de seguro con nosotros. ¿Tienes alguna pregunta? Con gusto te ayudo. 😊`
  );
  const waUrl = waPhone ? `https://wa.me/${waPhone}?text=${waMsg}` : null;

  return (
    <div
      className="pointer-events-auto w-[360px] rounded-2xl shadow-2xl border border-amber-200/40 overflow-hidden animate-slide-in-right"
      style={{ background: "linear-gradient(135deg, #1e103c 0%, #2a2960 100%)" }}
    >
      {/* Barra de progreso */}
      <div className="h-0.5 bg-amber-400/30">
        <div className="h-full bg-amber-400" style={{ animation: "shrink 15s linear forwards" }} />
      </div>

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-full bg-amber-400/20 border border-amber-400/30 flex items-center justify-center mt-0.5">
            <Eye className="w-5 h-5 text-amber-400" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/70">
              👁 Propuesta abierta
            </p>
            <p className="text-[17px] text-white font-black leading-tight mt-0.5">
              {nombre}
            </p>
            <p className="text-[12px] text-white/60 mt-0.5">
              está viendo tu propuesta ahora mismo
            </p>
          </div>

          <button
            onClick={onClose}
            className="shrink-0 text-white/40 hover:text-white/80 transition-colors p-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Detalle vehículo / folio */}
        {(vehiculoInfo || folio) && (
          <div className="mt-3 px-3 py-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2 text-[12px] text-white/70">
            {folio && <span className="font-bold text-amber-300">Folio {folio}</span>}
            {folio && vehiculoInfo && <span className="text-white/30">·</span>}
            {vehiculoInfo && <span>{vehiculoInfo}</span>}
          </div>
        )}

        {/* Botones */}
        <div className="mt-3 flex gap-2">
          {waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#25D366] text-white text-[13px] font-bold hover:bg-[#1ebe5d] transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </a>
          )}
          {notif.leadId && (
            <button
              onClick={onVerLead}
              className={`${waUrl ? "flex-1" : "w-full"} py-2 rounded-xl bg-amber-400 text-[#1e103c] text-[13px] font-bold hover:bg-amber-300 transition-colors`}
            >
              Ver lead →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Exportar también un hook para el conteo de notificaciones no leídas
export function useNotificacionesCount(userEmail: string): number {
  const { data } = db.useQuery({
    notificaciones: {
      $: {
        where: { destinatarioEmail: userEmail, leida: false },
      },
    },
  });
  return data?.notificaciones?.length ?? 0;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/instant-db";
import { X, UserPlus } from "lucide-react";

function playNewLeadSound() {
  try {
    const ctx = new AudioContext();
    [440, 554, 659].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      const t = ctx.currentTime + i * 0.15;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.start(t);
      osc.stop(t + 0.55);
    });
  } catch {
    /* AudioContext may be blocked before user interaction */
  }
}

const RAMO_LABELS: Record<string, string> = {
  auto: "Autos",
  soat: "SOAT",
  salud: "Salud",
  vida: "Vida",
  hogar: "Hogar",
  pyme: "PYME",
  cumplimiento: "Cumplimiento",
};

interface LeadToast {
  id: string;
  name: string;
  phone?: string;
  type: string;
  source?: string;
}

export function NuevoLeadAlerta() {
  const router = useRouter();
  const seenIds = useRef<Set<string>>(new Set());
  const mountTime = useRef(Date.now());
  const isInitialized = useRef(false);
  const [toasts, setToasts] = useState<LeadToast[]>([]);

  const { data } = db.useQuery({
    leads: {
      $: {
        order: { serverCreatedAt: "desc" },
        limit: 10,
      },
    },
  });

  useEffect(() => {
    const leads = (data?.leads ?? []) as any[];

    if (!isInitialized.current) {
      leads.forEach((l) => seenIds.current.add(l.id));
      isInitialized.current = true;
      return;
    }

    const nuevos = leads.filter(
      (l) => !seenIds.current.has(l.id) && (l.createdAt ?? 0) >= mountTime.current
    );
    if (nuevos.length === 0) return;

    nuevos.forEach((l) => seenIds.current.add(l.id));
    playNewLeadSound();
    setToasts((prev) => [
      ...prev,
      ...nuevos.map((l) => ({
        id: l.id,
        name: l.name || "Lead sin nombre",
        phone: l.phone,
        type: l.type || "otro",
        source: l.source,
      })),
    ]);
  }, [data]);

  function cerrar(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="fixed bottom-24 right-6 z-[9997] flex flex-col gap-3 pointer-events-none">
      {toasts.map((t) => (
        <ToastNuevoLead
          key={t.id}
          toast={t}
          onClose={() => cerrar(t.id)}
          onVerLead={() => {
            cerrar(t.id);
            router.push(`/leads/${t.id}`);
          }}
        />
      ))}
    </div>
  );
}

function ToastNuevoLead({
  toast,
  onClose,
  onVerLead,
}: {
  toast: LeadToast;
  onClose: () => void;
  onVerLead: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 12000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const ramoLabel = RAMO_LABELS[toast.type] ?? toast.type;

  return (
    <div
      className="pointer-events-auto w-[340px] rounded-2xl shadow-2xl border border-emerald-400/30 overflow-hidden animate-slide-in-right"
      style={{
        background: "linear-gradient(135deg, #052e16 0%, #14532d 100%)",
      }}
    >
      {/* Barra de progreso */}
      <div className="h-0.5 bg-emerald-400/30">
        <div
          className="h-full bg-emerald-400"
          style={{ animation: "shrink 12s linear forwards" }}
        />
      </div>

      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-full bg-emerald-400/20 border border-emerald-400/30 flex items-center justify-center mt-0.5">
            <UserPlus className="w-4 h-4 text-emerald-400" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-400/70 mb-0.5">
              Nuevo lead — {ramoLabel}
            </p>
            <p className="text-[14px] text-white font-medium leading-snug truncate">
              {toast.name}
            </p>
            {toast.phone && (
              <p className="text-[12px] text-emerald-300/60 mt-0.5">{toast.phone}</p>
            )}
            {toast.source && (
              <p className="text-[11px] text-emerald-300/40 mt-0.5">via {toast.source}</p>
            )}
          </div>

          <button
            onClick={onClose}
            className="shrink-0 text-white/40 hover:text-white/80 transition-colors p-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={onVerLead}
          className="mt-3 w-full py-2 rounded-xl bg-emerald-500 text-white text-[13px] font-bold hover:bg-emerald-400 transition-colors"
        >
          Ver lead →
        </button>
      </div>
    </div>
  );
}

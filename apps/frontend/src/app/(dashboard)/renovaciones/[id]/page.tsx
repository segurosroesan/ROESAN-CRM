"use client";

import { use, useState } from "react";
import { db } from "@/lib/instant-db";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Phone, Mail, Shield, Calendar,
  Clock, CheckCircle2, RefreshCw, Plus, X,
} from "lucide-react";

const BACKEND = `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3002"}/api`;

const STAGES_RENOVACION = [
  "Importada",
  "Contacto previo",
  "En gestión",
  "Cotización enviada",
  "Negociando",
  "Confirmada",
  "Renovada en Soft ✓",
  "No renueva",
  "Perdida",
];

function diasBadge(dias: number) {
  if (dias <= 15) return { label: `CRÍTICO — ${dias} días`, cls: "bg-red-50 text-red-700 border-red-200" };
  if (dias <= 30) return { label: `URGENTE — ${dias} días`, cls: "bg-orange-50 text-orange-700 border-orange-200" };
  return { label: `${dias} días para vencer`, cls: "bg-amber-50 text-amber-700 border-amber-100" };
}

export default function RenovacionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [addingNota, setAddingNota] = useState(false);
  const [nota, setNota] = useState("");
  const [showConfirmarModal, setShowConfirmarModal] = useState(false);

  const { data, isLoading } = db.useQuery({
    leads: { $: { where: { id } } },
    interacciones: { $: { where: { leadId: id } } },
  } as any);

  const lead = (data as any)?.leads?.[0];
  const interacciones = ((data as any)?.interacciones || []).sort(
    (a: any, b: any) => b.createdAt - a.createdAt
  );

  const addNota = async () => {
    if (!nota.trim()) return;
    const { id: iid } = await import("@instantdb/react").then(m => ({ id: m.id() }));
    await db.transact([
      (db.tx.interacciones as any)[iid].update({
        tipo: "nota",
        notas: nota,
        leadId: id,
        createdAt: Date.now(),
      }),
    ]);
    setNota("");
    setAddingNota(false);
  };

  const cambiarStatus = async (newStatus: string) => {
    await db.transact([
      db.tx.leads[id].update({ status: newStatus, updatedAt: Date.now() } as any),
    ]);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Cargando…
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-slate-400">Renovación no encontrada</p>
        <button onClick={() => router.back()} className="text-blue-600 text-sm font-bold">
          Volver
        </button>
      </div>
    );
  }

  const diasVencer = lead.fecha_fin_poliza
    ? Math.ceil((new Date(lead.fecha_fin_poliza).getTime() - Date.now()) / 86_400_000)
    : lead.dias_para_vencer ?? 0;
  const badge = diasBadge(Math.max(diasVencer, 0));

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/renovaciones")}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-700 font-medium transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Pipeline Renovaciones
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-bold text-slate-700">{lead.name}</span>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Columna principal */}
        <div className="col-span-2 space-y-5">
          {/* Header card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900">{lead.name}</h2>
                <p className="text-sm text-slate-400 font-mono mt-0.5">
                  {lead.numero_poliza || "—"}
                </p>
                <span
                  className={`inline-block mt-2 text-xs font-black px-2.5 py-1 rounded-full border ${badge.cls}`}
                >
                  {badge.label}
                </span>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-emerald-600">
                  ${(lead.prima_actual || 0).toLocaleString("es-CO")}
                </p>
                <p className="text-xs text-slate-400 font-medium">Prima COP</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 pt-5 border-t border-slate-100">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Shield className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <span>{lead.aseguradora || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Calendar className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <span>Vence: {lead.fecha_fin_poliza || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Phone className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <a href={`tel:${lead.phone}`} className="hover:text-blue-600">
                  {lead.phone || "—"}
                </a>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Mail className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <a href={`mailto:${lead.email}`} className="hover:text-blue-600 truncate">
                  {lead.email || "—"}
                </a>
              </div>
            </div>
          </div>

          {/* Timeline de interacciones */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Actividad</h3>
              <button
                onClick={() => setAddingNota(true)}
                className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar nota
              </button>
            </div>

            {addingNota && (
              <div className="space-y-2">
                <textarea
                  value={nota}
                  onChange={e => setNota(e.target.value)}
                  placeholder="Escribe una nota sobre esta renovación…"
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400/30"
                  rows={3}
                />
                <div className="flex gap-2">
                  <button
                    onClick={addNota}
                    className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={() => { setAddingNota(false); setNota(""); }}
                    className="px-4 py-2 text-slate-400 text-xs font-bold hover:text-slate-700"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {interacciones.length === 0 && !addingNota && (
              <p className="text-sm text-slate-400 py-4 text-center">
                Sin actividad registrada aún
              </p>
            )}

            <div className="space-y-3">
              {interacciones.map((int: any) => (
                <div key={int.id} className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Clock className="h-4 w-4 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-700">{int.notas}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(int.createdAt).toLocaleString("es-CO", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Status del pipeline */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <h3 className="font-bold text-slate-800 text-sm">Estado del pipeline</h3>
            <div className="space-y-1.5">
              {STAGES_RENOVACION.map(stage => (
                <button
                  key={stage}
                  onClick={() => cambiarStatus(stage)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    lead.status === stage
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {lead.status === stage && (
                    <CheckCircle2 className="h-3 w-3 inline mr-1.5 mb-0.5" />
                  )}
                  {stage}
                </button>
              ))}
            </div>
          </div>

          {/* Botón confirmar (solo en Negociando o Confirmada) */}
          {(lead.status === "Confirmada" || lead.status === "Negociando") && (
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-emerald-600" />
                <h3 className="font-bold text-emerald-800 text-sm">Confirmar en Soft Seguros</h3>
              </div>
              <p className="text-xs text-emerald-600">
                Actualiza la póliza en Soft Seguros y marca esta renovación como completada.
              </p>
              <button
                onClick={() => setShowConfirmarModal(true)}
                className="w-full py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-sm"
              >
                Confirmar Renovación →
              </button>
            </div>
          )}

            {lead.soft_cliente_id && (
              <a
                href={`https://app.softseguros.com/srv1/home/clientes/${lead.soft_cliente_id}/editar/persona/`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center py-2 mt-4 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all border border-slate-200"
              >
                Ver en Soft Seguros ↗
              </a>
            )}
          </div>
        </div>

      {showConfirmarModal && (
        <ConfirmarRenovacionModal
          lead={lead}
          onClose={() => setShowConfirmarModal(false)}
          onSuccess={() => {
            setShowConfirmarModal(false);
            router.push("/renovaciones");
          }}
        />
      )}
    </div>
  );
}

function ConfirmarRenovacionModal({
  lead,
  onClose,
  onSuccess,
}: {
  lead: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [nuevaPrima, setNuevaPrima] = useState(String(lead.prima_actual || ""));
  const [nuevaFechaFin, setNuevaFechaFin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleConfirmar = async () => {
    if (!nuevaFechaFin) {
      setError("La nueva fecha de vencimiento es obligatoria");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BACKEND}/renovaciones/${lead.id}/confirmar`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nuevaPrima: Number(nuevaPrima), nuevaFechaFin }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Error ${res.status}`);
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600">
          <h3 className="font-bold text-white text-lg">Confirmar Renovación en Soft</h3>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-white/20 text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-slate-50 rounded-xl p-4 text-sm space-y-1">
            <p className="font-bold text-slate-700">{lead.name}</p>
            <p className="text-slate-400 font-mono">{lead.numero_poliza}</p>
            <p className="text-slate-400">{lead.aseguradora}</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Nueva prima (COP)
            </label>
            <input
              type="number"
              value={nuevaPrima}
              onChange={e => setNuevaPrima(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 text-sm"
              placeholder="1500000"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Nueva fecha de vencimiento *
            </label>
            <input
              type="date"
              value={nuevaFechaFin}
              onChange={e => setNuevaFechaFin(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 text-sm"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="pt-2 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-bold text-slate-400 hover:text-slate-700"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmar}
              disabled={loading}
              className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all"
            >
              {loading ? "Confirmando…" : "Confirmar en Soft Seguros"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

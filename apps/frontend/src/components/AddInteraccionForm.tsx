"use client";

import { useState } from "react";
import { db } from "@/lib/instant-db";
import { X } from "lucide-react";

export function AddInteraccionForm({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const [tipo, setTipo] = useState("llamada");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const newId = crypto.randomUUID();
    await db.transact([
      (db.tx.interacciones as any)[newId].update({
        leadId,
        tipo,
        notas,
        createdAt: Date.now(),
      }),
      // Link to lead
      (db.tx.interacciones as any)[newId].link({ lead: leadId }),
    ]);
    setSaving(false);
    onClose();
  };

  const tipoOptions = [
    { value: "llamada", label: "📞 Llamada" },
    { value: "whatsapp", label: "💬 WhatsApp" },
    { value: "email", label: "📧 Email" },
    { value: "nota", label: "📝 Nota" },
    { value: "reunion", label: "🤝 Reunión" },
  ];

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-blue-100 shadow-sm p-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-slate-700">Nueva interacción</h4>
        <button type="button" onClick={onClose} className="text-slate-300 hover:text-slate-500"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex gap-2 flex-wrap">
        {tipoOptions.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTipo(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${tipo === opt.value ? "bg-blue-600 text-white shadow-sm" : "bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-100"}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <textarea
        required
        value={notas}
        onChange={e => setNotas(e.target.value)}
        rows={3}
        placeholder="Describe la interacción, resultado, próximos pasos..."
        className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-sm resize-none"
      />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors">Cancelar</button>
        <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 shadow-sm transition-all disabled:opacity-50">
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}

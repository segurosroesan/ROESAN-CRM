"use client";

import { useState, useRef } from "react";
import { db } from "@/lib/instant-db";
import { X, FileText } from "lucide-react";

function buildCoberturas(data: any): object {
  return {
    rce_limite: data.rce_limite ?? null,
    rce_deducible_smmlv: data.rce_deducible_smmlv ?? null,
    danio_total_valor: data.danio_total_valor ?? null,
    danio_total_ded_pct: data.danio_total_ded_pct ?? null,
    danio_total_ded_smmlv: data.danio_total_ded_smmlv ?? null,
    danio_parcial_ded_pct: data.danio_parcial_ded_pct ?? null,
    danio_parcial_ded_smmlv: data.danio_parcial_ded_smmlv ?? null,
    hurto_total_ded_pct: data.hurto_total_ded_pct ?? null,
    hurto_total_ded_smmlv: data.hurto_total_ded_smmlv ?? null,
    hurto_parcial_ded_pct: data.hurto_parcial_ded_pct ?? null,
    hurto_parcial_ded_smmlv: data.hurto_parcial_ded_smmlv ?? null,
    terremoto: data.terremoto ?? false,
    proteccion_patrimonial: data.proteccion_patrimonial ?? false,
    asistencia_juridica_penal: data.asistencia_juridica_penal ?? false,
    asistencia_juridica_penal_valor: data.asistencia_juridica_penal_valor ?? null,
    asistencia_juridica_civil: data.asistencia_juridica_civil ?? false,
    asistencia_juridica_civil_valor: data.asistencia_juridica_civil_valor ?? null,
    lucro_cesante: data.lucro_cesante ?? false,
    accidentes_personales_conductor: data.accidentes_personales_conductor ?? null,
    asistencia_en_viaje: data.asistencia_en_viaje ?? false,
  };
}

export function AddCotizacionForm({ leadId, onClose, lead }: { leadId: string; onClose: () => void; lead: any }) {
  const [form, setForm] = useState({
    aseguradora: "",
    valor: "",
    prima_neta: "",
    valor_asegurado: "",
    cobertura: "",
    estado: "enviada",
    es_renovacion: false,
  });
  const [parsedCoverage, setParsedCoverage] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPdf(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3002"}/api`;
      const res = await fetch(`${backendUrl}/cotizador/parse-pdf`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setForm(prev => ({
          ...prev,
          aseguradora: data.aseguradora || prev.aseguradora,
          valor: data.prima_total ? String(data.prima_total) : prev.valor,
          prima_neta: data.prima_neta ? String(data.prima_neta) : prev.prima_neta,
          valor_asegurado: data.valor_asegurado ? String(data.valor_asegurado) : prev.valor_asegurado,
          cobertura: data.cobertura || prev.cobertura,
        }));
        setParsedCoverage(data);

        const updates: any = {};
        if (data.placa && !lead.vehiclePlate) updates.vehiclePlate = data.placa;
        if (data.modelo && !lead.vehicleYear) updates.vehicleYear = String(data.modelo);
        if (data.fasecolda && !lead.vehicleFasecolda) updates.vehicleFasecolda = data.fasecolda;
        if (data.documento && !lead.documento) updates.documento = data.documento;
        if (Object.keys(updates).length > 0) {
          await db.transact([db.tx.leads[leadId].update(updates)]);
        }
      } else {
        alert("Error al analizar el documento de la cotización");
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión al subir el PDF");
    } finally {
      setUploadingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const newId = crypto.randomUUID();
    const prima = parseFloat(form.valor) || 0;
    await db.transact([
      (db.tx.cotizaciones as any)[newId].update({
        leadId,
        aseguradora: form.aseguradora,
        valor: prima,
        prima_total: prima,
        prima_neta: parseFloat(form.prima_neta) || 0,
        valor_asegurado: parseFloat(form.valor_asegurado) || 0,
        cobertura: form.cobertura,
        coberturas: parsedCoverage ? buildCoberturas(parsedCoverage) : undefined,
        estado: form.estado,
        es_renovacion: form.es_renovacion,
        fuente: parsedCoverage ? "IA (PDF)" : "Manual",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
      (db.tx.cotizaciones as any)[newId].link({ lead: leadId }),
    ]);
    setSaving(false);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-slate-700">Nueva cotización</h4>
        <div className="flex items-center gap-2">
          <input type="file" accept="application/pdf,image/*" className="hidden" ref={fileInputRef} onChange={handlePdfUpload} />
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingPdf} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg hover:bg-blue-100 transition-colors">
            {uploadingPdf ? "Analizando..." : "📄 Autocompletar con PDF"}
          </button>
          <button type="button" onClick={onClose} className="text-slate-300 hover:text-slate-500 ml-2"><X className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Aseguradora <span className="text-red-500">*</span></label>
          <input
            required value={form.aseguradora}
            onChange={e => setForm({ ...form, aseguradora: e.target.value })}
            placeholder="Ej. Sura, Allianz, Axa"
            className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Prima Total (COP) <span className="text-red-500">*</span></label>
          <input
            required type="number" value={form.valor}
            onChange={e => setForm({ ...form, valor: e.target.value })}
            placeholder="1500000"
            className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all text-sm"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Descripción / Plan de Cobertura</label>
        <input
          value={form.cobertura}
          onChange={e => setForm({ ...form, cobertura: e.target.value })}
          placeholder="Todo riesgo, básico, etc."
          className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all text-sm"
        />
      </div>

      <label className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl cursor-pointer hover:bg-blue-100 transition-colors group">
        <input
          type="checkbox"
          checked={form.es_renovacion}
          onChange={e => setForm({ ...form, es_renovacion: e.target.checked })}
          className="w-4 h-4 accent-blue-600"
        />
        <div>
          <span className="text-sm font-bold text-blue-800">🔄 Es póliza vigente (para renovación)</span>
          <p className="text-[10px] text-blue-500 mt-0.5">Márcala si es la prima actual que se quiere comparar vs. nuevas opciones</p>
        </div>
      </label>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-slate-600">Cancelar</button>
        <button type="submit" disabled={saving} className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50">
          {saving ? "Guardando…" : "Guardar cotización"}
        </button>
      </div>
    </form>
  );
}

"use client";

import { db } from "@/lib/instant-db";
import { useParams, useRouter } from "next/navigation";
import { useState, useRef } from "react";

import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  FileText,
  MessageSquare,
  PhoneCall,
  Calendar,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Plus,
  Car,
  Heart,
  Building2,
  Shield,
  Home,
  Flame,
  Zap,
  Thermometer,
  Snowflake,
  Edit3,
  Save,
  X,
  DollarSign,
  Send,
  Clock,
  User,
  ExternalLink,
  Copy,
  Search,
} from "lucide-react";
import { EmailComposer } from "@/components/EmailComposer";
import { CotizacionComparativo } from "@/components/CotizacionComparativo";
import { DocumentosLegales } from "@/components/DocumentosLegales";
import { AddInteraccionForm } from "@/components/AddInteraccionForm";
import { AddCotizacionForm } from "@/components/AddCotizacionForm";
import { PropuestaProModal } from "@/components/PropuestaProModal";

// ✅ Etapas simplificadas según feedback
const STAGES = [
  "Nuevo",
  "Contacto",
  "Calificado",
  "Cotización",
  "Seguimiento",
  "Ganado / Sincronizado",
  "Rechazado",
  "Perdido",
];

const STAGE_COLORS: Record<string, string> = {
  "Nuevo": "bg-blue-600",
  "Contacto": "bg-violet-600",
  "Calificado": "bg-purple-600",
  "Cotización": "bg-amber-500",
  "Seguimiento": "bg-orange-500",
  "Ganado / Sincronizado": "bg-emerald-600",
  "Rechazado": "bg-rose-600",
  "Perdido": "bg-gray-500",
};

const TIPO_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "llamada": PhoneCall,
  "whatsapp": MessageSquare,
  "email": Mail,
  "nota": FileText,
  "reunion": Calendar,
};

const TIPO_COLORS: Record<string, string> = {
  "llamada": "bg-blue-100 text-blue-600 border-blue-200",
  "whatsapp": "bg-green-100 text-green-600 border-green-200",
  "email": "bg-purple-100 text-purple-600 border-purple-200",
  "nota": "bg-amber-100 text-amber-600 border-amber-200",
  "reunion": "bg-cyan-100 text-cyan-600 border-cyan-200",
};

const RAMO_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  "auto": { label: "Autos", icon: Car, color: "from-blue-500 to-indigo-600" },
  "salud": { label: "Salud", icon: Heart, color: "from-rose-500 to-pink-600" },
  "vida": { label: "Vida", icon: Heart, color: "from-rose-600 to-red-700" },
  "soat": { label: "SOAT", icon: Car, color: "from-amber-500 to-orange-600" },
  "hogar": { label: "Hogar", icon: Home, color: "from-teal-500 to-cyan-600" },
  "pyme": { label: "PYME", icon: Building2, color: "from-violet-500 to-purple-600" },
  "cumplimiento": { label: "Cumplimiento", icon: Shield, color: "from-slate-600 to-slate-700" },
};

function ScoreBar({ score }: { score?: number }) {
  const s = score || 0;
  let label = "Frío";
  let Icon = Snowflake;
  let barGradient = "linear-gradient(90deg, #94a3b8, #cbd5e1)";
  if (s >= 80) { label = "Urgente"; Icon = Flame;       barGradient = "linear-gradient(90deg, #ef4444, #f97316)"; }
  else if (s >= 60) { label = "Caliente"; Icon = Zap;   barGradient = "linear-gradient(90deg, #f59e0b, #f97316)"; }
  else if (s >= 40) { label = "Tibio"; Icon = Thermometer; barGradient = "linear-gradient(90deg, #fbbf24, #f59e0b)"; }

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="nova-progress-fill h-full rounded-full transition-all duration-700"
          style={{ width: `${s}%`, background: barGradient }}
        />
      </div>
      <span className="flex items-center gap-1 text-xs font-semibold text-slate-600 min-w-[72px]" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
        <Icon className="h-3.5 w-3.5" />
        {label} ({s})
      </span>
    </div>
  );
}

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.id as string;

  const { isLoading, data, error } = db.useQuery({
    leads: {
      $: { where: { id: leadId } },
    },
    interacciones: {
      $: { where: { leadId } },
    },
    cotizaciones: {
      $: { where: { leadId } },
    },
  });

  const [activeTab, setActiveTab] = useState<"timeline" | "cotizaciones" | "datos" | "emails" | "documentos">("datos");
  const [isEditingStage, setIsEditingStage] = useState(false);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [showAddInteraccion, setShowAddInteraccion] = useState(false);
  const [showAddCotizacion, setShowAddCotizacion] = useState(false);
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [comparativoData, setComparativoData] = useState<any>(null);
  const [propuestaProData, setPropuestaProData] = useState<{ body: string; url: string } | null>(null);
  const [isAutoQuoting, setIsAutoQuoting] = useState(false);
  const [uploadingBulk, setUploadingBulk] = useState(false);
  const [isSearchingPlaca, setIsSearchingPlaca] = useState(false);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  if (isLoading) return (
    <div className="h-full flex items-center justify-center">
      <div className="relative flex h-12 w-12">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-12 w-12 bg-blue-500 flex items-center justify-center shadow-lg">
          <RefreshCw className="text-white h-5 w-5 animate-spin" />
        </span>
      </div>
    </div>
  );

  if (error) return (
    <div className="p-8 text-center">
      <p className="text-red-600 font-bold">Error: {error.message}</p>
    </div>
  );

  const lead = data?.leads?.[0];
  if (!lead) return (
    <div className="p-8 text-center">
      <p className="text-slate-500">Prospecto no encontrado.</p>
      <button onClick={() => router.push("/leads")} className="mt-4 text-blue-600 font-bold hover:underline">
        ← Volver al pipeline
      </button>
    </div>
  );

  const interacciones = (data?.interacciones || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const cotizaciones = (data?.cotizaciones || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const ramoMeta = RAMO_META[lead.type?.toLowerCase()] || { label: lead.type || "Sin ramo", icon: Shield, color: "from-slate-500 to-slate-600" };
  const RamoIcon = ramoMeta.icon;


  const handleSingleAutoQuote = async (insurer: "all" | "allianz" | "qualitas" | "sbs") => {
    if (!lead.vehicleFasecolda || !lead.vehicleYear || !lead.documento) {
      alert("Faltan datos críticos para cotizar (Fasecolda, Modelo o Documento). Por favor completa los datos del lead.");
      return;
    }

    setIsAutoQuoting(true);
    try {
      const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3002"}/api`;
      const endpoint = insurer === "all" ? "all" : insurer;
      const response = await fetch(`${backendUrl}/cotizador/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claveFasecolda: lead.vehicleFasecolda,
          modelo: parseInt(lead.vehicleYear),
          placa: lead.vehiclePlate || "PROVIS",
          tipoDocumento: "CC",
          documento: lead.documento,
          departamento: "11",
          municipio: "11001",
          fechaInicio: new Date().toISOString().split('T')[0],
          fechaFin: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
          fechaNacimiento: lead.fecha_nacimiento,
          sexo: lead.genero,
          leadId: leadId
        }),
      });

      const results = await response.json();
      const transactions = [];
      
      // Manejar respuesta de Allianz (puede venir en results.allianz o directo en results si se llamó solo a allianz)
      const allianzData = insurer === "allianz" ? results : results.allianz;
      if (allianzData && !allianzData.error) {
        for (const pkg of (allianzData.paquetes || [])) {
          const aId = crypto.randomUUID();
          transactions.push(db.tx.cotizaciones[aId].update({
            leadId,
            aseguradora: "Allianz",
            valor: pkg.primaTotal,
            prima_total: pkg.primaTotal,
            cobertura: pkg.nombre,
            estado: "enviada",
            fuente: "API Allianz",
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }));
          transactions.push(db.tx.cotizaciones[aId].link({ lead: leadId }));
        }
      }

      // Manejar respuesta de Qualitas
      const qualitasData = insurer === "qualitas" ? results : results.qualitas;
      if (qualitasData && !qualitasData.error) {
        const qId = crypto.randomUUID();
        const prima = qualitasData.primaTotal || qualitasData.prima_total || 0;
        transactions.push(db.tx.cotizaciones[qId].update({
          leadId,
          aseguradora: "Qualitas",
          valor: prima,
          prima_total: prima,
          cobertura: "Plan Automóvil - Generado Automáticamente",
          estado: "enviada",
          fuente: "API Qualitas",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }));
        transactions.push(db.tx.cotizaciones[qId].link({ lead: leadId }));
      }

      // Manejar respuesta de SBS
      const sbsData = insurer === "sbs" ? results : results.sbs;
      if (sbsData && !sbsData.error) {
        const sId = crypto.randomUUID();
        const prima = sbsData.primaTotal || 0;
        transactions.push(db.tx.cotizaciones[sId].update({
          leadId,
          aseguradora: "SBS",
          valor: prima,
          prima_total: prima,
          cobertura: "Plan Automóvil - Generado Automáticamente",
          estado: "enviada",
          fuente: "API SBS",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }));
        transactions.push(db.tx.cotizaciones[sId].link({ lead: leadId }));
      }

      if (transactions.length > 0) {
        await db.transact(transactions);
        alert(`✅ ${transactions.length / 2} cotización(es) guardada(s) exitosamente.`);
      } else {
        const errorMsg = results.error || results.qualitas?.error || results.allianz?.error || results.sbs?.error || "La aseguradora no devolvió resultados.";
        alert(`Atención: ${errorMsg}`);
      }
    } catch (err) {
      console.error("Error en auto-quote:", err);
      alert("Error llamando al servicio de cotización.");
    } finally {
      setIsAutoQuoting(false);
    }
  };

  const handleBulkPdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setUploadingBulk(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach(file => formData.append("files", file));
      
      const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3002"}/api`;
      const res = await fetch(`${backendUrl}/cotizador/parse-pdfs`, {
        method: "POST",
        body: formData,
      });
      
      if (res.ok) {
        const parsedQuotes = await res.json();
        const txs: any[] = [];
        
        parsedQuotes.forEach((data: any) => {
          const newId = crypto.randomUUID();
          const prima = parseFloat(String(data.prima_total || 0)) || 0;
          txs.push(
            db.tx.cotizaciones[newId].update({
              leadId,
              aseguradora: data.aseguradora || "Desconocida",
              valor: prima,
              prima_total: prima,
              prima_neta: parseFloat(String(data.prima_neta || 0)) || 0,
              valor_asegurado: parseFloat(String(data.valor_asegurado || 0)) || 0,
              cobertura: data.cobertura || "",
              coberturas: buildCoberturas(data),
              estado: "enviada",
              es_renovacion: false,
              fuente: "IA (Múltiples PDFs)",
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }),
            db.tx.cotizaciones[newId].link({ lead: leadId })
          );
        });
        
        if (txs.length > 0) {
          await db.transact(txs);
        }
      } else {
        alert("Error al analizar los documentos");
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión al subir los PDFs");
    } finally {
      setUploadingBulk(false);
      if (bulkFileInputRef.current) bulkFileInputRef.current.value = "";
    }
  };

  const handleStageChange = async (newStage: string) => {
    await db.transact([
      db.tx.leads[leadId].update({ status: newStage, updatedAt: Date.now() }),
    ]);
    // Registrar en timeline
    const iId = crypto.randomUUID();
    await db.transact([
      db.tx.interacciones[iId].update({
        leadId,
        tipo: "nota",
        notas: `Etapa cambiada a: ${newStage}`,
        createdAt: Date.now(),
      }),
    ]);
    setIsEditingStage(false);
  };

  const handleSaveInfo = async () => {
    if (!editData) return;
    await db.transact([
      db.tx.leads[leadId].update({ ...editData, updatedAt: Date.now() }),
    ]);
    setIsEditingInfo(false);
    setEditData(null);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3002"}/api`;
      const response = await fetch(`${backendUrl}/sync/softseguros/${leadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadData: lead }),
      });
      const result = await response.json();
      if (result.success) {
        // Backend already writes soft_cliente_id and sincronizado_soft to InstantDB
        await db.transact([
          db.tx.leads[leadId].update({
            status: "Sincronizado ✓",
            updatedAt: Date.now(),
          }),
        ]);
      }
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSearchPlaca = async (placaBuscada?: string) => {
    const placaAUsar = placaBuscada || (isEditingInfo ? editData?.vehiclePlate : lead?.vehiclePlate);
    if (!placaAUsar) {
      alert("Por favor ingresa una placa primero.");
      return;
    }

    setIsSearchingPlaca(true);
    try {
      const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3002"}/api`;
      const response = await fetch(`${backendUrl}/vehiculos/placa/${placaAUsar}`);
      const result = await response.json();

      if (response.ok && result.success && result.data) {
        const { modelo, fasecolda, marca, linea } = result.data;
        const infoMsg = `Vehículo encontrado: ${marca} ${linea} ${modelo}`;
        
        if (isEditingInfo) {
          setEditData({
            ...editData,
            vehicleYear: modelo,
            vehicleFasecolda: fasecolda,
          });
          alert(`${infoMsg}\n(Datos actualizados en el formulario, recuerda Guardar)`);
        } else {
          // Guardar directamente
          await db.transact([
            db.tx.leads[leadId].update({
              vehicleYear: modelo,
              vehicleFasecolda: fasecolda,
              updatedAt: Date.now()
            })
          ]);
          alert(`${infoMsg}\n(Datos guardados exitosamente)`);
        }
      } else {
        alert(result.error || "No se encontraron datos para esta placa.");
      }
    } catch (err) {
      console.error("Error consultando placa:", err);
      alert("Error de conexión al consultar la placa.");
    } finally {
      setIsSearchingPlaca(false);
    }
  };

  const handleCompararCotizaciones = async () => {
    if (!cotizaciones || cotizaciones.length === 0) return;
    setIsComparing(true);
    try {
      const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3002"}/api`;

      // Normalize cotizaciones: map 'valor' → 'prima_total' for manual quotes,
      // and use the explicit 'es_renovacion' flag stored in DB.
      const cots = cotizaciones.map(c => {
        const primaTotalRaw = c.prima_total ?? c.valor ?? 0;
        return {
          aseguradora: c.aseguradora || "Sin nombre",
          nombre_plan: c.cobertura || c.nombre_plan || "",
          prima_neta: c.prima_neta ?? primaTotalRaw,
          prima_total: primaTotalRaw,
          iva: c.iva ?? 0,
          gastos_expedicion: c.gastos_expedicion ?? 0,
          valor_asegurado: c.valor_asegurado ?? 0,
          coberturas: c.coberturas || [],
          deducibles: c.deducibles || [],
          // Use explicit flag from DB; fallback: first quote in renovation pipeline
          es_renovacion: c.es_renovacion === true,
        };
      });

      const response = await fetch(`${backendUrl}/cotizador/comparar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cotizaciones: cots }),
      });
      const result = await response.json();
      if (result.comparativo_ia) {
        setComparativoData(result);
      }
    } catch (err) {
      console.error("Error comparando cotizaciones:", err);
    } finally {
      setIsComparing(false);
    }
  };

  const copyPhone = () => {
    if (lead.phone) {
      navigator.clipboard.writeText(lead.phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const stageColor = STAGE_COLORS[lead.status] || "bg-slate-500";
  const stageIdx = STAGES.indexOf(lead.status);
  const progressPct = Math.round(((stageIdx + 1) / STAGES.length) * 100);

  return (
    <div className="max-w-6xl mx-auto space-y-4">

      {/* Back button */}
      <button
        onClick={() => router.push("/leads")}
        className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-400 hover:text-amber-600 transition-colors group"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
        <span style={{ fontFamily: "var(--font-outfit)" }}>Pipeline Pre-Venta</span>
      </button>

      {/* Lead Hero Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Gradient header */}
        <div className={`h-1 bg-gradient-to-r ${ramoMeta.color}`} />

        <div className="p-5 flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${ramoMeta.color} flex items-center justify-center text-xl font-black text-white flex-shrink-0`}>
              {lead.name?.charAt(0)?.toUpperCase() || "?"}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-black text-slate-900">{lead.name || "Sin nombre"}</h1>
                {lead.sincronizado_soft && (
                  <span className="flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Sincronizado Soft
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`flex items-center gap-1 text-xs font-bold text-white px-2.5 py-0.5 rounded-full ${stageColor}`}>
                  <RamoIcon className="h-3.5 w-3.5" />
                  {ramoMeta.label}
                </span>
                {lead.source && (
                  <span className="text-xs text-slate-400 font-medium bg-slate-50 border border-slate-100 px-2.5 py-0.5 rounded-full">
                    {lead.source}
                  </span>
                )}
                {lead.documento && (
                  <span className="text-xs text-slate-500 font-mono">{lead.documento}</span>
                )}
              </div>

              {/* Contact info */}
              <div className="flex items-center gap-3 flex-wrap">
                {lead.phone && (
                  <button onClick={copyPhone} className="flex items-center gap-1 text-[13px] font-semibold text-slate-600 hover:text-blue-600 transition-colors group/phone">
                    <Phone className="h-3.5 w-3.5" />
                    {lead.phone}
                    <Copy className={`h-3 w-3 opacity-0 group-hover/phone:opacity-100 transition-opacity ${copied ? "text-green-500 opacity-100" : ""}`} />
                  </button>
                )}
                {lead.email && (
                  <a href={`mailto:${lead.email}`} className="flex items-center gap-1 text-[13px] font-semibold text-slate-500 hover:text-blue-600 transition-colors">
                    <Mail className="h-3.5 w-3.5" />
                    {lead.email}
                  </a>
                )}
                {lead.city && (
                  <span className="flex items-center gap-1 text-[13px] text-slate-400 font-medium">
                    <MapPin className="h-3.5 w-3.5" />
                    {lead.city}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 items-end flex-shrink-0">
            {/* Stage selector */}
            <div className="relative">
              <button
                onClick={() => setIsEditingStage(!isEditingStage)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-bold text-white ${stageColor} hover:opacity-90 transition-opacity`}
              >
                {lead.status || "Sin etapa"}
                <ChevronDown className={`h-4 w-4 transition-transform ${isEditingStage ? "rotate-180" : ""}`} />
              </button>
              
              {isEditingStage && (
                <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-30">
                  <div className="p-1.5">
                    {STAGES.map(stage => (
                      <button
                        key={stage}
                        onClick={() => handleStageChange(stage)}
                        className={`w-full text-left px-2.5 py-2 text-[13px] rounded-lg font-semibold transition-colors hover:bg-slate-50 flex items-center gap-2 ${lead.status === stage ? "bg-blue-50 text-blue-700" : "text-slate-700"}`}
                      >
                        <span className={`h-2 w-2 rounded-full flex-shrink-0 ${STAGE_COLORS[stage] || "bg-slate-300"}`} />
                        {stage}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sync button — only show when Ganado */}
            {(lead.status === "Ganado / Sincronizado") && !lead.sincronizado_soft && (
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                {isSyncing ? "Sincronizando…" : "Enviar a Soft Seguros"}
              </button>
            )}

            {lead.sincronizado_soft && lead.soft_cliente_id && (
              <a
                href={`https://app.softseguros.com/srv1/home/clientes/${lead.soft_cliente_id}/editar/persona/`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
              >
                <ExternalLink className="h-4 w-4" />
                Ver en Soft Seguros
              </a>
            )}
          </div>
        </div>

        {/* Score + Progress */}
        <div className="px-5 pb-4 space-y-2 border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Score del prospecto</span>
            <span className="text-xs font-bold text-slate-500">Progreso en pipeline: {progressPct}%</span>
          </div>
          <ScoreBar score={lead.score} />
          {/* Pipeline progress */}
          <div className="flex gap-1 mt-2">
            {STAGES.slice(0, 10).map((stage, idx) => (
              <div
                key={stage}
                className={`flex-1 h-1.5 rounded-full transition-all ${idx <= stageIdx ? stageColor.replace("bg-", "bg-") : "bg-slate-100"}`}
                title={stage}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Main content: Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

        {/* Left: Timeline + Cotizaciones */}
        <div className="lg:col-span-3 space-y-3">
          {/* Tab Bar */}
          <div className="flex items-center gap-0.5 bg-white/70 backdrop-blur rounded-xl p-1 border border-slate-100 w-fit shadow-sm">
            {[
              { id: "datos", label: "Datos completos", icon: User },
              { id: "timeline", label: "Timeline", icon: Clock },
              { id: "emails", label: `Emails (${interacciones.filter(i => i.tipo === "email").length})`, icon: Mail },
              { id: "documentos", label: "Documentos", icon: FileText },
              { id: "cotizaciones", label: `Cotizaciones (${cotizaciones.length})`, icon: DollarSign },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all ${
                  activeTab === tab.id
                    ? "bg-white text-slate-800 shadow-sm border border-amber-100"
                    : "text-slate-400 hover:text-slate-700 hover:bg-white/50"
                }`}
                style={activeTab === tab.id ? { fontFamily: "var(--font-outfit)" } : {}}
              >
                <tab.icon className={`h-3.5 w-3.5 ${activeTab === tab.id ? "text-amber-500" : ""}`} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Timeline Tab */}
          <div className={activeTab === "timeline" ? "block" : "hidden"}>
            <div className="space-y-3">
              <button
                onClick={() => setShowAddInteraccion(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border-2 border-dashed border-slate-200 rounded-xl text-[13px] font-bold text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/30 transition-all"
              >
                <Plus className="h-4 w-4" />
                Registrar interacción
              </button>

              {showAddInteraccion && (
                <AddInteraccionForm 
                  leadId={leadId} 
                  onClose={() => setShowAddInteraccion(false)} 
                />
              )}

              {interacciones.length === 0 && (
                <div className="text-center py-8 bg-white rounded-xl border border-slate-100">
                  <MessageSquare className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-slate-400 font-medium text-[13px]">Sin interacciones registradas</p>
                  <p className="text-slate-300 text-xs mt-0.5">Registra llamadas, mensajes y reuniones aquí.</p>
                </div>
              )}

              <div className="relative">
                {interacciones.length > 0 && (
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-100" />
                )}
                <div className="space-y-2.5">
                  {interacciones.map((interaccion) => {
                    const TipoIcon = TIPO_ICONS[interaccion.tipo] || FileText;
                    const colorClass = TIPO_COLORS[interaccion.tipo] || "bg-slate-100 text-slate-500 border-slate-200";
                    return (
                      <div key={interaccion.id} className="flex gap-3 relative">
                        <div className={`h-8 w-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 z-10 bg-white ${colorClass}`}>
                          <TipoIcon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 bg-white rounded-xl border border-slate-100 p-3 shadow-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{interaccion.tipo}</span>
                            <span className="text-[10px] text-slate-300 font-medium">
                              {new Date(interaccion.createdAt || Date.now()).toLocaleDateString("es-CO", {
                                day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                              })}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 leading-relaxed">{interaccion.notas}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Emails Tab */}
          <div className={activeTab === "emails" ? "block" : "hidden"}>
            <div className="space-y-4">
              <button
                onClick={() => setShowEmailComposer(true)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-white border-2 border-dashed border-slate-200 rounded-2xl text-sm font-bold text-slate-400 hover:border-purple-400 hover:text-purple-500 hover:bg-purple-50/30 transition-all"
              >
                <Plus className="h-4 w-4" />
                Redactar nuevo correo
              </button>

              {interacciones.filter(i => i.tipo === "email").length === 0 && (
                <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
                  <Mail className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-400 font-medium text-sm">Sin correos enviados</p>
                  <p className="text-slate-300 text-xs mt-1">Vincula tu cuenta en configuración para empezar.</p>
                </div>
              )}

              <div className="space-y-4">
                {interacciones.filter(i => i.tipo === "email").map((email) => (
                  <div key={email.id} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">Gmail</span>
                      <span className="text-[10px] text-slate-300 font-medium font-mono">
                        {new Date(email.createdAt || Date.now()).toLocaleString("es-CO")}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed italic border-l-2 border-slate-100 pl-4">
                      {email.notas}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Documentos Tab */}
          <div className={activeTab === "documentos" ? "block" : "hidden"}>
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
               <DocumentosLegales lead={lead} leadId={leadId} />
            </div>
          </div>

          {/* Cotizaciones Tab */}
          <div className={activeTab === "cotizaciones" ? "block" : "hidden"}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  onClick={() => setShowAddCotizacion(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-white border-2 border-dashed border-slate-200 rounded-2xl text-sm font-bold text-slate-400 hover:border-emerald-400 hover:text-emerald-500 hover:bg-emerald-50/30 transition-all"
                >
                  <Plus className="h-4 w-4" />
                  Agregar manual
                </button>
                <button
                  onClick={() => bulkFileInputRef.current?.click()}
                  disabled={uploadingBulk}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-white border-2 border-dashed border-slate-200 rounded-2xl text-sm font-bold text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/30 transition-all disabled:opacity-50"
                >
                  <input type="file" multiple accept="application/pdf,image/*" className="hidden" ref={bulkFileInputRef} onChange={handleBulkPdfUpload} />
                  {uploadingBulk ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  {uploadingBulk ? "Procesando..." : "Subir varios PDFs"}
                </button>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleSingleAutoQuote("allianz")}
                    disabled={isAutoQuoting}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-sm disabled:opacity-50 hover:opacity-90 bg-blue-600"
                  >
                    <Zap className={`h-3.5 w-3.5 ${isAutoQuoting ? "animate-spin" : ""}`} />
                    Cotizar Allianz
                  </button>
                  <button
                    onClick={() => handleSingleAutoQuote("qualitas")}
                    disabled={isAutoQuoting}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-sm disabled:opacity-50 hover:opacity-90 bg-sky-500"
                  >
                    <Zap className={`h-3.5 w-3.5 ${isAutoQuoting ? "animate-spin" : ""}`} />
                    Cotizar Qualitas
                  </button>
                  <button
                    onClick={() => handleSingleAutoQuote("sbs")}
                    disabled={isAutoQuoting}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-sm disabled:opacity-50 hover:opacity-90 bg-slate-700"
                  >
                    <Zap className={`h-3.5 w-3.5 ${isAutoQuoting ? "animate-spin" : ""}`} />
                    Cotizar SBS (Pruebas)
                  </button>
                </div>
              </div>

              {showAddCotizacion && (
                <AddCotizacionForm
                  leadId={leadId}
                  onClose={() => setShowAddCotizacion(false)}
                  lead={lead}
                />
              )}

              {cotizaciones.length === 0 && (
                <div className="text-center py-8 bg-white rounded-xl border border-slate-100">
                  <DollarSign className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-400 font-medium text-sm">Sin cotizaciones registradas</p>
                </div>
              )}

              {cotizaciones.length > 0 && !comparativoData && (
                <button
                  onClick={handleCompararCotizaciones}
                  disabled={isComparing}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl text-sm font-bold text-amber-700 hover:from-amber-100 hover:to-orange-100 transition-all shadow-sm disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${isComparing ? "animate-spin" : ""}`} />
                  {isComparing ? "Analizando opciones con IA..." : "Analizar Cotizaciones con IA"}
                </button>
              )}

              {comparativoData && (
                <CotizacionComparativo 
                  cotizaciones={cotizaciones}
                  comparativoIA={comparativoData.comparativo_ia}
                  accionIA={comparativoData.accion}
                  asegRenovacion={comparativoData.aseguradora_renovacion}
                  diferenciaPrima={comparativoData.diferencia_prima}
                  esNuevo={lead.pipeline_tipo !== "renovacion"}
                  onGenerarCorreo={async () => {
                    try {
                      // 1. Guardar la propuesta en InstantDB
                      const propuestaId = crypto.randomUUID();
                      const aseguradoraRecomendada = comparativoData.comparativo_ia?.aseguradora_recomendada || "";
                      
                      const cots = cotizaciones.map(c => ({
                        aseguradora: c.aseguradora,
                        plan: c.cobertura || c.nombre_plan || "",
                        prima_anual: c.prima_total || c.valor || 0,
                        rc_limite: c.coberturas?.rce_limite || "0",
                        ded_daño: c.deducibles?.danio_total_ded_pct ? `${c.deducibles.danio_total_ded_pct}%` : c.deducibles?.danio_total_ded_smmlv ? `${c.deducibles.danio_total_ded_smmlv} SMMLV` : "0",
                        reemplazo_total: c.coberturas?.reemplazo_total ? "Si" : "No",
                        conductor_elegido: c.coberturas?.conductor_elegido ? "Si" : "No",
                      }));

                      const payloadPropuesta = {
                        extracted: {
                          folio: lead.documento || lead.id.slice(0,6),
                          vigencia_oferta: "10 días",
                          cliente: {
                            nombre: lead.name,
                            cedula: lead.documento || "",
                          },
                          vehiculo: {
                            marca: lead.vehicleBrand || "",
                            linea: lead.vehicleModel || "",
                            año: lead.vehicleYear || "",
                            placa: lead.vehiclePlate || "",
                            ciudad: lead.city || "",
                            valor_asegurado: cotizaciones[0]?.valor_asegurado || 0,
                          },
                          asesor: {
                            nombre: "Adriana Garzón",
                            email: "autos@roesan.com.co",
                            telefono: "573197282277"
                          },
                          cotizaciones: cots,
                        },
                        analysis: {
                           recomendada: aseguradoraRecomendada,
                           plan_recomendado: comparativoData.comparativo_ia?.plan_recomendado || "",
                           razon_principal: comparativoData.comparativo_ia?.razon_principal || comparativoData.comparativo_ia?.justificacion_corta || "",
                           puntos_fuertes: comparativoData.comparativo_ia?.puntos_fuertes || [],
                           analisis_general: comparativoData.comparativo_ia?.analisis_general || "",
                           alternativa: comparativoData.comparativo_ia?.alternativa || "",
                           razon_alternativa: comparativoData.comparativo_ia?.razon_alternativa || "",
                        }
                      };

                      await db.transact([
                        db.tx.propuestas[propuestaId].update({
                          leadId: leadId,
                          extracted: payloadPropuesta.extracted,
                          analysis: payloadPropuesta.analysis,
                          createdAt: Date.now()
                        }),
                        db.tx.propuestas[propuestaId].link({ lead: leadId })
                      ]);

                      const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3002"}/api`;
                      const response = await fetch(`${backendUrl}/cotizador/email`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          cotizacionSeleccionada: cotizaciones.find(c => (c.aseguradora || "").toUpperCase() === aseguradoraRecomendada.toUpperCase()),
                          todasCotizaciones: cotizaciones,
                          aseguradoraRecomendada: aseguradoraRecomendada,
                          justificacionIA: comparativoData.comparativo_ia?.justificacion_corta,
                          datosExtra: { tomador: lead.name, placa: lead.vehiclePlate, descripcion_vehiculo: `${lead.vehicleBrand || ""} ${lead.vehicleModel || ""} ${lead.vehicleYear || ""}`.trim() },
                          accionIA: comparativoData.accion,
                          aseguradoraRenovacion: comparativoData.aseguradora_renovacion,
                          diferenciaPrima: comparativoData.diferencia_prima,
                          esNuevo: lead.pipeline_tipo !== "renovacion",
                          propuestaUrl: `${window.location.origin}/propuesta/${propuestaId}`
                        }),
                      });
                      const result = await response.json();
                      if (result.body) {
                        setPropuestaProData({ body: result.body, url: `${window.location.origin}/propuesta/${propuestaId}` });
                      }
                    } catch(err) {
                      console.error(err);
                      alert("Error generando propuesta y correo");
                    }
                  }}
                />
              )}

              <div className="grid grid-cols-1 gap-4">
              {cotizaciones.map(cot => {
                const estadoConfig: Record<string, { color: string; label: string }> = {
                  "borrador": { color: "bg-slate-100 text-slate-500", label: "Borrador" },
                  "enviada": { color: "bg-blue-100 text-blue-600", label: "Enviada" },
                  "aceptada": { color: "bg-emerald-100 text-emerald-600", label: "Aceptada ✓" },
                  "rechazada": { color: "bg-rose-100 text-rose-600", label: "Rechazada" },
                };
                const eConf = estadoConfig[cot.estado] || estadoConfig["borrador"];
                return (
                  <div key={cot.id} className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2.5">
                      <div>
                        <h4 className="font-bold text-slate-800">{cot.aseguradora}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">{cot.cobertura || "Sin descripción de cobertura"}</p>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${eConf.color}`}>{eConf.label}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-black text-emerald-600">
                        ${(cot.valor || cot.prima_total || 0).toLocaleString("es-CO")}
                      </span>
                      {cot.estado !== "aceptada" ? (
                        <button
                          onClick={async () => {
                            await db.transact([db.tx.cotizaciones[cot.id].update({ estado: "aceptada" })]);
                          }}
                          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 px-3 py-1.5 rounded-lg transition-all"
                        >
                          Marcar como aceptada
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            await db.transact([db.tx.cotizaciones[cot.id].update({ estado: "enviada" })]);
                          }}
                          className="text-xs font-bold text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 border border-slate-100 hover:border-rose-100 px-3 py-1.5 rounded-lg transition-all"
                        >
                          Desmarcar aceptada
                        </button>
                      )}
                    </div>
                    {cot.fuente && (
                      <p className="text-[10px] text-slate-300 mt-2 font-medium">Fuente: {cot.fuente}</p>
                    )}
                  </div>
                );
              })}
              </div>
            </div>
          </div>

          {/* Datos completos Tab */}
          <div className={activeTab === "datos" ? "block" : "hidden"}>
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-700">Datos del prospecto</h3>
                {!isEditingInfo ? (
                  <button
                    onClick={() => { setEditData({ ...lead }); setIsEditingInfo(true); }}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all border border-slate-100"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Editar
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setIsEditingInfo(false); setEditData(null); }}
                      className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-600 px-3 py-1.5 rounded-lg transition-all"
                    >
                      <X className="h-3.5 w-3.5" /> Cancelar
                    </button>
                    <button
                      onClick={handleSaveInfo}
                      className="flex items-center gap-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-all shadow-sm"
                    >
                      <Save className="h-3.5 w-3.5" /> Guardar
                    </button>
                  </div>
                )}
              </div>

              <div className="p-5 grid grid-cols-2 gap-4">
                {[
                  { label: "Nombre completo", field: "name", value: lead.name },
                  { label: "Cédula / NIT", field: "documento", value: lead.documento },
                  { label: "Celular", field: "phone", value: lead.phone },
                  { label: "Email", field: "email", value: lead.email },
                  { label: "Ciudad", field: "city", value: lead.city },
                  { label: "Ramo", field: "type", value: lead.type },
                  { label: "Fuente", field: "source", value: lead.source },
                  { label: "Placa", field: "vehiclePlate", value: lead.vehiclePlate },
                  { label: "Modelo", field: "vehicleYear", value: lead.vehicleYear },
                  { label: "Fasecolda", field: "vehicleFasecolda", value: lead.vehicleFasecolda },
                  { label: "ID Soft Cliente", field: "soft_cliente_id", value: lead.soft_cliente_id },
                ].map(({ label, field, value }) => (
                  <div key={field} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</label>
                      {field === "vehiclePlate" && (
                        <button
                          onClick={() => handleSearchPlaca()}
                          disabled={isSearchingPlaca}
                          className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded transition-all disabled:opacity-50"
                        >
                          <Search className={`h-3 w-3 ${isSearchingPlaca ? "animate-spin" : ""}`} />
                          {isSearchingPlaca ? "Buscando..." : "Buscar RUNT"}
                        </button>
                      )}
                    </div>
                    {isEditingInfo ? (
                      <input
                        value={editData?.[field] || ""}
                        onChange={e => setEditData({ ...editData, [field]: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                      />
                    ) : (
                      <p className="text-sm font-semibold text-slate-700">{value || <span className="text-slate-300 font-normal">—</span>}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Quick actions sidebar */}
        <div className="space-y-3">
          {/* Quick actions */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>Acciones rápidas</h3>
            <div className="space-y-2">
              {lead.phone && (
                <a
                  href={`https://wa.me/${lead.phone.replace("+", "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-green-50 hover:bg-green-100 text-green-700 font-bold text-sm transition-all"
                >
                  <MessageSquare className="h-4 w-4" />
                  WhatsApp
                </a>
              )}
              {lead.phone && (
                <a
                  href={`tel:${lead.phone}`}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-sm transition-all"
                >
                  <Phone className="h-4 w-4" />
                  Llamar
                </a>
              )}
              {lead.email && (
                <button
                  onClick={() => setShowEmailComposer(true)}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-sm transition-all"
                >
                  <Send className="h-4 w-4" />
                  Enviar correo
                </button>
              )}
            </div>
          </div>

          {/* Notas de gestión */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>Notas de gestión</h3>
              {!isEditingNotes ? (
                <button
                  onClick={() => { setNotesValue(lead.notes || ""); setIsEditingNotes(true); }}
                  className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 px-2 py-1 rounded-lg transition-all border border-slate-100"
                >
                  <Edit3 className="h-3 w-3" />
                  Editar
                </button>
              ) : (
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setIsEditingNotes(false)}
                    className="flex items-center gap-0.5 text-[10px] font-bold text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg transition-all"
                  >
                    <X className="h-3 w-3" /> Cancelar
                  </button>
                  <button
                    onClick={async () => {
                      await db.transact([db.tx.leads[leadId].update({ notes: notesValue, updatedAt: Date.now() })]);
                      setIsEditingNotes(false);
                    }}
                    className="flex items-center gap-0.5 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded-lg transition-all"
                  >
                    <Save className="h-3 w-3" /> Guardar
                  </button>
                </div>
              )}
            </div>
            {isEditingNotes ? (
              <textarea
                value={notesValue}
                onChange={e => setNotesValue(e.target.value)}
                rows={4}
                placeholder="Escribe notas sobre la gestión de este lead..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all resize-none"
              />
            ) : lead.notes ? (
              <p className="text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap">{lead.notes}</p>
            ) : (
              <p className="text-[12px] text-slate-300 italic">Sin notas. Haz clic en Editar para agregar.</p>
            )}
          </div>

          {/* Meta */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-2.5">
            <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>Información del registro</h3>
            <div className="space-y-1.5 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Creado</span>
                <span className="font-semibold text-slate-700 text-xs">
                  {new Date(lead.createdAt || Date.now()).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Actualizado</span>
                <span className="font-semibold text-slate-700 text-xs">
                  {new Date(lead.updatedAt || Date.now()).toLocaleDateString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Interacciones</span>
                <span className="font-black text-slate-800">{interacciones.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Cotizaciones</span>
                <span className="font-black text-slate-800">{cotizaciones.length}</span>
              </div>
            </div>
          </div>

          {/* Sync status */}
          <div className={`rounded-xl border p-4 ${lead.sincronizado_soft ? "bg-green-50 border-green-100" : "bg-slate-50 border-slate-100"}`}>
            <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2.5" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>Estado Soft Seguros</h3>
            {lead.sincronizado_soft ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-700 font-bold text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  Sincronizado correctamente
                </div>
                {lead.soft_cliente_id && (
                  <p className="text-xs text-slate-500">ID Cliente: <span className="font-mono font-bold">{lead.soft_cliente_id}</span></p>
                )}
                {lead.soft_poliza_id && (
                  <p className="text-xs text-slate-500">ID Póliza: <span className="font-mono font-bold">{lead.soft_poliza_id}</span></p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-400 font-medium text-sm">
                <AlertCircle className="h-4 w-4" />
                Pendiente de sincronización
              </div>
            )}
          </div>
        </div>
      </div>

      {propuestaProData && lead.email && (
        <PropuestaProModal
          leadId={leadId}
          toEmail={lead.email}
          initialBody={propuestaProData.body}
          propuestaUrl={propuestaProData.url}
          onClose={() => setPropuestaProData(null)}
          onRegenerate={() => {
            setPropuestaProData(null);
            handleCompararCotizaciones();
          }}
        />
      )}

      {/* Email Composer Modal */}
      {showEmailComposer && lead.email && (
        <EmailComposerWrapper
          leadId={leadId}
          toEmail={lead.email}
          onClose={() => setShowEmailComposer(false)}
        />
      )}

      {/* Click outside to close stage dropdown */}
      {isEditingStage && (
        <div className="fixed inset-0 z-20" onClick={() => setIsEditingStage(false)} />
      )}
    </div>
  );
}

// ── Email Composer Wrapper (injects userId from auth) ─────────────────────

function EmailComposerWrapper({ leadId, toEmail, onClose }: { leadId: string; toEmail: string; onClose: () => void }) {
  const { user } = db.useAuth();
  if (!user) return null;
  return <EmailComposer leadId={leadId} toEmail={toEmail} userId={user.id} onClose={onClose} />;
}

// ── Helpers ────────────────────────────────────────────────────────────────


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




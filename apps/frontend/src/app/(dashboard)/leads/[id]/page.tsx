"use client";

import { db } from "@/lib/instant-db";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
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
} from "lucide-react";
import { EmailComposer } from "@/components/EmailComposer";

// ✅ Etapas PRD v2.0 completas
const STAGES = [
  "Nuevo",
  "Contacto inmediato",
  "Contactado",
  "Calificado",
  "Documentos pendientes",
  "Cotización enviada",
  "Seguimiento",
  "Ganado / Aprobado",
  "Enviando a Soft…",
  "Sincronizado ✓",
  "Rechazado",
  "Perdido / Inactivo",
];

const STAGE_COLORS: Record<string, string> = {
  "Nuevo": "bg-blue-600",
  "Contacto inmediato": "bg-violet-600",
  "Contactado": "bg-indigo-600",
  "Calificado": "bg-purple-600",
  "Documentos pendientes": "bg-amber-500",
  "Cotización enviada": "bg-orange-500",
  "Seguimiento": "bg-cyan-600",
  "Ganado / Aprobado": "bg-emerald-600",
  "Enviando a Soft…": "bg-teal-600",
  "Sincronizado ✓": "bg-green-600",
  "Rechazado": "bg-rose-600",
  "Perdido / Inactivo": "bg-slate-500",
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
  let color = "bg-slate-300";
  let Icon = Snowflake;
  if (s >= 80) { label = "Urgente"; color = "bg-red-500"; Icon = Flame; }
  else if (s >= 60) { label = "Caliente"; color = "bg-orange-500"; Icon = Zap; }
  else if (s >= 40) { label = "Tibio"; color = "bg-amber-400"; Icon = Thermometer; }

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${s}%` }} />
      </div>
      <span className="flex items-center gap-1 text-xs font-bold text-slate-600 min-w-[70px]">
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

  const [activeTab, setActiveTab] = useState<"timeline" | "cotizaciones" | "datos">("timeline");
  const [isEditingStage, setIsEditingStage] = useState(false);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showAddInteraccion, setShowAddInteraccion] = useState(false);
  const [showAddCotizacion, setShowAddCotizacion] = useState(false);
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [copied, setCopied] = useState(false);

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
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
      const response = await fetch(`${backendUrl}/sync/softseguros/${leadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadData: lead }),
      });
      const result = await response.json();
      if (result.success) {
        await db.transact([
          db.tx.leads[leadId].update({ 
            sincronizado_soft: true, 
            status: "Sincronizado ✓",
            soft_cliente_id: String(result.softClient?.id || ""),
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
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Back button */}
      <button 
        onClick={() => router.push("/leads")}
        className="flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-blue-600 transition-colors group"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
        Pipeline Pre-Venta
      </button>

      {/* Lead Hero Card */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Gradient header */}
        <div className={`h-2 bg-gradient-to-r ${ramoMeta.color}`} />
        
        <div className="p-6 flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${ramoMeta.color} flex items-center justify-center text-2xl font-black text-white shadow-lg flex-shrink-0`}>
              {lead.name?.charAt(0)?.toUpperCase() || "?"}
            </div>
            
            <div className="space-y-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-black text-slate-900">{lead.name || "Sin nombre"}</h1>
                {lead.sincronizado_soft && (
                  <span className="flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Sincronizado Soft
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`flex items-center gap-1.5 text-xs font-bold text-white px-3 py-1 rounded-full ${stageColor}`}>
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
              <div className="flex items-center gap-4 flex-wrap mt-1">
                {lead.phone && (
                  <button onClick={copyPhone} className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors group/phone">
                    <Phone className="h-3.5 w-3.5" />
                    {lead.phone}
                    <Copy className={`h-3 w-3 opacity-0 group-hover/phone:opacity-100 transition-opacity ${copied ? "text-green-500 opacity-100" : ""}`} />
                  </button>
                )}
                {lead.email && (
                  <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-blue-600 transition-colors">
                    <Mail className="h-3.5 w-3.5" />
                    {lead.email}
                  </a>
                )}
                {lead.city && (
                  <span className="flex items-center gap-1.5 text-sm text-slate-400 font-medium">
                    <MapPin className="h-3.5 w-3.5" />
                    {lead.city}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 items-end flex-shrink-0">
            {/* Stage selector */}
            <div className="relative">
              <button
                onClick={() => setIsEditingStage(!isEditingStage)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white ${stageColor} shadow-sm hover:opacity-90 transition-opacity`}
              >
                {lead.status || "Sin etapa"}
                <ChevronDown className={`h-4 w-4 transition-transform ${isEditingStage ? "rotate-180" : ""}`} />
              </button>
              
              {isEditingStage && (
                <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-30">
                  <div className="p-2 max-h-72 overflow-y-auto">
                    {STAGES.map(stage => (
                      <button
                        key={stage}
                        onClick={() => handleStageChange(stage)}
                        className={`w-full text-left px-3 py-2.5 text-sm rounded-xl font-semibold transition-colors hover:bg-slate-50 flex items-center gap-2 ${lead.status === stage ? "bg-blue-50 text-blue-700" : "text-slate-700"}`}
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
            {(lead.status === "Ganado / Aprobado") && !lead.sincronizado_soft && (
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                {isSyncing ? "Sincronizando…" : "Enviar a Soft Seguros"}
              </button>
            )}

            {lead.sincronizado_soft && lead.soft_cliente_id && (
              <a
                href={`https://app.softseguros.com/cliente/${lead.soft_cliente_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
              >
                <ExternalLink className="h-4 w-4" />
                Ver en Soft Seguros
              </a>
            )}
          </div>
        </div>

        {/* Score + Progress */}
        <div className="px-6 pb-5 space-y-3 border-t border-slate-100 pt-4">
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Timeline + Cotizaciones */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tab Bar */}
          <div className="flex items-center gap-1 bg-white/60 backdrop-blur rounded-2xl p-1 border border-slate-100 w-fit">
            {[
              { id: "timeline", label: "Timeline", icon: Clock },
              { id: "emails", label: `Emails (${interacciones.filter(i => i.tipo === "email").length})`, icon: Mail },
              { id: "cotizaciones", label: `Cotizaciones (${cotizaciones.length})`, icon: DollarSign },
              { id: "datos", label: "Datos completos", icon: User },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  activeTab === tab.id
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Timeline Tab */}
          {activeTab === "timeline" && (
            <div className="space-y-4">
              <button
                onClick={() => setShowAddInteraccion(true)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-white border-2 border-dashed border-slate-200 rounded-2xl text-sm font-bold text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/30 transition-all"
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
                <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
                  <MessageSquare className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-400 font-medium text-sm">Sin interacciones registradas</p>
                  <p className="text-slate-300 text-xs mt-1">Registra llamadas, mensajes y reuniones aquí.</p>
                </div>
              )}

              <div className="relative">
                {interacciones.length > 0 && (
                  <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-100" />
                )}
                <div className="space-y-4">
                  {interacciones.map((interaccion) => {
                    const TipoIcon = TIPO_ICONS[interaccion.tipo] || FileText;
                    const colorClass = TIPO_COLORS[interaccion.tipo] || "bg-slate-100 text-slate-500 border-slate-200";
                    return (
                      <div key={interaccion.id} className="flex gap-4 relative">
                        <div className={`h-10 w-10 rounded-full border-2 flex items-center justify-center flex-shrink-0 z-10 bg-white ${colorClass}`}>
                          <TipoIcon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
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
          )}

          {/* Emails Tab */}
          {activeTab === "emails" && (
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
          )}

          {/* Cotizaciones Tab */}
          {activeTab === "cotizaciones" && (
            <div className="space-y-4">
              <button
                onClick={() => setShowAddCotizacion(true)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-white border-2 border-dashed border-slate-200 rounded-2xl text-sm font-bold text-slate-400 hover:border-emerald-400 hover:text-emerald-500 hover:bg-emerald-50/30 transition-all"
              >
                <Plus className="h-4 w-4" />
                Agregar cotización
              </button>

              {showAddCotizacion && (
                <AddCotizacionForm 
                  leadId={leadId} 
                  onClose={() => setShowAddCotizacion(false)} 
                />
              )}

              {cotizaciones.length === 0 && (
                <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
                  <DollarSign className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-400 font-medium text-sm">Sin cotizaciones registradas</p>
                </div>
              )}

              {cotizaciones.map(cot => {
                const estadoConfig: Record<string, { color: string; label: string }> = {
                  "borrador": { color: "bg-slate-100 text-slate-500", label: "Borrador" },
                  "enviada": { color: "bg-blue-100 text-blue-600", label: "Enviada" },
                  "aceptada": { color: "bg-emerald-100 text-emerald-600", label: "Aceptada ✓" },
                  "rechazada": { color: "bg-rose-100 text-rose-600", label: "Rechazada" },
                };
                const eConf = estadoConfig[cot.estado] || estadoConfig["borrador"];
                return (
                  <div key={cot.id} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-slate-800">{cot.aseguradora}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">{cot.cobertura || "Sin descripción de cobertura"}</p>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${eConf.color}`}>{eConf.label}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-black text-emerald-600">
                        ${(cot.valor || 0).toLocaleString("es-CO")}
                      </span>
                      {cot.estado !== "aceptada" && (
                        <button
                          onClick={async () => {
                            await db.transact([db.tx.cotizaciones[cot.id].update({ estado: "aceptada" })]);
                          }}
                          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 px-3 py-1.5 rounded-lg transition-all"
                        >
                          Marcar como aceptada
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
          )}

          {/* Datos completos Tab */}
          {activeTab === "datos" && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
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
                  { label: "ID Soft Cliente", field: "soft_cliente_id", value: lead.soft_cliente_id },
                ].map(({ label, field, value }) => (
                  <div key={field} className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</label>
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
          )}
        </div>

        {/* Right: Quick actions sidebar */}
        <div className="space-y-4">
          {/* Quick actions */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Acciones rápidas</h3>
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

          {/* Meta */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Información del registro</h3>
            <div className="space-y-2 text-sm">
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
          <div className={`rounded-2xl border p-5 ${lead.sincronizado_soft ? "bg-green-50 border-green-100" : "bg-slate-50 border-slate-100"}`}>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Estado Soft Seguros</h3>
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

      {/* Email Composer Modal */}
      {showEmailComposer && lead.email && (
        <EmailComposer 
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

// ── Sub-forms ──────────────────────────────────────────────────────────────

function AddInteraccionForm({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const [tipo, setTipo] = useState("llamada");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const newId = crypto.randomUUID();
    await db.transact([
      db.tx.interacciones[newId].update({
        leadId,
        tipo,
        notas,
        createdAt: Date.now(),
      }),
      // Link to lead
      db.tx.interacciones[newId].link({ lead: leadId }),
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

function AddCotizacionForm({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const [form, setForm] = useState({ aseguradora: "", valor: "", cobertura: "", estado: "enviada" });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const newId = crypto.randomUUID();
    await db.transact([
      db.tx.cotizaciones[newId].update({
        leadId,
        aseguradora: form.aseguradora,
        valor: parseFloat(form.valor) || 0,
        cobertura: form.cobertura,
        estado: form.estado,
        fuente: "Manual",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
      db.tx.cotizaciones[newId].link({ lead: leadId }),
    ]);
    setSaving(false);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-slate-700">Nueva cotización</h4>
        <button type="button" onClick={onClose} className="text-slate-300 hover:text-slate-500"><X className="h-4 w-4" /></button>
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
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Prima (COP) <span className="text-red-500">*</span></label>
          <input
            required type="number" value={form.valor}
            onChange={e => setForm({ ...form, valor: e.target.value })}
            placeholder="1500000"
            className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all text-sm"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Descripción / Cobertura</label>
        <input
          value={form.cobertura}
          onChange={e => setForm({ ...form, cobertura: e.target.value })}
          placeholder="Todo riesgo, básico, etc."
          className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all text-sm"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-slate-600">Cancelar</button>
        <button type="submit" disabled={saving} className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50">
          {saving ? "Guardando…" : "Guardar cotización"}
        </button>
      </div>
    </form>
  );
}

"use client";

import { db } from "@/lib/instant-db";
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Phone, 
  Mail, 
  Calendar, 
  RefreshCw,
  CheckCircle2,
  X,
  Flame,
  Zap,
  Thermometer,
  Snowflake,
  Car,
  Heart,
  Building2,
  Shield,
  Home,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";

// ✅ Etapas correctas según PRD v2.0
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

const STAGE_CONFIG: Record<string, { color: string; dotColor: string; textColor: string; bgBadge: string }> = {
  "Nuevo":               { color: "border-t-blue-500",    dotColor: "bg-blue-500",    textColor: "text-blue-600",    bgBadge: "bg-blue-50 text-blue-700" },
  "Contacto inmediato":  { color: "border-t-violet-500",  dotColor: "bg-violet-500",  textColor: "text-violet-600",  bgBadge: "bg-violet-50 text-violet-700" },
  "Contactado":          { color: "border-t-indigo-500",  dotColor: "bg-indigo-500",  textColor: "text-indigo-600",  bgBadge: "bg-indigo-50 text-indigo-700" },
  "Calificado":          { color: "border-t-purple-500",  dotColor: "bg-purple-500",  textColor: "text-purple-600",  bgBadge: "bg-purple-50 text-purple-700" },
  "Documentos pendientes":{ color: "border-t-amber-500",  dotColor: "bg-amber-500",   textColor: "text-amber-600",   bgBadge: "bg-amber-50 text-amber-700" },
  "Cotización enviada":  { color: "border-t-orange-500",  dotColor: "bg-orange-500",  textColor: "text-orange-600",  bgBadge: "bg-orange-50 text-orange-700" },
  "Seguimiento":         { color: "border-t-cyan-500",    dotColor: "bg-cyan-500",    textColor: "text-cyan-600",    bgBadge: "bg-cyan-50 text-cyan-700" },
  "Ganado / Aprobado":   { color: "border-t-emerald-500", dotColor: "bg-emerald-500", textColor: "text-emerald-600", bgBadge: "bg-emerald-50 text-emerald-700" },
  "Enviando a Soft…":    { color: "border-t-teal-500",    dotColor: "bg-teal-500",    textColor: "text-teal-600",    bgBadge: "bg-teal-50 text-teal-700" },
  "Sincronizado ✓":      { color: "border-t-green-500",   dotColor: "bg-green-500",   textColor: "text-green-600",   bgBadge: "bg-green-50 text-green-700" },
  "Rechazado":           { color: "border-t-rose-500",    dotColor: "bg-rose-500",    textColor: "text-rose-600",    bgBadge: "bg-rose-50 text-rose-700" },
  "Perdido / Inactivo":  { color: "border-t-slate-400",   dotColor: "bg-slate-400",   textColor: "text-slate-500",   bgBadge: "bg-slate-100 text-slate-600" },
};

const RAMO_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "auto": Car,
  "salud": Heart,
  "empresarial": Building2,
  "cumplimiento": Shield,
  "soat": Car,
  "hogar": Home,
};

function ScoreBadge({ score }: { score?: number }) {
  if (!score) return null;
  if (score >= 80) return (
    <span className="flex items-center gap-0.5 text-[9px] font-black text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded-full">
      <Flame className="h-2.5 w-2.5" /> URGENTE
    </span>
  );
  if (score >= 60) return (
    <span className="flex items-center gap-0.5 text-[9px] font-black text-orange-600 bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded-full">
      <Zap className="h-2.5 w-2.5" /> CALIENTE
    </span>
  );
  if (score >= 40) return (
    <span className="flex items-center gap-0.5 text-[9px] font-black text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-full">
      <Thermometer className="h-2.5 w-2.5" /> TIBIO
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 text-[9px] font-black text-slate-400 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-full">
      <Snowflake className="h-2.5 w-2.5" /> FRÍO
    </span>
  );
}

// Helper: Visible stages for the compact kanban view (hide terminal stages by default)
const VISIBLE_STAGES = STAGES.filter(s => s !== "Rechazado" && s !== "Perdido / Inactivo" && s !== "Enviando a Soft…");

export default function LeadsPage() {
  const { isLoading, data, error } = db.useQuery({ leads: {} });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const router = useRouter();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (isLoading) return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-4">
      <div className="relative flex h-14 w-14">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-14 w-14 bg-blue-500 shadow-xl shadow-blue-500/50 flex items-center justify-center">
          <RefreshCw className="text-white h-6 w-6 animate-spin" />
        </span>
      </div>
      <p className="text-sm font-medium text-slate-400">Conectando con la base de datos…</p>
    </div>
  );
  
  if (error) return (
    <div className="p-8 border border-red-200 bg-red-50/50 backdrop-blur-md rounded-2xl m-8 flex flex-col items-center justify-center">
      <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
         <span className="text-red-600 font-bold text-xl">!</span>
      </div>
      <h3 className="text-lg font-bold text-red-800">Error de conexión</h3>
      <p className="text-red-600/80 mt-2 text-sm">{error.message}</p>
    </div>
  );

  const allLeads = data?.leads || [];
  const filteredLeads = search
    ? allLeads.filter(l => 
        l.name?.toLowerCase().includes(search.toLowerCase()) ||
        l.phone?.includes(search) ||
        l.email?.toLowerCase().includes(search.toLowerCase())
      )
    : allLeads;

  const displayedStages = showAll ? STAGES : VISIBLE_STAGES;

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const leadId = active.id as string;
    const newStatus = over.id as string;

    if (STAGES.includes(newStatus)) {
      await db.transact([
        db.tx.leads[leadId].update({ status: newStatus, updatedAt: Date.now() }),
      ]);
    }
    setActiveId(null);
  };

  const totalLeads = allLeads.length;
  const totalGanados = allLeads.filter(l => l.status === "Ganado / Aprobado" || l.status === "Sincronizado ✓").length;
  const totalNuevos = allLeads.filter(l => l.status === "Nuevo").length;
  const tasaConversion = totalLeads > 0 ? Math.round((totalGanados / totalLeads) * 100) : 0;

  return (
    <div className="space-y-6 flex flex-col h-full w-full relative">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-900">Pipeline Pre-Venta</h2>
          <p className="text-slate-400 mt-0.5 text-[13px] font-medium">Arrastra los prospectos entre etapas para gestionar tu embudo.</p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar prospecto…"
              className="pl-9 pr-4 py-1.5 bg-white/70 backdrop-blur-lg border border-slate-200/80 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white w-52 transition-all shadow-sm"
            />
          </div>
          <button
            onClick={() => setShowAll(!showAll)}
            className="px-3 py-1.5 text-xs font-bold rounded-lg text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-sm"
          >
            {showAll ? "Ocultar terminados" : "Ver todas las etapas"}
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center px-4 py-1.5 bg-blue-600 text-white text-[13px] font-bold rounded-lg hover:bg-blue-700 transition-all"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={3} />
            Crear Prospecto
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total Leads", value: totalLeads, color: "text-slate-800" },
          { label: "Nuevos hoy", value: totalNuevos, color: "text-blue-600" },
          { label: "Ganados", value: totalGanados, color: "text-emerald-600" },
          { label: "Conversión", value: `${tasaConversion}%`, color: "text-indigo-600" },
        ].map(stat => (
          <div key={stat.label} className="bg-white/60 backdrop-blur-md rounded-xl border border-white/80 shadow-sm p-3">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">{stat.label}</p>
            <p className={`text-xl font-black ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Kanban */}
      <div className="flex space-x-3 overflow-x-auto pb-6 -mx-6 px-6 flex-1">
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={(e) => setActiveId(e.active.id as string)}
          onDragEnd={handleDragEnd}
        >
          {displayedStages.map((stage) => {
            const cfg = STAGE_CONFIG[stage] || { color: "border-t-slate-300", dotColor: "bg-slate-300", textColor: "text-slate-500", bgBadge: "bg-slate-50 text-slate-600" };
            const stageLeads = filteredLeads.filter((lead) => lead.status === stage);

            return (
              <div 
                key={stage}
                id={stage}
                className={`flex-shrink-0 w-64 flex flex-col bg-white/50 backdrop-blur-2xl rounded-xl border-t-[3px] ${cfg.color} border border-white shadow-sm overflow-hidden`}
              >
                {/* Column Header */}
                <div className="px-3 py-2.5 flex items-center justify-between bg-white/40 border-b border-slate-200/30">
                  <div className="flex items-center space-x-2">
                    <div className={`h-2 w-2 rounded-full ${cfg.dotColor}`} />
                    <h3 className="font-bold text-slate-700 text-xs tracking-wide">{stage}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${cfg.bgBadge}`}>
                      {stageLeads.length}
                    </span>
                  </div>
                  <button className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-white transition-colors">
                    <MoreVertical className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                </div>
                
                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-2.5 space-y-2 min-h-[120px]">
                  {stageLeads.length === 0 && (
                    <div className="flex items-center justify-center h-14 rounded-lg border-2 border-dashed border-slate-200/60">
                      <p className="text-[11px] text-slate-300 font-medium">Sin prospectos</p>
                    </div>
                  )}
                  {stageLeads.map((lead) => (
                    <LeadCard key={lead.id} lead={lead} onClick={() => router.push(`/leads/${lead.id}`)} />
                  ))}
                </div>
              </div>
            );
          })}
        </DndContext>
      </div>

      {isModalOpen && <CreateLeadModal onClose={() => setIsModalOpen(false)} />}
    </div>
  );
}

function LeadCard({ lead, onClick }: { lead: any; onClick: () => void }) {
  const initial = lead.name ? lead.name.charAt(0).toUpperCase() : "?";
  const RamoIcon = RAMO_ICONS[lead.type] || Shield;

  return (
    <div
      onClick={onClick}
      className="bg-white p-3 rounded-lg shadow-sm border border-slate-100 hover:border-blue-300/60 hover:shadow-sm transition-all duration-200 cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-black text-white shadow-sm">
            {initial}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-700 group-hover:text-blue-600 transition-colors">{lead.name || "Sin nombre"}</span>
            {lead.type && (
              <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                <RamoIcon className="h-2.5 w-2.5" />
                {lead.type}
              </span>
            )}
          </div>
        </div>
        <ScoreBadge score={lead.score} />
      </div>
      
      <div className="space-y-1.5">
        {lead.phone && (
          <div className="flex items-center text-[10px] text-slate-400 font-medium">
            <Phone className="h-3 w-3 mr-1.5 shrink-0" />
            <span className="truncate">{lead.phone}</span>
          </div>
        )}
        {lead.email && (
          <div className="flex items-center text-[10px] text-slate-400 font-medium">
            <Mail className="h-3 w-3 mr-1.5 shrink-0" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
      </div>

      <div className="mt-2 pt-2 border-t border-slate-100/80 flex items-center justify-between">
        <div className="flex items-center text-[9px] text-slate-300 font-bold uppercase tracking-wider">
          <Calendar className="h-3 w-3 mr-1 opacity-60" />
          {new Date(lead.createdAt || Date.now()).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}
        </div>
        {lead.sincronizado_soft && (
          <div className="flex items-center gap-1 text-[9px] text-green-600 font-bold">
            <CheckCircle2 className="h-3 w-3" strokeWidth={3} />
            Soft ✓
          </div>
        )}
      </div>
    </div>
  );
}

const RAMOS = ["Auto", "Salud", "Vida", "SOAT", "Hogar", "PYME", "Cumplimiento", "Otro"];
const FUENTES = ["Sitio Web", "Meta Ads", "Google Ads", "WhatsApp", "Referido", "Llamada directa", "CSV Import", "Otro"];

function CreateLeadModal({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({
    name: "",
    phone: "+57",
    email: "",
    documento: "",
    city: "",
    type: "",
    source: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const newId = crypto.randomUUID();
    
    await db.transact([
      db.tx.leads[newId].update({
        ...formData,
        status: "Nuevo",
        sincronizado_soft: false,
        score: 20,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    ]);
    
    setIsSubmitting(false);
    onClose();
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    let val = e.target.value;
    if (field === "phone") {
      // Strip everything, then enforce +57 prefix once
      const digits = val.replace(/\D/g, "").replace(/^(57)+/, "");
      val = "+57" + digits;
    }
    setFormData({ ...formData, [field]: val });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600">
          <h3 className="font-bold text-white text-lg">Nuevo Prospecto</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-white/20 text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Nombre */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre Completo <span className="text-red-500">*</span></label>
            <input 
              required value={formData.name} onChange={set("name")}
              className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-sm"
              placeholder="Ej. Juan Pérez"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Documento */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cédula / NIT</label>
              <input 
                value={formData.documento} onChange={set("documento")}
                className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-sm"
                placeholder="1010123456"
              />
            </div>
            {/* Teléfono */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Celular <span className="text-red-500">*</span></label>
              <input 
                required value={formData.phone} onChange={set("phone")}
                className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-sm"
                placeholder="+57 300..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Correo</label>
              <input 
                type="email" value={formData.email} onChange={set("email")}
                className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-sm"
                placeholder="juan@ejemplo.com"
              />
            </div>
            {/* Ciudad */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ciudad</label>
              <input 
                value={formData.city} onChange={set("city")}
                className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-sm"
                placeholder="Bogotá"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Ramo */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ramo <span className="text-red-500">*</span></label>
              <select 
                required
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-sm"
              >
                <option value="">Seleccionar…</option>
                {RAMOS.map(r => <option key={r} value={r.toLowerCase()}>{r}</option>)}
              </select>
            </div>
            {/* Fuente */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fuente</label>
              <select 
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-sm"
              >
                <option value="">Seleccionar…</option>
                {FUENTES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-400 hover:text-slate-700 transition-colors">
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-60"
            >
              {isSubmitting ? "Guardando…" : "Crear Prospecto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

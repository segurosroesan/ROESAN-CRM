"use client";

import { db } from "@/lib/instant-db";
import { id as newId } from "@instantdb/react";
import {
  RefreshCw,
  Search,
  MoreVertical,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shield,
  Car,
  Heart,
  Home,
  Building2,
  X,
  Plus,
  Zap,
  Download,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

const BACKEND = `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3002"}/api`;

// Etapas del pipeline de renovaciones (PRD v2.0)
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

const STAGE_CONFIG: Record<string, { color: string; dot: string; badge: string; border: string }> = {
  "Importada":          { color: "from-slate-400 to-slate-500", dot: "bg-slate-400",   badge: "bg-slate-100 text-slate-600",    border: "border-t-slate-400" },
  "Contacto previo":    { color: "from-blue-500 to-blue-600",   dot: "bg-blue-500",    badge: "bg-blue-50 text-blue-700",       border: "border-t-blue-500" },
  "En gestión":         { color: "from-violet-500 to-violet-600",dot: "bg-violet-500", badge: "bg-violet-50 text-violet-700",   border: "border-t-violet-500" },
  "Cotización enviada": { color: "from-amber-500 to-orange-500", dot: "bg-amber-500",  badge: "bg-amber-50 text-amber-700",     border: "border-t-amber-500" },
  "Negociando":         { color: "from-orange-500 to-orange-600",dot: "bg-orange-500", badge: "bg-orange-50 text-orange-700",   border: "border-t-orange-500" },
  "Confirmada":         { color: "from-cyan-500 to-teal-500",   dot: "bg-cyan-500",    badge: "bg-cyan-50 text-cyan-700",       border: "border-t-cyan-500" },
  "Renovada en Soft ✓": { color: "from-emerald-500 to-green-600",dot: "bg-emerald-500",badge: "bg-emerald-50 text-emerald-700", border: "border-t-emerald-500" },
  "No renueva":         { color: "from-rose-500 to-rose-600",   dot: "bg-rose-500",    badge: "bg-rose-50 text-rose-700",       border: "border-t-rose-500" },
  "Perdida":            { color: "from-slate-400 to-slate-500", dot: "bg-slate-300",   badge: "bg-slate-100 text-slate-500",    border: "border-t-slate-300" },
};

const RAMO_META: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  "auto":         { icon: Car,      color: "text-blue-600 bg-blue-50" },
  "salud":        { icon: Heart,    color: "text-rose-600 bg-rose-50" },
  "vida":         { icon: Heart,    color: "text-red-600 bg-red-50" },
  "soat":         { icon: Car,      color: "text-amber-600 bg-amber-50" },
  "hogar":        { icon: Home,     color: "text-teal-600 bg-teal-50" },
  "pyme":         { icon: Building2,color: "text-violet-600 bg-violet-50" },
  "empresarial":  { icon: Building2,color: "text-violet-600 bg-violet-50" },
  "cumplimiento": { icon: Shield,   color: "text-slate-600 bg-slate-50" },
  "responsabilidad_civil": { icon: Shield, color: "text-slate-600 bg-slate-50" },
  "rc_medica":    { icon: Shield,   color: "text-slate-600 bg-slate-50" },
  "transportes":  { icon: Car,      color: "text-blue-600 bg-blue-50" },
};

// Fallback genérico para ramos no mapeados (NO usar Car)
const RAMO_DEFAULT = { icon: Shield, color: "text-slate-500 bg-slate-50" };

function urgencyBadge(dias: number) {
  if (dias <= 15) return { label: `D-${dias} ⚠️ CRÍTICO`, cls: "text-red-700 bg-red-50 border border-red-200" };
  if (dias <= 30) return { label: `D-${dias} URGENTE`, cls: "text-orange-700 bg-orange-50 border border-orange-200" };
  if (dias <= 45) return { label: `D-${dias}`, cls: "text-amber-700 bg-amber-50 border border-amber-100" };
  return { label: `D-${dias}`, cls: "text-slate-500 bg-slate-50 border border-slate-100" };
}

interface RenovacionCard {
  id: string;
  name: string;
  type: string;
  poliza: string;
  aseguradora: string;
  prima: number;
  diasVencer: number;
  status: string;
  phone: string;
  placa: string;    // solo para auto/soat
  objeto: string;   // para otros ramos
}

function RenovacionCard({ ren, onClick, onMoveToNext }: { ren: RenovacionCard; onClick: () => void; onMoveToNext?: () => void }) {
  // Normalizar el tipo para el mapeo de iconos
  const tipoNormalizado = (ren.type || "").toLowerCase().trim();
  const meta = RAMO_META[tipoNormalizado] || RAMO_DEFAULT;
  const RamoIcon = meta.icon;
  const urgency = urgencyBadge(ren.diasVencer);

  const isVehicle = tipoNormalizado === "auto" || tipoNormalizado === "soat" || tipoNormalizado === "transportes";

  const nextStageIndex = STAGES_RENOVACION.indexOf(ren.status) + 1;
  const nextStage = nextStageIndex > 0 && nextStageIndex < STAGES_RENOVACION.length ? STAGES_RENOVACION[nextStageIndex] : null;

  return (
    <div
      onClick={onClick}
      className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:border-blue-300/50 hover:shadow-md transition-all duration-200 cursor-pointer group space-y-3"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 ${meta.color}`}>
            <RamoIcon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-700 group-hover:text-blue-600 transition-colors leading-tight">{ren.name}</p>
            {isVehicle && ren.placa && ren.placa !== "—" && (
              <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                Placa: {ren.placa.toUpperCase()}
              </p>
            )}
            {!isVehicle && ren.objeto && ren.objeto !== "—" && (
              <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[160px]" title={ren.objeto}>
                {ren.objeto}
              </p>
            )}
            <p className="text-[9px] text-slate-400 font-mono mt-0.5">{ren.poliza}</p>
          </div>
        </div>
        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${urgency.cls}`}>
          {urgency.label}
        </span>
      </div>

      {/* Info */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-slate-400 font-medium">{ren.aseguradora}</span>
          <span className="font-black text-emerald-600">${ren.prima.toLocaleString("es-CO")}</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
          <Calendar className="h-3 w-3" />
          Vence en {ren.diasVencer} días
        </div>
      </div>
      {/* Action Button */}
      {nextStage && onMoveToNext && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMoveToNext();
          }}
          className="w-full flex items-center justify-center gap-1 bg-slate-50 hover:bg-blue-50 text-blue-600 border border-slate-200 hover:border-blue-200 text-[10px] font-bold py-1.5 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 mt-2"
        >
          Mover a {nextStage}
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
        </button>
      )}
    </div>
  );
}

function DroppableColumn({ stage, cfg, stageRens, children }: { stage: string; cfg: any; stageRens: any[]; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div 
      ref={setNodeRef}
      className={`flex-shrink-0 w-[280px] flex flex-col bg-slate-50/50 rounded-2xl border-t-4 ${cfg.border} shadow-sm overflow-hidden transition-colors ${isOver ? 'ring-2 ring-blue-500 bg-blue-50/30' : 'border border-slate-200'}`}
    >
      <div className="px-4 py-3 flex items-center justify-between bg-white border-b border-slate-100 pointer-events-none">
        <div className="flex items-center space-x-2">
          <div className={`h-2 w-2 rounded-full ${cfg.dot}`} />
          <h3 className="font-bold text-slate-700 text-xs tracking-wide">{stage}</h3>
          <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${cfg.badge}`}>
            {stageRens.length}
          </span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[150px]">
        {children}
      </div>
    </div>
  );
}

function DraggableRenovacionCard({ ren, onClick, onMoveToNext }: { ren: RenovacionCard; onClick: () => void; onMoveToNext: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: ren.id,
    data: { ren },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
    position: isDragging ? "relative" : undefined,
  } as React.CSSProperties;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <RenovacionCard ren={ren} onClick={onClick} onMoveToNext={onMoveToNext} />
    </div>
  );
}

const RAMO_LABELS: Record<string, string> = {
  "auto": "Autos", "soat": "SOAT", "vida": "Vida", "salud": "Salud",
  "hogar": "Hogar", "pyme": "Pyme", "empresarial": "Empresarial",
  "cumplimiento": "Cumplimiento", "responsabilidad_civil": "RC", "rc_medica": "RC Médica",
  "transportes": "Transportes",
};

export default function RenovacionesPage() {
  const [search, setSearch] = useState("");
  const [filterRamo, setFilterRamo] = useState<string | null>(null);
  const [isImportando, setIsImportando] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importResult, setImportResult] = useState<{
    mesImportado: string;
    nuevasCreadas: number;
    actualizadas: number;
    errores: number;
    duracionMs: number;
  } | null>(null);
  const router = useRouter();

  // Datos reales desde InstantDB
  const { data, isLoading } = db.useQuery({
    leads: {
      $: { where: { pipeline_tipo: "renovacion" } },
    },
  });

  const renovaciones: RenovacionCard[] = (data?.leads || []).map((lead: any) => {
    const diasVencer = lead.fecha_fin_poliza
      ? Math.ceil((new Date(lead.fecha_fin_poliza).getTime() - Date.now()) / 86_400_000)
      : lead.dias_para_vencer ?? 60;
    const tipoLead = (lead.type || "").toLowerCase().trim();
    const esVehiculo = tipoLead === "auto" || tipoLead === "soat" || tipoLead === "transportes";
    return {
      id: lead.id,
      name: lead.name || "Sin nombre",
      type: lead.type || "",
      poliza: lead.numero_poliza || "—",
      aseguradora: lead.aseguradora || "—",
      prima: Number(lead.prima_actual || 0),
      diasVencer: Math.max(diasVencer, 0),
      status: lead.status || "Importada",
      phone: lead.phone || "",
      placa: esVehiculo ? (lead.placa || lead.vehiclePlate || "—") : "—",
      objeto: !esVehiculo ? (lead.objeto_asegurado || lead.placa || lead.vehiclePlate || "—") : "—",
    };
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Ramos presentes en los datos, con conteo
  const ramosCounts = renovaciones.reduce<Record<string, number>>((acc, r) => {
    const t = r.type || "otro";
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  const ramosDisponibles = Object.entries(ramosCounts).sort((a, b) => b[1] - a[1]);

  const filtered = renovaciones.filter(r => {
    const matchSearch = !search ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.poliza.toLowerCase().includes(search.toLowerCase()) ||
      r.aseguradora.toLowerCase().includes(search.toLowerCase());
    const matchRamo = !filterRamo || r.type === filterRamo;
    return matchSearch && matchRamo;
  });

  const moveToNextStage = async (leadId: string, currentStage: string) => {
    const nextIndex = STAGES_RENOVACION.indexOf(currentStage) + 1;
    if (nextIndex > 0 && nextIndex < STAGES_RENOVACION.length) {
      await db.transact([
        db.tx.leads[leadId].update({ status: STAGES_RENOVACION[nextIndex], updatedAt: Date.now() }),
      ]);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const newStatus = over.id as string;
    if (!STAGES_RENOVACION.includes(newStatus)) return;
    const leadId = active.id as string;
    await db.transact([
      db.tx.leads[leadId].update({ status: newStatus, updatedAt: Date.now() }),
    ]);
  };

  const handleImportar = async () => {
    setIsImportando(true);
    setImportResult(null);
    try {
      const res = await fetch(`${BACKEND}/renovaciones/import/direct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const result = await res.json();
      setImportResult(result);
    } catch (err: any) {
      alert(`Error al importar: ${err.message}`);
    } finally {
      setIsImportando(false);
    }
  };

  // Stats
  const criticas = renovaciones.filter(r => r.diasVencer <= 15).length;
  const urgentes = renovaciones.filter(r => r.diasVencer > 15 && r.diasVencer <= 30).length;
  const confirmadas = renovaciones.filter(r => r.status === "Confirmada" || r.status === "Renovada en Soft ✓").length;
  const primaTotal = renovaciones.reduce((acc, r) => acc + r.prima, 0);

  // Solo mostrar las 7 primeras etapas en el kanban principal
  const VISIBLE_STAGES = STAGES_RENOVACION.filter(s => !["No renueva", "Perdida"].includes(s));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm font-medium">
        Cargando renovaciones…
      </div>
    );
  }

  return (
    <div className="space-y-6 flex flex-col h-full w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">Pipeline Renovaciones</h2>
          <p className="text-slate-400 mt-0.5 text-sm font-medium">Pólizas próximas a vencer importadas desde Soft Seguros.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, póliza…"
              className="pl-10 pr-4 py-2.5 bg-white/70 border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-56 transition-all shadow-sm"
            />
          </div>
          <button
            onClick={handleImportar}
            disabled={isImportando}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
          >
            <Download className={`h-4 w-4 ${isImportando ? "animate-bounce" : ""}`} />
            {isImportando ? "Importando…" : "Importar ahora"}
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-emerald-600/30 shadow-lg"
          >
            <Plus className="h-4 w-4" strokeWidth={3} />
            Nueva Renovación
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total pólizas", value: renovaciones.length, icon: RefreshCw, color: "text-blue-600 bg-blue-50" },
          {
            label: "Críticas (≤15 días)", value: criticas, icon: AlertTriangle, color: "text-red-600 bg-red-50",
            pulse: criticas > 0
          },
          { label: "Urgentes (16–30 d)", value: urgentes, icon: Clock, color: "text-orange-600 bg-orange-50" },
          { label: "Confirmadas", value: confirmadas, icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50" },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4">
            <div className={`relative h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${stat.color}`}>
              <stat.icon className="h-5 w-5" />
              {(stat as any).pulse && stat.value > 0 && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white animate-pulse" />
              )}
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
              <p className="text-2xl font-black text-slate-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros por ramo */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilterRamo(null)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
            filterRamo === null
              ? "bg-slate-800 text-white border-slate-800 shadow-sm"
              : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
          }`}
        >
          Todos
          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${filterRamo === null ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
            {renovaciones.length}
          </span>
        </button>
        {ramosDisponibles.map(([ramo, count]) => {
          const meta = RAMO_META[ramo] || RAMO_DEFAULT;
          const RamoIcon = meta.icon;
          const label = RAMO_LABELS[ramo] || ramo.charAt(0).toUpperCase() + ramo.slice(1);
          const isActive = filterRamo === ramo;
          return (
            <button
              key={ramo}
              onClick={() => setFilterRamo(isActive ? null : ramo)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                isActive
                  ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              }`}
            >
              <RamoIcon className="h-3 w-3" />
              {label}
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Prima en riesgo */}
      <div className="flex items-center gap-4 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl px-5 py-4">
        <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
          <DollarSign className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Prima total en gestión</p>
          <p className="text-2xl font-black text-indigo-800">${primaTotal.toLocaleString("es-CO")} COP</p>
        </div>
        <div className="ml-auto text-xs text-indigo-400 font-medium">
          <Zap className="h-4 w-4 text-indigo-400 inline mr-1" />
          {renovaciones.filter(r => !["Renovada en Soft ✓", "No renueva", "Perdida"].includes(r.status)).length} sin confirmar
        </div>
      </div>

      {/* Kanban */}
      <div className="flex space-x-5 overflow-x-auto pb-8 -mx-10 px-10 flex-1">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragEnd={handleDragEnd}
        >
          {VISIBLE_STAGES.map(stage => {
            const cfg = STAGE_CONFIG[stage] || STAGE_CONFIG["Importada"];
            const stageRens = filtered.filter(r => r.status === stage);

            return (
              <DroppableColumn key={stage} stage={stage} cfg={cfg} stageRens={stageRens}>
                {stageRens.length === 0 && (
                  <div className="flex items-center justify-center h-16 rounded-xl border-2 border-dashed border-slate-200/60 pointer-events-none">
                    <p className="text-[11px] text-slate-300 font-medium">Sin pólizas</p>
                  </div>
                )}
                {stageRens.map(ren => (
                  <DraggableRenovacionCard
                    key={ren.id}
                    ren={ren}
                    onClick={() => router.push(`/renovaciones/${ren.id}`)}
                    onMoveToNext={() => moveToNextStage(ren.id, ren.status)}
                  />
                ))}
              </DroppableColumn>
            );
          })}
        </DndContext>
      </div>

      {/* Modal resultado de importación */}
      {importResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-500 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Importación completada</h3>
                {importResult.mesImportado && (
                  <p className="text-xs text-slate-500 font-medium capitalize">Pólizas de {importResult.mesImportado}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-emerald-50 rounded-xl p-3">
                <p className="text-2xl font-black text-emerald-600">{importResult.nuevasCreadas}</p>
                <p className="text-[10px] font-bold text-emerald-400 uppercase">Nuevas</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-2xl font-black text-blue-600">{importResult.actualizadas}</p>
                <p className="text-[10px] font-bold text-blue-400 uppercase">Actualizadas</p>
              </div>
              <div className="bg-red-50 rounded-xl p-3">
                <p className="text-2xl font-black text-red-600">{importResult.errores}</p>
                <p className="text-[10px] font-bold text-red-400 uppercase">Errores</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 text-center">
              Completado en {(importResult.duracionMs / 1000).toFixed(1)}s
            </p>
            <button
              onClick={() => setImportResult(null)}
              className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-700 transition-all"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {showImportModal && <ManualRenovacionModal onClose={() => setShowImportModal(false)} />}
    </div>
  );
}

function ManualRenovacionModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    name: "", phone: "+57", email: "", poliza: "",
    aseguradora: "", prima: "", type: "", diasVencer: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const diasVencer = Number(form.diasVencer);
    const fechaFin = new Date();
    fechaFin.setDate(fechaFin.getDate() + diasVencer);

    await db.transact([
      db.tx.leads[newId()].update({
        name: form.name,
        phone: form.phone,
        email: form.email,
        pipeline_tipo: "renovacion",
        status: "Importada",
        type: form.type,
        numero_poliza: form.poliza,
        aseguradora: form.aseguradora,
        prima_actual: Number(form.prima),
        dias_para_vencer: diasVencer,
        fecha_fin_poliza: fechaFin.toISOString().split("T")[0],
        sincronizado_soft: false,
        score: diasVencer <= 15 ? 40 : diasVencer <= 30 ? 25 : 10,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    ]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600">
          <h3 className="font-bold text-white text-lg">Nueva Renovación Manual</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-white/20 text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nombre cliente *</label>
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-500 text-sm" placeholder="Juan Pérez" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">N° Póliza *</label>
              <input required value={form.poliza} onChange={e => setForm({ ...form, poliza: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-500 text-sm font-mono" placeholder="POL-2024-0000" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Teléfono</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-500 text-sm" placeholder="+573001234567" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-500 text-sm" placeholder="cliente@email.com" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Aseguradora *</label>
              <input required value={form.aseguradora} onChange={e => setForm({ ...form, aseguradora: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-500 text-sm" placeholder="Sura, Allianz…" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Prima (COP) *</label>
              <input required type="number" value={form.prima} onChange={e => setForm({ ...form, prima: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-500 text-sm" placeholder="1500000" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ramo *</label>
              <select required value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-500 text-sm">
                <option value="">Seleccionar…</option>
                {["auto", "soat", "vida", "salud", "hogar", "empresarial", "cumplimiento"].map(r => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Días para vencer *</label>
              <input required type="number" value={form.diasVencer} onChange={e => setForm({ ...form, diasVencer: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-500 text-sm" placeholder="30" />
            </div>
          </div>
          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-400 hover:text-slate-700">Cancelar</button>
            <button type="submit" className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-sm transition-all">
              Crear Renovación
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

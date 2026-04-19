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
  X
} from "lucide-react";
import { useState } from "react";
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

const STAGES = [
  "Nuevo",
  "Contactado",
  "Calificado",
  "Propuesta Enviada",
  "Ganado",
  "Perdido",
];

const STAGE_COLORS: Record<string, string> = {
  "Nuevo": "bg-blue-500",
  "Contactado": "bg-indigo-500",
  "Calificado": "bg-purple-500",
  "Propuesta Enviada": "bg-amber-500",
  "Ganado": "bg-emerald-500",
  "Perdido": "bg-rose-500",
};

export default function LeadsPage() {
  const { isLoading, data, error } = db.useQuery({ leads: {} });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (isLoading) return (
    <div className="h-full w-full flex items-center justify-center">
      <div className="relative flex h-14 w-14">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-14 w-14 bg-blue-500 shadow-xl shadow-blue-500/50 flex items-center justify-center">
          <RefreshCw className="text-white h-6 w-6 animate-spin" />
        </span>
      </div>
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

  const leads = data?.leads || [];

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

  return (
    <div className="space-y-8 flex flex-col h-full w-full relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 drop-shadow-sm">Pipeline Comercial</h2>
          <p className="text-slate-500 mt-1 text-sm font-medium">Arrastra tus prospectos y cierra más ventas.</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="relative group">
            <div className="absolute inset-0 rounded-xl bg-blue-400/20 blur opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Buscar prospecto por nombre..." 
              className="relative pl-10 pr-4 py-2.5 bg-white/70 backdrop-blur-lg border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white w-72 transition-all shadow-sm"
            />
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="relative flex items-center px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-all shadow-[0_8px_20px_-6px_rgba(37,99,235,0.5)] hover:shadow-[0_12px_25px_-8px_rgba(37,99,235,0.6)] hover:-translate-y-0.5 active:translate-y-0 group overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-white/20 to-blue-400/0 -translate-x-[150%] group-hover:animate-[shimmer_1.5s_infinite]"></div>
            <Plus className="mr-2 h-4 w-4" strokeWidth={3} />
            Crear Prospecto
          </button>
        </div>
      </div>

      <div className="flex space-x-6 overflow-x-auto pb-8 -mx-10 px-10 flex-1 scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300">
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={(e) => setActiveId(e.active.id as string)}
          onDragEnd={handleDragEnd}
        >
          {STAGES.map((stage) => (
            <div key={stage} className="flex-shrink-0 w-80 flex flex-col bg-white/40 backdrop-blur-3xl rounded-3xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.02)] overflow-hidden transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] relative group">
              <div className="absolute inset-0 bg-gradient-to-b from-white/60 to-transparent pointer-events-none"></div>
              
              <div className="p-5 flex items-center justify-between border-b border-slate-200/50 relative z-10 bg-white/30">
                <div className="flex items-center space-x-3">
                  <div className={`h-2.5 w-2.5 rounded-full ${STAGE_COLORS[stage] || 'bg-slate-400'} shadow-[0_0_8px_currentColor] opacity-80`} />
                  <h3 className="font-extrabold text-slate-800 text-sm tracking-wide">{stage}</h3>
                  <span className="bg-white text-slate-600 text-[11px] px-2.5 py-0.5 rounded-full border border-slate-200/80 shadow-sm font-black">
                    {leads.filter(l => l.status === stage).length}
                  </span>
                </div>
                <button className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-white transition-colors">
                  <MoreVertical className="h-4 w-4 text-slate-400" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide relative z-10">
                {leads
                  .filter((lead) => lead.status === stage)
                  .map((lead) => (
                    <LeadCard key={lead.id} lead={lead} stageColor={STAGE_COLORS[stage]} />
                  ))}
              </div>
            </div>
          ))}
        </DndContext>
      </div>

      {isModalOpen && <CreateLeadModal onClose={() => setIsModalOpen(false)} />}
    </div>
  );
}

function CreateLeadModal({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({
    name: "",
    phone: "+57",
    email: "",
    documento: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newId = crypto.randomUUID();
    
    await db.transact([
      db.tx.leads[newId].update({
        ...formData,
        status: "Nuevo",
        type: "Persona",
        sincronizado_soft: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    ]);
    
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-white/20 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="font-bold text-slate-800 text-lg">Nuevo Prospecto</h3>
          <button 
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-slate-200 text-slate-500 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre Completo <span className="text-red-500">*</span></label>
            <input 
              required
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all text-sm"
              placeholder="Ej. Juan Pérez"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Documento (CC) <span className="text-red-500">*</span></label>
              <input 
                required
                value={formData.documento}
                onChange={(e) => setFormData({...formData, documento: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all text-sm font-medium"
                placeholder="Ej. 1010123456"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Teléfono <span className="text-red-500">*</span></label>
              <input 
                required
                value={formData.phone}
                onChange={(e) => {
                  let val = e.target.value;
                  if (!val.startsWith("+57")) val = "+57" + val.replace("+57", "");
                  setFormData({...formData, phone: val});
                }}
                className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all text-sm font-medium"
                placeholder="+57..."
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Correo Electrónico</label>
            <input 
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all text-sm"
              placeholder="juan@ejemplo.com"
            />
          </div>

          <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-100">
            <button 
              type="button" 
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all active:scale-95"
            >
              Guardar Prospecto
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LeadCard({ lead, stageColor }: { lead: any, stageColor: string }) {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSyncing(true);
    
    try {
      const response = await fetch(`http://localhost:3002/sync/softseguros/${lead.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Enviamos todo el prospecto para que el backend pueda crear el cliente en SYNC-2 si no existe
        body: JSON.stringify({ leadData: lead }),
      });
      
      const result = await response.json();
      if (result.success) {
        alert(`${result.message}\n\nID Soft Seguros: ${result.softClient.id}`);
      } else {
        alert(result.message || "No se encontró el cliente o hubo un error.");
      }
    } catch (error) {
      console.error("Sync error:", error);
      alert("Error de red al sincronizar.");
    } finally {
      setIsSyncing(false);
    }
  };

  const initial = lead.name ? lead.name.charAt(0).toUpperCase() : "U";

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 hover:border-blue-400/50 hover:shadow-[0_8px_25px_-5px_rgba(59,130,246,0.15)] transition-all duration-300 transform cursor-grab active:cursor-grabbing group animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
           <div className={`h-8 w-8 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-xs font-black text-slate-600 border border-white shadow-sm`}>
             {initial}
           </div>
           <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">
             {lead.type || "Persona"}
           </span>
        </div>
        
        {lead.sincronizado_soft ? (
          <div className="bg-green-50 p-1.5 rounded-full border border-green-100 shadow-sm" title="Sincronizado con Soft Seguros">
             <CheckCircle2 className="h-3.5 w-3.5 text-green-500" strokeWidth={3} />
          </div>
        ) : (
          <div className="h-2 w-2 rounded-full bg-slate-200 mt-2" />
        )}
      </div>
      
      <h4 className="font-bold text-slate-800 text-sm group-hover:text-blue-600 transition-colors leading-tight line-clamp-2 mb-3">
        {lead.name}
      </h4>
      
      <div className="space-y-2 mb-4">
        <div className="flex items-center text-[11px] text-slate-500 font-semibold bg-slate-50/50 rounded-lg p-1.5 border border-slate-100/50 w-full">
          <Phone className="h-3.5 w-3.5 mr-2 text-blue-400" />
          <span className="truncate">{lead.phone || "Sin teléfono"}</span>
        </div>
        <div className="flex items-center text-[11px] text-slate-500 font-semibold bg-slate-50/50 rounded-lg p-1.5 border border-slate-100/50 w-full">
          <Mail className="h-3.5 w-3.5 mr-2 text-blue-400" />
          <span className="truncate">{lead.email || "Sin correo"}</span>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100/80 flex items-center justify-between">
        <div className="flex items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
          <Calendar className="h-3.5 w-3.5 mr-1.5 opacity-70" />
          {new Date(lead.createdAt || Date.now()).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}
        </div>
        
        <div className="flex items-center space-x-2">
           {lead.status === "Ganado" && !lead.sincronizado_soft && (
             <button 
               onClick={handleSync}
               disabled={isSyncing}
               className="flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white border border-blue-100 hover:border-blue-600 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group/btn shadow-sm"
               title="Sincronizar con Soft Seguros"
             >
               <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isSyncing ? 'animate-spin' : 'group-hover/btn:rotate-180 transition-transform duration-500'}`} />
               <span className="text-[10px] font-bold">Sync</span>
             </button>
           )}
        </div>
      </div>
    </div>
  );
}

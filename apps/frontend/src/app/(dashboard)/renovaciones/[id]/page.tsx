"use client";

import { db } from "@/lib/instant-db";
import { useParams, useRouter } from "next/navigation";
import { useState, useRef, use } from "react";

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

const STAGE_COLORS: Record<string, string> = {
  "Importada": "bg-blue-500",
  "Contacto previo": "bg-violet-500",
  "En gestión": "bg-purple-500",
  "Cotización enviada": "bg-amber-500",
  "Negociando": "bg-orange-500",
  "Confirmada": "bg-emerald-500",
  "Renovada en Soft ✓": "bg-green-600",
  "No renueva": "bg-rose-600",
  "Perdida": "bg-gray-500",
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

function diasBadge(dias: number) {
  if (dias <= 15) return { label: `CRÍTICO — ${dias} días`, cls: "bg-red-50 text-red-700 border-red-200" };
  if (dias <= 30) return { label: `URGENTE — ${dias} días`, cls: "bg-orange-50 text-orange-700 border-orange-200" };
  return { label: `${dias} días para vencer`, cls: "bg-amber-50 text-amber-700 border-amber-100" };
}

export default function RenovacionDetailPage() {
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
  const [showAddInteraccion, setShowAddInteraccion] = useState(false);
  const [showAddCotizacion, setShowAddCotizacion] = useState(false);
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [showConfirmarModal, setShowConfirmarModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [comparativoData, setComparativoData] = useState<any>(null);
  const [propuestaProData, setPropuestaProData] = useState<{ body: string; url: string } | null>(null);
  const [isAutoQuoting, setIsAutoQuoting] = useState(false);
  const [uploadingBulk, setUploadingBulk] = useState(false);
  const [isSearchingPlaca, setIsSearchingPlaca] = useState(false);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  if (isLoading) return (
    <div className="h-full flex items-center justify-center p-20">
      <RefreshCw className="text-blue-500 h-8 w-8 animate-spin" />
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
      <p className="text-slate-500">Renovación no encontrada.</p>
      <button onClick={() => router.push("/renovaciones")} className="mt-4 text-blue-600 font-bold hover:underline">
        ← Volver al pipeline
      </button>
    </div>
  );

  const interacciones = (data?.interacciones || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const cotizaciones = (data?.cotizaciones || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const diasVencer = lead.fecha_fin_poliza
    ? Math.ceil((new Date(lead.fecha_fin_poliza).getTime() - Date.now()) / 86_400_000)
    : lead.dias_para_vencer ?? 0;
  const badge = diasBadge(Math.max(diasVencer, 0));

  const handleSingleAutoQuote = async (insurer: "all" | "allianz" | "qualitas" | "sbs") => {
    if (!lead.vehicleFasecolda || !lead.vehicleYear || !lead.documento) {
      alert("Faltan datos críticos para cotizar (Fasecolda, Modelo o Documento). Por favor completa los datos.");
      return;
    }

    setIsAutoQuoting(true);
    try {
      const endpoint = insurer === "all" ? "all" : insurer;
      const response = await fetch(`${BACKEND}/cotizador/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claveFasecolda: lead.vehicleFasecolda,
          modelo: parseInt(lead.vehicleYear),
          placa: lead.vehiclePlate || lead.placa || "PROVIS",
          tipoDocumento: lead.tipo_documento || "CC",
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
      const transactions: any[] = [];
      
      const allianzData = insurer === "allianz" ? results : results.allianz;
      if (allianzData && !allianzData.error) {
        for (const pkg of (allianzData.paquetes || [])) {
          const aId = crypto.randomUUID();
          transactions.push(
            (db.tx.cotizaciones as any)[aId].update({
              leadId,
              aseguradora: "Allianz",
              valor: pkg.primaTotal,
              prima_total: pkg.primaTotal,
              cobertura: pkg.nombre,
              estado: "enviada",
              fuente: "API Allianz",
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }),
            (db.tx.cotizaciones as any)[aId].link({ lead: leadId })
          );
        }
      }

      const qualitasData = insurer === "qualitas" ? results : results.qualitas;
      if (qualitasData && !qualitasData.error) {
        const qId = crypto.randomUUID();
        const prima = qualitasData.primaTotal || qualitasData.prima_total || 0;
        transactions.push(
          (db.tx.cotizaciones as any)[qId].update({
            leadId,
            aseguradora: "Qualitas",
            valor: prima,
            prima_total: prima,
            cobertura: "Plan Automóvil - Generado Automáticamente",
            estado: "enviada",
            fuente: "API Qualitas",
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }),
          (db.tx.cotizaciones as any)[qId].link({ lead: leadId })
        );
      }

      const sbsData = insurer === "sbs" ? results : results.sbs;
      if (sbsData && !sbsData.error) {
        const sId = crypto.randomUUID();
        const prima = sbsData.primaTotal || 0;
        transactions.push(
          (db.tx.cotizaciones as any)[sId].update({
            leadId,
            aseguradora: "SBS",
            valor: prima,
            prima_total: prima,
            cobertura: "Plan Automóvil - Generado Automáticamente",
            estado: "enviada",
            fuente: "API SBS",
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }),
          (db.tx.cotizaciones as any)[sId].link({ lead: leadId })
        );
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
      
      const res = await fetch(`${BACKEND}/cotizador/parse-pdfs`, {
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
            (db.tx.cotizaciones as any)[newId].update({
              leadId,
              aseguradora: data.aseguradora || "Desconocida",
              valor: prima,
              prima_total: prima,
              prima_neta: parseFloat(String(data.prima_neta || 0)) || 0,
              valor_asegurado: parseFloat(String(data.valor_asegurado || 0)) || 0,
              cobertura: data.cobertura || "",
              estado: "enviada",
              es_renovacion: false,
              fuente: "IA (Múltiples PDFs)",
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }),
            (db.tx.cotizaciones as any)[newId].link({ lead: leadId })
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
    const iId = crypto.randomUUID();
    await db.transact([
      (db.tx.interacciones as any)[iId].update({
        leadId,
        tipo: "nota",
        notas: `Etapa cambiada a: ${newStage}`,
        createdAt: Date.now(),
      }),
      (db.tx.interacciones as any)[iId].link({ lead: leadId }),
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

  const handleSearchPlaca = async (placaBuscada?: string) => {
    const placaAUsar = placaBuscada || (isEditingInfo ? editData?.vehiclePlate || editData?.placa : lead?.vehiclePlate || lead?.placa);
    if (!placaAUsar) {
      alert("Por favor ingresa una placa primero.");
      return;
    }

    setIsSearchingPlaca(true);
    try {
      const response = await fetch(`${BACKEND}/vehiculos/placa/${placaAUsar}`);
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
          es_renovacion: c.es_renovacion === true,
        };
      });

      const response = await fetch(`${BACKEND}/cotizador/comparar`, {
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
  const stageIdx = STAGES_RENOVACION.indexOf(lead.status);
  const progressPct = Math.round(((stageIdx + 1) / STAGES_RENOVACION.length) * 100);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Back button */}
      <button
        onClick={() => router.push("/renovaciones")}
        className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-400 hover:text-amber-600 transition-colors group"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
        <span style={{ fontFamily: "var(--font-outfit)" }}>Pipeline Renovaciones</span>
      </button>

      {/* Hero Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className={`h-1 rounded-t-xl bg-gradient-to-r from-blue-500 to-indigo-600`} />

        <div className="p-5 flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xl font-black text-white flex-shrink-0`}>
              {lead.name?.charAt(0)?.toUpperCase() || "?"}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-black text-slate-900">{lead.name || "Sin nombre"}</h1>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${badge.cls}`}
                >
                  {badge.label}
                </span>
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`flex items-center gap-1 text-xs font-bold text-white px-2.5 py-0.5 rounded-full ${stageColor}`}>
                  <Shield className="h-3.5 w-3.5" />
                  {lead.aseguradora || "Renovación"}
                </span>
                {lead.numero_poliza && (
                  <span className="text-xs text-slate-400 font-medium bg-slate-50 border border-slate-100 px-2.5 py-0.5 rounded-full font-mono">
                    {lead.numero_poliza}
                  </span>
                )}
                {lead.documento && (
                  <span className="text-xs text-slate-500 font-mono">{lead.documento}</span>
                )}
              </div>

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
                <span className="text-[13px] text-emerald-600 font-black">
                  Prima: ${(lead.prima_actual || 0).toLocaleString("es-CO")}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 items-end flex-shrink-0">
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
                    {STAGES_RENOVACION.map(stage => (
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

            {(lead.status === "Confirmada" || lead.status === "Negociando") && (
              <button
                onClick={() => setShowConfirmarModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all"
              >
                <RefreshCw className="h-4 w-4" />
                Confirmar Renovación en Soft
              </button>
            )}

            {lead.soft_cliente_id && (
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

        <div className="px-5 pb-4 space-y-2 border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Progreso de la renovación</span>
            <span className="text-xs font-bold text-slate-500">{progressPct}% completado</span>
          </div>
          <div className="flex gap-1 mt-2">
            {STAGES_RENOVACION.map((stage, idx) => (
              <div
                key={stage}
                className={`flex-1 h-1.5 rounded-full transition-all ${idx <= stageIdx ? stageColor : "bg-slate-100"}`}
                title={stage}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 space-y-3">
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

              <div className="relative">
                {interacciones.length > 0 && <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-100" />}
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

          <div className={activeTab === "emails" ? "block" : "hidden"}>
             <div className="space-y-4">
              <button
                onClick={() => setShowEmailComposer(true)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-white border-2 border-dashed border-slate-200 rounded-2xl text-sm font-bold text-slate-400 hover:border-purple-400 hover:text-purple-500 hover:bg-purple-50/30 transition-all"
              >
                <Plus className="h-4 w-4" />
                Redactar nuevo correo
              </button>
              <div className="space-y-4">
                {interacciones.filter(i => i.tipo === "email").map((email) => (
                  <div key={email.id} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">Email</span>
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

          <div className={activeTab === "documentos" ? "block" : "hidden"}>
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
               <DocumentosLegales lead={lead} leadId={leadId} />
            </div>
          </div>

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
                </div>
              </div>

              {showAddCotizacion && (
                <AddCotizacionForm leadId={leadId} onClose={() => setShowAddCotizacion(false)} lead={lead} />
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
                  esNuevo={false}
                  onGenerarCorreo={async () => {
                     try {
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
                          cliente: { nombre: lead.name, cedula: lead.documento || "" },
                          vehiculo: {
                            marca: lead.vehicleBrand || "",
                            linea: lead.vehicleModel || "",
                            año: lead.vehicleYear || "",
                            placa: lead.vehiclePlate || lead.placa || "",
                            ciudad: lead.city || "",
                            valor_asegurado: cotizaciones[0]?.valor_asegurado || 0,
                          },
                          asesor: { nombre: "Adriana Garzón", email: "autos@roesan.com.co", telefono: "573197282277" },
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

                      const response = await fetch(`${BACKEND}/cotizador/email`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          cotizacionSeleccionada: cotizaciones.find(c => (c.aseguradora || "").toUpperCase() === aseguradoraRecomendada.toUpperCase()),
                          todasCotizaciones: cotizaciones,
                          aseguradoraRecomendada: aseguradoraRecomendada,
                          justificacionIA: comparativoData.comparativo_ia?.justificacion_corta,
                          datosExtra: { tomador: lead.name, placa: lead.vehiclePlate || lead.placa, descripcion_vehiculo: `${lead.vehicleBrand || ""} ${lead.vehicleModel || ""} ${lead.vehicleYear || ""}`.trim() },
                          accionIA: comparativoData.accion,
                          aseguradoraRenovacion: comparativoData.aseguradora_renovacion,
                          diferenciaPrima: comparativoData.diferencia_prima,
                          esNuevo: false,
                          propuestaUrl: `${window.location.origin}/propuesta/${propuestaId}`
                        }),
                      });
                      const result = await response.json();
                      if (result.body) {
                        setPropuestaProData({ body: result.body, url: `${window.location.origin}/propuesta/${propuestaId}` });
                      }
                    } catch(err) {
                      console.error(err);
                      alert("Error generando propuesta");
                    }
                  }}
                />
              )}

              <div className="grid grid-cols-1 gap-4">
                {cotizaciones.map(cot => {
                  const estadoConfig: Record<string, { color: string; label: string }> = {
                    "borrador":  { color: "bg-slate-100 text-slate-500",    label: "Borrador" },
                    "enviada":   { color: "bg-blue-100 text-blue-600",      label: "Enviada al cliente" },
                    "aceptada":  { color: "bg-emerald-100 text-emerald-600",label: "Aceptada ✓" },
                    "rechazada": { color: "bg-rose-100 text-rose-600",      label: "Rechazada" },
                  };
                  const eConf = estadoConfig[cot.estado] || estadoConfig["borrador"];
                  return (
                  <div key={cot.id} className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2.5">
                      <div>
                        <h4 className="font-bold text-slate-800">{cot.aseguradora}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">{cot.cobertura || "Sin descripción"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${eConf.color}`}>{eConf.label}</span>
                        <button
                          onClick={async () => {
                            if (!confirm("¿Eliminar esta cotización?")) return;
                            await db.transact([db.tx.cotizaciones[cot.id].delete()]);
                          }}
                          className="h-6 w-6 flex items-center justify-center rounded-md text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all"
                          title="Eliminar cotización"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
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

          <div className={activeTab === "datos" ? "block" : "hidden"}>
             <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-700">Datos del registro</h3>
                {!isEditingInfo ? (
                  <button
                    onClick={() => { setEditData({ ...lead }); setIsEditingInfo(true); }}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all border border-slate-100"
                  >
                    <Edit3 className="h-3.5 w-3.5" /> Editar
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => { setIsEditingInfo(false); setEditData(null); }} className="text-xs font-bold text-slate-400 px-3 py-1.5">Cancelar</button>
                    <button onClick={handleSaveInfo} className="bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg">Guardar</button>
                  </div>
                )}
              </div>
              <div className="p-5 grid grid-cols-2 gap-4">
                {[
                  { label: "Nombre", field: "name", value: lead.name },
                  { label: "Documento", field: "documento", value: lead.documento },
                  { label: "Celular", field: "phone", value: lead.phone },
                  { label: "Email", field: "email", value: lead.email },
                  { label: "Fecha Nacimiento", field: "fecha_nacimiento", value: lead.fecha_nacimiento, type: "date" },
                  { label: "Placa", field: "placa", value: lead.placa || lead.vehiclePlate },
                  { label: "Modelo", field: "vehicleYear", value: lead.vehicleYear },
                  { label: "Fasecolda", field: "vehicleFasecolda", value: lead.vehicleFasecolda },
                  { label: "Póliza Actual", field: "numero_poliza", value: lead.numero_poliza },
                  { label: "Aseguradora Actual", field: "aseguradora", value: lead.aseguradora },
                ].map(({ label, field, value, type }) => (
                  <div key={field} className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">{label}</label>
                    {isEditingInfo ? (
                      <input
                        type={type || "text"}
                        value={editData?.[field] || ""}
                        onChange={e => setEditData({ ...editData, [field]: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                      />
                    ) : (
                      <p className="text-sm font-semibold text-slate-700">{value || "—"}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Acciones rápidas</h3>
            <div className="space-y-2">
              {lead.phone && (
                <a href={`https://wa.me/${lead.phone.replace(/\\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-green-50 hover:bg-green-100 text-green-700 font-bold text-sm transition-all">
                  <MessageSquare className="h-4 w-4" /> WhatsApp
                </a>
              )}
              {lead.phone && (
                <a href={`tel:${lead.phone}`} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-sm transition-all">
                  <Phone className="h-4 w-4" /> Llamar
                </a>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Notas</h3>
              <button onClick={() => { setNotesValue(lead.notes || ""); setIsEditingNotes(!isEditingNotes); }} className="text-[10px] font-bold text-blue-600">
                {isEditingNotes ? "Cancelar" : "Editar"}
              </button>
            </div>
            {isEditingNotes ? (
              <div className="space-y-2">
                <textarea value={notesValue} onChange={e => setNotesValue(e.target.value)} rows={4} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm resize-none" />
                <button onClick={async () => { await db.transact([db.tx.leads[leadId].update({ notes: notesValue, updatedAt: Date.now() })]); setIsEditingNotes(false); }} className="w-full py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg">Guardar</button>
              </div>
            ) : (
              <p className="text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap">{lead.notes || "Sin notas."}</p>
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

      {showEmailComposer && lead.email && (
        <EmailComposerWrapper leadId={leadId} toEmail={lead.email} onClose={() => setShowEmailComposer(false)} />
      )}

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

function EmailComposerWrapper({ leadId, toEmail, onClose }: { leadId: string; toEmail: string; onClose: () => void }) {
  const { user } = db.useAuth();
  if (!user) return null;
  return <EmailComposer leadId={leadId} toEmail={toEmail} userId={user.id} onClose={onClose} />;
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
          <button onClick={onClose} className="text-white hover:bg-white/20 p-1 rounded-full"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-slate-50 rounded-xl p-4 text-sm space-y-1">
            <p className="font-bold text-slate-700">{lead.name}</p>
            <p className="text-slate-400 font-mono">{lead.numero_poliza}</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase">Nueva prima (COP)</label>
            <input type="number" value={nuevaPrima} onChange={e => setNuevaPrima(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase">Nueva fecha vencimiento *</label>
            <input type="date" value={nuevaFechaFin} onChange={e => setNuevaFechaFin(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm" />
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="pt-2 flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 text-sm font-bold text-slate-400">Cancelar</button>
            <button onClick={handleConfirmar} disabled={loading} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-sm">
              {loading ? "Confirmando…" : "Confirmar Renovación"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useRef } from "react";
import { 
  FileText, 
  Upload, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  Building2, 
  ShieldCheck, 
  ArrowRight,
  Database,
  CloudUpload
} from "lucide-react";
import { db } from "@/lib/instant-db";

interface DocumentosLegalesProps {
  lead: any;
  leadId: string;
}

type DocType = "CEDULA" | "RUT" | "SARLAFT" | "POLIZA";

const DOC_TYPES: { id: DocType; label: string; icon: any; color: string }[] = [
  { id: "CEDULA", label: "Cédula", icon: User, color: "text-blue-600 bg-blue-50" },
  { id: "RUT", label: "RUT", icon: Building2, color: "text-indigo-600 bg-indigo-50" },
  { id: "SARLAFT", label: "Sarlaft", icon: ShieldCheck, color: "text-purple-600 bg-purple-50" },
  { id: "POLIZA", label: "Póliza Anterior", icon: FileText, color: "text-emerald-600 bg-emerald-50" },
];

export function DocumentosLegales({ lead, leadId }: DocumentosLegalesProps) {
  const [selectedType, setSelectedType] = useState<DocType>("CEDULA");
  const [isParsing, setIsParsing] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "success" | "error">("idle");
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCurrentFile(file);
    handleParse(file);
  };

  const handleParse = async (file: File) => {
    setIsParsing(true);
    setExtractedData(null);
    setSyncStatus("idle");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tipo", selectedType);

      const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3002"}/api`;
      const response = await fetch(`${backendUrl}/documentos/parse`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Error al analizar el documento");
      
      const data = await response.json();
      setExtractedData(data);
    } catch (err) {
      console.error(err);
      alert("No se pudo extraer información del documento.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleApplyToLead = async () => {
    if (!extractedData) return;

    // Map extracted data to Lead fields
    const updates: any = {};
    if (selectedType === "CEDULA") {
      updates.name = `${extractedData.nombres} ${extractedData.apellidos}`;
      updates.documento = extractedData.numero_documento;
      // Capturar fecha de nacimiento para cumpleaños y género
      if (extractedData.fecha_nacimiento) updates.fecha_nacimiento = extractedData.fecha_nacimiento;
      if (extractedData.genero) updates.genero = extractedData.genero;
    } else if (selectedType === "RUT") {
      updates.documento = extractedData.nit;
      updates.city = extractedData.ciudad;
      if (extractedData.razon_social) updates.name = extractedData.razon_social;
    } else if (selectedType === "POLIZA") {
      if (extractedData.placa) updates.vehiclePlate = extractedData.placa;
      if (extractedData.modelo) updates.vehicleYear = String(extractedData.modelo);
      if (extractedData.fasecolda) updates.vehicleFasecolda = extractedData.fasecolda;
      
      // Also create a "current policy" cotizacion for the comparison engine
      const cotId = crypto.randomUUID();
      const prima = parseFloat(extractedData.prima_total) || 0;
      
      await db.transact([
        db.tx.cotizaciones[cotId].update({
          leadId,
          aseguradora: extractedData.aseguradora || "Desconocida",
          valor: prima,
          prima_total: prima,
          prima_neta: parseFloat(extractedData.prima_neta) || 0,
          valor_asegurado: parseFloat(extractedData.valor_asegurado) || 0,
          cobertura: "Póliza Actual (IA)",
          es_renovacion: true,
          fuente: "IA (Documento)",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          coberturas: {
            rce_limite: extractedData.rce_limite ?? null,
            terremoto: extractedData.terremoto ?? false,
            proteccion_patrimonial: extractedData.proteccion_patrimonial ?? false,
            asistencia_en_viaje: extractedData.asistencia_en_viaje ?? false,
          }
        }),
        db.tx.cotizaciones[cotId].link({ lead: leadId }),
      ]);
    }

    await db.transact([
      db.tx.leads[leadId].update({ ...updates, updatedAt: Date.now() }),
    ]);

    // AUTO-SYNC: Si el cliente ya existe en Soft Seguros, sincronizar documento automáticamente
    if (lead.soft_cliente_id) {
      console.log("Auto-syncing document to Soft Seguros...");
      handleSyncToSoft();
    } else {
      alert(selectedType === "POLIZA" ? "Datos del vehículo actualizados y póliza actual registrada." : "Datos aplicados al prospecto localmente.");
    }
  };

  const handleSyncToSoft = async () => {
    if (!extractedData || !currentFile) return;
    setIsSyncing(true);
    setSyncStatus("loading");

    try {
      const formData = new FormData();
      formData.append("file", currentFile);
      formData.append("leadId", leadId);
      formData.append("tipo", selectedType);
      formData.append("extractedData", JSON.stringify(extractedData));
      if (lead.soft_cliente_id) formData.append("softClientId", lead.soft_cliente_id);
      if (lead.soft_poliza_id) formData.append("softPolicyId", lead.soft_poliza_id);

      const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3002"}/api`;
      const response = await fetch(`${backendUrl}/documentos/sync`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (result.success) {
        setSyncStatus("success");
      } else {
        setSyncStatus("error");
        alert(`Error: ${result.error}`);
      }
    } catch (err) {
      console.error(err);
      setSyncStatus("error");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Type Selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {DOC_TYPES.map((type) => (
          <button
            key={type.id}
            onClick={() => {
              setSelectedType(type.id);
              setExtractedData(null);
              setSyncStatus("idle");
              setCurrentFile(null);
            }}
            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
              selectedType === type.id
                ? "border-amber-500 bg-amber-50/50 shadow-sm"
                : "border-slate-100 bg-white hover:border-slate-200"
            }`}
          >
            <div className={`p-2 rounded-xl ${type.color}`}>
              <type.icon className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-slate-700">{type.label}</span>
          </button>
        ))}
      </div>

      {/* Upload Area */}
      <div 
        onClick={() => fileInputRef.current?.click()}
        className="group relative cursor-pointer"
      >
        <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative flex flex-col items-center justify-center p-10 bg-white border-2 border-dashed border-slate-200 rounded-3xl hover:border-amber-400 transition-all">
          <input 
            type="file" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileChange}
            accept="application/pdf,image/*"
          />
          
          {isParsing ? (
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="h-10 w-10 text-amber-500 animate-spin" />
              <p className="text-sm font-bold text-slate-600 animate-pulse">
                Analizando {selectedType.toLowerCase()} con IA...
              </p>
            </div>
          ) : currentFile ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="h-12 w-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">{currentFile.name}</p>
                <p className="text-xs text-slate-400">Archivo listo para procesar</p>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); setCurrentFile(null); setExtractedData(null); }}
                className="text-xs font-bold text-rose-500 hover:underline"
              >
                Cambiar archivo
              </button>
            </div>
          ) : (
            <>
              <div className="h-16 w-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <CloudUpload className="h-8 w-8" />
              </div>
              <p className="text-sm font-bold text-slate-600">Haz clic para subir documento</p>
              <p className="text-xs text-slate-400 mt-1">PDF o Imagen (Máx 10MB)</p>
            </>
          )}
        </div>
      </div>

      {/* Results & Actions */}
      {extractedData && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-6 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Database className="h-3.5 w-3.5" />
                Datos Extraídos por IA
              </span>
              <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                <ShieldCheck className="h-3 w-3" />
                Gemini Flash
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mb-8">
                {Object.entries(extractedData).map(([key, value]) => (
                  <div key={key} className="flex flex-col gap-1 border-b border-slate-50 pb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                      {key.replace(/_/g, " ")}
                    </span>
                    <span className="text-sm font-semibold text-slate-700">
                      {typeof value === 'boolean' ? (value ? "Sí" : "No") : String(value || "—")}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleApplyToLead}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-slate-100 text-slate-700 rounded-2xl text-sm font-bold hover:bg-slate-200 transition-all"
                >
                  <ArrowRight className="h-4 w-4" />
                  Actualizar Prospecto
                </button>
                
                <button
                  onClick={handleSyncToSoft}
                  disabled={isSyncing || syncStatus === "success"}
                  className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold text-white shadow-lg transition-all disabled:opacity-50 ${
                    syncStatus === "success" 
                      ? "bg-green-600" 
                      : "bg-gradient-to-r from-blue-600 to-indigo-700 hover:shadow-indigo-200"
                  }`}
                >
                  {isSyncing ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Sincronizando con Soft...
                    </>
                  ) : syncStatus === "success" ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Sincronizado con éxito
                    </>
                  ) : (
                    <>
                      <CloudUpload className="h-4 w-4" />
                      Sincronizar a Soft Seguros
                    </>
                  )}
                </button>
              </div>

              {syncStatus === "error" && (
                <p className="mt-3 text-center text-xs font-bold text-rose-500 flex items-center justify-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Hubo un problema al sincronizar. Reintenta o revisa los logs.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

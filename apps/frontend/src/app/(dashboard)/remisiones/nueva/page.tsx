"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Upload, CheckCircle, AlertCircle, ArrowRight, ArrowLeft,
  FileText, User, Shield, Building2, Loader2, X, ExternalLink, Plus, RefreshCw
} from "lucide-react";

const BACKEND = `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3002"}/api`;

type DocTipo = "CEDULA" | "RUT" | "SARLAFT" | "POLIZA";

const DOC_CONFIG: Record<DocTipo, { label: string; desc: string; icon: React.ComponentType<{ className?: string }> }> = {
  CEDULA:  { label: "Cédula / Permiso", desc: "Documento de identidad del cliente", icon: User },
  RUT:     { label: "RUT",              desc: "Registro Único Tributario",            icon: Building2 },
  SARLAFT: { label: "SARLAFT",          desc: "Formulario antilavado",               icon: Shield },
  POLIZA:  { label: "Carátula de Póliza", desc: "Documento de la póliza actual",     icon: FileText },
};

const RAMO_OPTIONS = [
  { value: "auto",         label: "Autos" },
  { value: "salud",        label: "Salud" },
  { value: "hogar",        label: "Hogar" },
  { value: "vida",         label: "Vida" },
  { value: "empresarial",  label: "Empresarial" },
  { value: "cumplimiento", label: "Cumplimiento" },
  { value: "soat",         label: "SOAT" },
];

const TIPO_DOC_OPTIONS = [
  { value: "01", label: "Cédula de Ciudadanía" },
  { value: "02", label: "NIT" },
  { value: "03", label: "Pasaporte" },
  { value: "04", label: "Cédula Extranjería" },
];

interface SoftCliente {
  id: number;
  nombres?: string;
  apellidos?: string;
  email?: string;
  celular?: string;
  ciudad?: string;
}

interface ExtractedData {
  CEDULA?: Record<string, any>;
  RUT?: Record<string, any>;
  SARLAFT?: Record<string, any>;
  POLIZA?: Record<string, any>;
}

const inputCls = "w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400/30 text-sm";
const inputSmCls = "w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400/30 text-sm";
const labelCls = "block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5";
const labelSmCls = "block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1";

interface VendedorItem { id: number; nombre: string; puede_crear_polizas?: boolean; }

export default function RemisionarPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Catalogs
  const [vendedores, setVendedores] = useState<VendedorItem[]>([]);
  useEffect(() => {
    fetch(`${BACKEND}/remisiones/catalogs`)
      .then(r => r.json())
      .then(d => { if (d.vendedores) setVendedores(d.vendedores); })
      .catch(() => {});
  }, []);

  // Step 1
  const [formCliente, setFormCliente] = useState({
    tipo_documento: "01",
    numero_documento: "",
    nombres: "",
    apellidos: "",
    email: "",
    telefono: "",
  });
  const [busquedaResult, setBusquedaResult] = useState<{
    searched: boolean;
    found: boolean;
    cliente: SoftCliente | null;
    polizas: any[];
    message: string;
  }>({ searched: false, found: false, cliente: null, polizas: [], message: "" });

  const [selectedPolizaId, setSelectedPolizaId] = useState<string | null>(null);

  // Step 2
  const [uploadedFiles, setUploadedFiles] = useState<Record<DocTipo, File | null>>({
    CEDULA: null, RUT: null, SARLAFT: null, POLIZA: null,
  });
  const [extracted, setExtracted] = useState<ExtractedData>({});
  const fileRefs = {
    CEDULA:  useRef<HTMLInputElement>(null),
    RUT:     useRef<HTMLInputElement>(null),
    SARLAFT: useRef<HTMLInputElement>(null),
    POLIZA:  useRef<HTMLInputElement>(null),
  };

  // Step 3
  const [clientData, setClientData] = useState<Record<string, any>>({});
  const [policyData, setPolicyData] = useState<Record<string, any>>({});

  // Result
  const [result, setResult] = useState<{
    leadId: string;
    soft_cliente_id: string;
    soft_poliza_id: string;
  } | null>(null);

  // ── Step 1 ────────────────────────────────────────────────────────────────

  async function handleBuscar() {
    if (!formCliente.numero_documento.trim()) {
      setError("Ingresa el número de documento");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BACKEND}/remisiones/buscar-cliente`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documento: formCliente.numero_documento.trim() }),
      });
      const data = await res.json();
      setBusquedaResult({ 
        searched: true, 
        found: data.found, 
        cliente: data.cliente, 
        polizas: data.polizas || [], 
        message: data.message 
      });
      if (data.found && data.cliente) {
        // Cliente existe — pre-llenar con info de Soft Seguros pero la nueva info sobreescribirá
        setFormCliente(prev => ({
          ...prev,
          nombres:   data.cliente.nombres  || prev.nombres,
          apellidos: data.cliente.apellidos || prev.apellidos,
          email:     data.cliente.email    || prev.email,
          telefono:  data.cliente.celular  || prev.telefono,
        }));
        // No bloqueamos: continuamos al paso 2 directamente
        setStep(2);
      } else {
        // Cliente no existe — ir directamente a subir documentos
        setStep(2);
      }
    } catch {
      setError("Error conectando con el servidor");
    } finally {
      setLoading(false);
    }
  }

  function handleStep1Next() {
    if (!busquedaResult.searched) { setError("Busca primero el cliente en Soft Seguros"); return; }
    if (!formCliente.numero_documento || !formCliente.nombres) { setError("Número de documento y nombre son requeridos"); return; }
    setError("");
    setStep(2);
  }

  // ── Step 2 ────────────────────────────────────────────────────────────────

  function handleFileSelect(tipo: DocTipo, file: File | null) {
    setError("");
    setUploadedFiles(prev => ({ ...prev, [tipo]: file }));
  }

  async function handleParsear() {
    const archivos = (Object.entries(uploadedFiles) as [DocTipo, File | null][]).filter(([, f]) => f !== null) as [DocTipo, File][];
    if (archivos.length === 0) { setError("Sube al menos un documento"); return; }
    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      const tipos: string[] = [];
      archivos.forEach(([tipo, file]) => {
        formData.append("files", file, file.name);
        tipos.push(tipo);
      });
      formData.append("tipos", JSON.stringify(tipos));

      const res = await fetch(`${BACKEND}/remisiones/parsear`, { method: "POST", body: formData });
      const data: ExtractedData = await res.json();
      setExtracted(data);

      // Pre-populate step 3
      const cd: Record<string, any> = {
        numero_documento: formCliente.numero_documento,
        tipo_documento:   formCliente.tipo_documento,
        email:            formCliente.email,
        telefono:         formCliente.telefono,
        nombres:          formCliente.nombres,
        apellidos:        formCliente.apellidos,
      };
      if (data.CEDULA) {
        if (data.CEDULA.nombres)          cd.nombres          = data.CEDULA.nombres;
        if (data.CEDULA.apellidos)        cd.apellidos        = data.CEDULA.apellidos;
        if (data.CEDULA.fecha_nacimiento) cd.fecha_nacimiento = data.CEDULA.fecha_nacimiento;
        if (data.CEDULA.fecha_expedicion) cd.fecha_expedicion = data.CEDULA.fecha_expedicion;
        if (data.CEDULA.genero)           cd.genero           = data.CEDULA.genero;
      } else if (data.POLIZA) {
        // Sin cédula: tomar datos del tomador desde la carátula de póliza
        if (data.POLIZA.tomador_nombres)   cd.nombres   = data.POLIZA.tomador_nombres;
        if (data.POLIZA.tomador_apellidos) cd.apellidos = data.POLIZA.tomador_apellidos;
        if (data.POLIZA.tomador_documento && !formCliente.numero_documento)
          cd.numero_documento = data.POLIZA.tomador_documento;
      }
      // Teléfono/correo: póliza como fallback si el usuario no los ingresó
      if (!cd.telefono && data.POLIZA?.tomador_telefono) cd.telefono = data.POLIZA.tomador_telefono;
      if (!cd.email    && data.POLIZA?.tomador_correo)   cd.email    = data.POLIZA.tomador_correo;
      if (data.RUT) {
        if (data.RUT.direccion)    cd.direccion = data.RUT.direccion;
        if (data.RUT.ciudad)       cd.ciudad    = data.RUT.ciudad;
        if (data.RUT.departamento) cd.provincia = data.RUT.departamento;
        // Para persona jurídica (NIT), la fecha_constitucion del RUT se usa como fecha_nacimiento en Soft Seguros
        if (data.RUT.fecha_constitucion && formCliente.tipo_documento === '02') {
          cd.fecha_nacimiento = data.RUT.fecha_constitucion;
        }
      } else if (data.POLIZA) {
        // Sin RUT: tomar dirección/ciudad/departamento del tomador desde la carátula
        if (data.POLIZA.tomador_direccion)   cd.direccion = data.POLIZA.tomador_direccion;
        if (data.POLIZA.tomador_ciudad)      cd.ciudad    = data.POLIZA.tomador_ciudad;
        if (data.POLIZA.tomador_departamento) cd.provincia = data.POLIZA.tomador_departamento;
      }
      if (data.SARLAFT?.ocupacion) cd.ocupacion_descripcion = data.SARLAFT.ocupacion;
      setClientData(cd);

      const pd: Record<string, any> = {};
      if (data.POLIZA) {
        pd.numero_poliza    = data.POLIZA.numero_poliza    || "";
        pd.aseguradora      = data.POLIZA.aseguradora      || "";
        pd.ramo             = data.POLIZA.ramo             || "auto";
        pd.fecha_inicio     = data.POLIZA.fecha_inicio     || "";
        pd.fecha_fin        = data.POLIZA.fecha_fin        || "";
        pd.prima_neta       = data.POLIZA.prima_neta       || 0;
        pd.prima_total      = data.POLIZA.prima_total      || 0;
        pd.iva              = data.POLIZA.iva              || 0;
        pd.gastos_expedicion = data.POLIZA.gastos_expedicion || 0;
        pd.objeto_asegurado = data.POLIZA.objeto_asegurado || "";
        pd.moneda           = data.POLIZA.moneda           || "COP";
        pd.beneficiarios    = data.POLIZA.beneficiarios    || [];
      } else {
        pd.moneda = "COP";
        pd.beneficiarios = [];
      }
      pd.vendedor_id = pd.vendedor_id || "27931";
      setPolicyData(pd);
    } catch {
      setError("Error al procesar los documentos");
    } finally {
      setLoading(false);
    }
  }

  function handleStep2Next() {
    setError("");
    // Pre-populate clientData from formCliente if doc extraction didn't run
    if (Object.keys(clientData).length === 0) {
      setClientData({
        numero_documento: formCliente.numero_documento,
        tipo_documento:   formCliente.tipo_documento,
        nombres:          formCliente.nombres,
        apellidos:        formCliente.apellidos,
        email:            formCliente.email,
        telefono:         formCliente.telefono,
      });
    }
    // Pre-populate policyData defaults if extraction didn't run
    if (Object.keys(policyData).length === 0) {
      setPolicyData({
        ramo: "auto",
        moneda: "COP",
        vendedor_id: "27931",
        beneficiarios: [],
      });
    } else if (!policyData.vendedor_id) {
      setPolicyData(p => ({ ...p, vendedor_id: "27931" }));
    }
    setStep(3);
  }

  // ── Step 3 ────────────────────────────────────────────────────────────────

  async function handleRemisionar() {
    if (!policyData.numero_poliza) { setError("Número de póliza es requerido"); return; }
    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      const archivos = (Object.entries(uploadedFiles) as [DocTipo, File | null][]).filter(([, f]) => f !== null) as [DocTipo, File][];
      const tipos: string[] = [];
      archivos.forEach(([tipo, file]) => {
        formData.append("files", file, file.name);
        tipos.push(tipo);
      });
      if (archivos.length > 0) formData.append("tipos", JSON.stringify(tipos));
      if (busquedaResult.found && busquedaResult.cliente) {
        formData.append("soft_cliente_id", String(busquedaResult.cliente.id));
      }
      formData.append("clientData", JSON.stringify(clientData));
      formData.append("policyData", JSON.stringify({
        ...policyData,
        poliza_padre_id: selectedPolizaId || undefined,
        forma_pago: policyData.forma_pago || "contado",
        cuotas: policyData.num_cuotas || 1
      }));

      const res = await fetch(`${BACKEND}/remisiones/remisionar`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error en remisionar");
      setResult({ leadId: data.leadId, soft_cliente_id: data.soft_cliente_id, soft_poliza_id: data.soft_poliza_id });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al remisionar");
    } finally {
      setLoading(false);
    }
  }

  function handleNuevaRemision() {
    setStep(1);
    setResult(null);
    setBusquedaResult({ searched: false, found: false, cliente: null, polizas: [], message: "" });
    setUploadedFiles({ CEDULA: null, RUT: null, SARLAFT: null, POLIZA: null });
    setExtracted({});
    setClientData({});
    setPolicyData({});
    setFormCliente({ tipo_documento: "01", numero_documento: "", nombres: "", apellidos: "", email: "", telefono: "" });
    setError("");
  }

  // ── Success Screen ────────────────────────────────────────────────────────

  if (result) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
          <div className="h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="h-8 w-8 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2" style={{ fontFamily: "var(--font-outfit)" }}>
            ¡Remisión exitosa!
          </h2>
          <p className="text-slate-500 mb-8">El cliente y la póliza fueron registrados en Soft Seguros.</p>
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-400 font-mono uppercase mb-1">ID Cliente Soft</p>
              <p className="text-lg font-bold text-slate-700 font-mono">{result.soft_cliente_id}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-400 font-mono uppercase mb-1">ID Póliza Soft</p>
              <p className="text-lg font-bold text-slate-700 font-mono">{result.soft_poliza_id}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4">
              <p className="text-xs text-emerald-600 font-mono uppercase mb-1">CRM Lead</p>
              <p className="text-lg font-bold text-emerald-700 font-mono truncate">{result.leadId.slice(0, 8)}…</p>
            </div>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push(`/leads/${result.leadId}`)}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Ver en CRM
            </button>
            <button
              onClick={handleNuevaRemision}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nueva remisión
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Wizard ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center mb-8">
        {[{ n: 1, label: "Cliente" }, { n: 2, label: "Documentos" }, { n: 3, label: "Confirmar" }].map(({ n, label }, i) => (
          <div key={n} className="flex items-center flex-1">
            <div className="flex items-center gap-2 flex-1">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-all ${step >= n ? "bg-amber-400 text-white" : "bg-slate-100 text-slate-400"}`}>
                {step > n ? <CheckCircle className="h-4 w-4" /> : n}
              </div>
              <span className={`text-sm font-medium ${step >= n ? "text-slate-700" : "text-slate-400"}`}>{label}</span>
            </div>
            {i < 2 && <div className={`h-px flex-1 mx-3 ${step > n ? "bg-amber-400" : "bg-slate-200"}`} />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* ── STEP 1 ───────────────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="p-8">
            <h2 className="text-xl font-bold text-slate-800 mb-1" style={{ fontFamily: "var(--font-outfit)" }}>Datos del Cliente</h2>
            <p className="text-sm text-slate-400 mb-6">Ingresa el documento y busca si ya existe en Soft Seguros.</p>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelCls}>Tipo de Documento</label>
                <select
                  value={formCliente.tipo_documento}
                  onChange={e => setFormCliente(p => ({ ...p, tipo_documento: e.target.value }))}
                  className={inputCls}
                >
                  {TIPO_DOC_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Número de Documento *</label>
                <div className="flex gap-2">
                  <input
                    value={formCliente.numero_documento}
                    onChange={e => setFormCliente(p => ({ ...p, numero_documento: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && handleBuscar()}
                    placeholder="1234567890"
                    className="flex-1 px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400/30 text-sm"
                  />
                  <button
                    onClick={handleBuscar}
                    disabled={loading}
                    className="px-4 py-2.5 bg-amber-400 hover:bg-amber-500 text-white rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5 text-sm font-medium"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Buscar
                  </button>
                </div>
              </div>
            </div>

            {busquedaResult.searched && (
              <div className="space-y-4 mb-6">
                <div className={`rounded-xl p-4 flex items-start gap-3 ${busquedaResult.found ? "bg-emerald-50 border border-emerald-100" : "bg-blue-50 border border-blue-100"}`}>
                  {busquedaResult.found
                    ? <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                    : <AlertCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />}
                  <p className={`text-sm font-medium ${busquedaResult.found ? "text-emerald-700" : "text-blue-700"}`}>
                    {busquedaResult.message}
                  </p>
                </div>

                {busquedaResult.polizas && busquedaResult.polizas.length > 0 && (
                  <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                    <div className="bg-slate-100 px-4 py-2 border-b border-slate-200">
                      <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Seleccionar póliza para renovar (opcional)</p>
                    </div>
                    <div className="divide-y divide-slate-200 max-h-48 overflow-y-auto">
                      {busquedaResult.polizas.map((pol: any) => (
                        <div 
                          key={pol.id} 
                          onClick={() => setSelectedPolizaId(selectedPolizaId === String(pol.id) ? null : String(pol.id))}
                          className={`p-3 flex items-center justify-between hover:bg-amber-50 cursor-pointer transition-colors ${selectedPolizaId === String(pol.id) ? "bg-amber-50" : ""}`}
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-700">#{pol.numero_poliza} - {pol.aseguradora_nombre}</p>
                            <p className="text-[10px] text-slate-500">{pol.ramo_nombre} | Vence: {pol.fecha_fin}</p>
                          </div>
                          <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${selectedPolizaId === String(pol.id) ? "border-amber-500 bg-amber-500" : "border-slate-300"}`}>
                            {selectedPolizaId === String(pol.id) && <CheckCircle className="h-3 w-3 text-white" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-4">
              {[
                { key: "nombres",   label: "Nombres *",   placeholder: "Juan Carlos" },
                { key: "apellidos", label: "Apellidos",   placeholder: "Pérez López" },
                { key: "email",     label: "Correo",      placeholder: "cliente@email.com", type: "email" },
                { key: "telefono",  label: "Teléfono",    placeholder: "+573001234567" },
              ].map(({ key, label, placeholder, type }) => (
                <div key={key}>
                  <label className={labelCls}>{label}</label>
                  <input
                    type={type || "text"}
                    value={(formCliente as Record<string, string>)[key]}
                    onChange={e => setFormCliente(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className={inputCls}
                  />
                </div>
              ))}
            </div>

            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            <div className="flex justify-end">
              <button onClick={handleStep1Next} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
                Continuar <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2 ───────────────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="p-8">
            <h2 className="text-xl font-bold text-slate-800 mb-1" style={{ fontFamily: "var(--font-outfit)" }}>Subir Documentos</h2>
            <p className="text-sm text-slate-400 mb-4">Adjunta los documentos. La IA extraerá los datos automáticamente.</p>

            {/* Banner contextual: cliente existente vs nuevo */}
            {busquedaResult.found ? (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5">
                <span className="text-lg shrink-0">🔄</span>
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    Cliente existente — sus datos se actualizarán
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    <strong>Sube la cédula</strong> para actualizar nombre, género y <strong>fecha de nacimiento</strong> (cumpleaños).
                    La nueva información siempre reemplaza la existente en Soft Seguros.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5">
                <span className="text-lg shrink-0">🆕</span>
                <p className="text-sm text-blue-700">
                  <strong>Cliente nuevo</strong> — se creará en Soft Seguros con los datos extraídos.
                  Sube la cédula para capturar nombre, fecha de nacimiento y género automáticamente.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-6">
              {(Object.keys(DOC_CONFIG) as DocTipo[]).map(tipo => {
                const cfg = DOC_CONFIG[tipo];
                const IconComp = cfg.icon;
                const file = uploadedFiles[tipo];
                const extractedForType = (extracted as Record<string, any>)[tipo];
                return (
                  <div
                    key={tipo}
                    className={`rounded-xl border-2 border-dashed p-4 transition-all cursor-pointer ${file ? "border-emerald-300 bg-emerald-50" : "border-slate-200 hover:border-amber-300 hover:bg-amber-50/30"}`}
                    onClick={() => fileRefs[tipo].current?.click()}
                  >
                    <input
                      ref={fileRefs[tipo]}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={e => handleFileSelect(tipo, e.target.files?.[0] || null)}
                    />
                    <div className="flex items-start gap-3">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${file ? "bg-emerald-100" : "bg-slate-100"}`}>
                        {file ? <CheckCircle className="h-5 w-5 text-emerald-500" /> : <IconComp className="h-5 w-5 text-slate-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700">{cfg.label}</p>
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{file ? file.name : cfg.desc}</p>
                        {extractedForType && !extractedForType.error && (
                          <p className="text-xs text-emerald-600 mt-1 font-medium">✓ Datos extraídos</p>
                        )}
                        {extractedForType?.error && (
                          <p className="text-xs text-red-500 mt-1 break-words" title={extractedForType.error}>
                            ✗ {String(extractedForType.error).slice(0, 80)}
                          </p>
                        )}
                      </div>
                      {file && (
                        <button
                          onClick={e => { e.stopPropagation(); handleFileSelect(tipo, null); }}
                          className="text-slate-400 hover:text-red-400 shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {Object.values(extracted).some((v: any) => v?.error) && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-sm text-amber-700">
                Algunos documentos no pudieron procesarse. Puedes <strong>continuar</strong> e ingresar los datos manualmente en el paso 3.
              </div>
            )}

            <div className="flex justify-center mb-6">
              <button
                onClick={handleParsear}
                disabled={loading || Object.values(uploadedFiles).every(f => !f)}
                className="flex items-center gap-2 px-6 py-2.5 bg-amber-400 hover:bg-amber-500 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Procesar documentos con IA
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4 text-sm text-blue-700">
              Los documentos son opcionales. Si no los tienes ahora, puedes ingresar los datos manualmente en el siguiente paso.
            </div>

            {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors">
                <ArrowLeft className="h-4 w-4" /> Anterior
              </button>
              <button onClick={handleStep2Next} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
                Continuar <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3 ───────────────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="p-8">
            <h2 className="text-xl font-bold text-slate-800 mb-1" style={{ fontFamily: "var(--font-outfit)" }}>Confirmar y Remisionar</h2>
            <p className="text-sm text-slate-400 mb-6">Revisa y ajusta los datos antes de enviar a Soft Seguros.</p>

            {/* Client Section */}
            <div className="mb-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <User className="h-3.5 w-3.5" /> Datos del Cliente
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "nombres",              label: "Nombres" },
                  { key: "apellidos",            label: "Apellidos" },
                  { key: "fecha_nacimiento",     label: "Fecha Nacimiento" },
                  { key: "genero",               label: "Género" },
                  { key: "email",                label: "Correo" },
                  { key: "telefono",             label: "Teléfono" },
                  { key: "direccion",            label: "Dirección" },
                  { key: "ciudad",               label: "Ciudad" },
                  { key: "provincia",            label: "Departamento" },
                  { key: "ocupacion_descripcion", label: "Ocupación" },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className={labelSmCls}>{label}</label>
                    <input
                      value={clientData[key] || ""}
                      onChange={e => setClientData(p => ({ ...p, [key]: e.target.value }))}
                      className={inputSmCls}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Policy Section */}
            <div className="mb-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Shield className="h-3.5 w-3.5" /> Datos de la Póliza
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelSmCls}>Número de Póliza *</label>
                  <input value={policyData.numero_poliza || ""} onChange={e => setPolicyData(p => ({ ...p, numero_poliza: e.target.value }))} className={inputSmCls} />
                </div>
                <div>
                  <label className={labelSmCls}>Aseguradora</label>
                  <input value={policyData.aseguradora || ""} onChange={e => setPolicyData(p => ({ ...p, aseguradora: e.target.value }))} className={inputSmCls} />
                </div>
                <div>
                  <label className={labelSmCls}>Ramo</label>
                  <select value={policyData.ramo || "auto"} onChange={e => setPolicyData(p => ({ ...p, ramo: e.target.value }))} className={inputSmCls}>
                    {RAMO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelSmCls}>Objeto Asegurado</label>
                  <input value={policyData.objeto_asegurado || ""} onChange={e => setPolicyData(p => ({ ...p, objeto_asegurado: e.target.value }))} placeholder="Placa, bien, etc." className={inputSmCls} />
                </div>
                <div>
                  <label className={labelSmCls}>Fecha Inicio</label>
                  <input type="date" value={policyData.fecha_inicio || ""} onChange={e => setPolicyData(p => ({ ...p, fecha_inicio: e.target.value }))} className={inputSmCls} />
                </div>
                <div>
                  <label className={labelSmCls}>Fecha Fin</label>
                  <input type="date" value={policyData.fecha_fin || ""} onChange={e => setPolicyData(p => ({ ...p, fecha_fin: e.target.value }))} className={inputSmCls} />
                </div>
                <div>
                  <label className={labelSmCls}>Moneda</label>
                  <select value={policyData.moneda || "COP"} onChange={e => setPolicyData(p => ({ ...p, moneda: e.target.value }))} className={inputSmCls}>
                    <option value="COP">COP (Pesos Colombianos)</option>
                    <option value="USD">USD (Dólares)</option>
                  </select>
                </div>
                <div className="col-span-2 grid grid-cols-4 gap-3">
                  <div>
                    <label className={labelSmCls}>Prima Neta</label>
                    <input
                      type="number"
                      value={policyData.prima_neta || ""}
                      onChange={e => setPolicyData(p => ({ ...p, prima_neta: Number(e.target.value) }))}
                      placeholder="1000000"
                      className={inputSmCls}
                    />
                  </div>
                  <div>
                    <label className={labelSmCls}>IVA</label>
                    <input
                      type="number"
                      value={policyData.iva || ""}
                      onChange={e => setPolicyData(p => ({ ...p, iva: Number(e.target.value) }))}
                      placeholder="190000"
                      className={inputSmCls}
                    />
                  </div>
                  <div>
                    <label className={labelSmCls}>Gastos Exped.</label>
                    <input
                      type="number"
                      value={policyData.gastos_expedicion || ""}
                      onChange={e => setPolicyData(p => ({ ...p, gastos_expedicion: Number(e.target.value) }))}
                      placeholder="0"
                      className={inputSmCls}
                    />
                  </div>
                  <div>
                    <label className={labelSmCls}>Prima Total</label>
                    <input
                      type="number"
                      value={policyData.prima_total || ""}
                      onChange={e => setPolicyData(p => ({ ...p, prima_total: Number(e.target.value) }))}
                      placeholder="1190000"
                      className={inputSmCls}
                    />
                  </div>
                </div>
                <div className="col-span-2 border-t border-slate-100 pt-3 mt-1">
                  <div className="flex items-center justify-between mb-2">
                    <label className={labelSmCls}>Forma de Pago</label>
                    {selectedPolizaId && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <RefreshCw className="h-2.5 w-2.5" /> Renovación de póliza #{busquedaResult.polizas.find(p => String(p.id) === selectedPolizaId)?.numero_poliza}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <button
                      onClick={() => setPolicyData(p => ({ ...p, forma_pago: "contado", num_cuotas: 1 }))}
                      className={`py-2 px-4 rounded-xl text-xs font-bold border-2 transition-all ${policyData.forma_pago !== "cuotas" ? "border-amber-400 bg-amber-50 text-amber-700" : "border-slate-100 text-slate-400"}`}
                    >
                      Contado (1 pago)
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPolicyData(p => ({ ...p, forma_pago: "cuotas", num_cuotas: p.num_cuotas || 2 }))}
                        className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold border-2 transition-all ${policyData.forma_pago === "cuotas" ? "border-amber-400 bg-amber-50 text-amber-700" : "border-slate-100 text-slate-400"}`}
                      >
                        Cuotas
                      </button>
                      {policyData.forma_pago === "cuotas" && (
                        <input
                          type="number"
                          min="2"
                          max="12"
                          value={policyData.num_cuotas || 2}
                          onChange={e => setPolicyData(p => ({ ...p, num_cuotas: Number(e.target.value) }))}
                          className="w-16 px-2 py-2 bg-slate-50 rounded-xl border border-slate-200 text-sm font-bold text-center"
                        />
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <label className={labelSmCls}>Periodicidad de Pago</label>
                    <select 
                      value={policyData.periodicidad || "Anual"} 
                      onChange={e => setPolicyData(p => ({ ...p, periodicidad: e.target.value }))}
                      className={inputSmCls}
                    >
                      <option value="Anual">Anual</option>
                      <option value="Mensual">Mensual</option>
                      <option value="Trimestral">Trimestral</option>
                      <option value="Semestral">Semestral</option>
                    </select>
                  </div>
                </div>

                <div className="col-span-2">
                  <label className={labelSmCls}>Asesor / Vendedor</label>
                  <select
                    value={policyData.vendedor_id || "27931"}
                    onChange={e => setPolicyData(p => ({ ...p, vendedor_id: e.target.value }))}
                    className={inputSmCls}
                  >
                    <option value="27931">ORGANIZACION DE SEGUROS ROESAN LIMITADA</option>
                    {vendedores.map(v => (
                      <option key={v.id} value={v.id}>{v.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Beneficiarios Section */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <User className="h-3.5 w-3.5" /> Beneficiarios
                </h3>
                <button
                  type="button"
                  onClick={() => setPolicyData(p => ({ ...p, beneficiarios: [...(p.beneficiarios || []), { nombres: "", numero_documento: "", parentesco: "", porcentaje_beneficio: 100 }] }))}
                  className="text-xs font-medium text-amber-500 hover:text-amber-600 flex items-center gap-1 bg-amber-50 px-2 py-1 rounded"
                >
                  <Plus className="h-3 w-3" /> Agregar Beneficiario
                </button>
              </div>
              
              {(policyData.beneficiarios || []).length === 0 ? (
                <p className="text-xs text-slate-400 italic">No hay beneficiarios agregados.</p>
              ) : (
                <div className="space-y-3">
                  {(policyData.beneficiarios || []).map((ben: any, idx: number) => (
                    <div key={idx} className="flex gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <input
                        value={ben.nombres}
                        onChange={e => {
                          const newB = [...policyData.beneficiarios];
                          newB[idx].nombres = e.target.value;
                          setPolicyData(p => ({ ...p, beneficiarios: newB }));
                        }}
                        placeholder="Nombres Completos"
                        className={`${inputSmCls} flex-1`}
                      />
                      <input
                        value={ben.numero_documento}
                        onChange={e => {
                          const newB = [...policyData.beneficiarios];
                          newB[idx].numero_documento = e.target.value;
                          setPolicyData(p => ({ ...p, beneficiarios: newB }));
                        }}
                        placeholder="Documento"
                        className={`${inputSmCls} w-32`}
                      />
                      <input
                        value={ben.parentesco || ""}
                        onChange={e => {
                          const newB = [...policyData.beneficiarios];
                          newB[idx].parentesco = e.target.value;
                          setPolicyData(p => ({ ...p, beneficiarios: newB }));
                        }}
                        placeholder="Parentesco"
                        className={`${inputSmCls} w-32`}
                      />
                      <input
                        type="number"
                        value={ben.porcentaje_beneficio}
                        onChange={e => {
                          const newB = [...policyData.beneficiarios];
                          newB[idx].porcentaje_beneficio = Number(e.target.value);
                          setPolicyData(p => ({ ...p, beneficiarios: newB }));
                        }}
                        placeholder="%"
                        className={`${inputSmCls} w-20`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newB = [...policyData.beneficiarios];
                          newB.splice(idx, 1);
                          setPolicyData(p => ({ ...p, beneficiarios: newB }));
                        }}
                        className="p-2 text-slate-400 hover:text-red-500 bg-white rounded-md border border-slate-200"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors">
                <ArrowLeft className="h-4 w-4" /> Anterior
              </button>
              <button
                onClick={handleRemisionar}
                disabled={loading}
                className="flex items-center gap-2 px-7 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Remisionar a Soft Seguros
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

"use client";

import { useParams } from "next/navigation";
import { db } from "@/lib/instant-db";
import { useEffect, useRef, useState } from "react";
import Head from "next/head";

function fmtCOP(n: any) {
  const num = typeof n === "string" ? parseInt(n.replace(/[^0-9]/g, "")) : Math.round(n);
  if (isNaN(num) || num === 0) return n;
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function fmtValor(v: any) {
  if (!v) return v;
  const n = parseInt(String(v).replace(/[^0-9]/g, ""));
  return isNaN(n) || n === 0 ? v : fmtCOP(n);
}

function fmtRC(v: any) {
  if (!v) return v;
  const s = String(v).trim();
  const mM = s.match(/(\d[\d.,]*)\s*[Mm]/);
  let n: number;
  if (mM) {
    n = parseFloat(mM[1].replace(/[.,]/g, "")) * 1_000_000;
  } else {
    const raw = parseInt(s.replace(/[^0-9]/g, ""));
    if (isNaN(raw) || raw === 0) return v;
    n = raw <= 10000 ? raw * 1_000_000 : raw;
  }
  const millions = Math.round(n / 1_000_000);
  return `$ ${millions.toLocaleString("es-CO")} M`;
}

const ASISTENCIAS = [
  { num: "01", titulo: "Grúa ilimitada", desc: "Sin límite de kilómetros en cualquier carretera del país.", icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px"><path d="M5 18H3c-.6 0-1-.4-1-1V7c0-.6.4-1 1-1h10c.6 0 1 .4 1 1v11"/><path d="M14 9h4l4 4v4c0 .6-.4 1-1 1h-2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>` },
  { num: "02", titulo: "Mecánico en sitio", desc: "Pinchazos, batería descargada, llave dentro del carro.", icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>` },
  { num: "03", titulo: "Conductor elegido", desc: "Si te excediste en una reunión, llevamos tu carro y a ti a casa.", icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>` },
  { num: "04", titulo: "Hospedaje y traslado", desc: "Si te varas lejos de casa, cubrimos hotel y transporte.", icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>` },
  { num: "05", titulo: "GPS y rastreo", desc: "Localización inmediata en caso de hurto o emergencia.", icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>` },
  { num: "06", titulo: "Adelanto de fianza", desc: "Para liberar el vehículo si quedó retenido por la autoridad.", icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>` },
  { num: "07", titulo: "Línea jurídica", desc: "Abogado disponible 24/7 para orientarte en el siniestro.", icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>` },
  { num: "08", titulo: "Lavado y laminado", desc: "Beneficios anuales en talleres autorizados de la red.", icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/></svg>` },
];

const STEPS = [
  { num: 1, label: "Llámanos", title: "Llámanos al instante", desc: "En el lugar del siniestro, llama primero a la línea 24/7 de la aseguradora y luego notifica a Roesan. Nosotros entramos a hacer el acompañamiento desde ese momento: validamos tu póliza, te orientamos sobre qué decir y activamos la red de ayuda.", action: "" },
  { num: 2, label: "Documenta", title: "Documenta sin riesgos", desc: "Toma fotos del vehículo, los daños y la placa del otro involucrado. Si hay heridos, prioriza atender. Te enviamos un checklist por WhatsApp con qué fotografiar y qué evitar decir mientras llega la grúa o el inspector.", action: "Te enviamos checklist por WhatsApp" },
  { num: 3, label: "Inspección", title: "Inspección y peritaje", desc: "La aseguradora envía un perito al lugar o coordina cita en taller. Roesan está presente o asiste el peritaje para asegurar que valoren correctamente todos los daños, incluyendo los que no son evidentes a simple vista.", action: "Acompañamos el peritaje" },
  { num: 4, label: "Reparación", title: "Reparación o reposición", desc: "Tu carro entra a un taller autorizado según la red de la aseguradora. Si tu póliza incluye vehículo de reemplazo, te lo entregan mientras tanto. En caso de pérdida total, agilizamos el pago de la indemnización.", action: "Agilizamos plazos con la compañía" },
  { num: 5, label: "Cierre", title: "Cierre y entrega", desc: "Recibes tu vehículo reparado o la indemnización. Roesan hace seguimiento posterior para verificar la calidad del servicio y resolver cualquier inconformidad. Si algo no quedó bien con la aseguradora, lo retomamos por ti.", action: "Garantía de acompañamiento Roesan" },
];

const LINEAS = [
  { nombre: "HDI", short: "#224", local: "601-307-7050", nacional: "01 8000 113 390", tel_short: "224", tel_local: "6013077050", tel_nac: "018000113390" },
  { nombre: "SURA", short: "#888", local: "601-489-7941", nacional: "01 8000 51 8888", tel_short: "888", tel_local: "6014897941", tel_nac: "018000518888" },
  { nombre: "Bolívar", short: "#322", local: "601-381-1151", nacional: "018000 123322", tel_short: "322", tel_local: "6013811151", tel_nac: "018000123322" },
  { nombre: "Allianz", short: "#611", local: "601-488-3800", nacional: "01 8000 519 611", tel_short: "611", tel_local: "6014883800", tel_nac: "018000519611" },
  { nombre: "AXA Colpatria", short: "", local: "601-745-5555", nacional: "01 8000 522 922", tel_short: "", tel_local: "6017455555", tel_nac: "018000522922" },
  { nombre: "Mapfre", short: "#567", local: "601-307-2050", nacional: "01 8000 111 567", tel_short: "567", tel_local: "6013072050", tel_nac: "018000111567" },
  { nombre: "Qualitas", short: "", local: "601-794-8400", nacional: "", tel_short: "", tel_local: "6017948400", tel_nac: "" },
  { nombre: "La Previsora", short: "", local: "601-307-0830", nacional: "01 8000 912 330", tel_short: "", tel_local: "6013070830", tel_nac: "018000912330" },
];

export default function PropuestaPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = db.useQuery({
    propuestas: {
      $: {
        where: { id: id },
      },
    },
  });

  const [scrollProgress, setScrollProgress] = useState(0);
  const trackingFired = useRef(false);

  // Notificar al equipo cuando el cliente abre la propuesta
  useEffect(() => {
    if (!data || data.propuestas.length === 0 || trackingFired.current) return;
    trackingFired.current = true;
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3002";
    fetch(`${backendUrl}/api/propuestas/${id}/vista`, { method: "POST" }).catch(() => {});
  }, [data, id]);

  useEffect(() => {
    const handleScroll = () => {
      const h = document.documentElement;
      if (h.scrollHeight - h.clientHeight > 0) {
        const progress = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
        setScrollProgress(progress);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const [activeStep, setActiveStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setActiveStep(s => (s + 1) % STEPS.length), 6500);
    return () => clearInterval(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc]">
        <div className="w-16 h-16 border-4 border-[#61bbe4] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-[#64748b] font-medium">Cargando propuesta...</p>
      </div>
    );
  }

  if (error || !data || data.propuestas.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc]">
        <p className="text-xl font-bold text-[#0f172a]">Propuesta no encontrada</p>
        <p className="mt-2 text-[#64748b]">El enlace es incorrecto o la propuesta ya no está disponible.</p>
      </div>
    );
  }

  const propuesta = data.propuestas[0];
  const ext = propuesta.extracted;
  const an = propuesta.analysis;

  const rec = ext.cotizaciones.find((c: any) => c.aseguradora.toLowerCase().includes(an.recomendada.toLowerCase())) || ext.cotizaciones[0];
  const sorted = [...ext.cotizaciones].sort((a: any, b: any) => a.prima_anual - b.prima_anual);
  const minP = sorted[0].prima_anual;
  const maxP = sorted[sorted.length - 1].prima_anual;

  const specsValor = fmtValor(ext.vehiculo.valor_asegurado);
  const specs = [
    ["Marca", ext.vehiculo.marca],
    ["Línea", ext.vehiculo.linea],
    ["Modelo / Año", ext.vehiculo.año],
    ["Placa", ext.vehiculo.placa],
    ["Ciudad", ext.vehiculo.ciudad],
    ["Valor asegurado", specsValor],
    ["Conductor", ext.cliente.nombre],
    ["Cotización", `Folio ${ext.folio || id.slice(0,6).toUpperCase()} · ${ext.cotizaciones.length} aseguradoras`],
  ];

  const heroRC = fmtRC(rec?.rc_limite);
  const heroValor = fmtValor(ext.vehiculo.valor_asegurado);

  const phoneAsesor = ext.asesor?.telefono || "573197282277";

  return (
    <div className="bg-[#f8fafc] min-h-screen font-sans text-[#334155] antialiased">
      <Head>
        <title>Propuesta Roesan · {ext.vehiculo.marca} {ext.vehiculo.año}</title>
      </Head>

      {/* Navigation */}
      <nav className="bg-white/95 backdrop-blur-md border-b border-[#e2e8f0] px-6 py-3.5 flex items-center justify-between sticky top-0 z-50">
        <img
          src="/logo-roesan-oficial.png"
          alt="Roesan Seguros"
          className="h-9 w-auto object-contain"
        />
        <div className="flex items-center gap-4 text-xs text-[#64748b] flex-wrap">
          <span className="w-2 h-2 rounded-full bg-[#22c55e] shadow-[0_0_0_4px_rgba(34,197,94,0.15)] inline-block"></span>
          Propuesta personalizada · vigencia {ext.vigencia_oferta}
          <span className="text-[#94a3b8]">|</span>
          <span className="text-[#2a2960] font-semibold">Folio {ext.folio || id.slice(0,6).toUpperCase()}</span>
        </div>
        <div 
          className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-[#51408d] to-[#61bbe4] transition-all duration-100 ease-out"
          style={{ width: `${scrollProgress}%` }}
        ></div>
      </nav>

      {/* Hero Section */}
      <div className="pt-8 pb-0">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="rounded-[28px] overflow-hidden bg-gradient-to-br from-[#1e103c] via-[#2a2960] to-[#0f172a] relative shadow-2xl">
            <div className="absolute -top-20 -right-20 w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(97,187,228,0.22),transparent_70%)]"></div>
            
            <div className="grid md:grid-cols-[1.3fr_1fr] gap-10 p-12 md:p-14 items-end relative z-10">
              <div>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-[10px] font-bold tracking-wider uppercase text-white/90 mb-5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#61bbe4]"></span>
                  Propuesta para {ext.cliente.nombre}
                </div>
                <h1 className="font-serif text-[clamp(30px,5vw,58px)] text-white leading-[1.05] font-normal tracking-tight mb-4">
                  Todo riesgo para tu <em className="text-[#61bbe4] not-italic italic">{ext.vehiculo.marca} {ext.vehiculo.año}</em>
                </h1>
                <div className="text-[15px] text-white/60 -mt-2 mb-4 tracking-wide">{ext.vehiculo.placa}</div>
                <p className="text-[17px] text-white/80 leading-relaxed font-light mb-7 max-w-md">
                  Comparamos {ext.cotizaciones.length} aseguradoras con tu perfil. Esta es la propuesta que mejor balancea precio, coberturas y servicio.
                </p>
                <div className="flex gap-6 flex-wrap pt-5 border-t border-white/10">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-white/50 mb-1">Cliente</div>
                    <div className="text-[15px] text-white font-medium">{ext.cliente.nombre}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-white/50 mb-1">Vigencia oferta</div>
                    <div className="text-[15px] text-white font-medium">{ext.vigencia_oferta}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-white/50 mb-1">Asesor</div>
                    <div className="text-[15px] text-white font-medium">{ext.asesor?.nombre || "Asesor Roesan"}</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[22px] p-7 relative">
                <span className="absolute -top-3 right-6 bg-[#fddf45] text-[#2a2960] text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                  Recomendada
                </span>
                <div className="text-[10px] uppercase tracking-widest text-white/60 mb-2">
                  Prima anual · {rec?.aseguradora} {rec?.plan}
                </div>
                <div className="font-serif text-4xl md:text-[44px] font-normal text-white tracking-tight leading-none mb-4">
                  {fmtCOP(rec?.prima_anual)}
                </div>
                <div className="border-t border-white/10 pt-3 flex flex-col gap-2">
                  <div className="flex justify-between text-[13px] text-white/80"><span>Suma asegurada</span><strong className="text-white">{heroValor}</strong></div>
                  <div className="flex justify-between text-[13px] text-white/80"><span>RC extracontractual</span><strong className="text-white">{heroRC}</strong></div>
                  <div className="flex justify-between text-[13px] text-white/80"><span>Deducible parcial</span><strong className="text-white">{rec?.ded_daño || "Ver detalle"}</strong></div>
                  <div className="flex justify-between text-[13px] text-white/80"><span>Vigencia oferta</span><strong className="text-[#fde68a]">{ext.vigencia_oferta}</strong></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Vehículo Section */}
      <div className="py-16">
        <div className="max-w-[1100px] mx-auto px-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#61bbe4] block mb-2">Tu vehículo</span>
          <h2 className="font-serif text-[clamp(26px,3.5vw,42px)] text-[#0f172a] leading-[1.1] tracking-tight mb-3">
            Lo que vamos a <em className="italic text-[#51408d]">proteger</em>
          </h2>
          <p className="text-base text-[#0f172a] leading-relaxed mb-6">
            Confirma que los datos coincidan con tu tarjeta de propiedad. Si hay algún error, da clic aquí:
            <a href={`https://wa.me/${phoneAsesor}?text=${encodeURIComponent(`Hola soy ${ext.cliente.nombre}, encontré el siguiente error en la cotización: `)}`} 
               target="_blank" rel="noreferrer"
               className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#25D366] text-white no-underline font-bold text-[13px] ml-2 align-middle shadow-[0_3px_10px_rgba(37,211,102,0.35)]">
               <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.116.553 4.103 1.523 5.824L.057 23.428a.75.75 0 0 0 .915.915l5.604-1.466A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.732 9.732 0 0 1-4.964-1.355l-.356-.212-3.679.963.981-3.587-.232-.369A9.712 9.712 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/></svg>
               Reportar error
            </a>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {specs.map(([k, v], i) => (
              <div key={i} className="bg-white rounded-[14px] p-4 border border-[#e2e8f0]">
                <div className="text-[10px] uppercase tracking-widest text-[#94a3b8] font-bold mb-1">{k}</div>
                <div className="text-[15px] text-[#0f172a] font-medium leading-tight">{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Análisis IA Section */}
      <div className="bg-gradient-to-br from-[#2a2960] to-[#1e103c] py-20">
        <div className="max-w-[1100px] mx-auto px-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#61bbe4] block mb-2">Análisis Roesan</span>
          <h2 className="font-serif text-[clamp(26px,3.5vw,42px)] text-white leading-[1.1] tracking-tight mb-4">
            Nuestra <em className="italic text-[#61bbe4]">recomendación experta</em>
          </h2>
          <p className="text-[17px] text-white/70 leading-relaxed font-light mb-9 text-justify">
            {an.analisis_general}
          </p>
          
          <div className="grid md:grid-cols-[1.2fr_1fr] gap-6">
            <div className="bg-white/5 border border-[#61bbe4]/25 rounded-[20px] p-8">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#61bbe4] mb-3">Opción recomendada</div>
              <div className="font-serif text-[26px] text-white mb-1">{an.recomendada}</div>
              <div className="text-[13px] text-white/60 mb-4">{an.plan_recomendado}</div>
              <p className="text-[15px] text-white/80 leading-relaxed mb-5 text-justify">
                {an.razon_principal}
              </p>
              
              <div className="flex flex-col gap-3">
                {(an.puntos_fuertes || []).map((p: string, i: number) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="shrink-0 w-4 h-4 rounded-full bg-gradient-to-br from-[#34d399] to-[#06b6d4] flex items-center justify-center mt-0.5">
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" width="8" height="8"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <span className="text-[14px] text-white/85 leading-snug">{p}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex flex-col gap-4">
              <div className="bg-white/5 border border-white/10 rounded-[18px] p-6">
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-2.5">Alternativa</div>
                <div className="font-serif text-xl text-white mb-1.5">{an.alternativa}</div>
                <p className="text-[14px] text-white/70 leading-relaxed text-justify">
                  {an.razon_alternativa}
                </p>
              </div>
              <div className="bg-[#fddf45]/10 border border-[#fddf45]/30 rounded-[16px] p-4 text-[13px] text-white/85 leading-relaxed">
                <strong className="text-[#fde68a]">⚠ Importante:</strong> En caso de ser una póliza nueva o un cambio de aseguradora en proceso de renovación, la aseguradora puede requerir una inspección al momento de emisión de la póliza.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cotizaciones list */}
      <div className="py-16">
        <div className="max-w-[1100px] mx-auto px-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#61bbe4] block mb-2">{ext.cotizaciones.length} aseguradoras comparadas</span>
          <h2 className="font-serif text-[clamp(26px,3.5vw,42px)] text-[#0f172a] leading-[1.1] tracking-tight mb-2">
            Trabajamos para ti, <em className="italic text-[#51408d]">no para la aseguradora</em>
          </h2>
          <p className="text-base text-[#64748b] leading-relaxed mb-9 font-light">Precios y coberturas reales. La decisión final es tuya.</p>
          
          <div className="flex flex-col gap-3">
            {sorted.map((q: any, i: number) => {
              const pct = maxP > minP ? Math.round(((q.prima_anual - minP) / (maxP - minP)) * 100) : 50;
              const isRec = q.aseguradora.toLowerCase().includes(an.recomendada.toLowerCase());
              const isMin = q.prima_anual === minP;
              const waMsg = encodeURIComponent(`Hola soy ${ext.cliente.nombre}, les solicito procedan a emitir esta Póliza con ${q.aseguradora} para el vehículo ${ext.vehiculo.placa}. ¡Gracias!`);
              
              return (
                <div key={i} className={`rounded-[18px] p-5 md:p-6 relative shadow-sm transition-all
                  ${isRec ? "bg-gradient-to-br from-[#51408d]/5 to-[#61bbe4]/10 border-2 border-[#51408d] shadow-[#51408d]/10 shadow-lg" : "bg-white border border-[#e2e8f0]"}`}>
                  
                  {isRec && (
                    <span className="absolute -top-2.5 left-5 bg-[#2a2960] text-white text-[9px] font-bold tracking-widest uppercase px-3 py-1 rounded-full">
                      Recomendada por Roesan
                    </span>
                  )}
                  {isMin && !isRec && (
                    <span className="absolute -top-2.5 right-5 md:right-36 bg-[#fddf45] text-[#2a2960] text-[9px] font-bold tracking-widest uppercase px-3 py-1 rounded-full">
                      Mejor precio
                    </span>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-[1.2fr_0.9fr_2fr_auto] gap-4 md:gap-6 items-center">
                    <div>
                      <div className="font-serif text-[19px] font-medium text-[#0f172a]">{q.aseguradora}</div>
                      <div className="text-[12px] text-[#64748b] mt-0.5">{q.plan}</div>
                    </div>
                    <div>
                      <div className="font-serif text-2xl font-medium text-[#2a2960]">{fmtCOP(q.prima_anual)}</div>
                      <div className="text-[10px] text-[#94a3b8] uppercase tracking-widest mt-0.5">Prima anual · IVA</div>
                      <div className="h-1 bg-[#f1f5f9] rounded-full mt-2 overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${isRec ? 'bg-[#51408d]' : isMin ? 'bg-[#fddf45]' : 'bg-[#61bbe4]'}`}
                          style={{ width: `${100 - pct}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
                      <div><div className="text-[#94a3b8] text-[9px] uppercase tracking-wider mb-0.5">RC</div><div className="text-[#1e293b] font-semibold">{fmtRC(q.rc_limite)}</div></div>
                      <div><div className="text-[#94a3b8] text-[9px] uppercase tracking-wider mb-0.5">Deducible</div><div className="text-[#1e293b] font-semibold">{q.ded_daño || "-"}</div></div>
                      <div><div className="text-[#94a3b8] text-[9px] uppercase tracking-wider mb-0.5">Reemplazo</div><div className="text-[#1e293b] font-semibold">{q.reemplazo_total || "-"}</div></div>
                      <div><div className="text-[#94a3b8] text-[9px] uppercase tracking-wider mb-0.5">Cond. elegido</div><div className="text-[#1e293b] font-semibold">{q.conductor_elegido || "-"}</div></div>
                    </div>
                    <div className="mt-2 md:mt-0">
                      <a href={`https://wa.me/${phoneAsesor}?text=${waMsg}`} target="_blank" rel="noreferrer"
                         className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#25D366] text-white no-underline font-bold text-[12px] whitespace-nowrap shadow-[0_3px_10px_rgba(37,211,102,0.3)] transition-transform hover:scale-105">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.116.553 4.103 1.523 5.824L.057 23.428a.75.75 0 0 0 .915.915l5.604-1.466A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.732 9.732 0 0 1-4.964-1.355l-.356-.212-3.679.963.981-3.587-.232-.369A9.712 9.712 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/></svg>
                        Seleccionar esta póliza
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer / CTA */}
      <div className="bg-[#f8fafc] pt-14 pb-24">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="bg-gradient-to-br from-[#2a2960] to-[#1e103c] rounded-[28px] p-10 md:p-14 relative overflow-hidden">
            <div className="absolute -top-24 -right-16 w-80 h-80 rounded-full bg-[radial-gradient(circle,rgba(97,187,228,0.22),transparent_70%)]"></div>
            
            <div className="grid md:grid-cols-[1.3fr_1fr] gap-10 items-center relative z-10">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#61bbe4] block mb-2">Siguiente paso</span>
                <h2 className="font-serif text-[clamp(24px,3vw,36px)] text-white leading-[1.1] tracking-tight mb-4">
                  Seleccionar póliza, enviar <em className="italic text-[#61bbe4]">Sarlaft</em> y hacer el pago
                </h2>
                <p className="text-[16px] text-white/75 leading-relaxed mb-6">Si tienes alguna duda, agenda 30 minutos con tu asesora y lo resolvemos.</p>
                <div className="flex gap-3 flex-wrap">
                  <a href={`https://wa.me/${phoneAsesor}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#25D366] text-white no-underline font-bold text-sm transition-transform hover:scale-105">
                    <span className="text-lg leading-none">📱</span> WhatsApp
                  </a>
                  <a href="mailto:autos@roesan.com.co" className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white/10 border border-white/30 text-white no-underline font-bold text-sm hover:bg-white/20 transition-colors">
                    <span className="text-lg leading-none">✉️</span> Email
                  </a>
                  <a href="https://roesan.com.co" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white/10 border border-white/30 text-white no-underline font-bold text-sm hover:bg-white/20 transition-colors">
                    <span className="text-lg leading-none">🌐</span> roesan.com.co
                  </a>
                </div>
              </div>
              
              <div className="bg-white/10 border border-white/20 rounded-[20px] p-7">
                <div className="flex gap-3.5 items-center mb-5">
                  <div className="w-[58px] h-[58px] rounded-full bg-gradient-to-br from-[#61bbe4] to-[#51408d] flex items-center justify-center text-xl font-bold text-white font-serif shrink-0">
                    {ext.asesor?.nombre?.substring(0,2).toUpperCase() || "AG"}
                  </div>
                  <div>
                    <div className="text-[19px] font-bold text-white leading-tight">{ext.asesor?.nombre || "Adriana Garzón"}</div>
                    <div className="text-[13px] text-white/65 mt-1">Ejecutiva Autos · Roesan Seguros</div>
                  </div>
                </div>
                <div className="flex flex-col gap-3 mb-5">
                  <a href={`https://wa.me/${phoneAsesor}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 text-[15px] text-white no-underline font-medium hover:text-[#25D366] transition-colors">
                    <span className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center text-base shrink-0">📱</span>
                    <span>{phoneAsesor}</span>
                  </a>
                  <a href={`mailto:${ext.asesor?.email || 'autos@roesan.com.co'}`} className="flex items-center gap-3 text-[15px] text-white no-underline font-medium hover:text-[#61bbe4] transition-colors">
                    <span className="w-8 h-8 rounded-full bg-[#61bbe4] flex items-center justify-center text-base shrink-0">✉️</span>
                    <span>{ext.asesor?.email || "autos@roesan.com.co"}</span>
                  </a>
                </div>
                <a href={`https://wa.me/${phoneAsesor}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2.5 p-3.5 rounded-[14px] bg-[#25D366] text-white no-underline font-extrabold text-[15px] tracking-wide shadow-lg transition-transform hover:scale-[1.02]">
                  <span className="text-xl">📱</span> Hablar con Asesor
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Asistencias 24/7 */}
      <div className="bg-gradient-to-br from-[#1e103c] to-[#2a2960] py-20">
        <div className="max-w-[1100px] mx-auto px-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#61bbe4] block mb-2">Incluido en tu póliza</span>
          <h2 className="font-serif text-[clamp(26px,3.5vw,42px)] text-white leading-[1.1] tracking-tight mb-3">
            Asistencias <em className="italic text-[#61bbe4]">24 / 7</em>
          </h2>
          <p className="text-[16px] text-white/65 leading-relaxed mb-10">Disponibles los 365 días del año, a cualquier hora, en cualquier punto del país.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {ASISTENCIAS.map((a) => (
              <div key={a.num} className="bg-white/5 border border-white/10 rounded-[18px] p-5 hover:border-[#61bbe4]/40 transition-all">
                <div
                  className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#51408d] to-[#61bbe4] flex items-center justify-center mb-3"
                  dangerouslySetInnerHTML={{ __html: a.icon }}
                />
                <div className="text-[10px] text-white/40 font-bold tracking-widest mb-1">{a.num}</div>
                <div className="text-[14px] text-white font-semibold mb-1.5 leading-tight">{a.titulo}</div>
                <div className="text-[12px] text-white/60 leading-relaxed">{a.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stepper siniestro */}
      <div className="py-20 bg-[#f8fafc]">
        <div className="max-w-[1100px] mx-auto px-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#61bbe4] block mb-2">Si ocurre un siniestro</span>
          <h2 className="font-serif text-[clamp(26px,3.5vw,42px)] text-[#0f172a] leading-[1.1] tracking-tight mb-3">
            ¿Qué hago si tengo <em className="italic text-[#51408d]">un accidente?</em>
          </h2>
          <p className="text-base text-[#64748b] leading-relaxed mb-10">Te acompañamos en cada paso del proceso.</p>

          <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
            {STEPS.map((s, i) => (
              <button
                key={s.num}
                onClick={() => setActiveStep(i)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-[12px] font-semibold whitespace-nowrap border transition-all ${
                  activeStep === i
                    ? "bg-[#51408d] text-white border-[#51408d] shadow-[0_4px_14px_rgba(81,64,141,0.35)]"
                    : "bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#51408d]/40"
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${activeStep === i ? "bg-white/20 text-white" : "bg-[#f1f5f9] text-[#94a3b8]"}`}>{s.num}</span>
                {s.label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-[24px] p-8 md:p-10 border border-[#e2e8f0] shadow-sm">
            <div className="flex items-start gap-6">
              <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-[#51408d] to-[#61bbe4] flex items-center justify-center text-white font-serif text-2xl font-bold">
                {STEPS[activeStep].num}
              </div>
              <div className="flex-1">
                <h3 className="font-serif text-[22px] text-[#0f172a] mb-3">{STEPS[activeStep].title}</h3>
                <p className="text-[16px] text-[#475569] leading-relaxed mb-4">{STEPS[activeStep].desc}</p>
                {STEPS[activeStep].action && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#51408d]/10 border border-[#51408d]/20 text-[13px] font-semibold text-[#51408d]">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>
                    {STEPS[activeStep].action}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-7 justify-center">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveStep(i)}
                  className={`rounded-full transition-all ${i === activeStep ? "w-6 h-2 bg-[#51408d]" : "w-2 h-2 bg-[#e2e8f0] hover:bg-[#51408d]/40"}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Líneas de asistencia directa */}
      <div className="py-16 bg-white">
        <div className="max-w-[1100px] mx-auto px-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#61bbe4] block mb-2">Contacto directo</span>
          <h2 className="font-serif text-[clamp(22px,3vw,36px)] text-[#0f172a] leading-[1.1] tracking-tight mb-2">
            Líneas de <em className="italic text-[#51408d]">asistencia directa</em>
          </h2>
          <p className="text-base text-[#64748b] leading-relaxed mb-8">En una emergencia, llama directo a la aseguradora o usa el número corto desde cualquier celular.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {LINEAS.map((l) => (
              <div key={l.nombre} className="rounded-[16px] border border-[#e2e8f0] p-4 bg-[#f8fafc] hover:border-[#51408d]/30 hover:shadow-md transition-all">
                <div className="font-serif text-[15px] font-semibold text-[#0f172a] mb-2.5">{l.nombre}</div>
                {l.short && (
                  <a href={`tel:${l.tel_short}`} className="flex items-center gap-1.5 text-[13px] text-[#51408d] font-bold no-underline mb-1.5 hover:text-[#2a2960]">
                    <span className="text-[10px] uppercase tracking-wider text-[#94a3b8] font-normal mr-0.5">Corto:</span>
                    {l.short}
                  </a>
                )}
                <a href={`tel:${l.tel_local}`} className="flex items-center gap-1.5 text-[12px] text-[#334155] no-underline mb-1 hover:text-[#51408d]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="11" height="11"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  {l.local}
                </a>
                {l.nacional && (
                  <a href={`tel:${l.tel_nac}`} className="flex items-center gap-1.5 text-[11px] text-[#64748b] no-underline hover:text-[#51408d]">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="11" height="11"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    {l.nacional}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Full Footer */}
      <footer className="bg-[#1e103c] pt-14 pb-8">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-10 pb-10 border-b border-white/10">
            <div>
              <img src="/logo-roesan-oficial.png" alt="Roesan Seguros" className="h-8 w-auto object-contain mb-4 brightness-0 invert" />
              <p className="text-[13px] text-white/55 leading-relaxed mb-4">Corredor de seguros autorizado por la Superintendencia Financiera de Colombia.</p>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-[#61bbe4] mb-4">Servicios</div>
              <ul className="flex flex-col gap-2.5 text-[13px] text-white/55 list-none p-0 m-0">
                <li>Seguros de autos todo riesgo</li>
                <li>Seguros de vida y salud</li>
                <li>SOAT</li>
                <li>Seguros empresariales</li>
                <li>Renovaciones y gestión de siniestros</li>
              </ul>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-[#61bbe4] mb-4">Contacto</div>
              <ul className="flex flex-col gap-2.5 text-[13px] text-white/55 list-none p-0 m-0">
                <li>Bogotá, Colombia</li>
                <li><a href="mailto:autos@roesan.com.co" className="text-white/55 no-underline hover:text-white transition-colors">autos@roesan.com.co</a></li>
                <li><a href="https://roesan.com.co" target="_blank" rel="noreferrer" className="text-white/55 no-underline hover:text-white transition-colors">roesan.com.co</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-6 flex flex-wrap justify-between gap-3 text-[11px] text-white/30">
            <span>© {new Date().getFullYear()} Organización de Seguros Roesan Ltda. Todos los derechos reservados.</span>
            <span>Propuesta no vinculante · sujeta a estudio de la aseguradora</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

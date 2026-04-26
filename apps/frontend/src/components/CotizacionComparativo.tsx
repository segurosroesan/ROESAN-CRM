"use client";

import React, { useState } from "react";
import {
  fmtPeso,
  abreviarCobertura,
  ordenarCotizaciones
} from "@/lib/comparador-helpers";
import { Copy, Check, ChevronDown, ChevronUp, Sparkles, MailOpen } from "lucide-react";

interface CotizacionComparativoProps {
  cotizaciones: any[];
  comparativoIA: any;
  accionIA: string;
  asegRenovacion: string;
  diferenciaPrima: number;
  esNuevo: boolean;
  onGenerarCorreo?: () => void;
}

export function CotizacionComparativo({
  cotizaciones,
  comparativoIA,
  accionIA,
  asegRenovacion,
  diferenciaPrima,
  esNuevo,
  onGenerarCorreo
}: CotizacionComparativoProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!cotizaciones || cotizaciones.length === 0) {
    return <div className="text-slate-400 text-sm italic">No hay cotizaciones para comparar.</div>;
  }

  const recomendada = (comparativoIA?.aseguradora_recomendada || "").toUpperCase();
  const ordenadas = ordenarCotizaciones(cotizaciones);

  // ── Banner config ──
  type BannerConfig = {
    icon: string;
    titulo: string;
    detalle: string;
    accentColor: string;
    borderColor: string;
    bgStyle: React.CSSProperties;
  };

  let banner: BannerConfig = {
    icon: "⭐",
    titulo: recomendada || "Analizando…",
    detalle: "",
    accentColor: "#f59e0b",
    borderColor: "rgba(245,158,11,0.25)",
    bgStyle: { background: "linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(249,115,22,0.05) 100%)" },
  };

  if (accionIA === "CAMBIAR" && !esNuevo) {
    const ahorro = diferenciaPrima > 0 ? ` • Ahorro estimado: ${fmtPeso(diferenciaPrima)}/año` : "";
    banner = {
      icon: "🔄",
      titulo: `CAMBIAR → ${recomendada}`,
      detalle: `Mejor opción vs. renovación actual de ${asegRenovacion?.toUpperCase()}${ahorro}`,
      accentColor: "#3b82f6",
      borderColor: "rgba(59,130,246,0.2)",
      bgStyle: { background: "linear-gradient(135deg, rgba(59,130,246,0.07) 0%, rgba(99,102,241,0.05) 100%)" },
    };
  } else if (accionIA === "RENOVAR" && !esNuevo) {
    banner = {
      icon: "✅",
      titulo: `RENOVAR con ${recomendada}`,
      detalle: `La póliza vigente de ${asegRenovacion?.toUpperCase()} sigue siendo la mejor opción`,
      accentColor: "#10b981",
      borderColor: "rgba(16,185,129,0.2)",
      bgStyle: { background: "linear-gradient(135deg, rgba(16,185,129,0.07) 0%, rgba(5,150,105,0.05) 100%)" },
    };
  } else if (accionIA === "MEJOR_OPCION" || esNuevo) {
    banner = {
      icon: "🏆",
      titulo: `MEJOR OPCIÓN: ${recomendada}`,
      detalle: "La alternativa más competitiva para este cliente",
      accentColor: "#f59e0b",
      borderColor: "rgba(245,158,11,0.25)",
      bgStyle: { background: "linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(249,115,22,0.05) 100%)" },
    };
  }

  const handleCopyJustificacion = () => {
    if (comparativoIA?.justificacion_corta) {
      navigator.clipboard.writeText(comparativoIA.justificacion_corta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ── Table helpers ──
  const todasCobs: string[] = [];
  const todasDeds: string[] = [];
  for (const c of ordenadas) {
    for (const cob of c.coberturas || []) {
      if (cob.nombre && !todasCobs.includes(cob.nombre)) todasCobs.push(cob.nombre);
    }
    for (const d of c.deducibles || []) {
      if (d.cobertura && !todasDeds.includes(d.cobertura)) todasDeds.push(d.cobertura);
    }
  }

  return (
    <div className="space-y-5">

      {/* ── Nova-style AI Banner ── */}
      <div
        className="relative rounded-2xl p-5 overflow-hidden"
        style={{ ...banner.bgStyle, border: `1px solid ${banner.borderColor}` }}
      >
        {/* Subtle top-edge glow line */}
        <div
          className="absolute top-0 left-[15%] right-[15%] h-px pointer-events-none"
          style={{ background: `linear-gradient(90deg, transparent, ${banner.accentColor}, transparent)`, opacity: 0.6 }}
        />

        <div className="flex flex-col md:flex-row gap-5 items-start">
          {/* Left: decision */}
          <div className="flex items-start gap-3 flex-1">
            <span className="text-2xl shrink-0">{banner.icon}</span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1.5" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                <Sparkles className="h-3 w-3" style={{ color: banner.accentColor }} />
                Adriana IA recomienda
              </p>
              <p className="text-lg font-bold text-slate-800 leading-tight" style={{ fontFamily: "var(--font-outfit)" }}>
                {banner.titulo}
              </p>
              <p className="text-sm text-slate-500 mt-0.5 font-light">{banner.detalle}</p>
            </div>
          </div>

          {/* Right: justificación */}
          <div
            className="md:w-2/5 rounded-xl p-3.5 relative group"
            style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.9)" }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
              Justificación IA
            </p>
            <p className="text-sm text-slate-700 italic leading-relaxed">
              {comparativoIA?.justificacion_corta || "—"}
            </p>
            <button
              onClick={handleCopyJustificacion}
              className="absolute top-2 right-2 p-1.5 bg-white rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity border border-slate-100"
              title="Copiar justificación"
            >
              {copied
                ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                : <Copy className="w-3.5 h-3.5 text-slate-400" />
              }
            </button>
          </div>
        </div>
      </div>

      {/* ── Summary Table ── */}
      <div className="bento-card bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr style={{ background: "linear-gradient(90deg, #060614 0%, #0c0c22 100%)" }}>
                <th className="px-4 py-3 text-amber-400/80 text-xs font-semibold uppercase tracking-widest" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                  Aseguradora
                </th>
                <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-widest" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                  Prima Neta
                </th>
                <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-widest" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                  IVA
                </th>
                <th className="px-4 py-3 text-amber-400 text-xs font-semibold uppercase tracking-widest" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                  Prima Total
                </th>
                <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-widest" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                  Valor Asegurado
                </th>
                <th className="px-4 py-3 text-slate-400 text-xs font-semibold uppercase tracking-widest" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                  Coberturas
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {ordenadas.map((c, i) => {
                const esRecom = (c.aseguradora || "").toUpperCase() === recomendada;
                const esRenov = c.es_renovacion;

                const cobDest = (c.coberturas || [])
                  .slice(0, 3)
                  .map((cob: any) => (
                    <span
                      key={cob.nombre}
                      className="inline-block px-2 py-0.5 text-[10px] rounded-md mr-1 mb-1 border"
                      style={esRecom
                        ? { background: "rgba(245,158,11,0.08)", color: "#92400e", borderColor: "rgba(245,158,11,0.2)" }
                        : { background: "#f8fafc", color: "#64748b", borderColor: "#e2e8f0" }
                      }
                    >
                      {abreviarCobertura(cob.nombre)}
                    </span>
                  ));

                return (
                  <tr
                    key={`${c.aseguradora}-${i}`}
                    className="transition-colors hover:bg-amber-50/30"
                    style={esRecom ? { background: "rgba(245,158,11,0.04)" } : esRenov ? { background: "rgba(59,130,246,0.03)" } : {}}
                  >
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-800" style={{ fontFamily: "var(--font-outfit)" }}>
                        {c.aseguradora || "—"}
                      </div>
                      {c.nombre_plan && (
                        <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[140px]">{c.nombre_plan}</div>
                      )}
                      <div className="flex gap-1 mt-1.5">
                        {esRenov && (
                          <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold rounded-md" style={{ background: "rgba(59,130,246,0.1)", color: "#1d4ed8" }}>
                            🔄 VIGENTE
                          </span>
                        )}
                        {esRecom && !esRenov && (
                          <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold rounded-md" style={{ background: "rgba(245,158,11,0.12)", color: "#92400e" }}>
                            ⭐ RECOMENDADA
                          </span>
                        )}
                        {esRecom && esRenov && (
                          <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold rounded-md" style={{ background: "rgba(16,185,129,0.1)", color: "#065f46" }}>
                            ✅ RENOVAR
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600" style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: "0.82rem" }}>
                      {fmtPeso(c.prima_neta)}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500" style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: "0.82rem" }}>
                      {fmtPeso(c.iva)}
                    </td>
                    <td className="px-4 py-3.5 font-bold" style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: "0.88rem", color: "#92400e" }}>
                      {fmtPeso(c.prima_total)}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500" style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: "0.82rem" }}>
                      {fmtPeso(c.valor_asegurado)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap max-w-[200px]">{cobDest.length > 0 ? cobDest : <span className="text-slate-300 text-xs">—</span>}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate email button */}
      {onGenerarCorreo && (
        <div className="flex justify-end">
          <button
            onClick={onGenerarCorreo}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl text-white transition-all hover:opacity-90 shadow-sm"
            style={{ background: "linear-gradient(135deg, #060614, #1e1e3a)", fontFamily: "var(--font-outfit)", border: "1px solid rgba(245,158,11,0.15)" }}
          >
            <MailOpen className="h-4 w-4 text-amber-400" />
            Generar correo para cliente
          </button>
        </div>
      )}

      {/* ── Detailed Breakdown Toggle ── */}
      <div className="border-t border-slate-100 pt-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors w-full group"
          style={{ fontFamily: "var(--font-outfit)" }}
        >
          <div
            className="h-5 w-5 rounded-md flex items-center justify-center transition-colors"
            style={{ background: expanded ? "rgba(245,158,11,0.12)" : "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.06)" }}
          >
            {expanded
              ? <ChevronUp className="w-3 h-3 text-amber-600" />
              : <ChevronDown className="w-3 h-3 text-slate-400" />
            }
          </div>
          {expanded ? "Ocultar análisis detallado (Vista Adriana)" : "Ver análisis detallado por cobertura (Vista Adriana)"}
        </button>

        {expanded && (
          <div className="mt-4 bento-card bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr style={{ background: "linear-gradient(90deg, #060614 0%, #0c0c22 100%)" }}>
                    <th className="px-4 py-3 sticky left-0 z-10 w-56 text-xs font-semibold uppercase tracking-widest text-amber-400/70" style={{ background: "#040412", fontFamily: "var(--font-jetbrains-mono)" }}>
                      Concepto
                    </th>
                    {ordenadas.map((c, i) => {
                      const esRenov = c.es_renovacion;
                      const esRecom = (c.aseguradora || "").toUpperCase() === recomendada;
                      return (
                        <th
                          key={`hd-${i}`}
                          className="px-4 py-3 text-center min-w-[120px] text-xs font-semibold uppercase tracking-wider"
                          style={{
                            fontFamily: "var(--font-outfit)",
                            color: esRecom ? "#fde68a" : esRenov ? "#93c5fd" : "#94a3b8",
                            background: esRecom ? "rgba(245,158,11,0.12)" : esRenov ? "rgba(59,130,246,0.12)" : "transparent",
                          }}
                        >
                          <div className="font-bold">
                            {esRenov && "🔄 "}{esRecom && "⭐ "}
                            {(c.aseguradora || "—").toUpperCase()}
                          </div>
                          {c.nombre_plan && (
                            <div className="text-[9px] font-normal opacity-60 mt-0.5 truncate max-w-[110px]" title={c.nombre_plan}>
                              {c.nombre_plan}
                            </div>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {/* Prima Total Row */}
                  <tr className="font-bold" style={{ background: "rgba(245,158,11,0.04)" }}>
                    <td className="px-4 py-3 sticky left-0 z-10 text-xs uppercase tracking-wider text-slate-600" style={{ background: "rgba(245,158,11,0.04)", fontFamily: "var(--font-jetbrains-mono)", borderRight: "1px solid rgba(0,0,0,0.04)" }}>
                      Prima Total Anual
                    </td>
                    {ordenadas.map((c, i) => (
                      <td key={`pt-${i}`} className="px-4 py-3 text-center font-bold" style={{ fontFamily: "var(--font-jetbrains-mono)", color: "#92400e", fontSize: "0.85rem" }}>
                        {fmtPeso(c.prima_total)}
                      </td>
                    ))}
                  </tr>

                  {/* Coberturas */}
                  <tr><td colSpan={ordenadas.length + 1} className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-amber-600/70 bg-amber-50/50" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>Coberturas</td></tr>
                  {todasCobs.map((cobName, idx) => (
                    <tr key={`cob-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-2 sticky left-0 z-10 text-xs font-medium text-slate-600" style={{ background: "white", borderRight: "1px solid rgba(0,0,0,0.04)", fontFamily: "var(--font-inter)" }}>
                        {cobName}
                      </td>
                      {ordenadas.map((c, i) => {
                        const match = (c.coberturas || []).find((x: any) => x.nombre === cobName);
                        const val = match?.valor || "NO INCLUYE";
                        const isNo = ["NO INCLUYE", "NO AMPARA", "NO APLICA"].includes(val);
                        return (
                          <td key={`cval-${i}`} className="px-4 py-2 text-center text-xs" style={{ color: isNo ? "#ef4444" : val === "INCLUIDA" ? "#059669" : "#475569", fontFamily: "var(--font-jetbrains-mono)" }}>
                            {val === "INCLUIDA" ? "✓" : val}
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  {/* Deducibles */}
                  {todasDeds.length > 0 && (
                    <>
                      <tr><td colSpan={ordenadas.length + 1} className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500/70 bg-slate-50" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>Deducibles</td></tr>
                      {todasDeds.map((dedName, idx) => (
                        <tr key={`ded-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-2 sticky left-0 z-10 text-xs font-medium text-slate-600" style={{ background: "white", borderRight: "1px solid rgba(0,0,0,0.04)", fontFamily: "var(--font-inter)" }}>
                            {dedName}
                          </td>
                          {ordenadas.map((c, i) => {
                            const match = (c.deducibles || []).find((x: any) => x.cobertura === dedName);
                            return (
                              <td key={`dval-${i}`} className="px-4 py-2 text-center text-xs text-slate-500" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                                {match?.deducible || "—"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

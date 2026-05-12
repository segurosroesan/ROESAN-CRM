"use client";

import React, { useState } from "react";
import {
  fmtPeso,
  numPrima,
  ordenarCotizaciones
} from "@/lib/comparador-helpers";
import { Copy, Check, Sparkles, MailOpen } from "lucide-react";

interface CotizacionComparativoProps {
  cotizaciones: any[];
  comparativoIA: any;
  accionIA: string;
  asegRenovacion: string;
  diferenciaPrima: number;
  esNuevo: boolean;
  onGenerarCorreo?: () => void;
}

// Colores de comparativo.py
const C_HEADER  = "#1a3a5c";
const C_SUBHDR  = "#2e6da4";
const C_ROW_ODD = "#eaf3fb";
const C_BEST    = "#c8e6c9";
const C_WORST   = "#ffcdd2";
const C_LBGD    = "#dce8f5";
const C_LBGD_ODD = "#c8d9ed";
const C_GRID    = "#c0d0e0";

// ── Helpers de formato ────────────────────────────────────────────────────

function getCob(c: any): any {
  if (!c.coberturas || Array.isArray(c.coberturas)) return {};
  return c.coberturas;
}

function fmtDed(pct: any, smmlv: any): string {
  const parts: string[] = [];
  if (pct !== null && pct !== undefined) parts.push(`${pct}%`);
  if (smmlv !== null && smmlv !== undefined) parts.push(`mín. ${smmlv} SMMLV`);
  return parts.length ? parts.join(" / ") : "—";
}

function fmtBool(v: any): { text: string; included: boolean; excluded: boolean } {
  if (v === true || v === "Si" || v === "si") return { text: "✓", included: true, excluded: false };
  return { text: "✗", included: false, excluded: true };
}

function fmtJur(bool: any, valor: any): { text: string; included: boolean; excluded: boolean } {
  if (valor && parseFloat(String(valor)) > 0) {
    return { text: fmtPeso(valor), included: true, excluded: false };
  }
  return fmtBool(bool);
}

// ── Definición de secciones (igual que comparativo.py) ────────────────────

type CellResult = { text: string; included?: boolean; excluded?: boolean };
type FilaDef = { label: string; render: (cob: any) => CellResult };
type SeccionDef = { titulo: string; filas: FilaDef[] };

const SECCIONES: SeccionDef[] = [
  {
    titulo: "RESPONSABILIDAD CIVIL EXTRACONTRACTUAL",
    filas: [
      {
        label: "Límite máximo",
        render: (cob) => ({ text: cob.rce_limite ? fmtPeso(cob.rce_limite) : "—" }),
      },
      {
        label: "Deducible",
        render: (cob) => ({
          text: cob.rce_deducible_smmlv !== null && cob.rce_deducible_smmlv !== undefined
            ? (cob.rce_deducible_smmlv === 0 ? "Sin deducible" : `${cob.rce_deducible_smmlv} SMMLV`)
            : "—",
        }),
      },
    ],
  },
  {
    titulo: "PÉRDIDA POR DAÑOS",
    filas: [
      {
        label: "Total — valor asegurado",
        render: (cob) => ({ text: cob.danio_total_valor ? fmtPeso(cob.danio_total_valor) : "—" }),
      },
      {
        label: "Total — deducible",
        render: (cob) => ({ text: fmtDed(cob.danio_total_ded_pct, cob.danio_total_ded_smmlv) }),
      },
      {
        label: "Parcial — deducible",
        render: (cob) => ({ text: fmtDed(cob.danio_parcial_ded_pct, cob.danio_parcial_ded_smmlv) }),
      },
    ],
  },
  {
    titulo: "PÉRDIDA POR HURTO",
    filas: [
      {
        label: "Total — deducible",
        render: (cob) => ({ text: fmtDed(cob.hurto_total_ded_pct, cob.hurto_total_ded_smmlv) }),
      },
      {
        label: "Parcial — deducible",
        render: (cob) => ({ text: fmtDed(cob.hurto_parcial_ded_pct, cob.hurto_parcial_ded_smmlv) }),
      },
    ],
  },
  {
    titulo: "COBERTURAS Y ASISTENCIAS ADICIONALES",
    filas: [
      {
        label: "Terremoto / eventos naturales",
        render: (cob) => fmtBool(cob.terremoto),
      },
      {
        label: "Protección patrimonial",
        render: (cob) => fmtBool(cob.proteccion_patrimonial),
      },
      {
        label: "Asistencia jurídica penal",
        render: (cob) => fmtJur(cob.asistencia_juridica_penal, cob.asistencia_juridica_penal_valor),
      },
      {
        label: "Asistencia jurídica civil",
        render: (cob) => fmtJur(cob.asistencia_juridica_civil, cob.asistencia_juridica_civil_valor),
      },
      {
        label: "Lucro cesante",
        render: (cob) => fmtBool(cob.lucro_cesante),
      },
      {
        label: "Accidentes personales conductor",
        render: (cob) => ({
          text: cob.accidentes_personales_conductor
            ? fmtPeso(cob.accidentes_personales_conductor)
            : "—",
        }),
      },
      {
        label: "Asistencia en viaje",
        render: (cob) => fmtBool(cob.asistencia_en_viaje),
      },
    ],
  },
];

// ── Componente principal ───────────────────────────────────────────────────

export function CotizacionComparativo({
  cotizaciones,
  comparativoIA,
  accionIA,
  asegRenovacion,
  diferenciaPrima,
  esNuevo,
  onGenerarCorreo,
}: CotizacionComparativoProps) {
  const [copied, setCopied] = useState(false);

  if (!cotizaciones || cotizaciones.length === 0) {
    return <div className="text-slate-400 text-sm italic">No hay cotizaciones para comparar.</div>;
  }

  const recomendada = (comparativoIA?.aseguradora_recomendada || "").toUpperCase();
  const ordenadas = ordenarCotizaciones(cotizaciones);

  // ── Banner ──
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

  // ── Price min/max ──
  const primas = ordenadas.map(c => numPrima(c));
  const validPrimas = primas.filter(p => p > 0);
  const minPrima = validPrimas.length > 1 ? Math.min(...validPrimas) : -1;
  const maxPrima = validPrimas.length > 1 ? Math.max(...validPrimas) : -1;

  const numCols = ordenadas.length + 1;

  // ── Table style helpers ──
  const cellBorder = `1px solid ${C_GRID}`;

  const sectionHdrStyle: React.CSSProperties = {
    background: C_SUBHDR,
    color: "white",
    fontFamily: "var(--font-jetbrains-mono)",
    fontSize: "0.68rem",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    padding: "5px 12px",
    border: cellBorder,
  };

  const leftColBase: React.CSSProperties = {
    fontFamily: "var(--font-inter)",
    fontSize: "0.78rem",
    fontWeight: 500,
    color: "#1a3a5c",
    padding: "6px 12px",
    border: cellBorder,
    position: "sticky",
    left: 0,
    zIndex: 10,
    minWidth: "240px",
    maxWidth: "240px",
  };

  const dataCellBase: React.CSSProperties = {
    fontFamily: "var(--font-jetbrains-mono)",
    fontSize: "0.8rem",
    textAlign: "center",
    padding: "6px 12px",
    border: cellBorder,
    minWidth: "150px",
  };

  return (
    <div className="space-y-5">

      {/* ── AI Banner ── */}
      <div
        className="relative rounded-2xl p-5 overflow-hidden"
        style={{ ...banner.bgStyle, border: `1px solid ${banner.borderColor}` }}
      >
        <div
          className="absolute top-0 left-[15%] right-[15%] h-px pointer-events-none"
          style={{ background: `linear-gradient(90deg, transparent, ${banner.accentColor}, transparent)`, opacity: 0.6 }}
        />
        <div className="flex flex-col md:flex-row gap-5 items-start">
          <div className="flex items-start gap-3 flex-1">
            <span className="text-2xl shrink-0">{banner.icon}</span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1.5" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                <Sparkles className="h-3 w-3" style={{ color: banner.accentColor }} />
                IA Roesan recomienda
              </p>
              <p className="text-lg font-bold text-slate-800 leading-tight" style={{ fontFamily: "var(--font-outfit)" }}>
                {banner.titulo}
              </p>
              <p className="text-sm text-slate-500 mt-0.5 font-light">{banner.detalle}</p>
            </div>
          </div>
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

      {/* ── Excel table ── */}
      <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: `1.5px solid ${C_HEADER}` }}>
        <div className="overflow-x-auto">
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={{
                  ...leftColBase,
                  background: "#0f2744",
                  color: "white",
                  fontFamily: "var(--font-jetbrains-mono)",
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}>
                  Concepto
                </th>
                {ordenadas.map((c, i) => {
                  const prima = primas[i];
                  const esMejor = prima === minPrima && prima > 0;
                  const esPeor  = prima === maxPrima && prima > 0 && minPrima !== maxPrima;
                  const esRecom = (c.aseguradora || "").toUpperCase() === recomendada;
                  const esRenov = c.es_renovacion;
                  return (
                    <th key={i} style={{
                      ...dataCellBase,
                      background: C_HEADER,
                      color: "white",
                      fontFamily: "var(--font-outfit)",
                      fontWeight: 700,
                      fontSize: "0.82rem",
                      padding: "8px 12px",
                      verticalAlign: "middle",
                    }}>
                      <div>{(c.aseguradora || "—").toUpperCase()}</div>
                      {(c.nombre_plan || c.cobertura) && (
                        <div style={{ fontSize: "0.62rem", fontWeight: 400, opacity: 0.6, fontFamily: "var(--font-inter)", marginTop: "2px" }}>
                          {c.nombre_plan || c.cobertura}
                        </div>
                      )}
                      <div style={{ marginTop: "5px", display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                        {esMejor && (
                          <span style={{ background: C_BEST, color: "#1b5e20", fontSize: "0.58rem", padding: "1px 7px", borderRadius: "4px", fontWeight: 700, letterSpacing: "0.06em" }}>
                            MEJOR PRECIO
                          </span>
                        )}
                        {esPeor && (
                          <span style={{ background: C_WORST, color: "#b71c1c", fontSize: "0.58rem", padding: "1px 7px", borderRadius: "4px", fontWeight: 700, letterSpacing: "0.06em" }}>
                            MAYOR PRECIO
                          </span>
                        )}
                        {esRenov && (
                          <span style={{ background: "rgba(59,130,246,0.35)", color: "#bfdbfe", fontSize: "0.58rem", padding: "1px 7px", borderRadius: "4px", fontWeight: 600 }}>
                            🔄 VIGENTE
                          </span>
                        )}
                        {esRecom && !esRenov && !esMejor && (
                          <span style={{ background: "rgba(245,158,11,0.35)", color: "#fde68a", fontSize: "0.58rem", padding: "1px 7px", borderRadius: "4px", fontWeight: 600 }}>
                            ⭐ RECOMENDADA
                          </span>
                        )}
                        {esRecom && esRenov && (
                          <span style={{ background: "rgba(16,185,129,0.35)", color: "#a7f3d0", fontSize: "0.58rem", padding: "1px 7px", borderRadius: "4px", fontWeight: 600 }}>
                            ✅ RENOVAR
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {/* ── PRECIO ── */}
              <tr>
                <td style={{ ...sectionHdrStyle, position: "sticky", left: 0, zIndex: 10, minWidth: "240px", maxWidth: "240px" }}>PRECIO TOTAL (IVA incluido)</td>
                <td colSpan={numCols - 1} style={sectionHdrStyle} />
              </tr>
              <tr>
                <td style={{ ...leftColBase, background: C_LBGD, fontWeight: 700 }}>Total a pagar</td>
                {ordenadas.map((c, i) => {
                  const prima = primas[i];
                  const esMejor = prima === minPrima && prima > 0;
                  const esPeor  = prima === maxPrima && prima > 0 && minPrima !== maxPrima;
                  return (
                    <td key={i} style={{
                      ...dataCellBase,
                      background: esMejor ? C_BEST : esPeor ? C_WORST : "white",
                      fontWeight: 700,
                      color: esMejor ? "#1b5e20" : esPeor ? "#b71c1c" : "#1a3a5c",
                      fontSize: "0.85rem",
                    }}>
                      {fmtPeso(c.prima_total)}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td style={{ ...leftColBase, background: C_LBGD_ODD }}>Prima neta</td>
                {ordenadas.map((c, i) => (
                  <td key={i} style={{ ...dataCellBase, background: C_ROW_ODD, color: "#1a3a5c" }}>
                    {fmtPeso(c.prima_neta)}
                  </td>
                ))}
              </tr>
              <tr>
                <td style={{ ...leftColBase, background: C_LBGD }}>Valor asegurado vehículo</td>
                {ordenadas.map((c, i) => (
                  <td key={i} style={{ ...dataCellBase, color: "#1a3a5c" }}>
                    {fmtPeso(c.valor_asegurado)}
                  </td>
                ))}
              </tr>

              {/* ── Secciones de cobertura ── */}
              {SECCIONES.map((seccion, si) => (
                <React.Fragment key={si}>
                  <tr>
                    <td style={{ ...sectionHdrStyle, position: "sticky", left: 0, zIndex: 10, minWidth: "240px", maxWidth: "240px" }}>{seccion.titulo}</td>
                    <td colSpan={numCols - 1} style={sectionHdrStyle} />
                  </tr>
                  {seccion.filas.map((fila, fi) => {
                    const isOdd = fi % 2 === 1;
                    return (
                      <tr key={fi}>
                        <td style={{ ...leftColBase, background: isOdd ? C_LBGD_ODD : C_LBGD }}>
                          {fila.label}
                        </td>
                        {ordenadas.map((c, i) => {
                          const cob = getCob(c);
                          const cell = fila.render(cob);
                          return (
                            <td key={i} style={{
                              ...dataCellBase,
                              background: isOdd ? C_ROW_ODD : "white",
                              color: cell.included ? "#1b5e20"
                                   : cell.excluded ? "#b71c1c"
                                   : "#475569",
                              fontWeight: (cell.included || cell.excluded) ? 700 : 400,
                            }}>
                              {cell.text}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Generar correo ── */}
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
    </div>
  );
}

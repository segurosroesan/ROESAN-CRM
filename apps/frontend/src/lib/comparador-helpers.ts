/**
 * comparador-helpers.ts — Utilidades compartidas para formateo, validación, etc.
 */

/** Formatea un número como peso colombiano: $ 1.288.331 */
export function fmtPeso(valor: any): string {
  if (valor === null || valor === undefined || valor === "" || valor === 0) return "—";
  try {
    const num = parseFloat(String(valor).replace(/\./g, "").replace(",", "."));
    if (isNaN(num) || num === 0) return String(valor);
    return "$ " + Math.round(num).toLocaleString("es-CO");
  } catch {
    return String(valor);
  }
}

/** Extrae el valor numérico de prima para ordenamiento */
export function numPrima(c: any): number {
  try {
    const val = c?.prima_total || 0;
    return parseFloat(String(val).replace(/\./g, "").replace(",", ".")) || Infinity;
  } catch {
    return Infinity;
  }
}

/** Convierte un valor a número entero limpio */
export function aNumero(val: any): number {
  if (val === null || val === undefined) return 0;
  try {
    const s = String(val).replace(/\$/g, "").replace(/\./g, "").replace(/,/g, "").trim();
    return parseInt(parseFloat(s).toString()) || 0;
  } catch {
    return 0;
  }
}

/** Determina si un archivo es la póliza de renovación por su nombre */
export function esRenovacion(nombreArchivo: string): boolean {
  const upper = (nombreArchivo || "").toUpperCase();
  const palabras = ["RENOVACION", "RENOVACIÓN", "RECIBO", "POLIZA VIGENTE", "POLIZA ACTUAL"];
  return palabras.some((p) => upper.includes(p));
}

/** Abreviación de cobertura para mostrar en tags */
export function abreviarCobertura(nombre: string): string {
  if (!nombre) return "";
  const mapa: Record<string, string> = {
    "responsabilidad civil extracontractual": "Resp. Civil",
    "pérdida total por daños": "P. Total Daños",
    "pérdida parcial por daños": "P. Parcial Daños",
    "pérdida total por hurto": "P. Total Hurto",
    "pérdida parcial por hurto": "P. Parcial Hurto",
    "terremoto y eventos de la naturaleza": "Terremoto",
    "amparo patrimonial": "A. Patrimonial",
    "asistencia jurídica": "A. Jurídica",
    "asistencia en viaje": "A. Viaje",
    "accidentes personales": "Acc. Personales",
    "gastos de transporte": "G. Transporte",
    "vehículo sustituto": "V. Sustituto",
    "cobertura de vidrios": "Vidrios",
    "trámite de tránsito": "Trámite Tránsito",
    "responsabilidad civil familiar": "RC Familiar",
    "exequias": "Exequias",
    "asistencia odontológica": "A. Odontológica",
  };
  const lower = nombre.toLowerCase();
  for (const [k, v] of Object.entries(mapa)) {
    if (lower.includes(k)) return v;
  }
  return nombre.length > 22 ? nombre.substring(0, 22) + "…" : nombre;
}

/** Ordena cotizaciones: renovación primero, luego por menor prima */
export function ordenarCotizaciones(cotizaciones: any[]): any[] {
  if (!cotizaciones) return [];
  const renovaciones = cotizaciones.filter((c) => c.es_renovacion);
  const resto = cotizaciones
    .filter((c) => !c.es_renovacion)
    .sort((a, b) => numPrima(a) - numPrima(b));
  return [...renovaciones, ...resto];
}

/** Lista de aseguradoras válidas en Colombia */
export const ASEGURADORAS_VALIDAS = [
  "Bolívar", "AXA", "Allianz", "Seguros del Estado", "HDI",
  "MAPFRE", "Qualitas", "SURA", "SBS", "La Previsora",
];

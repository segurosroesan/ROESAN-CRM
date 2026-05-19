/**
 * email-generator.ts — Genera el correo para el cliente
 * NUEVO COPY: corto, amable, rápido de leer.
 * Solo muestra la columna de la póliza ganadora en el cuerpo.
 * El Excel completo se adjunta por separado.
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

/** Links PSE por aseguradora */
export const LINKS_PSE: Record<string, string> = {
  HDI: "https://portal.cliente.hdiseguros.com.co/",
  ALLIANZ: "https://www.allianz.com.co/pse",
  AXA: "https://www.axacolsanitas.com.co/pse",
  MAPFRE: "https://www.mapfre.com.co/pse",
  SURA: "https://www.sura.com/pse",
  QUALITAS: "https://www.qualitas.com.co/pse",
  "BOLIVAR": "https://www.segurosbolivar.com/pse",
  "BOLÍVAR": "https://www.segurosbolivar.com/pse",
  SBS: "https://www.sbs.com.co/pse",
};

export interface GenerarCorreoParams {
  cotizacionSeleccionada: any;
  todasCotizaciones: any[];
  aseguradoraRecomendada: string;
  justificacionIA?: string;
  datosExtra?: any;
  accionIA?: string;
  aseguradoraRenovacion?: string;
  diferenciaPrima?: number;
  esNuevo?: boolean;
  enlacePropuesta?: string;
}

/** Genera el asunto del correo al cliente. */
export function generarAsunto(params: GenerarCorreoParams): string {
  const { cotizacionSeleccionada, datosExtra = {}, esNuevo = false } = params;
  const cot = cotizacionSeleccionada;
  const tomador = (cot?.tomador || datosExtra?.tomador || "").toUpperCase();
  const placa = (cot?.placa || datosExtra?.placa || "").toUpperCase();
  const primerNombre = tomador.split(" ")[0] || "";
  if (esNuevo) {
    return `PROPUESTA POLIZA TODO RIESGO ${placa} ${primerNombre}`.trim();
  } else {
    return `CONDICIONES DE RENOVACION POLIZA TODO RIESGO ${placa} ${primerNombre}`.trim();
  }
}

/**
 * Genera el texto del correo al cliente.
 */
export function generarCorreo(params: GenerarCorreoParams): string {
  const {
    cotizacionSeleccionada,
    datosExtra = {},
    accionIA = "",
    aseguradoraRenovacion = "",
    esNuevo = false,
    enlacePropuesta = ""
  } = params;

  const cot = cotizacionSeleccionada;
  const tomador = cot?.tomador || datosExtra?.tomador || "[NOMBRE CLIENTE]";
  const placa = cot?.placa || datosExtra?.placa || "[PLACA]";
  const descripcion = cot?.descripcion_vehiculo || datosExtra?.descripcion_vehiculo || "[VEHÍCULO]";
  const aseguradora = (cot?.aseguradora || "Aseguradora").toUpperCase();
  const primaTotal = fmtPeso(cot?.prima_total);

  const lineas: string[] = [];


  // ── Cuerpo ──
  const nombreCorto = tomador.split(" ")[0];
  const nombreTrato = nombreCorto.charAt(0).toUpperCase() + nombreCorto.slice(1).toLowerCase();

  lineas.push(`Buenas tardes ${nombreTrato},`);
  lineas.push("");

  const esMismaAseguradora = aseguradora.toUpperCase() === (aseguradoraRenovacion || "").toUpperCase();

  if (esNuevo) {
    lineas.push(`Le comparto la propuesta de seguro TODO RIESGO para su **${descripcion}** placa **${placa.toUpperCase()}**.`);
    lineas.push("");
    lineas.push(`Nuestra recomendación es **${aseguradora}** con una prima anual de **${primaTotal}**, que ofrece la mejor relación precio-cobertura del mercado.`);
  } else if (accionIA === "CAMBIAR" && aseguradoraRenovacion && !esMismaAseguradora) {
    lineas.push(`Su póliza de **${descripcion}** placa **${placa.toUpperCase()}** está próxima a vencer y le tenemos una buena noticia.`);
    lineas.push("");
    lineas.push(`Cotizamos con varias aseguradoras y encontramos que **${aseguradora}** le ofrece mejor precio: **${primaTotal}** anuales — por debajo de lo que paga hoy con ${aseguradoraRenovacion.toUpperCase()}.`);
    lineas.push("");
    lineas.push(`Si prefiere quedarse con ${aseguradoraRenovacion.toUpperCase()}, con solo confirmarnos gestionamos la renovación.`);
  } else if (aseguradoraRenovacion) {
    lineas.push(`Su póliza de **${descripcion}** placa **${placa.toUpperCase()}** está próxima a vencer.`);
    lineas.push("");
    lineas.push(`Revisamos el mercado y **${aseguradora}** sigue siendo la mejor opción para usted — prima anual de **${primaTotal}** con excelentes coberturas.`);
    lineas.push("");
    lineas.push(`Con solo confirmarnos por este medio, gestionamos la renovación.`);
  } else {
    lineas.push(`Le comparto la propuesta de seguro TODO RIESGO para su **${descripcion}** placa **${placa.toUpperCase()}**.`);
    lineas.push("");
    lineas.push(`Nuestra recomendación es **${aseguradora}** con una prima anual de **${primaTotal}**.`);
  }
  lineas.push("");

  if (enlacePropuesta) {
    lineas.push(`Hemos preparado una propuesta interactiva para que pueda revisar los detalles, comparar las demás opciones y descargar el resumen. Por favor haga clic en el siguiente enlace:`);
    lineas.push("");
    lineas.push(`${enlacePropuesta}`);
    lineas.push("");
  }

  // ── Link PSE ──
  let linkPSE = null;
  for (const [nombre, url] of Object.entries(LINKS_PSE)) {
    if (aseguradora.includes(nombre)) {
      linkPSE = url;
      break;
    }
  }
  if (linkPSE) {
    lineas.push(`Si desea puede realizar pago PSE en este link:`);
    lineas.push(linkPSE);
    lineas.push("");
  }

  if (accionIA === "CAMBIAR" && aseguradoraRenovacion && !esMismaAseguradora) {
    lineas.push(`Para hacer el cambio necesitamos:`);
    lineas.push(`  → Formato adjunto diligenciado`);
    lineas.push(`  → Copia cédula y tarjeta de propiedad`);
    lineas.push(`  → Inspección del vehículo (coordinamos nosotros)`);
    lineas.push("");
  }

  lineas.push("Cualquier duda, con gusto la atendemos.");
  lineas.push("");

  return lineas.join("\n");
}


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
}

/**
 * Genera el texto del correo al cliente.
 */
export function generarCorreo(params: GenerarCorreoParams): string {
  const {
    cotizacionSeleccionada,
    todasCotizaciones,
    justificacionIA,
    datosExtra = {},
    accionIA = "",
    aseguradoraRenovacion = "",
    esNuevo = false,
  } = params;

  const cot = cotizacionSeleccionada;
  const tomador = cot?.tomador || datosExtra?.tomador || "[NOMBRE CLIENTE]";
  const placa = cot?.placa || datosExtra?.placa || "[PLACA]";
  const descripcion = cot?.descripcion_vehiculo || datosExtra?.descripcion_vehiculo || "[VEHÍCULO]";
  const aseguradora = (cot?.aseguradora || "Aseguradora").toUpperCase();
  const primaTotal = fmtPeso(cot?.prima_total);

  const lineas: string[] = [];

  // ── Encabezado ──
  lineas.push(`De: Autos Roesan <autos@roesan.com.co>`);
  lineas.push(`Para: [CORREO CLIENTE]`);
  lineas.push(`CC: comercial@roesan.com.co; tecnico@roesan.com.co`);

  if (esNuevo) {
    lineas.push(`Asunto: PROPUESTA POLIZA TODO RIESGO ${placa} ${tomador.toUpperCase()}`);
  } else {
    lineas.push(`Asunto: CONDICIONES DE RENOVACION POLIZA TODO RIESGO ${placa} ${tomador.toUpperCase()}`);
  }

  lineas.push("");

  // ── Cuerpo ──
  const nombreCorto = tomador.split(" ")[0];
  const nombreTrato = nombreCorto.charAt(0).toUpperCase() + nombreCorto.slice(1).toLowerCase();

  lineas.push(`Buenas tardes ${nombreTrato},`);
  lineas.push("");

  if (esNuevo) {
    lineas.push(
      `Le comparto la propuesta de seguro TODO RIESGO para su ${descripcion} placa ${placa.toUpperCase()}.`
    );
    lineas.push("");
    lineas.push(
      `Nuestra recomendación es ${aseguradora} con una prima anual de ${primaTotal}, que ofrece la mejor relación precio-cobertura del mercado.`
    );
  } else if (accionIA === "CAMBIAR" && aseguradoraRenovacion) {
    lineas.push(
      `Su póliza de ${descripcion} placa ${placa.toUpperCase()} está próxima a vencer y le tenemos una buena noticia.`
    );
    lineas.push("");
    lineas.push(
      `Cotizamos con varias aseguradoras y encontramos que ${aseguradora} le ofrece mejor precio: ${primaTotal} anuales — por debajo de lo que paga hoy con ${aseguradoraRenovacion.toUpperCase()}.`
    );
    lineas.push("");
    lineas.push(`Para hacer el cambio necesitamos:`);
    lineas.push(`  → Formato adjunto diligenciado`);
    lineas.push(`  → Copia cédula y tarjeta de propiedad`);
    lineas.push(`  → Inspección del vehículo (coordinamos nosotros)`);
    lineas.push("");
    lineas.push(`Si prefiere quedarse con ${aseguradoraRenovacion.toUpperCase()}, con solo confirmarnos gestionamos la renovación.`);
  } else if (accionIA === "RENOVAR" && aseguradoraRenovacion) {
    lineas.push(
      `Su póliza de ${descripcion} placa ${placa.toUpperCase()} está próxima a vencer.`
    );
    lineas.push("");
    lineas.push(
      `Revisamos el mercado y ${aseguradora} sigue siendo la mejor opción para usted — prima anual de ${primaTotal} con excelentes coberturas.`
    );
    lineas.push("");
    lineas.push(`Con solo confirmarnos por este medio, gestionamos la renovación.`);
  } else {
    lineas.push(
      `Le comparto la propuesta de seguro TODO RIESGO para su ${descripcion} placa ${placa.toUpperCase()}.`
    );
    lineas.push("");
    lineas.push(
      `Nuestra recomendación es ${aseguradora} con una prima anual de ${primaTotal}.`
    );
  }
  lineas.push("");

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

  // ── Detalle SOLO de la póliza ganadora ──
  lineas.push("─".repeat(60));
  lineas.push(`PROPUESTA ${aseguradora}`);
  lineas.push("─".repeat(60));
  lineas.push("");

  // Datos básicos
  lineas.push(`  Valor asegurado:       ${fmtPeso(cot?.valor_asegurado)}`);
  lineas.push("");

  // Coberturas principales
  const coberturas = cot?.coberturas || [];
  if (coberturas.length > 0) {
    lineas.push("  COBERTURAS:");
    for (const cob of coberturas) {
      const nombre = cob?.nombre || "";
      const valor = cob?.valor || "INCLUIDA";
      let valorFmt;
      try {
        const num = parseFloat(String(valor).replace(/\./g, "").replace(",", "."));
        valorFmt = isNaN(num) ? valor : fmtPeso(valor);
      } catch {
        valorFmt = valor;
      }
      lineas.push(`  • ${nombre.padEnd(45)} ${valorFmt}`);
    }
    lineas.push("");
  }

  // Deducibles
  const deducibles = cot?.deducibles || [];
  if (deducibles.length > 0) {
    lineas.push("  DEDUCIBLES:");
    for (const ded of deducibles) {
      lineas.push(`  • ${(ded?.cobertura || "").padEnd(45)} ${ded?.deducible || ""}`);
    }
    lineas.push("");
  }

  // Prima desglosada
  lineas.push("  PRIMA:");
  lineas.push(`  • Prima sin IVA:       ${fmtPeso(cot?.prima_neta)}`);
  if (cot?.valor_asistencia > 0) {
    lineas.push(`  • Valor Asistencia:    ${fmtPeso(cot?.valor_asistencia)}`);
  }
  lineas.push(`  • Gastos expedición:   ${fmtPeso(cot?.gastos_expedicion)}`);
  lineas.push(`  • IVA (Prima):         ${fmtPeso(cot?.iva)}`);
  if (cot?.iva_asistencia > 0) {
    lineas.push(`  • IVA (Asistencia):    ${fmtPeso(cot?.iva_asistencia)}`);
  }
  lineas.push(`  • PRIMA TOTAL ANUAL:   ${primaTotal}`);
  lineas.push("");

  // ── Nota adjunto ──
  lineas.push("");
  lineas.push("Adjunto el comparativo completo con todas las opciones para que tenga el panorama claro.");
  lineas.push("");
  lineas.push("RESUMEN DE OPCIONES:");
  lineas.push("");

  // Ordenar: renovación primero, luego de menor a mayor
  const renovaciones = todasCotizaciones.filter((c) => !c.error && c.es_renovacion);
  const resto = todasCotizaciones
    .filter((c) => !c.error && !c.es_renovacion)
    .sort((a, b) => {
      const pa = parseFloat(String(a.prima_total || 0).replace(/\./g, "").replace(",", ".")) || Infinity;
      const pb = parseFloat(String(b.prima_total || 0).replace(/\./g, "").replace(",", ".")) || Infinity;
      return pa - pb;
    });

  const ordenadas = [...renovaciones, ...resto];
  for (const c of ordenadas) {
    const nombre = (c.aseguradora || "Desconocida").toUpperCase();
    const esRenov = c.es_renovacion;
    const esSel = c === cotizacionSeleccionada;
    const etiqueta = esRenov ? `RENOVACIÓN ${nombre}` : nombre;
    const marca = esSel ? " ← OPCIÓN RECOMENDADA" : esRenov ? " (PÓLIZA ACTUAL)" : "";
    lineas.push(`  • ${etiqueta.padEnd(30)} ${fmtPeso(c.prima_total).padStart(15)}${marca}`);
  }
  lineas.push("");
  lineas.push("Cualquier duda, con gusto la atendemos.");
  lineas.push("");

  return lineas.join("\n");
}

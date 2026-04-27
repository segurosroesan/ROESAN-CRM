import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

const COMPARACION_PROMPT = `\
Eres Adriana, una ejecutiva de seguros de autos con amplia experiencia en ROESAN, Colombia.

Se te presentan varias cotizaciones de seguros de automóvil para el mismo vehículo.
{contexto_renovacion}

Las cotizaciones son:

{cotizaciones_json}

Tu tarea:
1. {tarea_renovacion}
2. Analiza todas las cotizaciones.
3. REGLA PRINCIPAL — EL PRECIO ES LO MÁS IMPORTANTE:
   - Ordena TODAS las cotizaciones de menor a mayor prima_total.
   - La recomendada SIEMPRE debe ser la de MENOR PRIMA TOTAL.
   - Solo si dos opciones tienen prima muy similar (diferencia menor al 5%), puedes considerar coberturas para desempatar.
   - NUNCA recomiendes una opción más cara si existe otra más barata con coberturas similares.
4. Decide la acción:
   {opciones_accion}
5. Redacta la justificación en 2-3 oraciones en español colombiano (tono profesional y cálido de Adriana).

ADVERTENCIA: Adriana y el cliente NUNCA quieren pagar más de lo necesario.

Responde ÚNICAMENTE con este JSON:
{
  "accion": "{acciones_validas}",
  "aseguradora_recomendada": "nombre exacto de la aseguradora recomendada (la de menor prima total)",
  "aseguradora_renovacion": "{valor_renovacion}",
  "justificacion_corta": "texto corto para el correo",
  "diferencia_prima": 0,
  "ranking": [
    {"aseguradora": "...", "prima_total": 0, "posicion": 1, "es_renovacion": false}
  ]
}
`;

function toInt(val: any): number {
  if (val === null || val === undefined) return 0;
  try {
    const s = String(val).replace(/\$/g, "").replace(/\./g, "").replace(/,/g, "").trim();
    return parseInt(parseFloat(s).toString()) || 0;
  } catch {
    return 0;
  }
}

@Injectable()
export class ComparadorService {
  private readonly logger = new Logger(ComparadorService.name);
  private genAI: GoogleGenAI | null = null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY is not defined. Comparison AI will fail.');
    } else {
      this.genAI = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1' } });
    }
  }

  async compararCotizaciones(cotizaciones: any[]): Promise<any> {
    if (!cotizaciones || cotizaciones.length === 0) {
      throw new Error("No hay cotizaciones para comparar");
    }

    if (!this.genAI) {
      throw new Error("GEMINI_API_KEY no configurada");
    }

    // Determinar si hay renovación
    const tieneRenovacion = cotizaciones.some((c) => c.es_renovacion);

    // Preparar resumen para el prompt
    const resumen = cotizaciones
      .filter((c) => !c.error)
      .map((c) => ({
        aseguradora: c.aseguradora,
        nombre_plan: c.nombre_plan || "",
        es_renovacion: c.es_renovacion || false,
        prima_neta: c.prima_neta,
        prima_total: c.prima_total,
        iva: c.iva,
        gastos_expedicion: c.gastos_expedicion,
        valor_asegurado: c.valor_asegurado,
        coberturas: c.coberturas || [],
        deducibles: c.deducibles || [],
      }));

    if (resumen.length === 0) {
      throw new Error("No hay cotizaciones válidas para comparar");
    }

    // Adaptar prompt según escenario
    let prompt;
    if (tieneRenovacion) {
      prompt = COMPARACION_PROMPT
        .replace("{contexto_renovacion}", 'Una de ellas está marcada como "es_renovacion: true" — esa es la PÓLIZA VIGENTE.')
        .replace("{tarea_renovacion}", "Identifica la póliza de renovación (es_renovacion: true). Esa es la línea base.")
        .replace("{opciones_accion}", '- "RENOVAR" si la póliza vigente tiene prima baja o similar (diferencia < 5%).\n   - "CAMBIAR" si hay una cotización con prima significativamente más baja.')
        .replace("{acciones_validas}", "RENOVAR o CAMBIAR")
        .replace("{valor_renovacion}", "nombre de la aseguradora de renovación");
    } else {
      prompt = COMPARACION_PROMPT
        .replace("{contexto_renovacion}", "Es un CLIENTE NUEVO sin póliza vigente. No hay renovación.")
        .replace("{tarea_renovacion}", "Este es un caso nuevo. No hay póliza vigente de referencia.")
        .replace("{opciones_accion}", '- Siempre usar "MEJOR_OPCION" como acción para clientes nuevos.')
        .replace("{acciones_validas}", "MEJOR_OPCION")
        .replace("{valor_renovacion}", "");
    }

    prompt = prompt.replace("{cotizaciones_json}", JSON.stringify(resumen, null, 2));

    this.logger.log(`Solicitando comparacion a Gemini Flash (${resumen.length} cotizaciones)`);

    // Llamar a Gemini
    const result = await this.genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });
    const rawText = result.text ?? "";
    let resultado: any;

    try {
      resultado = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        resultado = JSON.parse(match[0]);
      } else {
        throw new Error("No se pudo parsear la respuesta de comparación IA");
      }
    }

    // ── OVERRIDE DETERMINÍSTICO POR PRECIO ──
    const validas = resumen.filter((c) => toInt(c.prima_total) > 0);
    const renovacion = validas.find((c) => c.es_renovacion) || null;

    if (validas.length > 0) {
      const ordenadas = [...validas].sort((a, b) => toInt(a.prima_total) - toInt(b.prima_total));
      const masBarata = ordenadas[0];
      const recomAI = (resultado.aseguradora_recomendada || "").toUpperCase();
      const recomActual = validas.find((c) => (c.aseguradora || "").toUpperCase() === recomAI);

      if (recomActual && masBarata) {
        const precioRecom = toInt(recomActual.prima_total);
        const precioBarata = toInt(masBarata.prima_total);
        const margen = precioBarata > 0 ? (precioRecom - precioBarata) / precioBarata : 0;

        if (margen > 0.05) {
          this.logger.warn(
            `[OVERRIDE] IA recomendó ${recomActual.aseguradora} ($${precioRecom}) pero la más barata es ${masBarata.aseguradora} ($${precioBarata}). Corrigiendo.`
          );
          resultado.aseguradora_recomendada = masBarata.aseguradora;
          const esRenov = masBarata.es_renovacion || false;

          if (tieneRenovacion) {
            resultado.accion = esRenov ? "RENOVAR" : "CAMBIAR";
          } else {
            resultado.accion = "MEJOR_OPCION";
          }

          const diff = renovacion ? toInt(renovacion.prima_total) - precioBarata : 0;
          resultado.diferencia_prima = diff;
          resultado.justificacion_corta = `La opción más competitiva en precio es ${masBarata.aseguradora} con una prima total de $${precioBarata.toLocaleString("es-CO")}. ${esRenov ? "Recomendamos renovar con la misma compañía." : "Recomendamos esta opción por su excelente relación precio-cobertura."}`;
        }
      }
    }

    // Calcular diferencia si falta
    if (!resultado.diferencia_prima && renovacion) {
      const recomAseg = (resultado.aseguradora_recomendada || "").toUpperCase();
      const mejor = resumen.find((c) => (c.aseguradora || "").toUpperCase() === recomAseg);
      if (mejor) {
        resultado.diferencia_prima = toInt(renovacion.prima_total) - toInt(mejor.prima_total);
      }
    }

    return {
      comparativo_ia: resultado,
      accion: resultado.accion || "",
      aseguradora_renovacion: resultado.aseguradora_renovacion || "",
      diferencia_prima: resultado.diferencia_prima || 0,
    };
  }

  async parsearPdfCotizacion(buffer: Buffer, mimeType: string): Promise<any> {
    if (!this.genAI) {
      throw new Error("GEMINI_API_KEY no configurada");
    }

    const prompt = `
Eres un experto analista de seguros de autos en Colombia.
Tu tarea es extraer los datos principales de esta cotización de seguro de vehículo que te adjunto en formato PDF o imagen.
Extrae la siguiente información y devuélvela en un objeto JSON estricto:

{
  "aseguradora": "Nombre de la aseguradora (ej. AXA Colpatria, HDI, Sura, Allianz, Mapfre, Previsora, etc.)",
  "valor_asegurado": 0, // numero
  "prima_neta": 0, // numero (sin IVA)
  "prima_total": 0, // numero (con IVA y gastos, total a pagar)
  "cobertura": "Nombre del plan (ej. Auto Pesado, Genio Pesado, Todo Riesgo, etc.)",
  "placa": "La placa del vehículo (si aparece)",
  "modelo": 2024, // el año/modelo del vehículo
  "fasecolda": "Código Fasecolda (ej. 05402012, suele tener 8 dígitos)",
  "documento": "Documento de identidad del tomador (sin puntos ni comas)",
  "fecha_nacimiento": "YYYY-MM-DD",
  "sexo": "MASCULINO / FEMENINO"
}

REGLAS:
- Si no encuentras un valor, pon 0, null o string vacío.
- Los valores monetarios deben ser números enteros (sin puntos ni comas).
- Identifica correctamente a la aseguradora leyendo el logo o los encabezados.
- NO devuelvas markdown, solo el JSON puro.
`;

    this.logger.log(`Parseando PDF con Gemini Flash (size: ${buffer.length} bytes)`);

    const result = await this.genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { data: buffer.toString("base64"), mimeType } },
          ],
        },
      ],
      config: { responseMimeType: "application/json" },
    });
    const rawText = result.text ?? "";
    try {
      return JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
      throw new Error("Error parseando PDF IA");
    }
  }

  async parsearMultiplesPdfsCotizacion(files: any[]): Promise<any[]> {
    return Promise.all(
      files.map(file => this.parsearPdfCotizacion(file.buffer, file.mimetype))
    );
  }
}

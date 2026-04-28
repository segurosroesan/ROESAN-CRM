import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

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
  private genAI: GoogleGenerativeAI | null = null;
  private fileManager: GoogleAIFileManager | null = null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY is not defined. Comparison AI will fail.');
    } else {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.fileManager = new GoogleAIFileManager(apiKey);
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
    const model = this.genAI.getGenerativeModel({
      model: "gemini-flash-latest",
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent(prompt);
    const rawText = result.response.text();
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
Extrae TODOS los datos de esta cotización de seguro de vehículo y devuélvelos en un objeto JSON estricto.

{
  "aseguradora": "Nombre de la aseguradora (AXA Colpatria, HDI Seguros, Sura, Allianz, Mapfre, La Previsora, Seguros del Estado, etc.)",
  "valor_asegurado": 0,
  "prima_neta": 0,
  "prima_total": 0,
  "cobertura": "Nombre del plan (Auto Pesado, Todo Riesgo, Genio Pesado, etc.)",
  "placa": "",
  "modelo": 0,
  "fasecolda": "",
  "documento": "",
  "fecha_nacimiento": "",
  "sexo": "",

  "rce_limite": null,
  "rce_deducible_smmlv": null,

  "danio_total_valor": null,
  "danio_total_ded_pct": null,
  "danio_total_ded_smmlv": null,
  "danio_parcial_ded_pct": null,
  "danio_parcial_ded_smmlv": null,

  "hurto_total_ded_pct": null,
  "hurto_total_ded_smmlv": null,
  "hurto_parcial_ded_pct": null,
  "hurto_parcial_ded_smmlv": null,

  "terremoto": false,
  "proteccion_patrimonial": false,
  "asistencia_juridica_penal": false,
  "asistencia_juridica_penal_valor": null,
  "asistencia_juridica_civil": false,
  "asistencia_juridica_civil_valor": null,
  "lucro_cesante": false,
  "accidentes_personales_conductor": null,
  "asistencia_en_viaje": false
}

GUÍA DE EXTRACCIÓN:
- rce_limite: límite máximo de Responsabilidad Civil Extracontractual en pesos (ej. 3000000000)
- rce_deducible_smmlv: deducible RCE en SMMLV (ej. 2.0). Si dice "sin deducible" = 0
- danio_total_valor: valor asegurado para pérdida total por daños (generalmente = valor_asegurado)
- danio_total_ded_pct: porcentaje del deducible para pérdida total daños (ej. 10 para 10%)
- danio_total_ded_smmlv: mínimo del deducible en SMMLV (ej. 0 si no hay mínimo)
- danio_parcial_ded_pct: % deducible pérdida parcial daños
- danio_parcial_ded_smmlv: mínimo SMMLV pérdida parcial daños
- hurto_total_ded_pct/smmlv: igual para hurto total
- hurto_parcial_ded_pct/smmlv: igual para hurto parcial
- terremoto: true si cubre terremotos/eventos naturales/fenómenos naturales
- proteccion_patrimonial: true si cubre "amparo patrimonial" o "protección patrimonial"
- asistencia_juridica_penal/civil: true si incluye asistencia jurídica penal/civil
- asistencia_juridica_penal_valor/civil_valor: monto en pesos si lo especifica (ej. 25000000)
- lucro_cesante: true si incluye lucro cesante
- accidentes_personales_conductor: monto en pesos (ej. 50000000). null si no incluye
- asistencia_en_viaje: true si incluye asistencia en viaje/carretera
- Los valores monetarios son números enteros sin puntos ni comas
- Los SMMLV son números decimales (ej. 2.0)
- Los porcentajes son números (ej. 10 para 10%)
- NO devuelvas markdown, solo el JSON puro
`;

    this.logger.log(`Parseando PDF con Gemini Flash (size: ${buffer.length} bytes)`);

    const model = this.genAI.getGenerativeModel({
      model: "gemini-flash-latest",
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: buffer.toString("base64"), mimeType } },
    ]);
    const rawText = result.response.text();
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

  async parsearDocumentoLegal(buffer: Buffer, mimeType: string, tipoDocumento: 'CEDULA' | 'RUT' | 'SARLAFT' | 'POLIZA'): Promise<any> {
    if (!this.genAI) {
      throw new Error("GEMINI_API_KEY no configurada");
    }

    let prompt = "";

    switch (tipoDocumento) {
      case 'CEDULA':
        prompt = `
Eres un experto analista de documentos de identidad en Colombia.
Extrae los siguientes datos de esta CÉDULA DE CIUDADANÍA y devuélvelos en JSON puro.

{
  "numero_documento": "número sin puntos",
  "nombres": "nombres completos",
  "apellidos": "apellidos completos",
  "genero": "MASCULINO o FEMENINO",
  "fecha_nacimiento": "YYYY-MM-DD"
}
`;
        break;
      case 'RUT':
        prompt = `
Eres un experto analista de documentos tributarios (RUT) en Colombia.
Extrae los siguientes datos del REGISTRO ÚNICO TRIBUTARIO y devuélvelos en JSON puro.

{
  "nit": "número de identificación tributaria sin puntos ni DV",
  "razon_social": "Nombre de la empresa si es persona jurídica, null si es persona natural",
  "nombres": "nombres si es persona natural",
  "apellidos": "apellidos si es persona natural",
  "direccion": "dirección principal",
  "ciudad": "municipio/ciudad",
  "departamento": "departamento",
  "actividades_economicas": ["códigos de 4 dígitos"]
}
`;
        break;
      case 'SARLAFT':
        prompt = `
Eres un experto analista de formularios Sarlaft (prevención de lavado de activos) en seguros.
Extrae los datos más relevantes de este formulario y devuélvelos en JSON puro.

{
  "ocupacion": "ID de ocupación o nombre (ej: Empleado, Independiente)",
  "ingresos_mensuales": 0,
  "egresos_mensuales": 0,
  "activos": 0,
  "pasivos": 0,
  "empresa_donde_trabaja": "",
  "cargo": "",
  "declara_renta": false,
  "persona_publicamente_expuesta": false
}
`;
        break;
      case 'POLIZA':
        prompt = `
Eres un experto analista de pólizas de seguros en Colombia.
Extrae los datos clave de esta CARÁTULA DE PÓLIZA y devuélvelos en JSON puro.

{
  "numero_poliza": "número de la póliza",
  "aseguradora": "nombre de la aseguradora",
  "ramo": "rama del seguro en minúsculas: auto, hogar, vida, salud, soat, empresarial o cumplimiento",
  "fecha_inicio": "YYYY-MM-DD",
  "fecha_fin": "YYYY-MM-DD",
  "prima_total": 0,
  "objeto_asegurado": "descripción corta del bien: placa del vehículo, dirección del inmueble, nombre del asegurado, etc.",
  "placa": "placa del vehículo si aplica, null si no",
  "marca": "marca del vehículo si aplica",
  "linea": "línea/modelo del vehículo si aplica",
  "modelo": 0
}
`;
        break;
    }

    if (!this.fileManager) {
      throw new Error("GEMINI_API_KEY no configurada");
    }

    this.logger.log(`Parseando documento legal (${tipoDocumento}) con Gemini Files API`);

    const model = this.genAI.getGenerativeModel({
      model: "gemini-flash-latest",
      generationConfig: { responseMimeType: "application/json" },
    });

    // Escribir buffer a archivo temporal para subir via Files API (soporta hasta 2 GB)
    const tempFile = path.join(os.tmpdir(), `roesan-${tipoDocumento}-${Date.now()}.tmp`);
    fs.writeFileSync(tempFile, buffer);

    let rawText: string;
    try {
      const uploadResult = await this.fileManager.uploadFile(tempFile, {
        mimeType,
        displayName: `${tipoDocumento}-${Date.now()}`,
      });

      // Esperar a que el archivo esté listo (usualmente inmediato para PDFs/imágenes)
      let file = uploadResult.file;
      let attempts = 0;
      while (file.state === FileState.PROCESSING && attempts < 15) {
        await new Promise(res => setTimeout(res, 1000));
        file = await this.fileManager.getFile(file.name);
        attempts++;
      }

      if (file.state !== FileState.ACTIVE) {
        throw new Error(`El archivo no quedó listo en Gemini (estado: ${file.state})`);
      }

      this.logger.log(`Archivo subido al Files API: ${file.uri} (${file.sizeBytes} bytes)`);

      const result = await model.generateContent([
        prompt,
        { fileData: { fileUri: file.uri, mimeType: file.mimeType } },
      ]);
      rawText = result.response.text();
    } catch (geminiErr: any) {
      const msg = geminiErr?.message || String(geminiErr);
      this.logger.error(`Gemini rechazó el documento ${tipoDocumento}: ${msg}`);
      throw new Error(`Gemini no pudo procesar el documento: ${msg}`);
    } finally {
      // Limpiar archivo temporal siempre, incluso si hubo error
      try { fs.unlinkSync(tempFile); } catch {}
    }

    try {
      return JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        try { return JSON.parse(match[0]); } catch { /* fall through */ }
      }
      this.logger.warn(`Gemini no devolvió JSON válido para ${tipoDocumento}. Raw: ${rawText?.slice(0, 200)}`);
      throw new Error(`Gemini no devolvió JSON válido para ${tipoDocumento}`);
    }
  }

  async parsearMultiplesPdfsCotizacion(files: any[]): Promise<any[]> {
    return Promise.all(
      files.map(file => this.parsearPdfCotizacion(file.buffer, file.mimetype))
    );
  }
}

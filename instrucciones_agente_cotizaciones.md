# Instrucciones de Integración para el Agente Comparador de Cotizaciones

Este documento describe cómo el Agente de Inteligencia Artificial debe comunicarse con el CRM de ROESAN una vez que ha finalizado el análisis y la comparación de cotizaciones de seguros de autos para un cliente.

## Información General del Endpoint

El agente debe enviar una petición HTTP tipo POST al CRM con la información de la póliza cotizada más favorable para guardarla como registro histórico e impactar el embudo de ventas.

- **URL de Producción:** `https://roesan-backend.onrender.com/cotizaciones/sync`
- **Method:** `POST`
- **Headers:** 
  - `Content-Type: application/json`
  - *(Sin autenticación o bearer token requerido por el momento)*

## Payload / Estructura del Body (JSON)

El CRM espera recibir un objeto JSON con la siguiente estructura estricta. El único campo absolutamente obligatorio es el `leadId`, aunque se espera que mandes los datos financieros también.

```json
{
  "leadId": "ID_DEL_CLIENTE_ENTREGADO_POR_INSTANTDB",
  "aseguradora": "Nombre de la aseguradora elegida (Ej. Sura, Mapfre)",
  "prima": 1500000, 
  "cobertura": "Descripción del plan o cobertura (Ej. Todo riesgo Plus)",
  "deducible": "Información sobre el deducible (Ej. 10% / 1 SMLV)",
  "detalles": "Cualquier texto adicional con justificaciones del agente sobre por qué ganó esta opción",
  "pdfUrl": "https://url-publica.com/cotizacion-enviada-al-cliente.pdf"
}
```

*Nota: La prima debe ser un valor numérico, o enviarse como un string con el precio limpio.*

## ¿Qué ocurre en el CRM al enviar éxito (200/201 HTTP Response)?

1. **Almacenamiento:** El CRM guarda un nuevo registro en la tabla `cotizaciones` en la base de datos (InstantDB) incluyendo todos los detalles provistos y la fuente la etiqueta como "Agente IA".
2. **Actualización Automática:** El CRM actualiza automáticamente al cliente identificado con el `leadId` y avanza su estado en el Pipeline de ventas (Pre-venta) a **"Cotización enviada"**.
3. **Visibilidad:** El asesor humano que usa la interfaz web del CRM ya puede ver la cotización lista en la tarjeta del cliente dentro del panel.

## Ejemplo de Configuración en n8n (HTTP Request Node)

Si se está usando n8n para el agente, el nodo HTTP Request final debe quedar así:
- **Method:** `POST`
- **URL:** `https://roesan-backend.onrender.com/cotizaciones/sync`
- **Send Body:** Activado -> *JSON*

Ejemplo de mapeo con expresiones en n8n:
```json
{
  "leadId": "={{ $json.id_lead_actual }}",
  "aseguradora": "={{ $json.resultado_analisis.mejor_opcion.aseguradora }}",
  "prima": "={{ $json.resultado_analisis.mejor_opcion.precio }}",
  "cobertura": "={{ $json.resultado_analisis.mejor_opcion.tipo }}",
  "deducible": "={{ $json.resultado_analisis.mejor_opcion.deducible }}",
  "detalles": "Comparación realizada por agente IA. Opciones evaluadas...",
  "pdfUrl": "={{ $json.documento_creado_url }}"
}
```

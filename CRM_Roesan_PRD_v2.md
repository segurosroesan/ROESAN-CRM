# CRM Pre-Venta & Renovaciones — Seguros Roesan
## PRD v2.0 + Arquitectura Funcional

**Versión:** 2.0  
**Fecha:** Abril 2026  
**Propietario:** Seguros Roesan  
**Preparado por:** Empleados Digitales  
**Sistema core:** Soft Seguros (integración bidireccional vía API REST)  
**Cambios v2.0:** Integración API real de Soft Seguros, módulo de renovaciones incorporado, flujo de sincronización orquestado multi-paso, cross-selling sobre pólizas activas.

---

## 1. Resumen Ejecutivo

El CRM de Seguros Roesan es una plataforma web de gestión comercial que opera en dos modos:

1. **Modo Pre-Venta (leads):** Captura, califica y convierte leads provenientes de canales digitales (web, pauta, WhatsApp, llamadas), entregando el prospecto aprobado a Soft Seguros mediante una secuencia de llamadas API orquestadas.
2. **Modo Renovaciones:** Consume desde Soft Seguros el listado de pólizas próximas a vencer, crea automáticamente oportunidades de renovación, y gestiona el proceso comercial hasta la confirmación de renovación o emisión de nueva póliza.

Soft Seguros sigue siendo el sistema maestro de pólizas emitidas. Este CRM es el sistema maestro del proceso comercial: antes de la emisión (leads) y antes del vencimiento (renovaciones).

---

## 2. Contexto

### 2.1 Problema Actual — Renovaciones

Roesan extrae manualmente desde Soft Seguros el listado de pólizas que vencen cada mes para hacer seguimiento. Este proceso tiene tres fricciones graves:

- La extracción es manual (exportación o revisión directa en Soft), sin un pipeline visual de gestión
- No hay priorización: todas las renovaciones se tratan igual, sin score por valor de prima, probabilidad de churn o historial del cliente
- No hay automatización de contacto: el asesor debe gestionar WhatsApp, llamadas y seguimiento de forma artesanal
- No hay métricas de retención: se desconoce cuántas pólizas se renuevan, cuántas se pierden y por qué

### 2.2 Solución

El CRM consulta automáticamente la API de Soft Seguros (`GET /api/poliza/`) para importar las pólizas que vencen en un rango de fechas configurable (por defecto: próximos 60 días), las convierte en **oportunidades de renovación** dentro de un pipeline dedicado, y gestiona el proceso de contacto, oferta y confirmación con las mismas herramientas del módulo de pre-venta.

---

## 3. Arquitectura Funcional — Visión General

```
┌──────────────────────────────────────────────────────────────────┐
│                    FUENTES DE ENTRADA                            │
│                                                                  │
│  [LEADS]                          [RENOVACIONES]                 │
│  Web | Pauta | WhatsApp           Soft Seguros API               │
│  Llamadas | Referidos             GET /api/poliza/ (pólizas      │
│                                   por vencer)                    │
└──────────────┬───────────────────────────────┬───────────────────┘
               │                               │ Job diario
               ▼                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                  ORQUESTADOR CENTRAL                             │
│  Normalización · Deduplicación · Asignación · Scoring · SLA      │
└──────────────────────────────┬───────────────────────────────────┘
                               │
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
     ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
     │   PIPELINE    │  │   PIPELINE   │  │   PIPELINE   │
     │  PRE-VENTA    │  │ RENOVACIONES │  │  CROSS-SELL  │
     │  (leads)      │  │ (por vencer) │  │ (de pólizas  │
     │               │  │              │  │  activas)    │
     └──────┬────────┘  └──────┬───────┘  └──────┬───────┘
            │                  │                  │
            └──────────────────┼──────────────────┘
                               │
               ┌───────────────▼───────────────┐
               │     INTEGRACIÓN BIDIRECCIONAL  │
               │         SOFT SEGUROS           │
               │                                │
               │  → POST /api/cliente/          │
               │  → POST /api/datosextrascliente│
               │  → POST /api/poliza/           │
               │  → PUT  /api/poliza/{id}/      │
               │  ← GET  /api/poliza/           │
               │  ← GET  /api/cliente/...       │
               └────────────────────────────────┘
```

---

## 4. Módulos Funcionales

### Módulo 1 — Gestión de Leads (Pre-Venta)

Núcleo del CRM para captura y conversión de prospectos nuevos.

**Pipeline de Pre-Venta — Etapas:**

| # | Etapa | SLA | Acción automática |
|---|-------|-----|-------------------|
| 1 | Nuevo | 0–5 min | Asignación + WhatsApp bienvenida + notificación asesor |
| 2 | Contacto inmediato | 5–30 min | Alerta SLA si no hay acción |
| 3 | Contactado | — | Log de interacción registrado |
| 4 | Calificado | — | Datos mínimos completos |
| 5 | Documentos pendientes | 24 h | Solicitud de docs enviada |
| 6 | Cotización enviada | — | PDF generado y enviado |
| 7 | Seguimiento | configurable | Recordatorios automáticos |
| 8 | Ganado / Aprobado | — | Validación pre-sync activada |
| 9 | Enviando a Soft… | automático | Secuencia API en ejecución |
| 10 | Sincronizado ✓ | — | soft_cliente_id + soft_poliza_id guardados |
| 11 | Rechazado | — | Motivo requerido |
| 12 | Perdido / Inactivo | — | Motivo + retroalimentación |

**Funcionalidades clave:**
- Ficha única del lead con datos, fuente, campaña, UTM, score, asesor y línea de tiempo completa
- Vista Kanban drag-and-drop + lista filtrable + agenda del asesor
- Score visual: frío / tibio / caliente / urgente
- Campos obligatorios configurables por ramo
- Historial de cambios de etapa con duración por etapa

---

### Módulo 2 — Gestión de Renovaciones *(nuevo — incorporado en v2.0)*

Reemplaza el proceso manual de extracción de pólizas vencidas de Soft Seguros.

#### 2.1 Importación Automática desde Soft Seguros

Un job programado (cron diario, hora configurable — recomendado: 7:00 AM) ejecuta el siguiente proceso:

```
PASO 1 — Consultar pólizas por vencer
  GET /api/poliza/?order_by=id&sort_by=asc
  → Paginar hasta traer todas
  → Filtrar localmente: fecha_fin entre HOY y HOY+60 días
  → Filtrar: estado_poliza = "Vigente" (codigo_generico: "01")
  → Filtrar: renovable = true

PASO 2 — Deduplicar contra el CRM
  → Para cada póliza, verificar si ya existe una oportunidad de renovación
    en la tabla Renovacion con soft_poliza_id = id de la póliza
  → Si ya existe: actualizar datos (prima, fecha_fin) si cambiaron
  → Si no existe: crear nueva oportunidad de renovación

PASO 3 — Enriquecer con datos del cliente
  GET /api/cliente/{id_cliente}/
  → Traer teléfono, celular, email para contacto
  → Guardar en la oportunidad de renovación

PASO 4 — Calcular score de renovación
  → Asignar prioridad según días restantes y valor de prima
  → Ver tabla de scoring de renovaciones más abajo

PASO 5 — Asignar asesor
  → Mismo asesor que tiene asignado la póliza en Soft (campo vendedor)
  → Si no existe en el CRM: asignación por round-robin o al coordinador

PASO 6 — Log de importación
  → Registrar: fecha, total pólizas encontradas, nuevas creadas,
    actualizadas, ignoradas (ya gestionadas), errores
```

#### 2.2 Pipeline de Renovaciones

| # | Etapa | Días antes del vencimiento | Acción automática |
|---|-------|---------------------------|-------------------|
| 1 | Importada | 60 días | Creación silenciosa, sin contacto aún |
| 2 | Contacto previo | 45 días | WhatsApp automático: "Tu póliza vence pronto" |
| 3 | En gestión | — | Asesor inicia contacto activo |
| 4 | Cotización enviada | — | Nueva propuesta de renovación enviada |
| 5 | Negociando | — | Cliente en proceso de decisión |
| 6 | Confirmada | — | Cliente acepta renovar |
| 7 | Renovada en Soft ✓ | — | PUT /api/poliza/{id}/ ejecutado con nuevas fechas |
| 8 | No renueva | — | Motivo requerido (precio, cambio aseguradora, cancelación) |
| 9 | Perdida | — | Motivo + cliente queda en base para seguimiento futuro |

#### 2.3 Scoring de Renovaciones

| Señal | Puntos |
|-------|--------|
| Vence en menos de 15 días | +40 |
| Vence entre 16–30 días | +25 |
| Vence entre 31–45 días | +10 |
| Prima total > $2.000.000 | +20 |
| Cliente con 2+ pólizas activas | +15 |
| Historial de renovación anterior exitosa | +20 |
| Cliente sin respuesta en último contacto | -15 |
| Póliza marcada como renovable=false en Soft | -50 (excluir) |

#### 2.4 Automatizaciones de Renovación

- **D-60:** Importación silenciosa. Sin contacto al cliente.
- **D-45:** WhatsApp automático al cliente: plantilla "Tu póliza de [ramo] vence el [fecha]..."
- **D-30:** Notificación al asesor: "Tienes X renovaciones pendientes de gestionar"
- **D-15:** Alerta crítica al asesor y coordinador. Prioridad máxima.
- **D-7:** Escalación automática al coordinador si el asesor no ha registrado contacto.
- **D-0 (vencida sin gestión):** Alerta de póliza vencida sin renovar. Etapa → "Perdida" automático con flag de revisión.

#### 2.5 Confirmación de Renovación en Soft Seguros

Cuando el asesor confirma la renovación en el CRM, el sistema ejecuta:

```json
PUT /api/poliza/{soft_poliza_id}/
{
  "cliente": soft_cliente_id,
  "estado_poliza": 1,
  "numero_poliza": "mismo número o nuevo",
  "sede": 1,
  "ramo": ramo_id,
  "codio_objeto_asegurado": "placa/dirección/riesgo",
  "vendedor": vendedor_id,
  "renovable": true,
  "fecha_inicio": "YYYY-MM-DD",
  "fecha_fin": "YYYY-MM-DD (nuevo año)",
  "nombre_tomador": "...",
  "cedula_tomador": "...",
  "prima": valor_nueva_prima,
  "total": valor_total
}
```

O bien, si se emite como póliza nueva:
```json
POST /api/poliza/
{ ...mismo body con nuevas fechas y número de póliza nuevo }
```

---

### Módulo 3 — Captura Multicanal

Recibe leads de todos los puntos de contacto y los normaliza.

**Fuentes soportadas:**
- Formulario web propio (JS snippet)
- Meta Lead Ads (webhook)
- Google Ads Lead Form (webhook)
- WhatsApp Business API
- Landing pages
- Llamadas entrantes (integración call tracking: Toky, JustCall, Twilio)
- Importación CSV/XLSX
- Referidos (link con código de asesor)

**Normalización automática:**
- Teléfono → formato E.164 Colombia (+57)
- Deduplicación por teléfono y/o email
- Enriquecimiento por UTM (ramo desde campaign, ciudad desde prefijo)
- Mapeo de campos específicos por fuente

---

### Módulo 4 — Motor de Asignación y Automatización

**Reglas de asignación (configurables):**
- Por ramo (autos → asesor autos, vida → asesor vida)
- Por origen geográfico
- Round-robin por capacidad disponible
- Por horario y turno activo
- Por asesor asignado en Soft Seguros (para renovaciones)

**Automatizaciones base:**
- Mensaje de bienvenida automático por WhatsApp al entrar lead
- Notificación push/email al asesor con datos del lead
- Alertas de SLA vencido si no hay acción en X minutos
- Recordatorios de seguimiento (1/3/7 días configurables)
- Re-asignación automática si el asesor no actúa
- Secuencias de nurturing para leads fríos
- Secuencias de renovación por días antes del vencimiento

---

### Módulo 5 — Inbox Omnicanal

**Canales:**
- WhatsApp Business API (bidireccional desde la ficha)
- Email (SMTP/IMAP)
- Llamadas (registro manual o integración CTI)
- Notas internas

**Funcionalidades:**
- Historial unificado de todas las interacciones en línea de tiempo
- Plantillas por etapa, ramo y tipo de pipeline (pre-venta vs. renovación)
- Envío de cotizaciones y documentos desde el inbox
- Indicador de apertura de mensajes (fase 2)

---

### Módulo 6 — Cotización Comercial

**Funcionalidades:**
- Formulario de cotización por ramo con campos específicos
- Registro de aseguradora(s) y prima(s) cotizadas
- Comparativo multi-aseguradora en tabla
- Generación de PDF para envío al cliente
- Versionado de cotizaciones
- En renovaciones: cotización con comparativo "prima actual vs. nueva prima"

---

### Módulo 7 — Gestión Documental

**Documentos por ramo:**

| Ramo | Documentos típicos |
|------|--------------------|
| Autos | Cédula, tarjeta de propiedad, licencia, fotos vehículo, SOAT anterior |
| Vida / Salud | Cédula, declaración de salud, formulario aseguradora, beneficiarios |
| Hogar | Cédula, matrícula predial, fotos inmueble |
| SOAT | Cédula, tarjeta de propiedad |
| PYME | Cámara de comercio, RUT, cédula representante |

**Funcionalidades:**
- Carga por asesor o por link auto-carga enviado al cliente vía WhatsApp
- Estado por documento: pendiente / recibido / verificado / rechazado
- Alerta de checklist completo (gatillo para avanzar a "Aprobado")
- En renovaciones: precargar documentos existentes del cliente anterior

---

### Módulo 8 — Scoring de Leads (Pre-Venta)

**Scoring por reglas (Fase 1):**

| Señal | Puntos |
|-------|--------|
| Formulario largo (>5 campos) completado | +20 |
| Proviene de campaña de alta conversión histórica | +15 |
| Responde WhatsApp en menos de 10 min | +25 |
| Sube documentos sin ser solicitado | +30 |
| Referido por cliente existente | +20 |
| Llama directamente | +25 |
| Producto de alto valor (vida, salud, PYME) | +10 |
| Sin respuesta en 24 h | -20 |
| Lead duplicado resuelto | -10 |

**Scoring ML (Fase 2):** Modelo entrenado con histórico de conversión. Produce score 0-100 y etiqueta de intención.

---

### Módulo 9 — Cross-Selling sobre Pólizas Activas *(nuevo — v2.0)*

Gracias a que la API de Soft Seguros permite consultar todas las pólizas de un cliente (`GET /api/poliza/?id_cliente=X`), el CRM puede mostrar en la ficha de cualquier lead o cliente las pólizas que ya tiene activas, identificando oportunidades de venta cruzada.

**Ejemplo:** Un cliente tiene SOAT activo en Soft. Cuando llega como lead buscando seguro de hogar, el asesor ve en la ficha que ya es cliente y qué pólizas tiene → puede personalizar la oferta, hacer upgrade y fortalecer la relación.

**Reglas de cross-sell automático:**
- Si cliente tiene solo SOAT → sugerir Todo Riesgo Autos
- Si cliente tiene autos → sugerir vida o salud
- Si cliente tiene hogar → sugerir vida
- Si cliente tiene 2+ pólizas → score +15 y marcar como "cliente estratégico"

---

### Módulo 10 — Integración Bidireccional con Soft Seguros

#### 10.1 Autenticación

La integración usa **Token Auth** (recomendado sobre Basic Auth para seguridad):

```
POST https://app.softseguros.com/api-token-auth/
Body: { "username": "...", "password": "..." }
Respuesta: { "token": "83315d67..." }

Uso en cada request:
Header: Authorization: Token 83315d67...
```

El token se obtiene al iniciar el servidor y se renueva según la política de expiración de Soft Seguros. Las credenciales se almacenan en variables de entorno cifradas, nunca en código.

#### 10.2 Flujo de Sincronización Saliente (Lead → Soft Seguros)

Cuando el lead pasa a "Ganado / Aprobado", el sistema ejecuta esta secuencia de máquina de estados:

```
SYNC-1: Verificar existencia del cliente
  GET https://app.softseguros.com/api/cliente/listar_cliente_por_documento/
      ?numero_documento={cedula_lead}
  
  ├─ Cliente encontrado → soft_cliente_id = id retornado
  │   → Ir a SYNC-3
  └─ No encontrado → SYNC-2

SYNC-2: Crear cliente como prospecto
  POST https://app.softseguros.com/api/cliente/
  Body:
  {
    "nombres": "...",
    "apellidos": "...",
    "tipo_documento": "cedula | cedula extranjeria | nit | pasaporte | nuip | tarjeta de identidad",
    "numero_documento": "...",
    "fecha_nacimiento": "YYYY-MM-DD",
    "genero": "masculino | femenino | otro",
    "telefono": "...",
    "celular": "+57XXXXXXXXXX",
    "email": "...",
    "ciudad": "...",
    "direccion": "...",
    "otra_ocupacion": "...",
    "es_prospecto": true,
    "notificacion_whatsapp_poliza_por_vencer": true,
    "notificacion_correo_cartera": true,
    "notificacion_sms_poliza_por_vencer": false
  }
  Respuesta: { "id": 12345 }
  → soft_cliente_id = 12345

SYNC-3: Agregar datos extra del ramo
  POST https://app.softseguros.com/api/datosextrascliente/
  
  Si ramo = Autos:
  {
    "cliente": soft_cliente_id,
    "codigo_tipo": 6,
    "texto": "{\"placa_dato_extra\":\"ABC123\",\"fecha_soat_dato_extra\":\"2026-12-01\",
               \"fecha_impuestos_dato_extra\":\"2026-09-01\",
               \"fecha_tecnomecanica_dato_extra\":\"2027-03-01\"}"
  }
  
  Si tiene hijos: codigo_tipo = 5
  Celular adicional: codigo_tipo = 4
  Email adicional: codigo_tipo = 1

SYNC-4: Crear póliza (si aplica en Fase 1, obligatorio Fase 2)
  POST https://app.softseguros.com/api/poliza/
  {
    "cliente": soft_cliente_id,
    "estado_poliza": 1,
    "numero_poliza": "...",
    "sede": 1,
    "ramo": ramo_id_soft,
    "codio_objeto_asegurado": "placa | dirección | riesgo",
    "vendedor": vendedor_id_soft,
    "renovable": true,
    "fecha_inicio": "YYYY-MM-DD",
    "fecha_fin": "YYYY-MM-DD",
    "nombre_tomador": "...",
    "cedula_tomador": "...",
    "nombre_asegurado": "...",
    "cedula_asegurado": "...",
    "prima": 0.00,
    "gastos_expedicion": 0.00,
    "iva": 0.00,
    "total": 0.00,
    "porcentje_comicion": 0.00
  }
  Respuesta: { "id": soft_poliza_id }

SYNC-5: Agregar beneficiarios (solo Vida y Salud)
  POST https://app.softseguros.com/api/beneficiariopolizariesgo/
  {
    "poliza": soft_poliza_id,
    "nombres": "...",
    "numero_documento": "...",
    "parentesco": "...",
    "porcentaje_beneficio": "100",
    "fecha_nacimiento": "YYYY-MM-DD"
  }

SYNC-6: Agregar anexos si aplica
  POST https://app.softseguros.com/api/anexopoliza/
  { ...campos del anexo... }
```

Cada paso se registra en la tabla `SoftSegurosSync` con estado, payload, respuesta y timestamp. Si un paso falla, la máquina de estados sabe exactamente dónde retomar.

#### 10.3 Flujo de Sincronización Entrante (Soft Seguros → CRM)

Job diario que trae pólizas por vencer:

```
GET https://app.softseguros.com/api/poliza/
    ?order_by=id&sort_by=asc&page={n}

→ Paginar hasta obtener todas (10 por página, usar campo "next")
→ Filtrar por: fecha_fin entre HOY y HOY+60
→ Filtrar por: estado_poliza.codigo_generico = "01" (Vigente)
→ Filtrar por: renovable = true
→ Crear/actualizar oportunidades de renovación en el CRM
```

Para cada cliente de renovación encontrado:
```
GET https://app.softseguros.com/api/cliente/listar_cliente_por_id/
    ?id_cliente={cliente_id}
→ Obtener teléfono/email para contacto
```

Para cross-selling al gestionar un lead:
```
GET https://app.softseguros.com/api/poliza/?id_cliente={soft_cliente_id}
→ Mostrar pólizas activas en la ficha del lead
```

#### 10.4 Manejo de Errores y Reintentos

```
Intento 1: inmediato
Intento 2: +30 segundos
Intento 3: +2 minutos
Intento 4: +10 minutos
→ Después del intento 4: Alerta admin + estado "Error de Sync"
   Botón de reintento manual disponible en el panel admin
   Todos los intentos quedan en bitácora con payload completo
```

#### 10.5 Validaciones Previas al Envío a Soft Seguros

El CRM bloquea el avance a "Ganado" y muestra al asesor los campos faltantes si no se cumplen:

| Campo | Obligatorio | Validación |
|-------|-------------|------------|
| nombres + apellidos | Sí | No vacíos |
| tipo_documento | Sí | Enum: cedula, cedula extranjeria, nit, pasaporte, nuip, tarjeta de identidad |
| numero_documento | Sí | No vacío, formato válido |
| celular | Sí | Formato E.164 +57XXXXXXXXXX |
| ciudad | Sí | No vacío |
| ramo | Sí | Enum válido y mapeado a ramo_id de Soft |
| cotizacion aceptada | Sí | Al menos una cotización en estado "aceptada" |
| consentimiento_datos | Sí | true con timestamp |
| prima_cotizada | Sí | > 0 |

---

### Módulo 11 — Reportería y Tableros

**Tablero Gerencial:**
- Embudo de conversión: leads → contactados → calificados → cotizados → ganados
- Leads por fuente, canal, campaña y periodo
- Tiempo promedio por etapa del pipeline
- Tasa de conversión a ganado por asesor y ramo
- **Panel de renovaciones:** total por vencer este mes, gestionadas, confirmadas, perdidas, en riesgo
- **Tasa de retención:** % de pólizas renovadas vs. vencidas
- KPIs de integración Soft Seguros: sincronizaciones exitosas / errores / pendientes

**Tablero Asesor:**
- Mis leads del día (priorizados por score y SLA)
- Mis renovaciones críticas (vencen en menos de 15 días)
- Tareas pendientes y vencidas
- Pipeline personal y métricas del mes

**Tablero de Renovaciones (coordinador):**
- Pólizas venciendo por semana (próximas 8 semanas)
- Por ramo y aseguradora
- Alertas de pólizas sin gestión iniciada
- Valor en riesgo: suma de primas de pólizas sin confirmar renovación

**Tablero Marketing:**
- Costo por lead por campaña
- Leads por UTM source/medium/campaign
- Calidad de leads por campaña (% que llegan a cotización)

---

### Módulo 12 — Administración y Configuración

- Gestión de usuarios, roles y permisos (admin, coordinador, asesor, solo lectura)
- Configuración de pipelines y etapas por tipo (pre-venta, renovaciones)
- Reglas de asignación y SLA
- Plantillas de mensajes por tipo y etapa
- Configuración de fuentes externas (webhooks, tokens Meta/Google)
- **Configuración de renovaciones:** rango de días de importación, horario del job, reglas de asignación por vendedor de Soft
- **Credenciales Soft Seguros:** token API por ambiente (dev/staging/prod), URL base, IP whitelist
- Mapeo de ramos del CRM → ramo_id de Soft Seguros
- Mapeo de vendedores del CRM → vendedor_id de Soft Seguros
- Auditoría: log completo de cambios, exportaciones y accesos a datos sensibles
- Consentimientos y política de datos (Ley 1581/2012)

---

## 5. Modelo de Datos

### Entidades Principales

```
Lead (pre-venta)
  id: uuid
  tipo: enum [lead, renovacion, cross_sell]
  fuente_id: FK → Fuente
  canal: enum [web, meta_leads, google_leads, whatsapp, llamada, referido, soft_import, csv]
  utm_source, utm_medium, utm_campaign: string
  nombre, apellido: string
  tipo_documento: enum
  numero_documento: string
  telefono, celular, email: string
  ciudad, direccion: string
  ramo: enum [autos, vida, salud, soat, hogar, pyme, otro]
  producto_especifico: string
  etapa_actual: FK → Etapa
  pipeline_tipo: enum [preventa, renovacion, crosssell]
  asesor_asignado: FK → Usuario
  score: int (0–100)
  prioridad: enum [baja, media, alta, urgente]
  soft_cliente_id: int (nullable)
  soft_poliza_id: int (nullable — para renovaciones)
  sincronizado_soft: boolean
  estado_sync: enum [pendiente, en_proceso, exitoso, error]
  consentimiento_datos: boolean
  ip_origen: string
  created_at, updated_at, ganado_at: timestamp

Renovacion (extensión de Lead para tipo=renovacion)
  lead_id: FK → Lead
  soft_poliza_id: int
  numero_poliza: string
  ramo_nombre: string
  ramo_global: string
  aseguradora: string
  fecha_inicio_poliza: date
  fecha_fin_poliza: date
  prima_actual: decimal
  dias_para_vencer: int (calculado)
  renovable: boolean
  objeto_asegurado: string (placa/dirección)
  estado_soft: string
  ultima_importacion: timestamp

SoftSegurosSync
  id: uuid
  lead_id: FK → Lead
  paso: enum [sync1_verificar, sync2_crear_cliente, sync3_datos_extra,
              sync4_crear_poliza, sync5_beneficiarios, sync6_anexos,
              renovacion_update_poliza, importacion_polizas]
  endpoint: string
  metodo: enum [GET, POST, PUT]
  payload_enviado: jsonb
  respuesta: jsonb
  http_status: int
  exitoso: boolean
  intento_num: int
  error_mensaje: string
  created_at: timestamp

JobImportacion
  id: uuid
  ejecutado_en: timestamp
  total_polizas_consultadas: int
  nuevas_renovaciones_creadas: int
  renovaciones_actualizadas: int
  ignoradas_ya_gestionadas: int
  errores: int
  detalle_errores: jsonb
  duracion_ms: int

[Las demás entidades del PRD v1.0 se mantienen:
 Interaccion, Cotizacion, Documento, Tarea, Fuente, Usuario]
```

---

## 6. Stack Tecnológico

### Frontend

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 15 (App Router) |
| UI Components | Shadcn/UI + Radix UI |
| Estado | Zustand |
| Tablas | TanStack Table v8 |
| Kanban | dnd-kit |
| Gráficos | Recharts |
| Estilos | Tailwind CSS v4 |

### Backend

| Capa | Tecnología |
|------|-----------|
| Runtime | Node.js + TypeScript |
| Framework API | NestJS |
| Base de datos | PostgreSQL (Supabase) |
| ORM | Prisma |
| Cola de jobs | BullMQ (Redis) — para sync Soft y job diario importación |
| Tiempo real | Supabase Realtime (alertas de SLA y renovaciones críticas) |
| Almacenamiento | Supabase Storage (documentos) |
| Auth | Supabase Auth (JWT + roles) |

### Integraciones

| Integración | Tecnología |
|-------------|-----------|
| Soft Seguros | REST API Bearer Token — bidireccional |
| WhatsApp Business | Meta Cloud API o BSP (360dialog / Gupshup) |
| Meta Lead Ads | Webhook Facebook |
| Google Ads Lead Forms | Webhook + Google Ads API |
| Email | Nodemailer + SMTP / SendGrid |
| Call Tracking | Toky / JustCall / Twilio (fase 2) |

### Infraestructura

| Componente | Opción |
|------------|--------|
| Frontend | Vercel |
| Backend | Railway o Render |
| DB | Supabase (PostgreSQL gestionado) |
| CDN | Cloudflare |
| Monitoreo | Sentry + Uptime Robot |
| CI/CD | GitHub Actions |

---

## 7. Flujos Completos

### 7.1 Lead Nuevo — Caso Feliz

```
[11:03] Lead Meta Leads "SOAT-Bogotá-Abril26" → Orquestador
[11:03] Ficha creada: ramo=SOAT, score=45, canal=meta
[11:03] Asignación → Asesor Juan Pérez | WhatsApp automático | Notificación push
[11:05] Juan llama → registra → Etapa: Contactado. Score +20 = 65
[11:07] Cliente sube cédula + tarjeta propiedad → Score +30 = 95 → Urgente
[11:10] Juan cotiza 2 aseguradoras → PDF enviado → Etapa: Cotización enviada
[11:45] Cliente acepta → Cotización marcada aceptada
        Validación pre-sync: ✅ todos los campos OK
        Etapa → "Ganado / Aprobado"
[11:45] SYNC-1: GET /api/cliente/...?numero_documento=XYZ → 404 Not Found
[11:45] SYNC-2: POST /api/cliente/ → { id: 84521 } soft_cliente_id guardado
[11:45] SYNC-3: POST /api/datosextrascliente/ (placa + fechas)
[11:45] SYNC-4: POST /api/poliza/ → { id: 91033 } soft_poliza_id guardado
        Etapa → "Sincronizado ✓" | Link a Soft Seguros visible en ficha
[11:45] Soft Seguros recibe prospecto con datos completos. Emisor toma el caso.
```

### 7.2 Importación de Renovaciones — Job Diario

```
[07:00] Job diario ejecutado
        GET /api/poliza/ → paginación completa
        Resultado: 171 pólizas totales en Soft Seguros
        Filtradas: 23 pólizas vencen en próximos 60 días
        → 3 ya tienen oportunidad de renovación en CRM (actualizadas)
        → 20 son nuevas → 20 oportunidades de renovación creadas
        → Scores asignados: 5 críticas (D-15), 8 urgentes (D-30), 7 normales (D-45)
        → Asignación: según vendedor en Soft Seguros
        Log guardado: 23 procesadas, 20 creadas, 3 actualizadas, 0 errores

[07:00] Para los 5 críticos (D-15):
        → Alerta inmediata al asesor y coordinador
        → WhatsApp al cliente: "Tu póliza de [ramo] vence en 15 días..."

[09:30] Asesor ve tablero de renovaciones → Gestiona caso D-15
        Llama al cliente → acepta renovar → Etapa: Confirmada
        PUT /api/poliza/{soft_poliza_id}/ → nuevas fechas → Renovada en Soft ✓
```

### 7.3 Cross-Selling en Pre-Venta

```
Lead entra buscando seguro de vida.
Asesor abre ficha → CRM consulta Soft:
  GET /api/poliza/?id_cliente=84521
  Resultado: { póliza SOAT vigente, póliza Autos Todo Riesgo vigente }
  
Asesor ve en la ficha: "Este cliente ya tiene SOAT y Todo Riesgo activos."
→ CRM sugiere: "Oportunidad: seguro de vida para cliente con autos."
→ Asesor personaliza la cotización → Mayor tasa de cierre.
```

---

## 8. Plan de Implementación por Fases

### Fase 1 — MVP (Semanas 1–8)

**Entregables:**
- Pipeline de pre-venta completo (módulo 1)
- Captura desde formularios web y WhatsApp (módulo 3)
- Asignación y notificaciones básicas (módulo 4)
- Historial de interacciones y notas (módulo 5)
- Cotización básica (registro, sin PDF) (módulo 6)
- Sincronización saliente con Soft Seguros — pasos SYNC-1 a SYNC-4 (módulo 10)
- Administración básica de usuarios y credenciales Soft (módulo 12)
- Dashboard del asesor (módulo 11)
- Cumplimiento Ley 1581

### Fase 2 — Renovaciones y Automatización (Semanas 9–16)

**Entregables:**
- **Módulo de renovaciones completo** (módulo 2): job diario, pipeline, scoring, automatizaciones, confirmación en Soft
- Automatizaciones de pre-venta: SLA, nurturing, re-asignación (módulo 4)
- Inbox WhatsApp bidireccional (módulo 5)
- Gestión documental con link auto-carga (módulo 7)
- Generación de cotización en PDF (módulo 6)
- Integración Meta Lead Ads y Google Lead Forms (módulo 3)
- Dashboard gerencial y de renovaciones (módulo 11)
- Scoring por reglas (módulo 8)
- SYNC-5 (beneficiarios) y SYNC-6 (anexos) (módulo 10)

### Fase 3 — Inteligencia y Escala (Semanas 17–24)

**Entregables:**
- Cross-selling automático sobre pólizas activas (módulo 9)
- Scoring predictivo ML (módulo 8, fase 2)
- Integración call tracking (módulo 3)
- Dashboard de marketing con datos de pauta
- API pública del CRM para integraciones futuras
- PWA / app móvil para asesores
- Multi-sede (soporte sucursales)

---

## 9. KPIs de Éxito

| KPI | Baseline actual | Meta Fase 1 | Meta Fase 2 |
|-----|----------------|-------------|-------------|
| Tiempo primer contacto (leads) | > 30 min | < 10 min | < 5 min |
| % leads contactados < 5 min | < 20% | > 50% | > 80% |
| Tasa cotización sobre leads calificados | — | > 60% | > 75% |
| % leads sync exitoso con Soft | 0% (manual) | > 95% | > 99% |
| **Tasa de retención de pólizas** | — (sin métrica) | Baseline medido | +10% vs. baseline |
| **Pólizas renovadas / total por vencer** | — | > 70% | > 85% |
| **Pólizas sin gestión activa en D-15** | ~100% | < 20% | < 5% |
| **Valor prima en riesgo (sin confirmar)** | Sin visibilidad | Visible y medido | Reducido en 40% |
| Satisfacción asesor (NPS interno) | — | > 7/10 | > 8.5/10 |

---

## 10. Seguridad y Cumplimiento

- Token Soft Seguros en variables de entorno cifradas, nunca expuesto al frontend
- HTTPS obligatorio en todos los endpoints
- Autenticación JWT de corta duración + refresh token
- Cifrado en reposo para documentos (S3/Supabase Storage)
- Rate limiting en webhooks de entrada (Meta, Google)
- IP whitelist para peticiones salientes hacia Soft Seguros
- Log de acceso a datos sensibles (documento, teléfono, prima)
- Consentimiento Habeas Data con timestamp, IP y texto de política aceptada
- Derecho de supresión: anonimización de datos personales a petición
- Retención: leads perdidos se anonimizan a los 12 meses (configurable)
- Auditoría completa: quién modificó qué y cuándo

---

## 11. Endpoints Completos Soft Seguros — Referencia

| Acción | Método | Endpoint |
|--------|--------|----------|
| Obtener token | POST | `/api-token-auth/` |
| Buscar cliente por documento | GET | `/api/cliente/listar_cliente_por_documento/?numero_documento=X` |
| Obtener cliente por ID | GET | `/api/cliente/listar_cliente_por_id/?id_cliente=X` |
| Crear cliente | POST | `/api/cliente/` |
| Agregar datos extra | POST | `/api/datosextrascliente/` |
| **Listar pólizas (importar renovaciones)** | GET | `/api/poliza/?order_by=id&sort_by=asc&page=N` |
| **Pólizas por cliente (cross-sell)** | GET | `/api/poliza/?id_cliente=X` |
| Crear póliza | POST | `/api/poliza/` |
| **Actualizar póliza (confirmar renovación)** | PUT | `/api/poliza/{id}/` |
| Crear beneficiario | POST | `/api/beneficiariopolizariesgo/` |
| Actualizar beneficiario | PUT | `/api/beneficiariopolizariesgo/{id}/` |
| Listar beneficiarios | GET | `/api/beneficiariopolizariesgo/?poliza_id=X` |
| Crear anexo póliza | POST | `/api/anexopoliza/` |
| Actualizar anexo | PUT | `/api/anexopoliza/{id}/` |
| Listar anexos | GET | `/api/anexopoliza/list_anexos_polizas_filtro_paginados/?id_poliza=X` |
| Listar estados póliza | GET | `/api/estadopoliza/` |

---

## 12. Glosario

| Término | Definición |
|---------|-----------|
| Lead | Persona con interés en comprar un seguro nuevo |
| Renovación | Póliza vigente próxima a vencer que requiere gestión de continuidad |
| Cross-sell | Venta de un producto adicional a un cliente con póliza activa |
| soft_cliente_id | ID numérico del cliente en Soft Seguros, obtenido al crear o consultar |
| soft_poliza_id | ID numérico de la póliza en Soft Seguros |
| Job diario | Proceso automático que se ejecuta a hora fija para importar datos de Soft |
| Máquina de estados | Lógica de sincronización que avanza paso a paso y puede retomar si falla |
| SLA | Tiempo máximo para ejecutar una acción (ej: primer contacto < 5 min) |
| Ramo | Categoría de seguro: autos, vida, salud, hogar, SOAT, PYME |
| Tasa de retención | % de pólizas que se renuevan sobre el total de pólizas vencidas |
| D-15, D-30, D-45 | Días restantes antes del vencimiento de la póliza |
| BSP | Business Solution Provider — proveedor oficial de WhatsApp Business API |


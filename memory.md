# Memoria del Proyecto — ROESAN CRM

> **AGENTES DE IA:** Leer este archivo al inicio de CADA sesión antes de escribir cualquier código. Actualizar al finalizar avances importantes.
> Última actualización: 2026-05-13

---

## 🟢 Estado General del Proyecto

**Fase actual:** Fase 1 (Semanas 1–8) — Pipeline pre-venta + integraciones core  
**Deploy:** Frontend → Netlify | Backend → Render | DB → InstantDB  
**Repo:** GitHub (rama `main`)

---

## ✅ Módulos Completados

| Módulo | Estado | Notas |
|--------|--------|-------|
| Dashboard + KPIs | ✅ Funcional | |
| Pipeline Pre-Venta (Kanban) | ✅ Funcional | |
| Pipeline Renovaciones | ✅ Funcional | |
| Config UI | ✅ Funcional | |
| Import Job (BullMQ) | ✅ Funcional | |
| Gmail integration | ✅ Funcional | OAuth, drafts, labels |
| Módulo Cotizador backend | ✅ Funcional | Controller + Service + Module |
| **Allianz SOAP** | ✅ **FUNCIONAL** | UAT probado, 4 paquetes |
| **SBS SOAP** | ⚠️ **BLOQUEADO** (Soporte) | Error de validación en factor de comisión. Esperando respuesta de Ivan David Diaz (SBS). |
| Comparador IA (Gemini Flash) | ✅ Funcional | Override determinístico para opción más barata |
| Parse-PDF de cotizaciones | ✅ Funcional | Endpoint `/parse-pdf` y `/parse-pdfs` (bulk) |
| **Módulo Documentos Legales** | ✅ **FUNCIONAL** | Extracción IA + **Persistencia en InstantDB** + Sincronización a Soft (Clientes/Pólizas) |
| Generador de correo IA | ✅ Funcional | Endpoint `/email` con contexto renovación/nuevo |
| Schema InstantDB cotizaciones | ✅ Actualizado | Campos: `cobertura`, `prima_total`, `es_renovacion` |
| **SYNC-6 (Anexos)** | ✅ **FUNCIONAL** | Subida de archivos a Soft Seguros mediante `/documentos/sync` |
| **Auth Google OAuth** | ✅ **FUNCIONAL** | Login con Google via InstantDB. Whitelist: `@roesan.com` + `jorge.jaime.henao.romero@gmail.com` |
| **Paridad de Pipelines** | ✅ **FUNCIONAL** | Los pipelines de Renovaciones y Pre-venta comparten componentes (`AddInteraccionForm`, `AddCotizacionForm`) y funcionalidades (CRM, Cotizaciones AI). |
| **Workflow Propuesta Pro** | ✅ **MEJORADO** | Modal de revisión (`PropuestaProModal`) permite previsualizar, editar y enviar propuestas via Email (OAuth) o WhatsApp. |

---

## ⚠️ En Progreso / Pendiente

| Item | Estado | Acción requerida |
|------|--------|-----------------|
| **Qualitas REST** | ✅ **FUNCIONAL** (QA) | Formato `fechaNacimiento` (DD/MM/YYYY) y regla 56 corregidos. Usar Fasecolda `01601276` para pruebas en QA. |
| **SYNC-1 a SYNC-4 en producción** | ⏳ Listo para probar | Permisos Soft Seguros ya habilitados — hacer prueba con lead real en "Ganado/Aprobado" |
| Generador de Propuesta Pro | ✅ Funcional | Link público interactivo generado automáticamente, con schema guardado en InstantDB |
| Comparativo PDF offline (`comparativo.py`) | ✅ Independiente | Script Python v3.0 local para asesores, no integrar al backend |

---

## 🔑 Integraciones — Hallazgos Críticos

### Soft Seguros API ✅ PERMISOS CONFIRMADOS (2026-04-26)
- **Base URL:** `https://app.softseguros.com`
- **Auth:** `POST /api-token-auth/` → `Authorization: Token <token>`
- **Permisos habilitados:** `/api/cliente/` (listar, crear, buscar por documento y por ID), `/api/poliza/` (crear)
- **Campos obligatorios POST `/api/poliza/`:**
  - `cliente` (ID), `sede` (6787), `vendedor` (ID asesor personal), `ramo` (ID del catálogo)
  - `estado_poliza` (ID entero, **NO** objeto), `numero_poliza`, `codio_objeto_asegurado`
  - `nombre_tomador`, `cedula_tomador`, `nombre_asegurado`, `cedula_asegurado`
- **🚨 CRÍTICO — estado_poliza:** Debe ser un **ID entero**, no el objeto `{codigo_generico:'01'}`
  - `45909` = Vigente ✓ | `45910` = Cotización | `45911` = Devengada
- **🚨 CRÍTICO — vendedor:** El ID `27931` (Org Roesan) **NO puede crear pólizas** → `400 "Ningún vendedor enviado"`
  - Usar asesores personales: `30808` (Martha Noguera), `30809` (Adriana Campo), etc.
  - Catálogo actualizado en `soft-catalogs/vendedores.json` con flag `puede_crear_polizas`
- **Teléfonos:** Siempre E.164 Colombia: `+57XXXXXXXXXX`
- **404 en búsqueda por documento** = cliente no existe (ya no devuelve 403)

### Allianz SOAP ✅ FUNCIONAL
- **Protocolo:** SOAP sobre HTTPS con certificado mTLS (.pfx)
- **Endpoint UAT:** `https://secure-eu-uat-colombia.apis.allianz.com/drswoc16/services/AutosIndividualWS?codCia=3`
- **Certificado:** `apps/backend/certs/CP100074_Int_PruebasRN2026.pfx` (gitignored)
- **Formato:** El `<chargerequest>` va HTML-escaped dentro de `<ws:xml>` en operación `call4`
- **Status B ≠ error:** Warnings (ej: error 714) son informativos. Solo lanzar error cuando `Status === 'E'`
- **Campos obligatorios que la doc omite:** `<cap>0</cap>`, `<isnewowner>N</isnewowner>`, `<discountextension>N</discountextension>`, `<providefrom>0</providefrom>`
- **TransactionNumber:** Exactamente 11 dígitos: `String(Date.now()).slice(-11)`
- **Timeout:** 60000ms mínimo (UAT tarda 30-60s)
- **Prueba exitosa:** Suzuki Ertiga 2020 (Fasecolda `4517106`), 4 paquetes: Esencial → Llave en Mano
- **rejectUnauthorized: false** en UAT (certificado autofirmado)

### Qualitas REST ✅ FUNCIONAL (QA)
- **Auth:** HTTP Basic Auth
- **Estado:** Corregido y probado en QA (2026-05-05).
- **Contactos:** Edgar Bello León (Director TI): `ebello@qualitascolombia.com.co` | Brayan Florez (Analista TI): `bflorez@qualitascolombia.com.co`
- **🚨 CRÍTICO — fechaNacimiento:** Debe ser **`DD/MM/YYYY`**. El backend ahora formatea automáticamente desde `YYYY-MM-DD`.
- **🚨 CRÍTICO — Reglas:** Se requiere `NoConsideracion: '56'` en `ConsideracionesAdicionalesDG` para habilitar la tarifa vigente.
- **Error `0005`:** Es por falta de tarifas para ciertos Fasecolda en QA. Para pruebas exitosas usar Suzuki Ertiga 2016 (`01601276`).
- **Género:** Se envía en `ConsideracionesAdicionalesDA` (TipoRegla 56) como 'M' o 'F'.
- **Frontend:** La función `handleAutoQuote` ya envía `fecha_nacimiento` y `genero` del lead.
- **Correo enviado 30 Abr 2026:** Se reportaron errores 0005 y 0235 al equipo de Qualitas. Se resolvieron internamente sin respuesta formal.
- **Pendiente:** Solicitar credenciales de **producción** a Edgar Bello.

### HDI 🆕 CREDENCIALES RECIBIDAS — Sin integración iniciada
- **Estado:** Credenciales recibidas el **9 May 2026** (llegaron encriptadas, pendiente procesarlas).
- **Credenciales en:** `APIS/HDI/Credenciales_HDI.md`
  - `ClientId: 3908e0jofl82r1dlfjk8v99af`
  - `ClientSecret: 1i91kppqi5vracd2jn4n87mtikpl5hl78mjvtct0f4sj2rb6g8d5`
- **Sin conector implementado** en el backend. Primer paso: revisar la documentación técnica de HDI y crear `apps/backend/src/lib/hdi-api.ts`.

---

### SURA 🆕 PRE-INTEGRACIÓN — Carpeta creada
- **Estado:** Carpeta creada y requerimientos técnicos definidos (`APIS/SURA/Sura_Integration_Info.md`).
- **Pendiente:** Contacto con el equipo técnico de SURA para recibir documentación y credenciales.

---

### SBS SOAP ⚠️ BLOQUEADO (Esperando respuesta)
- **Protocolo:** SOAP 1.2
- **Endpoint:** `https://test.cotizadoresgenerales.com/wsCotizaAutos/CotizaAutos.asmx`
- **Auth:** Usuario/Password (configurados en `.env`). Usuario de pruebas: `gerencia@roesan.com.co` (mismas credenciales que producción).
- **Estado Actual:** El conector está implementado. Correo enviado a Ivan David Diaz el **6 May 2026** reportando el error: *"No se pudo determinar el factor de comisión del usuario"*. Solicitamos el valor correcto de `<codFactComision>`.
- **Respuesta de Ivan David:** Pendiente.
- **Set de Pruebas proporcionado por SBS:** Toyota Hilux (09008205/2023), Hyundai Tucson (03206083/2019), Kia Picanto (04601219/2017), Mazda (05606092/2020), Renault (08021001/2022), Chevrolet (01601345/2023).
- **Nota:** SBS exige 30 pólizas/año para mantener el acceso al webservice.

---

## 📄 Módulo de Documentos e IA ✅ NUEVO (2026-04-27)

Este módulo permite procesar documentos legales y técnicos para automatizar la captura de datos y la sincronización con Soft Seguros.

### Documentos Soportados
- **Cédula:** Extrae Nombres, Apellidos, ID, Género y Fecha de Nacimiento. Actualiza nombre, documento, **`fecha_nacimiento`** y **`genero`** del Lead en InstantDB.
- **RUT:** Extrae NIT, Razón Social, Dirección y Ciudad. Actualiza el Lead.
- **Sarlaft:** Extrae datos de ocupación y financieros para el perfil del cliente.
- **Póliza:** Extrae Aseguradora, Número de Póliza, Vigencias, Prima y Coberturas.

### Lógica de "Actualización con Póliza Actual"
Cuando se procesa una **Póliza**, el sistema realiza dos acciones automáticas al darle a "Actualizar":
1. **Lead:** Actualiza los campos del vehículo (`vehiclePlate`, `vehicleYear`, `vehicleFasecolda`) con la info extraída.
2. **Comparador:** Crea un registro en la tabla `cotizaciones` marcado con `es_renovacion: true`. Esto permite que la IA compare esta póliza vigente contra las nuevas cotizaciones de Allianz/Qualitas.

### Lógica de Upsert de Cliente en Remisiones (2026-05-04)
Cuando se sube una póliza y el cliente **ya existe** en Soft Seguros:
- La nueva información es **siempre más actual** y sobreescribe la existente.
- Campos actualizados: `nombres`, `apellidos`, `fecha_nacimiento`, `genero`, `correo`, `celular`, `telefono`, `direccion`, `ciudad`, `provincia`, `ocupacion_descripcion`.
- La **`fecha_nacimiento`** de la cédula se guarda en `leads.fecha_nacimiento` (InstantDB) para cumpleaños.
- El frontend muestra banner 🔄 informando que el cliente existe y será actualizado.
- El flujo **no se bloquea**: al buscar un cliente (nuevo o existente), siempre avanza al Paso 2.

### Sincronización (SYNC-6)
- Permite subir el archivo PDF/Imagen directamente a Soft Seguros como un **Anexo**.
- El sistema detecta si debe asociarse al Cliente (C) o a la Póliza (P) según el tipo de documento.

---

## 🏗️ Arquitectura de Datos

- **InstantDB** (no Prisma, no PostgreSQL). Schema en `apps/frontend/src/lib/instant-schema.ts`
- **`leads` tiene `docs_metadata`** — persiste el estado de sincronización de archivos.
- **`leads` tiene `fecha_nacimiento` y `genero`** — se capturan al parsear la cédula (remisiones + ficha de lead)
- **Cotizaciones** guardan tanto `valor` como `prima_total` (el comparador usa `prima_total`)
- **Flag `es_renovacion`:** Se guarda explícitamente en InstantDB — el comparador NO puede inferirlo
- **`pipeline_tipo`:** enum `preventa | renovacion | crosssell`
- **Soft Seguros refs:** `soft_cliente_id` y `soft_poliza_id` en el Lead tras sincronización

---

## 📁 Archivos Clave

| Archivo | Descripción |
|---------|-------------|
| `apps/backend/src/lib/allianz-api.ts` | Cliente Allianz SOAP con mTLS |
| `apps/backend/src/lib/soft-seguros-api.ts` | Cliente Soft Seguros REST |
| `apps/backend/src/lib/qualitas-api.ts` | Cliente Qualitas REST |
| `apps/backend/src/cotizador/cotizador.service.ts` | Orquestador cotizaciones |
| `apps/backend/src/cotizador/comparador.service.ts` | Lógica comparativa IA |
| `apps/backend/src/cotizador/email-generator.ts` | Generador de correos |
| `apps/backend/src/cotizador/coverage-mapping.ts` | Mapeo de coberturas |
| `apps/frontend/src/app/(dashboard)/leads/[id]/page.tsx` | Ficha de prospecto + cotizaciones |
| `apps/frontend/src/components/CotizacionComparativo.tsx` | Comparador visual |
| `apps/frontend/src/components/DocumentosLegales.tsx` | Extractor de documentos legal/póliza |
| `apps/backend/src/documentos/` | Backend módulo extracción y sync anexos |
| `apps/frontend/src/lib/instant-schema.ts` | Schema InstantDB |
| `apps/backend/certs/CP100074_Int_PruebasRN2026.pfx` | Certificado Allianz UAT (gitignored) |
| `comparativo.py` | Script offline de comparativo PDF (independiente del CRM) |

---

## 📌 Reglas de Oro (no olvidar)

1. **Teléfonos siempre en E.164:** `+57XXXXXXXXXX`
2. **InstantDB:** No hay Prisma. Todo schema en `instant-schema.ts`
3. **`es_renovacion`:** Guardar explícitamente, no inferir
4. **Allianz Status B:** No es error fatal — seguir procesando paquetes
5. **Soft Seguros tokens:** Solo en variables de entorno, nunca en código
6. **Comparador:** Usa `prima_total`. Si es renovación, la póliza vigente se marca con `es_renovacion: true`

---

## 🔐 Auth — Configuración Google OAuth (2026-05-04)

- **OAuth Client ID:** `1003175569991-is2qmk8e6kl258nrj9banf37jdultap5.apps.googleusercontent.com`
- **InstantDB client name:** `roesan-crm`
- **Google Console app:** External + Test users
- **Whitelist acceso:** dominio `@roesan.com` (automático) + `jorge.jaime.henao.romero@gmail.com` (test user)
- **Authorized JS Origins:** `https://roesan-crm.netlify.app`, `http://localhost:3000`
- **Redirect URIs:** `https://api.instantdb.com/runtime/oauth/callback`, `https://roesan-backend.onrender.com/api/auth/google/callback`
- **Vars Netlify:** `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_CLIENT_NAME=roesan-crm`

---

## 🎯 Próximos Pasos (prioridad)

1. **Probar SYNC-1 a SYNC-4 en producción** — Soft Seguros ya tiene permisos en `/api/cliente/`
2. **HDI — Procesar credenciales e iniciar integración** — Credenciales recibidas el 9 May 2026, sin conector aún.
3. **SURA — Iniciar contacto técnico** — Documentación y credenciales pendientes.
4. **SBS — Hacer seguimiento a Ivan David Diaz** — Correo enviado el 6 May, sin respuesta. Reenviarlo si no hay respuesta en los próximos días.
5. **Qualitas Prod** — Pedir credenciales de producción a Edgar Bello (`ebello@qualitascolombia.com.co`).
6. **Allianz Prod** — Pedir credenciales de producción (contacto no registrado aún).
7. **SYNC-5** — Beneficiarios (Fase 2)
8. **PDF comparativo online** — Evaluar integración de `comparativo.py` al backend

---

## 🚀 Mejoras y Correcciones Recientes (2026-05-05)

### Correcciones de Build (Render/Netlify) ✅
- **Backend:** Se corrigieron errores de tipado en `sbs-api.ts` (parámetros de xml2js) y `remisiones.service.ts` (indexado de objetos).
- **Frontend:** Se resolvieron errores de sintaxis JSX (divs extra y etiquetas mal cerradas) en las fichas de Lead y Renovación que impedían el despliegue.

### Persistencia de Documentos ✅
- Se implementó el campo `docs_metadata` (JSON) en la entidad `leads`.
- Los componentes de frontend ahora recuperan el estado de sincronización y los datos extraídos de la DB, evitando la pérdida de información al cambiar entre pestañas o recargar la página.

### Wizard de Remisiones Pro ✅
- **Vinculación de Póliza:** Ahora soporta correctamente el campo `poliza_padre_id` para renovaciones.
- **Pagos Dinámicos:** Se añadió soporte para elegir **Forma de Pago** (Contado/Cuotas) y **Periodicidad** (Mensual, Trimestral, Semestral, Anual).
- **Cálculo de Cuotas:** El backend genera automáticamente los registros de pago en Soft Seguros proyectando las fechas de vencimiento según la periodicidad elegida.

### Refuerzo de Integración Soft Seguros ✅
- **Ruteo de Anexos:** Los documentos tipo `POLIZA` se envían exclusivamente a la entidad Póliza en Soft Seguros.
- **Estandarización de Links:** Todos los enlaces a fichas de cliente apuntan ahora a `/editar/persona/` para compatibilidad total con la v1 de Soft Seguros.

### Integración de Propuesta Pro ✅ (Actualizado 2026-05-07)
- **Generación en un Clic:** El flujo de cotización genera un enlace dinámico `/propuesta/[id]` en Next.js basándose en la plantilla visual de Propuestas Pro (basada en HTML previo).
- **Almacenamiento InstantDB:** La estructura de la propuesta y los resultados del análisis IA (`comparador.service.ts`) se persisten bajo la entidad `propuestas`.
- **Workflow de Revisión:** Implementación de `PropuestaProModal` para que el asesor previsualice y edite el texto antes de enviar.
- **Multicanal:** Envío directo mediante Gmail (via API OAuth integrada) o copia de link para WhatsApp manual.
- **Regeneración IA:** Opción de regenerar la comparación y propuesta directamente desde el modal si es necesario.

### Paridad de Componentes CRM ✅ (2026-05-07)
- Se extrajeron `AddInteraccionForm` y `AddCotizacionForm` a componentes globales.
- El pipeline de **Renovaciones** ahora cuenta con las mismas herramientas comerciales que el de **Pre-venta**: registro de interacciones, cotizador manual/AI, carga de documentos y generación de Propuesta Pro.
- Corrección de labels de relación (`lead` en lugar de `leads`) para mantener consistencia con el schema de InstantDB.

### Alertas en Tiempo Real y Propuestas Pro ✅ (2026-05-13)
- **Sistema de Alertas:** Implementación de notificaciones sonoras (5s) y "toasts" persistentes que incluyen el nombre del cliente y botón directo a WhatsApp.
- **Tracking de Propuestas:** Notificación automática en el CRM cuando un cliente abre el link de su propuesta comercial.
- **Propuesta Pro Premium:** Inclusión de logo oficial, formato de RC en millones y envío de correos vía Gmail API en formato HTML con botones de acción (CTA).
- **Control de Cotizaciones:** El asesor puede realizar un "manual override" de la selección de la IA en el comparador; los encabezados de los planes son pegajosos (sticky) para facilitar la navegación.
- **Detección de Renovaciones:** El sistema identifica automáticamente si un PDF es una renovación por el nombre del archivo y muestra un badge visual.
- **Integraciones:** 
    - **Allianz:** Corrección de estructura XML Call4, restauración de tags obligatorios (`discountextension`, etc.) y mejor manejo de errores SOAP 500.
    - **SBS:** Optimización del parsing eliminando prefijos de namespaces.
- **Datos y UX:** 
    - Agregados campos de Marca y Línea de vehículo, Género y Fecha de Nacimiento en el tab de Datos.
    - Filtros por Ramo en el Kanban de Renovaciones e iconos corregidos por ramo.
    - Notificaciones de nuevos leads con CC configurable.


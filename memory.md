# Memoria del Proyecto — ROESAN CRM

> **AGENTES DE IA:** Leer este archivo al inicio de CADA sesión antes de escribir cualquier código. Actualizar al finalizar avances importantes.
> Última actualización: 2026-05-04

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
| **SBS SOAP** | ✅ **FUNCIONAL** (QA) | Proceso de 2 pasos (Sesión + Cotización). |
| Comparador IA (Gemini Flash) | ✅ Funcional | Override determinístico para opción más barata |
| Parse-PDF de cotizaciones | ✅ Funcional | Endpoint `/parse-pdf` y `/parse-pdfs` (bulk) |
| **Módulo Documentos Legales** | ✅ **FUNCIONAL** | Extracción IA (Cédula, RUT, Sarlaft, Póliza) + Auto-registro póliza actual |
| Generador de correo IA | ✅ Funcional | Endpoint `/email` con contexto renovación/nuevo |
| Schema InstantDB cotizaciones | ✅ Actualizado | Campos: `cobertura`, `prima_total`, `es_renovacion` |
| **SYNC-6 (Anexos)** | ✅ **FUNCIONAL** | Subida de archivos a Soft Seguros mediante `/documentos/sync` |
| **Auth Google OAuth** | ✅ **FUNCIONAL** | Login con Google via InstantDB. Whitelist: `@roesan.com` + `jorge.jaime.henao.romero@gmail.com` |

---

## ⚠️ En Progreso / Pendiente

| Item | Estado | Acción requerida |
|------|--------|-----------------|
| **Qualitas REST** | ✅ **FUNCIONAL** (QA) | Formato `fechaNacimiento` (DD/MM/YYYY) y regla 56 corregidos. Usar Fasecolda `01601276` para pruebas en QA. |
| **SYNC-1 a SYNC-4 en producción** | ⏳ Listo para probar | Permisos Soft Seguros ya habilitados — hacer prueba con lead real en "Ganado/Aprobado" |
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
- **🚨 CRÍTICO — fechaNacimiento:** Debe ser **`DD/MM/YYYY`**. El backend ahora formatea automáticamente desde `YYYY-MM-DD`.
- **🚨 CRÍTICO — Reglas:** Se requiere `NoConsideracion: '56'` en `ConsideracionesAdicionalesDG` para habilitar la tarifa vigente.
- **Error `0005`:** Es por falta de tarifas para ciertos Fasecolda en QA. Para pruebas exitosas usar Suzuki Ertiga 2016 (`01601276`).
- **Género:** Se envía en `ConsideracionesAdicionalesDA` (TipoRegla 56) como 'M' o 'F'.
- **Frontend:** La función `handleAutoQuote` ya envía `fecha_nacimiento` y `genero` del lead.

### SBS SOAP ✅ FUNCIONAL (QA)
- **Protocolo:** SOAP 1.2
- **Endpoint:** `https://test.cotizadoresgenerales.com/wsCotizaAutos/CotizaAutos.asmx`
- **Auth:** Usuario/Password (mismos de producción para `gerencia@roesan.com.co`)
- **Proceso:** 
  1. `SBSAutos_CrearSesion_Paquete`: Crea la sesión con datos del prospecto y vehículo.
  2. `SBSAutos_CotizaryCerrarSesion_Paquete`: Genera el valor de la prima.
- **Mapeo:** El backend orquesta automáticamente los dos pasos requeridos por SBS.
- **Campos:** Requiere Fasecolda, Modelo, Documento, Género y Fecha de Nacimiento (provenientes del Lead).

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
2. **Resolver Qualitas QA** — Contactar Edgar Bello / Brayan Florez
3. **SYNC-5** — Beneficiarios (Fase 2)
4. **PDF comparativo online** — Evaluar integración de `comparativo.py` al backend

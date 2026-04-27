# Memoria del Proyecto — ROESAN CRM

> **AGENTES DE IA:** Leer este archivo al inicio de CADA sesión antes de escribir cualquier código. Actualizar al finalizar avances importantes.
> Última actualización: 2026-04-27

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
| Comparador IA (Gemini Flash) | ✅ Funcional | Override determinístico para opción más barata |
| Parse-PDF de cotizaciones | ✅ Funcional | Endpoint `/parse-pdf` y `/parse-pdfs` (bulk) |
| **Módulo Documentos Legales** | ✅ **FUNCIONAL** | Extracción IA (Cédula, RUT, Sarlaft, Póliza) + Auto-registro póliza actual |
| Generador de correo IA | ✅ Funcional | Endpoint `/email` con contexto renovación/nuevo |
| Schema InstantDB cotizaciones | ✅ Actualizado | Campos: `cobertura`, `prima_total`, `es_renovacion` |
| **SYNC-6 (Anexos)** | ✅ **FUNCIONAL** | Subida de archivos a Soft Seguros mediante `/documentos/sync` |

---

## ⚠️ En Progreso / Pendiente

| Item | Estado | Acción requerida |
|------|--------|-----------------|
| **Qualitas REST** | ⚠️ Conectado, QA limitado | Contactar Edgar Bello / Brayan Florez para activar tarifas en QA y confirmar formato `fechaNacimiento` |
| **SYNC-1 a SYNC-4 en producción** | ⏳ Listo para probar | Permisos Soft Seguros ya habilitados — hacer prueba con lead real en "Ganado/Aprobado" |
| Comparativo PDF offline (`comparativo.py`) | ✅ Independiente | Script Python v3.0 local para asesores, no integrar al backend |

---

## 🔑 Integraciones — Hallazgos Críticos

### Soft Seguros API ✅ PERMISOS CONFIRMADOS (2026-04-26)
- **Base URL:** `https://app.softseguros.com`
- **Auth:** `POST /api-token-auth/` → `Authorization: Token <token>`
- **Permisos habilitados:** `/api/cliente/` (listar, crear, buscar por documento y por ID)
- **Campos obligatorios POST `/api/cliente/`:**
  - `numero_documento`, `tipo_documento` (ej: "01"), `nombres`, `apellidos`
  - `email`, `telefono`, `genero` (MASCULINO/FEMENINO)
  - `fecha_nacimiento`, `ocupacion` (ID, ej: 4 = Independiente)
  - `es_prospecto: true`, `sede` (6787), `marca` (6751)
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

### Qualitas REST ⚠️ QA LIMITADO
- **Auth:** HTTP Basic Auth
- **Estado:** Servidor QA responde. Errores son de configuración QA (no de código):
  - Error `0005`: Fasecolda sin tarifa configurada en QA
  - Error `0235`: Problema con `fechaNacimiento` en QA
- **Acción pendiente:** Contactar equipo Qualitas para habilitar tarifas de prueba

---

## 🏗️ Arquitectura de Datos

- **InstantDB** (no Prisma, no PostgreSQL). Schema en `apps/frontend/src/lib/instant-schema.ts`
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

## 🎯 Próximos Pasos (prioridad)

1. **Probar SYNC-1 a SYNC-4 en producción** — Soft Seguros ya tiene permisos en `/api/cliente/`
2. **Resolver Qualitas QA** — Contactar Edgar Bello / Brayan Florez
3. **SYNC-5** — Beneficiarios (Fase 2)
4. **PDF comparativo online** — Evaluar integración de `comparativo.py` al backend

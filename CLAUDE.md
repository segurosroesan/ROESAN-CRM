# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

> ## 🧠 LEER PRIMERO: `memory.md`
> **OBLIGATORIO:** Leer el archivo `memory.md` en la raíz del repositorio ANTES de iniciar cualquier tarea.
> Contiene el estado actual del proyecto, APIs integradas, reglas críticas y los próximos pasos.
> También **actualizar `memory.md`** al finalizar cualquier avance importante.

---

## Project Overview

This is the **CRM Pre-Venta & Renovaciones** for **Seguros Roesan** — a Colombian insurance company. The full PRD is in `CRM_Roesan_PRD_v2.md`.

The CRM operates in two modes:
1. **Pre-Venta (leads):** Captures, qualifies, and converts leads from digital channels, then syncs approved prospects to Soft Seguros via a multi-step API sequence.
2. **Renovaciones:** Pulls expiring policies from Soft Seguros daily, creates renewal opportunities, and manages the commercial process through to renewal confirmation.

**Soft Seguros is the master system for issued policies. This CRM is the master system for the commercial process** (pre-emission for leads, pre-expiry for renewals).

---

## Tech Stack

### Frontend
- **Next.js 15** (App Router)
- **Shadcn/UI** + Radix UI for components
- **Zustand** for state management
- **TanStack Table v8** for data tables
- **dnd-kit** for Kanban drag-and-drop
- **Recharts** for dashboards
- **Tailwind CSS v4**

### Backend
- **NestJS** on Node.js + TypeScript
- **InstantDB** — real-time database (replaces PostgreSQL + ORM + Realtime + Auth). Use InstantDB's JS SDK on the frontend and Admin SDK on the server. No Prisma.
- **BullMQ** (Redis) for job queues — daily import job and Soft Seguros sync
- Document storage: TBD (separate solution, InstantDB has no file storage)

### Infrastructure
- Frontend → **Netlify**
- Backend → Railway or Render
- DB → **InstantDB**
- Source control → **GitHub**
- CDN → Cloudflare
- Monitoring → Sentry + Uptime Robot
- CI/CD → GitHub Actions

---

## Soft Seguros Integration (Critical)

Base URL: `https://app.softseguros.com`

**Auth:** Token-based. POST to `/api-token-auth/` with credentials → receive token. All requests use `Authorization: Token <token>`. Token and credentials must live in environment variables only, never in code.

### Outbound Sync (Lead → Soft Seguros)

Triggered when a lead reaches "Ganado / Aprobado". This is a state machine — each step is recorded in `SoftSegurosSync` table so the process can resume if interrupted:

1. **SYNC-1** `GET /api/cliente/listar_cliente_por_documento/?numero_documento=X` — check if client exists
2. **SYNC-2** `POST /api/cliente/` — create client if not found (returns `soft_cliente_id`)
3. **SYNC-3** `POST /api/datosextrascliente/` — add ramo-specific extra data
4. **SYNC-4** `POST /api/poliza/` — create policy (returns `soft_poliza_id`)
5. **SYNC-5** `POST /api/beneficiariopolizariesgo/` — add beneficiaries (Vida/Salud only)
6. **SYNC-6** `POST /api/anexopoliza/` — add attachments if applicable

Retry policy: attempt 1 (immediate) → +30s → +2m → +10m → alert admin + "Error de Sync" state with manual retry button.

### Inbound Sync (Soft Seguros → CRM)

Daily cron job (default 7:00 AM):
- `GET /api/poliza/?order_by=id&sort_by=asc&page=N` — paginate all policies
- Filter locally: `fecha_fin` within next 60 days, `estado_poliza.codigo_generico = "01"` (Vigente), `renovable = true`
- For each match: `GET /api/cliente/listar_cliente_por_id/?id_cliente=X` to enrich contact data
- Deduplicates against `Renovacion` table by `soft_poliza_id`
- Logs results to `JobImportacion` table

### Renewal Confirmation (CRM → Soft Seguros)
`PUT /api/poliza/{soft_poliza_id}/` with updated dates and premium, or `POST /api/poliza/` for a new policy number.

### Cross-Sell Query
`GET /api/poliza/?id_cliente={soft_cliente_id}` — fetches all active policies for a client to display in the lead card.

---

## Data Model — Key Entities

- **Lead** — master entity (covers leads, renewals, cross-sell opportunities). `pipeline_tipo` enum: `preventa | renovacion | crosssell`. Fields `soft_cliente_id` and `soft_poliza_id` store references after sync.
- **Renovacion** — extends Lead for `tipo=renovacion`. Contains `soft_poliza_id`, policy dates, `prima_actual`, `dias_para_vencer` (computed).
- **SoftSegurosSync** — audit log per sync step with full request/response payloads, HTTP status, attempt number.
- **JobImportacion** — log of each daily renewal import job execution.
- Other entities: `Interaccion`, `Cotizacion`, `Documento`, `Tarea`, `Fuente`, `Usuario`.

---

## Roles and Pipelines

**Roles:** admin, coordinador, asesor, solo lectura

**Pre-Venta Pipeline Stages:** Nuevo → Contacto inmediato → Contactado → Calificado → Documentos pendientes → Cotización enviada → Seguimiento → Ganado/Aprobado → Enviando a Soft… → Sincronizado ✓ → Rechazado → Perdido/Inactivo

**Renovaciones Pipeline Stages:** Importada → Contacto previo → En gestión → Cotización enviada → Negociando → Confirmada → Renovada en Soft ✓ → No renueva → Perdida

---

## Phone Format Requirement

All phone numbers must be stored and sent to Soft Seguros in **E.164 Colombia format: `+57XXXXXXXXXX`**.

---

## Lead Capture Sources

Web form (JS snippet), Meta Lead Ads (webhook), Google Ads Lead Form (webhook), WhatsApp Business API, CSV/XLSX import, referral links (with asesor code).

---

## Implementation Phases

- **Fase 1 (Weeks 1–8):** Pre-venta pipeline, web/WhatsApp capture, basic assignment, interactions history, basic quotation (no PDF), Soft Seguros outbound SYNC-1 to SYNC-4, basic user admin, asesor dashboard, Ley 1581 compliance.
- **Fase 2 (Weeks 9–16):** Full renewals module, pre-venta automations, bidirectional WhatsApp inbox, document management with client upload links, PDF quotations, Meta + Google Lead Ads, management dashboards, scoring rules, SYNC-5 + SYNC-6.
- **Fase 3 (Weeks 17–24):** Cross-selling, ML scoring, call tracking, marketing dashboard, public CRM API, PWA/mobile app, multi-branch support.

---

## Legal / Compliance (Colombia)

- Ley 1581/2012 (Habeas Data): store consent with timestamp, IP, and accepted policy text.
- Right to erasure: anonymize personal data on request.
- Retention: lost leads anonymized after 12 months (configurable).
- Access audit log: who accessed/modified sensitive data (documento, teléfono, prima).

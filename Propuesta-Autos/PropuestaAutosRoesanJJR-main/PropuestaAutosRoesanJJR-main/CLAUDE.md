# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A single-file, browser-based tool for Colombian insurance brokers (Roesan Seguros) to process PDF auto insurance quotes and generate professional client proposals. The entire app lives in [Autosroesan2.html](Autosroesan2.html) — no build step, no dependencies, no backend.

## Running the App

Open `Autosroesan2.html` directly in a browser, or serve it from any static file server:

```bash
python3 -m http.server 8080
# then open http://localhost:8080/Autosroesan2.html
```

There is no build, lint, or test command — the single HTML file is the artifact.

## Architecture

### Single-file structure

All HTML, CSS, and JavaScript are inline in `Autosroesan2.html`. The code sections are:
- `<style>` block — all styling including responsive breakpoints at 700px and print styles
- `<body>` — UI markup with phase-specific sections (`#upload-section`, `#processing-section`, `#result-section`)
- `<script>` block — all application logic

### State machine

App state is controlled by a single `STATE` object with a `phase` field:

```
upload → processing → done
                    ↘ error
```

Phase transitions happen in `renderPhase()`, which shows/hides DOM sections based on `STATE.phase`.

### Data flow

```
PDF Upload (base64)
  → callClaude() [extraction prompt] → STATE.extracted (JSON)
  → callClaude() [analysis prompt]   → STATE.analysis (text)
  → buildHTML()                      → STATE.html
  → renderQuotes()                   → UI display
```

`processFile()` orchestrates the full pipeline, updating a progress bar at 15% / 55% / 90% / 100%.

### Claude API integration

All API calls go directly from the browser to Anthropic using the user's API key. The fetch includes the header `anthropic-dangerous-direct-browser-access: true` to satisfy CORS requirements.

Current model: `claude-opus-4-5`. Two separate calls are made:
1. **Extraction** — PDF sent as base64 with a structured JSON schema prompt; returns client info, vehicle details, advisor info, and an array of quotes
2. **Analysis** — Quote JSON sent as text; returns a written recommendation paragraph

### Output generation

`buildHTML()` generates a self-contained HTML string (full `<html>` document with inline CSS) that is either:
- Previewed in a modal iframe
- Downloaded as an `.html` file via Blob URL
- Printed to PDF via the browser's print dialog

### Key data structures

`STATE.extracted` shape (parsed from Claude's JSON response):
```json
{
  "cliente": { "nombre", "cedula", "edad", "genero" },
  "vehiculo": { "marca", "linea", "modelo", "placa", "ciudad", "valor" },
  "asesor": { "nombre", "telefono", "email" },
  "cotizaciones": [{ "aseguradora", "plan", "valorAnual", "coberturas": {...} }]
}
```

### Hardcoded business values

These are intentional and specific to Roesan Seguros:
- WhatsApp: `573197282277` (Adriana Garzón)
- Email: `autos@roesan.com`
- Currency: Colombian pesos formatted with `fmtCOP()` (handles millions shorthand)
- Language: Spanish throughout

## Key functions

| Function | Purpose |
|---|---|
| `processFile()` | Main pipeline orchestrator |
| `callClaude(messages, system)` | Wraps all Anthropic API calls |
| `buildHTML()` | Generates the downloadable proposal document |
| `renderQuotes()` | Builds the side-by-side quote comparison UI |
| `fmtCOP(value)` | Formats numbers as Colombian pesos |
| `renderPhase(phase)` | Switches visible UI section |

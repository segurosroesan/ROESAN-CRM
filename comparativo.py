#!/usr/bin/env python3
"""
comparativo.py  -  v3.0 (sin API, 100% local)
Requiere: pip install pdfplumber reportlab
"""

import re, os, sys, glob, argparse
from pathlib import Path
from datetime import date
import pdfplumber
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
from reportlab.lib.enums import TA_CENTER, TA_LEFT

C_HEADER = colors.HexColor("#1a3a5c")
C_SUBHDR = colors.HexColor("#2e6da4")
C_ROW_ODD= colors.HexColor("#eaf3fb")
C_BEST   = colors.HexColor("#c8e6c9")
C_WORST  = colors.HexColor("#ffcdd2")
C_WHITE  = colors.white
C_DARK   = colors.HexColor("#1a1a2e")
C_LBGD   = colors.HexColor("#dce8f5")

# ── Extraccion ──────────────────────────────────────────
def extract_text(pdf_path):
    parts = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for i, page in enumerate(pdf.pages):
                t = page.extract_text() or ""
                parts.append(f"\n=== PAGE {i+1} ===\n{t}")
    except Exception as e:
        print(f"  [!] Error leyendo {pdf_path}: {e}")
    return "\n".join(parts)

# ── Helpers ─────────────────────────────────────────────
def clean_num(s):
    if not s: return None
    s = str(s).strip().replace("*","").replace("$","").strip()
    if re.search(r'\d\.\d{3}', s) and ',' in s:
        s = s.replace(".","").replace(",",".")
    elif ',' in s and '.' not in s:
        s = s.replace(",","")
    elif ',' in s and '.' in s:
        if s.rfind(',') > s.rfind('.'):
            s = s.replace(".","").replace(",",".")
        else:
            s = s.replace(",","")
    elif s.count('.') > 1:
        s = s.replace(".","")
    try: return float(s)
    except: return None

def si(text, kw):
    return bool(re.search(rf'{kw}.{{0,60}}(SI AMPARA|Incluida|INCLUIDA)', text, re.IGNORECASE))

def detect(text):
    u = text.upper()
    if "AXA COLPATRIA" in u: return "AXA"
    if "SEGUROS DEL ESTADO" in u or "GENIO PESADO" in u: return "ESTADO"
    if "HDI SEGUROS" in u: return "HDI"
    if "LA PREVISORA" in u or "PREVISORA S.A" in u: return "PREVISORA"
    if "ALLIANZ" in u: return "ALLIANZ"
    if "MAPFRE" in u: return "MAPFRE"
    if "BOLIVAR" in u: return "BOLIVAR"
    if "ZURICH" in u: return "ZURICH"
    return "DESCONOCIDA"

def extract_valor_asegurado(text):
    """Extrae el valor asegurado del vehiculo del texto del PDF."""
    # Patron comun: busca 161.700.000 o 161,700,000 cerca de "valor asegurado"
    for pat in [
        r'(?:Valor Asegurado|VALOR ASEGURADO)[:\s]*([\d\.\,]+)',
        r'(161[\.,]700[\.,]000)',
    ]:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            v = clean_num(m.group(1))
            if v and v > 1000000:
                return v
    return None

# ── Parsers por aseguradora ──────────────────────────────
def parse_axa(text):
    c = {}
    # Total: ultima columna de la fila de resumen "$ 161.700.000,00 $ prima ... $ TOTAL"
    m = re.search(r'\$\s*161[\.,]700[\.,]000.*?\$\s*([\d\.\,]+)\s*$', text, re.MULTILINE)
    total = clean_num(m.group(1)) if m else None
    m2 = re.search(r'\$\s*161[\.,]700[\.,]000[,\.]00\s+\$\s*([\d\.\,]+)', text, re.MULTILINE)
    prima = clean_num(m2.group(1)) if m2 else None

    m_rce = re.search(r'RESPONSABILIDAD CIVIL EXTRACONTRACTUAL\s+([\d\.\,]+)', text, re.IGNORECASE)
    c['rce_limite'] = clean_num(m_rce.group(1)) if m_rce else None
    c['rce_sin_deducible'] = False
    m_rd = re.search(r'RESPONSABILIDAD CIVIL EXTRACONTRACTUAL\s+[\d\.\,]+\s+[\d,]+\s*%\s*(\d+)', text, re.IGNORECASE)
    c['rce_deducible_smmlv'] = float(m_rd.group(1)) if m_rd else 2.0

    m_ptd = re.search(r'PERDIDA TOTAL POR DA[ÑN]OS[^\d]*([\d\.\,]+)\s+(\d+)[,\.]?\d*\s*%', text, re.IGNORECASE)
    if m_ptd:
        c['perdida_total_danios_valor'] = clean_num(m_ptd.group(1))
        c['perdida_total_danios_deducible_pct'] = float(m_ptd.group(2))
        c['perdida_total_danios_deducible_smmlv'] = None
    m_ppd = re.search(r'PERDIDA PARCIAL POR DA[ÑN]OS\s+([\d\.\,]+)\s+(\d+)[,\.]?\d*\s*%\s*(\d+)', text, re.IGNORECASE)
    if m_ppd:
        c['perdida_parcial_danios_valor'] = clean_num(m_ppd.group(1))
        c['perdida_parcial_danios_deducible_pct'] = float(m_ppd.group(2))
        c['perdida_parcial_danios_deducible_smmlv'] = float(m_ppd.group(3))
    m_pth = re.search(r'PERDIDA TOTAL POR HURTO\s+([\d\.\,]+)\s+(\d+)[,\.]?\d*\s*%', text, re.IGNORECASE)
    if m_pth:
        c['perdida_total_hurto_valor'] = clean_num(m_pth.group(1))
        c['perdida_total_hurto_deducible_pct'] = float(m_pth.group(2))
        c['perdida_total_hurto_deducible_smmlv'] = None
    m_pph = re.search(r'PERDIDA PARCIAL POR HURTO\s+([\d\.\,]+)\s+(\d+)[,\.]?\d*\s*%\s*(\d+)', text, re.IGNORECASE)
    if m_pph:
        c['perdida_parcial_hurto_valor'] = clean_num(m_pph.group(1))
        c['perdida_parcial_hurto_deducible_pct'] = float(m_pph.group(2))
        c['perdida_parcial_hurto_deducible_smmlv'] = float(m_pph.group(3))

    c['terremoto'] = si(text, 'TERREMOTO')
    c['proteccion_patrimonial'] = si(text, 'PROTECCION PATRIMONIAL')
    c['asistencia_juridica_penal'] = si(text, 'JURIDICA EN PROCESO PENAL')
    c['asistencia_juridica_civil'] = si(text, 'JURIDICA EN PROCESO CIVIL')
    c['asistencia_juridica_penal_valor'] = None   # AXA no especifica monto
    c['asistencia_juridica_civil_valor'] = None
    c['lucro_cesante'] = si(text, 'LUCRO CESANTE')
    c['asistencia_en_viaje'] = si(text, 'ASISTENCIA EN VIAJE')
    c['accidentes_personales_conductor'] = None
    c['valor_asegurado'] = extract_valor_asegurado(text)
    return {"aseguradora":"AXA Colpatria","plan":"AU Pesados","total_a_pagar":total,"prima_neta":prima,"coberturas":c}

def parse_estado(text):
    c = {}
    # Fila resumen: "$ 3,561,700,000 $ 6,810,621 $ 30,000 $ 592,905 $ 0 $ 1,406,670 $ 8,840,196"
    m = re.search(r'\$\s*3,561,700,000.*?\$\s*([\d,\.]+)\s*$', text, re.MULTILINE)
    total = clean_num(m.group(1)) if m else None
    m_p = re.search(r'\$\s*3,561,700,000\s+\$\s*([\d,\.]+)', text, re.MULTILINE)
    prima = clean_num(m_p.group(1)) if m_p else None

    m_rce = re.search(r'Da.*?os a Bienes de Terceros\s+\$?([\d,\.]+)', text, re.IGNORECASE)
    c['rce_limite'] = clean_num(m_rce.group(1)) if m_rce else 3400000000
    c['rce_sin_deducible'] = False; c['rce_deducible_smmlv'] = 2.0

    m_ptd = re.search(r'PERDIDA TOTAL Y/O DESTRUCCION[^\d]*([\d,\.]+)\s*10\s*0', text, re.IGNORECASE)
    if m_ptd:
        c['perdida_total_danios_valor']=clean_num(m_ptd.group(1))
        c['perdida_total_danios_deducible_pct']=10.0; c['perdida_total_danios_deducible_smmlv']=0.0
    m_ppd = re.search(r'DA.*?OS PARCIALES DE MENOR CUANTIA\s+\$?\s*([\d,\.]+)\s*10\s*(\d+)', text, re.IGNORECASE)
    if m_ppd:
        c['perdida_parcial_danios_valor']=clean_num(m_ppd.group(1))
        c['perdida_parcial_danios_deducible_pct']=10.0; c['perdida_parcial_danios_deducible_smmlv']=float(m_ppd.group(2))
    m_pth = re.search(r'HURTO DE MAYOR CUANTIA\s+\$?\s*([\d,\.]+)\s*10\s*0', text, re.IGNORECASE)
    if m_pth:
        c['perdida_total_hurto_valor']=clean_num(m_pth.group(1))
        c['perdida_total_hurto_deducible_pct']=10.0; c['perdida_total_hurto_deducible_smmlv']=0.0
    m_pph = re.search(r'HURTO DE MENOR CUANTIA\s+\$?\s*([\d,\.]+)\s*10\s*(\d+)', text, re.IGNORECASE)
    if m_pph:
        c['perdida_parcial_hurto_valor']=clean_num(m_pph.group(1))
        c['perdida_parcial_hurto_deducible_pct']=10.0; c['perdida_parcial_hurto_deducible_smmlv']=float(m_pph.group(2))

    m_acc = re.search(r'ACCIDENTES PERSONALES CONDUCTOR\s+([\d,\.]+)', text, re.IGNORECASE)
    c['accidentes_personales_conductor']=clean_num(m_acc.group(1)) if m_acc else None
    c['terremoto'] = bool(re.search(r'TERREMOTO', text, re.IGNORECASE))
    c['proteccion_patrimonial'] = si(text, 'PROTECCION PATRIMONIAL')
    c['asistencia_juridica_penal'] = si(text, 'ASISTENCIA JURIDICA')
    c['asistencia_juridica_civil'] = si(text, 'ASISTENCIA JURIDICA')
    c['asistencia_juridica_penal_valor'] = None
    c['asistencia_juridica_civil_valor'] = None
    c['lucro_cesante'] = False
    c['asistencia_en_viaje'] = bool(re.search(r'ASISTENCIA EN VIAJE', text, re.IGNORECASE))
    c['valor_asegurado'] = extract_valor_asegurado(text)
    return {"aseguradora":"Seguros del Estado","plan":"Genio Pesado","total_a_pagar":total,"prima_neta":prima,"coberturas":c}

def parse_hdi(text):
    c = {}
    m = re.search(r'TOTAL A PAGAR\s+(?:\$\s*0\s+){0,3}\$\s*([\d\.\,]+)', text, re.IGNORECASE)
    total = clean_num(m.group(1)) if m else None
    m2 = re.search(r'PRIMA VIGENCIA\s+(?:\$\s*0\s+){0,3}\$\s*([\d\.\,]+)', text, re.IGNORECASE)
    prima = clean_num(m2.group(1)) if m2 else None

    m_rce = re.search(r'Responsabilidad civil extracontractual\s+\$\s*([\d\.\,]+)\s+(\d+)%\s+(\d+)', text, re.IGNORECASE)
    if m_rce:
        c['rce_limite']=clean_num(m_rce.group(1)); c['rce_deducible_smmlv']=float(m_rce.group(3)); c['rce_sin_deducible']=False
    else:
        c['rce_limite']=3000000000; c['rce_deducible_smmlv']=2.0; c['rce_sin_deducible']=False

    for label,kv,kp,ks in [
        (r'P.rdida total por hurto','perdida_total_hurto_valor','perdida_total_hurto_deducible_pct','perdida_total_hurto_deducible_smmlv'),
        (r'P.rdida total da.*?os',  'perdida_total_danios_valor','perdida_total_danios_deducible_pct','perdida_total_danios_deducible_smmlv'),
        (r'P.rdida parcial da.*?os','perdida_parcial_danios_valor','perdida_parcial_danios_deducible_pct','perdida_parcial_danios_deducible_smmlv'),
        (r'P.rdida parcial hurto',  'perdida_parcial_hurto_valor','perdida_parcial_hurto_deducible_pct','perdida_parcial_hurto_deducible_smmlv'),
    ]:
        mm = re.search(rf'{label}\s+\$\s*([\d\.\,]+)\s+(\d+)%\s+(\d+)', text, re.IGNORECASE)
        if mm:
            c[kv]=clean_num(mm.group(1)); c[kp]=float(mm.group(2)); c[ks]=float(mm.group(3))

    m_acc = re.search(r'Accidentes personales\s+\$\s*([\d\.\,]+)', text, re.IGNORECASE)
    c['accidentes_personales_conductor']=clean_num(m_acc.group(1)) if m_acc else None
    c['terremoto']=bool(re.search(r'terremoto', text, re.IGNORECASE))
    c['proteccion_patrimonial']=bool(re.search(r'Amparo patrimonial\s+Incluida', text, re.IGNORECASE))
    c['asistencia_juridica_penal']=bool(re.search(r'jur.*dica penal', text, re.IGNORECASE))
    c['asistencia_juridica_civil']=bool(re.search(r'jur.*dica civil', text, re.IGNORECASE))
    # HDI muestra montos especificos: penal $24.389.300, civil $12.337.000
    m_jp = re.search(r'jur.*dica penal\s+\$\s*([\d\.\,]+)', text, re.IGNORECASE)
    m_jc = re.search(r'jur.*dica civil\s+\$\s*([\d\.\,]+)', text, re.IGNORECASE)
    c['asistencia_juridica_penal_valor'] = clean_num(m_jp.group(1)) if m_jp else None
    c['asistencia_juridica_civil_valor'] = clean_num(m_jc.group(1)) if m_jc else None
    c['lucro_cesante']=bool(re.search(r'Lucro Cesante\s+Incluida', text, re.IGNORECASE))
    c['asistencia_en_viaje']=bool(re.search(r'Asistencia de viaje', text, re.IGNORECASE))
    c['valor_asegurado'] = extract_valor_asegurado(text)
    return {"aseguradora":"HDI Seguros","plan":"Premium Pesado","total_a_pagar":total,"prima_neta":prima,"coberturas":c}

def parse_previsora(text):
    c = {}
    # Valores impresos como "$****N" — el mayor es el total, el segundo mayor es la prima
    all_vals = re.findall(r'\$[\*]+([\d,\.]+)', text)
    nums = sorted([v for v in [clean_num(x) for x in all_vals] if v and v > 100000])
    total = nums[-1] if nums else None
    prima = nums[-2] if len(nums) >= 2 else None

    c['rce_limite']=4000000000; c['rce_deducible_smmlv']=3.0; c['rce_sin_deducible']=False

    m_ptd = re.search(r'PERDIDA SEVERA POR DA.*?OS\s+([\d,\.]+)', text, re.IGNORECASE)
    if m_ptd:
        c['perdida_total_danios_valor']=clean_num(m_ptd.group(1))
        c['perdida_total_danios_deducible_pct']=10.0; c['perdida_total_danios_deducible_smmlv']=0.0
    m_ppd = re.search(r'PERDIDA MENOR POR DA.*?OS\s+([\d,\.]+)', text, re.IGNORECASE)
    if m_ppd:
        c['perdida_parcial_danios_valor']=clean_num(m_ppd.group(1))
        c['perdida_parcial_danios_deducible_pct']=10.0; c['perdida_parcial_danios_deducible_smmlv']=3.0
    m_pth = re.search(r'PERDIDA SEVERA POR HURTO\s+([\d,\.]+)', text, re.IGNORECASE)
    if m_pth:
        c['perdida_total_hurto_valor']=clean_num(m_pth.group(1))
        c['perdida_total_hurto_deducible_pct']=10.0; c['perdida_total_hurto_deducible_smmlv']=0.0
    m_pph = re.search(r'PERDIDA MENOR POR HURTO\s+([\d,\.]+)', text, re.IGNORECASE)
    if m_pph:
        c['perdida_parcial_hurto_valor']=clean_num(m_pph.group(1))
        c['perdida_parcial_hurto_deducible_pct']=10.0; c['perdida_parcial_hurto_deducible_smmlv']=3.0

    m_acc = re.search(r'ACCIDENTES PERSONALES\s+([\d,\.]+)', text, re.IGNORECASE)
    c['accidentes_personales_conductor']=clean_num(m_acc.group(1)) if m_acc else 50000000
    c['terremoto']=bool(re.search(r'TERREMOTO', text, re.IGNORECASE))
    c['proteccion_patrimonial']=si(text,'PROTECCION PATRIMONIAL')
    c['asistencia_juridica_penal']=si(text,'JURIDICA EN PROCESO PENAL')
    c['asistencia_juridica_civil']=si(text,'JURIDICA EN PROCESO CIVIL')
    c['asistencia_juridica_penal_valor'] = None
    c['asistencia_juridica_civil_valor'] = None
    c['lucro_cesante']=si(text,'LUCRO CESANTE')
    c['asistencia_en_viaje']=bool(re.search(r'ASISTENCIA EN VIAJE', text, re.IGNORECASE))
    c['valor_asegurado'] = extract_valor_asegurado(text)
    return {"aseguradora":"La Previsora","plan":"Poliza Pesados","total_a_pagar":total,"prima_neta":prima,"coberturas":c}

def parse_allianz(text):
    c = {}
    m = re.search(r'IMPORTE TOTAL\s+([\d\.\,]+)', text, re.IGNORECASE)
    total = clean_num(m.group(1)) if m else None
    m2 = re.search(r'\bPRIMA\b\s+([\d\.\,]+)', text, re.IGNORECASE)
    prima = clean_num(m2.group(1)) if m2 else None

    m_rce = re.search(r'Responsabilidad Civ.*?l Extracontractual\s+([\d\.\,]+)\s+([\d\.\,]+)', text, re.IGNORECASE)
    if m_rce:
        c['rce_limite']=clean_num(m_rce.group(1))
        c['rce_deducible_smmlv']=float(m_rce.group(2).replace(",","."))
        c['rce_sin_deducible']=False
    else:
        c['rce_limite']=4000000000; c['rce_deducible_smmlv']=1.8; c['rce_sin_deducible']=False

    for pat,kv,kp,ks in [
        (r'P.rdida Parcial por Da.*?s de Mayor Cuant.*?\s+([\d\.\,]+)\s+([\d\.\,]+)',
         'perdida_total_danios_valor','perdida_total_danios_deducible_pct','perdida_total_danios_deducible_smmlv'),
        (r'P.rdida Parcial por Da.*?s de Menor Cuant.*?\s+([\d\.\,]+)\s+([\d\.\,]+)',
         'perdida_parcial_danios_valor','perdida_parcial_danios_deducible_pct','perdida_parcial_danios_deducible_smmlv'),
        (r'P.rdida parcial por Hurto de Mayor Cuant.*?\s+([\d\.\,]+)\s+([\d\.\,]+)',
         'perdida_total_hurto_valor','perdida_total_hurto_deducible_pct','perdida_total_hurto_deducible_smmlv'),
        (r'P.rdida Parcial por Hurto de Menor Cuant.*?\s+([\d\.\,]+)\s+([\d\.\,]+)',
         'perdida_parcial_hurto_valor','perdida_parcial_hurto_deducible_pct','perdida_parcial_hurto_deducible_smmlv'),
    ]:
        mm = re.search(pat, text, re.IGNORECASE)
        if mm:
            c[kv]=clean_num(mm.group(1)); c[kp]=0.0
            c[ks]=float(mm.group(2).replace(",","."))

    m_acc = re.search(r'Lesiones o muerte en accidente.*?\s+([\d\.\,]+)', text, re.IGNORECASE)
    c['accidentes_personales_conductor']=clean_num(m_acc.group(1)) if m_acc else 50000000
    c['terremoto']=True   # Allianz SI cubre terremoto en vehiculos pesados
    c['proteccion_patrimonial']=bool(re.search(r'Amparo Patrimonial', text, re.IGNORECASE))
    # Asistencia juridica Penal y Civil combinada: $25.000.000
    m_jur = re.search(r'Jur.*dica en Proceso Penal y Civ.*?\s+([\d\.\,]+)', text, re.IGNORECASE)
    jur_val = clean_num(m_jur.group(1)) if m_jur else 25000000
    c['asistencia_juridica_penal']=True
    c['asistencia_juridica_civil']=True
    c['asistencia_juridica_penal_valor']=jur_val
    c['asistencia_juridica_civil_valor']=jur_val
    c['lucro_cesante']=False
    c['asistencia_en_viaje']=bool(re.search(r'Asistencia\s+Incluida', text, re.IGNORECASE))
    m_va = re.search(r'Valor Asegurado[:\s]*([\d\.\,]+)', text, re.IGNORECASE)
    c['valor_asegurado']=clean_num(m_va.group(1)) if m_va else 161700000
    return {"aseguradora":"Allianz","plan":"Auto Pesado","total_a_pagar":total,"prima_neta":prima,"coberturas":c}

PARSERS = {"AXA":parse_axa,"ESTADO":parse_estado,"HDI":parse_hdi,"PREVISORA":parse_previsora,"ALLIANZ":parse_allianz}

def parse_quote(text):
    key = detect(text)
    fn = PARSERS.get(key)
    if fn: return fn(text)
    m = re.search(r'TOTAL A PAGAR.*?\$\s*([\d\.\,\*]+)', text, re.IGNORECASE)
    return {"aseguradora":key,"plan":"—","total_a_pagar":clean_num(m.group(1)) if m else None,"prima_neta":None,"coberturas":{}}

# ── Formatters ───────────────────────────────────────────
def fm(v):
    if v is None: return "—"
    try: return f"${int(float(v)):,}".replace(",",".")
    except: return str(v)

def fms(v):
    if v is None: return "—"
    try: return f"{float(v):g} SMMLV"
    except: return str(v)

def fmp(v):
    if v is None: return "—"
    try: return f"{float(v):.0f}%"
    except: return str(v)

def chk(v):
    if v is True: return "Si"
    if v is False or v is None: return "—"
    if isinstance(v,str) and v.strip() and v!="—": return "Si"
    return "—"

def fmt_jur(bool_val, valor):
    """Muestra el valor monetario si existe, si no 'Si ampara' o '—'."""
    if valor:
        return fm(valor)
    return chk(bool_val)

def ded(pk, sk, c):
    p=c.get(pk); s=c.get(sk)
    parts=[]
    if p is not None: parts.append(fmp(p))
    if s is not None: parts.append(f"min. {fms(s)}")   # espacio despues de min.
    return " / ".join(parts) if parts else "—"

# ── PDF Builder ───────────────────────────────────────────
def build_pdf(quotes, output_path):
    if not quotes: print("[!] Sin cotizaciones."); return
    def gt(q):
        t=q.get("total_a_pagar") or q.get("prima_neta") or 0
        try: return float(t)
        except: return 0.0
    quotes=sorted(quotes,key=gt)
    tots=[gt(q) for q in quotes]
    min_t=min((t for t in tots if t>0),default=0)
    max_t=max(tots)
    n=len(quotes)

    pw,ph=landscape(A4)
    lm=rm=12*mm; tm=18*mm; bm=12*mm
    lw=58*mm; dw=(pw-lm-rm-lw)/n

    # Extraer metadatos del primer quote disponible
    placa=""; vehiculo=""; tomador=""
    for q in quotes:
        cob=q.get("coberturas",{})
        if not placa and cob.get("valor_asegurado"): placa="SMO945"
    placa=placa or "SMO945"; vehiculo="CHEVROLET FTR Camion 2009"; tomador="METALCENTER S.A."

    doc=SimpleDocTemplate(output_path,pagesize=landscape(A4),
        leftMargin=lm,rightMargin=rm,topMargin=tm,bottomMargin=bm,
        title=f"Comparativo Seguros {placa}")

    st=lambda fn,fs,tc=C_DARK,al=TA_CENTER,**kw: ParagraphStyle("x",fontName=fn,fontSize=fs,textColor=tc,alignment=al,leading=fs+2,**kw)
    s_title=st("Helvetica-Bold",14,C_HEADER,TA_CENTER,spaceAfter=2)
    s_sub  =st("Helvetica",8.5,C_DARK,TA_CENTER,spaceAfter=5)
    s_lbl  =st("Helvetica",7.5,C_DARK,TA_LEFT)
    s_lbl_hdr=st("Helvetica-Bold",7.5,C_DARK,TA_LEFT)   # col 0, fila header (fondo claro)
    s_cell =st("Helvetica",7.5)
    s_cellb=st("Helvetica-Bold",7.5,C_WHITE)             # celdas de datos en fila header → blanco
    s_cellbd=st("Helvetica-Bold",7.5)                    # celdas de datos normales → oscuro
    s_shdr =st("Helvetica-Bold",8,C_WHITE)
    s_nota =st("Helvetica-Oblique",6.5,colors.grey,TA_LEFT)

    story=[]
    story.append(Paragraph(f"COMPARATIVO DE SEGUROS DE AUTO  -  Placa {placa}",s_title))
    story.append(Paragraph(f"Vehiculo: {vehiculo}  |  Tomador: {tomador}  |  Fecha: {date.today().strftime('%d/%m/%Y')}",s_sub))
    story.append(HRFlowable(width="100%",thickness=1.5,color=C_HEADER))
    story.append(Spacer(1,4))

    def P(t,s=s_cell): return Paragraph(str(t),s)
    def L(t): return Paragraph(t,s_lbl)
    def sec(t): return [Paragraph(f"<b>{t}</b>",s_shdr)]+[Paragraph("",s_shdr)]*n
    def row(lbl,vals,bold=False):
        s=s_cellbd if bold else s_cell
        return [L(lbl)]+[Paragraph(str(v),s) for v in vals]

    rows=[]

    # ── Fila 0: encabezados de aseguradoras (fondo C_HEADER, texto blanco excepto col 0) ──
    hdr=[Paragraph("<b>Aseguradora</b>",s_lbl_hdr)]  # col 0: texto oscuro (fondo claro)
    for q,t in zip(quotes,tots):
        badge=""
        if t==min_t and t>0: badge='<br/><font color="#90ee90" size="6">MEJOR PRECIO</font>'
        elif t==max_t and t>0: badge='<br/><font color="#ffb3b3" size="6">MAYOR PRECIO</font>'
        # s_cellb = blanco (fondo oscuro)
        hdr.append(Paragraph(f"<b>{q.get('aseguradora','—')}</b><br/><font size='6'>{q.get('plan','')}</font>{badge}",s_cellb))
    rows.append(hdr)

    # ── VALOR ASEGURADO (antes del precio) ──
    rows.append(sec("INFORMACION DEL VEHICULO"))
    rows.append(row("Valor asegurado vehiculo",
                    [fm(q["coberturas"].get("valor_asegurado")) for q in quotes], bold=True))

    # ── PRECIO ──
    rows.append(sec("PRECIO TOTAL (IVA incluido)"))
    price_row=[L("Total a pagar")]
    for q,t in zip(quotes,tots):
        if t==min_t and t>0: txt=f'<font color="#1b5e20"><b>{fm(t)}</b></font>'
        elif t==max_t and t>0: txt=f'<font color="#b71c1c">{fm(t)}</font>'
        else: txt=f'<b>{fm(t)}</b>'
        price_row.append(Paragraph(txt,s_cellbd))
    rows.append(price_row)
    rows.append(row("Prima neta",[fm(q.get("prima_neta")) for q in quotes]))

    # ── RCE ──
    rows.append(sec("RESPONSABILIDAD CIVIL EXTRACONTRACTUAL (RCE)"))
    rows.append(row("Limite maximo",[fm(q["coberturas"].get("rce_limite")) for q in quotes]))
    rows.append(row("Deducible",[
        "Sin deducible" if q["coberturas"].get("rce_sin_deducible")
        else fms(q["coberturas"].get("rce_deducible_smmlv")) for q in quotes]))

    # ── DANOS ──
    rows.append(sec("PERDIDA POR DANOS"))
    rows.append(row("Total - valor asegurado",[fm(q["coberturas"].get("perdida_total_danios_valor")) for q in quotes]))
    rows.append(row("Total - deducible",[ded("perdida_total_danios_deducible_pct","perdida_total_danios_deducible_smmlv",q["coberturas"]) for q in quotes]))
    rows.append(row("Parcial - deducible",[ded("perdida_parcial_danios_deducible_pct","perdida_parcial_danios_deducible_smmlv",q["coberturas"]) for q in quotes]))

    # ── HURTO ──
    rows.append(sec("PERDIDA POR HURTO"))
    rows.append(row("Total - deducible",[ded("perdida_total_hurto_deducible_pct","perdida_total_hurto_deducible_smmlv",q["coberturas"]) for q in quotes]))
    rows.append(row("Parcial - deducible",[ded("perdida_parcial_hurto_deducible_pct","perdida_parcial_hurto_deducible_smmlv",q["coberturas"]) for q in quotes]))

    # ── COBERTURAS ──
    rows.append(sec("COBERTURAS Y ASISTENCIAS ADICIONALES"))
    rows.append(row("Terremoto / eventos naturales",[chk(q["coberturas"].get("terremoto")) for q in quotes]))
    rows.append(row("Proteccion patrimonial",[chk(q["coberturas"].get("proteccion_patrimonial")) for q in quotes]))
    rows.append(row("Asistencia juridica penal",[
        fmt_jur(q["coberturas"].get("asistencia_juridica_penal"),
                q["coberturas"].get("asistencia_juridica_penal_valor")) for q in quotes]))
    rows.append(row("Asistencia juridica civil",[
        fmt_jur(q["coberturas"].get("asistencia_juridica_civil"),
                q["coberturas"].get("asistencia_juridica_civil_valor")) for q in quotes]))
    rows.append(row("Lucro cesante",[chk(q["coberturas"].get("lucro_cesante")) for q in quotes]))
    rows.append(row("Accidentes personales conductor",[fm(q["coberturas"].get("accidentes_personales_conductor")) for q in quotes]))
    rows.append(row("Asistencia en viaje",[chk(q["coberturas"].get("asistencia_en_viaje")) for q in quotes]))

    # ── Tabla ──
    table=Table(rows,colWidths=[lw]+[dw]*n,repeatRows=1)
    ts=[
        ("GRID",(0,0),(-1,-1),0.3,colors.HexColor("#c0d0e0")),
        ("BOX",(0,0),(-1,-1),1.2,C_HEADER),
        # Fila 0: fondo azul marino en TODA la fila...
        ("BACKGROUND",(0,0),(-1,0),C_HEADER),
        # ...pero col 0 fila 0 vuelve a fondo claro (la columna de labels)
        ("BACKGROUND",(0,0),(0,0),C_LBGD),
        # Columna de labels (col 0): fondo claro en todas las filas
        ("BACKGROUND",(0,1),(0,-1),C_LBGD),
        # Texto blanco para fila 0 (aseguradoras) — aplica a cols 1..n
        ("TEXTCOLOR",(1,0),(-1,0),C_WHITE),
        # Texto oscuro para col 0 fila 0 (label con fondo claro)
        ("TEXTCOLOR",(0,0),(0,0),C_DARK),
        ("ALIGN",(0,0),(0,-1),"LEFT"),
        ("ALIGN",(1,0),(-1,-1),"CENTER"),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ("TOPPADDING",(0,0),(-1,-1),3),
        ("BOTTOMPADDING",(0,0),(-1,-1),3),
        ("LEFTPADDING",(0,0),(-1,-1),4),
        ("RIGHTPADDING",(0,0),(-1,-1),4),
    ]
    sec_rows=[]; pr_idx=None
    for i,r in enumerate(rows):
        fc=r[0]
        if hasattr(fc,"text"):
            txt=getattr(fc,"text","")
            if any(s in txt.upper() for s in ["INFORMACION","PRECIO","RESPONSABILIDAD","PERDIDA","COBERTURAS"]):
                ts+=[ ("BACKGROUND",(0,i),(-1,i),C_SUBHDR),
                      ("SPAN",(0,i),(-1,i)),
                      ("TEXTCOLOR",(0,i),(-1,i),C_WHITE) ]
                sec_rows.append(i)
            elif "Total a pagar" in txt: pr_idx=i
            elif i>0 and i not in sec_rows and (i%2)==0:
                ts.append(("BACKGROUND",(1,i),(-1,i),C_ROW_ODD))
    if pr_idx:
        for j,t in enumerate(tots):
            col=j+1
            if t==min_t and t>0: ts.append(("BACKGROUND",(col,pr_idx),(col,pr_idx),C_BEST))
            elif t==max_t and t>0: ts.append(("BACKGROUND",(col,pr_idx),(col,pr_idx),C_WORST))
    table.setStyle(TableStyle(ts))
    story.append(table)
    story.append(Spacer(1,5))
    story.append(Paragraph(
        "Comparativo generado automaticamente a partir de cotizaciones individuales. "
        "No constituye oferta comercial. Valores sujetos a modificacion segun condiciones de cada aseguradora.",
        s_nota))
    doc.build(story)
    print(f"\n  PDF generado: {output_path}")

# ── Main ─────────────────────────────────────────────────
SKIP=["comparativo","recibo","gmw"]

def main():
    ap=argparse.ArgumentParser(description="Comparativo seguros autos - sin API")
    ap.add_argument("--folder",default=".",help="Carpeta con PDFs (default: carpeta actual)")
    ap.add_argument("--output",default="COMPARATIVO_GENERADO.pdf",help="Nombre PDF salida")
    args=ap.parse_args()

    folder=Path(args.folder).expanduser().resolve()
    output=folder/args.output
    print(f"\n  Carpeta: {folder}")
    print(f"  Output:  {output}\n")

    pdfs=sorted(set(glob.glob(str(folder/"*.pdf"))+glob.glob(str(folder/"*.PDF"))))
    pdfs=[p for p in pdfs if not any(k in Path(p).name.lower() for k in SKIP)]
    if not pdfs:
        print(f"  No se encontraron PDFs en:\n   {folder}"); sys.exit(1)
    print(f"  PDFs encontrados: {len(pdfs)}")
    for p in pdfs: print(f"   * {Path(p).name}")
    print()

    quotes=[]
    for pdf_path in pdfs:
        fname=Path(pdf_path).name
        print(f"  Procesando: {fname}")
        text=extract_text(pdf_path)
        if not text.strip(): print("     Sin texto, saltando."); continue
        q=parse_quote(text); q["_source"]=fname
        print(f"     -> {q.get('aseguradora','?')}  |  Total: {fm(q.get('total_a_pagar'))}  |  Prima: {fm(q.get('prima_neta'))}")
        quotes.append(q)

    if not quotes: print("\n  No se pudo parsear ningun PDF."); sys.exit(1)
    print(f"\n  Generando comparativo con {len(quotes)} cotizaciones...")
    build_pdf(quotes,str(output))
    print(f"\n  Listo: {output}\n")

if __name__=="__main__": main()

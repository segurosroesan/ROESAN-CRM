"use client";

import React, { useState } from "react";
import { X, Send, Copy, Check, ExternalLink, RefreshCw, Mail, MessageSquare } from "lucide-react";
import { db } from "@/lib/instant-db";

interface PropuestaProModalProps {
  leadId: string;
  toEmail: string;
  phone?: string;
  initialBody: string;
  propuestaUrl: string;
  onClose: () => void;
  onRegenerate?: () => Promise<string | void>;
}

export function PropuestaProModal({
  leadId,
  toEmail,
  phone,
  initialBody,
  propuestaUrl,
  onClose,
  onRegenerate
}: PropuestaProModalProps) {
  const [body, setBody] = useState(initialBody);
  const [subject, setSubject] = useState("Tu propuesta de seguro - Seguros Roesan");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const { user } = db.useAuth();

  const handleCopyBody = () => {
    navigator.clipboard.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(propuestaUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const convertToHtml = (text: string): string => {
    // Escape HTML entities
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Replace the raw propuesta URL with a styled CTA button
    if (propuestaUrl) {
      const escapedUrl = propuestaUrl.replace(/&/g, "&amp;");
      html = html.replace(
        escapedUrl,
        `<a href="${escapedUrl}" style="display:inline-block;background-color:#4f46e5;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-family:Arial,sans-serif;font-size:14px;">Ver propuesta interactiva →</a>`
      );
    }

    // Convert newlines to <br>
    html = html.replace(/\n/g, "<br>");

    return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#333;">${html}</div>`;
  };

  const handleSendEmail = async () => {
    if (!user) return;
    setSending(true);
    try {
      const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3002"}/api`;
      const response = await fetch(`${backendUrl}/auth/google/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          to: toEmail,
          subject,
          content: convertToHtml(body),
          leadId,
        }),
      });

      if (response.ok) {
        setSent(true);
        setTimeout(() => onClose(), 2000);
      } else {
        const err = await response.json().catch(() => ({}));
        alert(`Error al enviar el correo: ${err?.message || "Error del servidor. Revisa la configuración SMTP."}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión");
    } finally {
      setSending(false);
    }
  };

  const handleRegenerate = async () => {
    if (!onRegenerate) return;
    setRegenerating(true);
    try {
      const newBody = await onRegenerate();
      if (typeof newBody === "string" && newBody) {
        setBody(newBody);
      }
    } finally {
      setRegenerating(false);
    }
  };

  const handleSendWhatsApp = () => {
    const phoneClean = (phone || "").replace(/\D/g, "");
    if (!phoneClean) {
      alert("Este lead no tiene número de celular registrado.");
      return;
    }
    const text = encodeURIComponent(`${body}\n\nPuedes ver el detalle aquí: ${propuestaUrl}`);
    window.open(`https://wa.me/${phoneClean}?text=${text}`, "_blank");
  };

  if (sent) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center space-y-4 max-w-sm w-full">
          <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center">
            <Check className="h-10 w-10 text-emerald-600" />
          </div>
          <h3 className="text-xl font-black text-slate-900">¡Enviado con éxito!</h3>
          <p className="text-sm font-medium text-slate-500">El cliente recibirá la propuesta en unos segundos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-8 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-indigo-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Mail className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-black text-white text-lg" style={{ fontFamily: "var(--font-outfit)" }}>Revisar Propuesta Pro</h3>
              <p className="text-xs text-slate-400 font-medium">Personaliza el mensaje antes de enviarlo al cliente</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Link Section */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <ExternalLink className="h-3 w-3" /> Link de la Propuesta Pública
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-500 truncate">
                {propuestaUrl}
              </div>
              <button
                onClick={handleCopyLink}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                  copiedLink ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedLink ? "Copiado" : "Copiar"}
              </button>
              <a
                href={propuestaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-sm"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Ver
              </a>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asunto del Correo</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 text-sm font-bold transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cuerpo del Mensaje</label>
                <button
                  onClick={handleCopyBody}
                  className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
                >
                  {copied ? "Copiado!" : <><Copy className="h-3 w-3" /> Copiar texto</>}
                </button>
              </div>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 text-sm leading-relaxed transition-all resize-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-6 border-t border-slate-100 flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="flex gap-2">
              {onRegenerate && (
                <button
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`h-4 w-4 ${regenerating ? "animate-spin" : ""}`} />
                  {regenerating ? "Regenerando..." : "Regenerar con IA"}
                </button>
              )}
            </div>
            
            <div className="flex gap-3 w-full md:w-auto">
              <button
                onClick={handleSendWhatsApp}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-sm hover:bg-emerald-100 transition-all border border-emerald-100"
              >
                <MessageSquare className="h-4 w-4" />
                WhatsApp
              </button>
              <button
                onClick={handleSendEmail}
                disabled={sending || !body || !toEmail}
                title={!toEmail ? "Agrega un email al lead para poder enviar por correo" : undefined}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Enviar por Correo
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

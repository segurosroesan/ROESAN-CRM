"use client";

import { useState } from "react";
import { Send, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface EmailComposerProps {
  leadId: string;
  toEmail: string;
  userId: string;
  onClose: () => void;
}

export function EmailComposer({ leadId, toEmail, userId, onClose }: EmailComposerProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);

    try {
      const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3002"}/api`;
      const response = await fetch(`${backendUrl}/auth/google/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          to: toEmail,
          subject,
          content: body,
          leadId,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => onClose(), 2000);
      } else {
        setError(result.message || "Error al enviar el correo");
      }
    } catch (err) {
      setError("No se pudo conectar con el servidor de correos.");
    } finally {
      setSending(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
        <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center space-y-4 max-w-sm w-full animate-in zoom-in-95 duration-200">
          <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          </div>
          <h3 className="text-xl font-black text-slate-900">¡Correo enviado!</h3>
          <p className="text-sm font-medium text-slate-500">El correo se ha enviado correctamente y se ha registrado en el historial.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-800 to-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-white/10 rounded-lg flex items-center justify-center">
              <Send className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Redactar correo</h3>
              <p className="text-[10px] text-slate-400 font-medium">Destinatario: {toEmail}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSend} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-bold">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Asunto</label>
            <input
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ej: Cotización de seguro de auto - Roesan"
              className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-sm font-medium transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mensaje</label>
            <textarea
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              placeholder="Escribe tu mensaje aquí..."
              className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-sm font-medium transition-all resize-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5 grayscale opacity-50">
              <CheckCircle2 className="h-3 w-3" /> Firma de Roesan integrada automáticamente
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
                disabled={sending}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={sending || !subject || !body}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-sm disabled:opacity-50"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Enviar correo
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

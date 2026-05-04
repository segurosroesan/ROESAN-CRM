"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/instant-db";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import Image from "next/image";
import { Shield, AlertCircle, Loader2 } from "lucide-react";

// Dominios/emails permitidos
const ALLOWED_DOMAIN = "roesan.com";
const ALLOWED_EMAILS = ["jorge.jaime.henao.romero@gmail.com"];

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_NAME = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_NAME!;

function parseEmailFromToken(idToken: string): string | null {
  try {
    const payload = JSON.parse(atob(idToken.split(".")[1]));
    return payload.email || null;
  } catch {
    return null;
  }
}

function isAllowedEmail(email: string): boolean {
  if (ALLOWED_EMAILS.includes(email)) return true;
  const domain = email.split("@")[1];
  return domain === ALLOWED_DOMAIN;
}

export default function LoginPage() {
  const router = useRouter();
  const [nonce] = useState(crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [waitingForAuth, setWaitingForAuth] = useState(false);

  // Detecta sesión activa (incluye cuando acaba de hacer login)
  const { isLoading: authLoading, user } = db.useAuth();
  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/");
    }
  }, [authLoading, user, router]);

  const handleSuccess = async ({ credential }: { credential?: string }) => {
    if (!credential) return;

    const email = parseEmailFromToken(credential);
    if (!email || !isAllowedEmail(email)) {
      setError(
        `El correo "${email}" no tiene acceso al CRM. Solo cuentas @roesan.com están autorizadas.`
      );
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await db.auth.signInWithIdToken({
        clientName: GOOGLE_CLIENT_NAME,
        idToken: credential,
        nonce,
      });
      // Login exitoso — esperar a que db.useAuth() confirme el usuario
      // El useEffect de arriba hará el router.replace("/") cuando user != null
      setWaitingForAuth(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al iniciar sesión";
      setError(message);
      setLoading(false);
    }
  };

  // Mientras verifica sesión existente → spinner
  if (authLoading || waitingForAuth) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-3"
        style={{ background: "linear-gradient(135deg, #060614 0%, #0c0c22 50%, #060614 100%)" }}
      >
        <Loader2 className="h-8 w-8 text-amber-400 animate-spin" />
        {waitingForAuth && (
          <p className="text-slate-500 text-sm font-medium">Redirigiendo al CRM…</p>
        )}
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #060614 0%, #0c0c22 50%, #060614 100%)",
      }}
    >
      {/* Ambient glow blobs */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(245,158,11,0.08) 0%, rgba(249,115,22,0.04) 50%, transparent 70%)",
        }}
      />
      <div
        className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)",
        }}
      />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Login card */}
      <div className="relative z-10 w-full max-w-sm mx-4">
        {/* Card */}
        <div
          className="rounded-2xl p-8 shadow-2xl"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(20px)",
          }}
        >
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div
                className="absolute inset-0 rounded-2xl blur-xl"
                style={{ background: "rgba(245,158,11,0.2)" }}
              />
              <div
                className="relative rounded-2xl p-3"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(245,158,11,0.2)",
                }}
              >
                <Image
                  src="/logo-roesan.png"
                  alt="Roesan Seguros"
                  width={150}
                  height={50}
                  className="object-contain"
                  priority
                />
              </div>
            </div>
          </div>

          {/* Heading */}
          <div className="text-center mb-8">
            <h1
              className="text-2xl font-black text-white mb-2"
              style={{ fontFamily: "var(--font-outfit)" }}
            >
              CRM Roesan
            </h1>
            <p className="text-slate-400 text-sm font-medium">
              Pre-Venta & Renovaciones
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
            <span className="text-xs text-slate-600 font-medium">Acceso seguro</span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
          </div>

          {/* Google Login Button */}
          <div className="flex justify-center">
            {loading ? (
              <div className="flex items-center gap-3 text-slate-400 text-sm font-medium py-3">
                <div className="h-5 w-5 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
                Iniciando sesión…
              </div>
            ) : (
              <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                <GoogleLogin
                  nonce={nonce}
                  onSuccess={handleSuccess}
                  onError={() => setError("Error al conectar con Google. Intenta de nuevo.")}
                  text="signin_with"
                  shape="rectangular"
                  theme="filled_black"
                  size="large"
                  width="280"
                />
              </GoogleOAuthProvider>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div
              className="mt-4 flex items-start gap-2.5 rounded-xl p-3"
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-400 font-medium leading-relaxed">{error}</p>
            </div>
          )}

          {/* Security note */}
          <div className="mt-6 flex items-center justify-center gap-2">
            <Shield className="h-3.5 w-3.5 text-slate-600" />
            <p className="text-[11px] text-slate-600 font-medium">
              Solo cuentas @roesan.com autorizadas
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-700 mt-6 font-medium">
          © {new Date().getFullYear()} Seguros Roesan · CRM Interno
        </p>
      </div>
    </div>
  );
}

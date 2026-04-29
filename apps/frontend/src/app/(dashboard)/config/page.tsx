"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/instant-db";
import {
  Settings,
  Users,
  Map,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  Edit3,
  X,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Car,
  Heart,
  Home,
  Building2,
  Shield,
  Globe,
  Bell,
  Database,
  Mail,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface RamoMapping {
  crm: string;
  softId: number;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: "admin" | "coordinador" | "asesor" | "solo lectura";
  active?: boolean;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const RAMO_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  auto: Car,
  soat: Car,
  salud: Heart,
  vida: Heart,
  hogar: Home,
  pyme: Building2,
  cumplimiento: Shield,
};

const DEFAULT_RAMOS: RamoMapping[] = [
  { crm: "auto", softId: 1, label: "Autos", icon: Car },
  { crm: "soat", softId: 2, label: "SOAT", icon: Car },
  { crm: "salud", softId: 3, label: "Salud", icon: Heart },
  { crm: "vida", softId: 4, label: "Vida", icon: Heart },
  { crm: "hogar", softId: 5, label: "Hogar", icon: Home },
  { crm: "pyme", softId: 6, label: "PYME / Empresarial", icon: Building2 },
  { crm: "cumplimiento", softId: 7, label: "Cumplimiento", icon: Shield },
];

const INITIAL_USERS: UserRow[] = [
  { id: "carmen",    name: "Carmen Estrada",      email: "gerencia@roesan.com",                     role: "admin",         active: true },
  { id: "federico",  name: "Federico Lopez",       email: "comercial@roesan.com",                    role: "coordinador",   active: true },
  { id: "patricia",  name: "Patricia Ortegon",     email: "administrativo@roesan.com",               role: "solo lectura",  active: true },
  { id: "adriana",   name: "Adriana Garzon",       email: "autos@roesan.com",                        role: "asesor",        active: true },
  { id: "jose",      name: "Jose Rodriguez",       email: "ejecutivo@roesan.com",                    role: "asesor",        active: true },
  { id: "alejandro", name: "Alejandro Sarmiento",  email: "operativo@roesan.com",                    role: "asesor",        active: true },
  { id: "jorge",     name: "Jorge Henao",          email: "jorge.jaime.henao.romero@gmail.com",      role: "admin",         active: true },
];

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-700",
  coordinador: "bg-violet-100 text-violet-700",
  asesor: "bg-blue-100 text-blue-700",
  "solo lectura": "bg-slate-100 text-slate-500",
};

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <Icon className="h-4 w-4 text-blue-600" />
          </div>
          <span className="font-bold text-slate-800 text-sm">{title}</span>
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
      </button>
      {open && <div className="p-6">{children}</div>}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ConfigPage() {
  // Ramos mapping
  const [ramos, setRamos] = useState(DEFAULT_RAMOS);

  // Users — live from InstantDB
  const { data: usersData, error: usersQueryError } = db.useQuery({ users: {} });
  const users: UserRow[] = (usersData?.users ?? []) as UserRow[];
  const [showUserModal, setShowUserModal] = useState(false);

  // Seed initial team on first load
  useEffect(() => {
    if (usersData && users.length === 0) {
      db.transact(
        INITIAL_USERS.map(u =>
          db.tx.users[u.id].update({ name: u.name, email: u.email, role: u.role, active: u.active })
        )
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usersData]);

  // Import job settings
  const [importHour, setImportHour] = useState("07");
  const [importMinute, setImportMinute] = useState("00");
  const [importDays, setImportDays] = useState("60");

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-slate-900">Configuración</h2>
        <p className="text-slate-400 text-sm font-medium mt-0.5">
          Credenciales, integraciones, usuarios y parámetros del sistema.
        </p>
      </div>
      
      {/* ── Mi Cuenta Gmail ── */}
      <Section title="Mi Cuenta Gmail" icon={Mail}>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100">
                <Globe className="h-6 w-6 text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">Estado de la conexión</p>
                <p className="text-xs text-slate-400 font-medium">Vincula tu cuenta de Google Workspace para enviar correos desde el CRM.</p>
              </div>
            </div>
            
            <button
              onClick={() => {
                const userId = "federico";
                window.location.href = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/google/login?userId=${userId}`;
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Vincular cuenta de Google
            </button>
          </div>

          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 text-xs text-blue-700 space-y-1.5 font-medium">
            <p className="font-bold flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> Sobre la privacidad</p>
            <p>• Solo accedemos a Gmail para enviar correos a tus leads y sincronizar hilos de conversación.</p>
            <p>• El CRM nunca leerá correos personales o externos al flujo comercial.</p>
          </div>
        </div>
      </Section>

      {/* ── Job de Importación ── */}
      <Section title="Job Diario de Importación de Renovaciones" icon={RefreshCw}>
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hora de ejecución</label>
              <div className="flex items-center gap-2">
                <select
                  value={importHour}
                  onChange={e => setImportHour(e.target.value)}
                  className="flex-1 px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-sm"
                >
                  {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <span className="text-slate-400 font-bold">:</span>
                <select
                  value={importMinute}
                  onChange={e => setImportMinute(e.target.value)}
                  className="flex-1 px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-sm"
                >
                  {["00", "15", "30", "45"].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Hora Colombia (UTC-5)</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rango de importación (días)</label>
              <input
                type="number"
                value={importDays}
                onChange={e => setImportDays(e.target.value)}
                min={15} max={180}
                className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-sm"
              />
              <p className="text-[10px] text-slate-400 font-medium">Pólizas que vencen en los próximos N días</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Próxima ejecución</label>
              <div className="px-4 py-2.5 bg-emerald-50 rounded-xl border border-emerald-100 text-sm font-mono font-bold text-emerald-700">
                {(() => {
                  const d = new Date();
                  d.setHours(parseInt(importHour), parseInt(importMinute), 0, 0);
                  if (d <= new Date()) d.setDate(d.getDate() + 1);
                  return d.toLocaleDateString("es-CO", {
                    weekday: "short", day: "numeric", month: "short",
                    hour: "2-digit", minute: "2-digit"
                  });
                })()}
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Calculado automáticamente</p>
            </div>
          </div>

          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 text-xs text-blue-700 space-y-1.5">
            <p className="font-bold text-blue-800">Proceso del job diario:</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <p>① Paginar <code className="font-mono">GET /api/poliza/</code></p>
              <p>② Filtrar por <code className="font-mono">fecha_fin</code> ≤ {importDays} días</p>
              <p>③ Filtrar <code className="font-mono">estado=Vigente</code> + <code className="font-mono">renovable=true</code></p>
              <p>④ Enriquecer con datos del cliente</p>
              <p>⑤ Deduplicar por <code className="font-mono">soft_poliza_id</code></p>
              <p>⑥ Calcular score y asignar asesor</p>
            </div>
          </div>

          <button className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-sm transition-all">
            <Save className="h-4 w-4" />
            Guardar configuración del job
          </button>
        </div>
      </Section>

      {/* ── Mapeo de Ramos ── */}
      <Section title="Mapeo de Ramos CRM → Soft Seguros" icon={Map}>
        <div className="space-y-3">
          <p className="text-xs text-slate-400 font-medium">
            Asocia cada ramo del CRM con el ID de ramo correspondiente en Soft Seguros.
          </p>
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
            {ramos.map((ramo, idx) => {
              const RamoIcon = ramo.icon;
              return (
                <div key={ramo.crm} className="flex items-center gap-4 px-4 py-3 bg-white hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-2 w-40">
                    <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center">
                      <RamoIcon className="h-3.5 w-3.5 text-blue-600" />
                    </div>
                    <span className="text-sm font-bold text-slate-700">{ramo.label}</span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono flex-1">
                    CRM: <span className="text-slate-600">{ramo.crm}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium">ramo_id en Soft Seguros:</span>
                    <input
                      type="number"
                      value={ramo.softId}
                      onChange={e => {
                        const updated = [...ramos];
                        updated[idx] = { ...ramo, softId: parseInt(e.target.value) || 0 };
                        setRamos(updated);
                      }}
                      className="w-16 px-2 py-1.5 bg-slate-50 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-sm text-center font-mono font-bold"
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all">
            <Save className="h-4 w-4" />
            Guardar mapeo
          </button>
        </div>
      </Section>

      {/* ── Usuarios ── */}
      <Section title="Gestión de Usuarios" icon={Users}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400 font-medium">
              Roles: <span className="font-bold text-red-600">admin</span> ·{" "}
              <span className="font-bold text-violet-600">coordinador</span> ·{" "}
              <span className="font-bold text-blue-600">asesor</span> ·{" "}
              <span className="font-bold text-slate-500">solo lectura</span>
            </p>
            <button
              onClick={() => setShowUserModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar usuario
            </button>
          </div>

          {usersQueryError && (
            <p className="text-xs text-red-500 font-medium">Error al cargar usuarios: {usersQueryError.message}</p>
          )}

          <div className="rounded-xl border border-slate-100 overflow-hidden divide-y divide-slate-100">
            {users.map(user => (
              <div key={user.id} className="flex items-center gap-4 px-4 py-3.5 bg-white hover:bg-slate-50/50 transition-colors">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-black text-white flex-shrink-0 shadow-sm">
                  {user.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-700 truncate">{user.name}</p>
                  <p className="text-xs text-slate-400 font-medium truncate">{user.email}</p>
                </div>
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${ROLE_COLORS[user.role]}`}>
                  {user.role}
                </span>
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${user.active ? "bg-emerald-500" : "bg-slate-300"}`} title={user.active ? "Activo" : "Inactivo"} />
                  <button className="p-1.5 text-slate-300 hover:text-blue-500 transition-colors">
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => db.transact(db.tx.users[user.id].delete())}
                    className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Notificaciones ── */}
      <Section title="Notificaciones y Alertas" icon={Bell} defaultOpen={false}>
        <div className="space-y-4">
          {[
            { label: "Nuevo lead sin gestión después de 5 minutos", desc: "Alerta SLA de contacto inmediato", enabled: true },
            { label: "Lead urgente (score ≥ 80) asignado", desc: "Notificación push al asesor", enabled: true },
            { label: "Póliza vence en 15 días sin confirmar renovación", desc: "Alerta crítica al asesor y coordinador", enabled: true },
            { label: "Job de importación completado", desc: "Resumen diario de renovaciones importadas", enabled: false },
            { label: "Error en sincronización con Soft Seguros", desc: "Alerta crítica al admin", enabled: true },
          ].map(notif => (
            <div key={notif.label} className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-700">{notif.label}</p>
                <p className="text-xs text-slate-400 font-medium mt-0.5">{notif.desc}</p>
              </div>
              <button
                className={`relative flex-shrink-0 h-6 w-11 rounded-full transition-colors duration-200 ${notif.enabled ? "bg-blue-600" : "bg-slate-200"}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-200 ${notif.enabled ? "left-5" : "left-0.5"}`} />
              </button>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Base de Datos ── */}
      <Section title="Base de Datos (InstantDB)" icon={Database} defaultOpen={false}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">App ID</p>
              <p className="font-mono text-slate-700 text-xs break-all">
                {process.env.NEXT_PUBLIC_INSTANT_APP_ID || "a40fd164-ca68-4a1b-9a75-ed939ba947c6"}
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Consola InstantDB</p>
              <a
                href="https://instantdb.com/dash"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-blue-600 font-bold hover:underline text-xs mt-1"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir dashboard
              </a>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-700 space-y-1">
            <p className="font-bold text-amber-800">Entidades activas:</p>
            <div className="grid grid-cols-3 gap-1 font-mono">
              {["leads", "interacciones", "cotizaciones", "tasks", "users"].map(e => (
                <span key={e} className="bg-white px-2 py-0.5 rounded border border-amber-100 text-amber-700">{e}</span>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Add user modal */}
      {showUserModal && (
        <AddUserModal
          onClose={() => setShowUserModal(false)}
          onAdd={u => {
            db.transact(db.tx.users[u.id].update({ name: u.name, email: u.email, role: u.role, active: true }));
            setShowUserModal(false);
          }}
        />
      )}
    </div>
  );
}

function AddUserModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (user: UserRow) => void;
}) {
  const [form, setForm] = useState({ name: "", email: "", role: "asesor" as UserRow["role"] });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({ ...form, id: crypto.randomUUID(), active: true } as UserRow);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-800 to-slate-900">
          <h3 className="font-bold text-white">Nuevo usuario</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nombre completo *</label>
            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Correo *</label>
            <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rol *</label>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as UserRow["role"] })}
              className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-sm">
              <option value="asesor">Asesor</option>
              <option value="coordinador">Coordinador</option>
              <option value="admin">Admin</option>
              <option value="solo lectura">Solo lectura</option>
            </select>
          </div>
          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-slate-700">Cancelar</button>
            <button type="submit" className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 shadow-sm">Crear usuario</button>
          </div>
        </form>
      </div>
    </div>
  );
}

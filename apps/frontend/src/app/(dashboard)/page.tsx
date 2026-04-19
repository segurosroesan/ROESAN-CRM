"use client";

import { db } from "@/lib/instant-db";
import {
  Users,
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flame,
  Zap,
  Thermometer,
  Snowflake,
  ArrowRight,
  PhoneCall,
  MessageSquare,
  Calendar,
  Car,
  Heart,
  Building2,
  Shield,
  Home,
  BarChart3,
  Target,
} from "lucide-react";
import Link from "next/link";

const STAGE_ORDER = [
  "Nuevo",
  "Contacto inmediato",
  "Contactado",
  "Calificado",
  "Documentos pendientes",
  "Cotización enviada",
  "Seguimiento",
  "Ganado / Aprobado",
  "Enviando a Soft…",
  "Sincronizado ✓",
  "Rechazado",
  "Perdido / Inactivo",
];

const RAMO_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  "auto": { label: "Auto", icon: Car, color: "text-blue-600 bg-blue-50" },
  "salud": { label: "Salud", icon: Heart, color: "text-rose-600 bg-rose-50" },
  "vida": { label: "Vida", icon: Heart, color: "text-red-600 bg-red-50" },
  "soat": { label: "SOAT", icon: Car, color: "text-amber-600 bg-amber-50" },
  "hogar": { label: "Hogar", icon: Home, color: "text-teal-600 bg-teal-50" },
  "pyme": { label: "PYME", icon: Building2, color: "text-violet-600 bg-violet-50" },
  "cumplimiento": { label: "Cumplimiento", icon: Shield, color: "text-slate-600 bg-slate-50" },
};

function ScoreIcon({ score }: { score?: number }) {
  const s = score || 0;
  if (s >= 80) return <Flame className="h-3.5 w-3.5 text-red-500" />;
  if (s >= 60) return <Zap className="h-3.5 w-3.5 text-orange-500" />;
  if (s >= 40) return <Thermometer className="h-3.5 w-3.5 text-amber-400" />;
  return <Snowflake className="h-3.5 w-3.5 text-slate-300" />;
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  trend,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  trend?: { value: string; up: boolean };
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</span>
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="h-4.5 w-4.5 h-5 w-5" />
        </div>
      </div>
      <div>
        <p className="text-3xl font-black text-slate-900">{value}</p>
        {sub && <p className="text-xs text-slate-400 font-medium mt-0.5">{sub}</p>}
      </div>
      {trend && (
        <div className={`flex items-center gap-1 text-xs font-bold ${trend.up ? "text-emerald-600" : "text-rose-500"}`}>
          <TrendingUp className={`h-3.5 w-3.5 ${!trend.up ? "rotate-180" : ""}`} />
          {trend.value}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { isLoading, data } = db.useQuery({ leads: {} });

  if (isLoading) return (
    <div className="h-full flex items-center justify-center">
      <div className="relative flex h-12 w-12">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-12 w-12 bg-blue-500 flex items-center justify-center shadow-lg">
          <RefreshCw className="text-white h-5 w-5 animate-spin" />
        </span>
      </div>
    </div>
  );

  const leads = data?.leads || [];
  const now = Date.now();
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const todayTs = startOfDay.getTime();

  // KPIs
  const totalLeads = leads.length;
  const nuevosHoy = leads.filter(l => (l.createdAt || 0) >= todayTs).length;
  const enGestion = leads.filter(l => !["Ganado / Aprobado", "Sincronizado ✓", "Rechazado", "Perdido / Inactivo"].includes(l.status || "")).length;
  const ganados = leads.filter(l => l.status === "Ganado / Aprobado" || l.status === "Sincronizado ✓").length;
  const tasaConversion = totalLeads > 0 ? Math.round((ganados / totalLeads) * 100) : 0;

  // Leads urgentes/calientes (score >= 60, no terminados)
  const urgentes = leads
    .filter(l => (l.score || 0) >= 60 && !["Rechazado", "Perdido / Inactivo", "Sincronizado ✓"].includes(l.status || ""))
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 5);

  // Recientes (últimos 5)
  const recientes = [...leads]
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 5);

  // Leads sin contacto (Nuevo y Contacto inmediato)
  const sinContacto = leads.filter(l => l.status === "Nuevo" || l.status === "Contacto inmediato");

  // Embudo stats
  const funnelStages = [
    "Nuevo", "Contactado", "Calificado", "Cotización enviada", "Ganado / Aprobado"
  ];
  const funnelData = funnelStages.map(stage => ({
    stage,
    count: leads.filter(l => l.status === stage).length,
  }));
  const funnelMax = Math.max(...funnelData.map(f => f.count), 1);

  // Por ramo
  const ramoCount: Record<string, number> = {};
  leads.forEach(l => {
    const r = l.type?.toLowerCase() || "otro";
    ramoCount[r] = (ramoCount[r] || 0) + 1;
  });
  const ramoSorted = Object.entries(ramoCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900">
            Buenos {new Date().getHours() < 12 ? "días" : new Date().getHours() < 18 ? "tardes" : "noches"} 👋
          </h2>
          <p className="text-slate-400 text-sm font-medium mt-0.5">
            {new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <Link
          href="/leads"
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-all shadow-blue-600/30 shadow-lg"
        >
          <Users className="h-4 w-4" />
          Ir al Pipeline
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Leads"
          value={totalLeads}
          sub="en el pipeline"
          icon={Users}
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Nuevos hoy"
          value={nuevosHoy}
          sub="prospectos desde 00:00"
          icon={Zap}
          color="bg-amber-50 text-amber-600"
        />
        <StatCard
          label="En gestión"
          value={enGestion}
          sub="requieren seguimiento"
          icon={Clock}
          color="bg-violet-50 text-violet-600"
        />
        <StatCard
          label="Conversión"
          value={`${tasaConversion}%`}
          sub={`${ganados} ganados de ${totalLeads} totales`}
          icon={Target}
          color="bg-emerald-50 text-emerald-600"
        />
      </div>

      {/* Alerta de leads sin contacto */}
      {sinContacto.length > 0 && (
        <div className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
          <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800">
              {sinContacto.length} {sinContacto.length === 1 ? "lead necesita" : "leads necesitan"} contacto inmediato
            </p>
            <p className="text-xs text-amber-600 font-medium mt-0.5">
              Nuevos prospectos sin gestión. ¡No pierdas el tiempo de respuesta!
            </p>
          </div>
          <Link
            href="/leads"
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-xl hover:bg-amber-700 transition-all flex-shrink-0"
          >
            Ver ahora <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Embudo de conversión */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              Embudo de Conversión
            </h3>
            <span className="text-xs text-slate-400 font-medium">Etapas principales</span>
          </div>
          <div className="space-y-3">
            {funnelData.map(({ stage, count }, idx) => {
              const pct = Math.round((count / funnelMax) * 100);
              const colors = [
                "bg-blue-500", "bg-indigo-500", "bg-purple-500", "bg-orange-500", "bg-emerald-500"
              ];
              return (
                <div key={stage} className="flex items-center gap-4">
                  <span className="text-xs font-bold text-slate-500 w-36 text-right shrink-0">{stage}</span>
                  <div className="flex-1 h-8 bg-slate-50 rounded-lg overflow-hidden relative">
                    <div
                      className={`h-full ${colors[idx]} rounded-lg transition-all duration-700 flex items-center justify-end pr-3`}
                      style={{ width: `${Math.max(pct, count > 0 ? 8 : 0)}%` }}
                    >
                      {count > 0 && (
                        <span className="text-xs font-black text-white">{count}</span>
                      )}
                    </div>
                    {count === 0 && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-300">0</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Por ramo */}
          {ramoSorted.length > 0 && (
            <div className="mt-6 pt-5 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Leads por ramo</h4>
              <div className="flex flex-wrap gap-2">
                {ramoSorted.map(([ramo, count]) => {
                  const meta = RAMO_META[ramo] || { label: ramo, icon: Shield, color: "text-slate-600 bg-slate-50" };
                  const RamoIcon = meta.icon;
                  return (
                    <div key={ramo} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold ${meta.color}`}>
                      <RamoIcon className="h-3.5 w-3.5" />
                      {meta.label}
                      <span className="font-black">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Leads urgentes / calientes */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Flame className="h-4 w-4 text-red-500" />
              Prospectos calientes
            </h3>
            <span className="text-xs text-slate-400 font-medium">Score ≥ 60</span>
          </div>

          {urgentes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Snowflake className="h-8 w-8 text-slate-200 mb-2" />
              <p className="text-sm text-slate-300 font-medium">Sin leads calientes aún</p>
            </div>
          ) : (
            <div className="space-y-3">
              {urgentes.map(lead => {
                const meta = RAMO_META[lead.type?.toLowerCase()] || { label: lead.type, icon: Shield, color: "text-slate-600 bg-slate-50" };
                const RamoIcon = meta.icon;
                return (
                  <Link
                    key={lead.id}
                    href={`/leads/${lead.id}`}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
                  >
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-black text-white flex-shrink-0">
                      {lead.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors truncate">
                        {lead.name || "Sin nombre"}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-bold ${meta.color}`}>
                          <RamoIcon className="h-2.5 w-2.5" />
                          {meta.label}
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium truncate">{lead.status}</span>
                      </div>
                    </div>
                    <ScoreIcon score={lead.score} />
                  </Link>
                );
              })}
            </div>
          )}

          {urgentes.length > 0 && (
            <Link href="/leads" className="mt-4 flex items-center justify-center gap-1.5 text-xs font-bold text-blue-500 hover:text-blue-700 transition-colors">
              Ver todos <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Recientes */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-400" />
            Últimos prospectos agregados
          </h3>
          <Link href="/leads" className="text-xs font-bold text-blue-500 hover:text-blue-700 flex items-center gap-1 transition-colors">
            Ver todos <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {recientes.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-10 w-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-300 font-medium text-sm">Sin prospectos aún</p>
            <Link href="/leads" className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-blue-500 hover:underline">
              <Zap className="h-3.5 w-3.5" /> Crear el primero
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recientes.map(lead => {
              const meta = RAMO_META[lead.type?.toLowerCase()] || { label: lead.type || "—", icon: Shield, color: "text-slate-500 bg-slate-50" };
              const RamoIcon = meta.icon;
              const stageColor: Record<string, string> = {
                "Nuevo": "bg-blue-100 text-blue-700",
                "Contactado": "bg-indigo-100 text-indigo-700",
                "Ganado / Aprobado": "bg-emerald-100 text-emerald-700",
                "Sincronizado ✓": "bg-green-100 text-green-700",
                "Rechazado": "bg-rose-100 text-rose-700",
                "Perdido / Inactivo": "bg-slate-100 text-slate-500",
              };
              const sc = stageColor[lead.status || ""] || "bg-slate-100 text-slate-600";
              return (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/70 transition-colors group"
                >
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-sm font-black text-slate-600 flex-shrink-0 shadow-sm">
                    {lead.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors truncate">
                      {lead.name || "Sin nombre"}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {lead.phone && (
                        <span className="text-[11px] text-slate-400 font-medium">{lead.phone}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg font-bold ${meta.color}`}>
                      <RamoIcon className="h-3 w-3" />
                      {meta.label}
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${sc}`}>
                      {lead.status || "—"}
                    </span>
                    <span className="text-[10px] text-slate-300 font-medium hidden md:block">
                      {new Date(lead.createdAt || Date.now()).toLocaleDateString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <ScoreIcon score={lead.score} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Acciones rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { href: "/leads", icon: Users, label: "Pipeline", sub: "Ver todos los leads", color: "from-blue-500 to-indigo-600" },
          { href: "/leads", icon: PhoneCall, label: "Registrar llamada", sub: "Agregar interacción", color: "from-violet-500 to-purple-600" },
          { href: "/renovaciones", icon: RefreshCw, label: "Renovaciones", sub: "Pólizas por vencer", color: "from-emerald-500 to-teal-600" },
          { href: "/leads", icon: CheckCircle2, label: "Pendientes", sub: "SLA vencidos", color: "from-rose-500 to-pink-600" },
        ].map(item => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href + item.label}
              href={item.href}
              className={`flex flex-col gap-3 p-5 rounded-2xl bg-gradient-to-br ${item.color} text-white hover:scale-[1.02] transition-all shadow-sm hover:shadow-md`}
            >
              <Icon className="h-6 w-6 opacity-90" />
              <div>
                <p className="font-bold text-sm">{item.label}</p>
                <p className="text-[11px] opacity-70 font-medium mt-0.5">{item.sub}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

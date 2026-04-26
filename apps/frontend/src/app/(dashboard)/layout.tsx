"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Users,
  RefreshCw,
  LayoutDashboard,
  Settings,
  LogOut,
  ChevronRight,
  Bell
} from "lucide-react";

const PAGE_TITLES: Record<string, { parent: string; current: string }> = {
  "/":             { parent: "Panel Comercial", current: "Dashboard" },
  "/leads":         { parent: "Panel Comercial", current: "Pre-Venta" },
  "/renovaciones":  { parent: "Panel Comercial", current: "Renovaciones" },
  "/config":        { parent: "Panel Comercial", current: "Configuración" },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isLeadDetail = pathname.startsWith("/leads/") && pathname !== "/leads";

  const pageInfo = isLeadDetail
    ? { parent: "Pre-Venta", current: "Ficha de Prospecto" }
    : PAGE_TITLES[pathname] || { parent: "Panel Comercial", current: "" };

  const navItems = [
    { title: "Dashboard", icon: LayoutDashboard, href: "/" },
    { title: "Pre-Venta", icon: Users, href: "/leads" },
    { title: "Renovaciones", icon: RefreshCw, href: "/renovaciones" },
    { title: "Configuración", icon: Settings, href: "/config" },
  ];

  return (
    <div className="flex h-screen bg-slate-50 selection:bg-amber-100">
      {/* Nova-style Sidebar */}
      <aside
        className="w-72 flex flex-col border-r border-amber-900/20 shadow-2xl relative overflow-hidden"
        style={{ background: "linear-gradient(180deg, #060614 0%, #0c0c22 50%, #060614 100%)" }}
      >
        {/* Ambient glow blob */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/3 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(245,158,11,0.08) 0%, transparent 70%)" }}
        />
        {/* Dot-grid background */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(rgba(245,158,11,0.8) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />

        {/* Logo */}
        <div className="p-8 relative z-10 flex items-center justify-center border-b border-white/[0.04] pb-6">
          <Image
            src="/logo-roesan.png"
            alt="Roesan Logo"
            width={175}
            height={58}
            className="object-contain drop-shadow-[0_0_12px_rgba(245,158,11,0.15)]"
            priority
          />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-6 space-y-1 relative z-10">
          <div className="px-3 mb-3 text-[10px] font-semibold text-amber-400/40 uppercase tracking-widest font-mono">
            Menú Principal
          </div>
          {navItems.map((item) => {
            const isActive = item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center px-3 py-3 text-sm font-medium rounded-xl transition-all duration-200 relative overflow-hidden ${
                  isActive
                    ? "border border-amber-400/15"
                    : "hover:border hover:border-white/5 border border-transparent"
                }`}
                style={isActive ? {
                  background: "rgba(245,158,11,0.09)",
                  boxShadow: "0 0 20px rgba(245,158,11,0.08), inset 0 1px 0 rgba(245,158,11,0.08)",
                } : {}}
              >
                {/* Active left indicator */}
                <div
                  className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full transition-all duration-300 ${
                    isActive ? "opacity-100" : "opacity-0 group-hover:opacity-50"
                  }`}
                  style={{ background: "linear-gradient(180deg, #fbbf24, #f59e0b)" }}
                />
                <item.icon
                  className={`mr-3 h-4.5 w-4.5 transition-colors shrink-0 ${
                    isActive ? "text-amber-400" : "text-slate-500 group-hover:text-amber-400/70"
                  }`}
                />
                <span
                  className={`transition-colors text-sm ${
                    isActive ? "text-white font-semibold" : "text-slate-400 group-hover:text-slate-200"
                  }`}
                >
                  {item.title}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* User card + logout */}
        <div className="p-4 relative z-10 border-t border-white/[0.04]">
          <div
            className="rounded-2xl p-4 mb-3"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <div className="h-9 w-9 rounded-full p-[1.5px]" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
                  <div className="h-full w-full rounded-full bg-[#0c0c22] flex items-center justify-center overflow-hidden">
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Roesan" alt="User" className="h-full w-full object-cover" />
                  </div>
                </div>
                <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-[#0c0c22]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white leading-none">Asesor Roesan</p>
                <p className="text-xs text-amber-400/60 mt-0.5 font-mono">Comercial</p>
              </div>
            </div>
          </div>

          <button className="flex items-center justify-center w-full px-4 py-2.5 text-sm font-medium rounded-xl text-slate-500 hover:bg-red-500/10 hover:text-red-400 border border-transparent hover:border-red-500/15 transition-all duration-200">
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">

        {/* Header */}
        <header className="h-15 bg-white/85 backdrop-blur-xl border-b border-slate-200/50 flex items-center justify-between px-8 sticky top-0 z-20 shadow-sm relative">
          {/* Subtle amber accent line at the bottom of header */}
          <div
            className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
            style={{ background: "linear-gradient(90deg, transparent, rgba(245,158,11,0.25) 30%, rgba(245,158,11,0.25) 70%, transparent)" }}
          />
          <div className="flex items-center text-sm font-medium text-slate-400">
            <span className="hover:text-amber-600 transition-colors cursor-pointer font-medium" style={{ fontFamily: "var(--font-outfit)" }}>
              {pageInfo.parent}
            </span>
            {pageInfo.current && (
              <>
                <ChevronRight className="h-4 w-4 mx-2 opacity-30" />
                <span
                  className="text-slate-800 bg-amber-50 border border-amber-100 px-3 py-1 rounded-full font-semibold text-xs"
                  style={{ fontFamily: "var(--font-outfit)" }}
                >
                  {pageInfo.current}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button className="relative p-2 text-slate-400 hover:text-amber-600 transition-colors rounded-full hover:bg-amber-50">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 border-2 border-white" />
            </button>
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
              style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
            >
              R
            </div>
          </div>
        </header>

        {/* Page background */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 80% 40% at 70% 0%, rgba(245,158,11,0.04) 0%, transparent 60%)" }}
        />
        <section className="flex-1 overflow-auto p-10 relative z-10 w-full">
          {children}
        </section>
      </main>
    </div>
  );
}

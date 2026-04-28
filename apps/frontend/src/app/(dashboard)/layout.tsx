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
  Bell,
  FileText
} from "lucide-react";

const PAGE_TITLES: Record<string, { parent: string; current: string }> = {
  "/":             { parent: "Panel Comercial", current: "Dashboard" },
  "/leads":         { parent: "Panel Comercial", current: "Pre-Venta" },
  "/renovaciones":  { parent: "Panel Comercial", current: "Renovaciones" },
  "/config":        { parent: "Panel Comercial", current: "Configuración" },
  "/remisiones/nueva": { parent: "Panel Comercial", current: "Remisionar" },
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
    { title: "Remisionar", icon: FileText, href: "/remisiones/nueva" },
    { title: "Configuración", icon: Settings, href: "/config" },
  ];

  return (
    <div className="flex h-screen bg-slate-50 selection:bg-amber-100">
      {/* Sidebar */}
      <aside
        className="w-52 flex flex-col border-r border-amber-900/20 relative overflow-hidden"
        style={{ background: "linear-gradient(180deg, #060614 0%, #0c0c22 50%, #060614 100%)" }}
      >
        {/* Logo */}
        <div className="p-5 pb-4 relative z-10 flex items-center justify-center border-b border-white/[0.04]">
          <Image
            src="/logo-roesan.png"
            alt="Roesan Logo"
            width={140}
            height={46}
            className="object-contain"
            priority
          />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 relative z-10">
          <div className="px-2.5 mb-2 text-[10px] font-semibold text-amber-400/40 uppercase tracking-widest font-mono">
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
                className={`group flex items-center px-2.5 py-2 text-[13px] font-medium rounded-lg transition-all duration-200 relative overflow-hidden ${
                  isActive
                    ? "border border-amber-400/15"
                    : "hover:border hover:border-white/5 border border-transparent"
                }`}
                style={isActive ? {
                  background: "rgba(245,158,11,0.09)",
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
                  className={`mr-2.5 h-4 w-4 transition-colors shrink-0 ${
                    isActive ? "text-amber-400" : "text-slate-500 group-hover:text-amber-400/70"
                  }`}
                />
                <span
                  className={`transition-colors ${
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
        <div className="p-3 relative z-10 border-t border-white/[0.04]">
          <div
            className="rounded-xl p-3 mb-2"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center gap-2.5">
              <div className="relative shrink-0">
                <div className="h-7 w-7 rounded-full p-[1.5px]" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
                  <div className="h-full w-full rounded-full bg-[#0c0c22] flex items-center justify-center overflow-hidden">
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Roesan" alt="User" className="h-full w-full object-cover" />
                  </div>
                </div>
                <div className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-400 border-2 border-[#0c0c22]" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-white leading-none">Asesor Roesan</p>
                <p className="text-[11px] text-amber-400/60 mt-0.5 font-mono">Comercial</p>
              </div>
            </div>
          </div>

          <button className="flex items-center justify-center w-full px-3 py-2 text-[13px] font-medium rounded-lg text-slate-500 hover:bg-red-500/10 hover:text-red-400 border border-transparent hover:border-red-500/15 transition-all duration-200">
            <LogOut className="mr-2 h-3.5 w-3.5" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">

        {/* Header */}
        <header className="h-11 bg-white/90 backdrop-blur-xl border-b border-slate-200/60 flex items-center justify-between px-6 sticky top-0 z-20">
          <div className="flex items-center text-[13px] font-medium text-slate-400">
            <span className="hover:text-amber-600 transition-colors cursor-pointer font-medium" style={{ fontFamily: "var(--font-outfit)" }}>
              {pageInfo.parent}
            </span>
            {pageInfo.current && (
              <>
                <ChevronRight className="h-3.5 w-3.5 mx-1.5 opacity-30" />
                <span
                  className="text-slate-700 bg-amber-50 border border-amber-100 px-2.5 py-0.5 rounded-full font-semibold text-[12px]"
                  style={{ fontFamily: "var(--font-outfit)" }}
                >
                  {pageInfo.current}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button className="relative p-1.5 text-slate-400 hover:text-amber-600 transition-colors rounded-lg hover:bg-amber-50">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-red-500 border border-white" />
            </button>
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
              style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
            >
              R
            </div>
          </div>
        </header>

        <section className="flex-1 overflow-auto p-6 relative z-10 w-full">
          {children}
        </section>
      </main>
    </div>
  );
}

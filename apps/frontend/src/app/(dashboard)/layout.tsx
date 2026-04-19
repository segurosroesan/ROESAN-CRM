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
  
  // For lead detail pages, show special breadcrumb
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
    <div className="flex h-screen bg-slate-50 font-sans selection:bg-blue-200">
      {/* Premium Sidebar */}
      <aside className="w-72 bg-gradient-to-b from-indigo-950 via-slate-900 to-black text-white flex flex-col border-r border-indigo-900/50 shadow-2xl relative overflow-hidden">
        {/* Subtle decorative background glow */}
        <div className="absolute top-0 left-0 w-full h-64 bg-blue-600/10 blur-3xl rounded-full pointer-events-none -translate-y-1/2"></div>
        
        <div className="p-8 relative z-10 w-full flex items-center justify-center border-b border-white/5 pb-6">
           <Image 
             src="/logo-roesan.png" 
             alt="Roesan Logo Oficial" 
             width={180} 
             height={60} 
             className="object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]"
             priority
           />
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-1 relative z-10">
          <div className="px-3 mb-3 text-xs font-semibold text-indigo-300/50 uppercase tracking-wider">Menú Principal</div>
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
                    ? "bg-white/10 shadow-[0_0_20px_rgba(59,130,246,0.15)] border border-white/10"
                    : "hover:bg-white/5 hover:shadow-[0_0_15px_rgba(59,130,246,0.08)]"
                }`}
              >
                <div className={`absolute left-0 top-0 h-full w-[3px] bg-blue-400 rounded-r transition-opacity ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-60"}`} />
                <item.icon className={`mr-3 h-5 w-5 transition-colors ${isActive ? "text-blue-400" : "text-indigo-300/70 group-hover:text-blue-400"}`} />
                <span className={`transition-colors ${isActive ? "text-white font-semibold" : "text-slate-400 group-hover:text-white"}`}>{item.title}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-6 relative z-10">
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10 backdrop-blur-md mb-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="h-10 w-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 p-[2px]">
                  <div className="h-full w-full rounded-full bg-slate-900 border-2 border-slate-900 flex items-center justify-center overflow-hidden">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=Felix`} alt="User" className="h-full w-full object-cover" />
                  </div>
                </div>
                <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-slate-900"></div>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white">John Doe</span>
                <span className="text-xs text-indigo-300">Asesor Comercial</span>
              </div>
            </div>
          </div>

          <button className="flex items-center justify-center w-full px-4 py-3 text-sm font-bold rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 border border-transparent transition-all duration-300">
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* Dynamic Header */}
        <header className="h-16 bg-white/80 backdrop-blur-xl border-b border-slate-200/40 flex items-center justify-between px-8 sticky top-0 z-20 shadow-sm">
          <div className="flex items-center text-sm font-medium text-slate-400">
            <span className="hover:text-blue-600 transition-colors cursor-pointer font-medium">{pageInfo.parent}</span>
            {pageInfo.current && (
              <>
                <ChevronRight className="h-4 w-4 mx-2 opacity-40" />
                <span className="text-slate-800 bg-slate-100/80 px-3 py-1 rounded-full font-bold text-sm shadow-sm">
                  {pageInfo.current}
                </span>
              </>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
             <button className="relative p-2 text-slate-400 hover:text-blue-600 transition-colors rounded-full hover:bg-blue-50">
               <Bell className="h-5 w-5" />
               <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 border-2 border-white"></span>
             </button>
             <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-black text-white shadow-sm">
               J
             </div>
          </div>
        </header>

        {/* Page Area with decorative gradient background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50/50 via-slate-50/50 to-slate-50 pointer-events-none"></div>
        <section className="flex-1 overflow-auto p-10 relative z-10 w-full">
          {children}
        </section>
      </main>
    </div>
  );
}

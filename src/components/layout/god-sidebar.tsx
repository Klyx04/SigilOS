"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Shield,
    LogOut,
    Activity,
    Home,
    Terminal,
    Gamepad2,
    Settings2,
    HardDrive,
    Ticket,
    Bell,
    ShieldAlert,
    Database,
    Ban
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSearchParams } from "next/navigation";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

const CONSOLE_PAGES = [
    { name: "Analytics", id: "overview", icon: Activity, color: "text-blue-400" },
    { name: "Guildes & Users", id: "guilds", icon: Settings2, color: "text-emerald-400" },
    { name: "Système & Infra", id: "infrastructure", icon: HardDrive, color: "text-amber-400" },
    { name: "Alertes Système", id: "notifications", icon: Bell, color: "text-rose-400" },
    { name: "Tickets Support", id: "tickets", icon: Ticket, color: "text-indigo-400" },
    { name: "Données de Jeu", id: "game-data", icon: Database, color: "text-cyan-400" },
    { name: "Sécurité & Logs", id: "security", icon: ShieldAlert, color: "text-zinc-400" },
];

export function GodSidebar({ className, user, unreadCount = 0 }: { className?: string, user: any, unreadCount?: number }) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const activeTab = searchParams.get("tab") || "overview";

    const isActiveRoot = (href: string) => {
        if (href === "/god") return pathname === "/god";
        return pathname.startsWith(href);
    };

    return (
        <div className={cn("flex flex-col h-full bg-[#050505] border-r border-white/5", className)}>

            {/* 1. HEADER: BRAND */}
            <div className="p-8 pb-4">
                <Link href="/" className="flex items-center gap-4 px-2 group/brand hover:opacity-80 transition-all">
                    <div className="relative h-10 w-10 shrink-0">
                        <Image
                            src="/assets/ui/logo-v2.png"
                            alt="SigilOS"
                            fill
                            priority
                            sizes="(max-width: 768px) 40px, 40px"
                            className="object-contain drop-shadow-[0_0_20px_rgba(168,85,247,0.6)] brightness-110"
                        />
                    </div>
                    <span className="text-xl md:text-2xl font-black tracking-tight text-white leading-none font-heading truncate">
                        SIGIL<span className="text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]">GOD</span>
                    </span>
                </Link>
            </div>

            {/* 2. NAVIGATION */}
            <ScrollArea className="flex-1 px-4 py-8">
                <nav className="space-y-8">
                    {/* CONSOLE SECTION */}
                    <div>
                        <div className="flex items-center gap-3 px-3 mb-6">
                            <Terminal className="h-4 w-4 text-zinc-600" />
                            <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-600">
                                Console Centrale
                            </h4>
                        </div>
                        
                        <div className="space-y-1.5">
                            {CONSOLE_PAGES.map((page) => {
                                const active = pathname === "/god" && activeTab === page.id;
                                const hasBadge = page.id === "notifications" && unreadCount > 0;
                                const sub = searchParams.get("sub") || "NONE";

                                return (
                                    <div key={page.id} className="space-y-1">
                                        <Link
                                            href={`/god?tab=${page.id}`}
                                            className={cn(
                                                "flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative",
                                                active
                                                    ? "bg-white/5 text-white shadow-[0_0_40px_rgba(255,255,255,0.03)] border border-white/10"
                                                    : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.03] border border-transparent"
                                            )}
                                        >
                                            {active && (
                                                <div className="absolute left-0 top-3 bottom-3 w-1 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.8)]" />
                                            )}
                                            <page.icon className={cn(
                                                "h-5 w-5 transition-all duration-500 group-hover:scale-110",
                                                active ? page.color : "text-zinc-700/80 group-hover:text-zinc-400"
                                            )} />
                                            <span className="text-[11px] font-bold tracking-widest uppercase truncate flex-1">{page.name}</span>
                                            
                                            {hasBadge && (
                                                <span className="flex items-center justify-center bg-rose-500 text-white text-[9px] font-black h-4 px-1.5 rounded-lg shadow-[0_0_15px_rgba(244,63,94,0.4)] animate-pulse">
                                                    {unreadCount}
                                                </span>
                                            )}
                                        </Link>

                                        {/* Sub-tabs for specific sections */}
                                        {active && page.id === "infrastructure" && (
                                            <div className="ml-8 space-y-1 border-l border-white/10 pl-4 py-1">
                                                <Link href="/god?tab=infrastructure&sub=STATUS" className={cn("flex items-center gap-3 px-3 py-2 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-all", sub === "STATUS" || sub === "NONE" ? "text-emerald-400 bg-emerald-500/10" : "text-zinc-600 hover:text-zinc-300 hover:bg-white/5")}>
                                                    <Activity className="h-3.5 w-3.5" /> Status
                                                </Link>
                                                <Link href="/god?tab=infrastructure&sub=STORAGE" className={cn("flex items-center gap-3 px-3 py-2 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-all", sub === "STORAGE" ? "text-blue-400 bg-blue-500/10" : "text-zinc-600 hover:text-zinc-300 hover:bg-white/5")}>
                                                    <HardDrive className="h-3.5 w-3.5" /> Stockage
                                                </Link>
                                            </div>
                                        )}

                                        {active && page.id === "security" && (
                                            <div className="ml-8 space-y-1 border-l border-white/10 pl-4 py-1">
                                                <Link href="/god?tab=security&sub=AUDIT" className={cn("flex items-center gap-3 px-3 py-2 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-all", sub === "AUDIT" || sub === "NONE" ? "text-zinc-300 bg-white/10" : "text-zinc-600 hover:text-zinc-300 hover:bg-white/5")}>
                                                    <ShieldAlert className="h-3.5 w-3.5" /> Audit Logs
                                                </Link>
                                                <Link href="/god?tab=security&sub=FIREWALL" className={cn("flex items-center gap-3 px-3 py-2 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-all", sub === "FIREWALL" ? "text-rose-400 bg-rose-500/10" : "text-zinc-600 hover:text-zinc-300 hover:bg-white/5")}>
                                                    <Bell className="h-3.5 w-3.5" /> Firewall
                                                </Link>
                                            </div>
                                        )}

                                        {active && page.id === "tickets" && (
                                            <div className="ml-8 space-y-1 border-l border-white/10 pl-4 py-1">
                                                <Link href="/god?tab=tickets&sub=OPEN" className={cn("flex items-center gap-3 px-3 py-2 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-all", sub === "OPEN" || sub === "NONE" ? "text-indigo-400 bg-indigo-500/10" : "text-zinc-600 hover:text-zinc-300 hover:bg-white/5")}>
                                                    <Ticket className="h-3.5 w-3.5" /> Ouverts
                                                </Link>
                                                <Link href="/god?tab=tickets&sub=CLOSED" className={cn("flex items-center gap-3 px-3 py-2 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-all", sub === "CLOSED" ? "text-zinc-400 bg-white/5" : "text-zinc-600 hover:text-zinc-300 hover:bg-white/5")}>
                                                    <Database className="h-3.5 w-3.5" /> Archives
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                    </div>

                    {/* OTHER ACCESSS */}
                    <div>
                        <h4 className="px-3 text-[10px] font-black uppercase tracking-[0.4em] text-zinc-600 mb-6 block">
                            Platform Access
                        </h4>
                        
                        <div className="space-y-1.5">
                            {[
                                { name: "Gestion Mini-Jeux", href: "/god/mini-games?sub=MAINTENANCE", icon: Gamepad2, active: pathname.startsWith("/god/mini-games"), color: "text-amber-500" },
                                { name: "Back to Member", href: "/dashboard", icon: LayoutDashboard, active: false, color: "text-emerald-500" },
                                { name: "Landing Page", href: "/", icon: Home, active: false, color: "text-blue-500" },
                            ].map((item) => (
                                <div key={item.name} className="space-y-1">
                                    <Link
                                        href={item.href}
                                        className={cn(
                                            "flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative",
                                            item.active
                                                ? "bg-white/5 text-white shadow-[0_0_40px_rgba(255,255,255,0.03)] border border-white/10"
                                                : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.03] border border-transparent"
                                        )}
                                    >
                                        {item.active && (
                                            <div className="absolute left-0 top-3 bottom-3 w-1 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.8)]" />
                                        )}
                                        <item.icon className={cn(
                                            "h-5 w-5 transition-transform duration-300 group-hover:scale-110",
                                            item.active ? item.color : "text-zinc-700/80 group-hover:text-zinc-400"
                                        )} />
                                        <span className="text-[11px] font-bold tracking-widest uppercase truncate">{item.name}</span>
                                    </Link>

                                    {item.active && item.name === "Gestion Mini-Jeux" && (
                                        <div className="ml-8 space-y-1 border-l border-white/10 pl-4 py-1">
                                            <Link href="/god/mini-games?sub=MAINTENANCE" className={cn("flex items-center gap-3 px-3 py-2 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-all", (searchParams.get("sub") || "MAINTENANCE") === "MAINTENANCE" ? "text-amber-400 bg-amber-500/10" : "text-zinc-600 hover:text-zinc-300 hover:bg-white/5")}>
                                                <ShieldAlert className="h-3.5 w-3.5" /> Maintenance
                                            </Link>
                                            <Link href="/god/mini-games?sub=GUESSER" className={cn("flex items-center gap-3 px-3 py-2 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-all", searchParams.get("sub") === "GUESSER" ? "text-rose-400 bg-rose-500/10" : "text-zinc-600 hover:text-zinc-300 hover:bg-white/5")}>
                                                <Ban className="h-3.5 w-3.5" /> Blacklist
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </nav>
            </ScrollArea>

            {/* 3. USER FOOTER */}
            <div className="p-4 border-t border-white/5 bg-black/50 backdrop-blur-md">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="w-full justify-start h-auto p-2 hover:bg-white/5 group">
                            <div className="flex items-center gap-3 w-full">
                                <Avatar className="h-8 w-8 rounded-lg border border-zinc-800">
                                    <AvatarImage src={user.image} />
                                    <AvatarFallback className="bg-zinc-800 text-xs font-bold text-amber-500">SU</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col items-start min-w-0 flex-1 text-left">
                                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest truncate w-full">
                                        Super Admin
                                    </span>
                                </div>
                            </div>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 bg-zinc-950 border-zinc-900 text-zinc-200" align="end">
                        <DropdownMenuItem onClick={() => signOut()} className="text-red-400 focus:text-red-400 focus:bg-red-950/20 cursor-pointer">
                            <LogOut className="mr-2 h-4 w-4" />
                            Déconnexion
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}

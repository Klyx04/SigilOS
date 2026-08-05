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
    Database,
    Ban,
    Sparkles,
    ShieldAlert,
    Navigation,
    Bug,
    Map,
    History,
    Zap
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
    { name: "Command Center", id: "overview", icon: Terminal, color: "text-blue-400" },
    { name: "Activité Dashboard", id: "telemetry", icon: Activity, color: "text-violet-400" },
    { name: "Guildes & Users", id: "guilds", icon: Settings2, color: "text-emerald-400" },

    { name: "Système & Infra", id: "infrastructure", icon: HardDrive, color: "text-amber-400" },
    { name: "Alertes Système", id: "notifications", icon: Bell, color: "text-rose-400" },
    { name: "Tickets Support", id: "tickets", icon: Ticket, color: "text-indigo-400" },
    { name: "Données de Jeu", id: "game-data", icon: Database, color: "text-cyan-400" },
    { name: "Mini-Jeux", id: "mini-games", sub: "mini-games", icon: Gamepad2, color: "text-amber-500" },
    { name: "Avis de Recherche", id: "bounties", sub: "game-data/bounties", icon: ShieldAlert, color: "text-rose-500" },
    { name: "Quêtes Dofus", id: "quetes-dofus", sub: "quetes-dofus", icon: Sparkles, color: "text-purple-400" },
    { name: "Guides Optim.", id: "dofus-guides", sub: "dofus-guides", icon: Navigation, color: "text-emerald-400" },
    { name: "Rush Sylvestre", id: "rush-sylvestre", sub: "rush-sylvestre", icon: Zap, color: "text-emerald-400" },
    { name: "Bugs & Suggs", id: "bugs", sub: "bugs", icon: Bug, color: "text-rose-400" },
    { name: "Roadmap Pro", id: "roadmap", sub: "roadmap", icon: Map, color: "text-amber-400" },
    { name: "Changelog Engine", id: "changelog", sub: "changelog", icon: History, color: "text-indigo-400" },
    { name: "Sous-Gods", id: "delegates", sub: "delegates", icon: Shield, color: "text-violet-400" },
    { name: "Sécurité & Logs", id: "security", icon: ShieldAlert, color: "text-zinc-400" },
];

type ScopeId = string;

// Scope requis par entrée du menu. "all" = super-admin seulement.
const SCOPE_REQUIRED: Record<string, ScopeId> = {
    overview: "all",
    telemetry: "all",
    guilds: "guilds",
    infrastructure: "maintenance",
    notifications: "all",
    tickets: "all",
    "game-data": "game-data",
    "mini-games": "all",
    bounties: "game-data",
    "quetes-dofus": "game-data",
    "dofus-guides": "game-data",
    "rush-sylvestre": "game-data",
    bugs: "all",
    roadmap: "all",
    changelog: "all",
    delegates: "users",
    security: "logs",
};

// Nombre total de scopes (un super-admin les possède tous).
const ALL_SCOPES_COUNT = 6;

export function GodSidebar({ className, user, unreadCount = 0, ticketCount = 0, activeScopes = [], godRoute = "/god" }: { className?: string, user: any, unreadCount?: number, ticketCount?: number, activeScopes?: string[], godRoute?: string }) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const activeTab = searchParams.get("tab") || "overview";

    // Un super-admin reçoit tous les scopes via getActiveScopes → isFullAdmin = vrai.
    const isFullAdmin = activeScopes.length >= ALL_SCOPES_COUNT;
    const visiblePages = CONSOLE_PAGES.filter(p => {
        const required = SCOPE_REQUIRED[p.id];
        if (!required)return true;
        if (required === "all") return isFullAdmin;
        return activeScopes.includes(required);
    });

    const isActiveRoot = (href: string) => {
        if (href === godRoute) return pathname === godRoute;
        return pathname.startsWith(href);
    };

    return (
        <div className={cn("flex flex-col h-full bg-zinc-950 border-r border-white/10", className)}>

            {/* 1. HEADER: BRAND */}
            <div className="p-6 lg:p-8 pb-4">
                <Link href="/" className="flex items-center gap-4 px-2 group/brand hover:opacity-80 transition-all">
                    <div className="relative h-8 w-8 md:h-10 md:w-10 shrink-0">
                        <Image
                            src="/assets/ui/logo-v2.png"
                            alt="SigilOS"
                            fill
                            priority
                            sizes="(max-width: 768px) 32px, 40px"
                            className="object-contain drop-shadow-[0_0_20px_rgba(168,85,247,0.6)] brightness-110"
                        />
                    </div>
                    <span className="text-lg md:text-2xl font-black tracking-tight text-white leading-none font-heading truncate drop-shadow-md">
                        SIGIL<span className="text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]">GOD</span>
                    </span>
                </Link>
            </div>

            {/* 2. NAVIGATION */}
            <div className="flex-1 overflow-y-auto px-4 py-4 lg:py-8 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                <nav className="space-y-8">
                    {/* CONSOLE SECTION */}
                    <div>
                        <div className="flex items-center gap-3 px-3 mb-6">
                            <Terminal className="h-4 w-4 text-zinc-400" />
                            <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-400">
                                Console Centrale
                            </h4>
                        </div>
                        
                        <div className="space-y-1.5">
                            {visiblePages.map((page) => {
                                const isDirectRoute = !!((page as any).sub);
                                const linkHref = isDirectRoute ? `${godRoute}/${(page as any).sub}` : `${godRoute}?tab=${page.id}`;
                                const active = isDirectRoute 
                                    ? pathname.startsWith(`${godRoute}/${(page as any).sub}`) 
                                    : ((pathname === godRoute || pathname === "/god") && activeTab === page.id);
                                
                                // Badge logic
                                const hasBadge = (page.id === "notifications" && unreadCount > 0) || 
                                               (page.id === "tickets" && ticketCount > 0);
                                const currentBadgeCount = page.id === "notifications" ? unreadCount : ticketCount;

                                const sub = searchParams.get("sub") || "NONE";

                                return (
                                    <div key={page.id} className="space-y-1">
                                        <Link
                                            href={linkHref}
                                            className={cn(
                                                "flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative",
                                                active
                                                    ? "bg-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.05)] border border-white/20"
                                                    : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"
                                            )}
                                        >
                                            {active && (
                                                <div className="absolute left-0 top-3 bottom-3 w-1 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.8)]" />
                                            )}
                                            <page.icon className={cn(
                                                "h-5 w-5 transition-all duration-500 group-hover:scale-110",
                                                page.color,
                                                !active && "opacity-60 group-hover:opacity-100"
                                            )} />
                                            <span className="text-[12px] font-bold tracking-widest uppercase truncate flex-1">{page.name}</span>
                                            
                                            {hasBadge && (
                                                <span className={cn(
                                                    "flex items-center justify-center text-white text-[10px] font-black h-5 px-2 rounded-lg animate-pulse shadow-lg",
                                                    page.id === "tickets" ? "bg-rose-500 shadow-rose-500/40" : "bg-indigo-500 shadow-indigo-500/40"
                                                )}>
                                                    {currentBadgeCount}
                                                </span>
                                            )}
                                        </Link>

                                        {/* Sub-tabs for specific sections */}
                                        {active && page.id === "infrastructure" && (
                                            <div className="ml-8 space-y-1 border-l-2 border-white/10 pl-4 py-2 mt-2">
                                                <Link href={`${godRoute}?tab=infrastructure&sub=STATUS`} className={cn("flex items-center gap-3 px-3 py-2 rounded-xl text-[11px] font-bold tracking-widest uppercase transition-all", sub === "STATUS" || sub === "NONE" ? "text-emerald-400 bg-emerald-500/15" : "text-zinc-400 hover:text-zinc-200 hover:bg-white/10")}>
                                                    <Activity className="h-4 w-4" /> Status
                                                </Link>
                                                <Link href={`${godRoute}?tab=infrastructure&sub=STORAGE`} className={cn("flex items-center gap-3 px-3 py-2 rounded-xl text-[11px] font-bold tracking-widest uppercase transition-all", sub === "STORAGE" ? "text-blue-400 bg-blue-500/15" : "text-zinc-400 hover:text-zinc-200 hover:bg-white/10")}>
                                                    <HardDrive className="h-4 w-4" /> Stockage
                                                </Link>
                                            </div>
                                        )}

                                        {active && page.id === "security" && (
                                            <div className="ml-8 space-y-1 border-l-2 border-white/10 pl-4 py-2 mt-2">
                                                <Link href="/god?tab=security&sub=AUDIT" className={cn("flex items-center gap-3 px-3 py-2 rounded-xl text-[11px] font-bold tracking-widest uppercase transition-all", sub === "AUDIT" || sub === "NONE" ? "text-white bg-white/15" : "text-zinc-400 hover:text-zinc-200 hover:bg-white/10")}>
                                                    <ShieldAlert className="h-4 w-4" /> Audit Logs
                                                </Link>
                                                <Link href="/god?tab=security&sub=FIREWALL" className={cn("flex items-center gap-3 px-3 py-2 rounded-xl text-[11px] font-bold tracking-widest uppercase transition-all", sub === "FIREWALL" ? "text-rose-400 bg-rose-500/15" : "text-zinc-400 hover:text-zinc-200 hover:bg-white/10")}>
                                                    <Bell className="h-4 w-4" /> Firewall
                                                </Link>
                                            </div>
                                        )}

                                        {active && page.id === "tickets" && (
                                            <div className="ml-8 space-y-1 border-l-2 border-white/10 pl-4 py-2 mt-2">
                                                <Link href="/god?tab=tickets&sub=OPEN" className={cn("flex items-center gap-3 px-3 py-2 rounded-xl text-[11px] font-bold tracking-widest uppercase transition-all", sub === "OPEN" || sub === "NONE" ? "text-indigo-400 bg-indigo-500/15" : "text-zinc-400 hover:text-zinc-200 hover:bg-white/10")}>
                                                    <Ticket className="h-4 w-4" /> Ouverts
                                                </Link>
                                                <Link href="/god?tab=tickets&sub=CLOSED" className={cn("flex items-center gap-3 px-3 py-2 rounded-xl text-[11px] font-bold tracking-widest uppercase transition-all", sub === "CLOSED" ? "text-zinc-300 bg-white/10" : "text-zinc-400 hover:text-zinc-200 hover:bg-white/10")}>
                                                    <Database className="h-4 w-4" /> Archives
                                                </Link>
                                            </div>
                                        )}
                                        {active && page.id === "mini-games" && (
                                            <div className="ml-8 space-y-1 border-l-2 border-white/10 pl-4 py-2 mt-2">
                                                <Link href="/god/mini-games?sub=MAINTENANCE" className={cn("flex items-center gap-3 px-3 py-2 rounded-xl text-[11px] font-bold tracking-widest uppercase transition-all", (searchParams.get("sub") || "MAINTENANCE") === "MAINTENANCE" ? "text-amber-400 bg-amber-500/15" : "text-zinc-400 hover:text-zinc-200 hover:bg-white/10")}>
                                                    <ShieldAlert className="h-4 w-4" /> Maintenance
                                                </Link>
                                                <Link href="/god/mini-games?sub=GUESSER" className={cn("flex items-center gap-3 px-3 py-2 rounded-xl text-[11px] font-bold tracking-widest uppercase transition-all", searchParams.get("sub") === "GUESSER" ? "text-rose-400 bg-rose-500/15" : "text-zinc-400 hover:text-zinc-200 hover:bg-white/10")}>
                                                    <Ban className="h-4 w-4" /> Blacklist
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </nav>
            </div>



            {/* 3. USER FOOTER */}
            <div className="p-4 border-t border-white/10 bg-zinc-950/80 backdrop-blur-md">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="w-full justify-start h-auto p-2 hover:bg-white/10 group rounded-xl transition-all">
                            <div className="flex items-center gap-3 w-full">
                                <Avatar className="h-10 w-10 rounded-lg border-2 border-zinc-800 shadow-md">
                                    <AvatarImage src={user.image} />
                                    <AvatarFallback className="bg-zinc-800 text-xs font-bold text-amber-500">SU</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col items-start min-w-0 flex-1 text-left">
                                    <span className="text-[11px] font-black text-amber-500 uppercase tracking-widest truncate w-full drop-shadow-sm">
                                        Super Admin
                                    </span>
                                </div>
                            </div>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 bg-zinc-900 border-zinc-800 text-zinc-200" align="end">
                        <DropdownMenuItem asChild className="focus:text-emerald-400 focus:bg-emerald-500/10 cursor-pointer rounded-lg font-bold">
                            <Link href="/dashboard" className="flex items-center w-full">
                                <LayoutDashboard className="mr-2 h-4 w-4" />
                                Tableau de bord Membre
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild className="focus:text-blue-400 focus:bg-blue-500/10 cursor-pointer rounded-lg font-bold">
                            <Link href="/" className="flex items-center w-full">
                                <Home className="mr-2 h-4 w-4" />
                                Page d'accueil publique
                            </Link>
                        </DropdownMenuItem>
                        
                        <div className="h-px bg-zinc-800 my-1 mx-2" />
                        
                        <DropdownMenuItem onClick={() => signOut()} className="text-red-400 focus:text-red-300 focus:bg-red-500/20 cursor-pointer rounded-lg font-bold">
                            <LogOut className="mr-2 h-4 w-4" />
                            Déconnexion
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}

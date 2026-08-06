import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { LogOut, Home, Terminal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CONSOLE_PAGES, GOD_NAV_GROUPS, ALL_SCOPES_COUNT, type GodNavItem } from "./god-nav-config";

// 🔒 SECURITY (R3): les liens utilisent TOUJOURS godRoute (jamais "/god" en dur)
// pour passer par le proxy anti-scout.

export function GodSidebar({ className, user, unreadCount = 0, ticketCount = 0, activeScopes = [], godRoute = "/god" }: { className?: string; user: any; unreadCount?: number; ticketCount?: number; activeScopes?: string[]; godRoute?: string }) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const activeTab = searchParams.get("tab") || "overview";

    const isFullAdmin = activeScopes.length >= ALL_SCOPES_COUNT;

    const visiblePages = CONSOLE_PAGES.filter(p => {
        if (p.scope === "all") return isFullAdmin;
        return activeScopes.includes(p.scope);
    });

    const grouped = GOD_NAV_GROUPS
        .map(group => ({ ...group, items: visiblePages.filter(p => p.group === group.key) }))
        .filter(g => g.items.length > 0);

    const activeForTab = (page: GodNavItem) => {
        if (page.sub) return pathname.startsWith(`${godRoute}/${page.sub}`);
        return (pathname === godRoute || pathname === "/god") && activeTab === page.id;
    };

    return (
        <div className={cn("flex flex-col h-full bg-zinc-950 border-r border-white/10", className)}>
            <div className="p-6 lg:p-8 pb-4">
                <Link href="/" className="flex items-center gap-4 px-2 group/brand hover:opacity-80 transition-all">
                    <div className="relative h-8 w-8 md:h-10 md:w-10 shrink-0">
                        <Image src="/assets/ui/logo-v2.png" alt="SigilOS" fill priority sizes="(max-width: 768px) 32px, 40px" className="object-contain drop-shadow-[0_0_20px_rgba(168,85,247,0.6)] brightness-110" />
                    </div>
                    <span className="text-lg md:text-2xl font-black tracking-tight text-white leading-none font-heading truncate drop-shadow-md">SIGIL<span className="text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]">GOD</span></span>
                </Link>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 lg:py-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                <nav className="space-y-8">
                    {grouped.map((group) => (
                        <div key={group.key}>
                            <div className="flex items-center gap-3 px-3 mb-4">
                                <group.icon className="h-4 w-4 text-zinc-400" />
                                <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-400">{group.label}</h4>
                            </div>
                            <div className="space-y-1.5">
                                {group.items.map((page) => {
                                    const active = activeForTab(page);
                                    return (
                                        <Link
                                            key={page.id}
                                            href={page.sub ? `${godRoute}/${page.sub}` : `${godRoute}?tab=${page.id}`}
                                            className={cn("flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative",
                                                active ? "bg-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.05)] border border-white/20" : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent")}
                                        >
                                            {active && <div className="absolute left-0 top-3 bottom-3 w-1 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.8)]" />}
                                            <page.icon className={cn("h-5 w-5 transition-all duration-500 group-hover:scale-110", page.color, !active && "opacity-60 group-hover:opacity-100")} />
                                            <span className="text-[12px] font-bold tracking-widest uppercase truncate flex-1">{page.name}</span>
                                            <span className={cn("hidden md:inline-flex text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md border",
                                                page.scope === "all" ? "border-amber-500/30 text-amber-400/80 bg-amber-500/5" : "border-white/10 text-zinc-500 bg-white/5")}>
                                                {page.scopeLabel || (page.scope === "all" ? "SU" : page.scope)}
                                            </span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>
            </div>

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
                                    <span className="text-[11px] font-black text-amber-500 uppercase tracking-widest truncate w-full drop-shadow-sm">Super Admin</span>
                                </div>
                            </div>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 bg-zinc-900 border-zinc-800 text-zinc-200" align="end">
                        <DropdownMenuItem asChild className="focus:text-emerald-400 focus:bg-emerald-500/10 cursor-pointer rounded-lg font-bold">
                            <Link href="/dashboard" className="flex items-center w-full"><Home className="mr-2 h-4 w-4" /> Tableau de bord Membre</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild className="focus:text-blue-400 focus:bg-blue-500/10 cursor-pointer rounded-lg font-bold">
                            <Link href="/" className="flex items-center w-full"><Terminal className="mr-2 h-4 w-4" /> Page d'accueil publique</Link>
                        </DropdownMenuItem>
                        <div className="h-px bg-zinc-800 my-1 mx-2" />
                        <DropdownMenuItem onClick={() => signOut()} className="text-red-400 focus:text-red-300 focus:bg-red-500/20 cursor-pointer rounded-lg font-bold">
                            <LogOut className="mr-2 h-4 w-4" /> Déconnexion
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}
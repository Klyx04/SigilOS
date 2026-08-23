"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LogOut, Home, Terminal } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DiscordAvatarImage } from "@/components/shared/discord-avatar-image";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CONSOLE_PAGES, GOD_NAV_GROUPS, ALL_SCOPES_COUNT, type GodNavItem } from "./god-nav-config";
import { ThemeToggle } from "./ThemeToggle";

// 🔒 SECURITY (R3): les liens utilisent TOUJOURS godRoute (jamais "/god" en dur)
// pour passer par le proxy anti-scout.

// #106 — sidebar God redimensionnable : largeur persistée en localStorage.
const SIDEBAR_STORAGE_KEY = "sigilos-god-sidebar-width";
const DEFAULT_WIDTH = 288; // w-72
const MIN_WIDTH = 264;
const MAX_WIDTH = 520;
const WIDE_THRESHOLD = 360;

export function GodSidebar({ className, user, unreadCount = 0, ticketCount = 0, activeScopes = [], accessibleBricks = [], godRoute = "/god" }: { className?: string; user: any; unreadCount?: number; ticketCount?: number; activeScopes?: string[]; accessibleBricks?: string[]; godRoute?: string }) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const activeTab = searchParams.get("tab") || "overview";

    // #106 — largeur custom + poignée de redimensionnement (persistance).
    const [width, setWidth] = useState(DEFAULT_WIDTH);
    const [isResizing, setIsResizing] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);
    const widthRef = useRef(width);
    useEffect(() => { widthRef.current = width; }, [width]);
    const isWide = width >= WIDE_THRESHOLD;

    useEffect(() => {
        try {
            const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
            if (saved) {
                const parsed = parseInt(saved, 10);
                if (!Number.isNaN(parsed)) setWidth(Math.min(Math.max(parsed, MIN_WIDTH), MAX_WIDTH));
            }
        } catch { /* localStorage indisponible — largeur par défaut */ }
    }, []);

    const startResize = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
    };

    useEffect(() => {
        if (!isResizing) return;
        const onMove = (e: MouseEvent) => {
            const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
            setWidth(Math.min(Math.max(e.clientX - left, MIN_WIDTH), MAX_WIDTH));
        };
        const onUp = () => {
            setIsResizing(false);
            try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(widthRef.current)); } catch { /* ignore */ }
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, [isResizing]);

    const isFullAdmin = activeScopes.length >= ALL_SCOPES_COUNT;

    // 🔄 P2 — Filtrage par BRIQUES ACCESSIBLES (fail-closed, calculé côté serveur).
    //  - un super-admin (isFullAdmin) voit tout (rétro-compat) ;
    //  - un sous-god ne voit QUE les pages dont la brique est dans accessibleBricks.
    const visiblePages = CONSOLE_PAGES.filter(p => {
        if (isFullAdmin) return true;
        return accessibleBricks.includes(p.brickId);
    });

    const grouped = GOD_NAV_GROUPS
        .map(group => ({ ...group, items: visiblePages.filter(p => p.group === group.key) }))
        .filter(g => g.items.length > 0);

    const activeForTab = (page: GodNavItem) => {
        if (page.sub) return pathname.startsWith(`${godRoute}/${page.sub}`);
        return (pathname === godRoute || pathname === "/god") && activeTab === page.id;
    };

    return (
        <div ref={sidebarRef} style={{ width }} className={cn("relative flex flex-col h-full bg-background border-r border-border", className)}>
            <div className="p-6 lg:p-8 pb-4 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-4 px-2 group/brand hover:opacity-80 transition-opacity min-w-0">
                    <div className="relative h-8 w-8 md:h-10 md:w-10 shrink-0">
                        <Image src="/assets/ui/logo-v2.png" alt="SigilOS" fill priority sizes="(max-width: 768px) 32px, 40px" className="object-contain" />
                    </div>
                    <span className="text-lg md:text-2xl font-bold tracking-tight text-foreground leading-none font-heading truncate">SIGIL<span className="text-amber-400">GOD</span></span>
                </Link>
                <div className="p-1 rounded-xl bg-surface border border-border shrink-0">
                    <ThemeToggle />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 lg:py-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                <nav className="space-y-8">
                    {grouped.map((group) => (
                        <div key={group.key}>
                            <div className="flex items-center gap-3 px-3 mb-4">
                                <group.icon className="h-4 w-4 text-muted-foreground" />
                                <h4 className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</h4>
                            </div>
                            <div className="space-y-1.5">
                                {group.items.map((page) => {
                                    const active = activeForTab(page);
                                    return (
                                        <Link
                                            key={page.id}
                                            href={page.sub ? `${godRoute}/${page.sub}${page.query ? `?${page.query}` : ""}` : `${godRoute}?tab=${page.id}`}
                                            className={cn("flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-colors duration-300 group relative",
                                                active ? "bg-surface text-foreground border border-border-strong" : "text-muted-foreground hover:text-foreground hover:bg-surface border border-transparent")}
                                        >
                                            {active && <div className="absolute left-0 top-3 bottom-3 w-1 bg-background rounded-full" />}
                                            <page.icon className={cn("h-5 w-5 transition-colors duration-150", active ? "text-foreground" : "text-muted-foreground opacity-70 group-hover:opacity-100 group-hover:text-foreground")} />
                                            <span className="text-body-sm font-medium truncate flex-1" title={page.name}>{page.name}</span>
                                            {page.id === "notifications" && unreadCount > 0 && (
                                                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-foreground text-caption font-bold leading-none">{unreadCount > 99 ? "99+" : unreadCount}</span>
                                            )}
                                            {page.id === "tickets" && ticketCount > 0 && (
                                                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-500 text-foreground text-caption font-bold leading-none">{ticketCount > 99 ? "99+" : ticketCount}</span>
                                            )}
                                            {/* #106 — badge scope affiché uniquement quand la sidebar est assez large
                                                (évite de tronquer le libellé principal) */}
                                            <span className={cn("text-caption font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md border shrink-0",
                                                isWide ? "inline-flex" : "hidden",
                                                page.scope === "all" ? "border-amber-500/30 text-amber-400/80 bg-amber-500/5" : "border-border text-muted-foreground bg-surface")}>
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

            <div className="p-4 border-t border-border bg-background/80 backdrop-blur-md flex items-center justify-between gap-2">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="flex-1 justify-start h-auto p-2 hover:bg-surface group rounded-xl transition-colors">
                            <div className="flex items-center gap-3 w-full">
                                <Avatar className="h-10 w-10 rounded-lg border-2 border-border shrink-0">
                                    <DiscordAvatarImage src={user.image} />
                                    <AvatarFallback className="bg-elevated text-xs font-bold text-amber-500">SU</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col items-start min-w-0 flex-1 text-left">
                                    <span className="text-caption font-semibold text-amber-400 uppercase tracking-wider truncate w-full">Super Admin</span>
                                </div>
                            </div>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 bg-surface border-border text-foreground" align="end">
                        <DropdownMenuItem asChild className="focus:text-emerald-400 focus:bg-emerald-500/10 cursor-pointer rounded-lg font-medium">
                            <Link href="/dashboard" className="flex items-center w-full"><Home className="mr-2 h-4 w-4" /> Tableau de bord Membre</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild className="focus:text-emerald-400 focus:bg-emerald-500/10 cursor-pointer rounded-lg font-medium">
                            <Link href="/" className="flex items-center w-full"><Terminal className="mr-2 h-4 w-4" /> Page d'accueil publique</Link>
                        </DropdownMenuItem>
                        <div className="h-px bg-elevated my-1 mx-2" />
                        <DropdownMenuItem onClick={() => signOut()} className="text-red-400 focus:text-red-300 focus:bg-red-500/20 cursor-pointer rounded-lg font-medium">
                            <LogOut className="mr-2 h-4 w-4" /> Déconnexion
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* #106 — poignée de redimensionnement (largeur persistée en localStorage) */}
            <div
                className={cn(
                    "absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-amber-500/60 transition-colors z-20",
                    isResizing && "bg-amber-500 w-1.5"
                )}
                onMouseDown={startResize}
                title="Élargir / rétrécir la sidebar — la largeur est sauvegardée"
                aria-hidden="true"
            />
        </div>
    );
}
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { getActiveScopes, getAccessibleBricks, getMyActiveGrants } from "@/server/actions/super-admin-actions";
import { GodSidebar } from "@/components/layout/god-sidebar";
import { GodExpiryGuard } from "./components/god-expiry-guard";
import { GodSessionTracker } from "./components/god-session-tracker";
import { Suspense } from "react";
import { getGodUnreadCounts } from "@/server/actions/god-notif-actions";
import { MobileGodSidebarSheet } from "@/components/layout/mobile-god-sidebar-sheet";
import { GodAccessBanner } from "./components/god-access-banner";
import { getGodRoute } from "@/lib/god-route";
import Link from "next/link";
import { Bell } from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

// R3 anti-scout : le panel God ne doit JAMAIS être indexé par les moteurs de recherche.
export const metadata: Metadata = {
    robots: { index: false, follow: false },
};

export default async function GodLayout({ children }: { children: React.ReactNode }) {
    // R3 : route secrète du panel, injectée aux sidebars "use client"
    // (jamais exposée dans le bundle JS — uniquement dans le HTML serveur).
    const godRoute = getGodRoute();

    // ─── R3 ANTI-SCOUT: vérification du secret — gérée par le middleware ────
    // Le middleware (Node runtime) compare le secret reçu (/mng-<secret>) à
    // GOD_ROUTE AVANT le rewrite, et renvoie 404 si incorrect. Le layout
    // n'a donc plus besoin de relire un header (fragile après rewrite).
    // Le layout continue de vérifier l'auth + les scopes ci-dessous.

    const session = await auth();
    if (!session?.user?.id) {
        redirect("/");
    }

    // Guard : autorise super-admin + tout sub-god avec au moins un scope actif
    // OU au moins une brique accessible (P2 — PIM). Fail-closed si rien.
    // Chaque page/action applicative vérifie ensuite son propre scope/brique.
    const activeScopes = await getActiveScopes();
    const accessibleBricks = await getAccessibleBricks(session.user.id);
    if (activeScopes.length === 0 && accessibleBricks.length === 0) {
        redirect("/");
    }

    // 🔄 P3-R — Accès effectifs du sous-god (briques + expiration) pour la vue "Mon accès".
    const myGrants = await getMyActiveGrants(session.user.id);

    // Super-admin complet = possède tous les scopes (getActiveScopes renvoie tous pour un admin).
    const isFullAdmin = activeScopes.length >= 6;

    // 🧹 A9 — plus AUCUNE ligne de journal par visite : la trace des accès est la
    // **session** (`GodSessionTracker` → `GodSessionLog`) et son compteur agrégé par
    // jour (`getGodAccessDailyStats`, affiché en tête de `/god/logs`). Mesure du
    // 25/09/2026 : `GOD_DASHBOARD_ACCESS` pesait 749 lignes sur 1 033 (`AuditLog`),
    // soit 72 % du journal — noyant tout ce qui comptait.

    // Fetch unread counts for the sidebar badges
    const unreadStats = await getGodUnreadCounts();
    const unreadCount = unreadStats.notifications;
    const ticketCount = unreadStats.tickets;

    return (
        <div className="flex h-screen bg-background font-sans text-foreground selection:bg-primary/20 overflow-hidden dashboard-layout">
            {/* Sidebar for all God pages */}
            <Suspense fallback={<div className="w-72 bg-surface border-r border-border h-full animate-pulse" />}>
                <GodSidebar 
                    className="hidden lg:flex shrink-0" 
                    user={session.user} 
                    unreadCount={unreadCount}
                    ticketCount={ticketCount}
                    activeScopes={activeScopes}
                    accessibleBricks={accessibleBricks}
                    godRoute={godRoute}
                />
            </Suspense>
            
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background border-l border-border relative">
                {/* Mobile Topbar & Hamburger Menu (Visible on lg:hidden) */}
                <div className="lg:hidden flex items-center justify-between p-4 px-6 border-b border-border bg-background z-50 shrink-0">
                    <div className="flex items-center gap-3">
                        <span className="text-xl font-black tracking-tight text-foreground leading-none font-heading flex gap-1">
                            SIGIL<span className="text-amber-500">GOD</span>
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="p-1 rounded-xl bg-surface border border-border shrink-0">
                            <ThemeToggle />
                        </div>
                        <Link
                            href={`${godRoute}?tab=notifications`}
                            aria-label="Notifications"
                            className="relative flex p-2.5 items-center justify-center rounded-xl bg-surface border border-border text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <Bell className="w-5 h-5" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-caption font-bold leading-none">
                                    {unreadCount > 99 ? "99+" : unreadCount}
                                </span>
                            )}
                        </Link>
                        <Suspense fallback={<div className="w-10 h-10 rounded-xl bg-surface animate-pulse" />}>
                            <MobileGodSidebarSheet user={session.user} unreadCount={unreadCount} ticketCount={ticketCount} activeScopes={activeScopes} accessibleBricks={accessibleBricks} godRoute={godRoute} />
                        </Suspense>
                    </div>
                </div>

                {/* Scrollable content view */}
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/10 scrollbar-track-transparent">
                    <GodAccessBanner activeScopes={activeScopes} isFullAdmin={isFullAdmin} myGrants={myGrants} />
                    {children}
                </div>
            </div>

            {/* 🛡️ P3-R — Garde anti-expiration + déconnexion forcée (sous-god uniquement) */}
            {!isFullAdmin && <GodExpiryGuard myGrants={myGrants} />}

            {/* R4 — Session active God (open/heartbeat/close, best-effort) */}
            <GodSessionTracker />
        </div>
    );
}

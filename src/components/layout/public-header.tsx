"use client";

/**
 * En-tête public — registre (refonte anti-slop).
 *
 * Ce qui a été retiré volontairement :
 *  - la barre transparente qui devenait opaque au scroll (le titre passait en
 *    blanc sur l'image du hero, ce qui obligeait à des `drop-shadow`) ;
 *  - l'animation d'entrée `framer-motion` (information nulle) ;
 *  - les libellés vagues (« Produit ») et la pilule marketing.
 *
 * Ce qui le remplace : une barre mate stable, des liens textuels lisibles,
 * un menu « Outils » natif (`<details>`, clavier + Échap) et une seule action
 * mise en avant (Connexion Discord). Le mono est réservé aux métadonnées.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight, LayoutDashboard, LogOut } from "lucide-react";
import type { User } from "next-auth";
import { loginWithDiscord, logoutAction } from "@/server/actions/auth-actions";
import { DiscordIcon } from "@/components/shared/icons";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "./ThemeToggle";
import { DashboardDrawer } from "./dashboard-drawer";
import { LanguageToggle } from "./LanguageToggle";
import { useI18n } from "@/lib/i18n/client";

/** Serveur Discord d'entraide — seule invitation publique connue. */
const DISCORD_INVITE = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "https://discord.gg/uX7G6SUDgN";

/**
 * Outils ouverts sans compte : regroupés sous « Outils » (« Produit » est trop vague).
 *
 * Chaque entrée porte l'asset Dofus réel qui l'identifie en jeu — œuf Sylvestre,
 * marqueur de donjon/boss, œuf Dolmanax (récompense d'Almanax), boussole de carte.
 * Assets colorés et non glyphes blancs : lisibles en thème clair comme en thème
 * sombre, et déjà employés ailleurs dans le produit (pas de nouvelle famille
 * graphique). Ils illustrent un libellé déjà écrit : `alt` vide, décoratifs.
 */
const TOOLS = [
    {
        id: "rush",
        label: "Rush Sylvestre",
        hint: "Étape courante, /travel, reprise",
        href: "/guides/rush-sylvestre",
        icon: "/module-dofus/Dofus_Sylvestre.png",
    },
    {
        id: "boss",
        label: "Fiches boss & donjons",
        hint: "Sorts, portées, résistances",
        href: "/boss",
        icon: "/assets/worldmap/dungeon-boss.png",
    },
    {
        id: "almanax",
        label: "Almanax",
        hint: "Offrande et bonus du jour",
        href: "/almanax",
        icon: "/module-dofus/Dofus_Dolmanax.png",
    },
    {
        id: "carte-du-monde",
        label: "Carte du monde",
        hint: "Positions et trajets",
        href: "/carte-du-monde",
        icon: "/assets/nav/map.png",
    },
] as const;

const NAV_ITEMS = [
    { id: "dashboard", label: "Tableau de bord", href: "/dashboard" },
    { id: "modules", label: "Modules", href: "/modules" },
    { id: "guides", label: "Guides", href: "/guides" },
    { id: "guildes", label: "Guildes", href: "/guilds" },
    { id: "changelog", label: "Journal", href: "/changelog" },
] as const;

/** Un `activePage` désigne soit un lien de nav, soit un outil, soit l'annuaire. */
function resolveActive(activePage?: string): string | null {
    if (!activePage) return null;
    if (TOOLS.some((tool) => tool.id === activePage)) return "outils";
    if (activePage === "annuaire" || activePage === "guilds") return "guildes";
    if (NAV_ITEMS.some((item) => item.id === activePage)) return activePage;
    return null;
}

interface PublicHeaderProps {
    activePage?: string;
    backHref?: string;
    backLabel?: string;
    user?: User;
    /** Conservé pour compatibilité d'appel ; la barre est désormais identique partout. */
    variant?: "hero" | "standard";
    dashboardHref?: string;
    isMember?: boolean;
    isFixed?: boolean;
    clientId?: string;
}

export function PublicHeader({
    activePage,
    backHref,
    backLabel = "Retour",
    user,
    variant: _variant = "standard",
    dashboardHref = "/dashboard",
    isMember,
    isFixed = true,
    clientId: _clientId,
}: PublicHeaderProps) {
    const { t } = useI18n();
    const active = resolveActive(activePage);
    const [toolsOpen, setToolsOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const toolsRef = useRef<HTMLDetailsElement>(null);

    const localizedTools = [
        {
            id: "rush",
            label: t.tools.rushTitle,
            hint: t.tools.rushHint,
            href: "/guides/rush-sylvestre",
            icon: "/module-dofus/Dofus_Sylvestre.png",
        },
        {
            id: "boss",
            label: t.tools.bossTitle,
            hint: t.tools.bossHint,
            href: "/boss",
            icon: "/assets/worldmap/dungeon-boss.png",
        },
        {
            id: "almanax",
            label: t.tools.almanaxTitle,
            hint: t.tools.almanaxHint,
            href: "/almanax",
            icon: "/module-dofus/Dofus_Dolmanax.png",
        },
        {
            id: "carte-du-monde",
            label: t.tools.worldmapTitle,
            hint: t.tools.worldmapHint,
            href: "/carte-du-monde",
            icon: "/assets/nav/map.png",
        },
    ];

    const localizedNav = [
        { id: "dashboard", label: t.nav.dashboard, href: "/dashboard" },
        { id: "modules", label: t.nav.modules, href: "/modules" },
        { id: "guides", label: t.nav.guides, href: "/guides" },
        { id: "guildes", label: t.nav.guilds, href: "/guilds" },
        { id: "changelog", label: t.nav.changelog, href: "/changelog" },
    ];

    // Échap ferme le menu Outils et repose le focus sur son déclencheur ;
    // un clic hors du menu le referme (comportement attendu d'un menu).
    useEffect(() => {
        if (!toolsOpen) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            setToolsOpen(false);
            toolsRef.current?.querySelector("summary")?.focus();
        };
        const onPointerDown = (event: PointerEvent) => {
            if (!toolsRef.current?.contains(event.target as Node)) setToolsOpen(false);
        };
        document.addEventListener("keydown", onKeyDown);
        document.addEventListener("pointerdown", onPointerDown);
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.removeEventListener("pointerdown", onPointerDown);
        };
    }, [toolsOpen]);

    const linkClass = (isActive: boolean) =>
        cn(
            "inline-flex items-center px-2.5 py-1.5 rounded-md text-sm transition-colors",
            isActive
                ? "text-foreground bg-surface font-semibold"
                : "text-muted-foreground font-medium hover:text-foreground hover:bg-surface",
        );

    return (
        <header
            className={cn(
                "w-full z-50 border-b border-border bg-background/95 backdrop-blur-sm",
                isFixed ? "sticky top-0" : "relative",
            )}
        >
            <div className="reg-shell">
                <div className="flex items-center justify-between gap-6 min-h-[3.75rem]">
                    {/* Marque + retour de page */}
                    <div className="flex items-center gap-3 min-w-0">
                        <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="SigilOS, accueil">
                            <Image src="/assets/ui/logo-v2.png" alt="" width={28} height={28} className="object-contain" priority />
                            <span className="text-base font-bold tracking-tight text-foreground leading-none">SigilOS</span>
                        </Link>

                        {backHref && (
                            <Link
                                href={backHref}
                                className="hidden md:inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors truncate"
                            >
                                <ChevronRight className="w-3.5 h-3.5 rotate-180" aria-hidden="true" />
                                <span className="truncate">{backLabel}</span>
                            </Link>
                        )}
                    </div>

                    {/* Navigation principale — liens textuels */}
                    <nav className="hidden lg:flex items-center gap-0.5" aria-label="Navigation principale">
                        {/* « Tableau de bord » sert de point d'entrée : sans session il lance
                            la connexion Discord, sinon il ouvre /dashboard qui redirige
                            vers la guilde unique ou vers la liste des guildes accessibles. */}
                        {user ? (
                            <Link
                                href={dashboardHref}
                                aria-current={active === "dashboard" ? "page" : undefined}
                                className={linkClass(active === "dashboard")}
                            >
                                {t.nav.dashboard}
                            </Link>
                        ) : (
                            <form action={loginWithDiscord}>
                                <button type="submit" className={linkClass(false)}>
                                    {t.nav.dashboard}
                                </button>
                            </form>
                        )}

                        <details
                            ref={toolsRef}
                            className="relative"
                            open={toolsOpen}
                            onToggle={(event) => setToolsOpen((event.currentTarget as HTMLDetailsElement).open)}
                        >
                            <summary
                                className={cn(
                                    linkClass(active === "outils"),
                                    "cursor-pointer list-none [&::-webkit-details-marker]:hidden",
                                )}
                            >
                                {t.nav.tools}
                                <span className="ml-1.5 text-[0.7em] text-muted-foreground" aria-hidden="true">
                                    ▾
                                </span>
                            </summary>
                            <div className="absolute left-0 top-[calc(100%+0.5rem)] w-[19rem] reg-panel p-1.5 z-50">
                                <p className="reg-eyebrow px-2.5 pt-1.5 pb-2">{t.nav.toolsHint}</p>
                                {localizedTools.map((tool) => (
                                    <Link
                                        key={tool.id}
                                        href={tool.href}
                                        onClick={() => setToolsOpen(false)}
                                        className="flex items-start gap-2.5 px-2.5 py-2 rounded-md hover:bg-muted transition-colors"
                                    >
                                        <Image
                                            src={tool.icon}
                                            alt=""
                                            width={20}
                                            height={20}
                                            aria-hidden="true"
                                            className="mt-0.5 w-5 h-5 shrink-0 object-contain"
                                        />
                                        <span className="min-w-0">
                                            <span className="block text-sm font-semibold text-foreground">
                                                {tool.label}
                                            </span>
                                            <span className="block text-xs text-muted-foreground">{tool.hint}</span>
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </details>

                        {localizedNav.slice(1).map((item) => (
                            <Link
                                key={item.id}
                                href={item.href}
                                aria-current={active === item.id ? "page" : undefined}
                                className={linkClass(active === item.id)}
                            >
                                {item.label}
                            </Link>
                        ))}

                        <a
                            href={DISCORD_INVITE}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(linkClass(false), "reg-external")}
                        >
                            Discord
                        </a>
                    </nav>

                    {/* Actions : langue, thème, connexion / compte */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        <LanguageToggle />
                        <ThemeToggle />

                        {user ? (
                            <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild>
                                    <button className="flex items-center gap-2.5 pl-1 pr-2.5 py-1 rounded-md border border-border hover:bg-surface transition-colors outline-none">
                                        <Avatar className="w-7 h-7 rounded-md">
                                            <AvatarImage src={user.image || ""} alt="" />
                                            <AvatarFallback className="bg-elevated text-foreground text-xs font-semibold">
                                                {user.name?.[0]}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="hidden sm:block text-sm font-medium text-foreground max-w-[9rem] truncate">
                                            {user.name}
                                        </span>
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                    <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">
                                        {user.name}
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {isMember !== false && (
                                        <DashboardDrawer>
                                            <DropdownMenuItem
                                                onSelect={(event) => event.preventDefault()}
                                                className="cursor-pointer"
                                            >
                                                <LayoutDashboard className="w-4 h-4 mr-2" aria-hidden="true" />
                                                {t.nav.myGuilds}
                                            </DropdownMenuItem>
                                        </DashboardDrawer>
                                    )}
                                    <DropdownMenuItem asChild className="cursor-pointer">
                                        <Link href={dashboardHref}>
                                            <LayoutDashboard className="w-4 h-4 mr-2" aria-hidden="true" />
                                            {t.nav.dashboard}
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onSelect={() => logoutAction()}
                                        className="cursor-pointer text-danger focus:text-danger"
                                    >
                                        <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
                                        {t.nav.logout}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <form action={loginWithDiscord} className="hidden sm:block">
                                <button type="submit" className="reg-btn reg-btn-primary min-h-9 px-3.5 py-1.5 text-sm">
                                    <DiscordIcon className="w-4 h-4" aria-hidden="true" />
                                    {t.nav.connectDiscord}
                                </button>
                            </form>
                        )}

                        <div className="lg:hidden">
                            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                                <SheetTrigger asChild>
                                    <button
                                        type="button"
                                        aria-label="Ouvrir le menu"
                                        className="w-10 h-10 flex items-center justify-center rounded-md border border-border text-foreground hover:bg-surface transition-colors"
                                    >
                                        <span className="space-y-1.5" aria-hidden="true">
                                            <span className="block w-5 h-px bg-foreground" />
                                            <span className="block w-5 h-px bg-foreground" />
                                            <span className="block w-5 h-px bg-foreground" />
                                        </span>
                                    </button>
                                </SheetTrigger>
                                <SheetContent
                                    side="right"
                                    className="w-[320px] bg-background border-l border-border p-0 overflow-y-auto"
                                >
                                    <nav className="p-5 space-y-6" aria-label="Navigation mobile">
                                        <div className="flex items-center gap-2">
                                            <Image src="/assets/ui/logo-v2.png" alt="" width={24} height={24} className="object-contain" />
                                            <span className="text-base font-bold tracking-tight text-foreground">SigilOS</span>
                                        </div>

                                        <div className="space-y-0.5">
                                            {localizedNav.map((item) =>
                                                item.id === "dashboard" && !user ? (
                                                    <form key={item.id} action={loginWithDiscord}>
                                                        <button
                                                            type="submit"
                                                            className="flex w-full items-center justify-between min-h-11 px-2 rounded-md text-sm font-medium text-foreground hover:bg-surface transition-colors"
                                                        >
                                                            {item.label}
                                                            <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                                                        </button>
                                                    </form>
                                                ) : (
                                                    <Link
                                                        key={item.id}
                                                        href={item.href}
                                                        onClick={() => setMobileOpen(false)}
                                                        className="flex items-center justify-between min-h-11 px-2 rounded-md text-sm font-medium text-foreground hover:bg-surface transition-colors"
                                                    >
                                                        {item.label}
                                                        <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                                                    </Link>
                                                ),
                                            )}
                                            <a
                                                href={DISCORD_INVITE}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-between min-h-11 px-2 rounded-md text-sm font-medium text-foreground hover:bg-surface transition-colors"
                                            >
                                                Discord
                                                <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                                            </a>
                                        </div>

                                        <div className="pt-4 border-t border-border space-y-1">
                                            <p className="reg-eyebrow pb-1">{t.nav.toolsHint}</p>
                                            {localizedTools.map((tool) => (
                                                <Link
                                                    key={tool.id}
                                                    href={tool.href}
                                                    onClick={() => setMobileOpen(false)}
                                                    className="flex items-start gap-3 py-1.5"
                                                >
                                                    <Image
                                                        src={tool.icon}
                                                        alt=""
                                                        width={20}
                                                        height={20}
                                                        aria-hidden="true"
                                                        className="mt-0.5 w-5 h-5 shrink-0 object-contain"
                                                    />
                                                    <span className="min-w-0">
                                                        <span className="block text-sm font-medium text-foreground">
                                                            {tool.label}
                                                        </span>
                                                        <span className="block text-xs text-muted-foreground">
                                                            {tool.hint}
                                                        </span>
                                                    </span>
                                                </Link>
                                            ))}
                                        </div>

                                        {!user && (
                                            <form action={loginWithDiscord} className="pt-4 border-t border-border">
                                                <button type="submit" className="reg-btn reg-btn-primary w-full">
                                                    <DiscordIcon className="w-4 h-4" aria-hidden="true" />
                                                    {t.nav.connectDiscord}
                                                </button>
                                            </form>
                                        )}
                                    </nav>
                                </SheetContent>
                            </Sheet>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}

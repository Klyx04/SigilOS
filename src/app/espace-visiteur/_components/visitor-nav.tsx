"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GameIcon } from "@/components/shared/game-icon";
import { cn } from "@/lib/utils";

/**
 * Un onglet = un **segment d'URL** (D-V6), jamais un état client.
 *
 * Chaque onglet porte l'**asset du jeu** qui l'identifie — même convention que l'en-tête
 * public, l'annuaire et le module Membres : aucun glyphe générique quand un asset existe
 * (`public/assets/dofus/game-icons/` ; `cog.png` vit sous `assets/nav/`). Le test
 * `visitor-shell` vérifie que chaque chemin existe sur disque (piège du 404 documenté).
 */
const SEGMENTS = [
    { href: "/espace-visiteur/general", label: "Général", icon: "party.png", tour: "visitor-nav-general" },
    { href: "/espace-visiteur/notifications", label: "Notifications", icon: "bell-on.png", tour: "visitor-nav-notifications" },
    { href: "/espace-visiteur/mules", label: "Mules", icon: "guilde-et-mules.png", tour: "visitor-nav-mules" },
    { href: "/espace-visiteur/presentation", label: "Présentation", icon: "parchment.png", tour: "visitor-nav-presentation" },
    { href: "/espace-visiteur/succes", label: "Succès", icon: "trophy-1.png", tour: "visitor-nav-succes" },
    { href: "/espace-visiteur/metiers", label: "Métiers", icon: "hammer.png", tour: "visitor-nav-metiers" },
    // Hub « Communauté SigilOS » : la porte visible de `/visiteurs`, à côté de l'espace
    // personnel. Le lien reste aussi dans « Explorer » pour les visiteurs connectés.
    { href: "/visiteurs", label: "Communauté SigilOS", icon: "/assets/dofus/modules/character.png", tour: "visitor-nav-community" },
    { href: "/espace-visiteur/reglages", label: "Réglages", icon: "/assets/nav/cog.png", tour: "visitor-nav-settings" },
] as const;

export function VisitorNav({ unreadCount = 0 }: { unreadCount?: number }) {
    const pathname = usePathname();

    return (
        <nav aria-label="Sections de l'espace visiteur" data-tour="visitor-nav" className="mx-auto w-full max-w-6xl overflow-x-auto px-2">
            <ul className="flex min-w-max gap-1 pb-2">
                {SEGMENTS.map((segment) => {
                    const active =
                        pathname === segment.href ||
                        (segment.href === "/visiteurs" && pathname.startsWith("/visiteurs/"));
                    return (
                        <li key={segment.href}>
                            <Link
                                href={segment.href}
                                data-tour={segment.tour}
                                aria-current={active ? "page" : undefined}
                                aria-label={
                                    segment.href === "/espace-visiteur/notifications" && unreadCount > 0
                                        ? `Notifications (${unreadCount} non lues)`
                                        : undefined
                                }
                                className={cn(
                                    "inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    active && "bg-elevated font-medium text-foreground"
                                )}
                            >
                                <GameIcon src={segment.icon} className="h-4 w-4" />
                                {segment.label}
                                {segment.href === "/espace-visiteur/notifications" && unreadCount > 0 && (
                                    <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-medium leading-5 text-primary-foreground">
                                        {unreadCount > 99 ? "99+" : unreadCount}
                                    </span>
                                )}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}

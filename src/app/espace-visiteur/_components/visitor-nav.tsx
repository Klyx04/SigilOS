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
    { href: "/espace-visiteur/general", label: "Général", icon: "party.png" },
    { href: "/espace-visiteur/mules", label: "Mules", icon: "guilde-et-mules.png" },
    { href: "/espace-visiteur/presentation", label: "Présentation", icon: "parchment.png" },
    { href: "/espace-visiteur/succes", label: "Succès", icon: "trophy-1.png" },
    { href: "/espace-visiteur/metiers", label: "Métiers", icon: "hammer.png" },
    { href: "/espace-visiteur/reglages", label: "Réglages", icon: "/assets/nav/cog.png" },
] as const;

export function VisitorNav() {
    const pathname = usePathname();

    return (
        <nav aria-label="Sections de l'espace visiteur" className="mx-auto w-full max-w-6xl overflow-x-auto px-2">
            <ul className="flex min-w-max gap-1 pb-2">
                {SEGMENTS.map((segment) => {
                    const active = pathname === segment.href;
                    return (
                        <li key={segment.href}>
                            <Link
                                href={segment.href}
                                aria-current={active ? "page" : undefined}
                                className={cn(
                                    "inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    active && "bg-elevated font-medium text-foreground"
                                )}
                            >
                                <GameIcon src={segment.icon} className="h-4 w-4" />
                                {segment.label}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}

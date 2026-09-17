"use client";

/**
 * Accès au soutien (Ko-fi) — version registre.
 *
 * Ce qui a été retiré volontairement (audit UI/UX anti-slop) :
 *  - la carte `rounded-2xl backdrop-blur-xl shadow-2xl shadow-black/70` posée
 *    en bas à droite : le gabarit « widget SaaS » flottant ;
 *  - le cœur dans une tuile teintée émeraude — un pictogramme dans un carré
 *    coloré, motif explicitement visé par l'audit ;
 *  - les libellés en capitales `font-black` sur deux lignes (SOUTENIR SIGILOS /
 *    Donation Ko-fi) et la double couleur vert + ambre qui se disputaient l'œil
 *    pour une seule action ;
 *  - les micro-animations (`hover:scale`, `translate-x`, `fill` animé) qui ne
 *    transmettent aucun état.
 *
 * Ce qui reste : un lien unique, une ligne, une icône reconnaissable (le café
 * = « buy me a coffee »), et la même destination Ko-fi.
 *
 * Portée : le soutien vit d'abord dans le pied de page. Cet accès flottant
 * n'existe que dans les espaces connectés — il est masqué sur les routes
 * publiques « registre » et en vue plein écran (règles
 * `body.*-fullscreen .support-orb`). La classe `support-orb` est donc conservée.
 */

import { Coffee } from "lucide-react";
import { usePathname } from "next/navigation";
import { isPublicRoute } from "@/lib/public-routes";

const SUPPORT_URL = "https://ko-fi.com/wylan";

export function SupportOrb() {
    const pathname = usePathname();
    // Masqué sur les routes overlay et worldmap/mini-jeux pour ne pas couvrir les contrôles de jeu
    if (pathname?.startsWith("/overlay") || pathname?.includes("/worldmap") || pathname?.includes("/mini-jeux")) return null;
    // Masqué sur les pages publiques : le soutien y est dans le pied de page.
    if (isPublicRoute(pathname)) return null;

    return (
        <div className="support-orb fixed bottom-4 right-4 z-[100]">
            <a
                href={SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Soutenir SigilOS — ouvre Ko-fi dans un nouvel onglet"
                className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
            >
                <Coffee className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Soutenir SigilOS</span>
                <span aria-hidden="true">↗</span>
            </a>
        </div>
    );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Un onglet = un **segment d'URL** (D-V6), jamais un état client. */
const SEGMENTS = [
    { href: "/espace-visiteur/general", label: "Général" },
    { href: "/espace-visiteur/mules", label: "Mules" },
    { href: "/espace-visiteur/presentation", label: "Présentation" },
    { href: "/espace-visiteur/succes", label: "Succès" },
    { href: "/espace-visiteur/metiers", label: "Métiers" },
    { href: "/espace-visiteur/reglages", label: "Réglages" },
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
                                    "inline-flex h-10 items-center rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    active && "bg-elevated font-medium text-foreground"
                                )}
                            >
                                {segment.label}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}

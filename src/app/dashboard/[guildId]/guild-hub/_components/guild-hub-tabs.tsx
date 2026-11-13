"use client";

import { BookOpen, MessageSquare, ScrollText, LucideIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

interface GuildHubTabsProps {
    initialTab: string;
    canViewWelcome: boolean;
    canViewPresentation: boolean;
    canViewRules: boolean;
}

interface HubEntry {
    id: string;
    label: string;
    icon: LucideIcon;
}

/**
 * Navigation du hub « La Guilde ».
 *
 * Refonte (14/10) : les deux grosses cartes empilées (bloc icône 44 px, pastille, chevron) sont
 * remplacées par une **barre segmentée compacte** — même vocabulaire que les filtres du module
 * Membres (actif = fond `accent-soft` + texte `accent`, jamais de dégradé ni d'ombre) : une seule
 * ligne, lisible en mobile comme en desktop.
 * Le règlement intérieur gagne **sa propre destination** : il était noyé sous le manifeste de la
 * présentation, donc introuvable côté membre.
 */
export function GuildHubTabs({
    initialTab,
    canViewWelcome,
    canViewPresentation,
    canViewRules,
}: GuildHubTabsProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    function setTab(tab: string) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", tab);
        router.push(`?${params.toString()}`);
    }

    const entries = [
        canViewWelcome ? { id: "welcome", label: "Bienvenue", icon: MessageSquare } : null,
        canViewPresentation ? { id: "presentation", label: "Présentation", icon: BookOpen } : null,
        canViewRules ? { id: "reglement", label: "Règlement", icon: ScrollText } : null,
    ].filter((entry): entry is HubEntry => entry !== null);

    return (
        <nav
            aria-label="Sections de la guilde"
            className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border-strong bg-surface p-1.5"
        >
            {entries.map((entry) => {
                const isActive = initialTab === entry.id;
                const Icon = entry.icon;
                return (
                    <button
                        key={entry.id}
                        type="button"
                        onClick={() => setTab(entry.id)}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                            "inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-border-strong",
                            isActive
                                ? "bg-accent-soft text-accent"
                                : "text-muted-foreground hover:bg-elevated hover:text-foreground"
                        )}
                    >
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        {entry.label}
                    </button>
                );
            })}
        </nav>
    );
}

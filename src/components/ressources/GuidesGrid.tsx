"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Clock, Search, Tv2 } from "lucide-react";
import { useRaidOverlay } from "@/hooks/use-raid-overlay";
import { cn } from "@/lib/utils";
import type { Guide } from "@/content/guides";

interface GuidesGridProps {
    guides: readonly Guide[];
}

/**
 * Carte d'un guide raid : overlay PiP + lien Raid Studio.
 * Slugs du registre (`src/content/guides/index.ts`).
 */
const RAID_GUIDE_CONFIG: Record<string, { raidSlug: "gigalodon" | "jardin-eternel"; studioHref: string; themeColor: string }> = {
    "raid-gigalodon-dofus-guide": {
        raidSlug: "gigalodon",
        studioHref: "/raids?raid=gigalodon",
        themeColor: "#06b6d4",
    },
    "raid-sanctuaire-jardins-eternels-dofus-guide": {
        raidSlug: "jardin-eternel",
        studioHref: "/raids?raid=sanctuaire",
        themeColor: "#10b981",
    },
};

function RaidGuideActions({ slug }: { slug: string }) {
    const config = RAID_GUIDE_CONFIG[slug];
    const { openRaidOverlay } = useRaidOverlay();
    if (!config) return null;

    return (
        <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
                type="button"
                onClick={() => openRaidOverlay({ raidSlug: config.raidSlug })}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black uppercase tracking-wider text-black transition-all hover:brightness-110 active:scale-[0.98]"
                style={{ backgroundColor: config.themeColor }}
            >
                <Tv2 className="h-3.5 w-3.5" aria-hidden="true" />
                Lancer l'Overlay
            </button>
            <Link
                href={config.studioHref}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
                Raid Studio
            </Link>
        </div>
    );
}

export function GuidesGrid({ guides }: GuidesGridProps) {
    const [query, setQuery] = useState("");
    const [category, setCategory] = useState<string>("all");

    const categories = useMemo(() => {
        const set = new Set<string>();
        for (const guide of guides) {
            if (guide.category) set.add(guide.category);
        }
        return [...set].sort((a, b) => a.localeCompare(b, "fr"));
    }, [guides]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return guides.filter((guide) => {
            if (category !== "all" && guide.category !== category) return false;
            if (!q) return true;
            return (
                guide.title.toLowerCase().includes(q) ||
                guide.description.toLowerCase().includes(q)
            );
        });
    }, [guides, query, category]);

    if (guides.length === 0) {
        return (
            <div className="rounded-2xl border border-border bg-surface p-10 text-center">
                <p className="text-sm font-medium text-muted-foreground">Aucun guide publié pour le moment.</p>
            </div>
        );
    }

    return (
        <div>
            {/* Filtres : recherche + catégories (parité avec l'index public /guides) */}
            <div className="mb-4 flex flex-col gap-3">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Rechercher un guide…"
                        aria-label="Rechercher un guide"
                        className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-border focus:outline-none"
                    />
                </div>
                {categories.length > 1 && (
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par catégorie">
                        <button
                            type="button"
                            onClick={() => setCategory("all")}
                            aria-pressed={category === "all"}
                            className={cn(
                                "rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors",
                                category === "all"
                                    ? "border-border bg-elevated text-foreground"
                                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                            )}
                        >
                            Tous
                        </button>
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setCategory(cat)}
                                aria-pressed={category === cat}
                                className={cn(
                                    "rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors",
                                    category === cat
                                        ? "border-border bg-elevated text-foreground"
                                        : "border-border bg-background text-muted-foreground hover:text-foreground",
                                )}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {filtered.length === 0 ? (
                <div className="rounded-2xl border border-border bg-surface p-10 text-center">
                    <p className="text-sm font-medium text-muted-foreground">Aucun guide ne correspond à ce filtre.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {filtered.map((guide) => {
                        const guideHref = "/guides/" + guide.slug;
                        const raidConfig = RAID_GUIDE_CONFIG[guide.slug];
                        return (
                            <article
                                key={guide.slug}
                                className="group flex items-start gap-4 rounded-2xl border border-border bg-surface p-5 transition-colors hover:bg-elevated"
                            >
                                {/* Vignette compacte (même registre que les guides publics) :
                                    les covers icônes (runes, dragodindes) sont de petits sprites —
                                    en plein cadre elles pixelisent, en 64 px elles restent nettes. */}
                                {guide.coverImage ? (
                                    <Link href={guideHref} className="block h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted" tabIndex={-1} aria-hidden="true">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={guide.coverImage}
                                            alt=""
                                            loading="lazy"
                                            width={64}
                                            height={64}
                                            className="h-full w-full object-cover"
                                        />
                                    </Link>
                                ) : (
                                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
                                        <FileText className="h-5 w-5 text-muted-foreground/60" aria-hidden="true" />
                                    </span>
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption font-medium text-muted-foreground">
                                        {guide.category && (
                                            <span className="text-[0.6875rem] font-black uppercase tracking-wider text-foreground">
                                                {guide.category}
                                            </span>
                                        )}
                                        <span className="inline-flex items-center gap-1.5">
                                            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                                            {new Date(guide.updatedAt).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })}
                                        </span>
                                        {guide.readingTime && (
                                            <span className="inline-flex items-center gap-1.5">
                                                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                                                {guide.readingTime} de lecture
                                            </span>
                                        )}
                                    </p>
                                    <Link href={guideHref}>
                                        <h3 className="mt-1.5 text-base font-bold leading-snug text-foreground transition-colors group-hover:text-emerald-500">
                                            {guide.title}
                                        </h3>
                                    </Link>
                                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground line-clamp-2">
                                        {guide.description}
                                    </p>
                                    {raidConfig ? (
                                        <RaidGuideActions slug={guide.slug} />
                                    ) : (
                                        <div className="mt-3">
                                            <Link
                                                href={guideHref}
                                                className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
                                            >
                                                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                                                Lire le guide
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

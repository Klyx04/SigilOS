"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, X, Sparkles, ArrowRight, Filter } from "lucide-react";
import type { BestiaryHubResponse } from "@/server/actions/game-data-actions";
import { monsterSpriteUrl } from "@/lib/monster-fiche";
import { cn } from "@/lib/utils";

interface BestiaryHubClientProps {
    hub: BestiaryHubResponse;
    labels: {
        searchPlaceholder: string;
        otherFamily: string;
        familyFiches: string;
        levelShort: string;
        empty: string;
        noResults: string;
    };
}

const FAMILIES_PER_PAGE = 16;
const MONSTERS_PER_PAGE = 36;

export function BestiaryHubClient({ hub, labels }: BestiaryHubClientProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedSuperRace, setSelectedSuperRace] = useState<string>("ALL");
    const [visibleFamiliesCount, setVisibleFamiliesCount] = useState(FAMILIES_PER_PAGE);
    const [visibleMonstersCount, setVisibleMonstersCount] = useState(MONSTERS_PER_PAGE);

    // Collect super races
    const superRaces = useMemo(() => {
        const set = new Set<string>();
        for (const f of hub.families) {
            if (f.superRaceName) set.add(f.superRaceName);
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [hub.families]);

    const cleanQuery = searchQuery.trim().toLowerCase();

    // Filtered data
    const { filteredFamilies, matchedMonsters } = useMemo(() => {
        if (!cleanQuery) {
            let families = hub.families;
            if (selectedSuperRace !== "ALL") {
                families = families.filter(f => f.superRaceName === selectedSuperRace);
            }
            return { filteredFamilies: families, matchedMonsters: [] };
        }

        // When search is active, find all matching monsters across families
        const matches: Array<{
            monsterId: number;
            name: string;
            slug: string;
            level: number;
            familyName: string;
            superRaceName?: string | null;
        }> = [];

        const matchingFamilies: typeof hub.families = [];

        for (const family of hub.families) {
            if (selectedSuperRace !== "ALL" && family.superRaceName !== selectedSuperRace) {
                continue;
            }

            const familyNameMatch = (family.name || "").toLowerCase().includes(cleanQuery);
            const monstersMatching = family.monsters.filter(m =>
                m.name.toLowerCase().includes(cleanQuery) || familyNameMatch
            );

            if (monstersMatching.length > 0) {
                matchingFamilies.push({
                    ...family,
                    monsters: monstersMatching,
                });

                for (const m of monstersMatching) {
                    matches.push({
                        ...m,
                        familyName: family.name ?? labels.otherFamily,
                        superRaceName: family.superRaceName,
                    });
                }
            }
        }

        return { filteredFamilies: matchingFamilies, matchedMonsters: matches };
    }, [hub.families, cleanQuery, selectedSuperRace, labels.otherFamily]);

    const isSearching = cleanQuery.length > 0;

    return (
        <div className="space-y-6">
            {/* Search and Filters Bar */}
            <div className="p-4 rounded-xl border border-border bg-surface/50 backdrop-blur-md space-y-3 shadow-xs">
                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Search Input */}
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setVisibleMonstersCount(MONSTERS_PER_PAGE);
                            }}
                            placeholder={labels.searchPlaceholder}
                            className="w-full h-10 pl-10 pr-9 rounded-lg bg-background/80 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-border-strong transition-colors"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                                aria-label="Effacer la recherche"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Result counter */}
                    <div className="flex items-center px-3 py-2 rounded-lg bg-background/50 border border-border text-xs text-muted-foreground shrink-0 font-medium">
                        {isSearching ? (
                            <span>{matchedMonsters.length} monstre{matchedMonsters.length > 1 ? "s" : ""} trouvé{matchedMonsters.length > 1 ? "s" : ""}</span>
                        ) : (
                            <span>{filteredFamilies.length} famille{filteredFamilies.length > 1 ? "s" : ""}</span>
                        )}
                    </div>
                </div>

                {/* Category Pills */}
                {superRaces.length > 0 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedSuperRace("ALL");
                                setVisibleFamiliesCount(FAMILIES_PER_PAGE);
                            }}
                            className={cn(
                                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer shrink-0 border",
                                selectedSuperRace === "ALL"
                                    ? "bg-foreground text-background border-foreground font-semibold"
                                    : "bg-background/60 text-muted-foreground border-border hover:text-foreground hover:bg-surface"
                            )}
                        >
                            Toutes
                        </button>
                        {superRaces.map((sr) => (
                            <button
                                key={sr}
                                type="button"
                                onClick={() => {
                                    setSelectedSuperRace(sr);
                                    setVisibleFamiliesCount(FAMILIES_PER_PAGE);
                                }}
                                className={cn(
                                    "px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer shrink-0 border",
                                    selectedSuperRace === sr
                                        ? "bg-foreground text-background border-foreground font-semibold"
                                        : "bg-background/60 text-muted-foreground border-border hover:text-foreground hover:bg-surface"
                                )}
                            >
                                {sr}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Content: Search flat view vs Families grouped view */}
            {isSearching ? (
                /* Flat monster list when searching */
                matchedMonsters.length > 0 ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                            {matchedMonsters.slice(0, visibleMonstersCount).map((monster) => {
                                const sprite = monsterSpriteUrl(monster.monsterId);
                                return (
                                    <Link
                                        key={monster.slug}
                                        href={`/bestiaire/${monster.slug}`}
                                        className="flex items-center gap-2.5 rounded-xl border border-border bg-surface/50 hover:bg-surface hover:border-border-strong p-2.5 transition-colors group"
                                    >
                                        {sprite ? (
                                            <img
                                                src={sprite}
                                                alt=""
                                                width={32}
                                                height={32}
                                                decoding="async"
                                                loading="lazy"
                                                className="h-8 w-8 shrink-0 object-contain"
                                            />
                                        ) : null}
                                        <div className="min-w-0 flex-1">
                                            <span className="block truncate text-xs font-semibold text-foreground group-hover:text-foreground">
                                                {monster.name}
                                            </span>
                                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                                {monster.level > 0 && (
                                                    <span className="font-mono">
                                                        {labels.levelShort} {monster.level}
                                                    </span>
                                                )}
                                                <span className="truncate opacity-75">· {monster.familyName}</span>
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>

                        {visibleMonstersCount < matchedMonsters.length && (
                            <div className="text-center pt-2">
                                <button
                                    type="button"
                                    onClick={() => setVisibleMonstersCount(prev => prev + MONSTERS_PER_PAGE)}
                                    className="px-4 py-2 rounded-lg bg-surface border border-border hover:border-border-strong text-xs font-semibold text-foreground cursor-pointer transition-colors"
                                >
                                    Afficher plus ({matchedMonsters.length - visibleMonstersCount} restants)
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="p-12 text-center border border-dashed border-border rounded-xl bg-surface/20 space-y-2">
                        <p className="text-sm font-semibold text-foreground">{labels.noResults}</p>
                        <p className="text-xs text-muted-foreground">Aucun monstre ne correspond à &laquo;&nbsp;{searchQuery}&nbsp;&raquo;</p>
                        <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            className="mt-2 text-xs font-semibold text-warning hover:underline cursor-pointer"
                        >
                            Effacer la recherche
                        </button>
                    </div>
                )
            ) : (
                /* Grouped Families View */
                filteredFamilies.length > 0 ? (
                    <div className="space-y-5">
                        {filteredFamilies.slice(0, visibleFamiliesCount).map((family) => (
                            <section
                                key={family.raceId}
                                className="rounded-xl border border-border bg-surface/30 p-4 sm:p-5 space-y-3"
                                style={{ contentVisibility: "auto", containIntrinsicSize: "auto 400px" }}
                            >
                                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/50 pb-2.5">
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-sm sm:text-base font-bold text-foreground">
                                            {family.name ?? labels.otherFamily}
                                        </h2>
                                        {family.superRaceName && (
                                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                                                <Sparkles className="w-3 h-3 text-muted-foreground" />
                                                {family.superRaceName}
                                            </span>
                                        )}
                                    </div>
                                    <span className="font-mono text-[11px] text-muted-foreground">
                                        {labels.familyFiches.replace("{count}", String(family.monsters.length))}
                                    </span>
                                </div>

                                <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                    {family.monsters.map((monster) => {
                                        const sprite = monsterSpriteUrl(monster.monsterId);
                                        return (
                                            <li key={monster.slug}>
                                                <Link
                                                    href={`/bestiaire/${monster.slug}`}
                                                    className="flex items-center gap-2 rounded-lg border border-border/80 bg-background/50 hover:bg-surface hover:border-border-strong p-2 transition-colors group"
                                                >
                                                    {sprite ? (
                                                        <img
                                                            src={sprite}
                                                            alt=""
                                                            width={30}
                                                            height={30}
                                                            decoding="async"
                                                            loading="lazy"
                                                            className="h-7.5 w-7.5 shrink-0 object-contain"
                                                        />
                                                    ) : null}
                                                    <div className="min-w-0 flex-1">
                                                        <span className="block truncate text-xs font-medium text-foreground group-hover:text-foreground">
                                                            {monster.name}
                                                        </span>
                                                        {monster.level > 0 && (
                                                            <span className="block font-mono text-[10px] text-muted-foreground">
                                                                {labels.levelShort} {monster.level}
                                                            </span>
                                                        )}
                                                    </div>
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </section>
                        ))}

                        {visibleFamiliesCount < filteredFamilies.length && (
                            <div className="text-center pt-2 pb-6">
                                <button
                                    type="button"
                                    onClick={() => setVisibleFamiliesCount(prev => prev + FAMILIES_PER_PAGE)}
                                    className="px-5 py-2.5 rounded-xl bg-surface border border-border hover:border-border-strong text-xs font-semibold text-foreground cursor-pointer transition-colors shadow-xs"
                                >
                                    Afficher plus de familles ({filteredFamilies.length - visibleFamiliesCount} restantes)
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="rounded-xl border border-border bg-surface/30 p-6 text-sm text-muted-foreground text-center">
                        {labels.empty}
                    </p>
                )
            )}
        </div>
    );
}

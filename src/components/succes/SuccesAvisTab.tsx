"use client";

/**
 * Onglet « Fiches Avis de recherche » — module Succès.
 *
 * Même exigence que les onglets Fiches Boss / Anomalies / Titans : **une seule source
 * de vérité** par donnée. Ici, tout vient du **siphon** (`Bounty` + `MonsterStat`) via
 * `getBountyFiche` (lecture **locale**) : sorts, paliers, butin, zone de traque, prime,
 * critères de chasse et carte de simulation. Aucune saisie à la main, aucun appel
 * DofusDB/Dofensive à l'ouverture d'une fiche.
 *
 * ⚠️ Le **rendu** d'une fiche vit dans `BountyFicheView` — partagé avec la carte du
 * monde (fiche de zone, onglet « Avis de recherche ») : l'avis se lit donc exactement
 * pareil dans le module et sur la carte, et une correction ne se fait qu'une fois.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Circle, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getBestiaireCatalog, type BestiaireEntry } from "@/server/actions/game-data-actions";
import { getBountyFiche, type BountyFichePayload } from "@/server/actions/bounty-actions";
import {
    getMySuccesCharacters,
    getUserBountyCompletions,
    toggleUserBounty,
} from "@/server/actions/dungeon-achievement-actions";
import { BountyFicheView, MonsterImage } from "@/components/succes/BountyFicheView";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SuccesCharacter } from "@/lib/succes-characters";

export function SuccesAvisTab({ guildId }: { guildId: string }) {
    const [catalog, setCatalog] = useState<BestiaireEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [fiche, setFiche] = useState<BountyFichePayload | null>(null);
    const [loadingFiche, setLoadingFiche] = useState(false);
    const [characters, setCharacters] = useState<SuccesCharacter[]>([]);
    const [characterSlot, setCharacterSlot] = useState("PRINCIPAL");
    const [checkedBounties, setCheckedBounties] = useState<Set<string>>(() => new Set());
    const [pendingBounty, setPendingBounty] = useState(false);
    // Lien profond `?dungeon=<slug>` : « ouvre la fiche de CE monstre » (carte du monde
    // → onglet Familles → fiche du monstre).
    const dungeonParam = useSearchParams().get("dungeon");

    // Personnages sélectionnables : principal + mules déclarées.
    useEffect(() => {
        let cancelled = false;
        getMySuccesCharacters(guildId)
            .then((res) => {
                if (cancelled || !res.success || !res.characters || res.characters.length === 0) {
                    return;
                }
                setCharacters(res.characters);
                setCharacterSlot((current) =>
                    res.characters!.some((character) => character.slot === current)
                        ? current
                        : res.characters![0].slot
                );
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [guildId]);

    // Coches d'avis du personnage sélectionné.
    useEffect(() => {
        let cancelled = false;
        getUserBountyCompletions(guildId, characterSlot)
            .then((res) => {
                if (cancelled) return;
                if (res.success && res.bountyIds) setCheckedBounties(new Set(res.bountyIds));
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [guildId, characterSlot]);

    // 1. Catalogue des avis — **uniquement** les lignes siphonnées (`isBountyMonster`).
    useEffect(() => {
        let cancelled = false;
        getBestiaireCatalog()
            .then((res) => {
                if (cancelled) return;
                if (res.success && Array.isArray(res.data)) {
                    setCatalog(res.data.filter((e) => e.type === "bounty"));
                }
            })
            .catch(() => {})
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        const list = q
            ? catalog.filter((e) => e.bossName.toLowerCase().includes(q) || e.name.toLowerCase().includes(q))
            : catalog;
        return [...list].sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || a.bossName.localeCompare(b.bossName, "fr"));
    }, [catalog, search]);

    // Jamais d'écran vide à l'arrivée : le premier avis (trié par niveau) est ouvert
    // d'office — sauf si un lien profond valide impose une fiche précise.
    const autoSelectedRef = useRef(false);
    useEffect(() => {
        if (autoSelectedRef.current || loading || catalog.length === 0) return;
        autoSelectedRef.current = true;
        const requested = (dungeonParam ?? "").trim().toLowerCase();
        if (requested) {
            const match = catalog.find(
                (e) => (e.slug ?? "").toLowerCase() === requested || e.id.toLowerCase() === requested
            );
            if (match) {
                setSelectedId(match.id);
                return;
            }
        }
        const first = [...catalog].sort(
            (a, b) => (a.level ?? 0) - (b.level ?? 0) || a.bossName.localeCompare(b.bossName, "fr")
        )[0];
        if (first) setSelectedId(first.id);
    }, [loading, catalog, dungeonParam]);

    // 2. Fiche locale de l'avis sélectionné (aucun appel sortant).
    useEffect(() => {
        if (!selectedId) {
            setFiche(null);
            return;
        }
        let cancelled = false;
        setLoadingFiche(true);
        getBountyFiche(selectedId)
            .then((res) => {
                if (!cancelled) setFiche(res.success && res.data ? res.data : null);
            })
            .catch(() => {
                if (!cancelled) setFiche(null);
            })
            .finally(() => {
                if (!cancelled) setLoadingFiche(false);
            });
        return () => { cancelled = true; };
    }, [selectedId]);

    const selected = filtered.find((e) => e.id === selectedId) ?? catalog.find((e) => e.id === selectedId) ?? null;

    /** Coche / décoche l'avis ouvert pour le personnage sélectionné (optimiste + rollback). */
    const toggleSelectedBounty = async () => {
        if (!selectedId || pendingBounty) return;
        const wasChecked = checkedBounties.has(selectedId);
        setPendingBounty(true);
        setCheckedBounties((current) => {
            const next = new Set(current);
            if (wasChecked) next.delete(selectedId);
            else next.add(selectedId);
            return next;
        });

        const result = await toggleUserBounty({
            guildId,
            bountyId: selectedId,
            characterSlot,
        });
        setPendingBounty(false);

        if (!result.success) {
            setCheckedBounties((current) => {
                const next = new Set(current);
                if (wasChecked) next.add(selectedId);
                else next.delete(selectedId);
                return next;
            });
            toast.error(result.error ?? "Impossible d'enregistrer cet avis.");
            return;
        }
        toast.success(result.done ? "Avis marqué comme fait." : "Avis décoché.");
    };


    return (
        <div className="grid gap-4 2xl:grid-cols-[320px_1fr]">
            {/* ── LISTE ─────────────────────────────────────────────────────────── */}
            <div className="rounded-2xl border border-border bg-surface/70 p-3 space-y-3">
                <div className="flex items-center justify-between">
                    <p className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">
                        Avis de recherche
                    </p>
                    <span className="font-mono text-[11px] text-muted-foreground">{filtered.length}</span>
                </div>
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher un avis ou une zone…"
                        className="w-full rounded-lg border border-border bg-background/60 py-1.5 pl-8 pr-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                </div>
                {characters.length > 1 ? (
                    <Select value={characterSlot} onValueChange={setCharacterSlot}>
                        <SelectTrigger
                            aria-label="Choisir le personnage"
                            className="h-8 w-full rounded-lg border-border bg-background/60 text-xs font-semibold text-foreground"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-surface border-border">
                            {characters.map((character) => (
                                <SelectItem key={character.slot} value={character.slot} className="text-xs">
                                    {character.name}
                                    {character.isMain ? " (principal)" : ""}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                ) : null}
                <div className="max-h-[60vh] space-y-1 overflow-y-auto pr-0.5">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <p className="py-8 text-center text-xs text-muted-foreground">
                            Aucun avis de recherche en base — lancez le siphon (God → Données de jeu).
                        </p>
                    ) : (
                        filtered.map((e) => (
                            <button
                                key={e.id}
                                type="button"
                                onClick={() => setSelectedId(e.id)}
                                className={cn(
                                    "flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors",
                                    selectedId === e.id
                                        ? "border-border-strong bg-elevated/90"
                                        : "border-transparent bg-elevated/40 hover:bg-elevated/70"
                                )}
                            >
                                <MonsterImage
                                    src={e.imageUrl}
                                    monsterId={e.dofusdbId ?? undefined}
                                    className="h-9 w-9 shrink-0 rounded-lg object-contain"
                                />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-xs font-semibold text-foreground">{e.bossName}</span>
                                    <span className="block truncate text-[10px] text-muted-foreground">{e.name}</span>
                                </span>
                                {e.level > 0 && <span className="font-mono text-[10px] text-muted-foreground">niv. {e.level}</span>}
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* ── FICHE (rendu partagé avec la carte du monde) ──────────────────── */}
            <div className="min-w-0">
                {selectedId ? (
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <button
                            type="button"
                            aria-pressed={checkedBounties.has(selectedId)}
                            onClick={toggleSelectedBounty}
                            disabled={pendingBounty}
                            className={cn(
                                "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                                checkedBounties.has(selectedId)
                                    ? "border-border-strong bg-elevated text-foreground"
                                    : "border-border bg-surface text-muted-foreground hover:bg-elevated hover:text-foreground"
                            )}
                        >
                            {checkedBounties.has(selectedId) ? (
                                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                            ) : (
                                <Circle className="size-3.5" aria-hidden="true" />
                            )}
                            {checkedBounties.has(selectedId) ? "Avis fait" : "Marquer fait"}
                        </button>
                    </div>
                ) : null}
                <BountyFicheView
                    fiche={fiche}
                    guildId={guildId}
                    loading={loadingFiche}
                    fallbackImageUrl={selected?.imageUrl ?? null}
                />
            </div>
        </div>
    );
}

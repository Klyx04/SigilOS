"use client";

/**
 * Onglet « Monstres » — module Succès.
 *
 * 🎯 Demande user (11/10/2026) : « un onglet fiche qui liste tous les monstres normaux hors
 * boss de dj / avis de recherche / anomalie / titans / boss de raid … et leur fiche existerait ».
 *
 * Ici, la **liste** couvre TOUT le bestiaire local (`unity-bestiary.json`, 5 129 monstres),
 * filtré par la règle pure `@/lib/monster-fiche` (`isNormalMonster`) et les exclusions lues
 * en base (boss de donjon, avis de recherche, titans) : c'est `searchNormalMonsters`. La
 * **fiche** du monstre sélectionné vient de la MÊME source que la page publique
 * (`getMonsterFicheBySegment`) et se rend avec le MÊME composant (`MonsterFicheView`) :
 * interne et public ne peuvent plus diverger. Aucune requête réseau, aucun tiers.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMonsterFicheBySegment, searchNormalMonsters, type BestiaireEntry } from "@/server/actions/game-data-actions";
import { MonsterFicheView, type MonsterFichePayload } from "@/components/succes/MonsterFicheView";
import { MonsterFamilyFilter } from "@/components/succes/MonsterFamilyFilter";
import { MonsterImage } from "@/components/succes/BountyFicheView";
import { monsterFicheHref } from "@/lib/monster-fiche";

export function SuccesMonstresTab() {
    const [search, setSearch] = useState("");
    const [list, setList] = useState<BestiaireEntry[]>([]);
    const [loadingList, setLoadingList] = useState(true);
    const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
    const [fiche, setFiche] = useState<MonsterFichePayload | null>(null);
    const [loadingFiche, setLoadingFiche] = useState(false);
    /** 2ᵉ niveau de filtre : famille (`raceId`) — « Monstres de quête », « Blops »… */
    const [familyId, setFamilyId] = useState<number | null>(null);

    // 1. Recherche — serveur (bestiaire local), bornée à 60 résultats, anti-rebond 250 ms :
    //    on ne relit pas 5 129 entrées à chaque frappe.
    useEffect(() => {
        let cancelled = false;
        setLoadingList(true);
        const timer = setTimeout(() => {
            searchNormalMonsters(search, 60, familyId)
                .then((res) => {
                    if (!cancelled && res.success && Array.isArray(res.data)) setList(res.data);
                })
                .catch(() => {})
                .finally(() => {
                    if (!cancelled) setLoadingList(false);
                });
        }, 250);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [search, familyId]);

    // 2. Fiche du monstre sélectionné — lecture locale, même source que `/bestiaire/<slug>`.
    useEffect(() => {
        if (!selectedSlug) {
            setFiche(null);
            return;
        }
        let cancelled = false;
        setLoadingFiche(true);
        getMonsterFicheBySegment(selectedSlug)
            .then((res) => {
                if (!cancelled) setFiche(res.success && res.data ? res.data : null);
            })
            .catch(() => {
                if (!cancelled) setFiche(null);
            })
            .finally(() => {
                if (!cancelled) setLoadingFiche(false);
            });
        return () => {
            cancelled = true;
        };
    }, [selectedSlug]);

    // Jamais d'écran vide à l'arrivée : le premier monstre de la liste est ouvert d'office
    // (l'utilisateur voit tout de suite à quoi ressemble une fiche).
    const autoSelectedRef = useRef(false);
    useEffect(() => {
        if (autoSelectedRef.current || loadingList || list.length === 0) return;
        autoSelectedRef.current = true;
        setSelectedSlug(list[0].slug ?? list[0].id);
    }, [loadingList, list]);

    const publicHref = fiche ? monsterFicheHref(fiche.name) : null;

    return (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            {/* ── LISTE ──────────────────────────────────────────────────────── */}
            <div className="space-y-2 rounded-2xl border border-border bg-surface/40 p-3">
                <div className="flex items-center justify-between">
                    <p className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">Monstres</p>
                    <span className="font-mono text-[11px] text-muted-foreground">{list.length}</span>
                </div>
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher un monstre…"
                        className="w-full rounded-lg border border-border bg-background/60 py-1.5 pl-8 pr-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                </div>
                {/* 2ᵉ niveau : familles réelles (« Monstres de quête », « Monstres de quête
                    d'alignement », « Blops »…) — facettes calculées côté serveur. */}
                <MonsterFamilyFilter value={familyId} onChange={setFamilyId} />
                <div className="max-h-[60vh] space-y-1 overflow-y-auto pr-0.5">
                    {loadingList ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : list.length === 0 ? (
                        <p className="py-8 text-center text-xs text-muted-foreground">
                            Aucun monstre normal pour cette recherche.
                        </p>
                    ) : (
                        list.map((e) => {
                            const slug = e.slug ?? e.id;
                            return (
                                <button
                                    key={e.id}
                                    type="button"
                                    onClick={() => setSelectedSlug(slug)}
                                    className={cn(
                                        "flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors",
                                        selectedSlug === slug
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
                            );
                        })
                    )}
                </div>
            </div>

            {/* ── FICHE (rendu partagé avec `/bestiaire/<slug>`) ─────────────── */}
            <div className="min-w-0 space-y-3">
                {publicHref && (
                    <div className="flex justify-end">
                        <Link
                            href={publicHref}
                            target="_blank"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground"
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Ouvrir la fiche publique
                        </Link>
                    </div>
                )}
                <MonsterFicheView
                    fiche={fiche}
                    loading={loadingFiche}
                    emptyLabel="Sélectionnez un monstre pour lire sa fiche."
                />
            </div>
        </div>
    );
}

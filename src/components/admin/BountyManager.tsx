"use client";

import React, { useState, useEffect } from "react";
import {
    Search, Save, Sparkles, Coins, ShieldAlert,
    ArrowLeft, Loader2, Image as ImageIcon,
    Plus, Trash2, SwatchBook,
    Crosshair, ExternalLink, Copy, Check, MapPin, RotateCcw
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { normalizeDofusAssetStoredUrl, isSafeDofusImageSrc } from "@/lib/dofus-image-url";
import { DocContent } from '@/components/doc/doc-content';
import { AdvancedEditor } from '@/components/editor/advanced-editor';
import { AssetGalleryModal } from "@/components/admin/asset-gallery-modal";
import { ZoneLocationCard } from "@/components/worldmap/ZoneLocationCard";

import { getAllBounties } from "@/server/actions/admin-actions";
import { updateGodBountyRecord } from "@/server/actions/game-data-actions";
import { deleteBountyAction, getBountyOrphansAction, getIgnoredBountiesAction, restoreBountyAction } from "@/server/actions/game-data-admin-actions";
// 🔗 Une seule implémentation du siphon d'avis (courses + suivi d'état serveur) :
// `src/components/admin/game-data-inline-runners.ts` — la même que le Tableau.
import { runInlineGameDataDataset } from "@/components/admin/game-data-inline-runners";
// Règles pures (client-safe) : types d'avis + visibilité des orphelins.
import {
    BOUNTY_RACE_IDS,
    bountyRaceShortLabel,
    filterVisibleBountyOrphans,
    type BountyOrphanView,
} from "@/lib/bounty";

const REWARD_TYPES = [
    { id: "Aliton", label: "Alitons", icon: "/assets/avis/aliton.png" },
    { id: "Aviton", label: "Avitons", icon: "/assets/avis/avitons.png" },
    { id: "Kama de glace", label: "Kamas de glace", icon: "/assets/avis/kamas_de_glace.png" },
];

/** Sous-zones de traque d'un avis (`Bounty.subareaIds`, Json libre) — ids worldmap valides. */
function bountySubareaIds(bounty: any): number[] {
    const raw = bounty?.subareaIds;
    return (Array.isArray(raw) ? raw : [])
        .map((value) => Math.floor(Number(value)))
        .filter((id) => Number.isInteger(id) && id > 0);
}

/**
 * Portrait d'un avis — rendu **via le proxy d'assets**, jamais depuis le chemin stocké.
 *
 * 🐛 Mesure beta (27/09/2026) : `Bounty.imageUrl` vaut `/uploads/assets-dofus/monsters/N.webp`,
 * un chemin servi par le standalone **seulement** si le WebP a déjà été siphonné
 * (`/uploads/…/4834.webp` → 404, `/api/uploads/…` → 200, puis le chemin brut → 200 **après** le
 * passage du proxy). Rendu brut, il donnait une image KO ici alors que l'onglet Succès (même
 * avis) l'affichait : deux formes d'URL pour une seule donnée. Le proxy, lui, sert le WebP local
 * ou son placeholder — **jamais de 404**.
 */
function BountyPortrait({
    bounty,
    className,
    fallback,
}: {
    bounty: any;
    className?: string;
    fallback: React.ReactNode;
}) {
    const candidate = normalizeDofusAssetStoredUrl("monsters", bounty?.imageUrl, bounty?.dofusdbId);
    // 🛡️ Garde de forme : une donnée brute ne part JAMAIS telle quelle dans une URL du DOM
    // (alerte CodeQL `js/xss-through-dom`) — seuls nos chemins internes et DofusDB passent.
    const src = isSafeDofusImageSrc(candidate) ? candidate : null;
    const [failed, setFailed] = useState(false);
    useEffect(() => { setFailed(false); }, [src]);
    if (!src || failed) return <>{fallback}</>;
    // `next/image` (et non un `<img>` brut) : le composant est le seul point où l'URL atteint le
    // DOM, avec des dimensions intrinsèques et `unoptimized` (nos WebP sont déjà optimisés).
    return (
        <Image
            src={src}
            alt=""
            width={64}
            height={64}
            unoptimized
            className={className}
            onError={() => setFailed(true)}
        />
    );
}

export default function BountyManager() {
    const [galleryOpen, setGalleryOpen] = useState(false);
    const [bounties, setBounties] = useState<any[]>([]);
    const [filteredBounties, setFilteredBounties] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [selectedBounty, setSelectedBounty] = useState<any>(null);
    const [saving, setSaving] = useState(false);
    /* Avis SUPPRIMÉS (exclus du siphon) : la suppression doit survivre au cron — cf. `bounty-ignore`. */
    const [ignoredEntries, setIgnoredEntries] = useState<{ dofusdbId: number; name: string | null; deletedAt: string | null }[]>([]);
    const [deleting, setDeleting] = useState(false);
    const [previewMode, setPreviewMode] = useState(false);
    const [subareaNames, setSubareaNames] = useState<string[]>([]);
    const [zoneSearch, setZoneSearch] = useState('');
    const [zoneOpen, setZoneOpen] = useState(false);
    /* Filtre par type d'avis (5 races DofusDB, `null` = toutes). */
    const [raceFilter, setRaceFilter] = useState<number | null>(null);
    /* Orphelins (lignes hors races, instantané du siphon) : revue + exclusion en masse. */
    const [orphans, setOrphans] = useState<BountyOrphanView[]>([]);
    const [orphansTotal, setOrphansTotal] = useState(0);
    const [orphansUpdatedAt, setOrphansUpdatedAt] = useState<string | null>(null);
    const [excludingAll, setExcludingAll] = useState(false);

    // Load worldmap subarea names client-side (public file, no server action needed)
    useEffect(() => {
        fetch('/game-data/worldmap.json')
            .then(r => r.json())
            .then(data => {
                const names: string[] = (data.subareas || [])
                    .map((sa: any) => typeof sa.name === 'string' ? sa.name : (sa.name?.fr || ''))
                    .filter(Boolean)
                    .sort((a: string, b: string) => a.localeCompare(b, 'fr'));
                setSubareaNames([...new Set(names)] as string[]);
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        setLoading(true);
        getAllBounties().then(data => {
            setBounties(data);
            setFilteredBounties(data);
            setLoading(false);
        });
        /* Avis supprimés (exclusions du siphon) — silencieux : la liste est un confort d'admin. */
        getIgnoredBountiesAction().then(res => {
            if (res.success && res.data) setIgnoredEntries(res.data.entries);
        }).catch(() => {});
        /* Orphelins (snapshot des passes complètes) — silencieux lui aussi. */
        getBountyOrphansAction().then(res => {
            if (res.success && res.data) {
                setOrphans(res.data.orphans);
                setOrphansTotal(res.data.total);
                setOrphansUpdatedAt(res.data.updatedAt);
            }
        }).catch(() => {});
    }, []);

    useEffect(() => {
        const q = search.toLowerCase();
        setFilteredBounties(
            bounties.filter(b =>
                (raceFilter === null || Math.floor(Number(b.raceId) || 0) === raceFilter) &&
                (b.name.toLowerCase().includes(q) ||
                    (b.zoneName && b.zoneName.toLowerCase().includes(q)))
            )
        );
    }, [search, bounties, raceFilter]);

    const handleSelectBounty = (b: any) => {
        let rewards = b.rewards;
        if (!Array.isArray(rewards) || rewards.length === 0) {
            rewards = [{ type: b.rewardType || "Aliton", amount: b.doplons || 0 }];
        }
        setSelectedBounty({ ...b, rewards });
    };

    const handleSave = async () => {
        if (!selectedBounty) return;
        setSaving(true);
        try {
            const primaryReward = selectedBounty.rewards?.[0];
            const dataToSave = {
                ...selectedBounty,
                doplons: primaryReward?.amount || 0,
                rewardType: primaryReward?.type || "Aliton"
            };

            const res = await updateGodBountyRecord(selectedBounty.id, dataToSave);
            if (res.success) {
                toast.success("Avis mis à jour avec succès");
                setBounties(prev => prev.map(b => b.id === selectedBounty.id ? { ...b, ...dataToSave } : b));
            } else {
                toast.error(res.error || "Erreur lors de la sauvegarde");
            }
        } catch (e) {
            toast.error("Erreur technique lors de la sauvegarde");
        } finally {
            setSaving(false);
        }
    };

    const addReward = () => {
        const newRewards = [...(selectedBounty.rewards || []), { type: "Aliton", amount: 0 }];
        setSelectedBounty({ ...selectedBounty, rewards: newRewards });
    };

    const removeReward = (index: number) => {
        const newRewards = selectedBounty.rewards.filter((_: any, i: number) => i !== index);
        setSelectedBounty({ ...selectedBounty, rewards: newRewards });
    };

    const updateReward = (index: number, field: string, value: any) => {
        const newRewards = selectedBounty.rewards.map((r: any, i: number) =>
            i === index ? { ...r, [field]: value } : r
        );
        setSelectedBounty({ ...selectedBounty, rewards: newRewards });
    };

    const [syncingAll, setSyncingAll] = useState(false);
    /** Avancement du siphon d'avis (`3/5 races`) — affiché dans le bouton, jamais un faux % . */
    const [syncProgress, setSyncProgress] = useState<string | null>(null);

    /**
     * Supprime l'avis sélectionné et l'**exclut du siphon** (liste d'exclusion) : sans cela, la
     * synchronisation suivante le recréerait. Restaurable depuis la liste « Avis supprimés ».
     */
    const handleDeleteBounty = async () => {
        if (!selectedBounty) return;
        const name = String(selectedBounty.name ?? "");
        const confirmed = confirm(
            `Supprimer définitivement « ${name} » ?\n\n` +
            "Il sera aussi EXCLU du siphon : il ne réapparaîtra pas après la prochaine synchronisation.\n" +
            "Il reste restaurable en bas de la liste (Avis supprimés)."
        );
        if (!confirmed) return;

        setDeleting(true);
        try {
            const res = await deleteBountyAction(selectedBounty.id);
            if (res.success && res.data) {
                toast.success(`« ${res.data.name} » supprimé (exclu du siphon)`);
                setIgnoredEntries(res.data.entries);
                setBounties(prev => prev.filter(b => b.id !== selectedBounty.id));
                setSelectedBounty(null);
            } else {
                toast.error(res.error || "Suppression impossible");
            }
        } catch {
            toast.error("Erreur de connexion");
        } finally {
            setDeleting(false);
        }
    };

    /** Réintègre un avis supprimé : il sort de la liste d'exclusion, le prochain siphon le recrée. */
    const handleRestoreBounty = async (dofusdbId: number, name: string | null) => {
        try {
            // 🔶 Le nom est transmis : les exclusions sans id (lignes historiques) se
            // réintègrent par le nom normalisé (`restoreBountyAction`).
            const res = await restoreBountyAction(dofusdbId, name);
            if (res.success && res.data) {
                setIgnoredEntries(res.data.entries);
                toast.success(`« ${name ?? dofusdbId} » réintégré — relancez le siphon pour le recréer`);
            } else {
                toast.error(res.error || "Restauration impossible");
            }
        } catch {
            toast.error("Erreur de connexion");
        }
    };

    /**
     * Orphelins encore visibles : l'instantané moins ce qui vient d'être exclu (la passe
     * complète suivante recalcule — entre-temps, on ne remontre pas le travail déjà fait).
     */
    const visibleOrphans = filterVisibleBountyOrphans(
        orphans,
        ignoredEntries.map((e) => e.dofusdbId),
        ignoredEntries.map((e) => e.name),
    );

    /**
     * Exclut TOUS les orphelins visibles (suppression + exclusion durable, comme
     * `handleDeleteBounty` mais en boucle) : c'est le nettoyage du stock historique en
     * un clic. Borné à l'affichage (l'instantané est déjà plafonné à 100).
     *
     * 🛡️ Garde curation : une ligne orpheline qui porte une curation God (texte, position,
     * milice, récompenses…) est CONSERVÉE et signalée — seul un humain peut arbitrer sa
     * suppression, jamais un clic de masse.
     */
    const handleExcludeAllOrphans = async () => {
        if (visibleOrphans.length === 0 || excludingAll) return;
        const confirmed = confirm(
            `Exclure ${visibleOrphans.length} ligne(s) orpheline(s) ?\n\n` +
            "Elles seront supprimées ET exclues du siphon (restaurables depuis « Avis supprimés »)."
        );
        if (!confirmed) return;
        setExcludingAll(true);
        try {
            // L'id God (`Bounty.id`) est retrouvé par `dofusdbId`, sinon par nom exact.
            const idByDofusdbId = new Map<number, string>();
            const idByName = new Map<string, string>();
            for (const b of bounties) {
                const did = Math.floor(Number(b.dofusdbId) || 0);
                if (did > 0 && !idByDofusdbId.has(did)) idByDofusdbId.set(did, String(b.id));
                const n = String(b.name ?? "").trim().toLowerCase();
                if (n && !idByName.has(n)) idByName.set(n, String(b.id));
            }
            let done = 0;
            const kept: string[] = [];
            for (const orphan of visibleOrphans) {
                const targetId = (orphan.dofusdbId && orphan.dofusdbId > 0
                    ? idByDofusdbId.get(orphan.dofusdbId)
                    : undefined) ?? idByName.get(orphan.name.trim().toLowerCase());
                if (!targetId) continue;
                const row = bounties.find((b) => String(b.id) === String(targetId));
                // 🛡️ Curation God = arbitrage humain uniquement : on ne touche pas.
                const curated = row != null && (
                    ["mechanics", "position", "milice", "dpnlUrl", "mapUrl", "reward"].some((k) =>
                        String(row?.[k] ?? "").trim() !== ""
                    ) ||
                    (Array.isArray(row?.rewards) && row.rewards.length > 0) ||
                    Number(row?.doplons) > 0
                );
                if (curated) {
                    kept.push(orphan.name);
                    continue;
                }
                const res = await deleteBountyAction(targetId);
                if (res.success && res.data) {
                    done++;
                    setIgnoredEntries(res.data.entries);
                    setBounties((prev) => prev.filter((b) => String(b.id) !== String(targetId)));
                    if (selectedBounty && String(selectedBounty.id) === String(targetId)) setSelectedBounty(null);
                }
            }
            // L'instantané sera recalculé à la prochaine passe complète : on retire
            // localement ce qui vient d'être exclu (voir `visibleOrphans`).
            if (kept.length > 0) {
                toast.success(
                    `${done} ligne(s) exclue(s), ${kept.length} conservée(s) (curation à arbitrer)`,
                    { description: kept.slice(0, 3).join(", ") + (kept.length > 3 ? "…" : "") }
                );
            } else {
                toast.success(done > 0 ? `${done} ligne(s) exclue(s) du siphon` : "Aucune ligne exclue");
            }
        } catch {
            toast.error("Erreur de connexion");
        } finally {
            setExcludingAll(false);
        }
    };

    /**
     * Synchronise **tous** les avis par le **rail unique** — `runInlineGameDataDataset("BOUNTIES")` :
     * les 5 races d'avis DofusDB, race par race, avec suivi d'état serveur (la colonne
     * « Progression » du Tableau reste vraie quelle que soit la porte d'entrée).
     *
     * 🐛 Mesure du 27/09/2026 : ce bouton appelait `syncBountiesCompleteFromDofusDb`, qui
     * interrogeait DofusDB par `typeId=23` — une requête **morte** (`monsters?typeId=23` →
     * `total: 0`, mesuré au `curl`) : la passe ne faisait rien et le toast annonçait pourtant
     * « 0 avis synchronisés **avec succès** ». L'appartenance d'un avis est portée par sa **race**
     * (`race∈{32,90,127,147,156}`), jamais par un `typeId`. Cette action écrivait en plus **hors
     * du siphon** (upsert par `name`, sans liste d'exclusion) ⇒ elle pouvait recréer un avis
     * supprimé dans God. Elle est supprimée : le bouton passe par le rail, seule source de vérité.
     */
    const handleSyncAllBounties = async () => {
        if (!confirm("Synchroniser les avis de recherche depuis DofusDB (les 5 races d'avis) ?")) return;
        setSyncingAll(true);
        setSyncProgress(null);
        try {
            const res = await runInlineGameDataDataset("BOUNTIES", {
                onProgress: (done, total) => setSyncProgress(`${done}/${total} races`),
            });
            if (res.ok) {
                toast.success(res.summary || "Avis synchronisés");
            } else {
                toast.error(res.error || "Synchronisation incomplète");
            }
            const updated = await getAllBounties();
            setBounties(updated);
            setFilteredBounties(updated);
        } catch {
            toast.error("Erreur de connexion");
        } finally {
            setSyncProgress(null);
            setSyncingAll(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-[16rem] items-center justify-center gap-3 rounded-xl border border-border bg-surface">
                <Loader2 className="animate-spin text-accent" size={24} />
                <span className="text-xs font-semibold text-muted-foreground">
                    Chargement des avis…
                </span>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
            {/* Barre d'outils — l'onglet « Avis de recherche » des Éditeurs porte déjà le titre et sa
                légende : ici, les compteurs, le filtre par type et les deux actions, rien de plus. */}
            <header className="flex flex-col gap-3 border-b border-border p-3 sm:p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs font-semibold text-muted-foreground">
                        {filteredBounties.length === bounties.length
                            ? `${bounties.length} avis`
                            : `${filteredBounties.length} / ${bounties.length} avis`}
                        {ignoredEntries.length > 0 ? ` · ${ignoredEntries.length} supprimé(s)` : ""}
                        {visibleOrphans.length > 0 ? ` · ${visibleOrphans.length} orphelin(s)` : ""}
                    </p>

                    <div className="flex items-center gap-2">
                        <Button
                            onClick={handleSyncAllBounties}
                            disabled={syncingAll}
                            className="bg-accent text-accent-foreground hover:opacity-90 h-9 px-3 rounded-lg flex items-center gap-2 text-xs font-semibold"
                        >
                            {syncingAll ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                            {syncingAll ? (syncProgress ?? "Synchronisation…") : "Sync & remplir tous les avis"}
                        </Button>

                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                            <Input
                                placeholder="Rechercher une cible…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 bg-surface border-border h-9 rounded-lg text-sm placeholder:text-muted-foreground/60"
                            />
                        </div>
                    </div>
                </div>

                {/* Filtre par type d'avis (5 races DofusDB). */}
                <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrer par type d'avis">
                    <button
                        type="button"
                        onClick={() => setRaceFilter(null)}
                        className={cn(
                            "px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors",
                            raceFilter === null
                                ? "bg-accent text-accent-foreground border-transparent"
                                : "border-border text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Tous
                    </button>
                    {BOUNTY_RACE_IDS.map((id) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setRaceFilter(raceFilter === id ? null : (id as number))}
                            className={cn(
                                "px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors",
                                raceFilter === id
                                    ? "bg-accent text-accent-foreground border-transparent"
                                    : "border-border text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {bountyRaceShortLabel(id as number)}
                        </button>
                    ))}
                </div>
            </header>

            <div className="flex min-h-[32rem] flex-col overflow-hidden lg:h-[38rem] lg:flex-row">
                {/* Bounty List */}
                <div className={cn(
                    "w-full lg:w-[360px] border-r border-border overflow-y-auto p-3 space-y-2 bg-surface/60 shrink-0",
                    selectedBounty && "hidden lg:block"
                )}>
                    {filteredBounties.map(b => {
                        const raceId = Math.floor(Number(b.raceId) || 0);
                        return (
                            <button
                                key={b.id}
                                onClick={() => handleSelectBounty(b)}
                                className={cn(
                                    "w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left border",
                                    selectedBounty?.id === b.id
                                        ? "border-accent/60 bg-elevated"
                                        : "bg-surface border-border hover:border-accent/40"
                                )}
                            >
                                <div className="w-11 h-11 rounded-lg bg-elevated flex items-center justify-center overflow-hidden border border-border shrink-0">
                                    <BountyPortrait
                                        bounty={b}
                                        className="w-10 h-10 object-contain"
                                        fallback={<ShieldAlert size={20} className="text-muted-foreground/50" />}
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={cn(
                                        "text-sm font-semibold truncate",
                                        selectedBounty?.id === b.id ? "text-accent" : "text-foreground"
                                    )}>
                                        {b.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                                        {raceId > 0 ? `${bountyRaceShortLabel(raceId, b.raceName)} · ` : ""}
                                        {b.zoneName || "Zone non exposée"}
                                    </p>
                                </div>
                                {b.mechanics && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" title="Briefing renseigné" />
                                )}
                            </button>
                        );
                    })}

                    {/* Orphelins : lignes hors races DofusDB — revue + exclusion en masse. */}
                    {visibleOrphans.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-border space-y-2">
                            <div className="flex items-center justify-between gap-2 px-1">
                                <span className="text-xs font-semibold text-muted-foreground">
                                    Orphelins ({visibleOrphans.length}{orphansTotal > visibleOrphans.length ? ` / ${orphansTotal}` : ""})
                                </span>
                                <button
                                    type="button"
                                    onClick={handleExcludeAllOrphans}
                                    disabled={excludingAll}
                                    className="shrink-0 flex items-center gap-1.5 px-2.5 h-8 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/15 text-xs font-semibold transition-colors disabled:opacity-50"
                                >
                                    {excludingAll ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                    Tout exclure
                                </button>
                            </div>
                            <p className="px-1 text-xs text-muted-foreground leading-relaxed">
                                Hors des 5 races DofusDB{orphansUpdatedAt ? ` (relevé ${new Date(orphansUpdatedAt).toLocaleDateString("fr-FR")})` : ""} : historique pré-siphon ou graines de pannes.
                                L'exclusion est durable (restaurable ci-dessous).
                            </p>
                            {visibleOrphans.map((orphan) => (
                                <div
                                    key={orphan.id}
                                    className="flex items-center gap-2 p-2.5 rounded-lg bg-surface border border-border"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-foreground truncate">
                                            {orphan.name || "Avis sans nom"}
                                        </p>
                                        <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                            {orphan.dofusdbId && orphan.dofusdbId > 0 ? `#${orphan.dofusdbId}` : "sans id DofusDB"}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {ignoredEntries.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-border space-y-2">
                            <div className="flex items-center gap-2 px-1">
                                <Trash2 size={12} className="text-muted-foreground" />
                                <span className="text-xs font-semibold text-muted-foreground">
                                    Avis supprimés ({ignoredEntries.length})
                                </span>
                            </div>
                            <p className="px-1 text-xs text-muted-foreground leading-relaxed">
                                Exclus du siphon : ils ne seront pas recréés à la prochaine synchronisation.
                                « Restaurer » les réintègre (le siphon les réécrit ensuite).
                            </p>
                            {ignoredEntries.map(entry => (
                                <div
                                    key={`${entry.dofusdbId}-${entry.name ?? "sans-nom"}`}
                                    className="flex items-center gap-2 p-2.5 rounded-lg bg-surface border border-border"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-foreground truncate">
                                            {entry.name || "Avis sans nom"}
                                        </p>
                                        <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                            {entry.dofusdbId > 0 ? `#${entry.dofusdbId}` : "sans id DofusDB (exclusion par nom)"}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleRestoreBounty(entry.dofusdbId, entry.name)}
                                        title="Réintégrer cet avis (le prochain siphon le recréera)"
                                        className="shrink-0 flex items-center gap-1.5 px-2.5 h-8 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-accent/40 text-xs font-semibold transition-colors"
                                    >
                                        <RotateCcw size={12} /> Restaurer
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Editor Section */}
                <div className={cn(
                    "flex-1 overflow-y-auto bg-surface",
                    !selectedBounty && "hidden lg:block"
                )}>
                    {selectedBounty ? (
                        <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
                            <div className="lg:hidden">
                                <Button
                                    variant="ghost"
                                    onClick={() => setSelectedBounty(null)}
                                    className="text-muted-foreground hover:text-foreground pl-0"
                                >
                                    <ArrowLeft className="mr-2" size={16} /> Retour à la liste
                                </Button>
                            </div>

                            <Tabs defaultValue="general" className="space-y-6">
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between sticky top-0 py-2 bg-surface z-20 gap-3">
                                    <TabsList className="bg-elevated border border-border p-1 h-10 rounded-lg">
                                        <TabsTrigger value="general" className="rounded-md px-4 text-xs font-semibold data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
                                            Configuration
                                        </TabsTrigger>
                                        <TabsTrigger value="rewards" className="rounded-md px-4 text-xs font-semibold data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
                                            Récompenses
                                        </TabsTrigger>
                                        <TabsTrigger value="mechanics" className="rounded-md px-4 text-xs font-semibold data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
                                            Stratégie
                                        </TabsTrigger>
                                    </TabsList>

                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={handleDeleteBounty}
                                            disabled={deleting || saving}
                                            title="Supprime cet avis et l'exclut du siphon (il ne sera pas recréé à la prochaine synchronisation)"
                                            className="border-destructive/30 bg-destructive/5 hover:bg-destructive/15 text-destructive h-10 px-4 rounded-lg text-xs font-semibold"
                                        >
                                            {deleting ? <Loader2 className="animate-spin mr-2" size={16} /> : <Trash2 className="mr-2" size={16} />}
                                            Supprimer
                                        </Button>
                                        <Button
                                            onClick={handleSave}
                                            disabled={saving}
                                            className="bg-accent text-accent-foreground hover:opacity-90 px-6 h-10 rounded-lg text-xs font-semibold"
                                        >
                                            {saving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" size={20} />}
                                            Mettre à jour
                                        </Button>
                                    </div>
                                </div>

                                <TabsContent value="general" className="mt-0">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        <div className="space-y-5">
                                            <div className="space-y-2">
                                                    <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                                                        <Crosshair size={12} /> Portrait de la cible
                                                    </label>
                                                    <button
                                                        onClick={() => setGalleryOpen(true)}
                                                        className="w-full aspect-square rounded-xl bg-elevated border border-border flex items-center justify-center overflow-hidden relative group hover:border-accent/40"
                                                    >
                                                        <BountyPortrait
                                                            bounty={selectedBounty}
                                                            className="w-full h-full object-contain"
                                                            fallback={<ImageIcon size={40} className="text-muted-foreground/50" />}
                                                        />
                                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                                            <ImageIcon size={20} className="text-accent" />
                                                            <span className="text-xs font-semibold text-white">Changer</span>
                                                        </div>
                                                    </button>
                                                    <div className="flex gap-2">
                                                        <Input
                                                            value={selectedBounty.imageUrl || ""}
                                                            onChange={(e) => setSelectedBounty({ ...selectedBounty, imageUrl: e.target.value })}
                                                            placeholder="URL du portrait…"
                                                            className="flex-1 bg-surface border-border font-mono text-xs text-muted-foreground h-10 rounded-lg"
                                                        />
                                                        <Button
                                                            onClick={() => setGalleryOpen(true)}
                                                            variant="outline"
                                                            className="h-10 w-10 p-0 rounded-lg"
                                                        >
                                                            <SwatchBook size={16} />
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                                                        <MapPin size={12} /> Zone de traque
                                                    </label>
                                                    <ZoneLocationCard
                                                        subareaIds={bountySubareaIds(selectedBounty)}
                                                        mapId={Number(selectedBounty.battleMapId) > 0 ? Math.floor(Number(selectedBounty.battleMapId)) : null}
                                                        title="Zone de traque"
                                                        placeName={selectedBounty.zoneName || selectedBounty.name}
                                                        openLabel="Ouvrir sur la carte"
                                                    />
                                                </div>
                                        </div>

                                        <div className="space-y-5">
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold text-muted-foreground">Nom de l'avis</label>
                                                <Input
                                                    value={selectedBounty.name}
                                                    onChange={(e) => setSelectedBounty({ ...selectedBounty, name: e.target.value })}
                                                    className="text-lg font-semibold bg-surface border-border h-12 rounded-lg"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-xs font-semibold text-muted-foreground">Niveau prérequis</label>
                                                    <Input
                                                        type="number"
                                                        value={selectedBounty.level}
                                                        onChange={(e) => setSelectedBounty({ ...selectedBounty, level: parseInt(e.target.value) })}
                                                        className="bg-surface border-border h-11 rounded-lg text-accent font-semibold"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-semibold text-muted-foreground">Origine / Milice</label>
                                                    <Input
                                                        value={selectedBounty.milice || ""}
                                                        onChange={(e) => setSelectedBounty({ ...selectedBounty, milice: e.target.value })}
                                                        className="bg-surface border-border h-11 rounded-lg"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                                                    <span>Position de départ (PNJ / milice)</span>
                                                    <span className="font-normal opacity-70">Format X,Y (ex : 4,-18)</span>
                                                </label>
                                                <div className="relative">
                                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                                    <Input
                                                        value={selectedBounty.position || ""}
                                                        onChange={(e) => setSelectedBounty({ ...selectedBounty, position: e.target.value })}
                                                        placeholder="4,-18"
                                                        className="pl-10 bg-surface border-border h-11 rounded-lg text-accent font-semibold"
                                                    />
                                                    {selectedBounty.position && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(`/travel ${selectedBounty.position}`);
                                                                toast.success("Commande /travel copiée !");
                                                            }}
                                                            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground h-8 px-3 rounded-lg"
                                                        >
                                                            <Copy size={12} className="mr-1.5" /> /travel
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold text-muted-foreground">Lien DofusPourLesNoobs</label>
                                                <div className="relative">
                                                    <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                                    <Input
                                                        value={selectedBounty.dpnlUrl || ""}
                                                        onChange={(e) => setSelectedBounty({ ...selectedBounty, dpnlUrl: e.target.value })}
                                                        placeholder="https://www.dofuspourlesnoobs.com/…"
                                                        className="pl-10 bg-surface border-border h-11 rounded-lg text-sm"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2 relative">
                                                <label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                                                    <span className="flex items-center gap-1.5"><MapPin size={11} /> Zone (worldmap)</span>
                                                    {selectedBounty.zoneName && (
                                                        <span className={cn(
                                                            "text-xs font-semibold px-2 py-0.5 rounded-md",
                                                            subareaNames.includes(selectedBounty.zoneName)
                                                                ? "bg-elevated text-accent"
                                                                : "bg-destructive/10 text-destructive"
                                                        )}>
                                                            {subareaNames.includes(selectedBounty.zoneName) ? "Zone reconnue" : "Zone introuvable"}
                                                        </span>
                                                    )}
                                                </label>
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={14} />
                                                    <input
                                                        value={zoneOpen ? zoneSearch : (selectedBounty.zoneName || '')}
                                                        onChange={(e) => {
                                                            setZoneSearch(e.target.value);
                                                            if (!zoneOpen) setZoneOpen(true);
                                                        }}
                                                        onFocus={() => {
                                                            setZoneSearch(selectedBounty.zoneName || '');
                                                            setZoneOpen(true);
                                                        }}
                                                        onBlur={() => setTimeout(() => setZoneOpen(false), 150)}
                                                        placeholder="Rechercher une zone de la worldmap…"
                                                        className="w-full pl-10 pr-4 bg-surface border border-border h-11 rounded-lg text-foreground text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-accent transition-colors"
                                                    />
                                                    {zoneOpen && (
                                                        <div className="absolute top-full left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-elevated border border-border rounded-xl shadow-xl z-50">
                                                            {(() => {
                                                                const q = zoneSearch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
                                                                const filtered = subareaNames.filter(n =>
                                                                    n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(q)
                                                                ).slice(0, 40);
                                                                if (filtered.length === 0) return (
                                                                    <div className="px-4 py-3 text-muted-foreground text-xs text-center">Aucune zone trouvée</div>
                                                                );
                                                                return filtered.map(name => (
                                                                    <button
                                                                        key={name}
                                                                        type="button"
                                                                        onMouseDown={() => {
                                                                            setSelectedBounty({ ...selectedBounty, zoneName: name });
                                                                            setZoneSearch(name);
                                                                            setZoneOpen(false);
                                                                        }}
                                                                        className={cn(
                                                                            "w-full text-left px-4 py-2.5 text-sm transition-colors border-b border-border last:border-0 flex items-center justify-between",
                                                                            selectedBounty.zoneName === name
                                                                                ? "bg-accent/10 text-accent"
                                                                                : "text-foreground hover:bg-elevated"
                                                                        )}
                                                                    >
                                                                        <span>{name}</span>
                                                                        {selectedBounty.zoneName === name && <Check size={12} className="text-accent flex-shrink-0" />}
                                                                    </button>
                                                                ));
                                                            })()}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="rewards" className="mt-0 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                                                <Coins className="text-accent" size={18} />
                                                Récompenses de capture
                                            </h3>
                                            <p className="text-xs text-muted-foreground mt-0.5">Jetons remis avec l'avis</p>
                                        </div>
                                        <Button
                                            onClick={addReward}
                                            variant="outline"
                                            className="rounded-lg px-4 h-9 text-xs font-semibold"
                                        >
                                            <Plus size={14} className="mr-1.5" /> Ajouter
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3">
                                        {selectedBounty.rewards?.map((reward: any, idx: number) => (
                                            <div key={idx} className="p-4 rounded-xl bg-surface border border-border flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-lg bg-elevated border border-border flex items-center justify-center shrink-0">
                                                    <img
                                                        src={REWARD_TYPES.find(t => t.id === reward.type)?.icon || "/assets/avis/aliton.png"}
                                                        alt=""
                                                        className="w-9 h-9 object-contain"
                                                    />
                                                </div>

                                                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                    <div className="space-y-1.5 sm:col-span-2">
                                                        <label className="text-xs font-semibold text-muted-foreground">Type de jeton</label>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {REWARD_TYPES.map(type => (
                                                                <button
                                                                    key={type.id}
                                                                    onClick={() => updateReward(idx, "type", type.id)}
                                                                    className={cn(
                                                                        "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border",
                                                                        reward.type === type.id
                                                                            ? "bg-accent text-accent-foreground border-transparent"
                                                                            : "border-border text-muted-foreground hover:text-foreground"
                                                                    )}
                                                                >
                                                                    {type.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-semibold text-muted-foreground">Montant</label>
                                                        <Input
                                                            type="number"
                                                            value={reward.amount}
                                                            onChange={(e) => updateReward(idx, "amount", parseInt(e.target.value) || 0)}
                                                            className="bg-surface border-border h-10 rounded-lg text-accent font-semibold"
                                                        />
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => removeReward(idx)}
                                                    className="p-2.5 text-muted-foreground hover:text-destructive transition-colors bg-surface rounded-lg border border-border hover:border-destructive/30"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </TabsContent>

                                <TabsContent value="mechanics" className="mt-0 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                                                <Sparkles className="text-accent" size={18} />
                                                Stratégie de capture
                                            </h3>
                                            <p className="text-xs text-muted-foreground mt-0.5">Markdown pris en charge</p>
                                        </div>
                                        <div className="flex bg-elevated p-1 rounded-lg border border-border">
                                            <button
                                                onClick={() => setPreviewMode(false)}
                                                className={cn("px-3 py-1.5 rounded-md text-xs font-semibold transition-colors", !previewMode ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}
                                            >
                                                Édition
                                            </button>
                                            <button
                                                onClick={() => setPreviewMode(true)}
                                                className={cn("px-3 py-1.5 rounded-md text-xs font-semibold transition-colors", previewMode ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}
                                            >
                                                Aperçu
                                            </button>
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-border bg-surface overflow-hidden min-h-[400px]">
                                            {!previewMode ? (
                                                <div className="relative h-full">
                                                    <AdvancedEditor
                                                        initialContent={selectedBounty.mechanics || ""}
                                                        onChange={(html) => setSelectedBounty({ ...selectedBounty, mechanics: html })}
                                                        contentClassName="min-h-[400px]"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="p-6">
                                                    <DocContent
                                                        content={selectedBounty.mechanics || "<p><em>Aucun contenu à prévisualiser</em></p>"}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                </TabsContent>
                            </Tabs>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center gap-3 min-h-[24rem] p-8">
                            <ShieldAlert size={48} className="text-muted-foreground/40" />
                            <p className="text-sm font-semibold text-muted-foreground">Sélectionnez un avis pour l'éditer</p>
                        </div>
                    )}
                </div>
            </div>

            <AssetGalleryModal
                open={galleryOpen}
                onOpenChange={setGalleryOpen}
                initialType="portraits"
                onSelect={(url) => setSelectedBounty({ ...selectedBounty, imageUrl: url })}
                title="Sélecteur de Portraits"
            />
        </div>
    );
}

'use client';
// dark-locked — module volontairement sombre (V2 Dual-Theme Phase 2C) : ne PAS utiliser les tokens thème-aware ici (voir memo 21/08 + prompt 22/08).

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Swords, ShieldAlert, ChevronDown, Loader2, MapPin, Ghost, Sparkles, Info, ChevronUp, Coins, ExternalLink, Map, Layers, Search, Users } from 'lucide-react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { DocContent } from '../doc/doc-content';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { getZoneMonsters, getBountiesForZone, getDungeonsForSubArea } from '@/server/actions/game-data-actions';
import { getZoneArchmonsters, getGuildOcreTrades } from '@/server/actions/ocre-actions';
import { getBountyFiche, type BountyFichePayload } from '@/server/actions/bounty-actions';
import { BountyFicheView } from '@/components/succes/BountyFicheView';
import { groupZoneFamilies } from '@/lib/zone-families';
import { monsterFicheHref } from '@/lib/bestiaire-fiche';
import { FilterDropdown } from '@/components/ui/filter-dropdown';

interface ZoneDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    zoneName: string;
    position: { x: number; y: number; displayX: number; displayY: number; mapId?: number };
    guildId?: string;
    worldId?: number;
    subAreaId?: number;
    mapId?: number;
    /** Mode public : masque les données de guilde (archimonstres, échanges Ocre). */
    isPublic?: boolean;
}

export function ZoneDetailModal({ isOpen, onClose, zoneName, position, guildId, worldId, subAreaId, mapId: mapIdProp, isPublic = false }: ZoneDetailModalProps) {
    const isGuildMode = !isPublic && !!guildId;
    const resolvedMapId = mapIdProp ?? position?.mapId;
    const [activeTab, setActiveTab] = useState<string>("tuile");
    const [loading, setLoading] = useState(false);
    const [monsters, setMonsters] = useState<any>(null);
    const [archis, setArchis] = useState<any[]>([]);
    const [bounties, setBounties] = useState<any[]>([]);
    // Avis sélectionné dans l'onglet « Avis de recherche » : sa fiche est chargée par
    // `getBountyFiche` (lecture locale du siphon) puis rendue par `BountyFicheView` —
    // le MÊME rendu que le module Succès, donc la même fiche partout.
    const [activeBountyId, setActiveBountyId] = useState<string | null>(null);
    const [bountyFiche, setBountyFiche] = useState<BountyFichePayload | null>(null);
    const [loadingBountyFiche, setLoadingBountyFiche] = useState(false);
    const [expandedBounties, setExpandedBounties] = useState<Record<string, boolean>>({});
    const [dungeons, setDungeons] = useState<any[]>([]);
    const [trades, setTrades] = useState<any[]>([]);
    const [tradesLoading, setTradesLoading] = useState(false);

    const [error, setError] = useState<string | null>(null);

    /**
     * Familles réellement peuplées dans la zone : règle **pure** partagée
     * (`@/lib/zone-families`) — une famille sans monstre n'est jamais affichée, et
     * chaque monstre est rattaché par clé normalisée (casse/accents/ponctuation).
     */
    const familyGroups = useMemo(
        () => groupZoneFamilies<any, any>(monsters?.families ?? [], monsters?.normalMonsters ?? []),
        [monsters]
    );

    /**
     * Filtre par **type** de l'onglet « Familles » — même grammaire que les fiches monstres :
     * les familles de la sous-zone sont groupées par **super-famille officielle**
     * (« Créatures de quête », « Créatures Archimonstres », « Blops »…). Les libellés viennent
     * du référentiel siphonné, jamais inventés ; aucune entrée si la zone n'a pas de type connu.
     */
    const [familyType, setFamilyType] = useState<string>("");
    const familyTypes = useMemo(() => {
        const types = new Set<string>();
        for (const family of (monsters?.families ?? [])) {
            const label = String(family?.superRaceName ?? "").trim();
            if (label) types.add(label);
        }
        return [...types].sort((a, b) => a.localeCompare(b, "fr"));
    }, [monsters]);
    const visibleFamilyGroups = useMemo(
        () => (familyType === ""
            ? familyGroups
            : familyGroups.filter((group: any) => String(group?.family?.superRaceName ?? "").trim() === familyType)),
        [familyGroups, familyType]
    );

    useEffect(() => {
        if (isOpen && zoneName) {
            setActiveTab("tuile");
            setLoading(true);
            setTradesLoading(true);
            // En mode public ou sans guilde, on charge les archis publics de la DB
            const archisPromise = getZoneArchmonsters(isGuildMode ? guildId : null, zoneName, subAreaId);
            const tradesPromise = isGuildMode
                ? getGuildOcreTrades(guildId!, { subAreaName: zoneName })
                : Promise.resolve({ success: false, data: [] } as any);
            Promise.all([
                getZoneMonsters(zoneName, subAreaId),
                archisPromise,
                getBountiesForZone(zoneName, subAreaId),
                getDungeonsForSubArea(subAreaId),
                tradesPromise,
            ]).then(([mRes, aRes, bRes, dRes, tRes]) => {
                // Les avis viennent de la **sous-zone réelle** (dataset souverain, siphon
                // DofusDB) : plus aucune fusion par nom de famille — c'est exactement ce qui
                // faisait apparaître « Qil Bil » (Cimetière des Torturés) dans « Cimetière ».
                // `ficheAvailable` suit le `bountyId` (ligne `Bounty` réellement siphonnée).
                const mergedAvis = (bRes.success ? bRes.data || [] : []).map((b: any) => ({
                    ...b,
                    ficheAvailable: Boolean(b?.bountyId),
                }));

                if (mRes.success && mRes.data) setMonsters(mRes.data);
                if (aRes.success) {
                    setArchis(aRes.data || []);
                    setError(null);
                } else {
                    setError((aRes as any).error || "Erreur inconnue");
                    setArchis([]);
                }
                setBounties(mergedAvis.map(b => ({
                    ...b,
                    guideUrl: `https://duffus.fr/avis-de-recherche/${b.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/['\s]/g, '-')}`
                })));
                // Fiche ouverte d'office : le premier avis **qui a une fiche** (sinon le premier).
                setBountyFiche(null);
                const firstWithFiche = mergedAvis.find((b: any) => b.ficheAvailable) ?? mergedAvis[0];
                setActiveBountyId(firstWithFiche ? firstWithFiche.id : null);
                if (dRes.success) setDungeons(dRes.data || []);
                if (tRes.success && tRes.data) setTrades(tRes.data);
                else setTrades([]);

                setLoading(false);
                setTradesLoading(false);
            }).catch(() => {
                setError("Erreur de connexion");
                setLoading(false);
                setTradesLoading(false);
            });
        }
    }, [isOpen, zoneName, guildId, isGuildMode]);

    // Fiche de l'avis sélectionné dans l'onglet « Avis de recherche » (lecture locale
    // du siphon, aucun appel sortant) — rendue ensuite par `BountyFicheView`.
    useEffect(() => {
        if (!isOpen || !activeBountyId) {
            setBountyFiche(null);
            return;
        }
        const row = bounties.find((b: any) => b.id === activeBountyId);
        // `bountyId` = la ligne `Bounty` réellement siphonnée (`null` pour un avis réel de la
        // zone qui n'a pas encore de fiche) : on ne demande jamais une fiche qui n'existe pas.
        const bountyId: string | null = row?.bountyId ?? null;
        if (!bountyId) {
            setBountyFiche(null);
            return;
        }
        let cancelled = false;
        setLoadingBountyFiche(true);
        getBountyFiche(bountyId)
            .then((res) => {
                if (!cancelled) setBountyFiche(res.success && res.data ? res.data : null);
            })
            .catch(() => {
                if (!cancelled) setBountyFiche(null);
            })
            .finally(() => {
                if (!cancelled) setLoadingBountyFiche(false);
            });
        return () => { cancelled = true; };
    }, [isOpen, activeBountyId, bounties]);


    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent 
                showCloseButton={false} 
                className="w-[95vw] max-w-6xl bg-[#080a10] border border-emerald-500/20 ring-1 ring-inset ring-white/[0.04] shadow-[0_50px_100px_rgba(0,0,0,0.9)] rounded-2xl md:rounded-[2rem] text-foreground p-0 overflow-hidden flex flex-col h-[min(850px,90vh)]"
            >
                {/* En-tête — grammaire « landing » : eyebrow + titre + fermeture. */}
                <div className="flex items-start gap-3 border-b border-border px-5 py-4 shrink-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface">
                        <MapPin size={18} className="text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Zone analysée
                            <span className="rounded-md border border-border bg-surface px-1.5 py-0.5 font-mono text-[11px] font-medium normal-case">
                                [{position.displayX}, {position.displayY}]
                            </span>
                        </p>
                        <h2 className="mt-0.5 truncate text-xl font-bold tracking-tight text-foreground">{zoneName}</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        title="Fermer"
                        className="shrink-0 rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {loading ? (
                        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
                            <Loader2 size={26} className="animate-spin" />
                            <p className="text-xs">Analyse de la zone…</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-5 md:px-6">
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col gap-5">
                                {/* Barre d'onglets : un seul segment (verre dépoli), aucune couleur pleine. */}
                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                                    <TabsList className="h-auto bg-surface border border-border p-1 gap-0.5">
                                        <TabsTrigger value="tuile" className="rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex items-center gap-2">
                                            <img src="/assets/dofus/map-layers/icon-zones-on.png" alt="" className="w-3.5 h-3.5 object-contain" /> Tuile HD
                                        </TabsTrigger>
                                        <TabsTrigger value="archis" className="rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex items-center gap-2">
                                            <img src="/assets/icons/ocre.png" alt="" className="w-3.5 h-3.5 object-contain" /> Archimonstres
                                        </TabsTrigger>
                                        <TabsTrigger value="bounties" className="rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex items-center gap-2">
                                            <img src="/assets/avis/avitons.png" alt="" className="w-3.5 h-3.5 object-contain" /> Avis de recherche
                                        </TabsTrigger>
                                        <TabsTrigger value="families" className="rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex items-center gap-2">
                                            <img src="/assets/dofus/game-icons/crossed-swords.png" alt="" className="w-3.5 h-3.5 object-contain" /> Familles
                                        </TabsTrigger>
                                    </TabsList>
                                    <span className="text-xs text-muted-foreground">
                                        Archimonstres :{" "}
                                        <strong className="font-semibold tabular-nums text-foreground">
                                            {isGuildMode
                                                ? `${archis.filter(a => a.state !== 'MANQUANT').length} / ${archis.length}`
                                                : archis.length}
                                        </strong>
                                    </span>
                                </div>


                                {/* TAB: TUILE HD */}
                                <TabsContent value="tuile" className="m-0">
                                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                                        {/* Tuile HD grande */}
                                        <div className="lg:col-span-3 relative rounded-2xl overflow-hidden bg-black/60 border border-white/10 shadow-2xl" style={{ minHeight: '280px' }}>
                                            {resolvedMapId ? (
                                                <>
                                                    <img
                                                        src={`/game-data/hd_maps/${resolvedMapId}.webp`}
                                                        alt={zoneName}
                                                        className="w-full h-full object-cover"
                                                        style={{ minHeight: '280px' }}
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).style.opacity = '0.2';
                                                        }}
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
                                                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur border border-white/20 text-[10px] font-black uppercase text-sky-400 tracking-widest">
                                                        HD MAP
                                                    </div>
                                                    <div className="absolute bottom-3 left-3 flex items-center gap-2">
                                                        <span className="px-3 py-1.5 rounded-xl bg-black/80 backdrop-blur border border-white/15 text-white/80 font-mono font-bold text-xs">
                                                            [{position.displayX}, {position.displayY}]
                                                        </span>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-full gap-4 text-foreground/20 p-8" style={{ minHeight: '280px' }}>
                                                    <Map size={48} />
                                                    <p className="text-xs text-muted-foreground">Aucune tuile disponible</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Infos rapides */}
                                        <div className="lg:col-span-2 flex flex-col gap-4">
                                            {/* Stats Zone */}
                                            <div className="space-y-3 rounded-2xl border border-border bg-surface/60 p-4">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Infos de la zone</p>
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs text-muted-foreground flex items-center gap-2">
                                                            <img src="/assets/icons/ocre.png" alt="" className="w-4 h-4 object-contain" /> Archimonstres
                                                        </span>
                                                        <span className="text-sm font-semibold tabular-nums text-foreground">{archis.length}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs text-muted-foreground flex items-center gap-2">
                                                            <img src="/assets/avis/avitons.png" alt="" className="w-4 h-4 object-contain" /> Avis de Recherche
                                                        </span>
                                                        <span className="text-sm font-semibold tabular-nums text-foreground">{bounties.length}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs text-muted-foreground flex items-center gap-2">
                                                            <img src="/assets/dofus/game-icons/crossed-swords.png" alt="" className="w-4 h-4 object-contain" /> Familles
                                                        </span>
                                                        <span className="text-sm font-semibold tabular-nums text-foreground">{monsters?.families?.length ?? 0}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs text-muted-foreground flex items-center gap-2">
                                                            <img src="/assets/dofus/map-layers/icon-dungeon-color.png" alt="" className="w-4 h-4 object-contain" /> Donjons
                                                        </span>
                                                        <span className="text-sm font-semibold tabular-nums text-foreground">{dungeons.length}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Donjons de la zone */}
                                            {dungeons.length > 0 && (
                                                <div className="p-4 rounded-2xl bg-surface/60 border border-border/80 space-y-3">
                                                    <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                                                        <img src="/assets/dofus/map-layers/icon-dungeon-color.png" alt="" className="w-3.5 h-3.5 object-contain" /> Donjons
                                                    </p>
                                                    <div className="space-y-2">
                                                        {dungeons.map((dj: any) => (
                                                            <div key={dj.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-background/50 border border-border/40 hover:border-amber-500/30 transition-all">
                                                                <div className="w-8 h-8 rounded-lg bg-black/40 border border-border/60 flex items-center justify-center shrink-0 overflow-hidden">
                                                                    {dj.imageUrl ? (
                                                                        <img src={dj.imageUrl} alt="" className="w-6 h-6 object-contain" />
                                                                    ) : (
                                                                        <img src="/assets/dofus/map-layers/icon-dungeon-color.png" alt="" className="w-4 h-4 object-contain opacity-40" />
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-xs font-bold text-foreground truncate leading-none">{dj.name}</p>
                                                                    <p className="text-[11px] text-muted-foreground">Niv. {dj.level}</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Accès rapide aux autres onglets — même grammaire sobre partout. */}
                                            <div className="grid grid-cols-3 gap-2">
                                                {([
                                                    { tab: "archis", label: "Archis", icon: "/assets/icons/ocre.png" },
                                                    { tab: "bounties", label: "Avis", icon: "/assets/avis/avitons.png" },
                                                    { tab: "families", label: "Familles", icon: "/assets/dofus/game-icons/crossed-swords.png" },
                                                ] as const).map((shortcut) => (
                                                    <button
                                                        key={shortcut.tab}
                                                        type="button"
                                                        onClick={() => setActiveTab(shortcut.tab)}
                                                        className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-surface/60 p-3 text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                                                    >
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img src={shortcut.icon} alt="" className="h-5 w-5 object-contain" />
                                                        <span className="text-[11px] font-semibold">{shortcut.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>

                                {/* TAB: ARCHIMONSTRES */}
                                <TabsContent value="archis" className="m-0 space-y-6">
                                    <div className={`grid grid-cols-1 ${(!isGuildMode && dungeons.length === 0) ? 'lg:grid-cols-1' : 'lg:grid-cols-3'} gap-6`}>
                                        {/* Colonne Gauche : Liste des Archimonstres de la zone */}
                                        <div className={`${(!isGuildMode && dungeons.length === 0) ? 'lg:col-span-1' : 'lg:col-span-2'} space-y-3`}>
                                            <div className="flex items-center justify-between pb-2 border-b border-border/40">
                                                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                                                    <img src="/assets/icons/ocre.png" alt="" className="w-4 h-4 object-contain" />
                                                    Archimonstres du secteur ({archis.length})
                                                </span>
                                            </div>

                                            {archis.length > 0 ? (
                                                <div className={`grid grid-cols-1 ${(!isGuildMode && dungeons.length === 0) ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3`}>
                                                    {archis.map((archi) => {
                                                        const isMissing = archi.state === 'MANQUANT';
                                                        const showGuildStatus = isGuildMode && archi.state !== 'INCONNU';
                                                        // Fiche du monstre : un archimonstre EST un monstre
                                                        // (race 78) ⇒ `/bestiaire/<slug>`, jamais une URL inventée.
                                                        const archiFicheHref = monsterFicheHref(isGuildMode ? guildId : null, { name: archi.name });
                                                        return (
                                                            <div 
                                                                key={archi.id} 
                                                                className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                                                                    showGuildStatus 
                                                                        ? isMissing 
                                                                            ? 'bg-rose-500/5 border-rose-500/15 hover:border-rose-500/30' 
                                                                            : 'bg-emerald-500/5 border-emerald-500/15 hover:border-emerald-500/30'
                                                                        : 'bg-surface/50 border-border/60 hover:border-amber-500/30'
                                                                }`}
                                                            >
                                                                <div className="w-10 h-10 rounded-xl bg-black/40 border border-border/60 overflow-hidden flex items-center justify-center shrink-0">
                                                                    <img src={archi.image} alt="" className="w-8 h-8 object-contain" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    {archiFicheHref ? (
                                                                        <Link
                                                                            href={archiFicheHref}
                                                                            title={`Ouvrir la fiche de ${archi.name}`}
                                                                            className={`block truncate text-xs font-bold leading-tight hover:underline ${showGuildStatus ? (isMissing ? 'text-rose-400' : 'text-emerald-400') : 'text-foreground'}`}
                                                                        >
                                                                            {archi.name}
                                                                        </Link>
                                                                    ) : (
                                                                        <p className={`text-xs font-bold truncate leading-tight ${showGuildStatus ? (isMissing ? 'text-rose-400' : 'text-emerald-400') : 'text-foreground'}`}>
                                                                            {archi.name}
                                                                        </p>
                                                                    )}
                                                                    <p className="text-[11px] text-foreground/40 truncate">
                                                                        {archi.subzone || archi.zone || "Zone inconnue"}
                                                                    </p>
                                                                </div>
                                                                <div className="flex shrink-0 items-center gap-1.5">
                                                                    {showGuildStatus ? (
                                                                        isMissing ? (
                                                                            <span className="px-2 py-0.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold">
                                                                                Manquant
                                                                            </span>
                                                                        ) : (
                                                                            <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                                                                                {archi.owned > 1 ? `x${archi.owned}` : 'Capturé'}
                                                                            </span>
                                                                        )
                                                                    ) : archi.step > 0 ? (
                                                                        <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold">
                                                                            Étape {archi.step}
                                                                        </span>
                                                                    ) : (
                                                                        // Sans compte Metamob lié, l'« étape » n'existe pas :
                                                                        // on affiche le **niveau réel** du monstre, jamais un faux.
                                                                        <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-border/60 text-foreground/50 text-[10px] font-bold tabular-nums">
                                                                            Niv. {archi.levelMin || archi.levelMax || "?"}
                                                                        </span>
                                                                    )}
                                                                    {/* Source officielle de la Quête Ocre (URL vérifiée). */}
                                                                    <a
                                                                        href="https://www.metamob.fr/"
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        title="Ouvrir Metamob"
                                                                        className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-border/60 text-foreground/40 transition-colors hover:text-amber-400"
                                                                    >
                                                                        <ExternalLink size={12} />
                                                                    </a>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="py-16 flex flex-col items-center justify-center gap-3 bg-surface/30 border border-dashed border-border rounded-2xl p-6 text-center">
                                                    <img src="/assets/icons/ocre.png" alt="" className="w-10 h-10 object-contain opacity-30" />
                                                    <p className="text-caption text-foreground/40 font-medium">
                                                        {isGuildMode && error === "Compte non lié" 
                                                            ? "Liez votre compte Metamob pour voir vos archimonstres"
                                                            : "Aucun archimonstre détecté dans ce secteur"}
                                                    </p>
                                                    {isGuildMode && error === "Compte non lié" && (
                                                        <a 
                                                            href={`/dashboard/${guildId}/profile`}
                                                            className="mt-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-caption font-bold transition-all flex items-center gap-2"
                                                        >
                                                            <Sparkles size={14} /> Lier mon compte Metamob
                                                        </a>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Colonne Droite (1/3) : Échanges Ocre Actifs (GUILDE UNIQUEMENT) & Donjons */}
                                        {(isGuildMode || dungeons.length > 0) && (
                                            <div className="space-y-6">
                                                {/* Section Échanges de Guilde pour cette zone — strictement masquée en mode public */}
                                                {isGuildMode && (
                                                    <section className="space-y-3">
                                                        <div className="flex items-center justify-between pb-2 border-b border-border/40">
                                                            <span className="text-caption font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                                                                <img src="/assets/icons/kama.png" alt="" className="w-3.5 h-3.5 object-contain" /> Échanges disponibles ({trades.length})
                                                            </span>
                                                        </div>

                                                        {tradesLoading ? (
                                                            <div className="p-4 rounded-xl bg-surface/20 text-caption text-foreground/40 italic flex items-center gap-2">
                                                                <Loader2 size={13} className="animate-spin" /> Recherche d'échanges de guilde...
                                                            </div>
                                                        ) : trades.length > 0 ? (
                                                            <div className="space-y-2">
                                                                {trades.map((t) => (
                                                                    <div key={t.id} className="p-3 rounded-xl bg-surface/50 border border-border/60 hover:border-amber-500/30 transition-all space-y-1.5">
                                                                        <div className="flex items-center gap-2">
                                                                            {t.monsterImageUrl && (
                                                                                <img src={t.monsterImageUrl} alt="" className="w-6 h-6 object-contain rounded bg-black/40 shrink-0" />
                                                                            )}
                                                                            <span className="text-xs font-bold text-foreground truncate flex-1">{t.monsterName}</span>
                                                                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                                                Dispo
                                                                            </span>
                                                                        </div>
                                                                        <div className="text-[11px] text-foreground/50 flex items-center justify-between">
                                                                            <span>Proposé par : <strong className="text-foreground/80">{t.requesterName}</strong></span>
                                                                            {t.targetName && <span className="text-foreground/40">→ {t.targetName}</span>}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="p-4 rounded-xl bg-surface/20 border border-dashed border-border/50 text-caption text-foreground/40 text-center">
                                                                Aucun membre de la guilde ne propose d'échange actif sur cette zone pour le moment.
                                                            </div>
                                                        )}
                                                    </section>
                                                )}

                                                {/* Donjons de la Zone */}
                                                {dungeons.length > 0 && (
                                                    <section className="space-y-3">
                                                        <div className="flex items-center justify-between pb-2 border-b border-border/40">
                                                            <span className="text-caption font-bold text-amber-500 flex items-center gap-1.5 uppercase tracking-wider">
                                                                <img src="/assets/dofus/map-layers/icon-dungeon-color.png" alt="" className="w-3.5 h-3.5 object-contain" /> Donjons ({dungeons.length})
                                                            </span>
                                                        </div>
                                                        <div className="space-y-2">
                                                            {dungeons.map((dj) => (
                                                                <div 
                                                                    key={dj.id} 
                                                                    className="flex items-center gap-3 p-3 rounded-xl bg-surface/50 border border-border/60 hover:border-amber-500/30 transition-all"
                                                                >
                                                                    <div className="w-9 h-9 rounded-lg bg-black/40 border border-border/60 overflow-hidden flex items-center justify-center shrink-0">
                                                                        {dj.imageUrl ? (
                                                                            <img src={dj.imageUrl} alt="" className="w-7 h-7 object-contain" />
                                                                        ) : (
                                                                            <img src="/assets/dofus/map-layers/icon-dungeon-color.png" alt="" className="w-5 h-5 object-contain opacity-40" />
                                                                        )}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-xs font-bold text-foreground truncate leading-none mb-0.5">{dj.name}</p>
                                                                        <p className="text-[11px] text-amber-400/70">Niveau {dj.level} · {dj.bossName}</p>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </section>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>

                                {/* TAB: AVIS DE RECHERCHE — la vraie fiche de l'avis (rendu partagé) */}
                                <TabsContent value="bounties" className="m-0">
                                    {bounties.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-14 text-center">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface">
                                                <ShieldAlert className="text-muted-foreground" size={22} />
                                            </div>
                                            <p className="text-sm font-semibold text-foreground">Zone sécurisée</p>
                                            <p className="max-w-md text-xs text-muted-foreground">
                                                Aucun avis de recherche signalé dans cette zone.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {bounties.length > 1 && (
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    {bounties.map((bounty: any) => (
                                                        <button
                                                            key={bounty.id}
                                                            type="button"
                                                            onClick={() => setActiveBountyId(bounty.id)}
                                                            className={
                                                                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors " +
                                                                (activeBountyId === bounty.id
                                                                    ? "border-border-strong bg-surface text-foreground"
                                                                    : "border-border text-muted-foreground hover:text-foreground")
                                                            }
                                                        >
                                                            {bounty.name}
                                                            {!bounty.ficheAvailable && (
                                                                <span className="text-[10px] text-muted-foreground/70">(sans fiche)</span>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            <BountyFicheView
                                                fiche={bountyFiche}
                                                guildId={isGuildMode ? (guildId as string) : ""}
                                                loading={loadingBountyFiche}
                                                showOverlayAction={isGuildMode}
                                                fallbackImageUrl={bounties.find((b: any) => b.id === activeBountyId)?.imageUrl ?? null}
                                                emptyTitle="Fiche non disponible"
                                                emptyHint="Cet avis n'a pas encore de fiche (God → Données de jeu → Avis de recherche)."
                                            />
                                        </div>
                                    )}
                                </TabsContent>
                                <TabsContent value="families" className="m-0">
                                    <div className="space-y-6">
                                        {/* Filtre par **type** de créature (super-famille officielle) —
                                            le MÊME menu déroulant du design system que les fiches
                                            monstres, alimenté par la sous-zone réelle. */}
                                        {familyTypes.length > 1 && (
                                            <FilterDropdown
                                                value={familyType}
                                                onChange={setFamilyType}
                                                ariaLabel="Filtrer par type de créature"
                                                options={[
                                                    { value: "", label: `Tous les types (${familyGroups.length})` },
                                                    ...familyTypes.map((type) => ({ value: type, label: type })),
                                                ]}
                                            />
                                        )}
                                        {visibleFamilyGroups.length > 0 ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Familles RÉELLEMENT peuplées de la zone (règle pure
                                                    `@/lib/zone-families`) : aucune famille vide, aucun monstre
                                                    rattaché à la mauvaise famille. */}
                                                {visibleFamilyGroups.map(({ family, monsters: familyMonsters }) => {
                                                    const familyImg = family.imageUrl
                                                        ? (family.imageUrl.startsWith('/') || family.imageUrl.startsWith('http')
                                                            ? family.imageUrl
                                                            : `/api/assets-dofus/monsters/${family.imageUrl}`)
                                                        : (familyMonsters[0]?.imageUrl || null);

                                                    return (
                                                        <div key={family.id} className="flex flex-col rounded-2xl border border-white/10 bg-black/25 p-5 space-y-4">
                                                            {/* Header Famille */}
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-14 h-14 rounded-xl bg-black/40 border border-border/60 flex items-center justify-center p-1.5 shrink-0 overflow-hidden">
                                                                    {familyImg ? (
                                                                        <img
                                                                            src={familyImg}
                                                                            alt={family.name}
                                                                            className="w-full h-full object-contain"
                                                                            onError={(e) => {
                                                                                // Fallback silencieux si l'image distante échoue
                                                                                (e.target as HTMLElement).style.display = 'none';
                                                                            }}
                                                                        />
                                                                    ) : (
                                                                        <Ghost className="text-purple-400/30 w-7 h-7" />
                                                                    )}
                                                                </div>

                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-caption font-bold text-purple-400 uppercase tracking-wider">
                                                                            Famille
                                                                        </span>
                                                                        {family.level && (
                                                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 font-semibold">
                                                                                Niv. {family.level}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <h4 className="text-base font-bold text-foreground truncate">
                                                                        {family.name}
                                                                    </h4>
                                                                    <p className="text-caption text-foreground/50">
                                                                        {familyMonsters.length} espèce{familyMonsters.length > 1 ? 's' : ''} répertoriée{familyMonsters.length > 1 ? 's' : ''}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {/* Liste des monstres membres — cliquables vers LEUR fiche
                                                                quand une fiche est publiée (slug lu en base). */}
                                                            {familyMonsters.length > 0 && (
                                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-3 border-t border-white/10">
                                                                    {familyMonsters.map((m: any) => {
                                                                        const monsterImg = m.imageUrl
                                                                            ? (m.imageUrl.startsWith('/') || m.imageUrl.startsWith('http')
                                                                                ? m.imageUrl
                                                                                : `/api/assets-dofus/monsters/${m.imageUrl}`)
                                                                            : null;
                                                                        // Lien vers la fiche : `null` quand aucune fiche n'est publiée
                                                                        // (jamais d'URL fabriquée à partir du nom ⇒ aucun 404).
                                                                        const ficheHref = monsterFicheHref(isGuildMode ? guildId : null, m);
                                                                        const rowClass = `flex items-center gap-2 p-2 rounded-xl bg-black/30 border border-white/10 transition-colors ${ficheHref ? "hover:border-purple-400/50" : "cursor-default"}`;
                                                                        const rowContent = (
                                                                            <>
                                                                                <div className="w-7 h-7 rounded-lg bg-black/30 flex items-center justify-center shrink-0 overflow-hidden">
                                                                                    {monsterImg ? (
                                                                                        <img
                                                                                            src={monsterImg}
                                                                                            alt={m.name}
                                                                                            className="w-full h-full object-contain"
                                                                                            onError={(e) => {
                                                                                                (e.target as HTMLElement).style.display = 'none';
                                                                                            }}
                                                                                        />
                                                                                    ) : (
                                                                                        <Ghost size={12} className="text-foreground/20" />
                                                                                    )}
                                                                                </div>
                                                                                <span className="text-caption font-medium text-foreground/80 truncate">
                                                                                    {m.name}
                                                                                </span>
                                                                            </>
                                                                        );

                                                                        return ficheHref ? (
                                                                            <Link
                                                                                key={m.id}
                                                                                href={ficheHref}
                                                                                title={`Ouvrir la fiche de ${m.name}`}
                                                                                className={rowClass}
                                                                            >
                                                                                {rowContent}
                                                                            </Link>
                                                                        ) : (
                                                                            <div
                                                                                key={m.id}
                                                                                title={`${m.name} — aucune fiche publiée`}
                                                                                className={rowClass}
                                                                            >
                                                                                {rowContent}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="py-16 rounded-2xl bg-surface/40 border border-dashed border-border flex flex-col items-center justify-center gap-3">
                                                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                                                    <Ghost className="text-purple-400" size={24} />
                                                </div>
                                                <div className="text-center space-y-1">
                                                    <h3 className="text-sm font-bold text-foreground">Aucune Famille Détectée</h3>
                                                    <p className="text-caption text-foreground/40 max-w-sm mx-auto">
                                                        Aucune famille de monstre n'est actuellement liée à cette zone.
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>


                            </Tabs>
                        </div>
                    )}
                </div>

                {/* Pied de fenêtre — sobre, sans pastille clignotante ni emphase. */}
                <div className="flex items-center justify-between gap-6 border-t border-border px-5 py-3 shrink-0">
                    <span className="truncate text-xs text-muted-foreground">
                        {zoneName} · [{position.displayX}, {position.displayY}]
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground/70">
                        Carte du Monde — SigilOS
                    </span>
                </div>
            </DialogContent>
        </Dialog>
    );
}

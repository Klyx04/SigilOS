'use client';
// dark-locked — module volontairement sombre (V2 Dual-Theme Phase 2C) : ne PAS utiliser les tokens thème-aware ici (voir memo 21/08 + prompt 22/08).

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Swords, ShieldAlert, ChevronDown, Loader2, MapPin, Ghost, Sparkles, Info, ChevronUp, Coins, ExternalLink, Map, Layers, Search, Users } from 'lucide-react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { DocContent } from '../doc/doc-content';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { getZoneMonsters, getBountiesForZone, searchDungeonsAdvanced } from '@/server/actions/game-data-actions';
import { getZoneArchmonsters, getGuildOcreTrades } from '@/server/actions/ocre-actions';

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
    const [expandedBounties, setExpandedBounties] = useState<Record<string, boolean>>({});
    const [dungeons, setDungeons] = useState<any[]>([]);
    const [trades, setTrades] = useState<any[]>([]);
    const [tradesLoading, setTradesLoading] = useState(false);

    const [error, setError] = useState<string | null>(null);

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
                getBountiesForZone(zoneName),
                searchDungeonsAdvanced({ query: zoneName }),
                tradesPromise,
            ]).then(([mRes, aRes, bRes, dRes, tRes]) => {
                const localAvis = (mRes.success && mRes.data) ? mRes.data.avisDeRecherche : [];
                const dbAvis = bRes.success ? bRes.data || [] : [];
                
                // Merge and deduplicate by name
                const mergedAvis = [...dbAvis];
                (localAvis || []).forEach((la: any) => {
                    if (!mergedAvis.some(dba => dba.name.toLowerCase() === la.name.toLowerCase())) {
                        mergedAvis.push({
                            id: la.id,
                            name: la.name,
                            imageUrl: la.imageUrl || `https://static.ankama.com/dofus/www/game/monsters/${la.id}.png`,
                            level: la.level || 0,
                            subarea: zoneName
                        });
                    }
                });

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


    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent 
                showCloseButton={false} 
                className="w-[95vw] max-w-6xl bg-[#080a10] border border-border shadow-[0_50px_100px_rgba(0,0,0,0.9)] rounded-[2.5rem] md:rounded-[3rem] text-foreground p-0 overflow-hidden flex flex-col h-[min(850px,90vh)]"
            >
                {/* Header */}
                <div className="relative h-32 md:h-44 bg-surface border-b border-border shrink-0 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/10 via-transparent to-amber-500/10" />
                    <button 
                        onClick={onClose}
                        className="absolute top-6 right-6 md:top-8 md:right-8 p-3 rounded-2xl bg-surface hover:bg-surface border border-border text-foreground/50 hover:text-foreground transition-all z-20"
                    >
                        <X size={24} />
                    </button>

                    <div className="absolute bottom-6 left-6 md:bottom-8 md:left-10 flex items-end gap-6 md:gap-8 z-10">
                        <div className="hidden md:flex w-16 h-16 rounded-2xl bg-emerald-500/20 items-center justify-center border border-emerald-500/20 shadow-inner">
                            <MapPin size={28} className="text-emerald-500" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-500 text-caption font-black uppercase tracking-widest italic shadow-lg shadow-emerald-500/10">
                                    GPS [{position.displayX}, {position.displayY}]
                                </span>
                            </div>
                            <h2 className="text-2xl md:text-3xl font-black text-foreground uppercase italic tracking-tighter leading-none drop-shadow-2xl">
                                {zoneName}
                            </h2>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-6 opacity-40">
                             <div className="relative">
                                 <Swords size={64} className="text-foreground animate-pulse" />
                                 <div className="absolute -inset-8 bg-emerald-500/20 blur-3xl rounded-full animate-pulse" />
                             </div>
                             <p className="text-body font-black uppercase tracking-widest text-foreground italic">Analyse de la faune locale...</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 pt-6">
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col gap-8">
                                <div className="flex items-center justify-between border-b border-border pb-4 sticky top-0 bg-[#080a10] z-20 pt-4">
                                    <TabsList className="bg-surface p-1.5 rounded-2xl gap-1">
                                        <TabsTrigger value="tuile" className="rounded-xl px-5 py-2.5 font-black uppercase italic text-label tracking-widest data-[state=active]:bg-[#1a2744] data-[state=active]:text-sky-300 data-[state=active]:border data-[state=active]:border-sky-500/40 transition-all flex items-center gap-2">
                                            <img src="/assets/dofus/map-layers/icon-zones-on.png" alt="" className="w-3.5 h-3.5 object-contain" /> Tuile HD
                                        </TabsTrigger>
                                        <TabsTrigger value="archis" className="rounded-xl px-5 py-2.5 font-black uppercase italic text-label tracking-widest data-[state=active]:bg-amber-500 data-[state=active]:text-black transition-all flex items-center gap-2">
                                            <img src="/assets/icons/ocre.png" alt="" className="w-3.5 h-3.5 object-contain" /> Archimonstres
                                        </TabsTrigger>
                                        <TabsTrigger value="bounties" className="rounded-xl px-5 py-2.5 font-black uppercase italic text-label tracking-widest data-[state=active]:bg-rose-500 data-[state=active]:text-foreground transition-all flex items-center gap-2">
                                            <img src="/assets/avis/avitons.png" alt="" className="w-3.5 h-3.5 object-contain" /> Avis de Recherche
                                        </TabsTrigger>
                                        <TabsTrigger value="families" className="rounded-xl px-5 py-2.5 font-black uppercase italic text-label tracking-widest data-[state=active]:bg-purple-500 data-[state=active]:text-foreground transition-all flex items-center gap-2">
                                            <img src="/assets/dofus/game-icons/crossed-swords.png" alt="" className="w-3.5 h-3.5 object-contain" /> Familles
                                        </TabsTrigger>
                                    </TabsList>

                                    {/* Capture Stats */}
                                    <div className="flex items-center gap-3">
                                        <span className="text-caption font-black text-foreground/20 uppercase tracking-[0.2em]">Archis :</span>
                                        {isGuildMode ? (
                                            <span className="text-caption font-black text-amber-500/80 uppercase tracking-widest bg-amber-500/5 px-3 py-1 rounded-full border border-amber-500/10 italic">
                                                {archis.filter(a => a.state !== 'MANQUANT').length} / {archis.length}
                                            </span>
                                        ) : (
                                            <span className="text-caption font-black text-amber-400 uppercase tracking-widest bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 italic">
                                                {archis.length} {archis.length > 1 ? "Archis" : "Archi"}
                                            </span>
                                        )}
                                    </div>
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
                                                    <p className="text-caption font-bold uppercase tracking-widest">Aucune tuile disponible</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Infos rapides */}
                                        <div className="lg:col-span-2 flex flex-col gap-4">
                                            {/* Stats Zone */}
                                            <div className="p-5 rounded-2xl bg-surface/60 border border-border/80 space-y-4">
                                                <p className="text-caption font-black text-foreground/40 uppercase tracking-widest">Infos de la zone</p>
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-caption text-foreground/70 flex items-center gap-2">
                                                            <img src="/assets/icons/ocre.png" alt="" className="w-4 h-4 object-contain" /> Archimonstres
                                                        </span>
                                                        <span className="text-sm font-black text-amber-400">{archis.length}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-caption text-foreground/70 flex items-center gap-2">
                                                            <img src="/assets/avis/avitons.png" alt="" className="w-4 h-4 object-contain" /> Avis de Recherche
                                                        </span>
                                                        <span className="text-sm font-black text-rose-400">{bounties.length}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-caption text-foreground/70 flex items-center gap-2">
                                                            <img src="/assets/dofus/game-icons/crossed-swords.png" alt="" className="w-4 h-4 object-contain" /> Familles
                                                        </span>
                                                        <span className="text-sm font-black text-purple-400">{monsters?.families?.length ?? 0}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-caption text-foreground/70 flex items-center gap-2">
                                                            <img src="/assets/dofus/map-layers/icon-dungeon-color.png" alt="" className="w-4 h-4 object-contain" /> Donjons
                                                        </span>
                                                        <span className="text-sm font-black text-foreground/80">{dungeons.length}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Donjons de la zone */}
                                            {dungeons.length > 0 && (
                                                <div className="p-4 rounded-2xl bg-surface/60 border border-border/80 space-y-3">
                                                    <p className="text-caption font-black text-amber-500/80 uppercase tracking-widest flex items-center gap-1.5">
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
                                                                    <p className="text-[11px] text-amber-400/60">Niv. {dj.level}</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Accès rapide autres onglets */}
                                            <div className="grid grid-cols-3 gap-2">
                                                <button
                                                    onClick={() => setActiveTab("archis")}
                                                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-surface/50 border border-amber-500/20 hover:border-amber-500/50 hover:bg-amber-500/10 transition-all text-amber-400 cursor-pointer group"
                                                >
                                                    <img src="/assets/icons/ocre.png" alt="" className="w-5 h-5 object-contain group-hover:scale-110 transition-transform" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Archis</span>
                                                </button>
                                                <button
                                                    onClick={() => setActiveTab("bounties")}
                                                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-surface/50 border border-rose-500/20 hover:border-rose-500/50 hover:bg-rose-500/10 transition-all text-rose-400 cursor-pointer group"
                                                >
                                                    <img src="/assets/avis/avitons.png" alt="" className="w-5 h-5 object-contain group-hover:scale-110 transition-transform" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Avis</span>
                                                </button>
                                                <button
                                                    onClick={() => setActiveTab("families")}
                                                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-surface/50 border border-purple-500/20 hover:border-purple-500/50 hover:bg-purple-500/10 transition-all text-purple-400 cursor-pointer group"
                                                >
                                                    <img src="/assets/dofus/game-icons/crossed-swords.png" alt="" className="w-5 h-5 object-contain group-hover:scale-110 transition-transform" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Familles</span>
                                                </button>
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
                                                <span className="text-caption font-bold text-foreground/60 uppercase tracking-wider flex items-center gap-2">
                                                    <img src="/assets/icons/ocre.png" alt="" className="w-4 h-4 object-contain" />
                                                    Archimonstres du secteur ({archis.length})
                                                </span>
                                            </div>

                                            {archis.length > 0 ? (
                                                <div className={`grid grid-cols-1 ${(!isGuildMode && dungeons.length === 0) ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3`}>
                                                    {archis.map((archi) => {
                                                        const isMissing = archi.state === 'MANQUANT';
                                                        const showGuildStatus = isGuildMode && archi.state !== 'INCONNU';
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
                                                                    <p className={`text-xs font-bold truncate leading-tight ${showGuildStatus ? (isMissing ? 'text-rose-400' : 'text-emerald-400') : 'text-foreground'}`}>
                                                                        {archi.name}
                                                                    </p>
                                                                    <p className="text-[11px] text-foreground/40 truncate">
                                                                        {archi.subzone || archi.zone || "Zone inconnue"}
                                                                    </p>
                                                                </div>
                                                                <div className="shrink-0">
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
                                                                    ) : (
                                                                        <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold">
                                                                            Étape {archi.step ?? 1}
                                                                        </span>
                                                                    )}
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

                                {/* TAB: AVIS DE RECHERCHE */}
                                <TabsContent value="bounties" className="m-0">
                                    <div className="space-y-6">
                                        {bounties.length > 0 ? (
                                            <div className="grid grid-cols-1 gap-8">
                                                {bounties.map((bounty) => (
                                                    <div key={bounty.id} className="group relative overflow-hidden flex flex-col rounded-[2.5rem] bg-gradient-to-br from-[#0a0a0f] to-[#12121a] border border-border hover:border-rose-500/30 transition-all shadow-2xl">

                                                        {/* 1. NOM + BADGES */}
                                                        <div className="px-8 pt-8 pb-5">
                                                            <h4 className="text-4xl font-black text-rose-500 uppercase italic tracking-tighter leading-none mb-3">
                                                                {bounty.name}
                                                            </h4>
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="px-3 py-1 rounded-xl bg-surface border border-border text-caption font-black text-foreground uppercase tracking-widest italic">
                                                                    Niv. {bounty.level}
                                                                </span>
                                                                {bounty.milice && bounty.milice !== 'Inconnu' && (
                                                                    <span className="px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-caption font-black text-amber-500 uppercase tracking-widest italic">
                                                                        {bounty.milice}
                                                                    </span>
                                                                )}
                                                                {bounty.subarea && (
                                                                    <span className="px-3 py-1 rounded-xl bg-surface border border-border text-caption font-black text-foreground/40 uppercase tracking-widest italic">
                                                                        {bounty.subarea}
                                                                    </span>
                                                                )}
                                                                {bounty.position && (
                                                                    <button 
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            navigator.clipboard.writeText(`/travel ${bounty.position}`);
                                                                        }}
                                                                        className="px-3 py-1 rounded-xl bg-amber-500 text-warning-foreground text-caption font-black uppercase tracking-widest italic  active:scale-95 transition-all flex items-center gap-1.5"
                                                                    >
                                                                        <MapPin size={10} /> {bounty.position}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 2. IMAGES CÔTE À CÔTE */}
                                                        <div className="px-8 grid grid-cols-2 gap-4">
                                                            <div className="relative h-56 rounded-2xl overflow-hidden bg-black/60 border border-border flex items-center justify-center">
                                                                <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent" />
                                                                <img src={bounty.imageUrl} alt={bounty.name} className="h-48 w-auto object-contain drop-shadow-[0_0_24px_rgba(244,63,94,0.5)] group- transition-transform duration-300" />
                                                            </div>
                                                            {bounty.mapUrl ? (
                                                                <div className="relative h-56 rounded-2xl overflow-hidden bg-black/60 border border-border">
                                                                    <img src={bounty.mapUrl} alt="Zone de spawn" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-all duration-300" />
                                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                                                                    <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
                                                                        <MapPin size={11} className="text-rose-500" />
                                                                        <span className="text-caption font-black text-foreground/60 uppercase italic tracking-widest">Zone de Spawn</span>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="h-56 rounded-2xl bg-black/40 border border-dashed border-border flex flex-col items-center justify-center gap-2">
                                                                    <MapPin size={22} className="text-foreground/20" />
                                                                    <span className="text-caption text-foreground/20 uppercase italic font-black tracking-widest">Carte indisponible</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="flex flex-col gap-4 px-8 pb-8 pt-5">
                                                            <div className="flex flex-wrap gap-2">
                                                                {Array.isArray(bounty.rewards) && bounty.rewards.length > 0 ? (
                                                                    bounty.rewards.map((reward: any, ridx: number) => {
                                                                        let iconSrc = '/assets/avis/avitons.png';
                                                                        const typeLower = (reward.type || '').toLowerCase();
                                                                        if (typeLower.includes('aliton')) iconSrc = '/assets/avis/aliton.png';
                                                                        else if (typeLower.includes('kama de glace')) iconSrc = '/assets/avis/kamas_de_glace.png';
                                                                        else if (typeLower.includes('dofus des glaces')) iconSrc = 'https://static.dofusdb.fr/items/11756.png';
                                                                        
                                                                        return (
                                                                            <div key={ridx} className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-surface border border-border hover:bg-surface transition-all">
                                                                                <img src={iconSrc} className="w-7 h-7 object-contain" alt={reward.type} />
                                                                                <span className="text-base font-black text-foreground">{reward.amount}</span>
                                                                                <span className="text-caption text-foreground/40 uppercase italic">{reward.type}</span>
                                                                            </div>
                                                                        );
                                                                    })
                                                                ) : bounty.doplons > 0 ? (
                                                                    <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-surface border border-border">
                                                                        <img
                                                                            src={
                                                                                (bounty.rewardType || '').toLowerCase().includes('aliton') ? '/assets/avis/aliton.png' : 
                                                                                (bounty.rewardType || '').toLowerCase().includes('kama de glace') ? '/assets/avis/kamas_de_glace.png' : 
                                                                                (bounty.rewardType || '').toLowerCase().includes('dofus des glaces') ? 'https://static.dofusdb.fr/items/11756.png' :
                                                                                '/assets/avis/avitons.png'
                                                                            }
                                                                            className="w-7 h-7 object-contain" alt={bounty.rewardType || 'Aviton'}
                                                                        />
                                                                        <span className="text-base font-black text-foreground">{bounty.doplons}</span>
                                                                        <span className="text-caption text-foreground/40 uppercase italic">{bounty.rewardType || 'Aviton'}</span>
                                                                    </div>
                                                                ) : null}
                                                            </div>

                                                            {/* 4. STRAT */}
                                                            <div className="relative p-6 rounded-[1.5rem] bg-rose-500/5 border border-rose-500/15">
                                                                 <div className="absolute top-0 left-8 -translate-y-1/2 px-3 py-0.5 bg-[#0a0a0f] border border-rose-500/30 rounded-full flex items-center gap-2">
                                                                     <span className="text-caption font-black text-rose-500 uppercase tracking-widest">⚔ Stratégie</span>
                                                                     {bounty.dpnlUrl && (
                                                                         <>
                                                                             <div className="w-[1px] h-2 bg-rose-500/30" />
                                                                             <a 
                                                                                 href={bounty.dpnlUrl} 
                                                                                 target="_blank" 
                                                                                 rel="noopener noreferrer"
                                                                                 className="text-caption font-black text-amber-500 hover:text-amber-400 uppercase tracking-widest flex items-center gap-1 transition-colors"
                                                                             >
                                                                                 Guide DPNL <ExternalLink size={8} />
                                                                             </a>
                                                                         </>
                                                                     )}
                                                                 </div>
                                                                 <div className="prose prose-invert prose-sm max-w-none text-body-sm text-foreground/80 leading-relaxed prose-p:my-2 prose-ul:my-2 prose-li:my-0.5">
                                                                     <DocContent content={bounty.mechanics || "Aucun résumé tactique disponible pour le moment."} />
                                                                 </div>
                                                            </div>
                                                        </div>

                                                        <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-rose-500/5 blur-[80px] rounded-full pointer-events-none" />
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="py-24 rounded-[3rem] bg-surface border border-dashed border-border flex flex-col items-center justify-center gap-6">
                                                <div className="w-20 h-20 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20 shadow-inner">
                                                    <ShieldAlert className="text-rose-500" size={32} />
                                                </div>
                                                <div className="text-center space-y-2">
                                                    <h3 className="text-xl font-black text-foreground uppercase italic tracking-widest">Zone Sécurisée</h3>
                                                    <p className="text-caption font-black text-foreground/30 uppercase tracking-widest italic max-w-md mx-auto">
                                                        Pas d'avis de recherche signalé dans cette zone.
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>

                                {/* TAB: FAMILLES DE MONSTRES */}
                                <TabsContent value="families" className="m-0">
                                    <div className="space-y-6">
                                        {monsters?.families?.length > 0 ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {monsters.families.map((family: any) => {
                                                    const familyMonsters = monsters.normalMonsters.filter((m: any) => m.familyName === family.name);
                                                    const familyImg = family.imageUrl
                                                        ? (family.imageUrl.startsWith('/') || family.imageUrl.startsWith('http')
                                                            ? family.imageUrl
                                                            : `/api/assets-dofus/monsters/${family.imageUrl}`)
                                                        : (familyMonsters[0]?.imageUrl || null);

                                                    return (
                                                        <div key={family.id} className="flex flex-col rounded-2xl bg-surface/60 border border-border/80 hover:border-purple-500/40 transition-all p-5 shadow-sm space-y-4">
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

                                                            {/* Liste des monstres membres */}
                                                            {familyMonsters.length > 0 && (
                                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-border/40">
                                                                    {familyMonsters.map((m: any) => {
                                                                        const monsterImg = m.imageUrl
                                                                            ? (m.imageUrl.startsWith('/') || m.imageUrl.startsWith('http')
                                                                                ? m.imageUrl
                                                                                : `/api/assets-dofus/monsters/${m.imageUrl}`)
                                                                            : null;

                                                                        return (
                                                                            <div
                                                                                key={m.id}
                                                                                className="flex items-center gap-2 p-2 rounded-xl bg-background/50 border border-border/40 hover:border-purple-500/30 transition-colors"
                                                                            >
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

                {/* Footer */}
                <div className="p-4 md:p-5 bg-black/40 border-t border-border flex items-center justify-between shrink-0 px-6 md:px-10 gap-6">
                    <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-caption font-bold text-foreground/50 uppercase tracking-wider">
                            {zoneName} · [{position.displayX}, {position.displayY}]
                        </span>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                        <span className="text-caption font-black text-foreground/30 uppercase tracking-widest italic">
                            Carte du Monde — SigilOS
                        </span>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

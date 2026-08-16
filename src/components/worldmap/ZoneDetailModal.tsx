'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Swords, ShieldAlert, CheckCircle2, XCircle, ChevronDown, Loader2, MapPin, Ghost, Sparkles, Info, ChevronUp, Coins, ExternalLink } from 'lucide-react';
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
    position: { x: number; y: number; displayX: number; displayY: number };
    guildId: string;
    worldId?: number;
}

export function ZoneDetailModal({ isOpen, onClose, zoneName, position, guildId, worldId }: ZoneDetailModalProps) {
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
            setLoading(true);
            setTradesLoading(true);
            Promise.all([
                getZoneMonsters(zoneName),
                (worldId === undefined || worldId === 1) ? getZoneArchmonsters(guildId, zoneName) : getZoneArchmonsters(guildId, zoneName),
                getBountiesForZone(zoneName),
                searchDungeonsAdvanced({ query: zoneName }),
                getGuildOcreTrades(guildId, { subAreaName: zoneName }),
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
    }, [isOpen, zoneName, guildId]);


    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent 
                showCloseButton={false} 
                className="w-[95vw] max-w-6xl bg-[#080a10] border border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.9)] rounded-[2.5rem] md:rounded-[3rem] text-white p-0 overflow-hidden flex flex-col h-[min(850px,90vh)]"
            >
                {/* Header */}
                <div className="relative h-32 md:h-44 bg-white/5 border-b border-white/5 shrink-0 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/10 via-transparent to-amber-500/10" />
                    <button 
                        onClick={onClose}
                        className="absolute top-6 right-6 md:top-8 md:right-8 p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white transition-all z-20"
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
                            <h2 className="text-2xl md:text-3xl font-black text-white uppercase italic tracking-tighter leading-none drop-shadow-2xl">
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
                                 <Swords size={64} className="text-white animate-pulse" />
                                 <div className="absolute -inset-8 bg-emerald-500/20 blur-3xl rounded-full animate-pulse" />
                             </div>
                             <p className="text-body font-black uppercase tracking-widest text-white italic">Analyse de la faune locale...</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 pt-6">
                            <Tabs defaultValue="archis" className="w-full flex flex-col gap-8">
                                <div className="flex items-center justify-between border-b border-white/10 pb-4 sticky top-0 bg-[#080a10] z-20 pt-4">
                                    <TabsList className="bg-white/5 p-1.5 rounded-2xl gap-1">
                                        <TabsTrigger value="archis" className="rounded-xl px-6 py-3 font-black uppercase italic text-label tracking-widest data-[state=active]:bg-amber-500 data-[state=active]:text-black transition-all">
                                                ✦ Archimonstres
                                            </TabsTrigger>
                                        <TabsTrigger value="bounties" className="rounded-xl px-6 py-3 font-black uppercase italic text-label tracking-widest data-[state=active]:bg-rose-500 data-[state=active]:text-white transition-all">
                                            ⚔ Avis de Recherche
                                        </TabsTrigger>
                                        <TabsTrigger value="families" className="rounded-xl px-6 py-3 font-black uppercase italic text-label tracking-widest data-[state=active]:bg-purple-500 data-[state=active]:text-white transition-all">
                                            🦇 Familles
                                        </TabsTrigger>

                                    </TabsList>

                                    {/* Capture Stats (Only relevant for Archis, but can show generally) */}
                                    <div className="flex items-center gap-3">
                                            <span className="text-caption font-black text-white/20 uppercase tracking-[0.2em]">Archis Capturés :</span>
                                            <span className="text-caption font-black text-amber-500/80 uppercase tracking-widest bg-amber-500/5 px-3 py-1 rounded-full border border-amber-500/10 italic">
                                                {archis.filter(a => a.state !== 'MANQUANT').length} / {archis.length}
                                            </span>
                                        </div>
                                </div>

                                {/* TAB: ARCHIMONSTRES */}
                                <TabsContent value="archis" className="m-0 space-y-8">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                                        {/* Left Column: Archimonstres List */}
                                        <div className="space-y-4">
                                            {archis.length > 0 ? (
                                                <div className="grid gap-3">
                                                    {archis.map((archi) => {
                                                        const isMissing = archi.state === 'MANQUANT';
                                                        return (
                                                            <div 
                                                                key={archi.id} 
                                                                className={`group relative flex items-center gap-4 p-4 rounded-2xl transition-all border duration-300 ${
                                                                    isMissing 
                                                                        ? 'bg-rose-500/5 border-rose-500/10 hover:border-rose-500/30' 
                                                                        : 'bg-emerald-500/5 border-emerald-500/10 hover:border-emerald-500/30'
                                                                }`}
                                                            >
                                                                <div className="w-12 h-12 rounded-xl bg-[#020408] border border-white/5 overflow-hidden flex items-center justify-center shrink-0">
                                                                    <img src={archi.image} alt="" className="w-10 h-10 object-contain group- transition-transform duration-300" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className={`text-sm font-black truncate leading-tight mb-1 uppercase italic tracking-tight ${isMissing ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                                        {archi.name}
                                                                    </p>
                                                                    <p className="text-caption font-bold text-white/20 uppercase tracking-[0.1em] italic line-clamp-2 leading-relaxed">
                                                                        {archi.subzone || archi.zone || "Zone inconnue"}
                                                                    </p>
                                                                </div>
                                                                <div className="shrink-0">
                                                                    {isMissing ? (
                                                                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500 text-white text-caption font-black uppercase italic shadow-lg shadow-rose-500/20">
                                                                            <XCircle size={12} /> Manquant
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-caption font-black uppercase italic">
                                                                            <CheckCircle2 size={12} /> {archi.owned > 1 ? `x${archi.owned}` : 'Capturé'}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="py-20 flex flex-col items-center justify-center gap-4 bg-white/[0.02] border border-dashed border-white/10 rounded-[2rem] px-10 text-center">
                                                    <Ghost className="text-white/10" size={40} />
                                                    <p className="text-caption font-black text-white/15 uppercase tracking-widest italic">
                                                        {error === "Compte non lié" 
                                                            ? "Liez votre compte Metamob pour voir vos archimonstres"
                                                            : "Aucun archi-monstre détecté dans ce secteur"}
                                                    </p>
                                                    {error === "Compte non lié" && (
                                                        <a 
                                                            href={`/dashboard/${guildId}/profile`}
                                                            className="mt-4 px-8 py-3 rounded-2xl bg-amber-500 text-black text-caption font-black uppercase italic shadow-2xl shadow-amber-500/40  active:scale-95 transition-all flex items-center gap-3"
                                                        >
                                                            <Sparkles size={16} /> Lier mon compte Metamob
                                                        </a>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Right Column: Donjons & Bestiaire (for context) */}
                                        <div className="space-y-12">
                                            {dungeons.length > 0 && (
                                                <section className="space-y-6">
                                                    <div className="flex items-center justify-between">
                                                        <h3 className="text-amber-500 text-lg font-black uppercase italic tracking-widest flex items-center gap-4">
                                                            <Swords size={20} /> Donjons de la Zone
                                                        </h3>
                                                    </div>
                                                    <div className="grid gap-3">
                                                        {dungeons.map((dj) => (
                                                            <div 
                                                                key={dj.id} 
                                                                className="group relative flex items-center gap-4 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 hover:border-amber-500/40 transition-all shadow-lg shadow-amber-500/5 cursor-default"
                                                            >
                                                                <div className="w-12 h-12 rounded-xl bg-[#020408] border border-white/5 overflow-hidden flex items-center justify-center shrink-0">
                                                                    {dj.imageUrl ? (
                                                                        <img src={dj.imageUrl} alt="" className="w-10 h-10 object-contain group- transition-transform duration-300" />
                                                                    ) : (
                                                                        <Swords size={20} className="text-amber-500/40" />
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-black text-white truncate leading-none mb-1 uppercase italic tracking-tight">{dj.name}</p>
                                                                    <p className="text-caption font-bold text-amber-500/60 uppercase tracking-[0.1em] italic">Niveau {dj.level}</p>
                                                                </div>
                                                                <div className="shrink-0 flex items-center gap-2">
                                                                    <span className="text-caption font-black text-white/30 uppercase tracking-widest italic">{dj.bossName}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </section>
                                            )}

                                            {monsters?.normalMonsters?.length > 0 && (
                                                <section className="space-y-6">
                                                    <h3 className="text-white/40 text-lg font-black uppercase italic tracking-widest flex items-center gap-4">
                                                        <ChevronDown size={20} /> Faune Standard
                                                    </h3>
                                                    
                                                    <div className="flex flex-wrap gap-2">
                                                        {monsters.normalMonsters.map((m: any) => (
                                                            <div key={m.id} className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-caption font-black text-white/40 hover:text-white hover:bg-white/10 transition-all cursor-default uppercase italic tracking-tighter">
                                                                {m.name}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </section>
                                            )}
                                        </div>
                                    </div>
                                </TabsContent>

                                {/* TAB: AVIS DE RECHERCHE */}
                                <TabsContent value="bounties" className="m-0">
                                    <div className="space-y-6">
                                        {bounties.length > 0 ? (
                                            <div className="grid grid-cols-1 gap-8">
                                                {bounties.map((bounty) => (
                                                    <div key={bounty.id} className="group relative overflow-hidden flex flex-col rounded-[2.5rem] bg-gradient-to-br from-[#0a0a0f] to-[#12121a] border border-white/10 hover:border-rose-500/30 transition-all shadow-2xl">

                                                        {/* 1. NOM + BADGES */}
                                                        <div className="px-8 pt-8 pb-5">
                                                            <h4 className="text-4xl font-black text-rose-500 uppercase italic tracking-tighter leading-none mb-3">
                                                                {bounty.name}
                                                            </h4>
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-caption font-black text-white uppercase tracking-widest italic">
                                                                    Niv. {bounty.level}
                                                                </span>
                                                                {bounty.milice && bounty.milice !== 'Inconnu' && (
                                                                    <span className="px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-caption font-black text-amber-500 uppercase tracking-widest italic">
                                                                        {bounty.milice}
                                                                    </span>
                                                                )}
                                                                {bounty.subarea && (
                                                                    <span className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-caption font-black text-white/40 uppercase tracking-widest italic">
                                                                        {bounty.subarea}
                                                                    </span>
                                                                )}
                                                                {bounty.position && (
                                                                    <button 
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            navigator.clipboard.writeText(`/travel ${bounty.position}`);
                                                                        }}
                                                                        className="px-3 py-1 rounded-xl bg-amber-500 text-black text-caption font-black uppercase tracking-widest italic  active:scale-95 transition-all flex items-center gap-1.5"
                                                                    >
                                                                        <MapPin size={10} /> {bounty.position}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 2. IMAGES CÔTE À CÔTE */}
                                                        <div className="px-8 grid grid-cols-2 gap-4">
                                                            <div className="relative h-56 rounded-2xl overflow-hidden bg-black/60 border border-white/5 flex items-center justify-center">
                                                                <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent" />
                                                                <img src={bounty.imageUrl} alt={bounty.name} className="h-48 w-auto object-contain drop-shadow-[0_0_24px_rgba(244,63,94,0.5)] group- transition-transform duration-300" />
                                                            </div>
                                                            {bounty.mapUrl ? (
                                                                <div className="relative h-56 rounded-2xl overflow-hidden bg-black/60 border border-white/5">
                                                                    <img src={bounty.mapUrl} alt="Zone de spawn" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-all duration-300" />
                                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                                                                    <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
                                                                        <MapPin size={11} className="text-rose-500" />
                                                                        <span className="text-caption font-black text-white/60 uppercase italic tracking-widest">Zone de Spawn</span>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="h-56 rounded-2xl bg-black/40 border border-dashed border-white/10 flex flex-col items-center justify-center gap-2">
                                                                    <MapPin size={22} className="text-white/20" />
                                                                    <span className="text-caption text-white/20 uppercase italic font-black tracking-widest">Carte indisponible</span>
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
                                                                            <div key={ridx} className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                                                                                <img src={iconSrc} className="w-7 h-7 object-contain" alt={reward.type} />
                                                                                <span className="text-base font-black text-white">{reward.amount}</span>
                                                                                <span className="text-caption text-white/40 uppercase italic">{reward.type}</span>
                                                                            </div>
                                                                        );
                                                                    })
                                                                ) : bounty.doplons > 0 ? (
                                                                    <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10">
                                                                        <img
                                                                            src={
                                                                                (bounty.rewardType || '').toLowerCase().includes('aliton') ? '/assets/avis/aliton.png' : 
                                                                                (bounty.rewardType || '').toLowerCase().includes('kama de glace') ? '/assets/avis/kamas_de_glace.png' : 
                                                                                (bounty.rewardType || '').toLowerCase().includes('dofus des glaces') ? 'https://static.dofusdb.fr/items/11756.png' :
                                                                                '/assets/avis/avitons.png'
                                                                            }
                                                                            className="w-7 h-7 object-contain" alt={bounty.rewardType || 'Aviton'}
                                                                        />
                                                                        <span className="text-base font-black text-white">{bounty.doplons}</span>
                                                                        <span className="text-caption text-white/40 uppercase italic">{bounty.rewardType || 'Aviton'}</span>
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
                                                                 <div className="prose prose-invert prose-sm max-w-none text-body-sm text-white/80 leading-relaxed prose-p:my-2 prose-ul:my-2 prose-li:my-0.5">
                                                                     <DocContent content={bounty.mechanics || "Aucun résumé tactique disponible pour le moment."} />
                                                                 </div>
                                                            </div>
                                                        </div>

                                                        <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-rose-500/5 blur-[80px] rounded-full pointer-events-none" />
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="py-24 rounded-[3rem] bg-white/[0.02] border border-dashed border-white/10 flex flex-col items-center justify-center gap-6">
                                                <div className="w-20 h-20 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20 shadow-inner">
                                                    <ShieldAlert className="text-rose-500" size={32} />
                                                </div>
                                                <div className="text-center space-y-2">
                                                    <h3 className="text-xl font-black text-white uppercase italic tracking-widest">Zone Sécurisée</h3>
                                                    <p className="text-caption font-black text-white/30 uppercase tracking-widest italic max-w-md mx-auto">
                                                        Pas d'avis de recherche signalé dans cette zone.
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>

                                {/* TAB: FAMILLES DE MONSTRES */}
                                <TabsContent value="families" className="m-0">
                                    <div className="space-y-12">
                                        {monsters?.families?.length > 0 ? (
                                            <div className="flex flex-col gap-12">
                                                {monsters.families.map((family: any) => {
                                                    const familyMonsters = monsters.normalMonsters.filter((m: any) => m.familyName === family.name);
                                                    
                                                    return (
                                                        <div key={family.id} className="group relative overflow-hidden rounded-[3rem] bg-gradient-to-br from-purple-500/10 via-black/40 to-transparent border border-purple-500/20 shadow-2xl p-10 md:p-14">
                                                            {/* Background Glow */}
                                                            <div className="absolute -top-24 -right-24 w-96 h-96 bg-purple-500/10 blur-[120px] rounded-full pointer-events-none" />
                                                            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-500/5 blur-[120px] rounded-full pointer-events-none" />

                                                            <div className="relative z-10 flex flex-col lg:flex-row gap-12 items-center lg:items-start">
                                                                {/* Family Image - MEGA SIZE */}
                                                                <div className="relative group/img shrink-0">
                                                                    <div className="absolute -inset-4 bg-purple-500/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                                                    <div className="w-48 h-48 md:w-64 md:h-64 rounded-[2.5rem] bg-black/60 border border-purple-500/30 flex items-center justify-center p-6 shadow-inner relative overflow-hidden">
                                                                        <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/10 to-transparent opacity-50" />
                                                                        {family.imageUrl ? (
                                                                            <img src={family.imageUrl} alt={family.name} className="w-full h-full object-contain drop-shadow-[0_0_30px_rgba(168,85,247,0.4)] group- transition-transform duration-300" />
                                                                        ) : (
                                                                            <Ghost className="text-purple-500/20 w-32 h-32" />
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* Family Info */}
                                                                <div className="flex-1 text-center lg:text-left space-y-8">
                                                                    <div>
                                                                        <div className="flex items-center justify-center lg:justify-start gap-4 mb-4">
                                                                            <span className="px-4 py-1.5 rounded-full bg-purple-500 text-white text-caption font-black uppercase tracking-widest italic shadow-lg shadow-purple-500/20">
                                                                                Famille de Monstres
                                                                            </span>
                                                                        </div>
                                                                        <h4 className="text-5xl md:text-7xl font-black text-white uppercase italic tracking-tighter leading-none mb-4 drop-shadow-2xl">
                                                                            {family.name}
                                                                        </h4>
                                                                        {familyMonsters.length > 0 && (
                                                                            <p className="text-body font-black text-purple-400/60 uppercase tracking-widest italic">
                                                                                {familyMonsters.length} espèces détectées
                                                                            </p>
                                                                        )}
                                                                    </div>

                                                                    {/* Monstres List - PREMIUM GRID */}
                                                                    {familyMonsters.length > 0 && (
                                                                        <div className="space-y-6">
                                                                            <h5 className="text-caption font-black text-white/30 uppercase tracking-widest italic flex items-center gap-4 justify-center lg:justify-start">
                                                                                <div className="h-[1px] w-8 bg-white/10" />
                                                                                Membres de la famille
                                                                                <div className="h-[1px] w-8 bg-white/10" />
                                                                            </h5>
                                                                            
                                                                            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                                                                                {familyMonsters.map((m: any) => (
                                                                                    <div key={m.id} className="group/monster flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-purple-500/30 hover:bg-purple-500/5 transition-all cursor-default">
                                                                                        <div className="w-10 h-10 rounded-xl bg-black/40 flex items-center justify-center p-1 border border-white/5 group-hover/monster:border-purple-500/20 transition-colors">
                                                                                            {m.imageUrl ? (
                                                                                                <img src={m.imageUrl} alt={m.name} className="w-full h-full object-contain group-hover/monster:scale-110 transition-transform" />
                                                                                            ) : (
                                                                                                <Ghost size={16} className="text-white/10" />
                                                                                            )}
                                                                                        </div>
                                                                                        <span className="text-caption font-bold text-white/60 group-hover/monster:text-white transition-colors uppercase italic truncate">
                                                                                            {m.name}
                                                                                        </span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="py-24 rounded-[3rem] bg-white/[0.02] border border-dashed border-white/10 flex flex-col items-center justify-center gap-6">
                                                <div className="w-20 h-20 rounded-full bg-purple-500/10 flex items-center justify-center border border-purple-500/20 shadow-inner">
                                                    <Ghost className="text-purple-500" size={32} />
                                                </div>
                                                <div className="text-center space-y-2">
                                                    <h3 className="text-xl font-black text-white uppercase italic tracking-widest">Aucune Famille</h3>
                                                    <p className="text-caption font-black text-white/30 uppercase tracking-widest italic max-w-md mx-auto">
                                                        Aucune famille de monstre n'est référencée pour cette zone dans la base de données GOD.
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
                <div className="p-6 bg-black/40 border-t border-white/5 flex items-center justify-between shrink-0 px-10 gap-6">
                    {/* Trades Ocre */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-caption font-black text-amber-400/80 uppercase tracking-widest italic flex items-center gap-1.5">
                                <Coins size={12} />
                                Échanges Ocre {zoneName ? `— ${zoneName}` : ''}
                            </span>
                            {tradesLoading && <Loader2 size={11} className="animate-spin text-amber-400/50" />}
                        </div>
                        {tradesLoading ? (
                            <p className="text-caption text-white/40 italic">Chargement des échanges…</p>
                        ) : trades.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {trades.slice(0, 4).map((t) => (
                                    <div key={t.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10">
                                        {t.monsterImageUrl && (
                                            <img src={t.monsterImageUrl} alt="" className="w-5 h-5 object-contain rounded bg-black/40 shrink-0" />
                                        )}
                                        <span className="text-caption font-bold text-white truncate max-w-[140px]">{t.monsterName}</span>
                                        <span className="text-caption font-black uppercase tracking-widest italic">
                                            {t.status === "ACCEPTED" ? (
                                                <span className="text-emerald-400">Accepté</span>
                                            ) : (
                                                <span className="text-amber-400">En attente</span>
                                            )}
                                        </span>
                                    </div>
                                ))}
                                {trades.length > 4 && (
                                    <span className="text-caption font-black text-white/30 uppercase tracking-widest italic self-center">+{trades.length - 4}</span>
                                )}
                            </div>
                        ) : (
                            <p className="text-caption text-white/25 italic">Aucun échange actif sur cette zone.</p>
                        )}
                    </div>

                    {/* Bouton Metamob + filigrane */}
                    <div className="flex items-center gap-4 shrink-0">
                        <a
                            href={`https://www.metamob.fr`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-5 py-2.5 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500 hover:text-black border border-emerald-500/30 text-emerald-400 text-caption font-black uppercase tracking-widest italic transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/5"
                        >
                            <Sparkles size={14} />
                            Metamob
                        </a>
                        <div className="flex items-center gap-4">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500  animate-pulse" />
                            <span className="text-caption font-black text-white/30 uppercase tracking-widest italic">Analyseur de Zone v4.2 - SigilOS</span>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Swords, ShieldAlert, CheckCircle2, XCircle, ChevronDown, Loader2, MapPin, Ghost, Sparkles } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { getZoneMonsters, getBountiesForZone, searchDungeonsAdvanced } from '@/server/actions/game-data-actions';
import { getZoneArchmonsters } from '@/server/actions/ocre-actions';

interface ZoneDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    zoneName: string;
    position: { x: number; y: number; displayX: number; displayY: number };
    guildId: string;
}

export function ZoneDetailModal({ isOpen, onClose, zoneName, position, guildId }: ZoneDetailModalProps) {
    const [loading, setLoading] = useState(false);
    const [monsters, setMonsters] = useState<any>(null);
    const [archis, setArchis] = useState<any[]>([]);
    const [bounties, setBounties] = useState<any[]>([]);
    const [dungeons, setDungeons] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && zoneName) {
            setLoading(true);
            Promise.all([
                getZoneMonsters(zoneName),
                getZoneArchmonsters(guildId, zoneName),
                getBountiesForZone(zoneName),
                searchDungeonsAdvanced({ query: zoneName }) // Basic way to find dungeons in zone by name match
            ]).then(([mRes, aRes, bRes, dRes]) => {
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
                    setError(aRes.error || "Erreur inconnue");
                    setArchis([]);
                }
                setBounties(mergedAvis);
                if (dRes.success) setDungeons(dRes.data || []);
                setLoading(false);
            }).catch(() => {
                setError("Erreur de connexion");
                setLoading(false);
            });
        }
    }, [isOpen, zoneName, guildId]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent showCloseButton={false} className="w-[95vw] max-w-6xl bg-[#080a10]/98 backdrop-blur-3xl border border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.9)] rounded-[3rem] text-white p-0 overflow-hidden flex flex-col h-[85vh]">
                {/* Header */}
                <div className="relative h-44 bg-white/5 border-b border-white/5 shrink-0 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/10 via-transparent to-amber-500/10" />
                    <button 
                        onClick={onClose}
                        className="absolute top-8 right-8 p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white transition-all z-20"
                    >
                        <X size={24} />
                    </button>

                    <div className="absolute bottom-8 left-10 flex items-end gap-8 z-10">
                        <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/20 shadow-inner">
                            <MapPin size={28} className="text-emerald-500" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-500 text-[10px] font-black uppercase tracking-widest italic shadow-lg shadow-emerald-500/10">
                                    GPS [{position.displayX}, {position.displayY}]
                                </span>
                            </div>
                            <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter leading-none drop-shadow-2xl">
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
                             <p className="text-[14px] font-black uppercase tracking-[0.5em] text-white italic">Analyse de la faune locale...</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-10 pt-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                                {/* Left Column: Archimonstres */}
                                <div className="space-y-8 min-w-0">
                                    <div className="flex items-center justify-between sticky top-0 bg-[#080a10] py-4 z-10 border-b border-white/5 mb-4">
                                        <h3 className="text-amber-500 text-lg font-black uppercase italic tracking-widest flex items-center gap-4">
                                            <Sparkles size={20} /> Archimonstres
                                        </h3>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">Capture :</span>
                                            <span className="text-[10px] font-black text-amber-500/80 uppercase tracking-widest bg-amber-500/5 px-3 py-1 rounded-full border border-amber-500/10 italic">
                                                {archis.filter(a => a.state !== 'MANQUANT').length} / {archis.length}
                                            </span>
                                        </div>
                                    </div>

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
                                                            <img src={archi.image} alt="" className="w-10 h-10 object-contain group-hover:scale-110 transition-transform duration-500" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`text-sm font-black truncate leading-tight mb-1 uppercase italic tracking-tight ${isMissing ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                                {archi.name}
                                                            </p>
                                                            <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.1em] italic line-clamp-2 leading-relaxed">
                                                                {archi.subzone || archi.zone || "Zone inconnue"}
                                                            </p>
                                                        </div>
                                                        <div className="shrink-0">
                                                            {isMissing ? (
                                                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500 text-white text-[10px] font-black uppercase italic shadow-lg shadow-rose-500/20">
                                                                    <XCircle size={12} /> Manquant
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase italic">
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
                                            <p className="text-[10px] font-black text-white/15 uppercase tracking-[0.3em] italic">
                                                {error === "Compte non lié" 
                                                    ? "Liez votre compte Metamob pour voir vos archimonstres"
                                                    : "Aucun archi-monstre détecté dans ce secteur"}
                                            </p>
                                            {error === "Compte non lié" && (
                                                <a 
                                                    href={`/dashboard/${guildId}/profile`}
                                                    className="mt-4 px-8 py-3 rounded-2xl bg-amber-500 text-black text-[11px] font-black uppercase italic shadow-2xl shadow-amber-500/40 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
                                                >
                                                    <Sparkles size={16} /> Lier mon compte Metamob
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Right Column: Avis & Monsters */}
                                <div className="space-y-12 min-w-0">
                                    {/* Avis de Recherche */}
                                    <section className="space-y-6">
                                        <div className="flex items-center justify-between sticky top-0 bg-[#080a10] py-4 z-10 border-b border-white/5 mb-4">
                                            <h3 className="text-rose-500 text-lg font-black uppercase italic tracking-widest flex items-center gap-4">
                                                <ShieldAlert size={20} /> Avis de Recherche
                                            </h3>
                                            <span className="text-[9px] font-black text-rose-500/40 uppercase tracking-[0.2em] italic">DofusDB</span>
                                        </div>
                                        
                                        {bounties.length > 0 ? (
                                            <div className="grid gap-3">
                                                {bounties.map((bounty) => (
                                                    <div key={bounty.id} className="group relative flex items-center gap-4 p-4 rounded-2xl bg-red-950/20 border border-red-500/20 hover:border-red-500/40 transition-all shadow-lg shadow-red-500/5">
                                                        <div className="w-12 h-12 rounded-xl bg-[#020408] border border-white/5 overflow-hidden flex items-center justify-center shrink-0">
                                                            <img src={bounty.imageUrl} alt="" className="w-10 h-10 object-contain group-hover:scale-110 transition-transform duration-500" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-black text-white truncate leading-none mb-1 uppercase italic tracking-tight">{bounty.name}</p>
                                                            <p className="text-[10px] font-bold text-red-500/60 uppercase tracking-[0.1em] italic">Niveau {bounty.level}</p>
                                                        </div>
                                                        <div className="shrink-0">
                                                            <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 text-white text-[10px] font-black uppercase italic shadow-md shadow-red-600/20 group-hover:scale-105 transition-transform">
                                                                Cible
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="py-12 rounded-[2rem] bg-white/[0.02] border border-dashed border-white/10 flex flex-col items-center gap-4">
                                                <ShieldAlert className="text-white/10" size={32} />
                                                <p className="text-[10px] font-black text-white/15 uppercase tracking-[0.3em] text-center italic">
                                                    Aucun avis de recherche identifié
                                                </p>
                                            </div>
                                        )}
                                    </section>
                                    
                                    {/* Donjons de la Zone */}
                                    {dungeons.length > 0 && (
                                        <section className="space-y-6">
                                            <div className="flex items-center justify-between sticky top-0 bg-[#080a10] py-4 z-10 border-b border-white/5 mb-4">
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
                                                                <img src={dj.imageUrl} alt="" className="w-10 h-10 object-contain group-hover:scale-110 transition-transform duration-500" />
                                                            ) : (
                                                                <Swords size={20} className="text-amber-500/40" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-black text-white truncate leading-none mb-1 uppercase italic tracking-tight">{dj.name}</p>
                                                            <p className="text-[10px] font-bold text-amber-500/60 uppercase tracking-[0.1em] italic">Niveau {dj.level}</p>
                                                        </div>
                                                        <div className="shrink-0 flex items-center gap-2">
                                                            <span className="text-[9px] font-black text-white/30 uppercase tracking-widest italic">{dj.bossName}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    )}

                                    {/* Bestiaire Standard */}
                                    {monsters?.normalMonsters?.length > 0 && (
                                        <section className="space-y-6">
                                            <h3 className="text-white/40 text-lg font-black uppercase italic tracking-widest flex items-center gap-4">
                                                <ChevronDown size={20} /> Faune Standard
                                            </h3>
                                            
                                            <div className="flex flex-wrap gap-2">
                                                {monsters.normalMonsters.map((m: any) => (
                                                    <div key={m.id} className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-[11px] font-black text-white/40 hover:text-white hover:bg-white/10 transition-all cursor-default uppercase italic tracking-tighter">
                                                        {m.name}
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-black/40 border-t border-white/5 flex items-center justify-between shrink-0 px-10">
                    <div className="flex items-center gap-4">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
                        <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] italic">Analyseur de Zone v4.2 - SigilOS</span>
                    </div>
                    <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest italic">
                        Sync: Metamob & DofusDB
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Copy, 
    Target, 
    Compass, 
    Trophy, 
    X, 
    HelpCircle,
    Info,
    ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MapHelpCardProps {
    onClose?: () => void;
}

export function MapHelpCard({ onClose }: MapHelpCardProps) {
    const [isVisible, setIsVisible] = useState(true);

    const handleClose = () => {
        setIsVisible(false);
        if (onClose) onClose();
    };

    const features = [
        {
            id: 'travel',
            title: 'Voyage Express',
            description: "Cliquez sur n'importe quelle case pour copier la commande /travel dans votre presse-papier.",
            icon: Copy,
            color: '#10b981', // Emerald
            bg: 'bg-emerald-500/10',
            border: 'border-emerald-500/20'
        },
        {
            id: 'archis',
            title: 'Chasse aux Archis',
            description: "Visualisez la liste des archimonstres présents dans chaque zone pour compléter votre Ocre.",
            icon: Target,
            color: '#a855f7', // Purple
            bg: 'bg-purple-500/10',
            border: 'border-purple-500/20'
        },
        {
            id: 'bounties',
            title: 'Avis de Recherche',
            description: "Identifiez les zones de spawn des recherchés célèbres directement sur votre itinéraire.",
            icon: Compass,
            color: '#06b6d4', // Cyan
            bg: 'bg-cyan-500/10',
            border: 'border-cyan-500/20'
        },
        {
            id: 'dungeons',
            title: 'Piliers de Donjons',
            description: "Consultez les donjons de la zone, leurs niveaux et les succès associés à débloquer.",
            icon: Trophy,
            color: '#f59e0b', // Amber
            bg: 'bg-amber-500/10',
            border: 'border-amber-500/20'
        }
    ];

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: -20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                    className="relative w-full max-w-7xl mx-auto mb-6 group"
                >
                    {/* Main Container */}
                    <div className="relative overflow-hidden rounded-[2rem] border border-white/5 bg-[#0d111a]/60 backdrop-blur-2xl p-6 md:p-8 shadow-2xl">
                        {/* Background Decorative Elements - Toned down */}
                        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/[0.02] rounded-full blur-[120px] pointer-events-none group-hover:bg-emerald-500/[0.04] transition-all duration-300" />
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/[0.02] rounded-full blur-[100px] pointer-events-none" />
                        
                        {/* Header Area */}
                        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8 lg:mb-10">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                                    <HelpCircle className="w-8 h-8" />
                                </div>
                                <div className="space-y-1">
                                    <h2 className="text-2xl md:text-3xl font-black text-white uppercase italic tracking-tighter leading-none">
                                        Guide de l'Explorateur
                                    </h2>
                                    <p className="text-zinc-400 text-sm font-medium">Découvrez tout le potentiel de la carte interactive.</p>
                                </div>
                            </div>

                            <button
                                onClick={handleClose}
                                className="absolute top-0 right-0 md:relative flex items-center justify-center w-10 h-10 rounded-full bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Features Grid */}
                        <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
                            {features.map((feature, i) => (
                                <motion.div
                                    key={feature.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 + 0.2 }}
                                    className="group/item relative p-6 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-white/10 transition-all cursor-default overflow-hidden"
                                >
                                    <div className={cn("absolute top-0 right-0 w-24 h-24 blur-3xl opacity-10 transition-opacity group-hover/item:opacity-20", feature.bg)} />
                                    
                                    <div className="relative space-y-4">
                                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center border transition-transform group-hover/item:scale-110 duration-300", feature.bg, feature.border)}>
                                            <feature.icon className="w-6 h-6" style={{ color: feature.color }} />
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <h3 className="text-sm font-black text-white uppercase italic tracking-tight flex items-center gap-2">
                                                {feature.title}
                                                <ChevronRight className="w-3 h-3 opacity-0 -translate-x-2 group-hover/item:opacity-100 group-hover/item:translate-x-0 transition-all" />
                                            </h3>
                                            <p className="text-caption leading-relaxed text-zinc-400 font-medium">
                                                {feature.description}
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* DofusDB Attribution Banner */}
                        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-3.5">
                                <div className="w-10 h-10 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center shrink-0 p-1.5">
                                    <img src="/assets/icons/dofusdb.png" alt="DofusDB Favicon" className="w-full h-full object-contain rounded-md" />
                                </div>
                                <div className="space-y-0.5 text-center sm:text-left">
                                    <div className="flex items-center gap-2 justify-center sm:justify-start">
                                        <span className="text-xs font-black text-white uppercase tracking-wider">Données Cartographiques & Jeu</span>
                                        <span className="px-1.5 py-0.5 rounded text-caption font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 uppercase">DofusDB</span>
                                    </div>
                                    <p className="text-caption text-zinc-400 font-medium">
                                        Données géographiques, monstres et objets issues de DofusDB. Utilisation soumise à la LPNC-IA 1.0.
                                    </p>
                                </div>
                            </div>
                            <a
                                href="https://dofusdb.fr/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 hover:text-emerald-300 text-xs font-bold uppercase tracking-wider transition-all shrink-0 flex items-center gap-2"
                            >
                                Visiter DofusDB ↗
                            </a>
                        </div>

                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

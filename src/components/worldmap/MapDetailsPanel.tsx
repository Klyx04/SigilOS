'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Maximize2, Minimize2, MapPin, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';

interface MapDetailsPanelProps {
    position: { x: number; y: number; displayX: number; displayY: number; mapId?: number };
    subAreaName?: string;
    onClose: () => void;
}

export default function MapDetailsPanel({ position, subAreaName, onClose }: MapDetailsPanelProps) {
    const [isMaximized, setIsMaximized] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    // HD Map URL
    const hdMapUrl = position.mapId ? `/game-data/hd_maps/${position.mapId}.webp` : null;

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.5, 4));
    const handleZoomOut = () => {
        setZoom(prev => {
            const next = Math.max(prev - 0.5, 1);
            if (next === 1) setPan({ x: 0, y: 0 });
            return next;
        });
    };
    const handleReset = () => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (e.deltaY < 0) handleZoomIn();
        else handleZoomOut();
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{
                    opacity: 0,
                    scale: 0.9,
                    right: '2rem',
                    bottom: '2rem',
                    top: 'auto',
                    left: 'auto'
                }}
                animate={{
                    opacity: 1,
                    scale: 1,
                    width: isMaximized ? '100%' : '380px',
                    height: isMaximized ? 'calc(100% - 64px)' : '480px',
                    left: isMaximized ? '0' : 'auto',
                    top: isMaximized ? '64px' : 'auto',
                    right: isMaximized ? '2rem' : '2rem', // Keep some margin even if auto handles it
                    bottom: isMaximized ? '0' : '2rem',
                    borderRadius: isMaximized ? '0px' : '2.5rem',
                }}
                exit={{ opacity: 0, scale: 0.9 }}
                drag={!isMaximized}
                dragMomentum={false}
                className={`absolute z-[1000] overflow-hidden bg-slate-950/95 backdrop-blur-3xl border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.8)] flex flex-col transition-[border-radius] duration-500 ease-out`}
            >
                {/* Header / Drag Handle */}
                <div className={`flex-shrink-0 flex items-center justify-between px-8 py-5 bg-white/5 border-b border-white/5 ${!isMaximized ? 'cursor-grab active:cursor-grabbing' : ''}`}>
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/20 shadow-inner">
                            <MapPin size={18} className="text-emerald-500" />
                        </div>
                        <div>
                            <h3 className="text-white font-black text-sm uppercase italic tracking-widest">Position Détails</h3>
                            <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em]">{subAreaName || 'Zone inconnue'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {isMaximized && (
                            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5 mr-2">
                                <button onClick={handleZoomOut} className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-all"><ZoomOut size={14} /></button>
                                <button onClick={handleReset} className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-all"><RefreshCw size={12} /></button>
                                <button onClick={handleZoomIn} className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-all"><ZoomIn size={14} /></button>
                            </div>
                        )}
                        <button
                            onClick={() => {
                                setIsMaximized(!isMaximized);
                                handleReset();
                            }}
                            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all border border-white/5"
                        >
                            {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-all border border-red-500/10"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col relative overflow-hidden" ref={containerRef}>
                    {/* Interaction Area / HD Preview */}
                    <div
                        className={`relative flex-1 bg-[#020408] overflow-hidden cursor-move`}
                        onWheel={isMaximized ? handleWheel : undefined}
                    >
                        {hdMapUrl ? (
                            <motion.div
                                animate={{ scale: zoom, x: pan.x, y: pan.y }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                drag={zoom > 1}
                                onDragEnd={(e, info) => setPan(prev => ({ x: prev.x + info.offset.x, y: prev.y + info.offset.y }))}
                                className="w-full h-full"
                            >
                                <img
                                    src={hdMapUrl}
                                    alt="HD Preview"
                                    className="w-full h-full object-contain pointer-events-none"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = '/game-data/tiles/w1/1/1.webp';
                                    }}
                                />
                            </motion.div>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <span className="text-white/10 font-black uppercase text-xs italic tracking-widest">Aperçu indisponible</span>
                            </div>
                        )}

                        {/* Overlay Gradient */}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-60 pointer-events-none" />

                        {/* Coordinates Badge */}
                        <div className="absolute bottom-6 left-8 flex items-center gap-3 pointer-events-none">
                            <div className="px-5 py-2.5 rounded-2xl bg-black/60 backdrop-blur-2xl border border-white/10 text-emerald-400 font-mono text-sm font-black shadow-2xl">
                                [{position.displayX}, {position.displayY}]
                            </div>
                            <div className="px-5 py-2.5 rounded-2xl bg-black/60 backdrop-blur-2xl border border-white/10 text-white/40 font-mono text-xs shadow-2xl">
                                ID: {position.mapId || '???'}
                            </div>
                        </div>

                        {/* Zoom Indicator */}
                        {zoom > 1 && (
                            <div className="absolute bottom-6 right-8 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-black text-[10px] uppercase italic backdrop-blur-xl">
                                Zoom x{zoom.toFixed(1)}
                            </div>
                        )}
                    </div>

                    {/* Quick Infos Bottom Bar */}
                    <div className="flex-shrink-0 grid grid-cols-2 gap-px bg-white/5 border-t border-white/5">
                        <div className="p-8 flex flex-col gap-2 bg-slate-950/50">
                            <span className="text-white/20 text-[9px] font-black uppercase tracking-[0.3em]">Type d'Environnement</span>
                            <span className="text-white text-xs font-black uppercase italic tracking-tighter">Carte du Monde</span>
                        </div>
                        <div className="p-8 flex flex-col gap-2 bg-slate-950/50">
                            <span className="text-white/20 text-[9px] font-black uppercase tracking-[0.3em]">Mode Visualisation</span>
                            <span className="text-emerald-400 text-xs font-black uppercase italic tracking-tighter">{isMaximized ? 'Analyse HD' : 'Mode Fenêtré'}</span>
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

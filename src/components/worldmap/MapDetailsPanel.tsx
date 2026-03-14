'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Maximize2, Minimize2, MapPin, ZoomIn, ZoomOut, RefreshCw, Sparkles, Swords } from 'lucide-react';

interface MapDetailsPanelProps {
    position: { x: number; y: number; displayX: number; displayY: number; mapId?: number };
    subAreaName?: string;
    guildId: string;
    onClose: () => void;
    onOpenZoneDetails?: () => void;
}

export default function MapDetailsPanel({ position, subAreaName, guildId, onClose, onOpenZoneDetails }: MapDetailsPanelProps) {
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
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{
                    opacity: 1,
                    scale: 1,
                    y: 0,
                    width: isMaximized ? '100%' : 'min(360px, calc(100vw - 2rem))',
                    height: isMaximized ? 'calc(100% - 64px)' : 'min(400px, calc(100vh - 8rem))',
                    left: isMaximized ? '0' : 'auto',
                    top: isMaximized ? '64px' : 'auto',
                    right: isMaximized ? '2rem' : '1rem', 
                    bottom: isMaximized ? '0' : '2rem',
                    borderRadius: isMaximized ? '0px' : '1rem',
                }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                drag={!isMaximized}
                dragMomentum={false}
                className="absolute z-[1000] overflow-hidden bg-[#080b12]/95 backdrop-blur-3xl border border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.9)] flex flex-col transition-[border-radius] duration-500 ease-out"
            >
                {/* Header */}
                <div className="p-4 flex items-center justify-between border-b border-white/5 shrink-0 bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-inner shrink-0">
                            <MapPin size={20} />
                        </div>
                        <div className="min-w-0 pr-2">
                            <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30 mb-0.5 truncate">Tactical</h3>
                            <h2 className="text-sm font-black text-white uppercase italic tracking-tighter leading-tight truncate">
                                {subAreaName || "Zone Inconnue"}
                            </h2>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => {
                                setIsMaximized(!isMaximized);
                                handleReset();
                            }}
                            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 transition-all hover:scale-105 active:scale-95 shadow-xl"
                        >
                            {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl bg-rose-500 text-white shadow-lg shadow-rose-500/20 hover:scale-105 active:scale-95 transition-all"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-hidden relative flex flex-col bg-[#020408]">
                    <div
                        className="w-full h-full relative cursor-move"
                        ref={containerRef}
                        onWheel={isMaximized ? handleWheel : undefined}
                    >
                        {hdMapUrl ? (
                            <motion.div
                                animate={{ scale: zoom, x: pan.x, y: pan.y }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                drag={zoom > 1}
                                onDragEnd={(e, info) => setPan(prev => ({ x: prev.x + info.offset.x, y: prev.y + info.offset.y }))}
                                className="w-full h-full flex items-center justify-center"
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
                            <div className="w-full h-full flex flex-col items-center justify-center gap-4 opacity-20">
                                <Swords size={48} className="text-white" />
                                <span className="text-white font-black uppercase text-[10px] italic tracking-widest text-center leading-loose">
                                    Visualisation Satellite<br/>indisponible
                                </span>
                            </div>
                        )}

                        {/* Top Action Overlay */}
                        <div className="absolute top-4 left-4 right-4 flex items-center justify-center pointer-events-none">
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenZoneDetails?.();
                                }}
                                className="pointer-events-auto px-4 py-2 rounded-xl bg-amber-500 text-black font-black text-[10px] uppercase italic shadow-[0_15px_40px_rgba(245,158,11,0.4)] flex items-center gap-2 hover:scale-105 hover:bg-amber-400 active:scale-95 transition-all group"
                            >
                                <Sparkles size={14} className="group-hover:rotate-12 transition-transform" /> 
                                Analyser zone
                            </button>
                        </div>

                        {/* Visual Gradients */}
                        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950/90 to-transparent pointer-events-none" />

                        {/* Bottom Info Overlay */}
                        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between pointer-events-none">
                            <div className="px-3 py-2 rounded-xl bg-black/80 backdrop-blur-2xl border border-white/10 text-emerald-400 font-mono text-xs font-black shadow-2xl flex items-center gap-2 max-w-[60%]">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,1)] animate-pulse shrink-0" />
                                <span className="truncate">[{position.displayX}, {position.displayY}]</span>
                            </div>
                            
                            {zoom > 1 && (
                                <button 
                                    onClick={handleReset}
                                    className="pointer-events-auto p-2 rounded-xl bg-white/10 backdrop-blur-xl border border-white/10 text-white/60 hover:text-white transition-all shadow-xl shrink-0"
                                >
                                    <RefreshCw size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Mini Footer Stats */}
                <div className="p-3 px-4 bg-black/50 border-t border-white/5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3 opacity-30">
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
                            <span className="text-[8px] font-black uppercase tracking-widest">Live Sync</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
                            <span className="text-[8px] font-black uppercase tracking-widest">{isMaximized ? 'Focus Mode' : 'Preview'}</span>
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

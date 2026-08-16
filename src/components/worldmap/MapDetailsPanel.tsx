'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { X, Maximize2, Minimize2, MapPin, RefreshCw, Swords, Plus, Minus, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';



interface MapDetailsPanelProps {
    position: { x: number; y: number; displayX: number; displayY: number; mapId?: number };
    allLayers?: any[];
    subAreaName?: string;
    guildId: string;
    onClose: () => void;
    onOpenZoneDetails?: () => void;
    onSelectMap?: (map: any) => void;
}

export default function MapDetailsPanel({ 
    position, 
    allLayers = [], 
    subAreaName, 
    guildId, 
    onClose, 
    onOpenZoneDetails,
    onSelectMap
}: MapDetailsPanelProps) {
    const [isMaximized, setIsMaximized] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const dragControls = useDragControls();



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
            {/* Backdrop for maximized mode */}
            {isMaximized && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[4999]"
                />
            )}

            <motion.div
                initial={{ 
                    opacity: 0, 
                    scale: 0.9, 
                    x: isMaximized ? '-50%' : 20, 
                    y: isMaximized ? '-50%' : 0,
                    left: isMaximized ? '50%' : 'auto',
                    right: isMaximized ? 'auto' : '2rem',
                    top: isMaximized ? '50%' : 'auto',
                    bottom: isMaximized ? 'auto' : '2rem',
                }}
                animate={{
                    opacity: 1,
                    scale: 1,
                    width: isMaximized ? 'min(1400px, 95vw)' : 'min(440px, 95vw)',
                    height: isMaximized ? 'min(900px, 90vh)' : 'min(500px, calc(100vh - 100px))',
                    left: isMaximized ? '50%' : 'auto',
                    top: isMaximized ? '50%' : 'auto',
                    x: isMaximized ? '-50%' : 0,
                    y: isMaximized ? '-50%' : 0,
                    right: isMaximized ? 'auto' : '2rem', 
                    bottom: isMaximized ? 'auto' : '2rem',
                    borderRadius: isMaximized ? '2.5rem' : '2rem',
                }}
                transition={{
                    type: 'spring',
                    damping: 25,
                    stiffness: 200,
                    mass: 0.8
                }}
                exit={{ opacity: 0, scale: 0.9 }}
                drag
                dragControls={dragControls}
                dragListener={false}
                dragMomentum={false}
                className={cn(
                    "overflow-hidden bg-[#020408]/95 backdrop-blur-3xl border border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.9)] flex flex-col",
                    isMaximized ? "fixed z-[5000] border-white/20" : "absolute z-[1000]"
                )}
            >
                {/* ─── HEADER ─── */}
                <div 
                    onPointerDown={(e) => dragControls.start(e)}
                    className={cn(
                        "flex border-b border-white/5 shrink-0 transition-all cursor-grab active:cursor-grabbing select-none relative z-[100]",
                        isMaximized ? "items-center bg-white/5 px-10 py-6 gap-6" : "flex-col bg-white/5 p-4 gap-4"
                    )}
                >
                    <div className="flex items-center justify-between w-full min-w-0 gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className={cn(
                                "rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-inner shrink-0 transition-all",
                                isMaximized ? "w-12 h-12" : "w-10 h-10"
                            )}>
                                <MapPin size={isMaximized ? 24 : 20} />
                            </div>
                            <div className="min-w-0 pr-2">
                                <h3 className="text-caption font-black uppercase tracking-widest text-white/30 mb-1 truncate">Renseignement Satellite</h3>
                                <h2 className={cn(
                                    "font-black text-white uppercase italic tracking-tighter leading-tight truncate transition-all",
                                    isMaximized ? "text-xl" : "text-sm"
                                )}>
                                    {subAreaName || "Zone Inconnue"}
                                </h2>
                            </div>
                            {isMaximized && (
                                <div className="ml-4 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 shrink-0">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-caption font-black text-emerald-400 italic tracking-widest">
                                        [ {position.x}, {position.y} ]
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Top-Right Area */}
                        <div className="flex items-center gap-4 shrink-0">


                            {/* Layer Switcher (Visible on the same line ONLY if maximized) */}
                            {isMaximized && allLayers.length > 1 && (
                                <div 
                                    className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-black/40 border border-white/10" 
                                    onPointerDown={(e) => e.stopPropagation()}
                                >
                                    {allLayers.sort((a, b) => (a.altitude || 0) - (b.altitude || 0)).map((layer) => {
                                        const isActive = position.mapId === layer.id;
                                        const label = (layer.altitude ?? 0) === 0 ? "Sol" : (layer.altitude ?? 0) === 1 ? "Air" : `Z${layer.altitude}`;
                                        return (
                                            <button
                                                key={layer.id}
                                                onClick={(e) => { e.stopPropagation(); onSelectMap?.(layer); }}
                                                className={cn(
                                                    "h-8 px-4 rounded-xl flex items-center justify-center transition-all border text-caption font-black uppercase italic cursor-pointer whitespace-nowrap",
                                                    isActive 
                                                        ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg' 
                                                        : 'bg-transparent text-white/40 border-transparent hover:bg-white/10 hover:text-white'
                                                )}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            <div className={cn("flex items-center gap-2", isMaximized && "border-l border-white/5 pl-4")}>
                                <button
                                    onPointerDown={e => e.stopPropagation()}
                                    onClick={() => {
                                        setIsMaximized(!isMaximized);
                                        handleReset();
                                    }}
                                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 transition-all  active:scale-95 shadow-xl"
                                >
                                    {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                                </button>
                                <button
                                    onPointerDown={e => e.stopPropagation()}
                                    onClick={onClose}
                                    className="p-2.5 rounded-xl bg-rose-500 text-white shadow-lg shadow-rose-500/20  active:scale-95 transition-all"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Area: Layer Switcher (small mode) */}
                    {!isMaximized && allLayers.length > 1 && (
                        <div className="flex items-center gap-2 w-full overflow-x-auto no-scrollbar" onPointerDown={e => e.stopPropagation()}>
                            {/* Layer Switcher */}
                            <div className="flex items-center gap-1 p-1 rounded-2xl bg-black/40 border border-white/10 overflow-x-auto no-scrollbar">
                                {allLayers.sort((a, b) => (a.altitude || 0) - (b.altitude || 0)).map((layer) => {
                                    const isActive = position.mapId === layer.id;
                                    const label = (layer.altitude ?? 0) === 0 ? "Sol" : (layer.altitude ?? 0) === 1 ? "Air" : `Z${layer.altitude}`;
                                    return (
                                        <button
                                            key={layer.id}
                                            onClick={(e) => { e.stopPropagation(); onSelectMap?.(layer); }}
                                            className={cn(
                                                "h-7 px-3 rounded-lg flex items-center justify-center transition-all border text-caption font-black uppercase italic cursor-pointer whitespace-nowrap",
                                                isActive 
                                                    ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg' 
                                                    : 'bg-transparent text-white/40 border-transparent hover:bg-white/10 hover:text-white'
                                            )}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* ─── MAP VIEWPORT (THE CONTENT) ─── */}
                <div className="flex-1 relative bg-[#020408] overflow-hidden min-h-[300px] z-10">
                        <div
                            className="absolute inset-0 cursor-move"
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
                                        className={cn(
                                            "max-w-full max-h-full object-contain pointer-events-none transition-all duration-300",
                                            isMaximized && "shadow-2xl ring-1 ring-white/5"
                                        )}
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = '/game-data/tiles/w1/1/1.webp';
                                        }}
                                    />
                                </motion.div>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center gap-4 opacity-20">
                                    <Swords size={48} className="text-white" />
                                    <span className="text-white font-black uppercase text-caption italic tracking-widest text-center leading-loose">
                                        Visualisation Satellite<br/>indisponible
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Gradient shadow for bottom readability */}
                        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none z-[20]" />

                        {/* Left Toolbar (Zoom) */}
                        {hdMapUrl && (
                            <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-[30]">
                                <button 
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}
                                    className="w-12 h-12 rounded-2xl bg-slate-950 border border-white/20 text-white flex items-center justify-center shadow-2xl  active:scale-90 transition-all cursor-pointer"
                                >
                                    <Plus size={20} />
                                </button>
                                <button 
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}
                                    className="w-12 h-12 rounded-2xl bg-slate-950 border border-white/20 text-white flex items-center justify-center shadow-2xl  active:scale-90 transition-all cursor-pointer"
                                >
                                    <Minus size={20} />
                                </button>
                            </div>
                        )}
                </div>

                {/* ─── OVERLAYS DESKTOP / TOP-LEVEL (Outside Main Content for perfect Z-index) ─── */}
                


                {/* Bottom Action Area (Always visible, highest Z) */}
                <div className={cn(
                    "absolute left-8 right-8 flex items-center justify-between pointer-events-none z-[2000] transition-all",
                    isMaximized ? "bottom-12" : "bottom-14"
                )}>
                    <div className="flex items-center gap-3 pointer-events-auto">
                        <div className="px-5 py-3 rounded-2xl bg-black border border-white/20 text-emerald-400 font-mono text-sm font-black shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center gap-3">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse " />
                            <span className="tracking-tight">[{position.displayX}, {position.displayY}]</span>
                        </div>
                        
                        <button 
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onOpenZoneDetails?.();
                            }}
                            className="px-10 py-3 rounded-2xl bg-amber-500 text-black font-black text-xs uppercase italic shadow-[0_20px_50px_rgba(245,158,11,0.3)]  active:scale-95 transition-all flex items-center gap-2 cursor-pointer relative z-10"
                        >
                            <Layers size={16} /> 
                            Analyser
                        </button>
                    </div>

                    {zoom > 1 && (
                        <button 
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); handleReset(); }}
                            className="pointer-events-auto w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 text-white flex items-center justify-center shadow-2xl transition-all cursor-pointer hover:bg-white/20"
                        >
                            <RefreshCw size={18} />
                        </button>
                    )}
                </div>

                {/* ─── FOOTER ─── */}
                {!isMaximized && (
                    <div className="h-10 px-8 bg-black/80 border-t border-white/5 flex items-center shrink-0">
                        <div className="flex items-center gap-4 opacity-20">
                            <div className="flex items-center gap-2">
                                <div className="w-1 h-1 rounded-full bg-white" />
                                <span className="text-caption font-black uppercase tracking-widest">Live Feed</span>
                            </div>
                        </div>
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    );
}

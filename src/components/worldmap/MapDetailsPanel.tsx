'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { X, Maximize2, Minimize2, MapPin, ZoomIn, ZoomOut, RefreshCw, Sparkles, Swords, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getQuestsAndGuidesByPosition } from '@/server/actions/game-data-actions';


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

    // Quest and Guide Integration
    const [activeTab, setActiveTab] = useState<'map' | 'quests'>('map');
    const [quests, setQuests] = useState<any[]>([]);
    const [guides, setGuides] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchQuestsAndGuides = async () => {
            setIsLoading(true);
            try {
                const res = await getQuestsAndGuidesByPosition(position.x, position.y);
                if (res.success && res.data) {
                    setQuests(res.data.quests || []);
                    setGuides(res.data.guides || []);
                } else {
                    setQuests([]);
                    setGuides([]);
                }
            } catch (err) {
                console.error("Error fetching quests/guides for position:", err);
                setQuests([]);
                setGuides([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchQuestsAndGuides();
        // Reset tab to map when coordinate changes
        setActiveTab('map');
    }, [position.x, position.y]);

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
                                <h3 className="text-[9px] font-black uppercase tracking-[0.4em] text-white/30 mb-1 truncate">Renseignement Satellite</h3>
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
                                    <span className="text-[10px] font-black text-emerald-400 italic tracking-widest">
                                        [ {position.x}, {position.y} ]
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Top-Right Area */}
                        <div className="flex items-center gap-4 shrink-0">
                            {/* Tab Switcher (Maximized) */}
                            {isMaximized && (
                                <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-black/40 border border-white/10 shrink-0 pointer-events-auto" onPointerDown={e => e.stopPropagation()}>
                                    <button
                                        onClick={() => setActiveTab('map')}
                                        className={cn(
                                            "h-8 px-4 rounded-xl flex items-center gap-2 transition-all border text-[10px] font-black uppercase italic cursor-pointer whitespace-nowrap",
                                            activeTab === 'map'
                                                ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20'
                                                : 'bg-transparent text-white/40 border-transparent hover:bg-white/5 hover:text-white'
                                        )}
                                    >
                                        🛰️ Satellite
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('quests')}
                                        className={cn(
                                            "h-8 px-4 rounded-xl flex items-center gap-2 transition-all border text-[10px] font-black uppercase italic cursor-pointer whitespace-nowrap relative",
                                            activeTab === 'quests'
                                                ? 'bg-amber-500 border-amber-400 text-black shadow-lg shadow-amber-500/20'
                                                : 'bg-transparent text-white/40 border-transparent hover:bg-white/5 hover:text-white'
                                        )}
                                    >
                                        📜 Quêtes & Guides
                                        {(quests.length > 0 || guides.length > 0) && (
                                            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_10px_#f59e0b]" />
                                        )}
                                    </button>
                                </div>
                            )}

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
                                                    "h-8 px-4 rounded-xl flex items-center justify-center transition-all border text-[10px] font-black uppercase italic cursor-pointer whitespace-nowrap",
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
                                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 transition-all hover:scale-105 active:scale-95 shadow-xl"
                                >
                                    {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                                </button>
                                <button
                                    onPointerDown={e => e.stopPropagation()}
                                    onClick={onClose}
                                    className="p-2.5 rounded-xl bg-rose-500 text-white shadow-lg shadow-rose-500/20 hover:scale-105 active:scale-95 transition-all"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Area: If small, show Tab Switcher and Layer Switcher on a second row */}
                    {!isMaximized && (
                        <div className="flex items-center gap-2 w-full overflow-x-auto no-scrollbar" onPointerDown={e => e.stopPropagation()}>
                            {/* Tab Switcher */}
                            <div className="flex items-center gap-1 p-1 rounded-2xl bg-black/40 border border-white/10 shrink-0">
                                <button
                                    onClick={() => setActiveTab('map')}
                                    className={cn(
                                        "h-7 px-3 rounded-lg flex items-center gap-1.5 transition-all text-[9px] font-black uppercase italic cursor-pointer whitespace-nowrap",
                                        activeTab === 'map'
                                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                            : 'bg-transparent text-white/40 hover:bg-white/5 hover:text-white'
                                    )}
                                >
                                    🛰️ Satellite
                                </button>
                                <button
                                    onClick={() => setActiveTab('quests')}
                                    className={cn(
                                        "h-7 px-3 rounded-lg flex items-center gap-1.5 transition-all text-[9px] font-black uppercase italic cursor-pointer whitespace-nowrap relative",
                                        activeTab === 'quests'
                                            ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                                            : 'bg-transparent text-white/40 hover:bg-white/5 hover:text-white'
                                    )}
                                >
                                    📜 Quêtes
                                    {(quests.length > 0 || guides.length > 0) && (
                                        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_#f59e0b]" />
                                    )}
                                </button>
                            </div>
                            
                            {/* Layer Switcher */}
                            {allLayers.length > 1 && (
                                <div className="flex items-center gap-1 p-1 rounded-2xl bg-black/40 border border-white/10 overflow-x-auto no-scrollbar">
                                    {allLayers.sort((a, b) => (a.altitude || 0) - (b.altitude || 0)).map((layer) => {
                                        const isActive = position.mapId === layer.id;
                                        const label = (layer.altitude ?? 0) === 0 ? "Sol" : (layer.altitude ?? 0) === 1 ? "Air" : `Z${layer.altitude}`;
                                        return (
                                            <button
                                                key={layer.id}
                                                onClick={(e) => { e.stopPropagation(); onSelectMap?.(layer); }}
                                                className={cn(
                                                    "h-7 px-3 rounded-lg flex items-center justify-center transition-all border text-[9px] font-black uppercase italic cursor-pointer whitespace-nowrap",
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
                        </div>
                    )}
                </div>

                {/* ─── MAP VIEWPORT (THE CONTENT) ─── */}
                {activeTab === 'map' ? (
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
                                            "max-w-full max-h-full object-contain pointer-events-none transition-all duration-700",
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
                                    <span className="text-white font-black uppercase text-[10px] italic tracking-widest text-center leading-loose">
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
                                    className="w-12 h-12 rounded-2xl bg-slate-950 border border-white/20 text-white flex items-center justify-center shadow-2xl hover:scale-110 active:scale-90 transition-all cursor-pointer"
                                >
                                    <Plus size={20} />
                                </button>
                                <button 
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}
                                    className="w-12 h-12 rounded-2xl bg-slate-950 border border-white/20 text-white flex items-center justify-center shadow-2xl hover:scale-110 active:scale-90 transition-all cursor-pointer"
                                >
                                    <Minus size={20} />
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    /* ─── QUESTS & GUIDES TAB CONTENT ─── */
                    <div className="flex-1 relative bg-[#020408] overflow-y-auto p-8 z-10 flex flex-col gap-6 select-none pointer-events-auto" onPointerDown={e => e.stopPropagation()}>
                        {isLoading ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20">
                                <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/40 italic">
                                    Chargement des renseignements...
                                </span>
                            </div>
                        ) : quests.length === 0 && guides.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20 opacity-30">
                                <Sparkles size={48} className="text-white" />
                                <span className="text-white font-black uppercase text-[10px] italic tracking-widest text-center leading-loose">
                                    Aucune quête ou guide<br/>référencé à cette position
                                </span>
                            </div>
                        ) : (
                            <div className="space-y-6 max-h-full pb-16 overflow-y-auto pr-2 no-scrollbar">
                                {/* GUIDES SECTION */}
                                {guides.length > 0 && (
                                    <div className="space-y-4">
                                        <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-amber-400 italic">
                                            🧭 Guides de Progression Associés
                                        </h4>
                                        <div className="grid gap-3">
                                            {guides.map((g: any) => (
                                                <div 
                                                    key={g.id} 
                                                    className="group p-5 rounded-2xl bg-amber-500/5 border border-amber-500/10 hover:border-amber-500/30 transition-all flex flex-col gap-3 relative overflow-hidden"
                                                >
                                                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all pointer-events-none" />
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                                <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[9px] font-black text-amber-400 uppercase tracking-widest italic">
                                                                    {g.subGuideRef}
                                                                </span>
                                                                <span className="text-[9px] text-white/30 font-black uppercase tracking-wider">
                                                                    {g.guideName || "Guide"}
                                                                </span>
                                                            </div>
                                                            <h3 className="text-sm font-black text-white uppercase italic tracking-tight group-hover:text-amber-300 transition-colors">
                                                                {g.subGuideName}
                                                            </h3>
                                                            {g.milestoneTitle && (
                                                                <p className="text-[10px] text-white/50 italic mt-1 font-medium">
                                                                    Milestone: <span className="text-white font-bold">{g.milestoneTitle}</span> {g.milestoneSubtitle && `(${g.milestoneSubtitle})`}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Steps Range */}
                                                    {(g.stepFrom !== null || g.stepTo !== null) && (
                                                        <div className="text-[10px] font-black text-amber-400/80 italic flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-xl w-fit">
                                                            <span>Étap{g.stepFrom === g.stepTo ? "e" : "es"} :</span>
                                                            <span className="text-white">
                                                                {g.stepFrom !== null ? g.stepFrom : "Début"}
                                                                {g.stepFrom !== g.stepTo && ` à ${g.stepTo !== null ? g.stepTo : "Fin"}`}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Custom Warning Note */}
                                                    {g.note && (
                                                        <div className="mt-1 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300 italic font-medium leading-relaxed flex gap-2">
                                                            <span className="shrink-0 text-xs">⚠️</span>
                                                            <p className="flex-1">{g.note}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* QUESTS SECTION */}
                                {quests.length > 0 && (
                                    <div className="space-y-4">
                                        <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-400 italic">
                                            📜 Quêtes Dofus à cette position
                                        </h4>
                                        <div className="grid gap-3">
                                            {quests.map((q: any) => (
                                                <div 
                                                    key={q.id} 
                                                    className="group flex items-center gap-4 p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 hover:border-indigo-500/30 transition-all"
                                                >
                                                    {q.chain?.dofus?.imageUrl && (
                                                        <img 
                                                            src={
                                                                (q.chain.dofus.imageUrl.length < 5 || q.chain.dofus.imageUrl.includes('❄')) 
                                                                    ? (q.chain.dofus.name.toLowerCase().includes('glace') ? 'https://static.dofusdb.fr/items/11756.png' : q.chain.dofus.imageUrl)
                                                                    : q.chain.dofus.imageUrl
                                                            } 
                                                            alt="" 
                                                            className="w-10 h-10 object-contain shrink-0 transition-transform group-hover:scale-110 duration-300" 
                                                        />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-black text-white truncate uppercase italic tracking-tight group-hover:text-indigo-300 transition-colors">
                                                            {q.name}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                            {q.chain?.dofus && (
                                                                <span 
                                                                    className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest italic border" 
                                                                    style={{ 
                                                                        color: q.chain.dofus.color || '#6366f1', 
                                                                        borderColor: `${q.chain.dofus.color || '#6366f1'}40`, 
                                                                        background: `${q.chain.dofus.color || '#6366f1'}10` 
                                                                    }}
                                                                >
                                                                    {q.chain.dofus.nameShort}
                                                                </span>
                                                            )}
                                                            {q.chain?.sectionName && (
                                                                <span className="text-[9px] text-white/30 italic">
                                                                    {q.chain.sectionName}
                                                                </span>
                                                            )}
                                                            {q.npcSubArea && (
                                                                <span className="text-[10px] text-indigo-400/60 italic">
                                                                    · {q.npcSubArea}
                                                                </span>
                                                            )}
                                                            {q.isDungeon && (
                                                                <span className="px-2 py-0.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[9px] font-black text-rose-500 uppercase tracking-widest italic">
                                                                    Donjon
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ─── OVERLAYS DESKTOP / TOP-LEVEL (Outside Main Content for perfect Z-index) ─── */}
                


                {/* Bottom Action Area (Always visible, highest Z) */}
                <div className={cn(
                    "absolute left-8 right-8 flex items-center justify-between pointer-events-none z-[2000] transition-all",
                    isMaximized ? "bottom-12" : "bottom-14"
                )}>
                    <div className="flex items-center gap-3 pointer-events-auto">
                        <div className="px-5 py-3 rounded-2xl bg-black border border-white/20 text-emerald-400 font-mono text-sm font-black shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center gap-3">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_#10b981]" />
                            <span className="tracking-tight">[{position.displayX}, {position.displayY}]</span>
                        </div>
                        
                        <button 
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onOpenZoneDetails?.();
                            }}
                            className="px-10 py-3 rounded-2xl bg-amber-500 text-black font-black text-xs uppercase italic shadow-[0_20px_50px_rgba(245,158,11,0.3)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer relative z-10"
                        >
                            <Sparkles size={16} /> 
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
                                <span className="text-[7px] font-black uppercase tracking-[0.3em]">Live Feed</span>
                            </div>
                        </div>
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    );
}

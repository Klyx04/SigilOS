"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { 
    RotateCcw,
    Gem, 
    Check, 
    Play, 
    Zap,
    Lock,
    ChevronDown,
    MapPin,
    ExternalLink,
    BookOpen,
    Users,
    Plus,
    Minus,
    Map as MapIcon,
    ArrowRight,
    Navigation,
    CircleDashed,
    Target,
    ListChecks,
    Package
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MemberOnQuest } from "@/server/actions/dofus-quest-actions";
import { DofusIcon } from "./DofusIcon";
import { Badge } from "@/components/ui/badge";
import { 
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import Image from "next/image";
import { NpcName, ParsedObjective, MapLink, ItemInline, copyWithToast, detectRealDungeons, filterQuestItemsFromResources, extractObjectiveText } from "./dofus-resolvers";

// ─── Robust Image Failover ────────────────────────────────────────────────
function SafeImage({ src, fallback, alt, className, width, height }: { src: string; fallback: string; alt: string; className?: string; width?: number; height?: number }) {
    const [imgSrc, setImgSrc] = useState(src);
    const [failedTwice, setFailedTwice] = useState(false);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => { 
        setImgSrc(src); 
        setFailedTwice(false); 
        setLoaded(false); 
    }, [src]);
    
    if (failedTwice) {
        return (
            <div className={`bg-white/5 border border-white/10 rounded overflow-hidden flex flex-col items-center justify-center text-white/30 text-[8px] italic shadow-inner ${className}`} style={{ width: width || '100%', height: height || '100%' }}>
                <CircleDashed className="w-1/2 h-1/2 opacity-20 mb-1" />
                N/A
            </div>
        );
    }

    return (
        <img 
            src={imgSrc} 
            alt={alt} 
            className={cn(className, "transition-opacity duration-300", !loaded ? "opacity-0" : "opacity-100")} 
            width={width} 
            height={height} 
            onLoad={() => setLoaded(true)}
            onError={() => { 
                if (imgSrc !== fallback) {
                    setImgSrc(fallback);
                    setLoaded(false);
                } else {
                    setFailedTwice(true);
                }
            }} 
        />
    );
}

// ─── Achievement Icon Resolver ──────────────────────────────────────────────
function AchievementIcon({ name, size = 64, className = "" }: { name?: string; size?: number; className?: string }) {
    const iconId = useMemo(() => {
        if (!name) return 1;
        const n = name.toLowerCase();
        if (n.includes("poussé par le vent")) return 1568;
        if (n.includes("voyage au bout de l'enfer")) return 1569;
        if (n.includes("en route")) return 1567;
        return 1;
    }, [name]);

    return (
        <div className={`relative ${className}`} style={{ width: size, height: size }}>
            <SafeImage 
                src={`https://static.ankama.com/dofus/www/game/achievements/${iconId}.png`}
                fallback={`https://api.dofusdb.fr/img/achievements/${iconId}.png`}
                alt={name || "Achievement"}
                width={size}
                height={size}
                className="object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all duration-700"
            />
        </div>
    );
}

// ─── Particle Lore Field ───────────────────────────────────────────────────
function LoreParticles({ color }: { color: string }) {
    const [particles, setParticles] = useState<any[]>([]);

    useEffect(() => {
        setParticles(Array.from({ length: 60 }).map((_, i) => ({
            id: i,
            x: Math.random() * 100,
            y: Math.random() * 100,
            size: Math.random() * 5 + 3,
            duration: Math.random() * 6 + 3,
            delay: Math.random() * 5,
            animateX1: Math.random() * 20 - 10,
            animateX2: Math.random() * 40 - 20
        })));
    }, []);

    if (particles.length === 0) return null;

    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-60">
            {particles.map((p) => (
                <motion.div
                    key={p.id}
                    className="absolute rounded-full"
                    style={{ 
                        backgroundColor: color, 
                        width: p.size, 
                        height: p.size,
                        left: `${p.x}%`,
                        top: `${p.y}%`,
                        boxShadow: `0 0 30px ${color}, 0 0 60px ${color}66`,
                        filter: "blur(2px)"
                    }}
                    animate={{
                        y: [0, -100, -200],
                        opacity: [0, 0.8, 0],
                        x: [0, p.animateX1, p.animateX2]
                    }}
                    transition={{
                        duration: p.duration,
                        repeat: Infinity,
                        delay: p.delay,
                        ease: "linear"
                    }}
                />
            ))}
        </div>
    );
}

interface DofusNeuralTreeProps {
    guildId: string;
    dofus: any;
    chains: any[];
    synergy: Record<string, MemberOnQuest[]>;
    dofusColor: string;
    onToggleStatus: (questId: string, status: any) => void;
}

export function DofusNeuralTree({ 
    guildId,
    dofus, 
    chains, 
    synergy, 
    dofusColor,
    onToggleStatus 
}: DofusNeuralTreeProps) {
    const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);
    const [expandedChainId, setExpandedChainId] = useState<string | null>(null);
    const [showResources, setShowResources] = useState(false);
    
    // Global filtered resources
    const [filteredGlobalItems, setFilteredGlobalItems] = useState<{ id: number; name: string; amount: number; img: string | null }[]>([]);
    const [isLoadingGlobalItems, setIsLoadingGlobalItems] = useState(true);
    
    const transformRef = useRef<ReactZoomPanPinchRef>(null);

    // Ultra robust coordinate-based centering
    useEffect(() => {
        if (!transformRef.current) return;
        const centerOnCoords = () => {
            // Give it 100ms to ensure SVG is fully in DOM before zooming
            setTimeout(() => {
                transformRef.current?.zoomToElement("dofus-core-node", 0.61);
            }, 100);
        };

        centerOnCoords();
        const timers = [
            setTimeout(centerOnCoords, 100),
            setTimeout(centerOnCoords, 500),
            setTimeout(centerOnCoords, 1500)
        ];
        return () => timers.forEach(clearTimeout);
    }, []);

    const { macroNodes, microNodes, centerX, centerY } = useMemo(() => {
        const CANVAS_WIDTH = 5000;
        const CANVAS_HEIGHT = 4000;
        const cX = CANVAS_WIDTH / 2;
        const cY = CANVAS_HEIGHT / 2;
        
        const macroNodes: any[] = [];
        const microNodes: any[] = [];
        const radius = 800;

        // Check if we have at least one entry with non-zero coordinates to decide on layout mode
        const hasCoords = chains.some(c => (c.entries || []).some((e: any) => e.posX !== 0 || e.posY !== 0));

        chains.forEach((chain, i) => {
            let x, y;
            
            if (hasCoords) {
                // Centroid of entries or first entry's baseX
                const entries = chain.entries || [];
                const validX = entries.filter((e: any) => e.posX !== 0).map((e: any) => e.posX);
                const validY = entries.filter((e: any) => e.posY !== 0).map((e: any) => e.posY);
                
                if (validX.length > 0) {
                    x = validX.reduce((a: number, b: number) => a + b, 0) / validX.length;
                    y = Math.min(...validY) - 150; // Place chapter gem above the quests
                } else {
                    x = 400 + i * 600;
                    y = 400;
                }
            } else {
                const angle = (i / chains.length) * Math.PI * 2 - Math.PI / 2;
                x = cX + Math.cos(angle) * radius;
                y = cY + Math.sin(angle) * radius;
            }

            macroNodes.push({
                ...chain,
                name: chain.sectionName,
                x, y,
                isCompleted: (chain.entries || []).every((e: any) => e.status === "COMPLETED") && (chain.entries || []).length > 0,
                doneCount: (chain.entries || []).filter((e: any) => e.status === "COMPLETED").length,
                totalCount: (chain.entries || []).length,
                color: dofusColor
            });

            // Add microNodes (quests)
            (chain.entries || []).forEach((entry: any) => {
                microNodes.push({
                    ...entry,
                    parentChainId: chain.id,
                    color: dofusColor
                });
            });
        });

        return { macroNodes, microNodes, centerX: cX, centerY: cY };
    }, [chains, dofusColor]);

    const activeChain = useMemo(() => chains.find(c => c.id === expandedChainId), [chains, expandedChainId]);

    const selectedQuestInModal = useMemo(() => {
        if (!selectedQuestId || !activeChain) return null;
        return activeChain.entries.find((n: any) => n.id === selectedQuestId);
    }, [activeChain, selectedQuestId]);

    // Aggregate Resources & Dungeons
    const globalResources = useMemo(() => {
        // Use ID as key! With V3 all items have a precise DofusDB ID.
        const itemMap = new Map<number, { id: number; name: string; amount: number; img: string | null }>();
        const dungeonSet = new Set<string>();
        
        chains.forEach((chain) => {
            (chain.entries || []).forEach((quest: any) => {
                // Add items from legacy itemsRequired
                (quest.itemsRequired || []).forEach((req: any) => {
                    const id = req.id;
                    if (!id) return;
                    if (itemMap.has(id)) {
                        itemMap.get(id)!.amount += req.amount || 1;
                    } else {
                        itemMap.set(id, { ...req, id: Number(id), amount: req.amount || 1, name: req.name || "Ressource" });
                    }
                });
                
                // Add items and dungeons from V3 objectives
                const objectives = Array.isArray(quest.objectives) ? quest.objectives : [];
                
                objectives.forEach((obj: any) => {
                    const text = extractObjectiveText(obj);
                    const regex = /(?:(\d+)\s*(?:[xX]\s*|de\s*)?)?\{item,\s*(\d+)(?:,(\d+))?\}/g;
                    let match;
                    while ((match = regex.exec(text)) !== null) {
                        const amount = match[1] ? parseInt(match[1], 10) : 1;
                        const id = parseInt(match[2], 10);
                        if (itemMap.has(id)) {
                            itemMap.get(id)!.amount += amount;
                        } else {
                            itemMap.set(id, { id, amount, name: "Ressource", img: null });
                        }
                    }
                });
                
                const dungeonInfos = detectRealDungeons(objectives);
                for (const dungeonInfo of dungeonInfos) {
                    if (dungeonInfo.isDungeon && dungeonInfo.dungeonName) {
                        dungeonSet.add(dungeonInfo.dungeonName);
                    }
                }
                if (quest.isDungeon && quest.bossName) {
                    dungeonSet.add(quest.bossName);
                }
            });
        });
        
        return {
            items: Array.from(itemMap.values()).sort((a,b) => b.amount - a.amount),
            dungeons: Array.from(dungeonSet).sort()
        };
    }, [chains]);

    // Async effect to filter out quest items from globalResources calculation
    useEffect(() => {
        if (!globalResources.items.length) {
            setFilteredGlobalItems([]);
            setIsLoadingGlobalItems(false);
            return;
        }

        let isMounted = true;
        setIsLoadingGlobalItems(true);
        
        filterQuestItemsFromResources(globalResources.items).then(filtered => {
            if (isMounted) {
                setFilteredGlobalItems(filtered as any);
                setIsLoadingGlobalItems(false);
            }
        });

        return () => { isMounted = false; };
    }, [globalResources.items]);

    return (
        <div className="relative w-full h-[750px] bg-[#050608] rounded-[2.5rem] border border-white/5 overflow-hidden group shadow-2xl">
            {/* Lore Particles */}
            <LoreParticles color={dofusColor} />

            {/* 🛸 Neural Landing Sequence */}
            <motion.div 
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 1.5, delay: 0.5 }}
                className="absolute inset-0 z-50 bg-[#050608] flex flex-col items-center justify-center pointer-events-none"
            >
                <div className="flex flex-col items-center gap-6">
                    <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center relative overflow-hidden backdrop-blur-xl">
                        <DofusIcon name={dofus.nameShort || "Argent"} size={48} className="relative z-10" />
                        <motion.div 
                            className="absolute inset-0 bg-gradient-to-t from-indigo-500/20 to-transparent"
                            animate={{ y: [80, -80] }}
                            transition={{ duration: 1.2, repeat: 2 }}
                        />
                    </div>
                    <div className="text-[10px] font-black text-white/30 uppercase tracking-[0.5em]">Neural Link Established</div>
                </div>
            </motion.div>

            {/* Header Overlay */}
            <div className="absolute top-6 left-6 right-6 z-20 flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-4 p-4 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-3xl pointer-events-auto shadow-2xl">
                    <div className="w-12 h-12 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center">
                        <DofusIcon name={dofus.nameShort || "Argent"} size={36} />
                    </div>
                    <div>
                        <div className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-0.5">Dofus Discovery System</div>
                        <h2 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none">Arbre {dofus.name}</h2>
                    </div>
                </div>
                <div className="flex items-center gap-2 pointer-events-auto">
                    <Button variant="ghost" className="h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-colors uppercase font-black text-[10px] tracking-widest px-4 shadow-[0_0_20px_rgba(99,102,241,0.2)]" onClick={() => setShowResources(true)}>
                        <ListChecks className="w-4 h-4 mr-2" /> Ressources Totales
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => window.location.reload()} className="w-10 h-10 rounded-xl bg-black/40 border border-white/10 text-white hover:bg-white/10"><RotateCcw className="w-4 h-4" /></Button>
                </div>
            </div>

            <TransformWrapper
                ref={transformRef}
                initialScale={0.7}
                centerOnInit={true}
                minScale={0.1}
                limitToBounds={false}
            >
                {({ zoomIn, zoomOut, resetTransform, centerView }) => (
                    <>
                        <div className="absolute bottom-10 left-10 z-40 flex flex-col gap-3">
                            <div className="p-1.5 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl flex flex-col gap-1">
                                <Button variant="ghost" size="icon" onClick={() => zoomIn(0.5)} className="h-10 w-10 text-white"><Plus className="w-4 h-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => zoomOut(0.5)} className="h-10 w-10 text-white"><Minus className="w-4 h-4" /></Button>
                                <div className="h-px bg-white/5 mx-2 my-1" />
                                <Button variant="ghost" size="icon" onClick={() => resetTransform()} className="h-10 w-10 text-white font-black text-[10px]">1:1</Button>
                                <Button variant="ghost" size="icon" onClick={() => centerView()} className="h-10 w-10 text-indigo-400"><Zap className="w-4 h-4" /></Button>
                            </div>
                        </div>

                        {/* 🛰️ Neural HUD: Main Scenario */}
                        <QuestHUD 
                            chains={chains} 
                            guildId={guildId} 
                            dofusColor={dofusColor}
                            onSelectQuest={(qId, cId) => {
                                setExpandedChainId(cId);
                                setSelectedQuestId(qId);
                            }}
                        />

                        <TransformComponent wrapperClass="w-full h-full !bg-transparent overflow-visible">
                            <div className="relative w-[4000px] h-[3000px] overflow-visible">
                                <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
                                    {/* 🕸️ Background Neural Web (Macro) */}
                                    {macroNodes.map((gem) => (
                                        <g key={`fiber-macro-${gem.id}`}>
                                            <NeuralLine 
                                                x1={centerX} y1={centerY} 
                                                x2={gem.x} y2={gem.y} 
                                                color={dofusColor}
                                                opacity={0.15}
                                            />
                                        </g>
                                    ))}

                                    {/* 🕸️ Micro Neural Connections (Intra-Chain) */}
                                    {microNodes.map((node, i) => {
                                        const prevNode = microNodes.find(m => m.parentChainId === node.parentChainId && m.stepOrder === node.stepOrder - 1);
                                        const parentChapter = macroNodes.find(m => m.id === node.parentChainId);
                                        
                                        if (!parentChapter) return null;

                                        return (
                                            <g key={`fiber-micro-${node.id}`}>
                                                {/* Connect quest to its parent chapter if it's the first one */}
                                                {node.stepOrder === 0 && (
                                                    <NeuralLine 
                                                        x1={parentChapter.x} y1={parentChapter.y}
                                                        x2={node.posX} y2={node.posY}
                                                        color={dofusColor}
                                                        opacity={0.3}
                                                        isDashed
                                                    />
                                                )}
                                                {/* Connect quest to previous quest in chain */}
                                                {prevNode && (
                                                    <NeuralLine 
                                                        x1={prevNode.posX} y1={prevNode.posY}
                                                        x2={node.posX} y2={node.posY}
                                                        color={dofusColor}
                                                        opacity={node.status === 'COMPLETED' ? 0.6 : 0.2}
                                                        isAnimated={node.status === 'IN_PROGRESS'}
                                                    />
                                                )}
                                            </g>
                                        );
                                    })}

                                    {/* 💎 Dofus Core (Master Node) */}
                                    <foreignObject id="dofus-core-node" x={centerX - 150} y={centerY - 150} width="300" height="300" className="overflow-visible">
                                        <div className="w-full h-full flex items-center justify-center">
                                            <motion.div 
                                                animate={{ 
                                                    scale: [1, 1.05, 1],
                                                    boxShadow: ["0 0 50px rgba(255,255,255,0.05)", "0 0 120px rgba(255,255,255,0.2)", "0 0 50px rgba(255,255,255,0.05)"]
                                                }} 
                                                transition={{ duration: 8, repeat: Infinity }} 
                                                className="w-32 h-32 rounded-[2.5rem] bg-black/40 border border-white/20 flex items-center justify-center backdrop-blur-3xl"
                                            >
                                                <DofusIcon name={dofus.nameShort || "Argent"} size={80} />
                                            </motion.div>
                                        </div>
                                    </foreignObject>

                                    {/* 🌀 Macro Nodes (Chapters) */}
                                    {macroNodes.map((gem) => (
                                        <foreignObject key={gem.id} x={gem.x - 120} y={gem.y - 120} width="240" height="280" className="overflow-visible">
                                            <div 
                                                onClick={() => setExpandedChainId(gem.id)} 
                                                className="w-full h-full flex flex-col items-center justify-center gap-6 pointer-events-auto group cursor-pointer"
                                            >
                                                <motion.button 
                                                    whileHover={{ scale: 1.1, rotate: 5 }}
                                                    whileTap={{ scale: 0.9 }}
                                                    className={`w-28 h-28 rounded-[2.2rem] border-2 flex items-center justify-center relative shadow-[0_0_80px_rgba(0,0,0,0.8)] transition-all duration-700 ${
                                                        gem.isCompleted ? "bg-emerald-500/80 border-emerald-400 shadow-emerald-500/30" 
                                                        : gem.doneCount > 0 ? "bg-indigo-500/80 border-indigo-400 shadow-indigo-500/30"
                                                        : "bg-black/60 border-white/10 group-hover:border-white/30 backdrop-blur-3xl"
                                                    }`}
                                                >
                                                    {gem.isCompleted ? <Check className="w-10 h-10 text-black" /> : <Gem className={`w-10 h-10 ${gem.doneCount > 0 ? "text-white" : "text-zinc-800"}`} />}
                                                    
                                                    {/* Neural Glow Pulse */}
                                                    {(gem.isCompleted || gem.doneCount > 0) && (
                                                        <motion.div 
                                                            className="absolute inset-0 rounded-[2.2rem] border-2 border-white/20"
                                                            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                                                            transition={{ duration: 4, repeat: Infinity }}
                                                        />
                                                    )}

                                                    <div className="absolute -top-4 px-3 py-1 bg-black border border-white/20 rounded-full text-[10px] font-black text-white shadow-2xl z-20">
                                                        {gem.doneCount}/{gem.totalCount}
                                                    </div>
                                                </motion.button>
                                                <div className="text-[12px] font-black uppercase italic tracking-[0.2em] text-center max-w-[200px] text-zinc-400 group-hover:text-white group-hover:scale-105 transition-all duration-500 drop-shadow-2xl">
                                                    {gem.name}
                                                </div>
                                            </div>
                                        </foreignObject>
                                    ))}

                                    {/* 📍 Micro Nodes (Quests) */}
                                    {microNodes.map((node) => (
                                        <foreignObject key={node.id} x={node.posX - 50} y={node.posY - 50} width="100" height="130" className="overflow-visible">
                                            <div 
                                                onClick={() => {
                                                    setExpandedChainId(node.parentChainId);
                                                    setSelectedQuestId(node.id);
                                                }}
                                                className="w-full h-full flex flex-col items-center justify-center gap-3 pointer-events-auto group cursor-pointer"
                                            >
                                                <motion.div 
                                                    whileHover={{ scale: 1.2 }}
                                                    className={cn(
                                                        "w-10 h-10 rounded-xl border flex items-center justify-center transition-all duration-500 relative",
                                                        node.status === 'COMPLETED' ? "bg-emerald-500 border-emerald-400 text-black" 
                                                        : node.status === 'IN_PROGRESS' ? "bg-indigo-500 border-indigo-400 text-white shadow-[0_0_20px_rgba(99,102,241,0.5)]"
                                                        : node.isSynergyCandidate ? "bg-amber-500/20 border-amber-400/50 text-amber-500 shadow-[0_0_15px_rgba(251,191,36,0.3)]"
                                                        : "bg-zinc-900 border-white/10 text-zinc-700"
                                                    )}
                                                >
                                                    {node.isDungeon ? <Navigation className="w-5 h-5" /> : <div className="w-2 h-2 rounded-full bg-current" />}
                                                    
                                                    {/* Active quest radar pulse */}
                                                    {node.status === 'IN_PROGRESS' && (
                                                        <motion.div 
                                                            className="absolute inset-0 rounded-xl border border-indigo-400"
                                                            animate={{ scale: [1, 2], opacity: [1, 0] }}
                                                            transition={{ duration: 2, repeat: Infinity }}
                                                        />
                                                    )}
                                                </motion.div>
                                                <div className="text-[9px] font-black uppercase text-center max-w-[80px] text-zinc-500 group-hover:text-white transition-colors truncate">
                                                    {node.name}
                                                </div>
                                            </div>
                                        </foreignObject>
                                    ))}
                                </svg>
                            </div>
                        </TransformComponent>
                    </>
                )}
            </TransformWrapper>

            <Dialog open={!!expandedChainId} onOpenChange={(open) => { if (!open) { setExpandedChainId(null); setSelectedQuestId(null); } }}>
                <DialogContent 
                    className="max-w-[95vw] w-full h-[90vh] bg-[#050608] border-white/10 p-0 overflow-hidden outline-none flex flex-col shadow-[0_0_100px_black]"
                    onPointerDownOutside={(e) => {
                        // Prevent closure if interacting with the neural tree inside the modal
                        if ((e.target as HTMLElement).closest('.transform-component')) e.preventDefault();
                    }}
                >
                    <LoreParticles color={dofusColor} />
                    
                    <DialogHeader className="p-0 border-b border-white/5 relative h-64 overflow-hidden flex-shrink-0">
                        {/* Background Banner Lore */}
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/40 to-transparent" />
                        <div className="absolute inset-0 bg-[url('https://api.dofusdb.fr/img/maps/1.png')] bg-cover bg-center opacity-10 grayscale" />
                        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#050608] to-transparent" />
                        
                        <div className="relative h-full flex flex-row items-end justify-between px-12 pb-8 gap-8">
                            <div className="flex items-center gap-8">
                                <SafeImage src={dofus.imageUrl || ""} fallback="https://api.dofusdb.fr/img/items/error.png" width={120} height={120} alt={dofus.name} className="mb-4 drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]" />
                                <div className="mb-4">
                                    <Badge className="bg-indigo-500/20 text-indigo-400 border-indigo-500/30 mb-2 rounded-lg font-black tracking-widest text-[10px]">SERIE DE QUÊTES</Badge>
                                    <DialogTitle className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none mb-2">
                                        {activeChain?.sectionName}
                                    </DialogTitle>
                                    <DialogDescription className="sr-only">Détails et progression de la quête</DialogDescription>
                                    <div className="flex items-center gap-4 text-[11px] font-bold text-zinc-500 uppercase tracking-[0.2em]">
                                        <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Progression Principale</div>
                                        <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Zone {activeChain?.entries?.[0]?.zone || "Monde"}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-4 bg-black/40 border border-white/10 rounded-3xl backdrop-blur-3xl min-w-[160px]">
                                    <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">Conseils Expert</div>
                                    <div className="text-[11px] font-medium text-white/80 leading-relaxed max-w-[250px]">
                                        {activeChain?.sectionName?.includes("Vent") ? "Rien à prévoir, vous allez surtout rencontrer les PNJs d'Incarnam." : "Consultez l'inventaire synthétique pour préparer vos aventures."}
                                    </div>
                                </div>
                                <div className="p-4 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-3xl min-w-[200px]">
                                    <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-3">Objectif Ultime</div>
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-[#050608] border border-white/10 flex items-center justify-center shadow-xl">
                                            <SafeImage src={dofus.imageUrl || ""} fallback="https://api.dofusdb.fr/img/items/error.png" width={32} height={32} alt={dofus.name} className="scale-110" />
                                        </div>
                                        <div className="flex flex-col">
                                            <div className="text-[14px] font-black text-white italic tracking-wider">{dofus.name}</div>
                                            <div className="text-[10px] font-bold text-zinc-500 uppercase">{dofus.successName || "Quête Principale"}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 relative overflow-hidden z-10 bg-[#020304] border-t border-white/5">
                        <TransformWrapper 
                            initialScale={0.8} 
                            minScale={0.2}
                            maxScale={2}
                            limitToBounds={false}
                            panning={{ velocityDisabled: false }}
                            wheel={{ wheelDisabled: false, step: 0.1 }}
                            doubleClick={{ disabled: false }}
                        >
                            {({ zoomIn, zoomOut, resetTransform }) => (
                                <>
                                    <div className="absolute top-6 left-6 z-20 flex gap-1 bg-black/60 border border-white/10 p-1 rounded-xl backdrop-blur-3xl shadow-2xl">
                                        <Button variant="ghost" size="icon" onClick={() => zoomIn(0.2)} className="h-8 w-8 text-white hover:bg-white/10"><Plus className="w-3 h-3" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => resetTransform()} className="h-8 w-8 text-[9px] font-black text-white/60">1:1</Button>
                                        <Button variant="ghost" size="icon" onClick={() => zoomOut(0.2)} className="h-8 w-8 text-white hover:bg-white/10"><Minus className="w-3 h-3" /></Button>
                                    </div>

                                    <TransformComponent wrapperClass="w-full h-full !bg-transparent overflow-visible select-none" contentClass="w-full h-full">
                                        <div className="relative w-[10000px] h-full" onPointerDown={(e) => e.stopPropagation()}>
                                            <svg className="w-full h-full overflow-visible translate-y-[200px]">
                                                <g>
                                                    {(activeChain?.entries || []).map((e: any, idx: number) => {
                                                        if (idx === 0) return null;
                                                        return (
                                                            <motion.line 
                                                                key={`link-${idx}`} 
                                                                x1={300 + (idx - 1) * 280} y1={200} 
                                                                x2={300 + idx * 280} y2={200} 
                                                                stroke={dofusColor} strokeWidth="3" 
                                                                strokeDasharray="10 10" 
                                                                animate={{ strokeDashoffset: [0, -100] }}
                                                                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                                                                className="opacity-20 glow"
                                                            />
                                                        );
                                                    })}
                                                </g>

                                                {(activeChain?.entries || []).sort((a:any,b:any) => a.stepOrder - b.stepOrder).map((node: any, i: number) => {
                                                    const isDone = node.status === "COMPLETED";
                                                    const isSelected = selectedQuestId === node.id;
                                                    return (
                                                        <foreignObject key={node.id} x={300 + i * 280 - 100} y={200 - 100} width={200} height={200} className="overflow-visible">
                                                            <div onClick={() => setSelectedQuestId(node.id)} className="flex flex-col items-center cursor-pointer group pointer-events-auto">
                                                                <motion.div 
                                                                    whileHover={{ scale: 1.15 }}
                                                                    whileTap={{ scale: 0.9 }}
                                                                    className={`w-24 h-24 rounded-3xl flex items-center justify-center border-2 transition-all duration-500 shadow-2xl relative ${
                                                                        isDone ? "bg-emerald-500/80 border-emerald-400 shadow-emerald-500/30" 
                                                                        : isSelected ? "bg-white border-white scale-110 shadow-white/40"
                                                                        : node.isSynergyCandidate ? "bg-amber-500/10 border-amber-400/50 shadow-[0_0_30px_rgba(251,191,36,0.15)] group-hover:border-amber-400 backdrop-blur-3xl"
                                                                        : "bg-[#0a0b0d] border-white/10 group-hover:border-white/30 backdrop-blur-3xl"
                                                                    }`}
                                                                >
                                                                    {isDone ? <Check className="w-10 h-10 text-black" /> : <Play className={`w-8 h-8 ${isSelected ? "text-black" : "text-zinc-600"} group-hover:text-white transition-colors`} />}
                                                                    
                                                                    {isSelected && (
                                                                        <motion.div 
                                                                            layoutId="neural-orb-active-modal"
                                                                            className="absolute inset-0 rounded-3xl border-2 border-white/50 blur-[2px]"
                                                                            animate={{ scale: [1, 1.2, 1], opacity: [0.8, 0, 0.8] }}
                                                                            transition={{ duration: 2, repeat: Infinity }}
                                                                        />
                                                                    )}
                                                                </motion.div>
                                                                <div className={`mt-6 text-center max-w-[180px] text-[11px] font-black italic uppercase tracking-wider transition-all ${isSelected || isDone ? "text-white" : "text-zinc-600"} group-hover:text-white`}>
                                                                    {node.name}
                                                                </div>
                                                            </div>
                                                        </foreignObject>
                                                    );
                                                })}
                                            </svg>
                                        </div>
                                    </TransformComponent>
                                </>
                            )}
                        </TransformWrapper>

                        <AnimatePresence>
                            {selectedQuestInModal && (
                                <motion.div 
                                    initial={{ x: 500 }} 
                                    animate={{ x: 0 }} 
                                    exit={{ x: 500 }} 
                                    className="absolute top-0 right-0 bottom-0 w-[480px] bg-[#050608]/95 backdrop-blur-2xl border-l border-white/5 shadow-[-50px_0_100px_rgba(0,0,0,0.8)] z-50 flex flex-col pt-0"
                                >
                                    <div className="px-10 pt-12 pb-6 flex items-center justify-between border-b border-white/5 bg-white/[0.02]">
                                        <div className="flex-1 min-w-0 pr-4">
                                            <div className="flex items-center gap-3 mb-1">
                                                <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em]">DÉTAIL DE L'ÉTAPE</div>
                                                {selectedQuestInModal.isSynergyCandidate && (
                                                    <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 rounded-lg font-black tracking-widest text-[8px] px-2 py-0 animate-pulse">SYNERGIE OPTIMISÉE</Badge>
                                                )}
                                            </div>
                                            <h4 className="text-2xl font-black text-white italic uppercase tracking-tighter truncate">{selectedQuestInModal.name}</h4>
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => setSelectedQuestId(null)} className="rounded-xl h-10 w-10 bg-white/5 flex-shrink-0 hover:bg-white/10 transition-colors">
                                            <ChevronDown className="w-4 h-4 -rotate-90 text-zinc-500" />
                                        </Button>
                                    </div>
                                    
                                    <ScrollArea className="flex-1 h-full min-h-0">
                                        <div className="px-10 py-10 space-y-10">
                                            <div className="space-y-4">
                                                <div className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em]">Logique de l'étape</div>
                                                <div className="space-y-3">
                                                    {(Array.isArray((selectedQuestInModal as any).objectives) ? (selectedQuestInModal as any).objectives : []).map((obj: any, idx: number) => {
                                                        const text = extractObjectiveText(obj);
                                                        const isReturn = text.toLowerCase().includes("retour") || text.toLowerCase().includes("aller voir");
                                                        return (
                                                            <div key={idx} className="flex gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-zinc-400 text-[13px] leading-relaxed transition-all hover:bg-white/[0.04]">
                                                                <div className={`w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-black ${isReturn ? "bg-indigo-500 text-white" : "bg-white/10"}`}>{idx+1}</div>
                                                                <ParsedObjective text={obj} guildId={guildId} zone={activeChain?.sectionName} />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Precise NPC / Dungeon HUD - Moved BELOW steps to respect order */}
                                            {(() => {
                                                const objectives = Array.isArray((selectedQuestInModal as any).objectives) ? (selectedQuestInModal as any).objectives : [];
                                                const dungeonInfos = detectRealDungeons(objectives);
                                                const dungeonInfo = dungeonInfos[0]; // For now just the first one for the HUD
                                                const npcMatch = objectives.find((o: any) => {
                                                    const t = typeof o === 'string' ? o : (o?.text || "");
                                                    return t.includes("{npc,");
                                                });
                                                
                                                if (dungeonInfo && dungeonInfo.isDungeon && dungeonInfo.dungeonName) {
                                                    return (
                                                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-[2rem] flex flex-col gap-6 overflow-hidden relative group">
                                                            <div className="flex items-center gap-6 relative z-10">
                                                                <div className="w-20 h-20 bg-rose-500/20 rounded-[1.5rem] flex items-center justify-center border border-rose-500/30 overflow-hidden shadow-2xl transition-transform hover:scale-110">
                                                                    {dungeonInfo.mapImg && (
                                                                        <SafeImage 
                                                                            src={dungeonInfo.mapImg} 
                                                                            fallback={dungeonInfo.mapImg}
                                                                            className="w-16 h-16 object-contain drop-shadow-2xl brightness-125 rotate-3" 
                                                                            alt="boss" 
                                                                        />
                                                                    )}
                                                                </div>
                                                                <div className="flex-1">
                                                                    <div className="text-[10px] font-black text-rose-400 uppercase tracking-[0.4em] mb-2 flex items-center gap-2"><Zap className="w-3 h-3 fill-rose-400 animate-pulse" /> Focus : Donjon Requis</div>
                                                                    <div className="text-2xl font-black text-white italic uppercase tracking-tighter mb-1">{dungeonInfo.dungeonName}</div>
                                                                    <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"><MapPin className="w-3 h-3" /> Objectif Principal</div>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-3 relative z-10">
                                                                {dungeonInfo.x !== undefined && (
                                                                    <Link 
                                                                        href={`/dashboard/${guildId}/worldmap?x=${dungeonInfo.x}&y=${dungeonInfo.y}&zoom=4&world=${dungeonInfo.worldId ?? 0}`}
                                                                        className="flex items-center justify-center h-12 rounded-2xl bg-white/5 border border-white/5 hover:bg-rose-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all"
                                                                    >
                                                                        <MapIcon className="w-4 h-4 mr-2" /> GPS Donjon
                                                                    </Link>
                                                                )}
                                                                <a 
                                                                    href={`https://www.google.com/search?q=site:dofuspourlesnoobs.com+${encodeURIComponent(dungeonInfo.dungeonName)}`} 
                                                                    target="_blank"
                                                                    className="flex items-center justify-center h-12 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest transition-all"
                                                                >
                                                                    <ExternalLink className="w-4 h-4 mr-2" /> Guide Boss
                                                                </a>
                                                            </div>
                                                        </motion.div>
                                                    );
                                                }

                                                if (npcMatch) {
                                                    const match = npcMatch.match(/\{npc,(\d+)\}/);
                                                    return (
                                                        <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-3xl flex items-center gap-4">
                                                            <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400 flex-shrink-0"><MapPin className="w-6 h-6" /></div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-1">PNJ CLÉ DE L'ÉTAPE</div>
                                                                <div className="text-[14px] font-black text-white italic">
                                                                    {match ? <NpcName npcId={match[1]} /> : "PNJ Principal"}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}

                                            <div className="pt-6 border-t border-white/5">
                                                <Button 
                                                    disabled={Array.isArray(selectedQuestInModal.requirements) && selectedQuestInModal.requirements.some((req: any) => req && typeof req === 'object' && req.type === "QUEST" && !activeChain.entries.some((n: any) => n.id === req.id && n.status === "COMPLETED")) && selectedQuestInModal.status !== "COMPLETED"}
                                                    onClick={() => onToggleStatus(selectedQuestInModal.id, selectedQuestInModal.status === "COMPLETED" ? "NOT_STARTED" : "COMPLETED")}
                                                    className={`w-full h-14 rounded-2xl font-black italic uppercase text-[12px] tracking-widest transition-all ${selectedQuestInModal.status === "COMPLETED" ? "bg-zinc-900 text-zinc-500 border border-white/5" : "bg-white text-black hover:bg-zinc-200 shadow-2xl"}`}
                                                >
                                                    {selectedQuestInModal.status === "COMPLETED" ? "Réinitialiser La Progression" : "Valider l'étape"}
                                                </Button>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 pb-20">
                                                <a href={`https://dofusdb.fr/fr/database/quest/${selectedQuestInModal.dofusdbId || selectedQuestInModal.id}`} target="_blank" className="flex flex-col items-center justify-center gap-2 h-16 rounded-2xl bg-white/5 border border-white/5 hover:bg-zinc-900 text-[9px] font-black text-zinc-500 uppercase tracking-widest"><MapIcon className="w-4 h-4 text-sky-400" /> DofusDB</a>
                                                <a href={`https://www.google.com/search?q=site:dofuspourlesnoobs.com+${encodeURIComponent(selectedQuestInModal.name)}`} target="_blank" className="flex flex-col items-center justify-center gap-2 h-16 rounded-2xl bg-white/5 border border-white/5 hover:bg-zinc-900 text-[9px] font-black text-zinc-500 uppercase tracking-widest"><BookOpen className="w-4 h-4 text-amber-400" /> Noobs</a>
                                            </div>
                                        </div>
                                    </ScrollArea>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Global Resources Dialog */}
            <Dialog open={showResources} onOpenChange={setShowResources}>
                <DialogContent className="max-w-[700px] bg-[#050608] border-white/10 p-0 overflow-hidden outline-none">
                    <div className="px-8 pt-8 pb-4 flex items-center gap-4 bg-gradient-to-b from-indigo-500/10 to-transparent border-b border-white/5">
                        <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shadow-xl">
                            <ListChecks className="w-8 h-8" />
                        </div>
                        <div>
                            <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-1">PRÉVISIONS LOGISTIQUES</div>
                            <DialogTitle className="text-3xl font-black text-white italic uppercase tracking-tighter">Inventaire Synthétique</DialogTitle>
                            <DialogDescription className="sr-only">Liste complète des ressources et donjons à collecter pour la quête du Dofus.</DialogDescription>
                        </div>
                    </div>
                    <ScrollArea className="h-[60vh]">
                        <div className="p-8 space-y-10">
                            <div>
                                <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.4em] mb-6 flex items-center gap-3">
                                    <Package className="w-4 h-4" /> Objets à collecter ({isLoadingGlobalItems ? "..." : String(filteredGlobalItems.length)})
                                </h3>
                                {isLoadingGlobalItems ? (
                                    <div className="py-12 flex flex-col items-center justify-center gap-3 text-zinc-500 italic text-[10px] font-black uppercase tracking-widest bg-white/[0.02] border border-white/5 border-dashed rounded-[2rem]">
                                        <div className="w-5 h-5 border-2 border-zinc-600 border-t-white rounded-full animate-spin"></div>
                                        Filtrage des objets de quête...
                                    </div>
                                ) : filteredGlobalItems.length === 0 ? (
                                    <div className="text-[12px] font-bold text-zinc-600 italic">Aucune donnée de ressources extraite pour ce Dofus.</div>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                        {filteredGlobalItems.map((item, i) => (
                                            <div key={i} className="flex flex-col items-center gap-3 p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/5 transition-colors group">
                                                <div className="w-14 h-14 bg-black/50 rounded-xl border border-white/10 flex items-center justify-center p-2 group-hover:border-indigo-500/40 relative">
                                                    <SafeImage src={`https://api.dofusdb.fr/img/items/${item.id}.png`} fallback="https://api.dofusdb.fr/img/items/error.png" alt={item.id.toString()} className="object-contain" />
                                                    <div className="absolute -bottom-2 -right-2 px-2 py-0.5 bg-indigo-500 text-white text-[10px] font-black rounded-lg tabular-nums">x{item.amount || 1}</div>
                                                </div>
                                                <ItemInline itemId={item.id.toString()} />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.4em] mb-6 flex items-center gap-3">
                                    <Target className="w-4 h-4" /> Donjons à affronter ({(globalResources?.dungeons || []).length})
                                </h3>
                                {(globalResources?.dungeons || []).length === 0 ? (
                                    <div className="text-[12px] font-bold text-zinc-600 italic">Aucun donjon détecté d'après les quêtes.</div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {globalResources.dungeons.map((dName, i) => (
                                            <div key={i} className="flex items-center gap-5 p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                                                <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 border border-rose-500/20">🏰</div>
                                                <div className="text-[14px] font-black text-white italic uppercase tracking-tighter">{dName}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ─── Component: Neural Line ──────────────────────────────────────────────────
function NeuralLine({ x1, y1, x2, y2, color, opacity = 0.2, isDashed = false, isAnimated = false }: any) {
    return (
        <g>
            <motion.path 
                d={`M ${x1} ${y1} Q ${(x1+x2)/2} ${y1} ${x2} ${y2}`}
                fill="none" 
                stroke={color} 
                strokeWidth={isAnimated ? "4" : "2"}
                strokeDasharray={isDashed ? "10 10" : "none"}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity }}
                transition={{ duration: 2 }}
                className={cn("glow", isAnimated && "animate-pulse")}
            />
            {isAnimated && (
                <motion.circle 
                    r="3" 
                    fill="#fff"
                    animate={{ offsetDistance: ["0%", "100%"] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    style={{ offsetPath: `path("M ${x1} ${y1} Q ${(x1+x2)/2} ${y1} ${x2} ${y2}")` }}
                />
            )}
        </g>
    );
}

// ─── Component: Main Scenario HUD ───────────────────────────────────────────
function QuestHUD({ chains, guildId, dofusColor, onSelectQuest }: { chains: any[]; guildId: string; dofusColor: string; onSelectQuest: (qId: string, cId: string) => void }) {
    const nextQuests = useMemo(() => {
        if (!Array.isArray(chains)) return [];
        const flat = chains.flatMap((c: any) => (Array.isArray(c.entries) ? c.entries : []).map((e: any) => ({ ...e, chainId: c.id })));
        return flat.filter((e: any) => e.status !== 'COMPLETED').slice(0, 3);
    }, [chains]);

    if (nextQuests.length === 0) return null;

    const current = nextQuests[0];

    return (
        <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-4"
        >
            <div className="flex items-center gap-1 p-1 bg-black/60 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.8)]">
                {nextQuests.map((q: any, i: number) => (
                    <div 
                        key={q.id}
                        onClick={() => onSelectQuest(q.id, q.chainId)}
                        className={cn(
                            "flex items-center gap-4 px-6 py-4 rounded-2xl cursor-pointer transition-all duration-500",
                            i === 0 ? "bg-white/10 border border-white/10 shadow-2xl scale-105" : "opacity-40 grayscale hover:opacity-100 hover:grayscale-0"
                        )}
                    >
                        <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center border",
                            i === 0 ? `border-${dofusColor} bg-indigo-500 text-white` : "border-white/10 bg-white/5 text-zinc-500"
                        )}>
                            {i === 0 ? <Target className="w-5 h-5" /> : <CircleDashed className="w-5 h-5" />}
                        </div>
                        <div className="hidden sm:block">
                            <div className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em]">{i === 0 ? "Prochaine Étape" : `Étape ${i+1}`}</div>
                            <div className="text-[13px] font-black text-white italic truncate max-w-[150px]">{q.name}</div>
                        </div>
                        {i === 0 && current.coords && (
                            <div className="flex items-center gap-2 ml-4 pl-4 border-l border-white/5">
                                <div className="text-emerald-400 font-black italic text-xs tabular-nums">[{current.coords.x}, {current.coords.y}]</div>
                                <Button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        window.location.href = `/dashboard/${guildId}/worldmap?x=${current.coords.x}&y=${current.coords.y}&zoom=4&world=1`;
                                    }}
                                    className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500 hover:text-white transition-all h-8 w-8"
                                >
                                    <MapPin className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </motion.div>
    );
}

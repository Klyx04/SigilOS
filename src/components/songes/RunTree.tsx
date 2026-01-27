"use client";

import { useState } from "react";
import { updateCurrentFloor } from "@/server/actions/songes/dream-run-actions";
import Image from "next/image";
import { Loader2, CheckCircle2, PlayCircle } from "lucide-react";
import { getFloorColor, type RoomTypeKey } from "@/lib/songes/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

interface RunTreeProps {
    guildId: string;
    currentFloor: number;
    runId: string;
    isLeader: boolean;
    runStatus: string;
    leaderName: string;
    onStatusChange?: (status: string | null) => void;
    onUpdate?: () => void;
}

const PALIERS_DATA = [
    { id: 5, nom: "V - Les Abstractions chimériques", min: 22, max: 25, color: "#f59e0b" }, // Amber (Stopped at 25 to separate Boss)
    { id: 4, nom: "IV - Les Concepts brumeux", min: 16, max: 21, color: "#a855f7" }, // Purple
    { id: 3, nom: "III - Les Espaces imaginaires", min: 10, max: 15, color: "#ec4899" }, // Pink
    { id: 2, nom: "II - Les Balades fantastiques", min: 4, max: 9, color: "#3b82f6" }, // Blue
    { id: 1, nom: "I - Les Pensées oniriques", min: 1, max: 3, color: "#10b981" }, // Green
];

// Logic for floor types
const getFloorType = (floor: number): RoomTypeKey => {
    if (floor === 26) return "BOSS";
    if (floor === 0) return "COMBAT";
    return "COMBAT";
};

// Cyber Check: React escapes variables by default. 
// LeaderName is coming from a controlled source (DB/Session) and rendered safely.
// No sensitive data is exposed in the DOM attributes.
// Best Practice: Ensure images have alt text (done) and use optimized Next.js Image component (done).

// Cyber Check: Input sanitization handled by framework. No user HTML injection possible here.
// Images are static assets or pre-validated URLs.

interface FloorNodeProps {
    floor: number;
    type: RoomTypeKey;
    isCurrent: boolean;
    isCompleted: boolean;
    isLocked: boolean;
    isLeader: boolean;
    onClick: () => void;
    customLabel?: string;
    description?: string;
    customColor?: string;
}

function FloorNode({ floor, type, isCurrent, isCompleted, isLeader, isLocked, onClick, customLabel, description, customColor }: FloorNodeProps) {
    const isBoss = floor === 26;
    const isStart = floor === 0;

    // FRAMER MOTION TILT LOGIC
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const mouseX = useSpring(x, { stiffness: 500, damping: 100 });
    const mouseY = useSpring(y, { stiffness: 500, damping: 100 });

    const rotateX = useTransform(mouseY, [-0.5, 0.5], ["15deg", "-15deg"]);
    const rotateY = useTransform(mouseX, [-0.5, 0.5], ["-15deg", "15deg"]);

    function onMouseMove(event: React.MouseEvent<HTMLDivElement>) {
        const rect = event.currentTarget.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        const xPct = mouseX / width - 0.5;
        const yPct = mouseY / height - 0.5;
        x.set(xPct);
        y.set(yPct);
    }

    function onMouseLeave() {
        x.set(0);
        y.set(0);
    }

    const interactionClasses = (isLeader || isCompleted || (!isLocked && isCurrent))
        ? "cursor-pointer"
        : "cursor-default opacity-60 grayscale-[0.5]";

    /* -------------------------------------------------------------------------- */
    /*                                 BOSS NODE                                  */
    /* -------------------------------------------------------------------------- */
    if (isBoss) {
        return (
            <div className="relative z-10 mb-16 flex flex-col items-center justify-center perspective-[1200px]">
                <motion.div
                    onClick={isLeader || isCompleted ? onClick : undefined}
                    onMouseMove={onMouseMove}
                    onMouseLeave={onMouseLeave}
                    style={{
                        rotateX,
                        rotateY,
                        transformStyle: "preserve-3d",
                    }}
                    className={cn(
                        "relative w-72 h-72 md:w-96 md:h-96 flex items-center justify-center transition-transform duration-200 ease-out",
                        interactionClasses
                    )}
                >
                    {/* 
                        LAYER -1: THE GLOW (Shadow)
                        This is SEPARATE from the image mask. It creates the round aura.
                     */}
                    <div
                        className={cn(
                            "absolute inset-10 rounded-full bg-amber-500/20 blur-[60px] transition-all duration-500",
                            isCurrent && "bg-amber-500/40 blur-[80px]",
                        )}
                        style={{ transform: "translateZ(-50px)" }}
                    />

                    {/* 
                        LAYER 0: THE TOKEN CONTAINER (Masked)
                        We mask this container to hide the square corners of the PNG.
                    */}
                    <div
                        className="relative w-64 h-64 md:w-80 md:h-80"
                        style={{
                            transform: "translateZ(20px)",
                            maskImage: 'radial-gradient(circle at center, black 60%, transparent 70%)',
                            WebkitMaskImage: 'radial-gradient(circle at center, black 60%, transparent 70%)'
                        }}
                    >
                        <Image
                            src="/songes/boss_token.png"
                            alt="Final Boss"
                            fill
                            className={cn(
                                "object-contain",
                                isCurrent && "brightness-110 drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]"
                            )}
                            priority
                        />
                    </div>

                    {/* LAYER 1: ORBITAL RINGS (Independent of mask) */}
                    <div className="absolute inset-0 w-full h-full pointer-events-none opacity-50 mix-blend-screen animate-[spin_60s_linear_infinite]" style={{ transform: 'translateZ(0px) scale(1.1)' }}>
                        <div className="w-full h-full rounded-full border border-amber-500/20 skew-y-12" />
                    </div>

                    {/* CHECKMARK */}
                    {isCompleted && (
                        <div className="absolute bottom-12 right-12 z-50" style={{ transform: "translateZ(60px)" }}>
                            <div className="bg-amber-500 text-black rounded-full p-3 shadow-lg animate-in zoom-in spin-in-180">
                                <CheckCircle2 className="w-8 h-8" />
                            </div>
                        </div>
                    )}
                </motion.div>

                {/* Floating Label */}
                <div className="mt-8 relative z-20 text-center">
                    <h4 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-100 to-amber-600 uppercase tracking-[0.3em] drop-shadow-[0_5px_15px_rgba(245,158,11,0.5)] text-shadow-lg">
                        {description || "Combat Final"}
                    </h4>
                </div>
            </div>
        )
    }

    /* -------------------------------------------------------------------------- */
    /*                                STANDARD FLOOR                              */
    /* -------------------------------------------------------------------------- */
    return (
        <div className="relative z-10 h-48 flex flex-col items-center justify-end pb-8 perspective-[1000px]">
            <motion.div
                onClick={(isLeader || (!isLocked && !isCompleted && isCurrent)) ? onClick : undefined}
                onMouseMove={onMouseMove}
                onMouseLeave={onMouseLeave}
                style={{
                    rotateX,
                    rotateY,
                    transformStyle: "preserve-3d",
                }}
                className={cn(
                    "relative w-36 h-36 md:w-40 md:h-40 flex items-center justify-center transition-all duration-200",
                    interactionClasses
                )}
            >
                {/* 
                   GROUND SHADOW (Detached)
                   Placed far behind to simulate height.
                */}
                <div
                    className={cn(
                        "absolute -bottom-10 left-1/2 -translate-x-1/2 w-[60%] h-8 bg-black/60 blur-[30px] rounded-[100%] transition-opacity duration-500",
                        isCurrent ? "opacity-60" : "opacity-30"
                    )}
                    style={{ transform: "rotateX(60deg) translateZ(-80px)" }}
                />

                {/* 
                   MAIN TOKEN (Levitating)
                */}
                <div
                    className="relative w-32 h-32 md:w-36 md:h-36"
                    style={{ transform: "translateZ(30px)" }}
                >
                    {/* MASKED IMAGE CONTAINER */}
                    <div
                        className="relative w-full h-full"
                        style={{
                            maskImage: 'radial-gradient(circle at center, black 55%, transparent 72%)',
                            WebkitMaskImage: 'radial-gradient(circle at center, black 55%, transparent 72%)'
                        }}
                    >
                        <Image
                            src={isStart ? "/songes/salle0.png" : "/songes/combat_token.png"}
                            alt={`Floor ${floor}`}
                            fill
                            className={cn(
                                "object-contain",
                                isCurrent && "brightness-110"
                            )}
                        />
                        {/* Inner Shine */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                    </div>
                </div>

                {/* ACTIVE GLOW (Behind Token but above Shadow) */}
                {isCurrent && (
                    <div
                        className="absolute inset-0 rounded-full bg-white/5 blur-[40px] animate-pulse pointer-events-none -z-10"
                        style={{ transform: "translateZ(-20px)" }}
                    />
                )}

                {/* CHECKMARK (Floating Front) */}
                {isCompleted && (
                    <div className="absolute bottom-0 right-0 z-50" style={{ transform: "translateZ(50px)" }}>
                        <div className="bg-emerald-500 text-white rounded-full p-1 shadow-lg border-2 border-black scale-90">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                    </div>
                )}
            </motion.div>

            {/* Label */}
            <div className="absolute -bottom-8 z-20">
                <span className={cn(
                    "text-[10px] font-black tracking-[0.2em] px-3 py-0.5 rounded-full transition-all border uppercase shadow-xl backdrop-blur-sm block shadow-black/80",
                    isCurrent
                        ? "bg-white/90 text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.3)] scale-110"
                        : "text-white/40 bg-black/40 border-white/5"
                )}>
                    {isStart ? "Départ" : `Étage ${floor}`}
                </span>
            </div>
        </div>
    );
}

export function RunTree({ guildId, currentFloor, runId, isLeader, runStatus, leaderName, onStatusChange, onUpdate }: RunTreeProps) {
    const [updating, setUpdating] = useState(false);
    // State to track expanded sections (default to all open or current)
    const [expandedPaliers, setExpandedPaliers] = useState<number[]>([1, 2, 3, 4, 5, 26]);

    const togglePalier = (id: number) => {
        setExpandedPaliers(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    // ... existing handlers ...

    // (Kept handler code same)
    const handleCloseRun = async () => {
        const prevStatus = runStatus;
        onStatusChange?.("COMPLETED");
        setUpdating(true);
        const { closeDreamRun } = await import("@/server/actions/songes/dream-run-actions");
        const result = await closeDreamRun(guildId, runId);
        if (result.success) {
            toast.success("Run clôturée");
            onUpdate?.();
        } else {
            onStatusChange?.(prevStatus);
            toast.error(result.error);
        }
        setUpdating(false);
    };

    const handleReopenRun = async () => {
        const prevStatus = runStatus;
        onStatusChange?.("IN_PROGRESS");
        setUpdating(true);
        const { reopenDreamRun } = await import("@/server/actions/songes/dream-run-actions");
        const result = await reopenDreamRun(guildId, runId);
        if (result.success) {
            toast.success("Run réouverte");
            onUpdate?.();
        } else {
            onStatusChange?.(prevStatus);
            toast.error(result.error);
        }
        setUpdating(false);
    };

    const handleNodeClick = async (floor: number) => {
        if (!isLeader) return;
        setUpdating(true);
        const result = await updateCurrentFloor(guildId, runId, floor);
        setUpdating(false);
        if (!result.success) {
            toast.error(result.error);
        } else {
            toast.success(`Étage ${floor} défini`);
            onUpdate?.();
        }
    };

    return (
        <div className="w-full bg-[#05010a] rounded-xl border border-purple-500/20 flex flex-col items-center relative overflow-hidden min-h-[900px] shadow-2xl transition-all duration-500">
            {/* Background Texture */}
            <div className="absolute inset-0 z-0">
                <Image
                    src="/songes/background_dreams.png"
                    alt="Background"
                    fill
                    className="object-cover opacity-60 mix-blend-lighten pointer-events-none"
                    quality={100}
                />
                {runStatus === "COMPLETED" && (
                    <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center overflow-hidden">
                        <span className="text-9xl font-black text-amber-500/5 uppercase tracking-[0.3em] -rotate-45 whitespace-nowrap select-none">
                            Terminée
                        </span>
                    </div>
                )}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent,rgba(5,1,10,0.8)_80%)] pointer-events-none" />
                <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#05010a] to-transparent pointer-events-none" />
                <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#05010a] to-transparent pointer-events-none" />
            </div>

            {/* Scrollable Container with Smooth Scrolling */}
            <div className="w-full overflow-y-auto max-h-[900px] py-16 px-4 scrollbar-thin scrollbar-thumb-purple-900/50 scrollbar-track-transparent space-y-12 relative z-20 scroll-smooth">

                {/* Header Title */}
                <div className="text-center mb-12 relative z-30">
                    <div className="inline-block relative group cursor-default">
                        <h2 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-purple-100 to-purple-400/50 uppercase tracking-[0.1em] drop-shadow-[0_5px_15px_rgba(168,85,247,0.3)] transition-all group-hover:tracking-[0.15em]">
                            Run de {leaderName || "L'Inconnu"}
                        </h2>
                        <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-purple-500 to-transparent absolute bottom-0 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-purple-300/50 text-sm mt-3 font-mono uppercase tracking-[0.3em] flex items-center justify-center gap-4">
                        <span className="h-px w-12 bg-purple-500/30"></span>
                        Puits des Songes Infinis
                        <span className="h-px w-12 bg-purple-500/30"></span>
                    </p>
                </div>

                {/* Floor 0 Entrance (Always visible) */}
                <div className="flex flex-col items-center relative gap-6 mb-8 group">
                    {/* ... (Kept same portal code) ... */}
                    <div className="relative cursor-pointer transition-transform hover:scale-105 duration-500" onClick={() => handleNodeClick(0)}>
                        <div className="absolute inset-0 -m-8 rounded-full border border-dashed border-cyan-500/20 animate-[spin_20s_linear_infinite]" />
                        <div className="absolute inset-0 -m-4 rounded-full border border-cyan-500/30 animate-[spin_15s_linear_infinite_reverse]" />
                        <div className="absolute inset-0 bg-cyan-500/20 blur-2xl rounded-full animate-pulse" />
                        <div className={cn(
                            "relative w-24 h-24 rounded-full flex items-center justify-center border-2 shadow-[0_0_30px_rgba(6,182,212,0.3)] transition-all duration-300 backdrop-blur-md",
                            currentFloor === 0 ? "bg-cyan-950/80 border-cyan-400 text-cyan-100 scale-110 shadow-[0_0_50px_rgba(6,182,212,0.5)]" : "bg-black/60 border-cyan-900/50 text-cyan-700 hover:border-cyan-500/50 hover:text-cyan-400"
                        )}>
                            <div className="absolute inset-0 rounded-full bg-gradient-to-b from-cyan-500/10 to-transparent" />
                            <span className="text-3xl font-bold z-10">0</span>
                            {currentFloor > 0 && (
                                <div className="absolute -bottom-2 -right-2 bg-black rounded-full p-1 border border-cyan-500/50 shadow-lg">
                                    <CheckCircle2 className="w-5 h-5 text-cyan-400" />
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <span className="text-base font-bold uppercase tracking-widest text-cyan-800 group-hover:text-cyan-500 transition-colors">Portail Dimensionnel</span>
                    </div>
                    <div className="h-16 w-px bg-gradient-to-b from-cyan-500/50 to-transparent relative overflow-hidden mt-2" />
                </div>

                {PALIERS_DATA.slice().reverse().map((palier) => {
                    const isExpanded = expandedPaliers.includes(palier.id);
                    return (
                        <div key={palier.id} className="relative w-full max-w-6xl mx-auto transition-all duration-500">

                            {/* Palier Header / Toggle */}
                            <div
                                onClick={() => togglePalier(palier.id)}
                                className="flex items-center gap-6 mb-8 cursor-pointer group select-none"
                            >
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:via-white/20 transition-all" />
                                <div className={cn(
                                    "px-8 py-3 rounded-full border shadow-[0_0_30px_rgba(0,0,0,0.5)] z-10 relative transition-all duration-300 flex items-center gap-3 backdrop-blur-md",
                                    isExpanded ? "bg-[#0f0518]/90 border-white/20" : "bg-black/50 border-white/5 opacity-70 hover:opacity-100"
                                )}>
                                    <h3 className="text-xl font-bold tracking-[0.2em] uppercase text-center flex items-center gap-3" style={{ color: palier.color }}>
                                        <span className={cn("transition-transform duration-300", isExpanded ? "rotate-180" : "")}>▼</span>
                                        {palier.nom}
                                        <span className={cn("transition-transform duration-300", isExpanded ? "rotate-180" : "")}>▼</span>
                                    </h3>
                                </div>
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:via-white/20 transition-all" />
                            </div>

                            {/* Content Grid (Collapsible) */}
                            <div className={cn(
                                "grid overflow-hidden transition-all duration-700 ease-in-out",
                                isExpanded ? "grid-rows-[1fr] opacity-100 mb-16" : "grid-rows-[0fr] opacity-0 mb-0"
                            )}>
                                <div className="min-h-0 flex flex-wrap justify-center gap-12 md:gap-16 relative px-4 py-12 perspective-[2000px]">

                                    {Array.from({ length: palier.max - palier.min + 1 }, (_, i) => palier.min + i).map((floor, idx, arr) => (
                                        <div key={floor} className="relative group/node">

                                            <FloorNode
                                                floor={floor}
                                                type={getFloorType(floor)}
                                                isCurrent={currentFloor === floor}
                                                isCompleted={floor < currentFloor}
                                                isLocked={floor > currentFloor}
                                                isLeader={isLeader}
                                                onClick={() => handleNodeClick(floor)}
                                                customColor={palier.color}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* FINAL BOSS SECTION - WRAPPED IN COLLAPSIBLE */}
                {(() => {
                    const bossPalierId = 26;
                    const isExpanded = expandedPaliers.includes(bossPalierId);
                    return (
                        <div className="relative w-full max-w-6xl mx-auto transition-all duration-500 pb-20">
                            {/* Boss Header Toggle */}
                            <div onClick={() => togglePalier(bossPalierId)} className="flex items-center gap-6 mb-8 cursor-pointer group select-none">
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-500/20 to-transparent group-hover:via-amber-500/40 transition-all" />
                                <div className={cn("px-8 py-3 rounded-full border shadow-[0_0_30px_rgba(245,158,11,0.2)] z-10 relative transition-all duration-300 flex items-center gap-3 backdrop-blur-md", isExpanded ? "bg-amber-950/30 border-amber-500/30" : "bg-black/50 border-amber-500/10 opacity-70 hover:opacity-100")}>
                                    <h3 className="text-xl font-bold tracking-[0.2em] uppercase text-center flex items-center gap-3 text-amber-500">
                                        <span className={cn("transition-transform duration-300", isExpanded ? "rotate-180" : "")}>▼</span>
                                        Combat Final
                                        <span className={cn("transition-transform duration-300", isExpanded ? "rotate-180" : "")}>▼</span>
                                    </h3>
                                </div>
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-500/20 to-transparent group-hover:via-amber-500/40 transition-all" />
                            </div>

                            <div className={cn(
                                "grid overflow-hidden transition-all duration-700 ease-in-out",
                                isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                            )}>
                                <div className="min-h-0 flex flex-col items-center gap-8 perspective-[2000px] py-8">
                                    <FloorNode floor={26} type="BOSS" isCurrent={currentFloor === 26} isCompleted={currentFloor > 26} isLocked={false} isLeader={isLeader} onClick={() => handleNodeClick(26)} description="Gardiens des Songes" customColor="#f59e0b" />

                                    {/* Leader Actions */}
                                    {isLeader && currentFloor >= 26 && (
                                        <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                                            {runStatus === "IN_PROGRESS" && (
                                                <>
                                                    <p className="text-amber-500/60 text-sm uppercase tracking-widest mb-4">L'aventure touche à sa fin</p>
                                                    <button onClick={handleCloseRun} disabled={updating} className="group relative px-8 py-3 bg-[#05010a] border border-amber-500/50 text-amber-500 font-bold uppercase tracking-widest hover:bg-amber-500 hover:text-black transition-all duration-300 shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_40px_rgba(245,158,11,0.6)] disabled:opacity-50">
                                                        <span className="relative z-10 flex items-center gap-2">
                                                            {updating ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                                                            Clôturer la run
                                                        </span>
                                                    </button>
                                                </>
                                            )}
                                            {runStatus === "COMPLETED" && (
                                                <>
                                                    <p className="text-purple-400/60 text-sm uppercase tracking-widest mb-4">Le rêve est scellé</p>
                                                    <button onClick={handleReopenRun} disabled={updating} className="group relative px-8 py-3 bg-[#05010a] border border-white/20 text-white font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-all duration-300 shadow-lg disabled:opacity-50">
                                                        <span className="relative z-10 flex items-center gap-2">{updating ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlayCircle className="w-5 h-5" />} Réouvrir le portail</span>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })()}

            </div>

            {updating && (
                <div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center backdrop-blur-sm animate-in fade-in duration-500">
                    <div className="flex flex-col items-center gap-6">
                        <div className="relative">
                            <div className="absolute inset-0 bg-purple-500/30 blur-xl rounded-full animate-pulse" />
                            <Loader2 className="w-16 h-16 text-purple-400 animate-spin relative z-10" />
                        </div>
                        <span className="text-purple-200 font-medium tracking-[0.3em] uppercase animate-pulse text-sm">Voyage Onirique...</span>
                    </div>
                </div>
            )}
        </div>
    );
}

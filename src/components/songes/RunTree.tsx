"use client";

import { useEffect, useRef, useState } from "react";
import { updateCurrentFloor } from "@/server/actions/songes/dream-run-actions";
import Image from "next/image";
import { Loader2, CheckCircle2, PlayCircle, Waves, ChevronRight } from "lucide-react";
import { type RoomTypeKey } from "@/lib/songes/types";
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
    { id: 1, nom: "Les Pensées oniriques", floors: [1, 2, 3], color: "#10b981", hex: "10b981" },
    { id: 2, nom: "Les Balades fantastiques", floors: [4, 5, 6, 7, 8, 9], color: "#3b82f6", hex: "3b82f6" },
    { id: 3, nom: "Les Espaces imaginaires", floors: [10, 11, 12, 13, 14, 15], color: "#ec4899", hex: "ec4899" },
    { id: 4, nom: "Les Concepts brumeux", floors: [16, 17, 18, 19, 20, 21], color: "#ef4444", hex: "ef4444" },
    { id: 5, nom: "Les Abstractions chimériques", floors: [22, 23, 24, 25], color: "#f59e0b", hex: "f59e0b" },
] as const;

// Chiffres romains
const ROMAN = ["I", "II", "III", "IV", "V"] as const;

/* ─────────────────────────────────────────────── */
/*  Tilt Card — réutilisable                       */
/* ─────────────────────────────────────────────── */
function TiltCard({
    className,
    children,
    onClick,
    disabled,
}: {
    className?: string;
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
}) {
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const mouseX = useSpring(x, { stiffness: 600, damping: 120 });
    const mouseY = useSpring(y, { stiffness: 600, damping: 120 });
    const rotateX = useTransform(mouseY, [-0.5, 0.5], ["12deg", "-12deg"]);
    const rotateY = useTransform(mouseX, [-0.5, 0.5], ["-12deg", "12deg"]);

    function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
        const rect = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - rect.left) / rect.width - 0.5);
        y.set((e.clientY - rect.top) / rect.height - 0.5);
    }
    function onMouseLeave() { x.set(0); y.set(0); }

    return (
        <motion.div
            onClick={disabled ? undefined : onClick}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
            style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
            className={cn("transition-transform duration-200", className)}
        />
    );
}

/* ─────────────────────────────────────────────── */
/*  Floor Node                                     */
/* ─────────────────────────────────────────────── */
interface FloorNodeProps {
    floor: number;
    isCurrent: boolean;
    isCompleted: boolean;
    isLocked: boolean;
    isLeader: boolean;
    palierColor: string;
    onClick: () => void;
}

function FloorNode({ floor, isCurrent, isCompleted, isLocked, isLeader, palierColor, onClick }: FloorNodeProps) {
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const mouseX = useSpring(x, { stiffness: 500, damping: 100 });
    const mouseY = useSpring(y, { stiffness: 500, damping: 100 });
    const rotateX = useTransform(mouseY, [-0.5, 0.5], ["14deg", "-14deg"]);
    const rotateY = useTransform(mouseX, [-0.5, 0.5], ["-14deg", "14deg"]);

    const canClick = isLeader || (!isLocked && isCurrent);

    function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
        const rect = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - rect.left) / rect.width - 0.5);
        y.set((e.clientY - rect.top) / rect.height - 0.5);
    }
    function onMouseLeave() { x.set(0); y.set(0); }

    return (
        <div className="flex flex-col items-center gap-3 perspective-[1000px]">
            <motion.div
                onClick={canClick ? onClick : undefined}
                onMouseMove={onMouseMove}
                onMouseLeave={onMouseLeave}
                style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
                className={cn(
                    "relative w-16 h-16 flex items-center justify-center transition-all duration-200",
                    canClick ? "cursor-pointer" : "cursor-default",
                    isLocked && !isLeader && "opacity-40 grayscale-[0.6]",
                )}
            >
                {/* Shadow / glow */}
                {isCurrent && (
                    <div
                        className="absolute inset-0 rounded-full blur-[20px] opacity-40 animate-pulse pointer-events-none"
                        style={{ background: palierColor, transform: "translateZ(-20px) scale(1.4)" }}
                    />
                )}

                {/* Token image */}
                <div
                    className="relative w-14 h-14"
                    style={{
                        transform: "translateZ(20px)",
                        maskImage: "radial-gradient(circle at center, black 55%, transparent 72%)",
                        WebkitMaskImage: "radial-gradient(circle at center, black 55%, transparent 72%)",
                    }}
                >
                    <Image
                        src="/songes/combat_token.png"
                        alt={`Étage ${floor}`}
                        fill
                        className={cn("object-contain", isCurrent && "brightness-110")}
                    />
                </div>

                {/* Checkmark */}
                {isCompleted && (
                    <div className="absolute -bottom-1 -right-1 z-10" style={{ transform: "translateZ(30px)" }}>
                        <div className="bg-emerald-500 rounded-full p-0.5 border border-black/60 shadow">
                            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                        </div>
                    </div>
                )}
            </motion.div>

            {/* Label étage */}
            <span
                className={cn(
                    "text-xs font-black tracking-widest uppercase px-3 py-1 rounded-full border transition-all",
                    isCurrent
                        ? "bg-white text-black border-white  scale-110"
                        : isCompleted
                            ? "bg-white/15 text-white/70 border-white/15"
                            : "bg-black/40 text-white/35 border-white/10"
                )}
            >
                {floor}
            </span>
        </div>
    );
}

/* ─────────────────────────────────────────────── */
/*  Boss Node (MAJ 3.5 — Vagues infinies)          */
/* ─────────────────────────────────────────────── */
function BossNode({ isCurrent, isCompleted, isLeader, onClick }: {
    isCurrent: boolean;
    isCompleted: boolean;
    isLeader: boolean;
    onClick: () => void;
}) {
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const mouseX = useSpring(x, { stiffness: 500, damping: 100 });
    const mouseY = useSpring(y, { stiffness: 500, damping: 100 });
    const rotateX = useTransform(mouseY, [-0.5, 0.5], ["12deg", "-12deg"]);
    const rotateY = useTransform(mouseX, [-0.5, 0.5], ["-12deg", "12deg"]);

    function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
        const rect = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - rect.left) / rect.width - 0.5);
        y.set((e.clientY - rect.top) / rect.height - 0.5);
    }
    function onMouseLeave() { x.set(0); y.set(0); }

    return (
        <div className="flex flex-col items-center gap-4 perspective-[1200px]">
            <motion.div
                onClick={(isLeader || isCompleted) ? onClick : undefined}
                onMouseMove={onMouseMove}
                onMouseLeave={onMouseLeave}
                style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
                className={cn(
                    "relative w-52 h-52 flex items-center justify-center",
                    (isLeader || isCompleted) ? "cursor-pointer" : "cursor-default"
                )}
            >
                {/* Aura */}
                <div
                    className={cn(
                        "absolute inset-8 rounded-full bg-amber-500/20 blur-[50px] transition-all duration-300",
                        isCurrent && "bg-amber-500/40 blur-[70px]"
                    )}
                    style={{ transform: "translateZ(-40px)" }}
                />
                {/* Orbital rings */}
                <div className="absolute inset-0 rounded-full border border-dashed border-amber-500/15 animate-[spin_40s_linear_infinite] pointer-events-none" />
                <div className="absolute inset-4 rounded-full border border-amber-500/10 animate-[spin_25s_linear_infinite_reverse] pointer-events-none" />

                {/* Token */}
                <div
                    className="relative w-40 h-40"
                    style={{
                        transform: "translateZ(20px)",
                        maskImage: "radial-gradient(circle at center, black 60%, transparent 72%)",
                        WebkitMaskImage: "radial-gradient(circle at center, black 60%, transparent 72%)",
                    }}
                >
                    <Image
                        src="/songes/boss_token.png"
                        alt="Combat Final"
                        fill
                        className={cn("object-contain", isCurrent && "brightness-110")}
                        priority
                    />
                </div>

                {/* Checkmark */}
                {isCompleted && (
                    <div className="absolute bottom-6 right-6 z-10" style={{ transform: "translateZ(50px)" }}>
                        <div className="bg-amber-500 text-black rounded-full p-2 shadow-lg animate-in zoom-in spin-in-180">
                            <CheckCircle2 className="w-6 h-6" />
                        </div>
                    </div>
                )}
            </motion.div>

            {/* Label boss */}
            <div className="text-center space-y-1">
                <h4 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-100 to-amber-600 uppercase tracking-widest drop-shadow-[0_4px_12px_rgba(245,158,11,0.5)]">
                    Combat Final
                </h4>
                {/* Badge MAJ 3.5 */}
                <div className="flex items-center justify-center gap-2">
                    <Waves className="w-3.5 h-3.5 text-amber-400/70" />
                    <span className="text-caption font-bold text-amber-400/70 uppercase tracking-wider">
                        Vagues infinies
                    </span>
                    <Waves className="w-3.5 h-3.5 text-amber-400/70" />
                </div>
                <p className="text-caption text-white/25 tracking-wider">
                    Enchaînez les vagues pour maximiser vos Bribes de Rêve
                </p>
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────────── */
/*  RunTree principal                              */
/* ─────────────────────────────────────────────── */
export function RunTree({ guildId, currentFloor, runId, isLeader, runStatus, leaderName, onStatusChange, onUpdate }: RunTreeProps) {
    const [updating, setUpdating] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const activeRef = useRef<HTMLDivElement>(null);

    // Auto-scroll vers l'étage actif au chargement et au changement
    useEffect(() => {
        if (activeRef.current && scrollRef.current) {
            // Légère temporisation pour laisser le DOM se stabiliser
            const timer = setTimeout(() => {
                activeRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                });
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [currentFloor]);

    const handleCloseRun = async () => {
        const prevStatus = runStatus;
        onStatusChange?.("COMPLETED");
        setUpdating(true);
        const { closeDreamRun } = await import("@/server/actions/songes/dream-run-actions");
        const result = await closeDreamRun(guildId, runId);
        if (result.success) { toast.success("Run clôturée"); onUpdate?.(); }
        else { onStatusChange?.(prevStatus); toast.error(result.error); }
        setUpdating(false);
    };

    const handleReopenRun = async () => {
        const prevStatus = runStatus;
        onStatusChange?.("IN_PROGRESS");
        setUpdating(true);
        const { reopenDreamRun } = await import("@/server/actions/songes/dream-run-actions");
        const result = await reopenDreamRun(guildId, runId);
        if (result.success) { toast.success("Run réouverte"); onUpdate?.(); }
        else { onStatusChange?.(prevStatus); toast.error(result.error); }
        setUpdating(false);
    };

    const handleNodeClick = async (floor: number) => {
        if (!isLeader) return;
        setUpdating(true);
        const result = await updateCurrentFloor(guildId, runId, floor);
        setUpdating(false);
        if (!result.success) toast.error(result.error);
        else { toast.success(`Étage ${floor === 0 ? "Portail" : floor === 26 ? "Combat Final" : floor} défini`); onUpdate?.(); }
    };

    const isBossActive = currentFloor === 26;
    const isBossCompleted = currentFloor > 26;

    return (
        <div className="w-full bg-[#05010a] rounded-xl border border-white/10 flex flex-col relative overflow-hidden shadow-2xl">
            {/* ── Background ── */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <Image
                    src="/songes/background_dreams.png"
                    alt="Background"
                    fill
                    className="object-cover opacity-50 mix-blend-lighten"
                    quality={80}
                />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(5,1,10,0.85)_80%)]" />
                <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#05010a] to-transparent" />
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#05010a] to-transparent" />
                {/* Watermark si run terminée */}
                {runStatus === "COMPLETED" && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden">
                        <span className="text-8xl font-black text-amber-500/4 uppercase tracking-widest -rotate-45 select-none whitespace-nowrap">
                            Terminée
                        </span>
                    </div>
                )}
            </div>

            {/* ── Header ── */}
            <div className="relative z-20 px-6 pt-6 pb-2 text-center">
                <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-white/80 to-white/40 uppercase tracking-[0.12em] transition-all">
                    Run de {leaderName || "L'Inconnu"}
                </h2>
                <div className="flex items-center justify-center gap-3 mt-1">
                    <div className="h-px w-10 bg-white/15" />
                    <p className="text-white/30 text-xs font-mono uppercase tracking-widest">
                        Puits des Songes Infinis
                    </p>
                    <div className="h-px w-10 bg-white/15" />
                </div>
            </div>

            {/* ── Scrollable Timeline ── */}
            <div
                ref={scrollRef}
                className="relative z-20 overflow-y-auto max-h-[800px] py-8 px-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent scroll-smooth"
            >
                {/* ── Portail d'entrée ── */}
                <div
                    ref={currentFloor === 0 ? activeRef : undefined}
                    className="flex flex-col items-center mb-10"
                >
                    <div
                        onClick={isLeader ? () => handleNodeClick(0) : undefined}
                        className={cn(
                            "relative w-20 h-20 rounded-full flex items-center justify-center border-2 transition-all duration-300 backdrop-blur-md",
                            isLeader && "cursor-pointer",
                            currentFloor === 0
                                ? "bg-cyan-950/80 border-cyan-400  scale-110"
                                : "bg-black/60 border-cyan-900/50 hover:border-cyan-600/50"
                        )}
                    >
                        <div className="absolute inset-0 rounded-full border border-dashed border-cyan-400/20 animate-[spin_20s_linear_infinite]" />
                        <div className="absolute inset-0 bg-cyan-500/10 blur-xl rounded-full animate-pulse" />
                        <div className="relative z-10 w-12 h-12">
                            <Image
                                src="/assets/songes/départ.png"
                                alt="Départ"
                                fill
                                className="object-contain"
                            />
                        </div>
                        {currentFloor > 0 && (
                            <div className="absolute -bottom-1 -right-1 bg-black rounded-full p-0.5 border border-cyan-500/50">
                                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                            </div>
                        )}
                    </div>
                    <span className="mt-2 text-caption font-black uppercase tracking-widest text-cyan-700">
                        Portail Dimensionnel
                    </span>
                    {/* Connecteur vers palier I */}
                    <TimelineConnector />
                </div>

                {/* ── Paliers I à V ── */}
                {PALIERS_DATA.map((palier, palierIdx) => {
                    const palierMin = palier.floors[0];
                    const palierMax = palier.floors[palier.floors.length - 1];
                    const isActivePalier = currentFloor >= palierMin && currentFloor <= palierMax;
                    const isPalierCompleted = currentFloor > palierMax;

                    return (
                        <div key={palier.id} className="relative flex gap-4 mb-0">
                            {/* ── Barre latérale colorée (palier indicator) ── */}
                            <div className="flex flex-col items-center shrink-0 w-10">
                                {/* Numéro du palier */}
                                <div
                                    className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center text-caption font-black border-2 transition-all duration-300 shrink-0",
                                        isActivePalier
                                            ? "scale-110  border-current"
                                            : isPalierCompleted
                                                ? "opacity-50 border-white/10"
                                                : "opacity-30 border-white/5"
                                    )}
                                    style={{
                                        color: palier.color,
                                        borderColor: isActivePalier ? palier.color : undefined,
                                        // @ts-ignore
                                        "--p-glow": palier.color + "66",
                                    }}
                                >
                                    {ROMAN[palierIdx]}
                                </div>

                                {/* Ligne verticale colorée */}
                                <div
                                    className="w-0.5 flex-1 min-h-[120px] transition-opacity duration-300"
                                    style={{
                                        background: `linear-gradient(to bottom, ${palier.color}${isActivePalier ? "80" : "20"}, ${palier.color}10)`,
                                    }}
                                />
                            </div>

                            {/* ── Contenu du palier ── */}
                            <div className="flex-1 pb-8">
                                {/* Nom du palier */}
                                <p
                                    className={cn(
                                        "text-sm font-black uppercase tracking-[0.12em] mb-4 transition-all duration-300",
                                        isActivePalier ? "opacity-100" : isPalierCompleted ? "opacity-50" : "opacity-30"
                                    )}
                                    style={{ color: palier.color }}
                                >
                                    Palier {ROMAN[palierIdx]} — {palier.nom}
                                </p>

                                {/* Grille d'étages */}
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-x-4 gap-y-6">
                                    {palier.floors.map((floor) => {
                                        const isActive = currentFloor === floor;
                                        const isDone = floor < currentFloor;
                                        const isLocked = floor > currentFloor;

                                        return (
                                            <div
                                                key={floor}
                                                ref={isActive ? activeRef : undefined}
                                            >
                                                <FloorNode
                                                    floor={floor}
                                                    isCurrent={isActive}
                                                    isCompleted={isDone}
                                                    isLocked={isLocked}
                                                    isLeader={isLeader}
                                                    palierColor={palier.color}
                                                    onClick={() => handleNodeClick(floor)}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* ── Connecteur vers Boss ── */}
                <div className="ml-10 pl-4">
                    <TimelineConnector color="rgba(245,158,11,0.4)" />
                </div>

                {/* ── Combat Final (Salle 26 — Vagues Infinies) ── */}
                <div
                    ref={isBossActive ? activeRef : undefined}
                    className="flex flex-col items-center mt-4 pb-8"
                >
                    <BossNode
                        isCurrent={isBossActive}
                        isCompleted={isBossCompleted}
                        isLeader={isLeader}
                        onClick={() => handleNodeClick(26)}
                    />

                    {/* ── Actions du leader ── */}
                    {isLeader && currentFloor >= 26 && (
                        <div className="mt-8 flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            {runStatus === "IN_PROGRESS" && (
                                <>
                                    <p className="text-amber-500/50 text-xs uppercase tracking-widest text-center">
                                        Le rêve touche à sa fin
                                    </p>
                                    <button
                                        onClick={handleCloseRun}
                                        disabled={updating}
                                        className="flex items-center gap-2 px-8 py-3 bg-[#05010a] border border-amber-500/50 text-amber-500 font-bold uppercase tracking-widest text-sm hover:bg-amber-500 hover:text-black transition-all duration-300   disabled:opacity-50"
                                    >
                                        {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                        Clôturer la run
                                    </button>
                                </>
                            )}
                            {runStatus === "COMPLETED" && (
                                <>
                                    <p className="text-white/30 text-xs uppercase tracking-widest text-center">
                                        Le rêve est scellé
                                    </p>
                                    <button
                                        onClick={handleReopenRun}
                                        disabled={updating}
                                        className="flex items-center gap-2 px-8 py-3 bg-[#05010a] border border-white/20 text-white font-bold uppercase tracking-widest text-sm hover:bg-white hover:text-black transition-all duration-300 shadow-lg disabled:opacity-50"
                                    >
                                        {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                                        Réouvrir le portail
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Legend compacte en bas ── */}
            <div className="relative z-20 border-t border-white/5 px-5 py-3 flex items-center gap-4 flex-wrap">
                <LegendItem color="bg-emerald-500" label="Étage actif" />
                <LegendItem color="bg-white/20" label="Terminé" />
                <LegendItem color="bg-white/5" label="Verrouillé" />
                {isLeader && (
                    <span className="ml-auto text-caption text-white/20 uppercase tracking-widest">
                        {isLeader && "Cliquer pour définir l'étage"}
                    </span>
                )}
            </div>

            {/* ── Overlay chargement ── */}
            {updating && (
                <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative">
                            <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full animate-pulse" />
                            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin relative z-10" />
                        </div>
                        <span className="text-white/60 font-medium tracking-widest uppercase text-xs animate-pulse">
                            Voyage Onirique...
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─────────────────────────────────────────────── */
/*  Helpers UI                                     */
/* ─────────────────────────────────────────────── */
function TimelineConnector({ color = "rgba(139,92,246,0.3)" }: { color?: string }) {
    return (
        <div className="flex flex-col items-center my-1" style={{ minHeight: "32px" }}>
            <div className="w-px h-6" style={{ background: `linear-gradient(to bottom, ${color}, transparent)` }} />
            <ChevronRight className="w-3 h-3 rotate-90 opacity-20" style={{ color }} />
        </div>
    );
}

function LegendItem({ color, label }: { color: string; label: string }) {
    return (
        <div className="flex items-center gap-1.5">
            <div className={cn("w-2 h-2 rounded-full", color)} />
            <span className="text-caption text-white/25 uppercase tracking-wider">{label}</span>
        </div>
    );
}

"use client";

import React from "react";
import { Socket } from "socket.io-client";
import { useGarticCanvas } from "../../hooks/useGarticCanvas";
import { cn } from "@/lib/utils";
import { CircularTimer } from "./CircularTimer";

interface Player {
    id: string;
    username: string;
    dofusClass?: string;
    hasSubmitted?: boolean;
}

interface DrawingScreenProps {
    isDrawer: boolean;
    word?: string;
    wordHint?: string;
    drawerName: string;
    socket: Socket;
    roomId: string;
    timeLeft: number;
    totalTime: number;
    players?: Player[];
    round?: number;
    totalRounds?: number;
    onClose?: () => void;
    isSpectator?: boolean;
}

export const DrawingScreen = ({ 
    isDrawer, 
    word, 
    wordHint, 
    drawerName, 
    socket, 
    roomId, 
    timeLeft, 
    totalTime, 
    players = [],
    round = 1,
    totalRounds = 1,
    onClose,
    isSpectator
}: DrawingScreenProps) => {
    const { canvasRef, overlayRef, tool, setTool, color, setColor, brushSize, setBrushSize, canUndo, canRedo, undo, redo, clear, handlers } = useGarticCanvas({ isDrawer: isDrawer && !isSpectator, socket, roomId });
    const [submitted, setSubmitted] = React.useState(false);

    const handleValidate = React.useCallback(() => {
        if (submitted || !isDrawer || isSpectator) return;
        const canvas = canvasRef.current;
        if (canvas) {
            const dataUrl = canvas.toDataURL("image/png");
            socket.emit("gartic:draw:submit", { dataUrl });
            setSubmitted(true);
        }
    }, [submitted, isDrawer, isSpectator, canvasRef, socket]);

    React.useEffect(() => {
        if (isDrawer && timeLeft <= 1 && !submitted) {
            handleValidate();
        }
    }, [timeLeft, isDrawer, submitted, handleValidate]);

    const COLORS = [
        "#000000", "#7f7f7f", "#880015", "#ed1c24", "#ff7f27", "#fff200", "#22b14c", "#00a2e8", "#3f48cc", "#a349a4",
        "#ffffff", "#c3c3c3", "#b97a57", "#ffaec9", "#ffc90e", "#efe4b0", "#b5e61d", "#99d9ea", "#7092be", "#c8bfe7",
    ];

    const BRUSH_SIZES = [4, 8, 14, 24, 40];

    return (
        <div className="flex flex-col items-center justify-center w-full max-w-[98vw] h-full animate-in zoom-in-95 duration-500 relative py-2 md:py-12 overflow-hidden">
            {/* Round Counter */}
            <div className="absolute top-2 md:top-4 left-4 md:left-6 z-50 flex flex-col items-start select-none">
                <span className="text-white/40 font-black text-[8px] md:text-sm tracking-[0.2em] md:tracking-[0.3em] uppercase italic">ROUND</span>
                <span className="text-white font-black text-2xl md:text-6xl italic drop-shadow-[0_5px_0_rgba(0,0,0,0.2)]">
                    {round}<span className="text-white/30 text-lg md:text-4xl">/{totalRounds}</span>
                </span>
            </div>

            <div className="w-full bg-white/10 backdrop-blur-xl border-[4px] md:border-[8px] border-white/10 rounded-[2rem] md:rounded-[4rem] p-2 md:p-10 flex flex-col gap-3 md:gap-10 relative shadow-2xl overflow-visible mt-12 md:mt-8 shrink-0 min-h-0 grow">
                
                {/* Purple Card Header */}
                <div className="w-full bg-[#5d3fd3] rounded-xl md:rounded-[2.5rem] p-3 md:p-8 relative overflow-hidden shadow-2xl -mt-8 md:-mt-24 border-b-[4px] md:border-b-[10px] border-black/20 flex flex-col md:flex-row items-center justify-between z-20 gap-2 md:gap-4 shrink-0">
                    <div className="flex flex-col gap-0.5 md:gap-1 text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-1 md:gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
                            <span className="text-white/40 font-black text-[6px] md:text-xs tracking-widest uppercase italic">
                                {isSpectator ? "OBSERVEUR" : "TON TOUR DE DESSINER"}
                            </span>
                        </div>
                        <h2 className="text-white text-lg md:text-6xl font-black uppercase tracking-tighter italic drop-shadow-lg leading-tight">
                            {isSpectator ? "LES ARTISTES SÉVISSENT..." : word}
                        </h2>
                    </div>

                    <div className="flex items-center gap-3 md:gap-8">
                         {isDrawer && (
                            <button
                                onClick={handleValidate}
                                disabled={submitted}
                                className={cn(
                                    "px-4 md:px-12 py-2 md:py-5 rounded-xl md:rounded-3xl font-black text-white text-xs md:text-2xl uppercase tracking-tighter transition-all shadow-2xl group relative overflow-hidden",
                                    submitted
                                        ? "bg-gray-500 border-b-2 md:border-b-8 border-gray-700 opacity-50 cursor-not-allowed"
                                        : "bg-[#2ed573] hover:bg-[#26af5f] border-b-[4px] md:border-b-[10px] border-[#1e9b53] active:translate-y-1 md:active:translate-y-2 active:border-b-0"
                                )}
                            >
                                <span className="relative z-10">{submitted ? "ENVOYÉ ✓" : "TERMINÉ !"}</span>
                            </button>
                        )}
                        <div className="scale-75 md:scale-125">
                            <CircularTimer remaining={timeLeft} total={totalTime} />
                        </div>
                    </div>

                    {/* Spiral effect */}
                    <div className="absolute top-[-15px] md:top-[-25px] left-1/2 -translate-x-1/2 w-3/4 flex justify-around px-4 md:px-10 pointer-events-none">
                        {Array.from({length: 12}).map((_, i) => (
                            <div key={i} className="w-1.5 md:w-4 h-8 md:h-14 bg-white rounded-full border border-black/10 shadow-md" />
                        ))}
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-3 md:gap-8 min-h-0 w-full grow overflow-hidden">
                    {/* LEFT: Toolbar */}
                    <div className="w-full lg:w-32 flex flex-row lg:flex-col gap-2 md:gap-6 shrink-0 h-[60px] md:h-auto lg:h-full">
                        {/* Tools */}
                        <div className="bg-white/95 rounded-xl md:rounded-[2.5rem] p-1.5 md:p-4 flex flex-row lg:flex-col gap-1.5 md:gap-3 shadow-2xl border-b-[4px] md:border-b-[10px] border-black/10 flex-1 lg:flex-none h-full">
                            {[
                                { id: "pencil", icon: "✎" },
                                { id: "bucket", icon: "🪣" },
                                { id: "erase_all", icon: "🧹" }
                            ].map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => t.id === "erase_all" ? clear() : setTool(t.id as any)}
                                    className={cn(
                                        "w-full aspect-square md:aspect-auto md:h-16 lg:aspect-square rounded-lg md:rounded-2xl flex items-center justify-center text-sm md:text-3xl transition-all border-b-[3px] md:border-b-[6px]",
                                        tool === t.id ? "bg-[#5d3fd3] text-white border-[#3d2080] scale-105 shadow-lg" : "bg-slate-100 text-[#3d2080] border-slate-300 hover:bg-white"
                                    )}
                                >
                                    {t.icon}
                                </button>
                            ))}
                        </div>

                        {/* Colors */}
                        <div className="flex-[3] lg:flex-1 bg-white/95 rounded-xl md:rounded-[2.5rem] p-1.5 md:p-4 shadow-2xl border-b-[4px] md:border-b-[10px] border-black/10 overflow-hidden h-full">
                            <div className="grid grid-cols-10 lg:grid-cols-2 gap-1 md:gap-3 h-full overflow-y-auto lg:overflow-y-visible">
                                {COLORS.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setColor(c)}
                                        className={cn(
                                            "w-full aspect-square rounded-md md:rounded-xl border md:border-4 transition-all hover:scale-125",
                                            color === c ? "ring-1 md:ring-4 ring-[#5d3fd3]/30 scale-125 border-white shadow-lg" : "border-black/5"
                                        )}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* CENTER: Canvas */}
                    <div className="flex-1 bg-white rounded-2xl md:rounded-[3rem] shadow-2xl relative overflow-hidden flex items-center justify-center p-2 md:p-8 border-b-[6px] md:border-b-[14px] border-black/10 group min-w-0 h-full min-h-[200px]">
                         {/* Spiral decorations */}
                         <div className="absolute top-0 left-0 w-full flex justify-around px-8 md:px-24 opacity-10 pointer-events-none mt-2">
                            {Array.from({length: 12}).map((_, i) => (
                                <div key={i} className="w-1.5 md:w-3.5 h-6 md:h-12 bg-black rounded-full -mt-3 md:-mt-6 shadow-inner" />
                            ))}
                        </div>

                        <div className="w-full h-full relative flex items-center justify-center">
                            <canvas
                                ref={canvasRef}
                                width={1200}
                                height={600}
                                className="w-full h-full object-contain touch-none cursor-crosshair drop-shadow-sm transition-transform active:scale-[1.005]"
                                style={{ cursor: isDrawer ? "crosshair" : "default" }}
                                {...(isDrawer ? handlers : {})}
                            />
                            <canvas
                                ref={overlayRef}
                                width={1200}
                                height={600}
                                className="absolute inset-0 w-full h-full pointer-events-none object-contain"
                            />
                        </div>

                        {submitted && (
                            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center animate-in fade-in duration-500">
                                <div className="text-4xl md:text-8xl mb-3 md:mb-6 animate-bounce">🎨</div>
                                <h3 className="text-lg md:text-4xl font-black text-[#5d3fd3] uppercase italic tracking-tighter">C'EST ENVOYÉ !</h3>
                                <p className="text-slate-500 font-bold uppercase tracking-widest mt-1 md:mt-2 text-[8px] md:text-base">Attente des autres joueurs...</p>
                            </div>
                        )}
                    </div>

                    {/* RIGHT: Brush Sizes & Player Status */}
                    <div className="hidden lg:flex w-48 flex-col gap-6 shrink-0 overflow-hidden h-full">
                         {/* Brush Sizes */}
                         <div className="bg-white/95 rounded-[2.5rem] p-8 flex flex-col items-center justify-center gap-8 shadow-2xl border-b-[10px] border-black/10">
                            {BRUSH_SIZES.map(size => (
                                <button
                                    key={size}
                                    onClick={() => setBrushSize(size)}
                                    className={cn(
                                        "rounded-full transition-all hover:scale-150",
                                        brushSize === size 
                                            ? "bg-[#5d3fd3] ring-[4px] ring-[#5d3fd3]/20 shadow-xl" 
                                            : "bg-slate-300 hover:bg-slate-400"
                                    )}
                                    style={{ width: size/2 + 8, height: size/2 + 8 }}
                                />
                            ))}
                        </div>

                        {/* Players */}
                        <div className="flex-1 bg-white/10 backdrop-blur-xl rounded-[2.5rem] border-4 border-white/20 p-6 flex flex-col shadow-2xl overflow-hidden min-h-0">
                             <div className="flex items-center gap-2 mb-6 px-1 shrink-0">
                                <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                                <span className="text-white/60 font-black text-xs uppercase tracking-[0.2em]">JOUEURS</span>
                            </div>
                            
                            <div className="flex flex-col gap-3 overflow-y-auto custom-scrollbar flex-1 pr-1">
                                {players.map(p => (
                                    <div key={p.id} className={cn(
                                        "flex items-center gap-4 p-4 rounded-2xl border-b-4 transition-all group",
                                        p.hasSubmitted 
                                            ? "bg-[#2ed573]/20 border-[#2ed573]/40 ring-1 ring-[#2ed573]/30" 
                                            : "bg-white/5 border-white/5 hover:bg-white/10"
                                    )}>
                                        <div className={cn(
                                            "w-3 h-3 rounded-full shadow-sm transition-all",
                                            p.hasSubmitted 
                                                ? "bg-[#2ed573] scale-110" 
                                                : "bg-white/20 animate-pulse group-hover:scale-125"
                                        )} />
                                        <span className={cn(
                                            "font-black text-sm truncate",
                                            p.hasSubmitted ? "text-white" : "text-white/40"
                                        )}>{p.username}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

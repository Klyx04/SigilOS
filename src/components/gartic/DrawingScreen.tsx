"use client";

import React from "react";
import { Socket } from "socket.io-client";
import { useGarticCanvas } from "../../hooks/useGarticCanvas";
import { cn } from "@/lib/utils";
import { CircularTimer } from "./CircularTimer";

interface DrawingScreenProps {
    isDrawer: boolean;
    word?: string;
    wordHint?: string;
    drawerName: string;
    socket: Socket;
    roomId: string;
    timeLeft: number;
    totalTime: number;
}

export const DrawingScreen = ({ isDrawer, word, wordHint, drawerName, socket, roomId, timeLeft, totalTime }: DrawingScreenProps) => {
    const canvas = useGarticCanvas({ isDrawer, socket, roomId });

    const DOFUS_COLORS = [
        "#1a1a1a", "#6c6c6c", "#4169e1",
        "#ffffff", "#a0a0a0", "#00bfff",
        "#228b22", "#8b0000", "#8b4513",
        "#32cd32", "#ff0000", "#ff8c00",
        "#daa520", "#8b008b", "#d2691e",
        "#ffd700", "#ff69b4", "#ffc0cb",
    ];

    const BRUSH_SIZES = [2, 4, 8, 14, 22];

    return (
        <div className="flex gap-4 items-start h-full">
            {/* Palette gauche */}
            <div className="flex flex-col gap-2 bg-black/20 p-3 rounded-2xl border border-white/20 w-32 shadow-xl backdrop-blur-sm">
                <div className="grid grid-cols-3 gap-1.5">
                    {DOFUS_COLORS.map((c) => (
                        <button
                            key={c}
                            onClick={() => canvas.setColor(c)}
                            className={cn(
                                "w-8 h-8 rounded-full border-2 transition-all hover:scale-110",
                                canvas.color === c ? "border-white scale-110" : "border-transparent"
                            )}
                            style={{ backgroundColor: c }}
                        />
                    ))}
                </div>
                <button
                    onClick={() => canvas.setColor("#000000")}
                    className={cn(
                        "w-full h-10 rounded-lg border-2 transition-all mt-2 hover:opacity-80",
                        canvas.color === "#000000" ? "border-white" : "border-transparent"
                    )}
                    style={{ backgroundColor: "#000000" }}
                />
                <div className="w-full h-10 rounded-lg border-2 border-white/50 mt-4 shadow-inner" style={{ backgroundColor: canvas.color }} />
            </div>

            {/* Zone centrale : Canvas + Header */}
            <div className="flex-1 flex flex-col gap-0 shadow-2xl rounded-2xl overflow-hidden">
                {/* Header canvas */}
                <div className="bg-[#3d2080] px-8 py-5 flex items-center justify-between shadow-2xl z-10 relative">
                    <div className="flex flex-col">
                        <span className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">Phase</span>
                        <span className="text-white font-black italic text-lg leading-tight uppercase tracking-wide">DESSINER</span>
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                        <h2 className="text-white text-3xl font-black tracking-widest drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)] italic uppercase">
                            {isDrawer ? `${word}` : `QUE DESSINE ${drawerName} ?`}
                        </h2>
                    </div>
                    <div className="flex items-center justify-end w-24">
                        <CircularTimer remaining={timeLeft} total={totalTime} />
                    </div>
                </div>

                {/* Canvas principal */}
                <div className="relative bg-white w-full h-[500px]" style={{ touchAction: "none" }}>
                    <canvas
                        ref={canvas.canvasRef}
                        width={800}
                        height={600}
                        className="w-full h-full object-contain"
                        style={{ cursor: isDrawer ? "crosshair" : "default", touchAction: "none" }}
                        {...(isDrawer ? canvas.handlers : {})}
                    />
                    <canvas
                        ref={canvas.overlayRef}
                        width={800}
                        height={600}
                        className="absolute inset-0 w-full h-full pointer-events-none object-contain"
                    />
                    {/* Hint mot (pour les non-drawers) */}
                    {!isDrawer && wordHint && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-6 py-3 rounded-full font-mono text-2xl tracking-[0.5em] shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                            {wordHint}
                        </div>
                    )}
                </div>

                {/* Barre de taille en bas */}
                <div className="bg-[#3d2080] px-6 py-4 flex items-center gap-6 shadow-md z-10 border-t-2 border-[#5430a6]">
                    {BRUSH_SIZES.map((size) => (
                        <button
                            key={size}
                            onClick={() => canvas.setBrushSize(size)}
                            className={cn(
                                "rounded-full bg-white transition-all shadow-inner",
                                canvas.brushSize === size ? "ring-2 ring-yellow-400 ring-offset-2 ring-offset-[#3d2080]" : "opacity-70 hover:opacity-100"
                            )}
                            style={{ width: size + 10, height: size + 10 }}
                        />
                    ))}
                    <div className="flex-1 opacity-50 text-white/50 text-center font-bold text-sm tracking-widest select-none">
                        {isDrawer ? "OUTILS DE DESSIN ACTIFS" : "MODE SPECTATEUR"}
                    </div>
                </div>
            </div>

            {/* Outils droite */}
            <div className="flex flex-col gap-3 bg-black/20 p-3 rounded-2xl border border-white/20 w-24 backdrop-blur-sm">
                {isDrawer && [
                    { icon: "✎", id: "pencil" },
                    { icon: "■", id: "rect-fill" },
                    { icon: "●", id: "circle-fill" },
                    { icon: "🪣", id: "bucket" }
                ].map(t => (
                    <button
                        key={t.id}
                        onClick={() => canvas.setTool(t.id as any)}
                        className={cn(
                            "p-4 rounded-xl font-bold transition-all text-xl hover:bg-white/20",
                            canvas.tool === t.id ? "bg-white/30 text-yellow-400 shadow-inner" : "bg-white/5 text-white"
                        )}
                    >
                        {t.icon}
                    </button>
                ))}

                <div className="h-[1px] bg-white/20 my-2" />

                {isDrawer && (
                    <>
                        <button onClick={canvas.undo} disabled={!canvas.canUndo} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl disabled:opacity-30 disabled:hover:bg-white/5 text-white transition-all">↩️</button>
                        <button onClick={canvas.redo} disabled={!canvas.canRedo} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl disabled:opacity-30 disabled:hover:bg-white/5 text-white transition-all">↪️</button>
                        <button onClick={canvas.clear} className="p-3 bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 rounded-xl transition-all">🗑️</button>
                    </>
                )}
            </div>
        </div>
    );
};

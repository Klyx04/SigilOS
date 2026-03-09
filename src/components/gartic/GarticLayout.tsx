"use client";

import React from "react";
import { GamePhase } from "../../types/socket-events";

export const GarticStarDecorations = () => {
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Simulation of stars or background patterns */}
            <div className="absolute w-2 h-2 bg-white rounded-full top-10 left-10 opacity-20" />
            <div className="absolute w-3 h-3 bg-white rounded-full top-40 right-20 opacity-30" />
            <div className="absolute w-1 h-1 bg-white rounded-full bottom-20 left-1/3 opacity-10" />
            {/* ... */}
        </div>
    );
};

export const GarticLayout = ({ phase, children }: { phase: GamePhase; children: React.ReactNode }) => {
    const bgMap: Record<GamePhase, string> = {
        LOBBY: "from-[#2d1b69] to-[#4a2d9e]",
        BRIEFING: "from-[#c0392b] to-[#e74c3c]",
        DRAWING: "from-[#c0392b] to-[#e74c3c]",
        GUESSING: "from-[#e67e22] to-[#f39c12]",
        INTERMISSION: "from-[#8e44ad] to-[#9b59b6]",
        REVEAL: "from-[#1a6fb5] to-[#2980b9]",
        SCORES: "from-[#1a6fb5] to-[#2980b9]",
    };

    return (
        <div className={`min-h-[800px] h-full w-full relative bg-gradient-to-br ${bgMap[phase]} transition-all duration-700 font-sans rounded-b-3xl`}>
            <GarticStarDecorations />
            <div className="max-w-5xl mx-auto px-4 py-6 relative z-10 h-full overflow-y-auto">
                {children}
            </div>
        </div>
    );
};

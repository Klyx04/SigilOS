"use client";

import React from "react";
import { cn } from "@/lib/utils";

export const CircularTimer = ({ remaining, total }: { remaining: number; total: number }) => {
    const radius = 45;
    const isUrgent = remaining <= 10;

    // Calcul de l'angle pour le camembert (sector)
    const angle = (remaining / total) * 360;
    const x = 50 + radius * Math.cos((angle - 90) * (Math.PI / 180));
    const y = 50 + radius * Math.sin((angle - 90) * (Math.PI / 180));
    const largeArcFlag = angle <= 180 ? 0 : 1;

    // Path du secteur (camembert)
    const d = remaining === total
        ? `M 50 50 m 0 -${radius} a ${radius} ${radius} 0 1 1 0 ${radius * 2} a ${radius} ${radius} 0 1 1 0 -${radius * 2}`
        : `M 50 50 L 50 ${50 - radius} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x} ${y} Z`;

    const ratio = remaining / total;
    const color = ratio > 0.6 ? "#2ecc71" : ratio > 0.3 ? "#f1c40f" : "#e74c3c";

    return (
        <div className={cn("relative w-24 h-24 drop-shadow-2xl", isUrgent && "animate-timerPulse")}>
            <svg className="w-full h-full" viewBox="0 0 100 100">
                {/* Background full circle */}
                <circle cx="50" cy="50" r={radius} fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="2" />
                {/* The Pie (Camembert) */}
                <path
                    d={remaining > 0 ? d : ""}
                    fill={color}
                    className="transition-all duration-1000 linear"
                    style={{ filter: isUrgent ? "brightness(1.2)" : "none" }}
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className={cn("text-3xl font-black text-white italic drop-shadow-md transition-all", isUrgent && "scale-110")}>
                    {remaining}
                </span>
            </div>
        </div>
    );
};

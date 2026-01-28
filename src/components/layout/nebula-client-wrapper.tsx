"use client";

import React from "react";

export function NebulaClientWrapper({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <style jsx global>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { 
                    -ms-overflow-style: none;  /* IE and Edge */
                    scrollbar-width: none;  /* Firefox */
                }
                .perspective-1000 { perspective: 1000px; }
                .preserve-3d { transform-style: preserve-3d; }
                .rotate-x-2 { transform: rotateX(2deg); }
                .rotate-y-6 { transform: rotateY(6deg); }
                .outline-glow {
                    -webkit-text-stroke: 1px rgba(255,255,255,0.1);
                    color: transparent;
                }
                @keyframes pulse-slow {
                    0%, 100% { opacity: 0.1; transform: scale(1); }
                    50% { opacity: 0.3; transform: scale(1.1); }
                }
                .animate-pulse-slow {
                    animation: pulse-slow 12s infinite ease-in-out;
                }
            `}</style>
        </>
    );
}

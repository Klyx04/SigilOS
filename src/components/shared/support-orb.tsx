"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Heart, ExternalLink } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * SupportOrb component
 * A premium, floating interactive orb to encourage donations/support.
 * Designed for SigilOS with Glassmorphism and smooth animations.
 */
export function SupportOrb() {
    const [isHovered, setIsHovered] = useState(false);

    // TODO: Replace with real link in production
    const stripeLink = "#"; 

    return (
        <div 
            className="fixed bottom-6 right-6 z-[100]"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <motion.a
                href={stripeLink}
                target="_blank"
                rel="noopener noreferrer"
                initial={false}
                animate={{
                    width: isHovered ? "220px" : "56px",
                    backgroundColor: isHovered ? "rgba(9, 9, 11, 0.6)" : "rgba(9, 9, 11, 0.4)"
                }}
                className={cn(
                    "flex items-center gap-3 h-14 overflow-hidden rounded-full",
                    "backdrop-blur-2xl border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)]",
                    "group transition-all duration-500 ease-out cursor-pointer hover:border-emerald-500/50"
                )}
            >
                {/* Orb Icon */}
                <div className="flex-shrink-0 w-14 h-14 flex items-center justify-center relative">
                    <motion.div 
                        animate={{ 
                            scale: [1, 1.2, 1],
                            opacity: [0.2, 0.4, 0.2]
                        }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute inset-2 bg-emerald-500 rounded-full blur-xl"
                    />
                    <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/80 via-emerald-600/80 to-indigo-700/80 flex items-center justify-center shadow-lg border border-white/10">
                        <Heart className={cn(
                            "w-5 h-5 text-white transition-all duration-500",
                            isHovered ? "fill-white scale-110" : "fill-white/10"
                        )} />
                    </div>
                </div>

                {/* Text Content */}
                <AnimatePresence>
                    {isHovered && (
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="flex-1 pr-6 flex flex-col items-start"
                        >
                            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em] leading-tight mb-0.5">
                                Sigil Project
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-white whitespace-nowrap uppercase italic">
                                    Soutenir l'Évolution
                                </span>
                                <ExternalLink className="w-2.5 h-2.5 text-zinc-500" />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.a>

            {/* Little "live" pulse indicator icon */}
            {!isHovered && (
                <div className="absolute top-0 right-0 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border border-zinc-950"></span>
                </div>
            )}
        </div>
    );
}

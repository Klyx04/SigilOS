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

    const stripeLink = "https://ko-fi.com/wylan"; 

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
                    width: isHovered ? "170px" : "44px",
                    backgroundColor: isHovered ? "rgba(9, 9, 11, 0.85)" : "rgba(9, 9, 11, 0.6)"
                }}
                className={cn(
                    "flex items-center gap-2.5 h-11 overflow-hidden rounded-full",
                    "backdrop-blur-2xl border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.4)]",
                    "group transition-all duration-300 ease-out cursor-pointer hover:border-emerald-500/40"
                )}
            >
                {/* Orb Icon */}
                <div className="flex-shrink-0 w-11 h-11 flex items-center justify-center relative">
                    <motion.div 
                        animate={{ 
                            scale: [1, 1.15, 1],
                            opacity: [0.2, 0.35, 0.2]
                        }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute inset-1.5 bg-emerald-500 rounded-full blur-md"
                    />
                    <div className="relative w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center border border-emerald-500/30 group-hover:border-emerald-400/60 transition-colors">
                        <Heart className={cn(
                            "w-4 h-4 text-emerald-400 transition-all duration-300",
                            isHovered ? "fill-emerald-400 scale-110" : "fill-emerald-400/20"
                        )} />
                    </div>
                </div>

                {/* Text Content */}
                <AnimatePresence>
                    {isHovered && (
                        <motion.div
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -6 }}
                            className="flex items-center gap-1.5 pr-4 whitespace-nowrap"
                        >
                            <span className="text-[11px] font-black text-zinc-200 uppercase tracking-wider">
                                Soutenir le projet
                            </span>
                            <ExternalLink className="w-3 h-3 text-emerald-400 shrink-0" />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.a>

            {/* Little "live" pulse indicator icon */}
            {!isHovered && (
                <div className="absolute top-0 right-0 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-zinc-950"></span>
                </div>
            )}
        </div>
    );
}

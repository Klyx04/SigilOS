"use client";

import React, { useState } from "react";
import { Share2, Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface ShareRoomButtonProps {
    roomId: string;
    className?: string;
}

export function ShareRoomButton({ roomId, className }: ShareRoomButtonProps) {
    const [copied, setCopied] = useState(false);

    const handleShare = async () => {
        const url = new URL(window.location.href);
        url.searchParams.set("room", roomId);
        const fullUrl = url.toString();

        // Avoid native share sheet on desktop (it's annoying for copy-link intent)
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        try {
            if (isMobile && navigator.share) {
                await navigator.share({
                    title: "Rejoins-moi sur SigilOS !",
                    text: `J'ai ouvert une salle (${roomId}). Viens jouer !`,
                    url: fullUrl,
                });
            } else {
                await navigator.clipboard.writeText(fullUrl);
                setCopied(true);
                toast.success("Lien copié dans le presse-papier !");
                setTimeout(() => setCopied(false), 2000);
            }
        } catch (err) {
            console.error("Erreur de partage:", err);
            // Fallback to clipboard if share cancelled or failed
            try {
                await navigator.clipboard.writeText(fullUrl);
                setCopied(true);
                toast.success("Lien copié !");
                setTimeout(() => setCopied(false), 2000);
            } catch (clipErr) {
                console.error("Clipboard fallback failed:", clipErr);
            }
        }
    };

    return (
        <button
            onClick={handleShare}
            className={cn(
                "group relative flex items-center gap-3 px-6 py-3 rounded-2xl bg-black/40 backdrop-blur-xl border border-border hover:border-info/50 hover:bg-black/60 transition-all active:scale-95",
                className
            )}
        >
            <div className="flex flex-col items-start leading-none pointer-events-none">
                <span className="text-caption font-black text-foreground/20 uppercase tracking-widest italic mb-1">Partager</span>
                <span className="text-sm font-black text-foreground italic tracking-tighter uppercase">{roomId}</span>
            </div>
            
            <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center group-hover:bg-info group-hover:text-foreground transition-all">
                <AnimatePresence mode="wait">
                    {copied ? (
                        <motion.div
                            key="check"
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.5, opacity: 0 }}
                        >
                            <Check size={18} />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="share"
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.5, opacity: 0 }}
                        >
                            <Share2 size={18} className="group-hover:rotate-12 transition-transform" />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Premium Shine Effect */}
            <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                <div className="absolute top-[-100%] left-[-100%] w-[300%] h-[300%] bg-gradient-to-br from-white/0 via-white/[0.05] to-white/0 rotate-45 animate-shine opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            <style jsx>{`
                @keyframes shine {
                    0% { transform: translate(-100%, -100%) rotate(45deg); }
                    100% { transform: translate(100%, 100%) rotate(45deg); }
                }
                .animate-shine {
                    animation: shine 1.5s infinite;
                }
            `}</style>
        </button>
    );
}

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Users, ChevronRight, Sparkles } from "lucide-react";

const DiscordIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 127.14 96.36" fill="currentColor">
        <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c2.91-27.55-13.48-51.67-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
    </svg>
);

interface AccessRequestModalProps {
    open: boolean;
    onClose: () => void;
}

function ModalContent({ onClose }: { onClose: () => void }) {
    const discordInvite = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "https://discord.gg/uX7G6SUDgN";

    return (
        <>
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-black/80 backdrop-blur-md"
                style={{ zIndex: 9998 }}
            />

            {/* Modal */}
            <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 32 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 32 }}
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
                className="fixed inset-0 flex items-center justify-center p-4"
                style={{ zIndex: 9999 }}
                onClick={e => e.target === e.currentTarget && onClose()}
            >
                <div className="w-full max-w-xl">
                    <div className="relative bg-zinc-950 border border-white/10 rounded-3xl overflow-hidden shadow-[0_32px_80px_-16px_rgba(0,0,0,0.8)]">

                        {/* Top gradient bar */}
                        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />

                        {/* Background glow */}
                        <div className="absolute top-[-40%] left-[-10%] w-[80%] h-[80%] bg-emerald-500/6 rounded-full blur-[140px] pointer-events-none" />
                        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

                        {/* Header */}
                        <div className="relative flex items-start justify-between p-10 pb-8">
                            <div>
                                <div className="flex items-center gap-2.5 mb-4">
                                    <div className="h-8 w-8 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
                                        <Users className="w-4 h-4 text-emerald-400" />
                                    </div>
                                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.35em]">Accès Chef de Guilde</span>
                                </div>
                                <h2 className="text-3xl font-black text-white tracking-tight leading-tight mb-3">
                                    Rejoindre SigilOS,<br />
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-300">c&apos;est simple.</span>
                                </h2>
                                <p className="text-sm text-zinc-500 leading-relaxed max-w-sm">
                                    Bêta privée réservée aux chefs de guilde actifs sur Dofus Unity.<br />
                                    Rejoins le Discord et ouvre un ticket — on répond sous 24-48h.
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center text-zinc-500 hover:text-white transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Divider */}
                        <div className="mx-10 h-px bg-white/5" />

                        {/* CTA Zone */}
                        <div className="relative p-10 pt-8 space-y-4">

                            {/* Main Discord CTA */}
                            <a
                                href={discordInvite}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex items-center gap-5 p-6 rounded-2xl bg-indigo-500/10 hover:bg-indigo-500/18 border border-indigo-500/25 hover:border-indigo-400/60 transition-all duration-200 shadow-[0_8px_32px_-8px_rgba(88,101,242,0.2)] hover:shadow-[0_8px_40px_-6px_rgba(88,101,242,0.35)]"
                            >
                                <div className="w-16 h-16 rounded-2xl bg-indigo-500/15 flex items-center justify-center flex-shrink-0 group-hover:scale-105 group-hover:bg-indigo-500/25 transition-all">
                                    <DiscordIcon className="w-8 h-8 text-indigo-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <span className="font-black text-white text-xl block mb-1">Rejoindre le Discord SigilOS</span>
                                    <span className="text-sm text-zinc-500">
                                        Ouvrir un ticket dans <span className="text-indigo-400 font-mono">#demande-accès</span>
                                        <span className="ml-2 inline-flex items-center gap-1 text-emerald-400/80 font-semibold">
                                            <Sparkles className="w-3 h-3" /> Réponse 24–48h
                                        </span>
                                    </span>
                                </div>
                                <ChevronRight className="w-6 h-6 text-zinc-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all flex-shrink-0" />
                            </a>

                            {/* Already have access */}
                            <p className="text-center text-[11px] text-zinc-700 pt-2">
                                Déjà membre ?{" "}
                                <button onClick={onClose} className="text-zinc-500 hover:text-white underline underline-offset-2 transition-colors">
                                    Connecte-toi via Discord en haut ↑
                                </button>
                            </p>
                        </div>
                    </div>
                </div>
            </motion.div>
        </>
    );
}

export function AccessRequestModal({ open, onClose }: AccessRequestModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {open && <ModalContent onClose={onClose} />}
        </AnimatePresence>,
        document.body
    );
}

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Crown, ChevronRight, Sparkles, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

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
                <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto custom-scrollbar">
                    <div className="relative bg-zinc-950 border border-white/10 rounded-3xl overflow-hidden shadow-[0_32px_80px_-16px_rgba(0,0,0,0.8)]">

                        {/* Top gradient bar */}
                        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent" />

                        {/* Background glow */}
                        <div className="absolute top-[-40%] left-[-10%] w-[80%] h-[80%] bg-amber-500/6 rounded-full  pointer-events-none" />
                        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/5 rounded-full  pointer-events-none" />

                        {/* Header */}
                        <div className="relative flex items-start justify-between p-6 sm:p-10 pb-6 sm:pb-8">
                            <div>
                                <div className="flex items-center gap-2.5 mb-4">
                                    <div className="h-8 w-8 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center">
                                        <Crown className="w-4 h-4 text-amber-400" />
                                    </div>
                                    <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Réservé Chefs de Guilde & Admins</span>
                                </div>
                                <h2 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight leading-tight mb-3">
                                    Activer SigilOS <br />
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200">pour votre guilde.</span>
                                </h2>
                                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-sm">
                                    Bêta privée réservée aux chefs de guilde et admins Discord sur Dofus Unity.<br />
                                    Rejoins le Discord et ouvre un ticket — on répond sous 24-48h.
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center text-zinc-500 hover:text-white transition-all ml-4"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Divider */}
                        <div className="mx-6 sm:mx-10 h-px bg-white/5" />

                        {/* CTA Zone */}
                        <div className="relative p-6 sm:p-10 pt-6 sm:pt-8 space-y-4">

                            {/* Member Clarification Alert */}
                            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-200/90 flex items-start gap-3">
                                <LogIn className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-bold text-white block mb-0.5">Vous êtes membre d&apos;une guilde déjà sur SigilOS ?</span>
                                    <span>Vous n&apos;avez pas besoin d&apos;ouvrir un ticket. Fermez ce pop-up et cliquez sur <strong className="text-emerald-400 font-bold">Se Connecter avec Discord</strong>.</span>
                                </div>
                            </div>

                            {/* Main Discord CTA */}
                            <Button
                                asChild
                                variant="sigil"
                                className="h-auto p-4 sm:p-6 rounded-2xl bg-indigo-500/10 border-indigo-500/25 justify-start text-left"
                            >
                                <a
                                    href={discordInvite}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex flex-wrap sm:flex-nowrap items-center gap-4 sm:gap-5"
                                >
                                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center flex-shrink-0  group-hover:bg-indigo-500/30 transition-all">
                                        <DiscordIcon className="w-6 h-6 sm:w-8 sm:h-8 text-white/90" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="font-semibold text-white text-lg sm:text-xl block mb-1 truncate">Ouvrir un ticket Discord</span>
                                        <div className="text-[11px] sm:text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors flex flex-wrap items-center gap-x-2 gap-y-1">
                                            <span>Salons <span className="text-indigo-400 font-mono">#OUVRIR-TICKET</span></span>
                                            <span className="inline-flex items-center gap-1 text-emerald-400/80 font-semibold">
                                                <Sparkles className="w-3 h-3" /> 24–48h
                                            </span>
                                        </div>
                                    </div>
                                    <ChevronRight className="hidden sm:block w-6 h-6 ml-auto text-white/20 group-hover:text-white transition-all" />
                                </a>
                            </Button>

                            {/* Already have access */}
                            <p className="text-center text-[11px] sm:text-[11px] text-zinc-500 pt-1">
                                Déjà membre ?{" "}
                                <button onClick={onClose} className="text-emerald-400 font-semibold hover:text-emerald-300 underline underline-offset-2 transition-colors">
                                    Fermer et se connecter via Discord ↑
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

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessageCircle, ExternalLink, Users, Sparkles, ChevronRight, Shield } from "lucide-react";

interface AccessRequestModalProps {
    open: boolean;
    onClose: () => void;
}

export function AccessRequestModal({ open, onClose }: AccessRequestModalProps) {
    const discordInvite = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "https://discord.gg/sigilos";
    const adminDM = process.env.NEXT_PUBLIC_DISCORD_ADMIN_DM || "https://discord.com/users/1";

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.92, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: 20 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div className="pointer-events-auto w-full max-w-lg">
                            <div className="relative bg-zinc-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl shadow-black/60">

                                {/* Decorative gradient top */}
                                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-amber-400 to-emerald-500" />

                                {/* Ambient glow */}
                                <div className="absolute top-[-40%] left-[-20%] w-[60%] h-[60%] bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
                                <div className="absolute bottom-[-30%] right-[-10%] w-[40%] h-[40%] bg-amber-500/10 rounded-full blur-[60px] pointer-events-none" />

                                {/* Header */}
                                <div className="relative flex items-start justify-between p-8 pb-0">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                                <Shield className="w-4 h-4 text-emerald-400" />
                                            </div>
                                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em]">Accès Chef de Guilde</span>
                                        </div>
                                        <h2 className="text-2xl font-black text-white tracking-tight">
                                            Rejoindre la Bêta
                                        </h2>
                                        <p className="text-sm text-zinc-400 leading-relaxed max-w-sm">
                                            SigilOS est en bêta privée. Rejoins notre Discord pour demander l&apos;accès — réservé aux chefs de guilde actifs.
                                        </p>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="flex-shrink-0 w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-all"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Options */}
                                <div className="relative p-8 space-y-3">
                                    {/* Option A — Discord Server */}
                                    <a
                                        href={discordInvite}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group flex items-center gap-4 p-5 rounded-2xl bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/20 hover:border-indigo-500/40 transition-all duration-200"
                                    >
                                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                                            <Users className="w-6 h-6 text-indigo-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="font-black text-white text-sm">Rejoindre le Discord SigilOS</span>
                                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black text-emerald-400 uppercase tracking-wider">Recommandé</span>
                                            </div>
                                            <p className="text-xs text-zinc-500 leading-relaxed">
                                                Accède au salon <span className="text-indigo-400 font-mono">#demande-accès</span> pour soumettre ta candidature. Réponse sous 24–48h.
                                            </p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                                    </a>

                                    {/* Option B — DM Admin */}
                                    <a
                                        href={adminDM}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group flex items-center gap-4 p-5 rounded-2xl bg-white/2 hover:bg-white/5 border border-white/5 hover:border-white/10 transition-all duration-200"
                                    >
                                        <div className="w-12 h-12 rounded-2xl bg-zinc-800 border border-white/5 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                                            <MessageCircle className="w-6 h-6 text-zinc-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className="font-black text-white text-sm block mb-0.5">Contacter l&apos;admin en DM</span>
                                            <p className="text-xs text-zinc-500 leading-relaxed">
                                                Tu peux aussi contacter directement l&apos;administrateur via Discord pour discuter de ta guilde.
                                            </p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                                    </a>

                                    {/* Footer note */}
                                    <div className="flex items-start gap-2.5 p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 mt-4">
                                        <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                                        <p className="text-[11px] text-amber-400/70 leading-relaxed">
                                            <span className="font-bold text-amber-400">Accès réservé.</span> SigilOS est destiné aux chefs de guilde sur Dofus Retro. Un serveur Discord actif est requis pour l&apos;accès.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

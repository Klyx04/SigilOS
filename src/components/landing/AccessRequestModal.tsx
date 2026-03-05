"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Users, ChevronRight, Mic, LayoutDashboard } from "lucide-react";

const DiscordIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 127.14 96.36" fill="currentColor">
        <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c2.91-27.55-13.48-51.67-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
    </svg>
);

const STEPS = [
    {
        icon: DiscordIcon,
        num: "01",
        title: "Ticket Discord",
        description: "Rejoignez le Discord SigilOS et ouvrez un ticket dans #demande-accès."
    },
    {
        icon: Mic,
        num: "02",
        title: "Échange vocal",
        description: "Un court entretien pour valider votre guilde et vos besoins."
    },
    {
        icon: LayoutDashboard,
        num: "03",
        title: "Accès Dashboard",
        description: "Votre guilde est configurée et vous accédez à votre grimoire."
    },
];

interface AccessRequestModalProps {
    open: boolean;
    onClose: () => void;
}

function ModalContent({ onClose }: { onClose: () => void }) {
    const discordInvite = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "https://discord.gg/sigilos";

    return (
        <>
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-black/75 backdrop-blur-sm"
                style={{ zIndex: 9998 }}
            />

            {/* Modal */}
            <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 24 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 24 }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
                className="fixed inset-0 flex items-center justify-center p-4"
                style={{ zIndex: 9999 }}
                onClick={e => e.target === e.currentTarget && onClose()}
            >
                <div className="w-full max-w-lg">
                    <div className="relative bg-zinc-950 border border-white/10 rounded-3xl overflow-hidden shadow-2xl shadow-black/70">

                        {/* Top gradient bar */}
                        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/80 to-transparent" />
                        <div className="absolute top-[-60%] left-[-20%] w-[70%] h-[70%] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

                        {/* Header */}
                        <div className="relative flex items-start justify-between p-8 pb-6">
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="h-7 w-7 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                        <Users className="w-3.5 h-3.5 text-emerald-400" />
                                    </div>
                                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em]">Accès Chef de Guilde</span>
                                </div>
                                <h2 className="text-2xl font-black text-white tracking-tight leading-tight">
                                    Comment rejoindre<br />SigilOS ?
                                </h2>
                                <p className="text-sm text-zinc-500 leading-relaxed mt-1.5">
                                    Bêta privée — réservé aux chefs de guilde actifs sur Dofus Retro.
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="flex-shrink-0 w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center text-zinc-500 hover:text-white transition-all"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* 3 étapes */}
                        <div className="relative px-8 pb-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="h-px flex-1 bg-white/5" />
                                <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.3em]">Le parcours d&apos;accès</span>
                                <div className="h-px flex-1 bg-white/5" />
                            </div>

                            <div className="grid grid-cols-3 gap-4 mb-8">
                                {STEPS.map((step, i) => (
                                    <div key={i} className="flex flex-col items-center text-center gap-3">
                                        <div className="relative">
                                            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center">
                                                <step.icon className="w-6 h-6 text-emerald-400" />
                                            </div>
                                            <div className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center text-[9px] font-black text-zinc-500">
                                                {step.num}
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-black text-white leading-tight mb-1">{step.title}</p>
                                            <p className="text-[10px] text-zinc-500 leading-snug">{step.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* CTA Discord */}
                            <a
                                href={discordInvite}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex items-center gap-4 p-5 rounded-2xl bg-indigo-500/10 hover:bg-indigo-500/15 border border-indigo-500/25 hover:border-indigo-500/50 transition-all duration-200"
                            >
                                <div className="w-12 h-12 rounded-xl bg-indigo-500/15 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                                    <DiscordIcon className="w-6 h-6 text-indigo-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <span className="font-black text-white text-base block mb-0.5">Rejoindre le Discord SigilOS</span>
                                    <span className="text-xs text-zinc-500">
                                        Ouvrir un ticket dans <span className="text-indigo-400 font-mono">#demande-accès</span> • Réponse 24–48h
                                    </span>
                                </div>
                                <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                            </a>
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

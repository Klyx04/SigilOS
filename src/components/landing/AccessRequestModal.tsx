"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Users, ChevronRight, Mic, LayoutDashboard } from "lucide-react";

// Discord SVG icon
const DiscordIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 127.14 96.36" fill="currentColor">
        <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c2.91-27.55-13.48-51.67-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
    </svg>
);

const STEPS = [
    {
        icon: DiscordIcon,
        num: "01",
        title: "Ouvrez un ticket Discord",
        description: "Rejoignez le Discord SigilOS et ouvrez un ticket dans #demande-accès."
    },
    {
        icon: Mic,
        num: "02",
        title: "Échange vocal rapide",
        description: "Un court entretien pour valider votre guilde et vos besoins."
    },
    {
        icon: LayoutDashboard,
        num: "03",
        title: "Accès au Dashboard",
        description: "Votre guilde est configurée et vous accédez à votre grimoire."
    },
];

interface AccessRequestModalProps {
    open: boolean;
    onClose: () => void;
}

export function AccessRequestModal({ open, onClose }: AccessRequestModalProps) {
    const discordInvite = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "https://discord.gg/sigilos";

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop — z-[100] pour passer au-dessus de la navbar (z-50) */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.94, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: 16 }}
                        transition={{ type: "spring", stiffness: 320, damping: 28 }}
                        className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div className="pointer-events-auto w-full max-w-lg">
                            <div className="relative bg-zinc-950 border border-white/10 rounded-3xl overflow-hidden shadow-2xl shadow-black/70">

                                {/* Top gradient bar */}
                                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/80 to-transparent" />

                                {/* Ambient glows */}
                                <div className="absolute top-[-60%] left-[-20%] w-[70%] h-[70%] bg-emerald-500/8 rounded-full blur-[100px] pointer-events-none" />

                                {/* Header */}
                                <div className="relative flex items-start justify-between p-7 pb-5">
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="h-7 w-7 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                                <Users className="w-3.5 h-3.5 text-emerald-400" />
                                            </div>
                                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em]">Accès Chef de Guilde</span>
                                        </div>
                                        <h2 className="text-xl font-black text-white tracking-tight">
                                            Comment rejoindre SigilOS ?
                                        </h2>
                                        <p className="text-sm text-zinc-500 leading-relaxed mt-1 max-w-sm">
                                            Bêta privée — réservé aux chefs de guilde actifs sur Dofus Retro.
                                        </p>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="flex-shrink-0 w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center text-zinc-500 hover:text-white transition-all"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* 3 étapes */}
                                <div className="relative px-7 pb-3">
                                    <div className="flex items-center gap-3 mb-5">
                                        <div className="h-px flex-1 bg-white/5" />
                                        <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.3em]">Processus d&apos;accès</span>
                                        <div className="h-px flex-1 bg-white/5" />
                                    </div>

                                    <div className="grid grid-cols-3 gap-3 mb-6">
                                        {STEPS.map((step, i) => (
                                            <div key={i} className="flex flex-col items-center text-center gap-2.5 px-1">
                                                <div className="relative">
                                                    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center">
                                                        <step.icon className="w-5 h-5 text-emerald-400" />
                                                    </div>
                                                    <div className="absolute -top-2 -right-2 w-5 h-5 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center text-[8px] font-black text-zinc-500">
                                                        {step.num}
                                                    </div>
                                                </div>
                                                <p className="text-[10px] font-bold text-white leading-tight">{step.title}</p>
                                                <p className="text-[9px] text-zinc-500 leading-snug">{step.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* CTA Discord */}
                                <div className="relative px-7 pb-7">
                                    <a
                                        href={discordInvite}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group flex items-center gap-4 p-4 rounded-2xl bg-indigo-500/10 hover:bg-indigo-500/15 border border-indigo-500/25 hover:border-indigo-500/50 transition-all duration-200"
                                    >
                                        <div className="w-11 h-11 rounded-xl bg-indigo-500/15 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                                            <DiscordIcon className="w-5 h-5 text-indigo-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className="font-black text-white text-sm block">Rejoindre le Discord SigilOS</span>
                                            <span className="text-[11px] text-zinc-500">
                                                Ouvrir un ticket dans <span className="text-indigo-400 font-mono">#demande-accès</span>
                                            </span>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                                    </a>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Compass,
    X,
    ArrowRight,
    User,
    ScrollText,
    InfinityIcon,
    Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { markWelcomeAsSeen } from "@/server/actions/onboarding-actions";
import Link from "next/link";

interface MemberWelcomeModalProps {
    guildId: string;
    guildName: string;
    userName: string;
    show: boolean;
}

export function MemberWelcomeModal({ guildId, guildName, userName, show }: MemberWelcomeModalProps) {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (show) {
            const timer = setTimeout(() => setIsOpen(true), 600);
            return () => clearTimeout(timer);
        }
    }, [show]);

    const handleClose = async () => {
        setIsOpen(false);
        await markWelcomeAsSeen(guildId);
    };

    const features = [
        {
            icon: User,
            label: "Ton Profil",
            description: "Renseigne ton pseudo Dofus et ta classe pour être identifié dans la guilde.",
            color: "text-blue-400",
            bg: "bg-blue-500/10 border-blue-500/20",
        },
        {
            icon: ScrollText,
            label: "Missions",
            description: "Participe aux défis hebdomadaires pour gagner de l'XP et faire grimper la guilde.",
            color: "text-emerald-400",
            bg: "bg-emerald-500/10 border-emerald-500/20",
        },
        {
            icon: InfinityIcon,
            label: "Songes Infinis",
            description: "Forme des équipes et progresse ensemble dans les Songes Infinis.",
            color: "text-purple-400",
            bg: "bg-purple-500/10 border-purple-500/20",
        },
        {
            icon: Trophy,
            label: "Ladder XP",
            description: "Chaque action rapporte de l'XP. Grimpe le classement et montre ta contribution !",
            color: "text-amber-400",
            bg: "bg-amber-500/10 border-amber-500/20",
        },
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-6">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-md"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: "spring", damping: 20, stiffness: 300 }}
                        className="relative w-full max-w-xl glass-premium rounded-3xl border border-white/10 overflow-hidden "
                    >
                        {/* Decorative background glows */}
                        <div className="absolute -top-24 -left-24 w-64 h-64 bg-teal-500/10 rounded-full blur-[100px]" />
                        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-purple-500/8 rounded-full blur-[100px]" />

                        <div className="relative z-10 p-8 md:p-12 flex flex-col items-center text-center space-y-8">
                            {/* Close Button */}
                            <button
                                onClick={handleClose}
                                className="absolute top-5 right-5 p-2 rounded-full bg-white/5 border border-white/10 text-zinc-500 hover:text-white hover:bg-white/10 transition-all"
                            >
                                <X className="w-4 h-4" />
                            </button>

                            {/* Icon Header */}
                            <div className="relative">
                                <div className="absolute inset-0 bg-teal-500 blur-2xl opacity-20 animate-pulse" />
                                <div className="relative w-20 h-20 rounded-[2rem] bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-2xl">
                                    <Compass className="w-10 h-10 text-white" />
                                </div>
                            </div>

                            {/* Text Content */}
                            <div className="space-y-4">
                                <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                                    Bienvenue, <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-400">{userName}</span> !
                                </h2>
                                <p className="text-zinc-400 font-medium max-w-md mx-auto text-base md:text-lg leading-relaxed">
                                    Tu viens de rejoindre <strong className="text-zinc-200">{guildName}</strong> sur SigilOS.
                                    Voici les outils à ta disposition :
                                </p>
                            </div>

                            {/* Features List */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full text-left">
                                {features.map((feature) => (
                                    <div
                                        key={feature.label}
                                        className={`flex items-start gap-4 p-4 rounded-2xl border ${feature.bg}`}
                                    >
                                        <div className="mt-0.5 flex-shrink-0">
                                            <feature.icon className={`w-5 h-5 ${feature.color}`} />
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-sm font-black text-white block">{feature.label}</span>
                                            <span className="text-xs text-zinc-400 font-medium leading-relaxed block">{feature.description}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Tip */}
                            <p className="text-sm text-zinc-500 font-medium italic max-w-sm">
                                💡 Commence par renseigner ton <strong className="text-zinc-300 not-italic">pseudo Dofus</strong> et ta <strong className="text-zinc-300 not-italic">classe</strong> pour que tes coéquipiers te reconnaissent.
                            </p>

                            {/* Actions */}
                            <div className="flex flex-col sm:flex-row items-center gap-4 w-full pt-2 max-w-md">
                                <Button
                                    asChild
                                    className="w-full h-14 bg-white text-black hover:bg-zinc-200 font-black uppercase tracking-[0.12em] text-sm rounded-2xl group"
                                >
                                    <Link href={`/dashboard/${guildId}/profile?edit=identity`} onClick={handleClose}>
                                        Compléter mon profil
                                        <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </Link>
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={handleClose}
                                    className="w-full h-14 text-zinc-500 hover:text-white hover:bg-white/5 font-bold text-sm rounded-2xl"
                                >
                                    Explorer le dashboard
                                </Button>
                            </div>
                        </div>

                        {/* Bottom decorative bar */}
                        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 via-emerald-500 to-purple-500" />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

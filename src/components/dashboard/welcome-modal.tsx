"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Rocket,
    X,
    ArrowRight,
    Sparkles,
    Shield,
    Puzzle,
    BookOpen,
    Swords
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { markWelcomeAsSeen } from "@/server/actions/onboarding-actions";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface WelcomeModalProps {
    guildId: string;
    show: boolean;
}

export function WelcomeModal({ guildId, show }: WelcomeModalProps) {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (show) {
            setIsOpen(true);
        }
    }, [show]);

    const handleClose = async () => {
        setIsOpen(false);
        await markWelcomeAsSeen(guildId);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-6">
                    {/* Backdrop — non-cliquable pour forcer l'action */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/80 backdrop-blur-md"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto glass-premium rounded-2xl md:rounded-3xl border border-border-strong"
                    >
                        <div className="relative z-10 p-5 sm:p-8 md:p-12 flex flex-col items-center text-center space-y-5 md:space-y-8">
                            {/* Close Button — always visible */}
                            <button
                                onClick={handleClose}
                                className="absolute top-3 right-3 sm:top-6 sm:right-6 p-2 rounded-full bg-surface border border-border text-muted-foreground hover:text-foreground hover:bg-surface transition-all z-20"
                            >
                                <X className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>

                            {/* Icon Header */}
                            <div className="relative pt-2">
                                <div className="relative w-14 h-14 sm:w-20 sm:h-20 rounded-2xl bg-success flex items-center justify-center shadow-lg">
                                    <Rocket className="w-7 h-7 sm:w-10 sm:h-10 text-foreground" />
                                </div>
                                <div className="absolute -top-2 -right-2 p-1.5 rounded-full bg-success shadow-xl border-2 border-border">
                                    <Sparkles className="w-3 h-3 text-foreground" />
                                </div>
                            </div>

                            {/* Text Content */}
                            <div className="space-y-3">
                                <h2 className="text-display-lg md:text-display-xl font-bold text-foreground font-heading">
                                    Bienvenue sur <span className="text-success">SigilOS</span>
                                </h2>
                                <p className="text-muted-foreground font-medium max-w-sm sm:max-w-md mx-auto text-sm sm:text-base md:text-lg leading-relaxed">
                                    Votre guilde a maintenant son QG sur SigilOS. Configurez vos modules, invitez vos membres et lancez vos premières sorties.
                                </p>
                            </div>

                            {/* Features Grid (Small) */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full pt-4">
                                <div className="flex flex-col items-center gap-2">
                                    <div className="p-3 rounded-xl bg-surface border border-border text-info">
                                        <Shield className="w-5 h-5" />
                                    </div>
                                    <span className="text-caption font-semibold text-muted-foreground">Bot Discord</span>
                                </div>
                                <div className="flex flex-col items-center gap-2">
                                    <div className="p-3 rounded-xl bg-surface border border-border text-info">
                                        <Puzzle className="w-5 h-5" />
                                    </div>
                                    <span className="text-caption font-semibold text-muted-foreground">Modules</span>
                                </div>
                                <div className="flex flex-col items-center gap-2">
                                    <div className="p-3 rounded-xl bg-surface border border-border text-success">
                                        <Swords className="w-5 h-5" />
                                    </div>
                                    <span className="text-caption font-semibold text-muted-foreground">Missions</span>
                                </div>
                                <div className="flex flex-col items-center gap-2">
                                    <div className="p-3 rounded-xl bg-surface border border-border text-info">
                                        <BookOpen className="w-5 h-5" />
                                    </div>
                                    <span className="text-caption font-semibold text-muted-foreground">Wiki</span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col items-center gap-3 pt-3 w-full max-w-md">
                                <Button
                                    asChild
                                    className="w-full h-12 bg-background text-foreground hover:bg-surface font-semibold text-sm rounded-xl"
                                >
                                    <Link href={`/dashboard/${guildId}/admin/getting-started`} onClick={handleClose}>
                                        Lancer la configuration
                                        <ArrowRight className="ml-2 w-4 h-4" />
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

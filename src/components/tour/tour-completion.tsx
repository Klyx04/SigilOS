"use client";

import { useEffect, useState } from "react";
import { useTour, isReplayableTourPhase } from "./tour-provider";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight, ShieldCheck, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function TourCompletion({ guildId }: { guildId: string }) {
    const { isCelebrationActive, setCelebrationActive, tourPhase } = useTour();
    const router = useRouter();
    const [particles, setParticles] = useState<any[]>([]);

    useEffect(() => {
        if (isCelebrationActive) {
            // Generate some simple random particles for the CSS confetti animation
            const list = Array.from({ length: 40 }).map((_, idx) => ({
                id: idx,
                x: Math.random() * 100, // percentage left
                y: Math.random() * -20, // initial top offset
                size: Math.random() * 8 + 4, // px size
                color: ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ec4899"][Math.floor(Math.random() * 5)],
                delay: Math.random() * 2, // seconds delay
                duration: Math.random() * 3 + 2, // seconds fall duration
                rotation: Math.random() * 360
            }));
            setParticles(list);
        } else {
            setParticles([]);
        }
    }, [isCelebrationActive]);

    if (!isCelebrationActive) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
                {/* Backdrop with blur */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setCelebrationActive(false)}
                    className="absolute inset-0 bg-black/80 backdrop-blur-md"
                />

                {/* Confetti Particles */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {particles.map((p) => (
                        <div
                            key={p.id}
                            className="absolute rounded-sm animate-fall"
                            style={{
                                left: `${p.x}%`,
                                top: `${p.y}%`,
                                width: `${p.size}px`,
                                height: `${p.size}px`,
                                backgroundColor: p.color,
                                animationDelay: `${p.delay}s`,
                                animationDuration: `${p.duration}s`,
                                transform: `rotate(${p.rotation}deg)`
                            }}
                        />
                    ))}
                </div>

                {/* Completion Modal Card */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-md bg-surface rounded-3xl border border-border overflow-hidden p-6 sm:p-10 flex flex-col items-center text-center space-y-6"
                >
                    {/* Celebration Trophy Icon */}
                    <div className="relative w-20 h-20 bg-info rounded-3xl flex items-center justify-center">
                        <ShieldCheck className="w-10 h-10 text-foreground" />
                        <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-warning" />
                    </div>

                    <div className="space-y-2 relative z-10">
                        <h2 className="text-2xl font-black text-foreground tracking-tight uppercase italic leading-none">
                            Tu es prêt ! 🎉
                        </h2>
                        <h3 className="text-sm font-bold text-primary uppercase tracking-widest">
                            Exploration terminée
                        </h3>
                        <p className="text-muted-foreground text-xs font-semibold leading-relaxed max-w-xs mx-auto pt-2">
                            {isReplayableTourPhase(tourPhase) && tourPhase !== "admin"
                                ? "Tu connais maintenant les bases de ce module. Tu peux le rejouer à tout moment depuis le bouton « Tutoriel »."
                                : "Ton profil est configuré et tu as maintenant toutes les clés pour utiliser au mieux le tableau de bord de la guilde !"}
                        </p>
                    </div>

                    {/* Actions CTAs — dédié au tour admin (arrivée) vs tour membre vs module admin */}
                    <div className="w-full flex flex-col gap-3 pt-4 relative z-10">
                        {isReplayableTourPhase(tourPhase) && tourPhase !== "admin" ? (
                            <>
                                <Button
                                    onClick={() => setCelebrationActive(false)}
                                    className="w-full h-12 bg-primary hover:bg-primary/90 font-black uppercase tracking-widest text-xs rounded-xl transition-colors active:scale-95 text-primary-foreground gap-2"
                                >
                                    <LayoutDashboard className="w-4 h-4" />
                                    Fermer
                                </Button>
                            </>
                        ) : tourPhase === "admin" ? (
                            <>
                                <Button
                                    onClick={() => {
                                        setCelebrationActive(false);
                                        router.push(`/dashboard/${guildId}/admin`);
                                    }}
                                    className="w-full h-12 bg-primary hover:bg-primary/90 font-black uppercase tracking-widest text-xs rounded-xl transition-colors active:scale-95 text-primary-foreground gap-2"
                                >
                                    <ShieldCheck className="w-4 h-4" />
                                    Ouvrir la Console
                                    <ArrowRight className="w-4 h-4 ml-auto" />
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setCelebrationActive(false);
                                        router.push(`/dashboard/${guildId}/admin/getting-started`);
                                    }}
                                    className="w-full h-12 border-border bg-surface hover:bg-surface text-xs font-black uppercase tracking-widest rounded-xl transition-all gap-2 text-foreground"
                                >
                                    <Sparkles className="w-4 h-4" />
                                    Revoir la mise en route
                                </Button>
                            </>
                        ) : (
                            <Button
                                onClick={() => setCelebrationActive(false)}
                                className="w-full h-12 bg-primary hover:bg-primary/90 font-black uppercase tracking-widest text-xs rounded-xl transition-colors active:scale-95 text-primary-foreground gap-2"
                            >
                                <LayoutDashboard className="w-4 h-4" />
                                Fermer
                            </Button>
                        )}
                    </div>

                    {/* CSS Confetti Fall Animation */}
                    <style jsx global>{`
                        @keyframes fall {
                            0% {
                                transform: translateY(0) rotate(0deg);
                                opacity: 1;
                            }
                            100% {
                                transform: translateY(110vh) rotate(720deg);
                                opacity: 0;
                            }
                        }
                        .animate-fall {
                            animation-name: fall;
                            animation-timing-function: linear;
                            animation-fill-mode: forwards;
                        }
                    `}</style>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

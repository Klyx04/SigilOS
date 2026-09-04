"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { loginWithDiscord } from "@/server/actions/auth-actions";
import { Sparkles, MessageSquare, Zap, ShieldCheck } from "lucide-react";

const DiscordIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 127.14 96.36" fill="currentColor">
        <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c2.91-27.55-13.48-51.67-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
    </svg>
);

interface AccessRequestModalProps {
    open: boolean;
    onClose: () => void;
}

export function AccessRequestModal({ open, onClose }: AccessRequestModalProps) {
    const discordInvite = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "https://discord.gg/uX7G6SUDgN";

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
            <DialogContent className="max-w-lg bg-zinc-950 border-white/10 text-white rounded-3xl p-6 md:p-8 backdrop-blur-2xl">
                <DialogHeader className="text-left space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-caption font-black uppercase tracking-wider text-emerald-400 w-fit">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Créer l&apos;espace de votre guilde</span>
                    </div>
                    <DialogTitle className="text-xl md:text-2xl font-black text-white tracking-tight">
                        Choisissez votre mode d&apos;onboarding
                    </DialogTitle>
                    <DialogDescription className="text-xs md:text-sm text-zinc-400 leading-relaxed">
                        Installez SigilOS directement en autonomie si vous êtes administrateur de votre Discord, ou faites-vous accompagner par notre équipe.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 my-2">
                    {/* OPTION 1 : AUTONOME (RECOMMANDÉ) */}
                    <div className="relative p-5 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-zinc-900/60 to-zinc-900/80 border border-emerald-500/30 hover:border-emerald-500/50 transition-all space-y-3 group shadow-lg shadow-emerald-950/20">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                                <Zap className="w-4 h-4 text-emerald-400" /> Option 1 — Autonome
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                Immédiat &amp; Gratuit
                            </span>
                        </div>
                        <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                            Vous êtes chef de guilde ou admin Discord ? Connectez-vous avec Discord et déployez votre guilde en autonomie en 30 secondes chrono.
                        </p>
                        <Button
                            onClick={() => loginWithDiscord()}
                            className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-900/30"
                        >
                            <DiscordIcon className="w-4 h-4 mr-2" />
                            Déployer mon serveur en 1 clic
                        </Button>
                    </div>

                    {/* OPTION 2 : VIP / MANUEL AVEC TICKET */}
                    <div className="p-4 rounded-2xl bg-zinc-900/40 border border-white/5 hover:border-white/10 transition-all space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-wider text-violet-400 flex items-center gap-1.5">
                                <MessageSquare className="w-4 h-4 text-violet-400" /> Option 2 — Accompagné
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-white/5">
                                Alliance &amp; Support VIP
                            </span>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                            Besoin d&apos;aide personnalisée, configuration multi-guildes / alliance ou questions préalables ? Ouvrez un ticket d&apos;onboarding avec notre équipe.
                        </p>
                        <a
                            href={discordInvite}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 w-full h-10 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-white font-bold text-xs uppercase tracking-wider transition-colors"
                        >
                            <DiscordIcon className="w-4 h-4" />
                            Ouvrir un ticket sur Discord
                        </a>
                    </div>
                </div>

                <div className="text-center pt-1 border-t border-white/5">
                    <p className="text-caption text-zinc-500">
                        Déjà membre d&apos;une guilde active ?{" "}
                        <button onClick={onClose} className="text-emerald-400 hover:underline font-semibold">
                            Fermez et connectez-vous
                        </button>.
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}

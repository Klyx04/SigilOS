"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Home, ArrowRight, Loader2, Hourglass } from "lucide-react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getGuildDeployState } from "@/server/actions/admin-actions";

type DeployPhase = "waiting-bot" | "bot-ready" | "deployed" | "stale";

const MAX_POLLS = 12; // ~36 s : au-delà, Discord n'a probablement pas propagé

export default function OnboardingSuccessPage() {
    const router = useRouter();
    const [countdown, setCountdown] = useState(5);
    const [isPopup, setIsPopup] = useState(false);
    const [guildId, setGuildId] = useState<string | null>(null);
    const [phase, setPhase] = useState<DeployPhase>("waiting-bot");
    const pollsRef = useRef(0);

    useEffect(() => {
        // 1. Signal to the opener (Dashboard) that we're done
        let opener: Window | null = null;
        try {
            opener = window.opener;
        } catch {
            opener = null;
        }
        if (opener) {
            setIsPopup(true);
            try {
                opener.postMessage("sigilos-bot-invited", window.location.origin);
            } catch (e) {
                console.error("Failed to notify opener:", e);
            }
        }

        // 2. guild_id transmis par Discord sur le redirect OAuth (scope bot)
        try {
            const gid = new URLSearchParams(window.location.search).get("guild_id");
            if (gid) setGuildId(gid);
        } catch {
            /* URL illisible — on garde le compteur simple */
        }

        // 3. Auto-close or redirect timer (flux popup inchangé)
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    // If it's a popup, try to close it, otherwise redirect
                    if (window.opener) {
                        window.close();
                    } else {
                        router.push("/dashboard");
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [router]);

    // 4. Polling d'état réel (flux onglet plein : pas de mensonge sur l'état)
    useEffect(() => {
        if (isPopup || !guildId) return;
        let cancelled = false;
        const poll = async () => {
            pollsRef.current += 1;
            try {
                const state = await getGuildDeployState(guildId);
                if (cancelled) return;
                if (state.configActive || (state.botPresent && state.hasConfig)) {
                    setPhase("deployed");
                    setTimeout(() => {
                        if (!cancelled) router.push("/dashboard");
                    }, 2000);
                    return;
                }
                if (state.botPresent) {
                    setPhase("bot-ready");
                    return;
                }
                if (pollsRef.current >= MAX_POLLS) setPhase("stale");
            } catch {
                if (pollsRef.current >= MAX_POLLS && !cancelled) setPhase("stale");
            }
        };
        void poll();
        const interval = setInterval(() => {
            if (pollsRef.current >= MAX_POLLS) {
                clearInterval(interval);
                return;
            }
            void poll();
        }, 3000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [isPopup, guildId, router]);

    return (
        <div className="relative min-h-screen w-full overflow-hidden flex flex-col items-center justify-center bg-background font-sans selection:bg-accent-teal/30">
            <AuroraBackground className="absolute inset-0 z-0 pointer-events-none opacity-40" />

            <div className="relative z-10 max-w-md w-full p-4 animate-in fade-in zoom-in-95 duration-300">
                <GlassPanel className="p-8 border-success/20  text-center space-y-6">
                    <div className="relative w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-2 border border-success/20">
                        {phase === "deployed" ? (
                            <CheckCircle2 className="w-10 h-10 text-success" />
                        ) : phase === "stale" ? (
                            <Hourglass className="w-10 h-10 text-warning" />
                        ) : (
                            <>
                                <CheckCircle2 className="w-10 h-10 text-success animate-pulse" />
                                <div className="absolute inset-0 rounded-full bg-success/20 blur-xl animate-pulse" />
                            </>
                        )}
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-3xl font-black text-foreground uppercase tracking-tight">
                            Bot Autorisé !
                        </h1>
                        {!isPopup && guildId && phase === "waiting-bot" && (
                            <p className="text-muted-foreground text-sm font-medium flex items-center justify-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Installation en cours côté Discord — quelques secondes…
                            </p>
                        )}
                        {!isPopup && guildId && phase === "bot-ready" && (
                            <p className="text-muted-foreground text-sm font-medium">
                                Bot détecté sur votre serveur ✓ — finalisez depuis le portail.
                            </p>
                        )}
                        {!isPopup && guildId && phase === "deployed" && (
                            <p className="text-success text-sm font-bold">
                                Guilde active ✓ — redirection vers votre QG…
                            </p>
                        )}
                        {!isPopup && guildId && phase === "stale" && (
                            <p className="text-warning text-sm font-medium">
                                Discord met du temps à propager l&apos;installation. Revenez dans une minute ou
                                finalisez depuis le portail.
                            </p>
                        )}
                        {(isPopup || !guildId) && (
                            <p className="text-muted-foreground text-sm font-medium">
                                SigilOS a bien été ajouté à votre serveur Discord.
                            </p>
                        )}
                    </div>

                    <div className="p-4 bg-background/50 rounded-2xl border border-border space-y-3">
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Vous pouvez fermer cet onglet et retourner sur l&apos;onglet SigilOS pour finaliser le déploiement.
                        </p>
                        {isPopup && (
                            <div className="flex items-center justify-center gap-2 py-1 px-3 bg-success/10 rounded-full w-fit mx-auto border border-success/10">
                                <div className="w-1.5 h-1.5 rounded-full bg-success animate-ping" />
                                <span className="text-caption font-black text-success uppercase tracking-widest">
                                    Fermeture automatique dans {countdown}s
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-3 pt-2">
                        <Button asChild className="w-full bg-success hover:bg-success text-success-foreground font-black uppercase tracking-widest rounded-xl py-6 h-auto shadow-lg shadow-emerald-500/20">
                            <Link href="/dashboard" className="flex items-center justify-center gap-2">
                                <Home className="w-4 h-4" />
                                Retour au QG
                                <ArrowRight className="w-4 h-4 ml-1" />
                            </Link>
                        </Button>

                        <button
                            onClick={() => window.close()}
                            className="text-caption font-bold text-muted-foreground hover:text-muted-foreground uppercase tracking-widest transition-colors py-2"
                        >
                            Fermer l&apos;onglet manuellement
                        </button>
                    </div>
                </GlassPanel>

                <p className="text-center mt-8 text-caption text-muted-foreground font-black uppercase tracking-widest opacity-50">
                    SigilOS Security Protocol · Authorization Confirmed
                </p>
            </div>
        </div>
    );
}

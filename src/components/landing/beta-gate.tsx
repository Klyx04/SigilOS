"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Lock, CheckCircle, ArrowRight, Users, LogOut } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { checkEligibility, type EligibilityResult } from "@/server/actions/beta-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const DISCORD_SUPPORT_URL = process.env.NEXT_PUBLIC_DISCORD_SUPPORT_URL || "#";

export function BetaGate() {
    const [isLoading, setIsLoading] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [result, setResult] = useState<EligibilityResult | null>(null);
    const router = useRouter();
    const { data: session, status } = useSession();

    const handleLogin = () => {
        signIn("discord", { callbackUrl: "/?check_eligibility=true" });
    };

    const handleLogout = () => {
        setIsLoggingOut(true);
        signOut({ callbackUrl: "/" });
        setResult(null);
    };

    const handleCheck = async () => {
        setIsLoading(true);
        try {
            const data = await checkEligibility();
            setResult(data);

            if (data.status === "ACCESS_GRANTED_ADMIN" || data.status === "ACCESS_GRANTED_MEMBER") {
                toast.success(`🎉 Accès autorisé via ${data.guildName} !`);
            }
        } catch (error) {
            toast.error("Erreur lors de la vérification.");
        } finally {
            setIsLoading(false);
        }
    };

    // Initial State: Login button or Check button
    const renderInitialState = () => (
        <motion.div
            key="check-btn"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
        >
            {status === "loading" || isLoggingOut ? (
                <div className="flex h-[136px] w-full items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-zinc-600/50" />
                </div>
            ) : status === "unauthenticated" ? (
                <div className="space-y-4">
                    <Button
                        size="lg"
                        onClick={handleLogin}
                        className="w-full h-14 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-black uppercase tracking-[0.2em] text-[10px] shadow-[0_10px_30px_rgba(88,101,242,0.3)] transition-all hover:scale-[1.02] active:scale-95 group relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:animate-shimmer" />
                        <svg className="mr-3 w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 127.14 96.36" fill="currentColor">
                            <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c2.91-27.55-13.48-51.67-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
                        </svg>
                        Connecter mon compte Discord
                    </Button>
                    <p className="text-[10px] text-zinc-500 text-center uppercase tracking-widest font-bold opacity-60">
                        Connexion sécurisée via protocole Discord requise.
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Premium Profile Badge */}
                    <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl group/id transition-all hover:bg-white/[0.07]">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <Avatar className="h-10 w-10 border-2 border-emerald-500/20 group-hover/id:border-emerald-500/50 transition-all">
                                    <AvatarImage src={session?.user?.image || ""} alt={session?.user?.name || ""} />
                                    <AvatarFallback className="bg-emerald-500/10 text-emerald-500 font-bold">
                                        {session?.user?.name?.[0] || "U"}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#020202] shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                            </div>
                            <div className="text-left">
                                <p className="text-[10px] uppercase tracking-widest font-black text-zinc-500">Authentifié</p>
                                <p className="text-sm font-bold text-white tracking-tight">{session?.user?.name}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-2.5 rounded-xl bg-white/5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20 group/logout"
                            title="Se déconnecter"
                        >
                            <LogOut className="w-4 h-4 transition-transform group-hover/logout:-translate-x-0.5" />
                        </button>
                    </div>

                    <Button
                        size="lg"
                        onClick={handleCheck}
                        disabled={isLoading}
                        className="w-full h-16 rounded-2xl bg-emerald-500 text-black font-black uppercase tracking-wider text-xs shadow-[0_20px_40px_-10px_rgba(16,185,129,0.4)] transition-all hover:scale-[1.02] hover:bg-emerald-400 active:scale-95 group relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:animate-shimmer" />
                        {isLoading ? (
                            <Loader2 className="mr-3 w-5 h-5 animate-spin" />
                        ) : (
                            <CheckCircle className="mr-3 w-5 h-5 fill-black/10" />
                        )}
                        {isLoading ? "Vérification en cours..." : "Vérifier mon Accès Bêta"}
                    </Button>
                </div>
            )}
        </motion.div>
    );

    const renderContent = () => {
        if (!result) return renderInitialState();

        switch (result.status) {
            case "ACCESS_GRANTED_ADMIN":
            case "ACCESS_GRANTED_MEMBER":
                const isAdmin = result.status === "ACCESS_GRANTED_ADMIN";
                return (
                    <motion.div
                        key="granted"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-emerald-500/10 border border-emerald-500/30 rounded-3xl p-8 text-center backdrop-blur-xl"
                    >
                        <div className="w-20 h-20 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                            {isAdmin ? <CheckCircle className="w-10 h-10 text-emerald-400" /> : <Users className="w-10 h-10 text-emerald-400" />}
                        </div>
                        <h3 className="text-2xl font-black text-white mb-2 tracking-tighter">Accès Autorisé</h3>
                        <p className="text-zinc-400 mb-8 font-medium">
                            {isAdmin ? "Administrateur" : "Membre"} de <span className="text-emerald-400 font-bold">{result.guildName}</span>. Votre protocole est prêt.
                        </p>
                        <div className="flex flex-col gap-3">
                            <Button
                                onClick={() => router.push("/dashboard")}
                                className="w-full h-14 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase text-xs rounded-xl shadow-lg"
                            >
                                Entrer dans le QG <ArrowRight className="ml-2 w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-zinc-500 hover:text-white">Déconnexion</Button>
                        </div>
                    </motion.div>
                );

            case "PROSPECT":
                return (
                    <motion.div
                        key="prospect"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-zinc-900/50 border border-white/10 rounded-3xl p-8 text-center backdrop-blur-xl"
                    >
                        <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <Lock className="w-10 h-10 text-zinc-500" />
                        </div>
                        <h3 className="text-2xl font-black text-white mb-2 tracking-tighter">Accès Restreint</h3>
                        <p className="text-zinc-400 mb-8 max-w-xs mx-auto font-medium leading-relaxed">
                            Votre guilde n'est pas encore enregistrée dans le réseau SigilOS. Demandez une clé d'accès.
                        </p>
                        <div className="flex flex-col gap-3">
                            <Button
                                asChild
                                className="w-full h-14 bg-white text-black hover:bg-zinc-200 font-black uppercase text-xs rounded-xl"
                            >
                                <Link href={DISCORD_SUPPORT_URL} target="_blank">
                                    Demander un Accès Bêta
                                </Link>
                            </Button>
                            <Button variant="ghost" onClick={() => setResult(null)} className="text-zinc-500">Retour</Button>
                        </div>
                    </motion.div>
                );

            case "VISITOR":
                return (
                    <motion.div
                        key="visitor"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-zinc-900/50 border border-white/10 rounded-3xl p-8 text-center backdrop-blur-xl"
                    >
                        <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <Users className="w-10 h-10 text-zinc-500" />
                        </div>
                        <h3 className="text-2xl font-black text-white mb-2 tracking-tighter">Aucune Guilde</h3>
                        <p className="text-zinc-400 mb-8 font-medium leading-relaxed">
                            Votre compte Discord n'est lié à aucune guilde partenaire SigilOS.
                        </p>
                        <div className="flex flex-col gap-3">
                            <Button
                                onClick={() => {
                                    navigator.clipboard.writeText("https://sigilos.fr");
                                    toast.success("Lien copié !");
                                }}
                                className="w-full h-14 bg-white text-black hover:bg-zinc-200 font-black uppercase text-xs rounded-xl"
                            >
                                En parler à mon Meneur
                            </Button>
                            <Button variant="ghost" onClick={() => setResult(null)} className="text-zinc-500">Retour</Button>
                        </div>
                    </motion.div>
                );

            default:
                return renderInitialState();
        }
    };

    return (
        <div className="w-full max-w-sm mx-auto relative z-20">
            <AnimatePresence mode="wait">
                {renderContent()}
            </AnimatePresence>
        </div>
    );
}

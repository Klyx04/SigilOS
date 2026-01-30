"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Lock, CheckCircle, XCircle, ArrowRight, Users } from "lucide-react";
import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";

const DISCORD_SUPPORT_URL = process.env.NEXT_PUBLIC_DISCORD_SUPPORT_URL || "#";
import { checkEligibility, type EligibilityResult } from "@/server/actions/beta-actions";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function BetaGate() {
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<EligibilityResult | null>(null);
    const router = useRouter();
    const searchParams = useSearchParams();

    const { data: session, status } = useSession();

    const handleLogin = () => {
        signIn("discord", { callbackUrl: "/?check_eligibility=true" });
    };

    const handleLogout = () => {
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

    // Initial State: Button changes based on Auth Status
    const renderInitialState = () => (
        <motion.div
            key="check-btn"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
        >
            {status === "unauthenticated" ? (
                <Button
                    size="lg"
                    onClick={handleLogin}
                    className="w-full h-14 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold text-lg shadow-[0_0_30px_rgba(88,101,242,0.4)] transition-all hover:scale-[1.02]"
                >
                    <Lock className="mr-2 w-5 h-5" />
                    Connexion Admin (Discord)
                </Button>
            ) : (
                <div className="flex flex-col gap-3">
                    <Button
                        size="lg"
                        onClick={handleCheck}
                        disabled={isLoading}
                        className="w-full h-14 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-lg shadow-[0_0_30px_rgba(79,70,229,0.4)] transition-all hover:scale-[1.02]"
                    >
                        {isLoading ? (
                            <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                        ) : (
                            <CheckCircle className="mr-2 w-5 h-5" />
                        )}
                        {isLoading ? "Vérification des droits..." : "Vérifier mon Accès Bêta"}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleLogout}
                        className="text-zinc-500 hover:text-red-400 hover:bg-red-950/20"
                    >
                        Se déconnecter
                    </Button>
                </div>
            )}

            <p className="text-xs text-zinc-500 text-center">
                {status === "unauthenticated"
                    ? "Connexion sécurisée requise pour vérifier vos droits."
                    : `Connecté en tant que ${session?.user?.name || "Utilisateur"}`
                }
            </p>
        </motion.div>
    );

    // State Renders
    const renderContent = () => {
        if (!result) return renderInitialState();

        switch (result.status) {
            case "ACCESS_GRANTED_ADMIN":
                return (
                    <motion.div
                        key="granted_admin"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 text-center backdrop-blur-sm"
                    >
                        <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="w-8 h-8 text-emerald-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Accès Confirmé</h3>
                        <p className="text-zinc-300 mb-6">
                            Bienvenue, Administrateur de <span className="text-emerald-300 font-semibold">{result.guildName}</span>.
                        </p>
                        <div className="flex flex-col gap-3">
                            <Button
                                onClick={() => router.push("/dashboard")}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-12"
                            >
                                Accéder au Dashboard <ArrowRight className="ml-2 w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-zinc-500 hover:text-white">Déconnexion</Button>
                        </div>
                    </motion.div>
                );

            case "ACCESS_GRANTED_MEMBER":
                return (
                    <motion.div
                        key="granted_member"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 text-center backdrop-blur-sm"
                    >
                        <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Users className="w-8 h-8 text-emerald-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Accès Membre</h3>
                        <p className="text-zinc-300 mb-6">
                            Ravi de vous revoir, membre de <span className="text-emerald-300 font-semibold">{result.guildName}</span>.
                        </p>
                        <div className="flex flex-col gap-3">
                            <Button
                                onClick={() => router.push("/dashboard")}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-12"
                            >
                                Accéder à l'Espace Guilde <ArrowRight className="ml-2 w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-zinc-500 hover:text-white">Déconnexion</Button>
                        </div>
                    </motion.div>
                );

            case "PROSPECT":
                return (
                    <motion.div
                        key="prospect"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-6 text-center backdrop-blur-sm"
                    >
                        <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4 relative group">
                                <div className="absolute inset-0 bg-indigo-500/10 blur-xl rounded-full animate-pulse" />
                                <Lock className="w-8 h-8 text-indigo-400 relative z-10" />
                            </div>

                            <div className="space-y-2">
                                <h2 className="text-xl font-bold text-white">Accès Restreint</h2>
                                <p className="text-zinc-400 text-sm max-w-sm mx-auto">
                                    Votre guilde n'a pas encore l'autorisation d'accéder au protocole SigilOS.
                                    Demandez un accès pour rejoindre l'élite.
                                </p>
                            </div>

                            <div className="flex flex-col gap-3 max-w-xs mx-auto pt-2">
                                <Button
                                    asChild
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium h-12 rounded-lg shadow-[0_0_20px_-5px_rgba(79,70,229,0.5)] transition-all hover:scale-[1.02]"
                                >
                                    <Link href={DISCORD_SUPPORT_URL} target="_blank">
                                        Demander un accès Bêta
                                    </Link>
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => setResult(null)}
                                    className="text-zinc-400 hover:text-white"
                                >
                                    Retour
                                </Button>
                                <Button variant="ghost" size="sm" onClick={handleLogout} className="text-zinc-600 hover:text-red-400">
                                    Déconnexion
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                );

            case "VISITOR":
                return (
                    <motion.div
                        key="visitor"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-6 text-center backdrop-blur-sm"
                    >
                        <div className="w-16 h-16 bg-zinc-700/30 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Users className="w-8 h-8 text-zinc-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Pas de Guilde Linkée</h3>
                        <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                            Nous n'avons trouvé aucune guilde partenaire liée à votre compte.
                            <br />
                            SigilOS est un outil pour les guildes Dofus.
                        </p>
                        <div className="flex flex-col gap-3">
                            <Button
                                className="w-full bg-white text-black hover:bg-zinc-200"
                                onClick={() => {
                                    navigator.clipboard.writeText("Hey ! J'ai trouvé cet outil pour la guilde : https://sigilos.com");
                                    toast.success("Lien copié ! Envoyez-le à votre meneur 😉");
                                }}
                            >
                                En parler à mon Meneur (Copier Lien)
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() => setResult(null)}
                                className="text-zinc-500 hover:text-zinc-300"
                            >
                                Retour
                            </Button>
                            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-zinc-600 hover:text-red-400">Déconnexion</Button>
                        </div>
                    </motion.div>
                );

            case "NO_SESSION":
                return (
                    <motion.div
                        key="error"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center backdrop-blur-sm"
                    >
                        <h3 className="text-lg font-bold text-white mb-2">Synchronisation en cours...</h3>
                        <p className="text-zinc-400 text-sm mb-4">
                            Les serveurs Discord mettent du temps à répondre. Réessayez dans un instant.
                        </p>
                        <Button
                            onClick={handleCheck}
                            className="bg-white text-black hover:bg-zinc-200"
                        >
                            <Loader2 className="mr-2 w-4 h-4" /> Réessayer
                        </Button>
                    </motion.div>
                );

            default:
                return renderInitialState();
        }
    };

    return (
        <div className="w-full max-w-md mx-auto relative z-20">
            <AnimatePresence mode="wait">
                {renderContent()}
            </AnimatePresence>
        </div>
    );
}

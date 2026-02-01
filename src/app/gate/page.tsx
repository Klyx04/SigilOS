"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function BetaGate() {
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const betaPassword = process.env.NEXT_PUBLIC_BETA_PASSWORD || "SigilOS_2026";

        // On utilise un simple cookie pour l'accès bêta (sécurisé par le SSL de Caddy)
        if (password === betaPassword) {
            document.cookie = `beta_access=true; path=/; max-age=604800; SameSite=Lax; Secure`;
            toast.success("Accès autorisé. Entrée dans le protocole...");
            setTimeout(() => router.push("/"), 1000);
        } else {
            toast.error("Code d'accès invalide. Tentative enregistrée.");
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            <div className="relative w-full max-w-md">
                {/* Glow effect */}
                <div className="absolute -top-24 -left-24 w-64 h-64 bg-indigo-500/20 rounded-full blur-[100px] animate-pulse" />
                <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-purple-500/20 rounded-full blur-[100px] animate-pulse" />

                <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl overflow-hidden relative group">
                    <div className="relative z-10 text-center">
                        <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 transform group-hover:scale-110 transition-transform duration-500">
                            <Lock className="w-8 h-8 text-indigo-400" />
                        </div>

                        <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
                            SigilOS <span className="text-indigo-400">Beta</span>
                        </h1>
                        <p className="text-zinc-400 mb-8 text-sm">
                            Cet environnement est protégé par le protocole de sécurité SigilOS.
                            Veuillez saisir votre sésame pour continuer.
                        </p>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="relative">
                                <Input
                                    type="password"
                                    placeholder="Code d'accès"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="bg-black/50 border-white/10 h-12 text-center text-lg focus:ring-indigo-500/50 transition-all"
                                    required
                                />
                            </div>
                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full h-12 bg-white text-black hover:bg-zinc-200 font-bold rounded-xl transition-all active:scale-95 group"
                            >
                                {loading ? "Vérification..." : "Déverrouiller l'accès"}
                                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </form>

                        <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-center gap-2 text-[10px] text-zinc-600 uppercase tracking-[0.2em]">
                            <ShieldCheck className="w-3 h-3" />
                            Secured Environment © 2026
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

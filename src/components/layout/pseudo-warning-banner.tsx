"use client";

import { AlertTriangle, ArrowRight, UserCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface PseudoWarningBannerProps {
    guildId: string;
    pseudoDofus?: string | null;
}

export function PseudoWarningBanner({ guildId, pseudoDofus }: PseudoWarningBannerProps) {
    const isMissing = !pseudoDofus;
    const isVoyageur = pseudoDofus?.startsWith("Voyageur");

    return (
        <div className="relative group overflow-hidden mb-6">
            {/* Background Glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/10 animate-pulse group-hover:opacity-100 transition-opacity" />
            
            <div className={cn(
                "relative flex flex-col md:flex-row items-center justify-between gap-4 p-4 md:p-5 rounded-2xl border-2 backdrop-blur-md transition-all duration-300",
                "bg-zinc-950/40 border-amber-500/30 hover:border-amber-500/50 "
            )}>
                <div className="flex items-center gap-4 text-center md:text-left">
                    <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shrink-0">
                        <AlertTriangle className="h-6 w-6 text-amber-500 animate-bounce duration-300" />
                    </div>
                    
                    <div className="space-y-1">
                        <h3 className="text-base font-black text-zinc-100 uppercase tracking-tight">
                            {isMissing ? "⚠️ Pseudo Dofus manquant" : "🛠️ Pseudo Dofus générique détecté"}
                        </h3>
                        <p className="text-sm text-zinc-400 max-w-xl leading-relaxed">
                            {isMissing 
                                ? "Votre pseudo n'est pas renseigné. La synchronisation automatique du Ladder Succès et XP ne peut pas fonctionner sans votre nom de personnage exact."
                                : `Votre pseudo actuel est "${pseudoDofus}". Pour que le site puisse synchroniser vos succès depuis Ankama, vous devez saisir votre vrai nom de personnage.`
                            } <span className="text-amber-500 font-semibold italic">(Attention aux majuscules et accents !)</span>
                        </p>
                    </div>
                </div>

                <Link
                    href={`/dashboard/${guildId}/profile`}
                    className="flex items-center gap-2 group/btn px-6 py-3 rounded-xl bg-amber-500 text-zinc-950 font-black text-sm uppercase tracking-widest hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20  active:scale-95"
                >
                    <UserCircle className="h-4 w-4" />
                    Modifier mon profil
                    <ArrowRight className="h-4 w-4 transform group-hover/btn:translate-x-1 transition-transform" />
                </Link>
            </div>
        </div>
    );
}

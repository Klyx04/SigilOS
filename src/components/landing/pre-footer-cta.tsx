"use client";

import { useState } from "react";
import Link from "next/link";
import { AccessRequestModal } from "./AccessRequestModal";
import { loginWithDiscord } from "@/server/actions/auth-actions";
import { Sparkles } from "lucide-react";

const DiscordIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 127.14 96.36" fill="currentColor">
        <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c2.91-27.55-13.48-51.67-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
    </svg>
);

export function PreFooterCta() {
    const [showAccessModal, setShowAccessModal] = useState(false);

    return (
        <section className="w-full border-t border-border py-20">
            <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
                <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/90 to-zinc-950 px-6 py-14 md:p-16 text-center shadow-2xl backdrop-blur-xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400 mb-5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Déploiement en 30 secondes · 100% Gratuit</span>
                    </div>

                    <h2 className="text-2xl md:text-4xl font-black tracking-tight text-white mb-4 font-heading">
                        Prêt à rassembler votre guilde ?
                    </h2>

                    <p className="text-zinc-400 text-sm md:text-base max-w-lg mx-auto mb-8 leading-relaxed">
                        Ajoutez SigilOS sur votre Discord en un clic. Vos sorties donjons, quêtes Dofus et archimonstres sont synchronisés instantanément.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                        <button
                            type="button"
                            onClick={() => loginWithDiscord()}
                            className="inline-flex items-center justify-center gap-2.5 h-12 px-7 rounded-xl bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold text-sm transition-all shadow-lg shadow-[#5865F2]/25 cursor-pointer active:scale-95"
                        >
                            <DiscordIcon className="w-4 h-4" />
                            Déployer ma guilde en 1 clic
                        </button>

                        <Link
                            href="/guides/rush-sylvestre"
                            className="inline-flex items-center justify-center h-12 px-6 rounded-xl border border-white/10 hover:border-emerald-500/40 bg-white/[0.03] hover:bg-white/[0.06] text-zinc-300 hover:text-white font-medium text-sm transition-colors"
                        >
                            Tester l&apos;Overlay en jeu
                        </Link>
                    </div>

                    <div className="text-xs text-zinc-500 mt-6">
                        Besoin d&apos;aide pour une alliance ou plusieurs guildes ?{" "}
                        <button
                            type="button"
                            onClick={() => setShowAccessModal(true)}
                            className="text-zinc-400 hover:text-emerald-400 underline font-medium transition-colors cursor-pointer"
                        >
                            Ouvrir un ticket Discord
                        </button>
                    </div>
                </div>
            </div>
            <AccessRequestModal open={showAccessModal} onClose={() => setShowAccessModal(false)} />
        </section>
    );
}

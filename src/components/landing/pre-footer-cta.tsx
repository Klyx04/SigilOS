"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AccessRequestModal } from "./AccessRequestModal";
import { loginWithDiscord } from "@/server/actions/auth-actions";

const DiscordIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 127.14 96.36" fill="currentColor" aria-hidden="true">
        <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c2.91-27.55-13.48-51.67-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
    </svg>
);

export function PreFooterCta() {
    const [showAccessModal, setShowAccessModal] = useState(false);

    return (
        <section className="w-full border-t border-border py-20">
            <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
                <div className="rounded-2xl border border-border bg-surface px-6 py-12 md:p-12">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                        <div className="space-y-4 max-w-xl">
                            <p className="text-sm font-semibold text-success">
                                Déploiement en 30 secondes · 100% gratuit
                            </p>
                            <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-foreground font-heading">
                                Rassemble ta guilde ce soir.
                            </h2>
                            <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
                                Connecte ton Discord : sorties donjons, quêtes Dofus et
                                archimonstres se synchronisent tout seuls.
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Besoin d&apos;un coup de main ?{" "}
                                <button
                                    type="button"
                                    onClick={() => setShowAccessModal(true)}
                                    className="underline underline-offset-2 hover:text-foreground cursor-pointer"
                                >
                                    Ouvrir un ticket Discord
                                </button>
                            </p>
                        </div>

                        <div className="flex flex-col items-start gap-4 shrink-0">
                            <button
                                type="button"
                                onClick={() => loginWithDiscord()}
                                className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl bg-[#5865F2] hover:brightness-110 text-white font-bold text-sm cursor-pointer"
                            >
                                <DiscordIcon className="w-4 h-4" />
                                Connecter mon Discord
                            </button>
                            <Link
                                href="/guides/rush-sylvestre"
                                className="group inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground"
                            >
                                <span>Tester l&apos;overlay en jeu</span>
                                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
            <AccessRequestModal open={showAccessModal} onClose={() => setShowAccessModal(false)} />
        </section>
    );
}

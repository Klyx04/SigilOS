"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { User } from "next-auth";
import { ChevronRight, Sparkles } from "lucide-react";
import { AccessRequestModal } from "./AccessRequestModal";
import { loginWithDiscord } from "@/server/actions/auth-actions";

const DiscordIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 127.14 96.36" fill="currentColor">
        <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c2.91-27.55-13.48-51.67-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
    </svg>
);

interface HeroSectionProps {
    user?: User;
    userGuilds?: { id: string; name: string; iconUrl: string | null }[];
    /** 🖼️ #140 — image du hero pilotée par le God (section "hero"), sinon capture par défaut. */
    heroImageUrl?: string;
}

export function HeroSection({ user, userGuilds = [], heroImageUrl }: HeroSectionProps) {
    const [showAccessModal, setShowAccessModal] = useState(false);
    const [zoomOpen, setZoomOpen] = useState(false);

    const heroSrc = heroImageUrl || "/assets/screenshots/screenshot1.png";

    return (
        <section className="relative w-full border-b border-border overflow-hidden">
            <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8 pt-32 pb-16 lg:pt-36 lg:pb-24">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

                    {/* Copy */}
                    <div className="max-w-xl">
                        <p className="text-caption font-semibold uppercase tracking-[0.14em] text-success mb-5">
                            SigilOS · Dofus Unity
                        </p>
                        <h1 className="text-[clamp(2.1rem,4.6vw,3.5rem)] font-bold tracking-tight text-foreground leading-[1.08] mb-5">
                            Votre guilde mérite mieux
                            qu&apos;un <span className="text-success">tableur Discord.</span>
                        </h1>
                        <p className="text-[15px] md:text-base text-muted-foreground leading-relaxed mb-8 max-w-md">
                            Quêtes, sorties, membres et progression Dofus réunis dans un espace partagé, relié à Discord.
                        </p>

                        {/* CTAs */}
                        {user && userGuilds.length > 0 ? (
                            <div className="flex flex-col items-start gap-3">
                                <Link
                                    href="/dashboard"
                                    className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-success hover:bg-success text-success-foreground font-bold text-sm transition-colors"
                                >
                                    Accéder au Dashboard
                                    <ChevronRight className="w-4 h-4" />
                                </Link>
                            </div>
                        ) : user ? (
                            <div className="flex flex-col items-start gap-3">
                                <button
                                    onClick={() => setShowAccessModal(true)}
                                    className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-success hover:bg-success text-success-foreground font-bold text-sm transition-colors"
                                >
                                    Demander l&apos;accès pour ma guilde
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-start gap-4">
                                <div className="flex items-center gap-3 flex-wrap">
                                    <form action={loginWithDiscord}>
                                        <button
                                            type="submit"
                                            className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold text-sm transition-all shadow-md shadow-[#5865F2]/20 cursor-pointer"
                                        >
                                            <DiscordIcon className="w-4 h-4" />
                                            Installer sur mon Discord
                                        </button>
                                    </form>
                                    <Link
                                        href="/guides/rush-sylvestre"
                                        className="inline-flex items-center justify-center gap-2 h-12 px-5 rounded-xl bg-surface hover:bg-surface/80 text-foreground font-bold text-sm border border-border transition-colors shadow-sm"
                                    >
                                        <Sparkles className="w-4 h-4 text-emerald-400" />
                                        Tester l&apos;Overlay sans compte
                                    </Link>
                                </div>
                                <div className="flex items-center gap-2 text-caption text-muted-foreground">
                                    <span>⚡ Déploiement en 30 secondes · 100% Gratuit</span>
                                    <span>·</span>
                                    <button
                                        type="button"
                                        onClick={() => setShowAccessModal(true)}
                                        className="hover:text-foreground underline transition-colors"
                                    >
                                        Besoin d&apos;aide ou alliance ?
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Product visual */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setZoomOpen(true)}
                            className="block w-full text-left rounded-2xl border border-border bg-surface overflow-hidden shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)] cursor-zoom-in transition-transform hover:scale-[1.01]"
                            aria-label="Agrandir la capture d'écran"
                        >
                            <div className="h-9 border-b border-border flex items-center gap-1.5 px-4">
                                <span className="w-2.5 h-2.5 rounded-full bg-muted" />
                                <span className="w-2.5 h-2.5 rounded-full bg-muted" />
                                <span className="w-2.5 h-2.5 rounded-full bg-success/70" />
                            </div>
                            <div className="relative aspect-[16/10]">
                                <Image
                                    src={heroSrc}
                                    alt="Tableau de bord SigilOS : missions, sorties et progression de guilde"
                                    fill
                                    className="object-cover object-top"
                                    sizes="(max-width: 1024px) 100vw, 560px"
                                    priority
                                />
                            </div>
                        </button>
                    </div>
                </div>
            </div>

            {/* 🖼️ #140 — zoom plein écran de l'image du hero */}
            {zoomOpen && (
                <div
                    className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
                    onClick={() => setZoomOpen(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Capture d'écran agrandie"
                >
                    <div className="relative w-full max-w-6xl max-h-[92vh]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={heroSrc}
                            alt="Capture d'écran SigilOS agrandie"
                            className="w-full h-full max-h-[92vh] object-contain rounded-xl border border-border shadow-2xl"
                        />
                    </div>
                </div>
            )}

            <AccessRequestModal open={showAccessModal} onClose={() => setShowAccessModal(false)} />
        </section>
    );
}

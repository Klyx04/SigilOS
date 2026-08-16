"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { User } from "next-auth";
import { ChevronRight } from "lucide-react";
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
}

export function HeroSection({ user, userGuilds = [] }: HeroSectionProps) {
    const [showAccessModal, setShowAccessModal] = useState(false);

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
                                    className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-success hover:bg-success text-[#06241a] font-bold text-sm transition-colors"
                                >
                                    Accéder au Dashboard
                                    <ChevronRight className="w-4 h-4" />
                                </Link>
                            </div>
                        ) : user ? (
                            <div className="flex flex-col items-start gap-3">
                                <button
                                    onClick={() => setShowAccessModal(true)}
                                    className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-success hover:bg-success text-[#06241a] font-bold text-sm transition-colors"
                                >
                                    Demander l&apos;accès pour ma guilde
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-start gap-4">
                                <button
                                    onClick={() => setShowAccessModal(true)}
                                    className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-success hover:bg-success text-[#06241a] font-bold text-sm transition-colors"
                                >
                                    Créer l&apos;espace de ma guilde
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                                <form action={loginWithDiscord}>
                                    <button
                                        type="submit"
                                        className="inline-flex items-center gap-2 text-body-sm text-muted-foreground hover:text-success font-medium transition-colors"
                                    >
                                        <DiscordIcon className="w-4 h-4" />
                                        Déjà membre ? Se connecter avec Discord
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>

                    {/* Product visual */}
                    <div className="relative">
                        <div className="rounded-2xl border border-border bg-[#101313] overflow-hidden shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)]">
                            <div className="h-9 border-b border-border flex items-center gap-1.5 px-4">
                                <span className="w-2.5 h-2.5 rounded-full bg-muted" />
                                <span className="w-2.5 h-2.5 rounded-full bg-muted" />
                                <span className="w-2.5 h-2.5 rounded-full bg-success/70" />
                            </div>
                            <div className="relative aspect-[16/10]">
                                <Image
                                    src="/assets/screenshots/screenshot1.png"
                                    alt="Tableau de bord SigilOS : missions, sorties et progression de guilde"
                                    fill
                                    className="object-cover object-top"
                                    sizes="(max-width: 1024px) 100vw, 560px"
                                    priority
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <AccessRequestModal open={showAccessModal} onClose={() => setShowAccessModal(false)} />
        </section>
    );
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { Maximize2, ExternalLink } from "lucide-react";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { ModuleHelpActions } from "@/components/doc/module-help-actions";

/** Icônes officielles du jeu (dump HD `dofus_assets/icons_assets_2x`). */
const FEATURES = [
    { icon: "/assets/dofus/icons/world.png", title: "Tous les mondes", text: "Le monde des Douze complet, en tuiles HD navigables." },
    { icon: "/assets/dofus/icons/zaap.png", title: "Zaaps", text: "Chaque zaap positionné, avec ses destinations." },
    { icon: "/assets/dofus/icons/boss.png", title: "Donjons", text: "Chaque donjon et son boss, Quête Ocre incluse." },
    { icon: "/assets/dofus/icons/archimonster.png", title: "Archimonstres", text: "Leur position exacte, map par map." },
    { icon: "/assets/dofus/icons/pickaxe.png", title: "Ressources", text: "Localisation des spots de récolte par métier." },
    { icon: "/assets/dofus/icons/magnifier.png", title: "Recherche", text: "Une recherche, la carte se centre sur la map." }
];

export function WorldmapLanding({ guildId }: { guildId: string }) {
    const handleOpenOverlay = () => {
        const width = 560;
        const height = 720;
        const left = Math.max(0, (typeof window !== 'undefined' ? window.screen.width : 1920) - width - 40);
        const top = 60;
        window.open(
            `/overlay/worldmap/${guildId}`,
            'sigil-worldmap-overlay',
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no`
        );
    };
    return (
        <div className="fixed top-[64px] md:top-[88px] bottom-[76px] left-0 md:left-[280px] right-0 z-[40] bg-background flex flex-col overflow-hidden rounded-b-3xl border-b border-border mx-2">
            <div className="worldmap-header flex-shrink-0 px-3 md:px-5 py-2 border-b border-border bg-surface/60 backdrop-blur-md">
                <UnifiedModuleHeader
                    title="Carte du Monde"
                    description="Explorez le monde des Douze"
                    imageSrc="/assets/dofus/modules/map.png"
                    backHref={`/dashboard/${guildId}`}
                    compact={true}
                    className="mb-0"
                    actions={<ModuleHelpActions docSlug="worldmap" docTitle="Carte Interactive Dofus HD" />}
                />
            </div>

            <div className="flex-1 overflow-y-auto">
                <div className="lg:h-full flex flex-col lg:flex-row gap-5 p-4 md:p-6">
                    {/* Colonne gauche : intro + fonctionnalités + CTA */}
                    <div className="flex flex-col gap-5 lg:flex-1 lg:justify-center">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Maximize2 className="h-4 w-4" />
                                <span className="text-xs font-semibold uppercase tracking-wide">Explorer le monde des Douze</span>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
                                Bienvenue sur la Carte du Monde
                            </h1>
                            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                                Retrouvez d&apos;un seul coup d&apos;œil toutes les cartes du jeu, les zaaps, les donjons, les
                                archimonstres et les ressources récoltables. Ouvrez la carte en plein écran pour une navigation
                                fluide sur tous les mondes disponibles.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {FEATURES.map((f) => (
                                <div
                                    key={f.title}
                                    className="rounded-xl border border-border bg-card px-3.5 py-3 flex flex-col gap-1 hover:border-border-strong transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <Image src={f.icon} alt="" width={22} height={22} className="w-[22px] h-[22px] object-contain shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]" />
                                        <h2 className="text-sm font-semibold text-foreground">{f.title}</h2>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">{f.text}</p>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
                            <div className="space-y-0.5">
                                <h2 className="text-base font-bold text-foreground">Prêt à explorer ?</h2>
                                <p className="text-xs text-muted-foreground">La croix vous ramène à cet accueil.</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2.5">
                                <button
                                    onClick={handleOpenOverlay}
                                    type="button"
                                    className="inline-flex items-center gap-2 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 hover:text-sky-300 border border-sky-500/30 hover:border-sky-400/60 text-sm font-semibold px-4 py-2.5 transition-all cursor-pointer shadow-sm active:scale-95"
                                    title="Ouvrir la carte dans une fenêtre overlay autonome"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                    Ouvrir l&apos;overlay
                                </button>
                                <Link
                                    href={`/dashboard/${guildId}/worldmap?play=1`}
                                    className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold px-5 py-2.5 hover:bg-primary/90 transition-colors cursor-pointer shadow-sm"
                                >
                                    <Maximize2 className="h-4 w-4" />
                                    Ouvrir la carte en plein écran
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* Colonne droite : aperçu HD (Astrub, cité) */}
                    <div className="lg:w-[42%] flex flex-col lg:min-h-0">
                        <div className="relative flex-1 rounded-xl border border-border bg-surface overflow-hidden lg:min-h-0 min-h-[240px]">
                            <Image
                                src="/assets/worldmap/astrub-apercu.webp"
                                alt="Aperçu HD de la carte : la cité d'Astrub"
                                fill
                                loading="lazy"
                                sizes="(max-width: 1024px) 100vw, 42vw"
                                className="object-cover"
                            />
                            <span className="absolute left-3 bottom-3 px-2.5 py-1 rounded-lg text-xs font-semibold bg-black/60 text-zinc-100 border border-white/10">
                                Astrub — cartes HD
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

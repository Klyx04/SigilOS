import Link from "next/link";
import {
    Map,
    Zap,
    Swords,
    Bug,
    Sprout,
    Compass,
    Maximize2
} from "lucide-react";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { ModuleHelpActions } from "@/components/doc/module-help-actions";

const FEATURES = [
    { icon: Map, title: "Tous les mondes", text: "Chaque monde est disponible et navigable." },
    { icon: Zap, title: "Zaaps", text: "Localisez les zaaps et leurs destinations." },
    { icon: Swords, title: "Donjons", text: "Tous les donjons, y compris la Quête Ocre." },
    { icon: Bug, title: "Archimonstres", text: "Retrouvez-les sur chaque map en un clic." },
    { icon: Sprout, title: "Farm & GPS", text: "Itinéraires de récolte optimisés." },
    { icon: Compass, title: "Recherche & navigation", text: "Centre la carte sur la map cherchée." }
];

export function WorldmapLanding({ guildId }: { guildId: string }) {
    return (
        <div className="fixed top-[64px] md:top-[88px] bottom-[76px] left-0 md:left-[280px] right-0 z-[40] bg-background flex flex-col overflow-hidden rounded-b-3xl border-b border-border mx-2">
            <div className="worldmap-header flex-shrink-0 px-3 md:px-5 py-2 border-b border-border bg-surface/60 backdrop-blur-md">
                <UnifiedModuleHeader
                    title="Carte du Monde"
                    description="Explorez le monde des Douze"
                    imageSrc="/assets/nav/world.png"
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
                                archimonstres et les itinéraires de farm. Ouvrez la carte en plein écran pour une navigation
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
                                        <f.icon className="h-4 w-4 text-primary shrink-0" />
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
                            <Link
                                href={`/dashboard/${guildId}/worldmap?play=1`}
                                className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold px-5 py-2.5 hover:bg-primary/90 transition-colors cursor-pointer"
                            >
                                <Maximize2 className="h-4 w-4" />
                                Ouvrir la carte en plein écran
                            </Link>
                        </div>
                    </div>

                    {/* Colonne droite : aperçu de la carte */}
                    <div className="lg:w-[42%] flex flex-col lg:min-h-0">
                        <div className="flex-1 rounded-xl border border-border bg-surface overflow-hidden lg:min-h-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src="/assets/worldmap/map-monde.png"
                                alt="Aperçu de la carte du monde"
                                loading="lazy"
                                className="w-full h-full object-cover"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

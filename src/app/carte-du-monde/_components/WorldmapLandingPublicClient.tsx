"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Maximize2,
  ExternalLink,
  Map as MapIcon,
  ChevronRight,
} from "lucide-react";

// Chargement dynamique (Leaflet ne peut pas être SSR)
const MapViewer = dynamic(
  () => import("@/components/worldmap/map-viewer").then((m) => m.MapViewer),
  { ssr: false }
);

const FEATURES = [
  {
    image: "/assets/worldmap/map-monde.png",
    tag: "Monde des Douze",
    title: "Tous les Mondes",
    text: "Le monde des Douze complet, en tuiles HD navigables. Astrub, les Frigosts, Enurado…",
  },
  {
    image: "/assets/dofus/map-layers/icon-zaap-color.png",
    tag: "Téléportations",
    title: "Zaaps",
    text: "Chaque zaap positionné avec ses destinations exactes pour optimiser vos voyages.",
  },
  {
    image: "/assets/dofus/map-layers/icon-boss.png",
    tag: "Donjons & Boss",
    title: "Donjons & Boss",
    text: "Localisation de chaque donjon, son boss et les succès associés. Quête Ocre incluse.",
  },
  {
    image: "/assets/icons/ocre.png",
    tag: "Éternelle Moisson",
    title: "Archimonstres",
    text: "Position exacte map par map. Suivez les avis de recherche de chaque zone.",
  },
  {
    image: "/assets/dofus/map-layers/icon-harvest-gold.png",
    tag: "Métiers",
    title: "Ressources & Récolte",
    text: "Localisation des spots par métier : bûcheron, mineur, alchimiste, pêcheur…",
  },
  {
    image: "/assets/dofus/game-icons/treasure-map.png",
    tag: "Navigation",
    title: "Recherche Instantanée",
    text: "Tapez un nom de zone, la carte se centre automatiquement sur la bonne map.",
  },
];

interface Props {
  isPlay: boolean;
  initialX?: number;
  initialY?: number;
  initialZoom?: number;
  initialWorldId?: number;
}

export function WorldmapLandingPublicClient({
  isPlay,
  initialX,
  initialY,
  initialZoom,
  initialWorldId,
}: Props) {
  const [showMap, setShowMap] = useState(isPlay);

  const handleOpenOverlay = () => {
    const width = 560;
    const height = 720;
    const left = Math.max(0, window.screen.width - width - 40);
    const top = 60;
    window.open(
      "/overlay/worldmap",
      "sigil-worldmap-public-overlay",
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no`
    );
  };

  // Mode plein écran interactif
  if (showMap) {
    return (
      <div className="fixed inset-0 top-[60px] bg-[#080a10] z-50">
        <MapViewer
          initialTab="map"
          initialX={initialX}
          initialY={initialY}
          initialZoom={initialZoom}
          initialWorldId={initialWorldId}
          hideUI={false}
          startFullscreen={true}
          isOverlay={false}
          isPublic={true}
        />
      </div>
    );
  }

  // Mode landing SEO
  return (
    <div className="relative overflow-hidden">
      {/* Gradient de fond décoratif */}
      <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-emerald-500/5 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-teal-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Hero */}
      <section className="relative px-4 pt-16 pb-10 md:pt-24 md:pb-16 max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
          {/* Texte hero */}
          <div className="flex-1 flex flex-col gap-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 self-center lg:self-start px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-bold uppercase tracking-widest">
              <MapIcon className="h-3.5 w-3.5" />
              Dofus Unity — 100% Gratuit
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-foreground leading-[1.1]">
              Carte du Monde{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-400">
                Dofus Unity
              </span>{" "}
              Interactive
            </h1>

            <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto lg:mx-0">
              Naviguez sur tous les mondes du jeu en tuiles haute définition. Retrouvez instantanément
              zaaps, donjons, archimonstres, ressources à récolter et passages secrets — sans compte, sans
              inscription.
            </p>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start">
              <button
                id="btn-open-fullscreen"
                onClick={() => setShowMap(true)}
                className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-bold px-6 py-3.5 text-base hover:from-teal-400 hover:to-emerald-400 transition-all shadow-lg shadow-teal-500/25 active:scale-95 cursor-pointer"
              >
                <Maximize2 className="h-5 w-5" />
                Ouvrir la carte en plein écran
              </button>
              <button
                id="btn-open-overlay"
                onClick={handleOpenOverlay}
                className="inline-flex items-center gap-2.5 rounded-xl bg-surface border border-border hover:border-border-strong text-foreground font-semibold px-5 py-3.5 text-base transition-all active:scale-95 cursor-pointer"
              >
                <ExternalLink className="h-5 w-5 text-sky-400" />
                Ouvrir l&apos;overlay
              </button>
            </div>

            <p className="text-xs text-muted-foreground/60">
              La croix ferme le plein écran et vous ramène ici. L&apos;overlay s&apos;ouvre dans une petite fenêtre indépendante.
            </p>
          </div>

          {/* Aperçu HD */}
          <div className="w-full lg:w-[48%] xl:w-[52%] shrink-0">
            <div
              className="relative rounded-2xl overflow-hidden border border-border shadow-2xl cursor-pointer group"
              onClick={() => setShowMap(true)}
              title="Cliquer pour ouvrir la carte interactive"
            >
              <Image
                src="/assets/worldmap/astrub-apercu.webp"
                alt="Aperçu HD de la carte du monde Dofus Unity — la cité d'Astrub"
                width={900}
                height={540}
                priority
                className="w-full object-cover aspect-[5/3] group-hover:scale-[1.02] transition-transform duration-500"
              />
              {/* Overlay au survol */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-500 text-white font-bold text-sm shadow-lg">
                  <Maximize2 className="h-4 w-4" />
                  Ouvrir la carte interactive
                </span>
              </div>
              <span className="absolute left-3 bottom-3 px-2.5 py-1 rounded-lg text-xs font-semibold bg-black/70 text-zinc-100 border border-white/10">
                Astrub — tuiles HD
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Grille de fonctionnalités */}
      <section className="px-4 py-12 md:py-16 max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-black text-foreground tracking-tight mb-3">
            Tout ce dont vous avez besoin
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm md:text-base">
            Une carte complète, interactive et en haute définition, disponible gratuitement pour tous les
            joueurs Dofus Unity.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-border/80 bg-surface/50 p-6 flex flex-col gap-4 hover:border-teal-500/40 hover:bg-surface/80 transition-all shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-black/50 border border-white/10 flex items-center justify-center p-2 shrink-0 group-hover:border-teal-500/40 group-hover:bg-teal-500/10 transition-all shadow-inner">
                  <img
                    src={f.image}
                    alt={f.title}
                    className="w-8 h-8 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] group-hover:scale-110 transition-transform duration-300"
                  />
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-muted-foreground group-hover:text-teal-300 group-hover:border-teal-500/30 transition-colors">
                  {f.tag}
                </span>
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground mb-1.5 group-hover:text-teal-400 transition-colors">
                  {f.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {f.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA bas de page */}
      <section className="px-4 py-12 max-w-4xl mx-auto text-center">
        <div className="rounded-2xl border border-border bg-card/60 p-8 md:p-12 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-emerald-500/5 pointer-events-none" />
          <h2 className="text-xl md:text-2xl font-black text-foreground mb-3 relative">
            Prêt à explorer le monde des Douze ?
          </h2>
          <p className="text-muted-foreground text-sm mb-6 relative max-w-md mx-auto">
            La carte est entièrement gratuite. Pas de compte requis. Ouvrez-la directement ou en overlay
            par-dessus votre client de jeu.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 relative">
            <button
              id="btn-open-fullscreen-bottom"
              onClick={() => setShowMap(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-bold px-6 py-3 text-sm hover:from-teal-400 hover:to-emerald-400 transition-all shadow-lg shadow-teal-500/25 active:scale-95 cursor-pointer"
            >
              <Maximize2 className="h-4 w-4" />
              Ouvrir en plein écran
            </button>
            <button
              id="btn-open-overlay-bottom"
              onClick={handleOpenOverlay}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface hover:border-border-strong text-foreground font-semibold px-5 py-3 text-sm transition-all active:scale-95 cursor-pointer"
            >
              <ExternalLink className="h-4 w-4 text-sky-400" />
              Overlay détachable
            </button>
          </div>
        </div>
      </section>

      {/* Lien SigilOS */}
      <section className="px-4 pb-10 max-w-4xl mx-auto text-center">
        <p className="text-xs text-muted-foreground/60">
          Vous êtes chef de guilde Dofus Unity ?{" "}
          <Link
            href="/guilds"
            className="text-teal-400 hover:text-teal-300 inline-flex items-center gap-1 font-semibold transition-colors"
          >
            Rejoignez SigilOS
            <ChevronRight className="h-3 w-3" />
          </Link>{" "}
          pour accéder au suivi de succès, dungeon finder, calendrier de guilde et bien plus.
        </p>
      </section>
    </div>
  );
}

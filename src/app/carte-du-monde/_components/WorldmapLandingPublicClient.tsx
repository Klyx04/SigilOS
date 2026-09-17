"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Maximize2, ExternalLink } from "lucide-react";

/**
 * Carte du monde — page publique (registre).
 *
 * Ce qui a été retiré : le badge pilule « 🗺 DOFUS UNITY — 100% GRATUIT », le
 * titre en `font-black` avec « Dofus Unity » en dégradé `bg-clip-text`, l'orbe
 * `blur-[120px]`, les calques de dégradés de fond, les six cartes `rounded-2xl`
 * à ombre, les tuiles d'icônes `bg-black/50 border-white/10` et les boutons
 * `bg-gradient-to-r … shadow-lg active:scale-95`.
 *
 * Ce qui a été conservé, volontairement : les assets Dofus. Un asset du jeu
 * n'est pas du décor — c'est une référence au produit (zaap, boss, récolte,
 * carte au trésor) et il porte de l'information. Ils vivent désormais en colonne
 * « Repère » d'un tableau, à côté du libellé qui les explique (`alt` vide : ils
 * illustrent un texte déjà écrit).
 *
 * Aperçu Astrub : gardé, avec sa légende sous l'image au lieu d'un badge
 * superposé, et sans voile noir au survol.
 */

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

  // Mode page publique
  return (
    <>
      <section className="reg-section reg-section-tight" aria-labelledby="carte-titre">
        <div className="reg-shell">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start lg:gap-12">
            <div>
              <h1
                id="carte-titre"
                className="max-w-[30ch] text-[clamp(1.75rem,3.2vw,2.5rem)] font-bold leading-[1.12] tracking-tight text-foreground"
              >
                Carte du monde Dofus Unity interactive
              </h1>
              <p className="mt-4 max-w-[62ch] text-base text-muted-foreground leading-relaxed">
                Naviguez sur tous les mondes du jeu en tuiles haute définition. Retrouvez instantanément
                zaaps, donjons, archimonstres, ressources à récolter et passages secrets — sans compte, sans
                inscription.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  id="btn-open-fullscreen"
                  type="button"
                  onClick={() => setShowMap(true)}
                  className="reg-btn reg-btn-primary"
                >
                  <Maximize2 className="h-4 w-4" aria-hidden="true" />
                  Ouvrir la carte en plein écran
                </button>
                <button
                  id="btn-open-overlay"
                  type="button"
                  onClick={handleOpenOverlay}
                  className="reg-btn reg-btn-secondary"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Ouvrir l&apos;overlay
                </button>
              </div>

              <p className="mt-4 text-xs text-muted-foreground">
                La croix ferme le plein écran et vous ramène ici. L&apos;overlay s&apos;ouvre dans une petite fenêtre indépendante.
              </p>
            </div>

            {/* Aperçu HD — asset conservé, légende sous l'image au lieu d'un badge superposé. */}
            <figure className="m-0">
              <button
                type="button"
                onClick={() => setShowMap(true)}
                className="reg-screen block w-full cursor-pointer"
                aria-label="Ouvrir la carte interactive depuis l'aperçu d'Astrub"
              >
                <Image
                  src="/assets/worldmap/astrub-apercu.webp"
                  alt="Aperçu HD de la carte du monde Dofus Unity — la cité d'Astrub"
                  width={900}
                  height={540}
                  priority
                  className="aspect-[5/3] w-full object-cover"
                />
              </button>
              <figcaption className="mt-2 text-xs text-muted-foreground">Astrub — tuiles HD</figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* Couches de la carte — un tableau, pas une grille de cartes. */}
      <section className="reg-section" aria-labelledby="carte-couches-titre">
        <div className="reg-shell">
          <h2
            id="carte-couches-titre"
            className="text-[clamp(1.25rem,2vw,1.5rem)] font-bold tracking-tight text-foreground"
          >
            Tout ce dont vous avez besoin
          </h2>
          <p className="mt-3 max-w-[68ch] text-sm text-muted-foreground leading-relaxed">
            Une carte complète, interactive et en haute définition, disponible gratuitement pour tous les
            joueurs Dofus Unity.
          </p>

          <div className="mt-8 overflow-x-auto">
            <table className="reg-table">
              <thead>
                <tr>
                  <th scope="col" className="w-[16rem]">Repère</th>
                  <th scope="col" className="hidden w-[11rem] sm:table-cell">Couche</th>
                  <th scope="col">Ce que la carte montre</th>
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((feature) => (
                  <tr key={feature.title}>
                    <th
                      scope="row"
                      className="border-b border-border py-[0.85rem] pr-4 text-left align-top text-sm font-semibold normal-case tracking-normal text-foreground"
                    >
                      <span className="flex items-start gap-3">
                        <Image
                          src={feature.image}
                          alt=""
                          width={22}
                          height={22}
                          aria-hidden="true"
                          className="mt-0.5 h-[22px] w-[22px] shrink-0 object-contain"
                        />
                        <span>{feature.title}</span>
                      </span>
                    </th>
                    <td className="hidden text-xs text-muted-foreground sm:table-cell">{feature.tag}</td>
                    <td className="text-sm text-muted-foreground">{feature.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA bas de page */}
      <section className="reg-section reg-section-tight" aria-labelledby="carte-cta-titre">
        <div className="reg-shell">
          <div className="reg-panel p-6 md:p-8">
            <h2
              id="carte-cta-titre"
              className="text-[clamp(1.25rem,2vw,1.5rem)] font-bold tracking-tight text-foreground"
            >
              Prêt à explorer le monde des Douze ?
            </h2>
            <p className="mt-3 max-w-[62ch] text-sm text-muted-foreground leading-relaxed">
              La carte est entièrement gratuite. Pas de compte requis. Ouvrez-la directement ou en overlay
              par-dessus votre client de jeu.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                id="btn-open-fullscreen-bottom"
                type="button"
                onClick={() => setShowMap(true)}
                className="reg-btn reg-btn-primary"
              >
                <Maximize2 className="h-4 w-4" aria-hidden="true" />
                Ouvrir en plein écran
              </button>
              <button
                id="btn-open-overlay-bottom"
                type="button"
                onClick={handleOpenOverlay}
                className="reg-btn reg-btn-secondary"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Overlay détachable
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Lien SigilOS */}
      <section className="pb-12">
        <div className="reg-shell">
          <p className="text-xs text-muted-foreground">
            Vous êtes chef de guilde Dofus Unity ?{" "}
            <Link href="/guilds" className="reg-link">
              Rejoignez SigilOS
            </Link>{" "}
            pour accéder au suivi de succès, dungeon finder, calendrier de guilde et bien plus.
          </p>
        </div>
      </section>
    </>
  );
}

"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Maximize2, ExternalLink } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

// Chargement dynamique (Leaflet ne peut pas être SSR)
const MapViewer = dynamic(
  () => import("@/components/worldmap/map-viewer").then((m) => m.MapViewer),
  { ssr: false }
);

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
  const { t, locale } = useI18n();
  const [showMap, setShowMap] = useState(isPlay);

  const features = [
    {
      image: "/assets/worldmap/map-monde.png",
      tag: t.worldmapPage.features.allWorldsTag,
      title: t.worldmapPage.features.allWorldsTitle,
      text: t.worldmapPage.features.allWorldsDesc,
    },
    {
      image: "/assets/dofus/map-layers/icon-zaap-color.png",
      tag: t.worldmapPage.features.zaapsTag,
      title: t.worldmapPage.features.zaapsTitle,
      text: t.worldmapPage.features.zaapsDesc,
    },
    {
      image: "/assets/dofus/map-layers/icon-boss.png",
      tag: t.worldmapPage.features.dungeonsTag,
      title: t.worldmapPage.features.dungeonsTitle,
      text: t.worldmapPage.features.dungeonsDesc,
    },
    {
      image: "/assets/icons/ocre.png",
      tag: t.worldmapPage.features.archisTag,
      title: t.worldmapPage.features.archisTitle,
      text: t.worldmapPage.features.archisDesc,
    },
    {
      image: "/assets/dofus/map-layers/icon-harvest-gold.png",
      tag: t.worldmapPage.features.harvestTag,
      title: t.worldmapPage.features.harvestTitle,
      text: t.worldmapPage.features.harvestDesc,
    },
    {
      image: "/assets/dofus/game-icons/treasure-map.png",
      tag: t.worldmapPage.features.searchTag,
      title: t.worldmapPage.features.searchTitle,
      text: t.worldmapPage.features.searchDesc,
    },
  ];

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
                {t.worldmapPage.title}
              </h1>
              <p className="mt-4 max-w-[62ch] text-base text-muted-foreground leading-relaxed">
                {t.worldmapPage.subtitle}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  id="btn-open-fullscreen"
                  type="button"
                  onClick={() => setShowMap(true)}
                  className="reg-btn reg-btn-primary cursor-pointer"
                >
                  <Maximize2 className="h-4 w-4" aria-hidden="true" />
                  {t.worldmapPage.openFullscreen}
                </button>
                <button
                  id="btn-open-overlay"
                  type="button"
                  onClick={handleOpenOverlay}
                  className="reg-btn reg-btn-secondary cursor-pointer"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  {t.worldmapPage.openOverlay}
                </button>
              </div>

              <p className="mt-4 text-xs text-muted-foreground">
                {locale === "en"
                  ? "The cross button closes fullscreen and returns here. The overlay opens in a detached mini-window over your game."
                  : "La croix ferme le plein écran et vous ramène ici. L'overlay s'ouvre dans une petite fenêtre indépendante."}
              </p>
            </div>

            {/* Aperçu HD */}
            <figure className="m-0">
              <button
                type="button"
                onClick={() => setShowMap(true)}
                className="reg-screen block w-full cursor-pointer"
                aria-label={locale === "en" ? "Open interactive map from Astrub preview" : "Ouvrir la carte interactive depuis l'aperçu d'Astrub"}
              >
                <Image
                  src="/assets/worldmap/astrub-apercu.webp"
                  alt={t.worldmapPage.astrubPreviewCaption}
                  width={900}
                  height={540}
                  priority
                  className="aspect-[5/3] w-full object-cover"
                />
              </button>
              <figcaption className="mt-2 text-xs text-muted-foreground">
                {t.worldmapPage.astrubPreviewCaption}
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* Couches de la carte */}
      <section className="reg-section" aria-labelledby="carte-couches-titre">
        <div className="reg-shell">
          <h2
            id="carte-couches-titre"
            className="text-[clamp(1.25rem,2vw,1.5rem)] font-bold tracking-tight text-foreground"
          >
            {t.worldmapPage.featuresTitle}
          </h2>
          <p className="mt-3 max-w-[68ch] text-sm text-muted-foreground leading-relaxed">
            {locale === "en"
              ? "A complete, high-definition interactive map, accessible free of charge to all Dofus Unity players."
              : "Une carte complète, interactive et en haute définition, disponible gratuitement pour tous les joueurs Dofus Unity."}
          </p>

          <div className="mt-8 overflow-x-auto">
            <table className="reg-table">
              <thead>
                <tr>
                  <th scope="col" className="w-[16rem]">{t.worldmapPage.repereCol}</th>
                  <th scope="col" className="hidden w-[11rem] sm:table-cell">{t.worldmapPage.featureCol}</th>
                  <th scope="col">{t.worldmapPage.descriptionCol}</th>
                </tr>
              </thead>
              <tbody>
                {features.map((feature) => (
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
              {locale === "en" ? "Ready to explore the World of Twelve?" : "Prêt à explorer le monde des Douze ?"}
            </h2>
            <p className="mt-3 max-w-[62ch] text-sm text-muted-foreground leading-relaxed">
              {locale === "en"
                ? "The map is completely free. No account required. Open it directly or in overlay over your game client."
                : "La carte est entièrement gratuite. Pas de compte requis. Ouvrez-la directement ou en overlay par-dessus votre client de jeu."}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                id="btn-open-fullscreen-bottom"
                type="button"
                onClick={() => setShowMap(true)}
                className="reg-btn reg-btn-primary cursor-pointer"
              >
                <Maximize2 className="h-4 w-4" aria-hidden="true" />
                {t.worldmapPage.openFullscreen}
              </button>
              <button
                id="btn-open-overlay-bottom"
                type="button"
                onClick={handleOpenOverlay}
                className="reg-btn reg-btn-secondary cursor-pointer"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                {t.worldmapPage.openOverlay}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Lien SigilOS */}
      <section className="pb-12">
        <div className="reg-shell">
          <p className="text-xs text-muted-foreground">
            {locale === "en" ? "Are you a Dofus Unity guild leader? " : "Vous êtes chef de guilde Dofus Unity ? "}
            <Link href="/guilds" className="reg-link">
              {locale === "en" ? "Join SigilOS" : "Rejoignez SigilOS"}
            </Link>{" "}
            {locale === "en"
              ? "to access achievement tracking, dungeon finder, guild calendar and much more."
              : "pour accéder au suivi de succès, dungeon finder, calendrier de guilde et bien plus."}
          </p>
        </div>
      </section>
    </>
  );
}

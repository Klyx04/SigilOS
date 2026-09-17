"use client";

import React, { useEffect, useMemo } from "react";
import { X, MapPin, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";
import { RushOverlayDungeonCard } from "./RushOverlayDungeonCard";
import { QuestItemResourceGrid } from "@/components/dofus-quests/rush/QuestItemResourceGrid";
import { RushOverlayTagSection } from "./RushOverlayTagSection";
import { RushCoordinateChip } from "@/components/dofus-quests/rush/RushCoordinateChip";
import { QuestHelpersSection } from "@/components/dofus-quests/rush/QuestHelpersSection";
import { classifyTags, getDungeons, getItemTags, getSequenceCoord, type TagClassification } from "./overlay-utils";
import { resolveDofusLocalImage } from "@/lib/dofus-image-url";
import { brandIconForUrl } from "@/lib/source-icons";

interface RushOverlayQuestDetailModalProps {
  milestone: RushMilestone;
  seq: RushSequence;
  isDone: boolean;
  /**
   * Conservé pour les appelants (site public, overlay, guide interne). Le
   * panneau ne s'en sert plus : il ne se peint qu'avec les jetons de thème, donc
   * il suit le `.dark` / `.light` du document — et l'overlay pose `.light` sur sa
   * racine quand le joueur bascule en thème clair.
   */
  isLightMode?: boolean;
  guildId?: string;
  onClose: () => void;
}

/**
 * Modale « Détails de la quête » — remplace l'ancien accordéon.
 *
 * Grammaire de la couche « registre » (cf. memo anti-slop du 16/09/2026) :
 *   - une seule surface (`--elevated`), un filet **entre** les sections
 *     (`divide-y`), pas de bordure doublée sous l'en-tête, rayon 6 px ;
 *   - libellés de section en **casse normale** — les capitales espacées de 9 px
 *     (`text-[9px] font-black uppercase tracking-[0.14em]`) donnaient l'allure
 *     d'un gabarit généré et se lisaient mal à 40 cm de l'écran ;
 *   - aucune ombre, aucun flou d'arrière-plan, aucun glow sur les assets Dofus :
 *     l'immersion vient de la donnée de jeu (illustration du Dofus, boss de
 *     donjon, ressources, coordonnées), pas d'un effet ;
 *   - les sources citées (DofusPourLesNoobs, DofusDB) affichent leur logo
 *     **servi en local**, jamais `google.com/s2/favicons` (une requête tierce par
 *     icône et par affichage, cf. `@/lib/source-icons`).
 */
export function RushOverlayQuestDetailModal({
  milestone,
  seq,
  isDone,
  guildId,
  onClose,
}: RushOverlayQuestDetailModalProps) {
  const tags = useMemo(() => classifyTags(seq.activityTags), [seq.activityTags]);
  // Badges affichés sans les donjons (déjà listés dans la carte « Donjon requis »).
  const badgesTags = useMemo<TagClassification>(() => {
    const hide = (t: { type: string }) => ["donjon", "ocre_dungeon", "dofus_link"].includes(t.type);
    return {
      nature: (tags.nature || []).filter((t) => !hide(t as any)),
      condition: (tags.condition || []).filter((t) => !hide(t as any)),
      tool: (tags.tool || []).filter((t) => !hide(t as any)),
    };
  }, [tags]);
  const dungeons = useMemo(() => getDungeons(seq), [seq]);
  const resources = useMemo(() => getItemTags(seq.activityTags), [seq.activityTags]);
  const coord = useMemo(() => getSequenceCoord(seq), [seq]);
  const name = seq.subGuideName || seq.subGuideRef || milestone.title;
  const noobsUrl = seq.dofuspourlesnoobsUrl;
  const dbUrl = seq.dofusdbUrl;
  const dofusImg = resolveDofusLocalImage(milestone.title) || resolveDofusLocalImage(name);
  const noobsIcon = brandIconForUrl(noobsUrl);
  const dbIcon = brandIconForUrl(dbUrl);

  // Échap ferme le panneau : cette modale remplace un `Dialog` Radix, qui gérait
  // la touche pour nous.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** Libellé de section : même famille que le texte, simplement atténué. */
  const sectionLabel = "mb-1.5 text-[11px] font-semibold text-muted-foreground";
  /** Lien de source : action lisible, soulignée, sans pastille de couleur. */
  const sourceLink =
    "inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent underline decoration-1 underline-offset-[0.28em] transition-colors hover:text-foreground";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="fixed inset-0 bg-black/70"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rush-quest-detail-title"
        className={cn(
          "relative z-10 flex max-h-[85vh] w-full max-w-[26rem] flex-col overflow-hidden",
          "rounded-[6px] border border-border-strong bg-elevated"
        )}
      >
        {/* En-tête : illustration du Dofus visé, nom de la quête, chapitre */}
        <header className="flex shrink-0 items-start gap-3 border-b border-border px-4 py-3">
          {dofusImg && (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[4px] border border-border bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={dofusImg} alt="" className="h-7 w-7 object-contain" loading="lazy" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground">
              {isDone ? "Quête validée" : "Détails de la quête"}
            </p>
            <h2
              id="rush-quest-detail-title"
              className="mt-0.5 text-[15px] font-semibold leading-snug text-foreground"
            >
              {name}
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{milestone.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="-mr-1 -mt-1 shrink-0 rounded-[4px] p-1.5 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Contenu : un filet entre les sections, jamais de cadre autour de chaque bloc */}
        <div className="flex-1 overflow-y-auto px-4">
          <div className="divide-y divide-border">
            {coord && (
              <section className="py-3">
                <p className={sectionLabel}>Position de lancement</p>
                <div className="flex items-center gap-2 rounded-[4px] border border-border bg-surface px-2.5 py-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <RushCoordinateChip
                    coordText={`[${coord.x},${coord.y}]`}
                    className="h-5 border-0 bg-transparent px-0 font-semibold text-foreground"
                  />
                </div>
              </section>
            )}

            {dungeons.length > 0 && (
              <section className="py-3">
                <RushOverlayDungeonCard dungeons={dungeons} guildId={guildId} />
              </section>
            )}

            {resources.length > 0 && (
              <section className="py-3">
                <QuestItemResourceGrid items={resources} showHeaderMeta={false} />
              </section>
            )}

            {(badgesTags.nature.length > 0 || badgesTags.condition.length > 0 || badgesTags.tool.length > 0) && (
              <section className="py-3">
                <p className={sectionLabel}>Badges</p>
                <RushOverlayTagSection tags={badgesTags} />
              </section>
            )}

            {guildId && (
              <section className="py-3">
                <QuestHelpersSection guildId={guildId} seq={seq} />
              </section>
            )}

            {(seq.tips || seq.note || noobsUrl || dbUrl) && (
              <section className="py-3">
                <p className={sectionLabel}>Conseils & liens</p>
                <div className="space-y-2">
                  {seq.tips && (
                    <p className="rounded-[4px] border border-warning/30 bg-warning/[0.07] px-2.5 py-2 text-[12px] leading-relaxed text-foreground">
                      {seq.tips}
                    </p>
                  )}
                  {seq.note && (
                    <p className="rounded-[4px] border border-border bg-surface px-2.5 py-2 text-[12px] leading-relaxed text-muted-foreground">
                      {seq.note}
                    </p>
                  )}
                  {(noobsUrl || dbUrl) && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-0.5">
                      {noobsUrl && (
                        <a href={noobsUrl} target="_blank" rel="noopener noreferrer" className={sourceLink}>
                          {noobsIcon && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={noobsIcon.src}
                              alt=""
                              className="h-3.5 w-3.5 shrink-0 rounded-[3px]"
                              loading="lazy"
                            />
                          )}
                          {noobsIcon?.label ?? "DofusPourLesNoobs"}
                          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                        </a>
                      )}
                      {dbUrl && (
                        <a href={dbUrl} target="_blank" rel="noopener noreferrer" className={sourceLink}>
                          {dbIcon && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={dbIcon.src}
                              alt=""
                              className="h-3.5 w-3.5 shrink-0 rounded-[3px]"
                              loading="lazy"
                            />
                          )}
                          {dbIcon?.label ?? "DofusDB"}
                          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

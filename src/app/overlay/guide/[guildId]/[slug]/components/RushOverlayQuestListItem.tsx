"use client";

import React, { memo } from "react";
import { Check, Flag, BookmarkCheck, Lock, Info, Package, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSequenceCoord, getDungeons, getItemTags, isDungeonSequence } from "./overlay-utils";
import { RushCoordinateChip } from "@/components/dofus-quests/rush/RushCoordinateChip";
import { RushOverlayDungeonPopover } from "./RushOverlayDungeonPopover";
import { getAlignmentSet } from "@/lib/rush-helpers";
import type { RushSequence } from "@/types/rush-guide-types";

interface RushOverlayQuestListItemProps {
  seq: RushSequence;
  isDone: boolean;
  isBookmarked: boolean;
  /** Conservé pour les appelants : l'apparence suit les jetons de thème. */
  isLightMode: boolean;
  onToggle: () => void;
  onBookmark: () => void;
  onOpenDetail: () => void;
  /** Membres (avatar + nom) qui ont posé le repère sur cette étape */
  bookmarkers?: { name: string; avatar?: string }[];
  /** Quête verrouillée tant que ses prérequis ne sont pas validés */
  isLocked?: boolean;
  /** Quêtes prérequis (cliquables pour y sauter) */
  prereqs?: { seqId: string; milestoneId: string; name: string }[];
  onGoToPrereq?: (seqId: string, milestoneId: string) => void;
  /** Ouvre la modale listant les membres en attente ici (avatars cliquables). */
  onOpenBookmarkers?: () => void;
  /** Guilde de la surface : sert à construire le lien de la fiche donjon du module. */
  guildId?: string;
}

/**
 * Ligne compacte d'une quête dans la liste de l'overlay.
 *
 * Hiérarchie : case de validation · titre (lien vers la soluce) · étiquettes
 * d'information (alignement, coordonnées, donjon, ressources, repères) · deux
 * actions (poser un repère, ouvrir les détails).
 *
 * Toutes les couleurs viennent des jetons de thème : l'overlay pose `.light` sur
 * sa racine en thème clair, donc le même rendu sert les deux thèmes sans palette
 * codée en dur (`#13161b`, `slate-*`) ni ombre portée — un halo doré sur une
 * carte de quête n'aidait pas à la lire dans une fenêtre de jeu.
 */
export const RushOverlayQuestListItem = memo(function RushOverlayQuestListItem({
  seq,
  isDone,
  isBookmarked,
  onToggle,
  onBookmark,
  onOpenDetail,
  bookmarkers = [],
  isLocked = false,
  prereqs = [],
  onGoToPrereq,
  onOpenBookmarkers,
  guildId,
}: RushOverlayQuestListItemProps) {
  const parsedCoord = getSequenceCoord(seq);
  const itemTags = getItemTags(seq.activityTags);
  const hasDungeon = isDungeonSequence(seq);
  // Donjons requis, extraits UNE fois : le badge en affiche le nombre, la popover le détail.
  const dungeons = React.useMemo(() => (hasDungeon ? getDungeons(seq) : []), [hasDungeon, seq]);
  const name = seq.subGuideName || seq.subGuideRef || "—";
  const alignmentSet = getAlignmentSet(seq);
  const alignLabel = alignmentSet
    ? alignmentSet.camp === "brakmarien"
      ? "Brakmarien"
      : alignmentSet.camp === "bontarien"
      ? "Bontarien"
      : alignmentSet.camp
    : null;
  // Lien externe prioritaire : DofusPourLesNoobs, sinon DofusDB.
  const externalUrl = seq.dofuspourlesnoobsUrl || seq.dofusdbUrl || null;
  const externalLabel = seq.dofuspourlesnoobsUrl ? "DofusPourLesNoobs" : "DofusDB";
  /**
   * Étiquette d'information : filet 1 px, rayon 3 px, texte atténué. La couleur
   * ne sert qu'à qualifier (ocre = donnée de jeu, rouge = verrou), jamais à
   * décorer : « Alignement », « Donjon », « ressources » se lisent en neutre.
   */
  const chip = "inline-flex items-center gap-1 rounded-[3px] border border-border bg-surface px-1.5 py-0.5 text-[11px] text-muted-foreground";

  return (
    <div
      id={`overlay-seq-${seq.id}`}
      className={cn(
        "overflow-hidden rounded-[4px] border transition-colors",
        // DEUX états, DEUX couleurs — jamais la même carte :
        //   · VERROUILLÉ (prérequis non terminés) ⇒ rouge `danger` : c'est un blocage ;
        //   · REPÈRE (« Je suis ici ») ⇒ ambre `warning` : c'est un marqueur de reprise.
        // Avant, une quête bloquée restait neutre et une quête repérée prenait l'ambre :
        // deux états voisins, indistinguables d'un coup d'œil dans la fenêtre de jeu.
        // Le repère se signale en plus par un filet gauche (3 px) et une teinte, jamais
        // par un halo : c'est lisible dans une fenêtre PiP réduite.
        isDone
          ? "border-border bg-surface opacity-60"
          : isLocked
          ? "border-danger/30 bg-danger/[0.05]"
          : isBookmarked
          ? "border-warning/40 border-l-[3px] border-l-warning bg-warning/10"
          : "border-border bg-surface hover:border-border-strong hover:bg-elevated"
      )}
    >
      {/* Ligne principale */}
      <div className="flex items-center gap-2 px-2.5 py-2">
        {/* Case de validation — cercle plein quand la quête est faite */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!isLocked) onToggle();
          }}
          disabled={isLocked}
          aria-label={isDone ? "Décocher la quête" : isLocked ? "Quête verrouillée par un prérequis" : "Marquer comme terminée"}
          className={cn(
            "shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
            isLocked && "cursor-not-allowed"
          )}
        >
          <span
            className={cn(
              "grid h-4 w-4 place-items-center rounded-full border transition-colors",
              isDone
                ? "border-accent bg-accent text-accent-foreground"
                : isLocked
                ? "border-danger/40 bg-background text-danger"
                : "border-border-strong bg-background hover:border-accent"
            )}
          >
            {isDone ? (
              <Check className="h-2.5 w-2.5 stroke-[3]" aria-hidden="true" />
            ) : isLocked ? (
              <Lock className="h-2.5 w-2.5 stroke-[2.5]" aria-hidden="true" />
            ) : null}
          </span>
        </button>

        {/* Titre + 2e ligne — clic sur le titre = ouvrir la fiche externe (DPLN/DofusDB) */}
        <div className="flex-1 min-w-0">
          {externalUrl ? (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title={`Ouvrir la fiche sur ${externalLabel}`}
              className={cn(
                "block w-full truncate text-left text-[13px] font-semibold leading-tight text-foreground transition-colors hover:text-accent hover:underline",
                isDone && "line-through opacity-50"
              )}
            >
              {name}
            </a>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetail();
              }}
              title="Voir les détails"
              className={cn(
                "block w-full cursor-pointer truncate text-left text-[13px] font-semibold leading-tight text-foreground transition-colors hover:text-accent hover:underline",
                isDone && "line-through opacity-50"
              )}
            >
              {name}
            </button>
          )}

          {/* 2e ligne : indicateurs (chips harmonisés) */}
          {(parsedCoord || hasDungeon || itemTags.length > 0 || bookmarkers.length > 0 || alignmentSet) && (
            <div className="flex flex-wrap items-center gap-1 mt-1">
              {alignmentSet && alignLabel && (
                <span className={chip} title={`Quête d'alignement → ${alignLabel} ${alignmentSet.level}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={alignmentSet.camp === "brakmarien" ? "/ordres/brakmar.png" : "/ordres/bonta.png"}
                    alt=""
                    className="h-3 w-3 shrink-0 object-contain"
                  />
                  Alignement {alignLabel} {alignmentSet.level}
                </span>
              )}
              {parsedCoord && (
                <RushCoordinateChip
                  coordText={`[${parsedCoord.x},${parsedCoord.y}]`}
                  className="text-[11px]"
                />
              )}
              {hasDungeon && (
                // Le badge n'était qu'un `title` natif : au survol (ou au clic), on montre les
                // donjons requis — vignette du boss, nom, badge Ocre — et chaque ligne ouvre sa
                // fiche (page publique pour l'overlay public, fiche boss du module sinon).
                <RushOverlayDungeonPopover dungeons={dungeons} guildId={guildId}>
                  <span className={cn(chip, "border-warning/40 text-warning")} title="Donjon requis — survoler pour le détail">
                    {/* Picto du donjon : l'asset du jeu, pas un glyphe d'interface. Le
                        compteur dit combien de donjons la quête demande (×1, ×2…). */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/assets/dofus-ui/pictos/donjon.png"
                      alt=""
                      className="h-3 w-3 shrink-0 object-contain"
                      aria-hidden="true"
                    />
                    Donjon ×{dungeons.length}
                  </span>
                </RushOverlayDungeonPopover>
              )}
              {itemTags.length > 0 && (
                <span className={chip} title={`${itemTags.length} ressource${itemTags.length > 1 ? "s" : ""} à prévoir`}>
                  <Package className="h-3 w-3" aria-hidden="true" />×{itemTags.length}
                </span>
              )}
              {!isDone && bookmarkers.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenBookmarkers?.();
                  }}
                  title={bookmarkers.map((b) => b.name).join(", ")}
                  aria-label={`En attente ici : ${bookmarkers.map((b) => b.name).join(", ")}`}
                  className={cn(chip, "border-warning/40 text-warning transition-colors hover:bg-warning/10")}
                >
                  <span className="flex items-center -space-x-1">
                    {bookmarkers.slice(0, 3).map((b, i) =>
                      b.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          src={b.avatar}
                          alt={b.name}
                          loading="lazy"
                          className="h-4 w-4 rounded-full border border-warning/40 object-cover"
                        />
                      ) : (
                        <span
                          key={i}
                          className="grid h-4 w-4 place-items-center rounded-full border border-warning/40 bg-warning/20 text-[9px] font-semibold text-warning"
                        >
                          {b.name.charAt(0) || "?"}
                        </span>
                      )
                    )}
                  </span>
                  <Users className="h-3 w-3" aria-hidden="true" />
                  {bookmarkers.length}
                </button>
              )}
            </div>
          )}
          {isLocked && prereqs.length > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-danger">
                <Lock className="h-3 w-3" aria-hidden="true" /> À terminer avant :
              </span>
              {prereqs.map((p) => (
                <button
                  key={p.seqId}
                  type="button"
                  onClick={() => onGoToPrereq?.(p.seqId, p.milestoneId)}
                  className="rounded-[3px] border border-danger/40 bg-danger/10 px-1.5 py-0.5 text-[11px] font-medium text-danger transition-colors hover:bg-danger/20"
                  title={`Aller à : ${p.name}`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Repère */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!isLocked && !isDone) onBookmark();
          }}
          disabled={isLocked || isDone}
          aria-label={isDone ? "Quête déjà validée" : isBookmarked ? "Retirer le repère" : isLocked ? "Repère indisponible (prérequis)" : "Poser le repère ici"}
          title={isDone ? "Quête déjà validée — repère désactivé" : isBookmarked ? "Repère posé ici" : isLocked ? "Repère indisponible (prérequis non terminés)" : "Je suis ici"}
          className={cn(
            "shrink-0 rounded-[3px] p-1 transition-colors",
            (isLocked || isDone) && "cursor-not-allowed opacity-40",
            isBookmarked && !isDone
              ? "bg-warning/15 text-warning"
              : "text-muted-foreground hover:bg-warning/10 hover:text-warning"
          )}
        >
          {isBookmarked && !isDone ? (
            <BookmarkCheck className="h-3.5 w-3.5" aria-hidden="true" />
          ) : isLocked ? (
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Flag className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>

        {/* Accordéon */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail();
          }}
          aria-label="Détails"
          title="Voir tous les détails (donjons, ressources, conseils)"
          className="flex shrink-0 items-center gap-0.5 rounded-[3px] p-1 text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground"
        >
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
});

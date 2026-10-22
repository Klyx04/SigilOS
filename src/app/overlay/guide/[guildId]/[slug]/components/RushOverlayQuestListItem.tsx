"use client";

import React, { memo, useState } from "react";
import { Check, Flag, BookmarkCheck, Lock, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSequenceCoord, getDungeons, getItemTags, isDungeonSequence } from "./overlay-utils";
import { RushCoordinateChip } from "@/components/dofus-quests/rush/RushCoordinateChip";
import { RushOverlayMemberBubbles, type OverlayBubbleMember } from "./RushOverlayMemberBubbles";
import { RushOverlayDungeonPopover } from "./RushOverlayDungeonPopover";
import { safeExternalUrl, safeImageUrl } from "@/lib/security";
import { resolveRushSeqIcon, getSequenceNpc, isZaapCopyEnabled, getSequenceManualZaap, RUSH_RESOURCES_PICTO, getAlignmentSet } from "@/lib/rush-guide-utils";
import { NpcBadge } from "@/components/dofus-quests/rush/NpcBadge";
import type { RushSequence } from "@/types/rush-guide-types";
import type {
  RushDungeonMemberState,
  RushDungeonState,
  RushDungeonStateMap,
} from "@/lib/rush-dungeons";
import { dungeonKeyOf, type RushMissingDungeon } from "@/lib/rush-dungeons";

/**
 * Vignette cliquable d'un donjon **manquant** : la vraie image du donjon, ou **rien**.
 * Aucun picto générique de repli — il se répétait à l'identique et donnait l'impression
 * d'une icône factice (retour user du 22/10/2026). Le nom reste en infobulle.
 */
function MissingDungeonThumb({
  name,
  imageUrl,
  onOpen,
}: {
  name: string;
  imageUrl?: string | null;
  onOpen: () => void;
}) {
  const [broken, setBroken] = useState(false);
  if (!imageUrl || broken) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`Cocher : ${name}`}
      aria-label={`Ouvrir ${name} dans les donjons de cette quête`}
      className="rounded-[3px] border border-danger/40 p-0.5 transition-colors hover:bg-danger/10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-danger"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt=""
        className="h-4 w-4 rounded-[2px] object-cover"
        loading="lazy"
        onError={() => setBroken(true)}
      />
    </button>
  );
}

interface RushOverlayQuestListItemProps {
  seq: RushSequence;
  isDone: boolean;
  isBookmarked: boolean;
  /** Conservé pour les appelants : l'apparence suit les jetons de thème. */
  isLightMode: boolean;
  onToggle: () => void;
  onBookmark: () => void;
  onOpenDetail: () => void;
  /** Membres (avatar + nom) qui ont posé le repère sur cette étape — affichés en bulles
   *  par la **brique partagée** `RushOverlayMemberBubbles` (mêmes bulles en vue de jeu). */
  bookmarkers?: OverlayBubbleMember[];
  /** Quête verrouillée tant que ses prérequis ne sont pas validés */
  isLocked?: boolean;
  /** Quêtes prérequis (cliquables pour y sauter) */
  prereqs?: { seqId: string; milestoneId: string; name: string }[];
  /**
   * Donjons **requis** de la quête qui ne sont pas encore cochés (noms lisibles).
   * Non vide ⇒ la quête est verrouillée : on dit **quoi cocher** au lieu de laisser
   * partir un clic que le serveur refusera (mesure du 22/10/2026).
   */
  missingDungeons?: RushMissingDungeon[];
  onGoToPrereq?: (seqId: string, milestoneId: string) => void;
  /** Ouvre la modale listant les membres en attente ici (avatars cliquables). */
  onOpenBookmarkers?: () => void;
  /** Guilde de la surface : sert à construire le lien de la fiche donjon du module. */
  guildId?: string;
  /**
   * Coche des donjons, **par occurrence** : mêmes états que la surface (base pour la
   * guilde, `localStorage` pour l'invité). Absent ⇒ la pastille ouvre la liste en
   * lecture seule.
   */
  dungeonActions?: {
    states: RushDungeonStateMap;
    busyKey: string | null;
    others: RushDungeonMemberState[];
    onSet: (sequenceId: string, dungeonKey: string, state: RushDungeonState | null) => void;
    ensureLoaded: () => void;
  };
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
  missingDungeons = [],
  onGoToPrereq,
  onOpenBookmarkers,
  guildId,
  dungeonActions,
}: RushOverlayQuestListItemProps) {
  const parsedCoord = getSequenceCoord(seq);
  // Panneau donjon piloté par la ligne : la pastille l'ouvre, les icônes des donjons
  // manquants l'ouvrent **en ciblant** le donjon cliqué (`targetKey`).
  const [dungeonPanelOpen, setDungeonPanelOpen] = useState(false);
  const [dungeonTarget, setDungeonTarget] = useState<string | null>(null);
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
  // CodeQL `js/xss-through-dom` : ces URL viennent de la base ; on ne rend un lien
  // que si le schéma est http(s) (jamais javascript:/data:). `safeExternalUrl`
  // normalise et encode l'URL ; `safeImageUrl` protège les icônes ci-dessous.
  const noobsUrl = safeExternalUrl(seq.dofuspourlesnoobsUrl);
  const dbUrl = safeExternalUrl(seq.dofusdbUrl);
  const externalUrl = noobsUrl || dbUrl || null;
  const externalLabel = noobsUrl ? "DofusPourLesNoobs" : "DofusDB";
  // Icône de type choisie en God (repli : rien, le titre suffit).
  const seqIcon = safeImageUrl(resolveRushSeqIcon(seq.icon));
  /**
   * Étiquette d'information : filet 1 px, rayon 3 px, texte atténué. La couleur
   * ne sert qu'à qualifier (ocre = donnée de jeu, rouge = verrou), jamais à
   * décorer : « Alignement », « Donjon », « ressources » se lisent en neutre.
   */
  // PNJ donneur (tag God) : nom + portrait par convention.
  const seqNpc = getSequenceNpc(seq);
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

        {/* Titre + 2e ligne — clic sur le titre = ouvrir la fiche externe (DPLN/DofusDB).
            Le bloc est une COLONNE : le nom prend toute la largeur (2 lignes max) et les
            étiquettes passent en dessous, en `flex-wrap` — la rangée unique d'avant écrasait
            le nom de la quête dès que la fenêtre PiP était étroite (retour user 08/10/2026). */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {/* 1ʳᵉ rangée : icône de type · portrait PNJ · nom de la quête */}
          <div className="flex min-w-0 items-start gap-1.5">
          {seqIcon && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={seqIcon} alt="" className="h-4 w-4 shrink-0 object-contain" loading="lazy" />
          )}
          {seqNpc && (seqNpc.imageUrl || seqNpc.id !== null) && (
            <NpcBadge npcId={seqNpc.id} name={seqNpc.name} imageUrl={seqNpc.imageUrl} bare />
          )}
          <div className="min-w-0 flex-1">
          {externalUrl ? (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title={`Ouvrir la fiche sur ${externalLabel}`}
              className={cn(
                "block w-full text-left text-[13px] font-semibold leading-snug text-foreground transition-colors hover:text-accent hover:underline line-clamp-2",
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
                "block w-full cursor-pointer text-left text-[13px] font-semibold leading-snug text-foreground transition-colors hover:text-accent hover:underline line-clamp-2",
                isDone && "line-through opacity-50"
              )}
            >
              {name}
            </button>
          )}
          </div>
          </div>

          {/* 2e ligne : indicateurs (chips harmonisés) — toute la largeur de la ligne */}
          {(parsedCoord || hasDungeon || itemTags.length > 0 || bookmarkers.length > 0 || alignmentSet) && (
            <div className="flex flex-wrap items-center gap-1">
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
                  showZaap={isZaapCopyEnabled(seq)}
                  manualZaap={getSequenceManualZaap(seq)}
                />
              )}
              {hasDungeon && (
                // Le badge n'était qu'un `title` natif : au survol (ou au clic), on montre les
                // donjons requis — vignette du boss, nom, badge Ocre — et chaque ligne ouvre sa
                // fiche (page publique pour l'overlay public, fiche boss du module sinon).
                <RushOverlayDungeonPopover
                  seq={seq}
                  dungeons={dungeons}
                  guildId={guildId}
                  open={dungeonPanelOpen}
                  onOpenChange={(next) => {
                    setDungeonPanelOpen(next);
                    if (!next) setDungeonTarget(null);
                  }}
                  targetKey={dungeonTarget}
                  states={dungeonActions?.states}
                  busyKey={dungeonActions?.busyKey}
                  others={dungeonActions?.others}
                  onSet={dungeonActions?.onSet}
                  onEnsureLoaded={dungeonActions?.ensureLoaded}
                >
                  <span className={cn(chip, "border-warning/40 text-warning")} title="Donjon requis — cliquer pour cocher fait / à faire">
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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={RUSH_RESOURCES_PICTO} alt="" aria-hidden="true" loading="lazy" className="h-3 w-3 object-contain" />×{itemTags.length}
                </span>
              )}
              {!isDone && bookmarkers.length > 0 && (
                <RushOverlayMemberBubbles
                  members={bookmarkers}
                  onOpen={() => onOpenBookmarkers?.()}
                  size="sm"
                />
              )}
            </div>
          )}
          {isLocked && prereqs.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
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
          {missingDungeons.length > 0 && (
            /* Une seule mention + les **vignettes** des donjons manquants : chacune ouvre
               le panneau de la quête en ciblant SON donjon (anneau + mise en vue). Les
               noms restent en infobulle — la liste en texte alourdissait la ligne
               (retour user du 22/10/2026). */
            <div className="flex items-center gap-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-danger">
                <Lock className="h-3 w-3" aria-hidden="true" /> Donjons requis non validés
              </span>
              {missingDungeons.map((d) => {
                const info = dungeons.find((dj) => dungeonKeyOf(dj) === d.key);
                // VRAIE vignette du donjon uniquement : sans image (ou image 404), on
                // n'affiche RIEN — un picto générique répété 3 fois faisait « faux »
                // (retour user du 22/10/2026).
                return (
                  <MissingDungeonThumb
                    key={d.key}
                    name={d.name}
                    imageUrl={info?.imageUrl ?? null}
                    onOpen={() => {
                      setDungeonTarget(d.key);
                      setDungeonPanelOpen(true);
                    }}
                  />
                );
              })}
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

"use client";

import React, { memo, useEffect, useState } from "react";
import { Check, Flag, BookmarkCheck, Info, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSequenceCoord, getDungeons, isDungeonSequence, type DungeonInfo } from "./overlay-utils";
import { RushOverlayPrereqModal } from "./RushOverlayPrereqModal";
import { RushCoordinateChip } from "@/components/dofus-quests/rush/RushCoordinateChip";
import { RushOverlayMemberBubbles, type OverlayBubbleMember } from "./RushOverlayMemberBubbles";
import { RushOverlayDungeonPopover } from "./RushOverlayDungeonPopover";
import { RushOverlayQuestLinksModal } from "./RushOverlayQuestLinksModal";
import { safeExternalUrl, safeImageUrl } from "@/lib/security";
import { resolveRushSeqIcon, getSequenceNpc, isZaapCopyEnabled, getSequenceManualZaap, getAlignmentSet, getSequenceSuccesses, type RushGuideQuestRef, type RushNextAlignmentQuest } from "@/lib/rush-guide-utils";
import {
  SuccessChip,
  type SuccessValidationContext,
} from "@/components/dofus-quests/rush/SuccessChip";
import { NpcBadge } from "@/components/dofus-quests/rush/NpcBadge";
import { RushAlignmentBadge } from "@/components/dofus-quests/rush/RushAlignmentBadge";
import { RushPrereqChoiceHint } from "@/components/dofus-quests/rush/RushPrereqChoiceHint";
import type { RushPrereqChoiceGroup } from "@/lib/rush-prereq-expr";
import type { OverlayJumpOrigin } from "@/lib/rush-overlay-jump";
import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";
import type {
  RushDungeonMemberState,
  RushDungeonState,
  RushDungeonStateMap,
} from "@/lib/rush-dungeons";
import { sequenceDungeonProgress, type RushMissingDungeon } from "@/lib/rush-dungeons";

interface RushOverlayQuestListItemProps {
  seq: RushSequence;
  isDone: boolean;
  isBookmarked: boolean;
  /**
   * Première quête ni validée ni verrouillée du chapitre affiché : c'est celle que
   * « Reprendre » vise et que le fil de sève atteint. Le libellé reste « À faire »
   * (aucun état inventé) — seul le nœud est accentué.
   */
  isNext?: boolean;
  onToggle: () => void;
  onBookmark: () => void;
  onOpenDetail: () => void;
  /** Membres (avatar + nom) qui ont posé le repère sur cette étape — affichés en bulles
   *  par la **brique partagée** `RushOverlayMemberBubbles` (mêmes bulles en vue de jeu). */
  bookmarkers?: OverlayBubbleMember[];
  /** Quête verrouillée tant que ses prérequis ne sont pas validés */
  isLocked?: boolean;
  /** Les quêtes du guide (id → nom + état) : la fiche d'un succès les liste. */
  guideQuests?: RushGuideQuestRef[];
  /** Blocs du guide : aperçu de la cascade « Valider les prérequis ». */
  guideMilestones?: RushMilestone[];
  /** Contexte d'écriture du succès ; absent ⇒ lecture seule (invité). */
  successValidation?: SuccessValidationContext;
  /** Saut + surbrillance vers une quête du guide (fourni par la surface). */
  onGoToQuest?: (sequenceId: string) => void;
  /** Bloc de la ligne : origine du retour après un saut vers un prérequis. */
  milestoneId?: string;
  /** Quêtes prérequis (cliquables pour y sauter) */
  prereqs?: { seqId: string; milestoneId: string; name: string }[];
  /**
   * Donjons **requis** de la quête qui ne sont pas encore cochés (noms lisibles).
   * Non vide ⇒ la quête est verrouillée : on dit **quoi cocher** au lieu de laisser
   * partir un clic que le serveur refusera (mesure du 22/10/2026).
   */
  missingDungeons?: RushMissingDungeon[];
  onGoToPrereq?: (seqId: string, milestoneId: string, origin?: OverlayJumpOrigin) => void;
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
  /** V-H — noms des monstres déjà capturés (Metamob) ; absent ⇒ état ocre inconnu. */
  capturedOcreNames?: readonly string[];
  /** V-H — ouvre la fenêtre Ocre depuis un donjon ocre. */
  onOpenOcre?: () => void;
  /** Bloc I — ouvre les succès du donjon (la quête est transmise avec le donjon). */
  onOpenAchievements?: (sequenceId: string, dungeonKey: string, dungeon: DungeonInfo) => void;
  /** Série d'alignement dérivée (« Ali 12 », « Rang 2 ») — jamais persistée. */
  alignmentLabel?: string | null;
  /** Groupes « au choix » (`prereq_expr`) : une seule alternative suffit. */
  choiceGroups?: RushPrereqChoiceGroup[];
  /**
   * Palier de cité : première quête de cité encore à faire. Fournie par la surface
   * (calcul pur), elle alimente le bouton « Prochaine quête de cité ».
   */
  nextAlignment?: RushNextAlignmentQuest | null;
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
  guideQuests = [],
  guideMilestones = [],
  successValidation,
  onGoToQuest,
  milestoneId: blockId,
  prereqs = [],
  missingDungeons = [],
  onGoToPrereq,
  onOpenBookmarkers,
  guildId,
  isNext = false,
  dungeonActions,
  capturedOcreNames,
  onOpenOcre,
  onOpenAchievements,
  alignmentLabel = null,
  choiceGroups = [],
  nextAlignment = null,
}: RushOverlayQuestListItemProps) {
  const parsedCoord = getSequenceCoord(seq);
  // Panneau donjon piloté par la ligne : la pastille l'ouvre, les icônes des donjons
  // manquants l'ouvrent **en ciblant** le donjon cliqué (`targetKey`).
  const [dungeonPanelOpen, setDungeonPanelOpen] = useState(false);
  const [dungeonTarget, setDungeonTarget] = useState<string | null>(null);
  /**
   * Fermeture automatique pilotée par la LIGNE, pas par la popover : quand le dernier
   * donjon requis est coché, la quête se déverrouille et le bandeau change de branche —
   * la popover est remontée. Un état local dans la popover serait perdu ; ce drapeau
   * survit et referme le panneau dès que `missingDungeons` tombe à zéro.
   */
  const [dungeonCloseOnComplete, setDungeonCloseOnComplete] = useState(false);
  useEffect(() => {
    if (!dungeonPanelOpen || !dungeonCloseOnComplete) return;
    if (missingDungeons.length > 0) return;
    setDungeonPanelOpen(false);
    setDungeonTarget(null);
    setDungeonCloseOnComplete(false);
  }, [dungeonPanelOpen, dungeonCloseOnComplete, missingDungeons.length]);
  // Mini-modale des prérequis (un seul encadré dans la ligne, la liste s'ouvre au clic).
  const [prereqsOpen, setPrereqsOpen] = useState(false);
  // Mini-modale de choix des liens de la quête (DPLN / DofusDB / détails).
  const [linksOpen, setLinksOpen] = useState(false);
  // Une icône de quête cassée laissait un cadre carré vide devant le titre : on la
  // retire (règle « pas d'image ⇒ rien », comme les vignettes de donjon).
  const [titleIconBroken, setTitleIconBroken] = useState(false);
  // (le chip « ressources » a été retiré : le détail vit dans la fiche « i »)
  const hasDungeon = isDungeonSequence(seq);
  // Donjons requis, extraits UNE fois : le badge en affiche le nombre, la popover le détail.
  const dungeons = React.useMemo(() => (hasDungeon ? getDungeons(seq) : []), [hasDungeon, seq]);
  // Compteur d'EXIGENCES : un groupe « au choix » compte pour 1 (pas ses 5 donjons).
  const requiredDungeonBlocks = React.useMemo(
    () => (hasDungeon ? sequenceDungeonProgress(seq).requiredBlocks : 0),
    [hasDungeon, seq]
  );
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
  // Icône de type choisie en God (repli : rien, le titre suffit).
  const seqIcon = safeImageUrl(resolveRushSeqIcon(seq.icon));
  /**
   * Étiquette d'information : filet 1 px, rayon 3 px, texte atténué. La couleur
   * ne sert qu'à qualifier (ocre = donnée de jeu, rouge = verrou), jamais à
   * décorer : « Alignement », « Donjon », « ressources » se lisent en neutre.
   */
  // PNJ donneur (tag God) : nom + portrait par convention.
  const seqNpc = getSequenceNpc(seq);
  /**
   * Libellé d'état — la couleur ne porte JAMAIS seule l'information (AA + daltonisme).
   * Vocabulaire de la DA : « Validée », « Verrouillée », « Je suis ici », « À faire ».
   * Le repère passe AVANT le verrou : on peut être « ici » sur une quête encore verrouillée.
   */
  const daState = isDone ? "Validée" : isBookmarked ? "Je suis ici" : isLocked ? "Verrouillée" : "À faire";
  /** Succès officiels portés par cette quête (pastille + fiche, jamais une coche). */
  const successes = getSequenceSuccesses(seq);
  /**
   * Icône de type de la quête — **dans la ligne du nom**, jamais au-dessus : posée dans
   * la rangée de l'état (`items-start`), elle flottait à côté de « À faire / Verrouillée »
   * au lieu de la quête (retour user du 18/11/2026). Même repli que le dashboard.
   */
  const titleIcon = seqIcon && !titleIconBroken ? (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={seqIcon}
      alt=""
      className="w-4 h-4 shrink-0 object-contain opacity-90"
      loading="lazy"
      onError={() => setTitleIconBroken(true)}
    />
  ) : (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/assets/icons/icone-quete.png"
      alt=""
      aria-hidden="true"
      className="w-4 h-4 shrink-0 object-contain opacity-90"
      loading="lazy"
    />
  );

  /**
   * Repère « je suis ici » — icône seule. Une quête verrouillée ne peut pas en
   * POSER un, mais doit pouvoir retirer celui posé avant le verrou (sinon il
   * resterait collé) : c'est la seule action conservée sur une carte verrouillée,
   * comme dans le guide interne.
   */
  const bookmarkAction = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!isDone && !(isLocked && !isBookmarked)) onBookmark();
      }}
      disabled={isDone || (isLocked && !isBookmarked)}
      aria-label={
        isDone
          ? "Quête déjà validée"
          : isBookmarked
            ? "Retirer le repère"
            : isLocked
              ? "Quête verrouillée — repère indisponible"
              : "Poser le repère ici"
      }
      title={
        isDone
          ? "Quête déjà validée — repère désactivé"
          : isBookmarked
            ? "Repère posé ici"
            : isLocked
              ? "Quête verrouillée — terminez d'abord ses prérequis"
              : "Je suis ici"
      }
      className={cn(
        "grid h-6 w-6 shrink-0 place-items-center rounded-[3px] transition-colors",
        (isDone || (isLocked && !isBookmarked)) && "cursor-not-allowed opacity-40",
        isBookmarked && !isDone
          ? "bg-warning/15 text-warning"
          : "text-muted-foreground hover:bg-warning/10 hover:text-warning",
      )}
    >
      {isBookmarked && !isDone ? (
        <BookmarkCheck className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Flag className="h-3.5 w-3.5" aria-hidden="true" />
      )}
    </button>
  );

  /**
   * Pastille donjon + son panneau. C'est la SEULE action conservée sur une carte
   * verrouillée : sans elle, la phrase « Donjons requis non validés » ouvrait un
   * panneau qui n'était plus monté (mesure 26/11/2026) — le joueur ne pouvait
   * plus cocher le donjon qui bloque la quête.
   */
  const dungeonAction = hasDungeon ? (
    <RushOverlayDungeonPopover
      seq={seq}
      dungeons={dungeons}
      guildId={guildId}
      open={dungeonPanelOpen}
      onOpenChange={(next) => {
        setDungeonPanelOpen(next);
        if (next) {
          setDungeonCloseOnComplete(missingDungeons.length > 0);
        } else {
          setDungeonTarget(null);
          setDungeonCloseOnComplete(false);
        }
      }}
      targetKey={dungeonTarget}
      states={dungeonActions?.states}
      busyKey={dungeonActions?.busyKey}
      others={dungeonActions?.others}
      onSet={dungeonActions?.onSet}
      onEnsureLoaded={dungeonActions?.ensureLoaded}
      capturedOcreNames={capturedOcreNames}
      onOpenOcre={onOpenOcre}
      onOpenAchievements={
        onOpenAchievements
          ? (key, dungeon) => onOpenAchievements(seq.id, key, dungeon)
          : undefined
      }
    >
      <span
        className={cn(
          "inline-flex h-6 items-center gap-0.5 rounded-[3px] px-1 text-[11px] font-semibold text-warning transition-colors hover:bg-warning/10",
          missingDungeons.length > 0 && "border border-danger/40 da-alert",
        )}
        title={
          requiredDungeonBlocks > 1
            ? `Donjons requis ×${requiredDungeonBlocks} — cliquer pour cocher fait / à faire`
            : "Donjon requis — cliquer pour cocher fait / à faire"
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/dofus-ui/pictos/donjon.png"
          alt=""
          className="h-3.5 w-3.5 shrink-0 object-contain"
          aria-hidden="true"
        />
        {requiredDungeonBlocks > 1 && <span>×{requiredDungeonBlocks}</span>}
      </span>
    </RushOverlayDungeonPopover>
  ) : null;

  /**
   * Bandeau d'icônes du bloc — TOUTES les actions au même endroit, au-dessus du
   * nom (demande user du 25/11/2026). En colonne, le nom garde toute la largeur
   * et « respire » ; les icônes ne le tronquent plus à « RETOURNER VOIR… ».
   */
  const rowActions = (
    <>
      {successes.length > 0 && (
        <SuccessChip
          compact
          successes={successes}
          quests={guideQuests}
          milestones={guideMilestones}
          validation={successValidation}
          onGoToQuest={onGoToQuest}
        />
      )}
      {parsedCoord && (
        <RushCoordinateChip
          coordText={`[${parsedCoord.x},${parsedCoord.y}]`}
          iconOnly
          menuOnClick
          worldId={parsedCoord.worldId ?? null}
          showZaap={isZaapCopyEnabled(seq)}
          manualZaap={getSequenceManualZaap(seq)}
          npc={getSequenceNpc(seq)}
          mapId={parsedCoord.mapId ?? null}
        />
      )}
      {dungeonAction}
      {/* Repère « je suis ici » — icône seule, en haut, sans titre visible. */}
      {bookmarkAction}
      {/* Détails — dernière icône du bandeau, plus dans le corps de la carte. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenDetail();
        }}
        aria-label="Détails"
        title="Voir tous les détails (donjons, ressources, conseils)"
        className="grid h-6 w-6 shrink-0 place-items-center rounded-[3px] text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground"
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </>
  );

  return (
    <div
      id={`overlay-seq-${seq.id}`}
      className="da-row"
      data-state={isDone ? "done" : isLocked ? "locked" : isNext ? "next" : "todo"}
      data-here={isBookmarked && !isDone ? "true" : "false"}
    >
      {/* Nœud de validation — HORS de la carte : le fil de sève passe derrière lui.
          Validée / à faire maintenant / à faire / verrouillée ; le repère
          « je suis ici » colore la CARTE, jamais le nœud (un seul point focal). */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!isLocked) onToggle();
        }}
        disabled={isLocked}
        aria-label={isDone ? "Décocher la quête" : isLocked ? "Quête verrouillée (prérequis ou donjon requis) — le repère « je suis ici » reste possible" : "Marquer comme terminée"}
        className={cn("da-node cursor-pointer", isLocked && "cursor-not-allowed")}
      >
        {isDone ? (
          <Check className="h-3.5 w-3.5 stroke-[3]" aria-hidden="true" />
        ) : isLocked ? (
          <img
            src="/assets/dofus-ui/pictos/verrou.png"
            alt=""
            aria-hidden="true"
            className="h-3 w-3 shrink-0 object-contain"
          />
        ) : null}
      </button>

      {/* Carte : bord peint irrégulier, filet teinté par le bloc actif */}
      <div className="da-card">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {/* Bandeau supérieur : toutes les actions au même endroit, au-dessus du
              nom. Une quête VERROUILLÉE ne montre que ses prérequis (parité avec
              les guides navigateur) : succès, position, donjon, détails et état
              disparaissent ; seul le retrait d'un repère déjà posé reste possible. */}
          {!isLocked ? (
            <div className="flex w-full flex-wrap items-center gap-1 border-b border-border/40 pb-1">
              <span
                className={cn(
                  "text-[9px] font-semibold uppercase tracking-[0.1em]",
                  isDone ? "text-success" : "text-muted-foreground"
                )}
              >
                {daState}
              </span>
              <div className="ml-auto flex shrink-0 items-center gap-0.5">{rowActions}</div>
            </div>
          ) : hasDungeon || isBookmarked ? (
            <div className="flex w-full items-center justify-end gap-0.5 pb-1">
              {dungeonAction}
              {isBookmarked ? bookmarkAction : null}
            </div>
          ) : null}
          <div className="flex min-w-0 items-start gap-1.5 pt-0.5">
            {titleIcon}
            {!isLocked && seqNpc && (seqNpc.imageUrl || seqNpc.id !== null) && (
              <NpcBadge npcId={seqNpc.id} name={seqNpc.name} imageUrl={seqNpc.imageUrl} bare />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                {alignmentSet && alignLabel && (
                  <RushAlignmentBadge label={alignmentLabel} tone="da" />
                )}
                {isLocked ? (
                  // Parité guides navigateur : le titre reste lisible, mais il n'ouvre
                  // plus la modale de liens tant que la quête est verrouillée.
                  <span className="da-qtitle block min-w-0 flex-1 text-left">
                    <span className="line-clamp-2">{name}</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLinksOpen(true);
                    }}
                    title="Liens de la quête"
                    className="da-qtitle block min-w-0 flex-1 cursor-pointer text-left transition-colors hover:text-accent hover:underline"
                  >
                    <span className="line-clamp-2">{name}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 2e ligne : membres qui ont posé un repère (le reste vit dans le bandeau). */}
          {!isDone && !isLocked && bookmarkers.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <RushOverlayMemberBubbles
                members={bookmarkers}
                onOpen={() => onOpenBookmarkers?.()}
                size="sm"
              />
            </div>
          )}
          {isLocked && prereqs.length > 0 && (
            /* 19/11/2026 — une seule ligne, sans cadre : le cadenas du nœud dit
               le verrou, la ligne dit quoi faire. */
            <button
              type="button"
              onClick={() => {
                if (prereqs.length === 1 && onGoToPrereq) {
                  const target = prereqs[0];
                  onGoToPrereq(
                    target.seqId,
                    target.milestoneId,
                    blockId ? { milestoneId: blockId, seqId: seq.id, name } : undefined
                  );
                  return;
                }
                setPrereqsOpen(true);
              }}
              aria-haspopup={prereqs.length > 1 ? "dialog" : undefined}
              aria-expanded={prereqs.length > 1 ? prereqsOpen : undefined}
              title={`Aller à : ${prereqs.map((p) => p.name).join(", ")}`}
              className="group inline-flex max-w-full items-center gap-1 rounded-[3px] px-1.5 py-0.5 text-left text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <span className="shrink-0">Terminer :</span>
              <span className="min-w-0 truncate font-semibold text-warning group-hover:underline">
                {prereqs[0].name}
                {prereqs.length > 1 ? ` +${prereqs.length - 1}` : ""}
              </span>
            </button>
          )}
          {isLocked && nextAlignment && (
            /* Palier de cité : un geste direct vers la première quête de cité qui reste.
               Le bouton est calculé par la surface (jamais un id en dur). */
            <button
              type="button"
              onClick={() =>
                onGoToPrereq?.(
                  nextAlignment.seqId,
                  nextAlignment.milestoneId,
                  blockId ? { milestoneId: blockId, seqId: seq.id, name } : undefined
                )
              }
              title={`Aller à : ${nextAlignment.name}`}
              className="inline-flex max-w-full items-center gap-1 self-start text-[11px] font-semibold text-warning underline-offset-2 transition-colors hover:underline"
            >
              Prochaine quête de cité
              <span aria-hidden="true">→</span>
            </button>
          )}
          {isLocked && choiceGroups.length > 0 && (
            <RushPrereqChoiceHint groups={choiceGroups} tone="da" />
          )}
          {prereqsOpen && (
            <RushOverlayPrereqModal
              prereqs={prereqs}
              onGoTo={(targetSeqId, targetMsId) =>
                onGoToPrereq?.(
                  targetSeqId,
                  targetMsId,
                  blockId ? { milestoneId: blockId, seqId: seq.id, name } : undefined
                )
              }
              onClose={() => setPrereqsOpen(false)}
            />
          )}
          {missingDungeons.length > 0 && (
            /* Un seul geste, aligné sur la ligne « Terminer : <quête> » juste au-dessus :
               la phrase ouvre le panneau donjon de la quête. Plus de vignettes dans la
               ligne — la vraie image de chaque donjon reste dans le panneau, au clic
               (retour user du 26/11/2026). Couleur distincte de la quête prérequis :
               le donjon manquant est un verrou de jeu, pas une étape du guide. */
            <button
              type="button"
              onClick={() => {
                dungeonActions?.ensureLoaded?.();
                setDungeonTarget(missingDungeons[0]?.key ?? null);
                setDungeonCloseOnComplete(missingDungeons.length > 0);
                setDungeonPanelOpen(true);
              }}
              aria-haspopup="dialog"
              aria-expanded={dungeonPanelOpen}
              title={`Ouvrir les donjons requis : ${missingDungeons.map((d) => d.name).join(", ")}`}
              className="group inline-flex max-w-full items-center gap-1 rounded-[3px] px-1.5 py-0.5 text-left text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <span className="shrink-0">Terminer :</span>
              <span className="min-w-0 truncate font-semibold text-danger group-hover:underline">
                Donjons requis non validés
              </span>
              <ChevronRight className="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      {linksOpen && (
        <RushOverlayQuestLinksModal
          name={name}
          noobsUrl={noobsUrl}
          dbUrl={dbUrl}
          onOpenDetail={onOpenDetail}
          onClose={() => setLinksOpen(false)}
        />
      )}
    </div>
  );
});

"use client";

import React, { memo, useState } from "react";
import { Check, Flag, BookmarkCheck, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSequenceCoord, getDungeons, isDungeonSequence } from "./overlay-utils";
import { RushOverlayPrereqModal } from "./RushOverlayPrereqModal";
import { RushCoordinateChip } from "@/components/dofus-quests/rush/RushCoordinateChip";
import { RushOverlayMemberBubbles, type OverlayBubbleMember } from "./RushOverlayMemberBubbles";
import { RushOverlayDungeonPopover } from "./RushOverlayDungeonPopover";
import { safeExternalUrl, safeImageUrl } from "@/lib/security";
import { resolveRushSeqIcon, getSequenceNpc, isZaapCopyEnabled, getSequenceManualZaap, getAlignmentSet, getSequenceSuccesses, type RushGuideQuestRef } from "@/lib/rush-guide-utils";
import { SuccessChip } from "@/components/dofus-quests/rush/SuccessChip";
import { NpcBadge } from "@/components/dofus-quests/rush/NpcBadge";
import { RushAlignmentBadge } from "@/components/dofus-quests/rush/RushAlignmentBadge";
import { RushPrereqChoiceHint } from "@/components/dofus-quests/rush/RushPrereqChoiceHint";
import type { RushPrereqChoiceGroup } from "@/lib/rush-prereq-expr";
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
        onLoad={(event) => {
          // Le proxy d'assets renvoie parfois un PNG **transparent 1×1** (mesure du
          // chantier Ocre) : il « charge » sans erreur et laissait un cadre vide.
          // Une vraie vignette fait au moins quelques pixels — sinon on n'affiche rien,
          // conformément à la règle « pas d'image ⇒ rien » du 22/10/2026.
          if (event.currentTarget.naturalWidth <= 2) setBroken(true);
        }}
        onError={() => setBroken(true)}
      />
    </button>
  );
}

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
  /** V-H — noms des monstres déjà capturés (Metamob) ; absent ⇒ état ocre inconnu. */
  capturedOcreNames?: readonly string[];
  /** V-H — ouvre la fenêtre Ocre depuis un donjon ocre. */
  onOpenOcre?: () => void;
  /** Série d'alignement dérivée (« Ali 12 », « Rang 2 ») — jamais persistée. */
  alignmentLabel?: string | null;
  /** Groupes « au choix » (`prereq_expr`) : une seule alternative suffit. */
  choiceGroups?: RushPrereqChoiceGroup[];
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
  prereqs = [],
  missingDungeons = [],
  onGoToPrereq,
  onOpenBookmarkers,
  guildId,
  isNext = false,
  dungeonActions,
  capturedOcreNames,
  onOpenOcre,
  alignmentLabel = null,
  choiceGroups = [],
}: RushOverlayQuestListItemProps) {
  const parsedCoord = getSequenceCoord(seq);
  // Panneau donjon piloté par la ligne : la pastille l'ouvre, les icônes des donjons
  // manquants l'ouvrent **en ciblant** le donjon cliqué (`targetKey`).
  const [dungeonPanelOpen, setDungeonPanelOpen] = useState(false);
  const [dungeonTarget, setDungeonTarget] = useState<string | null>(null);
  // Mini-modale des prérequis (un seul encadré dans la ligne, la liste s'ouvre au clic).
  const [prereqsOpen, setPrereqsOpen] = useState(false);
  // Une icône de quête cassée laissait un cadre carré vide devant le titre : on la
  // retire (règle « pas d'image ⇒ rien », comme les vignettes de donjon).
  const [titleIconBroken, setTitleIconBroken] = useState(false);
  // (le chip « ressources » a été retiré : le détail vit dans la fiche « i »)
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
  ) : null;

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
      <div className="da-card items-center">

        {/* Titre + 2e ligne — clic sur le titre = ouvrir la fiche externe (DPLN/DofusDB).
            Le bloc est une COLONNE : le nom prend toute la largeur (2 lignes max) et les
            étiquettes passent en dessous, en `flex-wrap` — la rangée unique d'avant écrasait
            le nom de la quête dès que la fenêtre PiP était étroite (retour user 08/10/2026). */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {/* 1ʳᵉ rangée : portrait PNJ · état + nom de la quête (l'icône de type vit
              désormais DANS la ligne du nom, voir `titleIcon`). */}
          <div className="flex min-w-0 items-start gap-1.5">
          {seqNpc && (seqNpc.imageUrl || seqNpc.id !== null) && (
            <NpcBadge npcId={seqNpc.id} name={seqNpc.name} imageUrl={seqNpc.imageUrl} bare />
          )}
          <div className="min-w-0 flex-1">
          <span className="da-state">{daState}</span>
          {externalUrl ? (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title={`Ouvrir la fiche sur ${externalLabel}`}
              className="da-qtitle block w-full text-left transition-colors hover:text-accent hover:underline"
            >
              <span className="flex min-w-0 items-center gap-2">
                {!isDone && titleIcon}
                <RushAlignmentBadge label={alignmentLabel} tone="da" />
                <span className="line-clamp-2">{name}</span>
              </span>
            </a>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetail();
              }}
              title="Voir les détails"
              className="da-qtitle block w-full cursor-pointer text-left transition-colors hover:text-accent hover:underline"
            >
              <span className="flex min-w-0 items-center gap-2">
                {!isDone && titleIcon}
                <RushAlignmentBadge label={alignmentLabel} tone="da" />
                <span className="line-clamp-2">{name}</span>
              </span>
            </button>
          )}
          </div>
          </div>

          {/* 2e ligne : indicateurs (chips harmonisés) — toute la largeur de la ligne */}
          {(parsedCoord || hasDungeon || bookmarkers.length > 0 || alignmentSet || successes.length > 0) && (
            <div className="flex flex-wrap items-center gap-1">
              {successes.length > 0 && <SuccessChip successes={successes} quests={guideQuests} />}
              {alignmentSet && alignLabel && (
                <span className={chip} title={`Quête d'alignement → ${alignLabel}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={alignmentSet.camp === "brakmarien" ? "/ordres/brakmar.png" : "/ordres/bonta.png"}
                    alt=""
                    className="h-3 w-3 shrink-0 object-contain"
                  />
                  Alignement {alignLabel}
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
                  capturedOcreNames={capturedOcreNames}
                  onOpenOcre={onOpenOcre}
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
            /* 19/11/2026 — une seule ligne, sans cadre : le cadenas du nœud dit
               le verrou, la ligne dit quoi faire. */
            <button
              type="button"
              onClick={() => setPrereqsOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={prereqsOpen}
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
          {isLocked && choiceGroups.length > 0 && (
            <RushPrereqChoiceHint groups={choiceGroups} tone="da" />
          )}
          {prereqsOpen && (
            <RushOverlayPrereqModal
              prereqs={prereqs}
              onGoTo={(seqId, milestoneId) => onGoToPrereq?.(seqId, milestoneId)}
              onClose={() => setPrereqsOpen(false)}
            />
          )}
          {missingDungeons.length > 0 && (
            /* Une seule mention + les **vignettes** des donjons manquants : chacune ouvre
               le panneau de la quête en ciblant SON donjon (anneau + mise en vue). Les
               noms restent en infobulle — la liste en texte alourdissait la ligne
               (retour user du 22/10/2026). */
            <div className="flex items-center gap-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-danger">
                Donjons requis non validés
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

        {/* Repère (18/11/2026) : une quête **verrouillée** n'est pas jouable, on n'y pose plus de
            repère. S'il en existait un avant le verrou, il reste retirable (sinon il serait collé). */}
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
            "shrink-0 rounded-[3px] p-1 transition-colors",
            (isDone || (isLocked && !isBookmarked)) && "cursor-not-allowed opacity-40",
            isBookmarked && !isDone
              ? "bg-warning/15 text-warning"
              : "text-muted-foreground hover:bg-warning/10 hover:text-warning"
          )}
        >
          {isBookmarked && !isDone ? (
            <BookmarkCheck className="h-3.5 w-3.5" aria-hidden="true" />
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

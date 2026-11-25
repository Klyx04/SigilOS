"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { CheckCircle2, Users } from "lucide-react";
import { useOverlayToast } from "@/components/rush/overlay-toast";
import {
  toggleMilestoneProgress,
  setRushSequenceProgress,
  setRushResourceChecks,
  setRushBookmark,
  applyRushAlignmentFromSequence,
  resetGuideProgress,
  resetMilestoneProgress,
} from "@/server/actions/optimized-guide-actions";
import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";
import { type GuideProgressRow } from "@/lib/guide-progress-helpers";
import { isInfoSequence, isNonCheckableBlock, rushChapterPosition, getPrereqRefs, isSequenceBlockedByPrereqs, deselectSequenceFromProgress, collectCascadeUncheck, type RushPrereqRef, type RushGuideQuestRef } from "@/lib/rush-guide-utils";
import { getPrereqChoiceGroups, type RushPrereqChoiceGroup } from "@/lib/rush-prereq-expr";
import { applyQuestResourceChecks } from "@/lib/rush-resource-checks";
import { buildAlignmentSeries, groupByAlignmentSeries } from "@/lib/rush-alignment-series";
import { filterAlignmentSequences } from "@/lib/rush-alignment-filter";
import { normalizeAlignmentCamp } from "@/lib/rush-route";
import { resolveOverlayLayout, type OverlayDensity } from "@/lib/rush-overlay-layout";
import { planOverlayJump, releaseOverlayFilters, type OverlayJumpOrigin } from "@/lib/rush-overlay-jump";
import { ALIGNMENTS, ORDERS } from "@/lib/dofus-assets";
import { useGuideProgressSync } from "@/hooks/use-guide-sync";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { RushOverlayHeader } from "./components/RushOverlayHeader";
import { RushDungeonsOverviewModal } from "@/components/dofus-quests/rush/RushDungeonsOverviewModal";
import {
  buildRushDungeonsOverview,
  rushDungeonsCounter,
  type RushOverviewMember,
} from "@/lib/rush-dungeons-overview";
import {
  getPublicRushDungeonsCommunity,
  getRushDungeonsCommunity,
} from "@/server/actions/rush-dungeons-overview-actions";
import { useRushDungeonStates } from "@/hooks/use-rush-dungeon-states";
import { readDungeonStates, writeDungeonState } from "@/lib/rush-dungeon-storage";
import {
  dungeonOccurrenceKey,
  doneDungeonKeysForSequence,
  missingRequiredDungeons,
  occurrenceState,
  type RushDungeonMemberState,
  type RushDungeonState,
  type RushDungeonStateMap,
  type RushMissingDungeon,
} from "@/lib/rush-dungeons";
import {
  achievementPanelMode,
  type DungeonAchievementDungeon,
  type DungeonAchievementPanelLoadInput,
  type DungeonAchievementPanelLoader,
  type DungeonAchievementToggleInput,
  type DungeonAchievementToggler,
} from "@/lib/rush-dungeon-achievements";
import { getRushDungeonAchievementPanel, toggleDungeonAchievement as toggleDungeonAchievementAction } from "@/server/actions/dungeon-achievement-actions";
import { RushOverlayDungeonAchievementsModal } from "./components/RushOverlayDungeonAchievementsModal";
import { RushOverlaySearch } from "./components/RushOverlaySearch";
import { RushOverlayChapterBar } from "./components/RushOverlayChapterBar";
import { RushOverlayActions } from "./components/RushOverlayActions";
import { DaThemeProvider } from "@/components/da/da-theme";
import { resolveRushDaTheme } from "@/lib/rush-da-theme";
import { useDaRail } from "@/components/da/use-da-rail";
import { OverlayToaster } from "@/components/rush/overlay-toast";
import { RushOverlayQuestFilter } from "./components/RushOverlayQuestFilter";
import { countRushQuests, matchesRushQuestFilter, nextQuestId, type RushQuestCounts, type RushQuestFilter } from "@/lib/rush-quest-filter";
import { RushOverlayQuestListItem } from "./components/RushOverlayQuestListItem";
import { RushChoiceGroupCard } from "@/components/dofus-quests/rush/RushChoiceGroupCard";
import {
  applyChoiceExclusivity,
  choiceRepresentatives,
  collapseChoiceGroups,
  stepCounts,
} from "@/lib/rush-choice-groups";
import { RushOverlayQuestDetailModal } from "./components/RushOverlayQuestDetailModal";
import { RushOverlayReturnToast } from "./components/RushOverlayReturnToast";
import { RushOverlayFooter } from "./components/RushOverlayFooter";
import { RushOverlayFeedbackPanel } from "./components/RushOverlayFeedbackPanel";
import { PublicMetamobModal } from "@/components/dofus-quests/rush/PublicMetamobModal";
import { RushSeparatorBanner } from "@/components/dofus-quests/rush/RushSeparatorBanner";
import { RushInfoBanner } from "@/components/dofus-quests/rush/RushInfoBanner";
import { RushCombatBanner } from "@/components/dofus-quests/rush/RushCombatBanner";
import { DofusObtainedBanner } from "@/components/dofus-quests/rush/DofusObtainedBanner";
import { RushDofusDexTip } from "@/components/dofus-quests/rush/RushDofusDexTip";
import { splitDofusDexTip } from "@/lib/rush-dofusdex-tip";
import { isRushCombatBlock, rushCombatSequenceType } from "@/lib/rush-block-types";
import { RushRichText } from "@/components/dofus-quests/rush/RushRichText";
import { RushInfoSequenceBanner } from "@/components/dofus-quests/rush/RushInfoSequenceBanner";
import { getNextObjective, aggregateRushResources, nextBlockIndex, bannersForChapter } from "./components/overlay-utils";
import { RushOverlayResourcesModal } from "./components/RushOverlayResourcesModal";
import { RushOverlayMembersModal, type OverlayMember } from "./components/RushOverlayMembersModal";
import { RushOverlayLiveToast } from "@/components/dofus-quests/rush/RushOverlayLiveToast";
import { useGuidePresence } from "@/hooks/use-guide-presence";
import { type OverlayBubbleMember } from "./components/RushOverlayMemberBubbles";
import { RushOverlayOcreModal } from "./components/RushOverlayOcreModal";
import { RushOverlayAlignmentModal } from "./components/RushOverlayAlignmentModal";
import type { AlignmentMember } from "@/components/dofus-quests/rush/GuildAlignmentPanel";
import { buildOcrePlan, type OcrePanelData } from "@/lib/ocre-soul-stones";
import { RushOverlayTutorialModal } from "./components/RushOverlayTutorialModal";
import { dofusMetaIndex, type RushDofusMeta } from "@/lib/rush-dofus-meta";

// Dofus defs pour récupération des visuels d'œufs — SOURCE UNIQUE
// (`src/lib/rush-dofus-meta.ts`). Cette copie-ci divergeait des quatre autres
// (mesuré le 08/10/2026 : `argente` #a8c0d6 vs #a1a1aa, `pourpre` #ef4444 vs
// #a855f7, `ebene` #6366f1 vs #52525b, `sylvestre` #39bc95 vs #d4a017).
const DOFUS_DEFS: Record<string, RushDofusMeta> = dofusMetaIndex();

/** Libellé court d'un membre : « Bontarien · Cœur Vaillant · T42 ». */
function alignmentSummary(camp: string, orderId?: string | null): string {
  const campLabel = ALIGNMENTS.find((a) => a.id === camp)?.name ?? camp;
  if (!orderId) return campLabel;
  const orders = (ORDERS as unknown as Record<string, Array<Record<string, unknown>>>)[camp] || [];
  const order = orders.find((o) => o.id === orderId);
  const orderLabel = order ? String(order.name) : orderId;
  return `${campLabel} · ${orderLabel}`;
}

type Props = {
  guildId?: string;
  guide: { id: string; name: string; slug: string; description?: string; imageUrl?: string };
  milestones: RushMilestone[];
  allProgress?: GuideProgressRow[];
  altPseudo?: string | null;
  /** Personnage courant (principal ou mule) pour l'affichage. */
  character?: { pseudo: string; classe: string | null; isMain: boolean };
  /** Mode invité / démo sans compte ni guilde */
  isGuest?: boolean;
  /** Bloc I — le membre peut-il ouvrir le module Succès ? (aucun `+` sinon). */
  canViewSucces?: boolean;
  /** Bloc I — coutures publiques (PiP du guide public) : catalogue et coches visiteur. */
  loadDungeonAchievementPanel?: DungeonAchievementPanelLoader;
  toggleDungeonAchievement?: DungeonAchievementToggler;
  dungeonAchievementGuestPseudo?: string | null;
  /**
   * Un **compte** est-il connecté sur cette surface ? Distinct de `isGuest`, que le
   * guide public code en dur à `true` : un membre connecté y lit le même overlay.
   * Sert au seul panneau de retour — sans quoi il n'aurait que le Discord alors qu'il
   * peut envoyer (`submitQuestFeedbackAction` exige une session).
   */
  feedbackSignedIn?: boolean;
  /**
   * Metamob de la surface publique connectée (demande du 08/11/2026). `undefined` = la surface
   * ne gère pas Metamob (overlay de guilde) ; une valeur ⇒ le bouton est rendu, iso interne.
   */
  metamobPseudo?: string | null;
  metamobVerified?: boolean;
  /**
   * Préfixe des trois clés de progression invité. La page publique le calcule en
   * fonction du PERSONNAGE déclaré (classe + pseudo + serveur) ; l'overlay ne
   * devine rien : il lit exactement le même emplacement (voir `@/lib/guest-progress`).
   * Par défaut : `sigil_guest_<slug>_` (progression sans personnage).
   */
  guestStoragePrefix?: string;
  /**
   * Faux quand la fenêtre est la popup `about:blank` de secours (navigateur sans
   * Document PiP) → bandeau "fenêtre non épinglée". Vrai par défaut
   * (vraie PiP toujours-au-dessus, ou page overlay directe).
   */
  pinned?: boolean;
  /**
   * Quête Ocre du membre (Metamob lié) — **overlay interne uniquement** : le guide
   * public n'a ni guilde ni compte, donc aucun bouton. `null`/absent ⇒ masqué.
   */
  ocre?: OcrePanelData | null;
  /**
   * V-G : « non lié » est un état à part entière — l'entrée reste visible et le panneau
   * propose la liaison (sans quoi l'overlay est un cul-de-sac pour un compte non lié).
   */
  ocreState?: "ready" | "not-linked" | "error";
  /**
   * V-H — captures Ocre du visiteur **public connecté**, chargées par le pont de la page
   * (`PublicOcreDungeonBridge`). L'overlay ne fait aucun appel réseau : il reçoit la liste,
   * et `ocre` reste réservé à l'overlay interne.
   */
  publicCapturedOcreNames?: readonly string[];
  /** Coches de ressources du membre (serveur, par personnage) — lu par la page. */
  initialResourceChecks?: string[];
  /**
   * Cité et Ordre du personnage COURANT, résolus côté serveur (route `L2`).
   *
   * Repli de la modale d'alignement : `alignmentMembers` déduplique par `profileId` et
   * `buildGuildProgressRows` ne renseigne que le pseudo **principal**, donc pour une mule
   * (`?character=…`) `isSelf` échoue et la modale repartait vide — l'utilisateur pouvait
   * écraser son choix. Le serveur, lui, sait toujours quel personnage est sélectionné.
   */
  selfAlignment?: string | null;
  selfOrder?: string | null;
  /**
   * Porte de départ du guide public : `false` quand aucun personnage n'est déclaré.
   * L'overlay PiP peut être ouvert avant le choix : il lit alors le guide, mais les
   * coches sont bloquées et un bandeau renvoie vers le guide.
   * Absent/`true` ⇒ aucune restriction (overlay interne).
   */
  characterReady?: boolean;
};

export default function GuideOverlayClient({
  guildId = "public",
  guide,
  milestones: rawMilestones,
  allProgress = [],
  altPseudo = null,
  character,
  isGuest = false,
  canViewSucces = false,
  loadDungeonAchievementPanel,
  toggleDungeonAchievement,
  dungeonAchievementGuestPseudo = null,
  feedbackSignedIn = false,
  metamobPseudo,
  metamobVerified = false,
  guestStoragePrefix,
  pinned = true,
  ocre = null,
  ocreState = "ready",
  publicCapturedOcreNames,
  initialResourceChecks,
  selfAlignment = null,
  selfOrder = null,
  characterReady = true,
}: Props) {
  /** Un invité sans personnage lit le guide mais ne coche rien (porte de départ). */
  const canValidate = !isGuest || characterReady;
  const effectiveAltPseudo = altPseudo ?? undefined;
  // ─── Bloc I — succès de donjon (mini-modale) ────────────────────────────────
  // Le mode est déduit de la surface : membre (guildId réel), visiteur connecté
  // (PiP publique + session), invité. Le guest reste en lecture seule.
  const achievementMode = achievementPanelMode({ guildId, isGuest, feedbackSignedIn });
  const [achievementTarget, setAchievementTarget] = useState<{
    sequenceId: string;
    dungeonKey: string;
    dungeon: DungeonAchievementDungeon;
  } | null>(null);
  const openDungeonAchievements = useCallback(
    (sequenceId: string, dungeonKey: string, dungeon: { id?: string; name?: string; bossName?: string; imageUrl?: string }) => {
      if (!dungeon.id) return;
      setAchievementTarget({
        sequenceId,
        dungeonKey,
        dungeon: {
          id: dungeon.id,
          name: dungeon.name ?? "Donjon",
          bossName: dungeon.bossName ?? null,
          imageUrl: dungeon.imageUrl ?? null,
        },
      });
    },
    []
  );
  const achievementHandler = achievementMode === "member" && !canViewSucces ? undefined : openDungeonAchievements;
  const internalAchievementLoader = useCallback(
    (input: DungeonAchievementPanelLoadInput) => {
      if (!achievementTarget) return Promise.resolve({ success: false as const, error: "Donjon introuvable" });
      return getRushDungeonAchievementPanel({
        guildId,
        sequenceId: achievementTarget.sequenceId,
        dungeonId: input.dungeonId,
        characterSlot: input.characterSlot ?? effectiveAltPseudo,
      });
    },
    [achievementTarget, guildId, effectiveAltPseudo]
  );
  const internalAchievementToggler = useCallback(
    (input: DungeonAchievementToggleInput) => {
      if (!achievementTarget) return Promise.resolve({ success: false as const, error: "Donjon introuvable" });
      return toggleDungeonAchievementAction({
        guildId,
        dungeonId: input.dungeonId,
        achievementId: input.achievementId,
        characterSlot: input.characterSlot ?? effectiveAltPseudo,
      });
    },
    [achievementTarget, guildId, effectiveAltPseudo]
  );
  const activeAchievementLoader =
    achievementMode === "member" ? internalAchievementLoader : loadDungeonAchievementPanel;
  const activeAchievementToggler =
    achievementMode === "member" ? internalAchievementToggler : toggleDungeonAchievement;
  // Notifications : Toaster de l'overlay quand il y en a un (PiP), sinon le global.
  const toast = useOverlayToast();
  // Repli si le personnage n'est pas fourni (accès direct à la page overlay).
  const overlayCharacter = useMemo(
    () =>
      character ?? {
        pseudo: effectiveAltPseudo || "Principal",
        classe: null,
        isMain: !effectiveAltPseudo,
      },
    [character, effectiveAltPseudo]
  );

  // La NAVIGATION ne porte que sur les CHAPITRES : les bannières (séparateur, encart
  // CONSEIL/TIPS, « Dofus obtenu ») ne sont pas des étapes — ni case à cocher, ni « 0/0 »,
  // ni titre de chapitre. Elles s'affichent dans le FLUX de leur chapitre, à leur place
  // chronologique (`bannersForChapter`), et on les retrouve dès qu'on ouvre ce chapitre,
  // quelle que soit la façon d'y arriver. Règle partagée `isNonCheckableBlock`.
  const milestones = useMemo(
    () => rawMilestones.filter((ms) => !isNonCheckableBlock(ms)),
    [rawMilestones]
  );

  // Détection du Dofus : règle PARTAGÉE `resolveRushDofus` (`@/lib/rush-dofus-meta`),
  // appelée par le bandeau lui-même. La copie locale de l'overlay a été retirée le
  // 22/11/2026 (elle seule connaissait le repli par titre).

  // ─── Thème ────────────────────────────────────────────────────────────────
  // Le bouton de bascule clair/sombre et sa préférence persistée ont été retirés
  // (décision du 18/11/2026). L'overlay **suit maintenant le thème du site** via
  // `html.light` (sélecteurs CSS de `da-wakfu.css`/`globals.css`) ; `data-theme="dark"`
  // reste le repli SSR et de la route overlay directe.

  const [showResources, setShowResources] = useState<boolean>(false);
  const [showOcre, setShowOcre] = useState<boolean>(false);
  // Alignement (vue guilde + mon choix) : panneau maison, jamais un Dialog Radix en PiP.
  const [showAlignment, setShowAlignment] = useState<boolean>(false);
  const [membersModal, setMembersModal] = useState<{ title: string; members: OverlayMember[] } | null>(null);
  const [showTutorial, setShowTutorial] = useState<boolean>(false);
  // F11 : le panneau de retour est monté ICI (fin de racine), plus dans l'en-tête.
  const [feedbackOpen, setFeedbackOpen] = useState<boolean>(false);
  /** Liaison Metamob de la surface publique connectée (demande du 08/11/2026). */
  const [metamobOpen, setMetamobOpen] = useState<boolean>(false);

  // Détection fiable de la taille RÉELLE du panneau overlay (le `matchMedia` sur
  // `window` ne reflète pas toujours la largeur d'un PiP / panneau redimensionnable).
  // On observe le conteneur racine avec un ResizeObserver.
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Liste des quêtes : cible du bouton « Reprendre » (on ne cherche JAMAIS dans
  // toute la fenêtre — le nœud du dock porte lui aussi un `data-state`).
  const listRef = useRef<HTMLElement | null>(null);
  // Fil de sève : la longueur du fil est mesurée par la règle PARTAGÉE
  // (`useDaRail`, `src/components/da/use-da-rail.ts`) — le guide plein écran
  // applique exactement la même, ce n'est pas une copie.
  const [overlaySmall, setOverlaySmall] = useState<boolean>(false);
  // Palier de densité de l'en-tête : `wide` dès 820 px de haut (hero 276 px + pips
  // de stade), `tight` en fenêtre de jeu, `normal` entre les deux.
  const [overlayDensity, setOverlayDensity] = useState<OverlayDensity>("normal");
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry?.contentRect?.width ?? el.clientWidth;
      const h = entry?.contentRect?.height ?? el.clientHeight;
      const layout = resolveOverlayLayout(w, h);
      setOverlaySmall(layout.small);
      setOverlayDensity(layout.density);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const openChapterMembers = useCallback((members: OverlayMember[]) => {
    setMembersModal({ title: "Sur ce chapitre", members });
  }, []);

  // ─── Présence temps réel : l'overlay CONSOMME, il n'émet pas ───────────────────
  // L'onglet du dashboard émet déjà le heartbeat du profil courant ; un second émetteur
  // depuis la fenêtre PiP créerait une présence en double, et l'overlay public n'a de toute
  // façon aucune identité à annoncer. `enabled: false` ⇒ aucun heartbeat. Le serveur ferme
  // la room aux non-membres (fail-closed) : un visiteur non authentifié reçoit une liste
  // vide — jamais une présence inventée.
  const guideLive = useGuidePresence({
    guildId,
    guideSlug: guide.slug,
    milestoneId: null,
    enabled: false,
  });

  /** Membres RÉELLEMENT connectés (WebSocket), prêts pour la modale des membres. */
  const liveMembers = useMemo<OverlayMember[]>(
    () =>
      guideLive.presence.map((m) => {
        const where = milestones.find((x) => x.id === m.milestoneId);
        // Alignement (cité · Ordre · tranche) lu côté serveur, puis la position.
        const parts = [
          m.alignment ? alignmentSummary(m.alignment, m.alignmentOrder) : "",
          where?.title ? `sur « ${where.title} »` : "",
        ].filter(Boolean);
        return {
          name: m.userName,
          avatar: m.userAvatar,
          subtitle: parts.length ? parts.join(" · ") : undefined,
        };
      }),
    [guideLive.presence, milestones]
  );

  // ─── Progression Locale Optimiste / Guest LocalStorage ───────────────────────
  // Le préfixe vient de l'appelant quand il est fourni (page publique : progression
  // PAR PERSONNAGE), sinon on retombe sur l'emplacement historique sans personnage.
  const storagePrefix = guestStoragePrefix || `sigil_guest_${guide.slug}_`;


  const [completedIds, setCompletedIds] = useState<Set<string>>(() => {
    if (isGuest && typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(`${storagePrefix}completed_ms`);
        if (raw) return new Set(JSON.parse(raw));
      } catch {}
    }
    const s = new Set<string>();
    milestones.forEach((ms) => {
      // Même règle que le dashboard : la complétude est celle de la **route** (les
      // séquences visibles), pas le drapeau global du bloc toutes branches.
      const contentIds = (ms.sequences || [])
        .filter((sequence) => !isInfoSequence(sequence))
        .map((sequence) => sequence.id);
      const steps = ms.playerProgress?.[0]?.completedStepIds ?? [];
      if (contentIds.length > 0 && contentIds.every((id) => steps.includes(id))) s.add(ms.id);
    });
    return s;
  });

  const [completedStepsByMs, setCompletedStepsByMs] = useState<Map<string, Set<string>>>(() => {
    if (isGuest && typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(`${storagePrefix}steps`);
        if (raw) {
          const parsed = JSON.parse(raw);
          const m = new Map<string, Set<string>>();
          for (const [k, v] of Object.entries(parsed)) {
            m.set(k, new Set(v as string[]));
          }
          return m;
        }
      } catch {}
    }
    const m = new Map<string, Set<string>>();
    milestones.forEach((ms) => {
      const ids = ms.playerProgress?.[0]?.completedStepIds;
      if (Array.isArray(ids)) m.set(ms.id, new Set(ids));
    });
    return m;
  });

  const [bookmarksByMs, setBookmarksByMs] = useState<Map<string, string>>(() => {
    if (isGuest && typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(`${storagePrefix}bookmarks`);
        if (raw) {
          const parsed = JSON.parse(raw);
          return new Map(Object.entries(parsed));
        }
      } catch {}
    }
    const m = new Map<string, string>();
    milestones.forEach((ms) => {
      const bk = ms.playerProgress?.[0]?.bookmarkedSeqId;
      if (bk) m.set(ms.id, bk);
    });
    return m;
  });

  // ── Donjons : coche par OCCURRENCE, depuis la pastille de la quête ─────────────
  // Interne : états de la guilde (Server Actions, chargés à la 1ʳᵉ ouverture du panneau).
  // Invité : `localStorage` de l'emplacement courant — aucune donnée de guilde, aucun serveur.
  const guildDungeons = useRushDungeonStates({
    guildId,
    slug: guide.slug,
    altPseudo: effectiveAltPseudo,
    // **Eager** : le verrou de quête a besoin des donjons cochés dès l'ouverture, sinon
    // une quête dont un donjon requis manque reste « cochable » jusqu'à ce qu'on ouvre
    // un panneau donjon (mesure du 22/10/2026 : clic → refus serveur → toast d'erreur).
    lazy: false,
  });
  const [guestDungeonStates, setGuestDungeonStates] = useState<RushDungeonStateMap>(() =>
    isGuest ? readDungeonStates(storagePrefix) : {}
  );
  const dungeonActions = useMemo(() => {
    if (isGuest) {
      return {
        states: guestDungeonStates,
        busyKey: null as string | null,
        others: [] as RushDungeonMemberState[],
        onSet: (sequenceId: string, dungeonKey: string, state: RushDungeonState | null) => {
          setGuestDungeonStates(
            writeDungeonState(storagePrefix, dungeonOccurrenceKey(sequenceId, dungeonKey), state)
          );
          // ── S0-7 : un donjon qui n'est plus « fait » DÉVALIDE la quête ──────────
          // Aucun serveur côté invité : on retire la quête des étapes cochées ici.
          if (state === "done") return;
          const next = deselectSequenceFromProgress({
            completedStepsByMs,
            completedIds,
            milestones,
            sequenceId,
          });
          if (!next.changed) return;
          setCompletedStepsByMs(next.completedStepsByMs);
          setCompletedIds(next.completedIds);
          try {
            const stepsObj: Record<string, string[]> = {};
            next.completedStepsByMs.forEach((set, k) => {
              stepsObj[k] = Array.from(set);
            });
            localStorage.setItem(`${storagePrefix}steps`, JSON.stringify(stepsObj));
            localStorage.setItem(
              `${storagePrefix}completed_ms`,
              JSON.stringify(Array.from(next.completedIds))
            );
          } catch {}
          toast.info("Donjon décoché : la quête a été dévalidée.");
        },
        ensureLoaded: () => setGuestDungeonStates(readDungeonStates(storagePrefix)),
      };
    }
    return {
      states: guildDungeons.states,
      busyKey: guildDungeons.busyKey,
      others: guildDungeons.others,
      onSet: guildDungeons.setState,
      ensureLoaded: guildDungeons.ensureLoaded,
    };
  }, [
    isGuest,
    guestDungeonStates,
    storagePrefix,
    completedStepsByMs,
    completedIds,
    milestones,
    guildDungeons.states,
    guildDungeons.busyKey,
    guildDungeons.others,
    guildDungeons.setState,
    guildDungeons.ensureLoaded,
  ]);

  // ── Bloc J — « Progression Donjons » (bouton d'en-tête + panneau) ───────
  const isPublicSurface = guildId === "public";
  const [dungeonsOverviewOpen, setDungeonsOverviewOpen] = useState(false);
  const [dungeonsCommunity, setDungeonsCommunity] = useState<RushOverviewMember[] | null>(null);
  const openDungeonsOverview = useCallback(() => {
    setDungeonsOverviewOpen(true);
    if (isPublicSurface && !feedbackSignedIn) return;
    // Toujours relire : une coche/décoche de quête, un bloc ou un reset change la liste.
    const request = isPublicSurface
      ? getPublicRushDungeonsCommunity()
      : getRushDungeonsCommunity(guildId, guide.slug, effectiveAltPseudo);
    void request
      .then((res) => {
        if (res.success) setDungeonsCommunity(res.members);
      })
      .catch(() => {});
  }, [guildId, guide.slug, effectiveAltPseudo, isPublicSurface, feedbackSignedIn]);
  const dungeonsOverviewMe = useMemo(
    () => ({
      doneKeys: Object.entries(dungeonActions.states)
        .filter(([, state]) => state === "done")
        .map(([key]) => key),
      flags: [...bookmarksByMs.values()],
    }),
    [dungeonActions.states, bookmarksByMs]
  );
  const dungeonsCounter = useMemo(
    () =>
      rushDungeonsCounter(
        buildRushDungeonsOverview({ milestones, me: dungeonsOverviewMe })
      ),
    [milestones, dungeonsOverviewMe]
  );

  // ─── Synchro dashboard ↔ overlay (BroadcastChannel, même navigateur) ─────
  // Aligne « ce qui est coché » entre la fenêtre du module et l'overlay.
  useGuideProgressSync(
    // Invité : canal par PERSONNAGE (même identifiant que la page publique, qui
    // transmet son préfixe) ; membre : canal de guilde habituel.
    isGuest ? storagePrefix : guildId,
    guide.slug,
    { completedIds, completedStepsByMs, bookmarksByMs },
    { setCompletedIds, setCompletedStepsByMs, setBookmarksByMs }
  );

  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [hideCompleted, setHideCompleted] = useState<boolean>(false);
  // Filtre d'affichage de la liste : Toutes / En cours / Verrouillées.
  // Il ne change ni l'ordre, ni les compteurs de progression — seulement les lignes visibles.
  const [questFilter, setQuestFilter] = useState<RushQuestFilter>("all");
  // Deux filtres incompatibles : « Faites » + « masquer les faites » viderait la liste
  // sans explication. On revient à « Toutes » dès que l'on masque les terminées.
  useEffect(() => {
    if (hideCompleted && questFilter === "done") setQuestFilter("all");
  }, [hideCompleted, questFilter]);
  // Coches de ressources « déjà préparé », par personnage : serveur pour un membre,
  // `localStorage` pour un invité (même clé que le guide public).
  const [resourceChecks, setResourceChecks] = useState<Set<string>>(() => {
    if (initialResourceChecks) return new Set(initialResourceChecks);
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem(`${storagePrefix}resources`);
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch {}
    return new Set();
  });

  const persistGuestResourceChecks = useCallback(
    (next: Set<string>) => {
      if (typeof window === "undefined") return;
      try {
        localStorage.setItem(`${storagePrefix}resources`, JSON.stringify([...next]));
      } catch {}
    },
    [storagePrefix]
  );

  const handleToggleResourceCheck = useCallback(
    async (key: string) => {
      const previous = resourceChecks;
      const next = new Set(previous);
      next.has(key) ? next.delete(key) : next.add(key);
      setResourceChecks(next);
      if (isGuest) {
        persistGuestResourceChecks(next);
        return;
      }
      try {
        await setRushResourceChecks(guildId, guide.slug, [...next], effectiveAltPseudo);
      } catch {
        setResourceChecks(previous);
        toast.error("Impossible d'enregistrer la préparation");
      }
    },
    [resourceChecks, isGuest, persistGuestResourceChecks, guildId, guide.slug, effectiveAltPseudo, toast]
  );
  // Modale de détail d'une quête (remplace l'ancien accordéon).
  const [detailSeq, setDetailSeq] = useState<{ ms: RushMilestone; seq: RushSequence } | null>(null);

  const toggleHideCompleted = useCallback(() => {
    setHideCompleted((prev) => {
      const next = !prev;
      toast.info(next ? "👁️ Quêtes faites masquées" : "👁️ Toutes les quêtes affichées", { duration: 1200 });
      return next;
    });
  }, []);

  // ─── Pagination de Milestone Active ─────────────────────────────────────────
  const defaultMsIndex = useMemo(() => {
    const idx = milestones.findIndex((ms) => !completedIds.has(ms.id));
    return idx >= 0 ? idx : 0;
  }, [milestones, completedIds]);

  const [currentMsIndex, setCurrentMsIndex] = useState<number>(defaultMsIndex);
  const currentMs = milestones[currentMsIndex] || milestones[0] || null;

  const goToNextMs = useCallback(() => {
    // Prochain bloc qui reste à valider — les bandeaux (séparateur, encart CONSEIL/TIPS,
    // « Dofus obtenu ») ne sont jamais sautés : règle pure dans `nextBlockIndex`.
    const next = nextBlockIndex(milestones, currentMsIndex, completedIds);
    if (next !== null) {
      setCurrentMsIndex(next);
      setDetailSeq(null);
    }
  }, [currentMsIndex, milestones, completedIds]);

  const goToPrevMs = useCallback(() => {
    if (currentMsIndex > 0) {
      setCurrentMsIndex((v) => v - 1);
      setDetailSeq(null);
    }
  }, [currentMsIndex]);

  const selectChapter = useCallback(
    (msId: string) => {
      const idx = milestones.findIndex((m) => m.id === msId);
      if (idx >= 0 && idx !== currentMsIndex) {
        setCurrentMsIndex(idx);
        setDetailSeq(null);
      }
    },
    [milestones, currentMsIndex]
  );

  // ─── Recherche ─────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        setTimeout(() => searchRef.current?.focus(), 50);
      }
      // Échap ne fait que vider la recherche (jamais de fermeture surprise :
      // le bouton ✕ de l'en-tête ferme).
      if (e.key === "Escape" && search) {
        setSearch("");
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [search]);

  // ─── Stats Globales ───────────────────────────────────────────────────────
  // Les séquences info (bandeaux/conseils) ne comptent pas dans la progression.
  const contentSeqs = (seqs: RushSequence[]) => seqs.filter((s) => !isInfoSequence(s));

  // Position du bloc courant dans la numérotation des CHAPITRES : un bandeau n'est pas
  // numéroté (« 12 / 45 » ne doit pas compter les séparateurs ni les encarts CONSEIL/TIPS).
  const chapterPos = useMemo(
    () => rushChapterPosition(milestones, currentMs?.id),
    [milestones, currentMs?.id]
  );

  // Bannières à lire AVEC ce chapitre, à leur place chronologique : celles qui l'introduisent
  // au-dessus du contenu, celles de fin de guide en dessous (règle partagée avec le
  // dashboard : « les bannières restent collées au chapitre qui les suit »).
  const banners = useMemo(
    () => bannersForChapter(rawMilestones, currentMs?.id),
    [rawMilestones, currentMs?.id]
  );
  // Une étape à variantes exclusives compte pour UNE, terminée dès qu'une variante
  // est cochée : même règle que le serveur (`stepCounts`).
  const stepProgress = useMemo(() => {
    let total = 0;
    let done = 0;
    for (const ms of milestones) {
      const counts = stepCounts(contentSeqs(ms.sequences), completedStepsByMs.get(ms.id) || []);
      total += counts.total;
      done += counts.done;
    }
    return { total, done };
  }, [milestones, completedStepsByMs]);
  const totalSteps = stepProgress.total;
  const completedSteps = stepProgress.done;
  const overallPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  // ─── Quête Ocre (Metamob) ─────────────────────────────────────────────────
  // Réservé à l'overlay INTERNE d'un membre dont le compte Metamob est lié : le guide
  // public (`isGuest`) et l'overlay sans guilde n'ont ni compte ni progression Ocre,
  // donc aucun bouton n'est rendu — et aucun calcul n'est fait.
  // L'entrée Ocre ne dépend plus des DONNÉES : un membre non lié doit pouvoir ouvrir le
  // panneau et lier son compte. Le mode invité et le guide public restent exclus.
  const ocreEnabled = !isGuest && !!guildId && guildId !== "public";
  // V-H — captures Metamob du membre, dérivées du payload Ocre déjà chargé (aucun
  // appel réseau supplémentaire). Liste vide ⇒ `unknown` : jamais un faux « à capturer ».
  // Surface publique : la liste vient du pont `PublicOcreDungeonBridge` (page).
  const capturedOcreNames = useMemo(() => {
    if (ocreEnabled) {
      return (ocre?.monsters ?? []).filter((m) => m.owned > 0).map((m) => m.nameFr);
    }
    return [...(publicCapturedOcreNames ?? [])];
  }, [ocre, ocreEnabled, publicCapturedOcreNames]);
  // Interne : panneau Ocre de guilde. Public connecté : la modale publique, portée
  // dans la PiP (`portalContainer`) — la même vue `OcreQuestPanel`, au même endroit.
  const openOcre = ocreEnabled
    ? () => setShowOcre(true)
    : isGuest && feedbackSignedIn
      ? () => setMetamobOpen(true)
      : undefined;
  const ocreSummary = useMemo(() => {
    if (!ocreEnabled || !ocre) return null;
    const plan = buildOcrePlan(ocre);
    return { missing: plan.progress.missing, percent: plan.progress.percent };
  }, [ocre, ocreEnabled]);

  // Ressources du BLOC affiché : même agrégation, périmètre = le chapitre courant.
  // C'est ce que le bouton « Ressources n/N » compte et ouvre — le guide entier
  // (482 objets) ne disait rien de l'étape en cours (retour user 05/11/2026).
  const chapterResources = useMemo(
    () => (currentMs ? aggregateRushResources([currentMs]) : []),
    [currentMs]
  );

  // Compteur du bouton « Ressources » : les ressources du bloc déjà cochées.
  const resourcesChecked = useMemo(
    () => chapterResources.filter((r) => resourceChecks.has(r.key)).length,
    [chapterResources, resourceChecks]
  );

  // « Reprendre » : la prochaine quête à faire du chapitre affiché. On interroge la
  // LISTE, jamais la fenêtre entière (le nœud du dock porte lui aussi un `data-state`).
  // `next` depuis E1e ; `todo` sinon (liste entièrement verrouillée).
  const scrollToNextQuest = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const target = list.querySelector<HTMLElement>('[data-state="next"], [data-state="todo"]');
    target?.scrollIntoView({ block: "center" });
  }, []);

  // Alignement de la guilde : `allProgress` porte déjà camp / Ordre / tranche
  // (`GuideProgressRow`), et la présence live dit qui est connecté — zéro requête.
  const alignmentMembers = useMemo<AlignmentMember[]>(() => {
    const online = new Set(guideLive.presence.map((p) => p.profileId));
    const byProfile = new Map<string, AlignmentMember>();
    for (const row of allProgress) {
      if (!row?.profileId || byProfile.has(row.profileId)) continue;
      byProfile.set(row.profileId, {
        profileId: row.profileId,
        userName: row.userName || "Voyageur",
        userAvatar: row.userAvatar,
        alignment: row.alignment ?? null,
        alignmentOrder: row.alignmentOrder ?? null,
        alignmentLevel: row.alignmentLevel ?? 0,
        isOnline: online.has(row.profileId),
        isSelf: !!character?.pseudo && row.userName === character.pseudo,
      });
    }
    return [...byProfile.values()];
  }, [allProgress, guideLive.presence, character?.pseudo]);

  const currentMsSeqs = contentSeqs(currentMs?.sequences || []);
  const currentMsDoneSeqs = currentMs ? completedStepsByMs.get(currentMs.id) || new Set<string>() : new Set<string>();

  // Image de Dofus associée au guide ou au milestone
  const dofusImage = useMemo(() => {
    if (guide.slug.includes("sylvestre") || guide.name.toLowerCase().includes("sylvestre")) {
      return "/module-dofus/Dofus_Sylvestre.png";
    }
    if (currentMs?.dofusId && DOFUS_DEFS[currentMs.dofusId]) {
      return DOFUS_DEFS[currentMs.dofusId].imageUrl;
    }
    return guide.imageUrl || "/module-dofus/Dofus_Sylvestre.png";
  }, [currentMs, guide.imageUrl, guide.slug, guide.name]);

  // ─── Membres ayant posé un repère (par séquence) ────────────────────────────
  // Le "repère" d'un membre = son `currentStep`. Selon l'appelant (dashboard Rush
  // ou overlay) il peut être stocké brut (`seqId`) ou préfixé (`seq:<seqId>`).
  // On normalise puis on compare directement à l'id de séquence (plus de mapping
  // step-keys Ganymède qui ne correspondait jamais → avatars vides).
  // ⚠️ Les séquences de TOUS les chapitres font foi : une bulle doit s'afficher sur
  // N'IMPORTE quelle quête affichée (résultats de recherche, chapitre rouvert), pas
  // seulement sur le chapitre courant (retour user 21/09/2026 : « les bulles profil …
  // aussi sur l'overlay dans chaque quête »).
  const validSeqIds = useMemo(() => {
    const ids = new Set<string>();
    for (const ms of milestones) for (const s of ms.sequences) ids.add(s.id);
    return ids;
  }, [milestones]);

  const bookmarkersBySeq = useMemo(() => {
    const map = new Map<string, OverlayBubbleMember[]>();
    // Un membre peut avoir plusieurs emplacements (principal + mule) sur la même quête :
    // UNE seule bulle par membre et par quête (même règle que le dashboard, qui
    // déduplique par `profileId || userName`).
    const seen = new Map<string, Set<string>>();
    for (const row of allProgress) {
      if (!row.currentStep) continue;
      const raw = String(row.currentStep);
      const seqId = raw.startsWith("seq:") ? raw.slice(4) : raw;
      if (!validSeqIds.has(seqId)) continue;
      const seenForSeq = seen.get(seqId) ?? new Set<string>();
      const memberKey = row.profileId || row.userName;
      if (seenForSeq.has(memberKey)) continue;
      seenForSeq.add(memberKey);
      seen.set(seqId, seenForSeq);
      const list = map.get(seqId) || [];
      list.push({ name: row.userName, avatar: row.userAvatar });
      map.set(seqId, list);
    }
    return map;
  }, [allProgress, validSeqIds]);

  /** Bulles « ici » d'une quête → mini-modale des membres (liste défilante). */
  const openSeqMembers = useCallback(
    (seq: RushSequence) => {
      const members = (bookmarkersBySeq.get(seq.id) || []).map((x) => ({ name: x.name, avatar: x.avatar }));
      setMembersModal({ title: "En attente ici", members });
    },
    [bookmarkersBySeq]
  );

  // ─── Prérequis (gating de validation) ─────────────────────────────────────
  // Une quête ne peut être cochée que si toutes ses quêtes prérequis sont validées.
  const gateAllCompleted = useMemo(() => {
    const all = new Set<string>();
    // Un bloc entièrement validé compte toutes ses quêtes : sinon les ressources
    // restantes (et le gating des prérequis) ignorent ses séquences si elles
    // n'ont pas été cochées une à une.
    for (const ms of milestones) {
      if (completedIds.has(ms.id)) {
        for (const s of ms.sequences) all.add(s.id);
        continue;
      }
      const steps = completedStepsByMs.get(ms.id);
      if (steps) for (const id of steps) all.add(id);
    }
    return all;
  }, [milestones, completedIds, completedStepsByMs]);
  // Mode « restantes » : on exclut les ressources des quêtes déjà cochées
  // (décrément en direct selon l'avancement). Périmètre = le bloc affiché, comme
  // le bouton « Ressources n/N » (une seule vérité pour le compteur et la liste).
  const remainingResources = useMemo(
    () => (currentMs ? aggregateRushResources([currentMs], gateAllCompleted) : []),
    [currentMs, gateAllCompleted]
  );



  const prereqBySeq = useMemo(() => {
    const map = new Map<string, RushPrereqRef[]>();
    if (!currentMs) return map;
    for (const seq of currentMs.sequences) {
      map.set(seq.id, getPrereqRefs(seq, milestones));
    }
    return map;
  }, [currentMs, milestones]);

  /**
   * Quêtes du guide (id → nom + état) : la fiche d'un succès les liste avec leur coche.
   * Construite une fois par rendu des jalons — 600 entrées légères, pas de requête.
   */
  const guideQuests = useMemo<RushGuideQuestRef[]>(() => {
    const out: RushGuideQuestRef[] = [];
    for (const ms of milestones) {
      const doneSet = completedStepsByMs.get(ms.id);
      for (const seq of ms.sequences) {
        for (const questId of (seq as { questDbIds?: number[] }).questDbIds ?? []) {
          out.push({
            id: questId,
            name: seq.subGuideName || `Quête ${questId}`,
            done: doneSet?.has(seq.id) ?? false,
            sequenceId: seq.id,
          });
        }
      }
    }
    return out;
  }, [milestones, completedStepsByMs]);

  const getSeqGate = useCallback(
    (seq: RushSequence): { locked: boolean; prereqs: RushPrereqRef[]; missingDungeons: RushMissingDungeon[]; choiceGroups: RushPrereqChoiceGroup[] } => {
      const refs = prereqBySeq.get(seq.id) || getPrereqRefs(seq, milestones);
      // Verrou UNITAIRE : un donjon **requis** non coché bloque la quête. La validation
      // par bloc bypass ce verrou (décision 20/11) ; la quête seule le conserve (24/11).
      const missingDungeons = missingRequiredDungeons(
        seq,
        doneDungeonKeysForSequence(dungeonActions.states, seq.id)
      );
      // Le verrou est celui du SERVEUR (`isSequenceBlockedByPrereqs`) : tags ET, chaîne
      // des rangs, palier de cité et groupes « au choix ». La liste `refs` ne sert qu'à
      // l'affichage (nommer les prérequis ET) — elle ne couvrait ni le palier ni l'OU.
      const choiceGroups = getPrereqChoiceGroups(seq, milestones);
      return {
        locked: isSequenceBlockedByPrereqs(seq, gateAllCompleted, milestones) || missingDungeons.length > 0,
        // Seuls les prérequis ENCORE manquants : la carte affiche « Terminer : X » et
        // X devait être la quête précédente même une fois validée (mesure du 05/11/2026).
        // Le verrou, lui, reste calculé sur le guide entier.
        prereqs: refs.filter((r) => !gateAllCompleted.has(r.seqId)),
        missingDungeons,
        choiceGroups,
      };
    },
    [prereqBySeq, gateAllCompleted, milestones, dungeonActions.states]
  );

  const [pendingFocus, setPendingFocus] = useState<{ seqId: string; name: string } | null>(null);

  const jumpToQuest = useCallback(
    (target: { seqId: string; milestoneId: string }): boolean => {
      const plan = planOverlayJump(milestones, target);
      if (!plan) {
        toast.error("Quête cible introuvable dans ce guide");
        return false;
      }
      // Une recherche ou un filtre de la vue précédente peut empêcher la cible
      // d'être rendue : on ne relâche que ce qui la cache, pour ne pas changer
      // la vue du joueur sans raison (le saut doit toujours atterrir).
      const targetMs = milestones[plan.milestoneIndex];
      const targetSeq = targetMs?.sequences.find((s) => s.id === plan.seqId);
      const targetDone = completedStepsByMs.get(targetMs?.id ?? "")?.has(plan.seqId) ?? false;
      const targetLocked = targetSeq ? getSeqGate(targetSeq).locked : false;
      const release = releaseOverlayFilters(
        { search, hideCompleted, questFilter },
        { isDone: targetDone, isLocked: targetLocked }
      );
      if (release.clearSearch) setSearch("");
      if (release.showCompleted) setHideCompleted(false);
      if (release.resetQuestFilter) setQuestFilter("all");
      setCurrentMsIndex(plan.milestoneIndex);
      setDetailSeq(null);
      setPendingFocus({ seqId: plan.seqId, name: plan.name });
      return true;
    },
    [
      milestones,
      completedStepsByMs,
      getSeqGate,
      search,
      hideCompleted,
      questFilter,
      toast,
    ]
  );

  // Le toast « Revenir » capture l'action pendant 10 s : la ref lui donne
  // toujours le `jumpToQuest` courant (filtres et progression à jour).
  const jumpToQuestRef = useRef(jumpToQuest);
  useEffect(() => {
    jumpToQuestRef.current = jumpToQuest;
  }, [jumpToQuest]);

  /**
   * Le nœud cible vit dans le document de l'overlay (PiP) : le `document` global
   * désigne la page HÔTE. On attend que la ligne soit montée après le changement
   * de bloc, puis on la centre et on l'anneau 1,8 s.
   */
  useEffect(() => {
    if (!pendingFocus) return;
    const doc = rootRef.current?.ownerDocument;
    const win = doc?.defaultView ?? (typeof window !== "undefined" ? window : null);
    if (!doc || !win) return;
    let alive = true;
    let attempts = 0;
    let timer: number | undefined;
    let spotlight: number | undefined;
    let highlighted: HTMLElement | null = null;
    const ring = ["ring-2", "ring-success", "ring-offset-2", "ring-offset-background"];
    const tryScroll = () => {
      if (!alive) return;
      const el = doc.getElementById(`overlay-seq-${pendingFocus.seqId}`);
      if (!el) {
        if (attempts < 12) {
          attempts += 1;
          timer = win.setTimeout(tryScroll, 100 + attempts * 60);
        } else {
          toast.error(`Quête cible introuvable : ${pendingFocus.name}`);
        }
        return;
      }
      highlighted = el;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add(...ring);
      spotlight = win.setTimeout(() => el.classList.remove(...ring), 1800);
    };
    timer = win.setTimeout(tryScroll, 80);
    return () => {
      alive = false;
      if (timer !== undefined) win.clearTimeout(timer);
      if (spotlight !== undefined) win.clearTimeout(spotlight);
      // Un second saut avant la fin de l'anneau ne doit pas laisser la
      // première ligne surlignée pour toujours.
      highlighted?.classList.remove(...ring);
    };
  }, [pendingFocus, toast]);

  const handleGoToPrereq = useCallback(
    (seqId: string, milestoneId: string, origin?: OverlayJumpOrigin) => {
      const landed = jumpToQuest({ seqId, milestoneId });
      if (!landed || !origin) return;
      // Même principe que le guide interne (retour proposé depuis la modale) :
      // le joueur a quitté sa quête d'origine (souvent dans un autre bloc),
      // le toast la lui rend — 30 s avec compte à rebours pour ne pas le rater.
      toast.custom(
        (id) => (
          <RushOverlayReturnToast
            questName={origin.name}
            seconds={30}
            onReturn={() => {
              toast.dismiss(id);
              jumpToQuestRef.current(origin);
            }}
            onDismiss={() => toast.dismiss(id)}
          />
        ),
        { duration: 30000 }
      );
    },
    [jumpToQuest, toast]
  );

  const handleGoToDungeonStep = useCallback(
    (seqId: string) => {
      const milestone = milestones.find((ms) =>
        Array.isArray(ms.sequences) && ms.sequences.some((seq) => seq.id === seqId)
      );
      jumpToQuest({ seqId, milestoneId: milestone?.id ?? "" });
    },
    [milestones, jumpToQuest]
  );

  /**
   * « Valider les prérequis » d'un succès : l'action serveur renvoie un succès par bloc,
   * mais l'overlay ne relit pas les props (il vit dans une PiP, souvent hors du routeur).
   * On applique donc **exactement les séquences validées** au state local, ressources et
   * donjons compris — le serveur reste seul juge (auth, périmètre, donjons, verrous).
   */
  const handleSuccessValidated = useCallback(
    (updates: Array<{ milestoneId: string; sequenceIds: string[] }>) => {
      const validated = new Set(updates.flatMap((update) => update.sequenceIds));
      const nextSteps = new Map(completedStepsByMs);
      for (const update of updates) {
        const set = new Set(nextSteps.get(update.milestoneId) ?? []);
        for (const id of update.sequenceIds) set.add(id);
        nextSteps.set(update.milestoneId, set);
      }
      setCompletedStepsByMs(nextSteps);
      setCompletedIds((prev) => {
        const next = new Set(prev);
        for (const ms of milestones) {
          const content = (ms.sequences ?? []).filter((seq) => !isInfoSequence(seq));
          if (content.length === 0) continue;
          const done = nextSteps.get(ms.id) ?? new Set<string>();
          if (content.every((seq) => done.has(seq.id))) next.add(ms.id);
        }
        return next;
      });
      let nextResources = resourceChecks;
      for (const ms of milestones) {
        for (const seq of ms.sequences ?? []) {
          if (!validated.has(seq.id)) continue;
          nextResources = applyQuestResourceChecks(nextResources, seq.activityTags, true);
        }
      }
      setResourceChecks(nextResources);
      if (isGuest) persistGuestResourceChecks(nextResources);
      void guildDungeons.refresh();
    },
    [
      completedStepsByMs,
      milestones,
      resourceChecks,
      isGuest,
      persistGuestResourceChecks,
      guildDungeons.refresh,
    ]
  );

  // Objet STABLE : `RushOverlayQuestListItem` est `memo`, un contexte recréé à chaque
  // rendu re-rendrait les ~500 lignes de quête à chaque frappe de recherche.
  const successValidation = useMemo(
    () =>
      isGuest
        ? undefined
        : {
            guildId,
            altPseudo: effectiveAltPseudo,
            onValidated: handleSuccessValidated,
          },
    [isGuest, guildId, effectiveAltPseudo, handleSuccessValidated]
  );

  // ─── Présence communauté : membres ayant un repère sur ce chapitre ─────────
  const chapterMembers = useMemo(() => {
    if (!currentMs) return [];
    const seen = new Set<string>();
    const out: { name: string; avatar?: string; stepId?: string }[] = [];
    for (const row of allProgress) {
      if (row.milestoneId !== currentMs.id) continue;
      if (seen.has(row.profileId)) continue;
      seen.add(row.profileId);
      const raw = row.currentStep ? String(row.currentStep) : "";
      out.push({
        name: row.userName,
        avatar: row.userAvatar,
        stepId: raw ? (raw.startsWith("seq:") ? raw.slice(4) : raw) : undefined,
      });
    }
    return out;
  }, [allProgress, currentMs]);


  // ─── Mutations Optimistes ──────────────────────────────────────────────────
  /**
   * V-H — retour de **bloc** (pas de quête) : un toast dans l'overlay, à la même
   * place et avec la même DA que les autres. Un bloc `DOFUS` annonce l'obtention.
   */
  const notifyBlockDone = useCallback(
    (ms: RushMilestone) => {
      toast.success(
        ms.type === "DOFUS" ? `🍀 Dofus obtenu : ${ms.title}` : `Bloc validé : ${ms.title}`,
        { duration: 2500 }
      );
    },
    [toast]
  );

  const handleToggleMs = useCallback(
    async (ms: RushMilestone) => {
      if (loadingIds.has(ms.id)) return;
      if (!canValidate) {
        toast.warning("Choisis ton personnage dans le guide avant de valider un bloc.");
        return;
      }
      const was = completedIds.has(ms.id);
      const contentSeqs = (ms.sequences || []).filter((sequence) => !isInfoSequence(sequence));
      const scope = contentSeqs.map((sequence) => sequence.id);
      // Une étape à variantes exclusives ne coche qu'UNE variante : le serveur applique
      // la même réduction ; l'écho optimiste ne montre pas les trois validées.
      const checked = was
        ? []
        : choiceRepresentatives(contentSeqs, scope, completedStepsByMs.get(ms.id) || new Set());
      const checkedSet = new Set(checked);
      // Ressources : valider le chapitre coche celles des quêtes réellement validées ;
      // l'invalider les décoche. Écho optimiste de la règle serveur, persisté pour l'invité.
      const resourceBefore = resourceChecks;
      const nextResourceChecks = (ms.sequences || []).reduce(
        (acc, s) =>
          was || checkedSet.has(s.id)
            ? applyQuestResourceChecks(acc, (s as any).activityTags, !was)
            : acc,
        resourceChecks
      );
      setResourceChecks(nextResourceChecks);
      if (isGuest) persistGuestResourceChecks(nextResourceChecks);
      setCompletedIds((prev) => {
        const n = new Set(prev);
        was ? n.delete(ms.id) : n.add(ms.id);
        return n;
      });
      // Chapitre validé/dévalidé d'un coup → synchronise les quêtes cochées
      // (sinon les cases ne se cochent pas toutes et les ressources ne sont
      // pas décomptées pour ce chapitre).
      const prevSteps = new Map(completedStepsByMs);
      setCompletedStepsByMs((prev) => {
        const n = new Map(prev);
        n.set(ms.id, new Set(checked));
        return n;
      });
      if (isGuest) {
        if (typeof window !== "undefined") {
          try {
            const nextCompleted = was
              ? Array.from(completedIds).filter((id) => id !== ms.id)
              : [...Array.from(completedIds), ms.id];
            localStorage.setItem(`${storagePrefix}completed_ms`, JSON.stringify(nextCompleted));
            const stepsObj: Record<string, string[]> = {};
            prevSteps.forEach((set, k) => {
              stepsObj[k] = Array.from(set);
            });
            stepsObj[ms.id] = was ? [] : checked;
            localStorage.setItem(`${storagePrefix}steps`, JSON.stringify(stepsObj));

            if (!was && bookmarksByMs.get(ms.id)) {
              setBookmarksByMs((prev) => {
                const n = new Map(prev);
                n.delete(ms.id);
                localStorage.setItem(`${storagePrefix}bookmarks`, JSON.stringify(Object.fromEntries(n)));
                return n;
              });
            }
          } catch {}
        }
        if (!was) {
          notifyBlockDone(ms);
          goToNextMs();
        }
        return;
      }
      setLoadingIds((prev) => new Set([...prev, ms.id]));
      let refusal: string | null = null;
      try {
        const res = await toggleMilestoneProgress(guildId, ms.id, !was, effectiveAltPseudo, scope);
        if (!(res as any)?.success) {
          // Refus serveur (ex. donjon requis non fait) : on affiche SA raison, pas « Erreur ».
          refusal = (res as any)?.error || null;
          throw new Error("Échec mutation");
        }
        // Chapitre validé d'un coup → son repère est retiré (soit validé, soit repère).
        if (!was && bookmarksByMs.get(ms.id)) {
          setBookmarksByMs((prev) => {
            const n = new Map(prev);
            n.delete(ms.id);
            return n;
          });
          await setRushBookmark(guildId, ms.id, null, effectiveAltPseudo).catch(() => {});
        }
        void guildDungeons.refresh();
        // Chapitre complété d'un coup → passer automatiquement au suivant.
        if (!was) {
          notifyBlockDone(ms);
          goToNextMs();
        }
      } catch {
        setResourceChecks(resourceBefore);
        setCompletedStepsByMs(prevSteps);
        setCompletedIds((prev) => {
          const n = new Set(prev);
          was ? n.add(ms.id) : n.delete(ms.id);
          return n;
        });
        toast.error(refusal ?? "Erreur de synchronisation");
      } finally {
        setLoadingIds((prev) => {
          const n = new Set(prev);
          n.delete(ms.id);
          return n;
        });
      }
    },
    [completedIds, completedStepsByMs, loadingIds, bookmarksByMs, guildId, effectiveAltPseudo, goToNextMs, resourceChecks, isGuest, persistGuestResourceChecks, notifyBlockDone, guildDungeons.refresh, canValidate]
  );

  const handleResetMs = useCallback(
    async (ms: RushMilestone) => {
      if (loadingIds.has(ms.id)) return;
      const prevCompleted = completedIds;
      const prevSteps = completedStepsByMs;
      const prevResources = resourceChecks;
      setCompletedIds((prev) => {
        const n = new Set(prev);
        n.delete(ms.id);
        return n;
      });
      const nextSteps = new Map(completedStepsByMs);
      nextSteps.set(ms.id, new Set<string>());
      setCompletedStepsByMs(nextSteps);
      const nextResources = (ms.sequences || []).reduce(
        (acc, s) => applyQuestResourceChecks(acc, s.activityTags, false),
        resourceChecks
      );
      setResourceChecks(nextResources);

      if (isGuest) {
        persistGuestResourceChecks(nextResources);
        if (typeof window !== "undefined") {
          try {
            const stepsObj: Record<string, string[]> = {};
            nextSteps.forEach((set, key) => {
              stepsObj[key] = Array.from(set);
            });
            localStorage.setItem(`${storagePrefix}steps`, JSON.stringify(stepsObj));
            localStorage.setItem(
              `${storagePrefix}completed_ms`,
              JSON.stringify(Array.from(completedIds).filter((id) => id !== ms.id))
            );
          } catch {}
        }
        toast.success("Bloc réinitialisé");
        return;
      }

      setLoadingIds((prev) => new Set([...prev, ms.id]));
      try {
        await resetMilestoneProgress(guildId, ms.id, effectiveAltPseudo);
        toast.success("Bloc réinitialisé");
        void guildDungeons.refresh();
      } catch {
        setCompletedIds(prevCompleted);
        setCompletedStepsByMs(prevSteps);
        setResourceChecks(prevResources);
        toast.error("Erreur de réinitialisation");
      } finally {
        setLoadingIds((prev) => {
          const n = new Set(prev);
          n.delete(ms.id);
          return n;
        });
      }
    },
    [
      completedIds,
      completedStepsByMs,
      loadingIds,
      guildId,
      effectiveAltPseudo,
      resourceChecks,
      isGuest,
      persistGuestResourceChecks,
      storagePrefix,
      toast,
      guildDungeons.refresh,
    ]
  );

  const handleToggleSeq = useCallback(
    async (ms: RushMilestone, seqId: string) => {
      if (!canValidate) {
        toast.warning("Choisis ton personnage dans le guide avant de cocher tes quêtes.");
        return;
      }
      const prevSet = new Set(completedStepsByMs.get(ms.id) || []);
      let cur = new Set(prevSet);
      const was = cur.has(seqId);
      if (!was) {
        const seqObj = ms.sequences.find((s) => s.id === seqId);
        const gate = seqObj
          ? getSeqGate(seqObj)
          : { locked: false, prereqs: [] as RushPrereqRef[], missingDungeons: [] as RushMissingDungeon[] };
        if (gate.locked) {
          toast.warning(
            gate.missingDungeons.length > 0
              ? `Donjons requis à cocher d'abord : ${gate.missingDungeons.map((d) => d.name).join(", ")}.`
              : "Terminez d'abord les prérequis de cette quête."
          );
          return;
        }
      }
      was ? cur.delete(seqId) : cur.add(seqId);
      const contentSeqs = ms.sequences.filter((s) => !isInfoSequence(s));
      // Étape à variantes exclusives : cocher une variante retire ses sœurs (écho
      // optimiste identique au serveur) ; le bloc se termine dès qu'une est cochée.
      if (!was) cur = new Set(applyChoiceExclusivity(contentSeqs, Array.from(cur), [seqId]));
      const counts = stepCounts(contentSeqs, cur);
      const allChecked = counts.total > 0 && counts.done === counts.total;
      const prevMap = new Map(completedStepsByMs);
      const prevActive = completedIds.has(ms.id);
      // Cascade décoche : décocher la cible décoche aussi les quêtes qui en dépendent.
      const cascadeMsIds = new Map<string, Set<string>>();
      const cascadeSeqIds = new Set<string>();
      if (was) {
        const cascade = collectCascadeUncheck(seqId, milestones, gateAllCompleted);
        for (const cid of cascade) {
          if (cid === seqId) continue;
          const owner = milestones.find((m) => m.sequences.some((s) => s.id === cid));
          if (!owner) continue;
          cascadeSeqIds.add(cid);
          if (!cascadeMsIds.has(owner.id)) cascadeMsIds.set(owner.id, new Set<string>());
          cascadeMsIds.get(owner.id)!.add(cid);
        }
      }
      // Ressources : valider coche les ressources de la quête ; invalider les décoche
      // (cascade comprise). Le serveur applique la même règle ; ici, l'écho optimiste.
      const resourceBefore = resourceChecks;
      const seqResource = ms.sequences.find((s) => s.id === seqId);
      let nextResourceChecks = applyQuestResourceChecks(
        resourceChecks,
        (seqResource as any)?.activityTags,
        !was
      );
      for (const cid of cascadeSeqIds) {
        const cs = milestones.flatMap((m) => m.sequences).find((s) => s.id === cid);
        if (cs) nextResourceChecks = applyQuestResourceChecks(nextResourceChecks, (cs as any).activityTags, false);
      }
      setResourceChecks(nextResourceChecks);
      if (isGuest) persistGuestResourceChecks(nextResourceChecks);
      setCompletedStepsByMs((prev) => {
        const n = new Map(prev);
        n.set(ms.id, cur);
        for (const [mid, set] of cascadeMsIds) {
          const s = new Set(n.get(mid) || []);
          for (const cid of set) s.delete(cid);
          n.set(mid, s);
        }
        return n;
      });
      setCompletedIds((prev) => {
        const n = new Set(prev);
        allChecked ? n.add(ms.id) : n.delete(ms.id);
        for (const [mid, set] of cascadeMsIds) {
          const m = milestones.find((mm) => mm.id === mid);
          if (!m) continue;
          const reg = m.sequences.filter((s) => !isInfoSequence(s));
          const steps = new Set(completedStepsByMs.get(mid) || []);
          for (const cid of set) steps.delete(cid);
          const cascadeCounts = stepCounts(reg, steps);
          const done = cascadeCounts.total > 0 && cascadeCounts.done === cascadeCounts.total;
          done ? n.add(mid) : n.delete(mid);
        }
        return n;
      });
      if (isGuest) {
        if (typeof window !== "undefined") {
          try {
            const stepsObj: Record<string, string[]> = {};
            completedStepsByMs.forEach((set, k) => {
              stepsObj[k] = Array.from(set);
            });
            stepsObj[ms.id] = Array.from(cur);
            for (const [mid, set] of cascadeMsIds) {
              const currentSt = new Set(completedStepsByMs.get(mid) || []);
              for (const cid of set) currentSt.delete(cid);
              stepsObj[mid] = Array.from(currentSt);
            }
            localStorage.setItem(`${storagePrefix}steps`, JSON.stringify(stepsObj));

            const nextCompleted = new Set(completedIds);
            allChecked ? nextCompleted.add(ms.id) : nextCompleted.delete(ms.id);
            for (const [mid, set] of cascadeMsIds) {
              const m = milestones.find((mm) => mm.id === mid);
              if (!m) continue;
              const reg = m.sequences.filter((s) => !isInfoSequence(s));
              const steps = new Set(completedStepsByMs.get(mid) || []);
              for (const cid of set) steps.delete(cid);
              const cascadeCounts = stepCounts(reg, steps);
              const done = cascadeCounts.total > 0 && cascadeCounts.done === cascadeCounts.total;
              done ? nextCompleted.add(mid) : nextCompleted.delete(mid);
            }
            localStorage.setItem(`${storagePrefix}completed_ms`, JSON.stringify(Array.from(nextCompleted)));

            if (!was && bookmarksByMs.get(ms.id) === seqId) {
              const nextBk = new Map(bookmarksByMs);
              nextBk.delete(ms.id);
              setBookmarksByMs(nextBk);
              localStorage.setItem(`${storagePrefix}bookmarks`, JSON.stringify(Object.fromEntries(nextBk)));
            }
          } catch {}
        }
        // Dernière quête du chapitre cochée à la main → on enchaîne sur le chapitre suivant.
        if (!was && allChecked) {
          notifyBlockDone(ms);
          goToNextMs();
        }
        return;
      }
      try {
        const res = await setRushSequenceProgress(guildId, ms.id, Array.from(cur), effectiveAltPseudo);
        if (!(res as any)?.success) throw new Error("Échec mutation");
        // Validation → le repère (« je suis ici ») de cette quête est retiré :
        // une quête est soit validée, soit marquée d'un repère, jamais les deux.
        // Le panneau donjon peut avoir changé (coche des requis) : on relit l'état.
        void guildDungeons.refresh();
        if (!was && bookmarksByMs.get(ms.id) === seqId) {
          setBookmarksByMs((prev) => {
            const n = new Map(prev);
            n.delete(ms.id);
            return n;
          });
          await setRushBookmark(guildId, ms.id, null, effectiveAltPseudo).catch(() => {});
        }
        // Cascade : persiste les milestones dépendants (quêtes décochées).
        for (const [mid, set] of cascadeMsIds) {
          const steps = new Set(completedStepsByMs.get(mid) || []);
          for (const cid of set) steps.delete(cid);
          await setRushSequenceProgress(guildId, mid, Array.from(steps), effectiveAltPseudo).catch(() => {});
        }
        // Quête(s) d'alignement : applique (coche) / restaure (décoche) l'alignement.
        for (const sid of [seqId, ...cascadeSeqIds]) {
          const owner = milestones.find((m) => m.sequences.some((s) => s.id === sid));
          const alignTag = owner?.sequences
            .find((s) => s.id === sid)
            ?.activityTags?.some((t) => t.type === "alignment_set");
          if (!alignTag) continue;
          const ares = await applyRushAlignmentFromSequence(guildId, sid, !was, effectiveAltPseudo);
          if ((ares as any)?.success) {
            toast.success(
              was
                ? "↩️ Alignement restauré"
                : `↦ Alignement ${(ares as any).camp} ${(ares as any).level}`,
              { duration: 2000 }
            );
          }
        }
        // Dernière quête du chapitre cochée à la main → on enchaîne sur le chapitre
        // suivant, exactement comme la case « tout le chapitre » : avant, l'utilisateur
        // restait bloqué sur un chapitre vide à 100 %.
        if (!was && allChecked) {
          notifyBlockDone(ms);
          goToNextMs();
        }
      } catch {
        setResourceChecks(resourceBefore);
        setCompletedStepsByMs(prevMap);
        setCompletedIds((prev) => {
          const n = new Set(prev);
          prevActive ? n.add(ms.id) : n.delete(ms.id);
          return n;
        });
        toast.error("Erreur de synchronisation");
      }
    },
    [completedStepsByMs, completedIds, bookmarksByMs, guildId, effectiveAltPseudo, getSeqGate, goToNextMs, resourceChecks, isGuest, persistGuestResourceChecks, notifyBlockDone, guildDungeons.refresh, canValidate]
  );

  // Réinitialise TOUTE la progression du guide (synchro serveur + dashboard),
  // et vide l'état local de l'overlay (blocs cochés, quêtes, repères).
  const handleResetGuide = useCallback(async () => {
    if (isGuest) {
      setCompletedIds(new Set());
      setCompletedStepsByMs(new Map());
      setBookmarksByMs(new Map());
      setResourceChecks(new Set());
      setDetailSeq(null);
      setCurrentMsIndex(0);
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem(`${storagePrefix}completed_ms`);
          localStorage.removeItem(`${storagePrefix}steps`);
          localStorage.removeItem(`${storagePrefix}bookmarks`);
          localStorage.removeItem(`${storagePrefix}resources`);
        } catch {}
      }
      toast.success("Guide réinitialisé.");
      return;
    }
    try {
      const res = await resetGuideProgress(guildId, guide.id, effectiveAltPseudo);
      if ((res as any)?.success) {
        setCompletedIds(new Set());
        setCompletedStepsByMs(new Map());
        setBookmarksByMs(new Map());
        setResourceChecks(new Set());
        setDetailSeq(null);
        // Force le recalcul de la progression globale (header) à 0.
        setCurrentMsIndex(0);
        toast.success("Guide réinitialisé.");
      } else {
        toast.error("Échec de la réinitialisation.");
      }
    } catch {
      toast.error("Erreur réseau lors de la réinitialisation.");
    }
  }, [guildId, guide.id, effectiveAltPseudo, isGuest, storagePrefix]);

  const handleBookmark = useCallback(
    async (ms: RushMilestone, seqId: string) => {
      const isAlready = bookmarksByMs.get(ms.id) === seqId;
      // Une quête validée ne peut pas porter de repère : soit validée, soit repère.
      // ⚠️ 11/11/2026 — le repère « j'en suis là » ne dépend PAS du verrou de validation :
      // un donjon requis non coché (ou un prérequis) empêche de **valider** la quête, pas
      // de dire où l'on en est. Le repère reste donc possible sur une carte verrouillée.
      if (!isAlready && completedStepsByMs.get(ms.id)?.has(seqId)) {
        toast.info("Cette quête est déjà validée.");
        return;
      }
      const prevMap = new Map(bookmarksByMs);
      setBookmarksByMs((prev) => {
        // Préserve les repères des AUTRES blocs (1 `bookmarksByMs` = Map<msId,seqId>).
        const n = new Map(prev);
        if (!isAlready) n.set(ms.id, seqId);
        else n.delete(ms.id);
        return n;
      });
      if (isGuest) {
        if (typeof window !== "undefined") {
          try {
            const nextBk = new Map(bookmarksByMs);
            if (!isAlready) nextBk.set(ms.id, seqId);
            else nextBk.delete(ms.id);
            localStorage.setItem(`${storagePrefix}bookmarks`, JSON.stringify(Object.fromEntries(nextBk)));
          } catch {}
        }
        toast.success(isAlready ? "Repère retiré" : "📍 Repère posé ici !", { duration: 1500 });
        return;
      }
      try {
        await setRushBookmark(guildId, ms.id, isAlready ? null : seqId, effectiveAltPseudo);
        toast.success(isAlready ? "Repère retiré" : "📍 Repère posé ici !", { duration: 1500 });
      } catch {
        setBookmarksByMs(prevMap);
        toast.error("Erreur repère");
      }
    },
    [bookmarksByMs, completedStepsByMs, guildId, effectiveAltPseudo, getSeqGate, isGuest, storagePrefix]
  );

  // Filtrage des quêtes du milestone courant
  const visibleSequences = useMemo(() => {
    if (!currentMs) return [];
    let seqs = currentMs.sequences;
    if (search.trim()) {
      const q = search.toLowerCase();
      seqs = seqs.filter(
        (s) =>
          s.subGuideName.toLowerCase().includes(q) ||
          (s.tips && s.tips.toLowerCase().includes(q)) ||
          (s.dungeon?.name && s.dungeon.name.toLowerCase().includes(q))
      );
    }
    if (hideCompleted) {
      seqs = seqs.filter((s) => !currentMsDoneSeqs.has(s.id));
    }
    if (questFilter !== "all") {
      // Les encarts info ne sont pas des quêtes : ils sortent des filtres « En cours »
      // et « Verrouillées ». L'ordre de `seqs` n'est jamais modifié (on filtre).
      seqs = seqs.filter((s) => {
        if (isInfoSequence(s)) return false;
        return matchesRushQuestFilter(
          { isDone: currentMsDoneSeqs.has(s.id), isLocked: getSeqGate(s).locked },
          questFilter
        );
      });
    }
    return seqs;
  }, [currentMs, search, hideCompleted, currentMsDoneSeqs, questFilter, getSeqGate]);

  // Séries d'alignement (« Ali 12 », « Rang 2 ») : dérivées du guide ENTIER, jamais du
  // nom stocké — les prérequis sont résolus par nom (`resolvePrereqTag`).
  const alignmentSeries = useMemo(() => buildAlignmentSeries(milestones), [milestones]);
  const alignmentGroups = useMemo(() => {
    // Meme regle que le dashboard : camp du joueur puis son Ordre ; jamais de bloc vide.
    const filtered = filterAlignmentSequences(
      visibleSequences,
      alignmentSeries,
      { camp: normalizeAlignmentCamp(selfAlignment), orderId: selfOrder },
      selfOrder
    );
    // Fail-closed : on ne regroupe (donc on ne réordonne) que si TOUTES les lignes
    // portent une série. Un encart info ou une quête commune garde sa place.
    if (!filtered.every((s) => alignmentSeries.has(s.id))) {
      return [{ key: "ordre-du-guide", camp: null, label: null, sequences: filtered }];
    }
    return groupByAlignmentSeries(filtered, alignmentSeries);
  }, [visibleSequences, alignmentSeries, selfAlignment, selfOrder]);

  // Quête « à faire maintenant » de la liste AFFICHÉE : une seule règle partagée
  // par le nœud accentué, « Reprendre » et l'arrêt du fil de sève.
  const nextSeqId = useMemo(
    () =>
      nextQuestId(
        visibleSequences
          .filter((s) => !isInfoSequence(s))
          .map((s) => ({
            id: s.id,
            isDone: currentMsDoneSeqs.has(s.id),
            isLocked: getSeqGate(s).locked,
          }))
      ),
    [visibleSequences, currentMsDoneSeqs, getSeqGate]
  );

  // ─── Fil de sève ────────────────────────────────────────────────────────────
  // Règle partagée : `useDaRail` mesure `--da-grow` (offsetTop + 26 de la première
  // quête ni validée ni verrouillée ; tout validé ⇒ clientHeight − 48).
  const railRef = useDaRail([
    visibleSequences,
    currentMs?.id,
    overlaySmall,
    overlayDensity,
  ]);

  // Recherche GLOBALE : matche sur TOUT le guide (tous chapitres), pas seulement
  // le milestone courant. Un clic sur un résultat bascule vers son chapitre.
  const globalResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const out: { ms: RushMilestone; seq: RushSequence }[] = [];
    for (const ms of milestones) {
      for (const seq of ms.sequences) {
        if (isInfoSequence(seq)) continue;
        const dungeons = (seq as any).dungeons as { name?: string }[] | undefined;
        const hit =
          (seq.subGuideName || "").toLowerCase().includes(q) ||
          (seq.tips || "").toLowerCase().includes(q) ||
          (seq.note || "").toLowerCase().includes(q) ||
          (seq.dungeon?.name || "").toLowerCase().includes(q) ||
          !!dungeons?.some((d) => (d.name || "").toLowerCase().includes(q));
        if (hit) out.push({ ms, seq });
      }
    }
    return out;
  }, [milestones, search]);

  const bookmarkSeqId = currentMs ? bookmarksByMs.get(currentMs.id) || null : null;
  // Étape courante : contexte exact pré-rempli dans le retour bug.
  const currentObjective = currentMs
    ? getNextObjective(currentMs.sequences, currentMsDoneSeqs, bookmarkSeqId, milestones, gateAllCompleted)
    : null;

  // ─── Thème de bloc de la DA « Gouache Wakfu » ─────────────────────────────
  // La règle vit dans `src/lib/rush-da-theme.ts` : le guide plein écran applique
  // la MÊME (parité public ↔ interne), donc plus de copie locale.
  const daTheme = useMemo(
    () => resolveRushDaTheme(milestones, currentMs?.id),
    [milestones, currentMs]
  );
  const daBlock = daTheme.block;

  // Thème exposé aux portails (popover de donjon, prérequis) : la MÊME vérité que
  // `data-theme`, une seule fois — plus aucun composant ne reçoit le thème en prop.
  const daThemeValue = useMemo(
    () => ({
      theme: "dark" as const,
      block: daBlock,
      accent: daTheme.accent,
    }),
    [daBlock, daTheme.accent]
  );

  // Compteurs des filtres — même source que la liste filtrée, même règle pure
  // (`countRushQuests`) : les encarts info ne sont pas des quêtes et ne comptent pas.
  const daCounts: RushQuestCounts = useMemo(
    () =>
      countRushQuests(
        currentMsSeqs
          .filter((s) => !isInfoSequence(s))
          .map((s) => ({ isDone: currentMsDoneSeqs.has(s.id), isLocked: getSeqGate(s).locked }))
      ),
    [currentMsSeqs, currentMsDoneSeqs, getSeqGate]
  );

  // Contexte exact de l'étape courante, pré-rempli dans le retour bug (overlay).
  const overlayBugContext = useMemo(() => {
    if (!currentMs) return undefined;
    const parts = [
      chapterPos.index > 0 ? `Chapitre ${chapterPos.index}/${chapterPos.total}` : "Bloc informatif",
      currentMs.title || "Jalon",
    ];
    const objective = currentObjective;
    if (objective) parts.push(`Étape : ${objective.subGuideName || objective.subGuideRef || "?"}`);
    return parts.join(" · ");
  }, [currentMs, chapterPos, currentObjective]);

  // ─── Rendu d'une BANNIÈRE (bloc non cochable) ──────────────────────────────
  // Le MÊME composant partagé que le dashboard et le guide public : un séparateur, un
  // encart CONSEIL/TIPS ou un « Dofus obtenu » se lit à sa place dans le flux, jamais comme
  // une étape (aucune case à cocher, aucun numéro, aucun « n/N »).
  const renderBanner = (ms: RushMilestone) => {
    if (ms.type === "SEPARATEUR") {
      return (
        <RushSeparatorBanner
          key={ms.id}
          title={ms.title}
          description={ms.description}
          imageUrl={ms.imageUrl}
          accentColor={ms.accentColor}
          className="my-3"
        />
      );
    }
    if (ms.type === "INFO") {
      const infoText = ms.tips || ms.description || ms.title || "";
      const infoTitle = ms.title && !infoText.startsWith(ms.title) ? ms.title : null;
      return (
        <RushInfoBanner
          key={ms.id}
          title={infoTitle}
          imageUrl={ms.imageUrl}
          accentColor={ms.accentColor}
          className="my-3"
          collapsible
          bodyText={infoText}
        >
          {/* Pavé DofusDex (13 blocs, 463–1 956 caractères) : replié par la règle
              partagée ; un conseil ordinaire garde `normalizeMeta` (positions, liens). */}
          {splitDofusDexTip(infoText).official ? (
            <RushDofusDexTip text={infoText} />
          ) : (
            <RushRichText text={infoText} normalizeMeta />
          )}
        </RushInfoBanner>
      );
    }
    if (isRushCombatBlock(ms.type)) {
      return (
        <RushCombatBanner
          key={ms.id}
          type={ms.type}
          title={ms.title}
          bodyText={ms.tips || ms.description || ms.title || ""}
          imageUrl={ms.imageUrl}
          links={ms.links}
          surface="pip"
          className="my-3"
        />
      );
    }
    // Bandeau PARTAGÉ (22/11/2026) : le titre du studio est le titre, le Dofus n'est
    // qu'un repère (œuf + couleur) et la carte est pleine largeur — la copie locale
    // empilait un `max-w-md` qui débordait sur une PiP étroite.
    return <DofusObtainedBanner key={ms.id} milestone={ms} surface="pip" className="my-3" />;
  };

  /**
   * Une ligne de la liste du chapitre : encart info/combat, ou carte de quête.
   * Extrait pour être rendu **une fois par variante** à l'intérieur de la carte
   * d'une étape à choix, sans dupliquer la logique (elle utilise le chapitre courant).
   */
  const renderOverlaySequence = (seq: RushSequence) => {
    if (!currentMs) return null;
    // Les séquences info (conseils/bandeaux) ne sont pas des quêtes cochables.
    if (isInfoSequence(seq)) {
      // Combat tactique / semi-tactique DANS le bloc : bandeau `pip` partagé,
      // rien à cocher — marqueur `activityTags` (22/11/2026).
      const combatSeq = rushCombatSequenceType(seq);
      if (combatSeq) {
        return (
          <RushCombatBanner
            type={combatSeq}
            title={seq.subGuideName}
            bodyText={seq.tips}
            surface="pip"
            className="my-2"
          />
        );
      }
      // Bandeau d'une séquence informative : composant PARTAGÉ (dashboard,
      // guide public, overlay) — rien à cocher, ce n'est pas une quête.
      return <RushInfoSequenceBanner seq={seq} accentColor={currentMs.accentColor} collapsible />;
    }
    const isSeqDone = currentMsDoneSeqs.has(seq.id);
    const gate = getSeqGate(seq);
    const isBookmarked = bookmarkSeqId === seq.id;
    return (
      <RushOverlayQuestListItem
        seq={seq}
        guildId={guildId}
        milestoneId={currentMs.id}
        dungeonActions={dungeonActions}
        onOpenAchievements={achievementHandler}
        isDone={isSeqDone}
        isNext={nextSeqId === seq.id}
        isBookmarked={isBookmarked}
        isLocked={gate.locked}
        prereqs={gate.prereqs}
        missingDungeons={gate.missingDungeons}
        guideQuests={guideQuests}
        guideMilestones={milestones}
        successValidation={successValidation}
        onGoToQuest={handleGoToDungeonStep}
        onGoToPrereq={handleGoToPrereq}
        onToggle={() => handleToggleSeq(currentMs, seq.id)}
        onBookmark={() => handleBookmark(currentMs, seq.id)}
        onOpenDetail={() => setDetailSeq({ ms: currentMs, seq })}
        bookmarkers={bookmarkersBySeq.get(seq.id) || []}
        onOpenBookmarkers={() => openSeqMembers(seq)}
        capturedOcreNames={capturedOcreNames}
        onOpenOcre={openOcre}
        alignmentLabel={alignmentSeries.get(seq.id)?.label ?? null}
        choiceGroups={gate.choiceGroups}
      />
    );
  };

  // ─── Rendu COMMUN ─────────────────────────────────────────────────────────
  // La fenêtre source et la fenêtre PiP (always-on-top) affichent le même
  // contenu. Seules les actions liées au cycle de vie de la fenêtre (fermer /
  // épingler / réduire) diffèrent selon le contexte.

  return (
    // `data-theme="dark"` reste le repli SSR / route directe ; la CSS bascule les
    // jetons en clair dès que `<html>` porte `.light` (mode blanc du guide).
    <DaThemeProvider value={daThemeValue}>
    <div
      ref={rootRef}
      data-da="wakfu"
      data-theme="dark"
      data-block={daBlock}
      /* La PiP est la surface « pip » : la compression verticale et les règles
         de fenêtre s'y accrochent sans dépendre de la qualité. */
      data-host="pip"
      data-pinned={pinned ? "true" : "false"}
      /* F7 (chantier 4) — la PiP flotte AU-DESSUS du jeu : `data-quality="low"` coupe le grain
         et les bords « rough » (règle `[data-quality="low"]` de `da-wakfu.css`, déjà écrite
         mais jamais appliquée ici). Le guide plein écran garde `high` : la gouache reste sa
         signature, la petite fenêtre reste nette. */
      data-quality="low"
      data-compact={overlayDensity === "tight"}
      className={`rush-overlay da-window da-grain relative flex flex-col h-screen overflow-hidden select-none transition-colors bg-background text-foreground`}
      style={{
        fontFamily: "var(--da-font-text)",
        ...(daTheme.accent ? ({ "--da-acc": daTheme.accent } as React.CSSProperties) : null),
      }}
    >
      <style>{`@media (prefers-reduced-motion: reduce){ *{transition:none!important; animation:none!important; } }`}</style>

      {/* DA « Grimoire Sylvestre » : un seul filet de reliure, jamais d'ombre ni de halo. */}
      <span aria-hidden="true" className="rush-carnet-frame pointer-events-none absolute inset-0 border border-border-strong/60" />

      {/* Navigateur sans Document PiP (ex. Opera GX) : la fenêtre n'est pas épinglée */}
      {/* Le bandeau « non épinglée » n'est plus affiché dans le guide Rush : il reste
          dans les overlays Raid/Boss. La fenêtre simple est signalée par `data-pinned`. */}

          {/* ══ HEADER FIXE ══ */}
          <RushOverlayHeader
            guideName={guide.name}
            guideSlug={guide.slug}
            guildId={guildId}
            dofusImageUrl={dofusImage}
            totalSteps={totalSteps}
            completedSteps={completedSteps}
            overallPct={overallPct}
            isNarrow={overlaySmall}
            density={overlayDensity}
            hideCompleted={hideCompleted}
            onToggleHideCompleted={toggleHideCompleted}
            onOpenTutorial={() => setShowTutorial(true)}
            onOpenFeedback={() => setFeedbackOpen(true)}
            character={overlayCharacter}
            onResetGuide={handleResetGuide}
            isGuest={isGuest}
            block={daBlock}
            ocre={ocreSummary}
            onOpenOcre={ocreEnabled ? () => setShowOcre(true) : undefined}
            onOpenMetamob={
              isGuest && feedbackSignedIn ? () => setMetamobOpen(true) : undefined
            }
            metamobVerified={metamobVerified}
            onOpenAlignment={!isGuest && guildId !== "public" ? () => setShowAlignment(true) : undefined}
            onOpenDungeons={openDungeonsOverview}
            dungeonsPending={Math.max(0, dungeonsCounter.total - dungeonsCounter.done)}
          />

          <RushDungeonsOverviewModal
            open={dungeonsOverviewOpen}
            onClose={() => setDungeonsOverviewOpen(false)}
            milestones={milestones}
            me={dungeonsOverviewMe}
            members={
              isPublicSurface
                ? feedbackSignedIn
                  ? dungeonsCommunity
                  : null
                : dungeonsCommunity
            }
            mode={isPublicSurface ? (feedbackSignedIn ? "visitor" : "guest") : "member"}
            variant="overlay"
            quality={overlayDensity === "tight" ? "low" : "high"}
            portalContainer={rootRef.current?.ownerDocument.body ?? null}
            onGoToStep={(seqId) => {
              setDungeonsOverviewOpen(false);
              handleGoToDungeonStep(seqId);
            }}
          />

          {/* ══ RECHERCHE ══ */}
          <RushOverlaySearch
            value={search}
            onChange={setSearch}
            onClear={() => setSearch("")}
            compact={overlayDensity === "tight"}
            ref={searchRef}
          />

          {/* ══ BARRE DE CHAPITRE (UNE seule) ══
              Le sélecteur déroulant, la barre « Chapitre n / N » et la barre du bloc courant
              empilaient trois blocs (~120 px) pour dire la même chose : une seule barre porte
              la case « tout le chapitre », le titre déroulant et l'avancement chiffré. */}
          <RushOverlayChapterBar
            chapters={milestones}
            activeMsId={currentMs?.id}
            onSelectChapter={selectChapter}
            completedMsIds={completedIds}
            doneByMs={completedStepsByMs}
            onToggleChapter={handleToggleMs}
            onResetChapter={handleResetMs}
            loading={!!currentMs && loadingIds.has(currentMs.id)}
          />

          {/* ══ RANGÉE D'ACTIONS ══
              Reprendre (saut à la prochaine quête à faire) + Ressources (la modale,
              qui n'a plus d'icône dans l'en-tête : un seul point d'entrée). */}
          <RushOverlayActions
            onResume={scrollToNextQuest}
            onOpenResources={() => setShowResources(true)}
            checked={resourcesChecked}
            total={chapterResources.length}
            compact={overlayDensity === "tight"}
          />

          {/* Filtre d'affichage — Toutes / En cours / Verrouillées. */}
          <RushOverlayQuestFilter
            value={questFilter}
            onChange={setQuestFilter}
            counts={daCounts}
            compact={overlayDensity === "tight"}
            hideCompleted={hideCompleted}
            onToggleHideCompleted={() => setHideCompleted((value) => !value)}
          />

          {/* F9 — le bandeau du bloc courant (image + titre + écriteau « N/M ») est
              retiré : le dock juste au-dessus porte déjà le titre du chapitre et son
              avancement, et la jauge du haut porte le total. La **description** reste :
              c'est la seule à dire ce que le chapitre regroupe. */}
          {currentMs?.description ? (
            <div className="px-3 pt-3">
              <div className="da-blockdesc">
                <RushRichText text={currentMs.description} />
              </div>
            </div>
          ) : null}



          {/* L'objectif courant (« À FAIRE MAINTENANT ») a été retiré : la liste des quêtes
              juste en dessous dit déjà quoi faire, avec sa coordonnée et ses donjons —
              un encart doré qui répète la première ligne ne servait à rien (user, 21/09). */}

          {/* ══ PRÉSENCE COMMUNAUTÉ ══ */}
          {chapterMembers.length > 0 && (
            <button
              type="button"
              onClick={() =>
                openChapterMembers(
                  chapterMembers.map((m) => ({
                    name: m.name,
                    avatar: m.avatar,
                    subtitle: m.stepId ? "a posé un repère ici" : undefined,
                  }))
                )
              }
              title="Voir les membres sur ce chapitre"
              className="px-3 pt-2 flex items-center gap-2 text-left"
            >
              <Users className="w-3 h-3 text-[#39bc95]" />
              <span className="text-[9px] font-bold uppercase tracking-wide text-[#6e7784]">
                Sur ce chapitre
              </span>
              <span className="flex items-center -space-x-1.5">
                {chapterMembers.slice(0, 6).map((m, i) => (
                  <MemberAvatar
                    key={i}
                    src={m.avatar}
                    name={m.name}
                    alt={m.name}
                    title={m.name}
                    className="w-5 h-5 rounded-full border border-[#39bc95]/40"
                    fallbackClassName="bg-[#39bc95]/20 text-[#39bc95] text-[8px] font-bold uppercase"
                  />
                ))}
              </span>
              {chapterMembers.length > 6 && (
                <span className="text-[9px] text-[#6e7784]">+{chapterMembers.length - 6}</span>
              )}
            </button>
          )}

          {/* ══ LISTE DES QUÊTES + DÉTAILS ══ */}
          <main ref={listRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pt-3 pb-2 space-y-2 overlay-scroll">
            {/* Porte de départ : la PiP peut s'ouvrir avant le choix du personnage ;
                elle reste lisible, mais les coches sont bloquées (même règle que la page). */}
            {!canValidate ? (
              <div className="rounded-[4px] border border-warning/40 bg-warning/10 px-2.5 py-2 text-[11px] leading-relaxed text-warning">
                Choisis ton personnage dans le guide pour cocher tes quêtes.{" "}
                <a
                  href={`/guides/${guide.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline underline-offset-2"
                >
                  Choisir
                </a>
              </div>
            ) : null}
            {/* Ce qui est masqué est DIT, et réouvrable d'un geste (la PiP étroite cache
                le bouton d'en-tête dans le menu « … »). */}
            {hideCompleted && currentMsDoneSeqs.size > 0 ? (
              <div className="flex items-center justify-between gap-2 rounded-[4px] border border-border bg-surface px-2.5 py-1.5 text-[11px]">
                <span className="min-w-0 truncate text-muted-foreground">
                  {currentMsDoneSeqs.size} étape{currentMsDoneSeqs.size > 1 ? "s" : ""} faite
                  {currentMsDoneSeqs.size > 1 ? "s" : ""} masquée{currentMsDoneSeqs.size > 1 ? "s" : ""}
                </span>
                <button
                  type="button"
                  onClick={() => setHideCompleted(false)}
                  className="shrink-0 rounded-[3px] border border-border px-2 py-0.5 font-semibold text-foreground transition-colors hover:bg-elevated"
                >
                  Afficher
                </button>
              </div>
            ) : null}
            {/* Bannières qui INTRODUISENT ce chapitre — leur place chronologique dans le
                flux. Elles suivent le chapitre, donc on les retrouve dès qu'on l'ouvre
                (dropdown, précédent/suivant, repère) : c'est ce qui manquait. */}
            {!search.trim() && banners.before.map(renderBanner)}
            {search.trim() ? (
              globalResults.length === 0 ? (
                <div className="py-12 text-center text-[#929aa5] text-xs">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-[#39bc95] opacity-40" />
                  <p className="font-bold font-serif text-sm text-[#f2f0e9]">Aucune quête ne correspond</p>
                  <p className="text-[11px] text-[#6e7784] mt-0.5">Essayez un autre mot-clé.</p>
                </div>
              ) : (
                globalResults.map(({ ms, seq }, i) => {
                  const showMsHeader = i === 0 || globalResults[i - 1].ms.id !== ms.id;
                  const isSeqDone = (completedStepsByMs.get(ms.id) || new Set<string>()).has(seq.id);
                  const gate = getSeqGate(seq);
                  return (
                    <React.Fragment key={seq.id}>
                      {showMsHeader && (
                        <div className="flex items-center gap-1.5 pt-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-gold">
                          <span className="w-1 h-1 rounded-full bg-[#d5a94e]" />
                          {ms.title || "Jalon"}
                        </div>
                      )}
                      <RushOverlayQuestListItem
                        seq={seq}
                        guildId={guildId}
                        milestoneId={ms.id}
                        dungeonActions={dungeonActions}
                        onOpenAchievements={achievementHandler}
                        isDone={isSeqDone}
                        isBookmarked={bookmarksByMs.get(ms.id) === seq.id}
                        isLocked={gate.locked}
                        prereqs={gate.prereqs}
                        missingDungeons={gate.missingDungeons}
                        guideQuests={guideQuests}
                        guideMilestones={milestones}
                        successValidation={successValidation}
                        onGoToQuest={handleGoToDungeonStep}
                        onGoToPrereq={handleGoToPrereq}
                        onToggle={() => handleToggleSeq(ms, seq.id)}
                        onBookmark={() => handleBookmark(ms, seq.id)}
                        onOpenDetail={() => setDetailSeq({ ms, seq })}
                        bookmarkers={bookmarkersBySeq.get(seq.id) || []}
                        onOpenBookmarkers={() => openSeqMembers(seq)}
                        capturedOcreNames={capturedOcreNames}
                        onOpenOcre={openOcre}
                        alignmentLabel={alignmentSeries.get(seq.id)?.label ?? null}
                        choiceGroups={gate.choiceGroups}
                      />
                    </React.Fragment>
                  );
                })
              )
            ) : visibleSequences.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-success opacity-40" />
                <p className="font-serif text-sm font-semibold text-foreground">
                  {search.trim()
                    ? "Aucune quête ne correspond"
                    : questFilter === "active"
                      ? "Aucune quête à faire ici"
                      : questFilter === "locked"
                        ? "Aucune quête verrouillée ici"
                        : "Toutes les quêtes sont terminées !"}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {search.trim()
                    ? "Essayez un autre mot-clé."
                    : questFilter !== "all"
                      ? "Changez de filtre pour voir les autres quêtes."
                      : "Passez au chapitre suivant avec le bouton Suivant."}
                </p>
                {hideCompleted && currentMsDoneSeqs.size > 0 ? (
                  <button
                    type="button"
                    onClick={() => setHideCompleted(false)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-[4px] border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-elevated"
                  >
                    Afficher les étapes faites
                  </button>
                ) : null}
              </div>
            ) : currentMs ? (
              <div className="da-rail" ref={railRef}>
                <div>
                  {alignmentGroups.map((group) => (
                    <React.Fragment key={group.key}>
                      {alignmentGroups.length > 1 && group.label && (
                        <div className="flex items-center gap-1.5 px-0.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          <span className="h-1 w-1 rounded-full bg-accent" aria-hidden="true" />
                          {group.label}
                        </div>
                      )}
                      {collapseChoiceGroups(group.sequences).map((item) =>
                        item.kind === "choice" ? (
                          <RushChoiceGroupCard
                            key={`choice:${item.group}`}
                            group={item.group}
                            label={item.label}
                            note={item.note}
                            count={item.sequences.length}
                          >
                            {item.sequences.map((seq) => (
                              <React.Fragment key={seq.id}>{renderOverlaySequence(seq)}</React.Fragment>
                            ))}
                          </RushChoiceGroupCard>
                        ) : (
                          <React.Fragment key={item.seq.id}>{renderOverlaySequence(item.seq)}</React.Fragment>
                        )
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Bannières de fin de guide : rattachées au dernier chapitre (même règle) */}
            {!search.trim() && banners.after.map(renderBanner)}
          </main>

          {/* ══ FOOTER FIXE ══ */}
          <RushOverlayFooter
            onPrev={goToPrevMs}
            onNext={goToNextMs}
            canPrev={currentMsIndex > 0}
            canNext={currentMsIndex < milestones.length - 1}
            label={chapterPos.index > 0 ? `${chapterPos.index} / ${chapterPos.total}` : ""}
          />

      {/* ══ MODALE RESSOURCES GLOBALES (toutes étapes) ══ */}
      {showResources && (
        <RushOverlayResourcesModal
          resources={remainingResources}
          allResources={chapterResources}
          totalCount={chapterResources.length}
          hideProvidedResources={hideCompleted}
          checkedKeys={resourceChecks}
          onToggleCheck={handleToggleResourceCheck}
          onClose={() => setShowResources(false)}
        />
      )}

      {/* ══ TOAST « un coéquipier a validé » (3 s) ══
          Rendu DANS l'overlay, pas par `toast()` de Sonner : Sonner monte ses toasts sur le
          document PRINCIPAL, donc derrière le jeu quand l'overlay vit dans une fenêtre PiP. */}
      <RushOverlayLiveToast events={guideLive.events} />

      {/* ══ MODALE MEMBRES (sur ce chapitre / je suis ici) ══ */}
      {membersModal && (
        <RushOverlayMembersModal
          title={membersModal.title}
          members={membersModal.members}
          liveMembers={liveMembers}
          onClose={() => setMembersModal(null)}
        />
      )}

      {/* ══ MODALE DÉTAILS DE QUÊTE ══ */}
      {detailSeq && (
        <RushOverlayQuestDetailModal
          milestone={detailSeq.ms}
          seq={detailSeq.seq}
          isDone={(completedStepsByMs.get(detailSeq.ms.id) || new Set<string>()).has(detailSeq.seq.id)}
          guildId={guildId}
          hideProvidedResources={hideCompleted}
          checkedKeys={resourceChecks}
          onToggleResourceCheck={handleToggleResourceCheck}
          capturedOcreNames={capturedOcreNames}
          onOpenOcre={openOcre}
          dungeonStates={dungeonActions?.states}
          dungeonBusyKey={dungeonActions?.busyKey}
          dungeonOthers={dungeonActions?.others}
          onSetDungeon={dungeonActions?.onSet}
          onOpenAchievements={
            achievementHandler
              ? (key, dungeon) => achievementHandler(detailSeq.seq.id, key, dungeon)
              : undefined
          }
          viewer={isGuest ? "visitor" : "member"}
          guideQuests={guideQuests}
          guideMilestones={milestones}
          successValidation={successValidation}
          onGoToQuest={handleGoToDungeonStep}
          onClose={() => setDetailSeq(null)}
        />
      )}

      {/* ══ MINI-MODALE SUCCÈS D'UN DONJON (Bloc I) ══ */}
      {achievementTarget && activeAchievementLoader ? (
        <RushOverlayDungeonAchievementsModal
          dungeon={achievementTarget.dungeon}
          dungeonKey={achievementTarget.dungeonKey}
          dungeonState={occurrenceState(
            dungeonActions?.states ?? {},
            achievementTarget.sequenceId,
            achievementTarget.dungeonKey
          )}
          onSetDungeon={
            dungeonActions
              ? (state) =>
                  dungeonActions.onSet(
                    achievementTarget.sequenceId,
                    achievementTarget.dungeonKey,
                    state
                  )
              : undefined
          }
          mode={achievementMode}
          loadPanel={activeAchievementLoader}
          toggle={achievementMode === "guest" ? undefined : activeAchievementToggler}
          guestPseudo={dungeonAchievementGuestPseudo}
          characterSlot={achievementMode === "member" ? effectiveAltPseudo : undefined}
          onClose={() => setAchievementTarget(null)}
        />
      ) : null}

      {/* ══ MODALE TUTORIEL ══ */}
      {showTutorial && (
        <RushOverlayTutorialModal onClose={() => setShowTutorial(false)} />
      )}

      {/* ══ PANNEAU QUÊTE OCRE (Metamob · overlay interne) ══ */}
      {showOcre && ocreEnabled && (
        <RushOverlayOcreModal
          guildId={guildId}
          initial={ocre}
          state={ocreState}
          onClose={() => setShowOcre(false)}
        />
      )}

      {/* ══ MODALE ALIGNEMENT (vue guilde + mon choix) ══ */}
      {showAlignment && (
        <RushOverlayAlignmentModal
          guildId={guildId}
          members={alignmentMembers}
          selfAlignment={alignmentMembers.find((m) => m.isSelf)?.alignment ?? selfAlignment}
          selfOrder={alignmentMembers.find((m) => m.isSelf)?.alignmentOrder ?? selfOrder}
          mulePseudo={!character?.isMain ? character?.pseudo ?? null : null}
          onClose={() => setShowAlignment(false)}
        />
      )}
      {/* ══ PANNEAU « SIGNALER UN BUG » (F11) ══
          Monté ICI, en fin de racine : dans l'en-tête il était enfermé par `.da-hero`
          (`position: relative; overflow: hidden`) et passait sous le contenu, quel que
          soit son `z-index`. Ici il est le dernier enfant de la racine `data-theme` —
          donc au-dessus, dans le bon document (PiP comprise), avec les bons jetons. */}
      {feedbackOpen && (
        <RushOverlayFeedbackPanel
          guildId={guildId}
          sourcePage={`guide:overlay:${guide.slug}`}
          targetSlug={guide.slug}
          context={overlayBugContext}
          onlyDiscord={isGuest && !feedbackSignedIn}
          visitorMode={isGuest && feedbackSignedIn}
          onClose={() => setFeedbackOpen(false)}
        />
      )}
      {/* Metamob de la surface publique connectée — monté au MÊME endroit que le panneau de
          retour, pour la même raison : dernier enfant de la racine `data-theme`, donc dans le
          bon document (PiP comprise) et avec les jetons de la DA. */}
      <PublicMetamobModal
        open={metamobOpen}
        onClose={() => setMetamobOpen(false)}
        metamobPseudo={metamobPseudo ?? null}
        verified={metamobVerified}
        portalContainer={rootRef.current?.ownerDocument.body ?? null}
      />
    </div>
      {/* Toaster de l'overlay : monté SOUS la portée `data-da` pour hériter des
          jetons (Sonner le positionne en `fixed`, mais ses variables viennent de
          l'arbre : hors de cette portée, il retombait sur un noir en dur). */}
      <div
        data-da="wakfu"
        data-theme="dark"
        data-block={daBlock}
        className="contents"
      >
        <OverlayToaster />
      </div>
    </DaThemeProvider>
  );
}


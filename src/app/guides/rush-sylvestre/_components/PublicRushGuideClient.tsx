"use client";

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  ChevronUp,
  Check,
  Users,
  ArrowRight,
  Search,
  X,
  Target,
  MapPin,
  CheckCircle2,
  BookmarkCheck,
  Flag,
  Info,
  Lightbulb,
  Layers,
  HelpCircle,
  Copy,
  CheckCheck,
  UserRound,
  Server,
  Eraser,
  Lock,
  ClipboardList,
  RotateCcw,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n/client";
import type { RushMilestone, RushSequence, RushDungeonRef } from "@/types/rush-guide-types";
import { getAlignment, getClass } from "@/lib/dofus-assets";
import { getDofusServerImage } from "@/lib/dofus-assets";
import { DOFUS_UNITY_SERVERS } from "@/lib/presentation-constants";
import {
  type GuestCharacter,
  hasGuestCharacter,
  readGuestCharacter,
  writeGuestCharacter,
  readGuestProgress,
  adoptAnonymousGuestProgress,
  guestProgressPrefix,
  guestCharacterSlot,
} from "@/lib/guest-progress";
// Coches de DONJONS du visiteur : même contrat LOCAL que le reste de sa progression
// (préfixe par personnage), clé par OCCURRENCE (`sequenceId::dungeonKey`). Aucune
// donnée de guilde, aucun serveur : le verrou est appliqué dans les écritures.
import {
  clearDungeonStates,
  readDungeonStates,
  writeDungeonState,
  type LocalDungeonStates,
} from "@/lib/rush-dungeon-storage";
import {
  dungeonOccurrenceKey,
  doneDungeonKeysForSequence,
  resolveSequenceDungeons,
  sequenceDungeonProgress,
  type RushDungeonState,
} from "@/lib/rush-dungeons";
import { RushQuestDungeonsPanel } from "@/components/dofus-quests/rush/RushQuestDungeonsPanel";
import { resolveRushRoute } from "@/lib/rush-route";
import { PublicCommunityPanel } from "./PublicCommunityPanel";
import { applyQuestResourceChecks, resourceKeysForTags } from "@/lib/rush-resource-checks";
import { PUBLIC_SLOT_PRINCIPAL } from "@/lib/public-rush-progress";
import { metamobState, type PublicGuideVisitor } from "@/lib/public-guide-visitor";
import {
  adoptMyRushProgress,
  loadMyRushProgress,
  resetMyRushProgress,
  saveMyRushProgress,
} from "@/app/guides/rush-sylvestre/_actions/rush-progress";
import { RushCoordinateChip } from "@/components/dofus-quests/rush/RushCoordinateChip";
import { NpcBadge } from "@/components/dofus-quests/rush/NpcBadge";
import { brandIconForUrl } from "@/lib/source-icons";
import { QuestItemResourceGrid } from "@/components/dofus-quests/rush/QuestItemResourceGrid";
import { RushSeparatorBanner } from "@/components/dofus-quests/rush/RushSeparatorBanner";
import { RushInfoBanner } from "@/components/dofus-quests/rush/RushInfoBanner";
import { RushRichText } from "@/components/dofus-quests/rush/RushRichText";
import { RushInfoSequenceBanner } from "@/components/dofus-quests/rush/RushInfoSequenceBanner";
// Pense-bête : MÊME modale que le guide interne, alimentée par la config GOD
// (`rushUIConfig.penseBete`) avec repli sur le contenu statique du module.
import { RushPenseBeteModal } from "@/components/dofus-quests/rush/RushPenseBeteModal";
import { resolveRushUIConfig } from "@/lib/rush-ui-config";
import {
  openPipWindow,
  openFallbackPopup,
  preparePipDocument,
  isDocumentPipSupported,
} from "@/hooks/use-guide-pip";
import GuideOverlayClient from "@/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient";
import { useGuideProgressSync } from "@/hooks/use-guide-sync";
import {
  aggregateRushResources,
  getSequenceCoord,
} from "@/app/overlay/guide/[guildId]/[slug]/components/overlay-utils";
import { isInfoSequence, isSequenceBlockedByPrereqs, getPrereqRefs, resolveRushSeqIcon, getSequenceNpc, isZaapCopyEnabled, getSequenceManualZaap, RUSH_RESOURCES_PICTO, RUSH_ACTIVITY_TAG_CONFIG, deselectSequenceFromProgress, getAlignmentSet } from "@/lib/rush-guide-utils";
// Panneau de droite — le MÊME composant que le guide interne (chapitres, progression,
// donjons & métiers à prévoir, objets requis + bascule Restantes/Toutes).
import { RushChapterSidebar } from "@/components/dofus-quests/rush/RushChapterSidebar";
// Sommaire au langage du dock — composant PARTAGÉ (public en E2, interne en E4).
import { RushChapterNav } from "@/components/dofus-quests/rush/RushChapterNav";
import { resolveRushDaTheme } from "@/lib/rush-da-theme";
import { DaRail } from "@/components/da/da-rail";
import { DaThemeProvider } from "@/components/da/da-theme";
import { daScopeProps } from "@/lib/da-scope";
import { RushOverlayResourcesModal } from "@/app/overlay/guide/[guildId]/[slug]/components/RushOverlayResourcesModal";
import { RushOverlayQuestDetailModal } from "@/app/overlay/guide/[guildId]/[slug]/components/RushOverlayQuestDetailModal";
import { resolveDofusLocalImage } from "@/lib/dofus-image-url";
import { buildRushGuideView } from "@/lib/rush-guide-view";
import { alignmentCrest } from "@/lib/rush-guide-view";
// Modale « Mon personnage » (pictos de classe, vignettes de serveur, pseudo validé
// par la règle partagée du profil) — le choix n'est plus un panneau replié.
import { GuestCharacterModal } from "@/components/dofus-quests/rush/GuestCharacterModal";
import { CharacterSwitchModal } from "@/components/dofus-quests/rush/CharacterSwitchModal";
import { PublicMetamobModal } from "@/components/dofus-quests/rush/PublicMetamobModal";
import { PublicAlignmentModal } from "./PublicAlignmentModal";
import { PublicOnboardingModal, type OnboardingStep } from "./PublicOnboardingModal";
// ─── Structuration en Blocs de Quêtes ─────────────────────────────────────────

interface QuestBlock {
  questName: string;
  questRef: string;
  sequences: RushSequence[];
  dofusdbUrl?: string | null;
  dofuspourlesnoobsUrl?: string | null;
  dungeons: RushDungeonRef[];
  isDone: boolean;
  doneCount: number;
  totalCount: number;
}

function groupSequencesIntoQuests(
  sequences: RushSequence[],
  doneSteps: Set<string>
): QuestBlock[] {
  const blocks: QuestBlock[] = [];
  let currentBlock: QuestBlock | null = null;
  // Les séquences info sont des ENCARTS, pas des quêtes : elles gardent leur place dans le
  // flux (ordre du guide) et ne comptent JAMAIS dans la progression d'un bloc. Une info en
  // tête de bloc est collée au bloc qui la suit (même règle que les bannières du dashboard) ;
  // une info de fin reste dans le dernier bloc.
  let pendingInfo: RushSequence[] = [];

  for (const seq of sequences) {
    if (isInfoSequence(seq)) {
      if (currentBlock) currentBlock.sequences.push(seq);
      else pendingInfo.push(seq);
      continue;
    }
    const qName = seq.subGuideName || seq.subGuideRef || "Étape";
    const qRef = seq.subGuideRef || qName;

    if (!currentBlock || currentBlock.questRef !== qRef) {
      currentBlock = {
        questName: qName,
        questRef: qRef,
        sequences: [...pendingInfo, seq],
        dofusdbUrl: seq.dofusdbUrl || null,
        dofuspourlesnoobsUrl: seq.dofuspourlesnoobsUrl || null,
        dungeons: [],
        isDone: false,
        doneCount: 0,
        totalCount: 0,
      };
      pendingInfo = [];
      blocks.push(currentBlock);
    } else {
      currentBlock.sequences.push(seq);
      if (!currentBlock.dofusdbUrl && seq.dofusdbUrl) currentBlock.dofusdbUrl = seq.dofusdbUrl;
      if (!currentBlock.dofuspourlesnoobsUrl && seq.dofuspourlesnoobsUrl) {
        currentBlock.dofuspourlesnoobsUrl = seq.dofuspourlesnoobsUrl;
      }
    }

    const djs = seq.dungeons && seq.dungeons.length > 0 ? seq.dungeons : seq.dungeon ? [seq.dungeon] : [];
    for (const dj of djs) {
      if (!currentBlock.dungeons.some((d) => d.id === dj.id)) {
        currentBlock.dungeons.push(dj);
      }
    }
  }

  // Milestone fait uniquement d'encarts info : ils sont portés par un bloc sans étape
  // (aucun en-tête de quête n'est rendu pour lui — voir le rendu).
  if (pendingInfo.length) {
    blocks.push({
      questName: "",
      questRef: "",
      sequences: pendingInfo,
      dofusdbUrl: null,
      dofuspourlesnoobsUrl: null,
      dungeons: [],
      isDone: false,
      doneCount: 0,
      totalCount: 0,
    });
  }

  for (const b of blocks) {
    const steps = b.sequences.filter((s) => !isInfoSequence(s));
    b.totalCount = steps.length;
    b.doneCount = steps.filter((s) => doneSteps.has(s.id)).length;
    b.isDone = b.totalCount > 0 && b.doneCount === b.totalCount;
  }

  return blocks;
}
// ─── Composant Principal ──────────────────────────────────────────────────────

interface PublicRushGuideClientProps {
  guide: {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    imageUrl?: string | null;
    /** Config UI/UX poussée depuis le GOD (pense-bête éditable) — même source que l'interne. */
    rushUIConfig?: unknown;
  };
  milestones: RushMilestone[];
  /**
   * V1d — session visiteur présente ? Non connecté ⇒ le guide reste **100 % local**
   * (aucun appel réseau), exactement comme avant.
   */
  isConnected?: boolean;
  /**
   * V2a — identité du visiteur connecté (5 scalaires, DTO étanche). `null` pour un anonyme :
   * aucun bandeau, aucune requête, le guide reste exactement ce qu'il était.
   */
  visitor?: PublicGuideVisitor | null;
}

// ─── Personnage invité (facultatif) ──────────────────────────────────────────

/**
 * Les trois cités du guide public (V2a-5). Le choix est **purement local** : il ne
 * conditionne que la route affichée (`resolveRushRoute`), aucune donnée de guilde.
 * Il vivait dans un bandeau de trois boutons au-dessus des tuiles — demande user du
 * 07/11/2026 : « le bandeau avec les trois alignements doit disparaître ». Il vit
 * désormais dans « Options », en sous-menu radio (clavier + `aria-checked` gérés).
 */
const ROUTE_CAMPS: Array<{ value: "bontarien" | "brakmarien" | null; label: string; icon: string }> = [
  { value: "bontarien", label: "Bontarien", icon: "/ordres/bonta.png" },
  { value: null, label: "Neutre", icon: "/ordres/neutre.png" },
  { value: "brakmarien", label: "Brâkmarien", icon: "/ordres/brakmar.png" },
];

/** Nom officiel d'un serveur à partir de son identifiant (null si inconnu). */
function guestServerLabel(serverId: number | null | undefined): string | null {
  if (!serverId) return null;
  for (const list of Object.values(DOFUS_UNITY_SERVERS)) {
    const hit = (list as readonly { name: string; id: number }[]).find((s) => s.id === serverId);
    if (hit) return hit.name;
  }
  return null;
}

/**
 * Remise à zéro de la progression locale : une action DESTRUCTIVE, donc en deux
 * temps (jamais d'aller simple). Le premier clic demande, le second efface —
 * c'est le panneau de progression qui la porte depuis que le bloc d'en-tête a été
 * supprimé (demande user).
 */
function ResetProgressButton({
  onReset,
  label,
  confirmLabel,
  yesLabel,
  cancelLabel,
}: {
  onReset: () => void;
  label: string;
  confirmLabel: string;
  yesLabel: string;
  cancelLabel: string;
}) {
  const [confirming, setConfirming] = React.useState(false);
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1.5 rounded-[3px] border border-border px-2.5 py-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </button>
    );
  }
  return (
    <span className="flex flex-wrap items-center justify-end gap-2">
      <span className="text-[11px] text-muted-foreground">{confirmLabel}</span>
      <button
        type="button"
        onClick={() => {
          setConfirming(false);
          onReset();
        }}
        className="rounded-[3px] border border-danger/40 px-2.5 py-2 text-[11px] font-semibold text-danger transition-colors hover:bg-danger/10 cursor-pointer"
      >
        {yesLabel}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-[3px] border border-border px-2.5 py-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
      >
        {cancelLabel}
      </button>
    </span>
  );
}

/** Drapeau local de l accueil de premiere arrivee (V2a-4) : une seule fois par navigateur. */
const ONBOARDING_FLAG = "sigilos:rush-public-onboarded";

export function PublicRushGuideClient({ guide, milestones: rawMilestones, isConnected = false, visitor = null }: PublicRushGuideClientProps) {
  const { t, locale } = useI18n();
  // ── Progression locale PAR PERSONNAGE ───────────────────────────────────────
  // Le visiteur peut déclarer son personnage (classe + pseudo + serveur — les trois
  // facultatifs) : chaque personnage garde SES étapes cochées et SON repère. Sans
  // personnage déclaré, les clés restent celles d'origine (`sigil_guest_<slug>_…`) :
  // aucun visiteur déjà en cours de rush ne perd sa progression.
  const [character, setCharacter] = useState<GuestCharacter | null>(() => readGuestCharacter(guide.slug));
  const storagePrefix = guestProgressPrefix(guide.slug, character);

  // ── Route d'alignement (lot 5) ──────────────────────────────────────────────
  // Guide PUBLIC et non connecté : le choix est purement LOCAL. Aucune donnée de
  // guilde n'est lue ni affichée (pas de liste de membres, pas de progression d'autrui).
  // Le filtre s'applique AVANT la vue, les prérequis et l'agrégation des ressources.
  const routeStorageKey = `sigilos_rush_route_${guide.slug}`;
  /** Ordre du choix LOCAL : le camp pilote la route, l'Ordre est ce qu'affiche la modale. */
  const routeOrderKey = `sigilos_rush_route_order_${guide.slug}`;
  const [routeCamp, setRouteCamp] = useState<"bontarien" | "brakmarien" | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem(routeStorageKey);
      return stored === "bontarien" || stored === "brakmarien" ? stored : null;
    } catch {
      return null;
    }
  });
  const [routeOrder, setRouteOrder] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(routeOrderKey);
    } catch {
      return null;
    }
  });
  const handleRouteChange = useCallback(
    (value: "bontarien" | "brakmarien" | null) => {
      setRouteCamp(value);
      if (typeof window === "undefined") return;
      try {
        if (value) localStorage.setItem(routeStorageKey, value);
        else localStorage.removeItem(routeStorageKey);
      } catch {
        /* stockage indisponible : le choix reste valable pour la session */
      }
    },
    [routeStorageKey]
  );
  /**
   * V2a-4 — alignement **local** du visiteur non connecté : le même geste que pour un
   * compte (cité → Ordre), sans aucune écriture serveur. La cité met à jour la route
   * (`resolveRushRoute`), l'Ordre est conservé pour la modale et l'affichage.
   */
  const handleLocalAlignment = useCallback(
    (value: { alignment: "bontarien" | "brakmarien" | "neutre"; alignmentOrder: string | null }) => {
      handleRouteChange(value.alignment === "neutre" ? null : value.alignment);
      const order = value.alignment === "neutre" ? null : value.alignmentOrder;
      setRouteOrder(order);
      if (typeof window === "undefined") return;
      try {
        if (order) localStorage.setItem(routeOrderKey, order);
        else localStorage.removeItem(routeOrderKey);
      } catch {
        /* stockage indisponible : le choix reste valable pour la session */
      }
    },
    [handleRouteChange, routeOrderKey]
  );
  const milestones = useMemo(
    () => resolveRushRoute(rawMilestones, { camp: routeCamp }),
    [rawMilestones, routeCamp]
  );

  // ── Coches MANUELLES de ressources (« déjà préparé ») ────────────────────────
  // Persistées LOCALEMENT (aucun compte requis), par personnage — même clé que le
  // reste de la progression visiteur. Côté guilde, la même coche vit en base.
  const [resourceChecks, setResourceChecks] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set<string>();
    try {
      const raw = localStorage.getItem(`${storagePrefix}resources`);
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch {}
    return new Set<string>();
  });
  const handleToggleResourceCheck = useCallback(
    (key: string) => {
      setResourceChecks((prev) => {
        const next = new Set(prev);
        next.has(key) ? next.delete(key) : next.add(key);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(`${storagePrefix}resources`, JSON.stringify([...next]));
          } catch {}
        }
        return next;
      });
    },
    [storagePrefix]
  );

  // Applique validation/dévalidation d'une quête aux coches, puis persiste localement.
  const applyResourceChecksForQuest = useCallback(
    (tags: { type?: string; name?: string; id?: string }[] | null | undefined, checked: boolean) => {
      setResourceChecks((prev) => {
        const next = applyQuestResourceChecks(prev, tags, checked);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(`${storagePrefix}resources`, JSON.stringify([...next]));
          } catch {}
        }
        return next;
      });
    },
    [storagePrefix]
  );

  // ── Pense-bête (mêmes sections que le guide interne) ─────────────────────────
  const [penseBeteOpen, setPenseBeteOpen] = useState(false);
  const penseBeteSections = useMemo(
    () => resolveRushUIConfig(guide.rushUIConfig)?.penseBete,
    [guide.rushUIConfig]
  );
  // Modale « Mon personnage » : elle porte son propre brouillon jusqu'à validation.
  const [characterOpen, setCharacterOpen] = useState(false);
  /** Bascule de personnage (compte connecté) — distincte du formulaire de l'anonyme. */
  const [switchOpen, setSwitchOpen] = useState(false);
  /** Metamob — la modale s'ouvre **ici**, sans passer par l'espace visiteur. */
  const [metamobOpen, setMetamobOpen] = useState(false);
  /** V2a-4 — modale « Mon alignement » (cité + Ordre, écrits sur le profil visiteur). */
  const [alignmentOpen, setAlignmentOpen] = useState(false);

  /* V2a-4 — accueil de première arrivée (trois étapes, une seule fois par navigateur).
     Il ENCHAÎNE les deux sélecteurs existants : aucun second formulaire à maintenir. */
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep | null>(null);
  const [onboardingFlow, setOnboardingFlow] = useState<"character" | "alignment" | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem(ONBOARDING_FLAG)) return;
    } catch {
      return; // stockage indisponible : pas d accueil, jamais un blocage
    }
    const timer = setTimeout(() => setOnboardingStep(1), 600);
    return () => clearTimeout(timer);
  }, []);

  const finishOnboarding = () => {
    try {
      window.localStorage.setItem(ONBOARDING_FLAG, "1");
    } catch {
      /* le drapeau est un confort : son absence ne bloque jamais la lecture */
    }
    setOnboardingStep(null);
    setOnboardingFlow(null);
  };

  const closeCharacterModal = () => {
    setCharacterOpen(false);
    if (onboardingFlow === "character") {
      setOnboardingFlow(null);
      setOnboardingStep(2);
    }
  };

  const closeAlignmentModal = () => {
    setAlignmentOpen(false);
    if (onboardingFlow === "alignment") {
      setOnboardingFlow(null);
      setOnboardingStep(3);
    }
  };

  // Overlay Floating Window state
  const [pipWin, setPipWin] = useState<Window | null>(null);
  // Faux si la fenêtre est la popup de secours (navigateur sans Document PiP,
  // ex. Opera GX) → bandeau "fenêtre non épinglée" dans l'overlay.
  const [pipPinned, setPipPinned] = useState(true);

  // Modale de détail d'étape (comme le bouton (i) du guide interne)
  const [detailModalSeq, setDetailModalSeq] = useState<{
    milestone: RushMilestone;
    sequence: RushSequence;
  } | null>(null);

  // État des accordéons de ressources par étape
  const [expandedResourceSteps, setExpandedResourceSteps] = useState<Set<string>>(new Set());
  // État des accordéons conseils & notes par étape (comme le guide interne)
  const [expandedHintsSteps, setExpandedHintsSteps] = useState<Set<string>>(new Set());

  // Navigation flottante haut / position / bas (comme le guide interne)
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      const maxY = document.documentElement.scrollHeight - window.innerHeight;
      setShowScrollTop(y > 300);
      setShowScrollBottom(y < maxY - 300);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, []);

  const scrollToBottom = useCallback(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight, left: 0, behavior: "smooth" });
  }, []);

  // Chapitre affiché (pagination : une vue = un chapitre). Déclaré tôt, parce que les
  // helpers de scroll doivent pouvoir OUVRIR le chapitre d'une étape ciblée avant de
  // chercher son nœud (sinon il n'est pas dans le DOM en mode paginé).
  const [pageChapterId, setPageChapterId] = useState<string | null>(null);
  const seqToChapterId = useMemo(() => {
    const m = new Map<string, string>();
    for (const ms of milestones) for (const s of ms.sequences || []) m.set(s.id, ms.id);
    return m;
  }, [milestones]);

  const scrollToStep = useCallback((seqId: string) => {
    const targetMsId = seqToChapterId.get(seqId);
    if (targetMsId) setPageChapterId(targetMsId);
    let attempts = 0;
    const maxAttempts = 10;
    const tryScroll = () => {
      const el = document.querySelector(`[data-seq-id="${seqId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-success", "ring-offset-2", "ring-offset-background");
        setTimeout(() => {
          el.classList.remove("ring-2", "ring-success", "ring-offset-2", "ring-offset-background");
        }, 3500);
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(tryScroll, 200 + attempts * 100);
      }
    };
    setTimeout(tryScroll, 100);
  }, [seqToChapterId]);

  // Completed steps & milestones (Local-First localStorage)
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(`${storagePrefix}completed_ms`);
        if (raw) return new Set(JSON.parse(raw));
      } catch {}
    }
    return new Set<string>();
  });

  const [completedStepsByMs, setCompletedStepsByMs] = useState<Map<string, Set<string>>>(() => {
    if (typeof window !== "undefined") {
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
    return new Map<string, Set<string>>();
  });

  const [bookmarksByMs, setBookmarksByMs] = useState<Map<string, string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(`${storagePrefix}bookmarks`);
        if (raw) {
          const parsed = JSON.parse(raw);
          return new Map(Object.entries(parsed));
        }
      } catch {}
    }
    return new Map<string, string>();
  });

  // ── Donjons : coches LOCALES (sans compte, sans base) ─────────────────────────
  // La fenêtre est la MÊME coquille que l'overlay et le dashboard ; seule la
  // persistance change (ici : `localStorage`, emplacement du personnage déclaré).
  const [dungeonStates, setDungeonStates] = useState<LocalDungeonStates>(() =>
    readDungeonStates(storagePrefix)
  );
  // Quelle quête a SON panneau donjon ouvert (`null` = aucun). Aucune fenêtre globale.
  const [openDungeonPanel, setOpenDungeonPanel] = useState<string | null>(null);
  // Changement de personnage (ou adoption d'une progression anonyme) = changement
  // d'emplacement : on relit SES coches de donjons, comme ses étapes cochées.
  useEffect(() => {
    setDungeonStates(readDungeonStates(storagePrefix));
  }, [storagePrefix]);

  // ─── Progression EN BASE (V1d) — connectés seulement ────────────────────────
  // Le navigateur reste la **source** (D1) ; la base est un **miroir**, pour que la suite
  // (V2a : « qui a coché quoi ») puisse la lire. Non connecté ⇒ aucun appel réseau.
  const characterSlot = guestCharacterSlot(character) ?? PUBLIC_SLOT_PRINCIPAL;

  const buildProgressSnapshot = useCallback(
    () => ({
      characterSlot,
      characterName: character?.pseudo ?? null,
      classe: character?.classId ?? null,
      completedMilestones: Array.from(completedIds),
      completedSteps: Object.fromEntries(
        Array.from(completedStepsByMs, ([msId, steps]) => [msId, Array.from(steps)])
      ),
      bookmarks: Object.fromEntries(Array.from(bookmarksByMs)),
      dungeonChecks: dungeonStates,
    }),
    [characterSlot, character, completedIds, completedStepsByMs, bookmarksByMs, dungeonStates]
  );

  // Adoption : une seule fois PAR emplacement. Le serveur est déjà idempotent
  // (`createMany skipDuplicates`) ; le `Set` évite simplement de rejouer l'appel.
  const adoptedSlots = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!isConnected || adoptedSlots.current.has(characterSlot)) return;
    adoptedSlots.current.add(characterSlot);
    void (async () => {
      const state = await loadMyRushProgress({ characterSlot });
      if (state.success && !state.exists) {
        await adoptMyRushProgress(buildProgressSnapshot());
      }
    })();
  }, [isConnected, characterSlot, buildProgressSnapshot]);

  // Miroir débouncé : 2 s après la dernière coche, on envoie l'état complet.
  // Pas de `flush` à la fermeture d'onglet : une server action ne survit pas à un
  // `beforeunload`, et la base reste un miroir — le navigateur n'a rien perdu.
  const firstMirrorRun = useRef(true);
  useEffect(() => {
    if (!isConnected) return;
    if (firstMirrorRun.current) {
      firstMirrorRun.current = false;
      return;
    }
    const timer = setTimeout(() => {
      void saveMyRushProgress(buildProgressSnapshot());
    }, 2000);
    return () => clearTimeout(timer);
  }, [isConnected, buildProgressSnapshot]);

  // Popup « Reprendre ? » : uniquement au retour sur le guide avec un repère
  // local pré-existant — jamais juste après avoir posé le repère soi-même.
  const [continueModalOpen, setContinueModalOpen] = useState(false);
  const resumeShownThisSession = useRef(false);
  const hadBookmarkAtMount = useRef<boolean | null>(null);
  const bookmarkTouchedThisSession = useRef(false);
  useEffect(() => {
    if (hadBookmarkAtMount.current === null) {
      hadBookmarkAtMount.current = bookmarksByMs.size > 0;
    }
    if (!hadBookmarkAtMount.current || resumeShownThisSession.current || bookmarkTouchedThisSession.current) return;
    const hasAny = Array.from(bookmarksByMs.keys()).length > 0;
    if (!hasAny) return;
    resumeShownThisSession.current = true;
    const t = setTimeout(() => setContinueModalOpen(true), 1200);
    return () => clearTimeout(t);
  }, [bookmarksByMs]);

  // Cross-window sync (broadcast channel between page and floating overlay)
  useGuideProgressSync(
    // Canal par PERSONNAGE (le préfixe porte l'emplacement) : deux personnages
    // ouverts dans deux onglets ne se marchent pas dessus.
    storagePrefix,
    guide.slug,
    { completedIds, completedStepsByMs, bookmarksByMs },
    { setCompletedIds, setCompletedStepsByMs, setBookmarksByMs }
  );

  // Filters & UI State
  const [searchQuery, setSearchQuery] = useState("");
  const [hideDone, setHideDone] = useState(false);
  const [showResources, setShowResources] = useState(false);
  const [expandedMs, setExpandedMs] = useState<Set<string>>(() => new Set([milestones[0]?.id].filter(Boolean)));

  // Global counts
  // Les séquences info (encarts) ne sont pas des étapes : elles ne comptent PAS dans la
  // progression — avant, elles étaient comptées mais jamais affichées, donc le guide ne
  // pouvait jamais atteindre 100 %.
  const totalSequences = useMemo(
    () =>
      milestones.reduce(
        (acc, ms) => acc + (ms.sequences?.filter((s) => !isInfoSequence(s)).length || 0),
        0
      ),
    [milestones]
  );

  const completedCount = useMemo(() => {
    let count = 0;
    completedStepsByMs.forEach((set) => {
      count += set.size;
    });
    return count;
  }, [completedStepsByMs]);

  const progressPercent = totalSequences > 0 ? Math.round((completedCount / totalSequences) * 100) : 0;

  // Clés d'items consommés par les étapes validées (id sinon nom) : le bloc
  // « Ressources requises » décrémente à mesure des validations.
  const completedItemKeys = useMemo(() => {
    const set = new Set<string>();
    for (const ms of milestones) {
      const done = completedStepsByMs.get(ms.id);
      if (!done) continue;
      for (const s of ms.sequences || []) {
        if (!done.has(s.id)) continue;
        for (const key of resourceKeysForTags((s as any).activityTags)) set.add(key);
      }
    }
    return set;
  }, [milestones, completedStepsByMs]);

  // Étapes validées, tous chapitres confondus : sert à recalculer les ressources
  // « restantes » de la modale. 🐞 Avant, la page publique passait DEUX fois la
  // liste complète (`aggregateRushResources(milestones)`) : la bascule
  // « Restantes / Toutes » affichait la même chose et rien ne décrémentait à
  // mesure des validations. L'overlay, lui, passait bien les étapes terminées.
  const completedSeqIds = useMemo(() => {
    const set = new Set<string>();
    completedStepsByMs.forEach((ids) => ids.forEach((id) => set.add(id)));
    return set;
  }, [completedStepsByMs]);

  const allResources = useMemo(() => aggregateRushResources(milestones), [milestones]);

  // Séquence par id + verrou de prérequis : la MÊME règle que le guide interne
  // (`isSequenceBlockedByPrereqs`, helper partagé du module). Le public n'avait
  // aucun verrou : il laissait cocher « Le Dofus Pourpre » avant « Protection
  // divine » là où l'interne refuse (défaut signalé par le user).
  const seqById = useMemo(() => {
    const m = new Map<string, RushSequence>();
    for (const ms of milestones) for (const s of ms.sequences || []) m.set(s.id, s);
    return m;
  }, [milestones]);

  const isStepLocked = useCallback(
    (seqId: string): boolean => {
      const s = seqById.get(seqId);
      if (!s || completedSeqIds.has(seqId)) return false;
      return isSequenceBlockedByPrereqs(s, completedSeqIds, milestones);
    },
    [seqById, completedSeqIds, milestones]
  );

  /**
   * Verrou de DONJONS (même règle que l'interne et le serveur) : seuls les donjons
   * REQUIS **de cette quête** comptent, d'où `doneDungeonKeysForSequence`.
   */
  const isSeqBlockedByDungeon = useCallback(
    (seqId: string): boolean => {
      const s = seqById.get(seqId);
      if (!s || completedSeqIds.has(seqId)) return false;
      return sequenceDungeonProgress(s, doneDungeonKeysForSequence(dungeonStates, seqId)).blocked;
    },
    [seqById, completedSeqIds, dungeonStates]
  );

  /** Coche / décoche une OCCURRENCE (re-cliquer retire l'état). */
  const handleSetDungeonState = useCallback(
    (sequenceId: string, dungeonKey: string, state: RushDungeonState | null) => {
      setDungeonStates(
        writeDungeonState(storagePrefix, dungeonOccurrenceKey(sequenceId, dungeonKey), state)
      );
      // ── S0-7 : un donjon qui n'est plus « fait » DÉVALIDE la quête ────────────
      // Pas de serveur ici : c'est la surface qui retire la quête de ses étapes cochées.
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
      if (typeof window !== "undefined") {
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
      }
      toast.info("Donjon décoché : la quête a été dévalidée.");
    },
    [storagePrefix, completedStepsByMs, completedIds, milestones]
  );

  const remainingResources = useMemo(
    () => aggregateRushResources(milestones, completedSeqIds),
    [milestones, completedSeqIds]
  );

  // Bookmark / Repère personnel ("Je suis ici")
  const handleToggleBookmark = useCallback(
    (msId: string, seqId: string) => {
      bookmarkTouchedThisSession.current = true;
      setBookmarksByMs((prev) => {
        const next = new Map(prev);
        if (next.get(msId) === seqId) {
          next.delete(msId);
          toast.info("Repère retiré", { duration: 1500 });
        } else {
          next.set(msId, seqId);
          toast.success("🚩 Repère placé : « Je suis ici »", { duration: 2000 });
        }
        if (typeof window !== "undefined") {
          try {
            const obj = Object.fromEntries(next);
            localStorage.setItem(`${storagePrefix}bookmarks`, JSON.stringify(obj));
          } catch {}
        }
        return next;
      });
    },
    [storagePrefix]
  );

  // Active / Next Objective — UNE SEULE VÉRITÉ : le modèle de vue partagé du
  // module (`buildRushGuideView`) applique les règles qui font foi : repère du
  // joueur prioritaire, séquences informatives ignorées, dépendances (`prereq_text`)
  // respectées. Avant, cette page avait sa propre boucle — elle divergeait du guide
  // interne sur ces trois points.
  const bookmarkedSeqId = useMemo(() => {
    for (const ms of milestones) {
      const bmSeqId = bookmarksByMs.get(ms.id);
      if (bmSeqId && !completedSeqIds.has(bmSeqId)) return bmSeqId;
    }
    return null;
  }, [milestones, bookmarksByMs, completedSeqIds]);

  const rushView = useMemo(
    () => buildRushGuideView({ milestones, completedSeqIds, bookmarkedSeqId }),
    [milestones, completedSeqIds, bookmarkedSeqId]
  );

  const activeObjective = rushView.active;

  // Toggle step
  const handleToggleStep = useCallback(
    (msId: string, seqId: string) => {
      const current = new Set(completedStepsByMs.get(msId) || []);
      const was = current.has(seqId);

      // 🚫 Même refus que le guide interne : un prérequis non terminé verrouille la
      // quête. Le garde-fou est ICI (dans l'écriture), pas seulement dans le rendu :
      // un état local trafiqué ne doit pas valider plus que la guilde.
      if (!was && isStepLocked(seqId)) {
        toast.error("Prérequis non terminé — cette quête est encore verrouillée.");
        return;
      }

      // 🚫 Même doctrine pour les DONJONS : un donjon requis non coché dans CETTE
      // quête verrouille la validation. Ici le refus est local (aucun serveur).
      if (!was && isSeqBlockedByDungeon(seqId)) {
        toast.error("Donjon requis non fait — coche-le sur la pastille Donjon de cette quête.");
        return;
      }

      was ? current.delete(seqId) : current.add(seqId);

      // Ressources : valider coche les ressources de la quête, invalider les décoche.
      const seqForResources = milestones.flatMap((m) => m.sequences || []).find((s) => s.id === seqId);
      applyResourceChecksForQuest((seqForResources as any)?.activityTags, !was);

      setCompletedStepsByMs((prev) => {
        const next = new Map(prev);
        next.set(msId, current);
        if (typeof window !== "undefined") {
          try {
            const stepsObj: Record<string, string[]> = {};
            next.forEach((set, k) => {
              stepsObj[k] = Array.from(set);
            });
            localStorage.setItem(`${storagePrefix}steps`, JSON.stringify(stepsObj));
          } catch {}
        }
        return next;
      });

      const ms = milestones.find((m) => m.id === msId);
      if (ms && ms.sequences) {
        // Seules les étapes cochables comptent : un encart info n'est jamais validé, donc
        // sans ce filtre un bloc contenant un encart ne serait jamais « terminé ».
        const steps = ms.sequences.filter((s) => !isInfoSequence(s));
        const allDone = steps.length > 0 && steps.every((s) => current.has(s.id));
        setCompletedIds((prev) => {
          const next = new Set(prev);
          allDone ? next.add(msId) : next.delete(msId);
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(`${storagePrefix}completed_ms`, JSON.stringify(Array.from(next)));
            } catch {}
          }
          return next;
        });
      }
    },
    [completedStepsByMs, milestones, storagePrefix, isStepLocked, isSeqBlockedByDungeon, applyResourceChecksForQuest]
  );

  // Toggle whole chapter
  const handleToggleChapterAll = useCallback(
    (msId: string, completeAll: boolean) => {
      const ms = milestones.find((m) => m.id === msId);
      if (!ms || !ms.sequences) return;

      const current = new Set(completedStepsByMs.get(msId) || []);
      const before = new Set(current);
      // Jamais les encarts info : ils n'ont pas de case à cocher. Et jamais une quête
      // verrouillée : « Tout valider » ne contourne pas les prérequis.
      ms.sequences.filter((s) => !isInfoSequence(s)).forEach((s) => {
        if (completeAll && !current.has(s.id) && isStepLocked(s.id)) return;
        // « Tout valider » ne contourne pas non plus un donjon requis non coché.
        if (completeAll && !current.has(s.id) && isSeqBlockedByDungeon(s.id)) return;
        completeAll ? current.add(s.id) : current.delete(s.id);
      });

      // Ressources : seules les quêtes réellement basculées touchent leurs coches.
      for (const s of ms.sequences) {
        if (isInfoSequence(s)) continue;
        if (before.has(s.id) === current.has(s.id)) continue;
        applyResourceChecksForQuest((s as any).activityTags, current.has(s.id));
      }

      setCompletedStepsByMs((prev) => {
        const next = new Map(prev);
        next.set(msId, current);
        if (typeof window !== "undefined") {
          try {
            const stepsObj: Record<string, string[]> = {};
            next.forEach((set, k) => {
              stepsObj[k] = Array.from(set);
            });
            localStorage.setItem(`${storagePrefix}steps`, JSON.stringify(stepsObj));
          } catch {}
        }
        return next;
      });

      setCompletedIds((prev) => {
        const next = new Set(prev);
        completeAll ? next.add(msId) : next.delete(msId);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(`${storagePrefix}completed_ms`, JSON.stringify(Array.from(next)));
          } catch {}
        }
        return next;
      });
    },
    [completedStepsByMs, milestones, storagePrefix, isStepLocked, isSeqBlockedByDungeon, applyResourceChecksForQuest]
  );

  // Toggle all steps of one quest block (comme le guide interne)
  const handleToggleBlockSteps = useCallback(
    (msId: string, seqIds: string[], completeAll: boolean) => {
      // Une quête verrouillée par un prérequis n'est jamais cochée en lot (même règle
      // que le guide interne) : on filtre la cible AVANT d'écrire quoi que ce soit.
      const targets = completeAll
        ? seqIds.filter((id) => {
            const s = seqById.get(id);
            if (!s || completedSeqIds.has(id)) return true;
            return (
              !isSequenceBlockedByPrereqs(s, completedSeqIds, milestones) &&
              !isSeqBlockedByDungeon(id)
            );
          })
        : seqIds;
      // Ressources : les quêtes réellement basculées cochent/décochent leurs ressources.
      for (const id of targets) {
        const s = seqById.get(id);
        if (s) applyResourceChecksForQuest((s as any).activityTags, completeAll);
      }
      setCompletedStepsByMs((prev) => {
        const next = new Map(prev);
        const current = new Set(next.get(msId) || []);
        targets.forEach((id) => {
          if (completeAll) current.add(id);
          else current.delete(id);
        });
        next.set(msId, current);
        if (typeof window !== "undefined") {
          try {
            const stepsObj: Record<string, string[]> = {};
            next.forEach((set, k) => {
              stepsObj[k] = Array.from(set);
            });
            localStorage.setItem(`${storagePrefix}steps`, JSON.stringify(stepsObj));
          } catch {}
        }
        return next;
      });

      const ms = milestones.find((m) => m.id === msId);
      if (ms && ms.sequences) {
        const doneSet = new Set(completedStepsByMs.get(msId) || []);
        targets.forEach((id) => {
          if (completeAll) doneSet.add(id);
          else doneSet.delete(id);
        });
        const relevant = ms.sequences.filter((s) => !isInfoSequence(s)).map((s) => s.id);
        const allDone = relevant.length > 0 && relevant.every((id) => doneSet.has(id));
        setCompletedIds((prev) => {
          const next = new Set(prev);
          allDone ? next.add(msId) : next.delete(msId);
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(`${storagePrefix}completed_ms`, JSON.stringify(Array.from(next)));
            } catch {}
          }
          return next;
        });
      }
    },
    [completedStepsByMs, milestones, storagePrefix, seqById, completedSeqIds, isSeqBlockedByDungeon, applyResourceChecksForQuest]
  );

  // Personnage déclaré → libellé affiché (icône de classe + pseudo + serveur) et
  // reprise du libellé dans les messages (remise à zéro).
  const characterClass = character?.classId ? getClass(character.classId) : null;
  /** V2a — classe du visiteur **connecté** (celle du profil, pas du personnage invité). */
  const visitorClass = visitor?.classe ? getClass(visitor.classe) : null;
  const characterLabel = character
    ? [character.pseudo || characterClass?.name || "Personnage", guestServerLabel(character.serverId)]
        .filter(Boolean)
        .join(" · ")
    : null;

  // V2a-3 — ce que montre la tuile « Personnage actif » : le personnage invité prime,
  // sinon l'identité du COMPTE (`visitor`, fusionnée depuis le bandeau V2a-1). Une seule
  // tuile, deux sources, aucune valeur inventée : sans les deux, la tuile reste le rendu
  // d'avant (progression du navigateur).
  const activeClass = characterClass ?? visitorClass;
  const activeServerId =
    hasGuestCharacter(character) && character?.serverId ? character.serverId : visitor?.serverId ?? null;
  const activeName = hasGuestCharacter(character) ? characterLabel : visitor?.pseudo ?? null;
  /**
   * Demande user du 08/11/2026 — « si je n'ai que mon main sans mule à ajouter, le pseudo doit
   * pas être cliquable ; sinon il doit proposer une modale pour changer de personnage ».
   *
   * Mesure : le pseudo ouvrait **toujours** la modale « Mon personnage », c'est-à-dire un
   * formulaire de **création** (classe + serveur + nom) — la porte de l'anonyme, qui enregistre
   * dans `localStorage`. Un compte connecté sans mule n'a pourtant **rien** à changer : on lui
   * proposait de créer un personnage alors que le sien est déjà en base.
   *
   * Trois cas conservés : anonyme ⇒ cliquable (c'est sa seule porte) ; connecté **avec** mules ⇒
   * cliquable (la modale liste d'abord « Mes personnages déclarés ») ; connecté **sans** mule ⇒
   * le pseudo redevient du texte.
   */
  const canSwitchCharacter = !visitor || (visitor.mules?.length ?? 0) > 0;

  /**
   * V2a-3 — libellé Metamob : TROIS états sortis de la règle pure `metamobState`
   * (aucune clé d'API, aucun appel réseau). La tuile ne raconte donc rien d'autre que
   * ce que le profil déclare.
   */
  const metamob = metamobState(visitor);
  const metamobLabel =
    metamob === "verified"
      ? locale === "en" ? "linked · verified" : "lié · vérifié"
      : metamob === "linked"
        ? locale === "en" ? "linked · unverified" : "lié · non vérifié"
        : locale === "en" ? "not linked" : "non renseigné";

  // Remise à zéro : les CINQ clés de progression partent ensemble (étapes cochées,
  // blocs terminés, repères, coches de donjons, ressources préparées). Un reset partiel
  // laisserait un guide à moitié coché — et une fenêtre d'overlay ouverte se réaligne
  // seule (le BroadcastChannel republie l'état vide).
  const handleResetProgress = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(`${storagePrefix}completed_ms`);
        localStorage.removeItem(`${storagePrefix}steps`);
        localStorage.removeItem(`${storagePrefix}bookmarks`);
        localStorage.removeItem(`${storagePrefix}resources`);
      } catch {}
    }
    clearDungeonStates(storagePrefix);
    // V1d : la base suit la remise à zéro — **un** emplacement, jamais tout le profil.
    if (isConnected) void resetMyRushProgress({ characterSlot });
    setCompletedIds(new Set());
    setCompletedStepsByMs(new Map());
    setBookmarksByMs(new Map());
    setDungeonStates({});
    setResourceChecks(new Set());
    setExpandedMs(new Set(milestones[0]?.id ? [milestones[0].id] : []));
    setHideDone(false);
    setSearchQuery("");
    setContinueModalOpen(false);
    resumeShownThisSession.current = true;
    toast.success("Progression remise à zéro", {
      description: characterLabel
        ? `Étapes cochées, blocs terminés, repères et donjons de ${characterLabel} ont été effacés.`
        : "Étapes cochées, blocs terminés, repères et donjons ont été effacés.",
    });
  }, [storagePrefix, milestones, characterLabel, isConnected, characterSlot]);

  // ─── Personnage (facultatif) ────────────────────────────────────────────────
  // Appliquer un personnage CHANGE d'emplacement de progression : on relit ses trois
  // clés. S'il est vierge et que le visiteur avait déjà coché des étapes sans
  // personnage, on les lui RECOPIE (voir `adoptAnonymousGuestProgress`) — personne
  // ne perd son rush en déclarant son personnage.
  const applyGuestCharacter = useCallback(
    (next: GuestCharacter | null) => {
      // Formulaire vide (ou pseudo en espaces) → même effet que « Retirer » : on
      // revient à la progression du navigateur plutôt que de créer un emplacement
      // « Personnage » sans nom.
      const normalized: GuestCharacter | null = hasGuestCharacter(next)
        ? { classId: next.classId || null, pseudo: next.pseudo?.trim() || null, serverId: next.serverId ?? null }
        : null;
      // Adoption UNIQUEMENT à la première déclaration (aucun personnage enregistré) :
      // déclarer un SECOND personnage doit partir vierge, jamais hériter du premier.
      const firstDeclaration = readGuestCharacter(guide.slug) === null;
      const adopted = firstDeclaration && adoptAnonymousGuestProgress(guide.slug, normalized);
      writeGuestCharacter(guide.slug, normalized);
      setCharacter(normalized);

      const snapshot = readGuestProgress(guide.slug, normalized);
      setCompletedIds(snapshot.completedIds);
      setCompletedStepsByMs(snapshot.completedStepsByMs);
      setBookmarksByMs(snapshot.bookmarksByMs);
      setExpandedMs(new Set(milestones[0]?.id ? [milestones[0].id] : []));
      setCharacterOpen(false);

      const who = normalized
        ? [
            normalized.pseudo || (normalized.classId ? getClass(normalized.classId)?.name : null) || "Personnage",
            guestServerLabel(normalized.serverId),
          ]
            .filter(Boolean)
            .join(" · ")
        : null;
      if (normalized && adopted) {
        toast.success(`Progression reprise pour ${who}`, {
          description: "Les étapes déjà cochées sans personnage ont été recopiées sur ce personnage.",
        });
      } else if (normalized) {
        toast.success(`Progression locale : ${who}`, {
          description: "Ce personnage garde ses propres étapes cochées, ses blocs terminés et son repère.",
        });
      } else {
        toast.info("Personnage retiré", {
          description: "Retour à la progression du navigateur (sans personnage).",
        });
      }
    },
    [guide.slug, milestones]
  );

  // Ouvrir la modale : elle repart du personnage déclaré (aucun état à préparer ici).
  /**
   * Bascule ou création ? Un **compte** a déjà son personnage et ses mules en base : on lui ouvre
   * la bascule (demande du 08/11/2026 — « cette modale est destinée au visiteur non connecté »).
   * L'anonyme, lui, n'a que le formulaire local, et c'est normal.
   */
  const openCharacterForm = useCallback(() => {
    if (visitor && (visitor.mules?.length ?? 0) > 0) {
      setSwitchOpen(true);
      return;
    }
    setCharacterOpen(true);
  }, [visitor]);

  // Toggle chapter expansion
  const toggleChapter = (msId: string) => {
    setExpandedMs((prev) => {
      const next = new Set(prev);
      next.has(msId) ? next.delete(msId) : next.add(msId);
      return next;
    });
  };

  // Launch Overlay In-Game
  const handleLaunchOverlay = async () => {
    if (pipWin && !pipWin.closed) {
      pipWin.focus?.();
      return;
    }

    try {
      let win: Window | null = null;
      let pinned = true;
      if (isDocumentPipSupported()) {
        try {
          win = await openPipWindow({ width: 420, height: 720 });
          pinned = win !== null;
        } catch {
          win = null;
          pinned = false;
        }
      } else {
        pinned = false;
        win = openFallbackPopup({ width: 420, height: 720 });
        if (win) preparePipDocument(win);
      }

      if (!win) {
        toast.error("Impossible d'ouvrir la mini-fenêtre. Vérifiez les popups autorisées.");
        return;
      }

      win.addEventListener("unload", () => {
        setPipWin(null);
      });

      setPipPinned(pinned);
      setPipWin(win);
      if (pinned) {
        toast.success("🪟 Mini-fenêtre Overlay ouverte par-dessus votre jeu !", {
          description: "Gardez-la au-dessus de votre client Dofus pour suivre chaque étape.",
          duration: 4000,
        });
      } else {
        toast.warning("🪟 Mini-fenêtre ouverte (non épinglée).", {
          description:
            "Votre navigateur ne supporte pas l'overlay toujours-au-dessus : gardez la fenêtre visible à côté du jeu.",
          duration: 5000,
        });
      }
    } catch (e) {
      console.error("[Overlay Launch Error]:", e);
      toast.error("Erreur lors de l'ouverture de l'overlay.");
    }
  };

  // ─── Pagination par chapitre ────────────────────────────────────────────────
  // 57 chapitres / 379 étapes : même replié, tout rendre faisait un mur de scroll qui
  // ne fera qu'empirer. Une vue = UN chapitre. Le sommaire (balise <nav>) garde les
  // 57 titres dans le HTML — rien n'est perdu pour l'indexation — et chaque chapitre a
  // une ancre partageable (`#bloc-<id>`), sans paramètre d'URL (la page reste ISR).
  const chapterPages = useMemo(() => {
    const out: { ms: RushMilestone; index: number; lead: RushMilestone[]; tail: RushMilestone[] }[] = [];
    let lead: RushMilestone[] = [];
    milestones.forEach((ms, index) => {
      if (ms.type === "SEPARATEUR" || ms.type === "INFO") {
        // Bannière : elle reste collée au chapitre qui la suit (sinon à la fin du dernier).
        if (out.length) out[out.length - 1].tail.push(ms);
        else lead.push(ms);
        return;
      }
      out.push({ ms, index, lead, tail: [] });
      lead = [];
    });
    return out;
  }, [milestones]);

  const isSearching = searchQuery.trim().length > 0;

  const currentPageIndex = useMemo(() => {
    const idx = chapterPages.findIndex((p) => p.ms.id === pageChapterId);
    return idx >= 0 ? idx : 0;
  }, [chapterPages, pageChapterId]);
  const currentPage = chapterPages[currentPageIndex];

  // Les ancres du sommaire sont partageables et le bouton « retour » du navigateur
  // refait le tour des chapitres déjà visités.
  useEffect(() => {
    const applyHash = () => {
      const id = window.location.hash.replace(/^#bloc-/, "");
      if (!id || id === pageChapterId) return;
      if (chapterPages.some((p) => p.ms.id === id)) setPageChapterId(id);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [chapterPages, pageChapterId]);

  const goToChapterPage = useCallback((idx: number) => {
    const page = chapterPages[idx];
    if (!page) return;
    setPageChapterId(page.ms.id);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#bloc-${page.ms.id}`);
    }
    document.getElementById("guide-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [chapterPages]);

  // Le chapitre ouvert est la page : on le déplie **à l'arrivée sur la page**
  // (navigation, ancre, sommaire) — mais il reste **repliable** ensuite.
  // ⚠️ Avant, `isExpanded` était forcé à `true` pour la page courante : la flèche de
  // repli était alors **inerte** (retour user : « la flèche pour replier un bloc marche
  // pas sur le guide public »). La recherche, elle, fouille TOUS les chapitres (sinon
  // elle cacherait ses propres résultats) : elle déplie tout, à la volée.
  const pagedChapterId = isSearching ? null : currentPage?.ms.id ?? null;
  useEffect(() => {
    if (!pagedChapterId) return;
    setExpandedMs((prev) => (prev.has(pagedChapterId) ? prev : new Set(prev).add(pagedChapterId)));
  }, [pagedChapterId]);
  const visibleMilestones = useMemo(
    () => (isSearching || !currentPage ? milestones : [...currentPage.lead, currentPage.ms, ...currentPage.tail]),
    [isSearching, currentPage, milestones]
  );

  // ─── Bloc de la DA « Gouache Wakfu » ───────────────────────────────────────
  // EXACTEMENT la règle de l'overlay (`src/lib/rush-da-theme.ts`) : bloc nommé
  // d'abord, puis héritage en remontant la liste. Une seule vérité pour les deux
  // surfaces — c'est la parité public ↔ interne, pas une copie.
  const daTheme = useMemo(
    () => resolveRushDaTheme(milestones, currentPage?.ms.id ?? null),
    [milestones, currentPage]
  );

  // Thème exposé aux surfaces sorties de l'arbre (modales Radix portées dans
  // `document.body`, navigation flottante) : même vérité que la coque, sans
  // prop-drilling. `daScopeProps` la traduit en attributs `data-*`.
  const daThemeValue = useMemo(
    () => ({ theme: "dark" as const, block: daTheme.block, accent: daTheme.accent }),
    [daTheme.block, daTheme.accent]
  );
  const daScope = daScopeProps(daThemeValue);

  return (
    <DaThemeProvider value={daThemeValue}>
    <>
      {/* ══ COQUE DU GUIDE — la portée de la DA « Gouache Wakfu » ════════════════
          Même grammaire que l'overlay : `data-da` + `data-theme` + `data-block`
          (bloc courant, règle PARTAGÉE `resolveRushDaTheme`) — et `data-quality`
          « high », puisque le guide est une surface plein écran : le grain et les
          bords tremblés y sont autorisés (ils sont coupés dans la PiP).
          Coque à 1 360 px : `reg-shell` (1 120) reste pour almanax / bestiaire. */}
      <div
        data-da="wakfu"
        data-theme="dark"
        data-block={daTheme.block}
        data-quality="high"
        className="rush-guide da-grain da-guide"
        style={daTheme.accent ? ({ "--da-acc": daTheme.accent } as React.CSSProperties) : undefined}
      >
      {/* ── BANDEAU DU GUIDE — UNE seule carte (demande user, 05/11/2026) ──────
          Le titre et le panneau de contrôle vivaient dans deux cartes : le titre
          centré en haut, les contrôles dans la colonne du module. Ils n'en font
          plus qu'une, comme le guide interne. Le voile de `.da-guide-hero::after`
          garde le titre lisible quelle que soit l'image du bloc. Le panneau, lui,
          est rendu par le client : c'est ici qu'il trouve son état (route, filtre,
          personnage) sans redescendre par des props.

          V2a-3 (07/11/2026) — le bandeau d'identité de V2a-1 est FUSIONNÉ dans la
          tuile « Personnage actif ». Deux blocs qui annonçaient tous les deux
          « Personnage actif » pour la même intention étaient un doublon ; l'interne
          n'a qu'une tuile. L'identité du COMPTE reste gardée par `visitor` (un
          anonyme ne la voit pas), mais elle se lit désormais DANS la tuile. */}
      <header className="da-guide-hero">
        <div className="da-guide-hero-inner">
          <nav aria-label="Fil d'Ariane" className="da-guide-hero-crumb">
            <Link href="/guides" className="da-kicker">
              ← {t.rushGuide.breadcrumbGuides}
            </Link>
          </nav>
          {/* L'icône du Dofus partage la LIGNE du titre (V2a-5, retour user : « pk l'icône
              du dofus sylvestre n'est pas aligné et grossis à la taille du titre »).
              « AVENTURE » reste au-dessus, le mot et le Dofus sont centrés ensemble. */}
          <h1 className="da-logo" aria-label={locale === "en" ? "Sylvan Rush adventure" : "Aventure Rush Sylvestre"}>
            <span className="da-logo-a" aria-hidden="true">
              {locale === "en" ? "Adventure" : "Aventure"}
            </span>
            <span className="da-logo-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/module-dofus/Dofus_Sylvestre.png"
                alt=""
                aria-hidden="true"
                width={96}
                height={96}
                className="da-guide-hero-dofus"
              />
              <span className="da-logo-b" aria-hidden="true">
                {locale === "en" ? "Sylvan Rush" : "Rush Sylvestre"}
              </span>
            </span>
          </h1>
          {/* La porte de l'espace visiteur vit ICI depuis V2a-5 — demande user : « mon
              espace visiteur doit bouger ailleurs, dans le gros bandeau Rush Sylvestre
              bien visible cliquable ». Anonyme ⇒ pas de porte (aucun compte à ouvrir). */}
          {visitor ? (
            <Link href="/espace-visiteur/general" className="da-guide-hero-cta">
              {locale === "en" ? "My visitor space →" : "Mon espace visiteur →"}
            </Link>
          ) : !isConnected ? (
            /* V2a-6 — invitation DISCRÈTE au profil visiteur : un lien, jamais une modale
               forcée. La lecture du guide reste entièrement libre. */
            <Link href="/espace-visiteur/general" className="da-guide-hero-cta">
              {locale === "en" ? "Create my visitor profile →" : "Créer mon profil visiteur →"}
            </Link>
          ) : null}
        </div>
        <div className="da-guide-controls">
      {/* ── BARRE DU HAUT — les outils de CONTENU ────────────────────────────
          V2a-5 (07/11/2026) — demande user : « le bandeau avec les trois alignements
          bonta brak neutre doit disparaître, le conseil aussi ». Les deux sont partis :
          « Ma cité » vit dans « Options » (le choix pilote toujours la route, il n'est
          plus au premier plan) et le conseil « Niv. 200 » n'est plus affiché nulle part. */}
      <div className="flex flex-wrap items-center justify-end gap-2 border-b border-border px-4 py-2.5 sm:px-5">
          <button
            type="button"
            onClick={() => setShowResources(true)}
            className="inline-flex items-center gap-1.5 rounded-[4px] border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
            title={
              locale === "en"
                ? "Resources to prepare — follows validated steps and your manual checks"
                : "Ressources à prévoir — le calcul suit les étapes validées et vos coches manuelles"
            }
            aria-label={locale === "en" ? "Open resources to prepare" : "Ouvrir les ressources à prévoir"}
          >
            {/* Picto RÉEL du jeu (source unique `RUSH_RESOURCES_PICTO`), comme le guide
                interne et l'overlay — plus de carré Lucide `Package`. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={RUSH_RESOURCES_PICTO} alt="" aria-hidden="true" loading="lazy" className="h-3.5 w-3.5 object-contain" />
            <span>{t.rushGuide.resourcesTab}</span>
          </button>

          {/* Pense-bête — contenu édité côté GOD, lecture seule (même modale que
              le guide interne). Il remplace le conseil perdu dans la FAQ. */}
          <button
            type="button"
            onClick={() => setPenseBeteOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-[4px] border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
            title={locale === "en" ? "Things to know / to prepare before the rush" : "Les choses à savoir / à préparer avant le rush"}
          >
            <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{locale === "en" ? "Checklist" : "Pense-bête"}</span>
          </button>

          {/* L'interrupteur de densité a quitté cette barre en V2a-3 : il vit dans
              « Options », la rangée sous les tuiles, avec les réglages — pas avec les
              outils de contenu (Ressources, Pense-bête). Même état, même effet. */}
      </div>

      {/* ── TUILLES — les CINQ de l'interne (V2a-3) : personnage actif · alignement ·
          Metamob · Rush Live · overlay. Chacune n'affiche que ce qu'elle peut prouver. */}
      <div className="flex flex-wrap items-stretch gap-3 px-4 py-3 sm:px-5">
        {/* Personnage actif — UNE tuile, DEUX sources (V2a-3) : le personnage invité
            (progression locale) quand il existe, sinon l'identité du COMPTE connecté
            (fusionnée ici depuis le bandeau V2a-1). Anonyme sans personnage ⇒ rendu
            d'avant, à l'identique. */}
        <div className="flex min-w-0 items-center gap-2.5">
          {activeClass ? (
            // Icône de classe du jeu (mêmes PNG que le profil et le dashboard).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={activeClass.icon}
              alt={activeClass.name}
              title={activeClass.name}
              className="h-8 w-8 shrink-0 object-contain"
            />
          ) : (
            <UserRound className="h-8 w-8 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          {activeServerId && getDofusServerImage(activeServerId) && (
            // Vignette du serveur déclaré (assets du jeu, WebP).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={getDofusServerImage(activeServerId)!}
              alt=""
              title={guestServerLabel(activeServerId) ?? ""}
              loading="lazy"
              decoding="async"
              draggable={false}
              className="h-8 w-8 shrink-0 rounded-[3px] border border-border object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground">
              {locale === "en" ? "Active character" : "Personnage actif"}
            </p>
            {/* Le nom à gauche, les deux chiffres À DROITE sur la même ligne (retour user :
                « l'affichage niveau et succès est moche en bas, prends la place à droite »).
                `flex-wrap` : sous 390 px ils passent sous le nom au lieu de déborder. */}
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              {/* Le NOM est le déclencheur du changement (V2a-5 — demande user : « pk pas
                  juste rendre cliquable son pseudo pour changer de perso »). Un vrai
                  <button> : clavier et lecteur d'écran le voient, contrairement à une div. */}
              {canSwitchCharacter ? (
                <button
                  type="button"
                  onClick={openCharacterForm}
                  className="min-w-0 max-w-full truncate text-left text-xs font-semibold text-foreground underline decoration-dotted underline-offset-2 transition-colors hover:text-accent"
                  title={
                    locale === "en"
                      ? "Class + nickname + server: each character keeps their own progress"
                      : "Classe + pseudo + serveur : chaque personnage garde sa propre progression"
                  }
                >
                  {activeName ?? (locale === "en" ? "Choose my character" : "Choisir mon personnage")}
                </button>
              ) : (
                /* Connecté sans mule : rien à changer, donc rien à cliquer (demande du
                   08/11/2026). Le pseudo reste lisible, sans affordance de bouton. */
                <span
                  className="min-w-0 max-w-full truncate text-left text-xs font-semibold text-foreground"
                  title={
                    locale === "en"
                      ? "Declare a mule in your visitor space to switch character"
                      : "Déclare une mule dans ton espace visiteur pour changer de personnage"
                  }
                >
                  {activeName}
                </span>
              )}
              {/* Identité du COMPTE — `visitor` est le SEUL garde. */}
              {visitor ? (
                <span
                  className="ml-auto shrink-0 text-[11px] text-muted-foreground"
                  title={
                    locale === "en"
                      ? `Level ${visitor.level ?? "—"} · ${visitor.successPoints ?? "—"} success points`
                      : `Niveau ${visitor.level ?? "—"} · ${visitor.successPoints ?? "—"} points de succès`
                  }
                >
                  <span className="font-mono font-medium text-foreground">{visitor.level ?? "—"}</span>{" "}
                  {locale === "en" ? "lvl" : "niv."}
                  <span aria-hidden="true"> · </span>
                  <span className="font-mono font-medium text-foreground">{visitor.successPoints ?? "—"}</span>{" "}
                  {locale === "en" ? "SP" : "pts"}
                </span>
              ) : null}
            </div>
            {!activeName && (
              <span className="block text-[11px] text-muted-foreground">
                {locale === "en"
                  ? "Progress saved for this browser"
                  : "Progression enregistrée pour ce navigateur"}
              </span>
            )}
          </div>
          {hasGuestCharacter(character) && (
            <button
              type="button"
              onClick={() => applyGuestCharacter(null)}
              aria-label={locale === "en" ? "Remove the character" : "Retirer le personnage"}
              title={
                locale === "en"
                  ? "Reset to browser progress (no character)"
                  : "Revenir à la progression du navigateur (sans personnage)"
              }
              className="shrink-0 rounded-[4px] p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
          <GuestCharacterModal
            open={characterOpen}
            onClose={closeCharacterModal}
            initial={character}
            locale={locale}
            onSubmit={(next) => applyGuestCharacter(next)}
            mules={visitor?.mules ?? []}
            defaultServerId={visitor?.serverId ?? null}
          />
          {/* Bascule de personnage du COMPTE (demande du 08/11/2026) : la modale ci-dessus est
              le formulaire de l'anonyme (localStorage) ; un compte, lui, choisit parmi ce qui
              existe déjà en base. */}
          <CharacterSwitchModal
            open={switchOpen}
            onClose={() => setSwitchOpen(false)}
            locale={locale}
            mainCharacter={
              visitor?.pseudo ? { pseudo: visitor.pseudo, classe: visitor.classe ?? null } : null
            }
            mules={visitor?.mules ?? []}
            activePseudo={hasGuestCharacter(character) ? characterLabel : visitor?.pseudo ?? null}
            onPickMain={() => {
              setSwitchOpen(false);
              applyGuestCharacter(null);
            }}
            onPickMule={(mule) => {
              setSwitchOpen(false);
              applyGuestCharacter({
                classId: mule.classe ?? null,
                pseudo: mule.pseudo,
                serverId: visitor?.serverId ?? null,
              });
            }}
          />
          <PublicMetamobModal
            open={metamobOpen}
            onClose={() => setMetamobOpen(false)}
            metamobPseudo={visitor?.metamobPseudo ?? null}
            verified={metamob === "verified"}
          />
          {/* V2a-4 — l'alignement se règle pour TOUT LE MONDE : écrit sur le profil quand
              un compte est connecté, conservé localement (et appliqué à la route) sinon. */}
          <PublicAlignmentModal
            open={alignmentOpen}
            onClose={closeAlignmentModal}
            alignment={visitor?.alignment ?? routeCamp}
            alignmentOrder={visitor?.alignmentOrder ?? routeOrder}
            locale={locale}
            localOnly={!visitor}
            onLocalSave={handleLocalAlignment}
          />
          {/* V2a-4 — accueil de première arrivée : trois étapes qui enchaînent les deux
              sélecteurs ci-dessus. Jamais forcé : « Passer » ferme et l accueil ne revient
              plus (drapeau local). */}
          <PublicOnboardingModal
            open={onboardingStep !== null}
            step={onboardingStep ?? 1}
            locale={locale}
            onPickCharacter={() => {
              setOnboardingFlow("character");
              setOnboardingStep(null);
              setCharacterOpen(true);
            }}
            onPickAlignment={() => {
              setOnboardingFlow("alignment");
              setOnboardingStep(null);
              setAlignmentOpen(true);
            }}
            onNext={() => setOnboardingStep(2)}
            onFinish={finishOnboarding}
            onSkip={finishOnboarding}
            onBack={() =>
              setOnboardingStep((step) => (step && step > 1 ? ((step - 1) as OnboardingStep) : step))
            }
          />
        </div>

        {/* Alignement — V2a-4 : cliquable pour TOUT LE MONDE. Connecté, la modale écrit
            `PublicProfile.alignment` ; anonyme, le choix reste local et pilote la route
            (demande user : « le mode non connecté alignement pas cliquable chef »).
            Sans choix déclaré, la tuile montre ce que le guide a DÉJÀ donné (les quêtes). */}
        {(() => {
          const declared = visitor?.alignment
            ? getAlignment(visitor.alignment)
            : routeCamp
              ? getAlignment(routeCamp)
              : null;
          const label = declared?.name ?? rushView.alignment?.label ?? (locale === "en" ? "Neutral" : "Neutre");
          const tier = rushView.alignment?.level ?? 0;
          const crest = declared?.icon ?? rushView.alignment?.crestSrc ?? alignmentCrest(null);
          const body = (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={crest}
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 shrink-0 object-contain"
              />
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">
                  {locale === "en" ? "Alignment" : "Alignement"}
                </p>
                <span className="block truncate text-xs font-semibold text-foreground">
                  {label}
                  {tier > 0 && (
                    <>
                      {" "}
                      <span className="reg-mono font-normal text-muted-foreground">
                        · {locale === "en" ? "tier" : "tranche"} {tier}
                      </span>
                    </>
                  )}
                  {!declared && !rushView.alignment && (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · {locale === "en" ? "no alignment quest yet" : "aucune quête validée"}
                    </span>
                  )}
                </span>
              </div>
            </>
          );
          return (
            <button
              type="button"
              onClick={() => setAlignmentOpen(true)}
              title={locale === "en" ? "Set my alignment" : "Changer mon alignement"}
              className="-mx-1 flex min-w-0 items-center gap-2.5 rounded-[4px] px-1 py-1 text-left transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-accent/50"
            >
              {body}
            </button>
          );
        })()}

        {visitor ? (
          <span aria-hidden="true" className="hidden w-px self-stretch bg-border md:block" />
        ) : null}

        {/* Metamob — ce que le PROFIL déclare, rien de plus (V2a-3), CLIQUABLE depuis V2a-5.
            Demande du 08/11/2026 : le geste doit ouvrir la modale **ici**, « sans aller dans
            son profil ». Il ouvre `PublicMetamobModal` (composant voisin), qui porte le
            formulaire et appelle `updatePublicMetamob` : ce fichier-ci n'importe toujours
            AUCUN `@/server/` (verrou `rush-public-parity` intact). */}
        {visitor ? (
          <button
            type="button"
            onClick={() => setMetamobOpen(true)}
            className="-mx-1 flex min-w-0 items-center gap-2.5 rounded-[4px] px-1 py-1 text-left transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-accent/50"
            title={
              metamob === "none"
                ? locale === "en"
                  ? "Link my Metamob account"
                  : "Lier mon compte Metamob"
                : locale === "en"
                  ? "Manage my Metamob link"
                  : "Gérer ma liaison Metamob"
            }
          >
            {/* Asset Ocre du jeu, posé NU (le même que le guide interne). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/icons/ocre.png"
              alt=""
              aria-hidden="true"
              loading="lazy"
              className="h-8 w-8 shrink-0 object-contain"
            />
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground">Metamob</p>
              <span
                className={cn(
                  "block truncate text-xs font-semibold",
                  metamob === "none"
                    ? "text-muted-foreground underline decoration-dotted underline-offset-2"
                    : "text-foreground"
                )}
              >
                {metamob === "none"
                  ? locale === "en"
                    ? "link my Metamob →"
                    : "lier mon Metamob →"
                  : metamobLabel}
              </span>
            </div>
          </button>
        ) : null}

        {visitor ? (
          <span aria-hidden="true" className="hidden w-px self-stretch bg-border md:block" />
        ) : null}

        {/* Rush Live — l'ÉTAT RÉEL, jamais un compteur (V2a-3), et **connectés
            seulement** depuis V2a-5 : demande user « le mode non connecté n'aura juste
            pas le rush live ni metamob ». Le visiteur n'a aucune room de présence avant
            V2c (room par serveur, consentement `showPresence`) : la tuile le dit. Ce
            n'est pas un bouton : il n'y a rien à ouvrir, donc pas de contrôle mort — et
            surtout pas « 0 en ligne », qui serait un mensonge. */}
        {visitor ? (
          <div className="flex min-w-0 items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/dofus/modules/guild.png"
              alt=""
              aria-hidden="true"
              loading="lazy"
              className="h-8 w-8 shrink-0 object-contain"
            />
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground">Rush Live</p>
              <span className="block truncate text-xs font-semibold text-muted-foreground">
                {locale === "en" ? "presence unavailable" : "présence indisponible"}
              </span>
            </div>
          </div>
        ) : null}

        {visitor ? (
          <span aria-hidden="true" className="hidden w-px self-stretch bg-border md:block" />
        ) : null}

        {/* Lancer l'overlay en jeu — une seule action mise en avant par écran. Plus de
            `ml-auto` : il créait un grand vide entre « Rush Live » et le bouton (retour
            user). Le bouton suit la rangée, et l'icône est le picto RÉEL du module Guide
            (`/assets/dofus/modules/guide.png`) — plus le glyphe générique `Sparkles`. */}
        <button
          type="button"
          onClick={handleLaunchOverlay}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-[4px] bg-success px-3 py-1.5 text-xs font-medium text-success-foreground transition-colors hover:bg-success/90"
          title={
            locale === "en"
              ? "Displays a floating mini-window always on top over Dofus"
              : "Affiche une mini-fenêtre flottante toujours au premier plan par-dessus Dofus"
          }
          aria-label={locale === "en" ? "Open the overlay" : "Ouvrir l'overlay"}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/dofus/modules/guide.png"
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="h-3.5 w-3.5 shrink-0 object-contain"
          />
          <span>{locale === "en" ? "Open Overlay" : "Ouvrir Overlay"}</span>
        </button>
      </div>

      {/* ── RECHERCHE + OPTIONS — la rangée de l'anatomie interne (V2a-3) ─────
          Elle vivait plus bas, dans la colonne du détail ; le brief du 06/11 la veut
          entre le haut du panneau (tuiles) et la progression. Même état, mêmes
          gestionnaires : seul l'emplacement change. `Options` ne porte que des
          réglages qui EXISTENT côté visiteur — aujourd'hui un seul (la densité) ;
          V2a-4 y branchera « Revoir le tour ». */}
      <div className="flex flex-col gap-2 border-t border-border px-4 py-2.5 sm:flex-row sm:items-center sm:px-5">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.rushGuide.searchPlaceholder}
            aria-label={locale === "en" ? "Search the guide" : "Rechercher dans le guide"}
            className="h-9 w-full rounded-[4px] border border-border bg-surface pl-9 pr-9 text-xs text-foreground transition-colors placeholder:text-muted-foreground focus:border-accent focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label={locale === "en" ? "Clear search" : "Effacer la recherche"}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-[3px] p-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={locale === "en" ? "Guide options" : "Options du guide"}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-[4px] border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
            >
              <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Options</span>
            </button>
          </DropdownMenuTrigger>
          {/* Radix porte le menu dans `document.body` : `da-portal` lui rend le thème
              de la DA (même mécanisme que les modales du guide). */}
          <DropdownMenuContent
            {...daScope}
            align="end"
            className="da-portal min-w-[15rem] rounded-[4px] border border-border bg-background p-1.5"
          >
            <DropdownMenuItem
              onSelect={() => setHideDone((v) => !v)}
              className="flex cursor-pointer items-center gap-2.5 rounded-[4px] px-2.5 py-2"
            >
              <CheckCheck
                className={cn("h-4 w-4", hideDone ? "text-accent" : "text-muted-foreground")}
                aria-hidden="true"
              />
              <span className="text-xs font-semibold">
                {hideDone
                  ? locale === "en" ? "Show full detail" : "Afficher tout le détail"
                  : locale === "en" ? "Hide completed steps" : "Masquer les étapes faites"}
              </span>
            </DropdownMenuItem>

            {/* V2a-4 — l accueil est REJOUABLE : même modale, même drapeau, aucune donnée
                perdue. Il ne s ouvre plus tout seul une fois le drapeau posé. */}
            <DropdownMenuItem
              onSelect={() => setOnboardingStep(1)}
              className="flex cursor-pointer items-center gap-2.5 rounded-[4px] px-2.5 py-2"
            >
              <HelpCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-xs font-semibold">
                {locale === "en" ? "Replay the welcome tour" : "Revoir l accueil"}
              </span>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1 h-px bg-border" />

            {/* « Ma cité » — sortie du bandeau en V2a-5 (demande user : « le bandeau avec
                les trois alignements doit disparaître »). Le choix pilote TOUJOURS la
                route (`resolveRushRoute`) : il ne disparaît pas, il descend d'un cran.
                Sous-menu radio : clavier et `aria-checked` gérés par Radix. */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="flex cursor-pointer items-center justify-between gap-2.5 rounded-[4px] px-2.5 py-2 text-xs font-semibold">
                <span className="flex items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ROUTE_CAMPS.find((c) => c.value === routeCamp)?.icon ?? "/ordres/neutre.png"}
                    alt=""
                    aria-hidden="true"
                    className="h-4 w-4 object-contain"
                  />
                  {locale === "en" ? "My city" : "Ma cité"}
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent
                {...daScope}
                className="da-portal min-w-[12rem] rounded-[4px] border border-border bg-background p-1.5"
              >
                <DropdownMenuLabel className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {locale === "en" ? "My city" : "Ma cité"}
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={routeCamp ?? "neutre"}
                  onValueChange={(value) =>
                    handleRouteChange(
                      (value === "neutre" ? null : value) as "bontarien" | "brakmarien" | null
                    )
                  }
                >
                  {ROUTE_CAMPS.map((camp) => (
                    <DropdownMenuRadioItem
                      key={camp.value ?? "neutre"}
                      value={camp.value ?? "neutre"}
                      className="cursor-pointer gap-2 rounded-[4px] px-2.5 py-1.5 text-xs font-semibold"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={camp.icon} alt="" aria-hidden="true" className="h-3.5 w-3.5 object-contain" />
                      {camp.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── PROGRESSION — UNE seule barre, pleine largeur ────────────────────
          Elle vivait en 160 px dans la rangée d'actions, et un second
          `reg-progress` la répétait plus bas : mesuré le 05/11/2026, deux
          barres pour la même donnée. Il n'en reste qu'une. */}
      <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-2.5 sm:px-5">
        <span className="text-[11px] text-muted-foreground">
          {locale === "en" ? "Local progress" : "Progression locale"}
        </span>
        <span className="reg-mono text-sm tabular-nums text-foreground">{progressPercent} %</span>
        <span className="reg-mono text-xs tabular-nums text-muted-foreground">
          ({completedCount} / {totalSequences} {locale === "en" ? "steps" : "étapes"})
        </span>
        <div
          className="h-1.5 min-w-[8rem] flex-1 overflow-hidden rounded-[2px] bg-elevated"
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={locale === "en" ? "Guide progress" : "Progression du guide"}
        >
          <span className="block h-full bg-success transition-all duration-300" style={{ width: `${progressPercent}%` }} />
        </div>
        <ResetProgressButton
          onReset={handleResetProgress}
          label={locale === "en" ? "Reset progress" : "Réinitialiser la progression"}
          confirmLabel={locale === "en" ? "Erase everything?" : "Effacer toute la progression ?"}
          yesLabel={locale === "en" ? "Yes, erase all" : "Oui, tout effacer"}
          cancelLabel={locale === "en" ? "Cancel" : "Annuler"}
        />
      </div>
    </div>
      </header>
      {/* ── PROGRESSION COMMUNAUTAIRE (V2a-2) — visiteurs du même serveur qui ont coché
          « Publier ma progression de rush » (D-V21). Pleine largeur, sous le bloc Progression.
          Absente pour l anonyme : le serveur se résout côté serveur, jamais depuis le navigateur. */}
      {isConnected ? (
        <div className="px-4 pb-4 sm:px-5 lg:px-6">
          <PublicCommunityPanel milestones={rawMilestones} />
        </div>
      ) : null}
      <div className="da-guide-grid">
        {/* Sommaire : colonne de gauche, au langage du dock. Le MÊME composant
            servira au guide interne (E4) : aucune variante « public ». */}
        <RushChapterNav
          milestones={milestones}
          completedSeqIds={completedSeqIds}
          selectedChapter={currentPage?.ms.chapter ?? "ALL"}
          onSelectChapter={(chapter) => {
            const idx = chapterPages.findIndex((p) => chapter === "ALL" || p.ms.chapter === chapter);
            if (idx >= 0) goToChapterPage(idx);
          }}
        />
        <div className="da-guide-main">
      {/* ── COLONNE DU DÉTAIL ─────────────────────────────────────────────────
          Le champ « Rechercher une quête » et l'interrupteur de densité ont rejoint
          le panneau du haut en V2a-3 (anatomie du guide interne) : un seul état
          `searchQuery`, un seul endroit pour le saisir — pas deux champs pour la
          même recherche.
          ⚠️ Cette colonne n'est PAS collante (mesure du 22/09 : une barre collante
          de 337 px recouvrait le rail) : c'est le rail de droite qui reste affiché
          pendant la lecture du chapitre. */}

      {/* ── CHAPTERS & QUEST BLOCKS ── */}
      {/* ── LE DÉTAIL, CHAPITRE PAR CHAPITRE ──
          La vue ci-dessus dit où l'on en est ; ici, le contenu complet : chaque
          quête, chaque étape, ses tags, ses donjons. */}
      <h2 className="reg-eyebrow mb-4" id="guide-detail">Le détail, chapitre par chapitre</h2>

      {/* ── SOMMAIRE SUPPRIMÉ (retour user 22/09 : « vire aussi le sommaire inutile »).
          Il ne portait que la liste des chapitres et leur avancement : deux
          informations déjà rendues par le rail de droite (`RushChapterSidebar` :
          chapitres, avancement « n/N » par chapitre, clic = navigation) et par le
          pager haut/bas. Les ancres `#bloc-<id>` restent posées sur chaque bloc de
          chapitre : les liens partagés continuent de fonctionner. */}

      {/* ── PAGER (haut) : on enchaîne les chapitres sans remonter la page. ── */}
      {!isSearching && chapterPages.length > 1 && currentPage && (
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-3">
          <button
            type="button"
            disabled={currentPageIndex <= 0}
            onClick={() => goToChapterPage(currentPageIndex - 1)}
            className="rounded-[3px] border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 cursor-pointer disabled:cursor-default"
          >
            ‹ Précédent
          </button>
          <span className="min-w-0 text-center">
            <span className="reg-mono text-[11px] text-muted-foreground">
              {currentPageIndex + 1} / {chapterPages.length}
            </span>
            <span className="block truncate text-[13px] font-bold text-foreground">{currentPage.ms.title}</span>
          </span>
          <button
            type="button"
            disabled={currentPageIndex >= chapterPages.length - 1}
            onClick={() => goToChapterPage(currentPageIndex + 1)}
            className="rounded-[3px] border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 cursor-pointer disabled:cursor-default"
          >
            Suivant ›
          </button>
        </div>
      )}

      {/* ── CONTENU + PANNEAU DE DROITE ──
          Même grammaire que le guide interne : le contenu du chapitre à gauche, la
          sidebar PARTAGÉE à droite (chapitres, progression, donjons & métiers à
          prévoir, objets requis avec bascule Restantes/Toutes). Sur petit écran elle
          passe sous le contenu — aucune information perdue, aucun doublon de rendu. */}
      <div className="min-w-0 space-y-6">
        {visibleMilestones.map((ms) => {
          const msIndex = milestones.indexOf(ms);
          const isDone = completedIds.has(ms.id);
          const isExpanded = isSearching || expandedMs.has(ms.id);
          const doneSteps = completedStepsByMs.get(ms.id) || new Set();
          const sequences = ms.sequences || [];
          // Étapes RÉELLEMENT cochables : les encarts info ne comptent pas dans la
          // progression (ni « n/N », ni pourcentage, ni « toutes les étapes »).
          const chapterSteps = sequences.filter((s) => !isInfoSequence(s));

          // Regroupement des séquences en blocs de quête (encarts info compris : ils se
          // lisent à leur place dans le flux).
          let questBlocks = groupSequencesIntoQuests(sequences, doneSteps);

          // Filtrage par recherche
          if (searchQuery.trim().length > 0) {
            const q = searchQuery.toLowerCase();
            questBlocks = questBlocks.filter(
              (b) =>
                b.questName.toLowerCase().includes(q) ||
                b.sequences.some(
                  (s) =>
                    (s.tips && s.tips.toLowerCase().includes(q)) ||
                    (s.note && s.note.toLowerCase().includes(q)) ||
                    (s.dungeons && s.dungeons.some((d) => d.name.toLowerCase().includes(q)))
                )
            );
          }

          // Filtrage « masquer ce qui est terminé » (même état que la vue partagée)
          if (hideDone) {
            questBlocks = questBlocks.filter((b) => !b.isDone);
          }

          if (questBlocks.length === 0 && (searchQuery.trim().length > 0 || hideDone)) {
            return null;
          }

          const msDoneCount = chapterSteps.filter((s) => doneSteps.has(s.id)).length;
          const msPercent = chapterSteps.length > 0 ? Math.round((msDoneCount / chapterSteps.length) * 100) : 0;
          const chapterDofusImg = resolveDofusLocalImage(ms.title);

          // Séparateur de chapitre majeur — le MÊME bandeau que le dashboard membre
          // (composant partagé) : filet d'accent, eyebrow mono, titre fort, description,
          // et l'image du bloc à droite quand le GOD en a posé une.
          if (ms.type === "SEPARATEUR") {
            return (
              // L'ancre partageable `#bloc-<id>` (sommaire + hash d'URL) doit survivre : le
              // bandeau reste donc dans un conteneur porteur de l'identifiant.
              <div key={ms.id} id={`bloc-${ms.id}`}>
                <RushSeparatorBanner
                  title={ms.title}
                  description={ms.description}
                  imageUrl={ms.imageUrl}
                  accentColor={ms.accentColor}
                  surface="page"
                />
              </div>
            );
          }

          // Bloc CONSEIL / TIPS : le MÊME bandeau que le dashboard membre (composant partagé).
          // Avant, le guide public le rendait comme un CHAPITRE (« Chapitre 0 · 0/0 étapes
          // (0%) » avec un bouton « Tout valider » qui ne pouvait rien valider) : deux rendus
          // pour un même bloc dans un guide partagé — c'est ce qui est corrigé ici.
          if (ms.type === "INFO") {
            const infoText = ms.tips || ms.description || ms.title || "";
            const infoTitle = ms.title && !infoText.startsWith(ms.title) ? ms.title : null;
            return (
              <div key={ms.id} id={`bloc-${ms.id}`}>
                <RushInfoBanner
                  title={infoTitle}
                  imageUrl={ms.imageUrl}
                  accentColor={ms.accentColor}
                >
                  <RushRichText text={infoText} normalizeMeta />
                </RushInfoBanner>
              </div>
            );
          }

          return (
            <div
              key={ms.id}
              id={`bloc-${ms.id}`}
              className={cn(
                "reg-panel-strong overflow-hidden transition-colors",
                isDone ? "border-success/30 opacity-80" : "border-border"
              )}
            >
              {/* Chapter Header */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-4 sm:p-6 border-b border-border gap-4 bg-elevated">
                <button
                  type="button"
                  onClick={() => toggleChapter(ms.id)}
                  className="flex items-center gap-4 min-w-0 text-left flex-1"
                >
                  {/* Le Dofus est servi NU : les PNG sont transparents, donc aucune tuile et
                      aucune teinte (une couleur par item est une décoration, pas une donnée).
                      Le chapitre sans Dofus porte son numéro en mono — sans boîte non plus. */}
                  <div className="w-11 h-11 flex items-center justify-center shrink-0">
                    {chapterDofusImg ? (
                      <img src={chapterDofusImg} alt={ms.title} className="w-9 h-9 object-contain" />
                    ) : (
                      <span className="reg-mono text-sm text-muted-foreground">{msIndex + 1}</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        {ms.chapterLabel || `Chapitre ${ms.chapter}`}
                      </span>
                      {chapterDofusImg && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <img src={chapterDofusImg} alt="" className="w-3 h-3 object-contain" />
                          Dofus en jeu
                        </span>
                      )}
                      <span className="reg-mono text-xs text-muted-foreground">
                        {msDoneCount} / {chapterSteps.length} étapes ({msPercent}%)
                      </span>
                    </div>
                    <h2 className="mt-0.5 truncate text-base font-bold text-foreground sm:text-lg">
                      {ms.title}
                    </h2>
                  </div>
                  {/* Image immersive du bloc — importée côté GOD (tous types), servie NUE
                      dans le flux, à droite, avec un fondu : elle ne crée ni cadre ni trou.
                      Si l'URL ne répond pas (401/404), l'image se retire au lieu de laisser
                      le cadre cassé du navigateur. */}
                  {ms.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ms.imageUrl}
                      alt=""
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      className="hidden md:block h-12 w-32 object-cover shrink-0"
                      style={{
                        maskImage: "linear-gradient(to left, rgba(0,0,0,0.95), transparent)",
                        WebkitMaskImage: "linear-gradient(to left, rgba(0,0,0,0.95), transparent)",
                      }}
                    />
                  )}

                  <ChevronDown
                    className={cn(
                      "w-5 h-5 text-muted-foreground transition-transform duration-200 shrink-0",
                      isExpanded && "rotate-180"
                    )}
                    aria-hidden="true"
                  />
                </button>

                {/* Quick Chapter Action: Mark all done */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleChapterAll(ms.id, !isDone)}
                    className="rounded-md border border-border bg-surface px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {isDone ? "Tout décocher" : "Tout valider ✓"}
                  </button>
                </div>
              </div>

              {/* Progress bar du chapitre */}
              <div
                className="reg-progress rounded-none"
                role="progressbar"
                aria-valuenow={msPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progression — ${ms.title}`}
              >
                <span style={{ width: `${msPercent}%` }} />
              </div>

              {/* Chapter Sequences & Quest Blocks */}
              {isExpanded && (
                // 🔁 22/09/2026 (retour user : « je veux la même largeur pour les quêtes déroulées
                // d'un bloc que les blocs eux-mêmes »). Mesure navigateur : ce conteneur portait
                // `p-4 sm:p-6` ⇒ les blocs d'étapes étaient **insetés de 16 à 24 px** de chaque côté
                // par rapport au panneau du chapitre. On ne garde que l'espace VERTICAL : les blocs
                // d'étapes épousent désormais exactement la largeur du bloc chapitre.
                <DaRail className="py-4 sm:py-5 space-y-5">
                  {questBlocks.length === 0 ? (
                    <p className="py-4 text-xs text-muted-foreground">
                      Aucune étape correspondante.
                    </p>
                  ) : (
                    questBlocks.map((block, blockIdx) => {
                      const questDofusImg = resolveDofusLocalImage(block.questName) || resolveDofusLocalImage(ms.title);
                      // Les encarts info ne sont pas des étapes : ils ne comptent ni dans
                      // l'en-tête (« n/N »), ni dans « Valider tout le bloc », ni dans le
                      // repère — mais ils gardent leur place dans le flux.
                      const blockSteps = block.sequences.filter((s) => !isInfoSequence(s));
                      const hasSteps = blockSteps.length > 0;
                      // Éléments réellement affichés (étapes + encarts, dans l'ordre du guide).
                      const blockItems = block.sequences.filter((s) => !hideDone || !doneSteps.has(s.id));
                      // Bloc mono-étape : pas d'en-tête redondant, la ligne-carte porte le nom (comme le guide interne)
                      const isSingleStep = blockSteps.length === 1;
                      return (
                      <div
                        key={`${block.questRef}-${blockIdx}`}
                        className={cn(
                          // DA : le panneau de quête n'est plus une BOÎTE (pas de boîte dans
                          // la boîte) — c'est `.da-card`, portée par chaque étape, qui dessine
                          // le cadre. Le bloc ne garde qu'un en-tête de quête et son fil.
                          // `relative z-[1]` : sans position, ce bloc passait DERRIÈRE le fil de
                          // sève (pseudo-élément positionné du rail) — le fil traversait le texte.
                          "relative z-[1] transition-colors",
                          block.isDone && "opacity-70"
                        )}
                      >
                        {/* ── EN-TÊTE DU BLOC DE QUÊTE (multi-étapes uniquement) ── */}
                        {hasSteps && !isSingleStep && (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border px-1 py-2.5">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {questDofusImg ? (
                              <img
                                src={questDofusImg}
                                alt="Dofus"
                                className="w-5 h-5 object-contain shrink-0"
                              />
                            ) : (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src="/assets/icons/icone-quete.png" alt="" className="w-5 h-5 object-contain opacity-90 shrink-0" loading="lazy" />
                            )}
                            {(() => {
                              const primaryUrl = block.dofuspourlesnoobsUrl || block.dofusdbUrl || null;
                              const cls = "text-xs sm:text-sm font-semibold truncate";
                              if (primaryUrl) {
                                return (
                                  <h4 className={cls}>
                                    <a
                                      href={primaryUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="hover:text-warning transition-colors"
                                      title={`Ouvrir sur ${block.dofuspourlesnoobsUrl ? "DofusPourLesNoobs" : "DofusDB"}`}
                                    >
                                      {block.questName}
                                    </a>
                                  </h4>
                                );
                              }
                              return <h4 className={`${cls} text-foreground`}>{block.questName}</h4>;
                            })()}

                            <span className="reg-mono text-xs text-muted-foreground shrink-0">
                              {block.doneCount} / {block.totalCount}
                            </span>
                          </div>
                          {(() => {
                            const bmSeqId = bookmarksByMs.get(ms.id) || null;
                            const bmInBlock = bmSeqId && blockSteps.some((s) => s.id === bmSeqId);
                            const firstUndone = blockSteps.find((s) => !doneSteps.has(s.id));
                            return (
                              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                {!block.isDone && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleBlockSteps(ms.id, blockSteps.map((s) => s.id), true)}
                                    className="inline-flex items-center gap-1 rounded-md border border-success/40 px-2.5 py-1.5 text-xs font-semibold text-success transition-colors hover:bg-success/10"
                                    title="Valider toutes les étapes du bloc"
                                  >
                                    <Check className="w-3.5 h-3.5" aria-hidden="true" />Valider
                                  </button>
                                )}
                                {(bmInBlock || firstUndone) && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleBookmark(ms.id, bmInBlock ? (bmSeqId as string) : (firstUndone as RushSequence).id)}
                                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors ${bmInBlock ? "border-warning/40 bg-warning/10 text-warning" : "border-border bg-surface text-muted-foreground hover:border-warning/40 hover:text-warning"}`}
                                    title={bmInBlock ? "Retirer le repère « Je suis ici »" : "Poser « Je suis ici » sur la prochaine étape du bloc"}
                                  >
                                    {bmInBlock ? <BookmarkCheck className="w-3.5 h-3.5 text-warning" /> : <Flag className="w-3.5 h-3.5 text-warning" />}<span>{bmInBlock ? "Repère" : "Je suis ici"}</span>
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        )}

                        {/* ── ÉTAPES DE LA QUÊTE ──
                            Le fil de sève est porté par le chapitre entier (un seul rail) :
                            ici on ne garde que la liste, sans padding horizontal, pour que les
                            nœuds soient alignés sur le tracé. */}
                        <div className={blockItems.length > 1 ? "py-2 pr-2 sm:py-3 sm:pr-3 space-y-2.5" : "py-2 pr-2 sm:py-3 sm:pr-3"}>
                          {blockItems.map((seq) => {
                            const stepDone = doneSteps.has(seq.id);
                            // Verrou de prérequis (même règle que le guide interne) : la case
                            // devient inerte, la carte passe en danger, le prérequis est nommé.
                            const prereqLocked = !stepDone && isStepLocked(seq.id);
                            const dungeonLocked = !stepDone && isSeqBlockedByDungeon(seq.id);
                            const stepLocked = prereqLocked || dungeonLocked;
                            const prereqRefs = prereqLocked ? getPrereqRefs(seq, milestones) : [];
                            // Donjons : pastille + panneau local, état par OCCURRENCE.
                            const seqDungeonReqs = resolveSequenceDungeons(
                              seq,
                              doneDungeonKeysForSequence(dungeonStates, seq.id)
                            ).requirements;
                            const seqDungeonCount = seqDungeonReqs.length;
                            const doneDungeonsForSeq = seqDungeonReqs.filter((r) => r.isDone).length;
                            // Donjons REQUIS manquants de CETTE quête (nommés, cliquables).
                            const missingDungeons = dungeonLocked
                              ? seqDungeonReqs.filter((r) => !r.isOptional && !r.isDone)
                              : [];
                            const parsedCoord = getSequenceCoord(seq);

                            // Encart informatif : jamais cochable, aucune progression — le
                            // MÊME bandeau que le dashboard et l'overlay (composant partagé).
                            if (isInfoSequence(seq)) {
                              return <RushInfoSequenceBanner key={seq.id} seq={seq} accentColor={ms.accentColor} />;
                            }

                            // Extraction et séparation des tags d'items pour ne PAS polluer la ligne
                            const allTags = seq.activityTags || [];
                            const itemTags = allTags.filter((t) => t.type === "item");

                            const hasManyItems = itemTags.length > 0;
                            const isResourceExpanded = expandedResourceSteps.has(seq.id);
                            const isBookmarked = bookmarksByMs.get(ms.id) === seq.id;
                            const isPrepResources = block.questName === "Ressources à prévoir" || seq.subGuideName === "Ressources à prévoir";

                            if (isPrepResources) {
                              return (
                                <div key={seq.id} className="p-4 reg-panel bg-surface space-y-3">
                                  <div className="flex items-center justify-between gap-3 pb-2 border-b border-border">
                                    <div className="flex items-center gap-3">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleStep(ms.id, seq.id)}
                                        aria-label={stepDone ? "Décocher" : "Valider cette préparation"}
                                        className={cn(
                                          "w-5 h-5 rounded-[3px] border flex items-center justify-center shrink-0 transition-colors cursor-pointer",
                                          stepDone
                                            ? "border-success/70 text-success"
                                            : "border-border hover:border-success"
                                        )}
                                      >
                                        {stepDone && <Check className="w-3.5 h-3.5 stroke-[2]" />}
                                      </button>
                                      <div>
                                        <h5 className="text-xs font-bold text-foreground">
                                          Ressources requises pour l'ensemble du parcours
                                        </h5>
                                        <p className="text-[11px] text-muted-foreground">
                                          Préparez ces ressources à l'avance pour enchaîner les étapes sans faire d'allers-retours en HDV.
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                  <QuestItemResourceGrid
                                    items={itemTags}
                                    completedIds={completedItemKeys}
                                    hideProvided={hideDone}
                                    checkedKeys={resourceChecks}
                                    onToggleCheck={handleToggleResourceCheck}
                                  />
                                </div>
                              );
                            }

                            // DA « Gouache Wakfu » : l'état de la quête est un ATTRIBUT, peint
                            // par `da-wakfu.css` (`done` / `locked` / `next` / `todo`). Le nœud
                            // sort de la carte, comme dans l'overlay — même grammaire, mêmes
                            // couleurs, même filet teinté par le bloc.
                            const daState = stepDone
                              ? "done"
                              : stepLocked
                                ? "locked"
                                : activeObjective?.id === seq.id && activeObjective?.blockId === ms.id
                                  ? "next"
                                  : "todo";
                            return (
                              <div
                                key={seq.id}
                                data-seq-id={seq.id}
                                className="da-row"
                                data-state={daState}
                              >
                                {/* Le NŒUD est le bouton de coche lui-même : même handler, même
                                    `aria-label`, même garde `stepLocked`. Seul son habillage change. */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleStep(ms.id, seq.id)}
                                  disabled={stepLocked}
                                  aria-label={stepDone ? "Décocher" : stepLocked ? "Quête verrouillée" : "Valider cette étape"}
                                  title={
                                    prereqLocked
                                      ? "Prérequis non terminé — valide d'abord les quêtes citées sous la ligne."
                                      : dungeonLocked
                                        ? "Donjon requis non fait — coche-le sur la pastille Donjon de cette quête."
                                        : undefined
                                  }
                                  className="da-node"
                                >
                                  {stepDone && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
                                  {stepLocked && <Lock className="h-3 w-3 stroke-[2]" aria-hidden="true" />}
                                </button>

                                <div className="da-card">
                                {/* Colonne : `.da-card` est un flex HORIZONTAL (une seule ligne
                                    dans l'overlay). Le guide y empile plusieurs blocs (ligne,
                                    verrou, conseils, ressources) : sans ce wrapper ils se
                                    posaient côte à côte et se recouvraient (mesure du 05/11). */}
                                <div className="flex min-w-0 flex-1 flex-col gap-2">
                                {/* Ligne principale de l'étape */}
                                <div className="flex min-w-0 flex-1 flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                  {/* Titre et indicateurs */}
                                  <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {activeObjective?.id === seq.id && activeObjective?.blockId === ms.id && !stepDone && (
                                          <span className="reg-mono shrink-0 text-[11px] text-muted-foreground">à faire</span>
                                        )}
                                        {/* Icône de la quête : type choisi en God, repli glyphe générique */}
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={resolveRushSeqIcon((seq as any).icon) ?? "/assets/icons/icone-quete.png"}
                                          alt=""
                                          className="h-4 w-4 shrink-0 self-center object-contain opacity-90"
                                          loading="lazy"
                                        />
                                        {/* Nom de quête (blocs mono-étape : pas d'en-tête, la ligne porte le nom) */}
                                        {isSingleStep && (
                                          <>
                                            {(() => {
                                              const primaryUrl = (seq as any).dofuspourlesnoobsUrl || (seq as any).dofusdbUrl || block.dofuspourlesnoobsUrl || block.dofusdbUrl || null;
                                              // `min-w` : dans un `flex-wrap` bourré de chips `shrink-0`, le nom
                                              // est le SEUL élément compressible — il s'écrasait à un caractère par
                                              // ligne (mesure du 05/11/2026). Une base de 12 rem force les chips à
                                              // passer à la ligne suivante, jamais à manger le titre.
                                              const cls = "text-[13px] font-semibold leading-snug break-words min-w-[12rem] flex-1";
                                              if (primaryUrl) {
                                                return (
                                                  <a
                                                    href={primaryUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className={`${cls} text-foreground hover:text-warning transition-colors`}
                                                    title={`Ouvrir sur ${(seq as any).dofuspourlesnoobsUrl || block.dofuspourlesnoobsUrl ? "DofusPourLesNoobs" : "DofusDB"}`}
                                                  >
                                                    {block.questName}
                                                  </a>
                                                );
                                              }
                                              return <span className={`${cls} text-foreground`}>{block.questName}</span>;
                                            })()}
                                          </>
                                        )}
                                        {/* Pastille donjon : ouvre les DEUX coches de CETTE quête.
                                            Même geste que l'overlay et le dashboard interne. */}
                                        {seqDungeonCount > 0 && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setOpenDungeonPanel((cur) => (cur === seq.id ? null : seq.id));
                                            }}
                                            aria-expanded={openDungeonPanel === seq.id}
                                            aria-label={`Donjons de cette quête (${doneDungeonsForSeq}/${seqDungeonCount} faits)`}
                                            title="Donjons de cette quête — cliquer pour cocher fait / à faire"
                                            className="inline-flex shrink-0 items-center gap-1 rounded-[4px] border border-warning/40 px-1.5 py-0.5 text-[11px] font-semibold text-warning transition-colors hover:bg-warning/10"
                                          >
                                            {/* Picto RÉEL du jeu (même asset que le tag « Donjon requis »). */}
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                              src={RUSH_ACTIVITY_TAG_CONFIG.donjon.imagePath}
                                              alt=""
                                              aria-hidden="true"
                                              loading="lazy"
                                              className="h-3 w-3 object-contain"
                                            />
                                            Donjon ×{seqDungeonCount}
                                            {doneDungeonsForSeq > 0 && (
                                              <span className="font-mono text-[10px] text-success">
                                                {doneDungeonsForSeq}/{seqDungeonCount}
                                              </span>
                                            )}
                                          </button>
                                        )}
                                        {parsedCoord && (
                                          <RushCoordinateChip coordText={parsedCoord.raw} showZaap={isZaapCopyEnabled(seq as any)} manualZaap={getSequenceManualZaap(seq as any)} />
                                        )}
                                        {(() => {
                                          const npc = getSequenceNpc(seq as any);
                                          if (!npc || (!npc.name && npc.id === null)) return null;
                                          return <NpcBadge npcId={npc.id} name={npc.name} imageUrl={npc.imageUrl} size="md" />;
                                        })()}
                                        {/* Quête d'alignement (détail complet en modale) */}
                                        {(() => {
                                          const align = getAlignmentSet(seq as any);
                                          if (!align) return null;
                                          const label = align.camp === "brakmarien" ? "Brakmarien" : align.camp === "bontarien" ? "Bontarien" : align.camp;
                                          return (
                                            <span
                                              className="inline-flex items-center gap-1 shrink-0 text-[11px] text-muted-foreground"
                                              title={`Quête d'alignement → ${label}`}
                                            >
                                              {/* eslint-disable-next-line @next/next/no-img-element */}
                                              <img
                                                src={align.camp === "brakmarien" ? "/ordres/brakmar.png" : "/ordres/bonta.png"}
                                                alt=""
                                                className="h-3 w-3 shrink-0 object-contain"
                                              />
                                              Alignement {label}
                                            </span>
                                          );
                                        })()}

                                        {seq.isSuccess && (
                                          <span className="text-[11px] font-semibold text-warning">
                                            Succès
                                          </span>
                                        )}

                                        {seq.isOptional && (
                                          <span className="text-[11px] text-muted-foreground">
                                            Bonus
                                          </span>
                                        )}

                                        {/* Bouton condensé si des ressources sont requises */}
                                        {hasManyItems && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setExpandedResourceSteps((prev) => {
                                                const next = new Set(prev);
                                                next.has(seq.id) ? next.delete(seq.id) : next.add(seq.id);
                                                return next;
                                              });
                                            }}
                                            className={cn(
                                              "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer",
                                              isResourceExpanded
                                                ? "border-warning/40 bg-warning/10 text-warning"
                                                : "border-border bg-surface text-muted-foreground hover:text-foreground"
                                            )}
                                          >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={RUSH_RESOURCES_PICTO} alt="" aria-hidden="true" loading="lazy" className="w-3 h-3 object-contain" />
                                            <span>{itemTags.length} ressource{itemTags.length > 1 ? "s" : ""}</span>
                                            {isResourceExpanded ? (
                                              <ChevronUp className="w-3 h-3" />
                                            ) : (
                                              <ChevronDown className="w-3 h-3" />
                                            )}
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Barre d'Actions d'Étape (Capture 4 : Coordonnées, Boss cliquable, Favicons DofusDB/DPNL, Bookmark, Détails) */}
                                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center flex-wrap">
                                    {/* Groupe d'actions 4 boutons (comme le guide interne) */}
                                    <div className="flex items-center gap-0.5 rounded-[4px] border border-border bg-surface p-0.5">
                                      {/* Soluce DofusPourLesNoobs — logo servi en local, aucune requête vers google.com/s2/favicons */}
                                      {(() => {
                                        const icon = brandIconForUrl(seq.dofuspourlesnoobsUrl);
                                        if (!seq.dofuspourlesnoobsUrl || !icon) return null;
                                        return (
                                          <a
                                            href={seq.dofuspourlesnoobsUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="rounded-[3px] p-1.5 transition-colors hover:bg-elevated"
                                            title={`Soluce ${icon.label}`}
                                          >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={icon.src} alt="" className="h-3.5 w-3.5 rounded-[3px]" loading="lazy" />
                                          </a>
                                        );
                                      })()}

                                      {/* Fiche DofusDB — même logo local */}
                                      {(() => {
                                        const icon = brandIconForUrl(seq.dofusdbUrl);
                                        if (!seq.dofusdbUrl || !icon) return null;
                                        return (
                                          <a
                                            href={seq.dofusdbUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="rounded-[3px] p-1.5 transition-colors hover:bg-elevated"
                                            title={`Fiche ${icon.label}`}
                                          >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={icon.src} alt="" className="h-3.5 w-3.5 rounded-[3px]" loading="lazy" />
                                          </a>
                                        );
                                      })()}

                                      {/* Bouton Drapeau Repère (Je suis ici) */}
                                      <button
                                        type="button"
                                        onClick={() => handleToggleBookmark(ms.id, seq.id)}
                                        className={cn(
                                          "p-1.5 rounded-[3px] transition-colors cursor-pointer",
                                          isBookmarked
                                            ? "text-warning bg-warning/15"
                                            : "text-muted-foreground hover:text-warning hover:bg-elevated"
                                        )}
                                        title={isBookmarked ? "Retirer le repère" : "Je suis ici (Repère)"}
                                      >
                                        {isBookmarked ? (
                                          <BookmarkCheck className="w-3.5 h-3.5" />
                                        ) : (
                                          <Flag className="w-3.5 h-3.5" />
                                        )}
                                      </button>

                                      {/* Bouton Détails (i) -> ouvre la modale dédiée.
                                          Masqué quand la quête est verrouillée : la seule
                                          action utile d'une carte bloquée est le lien vers
                                          la quête à terminer (retour user 21/10/2026). */}
                                      {!stepLocked && (
                                        <button
                                          type="button"
                                          onClick={() => setDetailModalSeq({ milestone: ms, sequence: seq })}
                                          className="p-1.5 rounded-[3px] text-muted-foreground hover:text-foreground hover:bg-elevated transition-colors cursor-pointer"
                                          title="Voir les détails complets de l'étape"
                                        >
                                          <Info className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* ── VERROU : prérequis non terminés ──
                                    Même rendu que le guide interne (danger, cadenas,
                                    prérequis nommés et cliquables) : le public disait
                                    seulement « Rien ne bloque » alors que l'interne
                                    refusait la validation. */}
                                {stepLocked && (
                                  <div className="flex flex-wrap items-center gap-1.5 border-t border-danger/20 pt-2">
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-danger">
                                      <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
                                      {prereqLocked ? "À terminer avant :" : "Donjon requis à faire :"}
                                    </span>
                                    {!prereqLocked ? (
                                      <button
                                        type="button"
                                        onClick={() => setOpenDungeonPanel(seq.id)}
                                        className="rounded-[3px] border border-danger/40 bg-danger/10 px-1.5 py-0.5 text-[11px] font-medium text-danger transition-colors hover:bg-danger/20 cursor-pointer"
                                        title="Ouvrir les donjons du guide"
                                      >
                                        {missingDungeons.map((d) => d.name).join(", ") || "Donjon requis"}
                                      </button>
                                    ) : prereqRefs.length === 0 ? (
                                      <span className="text-[11px] text-muted-foreground">
                                        quête prérequis non listée dans ce guide
                                      </span>
                                    ) : (
                                      prereqRefs.map((p) => (
                                        <button
                                          key={p.seqId}
                                          type="button"
                                          onClick={() => scrollToStep(p.seqId)}
                                          className="rounded-[3px] border border-danger/40 bg-danger/10 px-1.5 py-0.5 text-[11px] font-medium text-danger transition-colors hover:bg-danger/20 cursor-pointer"
                                          title={`Aller à : ${p.name}`}
                                        >
                                          {p.name}
                                        </button>
                                      ))
                                    )}
                                  </div>
                                )}

                                {/* ── DONJONS DE LA QUÊTE : panneau local, ouvert depuis la
                                    pastille. Aucune fenêtre globale, aucun onglet dans la barre. ── */}
                                {openDungeonPanel === seq.id && seqDungeonCount > 0 && (
                                  <RushQuestDungeonsPanel
                                    seq={seq}
                                    guildId="public"
                                    states={dungeonStates}
                                    busyKey={null}
                                    onSet={handleSetDungeonState}
                                    onClose={() => setOpenDungeonPanel(null)}
                                  />
                                )}

                                {/* Conseils & notes dépliables (comme le guide interne) */}
                                {(seq.tips || seq.note) && (() => {
                                  const isHintsOpen = expandedHintsSteps.has(seq.id);
                                  const toggleHints = () => {
                                    setExpandedHintsSteps((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(seq.id)) next.delete(seq.id);
                                      else next.add(seq.id);
                                      return next;
                                    });
                                  };
                                  const parts = (seq.tips || "").split(/·?\s*Succès\s*:\s*/i);
                                  const mainTip = parts[0]?.trim();
                                  const succesPart = parts[1]?.trim();
                                  return (
                                    <div className="border-t border-border">
                                      <button
                                        type="button"
                                        onClick={toggleHints}
                                        aria-expanded={isHintsOpen}
                                        className={cn(
                                          "flex w-full items-center gap-1.5 px-2.5 py-2 text-[11px] font-semibold transition-colors",
                                          isHintsOpen ? "text-warning" : "text-warning/90 hover:text-warning"
                                        )}
                                      >
                                        <Lightbulb className="h-3 w-3 shrink-0" aria-hidden="true" />
                                        {isHintsOpen ? "Masquer" : "Conseils & notes"}
                                        <ChevronDown
                                          className={`ml-auto h-3 w-3 transition-transform duration-150 ${isHintsOpen ? "rotate-180" : ""}`}
                                          aria-hidden="true"
                                        />
                                      </button>
                                      {isHintsOpen && (
                                        <div className="space-y-1.5 px-2.5 pb-2.5">
                                          {mainTip && (
                                            <p className={cn("text-xs leading-relaxed text-muted-foreground", stepDone && "line-through")}>
                                              <RushRichText text={mainTip} />
                                            </p>
                                          )}
                                          {succesPart && (
                                            <div className="flex items-center gap-1.5">
                                              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-warning">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src="/assets/dofus/game-icons/trophy-1.png" alt="" className="h-3 w-3 shrink-0 object-contain" />
                                                Succès : <RushRichText text={succesPart} />
                                              </span>
                                            </div>
                                          )}
                                          {seq.note && (
                                            <p className="text-[11px] leading-relaxed text-muted-foreground">
                                              Note : {seq.note}
                                            </p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}

                                {/* Panneau déroulant des ressources de l'étape (si déplié) */}
                                {hasManyItems && isResourceExpanded && (
                                  <div className="pt-2 border-t border-border">
                                    <QuestItemResourceGrid
                                      items={itemTags}
                                      completedIds={completedItemKeys}
                                      hideProvided={hideDone}
                                      showHeaderMeta={false}
                                      checkedKeys={resourceChecks}
                                      onToggleCheck={handleToggleResourceCheck}
                                    />
                                  </div>
                                )}
                                </div>{/* colonne interne */}
                                </div>{/* da-card */}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
                </DaRail>
              )}
            </div>
          );
        })}
        </div>

      {/* ── PAGER (bas) : enchaîner les chapitres sans remonter en haut de page. ── */}
      {!isSearching && chapterPages.length > 1 && currentPage && (
        <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
          <button
            type="button"
            disabled={currentPageIndex <= 0}
            onClick={() => goToChapterPage(currentPageIndex - 1)}
            className="rounded-[3px] border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 cursor-pointer disabled:cursor-default"
          >
            ‹ {currentPageIndex > 0 ? chapterPages[currentPageIndex - 1].ms.title.slice(0, 28) : "Début"}
          </button>
          <span className="reg-mono shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {currentPageIndex + 1} / {chapterPages.length}
          </span>
          <button
            type="button"
            disabled={currentPageIndex >= chapterPages.length - 1}
            onClick={() => goToChapterPage(currentPageIndex + 1)}
            className="rounded-[3px] border border-accent/40 px-2.5 py-1.5 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/10 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer disabled:cursor-default"
          >
            {currentPageIndex < chapterPages.length - 1
              ? `${chapterPages[currentPageIndex + 1].ms.title.slice(0, 28)} ›`
              : "Fin du guide"}
          </button>
        </div>
      )}

        </div>{/* da-guide-main */}

        {/* Colonne du module — le rail PARTAGÉ, inchangé côté données : progression,
            donjons & métiers à prévoir, objets requis. `hideChapters` évite le doublon
            avec le sommaire de gauche ; le dashboard ne passe pas la prop et garde donc
            exactement son rendu (parité public ↔ interne). */}
        <div className="da-guide-aside">
          <RushChapterSidebar
            milestones={milestones as any}
            completedSeqIds={completedSeqIds}
            hideProvidedResources={hideDone}
            hideChapters
            selectedChapter={currentPage?.ms.chapter ?? "ALL"}
            onSelectChapter={(chapter) => {
              const idx = chapterPages.findIndex((p) => chapter === "ALL" || p.ms.chapter === chapter);
              if (idx >= 0) goToChapterPage(idx);
            }}
          />
        </div>
      </div>{/* da-guide-grid */}

      {/* ── MODALE DÉTAILS D'ÉTAPE (RushOverlayQuestDetailModal) ── */}
      {detailModalSeq && (
        <RushOverlayQuestDetailModal
          milestone={detailModalSeq.milestone}
          seq={detailModalSeq.sequence}
          isDone={
            (completedStepsByMs.get(detailModalSeq.milestone.id) || new Set()).has(
              detailModalSeq.sequence.id
            )
          }
          hideProvidedResources={hideDone}
          onClose={() => setDetailModalSeq(null)}
        />
      )}

      {/* ── MODALE RESSOURCES GLOBALES ── */}
      {showResources && (
        <RushOverlayResourcesModal
          resources={remainingResources}
          allResources={allResources}
          totalCount={allResources.length}
          theme="site"
          checkedKeys={resourceChecks}
          onToggleCheck={handleToggleResourceCheck}
          hideProvidedResources={hideDone}
          onClose={() => setShowResources(false)}
        />
      )}

      {/* ── PENSE-BÊTE (contenu GOD, lecture seule — même modale que l'interne) ── */}
      <RushPenseBeteModal
        open={penseBeteOpen}
        onClose={() => setPenseBeteOpen(false)}
        sections={penseBeteSections}
      />

      {/* ── POPUP « REPRENDRE ? » (retour avec repère local) ── */}
      {continueModalOpen &&
        (() => {
          const bmEntry = Array.from(bookmarksByMs.entries())[0];
          if (!bmEntry) return null;
          const ms = milestones.find((m) => m.id === bmEntry[0]);
          if (!ms) return null;
          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" onClick={() => setContinueModalOpen(false)}>
              <div className="reg-panel-strong bg-background p-5 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-3">
                  <Flag className="w-5 h-5 text-success" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-foreground">Reprendre ?</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Tu étais à <strong className="text-foreground">{ms.title}</strong>.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      scrollToStep(bmEntry[1]);
                      setContinueModalOpen(false);
                    }}
                    className="reg-btn reg-btn-primary flex-1 text-sm"
                  >
                    Reprendre
                  </button>
                  <button
                    onClick={() => setContinueModalOpen(false)}
                    className="reg-btn reg-btn-secondary text-sm"
                  >
                    Plus tard
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      </div>{/* rush-guide · coque DA */}

      {/* ── Navigation flottante haut / position / bas (comme le guide interne) ── */}
      {typeof document !== "undefined" &&
        createPortal(
          <div
            {...daScope}
            className="da-portal fixed right-4 z-[100] flex flex-col items-center gap-1 reg-panel bg-background/95 py-2 px-1.5"
            style={{ top: "50%", transform: "translateY(-50%)" }}
          >
            <button
              onClick={scrollToTop}
              disabled={!showScrollTop}
              className={`p-2 rounded-md transition-colors ${showScrollTop ? "text-muted-foreground hover:text-foreground hover:bg-surface cursor-pointer" : "text-muted-foreground cursor-not-allowed"}`}
              title="Remonter en haut"
              aria-label="Remonter en haut"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (activeObjective) scrollToStep(activeObjective.id);
              }}
              disabled={!activeObjective}
              className={`p-2 rounded-md transition-colors ${activeObjective ? "text-success hover:bg-success/10 cursor-pointer" : "text-muted-foreground cursor-not-allowed"}`}
              title="Revenir à la position actuelle"
              aria-label="Revenir à la position actuelle"
            >
              <MapPin className="w-4 h-4" />
            </button>
            <button
              onClick={scrollToBottom}
              disabled={!showScrollBottom}
              className={`p-2 rounded-md transition-colors ${showScrollBottom ? "text-muted-foreground hover:text-foreground hover:bg-surface cursor-pointer" : "text-muted-foreground cursor-not-allowed"}`}
              title="Aller en bas"
              aria-label="Aller en bas"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>,
          document.body
        )}

      {/* ── FLOATING OVERLAY PORTAL (fenêtre détachée active) ── */}
      {pipWin &&
        createPortal(
          <GuideOverlayClient
            key={storagePrefix}
            guide={{
              id: guide.id,
              name: guide.name,
              slug: guide.slug,
              description: guide.description || undefined,
              imageUrl: guide.imageUrl || "/module-dofus/Dofus_Sylvestre.png",
            }}
            milestones={milestones}
            isGuest={true}
            // Le visiteur de CETTE page est connu (session) : le panneau de retour doit
            // proposer le formulaire complet, pas seulement le Discord. Mesure du
            // 08/11/2026 : `isGuest={true}` est codé en dur ici, il ne dit donc RIEN de
            // la session — d'où cette seconde information, explicite.
            feedbackSignedIn={!!visitor}
            // Metamob dans l'overlay (demande du 08/11/2026) : la surface publique connectée
            // reçoit l'état du profil ; l'overlay rend son bouton et sa modale lui-même, donc
            // en PiP aussi (même raison que le panneau de retour).
            metamobPseudo={visitor?.metamobPseudo ?? null}
            metamobVerified={metamob === "verified"}
            pinned={pipPinned}
            // L'overlay lit EXACTEMENT les mêmes clés que la page (donc la progression
            // du personnage déclaré), et affiche son icône de classe dans son en-tête.
            guestStoragePrefix={storagePrefix}
            character={{
              pseudo: character?.pseudo || characterClass?.name || "Invité",
              classe: character?.classId ?? null,
              isMain: true,
            }}
          />,
          pipWin.document.body
        )}
    </>
    </DaThemeProvider>
  );
}


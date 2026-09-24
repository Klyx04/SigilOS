"use client";

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Package,
  ChevronDown,
  ChevronUp,
  Sparkles,
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
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";
import type { RushMilestone, RushSequence, RushDungeonRef } from "@/types/rush-guide-types";
import { getClass } from "@/lib/dofus-assets";
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
} from "@/lib/guest-progress";
import { RushCoordinateChip } from "@/components/dofus-quests/rush/RushCoordinateChip";
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
import { isInfoSequence, isSequenceBlockedByPrereqs, getPrereqRefs } from "@/lib/rush-guide-utils";
// Panneau de droite — le MÊME composant que le guide interne (chapitres, progression,
// donjons & métiers à prévoir, objets requis + bascule Restantes/Toutes).
import { RushChapterSidebar } from "@/components/dofus-quests/rush/RushChapterSidebar";
import { getAlignmentSet } from "@/lib/rush-helpers";
import { RushOverlayResourcesModal } from "@/app/overlay/guide/[guildId]/[slug]/components/RushOverlayResourcesModal";
import { RushOverlayQuestDetailModal } from "@/app/overlay/guide/[guildId]/[slug]/components/RushOverlayQuestDetailModal";
import { resolveDofusLocalImage } from "@/lib/dofus-image-url";
import { buildRushGuideView } from "@/lib/rush-guide-view";
import { alignmentCrest } from "@/lib/rush-guide-view";
// Modale « Mon personnage » (pictos de classe, vignettes de serveur, pseudo validé
// par la règle partagée du profil) — le choix n'est plus un panneau replié.
import { GuestCharacterModal } from "@/components/dofus-quests/rush/GuestCharacterModal";
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
}

// ─── Personnage invité (facultatif) ──────────────────────────────────────────

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

export function PublicRushGuideClient({ guide, milestones }: PublicRushGuideClientProps) {
  const { t, locale } = useI18n();
  // ── Progression locale PAR PERSONNAGE ───────────────────────────────────────
  // Le visiteur peut déclarer son personnage (classe + pseudo + serveur — les trois
  // facultatifs) : chaque personnage garde SES étapes cochées et SON repère. Sans
  // personnage déclaré, les clés restent celles d'origine (`sigil_guest_<slug>_…`) :
  // aucun visiteur déjà en cours de rush ne perd sa progression.
  const [character, setCharacter] = useState<GuestCharacter | null>(() => readGuestCharacter(guide.slug));
  const storagePrefix = guestProgressPrefix(guide.slug, character);

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

  // ── Pense-bête (mêmes sections que le guide interne) ─────────────────────────
  const [penseBeteOpen, setPenseBeteOpen] = useState(false);
  const penseBeteSections = useMemo(
    () => resolveRushUIConfig(guide.rushUIConfig)?.penseBete,
    [guide.rushUIConfig]
  );
  // Modale « Mon personnage » : elle porte son propre brouillon jusqu'à validation.
  const [characterOpen, setCharacterOpen] = useState(false);

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
        for (const t of (s.activityTags || []) as any[]) {
          if (t?.type !== "item" || !t?.name) continue;
          set.add(t.id || t.name);
        }
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

      was ? current.delete(seqId) : current.add(seqId);

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
    [completedStepsByMs, milestones, storagePrefix, isStepLocked]
  );

  // Toggle whole chapter
  const handleToggleChapterAll = useCallback(
    (msId: string, completeAll: boolean) => {
      const ms = milestones.find((m) => m.id === msId);
      if (!ms || !ms.sequences) return;

      const current = new Set(completedStepsByMs.get(msId) || []);
      // Jamais les encarts info : ils n'ont pas de case à cocher. Et jamais une quête
      // verrouillée : « Tout valider » ne contourne pas les prérequis.
      ms.sequences.filter((s) => !isInfoSequence(s)).forEach((s) => {
        if (completeAll && !current.has(s.id) && isStepLocked(s.id)) return;
        completeAll ? current.add(s.id) : current.delete(s.id);
      });

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
    [completedStepsByMs, milestones, storagePrefix, isStepLocked]
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
            return !isSequenceBlockedByPrereqs(s, completedSeqIds, milestones);
          })
        : seqIds;
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
    [completedStepsByMs, milestones, storagePrefix, seqById, completedSeqIds]
  );

  // Personnage déclaré → libellé affiché (icône de classe + pseudo + serveur) et
  // reprise du libellé dans les messages (remise à zéro).
  const characterClass = character?.classId ? getClass(character.classId) : null;
  const characterLabel = character
    ? [character.pseudo || characterClass?.name || "Personnage", guestServerLabel(character.serverId)]
        .filter(Boolean)
        .join(" · ")
    : null;

  // Remise à zéro : les TROIS clés de progression partent ensemble (étapes
  // cochées, blocs terminés, repères). Un reset partiel laisserait un guide à
  // moitié coché — et une fenêtre d'overlay ouverte se réaligne seule (le
  // BroadcastChannel republie l'état vide).
  const handleResetProgress = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(`${storagePrefix}completed_ms`);
        localStorage.removeItem(`${storagePrefix}steps`);
        localStorage.removeItem(`${storagePrefix}bookmarks`);
      } catch {}
    }
    setCompletedIds(new Set());
    setCompletedStepsByMs(new Map());
    setBookmarksByMs(new Map());
    setExpandedMs(new Set(milestones[0]?.id ? [milestones[0].id] : []));
    setHideDone(false);
    setSearchQuery("");
    setContinueModalOpen(false);
    resumeShownThisSession.current = true;
    toast.success("Progression remise à zéro", {
      description: characterLabel
        ? `Étapes cochées, blocs terminés et repères de ${characterLabel} ont été effacés.`
        : "Étapes cochées, blocs terminés et repères ont été effacés.",
    });
  }, [storagePrefix, milestones, characterLabel]);

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
  const openCharacterForm = useCallback(() => {
    setCharacterOpen(true);
  }, []);

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

  return (
    <>
      {/* ── BARRE DE CONTRÔLE (progression · actions · personnage) + RECHERCHE ──
          Un seul panneau porte les trois : où en est le joueur, ce qu'il peut
          préparer, et SON personnage. Le bloc d'en-tête qui les répétait au-dessus
          est supprimé (retour user : « supprime le bloc ») — l'alignement et la
          remise à zéro qu'il portait descendent ICI.
          ⚠️ NON collant — mesuré le 22/09 (1291×712) : collant (décalage `top-16`, `z-30`),
          ce panneau fait 337 px de haut et recouvrait le rail de droite (337 + 596 px de
          rail pour 712 px de viewport) : le rail devenait invisible dès qu'on
          scrollait. Le panneau défile donc avec la page ; c'est le rail qui reste
          affiché pendant la lecture du chapitre. */}
      <div className="mb-8 reg-panel bg-background p-4 sm:p-5 space-y-4">
        {/* Ligne 1 — progression + actions */}
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          {/* Progress summary */}
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="w-12 h-12 shrink-0 flex items-center justify-center">
              <img
                src={guide.imageUrl || "/module-dofus/Dofus_Sylvestre.png"}
                alt="Dofus Sylvestre"
                className="w-12 h-12 object-contain"
              />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-semibold text-foreground">
                {locale === "en" ? "Local Progress" : "Progression locale"}
              </span>
              <p className="reg-mono text-sm text-foreground">
                {completedCount} / {totalSequences} {locale === "en" ? "steps completed" : "étapes validées"} ({progressPercent}%)
              </p>
              <div
                className="mt-1.5 h-1.5 w-[10rem] max-w-full bg-elevated"
                role="progressbar"
                aria-valuenow={progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={locale === "en" ? "Guide progress" : "Progression du guide"}
              >
                <span className="block h-full bg-success transition-all duration-300" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          </div>

          {/* Boutons d'action : TOUS sur la même ligne (4 colonnes) dès qu'il y a la
              place, 2 par ligne sur tablette, empilés sur mobile — largeurs égales,
              aucun bouton qui déborde du cadre. */}
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:w-auto xl:grid-cols-4">
            <button
              type="button"
              onClick={() => setShowResources(true)}
              className="reg-btn reg-btn-secondary w-full"
            >
              <Package className="w-4 h-4 text-warning" aria-hidden="true" />
              <span>{t.rushGuide.resourcesTab}</span>
            </button>

            {/* Pense-bête — contenu édité côté GOD, lecture seule (même modale que
                le guide interne). Il remplace le conseil perdu dans la FAQ. */}
            <button
              type="button"
              onClick={() => setPenseBeteOpen(true)}
              className="reg-btn reg-btn-secondary w-full"
              title={locale === "en" ? "Things to know / to prepare before the rush" : "Les choses à savoir / à préparer avant le rush"}
            >
              <ClipboardList className="w-4 h-4" aria-hidden="true" />
              <span>{locale === "en" ? "Checklist" : "Pense-bête"}</span>
            </button>

            {/* Le seul interrupteur de densité : son interrupteur d'origine vivait
                dans le journal de la vue, supprimé avec lui. Effet inchangé —
                les blocs et les étapes déjà faits sortent du détail ci-dessous. */}
            <button
              type="button"
              onClick={() => setHideDone((v) => !v)}
              aria-pressed={hideDone}
              className={cn("reg-btn reg-btn-secondary w-full", hideDone && "border-accent/40 text-accent")}
              title={locale === "en" ? "Remove validated steps from detail view" : "Retirer du détail ce qui est déjà validé"}
            >
              <CheckCheck className="w-4 h-4" aria-hidden="true" />
              <span>
                {hideDone
                  ? (locale === "en" ? "Show full detail" : "Afficher tout le détail")
                  : (locale === "en" ? "Hide completed steps" : "Masquer les étapes faites")}
              </span>
            </button>

            {/* Lancer l'overlay en jeu — une seule action mise en avant par écran */}
            <button
              type="button"
              onClick={handleLaunchOverlay}
              className="reg-btn reg-btn-primary w-full"
              title={locale === "en" ? "Displays a floating mini-window always on top over Dofus" : "Affiche une mini-fenêtre flottante toujours au premier plan par-dessus Dofus"}
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              <span>{locale === "en" ? "Launch in-game Overlay" : "Lancer l'Overlay en jeu"}</span>
            </button>
          </div>
        </div>

        {/* Ligne 2 — ce que le guide a DÉJÀ donné (alignement, recalculé à chaque
            coche) et la sortie de secours (remise à zéro en deux temps). */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <p className="inline-flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={rushView.alignment?.crestSrc ?? alignmentCrest(null)}
              alt=""
              width={18}
              height={18}
              className="h-[18px] w-[18px] shrink-0 object-contain"
            />
            {rushView.alignment ? (
              <span>
                {locale === "en" ? "Alignment" : "Alignement"} <b className="text-foreground">{rushView.alignment.label}</b>
                {rushView.alignment.level > 0 && (
                  <>
                    {" · "}
                    {locale === "en" ? "tier" : "tranche"}{" "}
                    <span className="reg-mono">{rushView.alignment.level}</span>
                  </>
                )}
              </span>
            ) : (
              <span>
                {locale === "en" ? "Alignment" : "Alignement"} <b className="text-foreground">neutre</b> —{" "}
                {locale === "en" ? "no alignment quest validated yet" : "aucune quête d'alignement validée"}
              </span>
            )}
          </p>
          <ResetProgressButton
            onReset={handleResetProgress}
            label={locale === "en" ? "Reset progress" : "Réinitialiser la progression"}
            confirmLabel={locale === "en" ? "Erase everything?" : "Effacer toute la progression ?"}
            yesLabel={locale === "en" ? "Yes, erase all" : "Oui, tout effacer"}
            cancelLabel={locale === "en" ? "Cancel" : "Annuler"}
          />
        </div>
        {/* ── Ligne 3 — MON PERSONNAGE ────────────────────────────────────────
            Le choix vivait dans un panneau replié (trois `<select>`) que le user ne
            voyait pas : il vit maintenant dans une MODALE dédiée (pictos de classe,
            vignettes de serveur, pseudo validé comme dans le profil interne) et le
            résumé du personnage choisi reste affiché ici, en clair. */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          {hasGuestCharacter(character) ? (
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
              {characterClass ? (
                // Icône de classe du jeu (mêmes PNG que le profil et le dashboard).
                <img
                  src={characterClass.icon}
                  alt={characterClass.name}
                  title={characterClass.name}
                  className="h-8 w-8 shrink-0 object-contain"
                />
              ) : null}
              {character.serverId && getDofusServerImage(character.serverId) && (
                // Vignette du serveur déclaré (assets du jeu, WebP).
                <img
                  src={getDofusServerImage(character.serverId)!}
                  alt=""
                  title={guestServerLabel(character.serverId) ?? ""}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className="h-8 w-8 shrink-0 rounded-[3px] border border-border object-cover"
                />
              )}
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-foreground">{characterLabel}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {locale === "en" ? "progress saved for this character" : "progression enregistrée pour ce personnage"}
                </span>
              </span>
            </div>
          ) : (
            <p className="min-w-0 text-[11px] text-muted-foreground">
              {locale === "en"
                ? "Progress is saved for this browser. Declare a character to keep one progress per character."
                : "La progression est enregistrée pour ce navigateur. Déclare un personnage pour garder une progression par personnage."}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openCharacterForm}
              className="reg-btn reg-btn-secondary"
              title={locale === "en" ? "Class + nickname + server: each character keeps their own progress" : "Classe + pseudo + serveur : chaque personnage garde sa propre progression"}
            >
              <UserRound className="h-4 w-4" aria-hidden="true" />
              <span>
                {hasGuestCharacter(character)
                  ? locale === "en" ? "Change character" : "Changer de personnage"
                  : locale === "en" ? "Choose my character" : "Choisir mon personnage"}
              </span>
            </button>
            {hasGuestCharacter(character) && (
              <button
                type="button"
                onClick={() => applyGuestCharacter(null)}
                className="inline-flex items-center gap-1.5 rounded-[3px] border border-border px-2.5 py-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
                title={locale === "en" ? "Reset to browser progress (no character)" : "Revenir à la progression du navigateur (sans personnage)"}
              >
                <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
                {locale === "en" ? "Remove" : "Retirer"}
              </button>
            )}
            <GuestCharacterModal
              open={characterOpen}
              onClose={() => setCharacterOpen(false)}
              initial={character}
              locale={locale}
              onSubmit={(next) => applyGuestCharacter(next)}
            />
          </div>
        </div>

        {/* Search bar & Live Filter */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden="true" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.rushGuide.searchPlaceholder}
            className="w-full h-11 pl-10 pr-10 rounded-md bg-surface border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              aria-label={locale === "en" ? "Clear search" : "Effacer la recherche"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Progression globale */}
        <div
          className="reg-progress"
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progression du rush"
        >
          <span style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

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
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
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
                  <RushRichText text={infoText} />
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
                <div className="py-4 sm:py-5 space-y-5">
                  {questBlocks.length === 0 ? (
                    <p className="py-4 text-xs italic text-muted-foreground">
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
                          "reg-panel overflow-hidden transition-colors bg-background",
                          block.isDone && "opacity-70"
                        )}
                      >
                        {/* ── EN-TÊTE DU BLOC DE QUÊTE (multi-étapes uniquement) ── */}
                        {hasSteps && !isSingleStep && (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 sm:px-4 bg-surface border-b border-border">
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

                        {/* ── ÉTAPES DE LA QUÊTE ── */}
                        <div className={blockItems.length > 1 ? "p-2 sm:p-3 space-y-2.5" : "p-2 sm:p-3"}>
                          {blockItems.map((seq) => {
                            const stepDone = doneSteps.has(seq.id);
                            // Verrou de prérequis (même règle que le guide interne) : la case
                            // devient inerte, la carte passe en danger, le prérequis est nommé.
                            const stepLocked = !stepDone && isStepLocked(seq.id);
                            const prereqRefs = stepLocked ? getPrereqRefs(seq, milestones) : [];
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
                                  />
                                </div>
                              );
                            }

                            return (
                              <div
                                key={seq.id}
                                data-seq-id={seq.id}
                                className={cn(
                                  "group flex flex-col gap-2 rounded-[4px] border p-3 transition-colors",
                                  // Trois états, trois couleurs (règle partagée avec l'interne) :
                                  // validée = neutre atténué · VERROUILLÉE = danger · REPÈRE = ambre.
                                  stepDone
                                    ? "border-border bg-surface opacity-65"
                                    : stepLocked
                                    ? "border-danger/30 bg-danger/[0.05]"
                                    : isBookmarked
                                    ? "border-warning/40 bg-warning/10"
                                    : "border-border bg-elevated hover:bg-surface"
                                )}
                              >
                                {/* Ligne principale de l'étape */}
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                  {/* Checkbox & Titre */}
                                  <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleStep(ms.id, seq.id)}
                                      disabled={stepLocked}
                                      aria-label={stepDone ? "Décocher" : stepLocked ? "Quête verrouillée par un prérequis" : "Valider cette étape"}
                                      title={stepLocked ? "Prérequis non terminé — valide d'abord les quêtes citées sous la ligne." : undefined}
                                      className={cn(
                                        "w-5 h-5 rounded-[3px] border flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 transition-colors",
                                        stepLocked ? "border-danger/40 text-danger cursor-not-allowed" : "cursor-pointer",
                                        stepDone
                                          ? "border-success/70 text-success"
                                          : stepLocked
                                          ? ""
                                          : "border-border hover:border-success"
                                      )}
                                    >
                                      {stepDone && <Check className="w-3.5 h-3.5 stroke-[2]" />}
                                      {stepLocked && <Lock className="w-3 h-3 stroke-[2]" aria-hidden="true" />}
                                    </button>

                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {activeObjective?.id === seq.id && activeObjective?.blockId === ms.id && !stepDone && (
                                          <span className="reg-mono shrink-0 text-[11px] text-muted-foreground">à faire</span>
                                        )}
                                        {/* Glyphe de quête du jeu : la ligne dit d'abord « c'est une quête », ensuite laquelle */}
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src="/assets/icons/icone-quete.png"
                                          alt=""
                                          className="h-4 w-4 shrink-0 self-center object-contain opacity-90"
                                          loading="lazy"
                                        />
                                        {/* Nom de quête (blocs mono-étape : pas d'en-tête, la ligne porte le nom) */}
                                        {isSingleStep && (
                                          <>
                                            {(() => {
                                              const primaryUrl = (seq as any).dofuspourlesnoobsUrl || (seq as any).dofusdbUrl || block.dofuspourlesnoobsUrl || block.dofusdbUrl || null;
                                              const cls = "text-[13px] font-semibold leading-snug break-words min-w-0";
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
                                        {parsedCoord && (
                                          <RushCoordinateChip coordText={parsedCoord.raw} />
                                        )}
                                        {/* Quête d'alignement (détail complet en modale) */}
                                        {(() => {
                                          const align = getAlignmentSet(seq as any);
                                          if (!align) return null;
                                          const label = align.camp === "brakmarien" ? "Brakmarien" : align.camp === "bontarien" ? "Bontarien" : align.camp;
                                          return (
                                            <span
                                              className="inline-flex items-center gap-1 shrink-0 text-[11px] text-muted-foreground"
                                              title={`Quête d'alignement → ${label} ${align.level}`}
                                            >
                                              {/* eslint-disable-next-line @next/next/no-img-element */}
                                              <img
                                                src={align.camp === "brakmarien" ? "/ordres/brakmar.png" : "/ordres/bonta.png"}
                                                alt=""
                                                className="h-3 w-3 shrink-0 object-contain"
                                              />
                                              Alignement {label} {align.level}
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
                                            <Package className="w-3 h-3 text-warning" aria-hidden="true" />
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

                                      {/* Bouton Détails (i) -> ouvre la modale dédiée */}
                                      <button
                                        type="button"
                                        onClick={() => setDetailModalSeq({ milestone: ms, sequence: seq })}
                                        className="p-1.5 rounded-[3px] text-muted-foreground hover:text-foreground hover:bg-elevated transition-colors cursor-pointer"
                                        title="Voir les détails complets de l'étape"
                                      >
                                        <Info className="w-3.5 h-3.5" />
                                      </button>
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
                                      À terminer avant :
                                    </span>
                                    {prereqRefs.length === 0 ? (
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
                                            <p className="text-[11px] italic leading-relaxed text-muted-foreground">
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
                                      showHeaderMeta={false}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
                </div>
              )}
            </div>
          );
        })}
        </div>

        {/* Le panneau de droite suit la page courante : cliquer un chapitre y navigue
            (même geste que dans le guide interne) ET il reste affiché pendant toute la
            lecture du chapitre — c'est lui qui porte le repère une fois la barre de
            contrôle défilée. Mesure du 22/09 (1291×712) : le rail fait 596 px pour
            616 px disponibles sous l'en-tête public (712 − 80 de décalage `top-20` −
            16 de marge) → on le borne au viewport et il défile en interne, sinon sa
            fin (objets requis) restait hors écran. */}
        <RushChapterSidebar
          className="xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto custom-scrollbar"
          milestones={milestones as any}
          completedSeqIds={completedSeqIds}
          selectedChapter={currentPage?.ms.chapter ?? "ALL"}
          onSelectChapter={(chapter) => {
            const idx = chapterPages.findIndex((p) => chapter === "ALL" || p.ms.chapter === chapter);
            if (idx >= 0) goToChapterPage(idx);
          }}
        />
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
          isLightMode={false}
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
          isLightMode={false}
          checkedKeys={resourceChecks}
          onToggleCheck={handleToggleResourceCheck}
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

      {/* ── Navigation flottante haut / position / bas (comme le guide interne) ── */}
      {typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed right-4 z-[100] flex flex-col items-center gap-1 reg-panel bg-background/95 py-2 px-1.5"
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
            pinned={pipPinned}
            // L'overlay lit EXACTEMENT les mêmes clés que la page (donc la progression
            // du personnage déclaré), et affiche son icône de classe dans son en-tête.
            guestStoragePrefix={storagePrefix}
            character={{
              pseudo: character?.pseudo || characterClass?.name || "Invité",
              classe: character?.classId ?? null,
              isMain: true,
            }}
            onClose={() => pipWin?.close?.()}
          />,
          pipWin.document.body
        )}
    </>
  );
}

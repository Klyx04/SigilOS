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
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { RushMilestone, RushSequence, RushDungeonRef } from "@/types/rush-guide-types";
import { getClass, DOFUS_CLASSES } from "@/lib/dofus-assets";
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
import { getAlignmentSet } from "@/lib/rush-helpers";
import { RushOverlayResourcesModal } from "@/app/overlay/guide/[guildId]/[slug]/components/RushOverlayResourcesModal";
import { RushOverlayQuestDetailModal } from "@/app/overlay/guide/[guildId]/[slug]/components/RushOverlayQuestDetailModal";
import { resolveDofusLocalImage } from "@/lib/dofus-image-url";
import { RushGuideView } from "@/components/dofus-quests/rush/RushGuideView";
import { buildRushGuideView } from "@/lib/rush-guide-view";

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

  for (const seq of sequences) {
    // Séquences info (bandeaux méta) : hors blocs de quêtes — jamais cochables,
    // sinon aucun bloc ne pourrait être marqué terminé (filtre « masquer ce qui
    // est terminé » piloté depuis la vue partagée).
    if (Array.isArray((seq as any).activityTags) && (seq as any).activityTags.some((t: any) => t.type === "info_sequence")) continue;
    const qName = seq.subGuideName || seq.subGuideRef || "Étape";
    const qRef = seq.subGuideRef || qName;

    if (!currentBlock || currentBlock.questRef !== qRef) {
      currentBlock = {
        questName: qName,
        questRef: qRef,
        sequences: [seq],
        dofusdbUrl: seq.dofusdbUrl || null,
        dofuspourlesnoobsUrl: seq.dofuspourlesnoobsUrl || null,
        dungeons: [],
        isDone: false,
        doneCount: 0,
        totalCount: 0,
      };
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

  for (const b of blocks) {
    b.totalCount = b.sequences.length;
    b.doneCount = b.sequences.filter((s) => doneSteps.has(s.id)).length;
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
  };
  milestones: RushMilestone[];
}

// ─── Personnage invité (facultatif) ──────────────────────────────────────────
// Catégories de serveurs Unity, dans l'ordre d'affichage du choix.
const GUEST_SERVER_GROUPS: { key: keyof typeof DOFUS_UNITY_SERVERS; label: string }[] = [
  { key: "monocompte", label: "Monocompte" },
  { key: "classique", label: "Classique" },
  { key: "pionnierMono", label: "Pionnier monocompte" },
  { key: "pionnier", label: "Pionnier" },
  { key: "epique", label: "Épique" },
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

export function PublicRushGuideClient({ guide, milestones }: PublicRushGuideClientProps) {
  // ── Progression locale PAR PERSONNAGE ───────────────────────────────────────
  // Le visiteur peut déclarer son personnage (classe + pseudo + serveur — les trois
  // facultatifs) : chaque personnage garde SES étapes cochées et SON repère. Sans
  // personnage déclaré, les clés restent celles d'origine (`sigil_guest_<slug>_…`) :
  // aucun visiteur déjà en cours de rush ne perd sa progression.
  const [character, setCharacter] = useState<GuestCharacter | null>(() => readGuestCharacter(guide.slug));
  const storagePrefix = guestProgressPrefix(guide.slug, character);
  // Formulaire « personnage » : on travaille sur un brouillon jusqu'à validation.
  const [characterOpen, setCharacterOpen] = useState(false);
  const [charDraft, setCharDraft] = useState<GuestCharacter>({ classId: null, pseudo: null, serverId: null });

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
  const totalSequences = useMemo(
    () => milestones.reduce((acc, ms) => acc + (ms.sequences?.length || 0), 0),
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
        const allDone = ms.sequences.length > 0 && ms.sequences.every((s) => current.has(s.id));
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
    [completedStepsByMs, milestones, storagePrefix]
  );

  // Validation depuis la vue partagée : la vue ne connaît que l'étape (règle du
  // module), la page résout son bloc puis délègue au handler local existant.
  const handleValidateStepById = useCallback(
    (seqId: string) => {
      const ms = milestones.find((m) => m.sequences?.some((s) => s.id === seqId));
      if (ms) handleToggleStep(ms.id, seqId);
    },
    [milestones, handleToggleStep]
  );

  // Toggle whole chapter
  const handleToggleChapterAll = useCallback(
    (msId: string, completeAll: boolean) => {
      const ms = milestones.find((m) => m.id === msId);
      if (!ms || !ms.sequences) return;

      const current = new Set(completedStepsByMs.get(msId) || []);
      ms.sequences.forEach((s) => {
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
    [completedStepsByMs, milestones, storagePrefix]
  );

  // Toggle all steps of one quest block (comme le guide interne)
  const handleToggleBlockSteps = useCallback(
    (msId: string, seqIds: string[], completeAll: boolean) => {
      setCompletedStepsByMs((prev) => {
        const next = new Map(prev);
        const current = new Set(next.get(msId) || []);
        seqIds.forEach((id) => {
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
        seqIds.forEach((id) => {
          if (completeAll) doneSet.add(id);
          else doneSet.delete(id);
        });
        const relevant = ms.sequences.map((s) => s.id);
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
    [completedStepsByMs, milestones, storagePrefix]
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

  const openCharacterForm = useCallback(() => {
    setCharDraft(character ?? { classId: null, pseudo: null, serverId: null });
    setCharacterOpen(true);
  }, [character]);

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

  // Le chapitre ouvert est la page : il est toujours déplié. La recherche, elle,
  // fouille TOUS les chapitres (sinon elle cacherait ses propres résultats).
  const pagedChapterId = isSearching ? null : currentPage?.ms.id ?? null;
  const visibleMilestones = useMemo(
    () => (isSearching || !currentPage ? milestones : [...currentPage.lead, currentPage.ms, ...currentPage.tail]),
    [isSearching, currentPage, milestones]
  );

  return (
    <>
      {/* ── LE GUIDE — la vue partagée (public ↔ guilde) ──
          C'est EXACTEMENT la vue du guide interne (`RushGuideView`) alimentée par
          le modèle unique du module (`buildRushGuideView`) : repère du joueur
          prioritaire, étapes informatives ignorées, dépendances `prereq_text`
          respectées, compteurs. Deux sections seulement : où en est l'expédition,
          et l'unique action qui suit — le contenu complet est plus bas, chapitre
          par chapitre. Variante « public » = visiteur non connecté : aucune
          fonction communautaire, aucun plein écran, la progression reste dans le
          stockage local du navigateur. */}

      <RushGuideView
        variant="public"
        view={rushView}
        onValidateStep={handleValidateStepById}
        onResetProgress={handleResetProgress}
        className="mb-8"
      />

      {/* ── BARRE DE CONTRÔLE + RECHERCHE ──
          Avant : `rounded-3xl`, `shadow-2xl`, `backdrop-blur-xl` et libellés en
          capitales grasses. Maintenant : panneau opaque du registre, sans ombre —
          il reste lisible quand il se colle sous l'en-tête. */}
      <div className="sticky top-16 z-30 mb-8 reg-panel bg-background p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* Progress summary */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 shrink-0 flex items-center justify-center">
              <img
                src={guide.imageUrl || "/module-dofus/Dofus_Sylvestre.png"}
                alt="Dofus Sylvestre"
                className="w-12 h-12 object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">Progression Locale</span>
              </div>
              <p className="reg-mono text-sm text-foreground">
                {completedCount} / {totalSequences} étapes validées ({progressPercent}%)
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            <button
              type="button"
              onClick={() => setShowResources(true)}
              className="reg-btn reg-btn-secondary"
            >
              <Package className="w-4 h-4 text-warning" aria-hidden="true" />
              <span>Ressources</span>
            </button>

            {/* Le seul interrupteur de densité : son interrupteur d'origine vivait
                dans le journal de la vue, supprimé avec lui. Effet inchangé —
                les blocs et les étapes déjà faits sortent du détail ci-dessous. */}
            <button
              type="button"
              onClick={() => setHideDone((v) => !v)}
              aria-pressed={hideDone}
              className={cn("reg-btn reg-btn-secondary", hideDone && "border-accent/40 text-accent")}
              title="Retirer du détail ce qui est déjà validé"
            >
              <CheckCheck className="w-4 h-4" aria-hidden="true" />
              <span>{hideDone ? "Afficher tout le détail" : "Masquer les étapes faites"}</span>
            </button>

            {/* Lancer l'overlay en jeu — une seule action mise en avant par écran */}
            <button
              type="button"
              onClick={handleLaunchOverlay}
              className="reg-btn reg-btn-primary flex-1 md:flex-initial"
              title="Affiche une mini-fenêtre flottante toujours au premier plan par-dessus Dofus"
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              <span>Lancer l'Overlay en jeu</span>
            </button>
          </div>
        </div>

        {/* ── PERSONNAGE (facultatif) ──────────────────────────────────────────
            La progression locale est gardée PAR PERSONNAGE : déclarer classe +
            pseudo + serveur permet de suivre plusieurs persos (et de retrouver sa
            progression dans l'overlay en jeu). Les trois champs sont facultatifs :
            sans personnage, la progression reste celle du navigateur. */}
        <div className="border-t border-border pt-3">
          {hasGuestCharacter(character) && !characterOpen ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {characterClass ? (
                // Icône de classe du jeu (mêmes PNG que le profil et le dashboard).
                <img
                  src={characterClass.icon}
                  alt={characterClass.name}
                  title={characterClass.name}
                  className="h-7 w-7 shrink-0 object-contain"
                />
              ) : (
                <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              {character.serverId && getDofusServerImage(character.serverId) && (
                // Vignette du serveur déclaré (assets du jeu, WebP).
                <img
                  src={getDofusServerImage(character.serverId)!}
                  alt=""
                  title={guestServerLabel(character.serverId) ?? ""}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className="h-7 w-7 shrink-0 rounded-[3px] border border-border object-cover"
                />
              )}
              <span className="text-xs font-semibold text-foreground">{characterLabel}</span>
              <span className="text-[11px] text-muted-foreground">
                progression enregistrée pour ce personnage
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openCharacterForm}
                  className="rounded-[3px] border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
                >
                  Changer
                </button>
                <button
                  type="button"
                  onClick={() => applyGuestCharacter(null)}
                  className="inline-flex items-center gap-1.5 rounded-[3px] border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
                  title="Revenir à la progression du navigateur (sans personnage)"
                >
                  <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
                  Retirer
                </button>
              </div>
            </div>
          ) : characterOpen ? (
            <div className="space-y-3">
              <p className="text-[11px] text-muted-foreground">
                Personnage (facultatif) — la progression reste dans votre navigateur. Le pseudo et le
                serveur servent à séparer plusieurs personnages sur le même navigateur.
              </p>
              {/* Classe : icônes du jeu, une seule sélection (re-cliquer retire). */}
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Classe du personnage">
                {DOFUS_CLASSES.map((c) => {
                  const isSelected = charDraft.classId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCharDraft((d) => ({ ...d, classId: d.classId === c.id ? null : c.id }))}
                      aria-pressed={isSelected}
                      aria-label={c.name}
                      title={c.name}
                      className={cn(
                        "h-9 w-9 shrink-0 rounded-[3px] border p-1 transition-colors cursor-pointer",
                        isSelected ? "border-accent bg-accent/10" : "border-border hover:bg-elevated"
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.icon} alt="" className="h-full w-full object-contain" loading="lazy" />
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={charDraft.pseudo ?? ""}
                  onChange={(e) => setCharDraft((d) => ({ ...d, pseudo: e.target.value }))}
                  maxLength={24}
                  placeholder="Pseudo en jeu (ex. MonIop)"
                  aria-label="Pseudo en jeu"
                  className="h-9 w-48 rounded-[3px] border border-border bg-surface px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
                />
                <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Server className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <select
                    value={charDraft.serverId ?? ""}
                    onChange={(e) =>
                      setCharDraft((d) => ({ ...d, serverId: e.target.value ? Number(e.target.value) : null }))
                    }
                    aria-label="Serveur de jeu"
                    className="h-9 rounded-[3px] border border-border bg-surface px-2 text-xs text-foreground focus:border-accent focus:outline-none cursor-pointer"
                  >
                    <option value="">Serveur (facultatif)</option>
                    {GUEST_SERVER_GROUPS.map((group) => (
                      <optgroup key={group.key} label={group.label}>
                        {(DOFUS_UNITY_SERVERS[group.key] as readonly { name: string; id: number }[]).map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => applyGuestCharacter(charDraft)}
                  className="inline-flex items-center gap-1.5 rounded-[3px] border border-success/40 px-3 py-1.5 text-[11px] font-semibold text-success transition-colors hover:bg-success/10 cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  Enregistrer
                </button>
                <button
                  type="button"
                  onClick={() => setCharacterOpen(false)}
                  className="rounded-[3px] border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={openCharacterForm}
              className="inline-flex items-center gap-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
              title="Classe + pseudo + serveur : chaque personnage garde sa propre progression"
            >
              <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
              Choisir mon personnage (facultatif)
            </button>
          )}
        </div>

        {/* Search bar & Live Filter */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden="true" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher une quête, un donjon, un PNJ, des coordonnées [X, Y]…"
            className="w-full h-11 pl-10 pr-10 rounded-md bg-surface border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              aria-label="Effacer la recherche"
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

      {/* ── SOMMAIRE — les 59 chapitres restent TOUS dans le HTML (indexation) et
          chaque titre garde son ancre partageable (#bloc-…) : seul l'affichage est
          replié, et plafonné (max-h-72 + scroll) quand on l'ouvre. Ouvert d'office,
          cette liste mangeait ≈680 px avant même le premier chapitre. */}
      <details className="group/som reg-panel-strong bg-background p-3 mb-5">
        <summary className="flex cursor-pointer list-none select-none items-center gap-2 text-xs font-semibold text-foreground">
          <span aria-hidden="true" className="shrink-0 text-muted-foreground transition-transform group-open/som:rotate-90">
            ▶
          </span>
          <span className="shrink-0">
            Sommaire — {chapterPages.length} chapitres
          </span>
          <span className="reg-mono min-w-0 truncate text-[11px] font-normal text-muted-foreground">
            {chapterPages.filter((p) => completedIds.has(p.ms.id)).length} / {chapterPages.length} blocs terminés
            {isSearching && " · recherche en cours : tous les chapitres sont ouverts"}
          </span>
        </summary>
        <nav aria-label="Sommaire du guide" className="mt-2">
          <ul className="grid max-h-72 grid-cols-1 gap-0.5 overflow-y-auto border border-border p-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {chapterPages.map((p, i) => {
              const done = p.ms.sequences.filter((s) => (completedStepsByMs.get(p.ms.id) || new Set()).has(s.id)).length;
              const isCurrent = !isSearching && i === currentPageIndex;
              return (
                <li key={p.ms.id} className="min-w-0">
                  <a
                    href={`#bloc-${p.ms.id}`}
                    onClick={(e) => { e.preventDefault(); goToChapterPage(i); }}
                    aria-current={isCurrent ? "true" : undefined}
                    className={cn(
                      "flex items-baseline gap-2 rounded-[4px] px-2 py-1.5 transition-colors",
                      isCurrent ? "bg-accent/10 text-accent" : "text-muted-foreground hover:bg-elevated hover:text-foreground"
                    )}
                  >
                    <span className="reg-mono shrink-0 text-[11px] tabular-nums">{p.index + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold">{p.ms.title}</span>
                    <span className="reg-mono shrink-0 text-[11px] tabular-nums">
                      {done}/{p.ms.sequences.length}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </details>

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

      <div className="space-y-6">
        {visibleMilestones.map((ms) => {
          const msIndex = milestones.indexOf(ms);
          const isDone = completedIds.has(ms.id);
          const isExpanded = expandedMs.has(ms.id) || isSearching || pagedChapterId === ms.id;
          const doneSteps = completedStepsByMs.get(ms.id) || new Set();
          const sequences = ms.sequences || [];

          // Regroupement des séquences en blocs de quête
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

          const msDoneCount = sequences.filter((s) => doneSteps.has(s.id)).length;
          const msPercent = sequences.length > 0 ? Math.round((msDoneCount / sequences.length) * 100) : 0;
          const chapterDofusImg = resolveDofusLocalImage(ms.title);

          // Séparateur de chapitre majeur
          if (ms.type === "SEPARATEUR") {
            return (
              <div
                key={ms.id}
                className="my-6 border-t border-border pt-4"
              >
                <span className="reg-eyebrow block">
                  Étape Charnière
                </span>
                <h3 className="text-lg font-bold text-foreground mt-1">{ms.title}</h3>
                {ms.description && <p className="text-xs text-muted-foreground mt-1">{ms.description}</p>}
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
                        {msDoneCount} / {sequences.length} étapes ({msPercent}%)
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
                <div className="p-4 sm:p-6 space-y-5">
                  {questBlocks.length === 0 ? (
                    <p className="py-4 text-xs italic text-muted-foreground">
                      Aucune étape correspondante.
                    </p>
                  ) : (
                    questBlocks.map((block, blockIdx) => {
                      const questDofusImg = resolveDofusLocalImage(block.questName) || resolveDofusLocalImage(ms.title);
                      // Bloc mono-étape : pas d'en-tête redondant, la ligne-carte porte le nom (comme le guide interne)
                      const isSingleStep = block.sequences.length === 1;
                      return (
                      <div
                        key={`${block.questRef}-${blockIdx}`}
                        className={cn(
                          "reg-panel overflow-hidden transition-colors bg-background",
                          block.isDone && "opacity-70"
                        )}
                      >
                        {/* ── EN-TÊTE DU BLOC DE QUÊTE (multi-étapes uniquement) ── */}
                        {!isSingleStep && (
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
                            const bmInBlock = bmSeqId && block.sequences.some((s) => s.id === bmSeqId);
                            const firstUndone = block.sequences.find((s) => !doneSteps.has(s.id));
                            return (
                              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                {!block.isDone && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleBlockSteps(ms.id, block.sequences.map((s) => s.id), true)}
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
                        <div className={isSingleStep ? "p-2 sm:p-3" : "p-2 sm:p-3 space-y-2.5"}>
                          {block.sequences.filter((s) => !hideDone || !doneSteps.has(s.id)).map((seq) => {
                            const stepDone = doneSteps.has(seq.id);
                            const parsedCoord = getSequenceCoord(seq);

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
                                  stepDone
                                    ? "border-border bg-surface opacity-65"
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
                                      aria-label={stepDone ? "Décocher" : "Valider cette étape"}
                                      className={cn(
                                        "w-5 h-5 rounded-[3px] border flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 transition-colors cursor-pointer",
                                        stepDone
                                          ? "border-success/70 text-success"
                                          : "border-border hover:border-success"
                                      )}
                                    >
                                      {stepDone && <Check className="w-3.5 h-3.5 stroke-[2]" />}
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
                                              {mainTip}
                                            </p>
                                          )}
                                          {succesPart && (
                                            <div className="flex items-center gap-1.5">
                                              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-warning">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src="/assets/dofus/game-icons/trophy-1.png" alt="" className="h-3 w-3 shrink-0 object-contain" />
                                                Succès : {succesPart}
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

      {/* ── PAGER (bas) : enchaîner les chapitres sans remonter au sommaire. ── */}
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
          onClose={() => setShowResources(false)}
        />
      )}

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

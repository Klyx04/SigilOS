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
  Eye,
  EyeOff,
  Search,
  X,
  Target,
  Sword,
  MapPin,
  CheckCircle2,
  BookmarkCheck,
  Flag,
  Info,
  Layers,
  HelpCircle,
  Copy,
  CheckCheck,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { RushMilestone, RushSequence, RushDungeonRef, RushActivityTag } from "@/types/rush-guide-types";
import { RushCoordinateChip } from "@/components/dofus-quests/rush/RushCoordinateChip";
import { QuestItemResourceGrid } from "@/components/dofus-quests/rush/QuestItemResourceGrid";
import { ResourceImage } from "@/components/dofus-quests/ResourceImage";
import { copyToClipboard } from "@/lib/clipboard";
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
    // sinon aucun bloc ne pourrait être marqué terminé (filtre "Faites masquées").
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

export function PublicRushGuideClient({ guide, milestones }: PublicRushGuideClientProps) {
  const storagePrefix = `sigil_guest_${guide.slug}_`;

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

  const scrollToStep = useCallback((seqId: string) => {
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
  }, []);

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
    `guest:${guide.slug}`,
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

  // Active / Next Objective (première étape non cochée ou bookmarked)
  const activeObjective = useMemo(() => {
    // 1. Priorité au repère placé manuellement
    for (const ms of milestones) {
      const bmSeqId = bookmarksByMs.get(ms.id);
      if (bmSeqId) {
        const seq = ms.sequences?.find((s) => s.id === bmSeqId);
        const doneSteps = completedStepsByMs.get(ms.id) || new Set();
        if (seq && !doneSteps.has(seq.id)) {
          return { milestone: ms, sequence: seq, isBookmarked: true };
        }
      }
    }
    // 2. Première étape non terminée
    for (const ms of milestones) {
      const doneSteps = completedStepsByMs.get(ms.id) || new Set();
      for (const seq of ms.sequences || []) {
        if (!doneSteps.has(seq.id)) {
          return { milestone: ms, sequence: seq, isBookmarked: false };
        }
      }
    }
    return null;
  }, [milestones, completedStepsByMs, bookmarksByMs]);

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

  return (
    <>
      {/* ── OBJECTIF EN COURS (Hero Banner interactif) ── */}
      {activeObjective && (
        <div className="mb-8 rounded-3xl border border-success/40 bg-gradient-to-r from-success/20 via-elevated to-background p-5 sm:p-6 shadow-2xl relative overflow-hidden backdrop-blur-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-success/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-success/20 border border-success/40 text-success text-[11px] font-black uppercase tracking-wider">
                  <Target className="w-3.5 h-3.5 text-success animate-pulse" />
                  {activeObjective.isBookmarked ? "Repère Actif (Je suis ici)" : "Prochain Objectif"}
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  {activeObjective.milestone.title}
                </span>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-lg sm:text-xl font-black text-foreground truncate font-heading">
                  {activeObjective.sequence.subGuideName || activeObjective.sequence.subGuideRef}
                </h3>

                {(() => {
                  const parsedCoord = getSequenceCoord(activeObjective.sequence);
                  return parsedCoord ? (
                    <RushCoordinateChip coordText={parsedCoord.raw} showIcon={true} />
                  ) : null;
                })()}

                {/* Donjon associé à l'objectif actif */}
                {(() => {
                  const djs = activeObjective.sequence.dungeons && activeObjective.sequence.dungeons.length > 0
                    ? activeObjective.sequence.dungeons
                    : activeObjective.sequence.dungeon
                    ? [activeObjective.sequence.dungeon]
                    : [];
                  if (djs.length === 0) return null;
                  const dj = djs[0];
                  return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-warning/15 border border-warning/30 text-warning text-xs font-bold">
                      {dj.imageUrl ? (
                        <img src={dj.imageUrl} alt="" className="w-4 h-4 rounded object-cover" />
                      ) : (
                        <Sword className="w-3.5 h-3.5" />
                      )}
                      <span>{dj.name}</span>
                    </span>
                  );
                })()}
              </div>

              {activeObjective.sequence.tips && (
                <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 bg-black/30 p-2.5 rounded-xl border border-border">
                  💡 <span className="font-semibold text-foreground">Conseil :</span> {activeObjective.sequence.tips}
                </p>
              )}
            </div>

            {/* Actions rapides sur l'objectif */}
            <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto">
              <button
                type="button"
                onClick={() =>
                  handleToggleStep(activeObjective.milestone.id, activeObjective.sequence.id)
                }
                className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-success hover:bg-success text-success-foreground font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-success/20"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Valider cette étape</span>
              </button>

              <button
                type="button"
                onClick={handleLaunchOverlay}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-elevated hover:bg-elevated text-foreground font-bold text-xs border border-border transition-colors"
                title="Détacher la mini-fenêtre par-dessus le jeu Dofus"
              >
                <Sparkles className="w-3.5 h-3.5 text-success" />
                <span className="hidden sm:inline">Overlay en jeu</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STICKY CONTROL BAR & SEARCH ── */}
      <div className="sticky top-16 z-30 mb-8 rounded-3xl border border-border bg-background/95 p-4 sm:p-5 shadow-2xl backdrop-blur-xl space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* Progress summary */}
          <div className="flex items-center gap-3.5">
            <div className="relative w-12 h-12 rounded-2xl bg-success/10 border border-success/20 flex items-center justify-center shrink-0">
              <img
                src={guide.imageUrl || "/module-dofus/Dofus_Sylvestre.png"}
                alt="Dofus Sylvestre"
                className="w-8 h-8 object-contain drop-shadow"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-success">Progression Locale</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-success/10 border border-success/20 text-success font-mono font-bold">
                  100% Gratuit
                </span>
              </div>
              <p className="text-sm font-bold text-foreground tabular-nums">
                {completedCount} / {totalSequences} étapes validées ({progressPercent}%)
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            <button
              type="button"
              onClick={() => setHideDone((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors",
                hideDone
                  ? "bg-success/20 text-success border-success/30"
                  : "bg-elevated text-muted-foreground border-border hover:bg-elevated"
              )}
            >
              {hideDone ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{hideDone ? "Faites masquées" : "Tout afficher"}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowResources(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-elevated hover:bg-elevated text-foreground border border-border transition-colors"
            >
              <Package className="w-3.5 h-3.5 text-warning" />
              <span>Ressources</span>
            </button>

            {/* Launch In-Game Overlay */}
            <button
              type="button"
              onClick={handleLaunchOverlay}
              className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-success to-success/20 hover:from-success hover:to-success text-success-foreground font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-success/20"
              title="Affiche une mini-fenêtre flottante toujours au premier plan par-dessus Dofus"
            >
              <Sparkles className="w-4 h-4" />
              <span>Lancer l'Overlay en jeu</span>
            </button>
          </div>
        </div>

        {/* Search bar & Live Filter */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher une quête, un donjon, un PNJ, des coordonnées [X, Y]…"
            className="w-full h-10 pl-10 pr-10 rounded-2xl bg-elevated border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-success/50 focus:bg-elevated transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Global Progress bar */}
        <div className="w-full h-1.5 rounded-full bg-elevated overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-success via-success to-success transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* ── CHAPTERS & QUEST BLOCKS ── */}
      <div className="space-y-6">
        {milestones.map((ms, msIndex) => {
          const isDone = completedIds.has(ms.id);
          const isExpanded = expandedMs.has(ms.id) || searchQuery.trim().length > 0;
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

          // Filtrage "Faites masquées"
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
                className="py-6 my-4 border-y border-success/20 bg-gradient-to-r from-success/20 via-surface/40 to-success/20 rounded-2xl text-center px-4"
              >
                <span className="text-[11px] font-black uppercase tracking-widest text-success block mb-1">
                  Étape Charnière
                </span>
                <h3 className="text-lg font-black text-foreground font-heading">{ms.title}</h3>
                {ms.description && <p className="text-xs text-muted-foreground mt-1">{ms.description}</p>}
              </div>
            );
          }

          return (
            <div
              key={ms.id}
              className={cn(
                "rounded-3xl border transition-all overflow-hidden shadow-xl",
                isDone
                  ? "bg-surface/40 border-success/20 opacity-85"
                  : "bg-surface/60 border-border hover:border-border"
              )}
            >
              {/* Chapter Header */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-4 sm:p-6 border-b border-border gap-4 bg-elevated">
                <button
                  type="button"
                  onClick={() => toggleChapter(ms.id)}
                  className="flex items-center gap-4 min-w-0 text-left flex-1"
                >
                  <div
                    className={cn(
                      "w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 border transition-all p-1",
                      isDone
                        ? "bg-success text-success-foreground border-success shadow-lg shadow-success/20"
                        : chapterDofusImg
                        ? "bg-warning/10 border-warning/30 text-warning shadow-md shadow-warning/10"
                        : "bg-elevated text-muted-foreground border-border"
                    )}
                  >
                    {isDone ? (
                      <Check className="w-5 h-5 stroke-[3]" />
                    ) : chapterDofusImg ? (
                      <img
                        src={chapterDofusImg}
                        alt={ms.title}
                        className="w-7 h-7 object-contain drop-shadow-[0_0_8px_rgba(230,185,107,0.4)]"
                      />
                    ) : (
                      msIndex + 1
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black uppercase tracking-wider text-success">
                        {ms.chapterLabel || `Chapitre ${ms.chapter}`}
                      </span>
                      {chapterDofusImg && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-warning/15 border border-warning/30 text-warning shadow-sm">
                          <img src={chapterDofusImg} alt="" className="w-3 h-3 object-contain" />
                          Dofus en jeu
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {msDoneCount} / {sequences.length} étapes ({msPercent}%)
                      </span>
                    </div>
                    <h2 className="text-base sm:text-lg font-black text-foreground truncate font-heading mt-0.5">
                      {ms.title}
                    </h2>
                  </div>

                  <ChevronDown
                    className={cn(
                      "w-5 h-5 text-muted-foreground transition-transform duration-200 shrink-0",
                      isExpanded && "rotate-180"
                    )}
                  />
                </button>

                {/* Quick Chapter Action: Mark all done */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleChapterAll(ms.id, !isDone)}
                    className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-elevated hover:bg-elevated text-muted-foreground hover:text-foreground border border-border transition-colors"
                  >
                    {isDone ? "Tout décocher" : "Tout valider ✓"}
                  </button>
                </div>
              </div>

              {/* Progress bar du chapitre */}
              <div className="w-full h-1 bg-elevated">
                <div
                  className="h-full bg-success transition-all duration-300"
                  style={{ width: `${msPercent}%` }}
                />
              </div>

              {/* Chapter Sequences & Quest Blocks */}
              {isExpanded && (
                <div className="p-4 sm:p-6 space-y-5">
                  {questBlocks.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center italic">
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
                          "rounded-2xl border transition-all overflow-hidden",
                          block.isDone
                            ? "bg-surface/40 border-border/60 opacity-65"
                            : "bg-surface/80 border-border shadow-md"
                        )}
                      >
                        {/* ── EN-TÊTE DU BLOC DE QUÊTE (multi-étapes uniquement) ── */}
                        {!isSingleStep && (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 sm:px-4 bg-elevated border-b border-border">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {questDofusImg ? (
                              <img
                                src={questDofusImg}
                                alt="Dofus"
                                className="w-5 h-5 object-contain drop-shadow-[0_0_8px_rgba(230,185,107,0.4)] shrink-0"
                              />
                            ) : (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src="/assets/icons/icone-quete.png" alt="" className="w-5 h-5 object-contain opacity-90 shrink-0" loading="lazy" />
                            )}
                            {(() => {
                              const primaryUrl = block.dofuspourlesnoobsUrl || block.dofusdbUrl || null;
                              const cls = "text-xs sm:text-sm font-bold truncate font-[family-name:var(--font-cinzel)] tracking-wide";
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

                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-elevated text-muted-foreground shrink-0">
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
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-success/40 bg-success/15 hover:bg-success/25 text-success transition-all text-xs font-bold"
                                    title="Valider toutes les étapes du bloc"
                                  >
                                    <Check className="w-3.5 h-3.5" />Valider
                                  </button>
                                )}
                                {(bmInBlock || firstUndone) && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleBookmark(ms.id, bmInBlock ? (bmSeqId as string) : (firstUndone as RushSequence).id)}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all text-xs font-semibold ${bmInBlock ? "bg-warning/15 border-warning/40 text-warning" : "bg-surface border-border text-muted-foreground hover:text-warning hover:border-warning/40"}`}
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
                                <div key={seq.id} className="p-4 rounded-2xl bg-black/30 border border-border space-y-3">
                                  <div className="flex items-center justify-between gap-3 pb-2 border-b border-border">
                                    <div className="flex items-center gap-3">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleStep(ms.id, seq.id)}
                                        aria-label={stepDone ? "Décocher" : "Valider cette préparation"}
                                        className={cn(
                                          "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer",
                                          stepDone
                                            ? "bg-success border-success text-success-foreground"
                                            : "border-border bg-surface/60 hover:border-success"
                                        )}
                                      >
                                        {stepDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
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
                                  "group flex flex-col gap-2 p-3 rounded-xl border transition-all",
                                  stepDone
                                    ? "bg-surface/40 border-border/60 opacity-60"
                                    : isBookmarked
                                    ? "bg-warning/10 border-warning/40 shadow-sm"
                                    : "bg-elevated hover:bg-elevated border-border"
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
                                        "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 transition-all cursor-pointer",
                                        stepDone
                                          ? "bg-success border-success text-success-foreground"
                                          : "border-border bg-surface/60 hover:border-success"
                                      )}
                                    >
                                      {stepDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                    </button>

                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {activeObjective?.sequence.id === seq.id && activeObjective?.milestone.id === ms.id && !stepDone && (
                                          <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-info/15 text-info border border-info/25 shrink-0">À faire</span>
                                        )}
                                        {/* Nom de quête (blocs mono-étape : pas d'en-tête, la ligne porte le nom) */}
                                        {isSingleStep && (
                                          <>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src="/assets/icons/icone-quete.png" alt="" className="w-4 h-4 object-contain opacity-90 shrink-0 self-center" loading="lazy" />
                                            {(() => {
                                              const primaryUrl = (seq as any).dofuspourlesnoobsUrl || (seq as any).dofusdbUrl || block.dofuspourlesnoobsUrl || block.dofusdbUrl || null;
                                              const cls = "text-[13px] font-semibold leading-snug tracking-wide font-[family-name:var(--font-cinzel)] break-words min-w-0";
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
                                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-info/10 border border-info/40 text-info text-[9px] font-black uppercase tracking-wider shrink-0"
                                              title={`Quête d'alignement → ${label} ${align.level}`}
                                            >
                                              {/* eslint-disable-next-line @next/next/no-img-element */}
                                              <img src={align.camp === "brakmarien" ? "/ordres/brakmar.png" : "/ordres/bonta.png"} alt="" className="w-3 h-3 object-contain" />
                                              ↦ {label} {align.level}
                                            </span>
                                          );
                                        })()}

                                        {seq.isSuccess && (
                                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-warning/15 text-warning border border-warning/30">
                                            Succès
                                          </span>
                                        )}

                                        {seq.isOptional && (
                                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-elevated text-muted-foreground">
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
                                              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer",
                                              isResourceExpanded
                                                ? "bg-warning/20 text-warning border-warning/40"
                                                : "bg-elevated text-muted-foreground border-border hover:bg-elevated"
                                            )}
                                          >
                                            <Package className="w-3 h-3 text-warning" />
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
                                    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-elevated/50 p-0.5">
                                      {/* Favicon DPNL */}
                                      {seq.dofuspourlesnoobsUrl && (
                                        <a
                                          href={seq.dofuspourlesnoobsUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-1.5 rounded-md hover:bg-elevated transition-colors"
                                          title="Soluce DofusPourLesNoobs"
                                        >
                                          <img
                                            src="https://www.google.com/s2/favicons?domain=dofuspourlesnoobs.com&sz=32"
                                            alt="DPNL"
                                            className="w-3.5 h-3.5 rounded-sm"
                                          />
                                        </a>
                                      )}

                                      {/* Favicon DofusDB */}
                                      {seq.dofusdbUrl && (
                                        <a
                                          href={seq.dofusdbUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-1.5 rounded-md hover:bg-elevated transition-colors"
                                          title="Fiche DofusDB"
                                        >
                                          <img
                                            src="https://www.google.com/s2/favicons?domain=dofusdb.fr&sz=32"
                                            alt="DofusDB"
                                            className="w-3.5 h-3.5 rounded-sm"
                                          />
                                        </a>
                                      )}

                                      {/* Bouton Drapeau Repère (Je suis ici) */}
                                      <button
                                        type="button"
                                        onClick={() => handleToggleBookmark(ms.id, seq.id)}
                                        className={cn(
                                          "p-1.5 rounded-md transition-colors cursor-pointer",
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
                                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-elevated transition-colors cursor-pointer"
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
                                        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                                      >
                                        <Sparkles className="w-2.5 h-2.5 shrink-0" />
                                        {isHintsOpen ? "Masquer" : "Conseils & notes"}
                                        <ChevronDown className={`w-3 h-3 ml-auto transition-transform duration-150 ${isHintsOpen ? "rotate-180" : ""}`} />
                                      </button>
                                      {isHintsOpen && (
                                        <div className="px-2.5 pb-2.5 space-y-1.5">
                                          {mainTip && (
                                            <p className={cn("text-xs leading-relaxed", stepDone ? "text-muted-foreground line-through" : "text-muted-foreground")}>
                                              {mainTip}
                                            </p>
                                          )}
                                          {succesPart && (
                                            <div className="flex items-center gap-1.5">
                                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-warning bg-warning/10 border border-warning/25 px-2 py-0.5 rounded-md">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src="/assets/dofus/game-icons/trophy-1.png" alt="" className="w-3 h-3 object-contain" />
                                                Succès : {succesPart}
                                              </span>
                                            </div>
                                          )}
                                          {seq.note && (
                                            <p className="text-[11px] text-warning/80 italic">
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
                                  <div className="pt-2 border-t border-border animate-in fade-in duration-200">
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
          resources={aggregateRushResources(milestones)}
          allResources={aggregateRushResources(milestones)}
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
              <div className="bg-surface border border-border rounded-2xl p-5 max-w-sm w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-3">
                  <Flag className="w-5 h-5 text-success" />
                  <h3 className="text-sm font-black text-foreground" style={{ fontFamily: "var(--font-cinzel)" }}>Reprendre ?</h3>
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
                    className="flex-1 px-4 py-2.5 rounded-xl bg-success hover:bg-success text-success-foreground text-caption font-black uppercase tracking-widest"
                  >
                    Reprendre
                  </button>
                  <button
                    onClick={() => setContinueModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-elevated hover:bg-muted text-muted-foreground text-caption font-black uppercase tracking-widest"
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
            className="fixed right-4 z-[100] flex flex-col items-center gap-1 bg-background/90 border border-success/20 rounded-2xl py-2 px-1.5 shadow-2xl"
            style={{ top: "50%", transform: "translateY(-50%)" }}
          >
            <button
              onClick={scrollToTop}
              disabled={!showScrollTop}
              className={`p-2 rounded-xl transition-all ${showScrollTop ? "text-muted-foreground hover:text-foreground hover:bg-elevated cursor-pointer" : "text-muted-foreground cursor-not-allowed"}`}
              title="Remonter en haut"
              aria-label="Remonter en haut"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (activeObjective) scrollToStep(activeObjective.sequence.id);
              }}
              disabled={!activeObjective}
              className={`p-2 rounded-xl transition-all ${activeObjective ? "text-success hover:bg-success/10 cursor-pointer" : "text-muted-foreground cursor-not-allowed"}`}
              title="Revenir à la position actuelle"
              aria-label="Revenir à la position actuelle"
            >
              <MapPin className="w-4 h-4" />
            </button>
            <button
              onClick={scrollToBottom}
              disabled={!showScrollBottom}
              className={`p-2 rounded-xl transition-all ${showScrollBottom ? "text-muted-foreground hover:text-foreground hover:bg-elevated cursor-pointer" : "text-muted-foreground cursor-not-allowed"}`}
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
            onClose={() => pipWin?.close?.()}
          />,
          pipWin.document.body
        )}
    </>
  );
}

"use client";

import React, { useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ExternalLink,
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
  Scroll,
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
import { RushTagBadge } from "@/components/dofus-quests/rush/RushTagBadge";
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

// ─── Composant Dédié : Grille de Ressources Élégante (Style Guide Interne) ──

function QuestItemResourceGrid({
  items,
  completedIds,
  onToggleItem,
}: {
  items: RushActivityTag[];
  completedIds: Set<string>;
  onToggleItem?: (id: string) => void;
}) {
  const [filterMode, setFilterMode] = useState<"remaining" | "all">("remaining");
  const [copiedName, setCopiedName] = useState<string | null>(null);

  const parsedItems = useMemo(() => {
    return items.map((it, idx) => ({
      key: it.id || `${it.name}-${idx}`,
      id: it.id,
      name: it.name || "Ressource",
      count: it.count || it.quantity || 1,
      level: it.level,
      imageUrl: it.imageUrl,
      isDone: it.id ? completedIds.has(it.id) : false,
    }));
  }, [items, completedIds]);

  const visibleItems = useMemo(() => {
    if (filterMode === "remaining") {
      return parsedItems.filter((it) => !it.isDone);
    }
    return parsedItems;
  }, [parsedItems, filterMode]);

  const remainingCount = parsedItems.filter((it) => !it.isDone).length;

  const handleCopy = (name: string) => {
    copyToClipboard(name).then((ok) => {
      if (ok) {
        setCopiedName(name);
        toast.success(`Copié : ${name}`, { duration: 1500 });
        setTimeout(() => setCopiedName(null), 1800);
      }
    });
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1219]/90 p-3.5 space-y-3 shadow-inner">
      {/* En-tête avec filtres Restantes / Toutes */}
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2.5">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-black uppercase tracking-wider text-zinc-200">
            Ressources requises
          </span>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30">
            {remainingCount} restante{remainingCount > 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/5">
          <button
            type="button"
            onClick={() => setFilterMode("remaining")}
            className={cn(
              "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors",
              filterMode === "remaining"
                ? "bg-emerald-500 text-zinc-950 shadow-sm"
                : "text-zinc-400 hover:text-white"
            )}
          >
            Restantes
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("all")}
            className={cn(
              "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors",
              filterMode === "all"
                ? "bg-emerald-500 text-zinc-950 shadow-sm"
                : "text-zinc-400 hover:text-white"
            )}
          >
            Toutes ({parsedItems.length})
          </button>
        </div>
      </div>

      {/* Grille compacte des items avec icône Dofus officielle */}
      {visibleItems.length === 0 ? (
        <p className="text-xs text-zinc-500 py-3 text-center italic">
          Toutes les ressources de cette étape sont réunies !
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
          {visibleItems.map((item) => (
            <div
              key={item.key}
              onClick={() => handleCopy(item.name)}
              className={cn(
                "group flex items-center justify-between gap-2.5 p-2 rounded-xl border transition-all cursor-pointer select-none",
                item.isDone
                  ? "bg-zinc-950/40 border-white/[0.04] opacity-50"
                  : "bg-[#131922] hover:bg-[#192230] border-white/[0.08] hover:border-amber-500/40 shadow-sm"
              )}
              title="Cliquer pour copier le nom"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-lg bg-black/60 border border-white/10 flex items-center justify-center shrink-0 p-0.5 overflow-hidden shadow-inner">
                  <ResourceImage
                    id={item.id}
                    imageUrl={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "text-xs font-semibold block truncate group-hover:text-amber-300 transition-colors",
                      item.isDone ? "line-through text-zinc-500" : "text-zinc-100"
                    )}
                  >
                    {item.name}
                  </span>
                  {item.level && (
                    <span className="text-[10px] text-zinc-500 font-mono">Niv. {item.level}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={cn(
                    "font-mono font-bold text-xs px-2 py-0.5 rounded-lg border",
                    item.isDone
                      ? "bg-zinc-900 border-zinc-800 text-zinc-600"
                      : "bg-amber-500/15 border-amber-500/30 text-amber-300"
                  )}
                >
                  ×{item.count}
                </span>

                {copiedName === item.name ? (
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <Copy className="w-3 h-3 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
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

  // Modale de détail d'étape (comme le bouton (i) du guide interne)
  const [detailModalSeq, setDetailModalSeq] = useState<{
    milestone: RushMilestone;
    sequence: RushSequence;
  } | null>(null);

  // État des accordéons de ressources par étape
  const [expandedResourceSteps, setExpandedResourceSteps] = useState<Set<string>>(new Set());

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

  // Bookmark / Repère personnel ("Je suis ici")
  const handleToggleBookmark = useCallback(
    (msId: string, seqId: string) => {
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
      if (isDocumentPipSupported()) {
        win = await openPipWindow({ width: 420, height: 720 });
      } else {
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

      setPipWin(win);
      toast.success("🪟 Mini-fenêtre Overlay ouverte par-dessus votre jeu !", {
        description: "Gardez-la au-dessus de votre client Dofus pour suivre chaque étape.",
        duration: 4000,
      });
    } catch (e) {
      console.error("[Overlay Launch Error]:", e);
      toast.error("Erreur lors de l'ouverture de l'overlay.");
    }
  };

  return (
    <>
      {/* ── OBJECTIF EN COURS (Hero Banner interactif) ── */}
      {activeObjective && (
        <div className="mb-8 rounded-3xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/60 via-[#0d1418] to-zinc-950 p-5 sm:p-6 shadow-2xl relative overflow-hidden backdrop-blur-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-black uppercase tracking-wider">
                  <Target className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  {activeObjective.isBookmarked ? "Repère Actif (Je suis ici)" : "Prochain Objectif"}
                </span>
                <span className="text-xs text-zinc-400 font-medium">
                  {activeObjective.milestone.title}
                </span>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-lg sm:text-xl font-black text-white truncate font-heading">
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
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
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
                <p className="text-xs sm:text-sm text-zinc-300 line-clamp-2 bg-black/30 p-2.5 rounded-xl border border-white/5">
                  💡 <span className="font-semibold text-zinc-200">Conseil :</span> {activeObjective.sequence.tips}
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
                className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Valider cette étape</span>
              </button>

              <button
                type="button"
                onClick={handleLaunchOverlay}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-zinc-100 font-bold text-xs border border-white/10 transition-colors"
                title="Détacher la mini-fenêtre par-dessus le jeu Dofus"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Overlay en jeu</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STICKY CONTROL BAR & SEARCH ── */}
      <div className="sticky top-16 z-30 mb-8 rounded-3xl border border-white/10 bg-[#0d1117]/95 p-4 sm:p-5 shadow-2xl backdrop-blur-xl space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* Progress summary */}
          <div className="flex items-center gap-3.5">
            <div className="relative w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <img
                src={guide.imageUrl || "/module-dofus/Dofus_Sylvestre.png"}
                alt="Dofus Sylvestre"
                className="w-8 h-8 object-contain drop-shadow"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400">Progression Locale</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono font-bold">
                  100% Gratuit
                </span>
              </div>
              <p className="text-sm font-bold text-zinc-100 tabular-nums">
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
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                  : "bg-white/[0.04] text-zinc-300 border-white/10 hover:bg-white/[0.08]"
              )}
            >
              {hideDone ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{hideDone ? "Faites masquées" : "Tout afficher"}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowResources(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 border border-white/10 transition-colors"
            >
              <Package className="w-3.5 h-3.5 text-amber-400" />
              <span>Ressources</span>
            </button>

            {/* Launch In-Game Overlay */}
            <button
              type="button"
              onClick={handleLaunchOverlay}
              className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20"
              title="Affiche une mini-fenêtre flottante toujours au premier plan par-dessus Dofus"
            >
              <Sparkles className="w-4 h-4" />
              <span>Lancer l'Overlay en jeu</span>
            </button>
          </div>
        </div>

        {/* Search bar & Live Filter */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher une quête, un donjon, un PNJ, des coordonnées [X, Y]…"
            className="w-full h-10 pl-10 pr-10 rounded-2xl bg-white/[0.04] border border-white/10 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.06] transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Global Progress bar */}
        <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 transition-all duration-300"
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

          if (questBlocks.length === 0 && searchQuery.trim().length > 0) {
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
                className="py-6 my-4 border-y border-emerald-500/20 bg-gradient-to-r from-emerald-950/20 via-surface/40 to-emerald-950/20 rounded-2xl text-center px-4"
              >
                <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400 block mb-1">
                  Étape Charnière
                </span>
                <h3 className="text-lg font-black text-white font-heading">{ms.title}</h3>
                {ms.description && <p className="text-xs text-zinc-400 mt-1">{ms.description}</p>}
              </div>
            );
          }

          return (
            <div
              key={ms.id}
              className={cn(
                "rounded-3xl border transition-all overflow-hidden shadow-xl",
                isDone
                  ? "bg-zinc-950/40 border-emerald-500/20 opacity-85"
                  : "bg-surface/60 border-white/[0.08] hover:border-white/[0.14]"
              )}
            >
              {/* Chapter Header */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-4 sm:p-6 border-b border-white/[0.06] gap-4 bg-white/[0.01]">
                <button
                  type="button"
                  onClick={() => toggleChapter(ms.id)}
                  className="flex items-center gap-4 min-w-0 text-left flex-1"
                >
                  <div
                    className={cn(
                      "w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 border transition-all p-1",
                      isDone
                        ? "bg-emerald-500 text-zinc-950 border-emerald-400 shadow-lg shadow-emerald-500/20"
                        : chapterDofusImg
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-300 shadow-md shadow-amber-500/10"
                        : "bg-white/[0.06] text-zinc-300 border-white/10"
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
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                        {ms.chapterLabel || `Chapitre ${ms.chapter}`}
                      </span>
                      {chapterDofusImg && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 shadow-sm">
                          <img src={chapterDofusImg} alt="" className="w-3 h-3 object-contain" />
                          Dofus en jeu
                        </span>
                      )}
                      <span className="text-xs text-zinc-400 tabular-nums">
                        {msDoneCount} / {sequences.length} étapes ({msPercent}%)
                      </span>
                    </div>
                    <h2 className="text-base sm:text-lg font-black text-zinc-100 truncate font-heading mt-0.5">
                      {ms.title}
                    </h2>
                  </div>

                  <ChevronDown
                    className={cn(
                      "w-5 h-5 text-zinc-400 transition-transform duration-200 shrink-0",
                      isExpanded && "rotate-180"
                    )}
                  />
                </button>

                {/* Quick Chapter Action: Mark all done */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleChapterAll(ms.id, !isDone)}
                    className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/10 transition-colors"
                  >
                    {isDone ? "Tout décocher" : "Tout valider ✓"}
                  </button>
                </div>
              </div>

              {/* Progress bar du chapitre */}
              <div className="w-full h-1 bg-white/[0.04]">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${msPercent}%` }}
                />
              </div>

              {/* Chapter Sequences & Quest Blocks */}
              {isExpanded && (
                <div className="p-4 sm:p-6 space-y-5">
                  {questBlocks.length === 0 ? (
                    <p className="text-xs text-zinc-500 py-4 text-center italic">
                      Aucune étape correspondante.
                    </p>
                  ) : (
                    questBlocks.map((block, blockIdx) => {
                      const questDofusImg = resolveDofusLocalImage(block.questName) || resolveDofusLocalImage(ms.title);
                      return (
                      <div
                        key={`${block.questRef}-${blockIdx}`}
                        className={cn(
                          "rounded-2xl border transition-all overflow-hidden",
                          block.isDone
                            ? "bg-zinc-950/40 border-zinc-800/60 opacity-65"
                            : "bg-[#0f141c]/80 border-white/[0.08] shadow-md"
                        )}
                      >
                        {/* ── EN-TÊTE DU BLOC DE QUÊTE (Séparateur visuel propre) ── */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 sm:px-4 bg-white/[0.02] border-b border-white/[0.06]">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {questDofusImg ? (
                              <img
                                src={questDofusImg}
                                alt="Dofus"
                                className="w-5 h-5 object-contain drop-shadow-[0_0_8px_rgba(230,185,107,0.4)] shrink-0"
                              />
                            ) : (
                              <Scroll className="w-4 h-4 text-emerald-400 shrink-0" />
                            )}
                            <h4 className="text-xs sm:text-sm font-bold text-zinc-100 truncate">
                              {block.questName}
                            </h4>

                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-white/[0.06] text-zinc-400 shrink-0">
                              {block.doneCount} / {block.totalCount}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center flex-wrap">
                            {/* Boss / Donjons requis avec lien vers la fiche boss */}
                            {block.dungeons.map((dj) => {
                              const bossDisplayName = dj.bossName || dj.name.replace(/^Donjon (du |de la |de l'|de |des )/i, "");
                              return (
                                <Link
                                  key={dj.id}
                                  href={`/boss/${encodeURIComponent(dj.id)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-bold transition-all group/boss shadow-sm cursor-pointer"
                                  title={`Voir la fiche boss de ${bossDisplayName}`}
                                >
                                  {dj.imageUrl ? (
                                    <img src={dj.imageUrl} alt={bossDisplayName} className="w-4 h-4 rounded object-cover" />
                                  ) : (
                                    <Sword className="w-3.5 h-3.5 text-amber-400" />
                                  )}
                                  <span className="truncate max-w-[150px] group-hover/boss:text-amber-200 group-hover/boss:underline">
                                    {bossDisplayName}
                                  </span>
                                  <ExternalLink className="w-3 h-3 text-amber-400/70 shrink-0" />
                                </Link>
                              );
                            })}
                          </div>
                        </div>

                        {/* ── ÉTAPES DE LA QUÊTE ── */}
                        <div className="p-2 sm:p-3 space-y-2.5">
                          {block.sequences.map((seq, seqIdx) => {
                            const stepDone = doneSteps.has(seq.id);
                            const parsedCoord = getSequenceCoord(seq);
                            const djs =
                              seq.dungeons && seq.dungeons.length > 0
                                ? seq.dungeons
                                : seq.dungeon
                                ? [seq.dungeon]
                                : [];

                            // Extraction et séparation des tags d'items pour ne PAS polluer la ligne
                            const allTags = seq.activityTags || [];
                            const itemTags = allTags.filter((t) => t.type === "item");
                            const nonItemTags = allTags.filter((t) => t.type !== "item");

                            const hasManyItems = itemTags.length > 0;
                            const isResourceExpanded = expandedResourceSteps.has(seq.id);
                            const isBookmarked = bookmarksByMs.get(ms.id) === seq.id;
                            const isPrepResources = block.questName === "Ressources à prévoir" || seq.subGuideName === "Ressources à prévoir";

                            if (isPrepResources) {
                              return (
                                <div key={seq.id} className="p-4 rounded-2xl bg-black/30 border border-white/[0.08] space-y-3">
                                  <div className="flex items-center justify-between gap-3 pb-2 border-b border-white/[0.06]">
                                    <div className="flex items-center gap-3">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleStep(ms.id, seq.id)}
                                        aria-label={stepDone ? "Décocher" : "Valider cette préparation"}
                                        className={cn(
                                          "w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-colors cursor-pointer",
                                          stepDone
                                            ? "bg-emerald-500 border-emerald-400 text-zinc-950"
                                            : "border-zinc-700 bg-zinc-900/60 hover:border-emerald-500/50"
                                        )}
                                      >
                                        {stepDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                      </button>
                                      <div>
                                        <h5 className="text-xs font-bold text-zinc-100">
                                          Ressources requises pour l'ensemble du parcours
                                        </h5>
                                        <p className="text-[11px] text-zinc-400">
                                          Préparez ces ressources à l'avance pour enchaîner les étapes sans faire d'allers-retours en HDV.
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                  <QuestItemResourceGrid
                                    items={itemTags}
                                    completedIds={completedIds}
                                  />
                                </div>
                              );
                            }

                            return (
                              <div
                                key={seq.id}
                                className={cn(
                                  "group flex flex-col gap-2 p-3 rounded-xl border transition-all",
                                  stepDone
                                    ? "bg-zinc-950/40 border-zinc-800/60 opacity-60"
                                    : isBookmarked
                                    ? "bg-amber-950/20 border-amber-500/40 shadow-sm"
                                    : "bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.06]"
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
                                        "w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 transition-colors cursor-pointer",
                                        stepDone
                                          ? "bg-emerald-500 border-emerald-400 text-zinc-950"
                                          : "border-zinc-700 bg-zinc-900/60 hover:border-emerald-500/50"
                                      )}
                                    >
                                      {stepDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                    </button>

                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[10px] font-mono text-zinc-500 font-bold">
                                          Étape {seqIdx + 1}
                                        </span>

                                        {seq.isSuccess && (
                                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                            Succès
                                          </span>
                                        )}

                                        {seq.isOptional && (
                                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                                            Bonus
                                          </span>
                                        )}

                                        {/* Tags d'activité filtrés (pas 100 items !) */}
                                        {nonItemTags.slice(0, 4).map((tag, tagIdx) => (
                                          <RushTagBadge key={tagIdx} tag={tag} size="sm" />
                                        ))}

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
                                                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                                : "bg-white/[0.04] text-zinc-300 border-white/10 hover:bg-white/[0.08]"
                                            )}
                                          >
                                            <Package className="w-3 h-3 text-amber-400" />
                                            <span>{itemTags.length} ressource{itemTags.length > 1 ? "s" : ""}</span>
                                            {isResourceExpanded ? (
                                              <ChevronUp className="w-3 h-3" />
                                            ) : (
                                              <ChevronDown className="w-3 h-3" />
                                            )}
                                          </button>
                                        )}
                                      </div>

                                      {/* Consigne / Astuce (aérée, pas de saut au survol souris) */}
                                      {seq.tips && (() => {
                                        const parts = seq.tips.split(/·?\s*Succès\s*:\s*/i);
                                        const mainTip = parts[0]?.trim();
                                        const succesPart = parts[1]?.trim();
                                        return (
                                          <div className="mt-1 space-y-1">
                                            {mainTip && (
                                              <p
                                                className={cn(
                                                  "text-xs leading-relaxed",
                                                  stepDone ? "text-zinc-500 line-through" : "text-zinc-300"
                                                )}
                                              >
                                                {mainTip}
                                              </p>
                                            )}
                                            {succesPart && (
                                              <div className="flex items-center gap-1.5 pt-0.5">
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-md">
                                                  🏆 Succès : {succesPart}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })()}

                                      {seq.note && (
                                        <p className="text-[11px] text-amber-300/80 italic mt-0.5">
                                          Note : {seq.note}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  {/* Barre d'Actions d'Étape (Capture 4 : Coordonnées, Boss cliquable, Favicons DofusDB/DPNL, Bookmark, Détails) */}
                                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center flex-wrap">
                                    {parsedCoord && (
                                      <RushCoordinateChip coordText={parsedCoord.raw} />
                                    )}

                                    {/* Boss spécifique à l'étape s'il n'est pas déjà dans l'en-tête du bloc */}
                                    {djs.filter((dj) => !block.dungeons.some((bd) => bd.id === dj.id)).map((dj) => {
                                      const bossDisplayName = dj.bossName || dj.name.replace(/^Donjon (du |de la |de l'|de |des )/i, "");
                                      return (
                                        <Link
                                          key={dj.id}
                                          href={`/boss/${encodeURIComponent(dj.id)}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[10px] font-bold transition-colors cursor-pointer"
                                          title={`Fiche boss : ${bossDisplayName}`}
                                        >
                                          <Sword className="w-3 h-3 text-amber-400" />
                                          <span>{bossDisplayName}</span>
                                        </Link>
                                      );
                                    })}

                                    {/* Groupe d'actions 4 boutons (comme le guide interne) */}
                                    <div className="flex items-center gap-0.5 rounded-lg border border-white/[0.08] bg-white/[0.03] p-0.5">
                                      {/* Favicon DPNL */}
                                      {seq.dofuspourlesnoobsUrl && (
                                        <a
                                          href={seq.dofuspourlesnoobsUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-1.5 rounded-md hover:bg-white/[0.08] transition-colors"
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
                                          className="p-1.5 rounded-md hover:bg-white/[0.08] transition-colors"
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
                                            ? "text-[#e6b96b] bg-[#e6b96b]/15"
                                            : "text-zinc-400 hover:text-[#e6b96b] hover:bg-white/[0.08]"
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
                                        className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                                        title="Voir les détails complets de l'étape"
                                      >
                                        <Info className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {/* Panneau déroulant des ressources de l'étape (si déplié) */}
                                {hasManyItems && isResourceExpanded && (
                                  <div className="pt-2 border-t border-white/[0.06] animate-in fade-in duration-200">
                                    <QuestItemResourceGrid
                                      items={itemTags}
                                      completedIds={completedIds}
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
            onClose={() => pipWin?.close?.()}
          />,
          pipWin.document.body
        )}
    </>
  );
}

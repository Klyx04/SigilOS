"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { CheckCircle2, Eye, EyeOff, ExternalLink, Check, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  toggleMilestoneProgress,
  setRushSequenceProgress,
  setRushBookmark,
  applyRushAlignmentFromSequence,
} from "@/server/actions/optimized-guide-actions";
import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";
import { type GuideProgressRow } from "@/lib/guide-progress-helpers";
import { isInfoSequence, getPrereqRefs, type RushPrereqRef } from "@/lib/rush-guide-utils";
import { collectCascadeUncheck } from "@/lib/rush-helpers";
import { useGuideProgressSync } from "@/hooks/use-guide-sync";
import { RushOverlayHeader } from "./components/RushOverlayHeader";
import { RushOverlaySearch } from "./components/RushOverlaySearch";
import { RushOverlayChapterTree } from "./components/RushOverlayChapterTree";
import { RushOverlayQuestListItem } from "./components/RushOverlayQuestListItem";
import { RushOverlayQuestPanel } from "./components/RushOverlayQuestPanel";
import { RushOverlayFooter } from "./components/RushOverlayFooter";
import { RushOverlayCompact } from "./components/RushOverlayCompact";
import { RushCurrentObjective } from "@/components/dofus-quests/rush/RushCurrentObjective";
import { getNextObjective } from "./components/overlay-utils";

// Dofus defs pour récupération des visuels d'œufs
const DOFUS_DEFS: Record<string, { label: string; imageUrl: string; color: string }> = {
  argente: { label: "Argenté", imageUrl: "/module-dofus/Dofus_Argente.png", color: "#a8c0d6" },
  cawotte: { label: "Cawotte", imageUrl: "/module-dofus/Dofus_Cawotte.png", color: "#f59e0b" },
  dokoko: { label: "Dokoko", imageUrl: "/module-dofus/Dofus_Dokoko.png", color: "#a3e635" },
  emeraude: { label: "Émeraude", imageUrl: "/module-dofus/Dofus_Emeraude.png", color: "#10b981" },
  pourpre: { label: "Pourpre", imageUrl: "/module-dofus/Dofus_Pourpre.png", color: "#ef4444" },
  turquoise: { label: "Turquoise", imageUrl: "/module-dofus/Dofus_Turquoise.png", color: "#06b6d4" },
  vulbis: { label: "Vulbis", imageUrl: "/module-dofus/Dofus_Vulbis.png", color: "#f97316" },
  ocre: { label: "Ocre", imageUrl: "/assets/icons/ocre.png", color: "#eab308" },
  ébène: { label: "Ébène", imageUrl: "/module-dofus/Dofus_Ebene.png", color: "#6366f1" },
  ivoire: { label: "Ivoire", imageUrl: "/module-dofus/Dofus_Ivoire.png", color: "#f1f5f9" },
  abyssal: { label: "Abyssal", imageUrl: "/module-dofus/Dofus_Abyssal.png", color: "#3b82f6" },
  sylvestre: { label: "Sylvestre", imageUrl: "/module-dofus/Dofus_Sylvestre.png", color: "#39bc95" },
};

type Props = {
  guildId: string;
  guide: { name: string; slug: string; description?: string; imageUrl?: string };
  milestones: RushMilestone[];
  allProgress: GuideProgressRow[];
  altPseudo: string | null;
  onClose?: () => void;
};

export default function GuideOverlayClient({ guildId, guide, milestones: rawMilestones, allProgress, altPseudo, onClose }: Props) {
  const effectiveAltPseudo = altPseudo ?? undefined;

  const milestones = useMemo(
    () => rawMilestones.filter((ms) => !["SEPARATEUR", "INFO", "DOFUS_OBTAINED"].includes(ms.type || "")),
    [rawMilestones]
  );

  // ─── Thème Clair / Sombre ─────────────────────────────────────────────────
  const [isLightMode, setIsLightMode] = useState<boolean>(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sigil_overlay_theme");
      if (saved === "light") setIsLightMode(true);
    } catch {}
  }, []);

  const toggleTheme = useCallback(() => {
    setIsLightMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sigil_overlay_theme", next ? "light" : "dark");
      } catch {}
      toast(next ? "☀️ Mode Clair activé" : "🌙 Mode Sombre activé", { duration: 1200 });
      return next;
    });
  }, []);

  // ─── Mode compact (jeu) ───────────────────────────────────────────────────
  const [isCompactMode, setIsCompactMode] = useState<boolean>(false);

  // Mode jeu: replie l'overlay en mode compact.
  const enterGameMode = useCallback(() => {
    setIsCompactMode(true);
  }, []);

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
      return;
    }
    try {
      window.close();
    } catch {
      // window.close() refuse: on reduit l'overlay en mode compact plutot que de rien faire
      setIsCompactMode(true);
    }
  }, [onClose]);

  // ─── Progression Locale Optimiste ─────────────────────────────────────────
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => {
    const s = new Set<string>();
    milestones.forEach((ms) => {
      if (ms.playerProgress?.[0]?.isCompleted) s.add(ms.id);
    });
    return s;
  });

  const [completedStepsByMs, setCompletedStepsByMs] = useState<Map<string, Set<string>>>(() => {
    const m = new Map<string, Set<string>>();
    milestones.forEach((ms) => {
      const ids = ms.playerProgress?.[0]?.completedStepIds;
      if (Array.isArray(ids)) m.set(ms.id, new Set(ids));
    });
    return m;
  });

  const [bookmarksByMs, setBookmarksByMs] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>();
    milestones.forEach((ms) => {
      const bk = ms.playerProgress?.[0]?.bookmarkedSeqId;
      if (bk) m.set(ms.id, bk);
    });
    return m;
  });

  // ─── Synchro dashboard ↔ overlay (BroadcastChannel, même navigateur) ─────
  // Aligne « ce qui est coché » entre la fenêtre du module et l'overlay.
  useGuideProgressSync(
    guildId,
    guide.slug,
    { completedIds, completedStepsByMs, bookmarksByMs },
    { setCompletedIds, setCompletedStepsByMs, setBookmarksByMs }
  );

  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [hideCompleted, setHideCompleted] = useState<boolean>(false);
  const [expandedSeqIds, setExpandedSeqIds] = useState<Set<string>>(new Set());

  const toggleHideCompleted = useCallback(() => {
    setHideCompleted((prev) => {
      const next = !prev;
      toast(next ? "👁️ Quêtes faites masquées" : "👁️ Toutes les quêtes affichées", { duration: 1200 });
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
    if (currentMsIndex < milestones.length - 1) {
      setCurrentMsIndex((v) => v + 1);
      setExpandedSeqIds(new Set());
    }
  }, [currentMsIndex, milestones.length]);

  const goToPrevMs = useCallback(() => {
    if (currentMsIndex > 0) {
      setCurrentMsIndex((v) => v - 1);
      setExpandedSeqIds(new Set());
    }
  }, [currentMsIndex]);

  const selectChapter = useCallback(
    (msId: string) => {
      const idx = milestones.findIndex((m) => m.id === msId);
      if (idx >= 0 && idx !== currentMsIndex) {
        setCurrentMsIndex(idx);
        setExpandedSeqIds(new Set());
      }
    },
    [milestones, currentMsIndex]
  );

  // ─── Recherche ─────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && !isCompactMode) {
        e.preventDefault();
        setTimeout(() => searchRef.current?.focus(), 50);
      }
      if (e.key === "Escape") {
        if (search) {
          setSearch("");
          searchRef.current?.blur();
        } else if (!isCompactMode) {
          setIsCompactMode(true);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [search, isCompactMode]);

  // ─── Stats Globales ───────────────────────────────────────────────────────
  // Les séquences info (bandeaux/conseils) ne comptent pas dans la progression.
  const contentSeqs = (seqs: RushSequence[]) => seqs.filter((s) => !isInfoSequence(s));

  const totalMs = milestones.length;
  const totalSteps = useMemo(() => milestones.reduce((acc, ms) => acc + contentSeqs(ms.sequences).length, 0), [milestones]);
  const completedSteps = useMemo(() => {
    let n = 0;
    for (const ms of milestones) n += completedStepsByMs.get(ms.id)?.size ?? 0;
    return n;
  }, [milestones, completedStepsByMs]);
  const overallPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  const currentMsSeqs = contentSeqs(currentMs?.sequences || []);
  const currentMsDoneSeqs = currentMs ? completedStepsByMs.get(currentMs.id) || new Set<string>() : new Set<string>();
  const currentMsDoneCount = currentMsSeqs.filter((s) => currentMsDoneSeqs.has(s.id)).length;
  const currentMsPct =
    currentMsSeqs.length > 0
      ? Math.round((currentMsDoneCount / currentMsSeqs.length) * 100)
      : completedIds.has(currentMs?.id || "")
        ? 100
        : 0;

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
  const validSeqIds = useMemo(() => {
    return new Set(currentMs?.sequences.map((s) => s.id) ?? []);
  }, [currentMs]);

  const bookmarkersBySeq = useMemo(() => {
    const map = new Map<string, { name: string; avatar?: string }[]>();
    if (!currentMs) return map;
    for (const row of allProgress) {
      if (row.milestoneId !== currentMs.id || !row.currentStep) continue;
      const raw = String(row.currentStep);
      const seqId = raw.startsWith("seq:") ? raw.slice(4) : raw;
      if (!validSeqIds.has(seqId)) continue;
      const list = map.get(seqId) || [];
      list.push({ name: row.userName, avatar: row.userAvatar });
      map.set(seqId, list);
    }
    return map;
  }, [allProgress, currentMs, validSeqIds]);

  // ─── Prérequis (gating de validation) ─────────────────────────────────────
  // Une quête ne peut être cochée que si toutes ses quêtes prérequis sont validées.
  const gateAllCompleted = useMemo(() => {
    const all = new Set<string>();
    completedStepsByMs.forEach((steps) => steps.forEach((id) => all.add(id)));
    return all;
  }, [completedStepsByMs]);

  const prereqBySeq = useMemo(() => {
    const map = new Map<string, RushPrereqRef[]>();
    if (!currentMs) return map;
    for (const seq of currentMs.sequences) {
      map.set(seq.id, getPrereqRefs(seq, milestones));
    }
    return map;
  }, [currentMs, milestones]);

  const getSeqGate = useCallback(
    (seqId: string): { locked: boolean; prereqs: RushPrereqRef[] } => {
      const refs = prereqBySeq.get(seqId) || [];
      return { locked: refs.some((r) => !gateAllCompleted.has(r.seqId)), prereqs: refs };
    },
    [prereqBySeq, gateAllCompleted]
  );

  const handleGoToPrereq = useCallback(
    (seqId: string, milestoneId: string) => {
      const idx = milestones.findIndex((m) => m.id === milestoneId);
      if (idx >= 0) {
        if (idx !== currentMsIndex) {
          setCurrentMsIndex(idx);
          setExpandedSeqIds(new Set([seqId]));
        } else {
          setExpandedSeqIds((prev) => new Set([...prev, seqId]));
        }
      }
      window.setTimeout(() => {
        document.getElementById(`overlay-seq-${seqId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 90);
    },
    [milestones, currentMsIndex]
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
  const handleToggleMs = useCallback(
    async (ms: RushMilestone) => {
      if (loadingIds.has(ms.id)) return;
      const was = completedIds.has(ms.id);
      setCompletedIds((prev) => {
        const n = new Set(prev);
        was ? n.delete(ms.id) : n.add(ms.id);
        return n;
      });
      setLoadingIds((prev) => new Set([...prev, ms.id]));
      try {
        const res = await toggleMilestoneProgress(guildId, ms.id, !was, effectiveAltPseudo);
        if (!(res as any)?.success) throw new Error("Échec mutation");
      } catch {
        setCompletedIds((prev) => {
          const n = new Set(prev);
          was ? n.add(ms.id) : n.delete(ms.id);
          return n;
        });
        toast.error("Erreur de synchronisation");
      } finally {
        setLoadingIds((prev) => {
          const n = new Set(prev);
          n.delete(ms.id);
          return n;
        });
      }
    },
    [completedIds, loadingIds, guildId, effectiveAltPseudo]
  );

  const handleToggleSeq = useCallback(
    async (ms: RushMilestone, seqId: string) => {
      const cur = new Set(completedStepsByMs.get(ms.id) || []);
      const was = cur.has(seqId);
      if (!was && getSeqGate(seqId).locked) {
        toast.warning("Terminez d'abord les prérequis de cette quête.");
        return;
      }
      was ? cur.delete(seqId) : cur.add(seqId);
      const contentSeqs = ms.sequences.filter((s) => !isInfoSequence(s));
      const allChecked = contentSeqs.length > 0 && contentSeqs.every((s) => cur.has(s.id));
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
          const done = reg.length > 0 && reg.every((s) => steps.has(s.id));
          done ? n.add(mid) : n.delete(mid);
        }
        return n;
      });
      try {
        const res = await setRushSequenceProgress(guildId, ms.id, Array.from(cur), effectiveAltPseudo);
        if (!(res as any)?.success) throw new Error("Échec mutation");
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
      } catch {
        setCompletedStepsByMs(prevMap);
        setCompletedIds((prev) => {
          const n = new Set(prev);
          prevActive ? n.add(ms.id) : n.delete(ms.id);
          return n;
        });
        toast.error("Erreur de synchronisation");
      }
    },
    [completedStepsByMs, completedIds, guildId, effectiveAltPseudo, getSeqGate]
  );

  const handleBookmark = useCallback(
    async (ms: RushMilestone, seqId: string) => {
      const isAlready = bookmarksByMs.get(ms.id) === seqId;
      if (!isAlready && getSeqGate(seqId).locked) {
        toast.warning("Terminez d'abord les prérequis de cette quête.");
        return;
      }
      const prevMap = new Map(bookmarksByMs);
      setBookmarksByMs((prev) => {
        const n = new Map<string, string>();
        if (!isAlready) n.set(ms.id, seqId);
        return n;
      });
      try {
        await setRushBookmark(guildId, ms.id, isAlready ? null : seqId, effectiveAltPseudo);
        toast.success(isAlready ? "Repère retiré" : "📍 Repère posé ici !", { duration: 1500 });
      } catch {
        setBookmarksByMs(prevMap);
        toast.error("Erreur repère");
      }
    },
    [bookmarksByMs, guildId, effectiveAltPseudo, getSeqGate]
  );

  const toggleSeqAccordion = useCallback((seqId: string) => {
    setExpandedSeqIds((prev) => {
      const n = new Set(prev);
      n.has(seqId) ? n.delete(seqId) : n.add(seqId);
      return n;
    });
  }, []);

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
    return seqs;
  }, [currentMs, search, hideCompleted, currentMsDoneSeqs]);

  const bookmarkSeqId = currentMs ? bookmarksByMs.get(currentMs.id) || null : null;
  const compactObjective = currentMs
    ? getNextObjective(currentMs.sequences, currentMsDoneSeqs, bookmarkSeqId, milestones, gateAllCompleted)
    : null;

  const msDone = currentMs ? completedIds.has(currentMs.id) : false;

  // ─── Rendu COMMUN ─────────────────────────────────────────────────────────
  // La fenêtre source et la fenêtre PiP (always-on-top) affichent le même
  // contenu. Seules les actions liées au cycle de vie de la fenêtre (fermer /
  // épingler / réduire) diffèrent selon le contexte.

  return (
    <div
      className={`relative flex flex-col h-screen overflow-hidden select-none transition-colors ${
        isLightMode ? "bg-[#f8fafc] text-[#0f172a]" : "bg-[#090b0e] text-[#f2f0e9]"
      }`}
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <style>{`@media (prefers-reduced-motion: reduce){ *{transition:none!important; animation:none!important; } }`}</style>

      {!isCompactMode ? (
        <>
          {/* ══ HEADER FIXE ══ */}
          <RushOverlayHeader
            guideName={guide.name}
            guideSlug={guide.slug}
            guildId={guildId}
            dofusImageUrl={dofusImage}
            totalSteps={totalSteps}
            completedSteps={completedSteps}
            overallPct={overallPct}
            isLightMode={isLightMode}
            onToggleTheme={toggleTheme}
            onClose={handleClose}
          />

          {/* ══ RECHERCHE ══ */}
          <RushOverlaySearch
            value={search}
            onChange={setSearch}
            onClear={() => setSearch("")}
            isLightMode={isLightMode}
            ref={searchRef}
          />

          {/* ══ NAVIGATION CHAPITRES ══ */}
          <RushOverlayChapterTree
            chapters={milestones}
            activeMsId={currentMs?.id}
            onSelectChapter={selectChapter}
            completedMsIds={completedIds}
            doneByMs={completedStepsByMs}
            isLightMode={isLightMode}
          />


          {/* ══ BARRE CHAPITRE COURANT ══ */}
          {currentMs && (
            <div
              className={`flex items-center justify-between gap-2 px-4 py-2 border-b shrink-0 ${
                isLightMode ? "border-slate-200 bg-white" : "border-[#28303a]/60 bg-[#12161b]"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => handleToggleMs(currentMs)}
                  aria-label={msDone ? "Marquer le chapitre comme non terminé" : "Marquer le chapitre comme terminé"}
                  className="shrink-0 rounded focus-visible:outline-2 focus-visible:outline-[#39bc95] focus-visible:outline-offset-1"
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-md border transition-all ${
                      msDone
                        ? "bg-[#39bc95] border-[#39bc95] text-black"
                        : isLightMode
                          ? "border-slate-300 bg-white"
                          : "border-[#3a4d60] bg-[#0f1419]"
                    }`}
                  >
                    {msDone && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                  </span>
                </button>

                <span className="font-serif font-bold text-xs text-[#39bc95] shrink-0">{currentMsIndex + 1}.</span>
                <span
                  className={`font-serif font-bold text-xs truncate flex-1 leading-tight ${
                    isLightMode ? "text-slate-900" : "text-[#f2f0e9]"
                  }`}
                  title={currentMs.title}
                >
                  {currentMs.title || "Jalon"}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 pl-1">
                <span className={`text-[11px] font-mono font-bold mr-1 ${isLightMode ? "text-slate-500" : "text-[#929aa5]"}`}>
                  {currentMsPct}%
                </span>

                <button
                  type="button"
                  onClick={toggleHideCompleted}
                  aria-label={hideCompleted ? "Afficher les quêtes terminées" : "Masquer les quêtes terminées"}
                  title={hideCompleted ? "Afficher les quêtes terminées" : "Masquer les quêtes terminées"}
                  className={`p-1.5 rounded-lg transition-colors ${
                    hideCompleted
                      ? "bg-[#39bc95]/20 text-[#2b9f7d] border border-[#39bc95]/40"
                      : isLightMode
                        ? "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                        : "text-[#929aa5] hover:text-[#f2f0e9] hover:bg-[#181e25]"
                  }`}
                >
                  {hideCompleted ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>

                <a
                  href={`/dashboard/${guildId}/quetes-dofus/guide/${guide.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Ouvrir le guide complet sur SigilOS"
                  title="Ouvrir le guide complet sur SigilOS"
                  className={`p-1.5 rounded-lg transition-colors ${
                    isLightMode
                      ? "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                      : "text-[#929aa5] hover:text-[#f2f0e9] hover:bg-[#181e25]"
                  }`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}

          {/* ══ OBJECTIF COURANT (épinglé — toujours visible) ══ */}
          {!hideCompleted && compactObjective && (
            <div className="px-3 pt-2">
              <RushCurrentObjective
                sequence={compactObjective}
                milestoneTitle={currentMs?.title}
                variant="overlay"
                onNavigate={() => handleGoToPrereq(compactObjective.id, currentMs?.id || "")}
              />
            </div>
          )}

          {/* ══ PRÉSENCE COMMUNAUTÉ ══ */}
          {chapterMembers.length > 0 && (
            <div className="px-3 pt-2 flex items-center gap-2">
              <Users className="w-3 h-3 text-[#39bc95]" />
              <span className="text-[9px] font-bold uppercase tracking-wide text-[#6e7784]">
                Sur ce chapitre
              </span>
              <div className="flex items-center -space-x-1.5">
                {chapterMembers.slice(0, 6).map((m, i) =>
                  m.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={m.avatar}
                      alt={m.name}
                      loading="lazy"
                      title={m.name}
                      className="w-5 h-5 rounded-full border border-[#39bc95]/40 object-cover"
                    />
                  ) : (
                    <span
                      key={i}
                      title={m.name}
                      className="w-5 h-5 rounded-full border border-[#39bc95]/40 bg-[#39bc95]/20 text-[#39bc95] flex items-center justify-center text-[8px] font-bold uppercase"
                    >
                      {m.name.charAt(0) || "?"}
                    </span>
                  )
                )}
              </div>
              {chapterMembers.length > 6 && (
                <span className="text-[9px] text-[#6e7784]">+{chapterMembers.length - 6}</span>
              )}
            </div>
          )}

          {/* ══ LISTE DES QUÊTES + DÉTAILS ══ */}
          <main className="flex-1 overflow-y-auto p-3 space-y-2">
            {visibleSequences.length === 0 ? (
              <div className="py-12 text-center text-[#929aa5] text-xs">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-[#39bc95] opacity-40" />
                <p className="font-bold font-serif text-sm text-[#f2f0e9]">
                  {search.trim() ? "Aucune quête ne correspond" : "Toutes les quêtes sont terminées !"}
                </p>
                <p className="text-[11px] text-[#6e7784] mt-0.5">
                  {search.trim() ? "Essayez un autre mot-clé." : "Passez au chapitre suivant avec le bouton Suivant."}
                </p>
              </div>
            ) : currentMs ? (
              visibleSequences.map((seq) => {
                // Les séquences info (conseils/bandeaux) ne sont pas des quêtes cochables.
                if (isInfoSequence(seq)) {
                  const info = seq.tips || seq.subGuideName || seq.subGuideRef || "";
                  return (
                    <div
                      key={seq.id}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-[11px] leading-relaxed",
                        isLightMode
                          ? "bg-slate-50 border-slate-200 text-slate-500"
                          : "bg-[#0f1318]/70 border-[#1e2530]/60 text-[#8b95a0]"
                      )}
                    >
                      <span className="font-semibold text-[#39bc95]">📘&nbsp;</span>
                      {info}
                    </div>
                  );
                }
                const isSeqDone = currentMsDoneSeqs.has(seq.id);
                const gate = getSeqGate(seq.id);
                const isBookmarked = bookmarkSeqId === seq.id;
                const isExpanded = expandedSeqIds.has(seq.id);
                return (
                  <React.Fragment key={seq.id}>
                    <RushOverlayQuestListItem
                      seq={seq}
                      isDone={isSeqDone}
                      isBookmarked={isBookmarked}
                      isExpanded={isExpanded}
                      isLightMode={isLightMode}
                      isLocked={gate.locked}
                      prereqs={gate.prereqs}
                      onGoToPrereq={handleGoToPrereq}
                      onToggle={() => handleToggleSeq(currentMs, seq.id)}
                      onBookmark={() => handleBookmark(currentMs, seq.id)}
                      onExpand={() => toggleSeqAccordion(seq.id)}
                      bookmarkers={bookmarkersBySeq.get(seq.id) || []}
                    />
                    {isExpanded && (
                      <RushOverlayQuestPanel
                        milestone={currentMs}
                        seq={seq}
                        isDone={isSeqDone}
                        isLightMode={isLightMode}
                      />
                    )}
                  </React.Fragment>
                );
              })
            ) : null}
          </main>

          {/* ══ FOOTER FIXE ══ */}
          <RushOverlayFooter
            onPrev={goToPrevMs}
            onNext={goToNextMs}
            canPrev={currentMsIndex > 0}
            canNext={currentMsIndex < milestones.length - 1}
            isLightMode={isLightMode}
            label={`${currentMsIndex + 1} / ${totalMs}`}
            onToggleCompact={enterGameMode}
          />
        </>
      ) : currentMs ? (
        /* ══ MODE COMPACT (JEU) ══ */
        <RushOverlayCompact
          milestone={currentMs}
          objective={compactObjective}
          isDone={!!compactObjective && currentMsDoneSeqs.has(compactObjective.id)}
          isLightMode={isLightMode}
          onToggle={() => currentMs && compactObjective && handleToggleSeq(currentMs, compactObjective.id)}
          onPrev={goToPrevMs}
          onNext={goToNextMs}
          canPrev={currentMsIndex > 0}
          canNext={currentMsIndex < milestones.length - 1}
          onExpand={() => setIsCompactMode(false)}
          onClose={handleClose}
        />
      ) : null}

    </div>
  );
}


"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  ChevronLeft, ChevronRight, CheckCircle2, Square,
  Flag, BookmarkCheck, X, Maximize2, Minimize2,
  Sparkles, AlertTriangle, Copy, Check, ChevronDown,
  Search
} from "lucide-react";
import { toast } from "sonner";
import {
  toggleMilestoneProgress,
  updateBookmarkedStep,
  updateStepProgress,
} from "@/server/actions/optimized-guide-actions";

// ─── Design tokens (maquette sigilos-overlay-concept.html) ───────────────────
const DS = {
  bg:      "#0b0d10",
  surface: "#13161b",
  surface2:"#1a1e24",
  line:    "#252c34",
  text:    "#f2f0e9",
  muted:   "#949aa4",
  gold:    "#d5a94e",
  green:   "#35ba91",
  blue:    "#82aaff",
  done:    "#54bd7d",
};

// ─── Types ────────────────────────────────────────────────────────────────────
type ActivityTag = {
  type: string; name?: string; level?: number; count?: number; imageUrl?: string; url?: string;
};
type Sequence = {
  id: string; subGuideName: string; subGuideRef: string; isOptional: boolean;
  tips?: string | null; note?: string | null;
  dofusdbUrl?: string | null; dofuspourlesnoobsUrl?: string | null;
  activityTags?: ActivityTag[];
};
type Milestone = {
  id: string; title: string; chapter: number; chapterLabel?: string;
  type?: string; isOptional?: boolean;
  sequences: Sequence[];
  playerProgress?: Array<{ isCompleted: boolean; completedStepIds?: string[]; bookmarkedSeqId?: string | null }>;
};
type Props = {
  guildId: string;
  guide: { name: string; slug: string; description?: string };
  milestones: Milestone[];
  allProgress: any[];
  altPseudo: string | null;
};

const TAG_META: Record<string, { icon: string; label: string }> = {
  donjon:              { icon: "/assets/rush-sylvestre/donjon.png",          label: "Donjon" },
  combat_solo:         { icon: "/assets/rush-sylvestre/combat-solo.png",     label: "Solo" },
  combat_tactique:     { icon: "/assets/rush-sylvestre/combat-tactique.png", label: "Tactique" },
  combat_vagues:       { icon: "/assets/rush-sylvestre/combat-vagues.png",   label: "Vagues" },
  combat_plusieurs:    { icon: "/assets/rush-sylvestre/combat-solo.png",     label: "Groupe" },
  plusieurs_personnes: { icon: "/assets/rush-sylvestre/combat-solo.png",     label: "Groupe" },
  metier:              { icon: "/assets/rush-sylvestre/metier.png",          label: "Métier" },
  solver:              { icon: "/assets/rush-sylvestre/solver.png",          label: "Solver" },
  songes:              { icon: "/assets/rush-sylvestre/songes.png",          label: "Songes" },
};

// ─── Tag Modal ────────────────────────────────────────────────────────────────
function TagModal({ tag, meta, onClose }: { tag: ActivityTag; meta: { icon: string; label: string }; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,.72)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div style={{ background: DS.surface, border: `1px solid ${DS.line}`, borderRadius: 12 }} className="p-4 shadow-2xl w-[180px]" onClick={e => e.stopPropagation()}>
        <div className="flex flex-col items-center gap-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={meta.icon} alt={meta.label} className="w-12 h-12 object-contain rounded-lg" />
          <p className="text-sm font-bold" style={{ color: DS.text, fontFamily: "Georgia, serif" }}>{meta.label}</p>
          {tag.name && <p className="text-xs" style={{ color: DS.muted }}>{tag.name}{tag.level ? ` Niv.${tag.level}` : ""}{tag.count && tag.count > 1 ? ` ×${tag.count}` : ""}</p>}
        </div>
        <button onClick={onClose} className="mt-3 w-full text-[10px] font-bold" style={{ color: DS.muted }}>Fermer</button>
      </div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function GuideOverlayClient({ guildId, guide, milestones: rawMilestones, altPseudo }: Props) {
  const effectiveAltPseudo = altPseudo ?? undefined;

  const milestones = useMemo(() =>
    rawMilestones.filter(ms => !["SEPARATEUR", "INFO", "DOFUS_OBTAINED"].includes(ms.type || "")),
    [rawMilestones]
  );

  // ─── Progression ──────────────────────────────────────────────────────────
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => {
    const s = new Set<string>();
    milestones.forEach(ms => { if (ms.playerProgress?.[0]?.isCompleted) s.add(ms.id); });
    return s;
  });
  const [completedStepsByMs, setCompletedStepsByMs] = useState<Map<string, Set<string>>>(() => {
    const m = new Map<string, Set<string>>();
    milestones.forEach(ms => {
      const ids = ms.playerProgress?.[0]?.completedStepIds;
      if (Array.isArray(ids)) m.set(ms.id, new Set(ids));
    });
    return m;
  });
  const [bookmarksByMs, setBookmarksByMs] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>();
    milestones.forEach(ms => { const bk = ms.playerProgress?.[0]?.bookmarkedSeqId; if (bk) m.set(ms.id, bk); });
    return m;
  });
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  // ─── Chapitres ────────────────────────────────────────────────────────────
  const chapters = useMemo(() => {
    const map = new Map<number, { num: number; label: string; milestones: Milestone[] }>();
    for (const ms of milestones) {
      if (!map.has(ms.chapter)) map.set(ms.chapter, { num: ms.chapter, label: ms.chapterLabel || `Chapitre ${ms.chapter}`, milestones: [] });
      map.get(ms.chapter)!.milestones.push(ms);
    }
    return Array.from(map.values()).sort((a, b) => a.num - b.num);
  }, [milestones]);

  const activeChapterNum = useMemo(() => {
    for (const ch of chapters) { if (ch.milestones.some(ms => !ms.playerProgress?.[0]?.isCompleted)) return ch.num; }
    return chapters[0]?.num || 1;
  }, [chapters]);

  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(() => new Set([activeChapterNum]));
  const toggleChapter = useCallback((num: number) => {
    setExpandedChapters(prev => { const n = new Set(prev); n.has(num) ? n.delete(num) : n.add(num); return n; });
  }, []);

  // ─── Quête sélectionnée ───────────────────────────────────────────────────
  const defaultMs = useMemo(() => {
    for (const ms of milestones) { if (!ms.playerProgress?.[0]?.isCompleted) return ms; }
    return milestones[0] || null;
  }, [milestones]);

  const [selectedMsId, setSelectedMsId] = useState<string | null>(defaultMs?.id || null);
  const selectedMs = useMemo(() => milestones.find(m => m.id === selectedMsId) || null, [milestones, selectedMsId]);

  // ─── Recherche ────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Raccourci "/" → focus recherche (comme Ganymède)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        if (search) { setSearch(""); searchRef.current?.blur(); }
        else window.close();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [search]);

  const filteredChapters = useMemo(() => {
    if (!search.trim()) return chapters;
    const q = search.toLowerCase();
    return chapters.map(ch => ({
      ...ch,
      milestones: ch.milestones.filter(ms => ms.title.toLowerCase().includes(q) || ch.label.toLowerCase().includes(q)),
    })).filter(ch => ch.milestones.length > 0);
  }, [chapters, search]);

  useEffect(() => {
    if (search.trim()) setExpandedChapters(new Set(filteredChapters.map(c => c.num)));
  }, [search, filteredChapters]);

  // ─── Stats ────────────────────────────────────────────────────────────────
  const totalMs = milestones.length;
  const completedMs = milestones.filter(ms => completedIds.has(ms.id)).length;
  const progressPct = totalMs > 0 ? Math.round((completedMs / totalMs) * 100) : 0;

  // ─── Actions ──────────────────────────────────────────────────────────────
  const handleToggleMs = useCallback(async (ms: Milestone) => {
    if (loadingIds.has(ms.id)) return;
    const was = completedIds.has(ms.id);
    setCompletedIds(prev => { const n = new Set(prev); was ? n.delete(ms.id) : n.add(ms.id); return n; });
    setLoadingIds(prev => new Set([...prev, ms.id]));
    try { await toggleMilestoneProgress(guildId, ms.id, !was, effectiveAltPseudo); }
    catch { setCompletedIds(prev => { const n = new Set(prev); was ? n.add(ms.id) : n.delete(ms.id); return n; }); toast.error("Erreur sync"); }
    finally { setLoadingIds(prev => { const n = new Set(prev); n.delete(ms.id); return n; }); }
  }, [completedIds, loadingIds, guildId, effectiveAltPseudo]);

  const handleToggleSeq = useCallback(async (ms: Milestone, seqId: string) => {
    const cur = new Set(completedStepsByMs.get(ms.id) || []);
    const was = cur.has(seqId); was ? cur.delete(seqId) : cur.add(seqId);
    setCompletedStepsByMs(prev => { const n = new Map(prev); n.set(ms.id, cur); return n; });
    try { await updateStepProgress(guildId, ms.id, Array.from(cur), effectiveAltPseudo); }
    catch { toast.error("Erreur sync"); }
  }, [completedStepsByMs, guildId, effectiveAltPseudo]);

  const handleBookmark = useCallback(async (ms: Milestone, seqId: string) => {
    const isAlready = bookmarksByMs.get(ms.id) === seqId;
    setBookmarksByMs(prev => { const n = new Map<string, string>(); if (!isAlready) n.set(ms.id, seqId); return n; });
    try { await updateBookmarkedStep(guildId, ms.id, isAlready ? null : seqId, effectiveAltPseudo); }
    catch { toast.error("Erreur bookmark"); }
  }, [bookmarksByMs, guildId, effectiveAltPseudo]);

  const msIndex = useMemo(() => milestones.findIndex(m => m.id === selectedMsId), [milestones, selectedMsId]);
  const goNext = useCallback(() => {
    const next = milestones[msIndex + 1];
    if (next) { setSelectedMsId(next.id); const ch = chapters.find(c => c.milestones.some(m => m.id === next.id)); if (ch) setExpandedChapters(prev => new Set([...prev, ch.num])); }
  }, [milestones, msIndex, chapters]);
  const goPrev = useCallback(() => {
    const prev = milestones[msIndex - 1];
    if (prev) { setSelectedMsId(prev.id); const ch = chapters.find(c => c.milestones.some(m => m.id === prev.id)); if (ch) setExpandedChapters(prev2 => new Set([...prev2, ch.num])); }
  }, [milestones, msIndex, chapters]);

  const [compact, setCompact] = useState(false);
  const [activeTagModal, setActiveTagModal] = useState<{ tag: ActivityTag; meta: { icon: string; label: string } } | null>(null);
  const [copiedPos, setCopiedPos] = useState<string | null>(null);
  const copyPos = useCallback((text: string) => {
    navigator.clipboard.writeText(`/travel ${text}`).then(() => { setCopiedPos(text); setTimeout(() => setCopiedPos(null), 1500); toast.success(`📍 ${text} copié !`, { duration: 1200 }); }).catch(() => {});
  }, []);

  // ─── Quest panel derivations ──────────────────────────────────────────────
  const msCompleted = selectedMs ? completedIds.has(selectedMs.id) : false;
  const seqsDone = selectedMs ? (completedStepsByMs.get(selectedMs.id) || new Set<string>()) : new Set<string>();
  const bookmarkSeqId = selectedMs ? (bookmarksByMs.get(selectedMs.id) || null) : null;

  // "À faire maintenant" = step bookmark ou première incomplète
  const nextSeq = selectedMs ? (
    bookmarkSeqId
      ? selectedMs.sequences.find(s => s.id === bookmarkSeqId)
      : selectedMs.sequences.find(s => !seqsDone.has(s.id) && s.activityTags?.every((t: any) => t.type !== "info_sequence"))
  ) : null;

  const nextPosTag = nextSeq?.activityTags?.find(t => t.type === "pos_tags");
  const nextPosStr = nextPosTag?.name ? String(nextPosTag.name) : null;
  const nextCoords = nextPosStr ? nextPosStr.match(/(-?\d+)\s*[,;]\s*(-?\d+)/) : null;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="relative flex flex-col h-screen overflow-hidden" style={{ background: DS.bg, color: DS.text, fontFamily: "Inter, system-ui, sans-serif", fontSize: 13 }}>

      {/* ══ HEADER ══ */}
      <header style={{ background: `linear-gradient(105deg,${DS.gold}14,transparent 55%)`, borderBottom: `1px solid ${DS.line}` }} className="flex items-center gap-2.5 px-3.5 py-3 shrink-0">
        {/* Logo */}
        <div className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0"
          style={{ border: `1px solid ${DS.gold}66`, background: "#292116", color: DS.gold, fontFamily: "Georgia,serif", fontWeight: 700 }}>
          ✦
        </div>
        <div className="flex-1 min-w-0">
          <p style={{ color: DS.text, fontFamily: "Georgia, serif", fontWeight: 700, fontSize: 14, letterSpacing: ".03em", lineHeight: 1 }} className="truncate">{guide.name}</p>
          {/* Barre de progression */}
          <div className="flex items-center gap-2 mt-2">
            <span style={{ color: DS.muted, fontSize: 10 }}>Progression <strong style={{ color: DS.text }}>{completedMs} / {totalMs}</strong></span>
            <div className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ background: "#292d34" }}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progressPct}%`, background: `linear-gradient(90deg,#b98932,${DS.gold})` }} />
            </div>
            <span style={{ color: DS.muted, fontSize: 10 }}>{progressPct}%</span>
          </div>
        </div>
        <button onClick={() => setCompact(v => !v)} style={{ color: DS.muted }} className="p-1 rounded hover:opacity-80 transition-opacity" title={compact ? "Agrandir" : "Réduire"}>
          {compact ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
        </button>
        <button onClick={() => window.close()} style={{ color: DS.muted }} className="p-1 rounded hover:text-red-400 transition-colors" title="Fermer">
          <X className="w-3.5 h-3.5" />
        </button>
      </header>

      {/* ══ MODE COMPACT ══ */}
      {compact && selectedMs && (
        <div className="flex items-center gap-2 px-3 py-2 shrink-0" style={{ borderBottom: `1px solid ${DS.line}` }}>
          <button onClick={() => handleToggleMs(selectedMs)} style={{ color: DS.muted }} className="shrink-0 hover:text-emerald-400 transition-colors">
            {msCompleted ? <CheckCircle2 className="w-4 h-4" style={{ color: DS.done }} /> : <Square className="w-3.5 h-3.5" />}
          </button>
          <p style={{ color: msCompleted ? DS.muted : DS.text, fontFamily: "Georgia,serif", fontWeight: 700, fontSize: 12, textDecoration: msCompleted ? "line-through" : undefined }} className="flex-1 truncate">
            {selectedMs.title}
          </p>
          <button onClick={goPrev} disabled={msIndex <= 0} style={{ color: DS.muted }} className="p-0.5 disabled:opacity-30"><ChevronLeft className="w-3.5 h-3.5" /></button>
          <button onClick={goNext} disabled={msIndex >= milestones.length - 1} style={{ color: DS.muted }} className="p-0.5 disabled:opacity-30"><ChevronRight className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* ══ MODE NORMAL ══ */}
      {!compact && (
        <>
          {/* Barre de recherche + hint "/" */}
          <div className="flex items-center gap-2 px-3 py-2 shrink-0" style={{ background: "#191c21", border: `1px solid ${DS.line}`, borderRadius: 9, margin: "10px 12px 8px" }}>
            <Search className="w-3.5 h-3.5 shrink-0" style={{ color: DS.muted }} />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher une quête, zone, donjon…"
              style={{ flex: 1, background: "transparent", color: DS.text, fontSize: 11, outline: "none" }}
            />
            {search ? (
              <button onClick={() => setSearch("")} style={{ color: DS.muted }} className="hover:text-zinc-300 transition-colors"><X className="w-3 h-3" /></button>
            ) : (
              <span style={{ padding: "2px 5px", border: `1px solid #343a44`, borderRadius: 4, fontSize: 10, color: DS.muted }}>/</span>
            )}
          </div>

          {/* ── Arbre chapitres ── */}
          <div className="flex-1 overflow-y-auto min-h-0 px-1.5">
            {filteredChapters.map((ch) => {
              const isExpanded = expandedChapters.has(ch.num);
              const chCompleted = ch.milestones.filter(ms => completedIds.has(ms.id)).length;
              const chTotal = ch.milestones.length;
              const chAllDone = chCompleted === chTotal;
              const isActiveChapter = ch.num === activeChapterNum;

              return (
                <div key={ch.num}
                  style={{
                    marginBottom: isExpanded ? 6 : 0,
                    border: isExpanded ? `1px solid ${DS.gold}2e` : `none`,
                    borderBottom: !isExpanded ? `1px solid ${DS.line}` : undefined,
                    borderRadius: isExpanded ? 10 : 0,
                    background: isExpanded ? `${DS.gold}08` : undefined,
                    opacity: chAllDone ? .5 : 1,
                  }}>
                  {/* Header chapitre */}
                  <button
                    onClick={() => toggleChapter(ch.num)}
                    className="w-full flex items-center gap-2 px-2.5 py-2.5 text-left transition-all"
                    style={{ color: isActiveChapter && isExpanded ? DS.gold : DS.muted }}
                  >
                    <span style={{ fontSize: 12 }}>{isExpanded ? "⌄" : "›"}</span>
                    <span style={{ flex: 1, fontSize: 11, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", truncate: true } as any} className="truncate">{ch.label}</span>
                    <span style={{ fontSize: 11, color: isExpanded ? DS.gold : DS.muted }}>
                      <strong style={{ color: isExpanded ? DS.gold : DS.text }}>{chCompleted}</strong> / {chTotal}
                    </span>
                  </button>

                  {/* Quêtes */}
                  {isExpanded && (
                    <div style={{ padding: "4px 6px 6px" }}>
                      {ch.milestones.map((ms) => {
                        const done = completedIds.has(ms.id);
                        const isSelected = ms.id === selectedMsId;
                        const hasBookmark = bookmarksByMs.has(ms.id);
                        const seqCount = ms.sequences.length;
                        const doneCount = (completedStepsByMs.get(ms.id)?.size || 0);

                        return (
                          <button key={ms.id} onClick={() => setSelectedMsId(ms.id)}
                            className="w-full flex items-center gap-2 text-left transition-all"
                            style={{
                              padding: "8px 9px",
                              marginBottom: 2,
                              borderRadius: 8,
                              background: isSelected ? "#262319" : undefined,
                              boxShadow: isSelected ? `inset 3px 0 ${DS.gold}` : undefined,
                            }}>
                            <div style={{ width: 13, height: 13, border: `1px solid ${done ? DS.done : "#6c7580"}`, borderRadius: 4, background: done ? DS.done : undefined, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#102219", fontSize: 9 }}>
                              {done ? "✓" : ""}
                            </div>
                            <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: done ? DS.muted : DS.text, textDecoration: done ? "line-through" : undefined }} className="truncate">
                              {ms.title}
                            </span>
                            {seqCount > 0 && !done && (
                              <span style={{ padding: "2px 6px", borderRadius: 99, background: "#2a2f37", color: "#abb2bc", fontSize: 10 }}>
                                {doneCount}/{seqCount}
                              </span>
                            )}
                            {hasBookmark && <Flag className="w-2.5 h-2.5 shrink-0" style={{ color: DS.gold + "b0" }} />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredChapters.length === 0 && (
              <div className="py-8 text-center" style={{ color: DS.muted, fontSize: 11 }}>
                Aucun résultat pour « {search} »
              </div>
            )}
          </div>

          {/* ── Panneau quête sélectionnée ── */}
          {selectedMs && (
            <div style={{ borderTop: `1px solid ${DS.line}`, background: "#111318" }} className="shrink-0 max-h-[58vh] flex flex-col">

              {/* "✦ À faire maintenant" */}
              {nextSeq && !msCompleted && (
                <div style={{ margin: "10px 13px 0", padding: "10px 11px", border: `1px solid ${DS.gold}52`, borderRadius: 9, background: `linear-gradient(90deg,${DS.gold}20,${DS.gold}06)` }}>
                  <small style={{ color: DS.gold, fontWeight: 800, letterSpacing: ".08em", fontSize: 10 }}>✦ À faire maintenant</small>
                  <p style={{ margin: "5px 0 0", color: "#f3e5c2", fontSize: 12, fontFamily: "Georgia,serif" }}>{nextSeq.subGuideName}</p>
                  {nextCoords && (
                    <button onClick={() => copyPos(nextPosStr!)}
                      style={{ marginTop: 6, padding: "2px 5px", borderRadius: 4, background: "#202a46", color: DS.blue, fontSize: 10, fontFamily: "monospace", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {copiedPos === nextPosStr ? <Check className="w-2.5 h-2.5" style={{ color: DS.green }} /> : <Copy className="w-2.5 h-2.5" />}
                      [{nextCoords[1]}, {nextCoords[2]}]
                    </button>
                  )}
                </div>
              )}

              {/* Titre quête + checkbox */}
              <div className="flex items-start gap-2 px-3 pt-2.5 pb-1 shrink-0">
                <button onClick={() => handleToggleMs(selectedMs)} disabled={loadingIds.has(selectedMs.id)} style={{ color: DS.muted }} className="shrink-0 mt-0.5 hover:text-emerald-400 transition-colors">
                  {msCompleted ? <CheckCircle2 className="w-4 h-4" style={{ color: DS.done }} /> : <Square className="w-3.5 h-3.5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p style={{ fontFamily: "Georgia,serif", fontWeight: 700, fontSize: 13, color: msCompleted ? DS.muted : DS.text, textDecoration: msCompleted ? "line-through" : undefined }} className="leading-snug truncate">
                    {selectedMs.title}
                  </p>
                  <p style={{ color: DS.muted, fontSize: 10, marginTop: 2 }}>{msIndex + 1} / {milestones.length}</p>
                </div>
              </div>

              {/* Séquences (scrollable) */}
              <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-1 min-h-0">
                {selectedMs.sequences?.map((seq) => {
                  const seqDone = seqsDone.has(seq.id);
                  const isBookmarked = bookmarkSeqId === seq.id;
                  const primaryUrl = seq.dofuspourlesnoobsUrl || seq.dofusdbUrl || null;
                  const noobUrl = seq.dofuspourlesnoobsUrl || null;
                  const dbUrl = seq.dofusdbUrl || null;
                  const posTag = seq.activityTags?.find(t => t.type === "pos_tags");
                  const posMatch = posTag?.name ? String(posTag.name).match(/(-?\d+)\s*[,;]\s*(-?\d+)/) : null;
                  const posStr = posTag?.name ? String(posTag.name) : null;
                  const visibleTags = (seq.activityTags || []).filter(t =>
                    !["prereq_text", "dofus_link", "ocre_dungeon", "pos_tags", "tougli_box", "quest_group", "info_sequence"].includes(t.type)
                  );

                  return (
                    <div key={seq.id}
                      style={{
                        borderRadius: 8,
                        border: isBookmarked ? `1px solid ${DS.line}` : `1px solid ${DS.line}`,
                        borderLeft: isBookmarked ? `3px solid ${DS.gold}b0` : `1px solid ${DS.line}`,
                        background: isBookmarked ? `${DS.gold}08` : seqDone ? "#0d0f12" : DS.surface,
                        opacity: seqDone ? .45 : 1,
                      }}>
                      <div className="flex items-center gap-1.5 px-2 py-1.5">
                        <button onClick={() => handleToggleSeq(selectedMs, seq.id)} style={{ color: DS.muted }} className="shrink-0 hover:text-emerald-400 transition-colors">
                          {seqDone ? <CheckCircle2 className="w-3.5 h-3.5" style={{ color: DS.done + "80" }} /> : <Square className="w-3 h-3" />}
                        </button>
                        {primaryUrl ? (
                          <a href={primaryUrl} target="_blank" rel="noopener noreferrer"
                            style={{ flex: 1, fontSize: 11, fontWeight: 700, fontFamily: "Georgia,serif", color: seqDone ? DS.muted : DS.text, textDecoration: seqDone ? "line-through" : undefined }}
                            className="truncate hover:opacity-80 transition-opacity">
                            {seq.subGuideName}
                          </a>
                        ) : (
                          <span style={{ flex: 1, fontSize: 11, fontWeight: 700, fontFamily: "Georgia,serif", color: seqDone ? DS.muted : DS.text, textDecoration: seqDone ? "line-through" : undefined }} className="truncate">
                            {seq.subGuideName}
                          </span>
                        )}
                        {visibleTags.slice(0, 3).map((tag, i) => {
                          const meta = TAG_META[tag.type];
                          if (!meta) return null;
                          if (tag.type === "solver" && tag.url) return <a key={i} href={tag.url} target="_blank" rel="noopener noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={meta.icon} alt="Solver" className="w-3 h-3 opacity-50 hover:opacity-100" />
                          </a>;
                          return <button key={i} onClick={e => { e.stopPropagation(); setActiveTagModal({ tag, meta }); }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={meta.icon} alt={meta.label} className="w-3 h-3 opacity-50 hover:opacity-100 cursor-pointer" title={meta.label} />
                          </button>;
                        })}
                        <button onClick={() => handleBookmark(selectedMs, seq.id)}
                          style={{ color: isBookmarked ? DS.gold : DS.line }} className="shrink-0 hover:opacity-100 transition-opacity">
                          {isBookmarked ? <BookmarkCheck className="w-3 h-3" /> : <Flag className="w-3 h-3" />}
                        </button>
                      </div>
                      {/* Sous-ligne coordonnées + favicons */}
                      {(posMatch || noobUrl || dbUrl) && (
                        <div className="flex items-center gap-1.5 px-2 pb-1.5">
                          {posMatch && posStr && (
                            <button onClick={() => copyPos(posStr)}
                              style={{ padding: "2px 5px", borderRadius: 4, background: "#202a46", color: DS.blue, fontSize: 9, fontFamily: "monospace", display: "inline-flex", alignItems: "center", gap: 3 }}>
                              {copiedPos === posStr ? <Check className="w-2 h-2" style={{ color: DS.green }} /> : <Copy className="w-2 h-2" />}
                              [{posMatch[1]}, {posMatch[2]}]
                            </button>
                          )}
                          <span className="flex-1" />
                          {noobUrl && <a href={noobUrl} target="_blank" rel="noopener noreferrer" title="DofusPourLesNoobs" className="opacity-40 hover:opacity-90 transition-opacity">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="https://www.google.com/s2/favicons?domain=dofuspourlesnoobs.com&sz=32" alt="" className="w-3 h-3 rounded-sm" />
                          </a>}
                          {dbUrl && <a href={dbUrl} target="_blank" rel="noopener noreferrer" title="DofusDB" className="opacity-40 hover:opacity-90 transition-opacity">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="https://www.google.com/s2/favicons?domain=dofusdb.fr&sz=32" alt="" className="w-3 h-3 rounded-sm" />
                          </a>}
                        </div>
                      )}
                    </div>
                  );
                })}

                {selectedMs.sequences?.some(s => s.tips) && (
                  <div style={{ padding: "8px 10px", borderRadius: 8, background: `${DS.gold}10`, border: `1px solid ${DS.gold}25`, display: "flex", alignItems: "flex-start", gap: 6 }}>
                    <Sparkles className="w-3 h-3 shrink-0 mt-0.5" style={{ color: DS.gold + "90" }} />
                    <p style={{ fontSize: 10, color: "#f3e5c2b0", lineHeight: 1.5 }}>{selectedMs.sequences.find(s => s.tips)?.tips}</p>
                  </div>
                )}
              </div>

              {/* Footer nav */}
              <div className="flex items-center gap-2 px-3 py-2 shrink-0" style={{ borderTop: `1px solid ${DS.line}` }}>
                <button onClick={goPrev} disabled={msIndex <= 0}
                  style={{ padding: "7px 10px", border: `1px solid #343943`, borderRadius: 7, background: "#1b1e24", color: "#c7ccd4", fontSize: 12, opacity: msIndex <= 0 ? .3 : 1 }}>
                  ← Précédent
                </button>
                <span style={{ flex: 1, textAlign: "center", color: DS.muted, fontSize: 11 }}>Étape {msIndex + 1} / {milestones.length}</span>
                <button onClick={goNext} disabled={msIndex >= milestones.length - 1}
                  style={{ padding: "7px 10px", border: `1px solid ${DS.gold}66`, borderRadius: 7, background: "#392d19", color: "#f4e5bd", fontSize: 12, opacity: msIndex >= milestones.length - 1 ? .3 : 1 }}>
                  Suivant →
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {activeTagModal && <TagModal tag={activeTagModal.tag} meta={activeTagModal.meta} onClose={() => setActiveTagModal(null)} />}
    </div>
  );
}

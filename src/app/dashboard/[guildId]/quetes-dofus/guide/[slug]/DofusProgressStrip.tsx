"use client";
import { useMemo, memo } from "react";
import { Gem, CheckCircle2, Circle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Milestone = {
  id: string;
  title: string;
  type?: string | null;
  dofusId?: string | null;
  chapter: number;
  chapterLabel: string;
  accentColor?: string | null;
  sequences: { id: string }[];
};

type DofusDef = { id: string; label: string; color: string; imageUrl: string };

// ─── Dofus list (shared) ──────────────────────────────────────────────────────

const DOFUS_DEFS: DofusDef[] = [
  { id: "ocre",               label: "Ocre",               color: "#f59e0b", imageUrl: "/assets/icons/ocre.png" },
  { id: "turquoise",          label: "Turquoise",          color: "#06b6d4", imageUrl: "/module-dofus/Dofus_Turquoise.png" },
  { id: "argente",            label: "Argenté",            color: "#a1a1aa", imageUrl: "/module-dofus/Dofus_Argente.png" },
  { id: "argente_scintillant",label: "Arg.Scin.",          color: "#c0c0c0", imageUrl: "/module-dofus/Dofus_Argente_Scintillant.png" },
  { id: "ebene",              label: "Ébène",              color: "#52525b", imageUrl: "/module-dofus/Dofus_Ebene.png" },
  { id: "pourpre",            label: "Pourpre",            color: "#a855f7", imageUrl: "/module-dofus/Dofus_Pourpre.png" },
  { id: "ivoire",             label: "Ivoire",             color: "#e2e8f0", imageUrl: "/module-dofus/Dofus_Ivoire.png" },
  { id: "emeraude",           label: "Émeraude",           color: "#10b981", imageUrl: "/module-dofus/Dofus_Emeraude.png" },
  { id: "dolmanax",           label: "Dolmanax",           color: "#ef4444", imageUrl: "/module-dofus/Dofus_Dolmanax.png" },
  { id: "des_glaces",         label: "Des Glaces",         color: "#93c5fd", imageUrl: "/module-dofus/Dofus_Des_Glaces.png" },
  { id: "du_cauchemar",       label: "Cauchemar",          color: "#7c3aed", imageUrl: "/module-dofus/Dofus_Du_Cauchemar.png" },
  { id: "des_veilleurs",      label: "Veilleurs",          color: "#38bdf8", imageUrl: "/module-dofus/Dofus_Veilleur.png" },
  { id: "domakuro",           label: "Domakuro",           color: "#84cc16", imageUrl: "/module-dofus/Dofus_Domakuro.png" },
  { id: "dorigami",           label: "Dorigami",           color: "#f472b6", imageUrl: "/module-dofus/Dofus_Dorigami.png" },
  { id: "tachete",            label: "Tacheté",            color: "#c084fc", imageUrl: "/module-dofus/Dofus_Tacheté.png" },
  { id: "dom_de_pin",         label: "Dom de Pin",         color: "#a3e635", imageUrl: "/module-dofus/Dom_De_Pin.png" },
  { id: "sylvestre",          label: "Sylvestre",          color: "#d4a017", imageUrl: "/module-dofus/Dofus_Sylvestre.png" },
];

// ─── Dofus progress per chapter ───────────────────────────────────────────────
type DofusChapterProgress = {
  chapter: number;
  chapterLabel: string;
  totalMs: number;
  doneMs: number;
  milestoneCount: number;
  pct: number;
};

// ─── DofusProgressStrip ───────────────────────────────────────────────────────
export const DofusProgressStrip = memo(function DofusProgressStrip({
  milestones,
  completedIds,
  activeFilter,
  onFilterChange,
}: {
  milestones: Milestone[];
  completedIds: Set<string>;
  activeFilter: string | null;
  onFilterChange: (id: string | null) => void;
}) {
  // Statistiques par Dofus
  const dofusStats = useMemo(() => {
    return DOFUS_DEFS.map((d) => {
      const linked = milestones.filter((m) => m.dofusId === d.id);
      if (linked.length === 0) return null;
      const done = linked.filter((m) => completedIds.has(m.id)).length;
      const pct = Math.round((done / linked.length) * 100);
      return { ...d, total: linked.length, done, pct };
    }).filter(Boolean) as (DofusDef & { total: number; done: number; pct: number })[];
  }, [milestones, completedIds]);

  // Statistiques par chapitre
  const chapterStats = useMemo(() => {
    const map = new Map<number, DofusChapterProgress>();
    milestones.forEach((m) => {
      if (!m.dofusId) return; // seulement les Dofus-linked milestones
      if (!map.has(m.chapter)) {
        map.set(m.chapter, {
          chapter: m.chapter,
          chapterLabel: m.chapterLabel,
          totalMs: 0,
          doneMs: 0,
          milestoneCount: 0,
          pct: 0,
        });
      }
      const entry = map.get(m.chapter)!;
      entry.totalMs++;
      entry.milestoneCount++;
      if (completedIds.has(m.id)) entry.doneMs++;
      entry.pct = Math.round((entry.doneMs / entry.totalMs) * 100);
    });
    return Array.from(map.values()).sort((a, b) => a.chapter - b.chapter);
  }, [milestones, completedIds]);

  if (dofusStats.length === 0) return null;

  const allTotal = dofusStats.reduce((s, d) => s + d.total, 0);
  const allDone = dofusStats.reduce((s, d) => s + d.done, 0);
  const allPct = allTotal > 0 ? Math.round((allDone / allTotal) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Global Dofus progression bar */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-zinc-900/70 to-zinc-950/70 border border-zinc-800/60">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Gem className="w-4 h-4 text-emerald-400" />
            <span className="text-caption font-black uppercase tracking-widest text-zinc-400">
              Progression Globale des Dofus
            </span>
          </div>
          <span className="text-xs font-black text-white font-mono">{allPct}%</span>
        </div>
        {/* Grosse barre globale */}
        <div className="h-2 bg-zinc-800/80 rounded-full overflow-hidden mb-3">
          <div
            className="h-full rounded-full border border-white/5 transition-all duration-300"
            style={{
              width: `${allPct}%`,
              background: `linear-gradient(90deg, #f59e0b, #a855f7, #06b6d4, #10b981)`,
            }}
          />
        </div>
        {/* Badge du total */}
        <p className="text-caption text-zinc-600 font-medium">
          {allDone}/{allTotal} blocs complétés
        </p>
      </div>

      {/* Grille des Dofus avec leurs progressions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {dofusStats.map((d) => {
          const isActive = activeFilter === d.id;
          const isComplete = d.done === d.total && d.total > 0;
          const isSylvestre = d.id === "sylvestre";
          return (
            <button
              key={d.id}
              onClick={() => onFilterChange(isActive ? null : d.id)}
              className={`relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all ${
                isActive
                  ? "border-emerald-500/40 bg-zinc-900/60 scale-[1.02]"
                  : isComplete
                  ? "border-emerald-500/30 bg-zinc-900/40 opacity-90"
                  : "border-zinc-800/60 bg-zinc-900/40 hover:border-zinc-600/60 hover:bg-zinc-900/60"
              } ${isSylvestre && isActive ? "border-amber-400/60" : ""}`}
              title={`${d.label} — ${d.done}/${d.total} (${d.pct}%)`}
            >
              {/* Status indicator */}
              <div className="absolute top-1.5 right-1.5">
                {isComplete ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                ) : d.done > 0 ? (
                  <Circle className="w-3 h-3 text-amber-400/60" />
                ) : null}
              </div>

              {/* Dofus icon */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={d.imageUrl}
                alt={d.label}
                className={`w-7 h-7 object-contain drop-shadow-lg transition-all ${
                  isComplete ? "opacity-100 brightness-110" : d.done > 0 ? "opacity-90" : "opacity-60 grayscale-[30%]"
                } ${isSylvestre ? "ring-1 ring-amber-400/60 rounded-full" : ""}`}
              />

              {/* Label */}
              <span className={`text-caption font-black uppercase tracking-wider text-center leading-tight ${
                isComplete || isActive ? "text-emerald-400" : "text-zinc-400"
              } ${isSylvestre && isActive ? "text-amber-300" : ""}`}>
                {d.label}
              </span>

              {/* Mini barre de progression */}
              <div className="w-full h-1 bg-zinc-800/60 rounded-full overflow-hidden mt-0.5">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${d.pct}%`, background: d.color }}
                />
              </div>

              {/* Percentage */}
              <span className="text-caption font-mono font-bold text-zinc-500">{d.pct}%</span>
            </button>
          );
        })}
      </div>

      {/* Stats par chapitre (pips) */}
      {chapterStats.length > 1 && (
        <details className="group">
          <summary className="flex items-center gap-2 text-caption font-black uppercase tracking-widest text-zinc-600 hover:text-zinc-400 cursor-pointer py-2 transition-colors list-none">
            <span className="w-4 h-4 rounded bg-zinc-800 flex items-center justify-center">
              <span className="text-caption font-black text-zinc-500 group-open:rotate-90 transition-transform">▶</span>
            </span>
            Répartition par chapitre
          </summary>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {chapterStats.map((ch) => (
              <div
                key={ch.chapter}
                className="flex items-center gap-2 p-2 rounded-xl bg-zinc-900/40 border border-zinc-800/50"
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-caption font-black border ${
                    ch.pct === 100
                      ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                      : ch.pct > 0
                      ? "bg-amber-500/15 border-amber-500/25 text-amber-400"
                      : "bg-zinc-800 border-zinc-700 text-zinc-500"
                  }`}
                >
                  {ch.chapter}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-caption font-bold text-zinc-300 truncate">
                    {ch.chapterLabel.length > 18 ? ch.chapterLabel.slice(0, 16) + "…" : ch.chapterLabel}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${ch.pct}%`,
                          background: ch.pct === 100 ? "#10b981" : ch.pct > 0 ? "#f59e0b" : "#3f3f46",
                        }}
                      />
                    </div>
                    <span className="text-caption font-mono text-zinc-500">{ch.pct}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
});
"use client";
import { useMemo, memo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, X, ExternalLink, ChevronRight } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Milestone = {
  id: string;
  title: string;
  chapter: number;
  chapterLabel: string;
  accentColor?: string | null;
  dofusId?: string | null;
};

type GuildMemberProgress = {
  profileId: string;
  milestoneId: string;
  isCompleted: boolean;
  userName: string;
  userAvatar?: string;
};

// Dofus definitions
const DOFUS_DEFS: Record<string, { label: string; color: string; imageUrl: string }> = {
  ocre:               { label: "Ocre",               color: "#f59e0b", imageUrl: "/assets/icons/ocre.png" },
  turquoise:          { label: "Turquoise",          color: "#06b6d4", imageUrl: "/module-dofus/Dofus_Turquoise.png" },
  argente:            { label: "Argenté",            color: "#a1a1aa", imageUrl: "/module-dofus/Dofus_Argente.png" },
  argente_scintillant:{ label: "Arg. Scintillant",   color: "#c0c0c0", imageUrl: "/module-dofus/Dofus_Argente_Scintillant.png" },
  ebene:              { label: "Ébène",              color: "#52525b", imageUrl: "/module-dofus/Dofus_Ebene.png" },
  pourpre:            { label: "Pourpre",            color: "#a855f7", imageUrl: "/module-dofus/Dofus_Pourpre.png" },
  ivoire:             { label: "Ivoire",             color: "#e2e8f0", imageUrl: "/module-dofus/Dofus_Ivoire.png" },
  emeraude:           { label: "Émeraude",           color: "#10b981", imageUrl: "/module-dofus/Dofus_Emeraude.png" },
  dolmanax:           { label: "Dolmanax",           color: "#ef4444", imageUrl: "/module-dofus/Dofus_Dolmanax.png" },
  des_glaces:         { label: "Des Glaces",         color: "#93c5fd", imageUrl: "/module-dofus/Dofus_Des_Glaces.png" },
  du_cauchemar:       { label: "Du Cauchemar",       color: "#7c3aed", imageUrl: "/module-dofus/Dofus_Du_Cauchemar.png" },
  des_veilleurs:      { label: "Des Veilleurs",      color: "#38bdf8", imageUrl: "/module-dofus/Dofus_Veilleur.png" },
  domakuro:           { label: "Domakuro",           color: "#84cc16", imageUrl: "/module-dofus/Dofus_Domakuro.png" },
  dorigami:           { label: "Dorigami",           color: "#f472b6", imageUrl: "/module-dofus/Dofus_Dorigami.png" },
  tachete:            { label: "Tacheté",            color: "#c084fc", imageUrl: "/module-dofus/Dofus_Tacheté.png" },
  dom_de_pin:         { label: "Dom de Pin",         color: "#a3e635", imageUrl: "/module-dofus/Dom_De_Pin.png" },
};

type DofusStat = {
  id: string;
  label: string;
  color: string;
  imageUrl: string;
  totalMilestones: number;
  completedMilestones: number;
  pct: number;
  membersInProgress: { profileId: string; userName: string; userAvatar?: string; completed: number; total: number; pct: number; alignment?: string | null; alignmentOrder?: string | null; alignmentLevel?: number | null }[];
};

// ─── GuildStatusPanel ─────────────────────────────────────────────────────────

export const GuildStatusPanel = memo(function GuildStatusPanel({
  milestones,
  guildProgress,
}: {
  milestones: Milestone[];
  guildProgress: GuildMemberProgress[];
}) {
  const [modalDofus, setModalDofus] = useState<string | null>(null);

  const dofusStats = useMemo(() => {
    const map = new Map<string, DofusStat>();

    milestones.forEach((ms) => {
      const dofusId = ms.dofusId;
      if (!dofusId) return;
      const def = DOFUS_DEFS[dofusId];
      if (!def) return;

      if (!map.has(dofusId)) {
        map.set(dofusId, {
          id: dofusId,
          label: def.label,
          color: def.color,
          imageUrl: def.imageUrl,
          totalMilestones: 0,
          completedMilestones: 0,
          pct: 0,
          membersInProgress: [],
        });
      }

      const stat = map.get(dofusId)!;
      stat.totalMilestones++;

      // Check if this milestone is completed by at least one member
      const completedBySome = guildProgress.some(
        (p) => p.milestoneId === ms.id && p.isCompleted
      );
      if (completedBySome) stat.completedMilestones++;
    });

    // Calculate per-member progress per Dofus
    const profileIds = [...new Set(guildProgress.map((p) => p.profileId))];

    map.forEach((stat, dofusId) => {
      const dofusMilestoneIds = new Set(
        milestones.filter((m) => m.dofusId === dofusId).map((m) => m.id)
      );

      stat.membersInProgress = profileIds
        .map((profileId) => {
          const memberProgress = guildProgress.filter(
            (p) => p.profileId === profileId && dofusMilestoneIds.has(p.milestoneId)
          );
          const userName = memberProgress[0]?.userName || "Inconnu";
          const userAvatar = memberProgress[0]?.userAvatar;
          const completed = memberProgress.filter((p) => p.isCompleted).length;
          const total = dofusMilestoneIds.size;
          const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
          // Alignement du personnage actif (repère > étapes cochées > premier).
          const activeRow = (memberProgress as any[]).reduce((best, p: any) => {
            const score = (p.currentStep ? 2 : 0) + Math.min((p.completedSteps || []).length, 5);
            return !best || score > best._score ? { ...p, _score: score } : best;
          }, null as any);
          return {
            profileId, userName, userAvatar, completed, total, pct,
            alignment: activeRow?.alignment ?? null,
            alignmentOrder: activeRow?.alignmentOrder ?? null,
            alignmentLevel: activeRow?.alignmentLevel ?? null,
          };
        })
        .filter((m) => m.total > 0)
        .sort((a, b) => b.pct - a.pct);
    });

    return Array.from(map.values()).sort((a, b) => b.totalMilestones - a.totalMilestones);
  }, [milestones, guildProgress]);

  const totalMembers = useMemo(
    () => new Set(guildProgress.map((p) => p.profileId)).size,
    [guildProgress]
  );

  if (dofusStats.length === 0) return null;

  const selectedDofus = modalDofus ? dofusStats.find((d) => d.id === modalDofus) : null;

  return (
    <>
      <div className="p-4 rounded-2xl bg-[#12161b] border border-[#28303a] shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#39bc95]" />
            <span className="text-xs font-bold font-serif uppercase tracking-widest text-[#f2f0e9]">
              Progression Guilde par Dofus
            </span>
          </div>
          <span className="text-xs font-mono font-bold text-[#39bc95]">
            {totalMembers} membre{totalMembers > 1 ? "s" : ""}
          </span>
        </div>

        {/* Dofus cards — horizontal scroll, compact */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent -mx-1 px-1">
          {dofusStats.map((d) => {
            const isAllDone = d.completedMilestones === d.totalMilestones && d.totalMilestones > 0;

            return (
              <button
                key={d.id}
                onClick={() => setModalDofus(d.id)}
                className="relative flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all text-center group cursor-pointer hover:scale-[1.02] active:scale-[0.98] shrink-0 w-[78px] bg-[#181e25] border-[#28303a] hover:border-[#384352]"
                style={{
                  borderColor: isAllDone ? `${d.color}60` : undefined,
                  background: isAllDone ? `${d.color}10` : undefined,
                }}
                title={`${d.label} — ${d.pct}% (${d.completedMilestones}/${d.totalMilestones})`}
              >
                {/* Dofus icon */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={d.imageUrl}
                  alt={d.label}
                  className="w-7 h-7 object-contain drop-shadow-md group-hover:scale-105 transition-transform"
                />

                {/* Label — truncated */}
                <span className="text-[10px] font-black uppercase tracking-wider truncate max-w-full leading-tight font-serif" style={{ color: d.color }}>
                  {d.label}
                </span>

                {/* Mini progress bar */}
                <div className="w-full h-1 bg-[#242b35] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${d.pct}%`,
                      background: `linear-gradient(90deg, ${d.color}, ${d.color}99)`,
                    }}
                  />
                </div>

                {/* Percentage compact */}
                <span className="text-[10px] font-mono font-bold text-[#929aa5]">
                  {d.pct}%
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Detail Modal ── */}
      <AnimatePresence>
        {modalDofus && selectedDofus && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/70 p-4"
            onClick={() => setModalDofus(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedDofus.imageUrl}
                    alt={selectedDofus.label}
                    className="w-12 h-12 object-contain"
                  />
                  <div>
                    <h3 className="text-base font-black text-white">{selectedDofus.label}</h3>
                    <p className="text-caption text-zinc-500 font-mono">
                      {selectedDofus.completedMilestones}/{selectedDofus.totalMilestones} blocs — {selectedDofus.pct}%
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setModalDofus(null)}
                  className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors"
                >
                  <X className="w-4 h-4 text-zinc-400" />
                </button>
              </div>

              {/* Progress bar large */}
              <div className="h-2 bg-zinc-800/60 rounded-full overflow-hidden mb-5">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${selectedDofus.pct}%`,
                    background: `linear-gradient(90deg, ${selectedDofus.color}, ${selectedDofus.color}99)`,
                    boxShadow: `0 0 12px ${selectedDofus.color}50`,
                  }}
                />
              </div>

              {/* Members list */}
              {selectedDofus.membersInProgress.length === 0 ? (
                <p className="text-xs text-zinc-600 italic text-center py-8">
                  Aucun membre n'a encore commencé ce Dofus.
                </p>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-caption font-black uppercase tracking-widest text-zinc-500 mb-2">
                    Membres ({selectedDofus.membersInProgress.length})
                  </p>
                  {selectedDofus.membersInProgress.map((m) => (
                    <div
                      key={m.profileId}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-800/40 border border-zinc-800/50 hover:border-zinc-700/50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-caption font-black text-zinc-300 overflow-hidden shrink-0">
                        {m.userAvatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.userAvatar} alt={m.userName} className="w-full h-full object-cover" />
                        ) : (
                          m.userName[0]?.toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-white truncate">{m.userName}</p>
                          <span className="text-caption font-mono font-black" style={{ color: selectedDofus.color }}>
                            {m.pct}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-zinc-800/60 rounded-full overflow-hidden mt-1.5">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${m.pct}%`,
                              background: selectedDofus.color,
                            }}
                          />
                        </div>
                        <p className="text-caption text-zinc-500 mt-0.5 font-mono">
                          {m.completed}/{m.total} blocs
                        </p>
                        {(() => {
                          const lvl = Number(m.alignmentLevel ?? 0);
                          if (!m.alignment || m.alignment === "neutre" || lvl <= 0) return null;
                          const label = m.alignment === "brakmarien" ? "Brakmarien" : m.alignment === "bontarien" ? "Bontarien" : m.alignment;
                          return (
                            <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#2a2160]/80 border border-indigo-500/40 text-[#a5b4fc]" title={`Alignement : ${label} ${lvl}`}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={m.alignment === "brakmarien" ? "/ordres/brakmar.png" : "/ordres/bonta.png"} alt="" className="w-3 h-3 object-contain" />
                              {label} {lvl}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer close */}
              <button
                onClick={() => setModalDofus(null)}
                className="w-full mt-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-caption font-black uppercase tracking-widest transition-colors"
              >
                Fermer
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});
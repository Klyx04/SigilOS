"use client";
import { useMemo, memo, useState, useEffect } from "react";
import { Users } from "lucide-react";

const MEMBERS_CUTOFF = 8;

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
  tachete:            { label: "Tacheté",            color: "#c084fc", imageUrl: "/module-dofus/Dofus_Tachete.png" },
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
  activeFilter,
  onFilterChange,
}: {
  milestones: Milestone[];
  guildProgress: GuildMemberProgress[];
  activeFilter: string | null;
  onFilterChange: (id: string | null) => void;
}) {
  const [showAllMembers, setShowAllMembers] = useState(false);
  // Replier la liste à chaque changement de Dofus sélectionné
  useEffect(() => { setShowAllMembers(false); }, [activeFilter]);

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

    // % par Dofus (jalons complétés par au moins un membre / jalons liés)
    map.forEach((stat) => {
      stat.pct = stat.totalMilestones > 0
        ? Math.round((stat.completedMilestones / stat.totalMilestones) * 100)
        : 0;
    });

    // Avancement par membre et par Dofus (détail en ligne sous les cartes)
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
          return { profileId, userName, userAvatar, completed, total, pct };
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

  return (
    <div className="p-4 rounded-[6px] bg-surface border border-border">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">
              Progression Guilde par Dofus
            </span>
          </div>
          <span className="text-xs font-mono tabular-nums text-muted-foreground">
            {totalMembers} membre{totalMembers > 1 ? "s" : ""}
          </span>
        </div>

        {/* Dofus — un asset du jeu se pose NU : pas de tuile teintée, pas de bordure,
            pas d'échelle au survol. La couleur ne sert qu'à l'état (filtre actif / terminé). */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent -mx-1 px-1">
          {dofusStats.map((d) => {
            const isAllDone = d.completedMilestones === d.totalMilestones && d.totalMilestones > 0;
            const isActive = activeFilter === d.id;

            return (
              <button
                key={d.id}
                onClick={() => onFilterChange(isActive ? null : d.id)}
                className={`relative flex flex-col items-center gap-1 p-1.5 text-center cursor-pointer shrink-0 w-[78px] rounded-[4px] border transition-colors ${
                  isActive ? "border-success" : "border-transparent hover:border-border"
                }`}
                title={isActive ? `${d.label} — filtre actif, cliquer pour annuler` : `${d.label} — ${d.pct}% — cliquer pour filtrer`}
              >
                {/* Dofus icon */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={d.imageUrl}
                  alt={d.label}
                  className="w-7 h-7 object-contain"
                />

                {/* Label — casse normale, la couleur dit « terminé » */}
                <span className={`text-[11px] truncate max-w-full leading-tight ${isAllDone ? "text-success" : "text-muted-foreground"}`}>
                  {d.label}
                </span>

                {/* Barre de progression — donnée, donc filet + aplat plat */}
                <div className="w-full h-1 bg-elevated rounded-[2px] overflow-hidden">
                  <div
                    className="h-full rounded-[2px] transition-all duration-300"
                    style={{
                      width: `${d.pct}%`,
                      background: isAllDone ? "var(--success)" : d.color,
                    }}
                  />
                </div>

                {/* Percentage compact */}
                <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
                  {d.pct}%
                </span>
              </button>
            );
          })}
        </div>

        {/* Détail en ligne du Dofus filtré : avancement des membres */}
        {(() => {
          const sel = activeFilter ? dofusStats.find((d) => d.id === activeFilter) : null;
          if (!sel) return null;
          if (sel.membersInProgress.length === 0) {
            return (
              <p className="text-xs text-zinc-600 italic text-center pt-3">
                Aucun membre n'a encore commencé ce Dofus.
              </p>
            );
          }
          const visibleMembers = showAllMembers
            ? sel.membersInProgress
            : sel.membersInProgress.slice(0, MEMBERS_CUTOFF);
          const hiddenCount = sel.membersInProgress.length - visibleMembers.length;
          return (
            <div className="space-y-1.5 pt-3 mt-1 border-t border-border">
              <p className="text-caption font-medium text-zinc-500">
                Membres — {sel.label} ({sel.membersInProgress.length})
              </p>
              <div className="max-h-[220px] overflow-y-auto custom-scrollbar space-y-1.5 pr-0.5">
                {visibleMembers.map((m) => (
                  <div
                    key={m.profileId}
                    className="flex items-center gap-3 p-2 rounded-[4px] bg-[#181e25] border border-border"
                  >
                    <div className="w-7 h-7 rounded-full bg-elevated border border-[#384352] flex items-center justify-center text-caption font-semibold text-zinc-300 overflow-hidden shrink-0">
                      {m.userAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.userAvatar} alt={m.userName} className="w-full h-full object-cover" />
                      ) : (
                        m.userName[0]?.toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-white truncate">{m.userName}</p>
                        <span className="text-caption font-mono font-semibold shrink-0" style={{ color: sel.color }}>
                          {m.pct}%
                        </span>
                      </div>
                      <div className="h-1 bg-elevated rounded-full overflow-hidden mt-1">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${m.pct}%`, background: sel.color }}
                        />
                      </div>
                      <p className="text-caption text-zinc-500 mt-0.5 font-mono">
                        {m.completed}/{m.total} blocs
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {(hiddenCount > 0 || showAllMembers) && sel.membersInProgress.length > MEMBERS_CUTOFF && (
                <button
                  type="button"
                  onClick={() => setShowAllMembers((v) => !v)}
                  className="w-full py-1.5 rounded-lg text-caption font-bold text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
                >
                  {showAllMembers ? "Réduire la liste" : `Afficher les ${hiddenCount} autres membres`}
                </button>
              )}
            </div>
          );
        })()}
      </div>
  );
});
"use client";
import { useMemo, memo, useState } from "react";
import { Users, ChevronRight } from "lucide-react";
import { dofusMetaIndex } from "@/lib/rush-dofus-meta";
import { memberDofusProgress, questStatusForMembers, type DofusQuestRef, type MemberDofusProgress } from "@/lib/rush-dofus-progress";
import { RushDofusDetailModal } from "@/components/dofus-quests/rush/RushDofusDetailModal";

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
  /** Clés d'étapes cochées (`<subGuideRef>-<n>` / `-all`) — fournies par `GuideProgressRow`. */
  completedSteps?: string[];
  /** Étape en cours du joueur (même format), s'il en a une. */
  currentStep?: string | null;
};

// Dofus definitions — SOURCE UNIQUE (`src/lib/rush-dofus-meta.ts`), partagée avec
// le studio God, le guide interne/public et l'overlay. (Cinq copies divergentes
// avant le 08/10/2026 : `ebene` y valait #27272a, #52525b ou #6366f1.)
const DOFUS_DEFS: Record<string, { label: string; color: string; imageUrl: string }> = dofusMetaIndex();

type DofusMemberStat = MemberDofusProgress & {
  profileId: string;
  userName: string;
  userAvatar?: string;
};

type DofusStat = {
  id: string;
  label: string;
  color: string;
  imageUrl: string;
  totalMilestones: number;
  completedMilestones: number;
  pct: number;
  membersInProgress: DofusMemberStat[];
};

// ─── GuildStatusPanel ─────────────────────────────────────────────────────────

export const GuildStatusPanel = memo(function GuildStatusPanel({
  milestones,
  questsByDofus,
  guildProgress,
  activeFilter,
  onFilterChange,
}: {
  milestones: Milestone[];
  /** Quêtes ordonnées de chaque Dofus (`subGuideRef`, libellé, catégorie, nb d'étapes). */
  questsByDofus: Record<string, DofusQuestRef[]>;
  guildProgress: GuildMemberProgress[];
  activeFilter: string | null;
  onFilterChange: (id: string | null) => void;
}) {
  /** Dofus dont la modale de détail est ouverte (un clic sur un Dofus). */
  const [openDofusId, setOpenDofusId] = useState<string | null>(null);

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

    // Avancement par membre et par Dofus — au niveau **quête** (et non plus seulement
    // « bloc validé ») : on réutilise les clés d'étapes déjà fournies par le serveur.
    const profileIds = [...new Set(guildProgress.map((p) => p.profileId))];

    map.forEach((stat, dofusId) => {
      const dofusMilestoneIds = new Set(
        milestones.filter((m) => m.dofusId === dofusId).map((m) => m.id)
      );
      const quests = questsByDofus[dofusId] ?? [];

      stat.membersInProgress = profileIds
        .map((profileId) => {
          const rows = guildProgress.filter(
            (p) => p.profileId === profileId && dofusMilestoneIds.has(p.milestoneId)
          );
          if (!rows.length) return null;

          const completedSteps = new Set<string>();
          for (const row of rows) for (const step of row.completedSteps ?? []) completedSteps.add(step);
          const currentStep = rows.find((row) => row.currentStep)?.currentStep ?? null;

          return {
            profileId,
            userName: rows[0]?.userName || "Inconnu",
            userAvatar: rows[0]?.userAvatar,
            ...memberDofusProgress(quests, completedSteps, currentStep),
          } as DofusMemberStat;
        })
        .filter((member): member is DofusMemberStat => member !== null)
        .sort((a, b) => b.pct - a.pct);
    });

    return Array.from(map.values()).sort((a, b) => b.totalMilestones - a.totalMilestones);
  }, [milestones, questsByDofus, guildProgress]);

  const totalMembers = useMemo(
    () => new Set(guildProgress.map((p) => p.profileId)).size,
    [guildProgress]
  );

  /** Dofus dont la modale est ouverte (un seul à la fois). */
  const selected = openDofusId ? dofusStats.find((d) => d.id === openDofusId) ?? null : null;

  /**
   * Quêtes du Dofus ouvert, avec leur statut : **Validée** (toutes les étapes chez au moins
   * un membre), **En cours** (l'étape courante d'un membre), **À faire**. Les étapes sont
   * agrégées par membre depuis les lignes déjà reçues — aucune requête neuve.
   */
  const selectedQuestRows = useMemo(() => {
    if (!selected) return [];
    const quests = questsByDofus[selected.id] ?? [];
    const dofusMilestoneIds = new Set(
      milestones.filter((milestone) => milestone.dofusId === selected.id).map((milestone) => milestone.id)
    );
    const byMember = new Map<string, { completedSteps: Set<string>; currentStep: string | null }>();
    for (const row of guildProgress) {
      if (!dofusMilestoneIds.has(row.milestoneId)) continue;
      const entry = byMember.get(row.profileId) ?? { completedSteps: new Set<string>(), currentStep: null };
      for (const step of row.completedSteps ?? []) entry.completedSteps.add(step);
      if (row.currentStep) entry.currentStep = row.currentStep;
      byMember.set(row.profileId, entry);
    }
    return questStatusForMembers(quests, [...byMember.values()]);
  }, [selected, questsByDofus, milestones, guildProgress]);

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
                type="button"
                onClick={() => setOpenDofusId(d.id)}
                aria-label={`Voir où en sont les membres sur le Dofus ${d.label} — ${d.pct} %, ${d.membersInProgress.length} membre(s) engagé(s)`}
                className={`relative flex flex-col items-center gap-1 p-1.5 text-center cursor-pointer shrink-0 w-[78px] rounded-[4px] border transition-colors ${
                  isActive ? "border-success" : "border-transparent hover:border-border"
                }`}
                title={`${d.label} — ${d.pct} % — cliquer pour le détail par membre`}
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

      {/* ── Modale par Dofus : où en est chaque membre, **quête par quête** ──
          Un clic sur un Dofus ouvre ce détail (avant : un panneau en ligne qui
          poussait la timeline). Le filtre de timeline reste accessible d'ici. */}
      {/* Fiche partagée avec le public : quêtes (asset + statut), membres compactes,
          Ocre avec son icône. Le filtre de timeline reste accessible d'ici. */}
      <RushDofusDetailModal
        open={!!selected}
        onClose={() => setOpenDofusId(null)}
        dofus={
          selected
            ? { id: selected.id, label: selected.label, imageUrl: selected.imageUrl, color: selected.color }
            : null
        }
        summary={
          selected
            ? `${selected.completedMilestones}/${selected.totalMilestones} blocs validés par au moins un membre · ${selected.membersInProgress.length} membre(s) engagé(s)`
            : ""
        }
        quests={selectedQuestRows}
        members={
          selected
            ? selected.membersInProgress.map((member) => ({
                name: member.userName,
                avatar: member.userAvatar ?? null,
                current: member.current ? member.current.label : null,
                done: member.done,
                total: member.total,
                pct: member.pct,
              }))
            : undefined
        }
        footer={
          selected ? (
            <button
              type="button"
              onClick={() => {
                onFilterChange(activeFilter === selected.id ? null : selected.id);
                setOpenDofusId(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-[4px] border border-border px-2.5 py-1.5 text-caption font-semibold text-foreground transition-colors hover:bg-elevated"
            >
              {activeFilter === selected.id ? "Retirer le filtre" : "Filtrer les quêtes sur ce Dofus"}
              <ChevronRight className="h-3 w-3" />
            </button>
          ) : undefined
        }
      />
    </div>
  );
});
"use client";
import { useMemo, memo, useState } from "react";
import { Users, ChevronRight } from "lucide-react";
import { dofusMetaIndex } from "@/lib/rush-dofus-meta";
import { excludeLegacyProfilesForViewer, groupGuildProgressByCharacter, memberCompletedStepKeys, memberDofusProgress, questStatusForMembers, scopeGuildProgressForViewer, type DofusQuestRef, type MemberDofusProgress } from "@/lib/rush-dofus-progress";
import { RushDofusDetailModal } from "@/components/dofus-quests/rush/RushDofusDetailModal";

// ─── Types ────────────────────────────────────────────────────────────────────

type Milestone = {
  id: string;
  title: string;
  chapter: number;
  chapterLabel: string;
  accentColor?: string | null;
  dofusId?: string | null;
  /** Séquences du bloc (pour projeter un bloc `isCompleted` en toutes ses quêtes). */
  sequences?: Array<{ id: string }>;
};

type GuildMemberProgress = {
  profileId: string;
  milestoneId: string;
  /** Emplacement du personnage (`PRINCIPAL` ou pseudo de mule) — porté par la ligne. */
  characterSlot?: string;
  /** `User.id` interne — détecte les profils hérités du même compte. */
  userId?: string | null;
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
  /** Personnage (`PRINCIPAL` ou pseudo de mule) — un membre peut en avoir plusieurs. */
  characterSlot: string;
  userName: string;
  userAvatar?: string;
  /** Personnage actif du lecteur (badge « MOI »). */
  isViewer: boolean;
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
  stepKeysBySequenceId,
  activeFilter,
  onFilterChange,
  onOpenQuest,
  viewerProfileId,
  viewerUserId,
  activeCharacterSlot,
}: {
  milestones: Milestone[];
  /** Quêtes ordonnées de chaque Dofus (`subGuideRef`, libellé, catégorie, nb d'étapes). */
  questsByDofus: Record<string, DofusQuestRef[]>;
  guildProgress: GuildMemberProgress[];
  /** Table `sequenceId → clés d'étape` (calculée par le guide, qui porte les séquences). */
  stepKeysBySequenceId: ReadonlyMap<string, readonly string[]>;
  activeFilter: string | null;
  onFilterChange: (id: string | null) => void;
  /** Clic sur une quête de la fiche : la page ferme la fiche et va à la quête. */
  onOpenQuest?: (sequenceId: string) => void;
  /** Profil du lecteur : ses autres emplacements (mules) ne comptent pas dans sa ligne. */
  viewerProfileId?: string | null;
  /** Compte du lecteur : ses profils hérités ne sont pas affichés comme un autre membre. */
  viewerUserId?: string | null;
  /** Emplacement du personnage sélectionné (`PRINCIPAL` ou pseudo de mule). */
  activeCharacterSlot?: string;
}) {
  /** Dofus dont la modale de détail est ouverte (un clic sur un Dofus). */
  const [openDofusId, setOpenDofusId] = useState<string | null>(null);

  /** Vue par défaut : **tous les personnages** (le but du panneau est la vue guilde). */
  const [scope, setScope] = useState<"all" | "me">("all");

  /**
   * Toutes les lignes de la guilde, **sauf les profils hérités du même compte** (même
   * `userId`, `profileId` différent) : on garde tous les personnages du profil courant
   * (principal + mules) et tous les autres membres.
   */
  const allRows = useMemo(
    () =>
      excludeLegacyProfilesForViewer(guildProgress, {
        profileId: viewerProfileId ?? null,
        userId: viewerUserId ?? null,
      }),
    [guildProgress, viewerProfileId, viewerUserId]
  );

  /** Lignes du seul personnage actif (vue « Mon personnage »). */
  const viewerRows = useMemo(
    () =>
      scopeGuildProgressForViewer(guildProgress, {
        profileId: viewerProfileId ?? null,
        userId: viewerUserId ?? null,
        characterSlot: activeCharacterSlot ?? "PRINCIPAL",
      }),
    [guildProgress, viewerProfileId, viewerUserId, activeCharacterSlot]
  );

  const panelRows = scope === "me" ? viewerRows : allRows;
  const characters = useMemo(() => {
    const grouped = groupGuildProgressByCharacter(panelRows, {
      profileId: viewerProfileId ?? null,
      characterSlot: activeCharacterSlot ?? "PRINCIPAL",
    });
    // Le personnage actif reste visible même à 0 (après un reset) : sans ligne de
    // progression, il disparaîtrait de la liste « Tous les personnages ».
    if (viewerProfileId && !grouped.some((character) => character.isViewer)) {
      const slot = activeCharacterSlot || "PRINCIPAL";
      grouped.push({
        key: `${viewerProfileId}::${slot}`,
        profileId: viewerProfileId,
        characterSlot: slot,
        name: slot === "PRINCIPAL" ? "Mon personnage" : slot,
        avatar: null,
        isViewer: true,
        rows: [],
      });
    }
    return grouped;
  }, [panelRows, viewerProfileId, activeCharacterSlot]);
  const panelCharacters = scope === "me" ? characters.filter((character) => character.isViewer) : characters;
  const panelProgress = useMemo(
    () => panelCharacters.flatMap((character) => character.rows),
    [panelCharacters]
  );
  const characterLabel = characters.find((character) => character.isViewer)?.name ?? "Mon personnage";

  /** Ids de séquence par bloc — un bloc `isCompleted` vaut toutes ses quêtes. */
  const sequenceIdsByMilestone = useMemo(
    () =>
      new Map(
        milestones.map((milestone) => [
          milestone.id,
          (milestone.sequences ?? []).map((sequence) => sequence.id),
        ])
      ),
    [milestones]
  );

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
      const completedBySome = panelProgress.some(
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

    // Avancement par **personnage** et par Dofus — au niveau quête. Un profil peut avoir
    // plusieurs personnages (principal + mules) : ils sont listés séparément, jamais fusionnés.
    map.forEach((stat, dofusId) => {
      const dofusMilestoneIds = new Set(
        milestones.filter((m) => m.dofusId === dofusId).map((m) => m.id)
      );
      const quests = questsByDofus[dofusId] ?? [];

      stat.membersInProgress = panelCharacters
        .map((character) => {
          const rows = character.rows.filter((row) => dofusMilestoneIds.has(row.milestoneId));
          if (!rows.length) return null;

          const completedSteps = memberCompletedStepKeys({
            rows,
            sequenceIdsByMilestone,
            stepKeysBySequenceId,
          });
          const currentStep = rows.find((row) => row.currentStep)?.currentStep ?? null;

          return {
            profileId: character.profileId,
            characterSlot: character.characterSlot,
            userName: character.name,
            userAvatar: character.avatar ?? undefined,
            isViewer: character.isViewer,
            ...memberDofusProgress(quests, completedSteps, currentStep),
          } as DofusMemberStat;
        })
        .filter((member): member is DofusMemberStat => member !== null)
        .sort((a, b) => b.pct - a.pct || a.userName.localeCompare(b.userName, "fr"));
    });

    return Array.from(map.values()).sort((a, b) => b.totalMilestones - a.totalMilestones);
  }, [milestones, questsByDofus, panelCharacters, sequenceIdsByMilestone, stepKeysBySequenceId]);

  const totalCharacters = panelCharacters.length;

  /** Dofus dont la modale est ouverte (un seul à la fois). */
  const selected = openDofusId ? dofusStats.find((d) => d.id === openDofusId) ?? null : null;

  /**
   * Quêtes du Dofus ouvert, avec leur statut : **Validée** (toutes les étapes chez un
   * personnage), **En cours** (l'étape courante d'un personnage), **À faire**. Chaque
   * personnage (principal, mule, autre membre) est une ligne distincte.
   */
  const selectedQuestRows = useMemo(() => {
    if (!selected) return [];
    const quests = questsByDofus[selected.id] ?? [];
    const dofusMilestoneIds = new Set(
      milestones.filter((milestone) => milestone.dofusId === selected.id).map((milestone) => milestone.id)
    );
    const members = panelCharacters.flatMap((character) => {
      const rows = character.rows.filter((row) => dofusMilestoneIds.has(row.milestoneId));
      if (!rows.length) return [];
      let currentStep: string | null = null;
      for (const row of rows) {
        if (!row.currentStep) continue;
        const keys = stepKeysBySequenceId.get(row.currentStep);
        currentStep = keys?.[0] ?? row.currentStep;
      }
      return [{
        completedSteps: memberCompletedStepKeys({
          rows,
          sequenceIdsByMilestone,
          stepKeysBySequenceId,
        }),
        currentStep,
        name: character.name,
        avatar: character.avatar ?? null,
        isViewer: character.isViewer,
      }];
    });
    return questStatusForMembers(quests, members);
  }, [selected, questsByDofus, milestones, panelCharacters, stepKeysBySequenceId, sequenceIdsByMilestone]);

  if (dofusStats.length === 0) return null;

  return (
    <div className="p-4 rounded-[6px] bg-surface border border-border">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex min-w-0 items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">
              {scope === "me" ? "Ma progression par Dofus" : "Progression Guilde par Dofus"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1" role="group" aria-label="Périmètre de la progression">
              <button
                type="button"
                onClick={() => setScope("all")}
                aria-pressed={scope === "all"}
                className={`rounded-[3px] border px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${scope === "all" ? "border-success/40 bg-success/10 text-success" : "border-border text-muted-foreground hover:text-foreground"}`}
              >
                Tous les personnages
              </button>
              <button
                type="button"
                onClick={() => setScope("me")}
                aria-pressed={scope === "me"}
                className={`rounded-[3px] border px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${scope === "me" ? "border-success/40 bg-success/10 text-success" : "border-border text-muted-foreground hover:text-foreground"}`}
              >
                Mon personnage
              </button>
            </div>
            <span className="text-xs font-mono tabular-nums text-muted-foreground">
              {scope === "me"
                ? characterLabel
                : `${totalCharacters} personnage${totalCharacters > 1 ? "s" : ""}`}
            </span>
          </div>
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
                aria-label={`Voir où en sont les personnages sur le Dofus ${d.label} — ${d.pct} %, ${d.membersInProgress.length} personnage(s) engagé(s)`}
                aria-pressed={isActive}
                className={`relative flex flex-col items-center gap-1 p-1.5 text-center cursor-pointer shrink-0 w-[78px] rounded-[4px] border transition-colors ${
                  isActive
                    ? "border-success bg-success/5"
                    : isAllDone
                      ? "border-success/40 bg-success/5 hover:border-success/60"
                      : "border-transparent hover:border-border"
                }`}
                title={`${d.label} — ${d.pct} % — cliquer pour le détail par personnage`}
              >
                {/* Dofus icon */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={d.imageUrl}
                  alt={d.label}
                  className="w-7 h-7 object-contain"
                />
                {isAllDone ? (
                  <span
                    className="absolute right-1 top-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-success text-[8px] font-bold text-background"
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                ) : null}

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
            ? scope === "me"
              ? `${selected.completedMilestones}/${selected.totalMilestones} blocs validés par ${characterLabel}`
              : `${selected.completedMilestones}/${selected.totalMilestones} blocs validés par au moins un personnage · ${selected.membersInProgress.length} personnage(s) engagé(s)`
            : ""
        }
        quests={selectedQuestRows}
        onOpenQuest={
          onOpenQuest
            ? (quest) => {
                setOpenDofusId(null);
                onOpenQuest(quest.sequenceId ?? quest.id);
              }
            : undefined
        }
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
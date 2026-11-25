"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useOverlayToast } from "@/components/rush/overlay-toast";
import { cn } from "@/lib/utils";
import { displayAchievementDescription } from "@/lib/challenge-description";
import { DungeonAchievementIcon } from "@/components/succes/achievement-icon";
import {
  achievementPanelSummary,
  listableDungeonAchievements,
  type DungeonAchievementDungeon,
  type DungeonAchievementPanelData,
  type DungeonAchievementPanelLoader,
  type DungeonAchievementPanelMode,
  type DungeonAchievementToggler,
  type DungeonAchievementView,
} from "@/lib/rush-dungeon-achievements";
import type { RushDungeonState } from "@/lib/rush-dungeons";
import { DungeonStateButton } from "./DungeonStateButton";

/** Une ligne de succès : icône, nom, points, explication, case. */
function AchievementRow({
  achievement,
  done,
  canEdit,
  pending,
  variant,
  onToggle,
}: {
  achievement: DungeonAchievementView;
  done: boolean;
  canEdit: boolean;
  pending: boolean;
  variant: "page" | "overlay";
  onToggle: (achievement: DungeonAchievementView) => void;
}) {
  const description = displayAchievementDescription({
    description: achievement.description,
    slug: achievement.slug,
  });
  const content = (
    <>
      <DungeonAchievementIcon achievement={achievement} className="h-6 w-6" fallbackClassName="h-5 w-5" />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate font-semibold text-foreground",
            variant === "overlay" ? "text-[11px]" : "text-sm"
          )}
        >
          {achievement.name}
        </span>
        {description ? (
          <span
            className={cn(
              "mt-0.5 block text-muted-foreground",
              variant === "overlay" ? "text-[10px]" : "text-xs"
            )}
          >
            {description}
          </span>
        ) : null}
      </span>
      {canEdit ? (
        <span
          className={cn(
            "grid h-5 w-5 shrink-0 place-items-center rounded-[3px] border",
            done ? "border-success bg-success text-white" : "border-border text-transparent"
          )}
          aria-hidden="true"
        >
          <Check className="h-3 w-3 stroke-[3]" />
        </span>
      ) : null}
    </>
  );

  if (!canEdit) {
    return <div className="flex items-start gap-2 px-1 py-1.5">{content}</div>;
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={`${done ? "Décocher" : "Cocher"} le succès ${achievement.name}`}
      disabled={pending}
      onClick={() => onToggle(achievement)}
      className={cn(
        "flex w-full items-start gap-2 rounded-[4px] px-1 py-1.5 text-left transition-colors hover:bg-elevated disabled:opacity-60",
        pending && "opacity-60"
      )}
    >
      {content}
    </button>
  );
}

/**
 * Panneau « succès d'un donjon » — deux niveaux clairement séparés :
 *  ① la coche du **donjon de cette quête** (par occurrence) ;
 *  ② les **succès du donjon** (par personnage, jamais le faux « Donjon validé »).
 *
 * Le composant ne connaît ni Prisma ni les actions : le parent fournit `loadPanel`
 * et `toggle`. C'est ce qui permet la même UI en membre, visiteur connecté et guest
 * (lecture seule) sans importer de code serveur dans le guide public.
 */
export function DungeonAchievementsPanel({
  mode,
  dungeon,
  dungeonKey,
  dungeonState,
  onSetDungeon,
  loadPanel,
  toggle,
  guestPseudo = null,
  characterSlot,
  variant = "page",
  showDungeonCheck = true,
  className,
}: {
  mode: DungeonAchievementPanelMode;
  dungeon: DungeonAchievementDungeon;
  /** Clé stable de l'occurrence (`sequenceId::dungeonKey`) — portée par le parent. */
  dungeonKey: string;
  dungeonState: RushDungeonState | null;
  onSetDungeon?: (state: RushDungeonState | null) => void;
  loadPanel: DungeonAchievementPanelLoader;
  toggle?: DungeonAchievementToggler;
  guestPseudo?: string | null;
  characterSlot?: string;
  variant?: "page" | "overlay";
  showDungeonCheck?: boolean;
  className?: string;
}) {
  // Overlay ⇒ toaster de la PiP ; page ⇒ toaster global.
  const toast = useOverlayToast();
  const [data, setData] = useState<DungeonAchievementPanelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<string[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | undefined>(characterSlot);
  const [localDungeonState, setLocalDungeonState] = useState<RushDungeonState | null>(dungeonState);

  useEffect(() => {
    setLocalDungeonState(dungeonState);
  }, [dungeonState]);

  const load = useCallback(
    async (slot?: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await loadPanel({
          dungeonId: dungeon.id,
          dungeon,
          characterSlot: slot ?? characterSlot,
          guestPseudo: guestPseudo ?? undefined,
        });
        if (!result.success || !result.data) {
          setData(null);
          setError(result.error ?? "Impossible de charger les succès de ce donjon.");
          return;
        }
        setData(result.data);
        setDoneIds(result.data.doneIds);
        setSelectedSlot(result.data.slot ?? undefined);
      } catch {
        setData(null);
        setError("Impossible de charger les succès de ce donjon.");
      } finally {
        setLoading(false);
      }
    },
    [loadPanel, dungeon, characterSlot, guestPseudo]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const achievements = useMemo(
    () => (data ? listableDungeonAchievements(data.achievements) : []),
    [data]
  );
  const summary = achievementPanelSummary(achievements, doneIds);
  const canEdit = !!data?.canEdit && !!toggle && mode !== "guest";
  const activeSlot = selectedSlot ?? data?.slot ?? undefined;

  const handleToggle = useCallback(
    async (achievement: DungeonAchievementView) => {
      if (!toggle || !canEdit) return;
      const wasDone = doneIds.includes(achievement.id);
      setDoneIds((prev) =>
        wasDone ? prev.filter((id) => id !== achievement.id) : [...prev, achievement.id]
      );
      setPendingId(achievement.id);
      try {
        const result = await toggle({
          dungeonId: dungeon.id,
          achievementId: achievement.id,
          characterSlot: activeSlot,
        });
        if (!result.success) {
          setDoneIds((prev) =>
            wasDone ? [...prev, achievement.id] : prev.filter((id) => id !== achievement.id)
          );
          toast.error(result.error ?? "Impossible d'enregistrer la coche");
          return;
        }
        setDoneIds((prev) => {
          const has = prev.includes(achievement.id);
          if (result.done && !has) return [...prev, achievement.id];
          if (result.done === false && has) return prev.filter((id) => id !== achievement.id);
          return prev;
        });
      } finally {
        setPendingId(null);
      }
    },
    [toggle, canEdit, doneIds, dungeon.id, activeSlot]
  );

  const handleSetDungeon = (next: RushDungeonState | null) => {
    setLocalDungeonState(next);
    onSetDungeon?.(next);
  };

  const handleSelectSlot = (slot: string) => {
    setSelectedSlot(slot);
    void load(slot);
  };

  const overlay = variant === "overlay";

  return (
    <div className={cn("space-y-3", className)} data-dungeon-key={dungeonKey}>
      {showDungeonCheck ? (
        <section className="space-y-1.5" aria-label="Donjon de cette quête">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
            <p className={cn("font-semibold text-foreground", overlay ? "text-[11px]" : "text-sm")}>
              Donjon de cette quête
            </p>
            <span className="text-[10px] text-muted-foreground">vaut pour cette quête uniquement</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <DungeonStateButton
              active={localDungeonState === "done"}
              tone="emerald"
              label="Fait"
              ariaLabel={`Marquer ${dungeon.name} comme fait dans cette quête`}
              disabled={!onSetDungeon}
              onClick={() => handleSetDungeon(localDungeonState === "done" ? null : "done")}
            />
            <DungeonStateButton
              active={localDungeonState === "todo"}
              tone="amber"
              label="À faire"
              ariaLabel={`Marquer ${dungeon.name} comme à faire dans cette quête`}
              disabled={!onSetDungeon}
              onClick={() => handleSetDungeon(localDungeonState === "todo" ? null : "todo")}
            />
          </div>
        </section>
      ) : null}

      <section className="space-y-2 border-t border-border pt-3" aria-label="Succès du donjon">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className={cn("font-semibold text-foreground", overlay ? "text-[11px]" : "text-sm")}>
              Succès du donjon
            </p>
            <p className="text-[10px] text-muted-foreground">
              {summary.isEmpty
                ? "Aucun succès connu"
                : `${summary.done}/${summary.total} validé${summary.done > 1 ? "s" : ""}`}
              {data?.characterName ? ` · ${data.characterName}` : ""}
            </p>
          </div>
          {mode === "visitor" &&
          data &&
          data.characters.length > 0 &&
          (data.slot === null || data.characters.length > 1) ? (
            <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              Personnage
              <select
                value={activeSlot ?? ""}
                onChange={(event) => {
                  if (event.target.value) handleSelectSlot(event.target.value);
                }}
                className="max-w-[11rem] rounded-[4px] border border-border bg-surface px-1.5 py-1 text-[10px] text-foreground"
              >
                {activeSlot ? null : <option value="">Choisir…</option>}
                {data.characters.map((character) => (
                  <option key={character.slot} value={character.slot}>
                    {character.name}
                    {character.isMain ? " (principal)" : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        {loading ? (
          <p className="flex items-center gap-2 py-3 text-[11px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Chargement des succès…
          </p>
        ) : error ? (
          <div className="space-y-1.5 py-2">
            <p className="text-[11px] text-warning">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="text-[10px] font-semibold text-foreground underline underline-offset-2"
            >
              Réessayer
            </button>
          </div>
        ) : summary.isEmpty ? (
          <p
            className={cn(
              "rounded-[4px] border border-border bg-surface px-2.5 py-2 text-muted-foreground",
              overlay ? "text-[10px]" : "text-xs"
            )}
          >
            Aucun succès connu pour ce donjon. La coche « donjon fait » suffit : il n&apos;y a rien
            d&apos;autre à valider.
          </p>
        ) : (
          <div className="space-y-0.5">
            {achievements.map((achievement) => (
              <AchievementRow
                key={achievement.id}
                achievement={achievement}
                done={doneIds.includes(achievement.id)}
                canEdit={canEdit}
                pending={pendingId === achievement.id}
                variant={variant}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}

        {!loading && !error && !canEdit ? (
          <p className="text-[10px] text-muted-foreground">
            {mode === "guest"
              ? "Connecte-toi pour cocher tes succès."
              : mode === "visitor" && data?.slot === null
                ? "Choisis un personnage déclaré dans ton profil pour cocher."
                : "Lecture seule : aucune coche ne sera enregistrée."}
          </p>
        ) : null}
      </section>
    </div>
  );
}

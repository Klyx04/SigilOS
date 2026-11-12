"use client";

import { useEffect, useState } from "react";

import { Plus, X } from "lucide-react";

import { RushQuestConstraints as RushQuestConstraintsView } from "@/components/dofus-quests/rush/RushQuestConstraints";
import { RushPortrait } from "@/components/dofus-quests/rush/RushPortrait";
import { GameIcon } from "@/components/shared/game-icon";
import { DOFUS_CLASSES, DOFUS_JOBS, getJob } from "@/lib/dofus-assets";
import {
  constraintsToInfos,
  RUSH_COMBAT_MODES,
  sanitizeConstraints,
} from "@/lib/rush-constraints";
import { cn } from "@/lib/utils";
import { searchMonstersForDefi } from "@/server/actions/defi-admin-actions";
import { searchDungeonsLocal } from "@/server/actions/dofus-search-actions";
import type {
  RushBashMob,
  RushCombatMode,
  RushCombatMonster,
  RushConstraintRole,
  RushDungeonChoiceDungeon,
  RushQuestConstraints,
} from "@/types/rush-constraints";

import { RushClassSelect } from "./RushClassSelect";

const JOB_GROUPS = Object.entries(DOFUS_JOBS).map(([category, jobs]) => ({ category, jobs }));
const CATEGORY_LABELS: Record<string, string> = {
  RECOLTE: "Récolte",
  ARTISANAT: "Artisanat",
  FORGEMAGIE: "Forgemagie",
};

const FIELD =
  "min-w-0 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-warning/50";
const LABEL = "text-[10px] font-semibold uppercase tracking-wider text-muted-foreground";
const ACTION =
  "inline-flex items-center gap-1 rounded-lg border border-border bg-elevated px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground";
const ICON = "h-3.5 w-3.5 shrink-0";

/** Un métier du référentiel Dofus, avec son icône réelle. */
function JobSelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  className?: string;
}) {
  const job = getJob(value);
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <GameIcon
        src={job?.icon ?? "/assets/dofus/game-icons/hammer.png"}
        className="h-4 w-4 shrink-0"
      />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(FIELD, "min-w-0", className)}
      >
        {JOB_GROUPS.map((group) => (
          <optgroup key={group.category} label={CATEGORY_LABELS[group.category] ?? group.category}>
            {group.jobs.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </span>
  );
}

function nextRole(kind: RushConstraintRole["kind"]): RushConstraintRole {
  if (kind === "job") return { kind: "job", job: JOB_GROUPS[0].jobs[0].id };
  if (kind === "class") return { kind: "class", className: DOFUS_CLASSES[0].id };
  return { kind: "free", text: "" };
}

/**
 * Éditeur des **conditions** d'une quête Rush — des infos, jamais des règles de blocage.
 * Chaque valeur est un contrôle (heure, effectif, métier + niveau, sort, note) ; les
 * métiers viennent de `DOFUS_JOBS` et leurs icônes sont les assets Dofus réels.
 */
export function RushConditionsEditor({
  value,
  onChange,
}: {
  value: RushQuestConstraints;
  onChange: (next: RushQuestConstraints) => void;
}) {
  const update = (patch: Partial<RushQuestConstraints>) => onChange({ ...value, ...patch });
  const players: NonNullable<RushQuestConstraints["players"]> = value.players ?? { roles: [] };
  const hours = value.hours;
  const preview = constraintsToInfos(sanitizeConstraints(value));

  const updatePlayers = (patch: Partial<NonNullable<RushQuestConstraints["players"]>>) =>
    update({ players: { ...players, ...patch } });
  const setRole = (index: number, role: RushConstraintRole) => {
    const roles = [...players.roles];
    roles[index] = role;
    updatePlayers({ roles });
  };
  const removeRole = (index: number) =>
    updatePlayers({ roles: players.roles.filter((_, roleIndex) => roleIndex !== index) });
  const setRoleLevel = (index: number, raw: string) => {
    const role = players.roles[index];
    if (!role || role.kind === "free") return;
    setRole(index, { ...role, level: raw ? Number(raw) : undefined });
  };

  const combat = value.combat;
  const dungeonChoice = value.dungeonChoice;
  const bashMobs = value.bashMobs ?? [];

  const setCombatMode = (mode: RushCombatMode) => {
    const current = value.combat ?? { mode, monsters: [] };
    update({ combat: { ...current, mode } });
  };
  const addCombatMonster = (monster: RushCombatMonster) => {
    const current = value.combat ?? { mode: "solo" as const, monsters: [] };
    update({ combat: { ...current, monsters: [...current.monsters, monster] } });
  };
  const updateCombatMonster = (index: number, patch: Partial<RushCombatMonster>) => {
    if (!value.combat) return;
    const monsters = value.combat.monsters.map((monster, monsterIndex) =>
      monsterIndex === index ? { ...monster, ...patch } : monster,
    );
    update({ combat: { ...value.combat, monsters } });
  };
  const removeCombatMonster = (index: number) => {
    if (!value.combat) return;
    update({
      combat: {
        ...value.combat,
        monsters: value.combat.monsters.filter((_, monsterIndex) => monsterIndex !== index),
      },
    });
  };
  const setDungeonNote = (note: string) => {
    const current = value.dungeonChoice ?? { dungeons: [] };
    update({ dungeonChoice: { ...current, note } });
  };
  const addDungeon = (dungeon: RushDungeonChoiceDungeon) => {
    const current = value.dungeonChoice ?? { dungeons: [] };
    update({ dungeonChoice: { ...current, dungeons: [...current.dungeons, dungeon] } });
  };
  const removeDungeon = (index: number) => {
    if (!value.dungeonChoice) return;
    update({
      dungeonChoice: {
        ...value.dungeonChoice,
        dungeons: value.dungeonChoice.dungeons.filter(
          (_, dungeonIndex) => dungeonIndex !== index,
        ),
      },
    });
  };
  const addBashMob = (mob: RushBashMob) => update({ bashMobs: [...bashMobs, mob] });
  const removeBashMob = (index: number) =>
    update({ bashMobs: bashMobs.filter((_, mobIndex) => mobIndex !== index) });

  return (
    <div className="space-y-2.5">
      {/* ── Horaire ── */}
      <div className="rounded-lg border border-border bg-surface/60 p-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={cn(LABEL, "flex items-center gap-1.5")}>
            <GameIcon src="/assets/dofus/game-icons/pin-clock.png" className={ICON} />
            Horaire
          </span>
          <div className="flex flex-wrap gap-1">
            {[
              { value: "", label: "Aucun" },
              { value: "window", label: "Créneau" },
              { value: "wait", label: "Attente" },
            ].map((choice) => (
              <button
                key={choice.value}
                type="button"
                onClick={() =>
                  update({
                    hours:
                      choice.value === ""
                        ? null
                        : choice.value === "window"
                          ? { kind: "window", from: "20:00", to: "23:00" }
                          : { kind: "wait", minutes: 3 },
                  })
                }
                className={cn(
                  ACTION,
                  (choice.value === "" && !hours) ||
                    (choice.value !== "" && hours?.kind === choice.value)
                    ? "border-warning/50 bg-warning/10 text-foreground"
                    : "",
                )}
              >
                {choice.label}
              </button>
            ))}
          </div>
        </div>

        {hours?.kind === "window" && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className={LABEL}>De</label>
            <input
              type="time"
              value={hours.from}
              onChange={(event) => update({ hours: { ...hours, from: event.target.value } })}
              className={cn(FIELD, "w-[7.5rem]")}
            />
            <label className={LABEL}>à</label>
            <input
              type="time"
              value={hours.to ?? ""}
              onChange={(event) =>
                update({ hours: { ...hours, to: event.target.value || undefined } })
              }
              className={cn(FIELD, "w-[7.5rem]")}
            />
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={!!hours.optional}
                onChange={(event) =>
                  update({ hours: { ...hours, optional: event.target.checked } })
                }
                className="accent-warning"
              />
              Contournable
            </label>
          </div>
        )}

        {hours?.kind === "wait" && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={1}
              max={1440}
              value={hours.minutes}
              onChange={(event) =>
                update({ hours: { ...hours, minutes: Number(event.target.value) || 1 } })
              }
              className={cn(FIELD, "w-20")}
            />
            <span className="text-[11px] text-muted-foreground">minutes</span>
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={!!hours.npc}
                onChange={(event) => update({ hours: { ...hours, npc: event.target.checked } })}
                className="accent-warning"
              />
              Auprès d&apos;un PNJ
            </label>
          </div>
        )}
      </div>

      {/* ── Joueurs ── */}
      <div className="rounded-lg border border-border bg-surface/60 p-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={cn(LABEL, "flex items-center gap-1.5")}>
            <GameIcon src="/assets/dofus/game-icons/party.png" className={ICON} />
            Joueurs
          </span>
          <button
            type="button"
            onClick={() =>
              updatePlayers({
                roles: [...players.roles, { kind: "job", job: JOB_GROUPS[0].jobs[0].id }],
              })
            }
            className={ACTION}
          >
            <Plus className={ICON} /> Rôle
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className={LABEL}>Effectif</label>
          <input
            type="number"
            min={1}
            max={40}
            value={players.count ?? ""}
            placeholder="—"
            onChange={(event) =>
              updatePlayers({
                count: event.target.value ? Number(event.target.value) : undefined,
              })
            }
            className={cn(FIELD, "w-20")}
          />
        </div>

        {players.roles.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {players.roles.map((role, index) => (
              <div key={index} className="flex flex-wrap items-center gap-1.5">
                <select
                  value={role.kind}
                  onChange={(event) =>
                    setRole(index, nextRole(event.target.value as RushConstraintRole["kind"]))
                  }
                  className={cn(FIELD, "w-24")}
                >
                  <option value="job">Métier</option>
                  <option value="class">Classe</option>
                  <option value="free">Libre</option>
                </select>

                {role.kind === "job" && (
                  <JobSelect
                    value={role.job}
                    onChange={(job) => setRole(index, { kind: "job", job, level: role.level })}
                  />
                )}
                {role.kind === "class" && (
                  <RushClassSelect
                    id={`rush-role-class-${index}`}
                    value={role.className}
                    onChange={(className) =>
                      setRole(index, { kind: "class", className, level: role.level })
                    }
                    className={cn(FIELD, "w-32")}
                  />
                )}
                {role.kind === "free" && (
                  <input
                    value={role.text}
                    onChange={(event) => setRole(index, { kind: "free", text: event.target.value })}
                    placeholder="Condition libre"
                    className={cn(FIELD, "flex-1")}
                  />
                )}
                {role.kind !== "free" && (
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={role.level ?? ""}
                    placeholder="Niv."
                    onChange={(event) => setRoleLevel(index, event.target.value)}
                    className={cn(FIELD, "w-16")}
                  />
                )}
                <button
                  type="button"
                  aria-label="Supprimer ce rôle"
                  onClick={() => removeRole(index)}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className={ICON} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Métiers ── */}
      <div className="rounded-lg border border-border bg-surface/60 p-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={cn(LABEL, "flex items-center gap-1.5")}>
            <GameIcon src="/assets/dofus/game-icons/hammer.png" className={ICON} />
            Métiers
          </span>
          <button
            type="button"
            onClick={() => update({ jobs: [...value.jobs, { job: JOB_GROUPS[0].jobs[0].id }] })}
            className={ACTION}
          >
            <Plus className={ICON} /> Métier
          </button>
        </div>

        {value.jobs.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {value.jobs.map((job, index) => (
              <div key={index} className="flex flex-wrap items-center gap-1.5">
                <JobSelect
                  value={job.job}
                  onChange={(next) => {
                    const jobs = [...value.jobs];
                    jobs[index] = { ...job, job: next };
                    update({ jobs });
                  }}
                />
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={job.level ?? ""}
                  placeholder="Niv."
                  onChange={(event) => {
                    const jobs = [...value.jobs];
                    jobs[index] = {
                      ...job,
                      level: event.target.value ? Number(event.target.value) : undefined,
                    };
                    update({ jobs });
                  }}
                  className={cn(FIELD, "w-16")}
                />
                <button
                  type="button"
                  aria-label="Supprimer ce métier"
                  onClick={() =>
                    update({ jobs: value.jobs.filter((_, jobIndex) => jobIndex !== index) })
                  }
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className={ICON} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Combat ── */}
      <div className="rounded-lg border border-border bg-surface/60 p-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={cn(LABEL, "flex items-center gap-1.5")}>
            <GameIcon src="/assets/dofus/game-icons/crossed-swords.png" className={ICON} />
            Combat
          </span>
          <div className="flex flex-wrap items-center gap-1">
            <select
              value={combat?.mode ?? "solo"}
              onChange={(event) => setCombatMode(event.target.value as RushCombatMode)}
              className={cn(FIELD, "w-44")}
              aria-label="Mode de combat"
            >
              {RUSH_COMBAT_MODES.map((mode) => (
                <option key={mode.id} value={mode.id}>
                  {mode.label}
                </option>
              ))}
            </select>
            {combat && (
              <button type="button" onClick={() => update({ combat: null })} className={ACTION}>
                <X className={ICON} /> Retirer
              </button>
            )}
          </div>
        </div>

        <div className="mt-2 space-y-1.5">
          <MonsterSearch
            placeholder="Ajouter un monstre au combat…"
            onPick={(result) =>
              addCombatMonster({
                name: result.label,
                count: 1,
                level: monsterLevel(result.subLabel),
                imageUrl: result.imageUrl ?? undefined,
              })
            }
          />
          {combat?.monsters.map((monster, index) => (
            <div key={`${monster.name}-${index}`} className="flex flex-wrap items-center gap-1.5">
              <RushPortrait src={monster.imageUrl} alt={monster.name} className="h-7 w-7" />
              <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">
                {monster.name}
              </span>
              <input
                type="number"
                min={1}
                max={20}
                value={monster.count}
                onChange={(event) =>
                  updateCombatMonster(index, { count: Number(event.target.value) || 1 })
                }
                className={cn(FIELD, "w-14")}
                aria-label="Nombre de monstres"
              />
              <input
                type="number"
                min={1}
                max={200}
                value={monster.level ?? ""}
                placeholder="Niv."
                onChange={(event) =>
                  updateCombatMonster(index, {
                    level: event.target.value ? Number(event.target.value) : undefined,
                  })
                }
                className={cn(FIELD, "w-16")}
                aria-label="Niveau du monstre"
              />
              <input
                type="number"
                min={1}
                max={999999}
                value={monster.health ?? ""}
                placeholder="PV"
                onChange={(event) =>
                  updateCombatMonster(index, {
                    health: event.target.value ? Number(event.target.value) : undefined,
                  })
                }
                className={cn(FIELD, "w-20")}
                aria-label="Points de vie du monstre"
              />
              <button
                type="button"
                aria-label="Supprimer ce monstre"
                onClick={() => removeCombatMonster(index)}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className={ICON} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Donjon au choix ── */}
      <div className="rounded-lg border border-border bg-surface/60 p-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={cn(LABEL, "flex items-center gap-1.5")}>
            <GameIcon src="/assets/dofus/game-icons/zaap.png" className={ICON} />
            Donjon au choix
          </span>
          {dungeonChoice && (
            <button
              type="button"
              onClick={() => update({ dungeonChoice: null })}
              className={ACTION}
            >
              <X className={ICON} /> Retirer
            </button>
          )}
        </div>

        <div className="mt-2 space-y-1.5">
          <DungeonSearch
            onPick={(dungeon) =>
              addDungeon({
                id: dungeon.id,
                name: dungeon.name,
                bossName: dungeon.bossName,
                level: dungeon.level,
                imageUrl: dungeon.imageUrl ?? undefined,
              })
            }
          />
          {dungeonChoice?.dungeons.map((dungeon, index) => (
            <div key={`${dungeon.name}-${index}`} className="flex flex-wrap items-center gap-1.5">
              <RushPortrait src={dungeon.imageUrl} alt={dungeon.name} className="h-8 w-8" />
              <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">
                {dungeon.name}
                <span className="block truncate text-[10px] text-muted-foreground">
                  {dungeon.bossName ?? ""}
                  {dungeon.level !== undefined
                    ? `${dungeon.bossName ? " · " : ""}Niv. ${dungeon.level}`
                    : ""}
                </span>
              </span>
              <button
                type="button"
                aria-label="Supprimer ce donjon"
                onClick={() => removeDungeon(index)}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className={ICON} />
              </button>
            </div>
          ))}
          {dungeonChoice && (
            <input
              value={dungeonChoice.note ?? ""}
              onChange={(event) => setDungeonNote(event.target.value)}
              placeholder="Note (facultatif)"
              className={cn(FIELD, "w-full")}
              aria-label="Note du donjon au choix"
            />
          )}
        </div>
      </div>

      {/* ── Monstres à tuer ── */}
      <div className="rounded-lg border border-border bg-surface/60 p-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={cn(LABEL, "flex items-center gap-1.5")}>
            <GameIcon src="/assets/dofus/game-icons/crossed-swords.png" className={ICON} />
            Monstres à tuer
          </span>
          {bashMobs.length > 0 && (
            <button type="button" onClick={() => update({ bashMobs: [] })} className={ACTION}>
              <X className={ICON} /> Vider
            </button>
          )}
        </div>

        <div className="mt-2 space-y-1.5">
          <MonsterSearch
            placeholder="Ajouter une espèce à combattre…"
            onPick={(result) =>
              addBashMob({
                name: result.label,
                level: monsterLevel(result.subLabel),
                imageUrl: result.imageUrl ?? undefined,
              })
            }
          />
          {bashMobs.map((mob, index) => (
            <div key={`${mob.name}-${index}`} className="flex flex-wrap items-center gap-1.5">
              <RushPortrait src={mob.imageUrl} alt={mob.name} className="h-6 w-6 rounded-full" />
              <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">{mob.name}</span>
              <input
                type="number"
                min={1}
                max={200}
                value={mob.level ?? ""}
                placeholder="Niv."
                onChange={(event) =>
                  update({
                    bashMobs: bashMobs.map((current, mobIndex) =>
                      mobIndex === index
                        ? {
                            ...current,
                            level: event.target.value ? Number(event.target.value) : undefined,
                          }
                        : current,
                    ),
                  })
                }
                className={cn(FIELD, "w-16")}
                aria-label="Niveau du monstre"
              />
              <button
                type="button"
                aria-label="Supprimer ce monstre"
                onClick={() => removeBashMob(index)}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className={ICON} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Sorts ── */}
      <div className="rounded-lg border border-border bg-surface/60 p-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={cn(LABEL, "flex items-center gap-1.5")}>
            <GameIcon src="/assets/dofus/game-icons/parchment.png" className={ICON} />
            Sorts
          </span>
          <button
            type="button"
            onClick={() => update({ spells: [...value.spells, ""] })}
            className={ACTION}
          >
            <Plus className={ICON} /> Sort
          </button>
        </div>

        {value.spells.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {value.spells.map((spell, index) => (
              <div key={index} className="flex flex-wrap items-center gap-1.5">
                <GameIcon
                  src="/assets/dofus/game-icons/parchment.png"
                  className="h-4 w-4 shrink-0"
                />
                <input
                  value={spell}
                  onChange={(event) => {
                    const spells = [...value.spells];
                    spells[index] = event.target.value;
                    update({ spells });
                  }}
                  placeholder="Nom du sort"
                  className={cn(FIELD, "flex-1")}
                />
                <button
                  type="button"
                  aria-label="Supprimer ce sort"
                  onClick={() =>
                    update({ spells: value.spells.filter((_, spellIndex) => spellIndex !== index) })
                  }
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className={ICON} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Notes ── */}
      <div className="rounded-lg border border-border bg-surface/60 p-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={cn(LABEL, "flex items-center gap-1.5")}>
            <GameIcon src="/assets/dofus/game-icons/info.png" className={ICON} />
            Notes
          </span>
          <button
            type="button"
            onClick={() => update({ notes: [...value.notes, ""] })}
            className={ACTION}
          >
            <Plus className={ICON} /> Note
          </button>
        </div>

        {value.notes.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {value.notes.map((note, index) => (
              <div key={index} className="flex flex-wrap items-center gap-1.5">
                <input
                  value={note}
                  onChange={(event) => {
                    const notes = [...value.notes];
                    notes[index] = event.target.value;
                    update({ notes });
                  }}
                  placeholder="Condition libre"
                  className={cn(FIELD, "flex-1")}
                />
                <button
                  type="button"
                  aria-label="Supprimer cette note"
                  onClick={() =>
                    update({ notes: value.notes.filter((_, noteIndex) => noteIndex !== index) })
                  }
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className={ICON} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Aperçu membre ── */}
      <div className="rounded-lg border border-border bg-surface/60 p-2.5">
        <p className={LABEL}>Aperçu membre</p>
        {preview.length > 0 ? (
          <div className="mt-1.5">
            <RushQuestConstraintsView constraints={preview} />
          </div>
        ) : (
          <p className="mt-1.5 text-[11px] text-muted-foreground">Aucune condition saisie.</p>
        )}
      </div>
    </div>
  );
}

type MonsterResult = {
  value: string;
  label: string;
  subLabel?: string;
  imageUrl?: string | null;
};

/** « Donjon · Niv. 200 » → 200 ; absent si le catalogue ne le dit pas. */
function monsterLevel(subLabel?: string): number | undefined {
  const match = subLabel?.match(/Niv\.\s*(\d+)/i);
  return match ? Number(match[1]) : undefined;
}

/** Recherche de monstre (catalogue local + boss siphonnés), avec portrait réel. */
function MonsterSearch({
  onPick,
  placeholder,
}: {
  onPick: (result: MonsterResult) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MonsterResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      const response = await searchMonstersForDefi(q);
      if (!active) return;
      setResults(response.success && response.data ? (response.data as MonsterResult[]) : []);
      setLoading(false);
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="space-y-1.5">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        className={cn(FIELD, "w-full")}
        aria-label={placeholder}
      />
      {loading && <p className="text-[10px] text-muted-foreground">Recherche…</p>}
      {results.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-surface p-1">
          {results.map((result) => (
            <button
              key={result.value}
              type="button"
              onClick={() => {
                onPick(result);
                setQuery("");
                setResults([]);
              }}
              className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-elevated"
            >
              <RushPortrait src={result.imageUrl} alt={result.label} className="h-6 w-6" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] text-foreground">{result.label}</span>
                {result.subLabel && (
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {result.subLabel}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type DungeonResult = {
  id: string;
  name: string;
  bossName: string;
  level: number;
  imageUrl: string | null;
};

/** Recherche de donjon dans la base locale, avec l'icône réelle du donjon. */
function DungeonSearch({ onPick }: { onPick: (dungeon: DungeonResult) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DungeonResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      const response = await searchDungeonsLocal(q);
      if (!active) return;
      setResults(response.success && response.data ? (response.data as DungeonResult[]) : []);
      setLoading(false);
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="space-y-1.5">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Ajouter un donjon au choix…"
        className={cn(FIELD, "w-full")}
        aria-label="Ajouter un donjon au choix"
      />
      {loading && <p className="text-[10px] text-muted-foreground">Recherche…</p>}
      {results.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-surface p-1">
          {results.map((dungeon) => (
            <button
              key={dungeon.id}
              type="button"
              onClick={() => {
                onPick(dungeon);
                setQuery("");
                setResults([]);
              }}
              className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-elevated"
            >
              <RushPortrait src={dungeon.imageUrl} alt={dungeon.name} className="h-7 w-7" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] text-foreground">{dungeon.name}</span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {dungeon.bossName} · Niv. {dungeon.level}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}



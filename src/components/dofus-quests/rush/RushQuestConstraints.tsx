"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

import { GameIcon } from "@/components/shared/game-icon";
import type { RushConstraintInfo } from "@/lib/rush-constraints";
import { cn } from "@/lib/utils";
import type { RushBashMob, RushCombat, RushDungeonChoiceDungeon } from "@/types/rush-constraints";
import type { RushTagViewer } from "./RushTagBadge";

import { RushPortrait } from "./RushPortrait";
import { RushRichText } from "./RushRichText";

/** Fiche monstre lourde : chargée à la demande, comme les tags de combat. */
const RushMonsterFicheModal = dynamic(
  () => import("./RushMonsterFicheModal").then((mod) => mod.RushMonsterFicheModal),
  { ssr: false },
);

/** Id DofusDB d'un monstre depuis son URL d'asset (`/api/assets-dofus/monsters/2860`). */
function monsterIdFromImageUrl(url: string | undefined): number | null {
  const match = /\/monsters\/(\d+)(?:\?|$)/.exec(url ?? "");
  const id = match ? Number(match[1]) : NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * Infos de quête illustrées — **jamais des conditions de blocage**.
 *
 * Les contraintes Tougli (joueurs, métier, horaire, sort, note) sont déjà du texte dans
 * `GuideSequence.tips` ; `parseRushConstraints` les a séparées. Ici on les rend avec de
 * **vrais assets Dofus** (`game-icons/` et `jobs/`), dans les trois surfaces : dashboard,
 * guide public et overlay. Aucun état, aucun clic, aucune règle : c'est de la lecture.
 */
export function RushQuestConstraints({
  constraints,
  className,
  viewer = "preview",
}: {
  constraints: RushConstraintInfo[];
  className?: string;
  /** Surface : fiche monstre interne pour un membre, lien public pour un visiteur. */
  viewer?: RushTagViewer;
}) {
  if (constraints.length === 0) return null;

  return (
    <div role="list" className={cn("grid gap-1.5", className)}>
      {constraints.map((constraint, index) => {
        const key = `${constraint.kind}-${index}`;
        if (constraint.kind === "combat" && constraint.combat) {
          return (
            <div key={key} role="listitem">
              <RushCombatCard
                combat={constraint.combat}
                label={constraint.label}
                icon={constraint.icon}
                viewer={viewer}
              />
            </div>
          );
        }
        if (constraint.kind === "dungeon" && constraint.dungeons) {
          return (
            <div key={key} role="listitem">
              <RushDungeonChoiceCard
                dungeons={constraint.dungeons}
                note={constraint.dungeonNote}
                label={constraint.label}
                icon={constraint.icon}
              />
            </div>
          );
        }
        if (constraint.kind === "mobs" && constraint.mobs) {
          return (
            <div key={key} role="listitem">
              <RushBashMobsCard
                mobs={constraint.mobs}
                label={constraint.label}
                icon={constraint.icon}
                viewer={viewer}
              />
            </div>
          );
        }
        return (
          <div
            key={key}
            role="listitem"
            className="flex items-start gap-2 rounded-[4px] border border-border bg-surface px-2 py-1.5"
          >
            <span className="mt-0.5 flex shrink-0 items-center gap-1" aria-hidden="true">
              <GameIcon src={constraint.icon} className="h-4 w-4" />
              {constraint.jobs.slice(1).map((job) => (
                <GameIcon
                  key={job.slug}
                  src={`/assets/dofus/jobs/${job.slug}.png`}
                  className="h-4 w-4"
                />
              ))}
            </span>

            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {constraint.label}
                </span>
                {constraint.players !== undefined && (
                  <span className="rounded-full border border-border bg-elevated px-1.5 py-0.5 text-[10px] font-bold text-foreground">
                    {constraint.players} joueur{constraint.players > 1 ? "s" : ""}
                  </span>
                )}
                {constraint.hours?.variant === "window" && (
                  <span className="rounded-full border border-border bg-elevated px-1.5 py-0.5 text-[10px] font-bold text-foreground">
                    {constraint.hours.from ?? "?"}
                    {constraint.hours.to ? ` → ${constraint.hours.to}` : " et +"}
                  </span>
                )}
                {constraint.hours?.variant === "wait" && (
                  <span className="rounded-full border border-border bg-elevated px-1.5 py-0.5 text-[10px] font-bold text-foreground">
                    {constraint.hours.minutes !== undefined
                      ? `${constraint.hours.minutes} min`
                      : "Attente"}
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-[12px] leading-relaxed text-foreground">
                <RushRichText text={constraint.text} />
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Combat — mode + composition, avec portraits et PV. */
function RushCombatCard({
  combat,
  label,
  icon,
  viewer = "preview",
}: {
  combat: RushCombat;
  label: string;
  icon: string;
  viewer?: RushTagViewer;
}) {
  const [fiche, setFiche] = useState<{ slug: string; name: string } | null>(null);

  return (
    <div className="rounded-[4px] border border-border bg-surface p-2">
      <div className="flex items-center gap-1.5">
        <GameIcon src={icon} className="h-4 w-4" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="mt-1.5 space-y-1">
        {combat.monsters.map((monster, index) => {
          const monsterId = monsterIdFromImageUrl(monster.imageUrl);
          const rowClass = "flex w-full items-center gap-2 rounded-[3px] px-0.5 py-0.5 text-left";
          const content = (
            <>
              <RushPortrait src={monster.imageUrl} alt={monster.name} className="h-7 w-7" />
              <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">
                {monster.count > 1 ? `${monster.count} × ` : ""}
                {monster.name}
              </span>
              {monster.level !== undefined && (
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  Niv. {monster.level}
                </span>
              )}
              {monster.health !== undefined && (
                <span className="shrink-0 text-[10px] font-semibold text-danger">
                  {monster.health} PV
                </span>
              )}
            </>
          );
          // Membre : la fiche interne s'ouvre dans le guide. Visiteur : lien direct
          // vers la fiche publique (`/bestiaire/<id>` redirige vers `/boss/<slug>`
          // quand la bête a une fiche officielle). Aperçu God : aucune navigation.
          if (monsterId && viewer === "member") {
            return (
              <button
                key={`${monster.name}-${index}`}
                type="button"
                onClick={() => setFiche({ slug: String(monsterId), name: monster.name })}
                title={`Ouvrir la fiche de ${monster.name}`}
                aria-label={`Ouvrir la fiche de ${monster.name}`}
                className={cn(rowClass, "transition-colors hover:bg-elevated")}
              >
                {content}
              </button>
            );
          }
          if (monsterId && viewer === "visitor") {
            return (
              <a
                key={`${monster.name}-${index}`}
                href={`/bestiaire/${monsterId}`}
                target="_blank"
                rel="noopener noreferrer"
                title={`Ouvrir la fiche publique de ${monster.name}`}
                className={cn(rowClass, "transition-colors hover:bg-elevated")}
              >
                {content}
              </a>
            );
          }
          return (
            <div key={`${monster.name}-${index}`} className={rowClass}>
              {content}
            </div>
          );
        })}
      </div>
      {combat.detail && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          {combat.detail}
        </p>
      )}
      {fiche && (
        <RushMonsterFicheModal
          slug={fiche.slug}
          name={fiche.name}
          onClose={() => setFiche(null)}
        />
      )}
    </div>
  );
}

/** Donjon au choix — chaque donjon proposé, avec son visuel et son boss. */
function RushDungeonChoiceCard({
  dungeons,
  note,
  label,
  icon,
}: {
  dungeons: RushDungeonChoiceDungeon[];
  note?: string;
  label: string;
  icon: string;
}) {
  return (
    <div className="rounded-[4px] border border-border bg-surface p-2">
      <div className="flex items-center gap-1.5">
        <GameIcon src={icon} className="h-4 w-4" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
        {dungeons.map((dungeon, index) => (
          <div
            key={`${dungeon.name}-${index}`}
            className="flex items-center gap-2 rounded-[4px] border border-border/60 bg-elevated/40 px-1.5 py-1"
          >
            <RushPortrait src={dungeon.imageUrl} alt={dungeon.name} className="h-8 w-8" />
            <span className="min-w-0">
              <span className="block truncate text-[12px] text-foreground">{dungeon.name}</span>
              {(dungeon.bossName || dungeon.level !== undefined) && (
                <span className="block truncate text-[10px] text-muted-foreground">
                  {dungeon.bossName ?? ""}
                  {dungeon.level !== undefined
                    ? `${dungeon.bossName ? " · " : ""}Niv. ${dungeon.level}`
                    : ""}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
      {note && <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{note}</p>}
    </div>
  );
}

/** Espèces à combattre (`bashMobs`) — des noms, pas des quantités. */
function RushBashMobsCard({
  mobs,
  label,
  icon,
  viewer = "preview",
}: {
  mobs: RushBashMob[];
  label: string;
  icon: string;
  viewer?: RushTagViewer;
}) {
  const [fiche, setFiche] = useState<{ slug: string; name: string } | null>(null);
  const chipClass =
    "inline-flex items-center gap-1 rounded-full border border-border bg-elevated px-1.5 py-0.5 text-[11px] text-foreground";
  return (
    <div className="rounded-[4px] border border-border bg-surface p-2">
      <div className="flex items-center gap-1.5">
        <GameIcon src={icon} className="h-4 w-4" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {mobs.map((mob, index) => {
          const monsterId = monsterIdFromImageUrl(mob.imageUrl);
          const content = (
            <>
              <RushPortrait src={mob.imageUrl} alt={mob.name} className="h-4 w-4 rounded-full" />
              {mob.name}
              {mob.level !== undefined ? ` · ${mob.level}` : ""}
            </>
          );
          // Même règle que les combats : fiche interne pour un membre, lien public
          // pour un visiteur, aucune navigation en aperçu God.
          if (monsterId && viewer === "member") {
            return (
              <button
                key={`${mob.name}-${index}`}
                type="button"
                onClick={() => setFiche({ slug: String(monsterId), name: mob.name })}
                title={`Ouvrir la fiche de ${mob.name}`}
                aria-label={`Ouvrir la fiche de ${mob.name}`}
                className={cn(chipClass, "transition-colors hover:border-border-strong hover:text-foreground")}
              >
                {content}
              </button>
            );
          }
          if (monsterId && viewer === "visitor") {
            return (
              <a
                key={`${mob.name}-${index}`}
                href={`/bestiaire/${monsterId}`}
                target="_blank"
                rel="noopener noreferrer"
                title={`Ouvrir la fiche publique de ${mob.name}`}
                className={cn(chipClass, "transition-colors hover:border-border-strong hover:text-foreground")}
              >
                {content}
              </a>
            );
          }
          return (
            <span key={`${mob.name}-${index}`} className={chipClass}>
              {content}
            </span>
          );
        })}
      </div>
      {fiche && (
        <RushMonsterFicheModal
          slug={fiche.slug}
          name={fiche.name}
          onClose={() => setFiche(null)}
        />
      )}
    </div>
  );
}

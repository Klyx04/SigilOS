"use client";

import React, { useState } from "react";
import { DoorOpen, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DungeonInfo } from "./overlay-utils";
import { isPublicOverlay } from "./overlay-utils";
import { dungeonFicheHref } from "@/lib/dungeon-fiche";
import {
  dungeonKeyOf,
  occurrenceState,
  type RushDungeonMemberState,
  type RushDungeonState,
  type RushDungeonStateMap,
} from "@/lib/rush-dungeons";

interface RushOverlayDungeonCardProps {
  dungeons: DungeonInfo[];
  guildId?: string;
  /** Conservé pour les appelants : l'apparence suit les jetons de thème. */
  isLightMode?: boolean;
  className?: string;
}

/**
 * **Donjons d'une quête** — liste propre, avec les deux coches (`Fait` / `À faire`).
 *
 * 🎯 Demande user (21/10/2026) : « au clic sur l'icône donjon, la mini modale reste
 * ouverte (avec une croix de fermeture) avec une 2ᵉ coche à côté de chaque donjon :
 * fait / à faire ». La coche est **par occurrence** (quête × donjon) : ce composant ne
 * rend donc QUE les donjons de la quête qu'on lui passe (`sequenceId`).
 *
 * Destination du lien, déduite de `guildId` par la règle partagée `isPublicOverlay` :
 *   · **public** → `/boss/<slug|id>` (fiche publique, hors guilde) ;
 *   · **interne** → `/dashboard/<guildId>/succes?dungeon=<slug|id>&view=boss` (fiche boss
 *     du module).
 *
 * La donnée de jeu porte l'immersion (vignette officielle du boss + nom du donjon) ; le
 * panneau, lui, reste neutre : surface `--surface`, un filet, un rayon de 4 px.
 */
interface RushOverlayDungeonCardProps {
  dungeons: DungeonInfo[];
  guildId?: string;
  /** Conservé pour les appelants : l'apparence suit les jetons de thème. */
  isLightMode?: boolean;
  className?: string;
  /** Masque le titre « Donjons requis » quand le panneau parent porte déjà le sien. */
  hideHeader?: boolean;
  /** Quête concernée : indispensable pour lire/écrire l'état **par occurrence**. */
  sequenceId?: string;
  /** États de ce joueur (`sequenceId::dungeonKey`). */
  states?: RushDungeonStateMap;
  /** Occurrence en cours d'écriture. */
  busyKey?: string | null;
  /** Membres qui ont marqué « à faire » (même périmètre de guilde). */
  others?: RushDungeonMemberState[];
  /** Sans ce callback, la carte reste en lecture seule (fiche détail, public sans état). */
  onSet?: (dungeonKey: string, state: RushDungeonState | null) => void;
}

/** Un bouton d'état, style commun aux deux valeurs. */
function StateButton({
  active,
  tone,
  label,
  ariaLabel,
  disabled,
  onClick,
}: {
  active: boolean;
  tone: "emerald" | "amber";
  label: string;
  ariaLabel: string;
  disabled: boolean;
  onClick: () => void;
}) {
  const activeCls =
    tone === "emerald"
      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
      : "border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400";
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onClick}
      className={
        active
          ? `rounded-lg border px-2 py-1 text-[10px] font-semibold ${activeCls}`
          : "rounded-lg border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground"
      }
    >
      {label}
    </button>
  );
}

export function RushOverlayDungeonCard({
  dungeons,
  guildId,
  className,
  hideHeader = false,
  sequenceId,
  states,
  busyKey = null,
  others = [],
  onSet,
}: RushOverlayDungeonCardProps) {
  if (dungeons.length === 0) return null;
  const isPublic = isPublicOverlay(guildId);

  // « à faire » : par OCCURRENCE (le même donjon dans une autre quête ne compte pas).
  const todoByKey = new Map<string, string[]>();
  for (const row of others) {
    if (row.state !== "todo" || row.sequenceId !== sequenceId) continue;
    const name = row.pseudoDofus || row.userName || "Membre";
    const list = todoByKey.get(row.dungeonKey) ?? [];
    if (!list.includes(name)) list.push(name);
    todoByKey.set(row.dungeonKey, list);
  }

  return (
    <div className={cn("rounded-[4px] border border-border bg-surface p-2.5", className)}>
      {!hideHeader && (
        <p className="text-[11px] font-semibold text-muted-foreground">
          {dungeons.length > 1 ? "Donjons requis" : "Donjon requis"}
        </p>
      )}

      <div className={cn("space-y-0.5", !hideHeader && "mt-1.5")}>
        {dungeons.map((dj, i) => {
          // Destination unique (cf. `dungeonFicheHref`) : slug public si la
          // donnée de jeu le porte, sinon identifiant.
          const href = dungeonFicheHref(isPublic ? "public" : guildId, dj);
          const key = sequenceId ? dungeonKeyOf(dj) : null;
          const state = key && sequenceId ? occurrenceState(states, sequenceId, key) : null;
          return (
            <DungeonRow
              key={key ?? `dj-${i}`}
              dj={dj}
              href={href}
              isPublic={isPublic}
              state={state}
              busy={!!key && busyKey === `${sequenceId}::${key}`}
              todo={key ? todoByKey.get(key) ?? [] : []}
              onSet={onSet && key ? (next) => onSet(key, next) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}


function DungeonRow({
  dj,
  href,
  isPublic,
  state,
  busy,
  todo,
  onSet,
}: {
  dj: DungeonInfo;
  href: string | null;
  isPublic: boolean;
  state: RushDungeonState | null;
  busy: boolean;
  todo: string[];
  onSet?: (state: RushDungeonState | null) => void;
}) {
  const [imgError, setImgError] = useState(false);
  const rawName = dj?.name || "Donjon";
  const bossDisplayName = dj?.bossName || rawName.replace(/^Donjon (du |de la |de l'|de |des )/i, "");
  const inner = (
    <>
      <span className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[4px] border border-border bg-elevated">
        {dj.imageUrl && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dj.imageUrl}
            alt={bossDisplayName}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <DoorOpen className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        )}
        {dj.isOcre && (
          <span className="absolute -top-px -right-px rounded-[3px] border border-warning/40 bg-warning/15 px-1 text-[9px] font-semibold leading-4 text-warning">
            Ocre
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[13px] font-semibold text-foreground">
          {bossDisplayName}
          {dj.isOptional ? (
            <span className="ml-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              optionnel
            </span>
          ) : null}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {dj.name || "Donjon"}
          {todo.length > 0 ? ` · à faire : ${todo.join(", ")}` : ""}
        </span>
      </span>
      <ExternalLink
        className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
        aria-hidden="true"
      />
    </>
  );
  return (
    <div className="flex items-center gap-2 rounded-[4px] px-2 py-1.5 transition-colors hover:bg-elevated">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={isPublic ? `Voir la fiche publique de ${bossDisplayName}` : `Ouvrir la fiche boss de ${bossDisplayName}`}
          className="group flex min-w-0 flex-1 items-center gap-2.5"
        >
          {inner}
        </a>
      ) : (
        <div className="group flex min-w-0 flex-1 items-center gap-2.5">{inner}</div>
      )}

      {/* Les DEUX états : « fait » débloque la quête, « à faire » dit aux autres
          qu'on compte le faire. Aucune case binaire : l'absence = pas décidé. */}
      {onSet && (
        <div className="flex shrink-0 items-center gap-1">
          <StateButton
            active={state === "done"}
            tone="emerald"
            label="Fait"
            ariaLabel={`Marquer ${bossDisplayName} comme fait dans cette quête`}
            disabled={busy}
            onClick={() => onSet(state === "done" ? null : "done")}
          />
          <StateButton
            active={state === "todo"}
            tone="amber"
            label="À faire"
            ariaLabel={`Marquer ${bossDisplayName} comme à faire dans cette quête`}
            disabled={busy}
            onClick={() => onSet(state === "todo" ? null : "todo")}
          />
        </div>
      )}
    </div>
  );
}



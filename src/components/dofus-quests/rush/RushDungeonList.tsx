"use client";

/**
 * Liste des donjons d'un guide — **présentation pure** (aucun import serveur).
 *
 * ⚠️ La coche est **par occurrence** : le même donjon peut apparaître dans plusieurs
 * quêtes, et chaque quête a SON état. On affiche donc, sous chaque donjon, la liste de
 * ses **endroits** avec deux boutons par endroit (`Fait` / `À faire`), plus les membres
 * qui ont marqué « à faire » pour cet endroit précis.
 */

import { useMemo } from "react";
import type { RushDungeonEntryView, RushDungeonState } from "@/lib/rush-dungeons";
import { dungeonOccurrenceKey } from "@/lib/rush-dungeons";

export type RushDungeonMemberState = {
  sequenceId: string;
  dungeonKey: string;
  state: "done" | "todo";
  profileId: string;
  userName: string;
  pseudoDofus: string | null;
};

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

export function RushDungeonList({
  entries,
  others,
  busyKey,
  onSet,
}: {
  entries: RushDungeonEntryView[];
  others: RushDungeonMemberState[];
  /** Clé d'occurrence en cours d'écriture (`sequenceId::dungeonKey`). */
  busyKey: string | null;
  onSet: (sequenceId: string, dungeonKey: string, state: RushDungeonState | null) => void;
}) {
  const todoByOccurrence = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const row of others) {
      if (row.state !== "todo") continue;
      const key = dungeonOccurrenceKey(row.sequenceId, row.dungeonKey);
      const name = row.pseudoDofus || row.userName || "Membre";
      const list = map.get(key) ?? [];
      if (!list.includes(name)) list.push(name);
      map.set(key, list);
    }
    return map;
  }, [others]);

  if (entries.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">Aucun donjon dans ce guide.</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {entries.map((entry) => (
        <li key={entry.key} className="py-2">
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="truncate text-xs font-semibold text-foreground">{entry.name}</p>
            <p className="text-[10px] text-muted-foreground">
              {entry.places} endroit{entry.places > 1 ? "s" : ""}
              {entry.requiredPlaces < entry.places
                ? ` · ${entry.places - entry.requiredPlaces} optionnel${entry.places - entry.requiredPlaces > 1 ? "s" : ""}`
                : ""}
              {entry.isOcre ? " · Ocre" : ""}
              {` · ${entry.donePlaces}/${entry.places} fait${entry.donePlaces > 1 ? "s" : ""}`}
            </p>
          </div>

          <ul className="mt-1 space-y-1 pl-2">
            {entry.occurrences.map((occurrence) => {
              const occurrenceKey = dungeonOccurrenceKey(occurrence.sequenceId, entry.key);
              const busy = busyKey === occurrenceKey;
              const todo = todoByOccurrence.get(occurrenceKey) ?? [];
              return (
                <li
                  key={occurrenceKey}
                  className="flex flex-wrap items-center gap-2 rounded-lg px-1 py-0.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] text-foreground">
                      {occurrence.sequenceName}
                      {occurrence.isOptional ? (
                        <span className="ml-1 text-[9px] uppercase tracking-wide text-muted-foreground">
                          optionnel
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {occurrence.milestoneTitle}
                      {todo.length > 0 ? ` · à faire : ${todo.join(", ")}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <StateButton
                      active={occurrence.state === "done"}
                      tone="emerald"
                      label="Fait"
                      ariaLabel={`Marquer ${entry.name} comme fait dans ${occurrence.sequenceName}`}
                      disabled={busy}
                      onClick={() =>
                        onSet(
                          occurrence.sequenceId,
                          entry.key,
                          occurrence.state === "done" ? null : "done"
                        )
                      }
                    />
                    <StateButton
                      active={occurrence.state === "todo"}
                      tone="amber"
                      label="À faire"
                      ariaLabel={`Marquer ${entry.name} comme à faire dans ${occurrence.sequenceName}`}
                      disabled={busy}
                      onClick={() =>
                        onSet(
                          occurrence.sequenceId,
                          entry.key,
                          occurrence.state === "todo" ? null : "todo"
                        )
                      }
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}

"use client";

import React, { useState } from "react";
import { Check, DoorOpen, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DungeonInfo } from "./overlay-utils";
import { isPublicOverlay } from "./overlay-utils";
import { dungeonFicheHref } from "@/lib/dungeon-fiche";
import { ocreDungeonCapture, type OcreDungeonCaptureState } from "@/lib/ocre-dungeons";
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
  /** Donjon à mettre en avant (celui qu'on vient de cliquer dans la ligne de quête). */
  highlightKey?: string | null;
  /**
   * V-H — noms des monstres déjà capturés (Metamob). Absents ou vides ⇒ état `unknown` :
   * on n'affiche jamais « à capturer » sans preuve (compte non lié).
   */
  capturedOcreNames?: readonly string[];
  /** V-H — ouvre la fenêtre Ocre ; sans callback, le badge reste informatif. */
  onOpenOcre?: () => void;
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
  // Actif = **aplat** (on lit l'état d'un coup d'œil dans une petite fenêtre de jeu),
  // inactif = contour discret. Deux teintes sémantiques seulement : vert = fait,
  // ambre = à faire.
  const activeCls =
    tone === "emerald"
      ? "border-emerald-500 bg-emerald-500 text-white"
      : "border-amber-500 bg-amber-500 text-black";
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "rounded-md border px-2 py-1 text-[10px] font-bold transition-colors disabled:opacity-50",
        active
          ? activeCls
          : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground"
      )}
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
  highlightKey = null,
  capturedOcreNames,
  onOpenOcre,
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
              highlighted={!!key && key === highlightKey}
              onSet={onSet && key ? (next) => onSet(key, next) : undefined}
              ocreState={dj.isOcre ? ocreDungeonCapture(dj, capturedOcreNames) : null}
              onOpenOcre={onOpenOcre}
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
  highlighted = false,
  onSet,
  ocreState = null,
  onOpenOcre,
}: {
  dj: DungeonInfo;
  href: string | null;
  isPublic: boolean;
  state: RushDungeonState | null;
  busy: boolean;
  todo: string[];
  onSet?: (state: RushDungeonState | null) => void;
  /** Cible d'une ouverture depuis la ligne de quête : anneau + mise en vue. */
  highlighted?: boolean;
  /** V-H — état Metamob du donjon ocre (`null` = pas un donjon ocre). */
  ocreState?: OcreDungeonCaptureState | null;
  /** V-H — ouvre la fenêtre Ocre (le bouton n'est rendu que si l'état est connu). */
  onOpenOcre?: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const rowRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!highlighted) return;
    // `block: "nearest"` : on ne fait pas sauter la fenêtre de jeu, on amène juste la
    // ligne dans le champ (le panneau peut être plus haut que le viewport du PiP).
    rowRef.current?.scrollIntoView({ block: "nearest" });
  }, [highlighted]);
  const rawName = dj?.name || "Donjon";
  const bossDisplayName = dj?.bossName || rawName.replace(/^Donjon (du |de la |de l'|de |des )/i, "");
  const inner = (
    <>
      <span
        className={cn(
          "relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[5px] border bg-elevated",
          // Le liseré dit l'état sans lire le texte : vert = fait, ambre = à faire.
          state === "done"
            ? "border-emerald-500/70"
            : state === "todo"
              ? "border-amber-500/70"
              : "border-border"
        )}
      >
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
          <span
            className={cn(
              "absolute -top-px -right-px rounded-[3px] border px-1 text-[9px] font-semibold leading-4",
              ocreState === "captured"
                ? "border-success/40 bg-success/15 text-success"
                : "border-warning/40 bg-warning/15 text-warning"
            )}
          >
            Ocre{ocreState === "captured" ? " ✓" : ocreState === "to-capture" ? " !" : ""}
          </span>
        )}
        {state === "done" && (
          <span className="absolute right-0 bottom-0 grid h-3.5 w-3.5 place-items-center rounded-tl-[4px] bg-emerald-500 text-white">
            <Check className="h-2.5 w-2.5 stroke-[3]" aria-hidden="true" />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[13px] font-semibold text-foreground">
          {bossDisplayName}
          {dj.isOptional ? (
            <span className="ml-1 rounded-[3px] border border-border px-1 align-middle text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              optionnel
            </span>
          ) : null}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {dj.name || "Donjon"}
          {todo.length > 0 ? ` · à faire : ${todo.join(", ")}` : ""}
          {ocreState === "captured"
            ? " · Ocre : capturé"
            : ocreState === "to-capture"
              ? " · Ocre : à capturer"
              : ""}
        </span>
      </span>
      <ExternalLink
        className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
        aria-hidden="true"
      />
    </>
  );
  return (
    <div
      ref={rowRef}
      className={cn(
        "flex items-center gap-2 rounded-[5px] px-2 py-2 transition-colors",
        state === "done" ? "bg-emerald-500/5" : "hover:bg-elevated",
        highlighted && "ring-2 ring-danger/50"
      )}
    >
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

      {/* V-H — le donjon ocre ouvre la fenêtre Ocre (Metamob). L'état est déjà dit
          dans la sous-ligne ; ce bouton compact ne porte que l'action, avec un
          `aria-label` complet (la fenêtre PiP n'a pas de place pour un libellé long). */}
      {ocreState && onOpenOcre ? (
        <button
          type="button"
          onClick={onOpenOcre}
          aria-label={
            ocreState === "captured"
              ? `Quête Ocre : ${bossDisplayName} déjà capturé — ouvrir le suivi`
              : ocreState === "to-capture"
                ? `Quête Ocre : ${bossDisplayName} à capturer — ouvrir le suivi`
                : "Quête Ocre : ouvrir le suivi Metamob"
          }
          title={
            ocreState === "captured"
              ? `${bossDisplayName} est déjà capturé — ouvrir la Quête Ocre`
              : ocreState === "to-capture"
                ? `${bossDisplayName} reste à capturer — ouvrir la Quête Ocre`
                : "Ouvrir la Quête Ocre (compte Metamob non lié ou données indisponibles)"
          }
          className={cn(
            "grid h-6 w-6 shrink-0 place-items-center rounded-[4px] border transition-colors",
            ocreState === "captured"
              ? "border-success/40 bg-success/10 text-success hover:bg-success/15"
              : ocreState === "to-capture"
                ? "border-warning/40 bg-warning/10 text-warning hover:bg-warning/15"
                : "border-border bg-surface text-muted-foreground hover:bg-elevated hover:text-foreground"
          )}
        >
          {/* L'asset du jeu porte l'identité Ocre ; la couleur du cadre et le badge
              de la vignette disent l'état. Icône seule : la PiP n'a pas de largeur. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/icons/ocre.png"
            alt=""
            className="h-3 w-3 object-contain"
            aria-hidden="true"
          />
        </button>
      ) : null}

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



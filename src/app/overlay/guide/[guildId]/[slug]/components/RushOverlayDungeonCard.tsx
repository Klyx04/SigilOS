"use client";

import React, { useState } from "react";
import { Check, DoorOpen, ExternalLink, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { DungeonStateButton } from "@/components/dofus-quests/rush/DungeonStateButton";
import { canOpenDungeonAchievements } from "@/lib/rush-dungeon-achievements";
import type { DungeonInfo } from "./overlay-utils";
import { isPublicOverlay } from "./overlay-utils";
import { dungeonFicheHref } from "@/lib/dungeon-fiche";
import { ocreDungeonCapture, type OcreDungeonCaptureState } from "@/lib/ocre-dungeons";
import {
  dungeonDisplayState,
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
  /**
   * `stacked` : nom sur toute la largeur, actions (Ocre, succès, Fait / À faire)
   * sur une 2ᵉ ligne. Obligatoire dans la modale donjon de l'overlay (22 rem) :
   * en `inline`, le nom du boss était tronqué à « Me… » par les quatre boutons.
   */
  layout?: "inline" | "stacked";
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
  /**
   * Bloc I — ouvre les succès du donjon. Sans callback (ou donjon optionnel / non
   * résolu), le bouton `+` n'est pas rendu : aucune écriture sans cible réelle.
   */
  onOpenAchievements?: (dungeonKey: string, dungeon: DungeonInfo) => void;
}

// Les deux boutons d'état vivent dans le composant partagé `DungeonStateButton`
// (même rendu dans la carte et dans le panneau des succès).

export function RushOverlayDungeonCard({
  dungeons,
  guildId,
  className,
  hideHeader = false,
  layout = "inline",
  sequenceId,
  states,
  busyKey = null,
  others = [],
  onSet,
  highlightKey = null,
  capturedOcreNames,
  onOpenOcre,
  onOpenAchievements,
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
          const displayState = dungeonDisplayState(state);
          // Groupe « au choix » : un seul donjon du groupe suffit (règle de
          // `rush-dungeons`). L'en-tête est posé AVANT la première alternative.
          const previousGroup = i > 0 ? dungeons[i - 1]?.choiceGroup ?? null : null;
          const startsChoiceGroup = !!dj.choiceGroup && dj.choiceGroup !== previousGroup;
          return (
            <React.Fragment key={key ?? `dj-${i}`}>
              {startsChoiceGroup && (
                <p className="px-2 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {dj.choiceLabel || "Au choix"} — un seul suffit
                </p>
              )}
              <DungeonRow
                dj={dj}
                href={href}
                isPublic={isPublic}
                layout={layout}
                state={state}
                displayState={displayState}
                busy={!!key && busyKey === `${sequenceId}::${key}`}
                todo={key ? todoByKey.get(key) ?? [] : []}
                highlighted={!!key && key === highlightKey}
                onSet={onSet && key ? (next) => onSet(key, next) : undefined}
                ocreState={dj.isOcre ? ocreDungeonCapture(dj, capturedOcreNames) : null}
                onOpenOcre={onOpenOcre}
                onOpenAchievements={
                  onOpenAchievements && key && canOpenDungeonAchievements(dj)
                    ? () => onOpenAchievements(key, dj)
                    : undefined
                }
              />
            </React.Fragment>
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
  layout = "inline",
  state,
  displayState,
  busy,
  todo,
  highlighted = false,
  onSet,
  ocreState = null,
  onOpenOcre,
  onOpenAchievements,
}: {
  dj: DungeonInfo;
  href: string | null;
  isPublic: boolean;
  layout?: "inline" | "stacked";
  state: RushDungeonState | null;
  displayState: RushDungeonState;
  busy: boolean;
  todo: string[];
  onSet?: (state: RushDungeonState | null) => void;
  /** Cible d'une ouverture depuis la ligne de quête : anneau + mise en vue. */
  highlighted?: boolean;
  /** V-H — état Metamob du donjon ocre (`null` = pas un donjon ocre). */
  ocreState?: OcreDungeonCaptureState | null;
  /** V-H — ouvre la fenêtre Ocre (le bouton n'est rendu que si l'état est connu). */
  onOpenOcre?: () => void;
  /** Bloc I — ouvre le panneau des succès (rendu seulement pour un donjon requis/résolu). */
  onOpenAchievements?: () => void;
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
          // Le liseré dit l'état sans lire le texte : vert = fait, ambre = à faire
          // (l'absence de décision s'affiche « à faire » par défaut).
          displayState === "done"
            ? "border-emerald-500/70"
            : "border-amber-500/70"
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
        {displayState === "done" && (
          <span className="absolute right-0 bottom-0 grid h-3.5 w-3.5 place-items-center rounded-tl-[4px] bg-emerald-500 text-white">
            <Check className="h-2.5 w-2.5 stroke-[3]" aria-hidden="true" />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span
          className={cn(
            "block text-[13px] font-semibold text-foreground",
            layout === "stacked" ? "line-clamp-2" : "truncate"
          )}
        >
          {bossDisplayName}
          {dj.isOptional ? (
            <span className="ml-1 rounded-[3px] border border-border px-1 align-middle text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              optionnel
            </span>
          ) : null}
        </span>
        <span
          className={cn(
            "block text-[11px] text-muted-foreground",
            layout === "stacked" ? "line-clamp-2" : "truncate"
          )}
        >
          {dj.name || "Donjon"}
          {todo.length > 0 ? ` · à faire : ${todo.join(", ")}` : ""}
        </span>
        {ocreState ? (
          <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            {/* L'asset Ocre du jeu, posé dans la ligne — plus de pastille collée sur la
                vignette du boss (retour user du 11/11/2026 : « l'encart Ocre est laid »). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/icons/ocre.png"
              alt=""
              aria-hidden="true"
              loading="lazy"
              className="h-3 w-3 shrink-0 object-contain"
            />
            {ocreState === "captured"
              ? "Ocre : capturé"
              : ocreState === "to-capture"
                ? "Ocre : à capturer"
                : "Ocre"}
          </span>
        ) : null}
      </span>
      <ExternalLink
        className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
        aria-hidden="true"
      />
    </>
  );
  const actions = (
    <>
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

      {/* Bloc I — les succès du donjon (requis + résolu uniquement). Icône d'action
          compacte : la PiP n'a pas de largeur pour un libellé. */}
      {onOpenAchievements ? (
        <button
          type="button"
          onClick={onOpenAchievements}
          aria-label={`Voir les succès de ${bossDisplayName}`}
          title="Voir les succès du donjon"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-[4px] border border-border bg-surface text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : null}

      {/* Les DEUX états : « fait » débloque la quête, « à faire » dit aux autres
          qu'on compte le faire. L'absence s'affiche « À faire » mais n'écrit qu'au
          premier clic (le verrou ne lit que les états `done`). */}
      {onSet && (
        <div className={cn("flex shrink-0 items-center gap-1", layout === "stacked" && "ml-auto")}>
          <DungeonStateButton
            active={displayState === "done"}
            tone="emerald"
            label="Fait"
            ariaLabel={`Marquer ${bossDisplayName} comme fait dans cette quête`}
            disabled={busy}
            onClick={() => onSet(state === "done" ? null : "done")}
          />
          <DungeonStateButton
            active={displayState === "todo"}
            tone="amber"
            label="À faire"
            ariaLabel={`Marquer ${bossDisplayName} comme à faire dans cette quête`}
            disabled={busy}
            onClick={() => onSet(state === "todo" ? null : "todo")}
          />
        </div>
      )}
    </>
  );

  const openable = href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={isPublic ? `Voir la fiche publique de ${bossDisplayName}` : `Ouvrir la fiche boss de ${bossDisplayName}`}
      className={cn(
        "group flex min-w-0 flex-1 gap-2.5",
        layout === "stacked" ? "items-start" : "items-center"
      )}
    >
      {inner}
    </a>
  ) : (
    <div
      className={cn(
        "group flex min-w-0 flex-1 gap-2.5",
        layout === "stacked" ? "items-start" : "items-center"
      )}
    >
      {inner}
    </div>
  );

  if (layout === "stacked") {
    return (
      <div
        ref={rowRef}
        className={cn(
          "rounded-[5px] px-2 py-2 transition-colors",
          displayState === "done" ? "bg-emerald-500/5" : "hover:bg-elevated",
          highlighted && "ring-2 ring-danger/50"
        )}
      >
        {openable}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-[3.25rem]">{actions}</div>
      </div>
    );
  }

  return (
    <div
      ref={rowRef}
      className={cn(
        "flex items-center gap-2 rounded-[5px] px-2 py-2 transition-colors",
        displayState === "done" ? "bg-emerald-500/5" : "hover:bg-elevated",
        highlighted && "ring-2 ring-danger/50"
      )}
    >
      {openable}
      {actions}
    </div>
  );
}



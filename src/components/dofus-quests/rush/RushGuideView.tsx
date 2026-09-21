"use client";

/**
 * RushGuideView — LA vue du guide, partagée par les deux surfaces.
 *
 * · variant "public" : visiteur NON connecté → AUCUNE présence communautaire,
 *   AUCUN plein écran, aucun compte requis. La progression vient du localStorage.
 * · variant "guild" : même vue, PLUS le bloc `presence` (campement) que la
 *   surface guilde fournit — le plein écran reste géré par la surface interne
 *   (`body.guide-fullscreen`), jamais par cette vue.
 *
 * Ce que cette vue réutilise du module : `buildRushGuideView` (modèle calculé à
 * partir des blocs/dépendances poussés au GOD) et `RushCoordinateChip` (déjà
 * thème-aware, copie `/w x,y`). Ce qu'elle ne réutilise PAS, volontairement :
 * les procédés dark-locked (dégradé doré + `animate-pulse`, ex. l'encart
 * « À FAIRE MAINTENANT » retiré de l'overlay le 21/09/2026) — l'audit a retiré
 * ces procédés, la vue garde le registre : filet 1px, rayon court, zéro ombre,
 * zéro dégradé, aucune animation infinie.
 */

import React from "react";
import {
  Check,
  Lock,
  RotateCcw,
} from "lucide-react";
import type {
  RushGuideView as RushGuideModel,
  RushStepView,
} from "@/lib/rush-guide-view";
import { alignmentCrest } from "@/lib/rush-guide-view";
import { RUSH_ACTIVITY_TAG_CONFIG, getMetierIconPath } from "@/lib/rush-guide-utils";
import { RushCoordinateChip } from "./RushCoordinateChip";
import { cn } from "@/lib/utils";
// ⚠️ Pas d'import CSS ici : la feuille est injectée par `globals.css` (une seule
// requête pour toutes les classes du registre) — un chunk CSS par composant peut
// arriver en retard et laisser la vue à l'état brut.

export type RushGuideVariant = "public" | "guild";

export interface RushGuideViewProps {
  view: RushGuideModel;
  variant?: RushGuideVariant;
  /** Persistance : chaque surface fournit la sienne (localStorage / serveur). */
  onValidateStep?: (seqId: string) => void;
  /**
   * Remise à zéro de TOUTE la progression. Optionnel : la vue ne sait pas où la
   * progression est écrite, elle demande confirmation puis délègue — une surface
   * qui n'a pas de reset à offrir n'affiche simplement pas le bouton.
   */
  onResetProgress?: () => void;
  /** Présence (campement). Rendue UNIQUEMENT en variant "guild". */
  presence?: React.ReactNode;
  className?: string;
}

const fr = (n: number) => n.toLocaleString("fr-FR");

/** Libellé + icône d'un tag du GOD (référentiel partagé du module). */
function tagLabel(type: string, name?: string | null): string {
  return RUSH_ACTIVITY_TAG_CONFIG[type]?.label || name || type.replace(/_/g, " ");
}

function StepMeta({ step }: { step: RushStepView }) {
  const natures = step.nature.slice(0, 4);
  if (!natures.length && !step.coord && !step.dungeons.length) return null;
  return (
    <ul className="rgv-meta">
      {step.coord && (
        <li>
          <RushCoordinateChip coordText={step.coord.raw} showIcon />
        </li>
      )}
      {natures.map((t) => (
        <li key={t.type}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="rgv-icon"
            src={
              // Un métier arrive nommé (« Bijoutier ») : son picto propre prime
              // sur le picto générique « professions » du référentiel.
              t.type === "metier"
                ? getMetierIconPath(t.name)
                : RUSH_ACTIVITY_TAG_CONFIG[t.type]?.imagePath || "/assets/icons/dofusdb.png"
            }
            alt=""
            width={16}
            height={16}
          />
          <span>{tagLabel(t.type, t.name)}</span>
        </li>
      ))}
      {step.dungeons.map((d, i) => (
        <li key={`${d.name || "donjon"}-${i}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {/* Picto de donjon du référentiel : `/assets/nav/boss.png` est un masque
              blanc, invisible en thème clair — même enjeu que les Dofus nus. */}
          <img
            className="rgv-icon"
            src={RUSH_ACTIVITY_TAG_CONFIG.donjon.imagePath}
            alt=""
            width={16}
            height={16}
          />
          <span>{d.name || d.bossName || "Donjon"}</span>
        </li>
      ))}
    </ul>
  );
}

function ActiveStep({
  step,
  total,
  done,
  onValidateStep,
}: {
  step: RushStepView;
  total: number;
  done: number;
  onValidateStep?: (seqId: string) => void;
}) {
  return (
    <div className="rgv-step">
      <p className="rgv-eyebrow">
        Étape active · <span className="rgv-mono">{done + 1}</span> sur{" "}
        <span className="rgv-mono">{total}</span>
      </p>

      <div className="rgv-step-title">
        <h3>{step.title}</h3>
        {step.isOptional && <span className="rgv-note">Étape optionnelle</span>}
      </div>

      <StepMeta step={step} />

      {step.blockedBy.length === 0 && step.prereqs.length > 0 && (
        <p className="rgv-dep">
          <Lock aria-hidden="true" /> Après{" "}
          {step.prereqs.map((p, i) => (
            <React.Fragment key={p.seqId}>
              {i > 0 && " · "}
              <b>« {p.name} »</b>
            </React.Fragment>
          ))}
        </p>
      )}

      {step.tips && (
        <details className="rgv-tip">
          <summary>Afficher l&apos;indice</summary>
          <p>{step.tips}</p>
        </details>
      )}

      <div className="rgv-actions">
        {onValidateStep && (
          <button
            type="button"
            className="rgv-btn rgv-btn-primary"
            onClick={() => onValidateStep(step.id)}
          >
            <Check aria-hidden="true" /> Valider l&apos;étape
          </button>
        )}
        {step.travelCommand && (
          <RushCoordinateChip coordText={step.travelCommand} showIcon />
        )}
      </div>
    </div>
  );
}

/**
 * Remise à zéro : une action DESTRUCTIVE, donc en deux temps. Le premier clic
 * demande, le second efface — jamais d'aller simple. L'état de confirmation vit
 * ici : la vue n'écrit rien, elle appelle la surface qui sait persister.
 */
function ResetProgress({ onReset }: { onReset: () => void }) {
  const [confirming, setConfirming] = React.useState(false);

  if (!confirming) {
    return (
      <button type="button" className="rgv-btn" onClick={() => setConfirming(true)}>
        <RotateCcw aria-hidden="true" /> Réinitialiser la progression
      </button>
    );
  }

  return (
    <span className="rgv-actions">
      <span className="rgv-note">Effacer toute la progression enregistrée ?</span>
      <button
        type="button"
        className="rgv-btn"
        onClick={() => {
          setConfirming(false);
          onReset();
        }}
      >
        Oui, tout effacer
      </button>
      <button type="button" className="rgv-btn" onClick={() => setConfirming(false)}>
        Annuler
      </button>
    </span>
  );
}

export function RushGuideView({
  view,
  variant = "public",
  onValidateStep,
  onResetProgress,
  presence,
  className,
}: RushGuideViewProps) {
  const isGuild = variant === "guild";

  return (
    <div className={cn("rgv", className)}>
      {/* 1 ── l'expédition : des compteurs, pas un bandeau de capitales */}
      <section className="rgv-head" aria-labelledby="rgv-head-title">
        <p className="rgv-eyebrow">
          {view.active
            ? `Chapitre ${view.active.chapter} · ${view.active.chapterLabel}`
            : "Expédition en cours"}
        </p>
        <h2 id="rgv-head-title">{view.active?.blockTitle || "Guide Rush Sylvestre"}</h2>
        <ul className="rgv-tally">
          <li>
            <b className="rgv-mono">{fr(view.counters.doneSteps)}</b> étapes franchies
          </li>
          <li>
            <b className="rgv-mono">{fr(view.counters.remainingSteps)}</b> à découvrir
          </li>
          <li>
            <b className="rgv-mono">{fr(view.counters.totalBlocks)}</b> blocs de route
          </li>
        </ul>
        <div
          className="rgv-progress"
          role="progressbar"
          aria-valuenow={view.counters.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progression : ${view.counters.label}`}
        >
          <span style={{ width: `${view.counters.percent}%` }} />
        </div>
        <p className="rgv-note rgv-mono">
          {view.counters.label} · {fr(view.counters.percent)} %
        </p>

        {/* Ce que le guide a DÉJÀ donné (alignement) et la sortie de secours
            (remise à zéro) : deux états du joueur, pas deux décorations. */}
        <div className="rgv-state">
          <p
            className="rgv-align"
            title={
              view.alignment
                ? `Donné par « ${view.alignment.stepTitle} » — ${view.alignment.chapterLabel}`
                : "Aucune quête d'alignement du guide n'est encore validée."
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="rgv-icon"
              src={view.alignment?.crestSrc ?? alignmentCrest(null)}
              alt=""
              width={16}
              height={16}
            />
            {view.alignment ? (
              <span>
                Alignement <b>{view.alignment.label}</b>
                {view.alignment.level > 0 && (
                  <>
                    {" · "}
                    tranche <span className="rgv-mono">{view.alignment.level}</span>
                  </>
                )}
              </span>
            ) : (
              <span>
                Alignement <b>neutre</b> — aucune quête d&apos;alignement validée
              </span>
            )}
          </p>
          {onResetProgress && <ResetProgress onReset={onResetProgress} />}
        </div>
      </section>

      {/* 2 ── une seule action */}
      <section className="rgv-sec" aria-labelledby="rgv-now">
        <div className="rgv-sec-head">
          <div>
            <p className="rgv-eyebrow">Votre fil conducteur</p>
            <h2 id="rgv-now">À faire maintenant</h2>
          </div>
          <span className="rgv-note">Une seule action. Le reste attend.</span>
        </div>
        {view.active ? (
          <ActiveStep
            step={view.active}
            total={view.counters.totalSteps}
            done={view.counters.doneSteps}
            onValidateStep={onValidateStep}
          />
        ) : (
          <p className="rgv-empty">
            {view.counters.totalSteps === 0
              ? "Guide en cours de rédaction — aucune étape publiée pour l'instant."
              : "Guide terminé — plus rien à faire ici."}
          </p>
        )}
      </section>

      {/* Présence communautaire : JAMAIS en variante publique. */}
      {isGuild && presence ? (
        <section className="rgv-sec rgv-presence" aria-label="Campement">
          {presence}
        </section>
      ) : null}
    </div>
  );
}

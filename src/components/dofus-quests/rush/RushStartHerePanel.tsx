"use client";

import Link from "next/link";
import { ArrowRight, Flag, Shield, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RushStartState } from "@/lib/rush-onboarding";

/**
 * **Prendre le joueur par la main** sans reproposer un tour guidé.
 *
 * Demande user du 25/11/2026 : après l'accueil, un collègue ne savait pas qu'il
 * devait choisir un personnage, ni comment démarrer ; l'alignement restait une
 * énigme. Cette carte est **persistante** (elle ne dépend pas du drapeau du tour) :
 *
 *  ① sans personnage → bouton « Choisir mon personnage » (les coches sont bloquées) ;
 *  ② avec personnage, sans cité → « Choisis ta cité quand tu veux » (jamais bloquant) ;
 *  ③ prêt → « Commence ici » avec la prochaine quête (masquable pour la session).
 */
export function RushStartHerePanel({
  state,
  characterName,
  nextStep,
  onPickCharacter,
  onPickAlignment,
  onDismissAlignment,
  onDismissNext,
  profileHref,
  locale = "fr",
  className,
}: {
  state: RushStartState;
  characterName?: string | null;
  nextStep?: { title: string; blockTitle?: string | null; onGo: () => void } | null;
  onPickCharacter: () => void;
  onPickAlignment: () => void;
  /** « Plus tard » : l'alignement est optionnel, on ne le force jamais. */
  onDismissAlignment?: () => void;
  /** Le guide « prêt » peut être masqué explicitement. */
  onDismissNext?: () => void;
  profileHref?: string | null;
  locale?: "fr" | "en";
  className?: string;
}) {
  const en = locale === "en";

  if (state.needsCharacter) {
    return (
      <section
        role="region"
        aria-label={en ? "Start here" : "Pour commencer"}
        className={cn(
          "relative flex flex-col gap-3 rounded-[6px] border border-accent/45 bg-accent/[0.07] px-4 py-3.5 sm:flex-row sm:items-center",
          className,
        )}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[6px] border border-accent/40 bg-accent/10 text-accent">
          <UserRound className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
            {en ? "Start here" : "Pour commencer"}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">
            {en ? "Pick your character" : "Choisis ton personnage"}
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            {en
              ? "Progress is saved for this browser and belongs to that character. Quest ticking stays blocked until you pick one."
              : "La progression est enregistrée pour ce navigateur et appartient à ce personnage. Les coches restent bloquées tant que tu n'en as pas choisi un."}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {profileHref ? (
            <Link
              href={profileHref}
              className="rounded-[4px] px-2 py-1.5 text-[11px] font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
            >
              {en ? "Create a visitor profile" : "Créer mon profil visiteur"}
            </Link>
          ) : null}
          <button
            type="button"
            onClick={onPickCharacter}
            className="inline-flex items-center gap-1.5 rounded-[4px] border border-accent/60 bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/25 focus-visible:outline-2 focus-visible:outline-accent/60"
          >
            {en ? "Pick my character" : "Choisir mon personnage"}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </section>
    );
  }

  if (state.needsAlignment) {
    return (
      <section
        role="region"
        aria-label={en ? "Optional next step" : "Étape suivante optionnelle"}
        className={cn(
          "flex flex-col gap-3 rounded-[6px] border border-border bg-surface px-4 py-3 sm:flex-row sm:items-center",
          className,
        )}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[6px] border border-border bg-elevated text-muted-foreground">
          <Shield className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {en ? "Next step · optional" : "Étape suivante · optionnelle"}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">
            {en ? "Pick your city whenever you want" : "Choisis ta cité quand tu veux"}
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            {en
              ? "You can read the whole guide without it. Some alignment quests will ask for it later — pick it then, or now."
              : "Tu peux lire tout le guide sans. Certaines quêtes d'alignement te le demanderont plus tard — choisis-le maintenant ou à ce moment-là."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
          {onDismissAlignment ? (
            <button
              type="button"
              onClick={onDismissAlignment}
              className="rounded-[4px] px-2 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {en ? "Later" : "Plus tard"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onPickAlignment}
            className="inline-flex items-center gap-1.5 rounded-[4px] border border-border bg-elevated px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-foreground/20 hover:bg-muted"
          >
            {en ? "Pick my city" : "Choisir ma cité"}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </section>
    );
  }

  if (!nextStep) return null;

  return (
    <section
      role="region"
      aria-label={en ? "Start here" : "Commence ici"}
      className={cn(
        "relative flex flex-col gap-3 rounded-[6px] border border-success/35 bg-success/[0.06] px-4 py-3 sm:flex-row sm:items-center",
        className,
      )}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[6px] border border-success/40 bg-success/10 text-success">
        <Flag className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-success">
          {en ? "Start here" : "Commence ici"}
        </p>
        <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
          {nextStep.blockTitle ? `${nextStep.blockTitle} · ` : ""}
          {nextStep.title}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {characterName
            ? en
              ? `Next step for ${characterName}.`
              : `Prochaine étape pour ${characterName}.`
            : en
              ? "Your next step in the guide."
              : "Ta prochaine étape dans le guide."}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
        <button
          type="button"
          onClick={nextStep.onGo}
          className="inline-flex items-center gap-1.5 rounded-[4px] border border-success/50 bg-success/15 px-3 py-1.5 text-xs font-semibold text-success transition-colors hover:bg-success/25"
        >
          {en ? "Go to this quest" : "Aller à cette quête"}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        {onDismissNext ? (
          <button
            type="button"
            onClick={onDismissNext}
            aria-label={en ? "Hide this card" : "Masquer cette carte"}
            title={en ? "Hide this card" : "Masquer cette carte"}
            className="rounded-[4px] p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </section>
  );
}

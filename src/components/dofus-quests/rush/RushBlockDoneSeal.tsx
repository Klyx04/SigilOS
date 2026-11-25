"use client";

import { CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sceau « Bloc validé » — le repère visuel d'un bloc entièrement terminé.
 *
 * Demande user du 25/11/2026 : un bloc validé ne doit pas s'éteindre (l'ancien
 * `opacity-80` grisait le titre) mais se **sceller** — bord gauche vert, panneau
 * légèrement teinté et ce sceau dans l'en-tête. Même composant sur les trois
 * surfaces (public, dashboard, overlay) pour que « terminé » se lise pareil.
 */
export function RushBlockDoneSeal({
  label = "Bloc validé",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span className={cn("rush-block-done-seal", className)} role="img" aria-label={label}>
      <CheckCheck aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

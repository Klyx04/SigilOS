"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { useDaRail } from "./use-da-rail";

/**
 * Fil de sève — enveloppe une liste d'étapes et mesure la longueur du fil.
 *
 * Chaque liste a **son** fil : le guide public rend les quêtes en panneaux, et un
 * fil unique posé au-dessus d'eux passerait *derrière* leur fond opaque. Un rail
 * par liste est donc le seul montage qui rende le tracé visible ; la règle de
 * mesure, elle, reste unique (`useDaRail`).
 *
 * Les enfants doivent porter `data-state` (`done` / `next` / `todo` / `locked`).
 */
export function DaRail({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  // Pas de dépendance : le `ResizeObserver` du hook suffit (il remesure dès que
  // la liste change de hauteur — filtre, repli, redimensionnement).
  const railRef = useDaRail([]);

  return (
    <div ref={railRef} className={cn("da-rail", className)}>
      {children}
    </div>
  );
}

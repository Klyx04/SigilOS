"use client";

/**
 * Dépli sobre du guide Rush (G8, 12/11/2026).
 *
 * 🎯 Mesure avant : les blocs s'ouvraient avec `framer-motion` en animant
 * `height: 0 → auto` — une mesure JS à chaque image, et un saut quand le contenu
 * change de hauteur. Ici, la hauteur est portée par `grid-template-rows`
 * (`0fr → 1fr`) : le navigateur interpole, sans mesure et sans dépendance.
 *
 * O15 — `motion-reduce:transition-none` coupe l'animation pour qui demande moins
 * de mouvement ; le contenu s'ouvre et se ferme quand même.
 *
 * `inert` retire le contenu fermé du clavier et des lecteurs d'écran : sans lui,
 * un bouton caché resterait focusable.
 */
import type { ReactNode } from "react";

export function RushCollapse({
  open,
  children,
  className = "",
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      } ${className}`}
      aria-hidden={!open}
      inert={!open}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

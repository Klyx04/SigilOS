"use client";

import React from "react";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

/** Membre affiché en bulle (avatar + pseudo) — `avatar` absent ⇒ initiale du pseudo. */
export type OverlayBubbleMember = { name: string; avatar?: string };

interface RushOverlayMemberBubblesProps {
  /** Membres ayant posé leur repère. **Vide ⇒ rien n'est rendu** (jamais une bulle vide). */
  members: OverlayBubbleMember[];
  /** Ouvre la mini-modale listant les membres (liste défilante, cf. `RushOverlayMembersModal`). */
  onOpen: () => void;
  /** Nombre de bulles empilées avant le compteur. */
  max?: number;
  /** `sm` = ligne de quête · `md` = vue de jeu (l'overlay compact se lit de loin). */
  size?: "sm" | "md";
  className?: string;
}

/**
 * Rangée de bulles « qui est ici » — **source unique** des deux surfaces de l'overlay
 * (liste des quêtes **et** mode compact/vue de jeu).
 *
 * Le pseudo n'est jamais écrit dans la bulle : 4 caractères dans 5 cm de fenêtre ne se
 * lisent pas. Il part dans le `title` (survol) et dans la mini-modale (clic), qui est la
 * seule surface où le nom a la place de s'afficher en entier.
 */
export function RushOverlayMemberBubbles({
  members,
  onOpen,
  max = 3,
  size = "sm",
  className,
}: RushOverlayMemberBubblesProps) {
  if (members.length === 0) return null;

  const bubble = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const names = members.map((m) => m.name).join(", ");

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      title={`En attente ici : ${names}`}
      aria-label={`Voir les membres ici (${members.length}) : ${names}`}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-[3px] border border-warning/40 bg-warning/[0.06] px-1.5 py-0.5 text-[11px] font-semibold text-warning transition-colors hover:bg-warning/15",
        className
      )}
    >
      <span className="flex items-center -space-x-1">
        {members.slice(0, max).map((m, i) =>
          m.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${m.name}-${i}`}
              src={m.avatar}
              alt={m.name}
              loading="lazy"
              className={cn(bubble, "rounded-full border border-warning/40 object-cover")}
            />
          ) : (
            <span
              key={`${m.name}-${i}`}
              className={cn(
                bubble,
                "grid place-items-center rounded-full border border-warning/40 bg-warning/20 text-[9px] font-semibold text-warning"
              )}
            >
              {(m.name || "?").charAt(0).toUpperCase()}
            </span>
          )
        )}
      </span>
      <Users className="h-3 w-3" aria-hidden="true" />
      <span className="tabular-nums">{members.length}</span>
    </button>
  );
}

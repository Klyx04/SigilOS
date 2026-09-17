"use client";

import React, { useEffect } from "react";
import { Users, X } from "lucide-react";

export type OverlayMember = { name: string; avatar?: string; subtitle?: string };

interface RushOverlayMembersModalProps {
  title: string;
  members: OverlayMember[];
  /** Conservé pour les appelants : l'apparence suit les jetons de thème. */
  isLightMode: boolean;
  onClose: () => void;
}

/**
 * Modale liste de membres (présence / « je suis ici » / « qui peut aider »).
 * Même grammaire que les autres modales du rush : rayon 6 px, filets, jetons de
 * thème — l'overlay pose `.light` sur sa racine en thème clair.
 */
export function RushOverlayMembersModal({ title, members, onClose }: RushOverlayMembersModalProps) {
  // Échap ferme la modale : même comportement que les autres modales du rush.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-3">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div className="relative z-10 flex max-h-[70vh] w-full max-w-[21rem] flex-col overflow-hidden rounded-[6px] border border-border-strong bg-elevated">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-accent" aria-hidden="true" />
            <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
            <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
              {members.length}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-[4px] p-1.5 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {members.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-muted-foreground">
              Personne ici pour l'instant.
            </p>
          ) : (
            members.map((m, i) => (
              <div
                key={`${m.name}-${i}`}
                className="flex items-center gap-2.5 rounded-[4px] border border-border bg-surface px-2.5 py-2"
              >
                {m.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.avatar}
                    alt={m.name}
                    className="h-8 w-8 shrink-0 rounded-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-accent/40 bg-accent/15 text-[12px] font-semibold text-accent">
                    {(m.name || "?").charAt(0)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-foreground">{m.name}</p>
                  {m.subtitle && (
                    <p className="truncate text-[11px] text-muted-foreground">{m.subtitle}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

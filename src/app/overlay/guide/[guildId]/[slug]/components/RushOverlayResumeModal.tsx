"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDaTheme } from "@/components/da/da-theme";
import { ChevronRight, Flag, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RushResumeChoice } from "@/lib/rush-resume";

export type { RushResumeChoice };

/**
 * Mini-modale « Reprendre où ? » — ouverte par le bouton **Reprendre** quand le
 * joueur a posé **plusieurs** repères « je suis ici » dans des blocs différents
 * (demande user du 26/11/2026). Avec un seul repère, le saut est direct ; sans
 * repère, la règle pure `findRushResumeTarget` choisit la prochaine quête.
 *
 * Portail dans le document du **nœud** (`ownerDocument`) : dans la fenêtre PiP,
 * `document` désigne la page hôte — la modale sortirait de l'overlay. Même règle
 * que `RushOverlayPrereqModal` / `RushOverlayDungeonPopover`.
 */
export function RushOverlayResumeModal({
  choices,
  onGoTo,
  onClose,
}: {
  choices: RushResumeChoice[];
  onGoTo: (choice: RushResumeChoice) => void;
  onClose: () => void;
}) {
  const da = useDaTheme();
  const theme = da?.theme ?? "dark";
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [doc, setDoc] = useState<Document | null>(null);

  useEffect(() => {
    const owner = anchorRef.current?.ownerDocument ?? (typeof document !== "undefined" ? document : null);
    setDoc(owner);
  }, []);

  useEffect(() => {
    const win = doc?.defaultView ?? (typeof window !== "undefined" ? window : null);
    if (!win) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    win.addEventListener("keydown", onKey);
    return () => win.removeEventListener("keydown", onKey);
  }, [doc, onClose]);

  return (
    <>
      <span ref={anchorRef} className="hidden" aria-hidden="true" />
      {doc &&
        createPortal(
          <div
            className={cn(
              "rush-carnet-theme fixed inset-0 z-[999998] flex items-center justify-center bg-black/60 p-3",
              theme === "light" && "light"
            )}
            data-theme={theme}
            onClick={onClose}
            role="presentation"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Choisir où reprendre"
              onClick={(e) => e.stopPropagation()}
              className="rush-carnet w-full max-w-[330px] overflow-hidden rounded-[6px] border border-border-strong bg-elevated"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border-strong px-2.5 py-2">
                <p className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-foreground">
                  <Flag className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
                  Reprendre où ?
                  <span className="font-normal text-muted-foreground">
                    · {choices.length} repères
                  </span>
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fermer"
                  className="rounded-[3px] p-0.5 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
              <ul className="max-h-[260px] space-y-0.5 overflow-y-auto p-1">
                {choices.map((choice) => (
                  <li key={`${choice.milestoneId}::${choice.seqId}`}>
                    <button
                      type="button"
                      onClick={() => onGoTo(choice)}
                      aria-label={`Reprendre ${choice.name} — ${choice.blockTitle}`}
                      className="flex w-full items-center gap-2 rounded-[4px] px-1.5 py-1.5 text-left transition-colors hover:bg-surface"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/assets/icons/icone-quete.png"
                        alt=""
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0 object-contain"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-semibold text-foreground">
                          {choice.name}
                        </span>
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {choice.blockTitle}
                        </span>
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>,
          doc.body
        )}
    </>
  );
}

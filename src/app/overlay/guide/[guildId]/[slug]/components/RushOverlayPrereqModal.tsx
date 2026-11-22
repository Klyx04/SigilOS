"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDaTheme } from "@/components/da/da-theme";
import { Check, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RushPrereqRef } from "@/lib/rush-guide-utils";

/**
 * Mini-modale « quête(s) à terminer avant ».
 *
 * 🎯 Retour user (22/10/2026) : « si on a plusieurs prérequis en quête on va empiler
 * plusieurs blocs rouges de quête c est moche et trop » -> **un seul encadré** cliquable
 * dans la ligne, qui ouvre cette liste.
 *
 * 🎯 Retour user (22/11/2026) : « on ne distingue pas les quêtes validées si plusieurs
 * quêtes sont demandées ». Chaque ligne porte donc son état : **Validée** (coche verte,
 * texte barré, en bas de liste) ou **À faire** (horloge, en haut). Le compteur du titre
 * dit combien sont déjà faites.
 *
 * ⚠️ Portail dans le document du **nœud** (`ownerDocument`) : dans la fenêtre PiP, la
 * variable globale `document` désigne la page hôte — la modale sortirait de l overlay.
 * Même règle que `RushOverlayDungeonPopover`.
 */
export function RushOverlayPrereqModal({
  prereqs,
  isDone,
  onGoTo,
  onClose,
}: {
  prereqs: RushPrereqRef[];
  /** État réel d une quête prérequis (validée ou non). Absent : aucun état affiché. */
  isDone?: (seqId: string) => boolean;
  onGoTo: (seqId: string, milestoneId: string) => void;
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

  const go = useCallback(
    (p: RushPrereqRef) => {
      onClose();
      onGoTo(p.seqId, p.milestoneId);
    },
    [onClose, onGoTo]
  );

  const done = (p: RushPrereqRef) => !!isDone?.(p.seqId);
  const doneCount = prereqs.filter(done).length;
  // Les quêtes à faire d abord (ce sont elles qui débloquent), les validées en bas.
  const ordered = [...prereqs].sort((a, b) => Number(done(a)) - Number(done(b)));

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
              aria-label="Quêtes à terminer avant"
              onClick={(e) => e.stopPropagation()}
              className="rush-carnet w-full max-w-[300px] overflow-hidden rounded-[6px] border border-danger/40 bg-elevated"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border-strong px-2.5 py-2">
                <p className="text-[11px] font-semibold text-danger">
                  {prereqs.length > 1 ? `${prereqs.length} quêtes à terminer avant` : "Quête à terminer avant"}
                  {doneCount > 0 && (
                    <span className="ml-1 font-medium text-success">
                      · {doneCount} validée{doneCount > 1 ? "s" : ""}
                    </span>
                  )}
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
              <ul className="max-h-[240px] space-y-0.5 overflow-y-auto p-1">
                {ordered.map((p) => {
                  const ok = done(p);
                  return (
                    <li key={p.seqId}>
                      <button
                        type="button"
                        onClick={() => go(p)}
                        title={`Aller à : ${p.name}`}
                        className={cn(
                          "flex w-full items-center gap-1.5 rounded-[4px] px-1.5 py-1.5 text-left text-[11px] font-medium transition-colors hover:bg-surface",
                          ok ? "text-muted-foreground" : "text-foreground"
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/assets/icons/icone-quete.png"
                          alt=""
                          aria-hidden="true"
                          className="h-3.5 w-3.5 shrink-0 object-contain"
                        />
                        <span className={cn("min-w-0 flex-1 truncate", ok && "line-through")}>{p.name}</span>
                        {ok ? (
                          <span className="flex shrink-0 items-center gap-0.5 text-[10px] font-semibold text-success">
                            <Check className="h-3 w-3" aria-hidden="true" /> Validée
                          </span>
                        ) : (
                          <span className="flex shrink-0 items-center gap-0.5 text-[10px] font-semibold text-warning">
                            <Clock className="h-3 w-3" aria-hidden="true" /> À faire
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>,
          doc.body
        )}
    </>
  );
}
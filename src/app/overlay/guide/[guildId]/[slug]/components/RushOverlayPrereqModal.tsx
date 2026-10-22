"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { RushPrereqRef } from "@/lib/rush-guide-utils";

/**
 * Mini-modale « quête(s) à terminer avant ».
 *
 * 🎯 Retour user (22/10/2026) : « si on a plusieurs prérequis en quête on va empiler
 * plusieurs blocs rouges de quête c'est moche et trop » → **un seul encadré** cliquable
 * dans la ligne, qui ouvre cette liste. Chaque quête est cliquable (icône de quête + nom)
 * et emmène à son bloc (`onGoTo`).
 *
 * ⚠️ Portail dans le document du **nœud** (`ownerDocument`) : dans la fenêtre PiP, la
 * variable globale `document` désigne la page hôte — la modale sortirait de l'overlay.
 * Même règle que `RushOverlayDungeonPopover`.
 */
export function RushOverlayPrereqModal({
  prereqs,
  onGoTo,
  onClose,
}: {
  prereqs: RushPrereqRef[];
  onGoTo: (seqId: string, milestoneId: string) => void;
  onClose: () => void;
}) {
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

  return (
    <>
      <span ref={anchorRef} className="hidden" aria-hidden="true" />
      {doc &&
        createPortal(
          <div
            className="fixed inset-0 z-[999998] flex items-center justify-center bg-black/60 p-3"
            onClick={onClose}
            role="presentation"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Quêtes à terminer avant"
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[280px] overflow-hidden rounded-lg border border-danger/40 bg-[#0d1014] shadow-2xl"
            >
              <div className="flex items-center justify-between gap-2 border-b border-white/10 px-2.5 py-2">
                <p className="text-[11px] font-semibold text-danger">
                  {prereqs.length > 1 ? `${prereqs.length} quêtes à terminer avant` : "Quête à terminer avant"}
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fermer"
                  className="rounded-[3px] p-0.5 text-[#929aa5] transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
              <ul className="max-h-[220px] space-y-0.5 overflow-y-auto p-1">
                {prereqs.map((p) => (
                  <li key={p.seqId}>
                    <button
                      type="button"
                      onClick={() => go(p)}
                      title={`Aller à : ${p.name}`}
                      className="flex w-full items-center gap-1.5 rounded-[4px] px-1.5 py-1.5 text-left text-[11px] font-medium text-[#f2f0e9] transition-colors hover:bg-white/5"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/assets/icons/icone-quete.png"
                        alt=""
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0 object-contain"
                      />
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
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

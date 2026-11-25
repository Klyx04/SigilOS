"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Info, X } from "lucide-react";
import { useDaTheme } from "@/components/da/da-theme";
import { brandIconForUrl } from "@/lib/source-icons";
import { cn } from "@/lib/utils";

/**
 * Mini-modale ouverte au clic d'une **quête** dans l'overlay.
 *
 * Choix explicites : fiche DofusPourLesNoobs, fiche DofusDB, ou détails complets.
 * Un lien **vide côté God n'est pas rendu** (jamais de bouton mort). Le portail vit
 * dans le document du nœud (`ownerDocument`) pour rester dans la fenêtre PiP.
 */
export function RushOverlayQuestLinksModal({
  name,
  noobsUrl,
  dbUrl,
  onOpenDetail,
  onClose,
}: {
  name: string;
  noobsUrl: string | null;
  dbUrl: string | null;
  onOpenDetail: () => void;
  onClose: () => void;
}) {
  const da = useDaTheme();
  const theme = da?.theme ?? "dark";
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [doc, setDoc] = useState<Document | null>(null);

  useEffect(() => {
    const owner =
      anchorRef.current?.ownerDocument ??
      (typeof document !== "undefined" ? document : null);
    setDoc(owner);
  }, []);

  useEffect(() => {
    const win = doc?.defaultView ?? (typeof window !== "undefined" ? window : null);
    if (!win) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    win.addEventListener("keydown", onKey);
    return () => win.removeEventListener("keydown", onKey);
  }, [doc, onClose]);

  const linkClass =
    "flex w-full items-center gap-2 rounded-[4px] border border-border bg-surface px-2.5 py-2 text-left text-[12px] font-semibold text-foreground transition-colors hover:border-border-strong hover:bg-elevated";
  const iconClass = "h-4 w-4 shrink-0 rounded-[3px] object-contain";
  const noobsIcon = brandIconForUrl(noobsUrl);
  const dbIcon = brandIconForUrl(dbUrl);

  return (
    <>
      <span ref={anchorRef} className="hidden" aria-hidden="true" />
      {doc &&
        createPortal(
          <div
            className={cn(
              "rush-carnet-theme fixed inset-0 z-[999998] flex items-center justify-center bg-black/60 p-3",
              theme === "light" && "light",
            )}
            data-theme={theme}
            onClick={onClose}
            role="presentation"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Liens de la quête ${name}`}
              onClick={(event) => event.stopPropagation()}
              className="rush-carnet w-full max-w-[320px] overflow-hidden rounded-[6px] border border-border-strong bg-elevated"
            >
              <header className="flex items-center justify-between gap-2 border-b border-border-strong px-2.5 py-2">
                <p className="min-w-0 truncate text-[11px] font-semibold text-foreground">{name}</p>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fermer"
                  className="-mr-1 shrink-0 rounded-[4px] p-1 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </header>

              <div className="space-y-1.5 p-2">
                {noobsUrl && (
                  <a
                    href={noobsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={onClose}
                    className={linkClass}
                  >
                    {noobsIcon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={noobsIcon.src} alt="" className={iconClass} loading="lazy" />
                    ) : (
                      <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    )}
                    DofusPourLesNoobs
                  </a>
                )}
                {dbUrl && (
                  <a
                    href={dbUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={onClose}
                    className={linkClass}
                  >
                    {dbIcon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={dbIcon.src} alt="" className={iconClass} loading="lazy" />
                    ) : (
                      <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    )}
                    DofusDB
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenDetail();
                  }}
                  className={linkClass}
                >
                  <Info className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  Détails de la quête
                </button>
              </div>
            </div>
          </div>,
          doc.body,
        )}
    </>
  );
}

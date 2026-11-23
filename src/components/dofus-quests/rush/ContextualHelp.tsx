"use client";

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";
import { placeContextualHelp, type HelpPosition } from "@/lib/contextual-help-position";

const POPOVER_WIDTH = 320;

/**
 * Bulle d'aide du **guide navigateur** (jamais l'overlay, qui a son bouton).
 *
 * La bulle est portée dans le `body` en `position: fixed` : elle ne peut plus
 * sortir de l'écran ni être coupée par un parent `overflow: hidden`. Le
 * placement (haut/bas, clamp horizontal) vit dans la règle pure
 * `placeContextualHelp`, testée aux largeurs 390/768/1024/1440.
 *
 * Survol = aperçu ; clic = épingle (la bulle reste ouverte pendant la lecture) ;
 * Échap ou clic extérieur = fermeture.
 */
export function ContextualHelp({
  enabled,
  label,
  children,
  className,
}: {
  enabled: boolean;
  label: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState<HelpPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();

  const update = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(POPOVER_WIDTH, Math.max(0, window.innerWidth - 16));
    const height = popoverRef.current?.getBoundingClientRect().height ?? 0;
    setPosition(
      placeContextualHelp(
        { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width },
        { width: window.innerWidth, height: window.innerHeight },
        { width, height }
      )
    );
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setPinned(false);
      }
    };
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        setPinned(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    update();
  }, [open, update]);

  useEffect(() => {
    if (!open) return;
    const handleReflow = () => update();
    window.addEventListener("resize", handleReflow);
    window.addEventListener("scroll", handleReflow, true);
    return () => {
      window.removeEventListener("resize", handleReflow);
      window.removeEventListener("scroll", handleReflow, true);
    };
  }, [open, update]);

  if (!enabled) return null;

  // Guide navigateur uniquement (l'overlay a son propre bouton d'aide) : le
  // portail vit dans le document principal, jamais dans une PiP.
  const portalRoot = typeof document !== "undefined" ? document.body : null;

  return (
    <span className={cn("relative inline-flex", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setPinned((value) => !value);
          setOpen(true);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => {
          if (!pinned) setOpen(false);
        }}
        onFocus={() => setOpen(true)}
        onBlur={(event) => {
          if (!pinned && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
        }}
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-success/10 hover:text-success focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success/50"
      >
        <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open && portalRoot
        ? createPortal(
            <div
              ref={popoverRef}
              id={popoverId}
              role="tooltip"
              onMouseEnter={() => setOpen(true)}
              onMouseLeave={() => {
                if (!pinned) setOpen(false);
              }}
              style={{
                position: "fixed",
                top: position?.top ?? 0,
                left: position?.left ?? 0,
                width: position?.width ?? POPOVER_WIDTH,
                maxHeight: position?.maxHeight,
                visibility: position ? "visible" : "hidden",
              }}
              className="z-[var(--z-tooltip)] overflow-y-auto rounded-[4px] border border-border bg-background p-3 text-xs leading-relaxed text-foreground"
            >
              {children}
              {position ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute h-2 w-2 rotate-45 border-border bg-background",
                    position.placement === "top"
                      ? "top-full -mt-px border-b border-r"
                      : "bottom-full -mb-px border-l border-t"
                  )}
                  style={{ left: position.arrowLeft }}
                />
              ) : null}
            </div>,
            portalRoot
          )
        : null}
    </span>
  );
}

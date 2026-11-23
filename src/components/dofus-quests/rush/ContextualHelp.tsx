"use client";

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDaTheme } from "@/components/da/da-theme";
import { daScopeProps } from "@/lib/da-scope";
import {
  HELP_POPOVER_WIDTH,
  placeContextualHelp,
  type HelpPosition,
} from "@/lib/contextual-help-position";

/**
 * Bulle d'aide du **guide navigateur** (jamais l'overlay, qui a son bouton).
 *
 * La bulle est portée dans le `body` en `position: fixed` : elle ne peut plus
 * sortir de l'écran ni être coupée par un parent `overflow: hidden`. Le nœud
 * porté reprend la **portée DA** (`da-portal` + `daScopeProps`) : sans elle, il
 * retombait sur les jetons produit (fond clair sur le guide sombre).
 *
 * Survol = aperçu (avec 140 ms pour rejoindre la bulle) ; clic = épingle ;
 * Échap ou clic extérieur = fermeture. Le placement vit dans la règle pure
 * `placeContextualHelp`, testée aux largeurs 390/768/1024/1440.
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
  const closeTimer = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const popoverId = useId();
  const daScope = daScopeProps(useDaTheme());

  const cancelClose = useCallback(() => {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    if (pinned) return;
    cancelClose();
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      setOpen(false);
    }, 140);
  }, [pinned, cancelClose]);

  const update = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const width = Math.min(HELP_POPOVER_WIDTH, Math.max(0, viewportWidth - 16));
    const height = popoverRef.current?.getBoundingClientRect().height ?? 0;
    setPosition(
      placeContextualHelp(
        { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width },
        { width: viewportWidth, height: viewportHeight },
        { width, height }
      )
    );
  }, []);

  const scheduleUpdate = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      update();
    });
  }, [update]);

  useEffect(() => {
    if (!enabled) {
      setOpen(false);
      setPinned(false);
      setPosition(null);
      cancelClose();
    }
  }, [enabled, cancelClose]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setPinned(false);
        cancelClose();
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
        cancelClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, cancelClose]);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }
    update();
  }, [open, update]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);
    return () => {
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
    };
  }, [open, scheduleUpdate]);

  useEffect(
    () => () => {
      cancelClose();
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
    },
    [cancelClose]
  );

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
          cancelClose();
        }}
        onMouseEnter={() => {
          cancelClose();
          setOpen(true);
        }}
        onMouseLeave={scheduleClose}
        onFocus={() => {
          cancelClose();
          setOpen(true);
        }}
        onBlur={(event) => {
          if (!pinned && !event.currentTarget.contains(event.relatedTarget)) scheduleClose();
        }}
        aria-label={label}
        aria-describedby={open ? popoverId : undefined}
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
              {...daScope}
              onMouseEnter={() => {
                cancelClose();
                setOpen(true);
              }}
              onMouseLeave={scheduleClose}
              style={{
                ...(daScope as { style?: React.CSSProperties }).style,
                position: "fixed",
                top: position?.top ?? 0,
                left: position?.left ?? 0,
                width: position?.width ?? `min(${HELP_POPOVER_WIDTH}px, calc(100vw - 16px))`,
                visibility: position ? "visible" : "hidden",
              }}
              className="da-portal z-[var(--z-tooltip)] rounded-[4px] border border-border bg-background text-foreground"
            >
              <div
                className="overflow-y-auto p-3 text-xs leading-relaxed"
                style={{ maxHeight: position ? Math.max(0, position.maxHeight - 2) : undefined }}
              >
                {children}
              </div>
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

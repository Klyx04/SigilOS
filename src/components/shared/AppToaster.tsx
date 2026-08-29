"use client";

import { usePathname } from "next/navigation";
import { Toaster } from "sonner";

/**
 * Toaster global scopé par route.
 * - Sur /overlay/* : notifications compactes (petites, discrètes, en haut à droite)
 *   pour ne pas envahir la petite fenêtre de jeu.
 * - Ailleurs : comportement inchangé (gros toasts riches en bas à droite).
 */
export function AppToaster() {
  const pathname = usePathname();
  const isOverlay = (pathname ?? "").startsWith("/overlay/");

  if (isOverlay) {
    return (
      <Toaster
        position="top-right"
        expand={false}
        closeButton
        toastOptions={{
          className:
            "group font-sans !p-2 !pr-3 !rounded-lg !text-xs !w-auto max-w-[230px] border border-border/70 bg-popover/95 text-popover-foreground backdrop-blur-xl shadow-xl",
          style: { fontSize: "12px", minWidth: 0, width: "auto" },
          descriptionClassName: "text-[11px] !text-muted-foreground",
        }}
      />
    );
  }

  return (
    <Toaster
      position="bottom-right"
      richColors
      expand={false}
      closeButton
      toastOptions={{
        className: "group font-sans border border-border/50 bg-card/90 backdrop-blur-xl text-card-foreground rounded-2xl p-4 shadow-lg",
        descriptionClassName: "text-muted-foreground font-medium text-body-sm",
        style: {
          borderLeft: "3px solid var(--border-strong, rgba(255,255,255,0.1))",
        },
        actionButtonStyle: {
          background: "var(--foreground)",
          color: "var(--background)",
          fontWeight: "bold",
          borderRadius: "0.5rem",
        },
      }}
    />
  );
}

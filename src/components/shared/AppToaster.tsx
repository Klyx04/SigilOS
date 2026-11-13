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
        position="bottom-right"
        expand={false}
        closeButton={false}
        toastOptions={{
          className:
            "group font-sans !p-2 !px-3 !rounded-lg !text-xs !w-auto max-w-[240px] border border-white/10 bg-[#030712]/95 text-white backdrop-blur-xl shadow-2xl",
          style: { fontSize: "12px", minWidth: 0, width: "auto" },
          descriptionClassName: "text-[10px] !text-white/60",
        }}
      />
    );
  }

  return (
    <>
      {/* Bulles d'**activité de guilde** (chantier N, lot N-3) : **en haut à droite**, sous le
          profil, pour tout le monde. Elles ne doivent pas se mélanger aux toasts d'action du bas :
          d'où un Toaster **dédié** (`id`), alimenté uniquement via `toasterId` par `ActivityToaster`. */}
      <Toaster
        id="guild-activity"
        position="top-right"
        expand={false}
        closeButton
        toastOptions={{
          className:
            "group font-sans border border-success/25 bg-card/95 backdrop-blur-xl text-card-foreground rounded-xl p-3.5 shadow-lg",
          descriptionClassName: "text-muted-foreground font-medium text-body-sm",
          style: { borderLeft: "3px solid var(--success, rgba(52,211,153,0.6))" },
        }}
      />
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
    </>
  );
}

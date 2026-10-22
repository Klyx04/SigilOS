"use client";

import { createContext, useContext, type ReactNode } from "react";
import { Toaster, toast as sonnerToast } from "sonner";

/**
 * Notifications de l'**overlay** — rendues DANS la fenêtre de l'overlay.
 *
 * 📌 Mesure du 22/10/2026 (retour user, capture à l'appui) : « une erreur de synchro
 * s'affiche au clic et **en dehors de l'overlay** ». L'overlay est porté par
 * `createPortal(..., win.document.body)` (`RushOverlayHost`) : son React vit dans le
 * document du PiP, mais `toast()` de sonner rendait dans le `<Toaster />` du **document
 * hôte** (layout dashboard) — donc hors de la fenêtre.
 *
 * Solution : un Toaster **dédié** (`id`), monté dans le portail de l'overlay, et des
 * appels routés par `toasterId`. `useOverlayToast()` retourne le `toast` global quand il
 * n'y a pas de provider (dashboard, guide public) : un composant partagé reste correct
 * partout.
 */
export const OVERLAY_TOASTER_ID = "rush-overlay";

type ToastOptions = Parameters<typeof sonnerToast.success>[1];

export type OverlayToastApi = {
  success: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
  warning: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
};

const overlayToast: OverlayToastApi = {
  success: (m, o) => sonnerToast.success(m, { ...o, toasterId: OVERLAY_TOASTER_ID }),
  info: (m, o) => sonnerToast.info(m, { ...o, toasterId: OVERLAY_TOASTER_ID }),
  warning: (m, o) => sonnerToast.warning(m, { ...o, toasterId: OVERLAY_TOASTER_ID }),
  error: (m, o) => sonnerToast.error(m, { ...o, toasterId: OVERLAY_TOASTER_ID }),
};

const globalToast: OverlayToastApi = {
  success: (m, o) => sonnerToast.success(m, o),
  info: (m, o) => sonnerToast.info(m, o),
  warning: (m, o) => sonnerToast.warning(m, o),
  error: (m, o) => sonnerToast.error(m, o),
};

const OverlayToastCtx = createContext<OverlayToastApi | null>(null);

/** À poser **dans** le portail de l'overlay (document PiP). */
export function OverlayToastProvider({ children }: { children: ReactNode }) {
  return <OverlayToastCtx.Provider value={overlayToast}>{children}</OverlayToastCtx.Provider>;
}

/** Toaster de l'overlay — à rendre à côté de `OverlayToastProvider`, jamais hors du portail. */
export function OverlayToaster() {
  return (
    <Toaster
      id={OVERLAY_TOASTER_ID}
      position="bottom-center"
      expand={false}
      closeButton={false}
      visibleToasts={2}
      toastOptions={{
        className:
          "group font-sans border border-white/10 bg-[#030712]/95 text-white backdrop-blur-xl shadow-2xl",
        style: { fontSize: "12px", borderRadius: "6px", padding: "8px 10px", maxWidth: "300px" },
        descriptionClassName: "text-[10px] text-white/60",
      }}
    />
  );
}

/** `toast` adapté à la surface courante (overlay si le provider est là, global sinon). */
export function useOverlayToast(): OverlayToastApi {
  return useContext(OverlayToastCtx) ?? globalToast;
}

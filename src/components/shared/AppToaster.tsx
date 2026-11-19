"use client";

import { usePathname } from "next/navigation";
import { Toaster } from "sonner";

/**
 * Toaster global scopé par route.
 * - Sur /overlay/* : notifications compactes (petites, discrètes, en haut à droite)
 *   pour ne pas envahir la petite fenêtre de jeu.
 * - Ailleurs : même matière, en bas à droite.
 *
 * DA « Gouache Wakfu » (19/11/2026) : les toasts portaient encore `bg-card/90`,
 * `rounded-2xl`, `backdrop-blur-xl` et une ombre — trois interdits de la DA, et une
 * matière qui ne suivait ni `--da-panel` ni `--da-ink`. Les Toaster vivent maintenant
 * sous la portée `[data-da="wakfu"]` (les jetons héritent) et portent `.da-toaster`,
 * que `da-wakfu.css` style.
 */
export function AppToaster() {
  const pathname = usePathname();
  const isOverlay = (pathname ?? "").startsWith("/overlay/");

  if (isOverlay) {
    return (
      <div data-da="wakfu" data-theme="dark" className="contents">
        <Toaster
          className="da-toaster"
          position="bottom-right"
          expand={false}
          closeButton={false}
          toastOptions={{
            className: "da-toast",
            style: { fontSize: "12px", minWidth: 0, width: "auto" },
            descriptionClassName: "da-toast-desc",
          }}
        />
      </div>
    );
  }

  return (
    <div data-da="wakfu" data-theme="dark" className="contents">
      {/* Bulles d'**activité de guilde** (chantier N, lot N-3) : **en haut à droite**, sous le
          profil, pour tout le monde. Elles ne doivent pas se mélanger aux toasts d'action du bas :
          d'où un Toaster **dédié** (`id`), alimenté uniquement via `toasterId` par `ActivityToaster`. */}
      <Toaster
        id="guild-activity"
        className="da-toaster"
        position="top-right"
        expand={false}
        closeButton
        toastOptions={{
          className: "da-toast",
          descriptionClassName: "da-toast-desc",
        }}
      />
      <Toaster
        className="da-toaster"
        position="bottom-right"
        expand={false}
        closeButton
        toastOptions={{
          className: "da-toast",
          descriptionClassName: "da-toast-desc",
        }}
      />
    </div>
  );
}

"use client";

import { useCallback, useRef, useState } from "react";

type DocumentPip = {
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
};

/** Vrai si le navigateur expose Document Picture-in-Picture (Chrome/Edge/Opera 102+/Firefox 151+). */
export function isDocumentPipSupported(): boolean {
  return typeof window !== "undefined" && "documentPictureInPicture" in window;
}

/**
 * Prépare le document d'une fenêtre PiP : body sans marges/débordement + copie
 * des feuilles de style (Tailwind, fonts, CSS-in-JS) nécessaires au rendu.
 */
export function preparePipDocument(win: Window): Document {
  const doc = win.document as Document;
  if (doc.documentElement) {
    doc.title = "SigilOS — Overlay";
    doc.documentElement.style.height = "100%";
    doc.documentElement.style.margin = "0";
    doc.documentElement.style.padding = "0";
    doc.documentElement.style.overflow = "hidden";
    if (document.documentElement.className) {
      document.documentElement.classList.forEach((cls) => {
        doc.documentElement.classList.add(cls);
      });
    }
  }
  doc.body.style.height = "100%";
  doc.body.style.margin = "0";
  doc.body.style.padding = "0";
  doc.body.style.overflow = "hidden";
  // Thème réel de la page hôte : le guide doit suivre le mode clair/sombre.
  const isDark = !document.documentElement.classList.contains("light");
  doc.body.style.backgroundColor = isDark ? "#0b0c10" : "#f3f1e5";
  doc.body.style.color = isDark ? "#f4f4f5" : "#2a3123";

  // Document PiP = document `about:blank` : sans <base>, chaque URL relative
  // (`/assets/...`, `/uploads/...`, `/api/assets-dofus/...`) se résout contre
  // `about:blank` et l'image échoue. On ancre le document sur l'URL de l'hôte :
  // les vignettes Ocre (et tous les assets relatifs) se chargent comme dans la page.
  if (doc.head && !doc.querySelector("base")) {
    const base = doc.createElement("base");
    base.href = document.baseURI;
    doc.head.prepend(base);
  }

  // Copie des feuilles de style via <style>.
  // ⚠️ C'est un **instantané** : en dev, une modification de `da-wakfu.css`
  // n'atteint PAS une PiP déjà ouverte (HMR ne touche que la page hôte). Après
  // un changement de CSS de l'overlay, fermer puis rouvrir la PiP — sinon la
  // nouvelle structure JSX tourne avec l'ancienne feuille (en-tête/toolbar
  // empilés). En production le CSS est figé au build : aucun impact.
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const css = Array.from(sheet.cssRules)
        .map((r) => r.cssText)
        .join("\n");
      const style = doc.createElement("style");
      style.textContent = css;
      doc.head.appendChild(style);
    } catch {
      // stylesheet cross-origin — ignoré
    }
  }

  // Copie des balises <link rel="stylesheet"> (polices, CSS dist)
  document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    try {
      const cloned = doc.createElement("link");
      cloned.rel = "stylesheet";
      cloned.href = (link as HTMLLinkElement).href;
      doc.head.appendChild(cloned);
    } catch {}
  });

  return doc;
}

/** Ouvre une fenêtre PiP via `requestWindow` et la prépare. Retourne null si non supporté. */
export async function openPipWindow(options?: { width?: number; height?: number }): Promise<Window | null> {
  const pip = (window as unknown as { documentPictureInPicture?: DocumentPip }).documentPictureInPicture;
  if (!pip) {
    console.info("[SigilOS] Document PiP indisponible — ouverture en fenêtre simple.");
    return null;
  }
  let win: Window;
  try {
    win = await pip.requestWindow(options);
  } catch (error) {
    // Certains navigateurs exposent l'API mais refusent `requestWindow` : on rend
    // `null` pour que l'appelant bascule sur la popup de secours, au lieu de laisser
    // une promesse rejetée tuer le clic. Le log permet de diagnostiquer (DevTools).
    console.warn("[SigilOS] Document PiP refusé — fenêtre simple.", error);
    return null;
  }
  // La fenêtre PiP est OUVERTE : une erreur de préparation (styles, head) ne doit pas
  // la jeter et déclencher un fallback popup. On garde la PiP, quitte à ce qu'elle
  // soit moins habillée.
  try {
    preparePipDocument(win);
  } catch (error) {
    console.warn("[SigilOS] Préparation de la fenêtre PiP incomplète.", error);
  }
  return win;
}

/**
 * Ouvre une popup classique (fallback navigateur SANS Document PiP : Firefox/Safari)
 * et la prépare à recevoir l'overlay via createPortal.
 *
 * Contrairement à `window.open('/overlay/guide/...')`, on ne re-navigue pas la popup :
 * - on réutilise la session déjà authentifiée du dashboard (aucun re-check serveur),
 * - donc aucun rebond possible vers `/dashboard/{guildId}`,
 * - l'URL de la popup reste vierge (`about:blank`), pas celle du dashboard.
 */
export function openFallbackPopup(options?: { width?: number; height?: number }): Window | null {
  const win = window.open(
    "",
    "sigil-overlay",
    `width=${options?.width ?? 420},height=${options?.height ?? 700},resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no`
  );
  if (!win) return null;
  // Le document d'une popup vierge (about:blank) n'est pas toujours prêt :
  // on écrit un HTML minimal pour garantir un <head> et un <body>.
  try {
    const doc = win.document;
    if (!doc.body || !doc.head || doc.head.childElementCount === 0) {
      doc.open();
      doc.write("<!doctype html><html><head></head><body></body></html>");
      doc.close();
    }
  } catch {
    // popup bloquée / accès cross-origin : on laisse tomber la préparation.
  }
  preparePipDocument(win);
  return win;
}

/**
 * Cycle de vie d'une fenêtre Document PiP, ouverte (et rendue) depuis la page
 * du dashboard : la fenêtre PiP ne survit jamais à son opener, mais le dashboard
 * reste ouvert en arrière-plan, donc plus besoin de popup intermédiaire.
 */
export function useDocumentPip() {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const pipWindowRef = useRef<Window | null>(null);

  const openPip = useCallback(async (options?: { width?: number; height?: number }): Promise<Window | null> => {
    const win = await openPipWindow(options);
    if (!win) return null;
    win.addEventListener("pagehide", () => {
      pipWindowRef.current = null;
      setPipWindow(null);
    });
    pipWindowRef.current = win;
    setPipWindow(win);
    return win;
  }, []);

  const closePip = useCallback(() => {
    try {
      pipWindowRef.current?.close();
    } catch {}
    pipWindowRef.current = null;
    setPipWindow(null);
  }, []);

  return { pipWindow, openPip, closePip, isSupported: isDocumentPipSupported() };
}

/**
 * Copie robuste vers le presse-papier, compatible overlay (webview / PiP / iframe).
 *
 * Dans l'overlay Dofus, `navigator.clipboard.writeText` existe souvent mais sa
 * promesse est rejetée (Permissions Policy / fenêtre non focalisée) → le toast
 * « Copié » s'affichait alors que le presse-papier restait vide.
 *
 * Stratégie :
 * 1. API async `navigator.clipboard.writeText` (contexte sécurisé + permission).
 * 2. Sinon, repli `document.execCommand("copy")` via un <textarea> hors-écran :
 *    fonctionne dans la plupart des webviews / fenêtres PiP déclenchées par un
 *    geste utilisateur.
 *
 * @returns `true` si l'écriture a réellement abouti.
 */
export async function copyToClipboard(text: string, targetDoc?: Document): Promise<boolean> {
  const doc = targetDoc || (typeof document !== "undefined" ? document : null);
  const win = doc?.defaultView || (typeof window !== "undefined" ? window : null);

  // 1) API moderne sur la fenêtre active/ciblée (ou globale)
  const clip = win?.navigator?.clipboard || (typeof navigator !== "undefined" ? navigator.clipboard : null);
  if (clip?.writeText) {
    try {
      await clip.writeText(text);
      return true;
    } catch {
      // La permission a été refusée ou le PiP n'est pas le focus principal → repli
    }
  }

  // 2) Repli execCommand dans le document ciblé (PiP ou principal)
  if (doc?.body) {
    try {
      const ta = doc.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "0";
      ta.style.opacity = "0";
      doc.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = doc.execCommand("copy");
      doc.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  return false;
}

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
export async function copyToClipboard(text: string): Promise<boolean> {
  // 1) API moderne
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // La permission a été refusée → on tente le repli.
    }
  }

  // 2) Repli execCommand (webview / iframe non focalisée)
  if (typeof document !== "undefined") {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "0";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  return false;
}

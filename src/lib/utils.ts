import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getAppBaseUrl() {
  // 1. Env override (Best practice)
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;

  // 2. Auth URL fallback (often set in Vercel/VPS)
  if (process.env.NEXTAUTH_URL) {
    if (process.env.NEXTAUTH_URL.includes("beta.sigilos.fr")) return "https://beta.sigilos.fr";
    return process.env.NEXTAUTH_URL;
  }

  // 3. Default fallback (Prod)
  return "https://sigilos.fr";
}

/**
 * Formate un pseudo Dofus : 1ère lettre en majuscule, le reste en minuscule.
 * Si composé d'un tiret '-' ou d'un espace ' ', la 1ère lettre après est aussi en majuscule.
 * Exemple: HK-Cudy -> Hk-Cudy, le grand fou -> Le Grand Fou
 */
export function formatDofusPseudo(pseudo: string): string {
  if (!pseudo) return "";
  
  // On autorise : lettres (incluant accents), tirets, espaces et crochets.
  const cleaned = pseudo.replace(/[^a-zA-Z\u00C0-\u017F\u00DF\u00FF\u0100-\u017F\s-\[\]]/g, "");
  
  const parts = cleaned.split(/([-\s])/);
  let firstWordFound = false;

  return parts
    .map((part) => {
      if (part === "-" || part === " " || part.length === 0) return part;
      
      // Si la partie est une balise/crochet (ex: [Jhh]), on la garde intacte sans la reformater
      if (part.startsWith("[") && part.endsWith("]")) {
        return part;
      }
      
      if (!firstWordFound) {
        firstWordFound = true;
        // Premier mot du pseudo : Toujours Majuscule au début
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      }
      
      // Mots suivants : On autorise Majuscule OU Minuscule au début (choix utilisateur)
      // Mais on force le reste en minuscule pour éviter les pseudos en FULL CAPS
      return part.charAt(0) + part.slice(1).toLowerCase();
    })
    .join("");
}

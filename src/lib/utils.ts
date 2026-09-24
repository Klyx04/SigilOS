import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { logger } from "@/lib/logger"


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Résolution de l'ORIGINE publique du site — fonction **pure** (donc testable) dont
 * `getAppBaseUrl()` n'est qu'un habillage sur `process.env`.
 *
 * Priorité : `NEXT_PUBLIC_APP_URL` (explicite, posé par environnement) > `NEXTAUTH_URL` > repli prod.
 * ⚠️ On n'utilise JAMAIS l'en-tête `Host` d'une requête entrante (il est falsifiable) : l'origine
 * vient toujours de la configuration — c'est ce que consomme `metadataBase` dans `app/layout.tsx`.
 * ⚠️ Le repli `https://sigilos.fr` est un **dernier recours** : sur un environnement où aucune des
 * deux variables n'est posée, les `canonical`, le sitemap et les images OpenGraph désigneraient le
 * mauvais domaine. C'est exactement la cause du « Impossible de récupérer le sitemap » du 03/08/2026
 * ⇒ l'absence de configuration est désormais **signalée** (voir `getAppBaseUrl`) au lieu d'être muette.
 */
export function resolveAppBaseUrl(env: {
  NEXT_PUBLIC_APP_URL?: string
  NEXTAUTH_URL?: string
}): { url: string; configured: boolean } {
  const explicit = env.NEXT_PUBLIC_APP_URL?.trim()
  if (explicit) return { url: explicit, configured: true }

  const auth = env.NEXTAUTH_URL?.trim()
  if (auth) {
    return {
      url: auth.includes("beta.sigilos.fr") ? "https://beta.sigilos.fr" : auth,
      configured: true,
    }
  }

  return { url: "https://sigilos.fr", configured: false }
}

/** Évite de répéter l'avertissement à chaque appel (le module est chargé une fois par process). */
let missingOriginWarned = false

export function getAppBaseUrl() {
  // Les deux variables lues sont nommées explicitement (audit facile, et pas de `process.env`
  // entier qui se ferait passer pour un objet de configuration).
  const { url, configured } = resolveAppBaseUrl({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  })

  // Côté serveur uniquement : inutile de polluer la console du navigateur d'un visiteur.
  if (!configured && !missingOriginWarned && typeof window === "undefined") {
    missingOriginWarned = true
    logger.warn(
      "[seo] Aucune origine configurée (NEXT_PUBLIC_APP_URL / NEXTAUTH_URL) : repli sur https://sigilos.fr. " +
        "Les canonical, le sitemap et les images OpenGraph peuvent désigner le mauvais domaine."
    )
  }

  return url
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

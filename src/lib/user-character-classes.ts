import { matchDofusClass, normalizeDofusClass } from "@/lib/dofus-assets";

export interface UserPlayableCharacter {
    pseudo: string;
    classe: string;
    isMain: boolean;
    level?: number;
}

export interface MinimalUserProfileInput {
    pseudoDofus?: string | null;
    classe?: string | null;
    altPseudos?: unknown;
}

/**
 * Extrait la liste ordonnée des personnages jouables d'un profil (Main + Mules avec classe).
 * Le personnage principal est toujours en tête s'il possède une classe.
 */
export function getUserPlayableCharacters(profile: MinimalUserProfileInput | null | undefined): UserPlayableCharacter[] {
    if (!profile) return [];
    const characters: UserPlayableCharacter[] = [];

    // 1. Personnage principal
    const mainClassCanonical = matchDofusClass(profile.classe);
    if (mainClassCanonical) {
        characters.push({
            pseudo: profile.pseudoDofus?.trim() || "Personnage principal",
            classe: mainClassCanonical,
            isMain: true,
        });
    }

    // 2. Mules / Personnages secondaires
    const rawAlts = Array.isArray(profile.altPseudos) ? profile.altPseudos : [];
    for (const alt of rawAlts) {
        if (!alt) continue;
        if (typeof alt === "object" && "pseudo" in alt) {
            const raw = alt as { pseudo?: unknown; classe?: unknown; level?: unknown };
            const pseudo = typeof raw.pseudo === "string" ? raw.pseudo.trim() : "";
            const altClassCanonical = matchDofusClass(typeof raw.classe === "string" ? raw.classe : null);
            if (pseudo && altClassCanonical) {
                characters.push({
                    pseudo,
                    classe: altClassCanonical,
                    isMain: false,
                    level: typeof raw.level === "number" ? raw.level : undefined,
                });
            }
        }
    }

    return characters;
}

/**
 * Retourne la liste dédoublonnée des classes canoniques qu'un utilisateur possède
 * (personnage principal et mules).
 */
export function getUserAllowedClasses(profile: MinimalUserProfileInput | null | undefined): string[] {
    const characters = getUserPlayableCharacters(profile);
    const set = new Set<string>();
    for (const char of characters) {
        set.add(char.classe);
    }
    return Array.from(set);
}

/**
 * Vérifie si une classe donnée (libellé ou id) est possédée par l'utilisateur
 * (fail-closed : faux si le profil est absent ou si la classe n'est pas dans le roster).
 */
export function isClassAllowedForUser(
    classeToCheck: string | null | undefined,
    profile: MinimalUserProfileInput | null | undefined
): boolean {
    const normalizedTarget = normalizeDofusClass(classeToCheck);
    if (!normalizedTarget) return false;

    const allowed = getUserAllowedClasses(profile);
    return allowed.some((c) => normalizeDofusClass(c) === normalizedTarget);
}

/**
 * Message unique (Discord + site) quand la classe demandée n'est pas dans le roster.
 * Formulé pour être actionnable : il dit **quoi faire** (compléter son profil).
 */
export function classNotOwnedMessage(classe: string): string {
    return `Tu ne possèdes pas la classe ${classe} sur ton profil SigilOS (ni en personnage principal, ni dans tes mules). Ajoute ce personnage sur ton profil pour pouvoir la sélectionner.`;
}

/**
 * Résout une classe **demandée** (site ou menu Discord) contre le roster du profil.
 *
 * - `null`/`""` ⇒ `{ success: true, classe: null }` (l'appelant efface le choix) ;
 * - classe canonique possédée ⇒ `{ success: true, classe: <canonique> }` ;
 * - classe inconnue ou non possédée ⇒ refus explicite (fail-closed), jamais un repli
 *   silencieux sur la classe principale : le membre verrait une classe qu'il n'a pas choisie.
 */
export function resolveOwnedClass(
    requested: string | null | undefined,
    profile: MinimalUserProfileInput | null | undefined
): { success: true; classe: string | null } | { success: false; error: string } {
    const raw = typeof requested === "string" ? requested.trim() : "";
    if (!raw) return { success: true, classe: null };

    const canonical = matchDofusClass(raw);
    if (!canonical) return { success: false, error: `Classe inconnue : ${raw.slice(0, 30)}` };
    if (!isClassAllowedForUser(canonical, profile)) {
        return { success: false, error: classNotOwnedMessage(canonical) };
    }
    return { success: true, classe: canonical };
}


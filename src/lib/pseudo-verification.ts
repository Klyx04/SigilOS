/**
 * Pseudo Dofus — **règle pure** du retour de vérification (aucune I/O).
 *
 * Le profil interne et l'espace visiteur parlent du même ladder ; le **message** doit être
 * le même partout. Cette fonction ne décide **pas** si l'enregistrement passe : depuis le
 * 08/11/2026 `createPublicProfile` et `updatePublicMules` **refusent** un pseudo introuvable.
 * Les quatre issues :
 *  · `manual` : le toggle God « Fallback Pseudo Manuel » est actif ⇒ pas de contrôle ;
 *  · `found === true` : le pseudo existe sur le serveur choisi ;
 *  · `found === false` : introuvable (orthographe, serveur, personnage récent) ⇒ refus ;
 *  · `found === null` : worker indisponible — la création passe encore (fail-open documenté
 *    dans `src/server/ladder-pseudo.ts`), et le message ne promet donc rien.
 */

export type PseudoVerificationFacts = {
    found: boolean | null;
    manual: boolean;
};

export type PseudoVerificationOutcome = {
    tone: "success" | "warning";
    message: string;
};

export function describePseudoVerification(facts: PseudoVerificationFacts): PseudoVerificationOutcome {
    if (facts.manual) {
        return {
            tone: "warning",
            message: "Vérification manuelle activée : ton pseudo est accepté sans contrôle du ladder.",
        };
    }
    if (facts.found === true) {
        return { tone: "success", message: "Pseudo trouvé sur le ladder de ce serveur." };
    }
    if (facts.found === false) {
        return {
            tone: "warning",
            message: "Pseudo introuvable sur ce serveur : vérifie l'orthographe, la casse et le serveur choisi.",
        };
    }
    return {
        tone: "warning",
        message: "Vérification indisponible pour l'instant — le contrôle sera refait plus tard.",
    };
}

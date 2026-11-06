/**
 * Pseudo Dofus — **règle pure** du retour de vérification (aucune I/O).
 *
 * Le profil interne et l'espace visiteur parlent du même ladder ; le **message** doit être
 * le même partout. Trois cas, dont deux qui n'empêchent pas l'enregistrement :
 *  · `manual` : le toggle God « Fallback Pseudo Manuel » est actif ⇒ pas de contrôle ;
 *  · `found === true` : le pseudo existe sur le serveur choisi ;
 *  · `found === false` : introuvable (orthographe, serveur, personnage récent) ;
 *  · `found === null` : worker indisponible (fail-open) — on enregistre, on revérifiera.
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
            message: "Pseudo introuvable sur ce serveur. Tu peux quand même l'enregistrer.",
        };
    }
    return {
        tone: "warning",
        message: "Vérification indisponible pour l'instant. Tu peux enregistrer, elle sera refaite plus tard.",
    };
}

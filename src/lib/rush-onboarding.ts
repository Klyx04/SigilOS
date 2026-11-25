/**
 * Guide public du Rush — **première étape de l'accueil** (règle pure, testable).
 *
 * L'accueil de première arrivée ne doit jamais demander ce que le compte sait
 * déjà :
 *  · un **anonyme** (ou un compte **sans profil**) part à l'étape 1 : il choisit
 *    un personnage **local** (localStorage), sans rapport avec un profil ;
 *  · un profil **partiel** (pseudo ou classe manquant) part aussi à l'étape 1 —
 *    l'identité manque ;
 *  · un profil **complet** saute l'étape 1 : son personnage est déjà en base ;
 *    reste l'alignement (étape 2) s'il n'est pas déclaré ;
 *  · tout est déjà déclaré ⇒ **aucun accueil** (`null`).
 *
 * Aucun `guildId`, aucune I/O : la règle ne fait que choisir une étape.
 */

import type { PublicGuideVisitor } from "@/lib/public-guide-visitor";

export type RushOnboardingStart = 1 | 2 | null;

export function resolveRushOnboardingStart(
    visitor: Pick<PublicGuideVisitor, "pseudo" | "classe" | "alignment"> | null | undefined
): RushOnboardingStart {
    if (!visitor) return 1;
    if (!visitor.pseudo || !visitor.classe) return 1;
    if (!visitor.alignment) return 2;
    return null;
}

/**
 * **Porte de départ** du guide public — l'accueil reste optionnel, mais la
 * progression ne démarre pas sans personnage.
 *
 * Demande user du 25/11/2026 : « le but n'est pas de reproposer un tour guide mais
 * de par exemple bloquer tant qu'un personnage n'est pas choisi ». On distingue donc
 * deux besoins :
 *  · `needsCharacter` : **bloque les coches** (aucune progression locale fiable sans
 *    personnage ; l'anonyme peut toujours lire le guide) ;
 *  · `needsAlignment` : **jamais bloquant** — la cité est optionnelle, mais les quêtes
 *    d'alignement en dépendent ; on l'affiche comme étape suivante.
 *
 * Un profil **complet** (pseudo + classe) fournit déjà le personnage : on ne le
 * redemande pas. Un profil partiel ou un compte sans profil garde la porte locale.
 */
export type RushStartState = {
    needsCharacter: boolean;
    hasCharacter: boolean;
    /** Aucune cité déclarée (profil ou choix local) : étape suivante, non bloquante. */
    needsAlignment: boolean;
};

export function resolveRushStartState(input: {
    isConnected: boolean;
    visitor: Pick<PublicGuideVisitor, "pseudo" | "classe" | "alignment"> | null | undefined;
    hasGuestCharacter: boolean;
    /** Cité choisie localement (guide public sans profil). */
    localAlignment?: string | null;
}): RushStartState {
    const profileComplete =
        input.isConnected && !!input.visitor?.pseudo && !!input.visitor?.classe;
    const hasCharacter = profileComplete || input.hasGuestCharacter;
    const needsCharacter = !hasCharacter;
    const needsAlignment =
        hasCharacter && !input.visitor?.alignment && !input.localAlignment;
    return { needsCharacter, hasCharacter, needsAlignment };
}

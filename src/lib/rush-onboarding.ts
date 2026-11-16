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

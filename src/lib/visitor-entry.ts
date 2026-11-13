/**
 * Espace visiteur (rang 57) — **règle pure** de la porte d'entrée (D-V13).
 *
 * Un compte connecté sans aucune guilde n'a plus de cul-de-sac : `/dashboard` et la
 * landing le renvoient dans son espace perso. La décision vit ici, en un seul endroit,
 * parce qu'elle est lue par **deux** écrans : dupliquée, elle divergerait au premier
 * ajustement (même raison que `sign-in-policy.ts` pour `signIn`).
 *
 * Ordre significatif, **fail-closed** :
 *  1. interrupteur fermé (`PUBLIC_VISITOR_ENTRY`) ⇒ on ne redirige pas — c'est le
 *     comportement d'avant le rang 57, sans redéploiement ;
 *  2. Discord n'a pas répondu ⇒ on ne conclut **pas** « pas de guilde ». Un membre dont
 *     l'API est en rate-limit ou dont le scope `guilds` manque a des listes vides : le
 *     traiter en visiteur serait une conclusion par défaut ;
 *  3. une guilde (active, en attente de validation ou à déployer) ⇒ ce n'est pas un visiteur.
 *
 * Aucune I/O, aucun `guildId` : l'espace visiteur est hors guilde par construction.
 */

export type VisitorEntryFacts = {
    /** Interrupteur d'exploitation — fermé par défaut (`isVisitorEntryEnabled`). */
    visitorEntryEnabled: boolean;
    /** Le compte a au moins une guilde : active, en attente de validation ou à déployer. */
    hasGuild: boolean;
    /** Discord n'a pas répondu (rate-limit, scope `guilds` refusé) : on ne sait pas conclure. */
    guildLookupFailed: boolean;
};

/** Vrai quand le compte doit être redirigé vers `/espace-visiteur/general`. */
export function shouldOpenVisitorSpace(facts: VisitorEntryFacts): boolean {
    if (!facts.visitorEntryEnabled) return false;
    if (facts.guildLookupFailed) return false;
    return !facts.hasGuild;
}

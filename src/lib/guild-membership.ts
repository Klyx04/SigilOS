/**
 * Appartenance à la guilde — règle pure (dashboard).
 *
 * Contexte : `getUserContext` projetait `isMember: !!member` (résultat LIVE de
 * l'API Discord uniquement). Un flake Discord d'une seconde (rate-limit,
 * timeout, 5xx) rendait `member = null` ⇒ « Accès Restreint » + verdict mis en
 * cache 60 s, alors que le membre était connu et ACTIF en base. Les correctifs
 * précédents n'avaient patché que des `return` précoces, jamais cette
 * projection finale — d'où les récidives.
 *
 * Règle : membre Discord vu → membre ; God plateforme → membre (inspection) ;
 * erreur API **avec** profil ACTIF connu en base → membre (repli BDD, même
 * prédicat que `isAuthorizedMember`). Un 404 Discord (kick/départ réel, pas une
 * erreur) ou un inconnu sans profil reste NON membre — fail-closed préservé.
 */
export function resolveIsMember(args: {
    /** Membre renvoyé par l'API Discord (`null` si 404 ou erreur). */
    memberPresent: boolean;
    /** God plateforme (inspection des guildes). */
    isGod: boolean;
    /** L'appel Discord a échoué techniquement (≠ 404, cf. `fetchGuildMember`). */
    memberFetchFailed: boolean;
    /** Un profil ACTIF de cette guilde existe en base pour cet utilisateur. */
    hasKnownActiveProfile: boolean;
}): boolean {
    return (
        args.memberPresent ||
        args.isGod ||
        (args.memberFetchFailed && args.hasKnownActiveProfile)
    );
}

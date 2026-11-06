/**
 * Espace visiteur — **règle pure** de décision de connexion (`signIn`).
 *
 * Pourquoi ce module : `src/auth.ts` portait une chaîne de `if` de 110 lignes dans un
 * callback NextAuth. Ouvrir la plateforme aux comptes **sans guilde** (rang 57) y ajoutait
 * une branche de plus, non testable. La décision est donc extraite ici : entrées
 * observables, sortie explicite, aucune I/O.
 *
 * Invariants (docs/plans/PLAN-ESPACE-VISITEUR.md) :
 *  · **D-V2** : un visiteur est un `User` comme un autre ; l'autorisation d'entrer ne dit
 *    rien de l'accès au dashboard, qui reste gardé par `getUserContext` (page ET action).
 *  · **Fail-closed** : si l'API Discord ne répond pas, on n'entre **pas** — sauf membre
 *    ACTIVE déjà connu (tolérance ciblée existante, cf. `src/lib/access-attempt.ts`).
 *  · **Interrupteur** : `visitorEntryEnabled` permet de refermer la porte sans redéployer
 *    de code (variable d'environnement lue par l'appelant). **Fermé par défaut** : l'audit
 *    des actions serveur doit passer avant l'ouverture (cf. `isVisitorEntryEnabled`).
 */

export type SignInFacts = {
    /** L'utilisateur appartient à au moins une guilde gérée (ou éligible au portail). */
    hasManagedGuild: boolean;
    /** Profil ACTIVE connu d'une guilde gérée — seule tolérance quand Discord est KO. */
    isKnownManagedMember: boolean;
    /** `GET /users/@me/guilds` a répondu (2xx). */
    discordApiOk: boolean;
    /** Interrupteur d'exploitation : `false` rend le comportement d'avant le rang 57. */
    visitorEntryEnabled: boolean;
};

export type SignInDecision =
    | { allow: true; as: "member" | "visitor" }
    | { allow: false; reason: "DISCORD_API_ERROR" | "NO_MANAGED_GUILD" };

/**
 * Décide l'entrée sur la plateforme.
 *
 * L'ordre des règles est significatif : un **membre** est reconnu avant tout le reste
 * (c'est la vie existante), puis l'API en échec refuse, et seulement ensuite la porte
 * visiteur s'ouvre.
 */
export function decideSignInAccess(facts: SignInFacts): SignInDecision {
    if (facts.hasManagedGuild || facts.isKnownManagedMember) {
        return { allow: true, as: "member" };
    }
    if (!facts.discordApiOk) {
        return { allow: false, reason: "DISCORD_API_ERROR" };
    }
    if (facts.visitorEntryEnabled) {
        return { allow: true, as: "visitor" };
    }
    return { allow: false, reason: "NO_MANAGED_GUILD" };
}

/**
 * Interrupteur lu depuis l'environnement — **fermé par défaut** (opt-in).
 *
 * Pourquoi fermé : l'interrupteur n'ouvre que la **connexion** des comptes sans guilde — la
 * porte d'entrée de l'interface (menu avatar + redirections `/dashboard` et `/`, **D-V13**)
 * est livrée. L'audit qui conditionnait l'ouverture est **fait** (06/11/2026) : les dix
 * actions cloisonnées par guilde qui ne vérifiaient qu'une session portent désormais
 * `assertGuildMemberAccess` (`src/server/guild-access.ts`). La dette **antérieure** — six
 * modules `"use server"` sans aucune authentification — reste figée par
 * `tests/unit/guild-actions-rbac.test.ts` et relève d'un lot séparé.
 *
 * Activation : `PUBLIC_VISITOR_ENTRY=1`, après contrôle à l'écran de l'espace visiteur.
 *
 * La signature ne demande que la clé utile — pas `NodeJS.ProcessEnv` entier.
 */
export function isVisitorEntryEnabled(
    env: Record<string, string | undefined> = process.env
): boolean {
    return env.PUBLIC_VISITOR_ENTRY === "1";
}

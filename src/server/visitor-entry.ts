/**
 * Espace visiteur (rang 57) — **garde serveur** de la porte d'entrée (D-V13).
 *
 * Appelée par `/dashboard` et par la landing, avec les **mêmes** faits : la règle est
 * `shouldOpenVisitorSpace` (`src/lib/visitor-entry.ts`), jamais recopiée dans un écran.
 *
 * Ce module n'est **pas** une server action : il ne fait qu'une redirection, il n'expose
 * aucune mutation et ne doit pas être importé par un composant client.
 *
 * Anti-boucle : `requirePublicSession` (`src/server/public-account.ts`) renvoie un compte
 * **banni** (JWT de 8 h encore valide) sur `/`, où cette garde se re-déclencherait. On
 * re-vérifie donc le compte public **avant** de rediriger : refus ⇒ aucune redirection.
 * Même raison pour une session absente entre deux requêtes.
 */

import { redirect } from "next/navigation";
import { isVisitorEntryEnabled } from "@/lib/sign-in-policy";
import { shouldOpenVisitorSpace, type VisitorEntryFacts } from "@/lib/visitor-entry";
import { getPublicSession } from "@/server/public-account";

export type GuildlessEntryFacts = Pick<VisitorEntryFacts, "hasGuild" | "guildLookupFailed">;

/**
 * Redirige un compte **sans guilde** vers son espace visiteur quand la porte est ouverte.
 * Sinon, ne fait rien : l'écran appelant poursuit son rendu habituel.
 */
export async function redirectGuildlessUserToVisitorSpace(facts: GuildlessEntryFacts): Promise<void> {
    if (!shouldOpenVisitorSpace({ ...facts, visitorEntryEnabled: isVisitorEntryEnabled() })) {
        return;
    }

    const account = await getPublicSession();
    if (!account) return;

    redirect("/espace-visiteur/general");
}

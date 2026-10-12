/**
 * Lien vers la **fiche d'un monstre** — source unique, et surtout **jamais une URL
 * inventée** : une fiche publiée n'existe que pour un avis de recherche (`Bounty`)
 * et pour le boss d'un donjon (`Dungeon`). Le slug est donc posé par le serveur
 * (`getZoneMonsters.ficheSlug`, lu en base) ; ici on ne fait que choisir la
 * **surface** : fiche publique `/boss/<slug>` ou fiche interne du module Succès.
 *
 * `null` = aucune fiche publiée ⇒ l'appelant n'affiche pas de lien (aucun 404).
 */
import { dungeonFicheHref } from "./dungeon-fiche";
import { monsterFicheHref as normalMonsterHref } from "./monster-fiche";

export function monsterFicheHref(
    guildId: string | null | undefined,
    monster: { ficheSlug?: string | null; ficheKind?: string | null; name?: string | null } | null | undefined,
): string | null {
    const slug = typeof monster?.ficheSlug === "string" ? monster.ficheSlug.trim() : "";
    if (slug === "") {
        // Pas de fiche dédiée : un monstre **normal** a désormais SA page `/bestiaire/<slug>`
        // (source unique `@/lib/monster-fiche`) — sinon `null`, jamais d'URL inventée.
        return normalMonsterHref(monster?.name);
    }

    // Public (ou sentinelle) : la fiche publique existe pour les deux natures.
    if (!guildId || guildId === "public") {
        return dungeonFicheHref(null, { slug });
    }

    // Interne : le boss d'un donjon ouvre la fiche boss (deep-link partagé) ; un avis
    // de recherche ouvre l'onglet « Fiches Avis » sur SA fiche.
    const seg = encodeURIComponent(slug);
    if (monster?.ficheKind === "bounty") {
        return `/dashboard/${encodeURIComponent(guildId)}/succes?view=bounties&dungeon=${seg}`;
    }
    return dungeonFicheHref(guildId, { slug });
}

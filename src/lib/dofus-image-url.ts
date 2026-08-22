/**
 * Normalisation d'URL d'icône d'un Dofus.
 *
 * Le Dofoozbz (slug éponyme) est un cas particulier sur dofusdb : son icône
 * `https://api.dofusdb.fr/img/items/31794.png` renvoie un 404 côté API.
 * Partout où l'on sert l'`imageUrl` d'un Dofus, on doit renvoyer l'asset LOCAL
 * `/module-dofus/Dofus_Dofoozbz.png` pour éviter que le client charge une image
 * cassée. Ce helper centralise cette règle afin de couvrir TOUTES les sources
 * (profil membre, hub Quêtes Dofus, stats guilde, honor, etc.) sans qu'il soit
 * nécessaire de la maintenir à chaque point de lecture.
 *
 * @param slug    Slug du Dofus (ex. `dofoozbz`, `emeraude`).
 * @param imageUrl URL d'icône stockée en base (dofusdb) ou déjà locale.
 * @returns       L'URL d'icône à servir au client.
 */
export function resolveDofusImageUrl(slug: string | null | undefined, imageUrl: string | null | undefined): string | null {
    if (slug === "dofoozbz") {
        return "/module-dofus/Dofus_Dofoozbz.png";
    }
    return imageUrl ?? null;
}

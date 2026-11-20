/**
 * Donjons d'un chapitre du guide Rush — **règle pure**.
 *
 * La table `Dungeon` contient deux entrées pour le même donjon : la version
 * normale et sa variante « (niv. 50) ». Dans la sidebar « Donjons à prévoir »,
 * elles s'affichaient **deux fois**, et la variante — souvent sans `imageUrl` —
 * tombait sur l'icône de repli. Mesure du 20/11/2026 : « Donjon des Bworks » et
 * « Donjon des Bworks (niv. 50) » côte à côte, la seconde avec un picto vide.
 *
 * La fusion est une **clé de base** : le nom débarrassé de sa variante de niveau.
 * L'entrée qui porte une image gagne, et le libellé le plus court est conservé
 * (c'est le nom du donjon, pas celui de la variante).
 */

export type RushChapterDungeon = {
    id?: string;
    name: string;
    imageUrl?: string;
    bossName?: string;
};

/** Clé de fusion : minuscules, sans la variante « (niv. N) » / « (niveau N) ». */
export function rushDungeonBaseKey(name: string): string {
    return name
        .trim()
        .toLowerCase()
        .replace(/\s*\(niv(?:eau)?\.?\s*\d+\)\s*$/i, "")
        .replace(/\s+/g, " ");
}

/**
 * Une seule ligne par donjon. L'image et le boss d'une variante comblent les
 * trous de l'autre ; deux donjons réellement différents restent séparés.
 */
export function mergeRushChapterDungeons(
    entries: readonly RushChapterDungeon[]
): RushChapterDungeon[] {
    const byKey = new Map<string, RushChapterDungeon>();
    for (const entry of entries) {
        const name = (entry.name ?? "").trim();
        if (!name) continue;
        const key = rushDungeonBaseKey(name);
        const previous = byKey.get(key);
        if (!previous) {
            byKey.set(key, { ...entry, name });
            continue;
        }
        byKey.set(key, {
            id: previous.id ?? entry.id,
            // Le libellé le plus court est le nom du donjon (pas la variante).
            name: previous.name.length <= name.length ? previous.name : name,
            imageUrl: previous.imageUrl ?? entry.imageUrl,
            bossName: previous.bossName ?? entry.bossName,
        });
    }
    return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

/**
 * Monstres **posables** dans la simulation tactique.
 *
 * 🐛 Mesure du 11/10/2026 : la grille filtrait `!monster.isBoss`, donc **tout boss autre
 * que celui de l'en-tête** était écarté. Conséquence visible : un **double boss**
 * (Frigost : Comte Harebourg + son associé) ne laissait poser que le Comte, et les
 * **4 Cavaliers de l'Apocalypse** se réduisaient à Servitude — alors qu'ils sont tous
 * dans la salle et doivent tous pouvoir être placés.
 *
 * 🔒 Règle : le **seul** monstre écarté est celui qui occupe déjà la place 1 (le boss de
 * la salle, celui de l'en-tête) — sinon il serait posé deux fois. Tous les autres sont
 * posables, **boss compris** : un boss est un monstre de la salle comme un autre, et
 * c'est la donnée (`isBoss`) qui doit informer, pas restreindre.
 */

/** Le strict nécessaire pour juger un monstre de salle. */
export interface RoomMonsterLike {
    name: string;
    isBoss?: boolean;
}

/** Normalise un libellé de monstre (casse et espaces). */
function normalize(value: string | null | undefined): string {
    return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Monstres de la salle posables en simulation, dans l'ordre de la famille, **boss inclus**.
 *
 * @param monsters monstres de la salle (famille du donjon)
 * @param bossName nom du boss déjà placé en position 1 (celui de l'en-tête)
 */
export function selectableRoomMonsters<T extends RoomMonsterLike>(
    monsters: readonly T[] | null | undefined,
    bossName: string | null | undefined,
): T[] {
    const boss = normalize(bossName);
    return (monsters ?? []).filter((monster) => normalize(monster.name) !== boss);
}

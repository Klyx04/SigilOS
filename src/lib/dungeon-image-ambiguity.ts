/**
 * Images de donjons — **une image appartient à un BOSS, jamais à un nom de donjon**.
 *
 * 🐛 Bug mesuré le 11/10/2026 (capture God « Donjons ») : trois entrées
 * `Protecteurs du Sanctuaire …` — mêmes `name`, boss différents (Reine Écarlate,
 * Gardien du Clos, Princesse Maudite) — affichaient **la même image**. C'est le cas
 * normal du modèle : plusieurs entrées peuvent partager un emplacement (la modale le
 * dit : « Comte Harebourg + Frizz + Sylargh + Kilme… »), chacune avec **son** boss.
 * Rien, en revanche, n'interdisait que la même `imageUrl` soit écrite sur les trois :
 * l'écran God affichait donc l'illustration d'un boss à la place d'un autre, sans
 * aucun signal.
 *
 * 🔒 Règle posée ici (règle **pure**, une seule source) : quand plusieurs donjons de
 * **même nom** portent des **boss différents** ET **la même image**, cette image est
 * ambiguë ⇒ elle ne doit pas être présentée comme celle du boss. L'appelant affiche
 * un état neutre et invite à choisir l'image du boss (le choix se fait par
 * `bossName`/`dofusdbId`, via le sélecteur d'images existant). On ne **devine** jamais
 * la bonne image, on **refuse** la fausse.
 */

/** Le strict nécessaire pour juger une image : identité + nom + boss + image. */
export interface DungeonImageCandidate {
    id: string;
    name: string;
    bossName: string;
    imageUrl?: string | null;
}

/** Normalise un libellé pour comparer deux noms (casse et espaces). */
function normalize(value: string | null | undefined): string {
    return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Ids des donjons dont l'`imageUrl` est **ambiguë** : partagée par au moins deux
 * entrées de **même nom** qui ont des **boss différents**.
 *
 * Un donjon seul, ou un homonyme dont l'image diffère, n'est jamais ambigu ; deux
 * entrées strictement identiques (même nom **et** même boss) ne le sont pas non plus.
 */
export function ambiguousDungeonImageIds(
    dungeons: readonly DungeonImageCandidate[],
): Set<string> {
    const byName = new Map<string, DungeonImageCandidate[]>();
    for (const dungeon of dungeons) {
        const key = normalize(dungeon.name);
        if (key === "") continue;
        const bucket = byName.get(key);
        if (bucket) bucket.push(dungeon);
        else byName.set(key, [dungeon]);
    }

    const ambiguous = new Set<string>();
    for (const bucket of byName.values()) {
        if (bucket.length < 2) continue;
        // Regroupe par image (non vide) : c'est l'égalité d'image qui crée l'ambiguïté.
        const byImage = new Map<string, DungeonImageCandidate[]>();
        for (const dungeon of bucket) {
            const image = (dungeon.imageUrl ?? "").trim();
            if (image === "") continue;
            const list = byImage.get(image);
            if (list) list.push(dungeon);
            else byImage.set(image, [dungeon]);
        }
        for (const sameImage of byImage.values()) {
            const bosses = new Set(sameImage.map((d) => normalize(d.bossName)));
            // Même image + plusieurs boss distincts ⇒ l'image ne peut pas être celle des deux.
            if (bosses.size > 1) for (const d of sameImage) ambiguous.add(d.id);
        }
    }
    return ambiguous;
}

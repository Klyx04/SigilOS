/**
 * Double boss d'un donjon — **source unique** de l'identité affichée.
 *
 * 🐛 Mesure du 20/10/2026 sur les 4 donjons de Frigost (`comte-et-klime`,
 * `comte-et-missiz-frizz`, `comte-et-nileza`, `comte-et-sylargh`) :
 * en base, `Dungeon.bossName` porte le **nom du donjon** (« Comte et Nileza »),
 * pas un monstre. Le résolveur Dofensive, lui, est bien renseigné
 * (`dofensiveMonsterName` = « Nileza », `dofensiveDungeonName` =
 * « Donjon du Comte Harebourg ») — mais l'écran utilisait `bossName` partout.
 *
 * Conséquences mesurées : la fiche affichait les stats du **Comte** et la
 * simulation ouvrait un dropdown sur **toutes** les salles (le filtre par nom de
 * boss de `SpellRangeGrid` ne pouvait jamais matcher « Comte et Nileza »).
 *
 * Règle : quand `dofensiveMonsterName` est renseigné, c'est **lui** le boss de la
 * salle (`focus`) ; l'autre boss du donjon (`partner`) est déduit du nom Dofensive
 * du donjon (« Donjon du Comte Harebourg » → « Comte Harebourg »). Aucune valeur
 * inventée : sans nom de donjon Dofensive, il n'y a **pas** de second boss.
 */

export interface DungeonBossPairInput {
    /** Nom du donjon en base (« Comte et Nileza »). */
    name: string;
    /** `Dungeon.bossName` — nom du donjon, **pas** forcément un monstre. */
    bossName?: string | null;
    /** `Dungeon.dofensiveMonsterName` — monstre exact côté Dofensive (« Nileza »). */
    dofensiveMonsterName?: string | null;
    /** `Dungeon.dofensiveDungeonName` — donjon exact côté Dofensive (« Donjon du Comte Harebourg »). */
    dofensiveDungeonName?: string | null;
}

export interface DungeonBossPair {
    /** Boss de la salle : celui dont on affiche les stats, les sorts et la carte. */
    focus: string;
    /** Second boss du donjon, si connu (jamais inventé). */
    partner: string | null;
    /** Vrai seulement quand les deux noms sont connus et distincts. */
    isDoubleBoss: boolean;
}

/** Retire l'enveloppe générique d'un nom de donjon Dofensive. */
function stripDungeonPrefix(value: string): string {
    return value
        .trim()
        .replace(/^(?:le\s+|la\s+|les\s+|l')?(?:donjon|expédition|expedition|labyrinthe)\s+/i, "")
        .replace(/^(?:du\s+|de\s+la\s+|des\s+|de\s+l'|de\s+|d')/i, "")
        .replace(/\s+/g, " ")
        .trim();
}

function sameName(a: string, b: string): boolean {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Identité d'affichage d'un donjon.
 *
 * - `dofensiveMonsterName` renseigné ⇒ c'est le **focus** (l'associé de la salle) ;
 * - `dofensiveDungeonName` renseigné en plus ⇒ son monstre (« Donjon du Comte
 *   Harebourg » → « Comte Harebourg ») devient le **partner** ;
 * - sinon ⇒ `focus` = `bossName` (ou `name`) et **aucun** partner.
 */
export function resolveDungeonBossPair(input: DungeonBossPairInput): DungeonBossPair {
    const fallback = (input.bossName || input.name || "").trim();
    const focus = (input.dofensiveMonsterName ?? "").trim();

    if (!focus) {
        return { focus: fallback, partner: null, isDoubleBoss: false };
    }

    const rawPartner = stripDungeonPrefix(input.dofensiveDungeonName ?? "");
    const partner = rawPartner && !sameName(rawPartner, focus) ? rawPartner : null;

    return { focus, partner, isDoubleBoss: !!partner };
}

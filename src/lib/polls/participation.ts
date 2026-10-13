/**
 * Sondages — participation : qui a voté, **qui n'a pas voté** (règle pure, testable).
 *
 * Pourquoi une règle unique : la liste des non-votants est le **complément exact** de la liste des
 * votants. Si les deux listes ne partageaient pas la même cascade d'identité ni le même tri, elles
 * se contrediraient à l'écran (« untel votant *et* non-votant »). Ici : une seule cascade
 * (pseudo Dofus → pseudo Discord → nom de compte → « Membre », la même que `getPoll`) et un seul
 * tri (nom affiché, `fr`, insensible à la casse).
 *
 * ⚠️ Un sondage **anonyme** ne publie **jamais** cette liste : elle révélerait les votants par
 * complément, alors que leurs identités sont volontairement masquées partout ailleurs.
 */

/** Membre tel que lu en base (les trois sources possibles d'un nom affiché). */
export interface PollMemberRef {
    id: string;
    pseudoDofus: string | null;
    discordNickname: string | null;
    userName: string | null;
    image: string | null;
}

/** Membre tel qu'affiché dans une liste de participation. */
export interface PollMember {
    id: string;
    name: string;
    image: string | null;
}

/**
 * Nom affiché d'un membre : pseudo Dofus → pseudo Discord → nom de compte → « Membre ».
 * Une chaîne vide ou faite d'espaces compte comme absente (jamais un nom vide à l'écran).
 */
export function pollMemberName(member: {
    pseudoDofus?: string | null;
    discordNickname?: string | null;
    userName?: string | null;
}): string {
    return (
        member.pseudoDofus?.trim() ||
        member.discordNickname?.trim() ||
        member.userName?.trim() ||
        "Membre"
    );
}

/**
 * Membres de la guilde qui **n'ont pas voté** — triés par nom affiché.
 * `voterProfileIds` accepte les doublons (un votant laisse **une ligne par option** en choix
 * multiple) : le `Set` les absorbe, donc aucun risque de compter un votant comme non-votant.
 */
export function computeNonVoters(
    members: PollMemberRef[],
    voterProfileIds: Iterable<string>
): PollMember[] {
    const voted = new Set(voterProfileIds);
    return members
        .filter((member) => !voted.has(member.id))
        .map((member) => ({ id: member.id, name: pollMemberName(member), image: member.image }))
        .sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
}

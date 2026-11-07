/**
 * Guide public du Rush — **identité du visiteur connecté** (V2a), règle pure (aucune I/O).
 *
 * La tuile « Personnage actif » du guide affiche ce que le visiteur a de public : qui il est
 * (pseudo + classe), son serveur, ses **deux chiffres** (niveau, points de succès — remplis
 * par V1e) et son **lien Metamob** (V2a-3 : `metamobPseudo` + `metamobVerified`, jamais la
 * clé). Rien d'autre.
 *
 * Pourquoi un module : la page ne doit pas passer la ligne Prisma entière au composant client
 * (piège du DTO, cf. `public-profile-dto.ts`). Ici, une liste blanche de sept scalaires — la
 * clé Metamob, les mules et `userId` n'ont aucun chemin pour fuir : `toPublicGuideVisitor`
 * recopie des champs **nommés**, il ne fait jamais `...profile`.
 */

export type PublicGuideVisitor = {
    pseudo: string | null;
    /** Id de classe (`iop`, `feca`) — jamais un libellé : l'icône se résout par `getClass`. */
    classe: string | null;
    serverId: number;
    level: number | null;
    successPoints: number | null;
    /** Pseudo Metamob déclaré (V2a-3) — `null` tant que rien n'est lié. */
    metamobPseudo: string | null;
    /** Lien Metamob vérifié par l'API ? La clé, elle, reste dans `metamobApiKey` côté serveur. */
    metamobVerified: boolean;
    /** Alignement déclaré (V2a-4) : `bontarien` | `brakmarien` | `neutre`, sinon `null`. */
    alignment: string | null;
    /** Id de l'Ordre dans la cité (`-1` à `-5`…), `null` pour un neutre sans Ordre. */
    alignmentOrder: string | null;
    /**
     * Mules **déclarées** par le visiteur. Elles sont déjà publiques (fiche `/visiteurs/<id>`)
     * et servent à lancer le rush sur un autre personnage : la progression en base est clé
     * par emplacement (`characterSlot`), donc une mule est un emplacement comme un autre.
     */
    mules: PublicGuideMule[];
};

export type PublicGuideMule = {
    pseudo: string;
    classe: string | null;
};

/** Profil public (DTO étanche) → identité de la tuile. Aucune fuite : recopie nommée. */
export function toPublicGuideVisitor(profile: {
    pseudoDofus: string | null;
    classe: string | null;
    dofusServerId: number;
    dofusLevel: number | null;
    successPoints: number | null;
    metamobPseudo: string | null;
    metamobVerified: boolean;
    alignment: string | null;
    alignmentOrder: string | null;
    altPseudos: ReadonlyArray<{ pseudo: string; classe?: string | null }>;
}): PublicGuideVisitor {
    return {
        pseudo: profile.pseudoDofus,
        classe: profile.classe,
        serverId: profile.dofusServerId,
        level: profile.dofusLevel,
        successPoints: profile.successPoints,
        metamobPseudo: profile.metamobPseudo,
        metamobVerified: profile.metamobVerified,
        alignment: profile.alignment,
        alignmentOrder: profile.alignmentOrder,
        mules: profile.altPseudos
            .filter((mule) => typeof mule?.pseudo === "string" && mule.pseudo.length > 0)
            .map((mule) => ({ pseudo: mule.pseudo, classe: mule.classe ?? null })),
    };
}

/**
 * État Metamob **affichable** (V2a-3) — trois cas, aucun autre : rien de lié, lié mais non
 * vérifié, lié et vérifié. Une règle pure, donc testable sans rendu : la tuile ne décide pas
 * elle-même de ce qu'elle raconte.
 */
export type PublicMetamobState = "none" | "linked" | "verified";

export function metamobState(
    visitor: Pick<PublicGuideVisitor, "metamobPseudo" | "metamobVerified"> | null | undefined
): PublicMetamobState {
    if (!visitor?.metamobPseudo) return "none";
    return visitor.metamobVerified ? "verified" : "linked";
}

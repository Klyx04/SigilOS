/**
 * Guide public du Rush — **identité du visiteur connecté** (V2a), règle pure (aucune I/O).
 *
 * Le bandeau du guide affiche trois choses et rien de plus : qui est là (pseudo + classe),
 * son serveur, et ses **deux chiffres publics** (niveau, points de succès — remplis par V1e).
 *
 * Pourquoi un module : la page ne doit pas passer la ligne Prisma entière au composant client
 * (piège du DTO, cf. `public-profile-dto.ts`). Ici, une liste blanche de cinq scalaires — la
 * clé Metamob, les mules et `userId` n'ont aucun chemin pour fuir.
 */

export type PublicGuideVisitor = {
    pseudo: string | null;
    /** Id de classe (`iop`, `feca`) — jamais un libellé : l'icône se résout par `getClass`. */
    classe: string | null;
    serverId: number;
    level: number | null;
    successPoints: number | null;
};

/** Profil public (DTO étanche) → identité du bandeau. Cinq champs, pas un de plus. */
export function toPublicGuideVisitor(profile: {
    pseudoDofus: string | null;
    classe: string | null;
    dofusServerId: number;
    dofusLevel: number | null;
    successPoints: number | null;
}): PublicGuideVisitor {
    return {
        pseudo: profile.pseudoDofus,
        classe: profile.classe,
        serverId: profile.dofusServerId,
        level: profile.dofusLevel,
        successPoints: profile.successPoints,
    };
}

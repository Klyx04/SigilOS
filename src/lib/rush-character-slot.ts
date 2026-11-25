/**
 * Slot de personnage du guide Rush — **règle pure**.
 *
 * Mesure du 25/11/2026 (base locale `rush-sylvestre`) : la mule « Wylan » portait le
 * **même pseudo** que le personnage principal. Le repli `altPseudo === pseudoDofus`
 * renvoyait `undefined` (slot `PRINCIPAL`) : la mule lisait et **réinitialisait** la
 * progression du principal, jamais la sienne (slot `Wylan`, 6 blocs validés). Le
 * sélecteur envoie `PRINCIPAL` pour le principal : une mule **déclarée** doit donc
 * gagner, même homonyme du personnage principal.
 */

type MuleLike = { pseudo?: string | null } | null | undefined;

export function resolveRushCharacterSlot(input: {
    /** Paramètre d'URL `?character=` (jamais deviné). */
    altPseudo?: string | null;
    /** Pseudo du personnage principal du profil. */
    mainPseudo?: string | null;
    /** Mules déclarées sur le profil (`altPseudos`). */
    mules?: ReadonlyArray<MuleLike> | null;
}): string | undefined {
    const alt = typeof input.altPseudo === "string" ? input.altPseudo.trim() : "";
    if (!alt || alt === "PRINCIPAL" || alt === "principal") return undefined;

    const declared = (input.mules ?? []).some(
        (mule) => (mule?.pseudo ?? "").trim() === alt
    );
    if (declared) return alt;

    // URL historique avec le pseudo du principal : le sélecteur, lui, envoie PRINCIPAL.
    if (input.mainPseudo && input.mainPseudo.trim() === alt) return undefined;
    return alt;
}

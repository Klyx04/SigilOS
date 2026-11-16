import { normalizeDeclaredMules } from "@/lib/public-profile-dto";

/** Slot du personnage principal — même convention que le Rush et les coches de succès. */
export const MAIN_CHARACTER_SLOT = "PRINCIPAL";

/** Longueur maximale d'un pseudo utilisé comme slot (même borne que les mules). */
export const SUCCES_SLOT_MAX = 40;

/** Un personnage sélectionnable pour les coches (principal ou mule déclarée). */
export type SuccesCharacter = {
    /** `"PRINCIPAL"` ou le pseudo de la mule — clé stable écrite en base. */
    slot: string;
    name: string;
    classe: string | null;
    level: number | null;
    isMain: boolean;
};

/**
 * Personnages d'un profil (interne ou visiteur), **sans I/O**.
 *
 * Le principal porte toujours le slot `"PRINCIPAL"` ; les mules reprennent le pseudo
 * déclaré (même convention que `PlayerGuideProgress` / `PublicRushProgress`). Une mule
 * en double, vide ou trop longue est écartée : le slot doit rester une clé stable.
 */
export function readSuccesCharacters(profile: {
    pseudoDofus?: string | null;
    classe?: string | null;
    altPseudos?: unknown;
}): SuccesCharacter[] {
    const pseudo = typeof profile.pseudoDofus === "string" ? profile.pseudoDofus.trim() : "";
    const main: SuccesCharacter = {
        slot: MAIN_CHARACTER_SLOT,
        name: pseudo || "Personnage principal",
        classe: profile.classe ?? null,
        level: null,
        isMain: true,
    };
    const out: SuccesCharacter[] = [main];
    const seen = new Set([main.name.toLowerCase()]);

    for (const mule of normalizeDeclaredMules(profile.altPseudos)) {
        const name = mule.pseudo.trim();
        if (!name || name.length > SUCCES_SLOT_MAX) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
            slot: name,
            name,
            classe: mule.classe ?? null,
            level: mule.level ?? null,
            isMain: false,
        });
        // 1 principal + 10 mules : même borne que `PUBLIC_MULES_MAX`.
        if (out.length >= 11) break;
    }
    return out;
}

/** Lit `?perso=` : chaîne bornée, sans caractère de contrôle. La validité se fait ensuite. */
export function parseSuccesCharacterParam(raw: string | string[] | undefined): string | null {
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > SUCCES_SLOT_MAX) return null;
    if (/[\u0000-\u001f\u007f]/.test(trimmed)) return null;
    return trimmed;
}

/** Un slot fourni par le client appartient-il bien aux personnages déclarés ? */
export function hasSuccesCharacterSlot(
    raw: string | null | undefined,
    characters: ReadonlyArray<SuccesCharacter>
): boolean {
    if (!raw) return true;
    return characters.some(
        (character) => character.slot === raw || character.slot.toLowerCase() === raw.toLowerCase()
    );
}

/** Slot canonique, ou `null` si le slot fourni n'appartient pas au profil (fail-closed). */
export function resolveSuccesCharacterSlotOrNull(
    raw: string | null | undefined,
    characters: ReadonlyArray<SuccesCharacter>
): string | null {
    if (!raw) return MAIN_CHARACTER_SLOT;
    const found = characters.find(
        (character) => character.slot === raw || character.slot.toLowerCase() === raw.toLowerCase()
    );
    return found?.slot ?? null;
}

/** Slot canonique (casse du profil) ; un slot absent ou inconnu retombe sur le principal. */
export function resolveSuccesCharacterSlot(
    raw: string | null | undefined,
    characters: ReadonlyArray<SuccesCharacter>
): string {
    return resolveSuccesCharacterSlotOrNull(raw, characters) ?? MAIN_CHARACTER_SLOT;
}

/**
 * Espace visiteur — règles **pures** du nom de guilde **déclaré** (aucune I/O).
 *
 * Pourquoi ce module : un visiteur n'a pas de guilde Discord vérifiable. Le nom qu'il
 * déclare est donc une **donnée libre**, affichée dans l'annuaire public : elle doit être
 * bornée une seule fois, au même endroit pour le client (aperçu) et pour l'action serveur
 * (validation), sinon les deux divergent.
 *
 * Décision du 06/11/2026 (verbatim) : « aucun caractère spécial sauf "-" par exemple,
 * pas de chiffre, 40 lettres max, plusieurs mots autorisés », puis « pas d'accent,
 * apostrophe et tiret ok, majuscule OK ».
 *
 * Autorisé  : `A-Z` `a-z` · espace · apostrophe `'` · tiret `-`
 * Interdit  : chiffres, accents et toute autre lettre non ASCII, `_` `.` `/` `@` `#` …
 * Forme     : commence et finit par une lettre, séparateurs **simples**.
 * Longueur  : 1 → 40 caractères **après normalisation**.
 *
 * L'apostrophe typographique `’` (U+2019) est ramenée à `'` : c'est la même intention
 * frappée par un clavier mobile, et le nom stocké reste ASCII.
 */

import { z } from "zod";

/** Longueur maximale d'un nom de guilde déclaré (décision du 06/11/2026). */
export const DECLARED_GUILD_NAME_MAX = 40;

/**
 * Forme canonique : des lettres séparées par **un** espace, **une** apostrophe ou **un**
 * tiret. `^…$` sur une chaîne déjà normalisée (espaces réduits, apostrophe ASCII).
 */
const DECLARED_GUILD_NAME_PATTERN = /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/;

/**
 * Ramène une saisie à sa forme canonique : NFC, apostrophes ASCII, espaces réduits,
 * bords nettoyés. Ne **rejette** rien — la validation est le rôle de
 * `checkDeclaredGuildName`.
 */
export function normalizeDeclaredGuildName(input: string): string {
    return input
        .normalize("NFC")
        .replace(/\u2019/g, "'")
        .replace(/\s+/g, " ")
        .trim();
}

export type DeclaredGuildNameCheck =
    | { ok: true; value: string }
    | { ok: false; error: string };

/**
 * Valide un nom de guilde déclaré et rend la valeur **normalisée** à stocker.
 *
 * `ok: false` porte le message exact à afficher : chaque refus dit *pourquoi*, jamais un
 * « invalide » générique (règle d'interface du dépôt).
 */
export function checkDeclaredGuildName(input: string): DeclaredGuildNameCheck {
    const value = normalizeDeclaredGuildName(input);

    if (value.length === 0) {
        return { ok: false, error: "Le nom de guilde est vide." };
    }
    if (value.length > DECLARED_GUILD_NAME_MAX) {
        return {
            ok: false,
            error: `Le nom de guilde ne peut pas dépasser ${DECLARED_GUILD_NAME_MAX} caractères.`,
        };
    }
    if (/\d/.test(value)) {
        return { ok: false, error: "Les chiffres ne sont pas autorisés dans le nom de guilde." };
    }
    // Toute lettre hors ASCII (É, à, ß…) est un accent ou un caractère non prévu.
    if (/[^\x20-\x7E]/.test(value)) {
        return { ok: false, error: "Les accents et caractères spéciaux ne sont pas autorisés." };
    }
    if (!/^[A-Za-z]/.test(value) || !/[A-Za-z]$/.test(value)) {
        return { ok: false, error: "Le nom de guilde doit commencer et finir par une lettre." };
    }
    if (!DECLARED_GUILD_NAME_PATTERN.test(value)) {
        return {
            ok: false,
            error: "Caractères autorisés : lettres, espace, apostrophe et tiret (séparés par un seul caractère).",
        };
    }
    return { ok: true, value };
}

/**
 * Schéma Zod des entrées serveur : la valeur rendue est **normalisée**.
 *
 * Le message de refus vient de la règle pure — une seule source, deux appelants.
 */
export const declaredGuildNameSchema = z
    .string()
    .max(200, "Le nom de guilde est trop long.")
    .transform((value, ctx) => {
        const check = checkDeclaredGuildName(value);
        if (!check.ok) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: check.error });
            return z.NEVER;
        }
        return check.value;
    });

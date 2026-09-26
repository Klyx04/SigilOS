/**
 * Dispatch des inscrits par classe Dofus dans les embeds Discord + menu select
 * de classe partagé par les 4 flows (DJ, songes, calendrier/raids).
 *
 * - L'affichage remplace le field unique « Membres/Inscrits/Équipe » par UN field
 *   inline PAR classe représentée (grille 3 colonnes côté Discord, comme
 *   Raid-Helper). La largeur d'un embed est fixée par Discord : on ne peut pas
 *   l'élargir, seule la grille donne l'effet « large ».
 * - Le select (type 3) coexiste avec les boutons S'inscrire / Se désinscrire :
 *   choisir une classe = s'inscrire avec cette classe, ou mettre à jour sa
 *   classe si déjà inscrit.
 */

import { DOFUS_CLASSES } from "@/lib/dofus-assets";
import { classEmojiName } from "@/lib/discord-emoji-catalog";

/** Les 19 classes, dans l'ordre canonique (même référentiel que VALID_CLASSES). */
export const DISPATCH_CLASSES: string[] = DOFUS_CLASSES.map((c) => c.name);

export const NO_CLASS_LABEL = "Sans classe";

/** Normalise pour le regroupement (« Féca » = « feca » = « Feca »). */
function normClasse(value: string | null | undefined): string {
    return (value || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

/** Retrouve le libellé canonique d'une classe saisie, ou null si inconnue. */
export function matchDispatchClass(value: string | null | undefined): string | null {
    const n = normClasse(value);
    if (!n) return null;
    return DISPATCH_CLASSES.find((c) => normClasse(c) === n) ?? null;
}

export type DispatchEntry = {
    /** Ligne déjà formatée (ex: `• Pseudo`, `**Lead**`, `• [Cl] **Nom** 🛡️…`). */
    line: string;
    /** Classe brute stockée (peut être null/vide/inconnue → « Sans classe »). */
    classe?: string | null;
};

type DispatchGroup = { label: string; lines: string[] };

/**
 * Regroupe des lignes d'inscrits par classe. L'ordre suit DISPATCH_CLASSES,
 * « Sans classe » toujours en dernier. Les classes vides sont omises
 * (compact > grille complète façon Raid-Helper).
 */
export function groupEntriesByClass(entries: DispatchEntry[]): DispatchGroup[] {
    const buckets = new Map<string, string[]>();
    const order: string[] = [];
    for (const e of entries) {
        const label = matchDispatchClass(e.classe) ?? NO_CLASS_LABEL;
        if (!buckets.has(label)) {
            buckets.set(label, []);
            order.push(label);
        }
        buckets.get(label)!.push(e.line);
    }
    const rank = (label: string) =>
        label === NO_CLASS_LABEL ? DISPATCH_CLASSES.length : DISPATCH_CLASSES.indexOf(label);
    return order
        .sort((a, b) => rank(a) - rank(b))
        .map((label) => ({ label, lines: buckets.get(label)! }));
}

const MAX_FIELD_VALUE = 1000;

/** Tronque une valeur de field sous la limite Discord (1024) sans couper un pseudo. */
function joinLines(lines: string[]): string {
    const full = lines.join("\n");
    if (full.length <= MAX_FIELD_VALUE) return full;
    const kept: string[] = [];
    let len = 0;
    for (const line of lines) {
        if (len + line.length + 1 > MAX_FIELD_VALUE - 20) break;
        kept.push(line);
        len += line.length + 1;
    }
    return `${kept.join("\n")}\n… +${lines.length - kept.length} autres`;
}

/**
 * Construit les fields « par classe » (inline: true → 3 colonnes).
 *
 * - `emptyField` : rendu quand il n'y a aucun inscrit (ex: `*En attente…*`).
 * - `maxGroups` : budget de fields (limite Discord = 25 par embed). Au-delà,
 *   repli sur UN field plat (rendu historique) pour ne jamais casser l'envoi.
 * - `emoji` : résolveur des emojis de CLASSE (pictos Dofus uploadés comme emojis
 *   d'application, cf. `src/lib/discord-emoji-catalog.ts`). Facultatif : sans lui
 *   (ou sans synchro des emojis), le rendu reste **exactement** celui d'avant —
 *   c'est le repli unicode du catalogue qui décide, jamais ce module.
 */
export function buildClassDispatchFields(
    entries: DispatchEntry[],
    opts: { emptyField: { name: string; value: string }; maxGroups?: number; emoji?: (name: string) => string }
): any[] {
    const emojiFor = (classe: string | null | undefined): string => {
        if (!opts.emoji) return "";
        const name = classEmojiName(classe);
        return name ? opts.emoji(name) : "";
    };
    /** Une classe par ligne : le picto de classe précède le pseudo (comme sur le site). */
    const decorate = (lines: string[], classe: string | null | undefined): string[] => {
        const ref = emojiFor(classe);
        return ref ? lines.map((l) => `${ref} ${l}`) : lines;
    };

    if (entries.length === 0) {
        return [{ ...opts.emptyField, inline: false }];
    }
    const groups = groupEntriesByClass(entries);
    const maxGroups = opts.maxGroups ?? 19;
    if (groups.length > maxGroups) {
        // Repli « plat » : une entrée = une ligne, chacune avec sa propre classe.
        return [{
            name: opts.emptyField.name,
            value: joinLines(entries.map((e) => decorate([e.line], e.classe).join(""))),
            inline: false,
        }];
    }
    return groups.map((g) => ({
        name: `${g.label === NO_CLASS_LABEL ? "❔ " : ""}${g.label} (${g.lines.length})`,
        value: joinLines(decorate(g.lines, g.label)),
        inline: true,
    }));
}

/** Options du select (19 classes — sous la limite Discord de 25 options). */
export function buildClassSelectOptions(): { label: string; value: string }[] {
    return DISPATCH_CLASSES.map((c) => ({ label: c, value: c }));
}

/**
 * Rangée « Choisir ma classe… » à ajouter APRÈS la rangée de boutons
 * (jamais à la place : les boutons S'inscrire / Se désinscrire restent).
 * Une seule rangée — ne pas l'ajouter si le message a déjà 5 rangées
 * (cas multi-donjons : 5 rangées de donjons = pas de place).
 */
export function buildClassSelectRow(customId: string, placeholder: string): any {
    return {
        type: 1,
        components: [
            {
                type: 3, // String Select
                custom_id: customId,
                placeholder: placeholder.slice(0, 100),
                min_values: 1,
                max_values: 1,
                options: buildClassSelectOptions(),
            },
        ],
    };
}

/**
 * 🎫 God — formulaires Discord par catégorie.
 *
 * Les quatre catégories historiques gardent leur formulaire dédié ; une
 * catégorie créée par le God utilise le formulaire générique (sujet +
 * description). La décision se prend sur `legacyCategory`, jamais sur un
 * libellé (qui est éditable) ni sur une clé libre.
 *
 * Règle pure : la route d'interactions ne contient plus de formulaire en dur.
 */

import type { GodTicketCategoryRow } from "./god-config";

type TextInput = {
    type: 4;
    custom_id: string;
    label: string;
    style: 1 | 2;
    placeholder: string;
    required: true;
    min_length: number;
    max_length: number;
};

export type SupportModalRow = { type: 1; components: TextInput[] };

const subjectRow: TextInput = {
    type: 4,
    custom_id: "subject",
    label: "Sujet",
    style: 1,
    placeholder: "De quoi s'agit-il ?",
    required: true,
    min_length: 3,
    max_length: 100,
};

const descriptionRow: TextInput = {
    type: 4,
    custom_id: "description",
    label: "Votre message",
    style: 2,
    placeholder: "Détaillez votre demande...",
    required: true,
    min_length: 10,
    max_length: 1500,
};

export function buildSupportModalComponents(
    category: GodTicketCategoryRow
): SupportModalRow[] {
    if (category.legacyCategory === "ACCESS_REQUEST") {
        return [
            {
                type: 1,
                components: [{
                    type: 4, custom_id: "discord_guild_id",
                    label: "ID de votre serveur Discord",
                    style: 1, placeholder: "Ex: 1234567890123456789 (17-20 chiffres)",
                    required: true, min_length: 17, max_length: 20,
                }],
            },
            {
                type: 1,
                components: [{
                    type: 4, custom_id: "guild_name",
                    label: "Nom de votre guilde Dofus",
                    style: 1, placeholder: "Uniquement des lettres (Ex: Les Gardiens)",
                    required: true, min_length: 2, max_length: 50,
                }],
            },
            {
                type: 1,
                components: [{
                    type: 4, custom_id: "pseudo_dofus",
                    label: "Votre pseudo Dofus",
                    style: 1, placeholder: "Uniquement des lettres (Ex: Klyx)",
                    required: true, min_length: 2, max_length: 30,
                }],
            },
            {
                type: 1,
                components: [{
                    type: 4, custom_id: "member_count",
                    label: "Nombre de membres",
                    style: 1, placeholder: "Entre 1 et 350 (chiffres uniquement)",
                    required: true, min_length: 1, max_length: 3,
                }],
            },
            {
                type: 1,
                components: [{
                    type: 4, custom_id: "description",
                    label: "Pourquoi souhaitez-vous utiliser SigilOS ?",
                    style: 2, placeholder: "Décrivez brièvement votre guilde et vos besoins...",
                    required: true, min_length: 10, max_length: 1000,
                }],
            },
        ];
    }

    if (category.legacyCategory === "BUG_REPORT") {
        return [
            {
                type: 1,
                components: [{
                    type: 4, custom_id: "subject",
                    label: "Description courte du bug",
                    style: 1, placeholder: "Ex: Les missions ne s'affichent plus",
                    required: true, min_length: 5, max_length: 100,
                }],
            },
            {
                type: 1,
                components: [{
                    type: 4, custom_id: "page",
                    label: "Page / Fonctionnalité concernée",
                    style: 1, placeholder: "Ex: Dashboard > Missions, Bot Discord, Landing page...",
                    required: true, min_length: 3, max_length: 100,
                }],
            },
            {
                type: 1,
                components: [{
                    type: 4, custom_id: "description",
                    label: "Étapes pour reproduire + détails",
                    style: 2, placeholder: "1. Je clique sur...\n2. Je vois...\n3. Comportement attendu vs réel",
                    required: true, min_length: 10, max_length: 1500,
                }],
            },
        ];
    }

    if (category.legacyCategory === "FEATURE_REQUEST") {
        return [
            {
                type: 1,
                components: [{
                    type: 4, custom_id: "subject",
                    label: "Titre de la fonctionnalité",
                    style: 1, placeholder: "Ex: Système de classement PvP",
                    required: true, min_length: 5, max_length: 100,
                }],
            },
            {
                type: 1,
                components: [{
                    type: 4, custom_id: "description",
                    label: "Description détaillée de votre idée",
                    style: 2, placeholder: "Décrivez la fonctionnalité, son utilité, et comment vous l'imaginez...",
                    required: true, min_length: 10, max_length: 1500,
                }],
            },
        ];
    }

    return [
        { type: 1, components: [subjectRow] },
        { type: 1, components: [descriptionRow] },
    ];
}

/** Titre de modale Discord : 45 caractères maximum, sans couper un emoji. */
export function buildSupportModalTitle(category: GodTicketCategoryRow): string {
    return Array.from(`${category.emoji} ${category.label}`).slice(0, 45).join("");
}

/**
 * ⚡ Commandes slash — **payloads Discord dérivés du catalogue** (pur, testable).
 *
 * La liste des commandes vit dans `SLASH_COMMANDS_CATALOG` (une seule source).
 * Cette table ne porte que ce que Discord exige en plus : une description bornée
 * à 100 caractères et les options d'autocomplétion.
 */

import { SLASH_COMMANDS_CATALOG } from "@/lib/slash-commands-catalog";

export interface DiscordCommandOption {
    name: string;
    description: string;
    type: number;
    required?: boolean;
    autocomplete?: boolean;
    choices?: Array<{ name: string; value: string }>;
}

export interface DiscordCommandPayload {
    name: string;
    description: string;
    options?: DiscordCommandOption[];
}

const COMMAND_PRESENTATION: Record<string, { description: string; options?: DiscordCommandOption[] }> = {
    almanax: {
        description: "📅 Offrande & bonus Almanax du jour demandé",
        options: [
            {
                name: "date",
                description: "Date au format JJ/MM/AAAA (optionnel, défaut = aujourd'hui)",
                type: 3,
                required: false,
            },
        ],
    },
    profil: {
        description: "🎖️ Fiche membre : classe, succès, métiers 200, activités et planning",
        options: [
            {
                name: "membre",
                description: "Mentionner un membre (optionnel, défaut = soi-même)",
                type: 6,
                required: false,
            },
        ],
    },
    boss: {
        description: "👑 Fiche d'un Boss de donjon – PV, résistances, sorts et mécaniques",
        options: [
            {
                name: "nom",
                description: "Nom du boss (ex: Comte Harebourg, Vortex...)",
                type: 3,
                required: true,
                autocomplete: true,
            },
        ],
    },
    monstre: {
        description: "👾 Fiche d'un monstre ou archimonstre – caractéristiques, zone et butins",
        options: [
            {
                name: "nom",
                description: "Nom du monstre ou archimonstre",
                type: 3,
                required: true,
                autocomplete: true,
            },
        ],
    },
    metiers: {
        description: "🔨 Trouve qui a tel métier dans la guilde, avec les niveaux",
        options: [
            {
                name: "metier",
                description: "Nom du métier (ex: Tailleur, Mineur, Forgemage...)",
                type: 3,
                required: true,
                autocomplete: true,
            },
        ],
    },
    ocre: {
        description: "🥚 Fiche quête Ocre – zone de pop et disponibilité des doublons en guilde",
        options: [
            {
                name: "archimonstre",
                description: "Nom de l'archimonstre ou monstre d'étape",
                type: 3,
                required: true,
                autocomplete: true,
            },
        ],
    },
    "valider-recrue": {
        // Une seule option : la recrue visée. Le reste se remplit dans la modale
        // (pseudo et tag Ankama lus du profil, date du jour, recruteur = auteur).
        description: "✅ Staff — ouvre le formulaire de validation d'une recrue (registre)",
        options: [
            {
                name: "membre",
                description: "La recrue à valider — le reste se remplit dans le formulaire",
                type: 6,
                required: true,
            },
        ],
    },
};

/**
 * Payloads Discord, dérivés du catalogue.
 * Discord refuse `options: []` : la clé est omise quand il n'y a pas d'option.
 */
export function buildDiscordCommandPayloads(): DiscordCommandPayload[] {
    return SLASH_COMMANDS_CATALOG.map((command) => {
        const presentation = COMMAND_PRESENTATION[command.name];
        const payload: DiscordCommandPayload = {
            name: command.name,
            description: (presentation?.description || command.description).slice(0, 100),
        };
        if (presentation?.options && presentation.options.length > 0) {
            payload.options = presentation.options;
        }
        return payload;
    });
}

/** Commandes du catalogue **sans** présentation Discord (doit rester vide). */
export function catalogCommandsMissingPresentation(): string[] {
    return SLASH_COMMANDS_CATALOG.filter((command) => !COMMAND_PRESENTATION[command.name]).map(
        (command) => command.name
    );
}

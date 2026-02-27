/**
 * Shared constants for the Services Guilde module.
 * Separated from "use server" files since Next.js only allows
 * async function exports from server action files.
 */

// ---------------------------------------------------------------------------
// SERVICE CATEGORIES
// ---------------------------------------------------------------------------

export const CATEGORY_LABELS = {
    PASSAGE_DONJON: "Passage Donjon",
    FORGEMAGIE: "Forgemagie",
    METIER: "Métier",
    QUETE: "Quête",
    OCRE: "Quête Ocre",
    AUTRE: "Autre",
} as const;

export const CATEGORY_EMOJIS = {
    PASSAGE_DONJON: "⚔️",
    FORGEMAGIE: "🔨",
    METIER: "🛠️",
    QUETE: "📜",
    OCRE: "👑",
    AUTRE: "🔧",
} as const;

export const CATEGORY_COLORS_HEX = {
    PASSAGE_DONJON: 0x06b6d4,
    FORGEMAGIE: 0xf59e0b,
    METIER: 0x10b981,
    QUETE: 0x8b5cf6,
    OCRE: 0xeab308,
    AUTRE: 0x6b7280,
} as const;

// ---------------------------------------------------------------------------
// LOAN TYPES & STATUSES
// ---------------------------------------------------------------------------

export const LOAN_TYPE_LABELS = {
    KAMAS: "Kamas",
    STUFF: "Stuff / Équipement",
    RESSOURCES: "Ressources",
    AUTRE: "Autre",
} as const;

export const LOAN_STATUS_LABELS = {
    ACTIVE: "En cours",
    RETURNED: "Rendu",
    PARTIAL: "Partiel",
    CANCELLED: "Annulé",
} as const;

// ---------------------------------------------------------------------------
// VAULT ACTIONS
// ---------------------------------------------------------------------------

export const VAULT_ACTION_LABELS = {
    DEPOSIT: "Dépôt",
    WITHDRAW: "Retrait",
} as const;

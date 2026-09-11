/**
 * Module « Marché » — constantes partagées (libellés FR, statuts, couleurs de
 * design tokens, bornes de validation).
 *
 * ⚠️ Ce fichier n'est **pas** un server action : Next.js n'autorise que des
 * exports de fonctions async dans un fichier `"use server"`. Il est partagé
 * entre les server actions, les écrans dashboard et les embeds Discord.
 *
 * 🎨 DoD visuelle (§10.6) : aucune couleur en dur — uniquement des **tokens**
 * du design system (`text-success`, `text-warning`, `text-info`, `text-danger`).
 */

import type {
    MarketListingStatus,
    MarketListingType,
    MarketOfferStatus,
    MarketReportReason,
    MarketReportStatus,
} from "@prisma/client";
import type { FmStatus } from "@/lib/market/fm-effects";

// ---------------------------------------------------------------------------
// BORNES & DÉFAUTS (garde-fous serveur — D35 : bornes anti-débilité uniquement)
// ---------------------------------------------------------------------------

export const MARKET_LIMITS = {
    /** Max de lignes de lot par annonce (Zod §6.12). */
    MAX_COMPONENTS: 20,
    /** Max de lignes de stats déclarées par annonce (D35). */
    MAX_STATS: 30,
    /** Bornes anti-débilité d'une valeur de stat (PAS des bornes de jeu, D35). */
    STAT_VALUE_MIN: -9_999,
    STAT_VALUE_MAX: 99_999,
    TITLE_MAX: 120,
    DESCRIPTION_MAX: 2_000,
    NOTE_MAX: 500,
    /** Max de résultats renvoyés par le catalogue (budget §4.2). */
    CATALOG_PAGE_SIZE: 120,
} as const;

/** Valeurs par défaut des réglages de guilde (§9.1) — miroir du schéma Prisma. */
export const MARKET_SETTINGS_DEFAULTS = {
    marketMaxActivePerMember: 5,
    marketDefaultDurationDays: 7,
    marketMaxLifetimeDays: 20,
    marketReminderDays: [7, 15] as number[],
    marketReservationHours: 12,
    marketOfferHours: 48,
    marketNegotiationsEnabled: true,
    marketProofsEnabled: true,
    marketMediaRetentionDays: 30,
    marketLogRetentionDays: 365,
} as const;

/** Bornes des réglages (validation Zod côté serveur). */
export const MARKET_SETTINGS_BOUNDS = {
    marketMaxActivePerMember: { min: 1, max: 20 },
    marketDefaultDurationDays: { min: 1, max: 30 },
    marketMaxLifetimeDays: { min: 5, max: 60 },
    marketReservationHours: { min: 1, max: 72 },
    marketOfferHours: { min: 6, max: 168 },
    marketMediaRetentionDays: { min: 7, max: 180 },
    marketLogRetentionDays: { min: 30, max: 730 },
} as const;

// ---------------------------------------------------------------------------
// LIBELLÉS
// ---------------------------------------------------------------------------

export const MARKET_TYPE_LABELS: Record<MarketListingType, string> = {
    EQUIPMENT: "Équipement",
    RESOURCE: "Ressources",
    SERVICE: "Service",
    WANTED: "Recherche",
};

export const MARKET_STATUS_LABELS: Record<MarketListingStatus, string> = {
    DRAFT: "Brouillon",
    ACTIVE: "Disponible",
    RESERVED: "Réservé",
    SOLD: "Vendu",
    EXPIRED: "Expiré",
    WITHDRAWN: "Retiré",
};

/**
 * Classe Tailwind (token du design system) associée à un statut.
 * `DRAFT`/`WITHDRAWN`/`EXPIRED` sont volontairement neutres.
 */
export const MARKET_STATUS_CLASSES: Record<MarketListingStatus, string> = {
    DRAFT: "text-muted-foreground border-border bg-muted/20",
    ACTIVE: "text-success border-success/30 bg-success/10",
    RESERVED: "text-warning border-warning/30 bg-warning/10",
    SOLD: "text-info border-info/30 bg-info/10",
    EXPIRED: "text-muted-foreground border-border bg-muted/20",
    WITHDRAWN: "text-danger border-danger/30 bg-danger/10",
};

/**
 * États d'une offre (§11.4) — écran **privé** (mes espaces) : « refusée » est
 * toujours **motivé côté serveur**, jamais deviné ici (§0.1).
 */
export const MARKET_OFFER_STATUS_LABELS: Record<MarketOfferStatus, string> = {
    PENDING: "En attente",
    ACCEPTED: "Acceptée",
    DECLINED: "Refusée",
    CANCELLED: "Retirée",
    EXPIRED: "Expirée",
};

/** Classe Tailwind (token du design system) associée à un état d'offre. */
export const MARKET_OFFER_STATUS_CLASSES: Record<MarketOfferStatus, string> = {
    PENDING: "text-warning border-warning/30 bg-warning/10",
    ACCEPTED: "text-success border-success/30 bg-success/10",
    DECLINED: "text-danger border-danger/30 bg-danger/10",
    CANCELLED: "text-muted-foreground border-border bg-muted/20",
    EXPIRED: "text-muted-foreground border-border bg-muted/20",
};

/**
 * Motifs de signalement d'une annonce (§6.9) — ordre d'affichage du formulaire,
 * repris tel quel par la validation Zod (une seule liste, jamais deux).
 */
export const MARKET_REPORT_REASONS = [
    "JET_MISMATCH",
    "SELLER_UNREACHABLE",
    "BUYER_ABSENT",
    "SUSPICIOUS",
    "FORBIDDEN",
    "OTHER",
] as const;

export const MARKET_REPORT_REASON_LABELS: Record<MarketReportReason, string> = {
    JET_MISMATCH: "Le jet ne correspond pas à l'annonce",
    SELLER_UNREACHABLE: "Vendeur injoignable",
    BUYER_ABSENT: "Acheteur absent au rendez-vous",
    SUSPICIOUS: "Annonce suspecte",
    FORBIDDEN: "Objet ou service interdit",
    OTHER: "Autre motif",
};

export const MARKET_REPORT_STATUS_LABELS: Record<MarketReportStatus, string> = {
    OPEN: "À traiter",
    REVIEWED: "En cours",
    CLOSED: "Clôturé",
};

export const MARKET_REPORT_STATUS_CLASSES: Record<MarketReportStatus, string> = {
    OPEN: "text-warning border-warning/30 bg-warning/10",
    REVIEWED: "text-info border-info/30 bg-info/10",
    CLOSED: "text-muted-foreground border-border bg-muted/20",
};

export const MARKET_QUALITY_LABELS = {
    LOW: "Sous la plage",
    NORMAL: "Normal",
    GOOD: "Bon",
    PERFECT: "Parfait",
    OVER: "Over (hors plage)",
} as const;

/** Couleur d'une qualité — over/perfection en accent, jamais de refus (D34). */
export const MARKET_QUALITY_CLASSES = {
    LOW: "text-warning",
    NORMAL: "text-muted-foreground",
    GOOD: "text-success",
    PERFECT: "text-success",
    OVER: "text-info",
} as const;

/** Origine du jet : EXO = habillage violet clair (jamais bloqué, D34). */
export const MARKET_ORIGIN_LABELS = {
    NATIVE: "Natif",
    EXO: "Exotique",
} as const;

export const MARKET_ORIGIN_CLASSES = {
    NATIVE: "",
    EXO: "text-info",
} as const;

// ---------------------------------------------------------------------------
// FM (Forge de Magie) — étiquettes enrichies (§12.8)
// ---------------------------------------------------------------------------
// ⚠️ Purement **affichage** : la base ne stocke que `MarketStatQuality` (D17).
// Un malus, un exo ou un jet atypique ne bloque JAMAIS une annonce (D34/D35).

/** Libellés FR des étiquettes FM calculées par `getFmStatus()`. */
export const MARKET_FM_STATUS_LABELS: Record<FmStatus, string> = {
    MALUS: "Malus",
    EXO: "Exo",
    A_VERIFIER: "À vérifier",
    OVER: "Over",
    PARFAIT: "Parfait",
    BON: "Bon",
    FAIBLE: "Faible",
};

/** Couleur (token du design system) d'une étiquette FM. */
export const MARKET_FM_STATUS_CLASSES: Record<FmStatus, string> = {
    MALUS: "text-danger",
    EXO: "text-info",
    A_VERIFIER: "text-warning",
    OVER: "text-info",
    PARFAIT: "text-success",
    BON: "text-success",
    FAIBLE: "text-muted-foreground",
};

// ---------------------------------------------------------------------------
// ACTIONS JOURNALISÉES (jamais de chaîne libre dans MarketAuditLog)
// ---------------------------------------------------------------------------

export const MARKET_AUDIT_ACTIONS = {
    LISTING_CREATED: "LISTING_CREATED",
    LISTING_UPDATED: "LISTING_UPDATED",
    LISTING_PUBLISHED: "LISTING_PUBLISHED",
    LISTING_RENEWED: "LISTING_RENEWED",
    LISTING_WITHDRAWN: "LISTING_WITHDRAWN",
    LISTING_EXPIRED: "LISTING_EXPIRED",
    LISTING_SOLD: "LISTING_SOLD",
    LISTING_DELETED: "LISTING_DELETED",
    /**
     * S5.1 — archivage automatique : l'annonce a atteint son échéance J+20 sans
     * aucune activité. Distinct de `LISTING_DELETED` (retrait humain vendeur/modo)
     * pour que le journal permette de séparer les deux causes (§11.10).
     */
    LISTING_AUTO_DELETED: "LISTING_AUTO_DELETED",
    LISTING_TAKEN_DOWN: "LISTING_TAKEN_DOWN",
    LISTING_RESTORED: "LISTING_RESTORED",
    RESERVATION_CREATED: "RESERVATION_CREATED",
    RESERVATION_CANCELLED_BUYER: "RESERVATION_CANCELLED_BUYER",
    RESERVATION_CANCELLED_SELLER: "RESERVATION_CANCELLED_SELLER",
    RESERVATION_EXPIRED: "RESERVATION_EXPIRED",
    OFFER_CREATED: "OFFER_CREATED",
    OFFER_ACCEPTED: "OFFER_ACCEPTED",
    OFFER_DECLINED: "OFFER_DECLINED",
    OFFER_CANCELLED: "OFFER_CANCELLED",
    OFFER_COUNTERED: "OFFER_COUNTERED",
    OFFER_EXPIRED: "OFFER_EXPIRED",
    LISTING_REPORTED: "LISTING_REPORTED",
    REPORT_REVIEWED: "REPORT_REVIEWED",
    DISCORD_SYNC_FAILED: "DISCORD_SYNC_FAILED",
    DISCORD_SYNC_RESTORED: "DISCORD_SYNC_RESTORED",
    IMAGE_REGENERATED: "IMAGE_REGENERATED",
    MEDIA_PURGED: "MEDIA_PURGED",
    CONFIG_UPDATED: "CONFIG_UPDATED",
} as const;

export type MarketAuditAction =
    (typeof MARKET_AUDIT_ACTIONS)[keyof typeof MARKET_AUDIT_ACTIONS];

/** Motifs de suppression (soft-delete traçable). */
export const MARKET_DELETE_REASONS = {
    AUTO_EXPIRED: "AUTO_EXPIRED",
    SELLER: "SELLER",
    MODERATION: "MODERATION",
    GUILD: "GUILD",
} as const;

/** Types de salon Discord détectés (D19). */
export const MARKET_CHANNEL_KINDS = {
    TEXT: "TEXT",
    FORUM: "FORUM",
} as const;

/**
 * Ordre d'affichage des statuts dans le catalogue : les annonces exploitables
 * d'abord (ACTIVE, RESERVED), puis le reste.
 */
export const MARKET_STATUS_ORDER: MarketListingStatus[] = [
    "ACTIVE",
    "RESERVED",
    "DRAFT",
    "EXPIRED",
    "SOLD",
    "WITHDRAWN",
];

/** Statuts considérés comme « terminés » (archives de « Mes espaces »). */
export const MARKET_TERMINAL_STATUSES: MarketListingStatus[] = [
    "SOLD",
    "EXPIRED",
    "WITHDRAWN",
];

/** Transitions autorisées (§11.1) — toute autre transition est refusée. */
export const MARKET_ALLOWED_TRANSITIONS: Record<MarketListingStatus, MarketListingStatus[]> = {
    DRAFT: ["ACTIVE", "WITHDRAWN"],
    ACTIVE: ["RESERVED", "EXPIRED", "WITHDRAWN"],
    RESERVED: ["ACTIVE", "SOLD", "WITHDRAWN"],
    SOLD: [],
    EXPIRED: ["ACTIVE", "WITHDRAWN"],
    WITHDRAWN: ["ACTIVE"],
};

/** `true` si la transition de statut est autorisée (§11.1). */
export function isMarketTransitionAllowed(
    from: MarketListingStatus,
    to: MarketListingStatus
): boolean {
    return (MARKET_ALLOWED_TRANSITIONS[from] || []).includes(to);
}


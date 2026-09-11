/**
 * Module « Marché » — payload Discord par état (S3.1).
 *
 * ⚠️ Fichier **PUR** (aucune dépendance réseau / Prisma / React). Il construit
 * l'embed et les boutons pour **chaque** transition de statut, une seule fois,
 * et il est **testé** (`tests/unit/market-discord-payload.test.ts`).
 *
 * Contrat (spec §13.2/§13.3, D35) : **aucun montant d'offre ni pseudo d'acheteur
 * n'est jamais public** — seul un **compteur** d'offres l'est. Les boutons
 * Rèserver/Offre sont **désactivés** (jamais retirés) en `RESERVED`.
 */

import { formatKamas } from "@/lib/market/kamas";

export type MarketDiscordStatus = "DRAFT" | "ACTIVE" | "RESERVED" | "SOLD" | "EXPIRED" | "WITHDRAWN";

/** Couleurs d'embed par état (§13.2). */
export const MARKET_DISCORD_COLORS: Record<MarketDiscordStatus, number> = {
    DRAFT: 0x71717a, // gris
    ACTIVE: 0xd4af37, // doré
    RESERVED: 0xf59e0b, // orange
    SOLD: 0x10b981, // vert
    EXPIRED: 0x71717a, // gris
    WITHDRAWN: 0x71717a, // gris
};

export const MARKET_DISCORD_STATUS_LABELS: Record<MarketDiscordStatus, string> = {
    DRAFT: "Brouillon",
    ACTIVE: "Disponible",
    RESERVED: "Réservé",
    SOLD: "Vendu",
    EXPIRED: "Expiré",
    WITHDRAWN: "Retiré",
};

export type MarketDiscordPayloadInput = {
    listingId: string;
    title: string;
    status: MarketDiscordStatus;
    /** Pseudo Dofus du vendeur (jamais l'ID Discord, jamais de mention publique). */
    sellerName: string;
    serverName?: string | null;
    itemName?: string | null;
    itemLevel?: number | null;
    itemTypeName?: string | null;
    priceKamas?: number | null;
    unitLabel?: string | null;
    negotiable: boolean;
    /** Compteur public d'offres en cours (jamais les montants). */
    offersCount?: number;
    /** Libellés des lignes exotiques (« Exo PA »…). */
    exoLabels?: string[];
    /** Contenu du lot (affiché à 5 lignes max + « + N autres »). */
    components?: { name: string; quantity: number }[];
    /** URL absolue de la carte PNG générée (optionnelle : publication sans image OK). */
    imageUrl?: string | null;
    /** URL absolue de la fiche SigilOS (bouton lien). */
    dashboardUrl: string;
    /** Mode forum : l'image objet va en `thumbnail`, pas de carte en `image`. */
    forumMode?: boolean;
    /** URL absolue de l'icône objet (mode forum → thumbnail). */
    itemIconUrl?: string | null;
};

export type MarketDiscordField = { name: string; value: string; inline?: boolean };

export type MarketDiscordPayload = {
    embedTitle: string;
    embedDescription: string;
    embedColor: number;
    embedFooter: string;
    embedImage?: string;
    embedThumbnail?: string;
    fields: MarketDiscordField[];
    /** Boutons (max 4 — contrainte Discord). */
    components: Array<{ type: 1; components: Array<Record<string, unknown>> }>;
};

/** Id court lisible d'une annonce (footer, nom de post forum). */
export function shortListingId(listingId: string): string {
    return listingId.slice(-6).toUpperCase();
}

/** Phrase de jet dérivée des exos éventuels (jamais de jugement de faisabilité). */
function buildExoBadge(exoLabels: string[] | undefined): string | null {
    if (!exoLabels || exoLabels.length === 0) return null;
    return `★ Exo ${exoLabels.join(" · ")}`;
}

/**
 * Construit le payload complet (embed + boutons) pour un état donné.
 * Toujours appelé côté serveur ; **jamais** de donnée privée dans l'embed.
 */
export function buildMarketDiscordPayload(input: MarketDiscordPayloadInput): MarketDiscordPayload {
    const {
        listingId,
        title,
        status,
        sellerName,
        serverName,
        itemName,
        itemLevel,
        itemTypeName,
        priceKamas,
        unitLabel,
        negotiable,
        offersCount = 0,
        exoLabels,
        components: lotComponents,
        imageUrl,
        dashboardUrl,
        forumMode,
        itemIconUrl,
    } = input;

    const priceLabel = formatKamas(priceKamas ?? null);
    const exoBadge = buildExoBadge(exoLabels);

    // ── Titre & description ──────────────────────────────────────────────────
    const headName = itemName || title;
    const embedTitle = `${headName} — ${priceLabel}`;

    const descriptionLines: string[] = [];
    if (itemLevel) {
        descriptionLines.push(`**Niveau ${itemLevel}**${itemTypeName ? ` · ${itemTypeName}` : ""}`);
    } else if (itemTypeName) {
        descriptionLines.push(`**${itemTypeName}**`);
    }
    if (unitLabel) descriptionLines.push(`Lot : ${unitLabel}`);
    if (exoBadge) descriptionLines.push(exoBadge);

    if (lotComponents && lotComponents.length > 0) {
        const visible = lotComponents.slice(0, 5).map((c) => `• ${c.quantity.toLocaleString("fr-FR")} × ${c.name}`);
        const extra = lotComponents.length > 5 ? `\n*+ ${lotComponents.length - 5} autre(s) ressource(s)*` : "";
        descriptionLines.push(`**Contenu du lot :**\n${visible.join("\n")}${extra}`);
    }

    // ── Fields (3) ───────────────────────────────────────────────────────────
    const fields: MarketDiscordField[] = [
        { name: "Statut", value: MARKET_DISCORD_STATUS_LABELS[status], inline: true },
        { name: "Négociable", value: negotiable ? "Oui" : "Non", inline: true },
        { name: "Offres", value: `${offersCount} en cours`, inline: true },
    ];

    // ── Boutons ──────────────────────────────────────────────────────────────
    const actionsDisabled = status !== "ACTIVE";
    const buttons: Array<Record<string, unknown>> = [
        {
            type: 2,
            style: 3,
            label: "Réserver au prix",
            custom_id: `mkt:reserve:${listingId}`,
            disabled: actionsDisabled,
        },
        {
            type: 2,
            style: 1,
            label: "Faire une offre",
            custom_id: `mkt:offer:${listingId}`,
            // §13.5 : l'offre exige une annonce `ACTIVE` ET négociable.
            disabled: actionsDisabled || !negotiable,
        },
        {
            type: 2,
            style: 2,
            label: "Contacter",
            custom_id: `mkt:contact:${listingId}`,
            disabled: status === "SOLD",
        },
        { type: 2, style: 5, label: "Voir sur SigilOS", url: dashboardUrl },
    ];

    const author = serverName ? `Vendeur : ${sellerName} • ${serverName}` : `Vendeur : ${sellerName}`;

    return {
        embedTitle,
        embedDescription: `${author}\n${descriptionLines.join("\n")}`.trim(),
        embedColor: MARKET_DISCORD_COLORS[status],
        embedFooter: `SigilOS Market • Annonce #${shortListingId(listingId)}`,
        // Mode forum : icône objet en thumbnail, pas de carte générée.
        embedThumbnail: forumMode ? (itemIconUrl ?? undefined) : undefined,
        embedImage: forumMode ? undefined : (imageUrl ?? undefined),
        fields,
        components: [{ type: 1, components: buttons }],
    };
}

/** Nom de post forum (100 caractères max, jamais de mention). */
export function buildForumPostName(input: MarketDiscordPayloadInput): string {
    const headName = input.itemName || input.title;
    const exoBadge = buildExoBadge(input.exoLabels);
    const raw = `${headName} — ${formatKamas(input.priceKamas ?? null)}${exoBadge ? ` · ${exoBadge}` : ""}`;
    return raw.replace(/\s+/g, " ").trim().slice(0, 100);
}


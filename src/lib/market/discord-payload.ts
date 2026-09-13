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
 *
 * S4.6 — le 4ᵉ bouton est toujours le **lien** « Voir sur SigilOS » vers la fiche
 * dashboard : sa forme (`style: 5`, URL, libellé) vient de
 * `buildMarketDashboardLinkButton()` (`discord-interactions.ts`), partagée avec
 * les réponses éphémères de S4.5 ⇒ une seule définition du bouton dans le module.
 */

import { formatKamas } from "@/lib/market/kamas";
import {
    MARKET_DASHBOARD_LINK_LABEL,
    buildMarketDashboardLinkButton,
    type MarketComponentRow,
} from "@/lib/market/discord-interactions";

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
    /**
     * Correction 13/09 — **lignes de jet** publiées dans l'embed (tous modes) :
     * l'objet se lisait sans ses stats, ce qui rendait l'annonce inutile.
     */
    stats?: MarketDiscordStatLine[];
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
    components: MarketComponentRow[];
};

/** Ligne de jet telle que publiée dans l'embed (S3.1 + correction 13/09). */
export type MarketDiscordStatLine = {
    label: string;
    actualValue: number;
    naturalMin?: number | null;
    naturalMax?: number | null;
    /** `NATIVE` | `EXO` — un exo est **marqué** dans l'embed (Discord n'a pas de couleur de texte). */
    origin?: string | null;
};

/**
 * Correction 13/09 — **le jet est publié** dans l'embed.
 *
 * Constat user : l'annonce Discord n'affichait aucune ligne de stats (seul le
 * badge d'exo), alors que l'objet en porte (et que la carte PNG, elle, les
 * montre). Discord n'acceptant ni couleur de texte ni icône d'asset dans un
 * embed, la ligne reprend la forme de la carte :
 *   `✦ Exo **1** PM [1]` · `**348** Vitalité [301 à 350]` · `**-8** Esquive PA [-6 à -8]`.
 */
export function formatMarketStatLine(stat: MarketDiscordStatLine): string {
    const sign = stat.actualValue >= 0 ? "+" : "";
    const range = formatNativeRangeText(stat.naturalMin, stat.naturalMax);
    const exoPrefix = stat.origin === "EXO" ? "✦ Exo " : "";
    return `${exoPrefix}**${sign}${stat.actualValue}** ${stat.label}${range ? ` ${range}` : ""}`;
}

/** Plage native lisible (« [301 à 350] », « [1] ») — même règle que la carte. */
function formatNativeRangeText(min: number | null | undefined, max: number | null | undefined): string {
    if (min == null && max == null) return "";
    const from = min ?? (max as number);
    const to = max ?? (min as number);
    return from === to ? `[${from}]` : `[${from} à ${to}]`;
}

/** Id court lisible d'une annonce (footer, nom de post forum). */
export function shortListingId(listingId: string): string {
    return listingId.slice(-6).toUpperCase();
}

/**
 * Correction 13/09 — **URL absolue obligatoire** pour Discord.
 *
 * Constat user : la publication en salon **forum** échouait avec
 * `400 Invalid Form Body / thumbnail.url : Not a well formed URL` (code 50035),
 * car `MarketListing.itemIconUrl` est un chemin **local**
 * (`/api/assets-dofus/items/14091`) et Discord n'accepte que `http(s)://`.
 * Une icône inexploitable est **omise** : mieux vaut un post sans vignette
 * qu'un échec de publication (la resynchro n'est jamais bloquante, S3).
 *
 * ⚠️ Fonction **pure** (testée) : la base d'URL est injectée par l'appelant.
 */
export function absoluteDiscordAssetUrl(
    url: string | null | undefined,
    baseUrl: string
): string | null {
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    const base = baseUrl.replace(/\/+$/, "");
    if (!/^https?:\/\//i.test(base)) return null;
    return url.startsWith("/") ? `${base}${url}` : `${base}/${url}`;
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
        stats = [],
    } = input;

    const priceLabel = formatKamas(priceKamas ?? null);
    const exoBadge = buildExoBadge(exoLabels);

    // ── Titre & description ──────────────────────────────────────────────────
    const headName = itemName || title;
    // Correction 13/09 — sans prix, le titre ne doit PAS finir par « — — »
    // (constat user) : `formatKamas(null)` renvoie un tiret de remplacement.
    const embedTitle = priceKamas != null ? `${headName} — ${priceLabel}` : headName;

    const descriptionLines: string[] = [];
    if (itemLevel) {
        descriptionLines.push(`**Niveau ${itemLevel}**${itemTypeName ? ` · ${itemTypeName}` : ""}`);
    } else if (itemTypeName) {
        descriptionLines.push(`**${itemTypeName}**`);
    }
    if (unitLabel) descriptionLines.push(`Lot : ${unitLabel}`);
    if (exoBadge) descriptionLines.push(exoBadge);

    // Correction 13/09 — **EFFETS** : le jet déclaré, tel qu'il apparaît sur la
    // carte (valeur + libellé + plage native), exo marqué « ✦ Exo », malus en
    // négatif. Discord limite un embed à **4096** caractères : on publie les
    // **20** premières lignes et on résume le reste (jamais de description muette).
    if (stats.length > 0) {
        const visible = stats.slice(0, 20).map(formatMarketStatLine);
        const extra =
            stats.length > 20 ? `\n*+ ${stats.length - 20} autre(s) ligne(s) de jet*` : "";
        descriptionLines.push(`**EFFETS**\n${visible.join("\n")}${extra}`);
    }

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
        // S4.6 — bouton **lien** vers la fiche SigilOS (jamais de `custom_id` :
        // Discord l'interdit sur un lien), forme partagée avec les réponses
        // éphémères de S4.5.
        buildMarketDashboardLinkButton(dashboardUrl, MARKET_DASHBOARD_LINK_LABEL),
    ];

    const author = serverName ? `Vendeur : ${sellerName} • ${serverName}` : `Vendeur : ${sellerName}`;

    return {
        embedTitle,
        embedDescription: `${author}\n${descriptionLines.join("\n")}`.trim(),
        embedColor: MARKET_DISCORD_COLORS[status],
        embedFooter: `SigilOS Market • Annonce #${shortListingId(listingId)}`,
        // Mode forum : l'icône objet part en **thumbnail** ET la carte PNG en
        // **image** (correction 13/09) — sans elle, le post ne montrait ni les
        // icônes officielles ni les couleurs (exo, malus) du jet.
        embedThumbnail: forumMode ? (itemIconUrl ?? undefined) : undefined,
        embedImage: imageUrl ?? undefined,
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


/**
 * Module « Marché » — payload Discord par état (S3.1).
 *
 * ⚠️ Fichier **PUR** (aucune dépendance réseau / Prisma / React). Il construit
 * l'embed et les boutons pour **chaque** transition de statut, une seule fois,
 * et il est **testé** (`tests/unit/market-discord-payload.test.ts`).
 *
 * Contrat (spec §13.2/§13.3, D35) : **aucun montant d'offre ni pseudo d'acheteur
 * n'est jamais public** — seul un **compteur** d'offres l'est. Les boutons sont
 * **désactivés** (jamais retirés) quand leur action n'est pas possible :
 * « Réserver au prix » sur une annonce non `ACTIVE`, « Faire une offre »
 * uniquement sur un état terminal ou non négociable (BUG-3 / R3 : une annonce
 * `RESERVED` reste **négociable**).
 *
 * S4.6 — le 4ᵉ bouton est toujours le **lien** « Voir sur SigilOS » vers la fiche
 * dashboard : sa forme (`style: 5`, URL, libellé) vient de
 * `buildMarketDashboardLinkButton()` (`discord-interactions.ts`), partagée avec
 * les réponses éphémères de S4.5 ⇒ une seule définition du bouton dans le module.
 */

import { formatKamas } from "@/lib/market/kamas";
import { SMITHMAGIC_POTION_TIERS, describeSmithmagicStatus } from "@/lib/market/smithmagic";
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
     * BUG-5 (spec §2.4) — **le jet n'est plus listé en texte** : il vit
     * entièrement dans la **carte image** (`/api/og/market/[id]`) avec les
     * icônes officielles et les couleurs over / exo / malus / max.
     * Le champ est conservé **à `undefined`** pour ne jamais casser un appelant
     * historique : la description ne contient plus aucune ligne de statistique.
     */
    stats?: never;
    /**
     * S8.17 (D40/D41) — **forge réelle déclarée** : Transcendé, élément de frappe
     * (+ palier de potion) et arme de chasse. Ce sont des données **déclarées**
     * par le vendeur (jamais déduites du jet) et **jamais identifiantes**
     * (§13.7 : aucune donnée personnelle dans un contenu public).
     */
    transcended?: boolean;
    transcendenceLabel?: string | null;
    strikeElement?: string | null;
    elementPotionTier?: number | null;
    huntingWeapon?: string | null;
    /**
     * D43 — `acceptsTrade` lu sur l'annonce : `true` ⇒ « Troc accepté »,
     * `false` ⇒ « Kamas uniquement ». Absent ⇒ aucune ligne (annonces
     * historiques / aperçus sans contexte).
     */
    acceptsTrade?: boolean;
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
 * BUG-5 (spec §2.4) — **plus aucune statistique en texte dans l'embed** : tout
 * est embarqué dans l'image de la carte (`/api/og/market/[id]`), rendue le jour
 * de la publication. Discord n'affiche ni icône d'asset ni couleur de texte :
 * un embed « texte » ne pouvait donc jamais ressembler à la tooltip Dofus.
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

/**
 * Constat beta (14/09/2026) — **la carte image n'a de sens que s'il y a un jet**.
 *
 * Constat user : « Les embeds des items de type Cosmétique / Ressources-Autres
 * ne génèrent pas l'image dans l'embed, ça ne sert à rien — uniquement utile
 * pour les items de type équipement : affiche juste en grand la miniature de
 * l'item. » (la carte d'un lot montrait en plus un cadre **vide**, faute
 * d'`ankamaId` sur l'annonce).
 *
 * Règle : **un jet réellement déclaré** (au moins une ligne porteuse, cf.
 * `isStatBearingStatRow`) ⇒ carte PNG `/api/og/market/[id]` (tooltip Dofus :
 * effets, couleurs, prix) ; sinon (lot, cosmétique, vente brute) ⇒ **l'image de
 * l'objet** en grand, posée directement comme image de l'embed — plus de carte
 * inutile à générer, plus de cadre vide.
 *
 * ⚠️ Fonction **pure** (testée) : les URL absolues sont résolues par l'appelant.
 * Jamais d'image vide : si la source préférée manque, on retombe sur l'autre.
 */
export function pickMarketEmbedImage(options: {
    /** Carte PNG générée (`/api/og/market/[id]`), absolue — `null` si indisponible. */
    cardImageUrl: string | null;
    /** Image de l'objet (absolue, 1ᵉʳ composant du lot si l'annonce n'a pas d'icône). */
    itemImageUrl: string | null;
    /** `true` si l'annonce porte un jet déclaré. */
    hasDeclaredJet: boolean;
}): string | null {
    const preferred = options.hasDeclaredJet ? options.cardImageUrl : options.itemImageUrl;
    return preferred ?? options.cardImageUrl ?? options.itemImageUrl ?? null;
}

/** Phrase de jet dérivée des exos éventuels (jamais de jugement de faisabilité). */
function buildExoBadge(exoLabels: string[] | undefined): string | null {
    if (!exoLabels || exoLabels.length === 0) return null;
    return `★ Exo ${exoLabels.join(" · ")}`;
}

/**
 * S8.17 — palier de potion **borné** aux 3 paliers de jeu (50 / 65 / 80 %).
 * Une valeur hors référentiel est **ignorée** : jamais un « potion 0 % » publié
 * (RULES.md § *Bornes validation* — toute donnée issue d'une API externe / d'une
 * saisie est bornée avant affichage).
 */
export function resolvePotionTierLabel(tier: number | null | undefined): string | null {
    if (typeof tier !== "number") return null;
    return (SMITHMAGIC_POTION_TIERS as readonly number[]).includes(tier) ? `potion ${tier} %` : null;
}

/**
 * S8.17 — lignes du bloc **STATUT** de l'embed : Transcendé, élément de frappe
 * (+ palier de potion), arme de chasse, puis « Troc accepté » / « Kamas
 * uniquement » (D43).
 *
 * 📌 Source **unique** du mapping : `describeSmithmagicStatus()` (pur, testé,
 * déjà consommé par la carte d'item S8.4) ⇒ carte et embed ne peuvent pas
 * diverger. Retourne `[]` quand rien n'est déclaré.
 */
export function buildMarketStatusLines(input: {
    transcended?: boolean;
    transcendenceLabel?: string | null;
    strikeElement?: string | null;
    elementPotionTier?: number | null;
    huntingWeapon?: string | null;
    acceptsTrade?: boolean;
}): string[] {
    const lines = describeSmithmagicStatus({
        transcended: input.transcended,
        transcendenceLabel: input.transcendenceLabel,
        strikeElement: input.strikeElement,
        huntingWeapon: input.huntingWeapon,
    }).map((line) => {
        // `TRANSCENDED` porte son libellé d'effet (repli « Empêche les futures
        // forgemagies ») : il s'affiche tel quel, comme sur la carte.
        if (!line.value) return line.label;
        if (line.kind !== "STRIKE_ELEMENT") return `${line.label} : ${line.value}`;
        const tier = resolvePotionTierLabel(input.elementPotionTier);
        return `${line.label} : ${line.value}${tier ? ` — ${tier}` : ""}`;
    });

    if (input.acceptsTrade !== undefined) {
        lines.push(input.acceptsTrade ? "Troc accepté" : "Kamas uniquement");
    }
    return lines;
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
        transcended,
        transcendenceLabel,
        strikeElement,
        elementPotionTier,
        huntingWeapon,
        acceptsTrade,
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

    // S8.17 — **STATUT** de forge (Transcendé / élément de frappe + palier /
    // arme de chasse) puis « Troc accepté » ou « Kamas uniquement » (D43).
    // Mêmes libellés que la carte d'item : une seule source (S8.4). Borné à
    // 4 lignes ⇒ l'embed reste très en deçà des 4096 caractères de Discord.
    const statusLines = buildMarketStatusLines({
        transcended,
        transcendenceLabel,
        strikeElement,
        elementPotionTier,
        huntingWeapon,
        acceptsTrade,
    });
    if (statusLines.length > 0) {
        descriptionLines.push(`**STATUT**\n${statusLines.join("\n")}`);
    }

    // BUG-5 (spec §2.4) — **aucune ligne de statistique ici** : le jet complet
    // (icônes officielles, couleurs over / exo / malus / max, plage native,
    // badges) est embarqué dans la **carte image**, posée dès la publication.
    // L'embed ne porte que ce qu'une image ne peut pas dire utilement.

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
    /**
     * BUG-3 (R3, ratifié) — « Réserver au prix » exige une annonce `ACTIVE`
     * (une seule réservation à la fois), mais « **Faire une offre** » reste
     * **ouvert** sur une annonce `RESERVED` : on peut toujours proposer un prix.
     * Le vendeur, lui, doit **lever la réservation** avant d'accepter une offre
     * (garde serveur `RESERVATION_ACTIVE`) — aucune reprise silencieuse.
     */
    const reserveDisabled = status !== "ACTIVE";
    const offerDisabled = !["ACTIVE", "RESERVED"].includes(status) || !negotiable;
    const buttons: Array<Record<string, unknown>> = [
        {
            type: 2,
            style: 3,
            label: "Réserver au prix",
            custom_id: `mkt:reserve:${listingId}`,
            disabled: reserveDisabled,
        },
        {
            type: 2,
            style: 1,
            label: "Faire une offre",
            custom_id: `mkt:offer:${listingId}`,
            // §13.5 : l'offre exige une annonce négociable et non terminale.
            disabled: offerDisabled,
        },
        // BUG-8 — l'acheteur qui a réservé au prix doit pouvoir **revenir en
        // arrière** : le bouton « Me désister » n'existe QUE sur une annonce
        // `RESERVED` (jamais un bouton mort dans les autres états).
        ...(status === "RESERVED"
            ? [
                  {
                      type: 2,
                      style: 4,
                      label: "Me désister",
                      custom_id: `mkt:cancel:${listingId}`,
                      disabled: false,
                  },
              ]
            : []),
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
        /**
         * BUG-4 (constat beta) — la **miniature est toujours renseignée** quand
         * une icône exploitable existe (objet, sinon 1ᵉʳ composant du lot) :
         * l'embed affiche l'objet en haut à droite **dès la publication**, sans
         * dépendre du chargement de la carte PNG (qui reste l'`image`, y compris
         * en salon forum — correctif BUG-5 du 13/09).
         */
        embedThumbnail: itemIconUrl ?? undefined,
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


/**
 * Module « Marché » — interactions Discord (S4.1).
 *
 * ⚠️ Fichier **PUR** (ni Prisma, ni React, ni réseau) → testé par
 * `tests/unit/market-discord-interactions.test.ts`.
 *
 * Contrat §13.4 : la route `/api/discord/interactions` ne contient **aucune
 * règle métier**. Ce fichier porte les trois éléments décidables sans base :
 *   1. le **parsing fail-closed** des `custom_id` du marché, produits par les
 *      boutons de l'annonce (`mkt:<action>:<listingId>`, §13.3) ;
 *   2. le **catalogue des messages éphémères** (§13.5) : un membre reçoit
 *      **toujours** une explication, succès comme refus, jamais de silence ;
 *   3. la **construction d'URL** de la fiche SigilOS et du **bouton lien**
 *      (`style: 5`), partagés par l'annonce publique (§13.3) et par les
 *      réponses éphémères (§13.5) ;
 *   4. la **lecture + le nettoyage** des 3 champs de la modale d'offre (S4.4),
 *      réutilisés par le formulaire du dashboard (une seule normalisation).
 *
 * Rien ici ne connaît la base : la guilde, le module actif et les actions
 * vivent dans `src/server/market/discord-interactions.ts`.
 */

import { KAMAS_MAX, parseKamas } from "@/lib/market/kamas";
import { sanitizeMarketText } from "@/lib/market/text";

/** Préfixe de toutes les interactions du marché (cf. `DISCORD_PERM_MAP.mkt`). */
export const MARKET_INTERACTION_PREFIX = "mkt";

/** Actions portées par les boutons de l'annonce (§13.3 + BUG-8). */
export type MarketInteractionAction = "reserve" | "offer" | "cancel";

/** `custom_id` du marché une fois validé. */
export type MarketCustomId = {
    action: MarketInteractionAction;
    listingId: string;
    /**
     * 🧺 **Option A** — objet visé quand le bouton vient d'un **message par objet**
     * (`mkt:<action>:<listingId>:<componentId>`). `undefined` = bouton d'une annonce
     * entière (message historique ou annonce simple).
     */
    componentId?: string;
};

/**
 * Champ texte d'une modale Discord (`ActionRow` + `TextInput`).
 *
 * Discord impose **exactement un** composant par ligne (`type: 1`) et au plus
 * **5 lignes** par modale (§13.5 : 3 champs).
 */
export type MarketModalComponent = {
    type: 1;
    components: Array<{
        type: 4;
        custom_id: string;
        label: string;
        style: 1 | 2;
        required: boolean;
        max_length: number;
        placeholder?: string;
    }>;
};

/** Contenu de `data` d'une réponse Discord **type 9** (modale). */
export type MarketModalPayload = {
    custom_id: string;
    title: string;
    components: MarketModalComponent[];
};

const MARKET_INTERACTION_ACTIONS: readonly MarketInteractionAction[] = ["reserve", "offer", "cancel"];

/** Bornes d'un `cuid()` : tout `listingId` hors de ces bornes est refusé. */
const LISTING_ID_MIN_LENGTH = 6;
const LISTING_ID_MAX_LENGTH = 40;

/** Caractères admis dans un identifiant d'annonce (`cuid` / `cuid2`). */
const LISTING_ID_PATTERN = /^[a-z0-9]+$/i;

/**
 * `mkt:<action>:<listingId>[:<componentId>]` → action + annonce (+ objet).
 *
 * 🧺 **Option A** : un lot publie **un message par objet**, chacun porteur de SES
 * boutons ⇒ `custom_id` à **4 segments**. La forme à **3 segments** (annonces
 * simples, messages publiés avant l'option A) reste acceptée à l'identique : les
 * boutons déjà en salon continuent de fonctionner, sans resynchronisation forcée.
 *
 * Retourne `null` dès que la forme n'est **pas exactement** celle produite par
 * les boutons (§0.1 fail-closed) : un `custom_id` bricolé, tronqué, d'une autre
 * version du payload ou d'un autre module n'entraîne **aucune** action métier.
 */
export function parseMarketCustomId(customId: string): MarketCustomId | null {
    if (typeof customId !== "string") return null;

    const parts = customId.split(":");
    if (parts.length !== 3 && parts.length !== 4) return null;

    const [prefix, rawAction, listingId, componentId] = parts;
    if (prefix !== MARKET_INTERACTION_PREFIX) return null;
    if (!MARKET_INTERACTION_ACTIONS.includes(rawAction as MarketInteractionAction)) return null;
    if (listingId.length < LISTING_ID_MIN_LENGTH || listingId.length > LISTING_ID_MAX_LENGTH) return null;
    if (!LISTING_ID_PATTERN.test(listingId)) return null;

    // Segment optionnel : mêmes bornes et mêmes caractères que l'ID d'annonce
    // (cuid/cuid2 d'objet de lot) — jamais un `componentId` fantaisiste.
    if (componentId !== undefined) {
        if (componentId.length < LISTING_ID_MIN_LENGTH || componentId.length > LISTING_ID_MAX_LENGTH) {
            return null;
        }
        if (!LISTING_ID_PATTERN.test(componentId)) return null;
    }

    return {
        action: rawAction as MarketInteractionAction,
        listingId,
        ...(componentId !== undefined ? { componentId } : {}),
    };
}

/**
 * URL absolue de la fiche SigilOS d'une annonce
 * (`/dashboard/<discordGuildId>/marche/<listingId>`).
 *
 * Le slash final éventuel de la base est neutralisé : une **seule** forme d'URL
 * circule dans le module (payload de l'annonce §13.3 et boutons Discord).
 */
export function buildMarketDashboardUrl(baseUrl: string, discordGuildId: string, listingId: string): string {
    const base = baseUrl.replace(/\/+$/, "");
    return `${base}/dashboard/${discordGuildId}/marche/${listingId}`;
}

/** Ligne de composants Discord (`ActionRow` type 1) — même forme pour tous les envois. */
export type MarketComponentRow = {
    type: 1;
    components: Array<Record<string, unknown>>;
};

/** Libellé du bouton lien de l'annonce publique (§13.3). */
export const MARKET_DASHBOARD_LINK_LABEL = "Voir sur SigilOS";

/** Libellé du bouton lien des réponses éphémères (S4.5). */
export const MARKET_EPHEMERAL_LINK_LABEL = "Ouvrir la fiche SigilOS";

/**
 * Bouton **lien** (style 5) vers la fiche SigilOS.
 *
 * Discord refuse un `custom_id` sur un bouton lien : les deux formes (URL +
 * `style: 5`) sont donc construites **ici**, une fois, et réutilisées par
 * l'embed de l'annonce (§13.3) comme par les réponses éphémères (§13.5) — le
 * libellé reste surchargeable pour rester au plus près de la spec.
 */
export function buildMarketDashboardLinkButton(
    dashboardUrl: string,
    label: string = MARKET_DASHBOARD_LINK_LABEL
): Record<string, unknown> {
    return { type: 2, style: 5, label, url: dashboardUrl };
}

/** Ligne (`ActionRow`) ne contenant que le bouton lien vers la fiche SigilOS. */
export function buildMarketDashboardLinkRow(
    dashboardUrl: string,
    label: string = MARKET_DASHBOARD_LINK_LABEL
): MarketComponentRow {
    return { type: 1, components: [buildMarketDashboardLinkButton(dashboardUrl, label)] };
}

/**
 * §13.5 — Modale « Faire une offre » (type 9) : **3 champs**, tous facultatifs
 * côté Discord. La règle « **kamas OU troc** » n'est **pas** exprimable en
 * modale : elle est appliquée par le serveur à la soumission (S4.4).
 *
 * Les bornes vivent ici (contrat UI) et sont **réutilisées** par la validation
 * serveur : une seule source de vérité pour les deux étapes du formulaire.
 */
export const MARKET_OFFER_MODAL = {
    /** Titre affiché (Discord : 1 → 45 caractères). */
    TITLE: "Faire une offre",
    /** `custom_id` des champs — jamais de chaîne libre ailleurs. */
    FIELDS: {
        KAMAS: "kamas",
        TRADE: "trade",
        NOTE: "note",
    },
    /** Longueurs maximales miroir de §13.5 (validation à la soumission). */
    KAMAS_MAX_LENGTH: String(KAMAS_MAX).length,
    TRADE_MAX_LENGTH: 200,
    NOTE_MAX_LENGTH: 500,
} as const;

/**
 * Construit la modale d'offre d'une annonce.
 *
 * Le `custom_id` de la modale reprend **exactement** la forme des boutons
 * (`mkt:offer:<listingId>`) : la soumission (type 5) est donc reparsée par
 * `parseMarketCustomId()`, sans second format à maintenir.
 *
 * D43 — `options.acceptsTrade === false` (« **kamas uniquement** ») adapte les
 * **libellés** pour que le membre sache avant de saisir : le serveur reste
 * **seul juge** (un troc seul est refusé par `createMarketOfferCore`, §11.4).
 * `undefined`/`true` reproduit **à l'identique** la sortie historique.
 */
export function buildMarketOfferModal(
    listingId: string,
    options?: { acceptsTrade?: boolean }
): MarketModalPayload {
    const tradeAccepted = options?.acceptsTrade !== false;
    const field = (
        customId: string,
        label: string,
        placeholder: string,
        style: 1 | 2,
        maxLength: number
    ): MarketModalComponent => ({
        type: 1,
        components: [
            {
                type: 4,
                custom_id: customId,
                label,
                style,
                required: false,
                max_length: maxLength,
                placeholder,
            },
        ],
    });

    return {
        custom_id: `${MARKET_INTERACTION_PREFIX}:offer:${listingId}`,
        title: MARKET_OFFER_MODAL.TITLE,
        components: [
            field(MARKET_OFFER_MODAL.FIELDS.KAMAS, tradeAccepted ? "Montant en kamas (facultatif)" : "Montant en kamas (obligatoire ici)", "Ex : 45000000", 1, MARKET_OFFER_MODAL.KAMAS_MAX_LENGTH),
            field(MARKET_OFFER_MODAL.FIELDS.TRADE, tradeAccepted ? "Troc proposé (facultatif)" : "Troc proposé (refusé sur cette annonce)", tradeAccepted ? "Objet ou lot proposé en échange" : "Cette annonce n'accepte que les kamas", 2, MARKET_OFFER_MODAL.TRADE_MAX_LENGTH),
            field(MARKET_OFFER_MODAL.FIELDS.NOTE, "Message au vendeur (facultatif)", "Un mot pour le vendeur (dispo, négociation…)", 2, MARKET_OFFER_MODAL.NOTE_MAX_LENGTH),
        ],
    };
}

/**
// ---------------------------------------------------------------------------
// SOUMISSION DE LA MODALE D'OFFRE (S4.4) — lecture & nettoyage des 3 champs
// ---------------------------------------------------------------------------

/**
 * Composant reçu dans `data.components` d'une **soumission de modale** (type 5).
 *
 * Discord imbrique toujours les champs dans des lignes (`ActionRow`), mais un
 * payload bricolé peut ne rien contenir : tout est facultatif ici et
 * `extractMarketOfferInputs()` ne devine jamais une valeur.
 */
export type MarketModalSubmitComponent = {
    custom_id?: string | null;
    value?: string | null;
};

/** Ligne (`ActionRow`) d'une soumission de modale (type 5). */
export type MarketModalSubmitRow = {
    components?: MarketModalSubmitComponent[] | null;
};

/** Champs bruts d'une modale d'offre, **tels que saisis** (jamais interprétés). */
export type MarketOfferRawInput = {
    kamas: string;
    trade: string;
    note: string;
};

/**
 * Offre **nettoyée et bornée** (§13.5), prête pour le moteur serveur
 * (`createMarketOfferCore()`, partagé avec le dashboard).
 */
export type MarketOfferDraft = {
    /** Montant lisible et **strictement positif**, `null` si aucun kama offert (§11.4). */
    offeredKamas: number | null;
    /** Troc nettoyé (liens retirés, §16.4), `null` si vide. */
    tradeDescription: string | null;
    /** Message au vendeur nettoyé, `null` si vide. */
    note: string | null;
    /** `true` = saisie inexploitable (kamas illisible, texte hors bornes) ⇒ refus explicite. */
    invalid: boolean;
};

/**
 * Extrait les 3 champs d'une soumission de modale, **sans** les interpréter.
 *
 * Un champ absent (ligne manquante, `custom_id` inconnu) vaut chaîne vide : la
 * décision « kamas OU troc » n'est jamais prise ici (§13.4).
 */
export function extractMarketOfferInputs(
    rows: readonly MarketModalSubmitRow[] | null | undefined
): MarketOfferRawInput {
    const inputs: MarketOfferRawInput = { kamas: "", trade: "", note: "" };
    if (!Array.isArray(rows)) return inputs;

    for (const row of rows) {
        if (!row || !Array.isArray(row.components)) continue;
        for (const component of row.components) {
            if (!component || typeof component.custom_id !== "string") continue;
            const value = typeof component.value === "string" ? component.value : "";
            if (component.custom_id === MARKET_OFFER_MODAL.FIELDS.KAMAS) inputs.kamas = value;
            if (component.custom_id === MARKET_OFFER_MODAL.FIELDS.TRADE) inputs.trade = value;
            if (component.custom_id === MARKET_OFFER_MODAL.FIELDS.NOTE) inputs.note = value;
        }
    }

    return inputs;
}

/**
 * Normalise une saisie d'offre : **mêmes règles** pour la modale Discord et
 * pour le formulaire du dashboard (§13.4 — une seule source de vérité).
 *
 * · kamas : séparateurs tolérés (`"12 500 k"`), entier `1 → KAMAS_MAX` ;
 *   `0`, négatif ou champ illisible ⇒ aucun montant (et `invalid` si le champ
 *   était rempli : jamais un `0` en silence) ;
 * · troc / note : nettoyés (§16.4) puis **bornés** à 200 / 500 caractères — un
 *   texte hors bornes est **refusé**, jamais tronqué à l'insu du membre.
 */
export function normalizeMarketOfferDraft(
    input: Partial<MarketOfferRawInput> | null | undefined
): MarketOfferDraft {
    const kamasRaw = (input?.kamas ?? "").trim();
    const parsedKamas = parseKamas(kamasRaw);
    const kamasInvalid = kamasRaw.length > 0 && parsedKamas === null;

    const tradeRaw = (input?.trade ?? "").trim();
    const noteRaw = (input?.note ?? "").trim();
    const tooLong =
        tradeRaw.length > MARKET_OFFER_MODAL.TRADE_MAX_LENGTH ||
        noteRaw.length > MARKET_OFFER_MODAL.NOTE_MAX_LENGTH;

    return {
        // §11.4 : une offre de 0 kama n'existe pas — le montant est alors absent.
        offeredKamas: kamasInvalid || parsedKamas === null || parsedKamas <= 0 ? null : parsedKamas,
        tradeDescription: sanitizeMarketText(tradeRaw),
        note: sanitizeMarketText(noteRaw),
        invalid: kamasInvalid || tooLong,
    };
}

/**
 * Extrait + normalise l'offre d'une **soumission de modale** (type 5).
 *
 * Retourne `null` si le `custom_id` n'est pas celui produit par
 * `buildMarketOfferModal()` (`mkt:offer:<listingId>`) : aucune action métier
 * n'est déclenchée sur un payload bricolé ou d'une autre version (§0.1).
 */
export function parseMarketOfferSubmission(params: {
    customId: string;
    components: readonly MarketModalSubmitRow[] | null | undefined;
}): (MarketOfferDraft & { listingId: string }) | null {
    const parsed = parseMarketCustomId(params.customId);
    if (!parsed || parsed.action !== "offer") return null;

    return {
        listingId: parsed.listingId,
        ...normalizeMarketOfferDraft(extractMarketOfferInputs(params.components)),
    };
}

/**
 * BUG-7 — **le bouton « Contacter » a été supprimé** : la fonction qui
 * construisait sa réponse éphémère (`/w <pseudo>`) a été retirée du module, avec
 * son `custom_id` (`mkt:contact`), ses libellés et sa documentation. Le bouton
 * **lien** « Voir sur SigilOS » reste la seule passerelle vers la fiche.
 */

/**
 * Messages éphémères (§13.5) — **toutes** les issues d'un clic sont couvertes.
 *
 * Interdits : afficher un montant d'offre ou un pseudo d'acheteur (§13.7), ou
 * laisser un clic sans réponse visible.
 */
export const MARKET_EPHEMERAL = {
    /** `custom_id` inconnu / obsolète (vieux bouton, message bricolé). */
    UNKNOWN_ACTION: "❌ Cette action du Marché n'est plus valable.",
    /** Interaction hors serveur : la guilde ne peut pas être isolée (§16.2). */
    GUILD_REQUIRED: "⚠️ Utilise ce bouton depuis le serveur Discord de ta guilde.",
    /** Module `marche` inactif pour la guilde (`DEFAULT_MODULES` inclus). */
    MODULE_DISABLED: "🔒 Le Marché est désactivé sur ce serveur.",
    /** S4.2 — réservation acceptée (§11.2 : l'échange se conclut en jeu). */
    RESERVE_SUCCESS: "✅ Annonce réservée ! Le vendeur sera prévenu — l'échange se conclut **en jeu**.",
    /** S4.2 — un vendeur ne réserve pas sa propre annonce (§11.2/D34). */
    RESERVE_OWN_LISTING: "❌ Tu ne peux pas réserver ta propre annonce.",
    /** S4.2 — annonce déjà `RESERVED`/`SOLD`/`EXPIRED`/`WITHDRAWN`. */
    RESERVE_UNAVAILABLE: "❌ Cette annonce n'est plus disponible.",
    /** S4.2 — §11.3 : quelqu'un a validé le verrou transactionnel avant. */
    RESERVE_CONFLICT: "❌ Cette annonce vient d'être réservée par quelqu'un d'autre.",
    /** S4.3 — un vendeur ne fait pas d'offre sur sa propre annonce (§11.2/D34). */
    OFFER_OWN_LISTING: "❌ Tu ne peux pas faire d'offre sur ta propre annonce.",
    /** S4.3 — annonce plus `ACTIVE` (déjà réservée / vendue / expirée / retirée). */
    OFFER_NOT_AVAILABLE: "❌ Cette annonce n'est plus disponible.",
    /** S4.3 — négociations coupées (réglage guilde ou annonce non négociable). */
    OFFER_DISABLED: "❌ Les négociations sont désactivées sur cette annonce.",
    /** S4.4 — offre `PENDING` créée : le vendeur est prévenu (DM en S4.8, §13.7). */
    OFFER_SUCCESS: "✅ Offre envoyée au vendeur ! L'échange se conclut **en jeu** s'il l'accepte.",
    /** S4.4 — §11.4 : offre vide (ni kamas, ni troc) ⇒ refusée, jamais devinée. */
    OFFER_EMPTY: "❌ Renseigne un montant en kamas **ou** un troc : une offre vide ne peut pas être envoyée.",
    /** S4.4 — kamas illisible / hors plafond, ou texte hors bornes (200 / 500). */
    OFFER_INVALID: "❌ Offre invalide : vérifie le montant en kamas et la longueur des textes.",
    /**
     * D43 — « **kamas uniquement** » (`acceptsTrade = false`) : une offre **sans
     * kamas** (troc seul) est refusée **serveur**. Aucun montant ni pseudo n'est
     * exposé (§13.7).
     */
    OFFER_TRADE_NOT_ACCEPTED: "❌ Cette annonce n'accepte que les kamas : indique un montant pour la réserver ou négocier.",
    /** BUG-8 — un acheteur ne peut pas se désister d'une annonce qu'il n'a pas réservée. */
    CANCEL_NOT_YOURS: "❌ Tu n'as pas de réservation active sur cette annonce.",
    /** BUG-8 — un vendeur ne se « désiste » pas : il retire son annonce. */
    CANCEL_OWN_LISTING: "ℹ️ Tu es le vendeur : pour libérer ton annonce, retire-la depuis SigilOS.",
    /** BUG-8 — le désistement a abouti : l'annonce repart, le vendeur est prévenu. */
    CANCEL_SUCCESS: "✅ Réservation annulée : l'annonce est de nouveau disponible et le vendeur est prévenu.",
    /** BUG-8 — annonce plus `RESERVED` (vendue / expirée / retirée entre-temps). */
    CANCEL_UNAVAILABLE: "❌ Cette annonce n'est plus réservée : il n'y a rien à annuler.",
    /** BUG-8 — le clic arrive trop vite (anti-spam des boutons, fail-closed). */
    RATE_LIMITED: "⏳ Doucement ! Réessaie dans quelques secondes.",
    /** BUG-8 — l'acheteur reclique « Réserver » sur **sa** réservation. */
    RESERVE_ALREADY_YOURS: "ℹ️ Tu as déjà réservé cette annonce : utilise « Me désister » pour revenir en arrière.",
    /** Annonce absente ou appartenant à une autre guilde (§16.2). */
    LISTING_NOT_FOUND: "❌ Cette annonce est introuvable.",
    /**
     * BUG-6 — **deux cas distincts**, deux messages distincts : un membre
     * **sans** profil SigilOS dans la guilde et un membre dont le profil est
     * **inactif** (en attente / archivé) n'ont pas la même action à faire.
     * L'ancien message unique (« Termine d'abord ton profil… ») s'affichait à
     * tort pour un membre dont le profil existait déjà.
     */
    PROFILE_MISSING: "❌ Aucun profil SigilOS dans cette guilde : crée ton profil (ou demande à un admin) pour utiliser le Marché.",
    /** Profil présent mais **inactif** : ce n'est pas au membre de le « terminer ». */
    PROFILE_INACTIVE: "❌ Ton profil SigilOS est inactif dans cette guilde : contacte un administrateur pour l'activer, puis réessaie.",
    /** Échec technique inattendu : jamais de silence (§13.5). */
    GENERIC_ERROR: "❌ L'action a échoué, réessaie dans un instant.",
} as const;

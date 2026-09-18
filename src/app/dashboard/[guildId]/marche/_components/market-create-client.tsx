"use client";

import { useState, useTransition, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { formatKamas, parseKamas } from "@/lib/market/kamas";
import { computeStatQuality } from "@/lib/market/stat-quality";
import { dofusStatAssetUrl } from "@/lib/dofus-stats-theme";
import {
    ELEMENT_POTION_ELEMENTS,
    SMITHMAGIC_PALIERS,
    TRANSCENDENCE_LABEL,
    strikeElementAsset,
    type ElementPotion,
    type SmithmagicElement,
    type SmithmagicPalier,
    type TranscendenceRune,
} from "@/lib/market/smithmagic";
// S8.9/S8.11 — gardes **pures** partagées avec le serveur (une seule règle).
import {
    MARKET_FORGE_LIMITS,
    describeTranscendenceConflicts,
    isWeaponItem,
} from "@/lib/market/forge-guards";
import { MARKET_LIMITS } from "@/server/actions/market-constants";
import {
    createMarketListing,
    getMarketStatReferential,
    getSmithmagicReferential,
    publishMarketListing,
    updateMarketListing,
    getMarketPublishContext,
    type MarketStatReferential,
    type SmithmagicReferential,
} from "@/server/actions/market-actions";
import { getGuildRoles } from "@/server/actions/bonus-actions";
import { searchLocalGameItems, type GameItemSearchResult } from "@/server/actions/game-item-actions";
import { buildNativeStatDrafts, type MarketStatDraft, type MarketNativeEffect } from "@/lib/market/effects";
// BUG-11/T10 — familles d'objets : libellés, descriptions et politique
// (Forge / jet / lot / légendaire) partagés avec le serveur (une seule règle).
import {
    MARKET_ITEM_FAMILY_DESCRIPTIONS,
    MARKET_ITEM_FAMILY_LABELS,
    resolveMarketItemPolicy,
    type MarketItemFamily,
} from "@/lib/market/item-families";
import { MarketItemCard } from "@/components/market/market-item-card";
import { MarketJetEditor } from "./market-jet-editor";
import { MarketBundleItemsEditor } from "./market-bundle-items-editor";
import {
    MARKET_BUNDLE_MAX_ITEMS,
    MARKET_BUNDLE_MIN_ITEMS,
    computeBundleTotal,
    type BundleItemInput,
} from "@/lib/market/bundle";
import { KamasAmount } from "@/components/market/kamas-amount";
import { MarketPublishStep, type MarketPublishContext } from "./market-publish-step";
import { MarketNotifyStep } from "./market-notify-step";
import { toast } from "sonner";
import { Boxes, ChevronLeft, ChevronRight, Check, Hammer, Loader2, Package, Plus, Save, Search, Sparkles, Store, X } from "lucide-react";

/**
 * Nature de l'annonce (BUG-11) : `EQUIPMENT` (objet du catalogue, éventuellement
 * forgé), `COSMETIC` (apparat / costume : vente brute), `RESOURCE`
 * (Ressources / Autres : lot à quantité libre, aucune modification) et
 * **`BUNDLE`** — 🧺 *lot multiple* (décision user du 14/09/2026) : **2 à 5 objets
 * différents** vendus ensemble, chacun avec **son propre prix** (option A : un
 * message Discord par objet). Le prix vit donc sur l'objet, jamais sur le lot.
 */
type ListingKind = "EQUIPMENT" | "COSMETIC" | "RESOURCE" | "BUNDLE";

/**
 * Nature d'annonce ↔ famille d'objet (résolution **serveur** ensuite).
 *
 * ⚠️ Un lot multiple est **hétérogène** : il n'a pas de famille de catalogue
 * (la famille ne sert qu'au sélecteur d'objet, étape 2) — on retient la famille
 * générique « Ressources / Autres » sans que cela ne contraigne les objets du lot.
 */
const KIND_TO_FAMILY: Record<ListingKind, MarketItemFamily> = {
    EQUIPMENT: "EQUIPMENT",
    COSMETIC: "COSMETIC",
    RESOURCE: "RESOURCES_OTHER",
    BUNDLE: "RESOURCES_OTHER",
};

/**
 * Constat beta — référence **stable** de « aucune ligne de jet déclarable »
 * (famille « vente brute » : cosmétique, apparat, compagnon, Dofus…). Elle
 * évite de recréer un tableau à chaque rendu, donc de faire recalculer les
 * `useMemo` qui en dépendent (carte publiée, embeds, récapitulatif).
 */
const NO_DECLARABLE_STATS: MarketStatDraft[] = [];

export type ComponentDraft = {
    key: string;
    dofusDbItemId: number | null;
    name: string;
    iconUrl: string | null;
    quantity: number;
    unitLabel: string | null;
    /**
     * 🧺 Lot multiple uniquement — **prix de CET objet** en kamas (`null` pour un
     * lot de ressources classique, où le prix reste global à l'annonce).
     */
    priceKamas?: number | null;
};

/**
 * S8.9 — état de la **forge réelle déclarée** (D40/D41) porté par l'assistant.
 *
 * `transcendenceRuneId` **porte à lui seul** l'état « Transcendé » (aucun
 * booléen redondant) ; `elementPotionTier` porte la donnée de jeu quand la
 * potion n'est pas siphonnée (`elementPotionId: null`, palier 65 %).
 */
export type MarketForgeState = {
    transcendenceRuneId: number | null;
    transcendenceLabel: string | null;
    strikeElement: SmithmagicElement | null;
    elementPotionId: number | null;
    elementPotionTier: number | null;
    huntingWeapon: string;
};

/** Forge vide (annonce sans déclaration de forge). */
export const EMPTY_MARKET_FORGE: MarketForgeState = {
    transcendenceRuneId: null,
    transcendenceLabel: null,
    strikeElement: null,
    elementPotionId: null,
    elementPotionTier: null,
    huntingWeapon: "",
};


/**
 * S7.11/S7.12 — **état initial** d'une annonce à modifier (mode `edit`).
 *
 * Le même assistant 4 étapes est rejoué sur ces valeurs : aucune duplication du
 * parcours, et **aucun** champ `quality` n'est transmis (il est **recalculé**
 * côté serveur par `updateMarketListing`, cf. D17).
 */
export type MarketListingEditInitial = {
    id: string;
    type: ListingKind;
    title: string;
    description: string | null;
    forgedBy: string | null;
    priceKamas: number | null;
    negotiable: boolean;
    acceptsTrade: boolean;
    quantity: number | null;
    unitLabel: string | null;
    minQuantity: number | null;
    /** Objet du catalogue (jamais inventé : il vient de la fiche persistée). */
    item: GameItemSearchResult | null;
    stats: MarketStatDraft[];
    components: ComponentDraft[];
    /** S8.9 — forge réelle déjà déclarée (rejouée telle quelle en édition). */
    forge: MarketForgeState;
};

interface MarketCreateClientProps {
    guildId: string;
    /** S7.12 — annonce existante ⇒ mode **édition** (sinon création). */
    initial?: MarketListingEditInitial | null;
    /**
     * 🎨 Vignettes **réelles** des natures (objets siphonnés du catalogue local,
     * résolues côté serveur) — jamais une illustration inventée.
     */
    natureIcons?: Partial<Record<ListingKind, string[]>>;
}

export function MarketCreateClient({ guildId, initial = null, natureIcons }: MarketCreateClientProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    /** S7.12 — édition d'une annonce existante : l'étape 4 (Discord) disparaît. */
    const isEdit = initial !== null;

    // Édition : on démarre directement sur « Objet / Jet », pré-rempli.
    // Création : 5 étapes — 4 « Publication » (aperçu Discord) et **5
    // « Notification »** (rôles à mentionner + audience), cette dernière étant
    // dédiée depuis le 18/09/2026 (décision user : elle était noyée dans l'étape 4).
    const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(initial ? 2 : 1);
    const [kind, setKind] = useState<ListingKind>(initial?.type ?? "EQUIPMENT");

    // Équipement
    const [item, setItem] = useState<GameItemSearchResult | null>(initial?.item ?? null);

    // S2.10 — lignes de jet, pré-remplies depuis les plages natives du catalogue.
    const [stats, setStats] = useState<MarketStatDraft[]>(initial?.stats ?? []);

    // S8.9 — forge réelle déclarée (rune de Transcendance, élément, arme de chasse).
    const [forge, setForge] = useState<MarketForgeState>(initial?.forge ?? EMPTY_MARKET_FORGE);

    // S8.9 — référentiel de forge (runes `typeId 211` + potions `typeId 26`).
    const [referential, setReferential] = useState<SmithmagicReferential | null>(null);

    /**
     * Correction 13/09 — **référentiel d'effets** (libellés exacts + malus).
     * Source de vérité : table siphonnée `GameEffect` (les tables codées en dur
     * se sont révélées fausses sur 35 entrées, ex. `162` = « Esquive PA »).
     * `null` = pas encore chargé (repli : table codée, jamais d'écran cassé).
     */
    const [statReferential, setStatReferential] = useState<MarketStatReferential | null>(null);

    // S3.14 — contexte de publication Discord (salon, rôles pinguables).
    const [publishContext, setPublishContext] = useState<MarketPublishContext | null>(null);
    const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
    const [pingRoleIds, setPingRoleIds] = useState<string[]>([]);

    useEffect(() => {
        // S7.12 — en édition il n'y a **pas** d'étape de publication Discord :
        // on évite deux appels serveur inutiles.
        if (isEdit) return;
        let cancelled = false;
        getMarketPublishContext(guildId).then((res) => {
            if (!cancelled && res.success && res.data) setPublishContext(res.data);
        });
        getGuildRoles(guildId).then((res) => {
            if (!cancelled && res.success && res.data) {
                setRoles(res.data.map((role) => ({ id: role.id, name: role.name })));
            }
        });
        return () => {
            cancelled = true;
        };
    }, [guildId, isEdit]);

    // Ressources (lot simple ou composite)
    const [components, setComponents] = useState<ComponentDraft[]>(initial?.components ?? []);

    // Commun
    const [title, setTitle] = useState(initial?.title ?? "");
    const [description, setDescription] = useState(initial?.description ?? "");
    const [forgedBy, setForgedBy] = useState(initial?.forgedBy ?? "");
    const [priceInput, setPriceInput] = useState(
        initial?.priceKamas != null ? String(initial.priceKamas) : ""
    );
    const [negotiable, setNegotiable] = useState(initial?.negotiable ?? true);
    const [acceptsTrade, setAcceptsTrade] = useState(initial?.acceptsTrade ?? false);
    const [minQuantity, setMinQuantity] = useState(
        initial?.minQuantity != null ? String(initial.minQuantity) : ""
    );

    const parsedPrice = parseKamas(priceInput);
    const priceInvalid = priceInput.trim().length > 0 && parsedPrice === null;

    // S8.9 — le référentiel de forge est chargé **à la demande** (dès qu'un objet
    // du catalogue est choisi) et **masqué** s'il est dégradé (fail-soft S8.3).
    useEffect(() => {
        if (kind !== "EQUIPMENT" || !item) return;
        let cancelled = false;
        getSmithmagicReferential(guildId).then((res) => {
            if (!cancelled && res.success && res.data) setReferential(res.data);
        });
        // Correction 13/09 — référentiel d'effets (libellés + **malus**) : il est
        // chargé au moment où l'objet est choisi, puis appliqué aux lignes.
        getMarketStatReferential(guildId).then((res) => {
            if (!cancelled && res.success && res.data) setStatReferential(res.data);
        });
        return () => {
            cancelled = true;
        };
    }, [guildId, kind, item]);

    /**
     * Correction 13/09 — entrées de résolution passées à `buildNativeStatDrafts` :
     * `effectLabels` **prime** sur les caractéristiques (l'`effectId` est
     * spécifique à la ligne) et `negativeEffectIds` rétablit le signe des malus.
     */
    const statDraftOptions = useMemo(
        () => ({
            labels: { ...(statReferential?.labels ?? {}), ...(statReferential?.effectLabels ?? {}) },
            negativeEffectIds: statReferential?.negativeEffectIds ?? [],
        }),
        [statReferential]
    );

    /** S8.9 (D40) — « Transcendé » est **déclaratif** : la rune ou rien. */
    const isTranscended = forge.transcendenceRuneId != null;

    /**
     * BUG-11/T10 — **politique de l'objet choisi** (famille + forge / jet / lot /
     * légendaire). C'est la **même fonction pure** que celle appliquée par le
     * serveur : l'UI n'ouvre jamais un bloc que le serveur refusera
     * (compagnon, Dofus, Trophée, Prysmaradite, apparat, ressource…).
     */
    const itemPolicy = useMemo(
        () =>
            resolveMarketItemPolicy({
                typeId: item?.typeId ?? null,
                superTypeId: item?.superTypeId ?? null,
                // ⚠️ `typeName` / `category` sont les signaux **toujours** présents
                // dans le référentiel local (cf. item-families.ts) : sans eux, un
                // objet réel serait classé « Ressources / Autres » par défaut.
                typeName: item?.typeName ?? null,
                category: item?.category ?? null,
            }),
        [item]
    );

    /**
     * Constat beta — **jamais de jet déclaré pour une famille « vente brute »**
     * (cosmétique, apparat, compagnon, Dofus, Trophée, percepteur…).
     *
     * Le serveur applique déjà la même règle (`statEditorAllowed`) et refuse
     * toute statistique sur ces objets. L'assistant cessait pourtant d'en
     * **pré-remplir** depuis le catalogue : une monture d'apparat partait avec
     * deux lignes fantômes (« Échangeable : », « Compatible avec : », mesurées
     * `0 → 0` sur l'objet `23559`), la carte les affichait et la publication
     * échouait sur « aucune statistique ne peut être déclarée » — alors que le
     * vendeur n'avait rien déclaré. Ces lignes ne sont donc plus **affichées**
     * (carte du catalogue, carte publiée) ni **envoyées**. C'est la **seule**
     * source du jet affiché et publié.
     */
    const declarableStats = itemPolicy.statEditorAllowed ? stats : NO_DECLARABLE_STATS;

    /**
     * S8.11 — lignes incompatibles avec la Transcendance, calculées **côté
     * client** avec la même règle pure que le serveur : bandeau + bouton
     * « Continuer » bloqué, jamais un refus surprise à l'enregistrement.
     */
    const transcendenceConflicts = useMemo(
        () =>
            isTranscended
                ? describeTranscendenceConflicts(
                      declarableStats.map((stat) => ({
                          label: stat.label,
                          origin: stat.origin,
                          naturalMax: stat.naturalMax,
                          actualValue: stat.actualValue,
                      }))
                  )
                : [],
        [isTranscended, declarableStats]
    );

    /**
     * S8.9 — récapitulatif lisible de la forge (rune nommée, potion + palier),
     * alimenté par le référentiel : aucune donnée inventée côté client.
     */
    const forgeRecap = useMemo(() => {
        const lines: { label: string; value: string }[] = [];
        if (isTranscended) {
            const rune = referential?.runes.find(
                (candidate) => candidate.ankamaId === forge.transcendenceRuneId
            );
            lines.push({
                label: "Transcendance",
                value: rune
                    ? `${rune.name} (${rune.statLabel} +${rune.bonus})`
                    : TRANSCENDENCE_LABEL,
            });
        }
        if (forge.strikeElement) {
            const potion = referential?.potions.find(
                (candidate) =>
                    candidate.element === forge.strikeElement &&
                    candidate.tier === forge.elementPotionTier
            );
            lines.push({
                label: "Élément de frappe",
                value: potion
                    ? `${forge.strikeElement} — ${potion.name} (${potion.tier} % des dégâts)`
                    : forge.strikeElement,
            });
        }
        if (forge.huntingWeapon.trim()) {
            lines.push({ label: "Arme de chasse", value: forge.huntingWeapon.trim() });
        }
        return lines;
    }, [isTranscended, referential, forge]);

    /**
     * S8.7 — carte **du catalogue** affichée au-dessus de l'éditeur : elle montre
     * les **jets maximum** de l'objet (+ EFFETS + STATUT déclaré), jamais le
     * brouillon du vendeur (c'est le rôle de l'éditeur juste en dessous).
     */
    const catalogueCard = useMemo(() => {
        if (!item) return null;
        // Correction 13/09 — lignes fidèles : libellés du référentiel siphonné et
        // **signe** des malus (« -6 à -8 Esquive PA »), valeurs = jets MAX.
        const drafts = itemPolicy.statEditorAllowed
            ? buildNativeStatDrafts(
                  (item.nativeEffects as MarketNativeEffect[] | null) ?? null,
                  statDraftOptions
              )
            : [];
        return {
            name: item.name,
            level: item.level,
            typeName: item.typeName,
            itemSetName: item.itemSetName ?? null,
            iconUrl: item.iconUrl,
            isLegendary: item.isLegendary ?? false,
            description: item.description ?? null,
            realWeight: item.realWeight ?? null,
            transcended: isTranscended,
            transcendenceLabel: forge.transcendenceLabel,
            strikeElement: forge.strikeElement,
            huntingWeapon: forge.huntingWeapon.trim() || null,
            stats: drafts.map((draft) => ({
                effectId: draft.effectId,
                characteristic: draft.characteristic,
                label: draft.label,
                naturalMin: draft.naturalMin,
                naturalMax: draft.naturalMax,
                // Jet MAX du catalogue : la carte annonce la fourchette, pas le déclaré.
                actualValue: draft.naturalMax ?? draft.naturalMin ?? 0,
                origin: "NATIVE",
                quality: computeStatQuality({
                    naturalMin: draft.naturalMin,
                    naturalMax: draft.naturalMax,
                    actualValue: draft.naturalMax ?? draft.naturalMin ?? 0,
                    origin: "NATIVE",
                }),
            })),
        };
    }, [item, isTranscended, forge, statDraftOptions, itemPolicy.statEditorAllowed]);

    /**
     * Correction 13/09 — **jet déclaré** envoyé à l'aperçu Discord : l'embed
     * publié doit porter les valeurs (« ✦ Exo 1 PM », « 348 Vitalité [301 à 350] »).
     */
    const publishStats = useMemo(
        () =>
            declarableStats.map((stat) => ({
                label: stat.label,
                actualValue: stat.actualValue,
                naturalMin: stat.naturalMin,
                naturalMax: stat.naturalMax,
                origin: stat.origin,
            })),
        [declarableStats]
    );

    /**
     * Correction 13/09 — carte de l'annonce **telle qu'elle sera publiée**
     * (jet déclaré + forge déclarée) : rendue à l'étape Publication pour que le
     * vendeur voie les icônes officielles, les exo en couleur et les malus
     * négatifs — exactement comme l'image générée par Discord en salon texte.
     */
    const declaredCard = useMemo(() => {
        if (!item) return null;
        return {
            name: item.name,
            level: item.level,
            typeName: item.typeName,
            itemSetName: item.itemSetName ?? null,
            iconUrl: item.iconUrl,
            isLegendary: item.isLegendary ?? false,
            description: description.trim() || null,
            forgedBy: forgedBy.trim() || null,
            realWeight: item.realWeight ?? null,
            priceKamas: parsedPrice,
            unitLabel:
                kind === "RESOURCE" && components.length === 1 ? components[0].unitLabel : null,
            transcended: isTranscended,
            transcendenceLabel: forge.transcendenceLabel,
            strikeElement: forge.strikeElement,
            huntingWeapon: forge.huntingWeapon.trim() || null,
            stats: declarableStats.map((stat) => ({
                effectId: stat.effectId,
                characteristic: stat.characteristic,
                label: stat.label,
                naturalMin: stat.naturalMin,
                naturalMax: stat.naturalMax,
                actualValue: stat.actualValue,
                origin: stat.origin,
                quality: computeStatQuality({
                    naturalMin: stat.naturalMin,
                    naturalMax: stat.naturalMax,
                    actualValue: stat.actualValue,
                    origin: stat.origin,
                }),
            })),
        };
    }, [
        item,
        kind,
        components,
        description,
        forgedBy,
        parsedPrice,
        declarableStats,
        isTranscended,
        forge,
    ]);

    /**
     * 🧺 Lot multiple — **nom pré-rempli** à partir des objets choisis (le vendeur
     * ajuste s'il veut) : « Lot : Bois de Frêne, Fer, Rune Pa Vi ». On ne le fait
     * qu'une fois le titre vide et à l'étape 3, pour ne jamais écraser une saisie.
     */
    useEffect(() => {
        if (kind !== "BUNDLE" || step !== 3 || title.trim().length > 0) return;
        const names = components.map((component) => component.name.trim()).filter((name) => name.length > 0);
        if (names.length === 0) return;
        setTitle(`Lot : ${names.slice(0, 3).join(", ")}${names.length > 3 ? "…" : ""}`);
    }, [kind, step, title, components]);

    /**
     * 🧺 Lot multiple — objets du lot vus par le moteur pur (`BundleItemInput`) :
     * le prix par objet vit dans `components[].priceKamas`.
     */
    const bundleItems: BundleItemInput[] = useMemo(
        () =>
            components.map((component) => ({
                dofusDbItemId: component.dofusDbItemId,
                name: component.name,
                iconUrl: component.iconUrl,
                quantity: component.quantity,
                unitLabel: component.unitLabel,
                priceKamas: component.priceKamas ?? 0,
            })),
        [components]
    );

    /** Tous les objets du lot sont nommés et prixés (borne 2→5, cf. moteur pur). */
    const bundleItemsValid =
        components.length >= MARKET_BUNDLE_MIN_ITEMS &&
        components.length <= MARKET_BUNDLE_MAX_ITEMS &&
        components.every(
            (component) => component.name.trim().length > 0 && (component.priceKamas ?? 0) > 0
        );

    const canGoNext = step === 1
        ? true
        : step === 2
            ? kind === "BUNDLE"
                ? bundleItemsValid
                : kind !== "RESOURCE"
                    ? !!item && transcendenceConflicts.length === 0
                    : components.length > 0
            : step === 3
                ? title.trim().length >= 3 && (kind === "BUNDLE" ? bundleItemsValid : !priceInvalid)
                : true; // étapes 4 (publication Discord) et 5 (notification)

    function togglePing(roleId: string) {
        setPingRoleIds((prev) =>
            prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId].slice(0, 3)
        );
    }

    /** « Ne mentionner personne » (étape 5) : un seul geste pour tout décocher. */
    function clearPing() {
        setPingRoleIds([]);
    }

    /**
     * Charge utile **commune** création / mise à jour.
     * ⚠️ Aucun champ `quality` ni plage native calculée côté client : le serveur
     * **recalcule** tout (§12.8, D17).
     */
    /**
     * S8.10 — champs de forge envoyés au serveur. Une annonce **sans** forge
     * envoie `null` partout (aucune valeur inventée) ; le libellé de
     * Transcendance retombe sur le libellé officiel (D40).
     */
    function toForgePayload() {
        const transcendent = forge.transcendenceRuneId != null;
        return {
            transcendenceRuneId: transcendent ? forge.transcendenceRuneId : null,
            transcendenceLabel: transcendent
                ? forge.transcendenceLabel?.trim() || TRANSCENDENCE_LABEL
                : null,
            strikeElement: forge.strikeElement,
            elementPotionId: forge.elementPotionId,
            elementPotionTier: forge.elementPotionTier,
            huntingWeapon: forge.huntingWeapon.trim() || null,
        };
    }

    function buildPayload() {
        // 🧺 Lot multiple (décision user du 14/09/2026) — le prix vit sur **chaque
        // objet** : on envoie `items[]` (le serveur revalide 2→5 via
        // `bundleItemsSchema` et **recalcule le total**), et **aucun** prix global.
        if (kind === "BUNDLE") {
            return {
                type: "BUNDLE" as const,
                title: title.trim(),
                description: description.trim() || null,
                priceKamas: null,
                negotiable,
                acceptsTrade,
                items: bundleItems.map((entry) => ({
                    dofusDbItemId: entry.dofusDbItemId ?? null,
                    name: entry.name.trim(),
                    iconUrl: entry.iconUrl ?? null,
                    quantity: entry.quantity,
                    unitLabel: entry.unitLabel ?? null,
                    priceKamas: entry.priceKamas,
                })),
                components: [],
                stats: [],
            };
        }

        // BUG-11 — « Cosmétique » est un **objet** : le type d'annonce existant
        // (`MarketListingType`) reste `EQUIPMENT` (aucune migration) ; seul
        // `RESOURCES_OTHER` produit un **lot** (`RESOURCE`).
        const isObjectListing = kind !== "RESOURCE";
        return {
            type: isObjectListing ? ("EQUIPMENT" as const) : ("RESOURCE" as const),
            title: title.trim(),
            description: description.trim() || null,
            forgedBy: forgedBy.trim() || null,
            priceKamas: parsedPrice,
            negotiable,
            acceptsTrade,
            // S8.9/S8.10 — forge réelle déclarée (6 champs, additifs) : envoyée
            // uniquement si la politique de l'objet l'autorise (BUG-11).
            ...(itemPolicy.forgeAllowed ? toForgePayload() : {}),
            dofusDbItemId: isObjectListing ? item?.ankamaId ?? null : null,
            itemName: isObjectListing ? item?.name ?? null : null,
            itemIconUrl: isObjectListing ? item?.iconUrl ?? null : null,
            itemLevel: isObjectListing ? item?.level ?? null : null,
            itemTypeName: isObjectListing ? item?.typeName ?? null : null,
            quantity: kind === "RESOURCE" && components.length === 1 ? components[0].quantity : null,
            unitLabel: kind === "RESOURCE" && components.length === 1 ? components[0].unitLabel : null,
            minQuantity: kind === "RESOURCE" ? parseKamas(minQuantity) ?? null : null,
            components: components.map((component) => ({
                dofusDbItemId: component.dofusDbItemId,
                name: component.name,
                iconUrl: component.iconUrl,
                quantity: component.quantity,
                unitLabel: component.unitLabel,
            })),
            stats: declarableStats.map((stat) => ({
                effectId: stat.effectId,
                characteristic: stat.characteristic,
                label: stat.label,
                naturalMin: stat.naturalMin,
                naturalMax: stat.naturalMax,
                actualValue: stat.actualValue,
                origin: stat.origin,
            })),
        };
    }

    /** Champs communs aux deux modes. `true` si le formulaire est inutilisable. */
    function hasFormError(): boolean {
        if (!title.trim()) {
            toast.error("Renseigne un titre pour ton annonce.");
            return true;
        }
        if (priceInvalid) {
            toast.error("Prix invalide (entier de kamas attendu).");
            return true;
        }
        return false;
    }

    /**
     * S7.12 — enregistre les modifications d'une annonce existante.
     * `updateMarketListing` revalide tout côté serveur : **vendeur** propriétaire,
     * statut éditable (`DRAFT`/`ACTIVE`/`EXPIRED`), **jet recalculé** (plages
     * natives du catalogue), `statsHash` rejoué et journal `LISTING_UPDATED`.
     */
    function handleUpdate() {
        if (!initial || hasFormError()) return;

        startTransition(async () => {
            const updated = await updateMarketListing(guildId, initial.id, buildPayload());
            if (!updated.success) {
                toast.error(updated.error || "Impossible d'enregistrer les modifications.");
                return;
            }

            toast.success("Annonce mise à jour.");
            router.push(`/dashboard/${guildId}/marche/${initial.id}`);
            router.refresh();
        });
    }

    function handleSubmit(publishNow: boolean) {
        if (hasFormError()) return;

        startTransition(async () => {
            const created = await createMarketListing(guildId, buildPayload());

            if (!created.success || !created.data) {
                toast.error(created.error || "Impossible de créer l'annonce.");
                return;
            }

            if (!publishNow) {
                toast.success("Brouillon enregistré. Publie-le depuis « Mon espace ».");
                router.push(`/dashboard/${guildId}/marche/mes-espaces`);
                return;
            }

            const published = await publishMarketListing(guildId, created.data.id, pingRoleIds);
            if (!published.success) {
                toast.error(published.error || "L'annonce est créée mais la publication a échoué.");
                router.push(`/dashboard/${guildId}/marche/mes-espaces`);
                return;
            }

            toast.success("Annonce publiée sur le marché !");
            router.push(`/dashboard/${guildId}/marche/${created.data.id}`);
        });
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <StepIndicator step={step} stepCount={isEdit ? 3 : 5} />

            {step === 1 && (
                <StepNature
                    kind={kind}
                    icons={natureIcons}
                    onPick={(picked) => {
                        setKind(picked);
                        // 🧺 Lot multiple — on part directement sur **2 objets**
                        // (le minimum du lot) : plus besoin de cliquer « Ajouter un
                        // objet » pour atteindre la borne basse.
                        if (picked === "BUNDLE") {
                            setComponents((prev) =>
                                prev.length >= MARKET_BUNDLE_MIN_ITEMS
                                    ? prev
                                    : Array.from({ length: MARKET_BUNDLE_MIN_ITEMS }, (_, index) => ({
                                          key: `bundle-${index}-nouveau`,
                                          dofusDbItemId: null,
                                          name: "",
                                          iconUrl: null,
                                          quantity: 1,
                                          unitLabel: null,
                                          priceKamas: 0,
                                      }))
                            );
                        }
                        setStep(2);
                    }}
                />
            )}

            {/* 🧺 Lot multiple : **aucun** sélecteur d'objet unique (le lot se compose
                de 2 à 5 objets, chacun cherché dans **tout** le catalogue). */}
            {step === 2 && kind !== "RESOURCE" && kind !== "BUNDLE" && (
                <>
                    <StepEquipment
                        family={KIND_TO_FAMILY[kind]}
                        item={item}
                        onSelect={(picked) => {
                            setItem(picked);
                            if (!title.trim()) setTitle(picked.name);
                            /**
                             * S2.8 — plages natives pré-remplies (source
                             * catalogue), **sauf** famille « vente brute »
                             * (constat beta) : une monture d'apparat ne part
                             * plus avec ses lignes de métadonnées `0 → 0`.
                             * Le serveur reste seul juge (`statEditorAllowed`).
                             */
                            const pickedPolicy = resolveMarketItemPolicy({
                                typeId: picked.typeId ?? null,
                                superTypeId: picked.superTypeId ?? null,
                                typeName: picked.typeName ?? null,
                                category: picked.category ?? null,
                            });
                            setStats(
                                pickedPolicy.statEditorAllowed
                                    ? buildNativeStatDrafts(
                                          (picked.nativeEffects as MarketNativeEffect[] | null) ?? null,
                                          statDraftOptions
                                      )
                                    : []
                            );
                        }}
                        onClear={() => {
                            setItem(null);
                            setStats([]);
                        }}
                    />
                    {item && (
                        <>
                            {/* S8.7 — carte du CATALOGUE (jets max + EFFETS + STATUT)
                                **au-dessus** de l'éditeur : le vendeur voit d'abord
                                l'objet réel, puis déclare son jet. */}
                            {catalogueCard && <MarketItemCard data={catalogueCard} />}

                            {itemPolicy.statEditorAllowed ? (
                                <Card className="bg-surface/60 border-border">
                                    <CardHeader>
                                        <CardTitle className="text-base">Déclare ton jet</CardTitle>
                                        <CardDescription>
                                            Les lignes natives sont pré-remplies depuis le catalogue. Ajuste la valeur
                                            réelle, ajoute un exo, ou clique « ✦ Jet parfait ». Les lignes non
                                            forgeables de l&apos;objet restent affichées sur la carte ci-dessus.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <MarketJetEditor
                                            stats={stats}
                                            onChange={setStats}
                                            transcendenceActive={isTranscended}
                                        />
                                    </CardContent>
                                </Card>
                            ) : (
                                /* BUG-11 — compagnon / Dofus / Trophée / Prysmaradite /
                                   apparat : **vente brute**, aucune saisie de stats. */
                                <Card className="bg-surface/60 border-border">
                                    <CardHeader>
                                        <CardTitle className="text-base">Vente brute</CardTitle>
                                        <CardDescription>
                                            Cet objet ({MARKET_ITEM_FAMILY_LABELS[itemPolicy.family]}) ne se modifie pas :
                                            il est vendu tel quel, sans jet déclaré ni forgemagie.
                                        </CardDescription>
                                    </CardHeader>
                                </Card>
                            )}

                            {/* S8.9 — bloc « Forge » (D40/D41) : transcende, élément
                                de frappe (armes), arme de chasse (armes).
                                BUG-11 : masqué pour tout objet non forgeable. */}
                            {itemPolicy.forgeAllowed && (
                                <ForgeBlock
                                    item={item}
                                    referential={referential}
                                    forge={forge}
                                    onChange={setForge}
                                    conflicts={transcendenceConflicts}
                                />
                            )}
                        </>
                    )}
                </>
            )}

            {step === 2 && kind === "RESOURCE" && (
                <StepResources
                    components={components}
                    onAdd={(source) => setComponents((prev) => [...prev.slice(0, MARKET_LIMITS.MAX_COMPONENTS - 1), source])}
                    onChangeQuantity={(index, quantity) =>
                        setComponents((prev) => prev.map((row, i) => (i === index ? { ...row, quantity } : row)))
                    }
                    onRemove={(index) => setComponents((prev) => prev.filter((_, i) => i !== index))}
                    minQuantity={minQuantity}
                    onMinQuantityChange={setMinQuantity}
                />
            )}

            {/* 🧺 Lot multiple — 2 à 5 objets, **prix par objet** (décision user
                du 14/09/2026). Éditeur partagé : mêmes bornes que le serveur. */}
            {step === 2 && kind === "BUNDLE" && (
                <MarketBundleItemsEditor
                    items={bundleItems}
                    renderPicker={(index, onPick) => (
                        <CataloguePicker
                            placeholder={`Rechercher l'objet n°${index + 1} — tout le catalogue Dofus`}
                            onSelect={(picked) =>
                                onPick({
                                    ankamaId: picked.ankamaId,
                                    name: picked.name,
                                    iconUrl: picked.iconUrl ?? null,
                                })
                            }
                        />
                    )}
                    onChange={(items) =>
                        setComponents(
                            items.map((entry, index) => ({
                                key: `bundle-${index}-${entry.name}`,
                                dofusDbItemId: entry.dofusDbItemId ?? null,
                                name: entry.name,
                                iconUrl: entry.iconUrl ?? null,
                                quantity: entry.quantity,
                                unitLabel: entry.unitLabel ?? null,
                                priceKamas: entry.priceKamas,
                            }))
                        )
                    }
                />
            )}

            {step === 3 && kind === "BUNDLE" && (
                <StepBundleTerms
                    items={bundleItems}
                    title={title}
                    setTitle={setTitle}
                    description={description}
                    setDescription={setDescription}
                    negotiable={negotiable}
                    setNegotiable={setNegotiable}
                    acceptsTrade={acceptsTrade}
                    setAcceptsTrade={setAcceptsTrade}
                />
            )}

            {step === 3 && kind !== "BUNDLE" && (
                <StepPricing
                    kind={kind}
                    item={item}
                    components={components}
                    title={title}
                    setTitle={setTitle}
                    description={description}
                    setDescription={setDescription}
                    forgedBy={forgedBy}
                    setForgedBy={setForgedBy}
                    priceInput={priceInput}
                    setPriceInput={setPriceInput}
                    priceInvalid={priceInvalid}
                    negotiable={negotiable}
                    setNegotiable={setNegotiable}
                    acceptsTrade={acceptsTrade}
                    setAcceptsTrade={setAcceptsTrade}
                />
            )}

            {/* 🧺 Lot multiple — **vrai récapitulatif** avant publication : un prix
                par objet, le total, et ce que les membres verront réellement
                (option A = un message Discord par objet, donc N messages). */}
            {!isEdit && step === 4 && kind === "BUNDLE" && (
                <div className="space-y-2 rounded-xl border border-border bg-surface/60 p-4">
                    <p className="text-sm font-semibold text-foreground">Récapitulatif du lot</p>
                    <ul className="space-y-1">
                        {bundleItems.map((entry, index) => (
                            <li
                                key={`${index}-${entry.name}`}
                                className="flex items-center justify-between gap-3 text-sm"
                            >
                                <span className="min-w-0 flex-1 truncate text-foreground">
                                    {index + 1}. {entry.name || "(objet à nommer)"}
                                    {entry.quantity > 1 ? ` × ${entry.quantity}` : ""}
                                </span>
                                <span className="shrink-0 font-medium text-foreground">
                                    <KamasAmount value={entry.priceKamas} />
                                </span>
                            </li>
                        ))}
                    </ul>
                    <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
                        <span className="text-muted-foreground">Total du lot</span>
                        <span className="font-semibold text-foreground">
                            <KamasAmount value={computeBundleTotal(bundleItems)} />
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        🧺 {bundleItems.length} objet(s) ⇒{" "}
                        <strong>{bundleItems.length} message(s) Discord</strong>, un par objet : chacun
                        peut être réservé et négocié séparément, à son prix.
                    </p>
                </div>
            )}

            {!isEdit && step === 4 && (
                <>
                    {/* Correction 13/09 — la carte publiée (jet + forge déclarés) :
                        c'est l'image que Discord affiche sous l'embed en salon
                        texte. Le vendeur y voit les icônes officielles, les exo en
                        couleur et les malus négatifs. */}
                    {declaredCard && (
                        <div className="space-y-2">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                Carte de l&apos;annonce (image jointe par Discord)
                            </p>
                            <MarketItemCard data={declaredCard} />
                        </div>
                    )}
                    <MarketPublishStep
                        channelName=""
                        title={title || item?.name || "Annonce"}
                        itemName={kind !== "RESOURCE" ? item?.name ?? null : null}
                        itemLevel={kind !== "RESOURCE" ? item?.level ?? null : null}
                        itemTypeName={kind !== "RESOURCE" ? item?.typeName ?? null : null}
                        priceKamas={parsedPrice}
                        unitLabel={kind === "RESOURCE" && components.length === 1 ? components[0].unitLabel : null}
                        negotiable={negotiable}
                        // S8.17 — l'aperçu doit montrer EXACTEMENT ce que l'embed
                        // publie : statut de forge déclaré + condition de troc (D43).
                        acceptsTrade={acceptsTrade}
                        transcended={isTranscended}
                        transcendenceLabel={forge.transcendenceLabel}
                        strikeElement={forge.strikeElement}
                        elementPotionTier={forge.elementPotionTier}
                        huntingWeapon={forge.huntingWeapon.trim() || null}
                        forgedBy={forgedBy.trim() || null}
                        exoLabels={declarableStats.filter((stat) => stat.origin === "EXO").map((stat) => stat.label)}
                        // Correction 13/09 — le jet déclaré part dans l'embed.
                        stats={publishStats}
                        forgeRecap={forgeRecap}
                        // Correction 13/09 — aperçu fidèle : icône réelle + mode forum.
                        itemIconUrl={kind !== "RESOURCE" ? item?.iconUrl ?? null : null}
                        forumMode={publishContext?.channelKind === "FORUM"}
                    bundleItems={
                        kind === "BUNDLE"
                            ? bundleItems.map((entry) => ({
                                  name: entry.name,
                                  quantity: entry.quantity,
                                  priceKamas: entry.priceKamas,
                                  iconUrl: entry.iconUrl ?? null,
                              }))
                            : []
                    }
                        components={components.map((component) => ({ name: component.name, quantity: component.quantity }))}
                        context={publishContext}
                        // La mention n'apparaît dans l'aperçu que si des rôles ont déjà
                        // été cochés à l'étape suivante (retour en arrière).
                        selectedPingIds={pingRoleIds}
                    />
                </>
            )}

            {!isEdit && step === 5 && (
                <MarketNotifyStep
                    guildId={guildId}
                    context={publishContext}
                    roles={roles}
                    selectedPingIds={pingRoleIds}
                    onTogglePing={togglePing}
                    onClearPing={clearPing}
                    listingLabel={title || item?.name || "Annonce"}
                    bundleMessageCount={kind === "BUNDLE" ? bundleItems.length : 0}
                    forumMode={publishContext?.channelKind === "FORUM"}
                    channelName=""
                />
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
                <Button
                    type="button"
                    variant="ghost"
                    className="gap-2"
                    disabled={step === 1 || isPending}
                    onClick={() => setStep((prev) => (prev > 1 ? ((prev - 1) as 1 | 2 | 3 | 4 | 5) : prev))}
                >
                    <ChevronLeft className="w-4 h-4" />
                    Retour
                </Button>

                {/* S7.12 — en édition, la dernière étape enregistre les modifications. */}
                {isEdit && step === 3 ? (
                    <Button
                        type="button"
                        className="gap-2"
                        disabled={isPending || !canGoNext}
                        onClick={handleUpdate}
                    >
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Enregistrer les modifications
                    </Button>
                ) : !isEdit && step === 5 ? (
                    /* Dernière étape (Notification) : c'est ICI qu'on publie — la
                       notification est choisie juste avant, donc plus de doute sur ce
                       qui partira dans le salon. */
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" disabled={isPending || !canGoNext} onClick={() => handleSubmit(false)}>
                            Enregistrer en brouillon
                        </Button>
                        <Button type="button" className="gap-2" disabled={isPending || !canGoNext} onClick={() => handleSubmit(true)}>
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            Publier l&apos;annonce
                        </Button>
                    </div>
                ) : (
                    <Button
                        type="button"
                        className="gap-2"
                        disabled={!canGoNext}
                        onClick={() => setStep((prev) => ((prev + 1) as 2 | 3 | 4 | 5))}
                    >
                        Continuer
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}


/**
 * Fil des étapes — **5** en création (… → 4 Publication → 5 Notification),
 * **3** en édition (S7.12 : l'annonce existe déjà, on ne rejoue pas les étapes
 * Discord). La notification a sa **propre** étape depuis le 18/09/2026.
 */
function StepIndicator({ step, stepCount = 5 }: { step: 1 | 2 | 3 | 4 | 5; stepCount?: 3 | 5 }) {
    const labels =
        stepCount === 3
            ? ["Nature", "Objet / Jet", "Prix"]
            : ["Nature", "Objet / Jet", "Prix", "Publication", "Notification"];
    return (
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-black">
            {labels.map((label, index) => {
                const value = index + 1;
                return (
                    <div key={label} className="flex items-center gap-2">
                        <span
                            className={cn(
                                "h-7 w-7 rounded-full border flex items-center justify-center",
                                step >= value ? "border-gold/40 bg-gold/10 text-gold" : "border-border text-muted-foreground"
                            )}
                        >
                            {value}
                        </span>
                        <span className={step >= value ? "text-foreground" : "text-muted-foreground"}>
                            {label}
                        </span>
                        {value < labels.length && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                    </div>
                );
            })}
        </div>
    );
}

/** Étape 1 — nature de l'annonce (BUG-11 : 3 familles + 🧺 lot multiple). */
function StepNature({
    kind,
    icons,
    onPick,
}: {
    kind: ListingKind;
    /** 🎨 Vignettes réelles par nature (objets du catalogue local, résolues serveur). */
    icons?: Partial<Record<ListingKind, string[]>>;
    onPick: (kind: ListingKind) => void;
}) {
    /**
     * Les 3 premières natures viennent de `MARKET_ITEM_FAMILY_LABELS` : « Équipement
     * forgemagie » et « Lot de ressources » sont **remplacés** par
     * « Équipements », « Cosmétique » et « Ressources / Autres » (BUG-11). La 4ᵉ,
     * **« Lot multiple »**, est une décision user du 14/09/2026 : un lot est
     * **hétérogène**, il n'a donc pas de libellé de famille (libellé propre).
     */
    const options: Array<{
        kind: ListingKind;
        Icon: typeof Hammer;
        tone: string;
        label?: string;
        description?: string;
    }> = [
        {
            kind: "EQUIPMENT",
            Icon: Hammer,
            tone: "text-gold",
            description:
                "Coiffe, cape, anneau, ceinture, bottes, arme, bouclier : le barda de l'aventurier, jet déclarable.",
        },
        {
            kind: "COSMETIC",
            Icon: Sparkles,
            tone: "text-violet-400",
            description: "Apparats et costumes : l'apparence se vend brute, aucun jet à déclarer.",
        },
        {
            kind: "RESOURCE",
            Icon: Package,
            tone: "text-info",
            description: "Bois, minerais, runes, pains, ingrédients : au détail ou en lot, quantité libre.",
        },
        {
            kind: "BUNDLE",
            Icon: Boxes,
            tone: "text-success",
            label: "Lot multiple",
            description: "Plusieurs prises d'un coup : 2 à 5 objets, chacun son prix et son annonce Discord.",
        },
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {options.map(({ kind: optionKind, Icon, tone, label, description: optionDescription }) => {
                const family = KIND_TO_FAMILY[optionKind];
                const selected = kind === optionKind;
                return (
                    <button
                        key={optionKind}
                        type="button"
                        onClick={() => onPick(optionKind)}
                        className={cn(
                            "text-left rounded-2xl border p-5 transition-colors",
                            selected
                                ? "border-gold/40 bg-gold/5"
                                : "border-border bg-surface/60 hover:border-border-strong"
                        )}
                    >
                        {icons?.[optionKind]?.length ? (
                            /* 🎨 Vignette(s) **réelle(s)** : l'objet du catalogue local
                               lui-même. Un lot en montre trois (il est hétérogène). */
                            <span
                                className={cn(
                                    "mb-3 flex h-11 items-center",
                                    (icons?.[optionKind]?.length ?? 0) > 1 && "-space-x-2.5"
                                )}
                            >
                                {(icons?.[optionKind] ?? []).map((url, position) => (
                                    <span
                                        key={url}
                                        style={{ zIndex: 10 - position }}
                                        className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-border bg-background/70 shadow-sm"
                                    >
                                        <Image
                                            src={url}
                                            alt=""
                                            fill
                                            sizes="44px"
                                            className="object-contain p-0.5"
                                            unoptimized
                                        />
                                    </span>
                                ))}
                            </span>
                        ) : (
                            <Icon className={cn("w-6 h-6 mb-3", selected ? tone : "text-muted-foreground")} />
                        )}
                        <p className="font-bold text-foreground">
                            {label ?? MARKET_ITEM_FAMILY_LABELS[family]}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {optionDescription ?? MARKET_ITEM_FAMILY_DESCRIPTIONS[family]}
                        </p>
                    </button>
                );
            })}
        </div>
    );
}

/* (ancien rendu 3 colonnes retiré — remplacé par la version 4 natures ci-dessus) */


/** Étape 2 (équipement) — sélection d'un objet du catalogue local. */
function StepEquipment({
    item,
    family,
    onSelect,
    onClear,
}: {
    item: GameItemSearchResult | null;
    /** BUG-11/T10 — famille filtrée dans le catalogue (Équipements / Cosmétique). */
    family: MarketItemFamily;
    onSelect: (item: GameItemSearchResult) => void;
    onClear: () => void;
}) {
    return (
        <Card className="bg-surface/60 border-border">
            <CardHeader>
                <CardTitle className="text-base">Choisis l&apos;objet du catalogue</CardTitle>
                <CardDescription>Recherche par nom dans le catalogue local Dofus (aucun item inventé).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {item ? (
                    <SelectedItem item={item} onClear={onClear} />
                ) : (
                    <CataloguePicker
                        family={family}
                        placeholder="Ex. Anneau de Force…"
                        onSelect={onSelect}
                    />
                )}
            </CardContent>
        </Card>
    );
}

/** Étape 2 (ressources) — lot simple ou composite (S1.33). */
function StepResources({
    components,
    onAdd,
    onChangeQuantity,
    onRemove,
    minQuantity,
    onMinQuantityChange,
}: {
    components: ComponentDraft[];
    onAdd: (component: ComponentDraft) => void;
    onChangeQuantity: (index: number, quantity: number) => void;
    onRemove: (index: number) => void;
    minQuantity: string;
    onMinQuantityChange: (value: string) => void;
}) {
    return (
        <Card className="bg-surface/60 border-border">
            <CardHeader>
                <CardTitle className="text-base">Compose ton lot de ressources</CardTitle>
                <CardDescription>
                    Jusqu&apos;à {MARKET_LIMITS.MAX_COMPONENTS} ressources. La quantité minimale s&apos;applique à tout le lot.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <CataloguePicker
                    family="RESOURCES_OTHER"
                    placeholder="Ex. Bois de Frêne…"
                    onSelect={(picked) =>
                        onAdd({
                            key: `${picked.ankamaId}-${components.length}-${picked.name}`,
                            dofusDbItemId: picked.ankamaId,
                            name: picked.name,
                            iconUrl: picked.iconUrl,
                            quantity: 1,
                            unitLabel: null,
                        })
                    }
                />

                {components.length > 0 && (
                    <div className="space-y-2">
                        {components.map((component, index) => (
                            <div key={component.key} className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3">
                                <span className="text-sm font-semibold text-foreground truncate flex-1">{component.name}</span>
                                <Input
                                    type="number"
                                    min={1}
                                    value={component.quantity}
                                    onChange={(event) => {
                                        const value = Math.max(1, Number.parseInt(event.target.value || "1", 10) || 1);
                                        onChangeQuantity(index, value);
                                    }}
                                    className="w-28"
                                />
                                <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(index)}>
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        ))}
                        <div className="space-y-1.5 pt-1">
                            <Label className="text-xs">Quantité minimale par acheteur (facultatif)</Label>
                            <Input
                                placeholder="Ex. 100"
                                value={minQuantity}
                                onChange={(event) => onMinQuantityChange(event.target.value)}
                                inputMode="numeric"
                                className="max-w-xs"
                            />
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}


/**
 * 🧺 Étape 3 — **conditions du lot multiple** (décision user 14/09/2026).
 *
 * Pourquoi un panneau dédié plutôt que `StepPricing` : un lot **n'a pas de prix
 * global** (le prix vit sur chaque objet, étape 2) ⇒ le champ « Prix en kamas »
 * y serait un piège (on le remplit et il est ignoré), et « Modifié par » relève
 * de la forge, donc sans objet pour un lot. Ici : on nomme, on décrit, on pose
 * les conditions, et on **relit la composition** avec le total.
 */
function StepBundleTerms({
    items,
    title,
    setTitle,
    description,
    setDescription,
    negotiable,
    setNegotiable,
    acceptsTrade,
    setAcceptsTrade,
}: {
    items: BundleItemInput[];
    title: string;
    setTitle: (value: string) => void;
    description: string;
    setDescription: (value: string) => void;
    negotiable: boolean;
    setNegotiable: (value: boolean) => void;
    acceptsTrade: boolean;
    setAcceptsTrade: (value: boolean) => void;
}) {
    return (
        <div className="space-y-4">
            <Card className="bg-surface/60 border-border">
                <CardHeader>
                    <CardTitle className="text-base">Ce que tu exposes</CardTitle>
                    <CardDescription>
                        Le prix de chaque objet est déjà posé (étape 2). Ici tu nommes le lot et tu dis
                        comment l&apos;échange se conclut.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <Label className="text-xs">Nom du lot</Label>
                        <Input
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder="Ex. Lot du mineur : bois, fer, runes"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs">Description (facultatif)</Label>
                        <Textarea
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            placeholder="Précise l'état, les conditions d'échange, tes disponibilités… (les liens sont retirés)"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-5">
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Switch checked={negotiable} onCheckedChange={setNegotiable} />
                            Prix négociable
                        </label>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Switch checked={acceptsTrade} onCheckedChange={setAcceptsTrade} />
                            Troc accepté
                        </label>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-surface/60 border-border">
                <CardHeader>
                    <CardTitle className="text-base">Composition du lot</CardTitle>
                    <CardDescription>
                        Chaque objet est réservable séparément, à son prix (les membres verront un message
                        Discord par objet).
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    {items.map((item, index) => (
                        <div
                            key={`${index}-${item.name}`}
                            className="flex items-center justify-between gap-3 text-sm"
                        >
                            <span className="min-w-0 flex-1 truncate text-foreground">
                                {index + 1}. {item.name}
                                {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                            </span>
                            <span className="shrink-0">
                                <KamasAmount value={item.priceKamas} />
                            </span>
                        </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
                        <span className="text-muted-foreground">Total du lot</span>
                        <span className="font-semibold text-foreground">
                            <KamasAmount value={computeBundleTotal(items)} />
                        </span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

/** Étape 3 — titre, description, prix et conditions. */
function StepPricing(props: {
    kind: ListingKind;
    item: GameItemSearchResult | null;
    components: ComponentDraft[];
    title: string;
    setTitle: (value: string) => void;
    description: string;
    setDescription: (value: string) => void;
    forgedBy: string;
    setForgedBy: (value: string) => void;
    priceInput: string;
    setPriceInput: (value: string) => void;
    priceInvalid: boolean;
    negotiable: boolean;
    setNegotiable: (value: boolean) => void;
    acceptsTrade: boolean;
    setAcceptsTrade: (value: boolean) => void;
}) {
    const preview = parseKamas(props.priceInput);
    return (
        <Card className="bg-surface/60 border-border">
            <CardHeader>
                <CardTitle className="text-base">Prix & conditions</CardTitle>
                <CardDescription>
                    {props.kind !== "RESOURCE"
                        ? props.item?.name ?? "Objet du catalogue"
                        : `${props.components.length} ressource(s)`}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-1.5">
                    <Label className="text-xs">Titre de l&apos;annonce</Label>
                    <Input
                        value={props.title}
                        onChange={(event) => props.setTitle(event.target.value)}
                        maxLength={MARKET_LIMITS.TITLE_MAX}
                        placeholder="Ex. Anneau de Force +12 Vitalité, over 300"
                    />
                </div>

                {props.kind !== "RESOURCE" && (
                    <div className="space-y-1.5">
                        <Label className="text-xs">Modifié par (facultatif)</Label>
                        <Input
                            value={props.forgedBy}
                            onChange={(event) => props.setForgedBy(event.target.value)}
                            maxLength={80}
                            placeholder="Pseudo de l'artisan FM"
                        />
                    </div>
                )}

                <div className="space-y-1.5">
                    <Label className="text-xs">Description (facultatif)</Label>
                    <Textarea
                        value={props.description}
                        onChange={(event) => props.setDescription(event.target.value)}
                        maxLength={MARKET_LIMITS.DESCRIPTION_MAX}
                        rows={3}
                        placeholder="Précise l'état, les conditions d'échange, tes disponibilités… (les liens sont retirés)"
                    />
                </div>

                <div className="space-y-1.5">
                    <Label className="text-xs">Prix en kamas *</Label>
                    <Input
                        value={props.priceInput}
                        onChange={(event) => props.setPriceInput(event.target.value)}
                        inputMode="numeric"
                        placeholder="Ex. 12 500"
                        className={props.priceInvalid ? "border-danger" : undefined}
                    />
                    <p className="text-[11px] text-muted-foreground">
                        {props.priceInvalid
                            ? "Prix invalide : saisis un entier de kamas."
                            : `Aperçu : ${formatKamas(preview)}`}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-6 pt-1">
                    <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                        <Switch checked={props.negotiable} onCheckedChange={props.setNegotiable} />
                        Prix négociable
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                        <Switch checked={props.acceptsTrade} onCheckedChange={props.setAcceptsTrade} />
                        Troc accepté
                    </label>
                </div>
            </CardContent>
        </Card>
    );
}

/** Aperçu de l'objet sélectionné. */
function SelectedItem({ item, onClear }: { item: GameItemSearchResult; onClear: () => void }) {
    return (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3">
            <div className="relative h-12 w-12 shrink-0 rounded-xl border border-border bg-background/60 overflow-hidden">
                {item.iconUrl ? (
                    <Image src={item.iconUrl} alt={item.name} fill sizes="48px" className="object-contain p-1" unoptimized />
                ) : (
                    <Store className="w-5 h-5 text-muted-foreground absolute inset-0 m-auto" />
                )}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                    {item.typeName} · Niv. {item.level}
                </p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={onClear}>
                Changer
            </Button>
        </div>
    );
}


/**
 * S8.9 — bloc « **Forge** » de l'écran de déclaration (D40/D41).
 *
 *   1. **Rune de Transcendance** (référentiel `typeId 211`, paliers Ta/PaTa/RaTa) :
 *      bonus définitif qui **empêche les futures forgemagies** ⇒ over/exo
 *      désactivés dans l'éditeur (et garde serveur S8.11) ;
 *   2. **Élément de frappe** (ARMES) + **potion** de forgemagie (`typeId 26`,
 *      paliers 50 / 65 / 80 %) ;
 *   3. **Arme de chasse** (ARMES, exception FM du référentiel).
 *
 * 🔌 Data-driven (D41) : les listes viennent de `getSmithmagicReferential`
 * (table `GameItem`, **aucun nouvel appel réseau**).
 * 🪶 **Fail-soft** : référentiel absent ou `degraded: true` ⇒ le bloc se masque,
 * l'écran de création n'est jamais cassé.
 * 🖼️ Chaque entrée porte son **icône officielle** ; les potions du palier 65 %
 * (non siphonnées) retombent sur l'icône de l'**élément** — jamais d'image cassée.
 */
function ForgeBlock({
    item,
    referential,
    forge,
    onChange,
    conflicts,
}: {
    item: GameItemSearchResult;
    referential: SmithmagicReferential | null;
    forge: MarketForgeState;
    onChange: (next: MarketForgeState) => void;
    /** Lignes over/exo incompatibles avec la Transcendance (garde pure S8.11). */
    conflicts: string[];
}) {
    const [palier, setPalier] = useState<SmithmagicPalier>("Ta");
    const [runeQuery, setRuneQuery] = useState("");

    // 🪶 Fail-soft : pas de référentiel (ou référentiel dégradé) ⇒ bloc masqué.
    if (!referential || referential.degraded) return null;

    /** « Transcendé » est **déclaratif** (D40) : la rune ou rien. */
    const isTranscended = forge.transcendenceRuneId != null;

    const isWeapon = isWeaponItem({
        itemSuperTypeName: item.superTypeName ?? null,
        itemTypeName: item.typeName ?? null,
    });
    const selectedRune =
        referential.runes.find((rune) => rune.ankamaId === forge.transcendenceRuneId) ?? null;
    const term = runeQuery.trim().toLowerCase();
    const runes = referential.runes.filter(
        (rune) =>
            rune.palier === palier &&
            (term.length === 0 || `${rune.name} ${rune.statLabel}`.toLowerCase().includes(term))
    );
    const potions = forge.strikeElement
        ? referential.potions.filter((potion) => potion.element === forge.strikeElement)
        : [];

    /**
     * Rune proposée quand le vendeur **active** la Transcendance : la première du
     * palier courant (aucune invention — elle vient du référentiel siphonné), ce
     * qui évite un état « transcende sans rune ».
     */
    const firstRune = runes[0] ?? referential.runes[0] ?? null;

    /** Rune de Transcendance : présence = objet « transcendé » (D40). */
    function pickRune(rune: TranscendenceRune | null) {
        onChange({
            ...forge,
            transcendenceRuneId: rune ? rune.ankamaId : null,
            transcendenceLabel: rune ? TRANSCENDENCE_LABEL : null,
        });
    }

    /** Élément de frappe : changer d'élément remet la potion à zéro. */
    function pickElement(element: SmithmagicElement | null) {
        onChange({
            ...forge,
            strikeElement: element,
            elementPotionId: null,
            elementPotionTier: null,
        });
    }

    /** Potion : fixe l'élément **et** le palier (id `null` si non siphonnée). */
    function pickPotion(potion: ElementPotion) {
        onChange({
            ...forge,
            strikeElement: potion.element,
            elementPotionId: potion.ankamaId,
            elementPotionTier: potion.tier,
        });
    }

    return (
        <Card className="bg-surface/60 border-border" data-tour="marche-forge">
            <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                    <Hammer className="w-4 h-4 text-gold" />
                    Ce qui ne se lit pas dans le jet
                </CardTitle>
                <CardDescription>
                    L&apos;éditeur ci-dessus décrit les <strong>valeurs</strong> de l&apos;objet.
                    Ici, tu déclares ce qui <strong>ne s&apos;y lit pas</strong> : une{" "}
                    <strong>rune de Transcendance</strong>, un <strong>élément de frappe</strong>{" "}
                    (potion) et une <strong>arme de chasse</strong>. SigilOS ne lit jamais ton
                    inventaire : ces trois états sont <strong>déclaratifs</strong> — laisse-les
                    vides si l&apos;objet ne les porte pas.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                {/* 1 — Rune de Transcendance (typeId 211) */}
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface/40 px-3 py-2">
                        <div className="min-w-0">
                            <Label className="text-xs font-bold">
                                Objet transcendé (rune de Transcendance)
                            </Label>
                            <p className="text-[11px] text-muted-foreground">
                                Bonus <strong>définitif</strong> qui « empêche les futures
                                forgemagies » ⇒ SigilOS refuse alors tout <strong>over</strong> et
                                tout <strong>exo</strong> (éditeur de jet verrouillé).
                            </p>
                        </div>
                        <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-muted-foreground">
                            <Switch
                                checked={isTranscended}
                                disabled={firstRune === null}
                                onCheckedChange={(checked) => pickRune(checked ? firstRune : null)}
                            />
                            {isTranscended ? "Oui" : "Non"}
                        </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Runes siphonnées
                        </span>
                        <span className="flex items-center gap-2 text-[10px] font-bold uppercase text-muted-foreground">
                            {SMITHMAGIC_PALIERS.map((value) => (
                                <span key={value} className="tabular-nums">
                                    {value} {referential.runeCounts[value] ?? 0}
                                </span>
                            ))}
                        </span>
                    </div>

                    {/*
                     * Correction 13/09 (2ᵉ passe, constat user) — la rune
                     * automatiquement posée à l'activation restait **figée** :
                     * le sélecteur n'était rendu que dans la branche « aucune
                     * rune choisie », donc jamais une fois la Transcendance
                     * activée (« impossible à changer »). La liste (paliers +
                     * recherche) est maintenant **toujours rendue** sous la rune
                     * courante, qui peut être remplacée d'un clic.
                     */}
                    {selectedRune && (
                        <div className="flex items-center gap-3 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2">
                            <ForgeEntryIcon
                                src={selectedRune.iconUrl}
                                fallbackAsset={strikeElementAsset("Neutre")}
                                alt={selectedRune.name}
                            />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-bold text-gold">
                                    {selectedRune.name}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                    {selectedRune.statLabel} +{selectedRune.bonus} · palier{" "}
                                    {selectedRune.palier} · {TRANSCENDENCE_LABEL}
                                </p>
                            </div>
                            <Button type="button" variant="ghost" size="sm" onClick={() => pickRune(null)}>
                                Retirer
                            </Button>
                        </div>
                    )}
                    {isTranscended && (
                        <>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Changer de rune
                                </span>
                                {SMITHMAGIC_PALIERS.map((value) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setPalier(value)}
                                        className={cn(
                                            "rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors",
                                            palier === value
                                                ? "border-gold/40 bg-gold/10 text-gold"
                                                : "border-border text-muted-foreground hover:border-border-strong"
                                        )}
                                    >
                                        {value}
                                    </button>
                                ))}
                                <div className="relative ml-auto w-full max-w-xs">
                                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        value={runeQuery}
                                        onChange={(event) => setRuneQuery(event.target.value)}
                                        placeholder="Rechercher une rune (ex. Agilité)"
                                        className="h-9 pl-9 text-xs"
                                    />
                                </div>
                            </div>

                            <ul className="max-h-[220px] space-y-1 overflow-y-auto custom-scrollbar pr-1">
                                {runes.length === 0 && (
                                    <li className="px-3 py-4 text-center text-xs text-muted-foreground">
                                        Aucune rune {palier} ne correspond à « {runeQuery} ».
                                    </li>
                                )}
                                {runes.map((rune) => {
                                    const isSelected = rune.ankamaId === forge.transcendenceRuneId;
                                    return (
                                        <li key={rune.ankamaId}>
                                            <button
                                                type="button"
                                                onClick={() => pickRune(rune)}
                                                className={cn(
                                                    "flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
                                                    isSelected
                                                        ? "border-gold/40 bg-gold/10"
                                                        : "border-border bg-surface/60 hover:border-border-strong"
                                                )}
                                            >
                                                <ForgeEntryIcon
                                                    src={rune.iconUrl}
                                                    fallbackAsset={strikeElementAsset("Neutre")}
                                                    alt={rune.name}
                                                />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-semibold text-foreground">
                                                        {rune.name}
                                                    </span>
                                                    <span className="block text-[11px] text-muted-foreground">
                                                        {rune.statLabel} +{rune.bonus} · niveau {rune.level}
                                                    </span>
                                                </span>
                                                {isSelected && (
                                                    <Check className="h-4 w-4 shrink-0 text-gold" />
                                                )}
                                                <span className="shrink-0 text-[10px] font-black uppercase text-muted-foreground">
                                                    {rune.palier}
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </>
                    )}
                    {conflicts.length > 0 && (
                        <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-[11px] font-semibold text-danger">
                            Objet transcendé : retire d&apos;abord {conflicts.join(", ")} — une rune
                            de Transcendance n&apos;accepte ni over ni exo. Remets ces lignes au jet
                            max (ou supprime-les) dans l&apos;éditeur ci-dessus.
                        </p>
                    )}

                    {/* 2 — Élément de frappe + potion (ARMES uniquement) */}
                    <div className="space-y-2 pt-2">
                        <Label className="text-xs">Élément de frappe (armes)</Label>
                        {!isWeapon ? (
                            <p className="text-[11px] text-muted-foreground">
                                {item.typeName} n&apos;est pas une arme : l&apos;élément de frappe
                                (potion de forgemagie) et l&apos;arme de chasse ne s&apos;appliquent
                                qu&apos;aux armes.
                            </p>
                        ) : (
                            <>
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => pickElement(null)}
                                        className={cn(
                                            "rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors",
                                            forge.strikeElement === null
                                                ? "border-gold/40 bg-gold/10 text-gold"
                                                : "border-border text-muted-foreground hover:border-border-strong"
                                        )}
                                    >
                                        Aucun
                                    </button>
                                    {ELEMENT_POTION_ELEMENTS.map((element) => (
                                        <button
                                            key={element}
                                            type="button"
                                            onClick={() => pickElement(element)}
                                            className={cn(
                                                "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors",
                                                forge.strikeElement === element
                                                    ? "border-gold/40 bg-gold/10 text-gold"
                                                    : "border-border text-muted-foreground hover:border-border-strong"
                                            )}
                                        >
                                            <Image
                                                src={dofusStatAssetUrl(strikeElementAsset(element))}
                                                alt={element}
                                                width={14}
                                                height={14}
                                                unoptimized
                                            />
                                            {element}
                                        </button>
                                    ))}
                                </div>
                                {forge.strikeElement && (
                                    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                        {potions.map((potion) => {
                                            const selected = forge.elementPotionTier === potion.tier;
                                            return (
                                                <li key={potion.name}>
                                                    <button
                                                        type="button"
                                                        onClick={() => pickPotion(potion)}
                                                        className={cn(
                                                            "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors",
                                                            selected
                                                                ? "border-gold/40 bg-gold/10"
                                                                : "border-border bg-surface/60 hover:border-border-strong"
                                                        )}
                                                    >
                                                        <ForgeEntryIcon
                                                            src={potion.iconUrl}
                                                            fallbackAsset={strikeElementAsset(potion.element)}
                                                            alt={potion.name}
                                                        />
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block truncate text-xs font-semibold text-foreground">
                                                                {potion.name}
                                                            </span>
                                                            <span className="block text-[10px] uppercase text-muted-foreground">
                                                                {potion.tier} % des dégâts
                                                            </span>
                                                        </span>
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                                {forge.strikeElement && forge.elementPotionTier == null && (
                                    <p className="text-[11px] text-muted-foreground">
                                        Choisis la potion réellement utilisée : son palier fixe les
                                        dégâts conservés (50 / 65 / 80 %).
                                    </p>
                                )}
                            </>
                        )}
                    </div>
                    {isWeapon && (
                        <div className="space-y-1.5 pt-2">
                            <Label className="text-xs">Arme de chasse (facultatif, armes)</Label>
                            <Input
                                value={forge.huntingWeapon}
                                onChange={(event) =>
                                    onChange({ ...forge, huntingWeapon: event.target.value })
                                }
                                maxLength={MARKET_FORGE_LIMITS.WEAPON_MAX}
                                placeholder="Ex. Arc de Chasse"
                                className="max-w-sm"
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Exception du référentiel FM : elle s&apos;applique{" "}
                                <strong>avant</strong> la rune de Transcendance.
                            </p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

/**
 * Icône d'une entrée du bloc Forge : asset officiel siphonné, sinon repli sur
 * l'icône de l'**élément** (potions du palier 65 % non encore en base).
 */
function ForgeEntryIcon({
    src,
    fallbackAsset,
    alt,
}: {
    src: string | null;
    fallbackAsset: string;
    alt: string;
}) {
    return (
        <span className="relative h-8 w-8 shrink-0 rounded-lg border border-border bg-background/60">
            <Image
                src={src ?? dofusStatAssetUrl(fallbackAsset)}
                alt={alt}
                fill
                sizes="32px"
                className="object-contain p-0.5"
                unoptimized
            />
        </span>
    );
}

/** Recherche dans le catalogue local (consomme `searchLocalGameItems`, D29). */
function CataloguePicker({
    family,
    placeholder,
    onSelect,
}: {
    /**
     * BUG-11/T10 — **famille produit** filtrée côté serveur. Le filtre porte sur
     * `typeId` / `superTypeId` / `typeName` (et **plus** sur la catégorie
     * grossière du catalogue, dont l'heuristique classait « Bois » en
     * « equipment » ⇒ recherche vide, constat beta du 13/09).
     *
     * 🧺 Lot multiple — **facultative** : un lot est hétérogène, chaque objet doit
     * pouvoir venir de **n'importe quelle** famille (`undefined` ⇒ aucun filtre
     * côté serveur, cf. `if (filters.family)` dans `item-catalog.ts`).
     */
    family?: MarketItemFamily;
    placeholder: string;
    onSelect: (item: GameItemSearchResult) => void;
}) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<GameItemSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    /** `true` dès qu'une recherche aboutie correspond à la saisie courante. */
    const [searched, setSearched] = useState(false);
    /** Anti-course : seule la **dernière** frappe peut écrire les résultats (S7.15). */
    const requestId = useRef(0);

    /**
     * S7.15 — recherche **déclenchée à la frappe** : plus besoin de cliquer sur
     * « Rechercher ». Le bouton reste (accessibilité et repli explicite) et les
     * réponses obsolètes sont ignorées (`requestId`).
     */
    function runSearch(term: string) {
        const trimmed = term.trim();
        if (trimmed.length < 2) {
            setResults([]);
            setError(null);
            setSearched(false);
            return;
        }

        const id = ++requestId.current;
        setIsSearching(true);
        setError(null);
        void searchLocalGameItems(trimmed, "all", 12, family)
            .then((res) => {
                if (id !== requestId.current) return;
                if (!res.success) {
                    setError(res.error || "Recherche indisponible");
                    setResults([]);
                } else {
                    setResults(res.data || []);
                }
            })
            .catch(() => {
                if (id === requestId.current) setError("Recherche indisponible pour le moment.");
            })
            .finally(() => {
                if (id === requestId.current) {
                    setIsSearching(false);
                    setSearched(true);
                }
            });
    }

    useEffect(() => {
        const trimmed = query.trim();
        if (trimmed.length < 2) {
            setResults([]);
            setError(null);
            setSearched(false);
            return;
        }
        // Debounce : on attend 300 ms d'inactivité avant d'interroger le catalogue.
        const timer = setTimeout(() => runSearch(trimmed), 300);
        return () => clearTimeout(timer);
        // `runSearch` ne dépend que de `family` (rejouée si la nature change).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, family]);

    return (
        <div className="space-y-3">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                runSearch(query);
                            }
                        }}
                        placeholder={placeholder}
                        className="pl-9 pr-9"
                    />
                    {/* S7.15 — la recherche se déclenche à la frappe : le témoin de
                        chargement remplace le clic obligatoire d'avant. */}
                    {isSearching && (
                        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                </div>
                <Button type="button" variant="outline" onClick={() => runSearch(query)} disabled={isSearching || query.trim().length < 2}>
                    {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Rechercher"}
                </Button>
            </div>

            {error && <p className="text-xs text-danger">{error}</p>}

            {results.length > 0 && (
                <div className="max-h-72 overflow-y-auto rounded-xl border border-border divide-y divide-border/60">
                    {results.map((result) => (
                        <button
                            key={result.ankamaId}
                            type="button"
                            onClick={() => {
                                onSelect(result);
                                // UX (retour user 15/09) — le clic **referme** la
                                // recherche : sans cela le panneau de résultats
                                // restait ouvert sous la ligne, ce qui obligeait à
                                // le fermer à la main pour chaque objet du lot.
                                setQuery("");
                                setResults([]);
                                setSearched(false);
                                setError(null);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-foreground/[0.03] transition-colors"
                        >
                            <span className="relative h-8 w-8 shrink-0 rounded-lg border border-border bg-background/60 overflow-hidden">
                                {result.iconUrl ? (
                                    <Image src={result.iconUrl} alt={result.name} fill sizes="32px" className="object-contain p-0.5" unoptimized />
                                ) : null}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-foreground truncate">{result.name}</span>
                                <span className="block text-[11px] text-muted-foreground">
                                    {result.typeName} · Niv. {result.level}
                                </span>
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {searched && !isSearching && !error && results.length === 0 && (
                <p className="text-xs text-muted-foreground">Aucun objet trouvé. Essaie un autre nom.</p>
            )}
        </div>
    );
}


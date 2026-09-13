import { describe, it, expect } from "vitest";
import {
    CHAR_NAMES,
    BOOK_STAT_NAMES,
    STAT_ICON_SPECS,
    NEGATIVE_EFFECT_IDS,
    toNativeEffects,
    resolveNativeEffects,
    enrichNativeEffects,
    dedupeNativeEffects,
    isNegativeNativeEffect,
    curatedStatLabel,
    resolveStatLabel,
    getStatLabel,
    isPlaceholderStatLabel,
    resolveStoredStatLabel,
    normalizeNativeRange,
    resolveStatIconSpec,
    isPercentStat,
    formatStatValue,
    findNativeRange,
    isNativeEffect,
    buildNativeStatDrafts,
    applyEffectSign,
    resolveNativeStatLabel,
    EXO_EFFECT_PRESETS,
    buildExoStatDraft,
    type MarketNativeEffect,
} from "@/lib/market/effects";

/**
 * Module « Marché » — référentiel d'effets pur (S2.4 / S2.5bis).
 * Ces tests verrouillent le comportement du module partagé qui remplace les
 * maps historiquement enfermées dans `ItemSearchPanel`.
 */
describe("effects — référentiel pur", () => {
    it("CHAR_NAMES / BOOK_STAT_NAMES / STAT_ICON_SPECS exposent les tables partagées", () => {
        expect(CHAR_NAMES[11]).toBe("Vitalité");
        expect(BOOK_STAT_NAMES.vi).toBe("Vitalité");
        expect(STAT_ICON_SPECS["11"]).toEqual({ icon: "heart", color: "text-danger" });
    });

    it("getStatLabel priorise le référentiel data-driven", () => {
        expect(getStatLabel({ characteristic: 11 }, { 11: "Vitalité (base)" })).toBe("Vitalité (base)");
    });

    it("getStatLabel retombe sur int_name puis CHAR_NAMES puis « Effet »", () => {
        expect(getStatLabel({ int_name: "vi" })).toBe("Vitalité");
        expect(getStatLabel({ characteristic: 10 })).toBe("Force");
        expect(getStatLabel({ effectId: 999_999 })).toBe("Effet");
    });

    /**
     * S7.3 — le référentiel siphonné `GameCharacteristic` fait autorité : les
     * ancres codées étaient fausses sur plusieurs ids (16 = Dommages et non
     * Force, 26 = Invocation, 27/28 = Esquive PA/PM, 48/49/50 = Prospection /
     * Soins / Renvoi).
     */
    it("CHAR_NAMES est aligné sur les caractéristiques officielles", () => {
        expect(CHAR_NAMES[10]).toBe("Force");
        expect(CHAR_NAMES[16]).toBe("Dommages");
        expect(CHAR_NAMES[26]).toBe("Invocation");
        expect(CHAR_NAMES[27]).toBe("Esquive PA");
        expect(CHAR_NAMES[28]).toBe("Esquive PM");
        expect(CHAR_NAMES[48]).toBe("Prospection");
        expect(CHAR_NAMES[49]).toBe("Soins");
        expect(CHAR_NAMES[50]).toBe("Renvoi");
        expect(CHAR_NAMES[33]).toBe("Résistance Terre (%)");
        expect(CHAR_NAMES[37]).toBe("Résistance Neutre (%)");
        expect(CHAR_NAMES[40]).toBe("Pods");
        expect(CHAR_NAMES[44]).toBe("Initiative");
    });

    /**
     * S7.3 — une caractéristique présente mais **non cartographiée** ne doit plus
     * masquer un `effectId` pourtant connu (cause racine du libellé « Effet »).
     *
     * ⚠️ Correction 13/09 — les couples `effectId → libellé` sont ceux **mesurés**
     * dans la table siphonnée `GameEffect` (source de vérité DofusDB) :
     * `162` = « Esquive PA » (et non « Dommages Critiques »), `163` =
     * « Esquive PM », `213` = « Feu (%) », `422` = « Terre », `430` = « Neutre ».
     * Ces assertions **verrouillent** les corrections de l'audit.
     */
    it("getStatLabel résout par characteristic PUIS par effectId", () => {
        expect(getStatLabel({ characteristic: 4242, effectId: 163 })).toBe("Esquive PM");
        expect(getStatLabel({ effectId: 111 })).toBe("PA");
        expect(getStatLabel({ effectId: 117 })).toBe("Portée");
        expect(getStatLabel({ effectId: 182 })).toBe("Invocations");
        expect(getStatLabel({ effectId: 162 })).toBe("Esquive PA");
        expect(getStatLabel({ effectId: 213 })).toBe("Résistance Feu (%)");
        expect(getStatLabel({ effectId: 210 })).toBe("Résistance Terre (%)");
        expect(getStatLabel({ effectId: 422 })).toBe("Dommages Terre");
        expect(getStatLabel({ effectId: 430 })).toBe("Dommages Neutre");
        expect(getStatLabel({ characteristic: 33 })).toBe("Résistance Terre (%)");
    });

    /**
     * Correction 13/09 (2ᵉ passe, constat user) — la table codée porte désormais
     * le **libellé d'infobulle** du jeu, vérifié `effectId` par `effectId`
     * contre les gabarits FR de DofusDB. Elle verrouille notamment les lignes de
     * la **Cape de Glourdorak** (`32237`) et la série de **pénalités** qui les
     * accompagne (mêmes libellés, signe porté par le référentiel).
     */
    it("CHAR_NAMES porte les libellés d'infobulle vérifiés (13/09)", () => {
        // Lignes de la Cape de Glourdorak — mesurées en base et sur DofusDB.
        expect(CHAR_NAMES[115]).toBe("Critique (%)");
        expect(CHAR_NAMES[176]).toBe("Prospection");
        expect(CHAR_NAMES[418]).toBe("Dommages Critiques");
        expect(CHAR_NAMES[421]).toBe("Résistance Critiques");
        // `112` = Dommages (l'ancienne ancre désignait la pénalité 105/265).
        expect(CHAR_NAMES[112]).toBe("Dommages");
        expect(CHAR_NAMES[105]).toBe("Dommages");
        // Pénalités élémentaires (série négative de 423/425/427/429/431).
        expect(CHAR_NAMES[423]).toBe("Dommages Terre");
        expect(CHAR_NAMES[425]).toBe("Dommages Feu");
        expect(CHAR_NAMES[427]).toBe("Dommages Eau");
        expect(CHAR_NAMES[429]).toBe("Dommages Air");
        expect(CHAR_NAMES[431]).toBe("Dommages Neutre");
        // Résistances percent : caractéristiques 33→37 relayées par les
        // `effectId` 210→214 (bonus) et le relais négatif 215→219.
        expect(CHAR_NAMES[215]).toBe("Résistance Terre (%)");
        expect(CHAR_NAMES[218]).toBe("Résistance Feu (%)");
        // Corrections d'ancres mesurées sur `GameCharacteristic` (121 lignes).
        expect(CHAR_NAMES[82]).toBe("Retrait PA");
        expect(CHAR_NAMES[84]).toBe("Dommages Poussée");
        expect(CHAR_NAMES[88]).toBe("Dommages Terre");
        expect(CHAR_NAMES[141]).toBe("Sorts (%)");
    });

    it("getStatLabel ignore les libellés placeholders du siphon /effects", () => {
        expect(isPlaceholderStatLabel("Effet 63")).toBe(true);
        expect(isPlaceholderStatLabel("}{ soins")).toBe(true);
        expect(isPlaceholderStatLabel("  ")).toBe(true);
        expect(isPlaceholderStatLabel("Vitalité")).toBe(false);

        // Un libellé de référentiel fantôme ne doit jamais gagner.
        expect(getStatLabel({ characteristic: 11 }, { 11: "Effet 11" })).toBe("Vitalité");
        expect(getStatLabel({ characteristic: 11 }, { 11: "Vitalité (base)" })).toBe("Vitalité (base)");
    });

    it("resolveStoredStatLabel corrige un libellé figé sans écraser l'inconnu", () => {
        expect(resolveStoredStatLabel({ characteristic: 11, effectId: 10, label: "Effet" })).toBe("Vitalité");
        expect(resolveStoredStatLabel({ characteristic: null, effectId: 163, label: "Effet" })).toBe(
            "Esquive PM"
        );
        // Inconnu : on conserve le libellé persisté plutôt que le repli « Effet ».
        expect(resolveStoredStatLabel({ characteristic: null, effectId: 999_999, label: "Jet maison" })).toBe(
            "Jet maison"
        );
        expect(resolveStoredStatLabel({ characteristic: null, effectId: 999_999, label: null })).toBe("Effet");
    });
});

describe("effects — parsing des effets natifs", () => {
    it("toNativeEffects mappe les formes tolérantes et filtre les ids invalides", () => {
        const result = toNativeEffects({
            effects: [
                { effectId: 96, characteristic: 16, from: 1, to: 3 },
                { int_id: 0, from: 1, to: 2 },
                { effectId: 10, characteristic: 11, from: 251, to: 300 },
            ],
        });
        expect(result).toHaveLength(2);
        expect(result?.[0]).toMatchObject({ effectId: 96, from: 1, to: 3 });
        expect(result?.[1]).toMatchObject({ effectId: 10, characteristic: 11 });
    });

    it("toNativeEffects renvoie null pour une entrée vide", () => {
        expect(toNativeEffects(null)).toBeNull();
        expect(toNativeEffects({ effects: [] })).toBeNull();
    });

    /**
     * S2.12 — filet de sécurité : les effets stockés AVANT l'ajout de la colonne
     * `nativeEffects` sont en forme BRUTE DofusDB (`diceNum`/`diceSide`). Sans
     * cette tolérance, l'éditeur FM afficherait « aucun effet natif ».
     * Valeurs réelles de l'Anneau du Cycloïde (cf. diagnostic B2).
     */
    it("toNativeEffects tolère la forme BRUTE DofusDB (diceNum/diceSide)", () => {
        const result = toNativeEffects({
            effects: [
                { effectId: 125, characteristic: 11, diceNum: 251, diceSide: 300 },
                { effectId: 96, characteristic: 16, diceNum: 31, diceSide: 40 },
                { effectId: 174, characteristic: 48, diceNum: 6, diceSide: 8 },
            ],
        });
        expect(result).toHaveLength(3);
        expect(result?.[0]).toMatchObject({ effectId: 125, from: 251, to: 300 });
        expect(result?.[1]).toMatchObject({ effectId: 96, from: 31, to: 40 });
        expect(result?.[2]).toMatchObject({ characteristic: 48, from: 6, to: 8 });
    });

    /**
     * S2.12 — filet centralisé utilisé par les lecteurs catalogue : la colonne
     * `nativeEffects` est prioritaire, sinon on dérive de `effects` bruts.
     */
    it("resolveNativeEffects privilégie la colonne, sinon dérive de `effects`", () => {
        const stored: MarketNativeEffect[] = [
            { effectId: 10, characteristic: 11, from: 1, to: 2, category: null, elementId: null },
        ];
        expect(resolveNativeEffects({ nativeEffects: stored, effects: null })).toEqual(stored);

        const derived = resolveNativeEffects({
            nativeEffects: null,
            effects: [{ effectId: 125, characteristic: 11, diceNum: 251, diceSide: 300 }],
        });
        expect(derived?.[0]).toMatchObject({ effectId: 125, from: 251, to: 300 });

        // Colonne vide ET effets illisibles → null (l'appelant retombe sur « libre »).
        expect(resolveNativeEffects({ nativeEffects: [], effects: [] })).toBeNull();
        expect(resolveNativeEffects(null)).toBeNull();
    });
});

describe("effects — plages natives (source serveur)", () => {
    const natives: MarketNativeEffect[] = [
        { effectId: 10, characteristic: 11, from: 251, to: 300, category: null, elementId: null },
        { effectId: 96, characteristic: 16, from: 1, to: 3, category: null, elementId: null },
    ];

    it("findNativeRange retrouve par effectId puis par characteristic", () => {
        expect(findNativeRange(natives, { effectId: 10 })).toEqual({ from: 251, to: 300 });
        expect(findNativeRange(natives, { effectId: 4242, characteristic: 16 })).toEqual({ from: 1, to: 3 });
        expect(findNativeRange(natives, { effectId: 4242, characteristic: 999 })).toBeNull();
    });

    it("isNativeEffect distingue natif et exo", () => {
        expect(isNativeEffect(natives, { effectId: 10 })).toBe(true);
        expect(isNativeEffect(natives, { effectId: 111, characteristic: 1 })).toBe(false);
    });

    it("buildNativeStatDrafts pré-remplit chaque ligne avec le max natif", () => {
        const drafts = buildNativeStatDrafts(natives);
        expect(drafts).toHaveLength(2);
        expect(drafts[0]).toMatchObject({ effectId: 10, label: "Vitalité", actualValue: 300, origin: "NATIVE" });
        expect(drafts[1]).toMatchObject({ effectId: 96, actualValue: 3 });
    });

    /**
     * Correction 13/09 (constat user) — trois défauts de la déclaration du jet :
     *   1. une valeur **fixe** (`from: 1, to: 0` côté DofusDB) s'affichait
     *      « 1 à 0 » avec la valeur `0` (PA / Invocations) ;
     *   2. un **malus** s'affichait positif (« +6 à +8 » au lieu de
     *      « -6 à -8 Esquive PA ») ;
     *   3. le libellé venait de la table codée (`CHAR_NAMES`) au lieu du
     *      référentiel siphonné (`GameEffect`).
     */
    it("buildNativeStatDrafts normalise les valeurs fixes et rétablit les malus", () => {
        const catalogue: MarketNativeEffect[] = [
            { effectId: 111, characteristic: null, from: 1, to: 0, category: null, elementId: null },
            { effectId: 162, characteristic: null, from: 6, to: 8, category: null, elementId: null },
            { effectId: 125, characteristic: 11, from: 351, to: 400, category: null, elementId: null },
        ];
        const drafts = buildNativeStatDrafts(catalogue, {
            // `GameEffect` : 162 = Esquive PA (négatif), 111 = PA, 125 = Vitalité.
            labels: { 111: "PA", 162: "Esquive PA", 125: "Vitalité" },
            negativeEffectIds: [162],
        });
        expect(drafts[0]).toMatchObject({ label: "PA", naturalMin: 1, naturalMax: 1, actualValue: 1 });
        expect(drafts[1]).toMatchObject({ label: "Esquive PA", naturalMin: -6, naturalMax: -8, actualValue: -8 });
        expect(drafts[2]).toMatchObject({ label: "Vitalité", naturalMin: 351, naturalMax: 400, actualValue: 400 });
    });

    it("resolveNativeStatLabel fait primer la table d'infobulle, puis le référentiel", () => {
        // 1. La table codée porte le libellé d'INFOBULLE : le nom siphonné — qui
        //    est celui de la caractéristique jointe (« Critiques (fixe) ») — ne
        //    l'écrase plus (constat user : « +30 Effet » au lieu de
        //    « -30 Résistance Critiques » sur la Cape de Glourdorak 32237).
        expect(
            resolveNativeStatLabel(
                { effectId: 421, characteristic: 87 },
                { labels: { 87: "Critiques (fixe)", 421: "Critiques (fixe)" } }
            )
        ).toBe("Résistance Critiques");
        // 2. Un `effectId` absent de la table retombe sur le référentiel siphonné
        //    (effet exotique) — jamais « Effet ».
        expect(
            resolveNativeStatLabel(
                { effectId: 4242, characteristic: null },
                { labels: { 4242: "Effet exotique" } }
            )
        ).toBe("Effet exotique");
        // 3. Un libellé **gabarit** reste ignoré (S8.5).
        expect(
            resolveNativeStatLabel(
                { effectId: 4242, characteristic: null },
                { labels: { 4242: "Effet 63" } }
            )
        ).toBe("Effet");
        // 4. Sans référentiel : table codée, vérifiée le 13/09.
        expect(resolveNativeStatLabel({ effectId: 162, characteristic: null })).toBe("Esquive PA");
        expect(resolveNativeStatLabel({ effectId: 213, characteristic: null })).toBe("Résistance Feu (%)");
    });

    it("curatedStatLabel / resolveStatLabel portent l'ordre de résolution", () => {
        expect(curatedStatLabel({ effectId: 418 })).toBe("Dommages Critiques");
        expect(curatedStatLabel({ effectId: null, characteristic: 87 })).toBe("Résistance Critiques");
        // La table mélange les deux espaces de clés : la caractéristique est
        // essayée d'abord (cascade historique de `getStatLabel`).
        expect(curatedStatLabel({ characteristic: 11, effectId: 10 })).toBe("Vitalité");
        expect(curatedStatLabel({ effectId: 4242 })).toBeNull();
        // Curated > référentiel > null.
        expect(resolveStatLabel({ effectId: 418 }, "Critiques")).toBe("Dommages Critiques");
        expect(resolveStatLabel({ effectId: 4242 }, "Effet exotique")).toBe("Effet exotique");
        expect(resolveStatLabel({ effectId: 4242 }, "Effet 63")).toBeNull();
        expect(resolveStatLabel({ effectId: 4242 }, null)).toBeNull();
    });

    it("applyEffectSign est idempotent (dés déjà signés ou non)", () => {
        expect(applyEffectSign({ from: 6, to: 8 }, true)).toEqual({ from: -6, to: -8 });
        expect(applyEffectSign({ from: -20, to: -20 }, true)).toEqual({ from: -20, to: -20 });
        expect(applyEffectSign({ from: 6, to: 8 }, false)).toEqual({ from: 6, to: 8 });
    });
});

/**
 * S7.4 — plages natives : DofusDB renvoie `diceSide = 0` quand le **second dé
 * est absent** (valeur fixe). Une lecture naïve produisait `[10 à 0]` puis
 * « 0 SOUS LA PLAGE » sur un objet parfait (capture user du 11/09).
 */
describe("effects — normalisation des plages natives", () => {
    it("normalizeNativeRange ne produit jamais de plage décroissante", () => {
        expect(normalizeNativeRange(251, 300)).toEqual({ from: 251, to: 300 });
        expect(normalizeNativeRange(2, 2)).toEqual({ from: 2, to: 2 });
        // Valeur fixe (second dé absent) — les deux sens sont ramenés au 1er dé.
        expect(normalizeNativeRange(10, 0)).toEqual({ from: 10, to: 10 });
        expect(normalizeNativeRange(300, 251)).toEqual({ from: 300, to: 300 });
        // Valeur négative fixe (résistance critique, malus).
        expect(normalizeNativeRange(-30, 0)).toEqual({ from: -30, to: -30 });
        // Correction 13/09 — une plage **négative décroissante** est un malus
        // LÉGITIME (« -6 à -8 Esquive PA ») : elle ne doit plus être effondrée.
        expect(normalizeNativeRange(-6, -8)).toEqual({ from: -6, to: -8 });
        expect(normalizeNativeRange(-8, -6)).toEqual({ from: -8, to: -6 });
    });

    it("toNativeEffects normalise la forme BRUTE (diceSide = 0 ⇒ valeur fixe)", () => {
        const result = toNativeEffects({
            effects: [
                { effectId: 163, characteristic: null, diceNum: -30, diceSide: 0 },
                { effectId: 110, characteristic: 16, diceNum: 10, diceSide: 0 },
                { effectId: 125, characteristic: 11, diceNum: 251, diceSide: 300 },
            ],
        });
        expect(result).toHaveLength(3);
        expect(result?.[0]).toMatchObject({ effectId: 163, from: -30, to: -30 });
        expect(result?.[1]).toMatchObject({ effectId: 110, from: 10, to: 10 });
        expect(result?.[2]).toMatchObject({ effectId: 125, from: 251, to: 300 });
    });

    it("findNativeRange soigne aussi une plage inversée déjà persistée", () => {
        const stored: MarketNativeEffect[] = [
            { effectId: 110, characteristic: 16, from: 10, to: 0, category: null, elementId: null },
        ];
        expect(findNativeRange(stored, { effectId: 110 })).toEqual({ from: 10, to: 10 });
        expect(findNativeRange(stored, { effectId: 4242, characteristic: 16 })).toEqual({ from: 10, to: 10 });
    });
});

describe("effects — exos & formatage", () => {
    it("EXO_EFFECT_PRESETS couvre PA / PM / PO / invocation", () => {
        expect(EXO_EFFECT_PRESETS.map((p) => p.key)).toEqual(["pa", "pm", "po", "invocation"]);
    });

    it("buildExoStatDraft construit une ligne EXO sans plage native", () => {
        const draft = buildExoStatDraft(EXO_EFFECT_PRESETS[0], 2);
        expect(draft).toMatchObject({ label: "PA", origin: "EXO", naturalMin: null, naturalMax: null, actualValue: 2 });
    });

    it("resolveStatIconSpec résout par id et par code court", () => {
        expect(resolveStatIconSpec(11)).toMatchObject({ icon: "heart" });
        expect(resolveStatIconSpec(null, "po")).toMatchObject({ icon: "eye" });
        expect(resolveStatIconSpec(999_999)).toBeNull();
    });

    it("isPercentStat détecte le symbole et le mot « pourcent »", () => {
        expect(isPercentStat("Résistance Feu (%)")).toBe(true);
        expect(isPercentStat("Pourcentage de dommages")).toBe(true);
        expect(isPercentStat("Vitalité")).toBe(false);
        expect(isPercentStat(null)).toBe(false);
    });

    it("formatStatValue signe et suffixe le « % » si nécessaire", () => {
        expect(formatStatValue(12)).toBe("+12");
        expect(formatStatValue(-3)).toBe("-3");
        expect(formatStatValue(12, "Résistance Eau (%)")).toBe("+12 %");
    });
});

/**
 * Correction 13/09 (2ᵉ passe, constat user) — **lignes natives résolues côté
 * serveur** (`enrichNativeEffects`) : le libellé d'infobulle **et** le drapeau
 * de malus voyagent avec l'item. L'écran de déclaration ne dépend donc plus du
 * second aller-retour `getMarketStatReferential` — qui, en échec silencieux
 * (cache vide, `prisma generate` oublié après migration), faisait réapparaître
 * « +30 Effet [21 à 30] » / « +30 Effet [30] » à la place de
 * « +30 Dommages Critiques » / « -30 Résistance Critiques ».
 *
 * Payload **réel** de la Cape de Glourdorak (`ankamaId 32237`), mesuré en base :
 * `nativeEffects` en forme BRUTE DofusDB (dés toujours positifs, `diceSide = 0`
 * pour les valeurs fixes).
 */
describe("effects — lignes natives résolues serveur (13/09)", () => {
    const glourdorak: MarketNativeEffect[] = [
        { effectId: 125, characteristic: null, from: 351, to: 400, category: null, elementId: null },
        { effectId: 115, characteristic: null, from: 4, to: 6, category: null, elementId: null },
        { effectId: 117, characteristic: null, from: 2, to: 0, category: null, elementId: null },
        { effectId: 210, characteristic: null, from: 2, to: 3, category: null, elementId: null },
        { effectId: 752, characteristic: null, from: 7, to: 10, category: null, elementId: null },
        { effectId: 418, characteristic: null, from: 21, to: 30, category: null, elementId: null },
        { effectId: 421, characteristic: null, from: 30, to: 0, category: null, elementId: null },
    ];
    /** Référentiel tel que le lit la base : noms courts + malus `421`. */
    const referential = {
        labels: { 418: "Critiques", 421: "Critiques (fixe)", 210: "Terre (%)" },
        negativeEffectIds: [421],
    };

    it("enrichit chaque ligne : libellé d'infobulle + drapeau de malus", () => {
        const enriched = enrichNativeEffects(glourdorak, referential);
        expect(enriched).toHaveLength(7);
        expect(enriched?.[1]).toMatchObject({ effectId: 115, label: "Critique (%)", isNegative: false });
        expect(enriched?.[3]).toMatchObject({ effectId: 210, label: "Résistance Terre (%)" });
        expect(enriched?.[5]).toMatchObject({ effectId: 418, label: "Dommages Critiques" });
        expect(enriched?.[6]).toMatchObject({ effectId: 421, label: "Résistance Critiques", isNegative: true });
        // Aucune entrée : `null` (jamais un tableau vide trompeur).
        expect(enrichNativeEffects([], referential)).toBeNull();
        expect(enrichNativeEffects(null, referential)).toBeNull();
    });

    it("buildNativeStatDrafts restitue les libellés ET les bornes signées", () => {
        const drafts = buildNativeStatDrafts(enrichNativeEffects(glourdorak, referential), referential);
        expect(drafts).toHaveLength(7);
        expect(drafts[1]).toMatchObject({ label: "Critique (%)", naturalMin: 4, naturalMax: 6, actualValue: 6 });
        // Valeur fixe (`0` à droite du catalogue) : jamais « 2 à 0 ».
        expect(drafts[2]).toMatchObject({ label: "Portée", naturalMin: 2, naturalMax: 2, actualValue: 2 });
        expect(drafts[5]).toMatchObject({
            label: "Dommages Critiques",
            naturalMin: 21,
            naturalMax: 30,
            actualValue: 30,
        });
        // Malus : bornes ET valeur signées (« -30 », jamais « +30 »).
        expect(drafts[6]).toMatchObject({
            label: "Résistance Critiques",
            naturalMin: -30,
            naturalMax: -30,
            actualValue: -30,
        });
    });

    it("reste juste même sans référentiel côté client (champs embarqués)", () => {
        const enriched = enrichNativeEffects(glourdorak, referential);
        // Cas mesuré : `statReferential === null` (échec silencieux du 2ᵉ appel).
        const drafts = buildNativeStatDrafts(enriched, null);
        expect(drafts.find((draft) => draft.effectId === 421)).toMatchObject({
            label: "Résistance Critiques",
            naturalMin: -30,
            actualValue: -30,
        });
        expect(drafts.find((draft) => draft.effectId === 418)).toMatchObject({
            label: "Dommages Critiques",
            naturalMax: 30,
        });
        // Et même sans enrichissement : la table d'infobulle suffit pour le libellé.
        const raw = buildNativeStatDrafts(glourdorak, null);
        expect(raw.find((draft) => draft.effectId === 418)).toMatchObject({ label: "Dommages Critiques" });
        expect(raw.find((draft) => draft.effectId === 115)).toMatchObject({ label: "Critique (%)" });
    });
});

/**
 * Correction 13/09 (3ᵉ passe, constat user « décidément tu n'y arrives pas avec
 * les malus ») — le **signe** ne doit plus dépendre d'un référentiel runtime
 * disponible.
 *
 * Cause mesurée : `GameEffect.isNegativeValue` n'arrivait au client que par le
 * référentiel (cache serveur + server action). Quand il était vide — cache,
 * `prisma generate` oublié après migration, ou `statReferential === null` — les
 * libellés (curated) restaient justes mais les malus redevenaient positifs
 * (« +100 Force » sur le Rouleau à Pâtisserie d'Aermyne `13649`).
 */
describe("effects — signe déterministe (3ᵉ passe, 13/09)", () => {
    it("NEGATIVE_EFFECT_IDS est la copie mesurée en base (86 ids)", () => {
        expect(NEGATIVE_EFFECT_IDS).toHaveLength(86);
        // Série de pénalités des primaires, esquives, dommages et résistances.
        for (const id of [101, 145, 152, 154, 155, 157, 162, 163, 419, 421, 423, 425, 427, 429, 431]) {
            expect(isNegativeNativeEffect(id)).toBe(true);
        }
        expect(isNegativeNativeEffect(754)).toBe(true);
        expect(isNegativeNativeEffect(2801)).toBe(true);
        expect(isNegativeNativeEffect(2861)).toBe(true);
        // Les **bonus** de la même famille ne sont jamais des malus.
        expect(isNegativeNativeEffect(418)).toBe(false);
        expect(isNegativeNativeEffect(160)).toBe(false);
        expect(isNegativeNativeEffect(430)).toBe(false);
        expect(isNegativeNativeEffect(999_999)).toBe(false);
    });

    it("drapeau explicite & référentiel priment, le repli curated sécurise", () => {
        expect(isNegativeNativeEffect(999_999, { isNegative: true })).toBe(true);
        expect(isNegativeNativeEffect(999_999, { negativeEffectIds: [999_999] })).toBe(true);
        // Référentiel **vide** (cas mesuré) : le repli rétablit le signe.
        expect(isNegativeNativeEffect(157, { isNegative: false, negativeEffectIds: [] })).toBe(true);
    });

    it("dédoublonne la ligne de dommages d'arme dupliquée par DofusDB", () => {
        const natives: MarketNativeEffect[] = [
            { effectId: 100, characteristic: null, from: 9, to: 14, category: null, elementId: null },
            { effectId: 100, characteristic: null, from: 9, to: 14, category: null, elementId: null },
            // Plage DIFFÉRENTE : jamais fusionnée.
            { effectId: 100, characteristic: null, from: 15, to: 20, category: null, elementId: null },
            { effectId: 125, characteristic: null, from: 301, to: 350, category: null, elementId: null },
        ];
        const unique = dedupeNativeEffects(natives);
        expect(unique).toHaveLength(3);
        expect(unique?.[2]).toMatchObject({ effectId: 125 });
        // Choke point de lecture : les lecteurs du catalogue en héritent.
        expect(resolveNativeEffects({ nativeEffects: natives })).toHaveLength(3);
        expect(dedupeNativeEffects([])).toBeNull();
        expect(dedupeNativeEffects(null)).toBeNull();
    });

    /**
     * Payload **réel** mesuré en base (`ankamaId 13649`) : 6 malus + la ligne de
     * dommages d'arme dupliquée. Les dés sont tous positifs côté DofusDB.
     */
    it("Rouleau à Pâtisserie d'Aermyne : malus signés SANS aucun référentiel", () => {
        const natives: MarketNativeEffect[] = [
            { effectId: 100, characteristic: null, from: 9, to: 14, category: null, elementId: null },
            { effectId: 100, characteristic: null, from: 9, to: 14, category: null, elementId: null },
            { effectId: 101, characteristic: null, from: 1, to: 0, category: null, elementId: null },
            { effectId: 157, characteristic: null, from: 71, to: 100, category: null, elementId: null },
            { effectId: 155, characteristic: null, from: 71, to: 100, category: null, elementId: null },
            { effectId: 152, characteristic: null, from: 71, to: 100, category: null, elementId: null },
            { effectId: 154, characteristic: null, from: 71, to: 100, category: null, elementId: null },
            { effectId: 160, characteristic: null, from: 4, to: 6, category: null, elementId: null },
            { effectId: 419, characteristic: null, from: 11, to: 15, category: null, elementId: null },
        ];
        // `null` en 2ᵉ argument = aucun référentiel (ni serveur ni client).
        const enriched = enrichNativeEffects(natives, null);
        // Dédoublonné (2 lignes 100 identiques → 1) et signé, sans référentiel.
        expect(enriched).toHaveLength(8);
        const drafts = buildNativeStatDrafts(enriched, null);
        expect(drafts.find((d) => d.effectId === 100)).toMatchObject({
            label: "Dommages Neutre (arme)",
            naturalMin: 9,
            naturalMax: 14,
        });
        expect(drafts.find((d) => d.effectId === 101)).toMatchObject({
            label: "PA",
            naturalMin: -1,
            naturalMax: -1,
            actualValue: -1,
        });
        expect(drafts.find((d) => d.effectId === 157)).toMatchObject({
            label: "Force",
            naturalMin: -71,
            naturalMax: -100,
            actualValue: -100,
        });
        expect(drafts.find((d) => d.effectId === 155)).toMatchObject({ label: "Intelligence", actualValue: -100 });
        expect(drafts.find((d) => d.effectId === 152)).toMatchObject({ label: "Chance", actualValue: -100 });
        expect(drafts.find((d) => d.effectId === 154)).toMatchObject({ label: "Agilité", actualValue: -100 });
        // La série « bonus » reste positive (160 = +4 à 6 Esquive PA).
        expect(drafts.find((d) => d.effectId === 160)).toMatchObject({
            label: "Esquive PA",
            naturalMin: 4,
            naturalMax: 6,
            actualValue: 6,
        });
        expect(drafts.find((d) => d.effectId === 419)).toMatchObject({
            label: "Dommages Critiques",
            naturalMin: -11,
            naturalMax: -15,
            actualValue: -15,
        });
    });
});


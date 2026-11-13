/**
 * Bonus de panoplie — **règles officielles** (Dofus 3.7), mesurées sur les payloads réels.
 *
 * Source : doc « Comprendre les interactions d'équipement dans DOFUS » (25/10/2026) +
 * MàJ 3.7 du 06/10/2026 :
 *   · une panoplie est **active dès 2 pièces** ;
 *   · le **palier courant remplace** le précédent (les lignes ne s'additionnent pas) ;
 *   · un **même objet porté deux fois** ne compte que pour **une** pièce distincte ;
 *   · une seule **Prysmaradite** (elle partage le 1ᵉʳ emplacement Dofus/Trophée).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { processDofusbookRawData, type DofusbookItem, type DofusbookPreviewData } from "@/lib/dofusbook-utils";
import {
    isPrysmaraditeType,
    validatePrysmaraditeLimit,
} from "@/lib/dofus-variant-rules";
import {
    activeSetBonuses,
    activeTierCount,
    normalizeItemSetTiers,
    tierBonuses,
    type ItemSetData,
} from "@/lib/dofus-set-bonuses";
import { applyVariantsToBuild, explainVariantRefusal } from "@/lib/dofus-variant-utils";
import { normalizeItemSet, normalizeSince, nextPageState } from "@/lib/item-sets-siphon";

function buildWithSet(stuffItem: Record<string, number>) {
    return {
        stuff: {
            name: "Panoplie test",
            character_level: 200,
            stuffItem,
            stuffCarac: {},
            stuffFm: { fm: {} },
            stuffFmItem: {},
        },
        items: [
            { id: 10, name: "Anneau test", picture: 10, official: 10, level: 200, effects: [] },
            { id: 11, name: "Coiffe test", picture: 11, official: 11, level: 200, effects: [] },
            { id: 12, name: "Cape test", picture: 12, official: 12, level: 200, effects: [] },
        ],
        cloths: [
            {
                name: "Panoplie test",
                count_item: 3,
                items: [{ id: 10 }, { id: 11 }, { id: 12 }],
                // Deux paliers envoyés : le plus haut atteint **remplace** l'autre.
                effects: [
                    { count: 2, name: "fo", value: 10 },
                    { count: 3, name: "fo", value: 30 },
                ],
            },
        ],
    };
}

describe("bonus de panoplie — palier remplacé, pièces distinctes", () => {
    it("applique le palier le plus haut, sans additionner les paliers", () => {
        const data = processDofusbookRawData("1", buildWithSet({ a1: 10, a2: 11, ca: 12 }));

        expect(data.cloths?.[0].count).toBe(3);
        // 30 (palier 3) et non 40 (10 + 30).
        expect(data.elements.fo).toBe(30);
        expect(data.cloths?.[0].bonuses).toMatchObject({ fo: 30 });
    });

    it("ne compte qu'une pièce distincte quand le même objet est porté deux fois", () => {
        // Anneau 10 en a1 ET a2 + coiffe 11 ⇒ 2 pièces distinctes (pas 3).
        const data = processDofusbookRawData("1", buildWithSet({ a1: 10, a2: 10, ch: 11 }));

        expect(data.cloths?.[0].count).toBe(2);
        expect(data.elements.fo).toBe(10);
    });

    it("une panoplie à 1 seule pièce n'est pas active (règle 3.7)", () => {
        const data = processDofusbookRawData("1", buildWithSet({ a1: 10 }));

        expect(data.cloths ?? []).toHaveLength(0);
        expect(data.elements.fo).toBe(0);
    });
});

describe("Prysmaradites — une seule par personnage", () => {
    it("reconnaît le type (insensible à la casse)", () => {
        expect(isPrysmaraditeType("Prysmaradite")).toBe(true);
        expect(isPrysmaraditeType(" prysmaradite ")).toBe(true);
        expect(isPrysmaraditeType("Dofus")).toBe(false);
        expect(isPrysmaraditeType(null)).toBe(false);
    });

    it("accepte une Prysmaradite, refuse la deuxième", () => {
        expect(validatePrysmaraditeLimit(["Dofus", "Prysmaradite"]).ok).toBe(true);

        const refused = validatePrysmaraditeLimit(["Prysmaradite", "Dofus", "Prysmaradite"]);
        expect(refused.ok).toBe(false);
        if (!refused.ok) {
            expect(refused.violation.code).toBe("prysmaradite-limit");
            expect(refused.violation.message).toContain("Une seule Prysmaradite");
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Règle pure partagée (`src/lib/dofus-set-bonuses.ts`) + recalcul d'une variante
// ─────────────────────────────────────────────────────────────────────────────

/** Panoplie de test : 4 pièces, paliers 2 / 3 / 4 (Chance). */
const SET_900: ItemSetData = {
    id: 900,
    name: "Panoplie test",
    itemCount: 4,
    tiers: [
        { count: 2, effects: [{ code: "ch", value: 20 }] },
        { count: 3, effects: [{ code: "ch", value: 50 }] },
        { count: 4, effects: [{ code: "ch", value: 90 }] },
    ],
};

const item = (id: number, name: string): DofusbookItem => ({ id, name, picture: id, official: id, level: 200, effects: [] });

/** Build d'origine : 3 pièces de la panoplie 900 ⇒ palier 3 (Chance +50, déjà dans les totaux). */
function buildWithThreePieces(): DofusbookPreviewData {
    return {
        v: 2,
        id: 1,
        name: "Build test",
        level: 200,
        classId: 1,
        className: "Féca",
        stats: { pa: 7, pm: 3, po: 0, vit: 1050, ini: 1200, pp: 100, cc: 0, invo: 1, so: 0 },
        elements: { fo: 0, in: 0, ch: 200, ag: 0, sa: 0, pu: 0 },
        resists: { neutre: 0, terre: 0, feu: 0, eau: 0, air: 0 },
        damages: {
            neutre: 0, terre: 0, feu: 0, eau: 0, air: 0, general: 0,
            critique: 0, poussee: 0, armes: 0, sorts: 0, melee: 0, distance: 0,
        },
        items: {
            ch: item(11, "Coiffe test"),
            ca: item(12, "Cape test"),
            a1: item(13, "Anneau test"),
            a2: item(19, "Anneau hors panoplie"),
        },
        cloths: [{ name: "Panoplie test", count: 3, total: 4, bonuses: { ch: 50 } }],
    };
}

/** Contexte de panoplies du build d'origine. */
const CONTEXT_900 = { sets: { 900: SET_900 }, byItem: { 11: 900, 12: 900, 13: 900 } };

describe("règle pure — palier retenu, pièces distinctes, panoplie inconnue", () => {
    it("retient le plus haut palier atteint, sans additionner les paliers", () => {
        expect(activeTierCount([{ count: 2 }, { count: 3 }, { count: 4 }], 3)).toBe(3);
        // 50 (palier 3) et non 70 (20 + 50).
        expect(tierBonuses(SET_900.tiers, 3)).toEqual({ tier: 3, bonuses: { ch: 50 } });
    });

    it("une seule pièce ne rend aucune panoplie active, même si un palier 1 existait", () => {
        expect(activeTierCount([{ count: 1 }, { count: 2 }], 1)).toBe(0);
        expect(tierBonuses(SET_900.tiers, 1)).toEqual({ tier: 0, bonuses: {} });
    });

    it("un même objet porté deux fois ne compte que pour une pièce distincte", () => {
        const { active } = activeSetBonuses(new Map([[900, new Set([11])]]), [SET_900]);
        expect(active).toHaveLength(0);
    });

    it("une panoplie portée reste active même sans bonus (cosmétique)", () => {
        const cosmetic: ItemSetData = { id: 950, name: "Panoplie cosmétique", itemCount: 2, tiers: [] };
        const { active, unknownIds } = activeSetBonuses(new Map([[950, new Set([1, 2])]]), [cosmetic]);

        // Connue, donc pas « inconnue » : aucune variante ne doit être refusée pour elle.
        expect(unknownIds).toEqual([]);
        expect(active).toHaveLength(1);
        expect(active[0]).toMatchObject({ setId: 950, pieces: 2, tier: 0, bonuses: {} });
    });

    it("signale une panoplie inconnue au lieu de l'ignorer", () => {
        const { active, unknownIds } = activeSetBonuses(new Map([[777, new Set([1, 2])]]), [SET_900]);
        expect(active).toHaveLength(0);
        expect(unknownIds).toEqual([777]);
    });

    it("écarte les paliers illisibles d'une valeur de base (fail-closed)", () => {
        expect(normalizeItemSetTiers("n'importe quoi")).toEqual([]);
        expect(normalizeItemSetTiers([{ count: 0, effects: [] }, { count: 2, effects: [{ code: "", value: 10 }] }])).toEqual([]);
        expect(normalizeItemSetTiers([{ count: 2, effects: [{ code: "ch", value: 30 }] }])).toEqual([
            { count: 2, effects: [{ code: "ch", value: 30 }] },
        ]);
    });
});

describe("siphon des panoplies — payload DofusDB mesuré", () => {
    it("lit les paliers de la panoplie de Danathor (`/item-sets/242`, 26/10/2026)", () => {
        const sample = {
            id: 242,
            name: { fr: "Panoplie de Danathor" },
            items: [{ id: 13120 }, { id: 13121 }, { id: 13122 }, { id: 13123 }],
            // Tableau **indexé par palier** : index 0 = 1 pièce (vide), index 1 = 2 pièces…
            effects: [
                [],
                [
                    { from: 40, characteristic: 13, effectId: 123 },
                    { from: 500, characteristic: 44, effectId: 174 },
                    { from: 20, characteristic: 48, effectId: 176 },
                    { from: 5, characteristic: 79, effectId: 753 },
                ],
                [{ from: 1, characteristic: 1, effectId: 111 }],
            ],
        };

        const result = normalizeItemSet(sample);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.set.name).toBe("Panoplie de Danathor");
        expect(result.set.itemCount).toBe(4);
        expect(result.set.tiers[0].count).toBe(2);
        // `characteristic` → code court : 13 Chance, 44 Initiative, 48 Prospection, 79 Tacle.
        expect(result.set.tiers[0].effects).toEqual([
            { code: "ch", value: 40, effectId: 123 },
            { code: "ini", value: 500, effectId: 174 },
            { code: "pp", value: 20, effectId: 176 },
            { code: "ta", value: 5, effectId: 753 },
        ]);
    });

    it("refuse une caractéristique non normalisable (jamais de bonus inventé)", () => {
        const result = normalizeItemSet({
            id: 5,
            name: { fr: "Panoplie inconnue" },
            items: [{ id: 1 }],
            effects: [[{ from: 10, characteristic: 9999, effectId: 1 }]],
        });

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toContain("9999");
    });

    it("accepte une panoplie sans bonus (cosmétique) : connue avec zéro palier", () => {
        const result = normalizeItemSet({
            id: 504,
            name: { fr: "Panoplie cosmétique" },
            items: [{ id: 1 }, { id: 2 }],
            effects: [],
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.set.tiers).toEqual([]);
        expect(result.set.itemCount).toBe(2);
    });

    it("lit la dernière page quand le total n'est pas un multiple de la page", () => {
        // 940 panoplies, pages de 50 : la dernière page commence à `skip = 900` et doit être lue.
        expect(nextPageState(0, 50, 940)).toEqual({ nextSkip: 50, more: true });
        expect(nextPageState(850, 50, 940)).toEqual({ nextSkip: 900, more: true });
        expect(nextPageState(900, 50, 940)).toEqual({ nextSkip: 950, more: false });
        // Page vide ou total inconnu : on s'arrête (jamais de boucle infinie).
        expect(nextPageState(0, 0, 940).more).toBe(false);
        expect(nextPageState(0, 50, null).more).toBe(false);
    });

    it("est idempotent : le même payload donne le même hash", () => {
        const sample = {
            id: 7,
            name: { fr: "Panoplie" },
            items: [{ id: 1 }, { id: 2 }],
            effects: [[], [{ from: 5, characteristic: 10, effectId: 1 }]],
        };

        const first = normalizeItemSet(sample);
        const second = normalizeItemSet(JSON.parse(JSON.stringify(sample)));

        expect(first.ok && second.ok && first.set.dataHash === second.set.dataHash).toBe(true);
    });
});

describe("variante — bonus de panoplie recalculés", () => {
    it("retirer une pièce fait baisser le palier (plus de bonus d'origine conservé)", () => {
        const updated = applyVariantsToBuild(
            buildWithThreePieces(),
            { ca: item(99, "Cape hors panoplie") },
            CONTEXT_900,
        );

        expect(updated).not.toBeNull();
        // Palier 3 (50) → palier 2 (20) : −30. Le total ne garde donc pas les 50 d'origine.
        expect(updated!.elements.ch).toBe(170);
        expect(updated!.cloths?.[0].count).toBe(2);
        expect(updated!.cloths?.[0].bonuses).toEqual({ ch: 20 });
    });

    it("une 2ᵉ pièce ajoutée par la variante active la panoplie", () => {
        const base = buildWithThreePieces();
        base.items = { a1: item(21, "Anneau A") };
        base.cloths = [];

        const context = {
            sets: { 901: { id: 901, name: "Panoplie B", itemCount: 2, tiers: [{ count: 2, effects: [{ code: "fo", value: 30 }] }] } },
            byItem: { 21: 901, 22: 901 },
        };

        const updated = applyVariantsToBuild(base, { a2: item(22, "Anneau B") }, context);

        expect(updated).not.toBeNull();
        expect(updated!.elements.fo).toBe(30);
        expect(updated!.cloths).toHaveLength(1);
        expect(updated!.cloths?.[0].bonuses).toEqual({ fo: 30 });
    });

    it("sans variante, le build d'origine est rendu tel quel", () => {
        const base = buildWithThreePieces();
        expect(applyVariantsToBuild(base, {})).toBe(base);
    });

    it("sans les panoplies du build, la variante n'est pas calculée (fail-closed)", () => {
        expect(applyVariantsToBuild(buildWithThreePieces(), { ca: item(99, "Cape") })).toBeNull();
    });

    it("une panoplie du build absente du référentiel ⇒ refus, jamais une approximation", () => {
        expect(
            applyVariantsToBuild(buildWithThreePieces(), { ca: item(99, "Cape") }, {
                sets: {},
                byItem: { 11: 900, 12: 900, 13: 900 },
            }),
        ).toBeNull();
    });

    it("un contexte qui n'explique pas le stuff d'origine ⇒ refus", () => {
        // `cloths` annonce une panoplie active, mais aucun objet n'est relié à une panoplie.
        expect(
            applyVariantsToBuild(buildWithThreePieces(), { ca: item(99, "Cape") }, {
                sets: { 900: SET_900 },
                byItem: {},
            }),
        ).toBeNull();
    });
});

describe("refus de variante — la cause est dite, et elle est actionnable", () => {
    it("sans panoplies chargées : nomme le build concerné et demande un rechargement", () => {
        const refusal = explainVariantRefusal(buildWithThreePieces(), { ca: item(99, "Cape") }, null);

        expect(refusal?.code).toBe("no-set-context");
        expect(refusal?.message).toContain("Panoplies non chargées");
        expect(refusal?.details).toContain("Panoplie test");
        expect(refusal?.details).toContain("Recharge la page");
    });

    it("panoplie inconnue : donne son identifiant et l'action de synchronisation", () => {
        const refusal = explainVariantRefusal(
            buildWithThreePieces(),
            { ca: item(99, "Cape") },
            { sets: {}, byItem: { 11: 900, 12: 900, 13: 900 } },
        );

        expect(refusal?.code).toBe("unknown-sets");
        expect(refusal?.unknownSetIds).toEqual([900]);
        expect(refusal?.details).toContain("#900");
        expect(refusal?.details).toContain("synchronisation");
    });

    it("contexte incohérent : nomme les panoplies que le catalogue n'explique pas", () => {
        const refusal = explainVariantRefusal(
            buildWithThreePieces(),
            { ca: item(99, "Cape") },
            { sets: { 900: SET_900 }, byItem: {} },
        );

        expect(refusal?.code).toBe("incoherent-context");
        expect(refusal?.unexplainedSetNames).toEqual(["Panoplie test"]);
        expect(refusal?.details).toContain("Dofusbook déclare 1");
    });

    it("aucun refus quand tout est calculable (le badge ne doit pas apparaître)", () => {
        expect(explainVariantRefusal(buildWithThreePieces(), { ca: item(99, "Cape") }, CONTEXT_900)).toBeNull();
        expect(explainVariantRefusal(buildWithThreePieces(), {})).toBeNull();
        expect(explainVariantRefusal(null, { ca: item(99, "Cape") }, CONTEXT_900)).toBeNull();
    });
});

describe("siphon des panoplies — reprise et route cron", () => {
    it("une passe bornée rend un curseur de reprise (`nextSkip` = null quand c'est fini)", () => {
        // Page 850 → il reste la 900 ; page 900 → plus rien.
        expect(nextPageState(850, 50, 940).more).toBe(true);
        expect(nextPageState(900, 50, 940)).toEqual({ nextSkip: 950, more: false });
    });

    it("la route cron est protégée et lance le même cœur (aucune logique dupliquée)", () => {
        const route = readFileSync(path.join(process.cwd(), "src/app/api/cron/siphon-item-sets/route.ts"), "utf8");

        expect(route).toContain("verifyCronSecret(req)");
        expect(route).toContain("siphonItemSetsCore({ apply, maxPages, startSkip })");
        // Dry-run par défaut : `apply` n'est vrai que sur demande explicite.
        expect(route).toContain('applyParam === "1" || applyParam === "true"');
    });
});

describe("veille ciblée des panoplies — un filigrane ne se devine jamais", () => {
    it("accepte une date ISO (avec ou sans heure) et la normalise en UTC", () => {
        expect(normalizeSince("2026-10-01T00:00:00.000Z")).toBe("2026-10-01T00:00:00.000Z");
        expect(normalizeSince("2026-10-01")).toBe("2026-10-01T00:00:00.000Z");
    });

    it("refuse tout le reste : une valeur illisible ne doit jamais passer pour « à jour »", () => {
        // Un filigrane invalide accepté ferait relire **zéro** panoplie : le référentiel se
        // périmerait en silence. On préfère une passe complète (correcte, seulement plus lente).
        for (const bad of [null, undefined, "", "   ", "hier", "2026-13-45T99:99:99Z", 12345, {}, []]) {
            expect(normalizeSince(bad)).toBeNull();
        }
    });
});

describe("branchement — les surfaces passent les panoplies du build", () => {
    const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

    it("miniature, carte de galerie et profil transmettent `itemSets`", () => {
        const preview = read("src/components/dofus/dofusbook-preview.tsx");
        const gallery = read("src/app/dashboard/[guildId]/galerie-stuff/gallery-client.tsx");
        const buildsCard = read("src/components/profile/builds-card.tsx");

        expect(preview).toContain("applyVariantsToBuild(data, variants, resolvedItemSets)");
        // Refus **motivé** : le badge affiche la cause exacte (plus un libellé muet).
        expect(preview).toContain("variantResult.refusal");
        expect(preview).toContain("explainVariantRefusal(data, variants, resolvedItemSets)");
        expect(gallery).toContain("itemSets={build.itemSets}");
        expect(buildsCard).toContain("itemSets={(link as any).itemSets}");
    });

    it("le serveur résout les panoplies avant d'enregistrer une variante", () => {
        const actions = read("src/server/actions/gallery-actions.ts");

        expect(actions).toContain("attachItemSetsToBuilds(pageBuilds)");
        expect(actions).toContain("applyVariantsToBuild(previewData, variants, { sets, byItem })");
        expect(actions).toContain("Bonus de panoplie indisponibles pour ce build");
    });
});


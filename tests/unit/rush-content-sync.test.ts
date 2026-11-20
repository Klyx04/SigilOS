import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
    isRushContentSyncNoop,
    planRushContentSync,
    summarizeRushContentSyncPlan,
} from "@/lib/rush-content-sync";
import type { RushImportPayload, RushImportSequence } from "@/lib/rush-import";

/**
 * Enrichissement (3b) : l'import est **additif**, donc les conseils (2b) et les
 * monstres (2a) du seed n'atteignent jamais un guide déjà en base. Cette règle
 * comble ce trou **sans écraser un texte God** : un conseil déjà saisi gagne, un
 * tag qui porte déjà ses monstres reste tel quel, aucun tag n'est ajouté ni retiré.
 */

function payloadOf(sequence: Partial<RushImportSequence>, blockTitle = "Bloc A"): RushImportPayload {
    return {
        blocks: [{ title: blockTitle, sequences: [{ subGuideName: "Quête X", ...sequence }] }],
    };
}

describe("planRushContentSync — conseils", () => {
    it("pose un conseil sur une quête qui n'en a pas", () => {
        const plan = planRushContentSync(payloadOf({ tips: "Parle au PNJ." }), [
            {
                id: "s1",
                blockTitle: "Bloc A",
                name: "Quête X",
                tips: null,
                activityTags: [{ type: "item", name: "Plume" }],
            },
        ]);

        expect(plan.updates).toHaveLength(1);
        expect(plan.updates[0]).toMatchObject({
            sequenceId: "s1",
            tips: "Parle au PNJ.",
            tipsFilled: true,
            monstersAdded: 0,
        });
        expect(plan.updates[0].activityTags).toBeNull();
    });

    it("ne réécrit jamais un conseil déjà saisi dans God", () => {
        const plan = planRushContentSync(payloadOf({ tips: "Texte du seed" }), [
            { id: "s1", blockTitle: "Bloc A", name: "Quête X", tips: "Texte God", activityTags: [] },
        ]);

        expect(plan.updates).toHaveLength(0);
        expect(plan.tipsProtected).toBe(1);
    });

    it("ne considère pas un conseil identique comme protégé", () => {
        const plan = planRushContentSync(payloadOf({ tips: "Même texte" }), [
            { id: "s1", blockTitle: "Bloc A", name: "Quête X", tips: "  Même texte  ", activityTags: [] },
        ]);

        expect(plan.updates).toHaveLength(0);
        expect(plan.tipsProtected).toBe(0);
    });

    it("ignore un conseil vide dans le payload", () => {
        const plan = planRushContentSync(payloadOf({ tips: "   " }), [
            { id: "s1", blockTitle: "Bloc A", name: "Quête X", tips: null, activityTags: [] },
        ]);

        expect(plan.updates).toHaveLength(0);
        expect(plan.tipsProtected).toBe(0);
    });
});

describe("planRushContentSync — monstres", () => {
    it("ajoute les monstres au tag de combat qui n'en a pas, sans toucher aux autres champs", () => {
        const plan = planRushContentSync(
            payloadOf({
                activityTags: [
                    {
                        type: "combat_plusieurs",
                        name: "Groupe · Bouftou, Tofu",
                        monsters: [
                            { name: "Bouftou", slug: "bouftou", monsterId: 1 },
                            { name: "Tofu" },
                        ],
                    },
                ],
            }),
            [
                {
                    id: "s1",
                    blockTitle: "Bloc A",
                    name: "Quête X",
                    tips: null,
                    activityTags: [
                        { type: "item", name: "Plume", id: "1" },
                        { type: "combat_plusieurs", name: "Groupe · Bouftou, Tofu", level: 12 },
                    ],
                },
            ]
        );

        expect(plan.updates).toHaveLength(1);
        expect(plan.updates[0].monstersAdded).toBe(2);
        expect(plan.updates[0].tagsPatched).toBe(1);
        const tags = plan.updates[0].activityTags!;
        // Le tag hors combat est réutilisé tel quel.
        expect(tags[0]).toEqual({ type: "item", name: "Plume", id: "1" });
        // Le tag de combat garde ses champs et reçoit sa liste.
        expect(tags[1]).toMatchObject({ type: "combat_plusieurs", name: "Groupe · Bouftou, Tofu", level: 12 });
        expect(tags[1].monsters).toHaveLength(2);
        expect(tags[1].monsters?.[0]).toMatchObject({ name: "Bouftou", slug: "bouftou", monsterId: 1 });
    });

    it("laisse un tag qui porte déjà ses monstres", () => {
        const plan = planRushContentSync(
            payloadOf({
                activityTags: [{ type: "combat_solo", name: "Bouftou", monsters: [{ name: "Bouftou" }] }],
            }),
            [
                {
                    id: "s1",
                    blockTitle: "Bloc A",
                    name: "Quête X",
                    tips: null,
                    activityTags: [{ type: "combat_solo", name: "Bouftou", monsters: [{ name: "Déjà là" }] }],
                },
            ]
        );

        expect(plan.updates).toHaveLength(0);
        expect(plan.tagsAlready).toBe(1);
    });

    it("signale un groupe que le payload ne résout pas, sans deviner", () => {
        const plan = planRushContentSync(
            payloadOf({ activityTags: [{ type: "combat_solo", name: "Autre monstre" }] }),
            [
                {
                    id: "s1",
                    blockTitle: "Bloc A",
                    name: "Quête X",
                    activityTags: [{ type: "combat_solo", name: "Inconnu" }],
                },
            ]
        );

        expect(plan.updates).toHaveLength(0);
        expect(plan.tagsWithoutSource).toBe(1);
    });

    it("ne touche ni un tag non-combat ni un tag absent du payload", () => {
        const plan = planRushContentSync(
            payloadOf({
                activityTags: [{ type: "combat_solo", name: "Bouftou", monsters: [{ name: "Bouftou" }] }],
            }),
            [
                {
                    id: "s1",
                    blockTitle: "Bloc A",
                    name: "Quête X",
                    tips: null,
                    activityTags: [
                        { type: "donjon", name: "Donjon des Bouftous" },
                        { type: "item", name: "Laine", count: 3 },
                    ],
                },
            ]
        );

        expect(plan.updates).toHaveLength(0);
        expect(plan.tagsAlready).toBe(0);
        expect(plan.tagsWithoutSource).toBe(0);
    });

    it("borne et dédoublonne un groupe de monstres", () => {
        const many = Array.from({ length: 25 }, (_, index) => ({ name: `Monstre ${index + 1}` }));
        const plan = planRushContentSync(
            payloadOf({
                activityTags: [{ type: "combat_solo", name: "Foule", monsters: [...many, { name: "Monstre 1" }] }],
            }),
            [
                {
                    id: "s1",
                    blockTitle: "Bloc A",
                    name: "Quête X",
                    activityTags: [{ type: "combat_solo", name: "Foule" }],
                },
            ]
        );

        expect(plan.updates[0].activityTags?.[0].monsters).toHaveLength(20);
    });
});

describe("planRushContentSync — rapprochement et idempotence", () => {
    it("rapproche par bloc et par nom, jamais par le seul nom", () => {
        const plan = planRushContentSync(
            { blocks: [{ title: "Bloc B", sequences: [{ subGuideName: "Quête X", tips: "Seed" }] }] },
            [{ id: "s1", blockTitle: "Bloc A", name: "Quête X", tips: null, activityTags: [] }]
        );

        expect(plan.updates).toHaveLength(0);
        expect(plan.unmatched).toBe(1);
    });

    it("ignore la casse, les accents et la ponctuation du libellé", () => {
        const plan = planRushContentSync(
            { blocks: [{ title: "Bloc A", sequences: [{ subGuideName: "La quete de l'ete", tips: "Seed" }] }] },
            [{ id: "s1", blockTitle: "Bloc A", name: "La Quête de l'Été", tips: null, activityTags: [] }]
        );

        expect(plan.updates).toHaveLength(1);
        expect(plan.unmatched).toBe(0);
    });

    it("est idempotente : une fois appliqué, le second passage ne propose plus rien", () => {
        const payload = payloadOf({
            tips: "Texte du seed",
            activityTags: [{ type: "combat_solo", name: "Bouftou", monsters: [{ name: "Bouftou" }] }],
        });
        const current = [
            {
                id: "s1",
                blockTitle: "Bloc A",
                name: "Quête X",
                tips: null,
                activityTags: [{ type: "combat_solo", name: "Bouftou" }],
            },
        ];

        const first = planRushContentSync(payload, current);
        expect(isRushContentSyncNoop(first)).toBe(false);

        const applied = [
            {
                ...current[0],
                tips: first.updates[0].tips,
                activityTags: first.updates[0].activityTags,
            },
        ];
        const second = planRushContentSync(payload, applied);
        expect(isRushContentSyncNoop(second)).toBe(true);
        expect(second.updates).toHaveLength(0);
    });

    it("ne mute pas les entrées", () => {
        const tags = [{ type: "combat_solo", name: "Bouftou" }];
        const sequence = {
            id: "s1",
            blockTitle: "Bloc A",
            name: "Quête X",
            tips: null,
            activityTags: tags,
        };
        const before = JSON.stringify(sequence);
        planRushContentSync(
            payloadOf({
                tips: "Seed",
                activityTags: [{ type: "combat_solo", name: "Bouftou", monsters: [{ name: "Bouftou" }] }],
            }),
            [sequence]
        );
        expect(JSON.stringify(sequence)).toBe(before);
    });

    it("résume le plan sans transporter les tags complets", () => {
        const plan = planRushContentSync(
            payloadOf({
                tips: "Seed",
                activityTags: [{ type: "combat_solo", name: "Bouftou", monsters: [{ name: "Bouftou" }] }],
            }),
            [
                {
                    id: "s1",
                    blockTitle: "Bloc A",
                    name: "Quête X",
                    tips: null,
                    activityTags: [{ type: "combat_solo", name: "Bouftou" }],
                },
            ]
        );
        const summary = summarizeRushContentSyncPlan(plan);

        expect(summary).toMatchObject({ sequences: 1, updates: 1, tips: 1, tags: 1, monsters: 1, unmatched: 0 });
        expect("activityTags" in summary).toBe(false);
        expect(summary.sample).toEqual([{ name: "Quête X", tipsFilled: true, monstersAdded: 1 }]);
    });
});

describe("syncRushGuideContent — garde de l'action serveur", () => {
    const code = readFileSync(
        path.join(process.cwd(), "src/server/actions/optimized-guide-actions.ts"),
        "utf8"
    );
    const start = code.indexOf("export async function syncRushGuideContent");
    const end = code.indexOf("\n/**", start + 10);
    const body = code.slice(start, end > start ? end : start + 9000);

    it("est protégée et rend le plan sans écrire quand `apply` est faux", () => {
        expect(start).toBeGreaterThan(-1);
        expect(body).toContain("await requireRushAccess();");
        expect(body).toContain("data: { dryRun: true as const, plan: summary }");
    });

    it("limite le débit, trace l'écriture et revalide les surfaces", () => {
        expect(body).toContain("rateLimit(");
        expect(body).toContain("logGodWrite(");
        // Le helper est la source unique : il revalide la page publique (verrou `rush-revalidations`).
        expect(body).toContain("revalidateRushContent()");
        expect(body).toContain("db.guideSequence.update({");
    });

    it("n'écrit un conseil que s'il est vide : le texte God reste prioritaire", () => {
        // La règle est portée par `planRushContentSync` (tipsFilled exige un `tips` vide) ;
        // l'action ne doit jamais écrire `tips` hors de ce drapeau.
        expect(body).toContain("update.tipsFilled && update.tips !== null");
        expect(body).toContain("activityTags: update.activityTags as never");
    });
});

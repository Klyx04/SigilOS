/**
 * Siphon des **conditions d'équipement** (DofusDude → `GameItem.conditions`).
 *
 * Ces conditions sont ce qui **bloque** une variante illégale (trophée conditionnel, `pk<2`,
 * `PA<12`…). Deux propriétés comptent vraiment et sont verrouillées ici :
 *  · **idempotence** — Postgres réordonne les clés JSONB, donc la comparaison doit être stable,
 *    sinon chaque passage réécrit 264 lignes pour rien ;
 *  · **aucune écriture partielle** — un arbre illisible ou démesuré est **refusé avec sa raison**
 *    (une condition à moitié écrite bloquerait une variante parfaitement légitime).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
vi.mock("@/lib/prisma", () => ({
    db: {
        gameItem: {
            findUnique: (...args: any[]) => mockFindUnique(...args),
            update: (...args: any[]) => mockUpdate(...args),
        },
    },
}));

vi.mock("@/lib/logger", () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { siphonItemConditionsCore } from "@/lib/item-conditions-siphon";

/** Arbre réel DofusDude (trophée conditionnel : moins de 2 bonus de panoplies). */
const CONDITION = {
    relation: "and",
    children: [
        { operator: "<", int_value: 2, element: { name: "Bonus de panoplies" } },
    ],
};

function page(items: unknown[], options: { hasNext?: boolean } = {}) {
    return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
            items,
            _links: options.hasNext ? { next: "https://api.dofusdu.de/next" } : {},
        }),
    } as any;
}

beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue({ id: 42, conditions: null });
    mockUpdate.mockResolvedValue({ id: 42 });
});

describe("siphon des conditions — dry-run, écriture, idempotence", () => {
    it("dry-run : mesure sans écrire (les objets sans condition sont ignorés)", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(page([
            { ankama_id: 15360, name: "Trophée", conditions: CONDITION },
            { ankama_id: 15361, name: "Sans condition", conditions: null },
        ])));

        const report = await siphonItemConditionsCore();

        expect(report).toMatchObject({ fetched: 2, withConditions: 1, toWrite: 1, written: 0 });
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("apply : écrit l'arbre tel quel sur l'objet trouvé par `ankamaId`", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(page([
            { ankama_id: 15360, conditions: CONDITION },
        ])));

        const report = await siphonItemConditionsCore({ apply: true });

        expect(report.written).toBe(1);
        expect(mockUpdate).toHaveBeenCalledWith({
            where: { id: 42 },
            data: { conditions: CONDITION },
        });
    });

    it("arbre identique mais clés dans un autre ordre → inchangé, aucune écriture (JSONB réordonne)", async () => {
        // Mêmes données, ordre des clés inversé : c'est exactement ce que Postgres renvoie.
        mockFindUnique.mockResolvedValue({
            id: 42,
            conditions: { children: CONDITION.children, relation: "and" },
        });
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(page([
            { ankama_id: 15360, conditions: CONDITION },
        ])));

        const report = await siphonItemConditionsCore({ apply: true });

        expect(report).toMatchObject({ unchanged: 1, toWrite: 0, written: 0 });
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("objet absent de `GameItem` → compté `missing`, jamais créé ici", async () => {
        mockFindUnique.mockResolvedValue(null);
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(page([
            { ankama_id: 999999, conditions: CONDITION },
        ])));

        const report = await siphonItemConditionsCore({ apply: true });

        expect(report).toMatchObject({ missing: 1, written: 0 });
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("arbre démesuré → refus explicite (jamais une condition partielle)", async () => {
        const huge = {
            relation: "and",
            children: Array.from({ length: 400 }, (_, i) => ({
                operator: "<",
                int_value: i,
                element: { name: "PA" },
            })),
        };
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(page([
            { ankama_id: 15360, conditions: huge },
        ])));

        const report = await siphonItemConditionsCore({ apply: true });

        expect(report.skipped).toHaveLength(1);
        expect(report.skipped[0].reason).toContain("démesuré");
        expect(report.written).toBe(0);
    });

    it("DofusDude indisponible → l'erreur remonte (le cron doit échouer franchement)", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: false,
            status: 503,
            headers: new Headers(),
            json: async () => ({}),
        } as any));

        await expect(siphonItemConditionsCore({ apply: true })).rejects.toThrow("503");
    });
});

describe("route cron — la même porte que les autres siphons", () => {
    it("protégée, dry-run par défaut, et elle appelle le cœur (aucune logique dupliquée)", () => {
        const route = readFileSync(
            path.join(process.cwd(), "src/app/api/cron/siphon-item-conditions/route.ts"),
            "utf8",
        );

        expect(route).toContain("verifyCronSecret(req)");
        expect(route).toContain('applyParam === "1" || applyParam === "true"');
        expect(route).toContain('import("@/lib/item-conditions-siphon")');
        // Le script local ne porte PLUS la logique : il l'importe (une seule source).
        const script = readFileSync(
            path.join(process.cwd(), "scripts/siphon-item-conditions.ts"),
            "utf8",
        );
        expect(script).toContain('import("../src/lib/item-conditions-siphon")');
    });
});

/**
 * 🎯 Alertes God — **une seule vérité, trois lecteurs** (lot C1).
 *
 * Mesure du 18/10/2026 (`dev` = `9f1d9649`) : `notifyGod` construisait les champs de
 * l'embed Discord à la volée (libellés français) mais ne persistait que `metadata` (clés
 * techniques) ; la console God réaffichait ces clés brutes, sans borne. Deux vérités pour
 * un même fait — et le cas `data-watch` (9 champs) perdait `autoUnavailable` dès qu'un
 * plafond d'affichage à 8 était envisagé.
 *
 * Ce test verrouille le contrat :
 *  ① la base **garde tout** (`details`, dans l'ordre, sans coupure produit) ;
 *  ② l'embed Discord est une **projection bornée** de cette même liste (25 champs /
 *    1 024 car.), jamais une seconde vérité ;
 *  ③ la console God lit `details` **en entier** (aucun `slice` d'affichage).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("@/lib/prisma", () => ({
    db: {
        platformConfig: { findUnique: vi.fn() },
        godNotification: { create: vi.fn(), findMany: vi.fn() },
    },
}));
vi.mock("@/lib/ratelimit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/server/discord", () => ({
    sendChannelMessage: vi.fn(),
    buildSafeRoleMention: vi.fn().mockResolvedValue(""),
}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { db } from "@/lib/prisma";
import { sendChannelMessage } from "@/server/discord";
import { notifyGod, getGodNotifications } from "@/server/actions/god-notif-actions";
import {
    detailsFromMetadata,
    formatGodDetailValue,
    normalizeGodNotificationDetails,
    resolveGodNotificationDetails,
    toGodEmbedFields,
    GOD_DETAILS_EMBED_MAX_FIELDS,
    GOD_DETAILS_EMBED_VALUE_MAX,
    GOD_DETAILS_MAX_FIELDS,
    GOD_DETAILS_VALUE_MAX,
    GOD_NOTIFICATIONS_LIST_MAX,
} from "@/lib/god-notification-details";

const mockDb = db as any;

/** Payload **réel** du plus gros émetteur (`data-watch`, 9 clés) lors d'un passage utile. */
const METADATA_9 = {
    remoteItems: 5120,
    localItems: 5114,
    questNew: 3,
    questModified: 1,
    remoteDungeons: 207,
    localDungeons: 207,
    autoQueued: ["quests"],
    autoRunning: ["dungeons"],
    autoUnavailable: ["monsters"],
};

describe("règle pure — une valeur ne perd jamais son sens", () => {
    it("un objet n'est jamais rendu « [object Object] »", () => {
        expect(formatGodDetailValue({ autoQueued: ["a", "b"] })).toBe('{"autoQueued":["a","b"]}');
    });

    it("un tableau est joint, pas stringifié en JSON", () => {
        expect(formatGodDetailValue(["STELLIUM", "AUTRE"])).toBe("STELLIUM, AUTRE");
    });

    it("null, vide ou tableau vide n'ont rien à afficher", () => {
        expect(formatGodDetailValue(null)).toBeNull();
        expect(formatGodDetailValue("   ")).toBeNull();
        expect(formatGodDetailValue([])).toBeNull();
    });

    it("une valeur démesurée est bornée au plafond de sécurité, avec une marque visible", () => {
        const out = formatGodDetailValue("x".repeat(GOD_DETAILS_VALUE_MAX + 50))!;
        expect(out.length).toBeLessThanOrEqual(GOD_DETAILS_VALUE_MAX);
        expect(out.endsWith("…")).toBe(true);
    });
});


describe("normalisation — tout est conservé, dans l'ordre", () => {
    it("le cas réel `data-watch` rend ses 9 champs (aucun plafond à 8)", () => {
        const rows = normalizeGodNotificationDetails(
            Object.entries(METADATA_9).map(([name, value]) => ({ name, value })),
        )!;
        expect(rows).toHaveLength(9);
        expect(rows[0].name).toBe("remoteItems");
        expect(rows[8].name).toBe("autoUnavailable");
        expect(rows[8].value).toBe("monsters");
    });

    it("ignore une entrée sans libellé ou sans valeur, et préserve `inline`", () => {
        const rows = normalizeGodNotificationDetails([
            { name: "   ", value: 1 },
            { name: "sans-valeur", value: null },
            { name: "Inline", value: 0, inline: true },
            { name: "Sans", value: false },
        ])!;
        expect(rows).toEqual([
            { name: "Inline", value: "0", inline: true },
            { name: "Sans", value: "false" },
        ]);
    });

    it("plafond de sécurité : 205 champs ⇒ 200 + 1 ligne qui DIT la perte", () => {
        const input = Array.from({ length: 205 }, (_, index) => ({ name: `c${index}`, value: index }));
        const rows = normalizeGodNotificationDetails(input)!;
        expect(rows).toHaveLength(GOD_DETAILS_MAX_FIELDS + 1);
        expect(rows[GOD_DETAILS_MAX_FIELDS].name).toContain("non conservés");
        expect(rows[GOD_DETAILS_MAX_FIELDS].value).toContain("5");
    });
});

describe("métadonnées et priorité des sources", () => {
    it("dérive les détails d'un `metadata` brut (alertes d'avant la migration)", () => {
        const rows = detailsFromMetadata({
            remoteItems: 120,
            keywords: ["a", "b"],
            nested: { x: 1 },
        })!;
        expect(rows.map((row) => [row.name, row.value])).toEqual([
            ["remoteItems", "120"],
            ["keywords", "a, b"],
            ["nested", '{"x":1}'],
        ]);
        expect(detailsFromMetadata(null)).toBeNull();
        expect(detailsFromMetadata(["a"])).toBeNull();
    });

    it("`fields` (libellés humains) l'emporte sur `metadata`", () => {
        const rows = resolveGodNotificationDetails({
            fields: [{ name: "Profils traités", value: 12 }],
            metadata: { success_count: 12 },
        })!;
        expect(rows.map((row) => row.name)).toEqual(["Profils traités"]);
    });
});

describe("projection embed — un extrait borné, jamais une autre vérité", () => {
    it("≤ 25 champs : mêmes libellés, mêmes valeurs, même ordre", () => {
        const details = normalizeGodNotificationDetails(
            Object.entries(METADATA_9).map(([name, value]) => ({ name, value })),
        )!;
        const embed = toGodEmbedFields(details)!;
        expect(embed.map((field) => [field.name, field.value])).toEqual(
            details.map((detail) => [detail.name, detail.value]),
        );
    });

    it("> 25 champs : 24 + une ligne qui dit combien restent visibles côté God", () => {
        const details = normalizeGodNotificationDetails(
            Array.from({ length: 30 }, (_, index) => ({ name: `Champ ${index}`, value: index })),
        )!;
        const embed = toGodEmbedFields(details)!;
        expect(embed).toHaveLength(GOD_DETAILS_EMBED_MAX_FIELDS);
        expect(embed.slice(0, 24).map((field) => field.name)).toEqual(
            details.slice(0, 24).map((detail) => detail.name),
        );
        expect(embed[24].value).toContain("6");
        expect(embed[24].value).toContain("console God");
    });

    it("une valeur trop longue n'est coupée QUE dans l'embed", () => {
        const long = "y".repeat(2000);
        const details = normalizeGodNotificationDetails([{ name: "Erreurs", value: long }])!;
        expect(details[0].value).toHaveLength(2000);
        const embed = toGodEmbedFields(details)!;
        expect(embed[0].value.length).toBeLessThanOrEqual(GOD_DETAILS_EMBED_VALUE_MAX);
        expect(embed[0].value.endsWith("…")).toBe(true);
    });

    it("rien à afficher ⇒ pas de champ d'embed", () => {
        expect(toGodEmbedFields(null)).toBeUndefined();
        expect(toGodEmbedFields([])).toBeUndefined();
    });
});

describe("notifyGod — la base garde tout, Discord reçoit l'extrait", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.platformConfig.findUnique.mockResolvedValue({
            godNotifyChannelId: "1547020288380637305",
            godNotifyRoleId: "999",
        });
        mockDb.godNotification.create.mockResolvedValue({ id: "notif-1" });
        mockDb.godNotification.findMany.mockResolvedValue([]);
        (sendChannelMessage as any).mockResolvedValue("outbox:job-1");
    });

    const detailsOf = () => mockDb.godNotification.create.mock.calls[0][0].data.details;
    const embedFieldsOf = () => (sendChannelMessage as any).mock.calls[0][2].fields;

    it("9 détails (cas `data-watch`) : 9 en base ET 9 dans l'embed, à l'identique", async () => {
        await notifyGod({
            title: "🆕 Nouveautés DofusDB détectées",
            message: "3 quêtes, 1 donjon modifié.",
            type: "SYSTEM",
            metadata: METADATA_9,
        });

        expect(detailsOf()).toHaveLength(9);
        expect(embedFieldsOf()).toHaveLength(9);
        expect(embedFieldsOf().map((field: any) => [field.name, field.value])).toEqual(
            detailsOf().map((detail: any) => [detail.name, detail.value]),
        );
    });

    it("30 détails : la base en garde 30, l'embed 25 (24 + résumé)", async () => {
        const fields = Array.from({ length: 30 }, (_, index) => ({
            name: `Champ ${index}`,
            value: String(index),
        }));
        await notifyGod({ title: "Gros bilan", message: "…", type: "WORKER_SYNC", fields });

        expect(detailsOf()).toHaveLength(30);
        expect(embedFieldsOf()).toHaveLength(GOD_DETAILS_EMBED_MAX_FIELDS);
        expect(embedFieldsOf()[24].value).toContain("6");
    });

    it("aucun champ ⇒ `details` reste NULL (pas de liste vide en base)", async () => {
        await notifyGod({ title: "☕ Nouveau Don Ko-fi", message: "3.00 EUR", type: "SYSTEM" });

        expect(detailsOf()).toBeNull();
        expect(embedFieldsOf()).toBeUndefined();
    });

    it("`fields` fournis ⇒ `metadata` ne pollue pas les détails", async () => {
        await notifyGod({
            title: "Ladder General/Succès Sync",
            message: "12/12 profils à jour.",
            type: "WORKER_SYNC",
            fields: [{ name: "Profils traités", value: "12" }],
            metadata: { success_count: 12, fail_count: 0 },
        });

        expect(detailsOf()).toEqual([{ name: "Profils traités", value: "12" }]);
    });
});

describe("getGodNotifications — lecture bornée côté serveur", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.godNotification.findMany.mockResolvedValue([]);
    });

    const takeOf = () => mockDb.godNotification.findMany.mock.calls[0][0].take;

    it("0 ⇒ 1, 10 000 ⇒ 100, NaN ⇒ 50", async () => {
        await getGodNotifications(0);
        expect(takeOf()).toBe(1);

        mockDb.godNotification.findMany.mockClear();
        await getGodNotifications(10_000);
        expect(takeOf()).toBe(GOD_NOTIFICATIONS_LIST_MAX);

        mockDb.godNotification.findMany.mockClear();
        await getGodNotifications(Number.NaN);
        expect(takeOf()).toBe(50);
    });
});

describe("verrous de source — la console lit la vérité écrite", () => {
    const panel = readFileSync("src/app/god/components/god-notification-panel.tsx", "utf8");
    const actions = readFileSync("src/server/actions/god-notif-actions.ts", "utf8");
    const schema = readFileSync("prisma/schema.prisma", "utf8");

    it("le modèle persiste `details` (colonne nullable)", () => {
        expect(schema).toMatch(/model GodNotification \{[\s\S]*?details\s+Json\?/);
    });

    it("`notifyGod` écrit `details` et projette l'embed depuis cette même valeur", () => {
        expect(actions).toMatch(/details:\s*details \?\? null/);
        expect(actions).toMatch(/fields:\s*toGodEmbedFields\(details\)/);
        // Plus aucun rendu brut de `metadata` dans l'embed (l'ancien `slice(0, 5)`).
        expect(actions).not.toMatch(/Object\.entries\(metadata\)\.slice/);
    });

    it("la console affiche la liste COMPLÈTE (aucun `slice`, aucune valeur brute)", () => {
        expect(panel).toMatch(/notif\.details/);
        expect(panel).toMatch(/detailsFromMetadata\(notif\.metadata\)/);
        expect(panel).not.toMatch(/detailRows\.slice\(/);
        expect(panel).not.toMatch(/String\(value\)/);
    });
});

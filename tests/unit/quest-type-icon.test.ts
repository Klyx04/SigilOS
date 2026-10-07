import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";

import {
    QUEST_TYPE_KEYS,
    QUEST_TYPE_LABELS,
    questTypeIconPath,
    questTypeLabel,
    resolveQuestTypeKey,
} from "@/lib/quest-type-icon";

describe("quest-type-icon — mapping mesuré client 3.7 / DofusDB", () => {
    it("mappe les 4 types de base", () => {
        expect(resolveQuestTypeKey({ type: 3 })).toBe("primordiale");
        expect(resolveQuestTypeKey({ type: 2 })).toBe("principale");
        expect(resolveQuestTypeKey({ type: 0 })).toBe("secondaire");
        expect(resolveQuestTypeKey({ type: 1 })).toBe("decouverte");
    });

    it("détecte la répétable classique (repeatType 1, ex Wogew)", () => {
        expect(resolveQuestTypeKey({ type: 0, repeatType: 1 })).toBe("repetable");
    });

    it("détecte la répétable événementielle (repeatType 3 + event, ex offrandes Almanax)", () => {
        expect(resolveQuestTypeKey({ type: 0, repeatType: 3, isEvent: true })).toBe("repetable-event");
    });

    it("décline les variantes événementielles (sauf primordiale et découverte)", () => {
        expect(resolveQuestTypeKey({ type: 2, isEvent: true })).toBe("principale-event");
        expect(resolveQuestTypeKey({ type: 0, isEvent: true })).toBe("secondaire-event");
        // La légende à 8 ne connaît pas ces variantes : repli type de base.
        expect(resolveQuestTypeKey({ type: 3, isEvent: true })).toBe("primordiale");
        expect(resolveQuestTypeKey({ type: 1, isEvent: true })).toBe("decouverte");
    });

    it("ne devine jamais sur repeatType non documenté (2, -1)", () => {
        expect(resolveQuestTypeKey({ type: 2, repeatType: 2 })).toBe("principale");
        expect(resolveQuestTypeKey({ type: 0, repeatType: -1 })).toBe("secondaire");
    });

    it("est fail-closed sur entrée absente ou farfelue", () => {
        expect(resolveQuestTypeKey(null)).toBe("secondaire");
        expect(resolveQuestTypeKey(undefined)).toBe("secondaire");
        expect(resolveQuestTypeKey({})).toBe("secondaire");
        expect(resolveQuestTypeKey({ type: 99 })).toBe("secondaire");
        expect(resolveQuestTypeKey({ type: "principale" })).toBe("secondaire");
    });

    it("expose 8 clés, 8 libellés et des sprites (repli base si variante manquante)", () => {
        expect(QUEST_TYPE_KEYS).toHaveLength(8);
        for (const key of QUEST_TYPE_KEYS) {
            expect(QUEST_TYPE_LABELS[key]).toMatch(/Quête/);
            expect(questTypeIconPath(key)).toMatch(/^\/assets\/dofus\/quests\/type-.*\.webp$/);
        }
        expect(questTypeIconPath("primordiale")).toBe("/assets/dofus/quests/type-primordiale.webp");
        // Variantes événementielles sans sprite dédié : sprite du type de base.
        expect(questTypeIconPath("principale-event")).toBe("/assets/dofus/quests/type-principale.webp");
        expect(questTypeLabel({ type: 2 })).toBe("Quête principale");
    });

    it("chaque sprite résolu existe dans public/ (aucun 404 silencieux)", () => {
        const manquants = QUEST_TYPE_KEYS.map(questTypeIconPath)
            .filter((src) => src.startsWith("/"))
            .filter((src) => !existsSync(path.join(process.cwd(), "public", src.replace(/^\//, ""))));
        expect(manquants).toEqual([]);
    });
});

/**
 * Clôture **unitaire** d'un donjon (post multi) + rappels H-1 en multi.
 *
 * 📏 Mesure du 23/10/2026 :
 *  - un post multi ne pouvait être fermé **qu'en entier** : impossible de terminer un donjon
 *    le soir et de garder les autres ouverts ;
 *  - `sendDjReminders` filtrait sur `DjSearchPost.targetDate`, **NULL** sur un post multi
 *    (les échéances vivent dans `_items[i].targetDate`) ⇒ **aucun rappel H-1 ne partait**.
 *
 * 🔒 Ce que ce verrou interdit : re-fermer en entier, créditer les succès/points d'un autre
 * donjon, patcher le message d'un donjon déjà clôturé, ou perdre le rappel du 2ᵉ donjon daté.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");

const ACTIONS = read("src/server/actions/dungeon-finder-actions.ts");
const REMINDERS = read("src/server/dj-reminder-service.ts");
const CLOSE_MODAL = read("src/components/dungeon-finder/DjCloseModal.tsx");
const DETAIL_MODAL = read("src/components/dungeon-finder/DjPostDetailModal.tsx");

function closeActionBody(): string {
    const start = ACTIONS.indexOf("export async function closeDjDungeon(");
    expect(start).toBeGreaterThan(-1);
    return ACTIONS.slice(start, start + 6000);
}

describe("Clôture unitaire d'un donjon", () => {
    it("l'action est réservée au créateur, isolée à la guilde et gardée dans le WHERE", () => {
        const body = closeActionBody();
        expect(body).toContain("Seul le créateur peut clôturer un donjon");
        expect(body).toContain("assertPostGuildTenant(guildId, post.guildId)");
        // Garde d'état : deux clics ne peuvent pas clôturer deux fois le même donjon.
        expect(body).toContain("if (updated.count === 0)");
        expect(body).toContain('status: { in: ["OPEN", "FULL"] }');
    });

    it("ne crédite QUE le donjon visé (points et succès)", () => {
        const body = closeActionBody();
        // Points : inscrits de CE donjon (ou ligne historique `dungeonIndex = null`).
        expect(body).toContain("OR: [{ dungeonIndex }, { dungeonIndex: null }]");
        // Succès : ceux demandés sur CE donjon, jamais ceux d'un autre.
        expect(body).toContain("v.dungeonId === entry.dungeonId && requestedAchievements.has(v.achievementId)");
    });

    it("supprime le message du donjon clôturé, et seulement lui", () => {
        const body = closeActionBody();
        expect(body).toContain("getMultiMessageIds(post.dungeonsJson)");
        expect(body).toContain("messageIds[dungeonIndex]");
        expect(body).toContain("deleteChannelMessage(post.discordChannelId, targetMessageId)");
        // Le post ne passe CLOSED que si plus aucun donjon n'est ouvert.
        expect(body).toContain("const remaining = openDjDungeonIndexes(nextJson).length;");
        expect(body).toContain('...(allClosed ? { status: "CLOSED" } : {})');
    });

    it("l'embed n'est plus patché pour un donjon clôturé", () => {
        expect(ACTIONS).toContain("if (isDjDungeonClosed(entries[i])) continue;");
    });

    it("l'UI branche la modale sur le donjon visé", () => {
        expect(CLOSE_MODAL).toContain("dungeonIndex?: number | null;");
        expect(CLOSE_MODAL).toContain("closeDjDungeon(guildId, post.id, dungeonIndex");
        expect(CLOSE_MODAL).toContain("if (dungeonIndex !== null && index !== dungeonIndex) return;");
        expect(DETAIL_MODAL).toContain("Clôturer ce donjon");
        expect(DETAIL_MODAL).toContain("dungeonIndex={closeDungeonIndex}");
        // « Terminer le post » reste la clôture GLOBALE : l'index est remis à null.
        expect(DETAIL_MODAL).toContain("setCloseDungeonIndex(null)");
    });
});

describe("Rappels H-1 en multi-donjons", () => {
    it("scanne aussi les posts dont la colonne `targetDate` est NULL", () => {
        expect(REMINDERS).toContain("const multiCandidates = await (db as any).djSearchPost.findMany({");
        expect(REMINDERS).toMatch(/multiCandidates[\s\S]{0,400}targetDate: null/);
        // Le filtre historique des posts simples reste intact (verrou h1-reminders-wiring).
        expect(REMINDERS).toMatch(/targetDate: \{ not: null, gt: now/);
    });

    it("ne rappelle ni un donjon clôturé ni un donjon sans date", () => {
        expect(REMINDERS).toContain("isDjDungeonClosed(entry)");
        expect(REMINDERS).toContain("if (!entry?.targetDate) return;");
    });

    it("pose un marqueur PAR DONJON (sinon le 2ᵉ donjon daté ne serait jamais rappelé)", () => {
        expect(REMINDERS).toContain("withDjDungeonReminder(workingJson, session.index, sentAtIso, forIso)");
        // La clé du message de rappel distingue les donjons d'un même post.
        expect(REMINDERS).toContain('dj-reminder:msg:${post.id}:${session.index ?? "s"}:${now.getTime()}');
    });

    it("ne prévient que les inscrits du donjon concerné", () => {
        expect(REMINDERS).toContain("p.dungeonIndex === index || p.dungeonIndex == null");
        expect(REMINDERS).toContain("select: { userId: true, dungeonIndex: true }");
    });

    it("les rappels d'inactivité nomment les donjons d'un post multi", () => {
        const inactive = read("src/server/actions/inactive-posts-actions.ts");
        expect(inactive).toContain("const multiEntries = getMultiDungeons(post.dungeonsJson);");
        expect(inactive).toContain("multiLabel");
        // Le compteur d'inactivité vit dans l'enveloppe : les items ne doivent pas être perdus.
        expect(inactive).toContain("Array.isArray(post.dungeonsJson) ? { _items: post.dungeonsJson }");
    });
});

/**
 * Règle PURE de l'alerte « Ladder General/Succès Sync ».
 * Verrouille : la couleur dit la vérité (`vert ⇔ 0 échec`), le message liste les échecs
 * (borné) et les champs d'embed sont en français.
 */

import { describe, it, expect } from "vitest";
import {
    summarizeLadderSync,
    buildLadderSyncMessage,
    buildLadderSyncFields,
    buildLadderWorkerMessage,
    buildLadderWorkerFields,
    buildLadderGuildFields,
    formatLadderFailureContext,
    ladderFailureDetailRows,
    summarizeLadderFailuresByGuild,
    LADDER_SYNC_MAX_DETAIL_ROWS,
    LADDER_SYNC_MAX_LISTED_FAILURES,
    LADDER_SYNC_MAX_LISTED_GUILDS,
    LADDER_SYNC_MAX_MESSAGE_GUILDS,
    type LadderFailureProfile,
} from "@/lib/ladder-sync-alert";

describe("summarizeLadderSync", () => {
    it("tout OK ⇒ allSucceeded = true, aucun échec listé", () => {
        const s = summarizeLadderSync([
            { pseudo: "a", success: true },
            { pseudo: "b", success: true },
        ]);
        expect(s).toMatchObject({ batchSize: 2, successCount: 2, failCount: 0, allSucceeded: true });
        expect(s.failures).toEqual([]);
    });

    it("un seul échec ⇒ allSucceeded = false (LA mesure : 17/34 alertes mentaient)", () => {
        const s = summarizeLadderSync([
            { pseudo: "a", success: true },
            { pseudo: "b", success: true },
            { pseudo: "c", success: true },
            { pseudo: "d", success: true },
            { pseudo: "e", success: false, reason: "Not found on ladder" },
        ]);
        expect(s.successCount).toBe(4);
        expect(s.failCount).toBe(1);
        expect(s.allSucceeded).toBe(false);
        expect(s.failures).toEqual([{ pseudo: "e", reason: "Not found on ladder" }]);
    });

    it("utilise `error` à défaut de `reason`, et un repli si aucun motif", () => {
        const s = summarizeLadderSync([
            { pseudo: "x", success: false, error: "TypeError: boom" },
            { pseudo: "y", success: false },
        ]);
        expect(s.failures[0].reason).toBe("TypeError: boom");
        expect(s.failures[1].reason).toBe("raison inconnue");
    });

    it("liste vide ⇒ batchSize 0, allSucceeded true", () => {
        expect(summarizeLadderSync([])).toMatchObject({ batchSize: 0, failCount: 0, allSucceeded: true });
    });
});

describe("buildLadderSyncMessage", () => {
    it("succès total : pas de section échecs", () => {
        const msg = buildLadderSyncMessage(summarizeLadderSync([{ pseudo: "a", success: true }]));
        expect(msg).toContain("1/1");
        expect(msg).not.toContain("échec");
    });

    it("échecs : les nomme avec leur motif (actionnable)", () => {
        const msg = buildLadderSyncMessage(
            summarizeLadderSync([{ pseudo: "Toto", success: false, reason: "Not found on ladder" }]),
        );
        expect(msg).toContain("Toto");
        expect(msg).toContain("Not found on ladder");
    });

    it("borne la liste et résume le reste", () => {
        const many = Array.from({ length: LADDER_SYNC_MAX_LISTED_FAILURES + 3 }, (_, i) => ({
            pseudo: `p${i}`,
            success: false,
            reason: "not found",
        }));
        const msg = buildLadderSyncMessage(summarizeLadderSync(many));
        expect(msg).toContain("et 3 autre(s)");
    });
});

describe("buildLadderSyncFields", () => {
    it("champs en français (fin du jargon success_count / fail_count)", () => {
        const fields = buildLadderSyncFields(
            summarizeLadderSync([{ pseudo: "a", success: true }, { pseudo: "b", success: false, reason: "x" }]),
        );
        const names = fields.map((f) => f.name);
        expect(names).toEqual(["Profils traités", "À jour", "Échecs"]);
        expect(fields.find((f) => f.name === "Échecs")?.value).toBe("1");
        expect(names).not.toContain("fail_count");
    });
});

describe("run du WORKER BullMQ — message et champs FR (fin du jargon synced/notFound/errored)", () => {
    it("nomme les pseudos introuvables et en erreur (borné + suffixe)", () => {
        const many = Array.from({ length: LADDER_SYNC_MAX_LISTED_FAILURES + 2 }, (_, i) => `miss${i}`);
        const msg = buildLadderWorkerMessage({
            synced: 117,
            notFound: 8,
            errored: 1,
            total: 126,
            notFoundPseudos: many,
            erroredPseudos: ["Kaput"],
        });
        expect(msg).toContain("117/126");
        expect(msg).toContain("miss0");
        expect(msg).toContain(`(+${many.length - LADDER_SYNC_MAX_LISTED_FAILURES})`);
        expect(msg).toContain("En erreur : Kaput");
        // Jamais de clé technique dans le message.
        expect(msg).not.toContain("notFound");
        expect(msg).not.toContain("errored");
    });

    it("sans liste fournie : message honnête, aucune section « qui »", () => {
        const msg = buildLadderWorkerMessage({ synced: 2, notFound: 0, errored: 0, total: 2 });
        expect(msg).not.toContain("Introuvables :");
        expect(msg).not.toContain("En erreur :");
    });

    it("run interrompu : le dit explicitement", () => {
        const msg = buildLadderWorkerMessage({ synced: 0, notFound: 0, errored: 0, total: 50, aborted: true });
        expect(msg).toContain("interrompue");
    });

    it("champs d'embed en français (jamais jobId/synced/notFound)", () => {
        const fields = buildLadderWorkerFields({ synced: 4, notFound: 8, errored: 0, total: 12 });
        const names = fields.map((f) => f.name);
        expect(names).toEqual(["Profils traités", "À jour", "Introuvables", "Erreurs"]);
        expect(names).not.toContain("jobId");
        expect(names).not.toContain("synced");
        expect(fields.find((f) => f.name === "Introuvables")?.value).toBe("8");
    });

    it("ajoute la pause anti-blocage seulement si le run en a pris", () => {
        expect(buildLadderWorkerFields({ total: 1 }).some((f) => f.name === "Pauses anti-blocage")).toBe(false);
        expect(
            buildLadderWorkerFields({ total: 1, cooldowns: 1 }).some((f) => f.name === "Pauses anti-blocage"),
        ).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// C3 — « qui, par guilde », avec le maximum de contexte (pseudo renommé ?)
// ─────────────────────────────────────────────────────────────────────────────

const failure = (over: Partial<LadderFailureProfile> = {}): LadderFailureProfile => ({
    guildId: "g1",
    guildName: "STELLIUM",
    serverId: "draconiros",
    pseudo: "Pseudo",
    altPseudos: [],
    classe: null,
    dofusLevel: null,
    successPoints: null,
    totalXp: null,
    lastLadderUpdate: null,
    discordNickname: null,
    ...over,
});

describe("summarizeLadderFailuresByGuild — le « qui » est rattaché à sa guilde", () => {
    it("regroupe par guilde, compte les totaux et trie la plus touchée d'abord", () => {
        const breakdown = summarizeLadderFailuresByGuild(
            [
                failure({ pseudo: "a" }),
                failure({ pseudo: "b" }),
                failure({ pseudo: "c", guildId: "g2", guildName: "AUTRE", serverId: null }),
            ],
            [failure({ pseudo: "d" })],
        );

        expect(breakdown.guildsTotal).toBe(2);
        expect(breakdown.hiddenGuilds).toBe(0);
        expect(breakdown.guilds[0]).toMatchObject({ guildId: "g1", notFoundTotal: 2, erroredTotal: 1 });
        expect(breakdown.guilds[1]).toMatchObject({ guildId: "g2", notFoundTotal: 1, erroredTotal: 0 });
    });

    it("plafonne le nombre de guildes détaillées en DISANT combien sont masquées", () => {
        const many = Array.from({ length: LADDER_SYNC_MAX_LISTED_GUILDS + 2 }, (_, index) =>
            failure({ guildId: `g${index}`, guildName: `G${index}`, pseudo: `p${index}` }),
        );
        const breakdown = summarizeLadderFailuresByGuild(many, []);
        expect(breakdown.guilds).toHaveLength(LADDER_SYNC_MAX_LISTED_GUILDS);
        expect(breakdown.guildsTotal).toBe(LADDER_SYNC_MAX_LISTED_GUILDS + 2);
        expect(breakdown.hiddenGuilds).toBe(2);
    });
});

describe("formatLadderFailureContext — de quoi comprendre un pseudo disparu", () => {
    it("rend niveau, points, classe, dernier sync, alias et pseudo Discord", () => {
        const context = formatLadderFailureContext(
            failure({
                dofusLevel: 200,
                successPoints: 3512,
                classe: "Iop",
                lastLadderUpdate: "2026-10-12T03:00:00.000Z",
                altPseudos: ["Ancien-Nom", "Autre-Nom"],
                discordNickname: "Nick",
            }),
        );

        expect(context).toContain("niv. 200");
        expect(context).toMatch(/3.512 pts/);
        expect(context).toContain("Iop");
        expect(context).toContain("dernier sync 2026-10-12");
        expect(context).toContain("alias : Ancien-Nom, Autre-Nom");
        expect(context).toContain("Discord : Nick");
    });

    it("dit « jamais synchronisé » quand aucune date n'existe (jamais un vide)", () => {
        expect(formatLadderFailureContext(failure())).toContain("jamais synchronisé");
    });
});

describe("rendu — champs d'embed, message et lignes du journal", () => {
    it("un champ par guilde, avec les pseudos contextés et le reste résumé", () => {
        const six = Array.from({ length: LADDER_SYNC_MAX_LISTED_FAILURES + 1 }, (_, index) =>
            failure({ pseudo: `p${index}`, dofusLevel: 200 }),
        );
        const fields = buildLadderGuildFields(summarizeLadderFailuresByGuild(six, []));

        expect(fields).toHaveLength(1);
        expect(fields[0].name).toBe("STELLIUM · serveur draconiros");
        expect(fields[0].value).toContain("6 introuvable(s)");
        expect(fields[0].value).toContain("p0 (niv. 200");
        expect(fields[0].value).toContain("(+1)");
    });

    it("ajoute un champ « … autres guildes » quand le plafond est atteint", () => {
        const many = Array.from({ length: LADDER_SYNC_MAX_LISTED_GUILDS + 2 }, (_, index) =>
            failure({ guildId: `g${index}`, guildName: `G${index}`, pseudo: `p${index}` }),
        );
        const fields = buildLadderGuildFields(summarizeLadderFailuresByGuild(many, []));
        const last = fields[fields.length - 1];
        expect(last.name).toBe("… autres guildes");
        expect(last.value).toContain("2");
    });

    it("le message nomme la guilde ET les pseudos, et résume les guildes en trop", () => {
        const breakdown = summarizeLadderFailuresByGuild(
            [failure({ pseudo: "Toto" })],
            [failure({ pseudo: "Kaput", guildId: "g2", guildName: "AUTRE", serverId: null })],
        );
        const message = buildLadderWorkerMessage(
            { synced: 1, notFound: 1, errored: 1, total: 3 },
            breakdown,
        );
        expect(message).toContain("STELLIUM · serveur draconiros");
        expect(message).toContain("Toto");
        expect(message).toContain("AUTRE");
        expect(message).toContain("Kaput");

        const manyGuilds = Array.from({ length: LADDER_SYNC_MAX_MESSAGE_GUILDS + 1 }, (_, index) =>
            failure({ guildId: `g${index}`, guildName: `G${index}`, pseudo: `p${index}` }),
        );
        const longMessage = buildLadderWorkerMessage(
            { synced: 0, notFound: manyGuilds.length, errored: 0, total: manyGuilds.length },
            summarizeLadderFailuresByGuild(manyGuilds, []),
        );
        expect(longMessage).toContain("et 1 autre(s) guilde(s)");
    });

    it("une ligne de journal par profil en échec (le tableau du journal God)", () => {
        const rows = ladderFailureDetailRows(
            summarizeLadderFailuresByGuild([failure({ pseudo: "Toto" })], [failure({ pseudo: "Kaput" })]),
        );

        expect(Object.keys(rows)).toEqual(["STELLIUM · Toto", "STELLIUM · Kaput"]);
        expect(rows["STELLIUM · Toto"]).toContain("introuvable");
        expect(rows["STELLIUM · Kaput"]).toContain("erreur technique");
    });

    it("plafonne les lignes du journal en DISANT combien manquent", () => {
        const many = Array.from({ length: LADDER_SYNC_MAX_DETAIL_ROWS + 5 }, (_, index) =>
            failure({ pseudo: `p${index}` }),
        );
        const rows = ladderFailureDetailRows(summarizeLadderFailuresByGuild(many, []));
        expect(Object.keys(rows)).toHaveLength(LADDER_SYNC_MAX_DETAIL_ROWS + 1);
        expect(rows["… autres profils non détaillés"]).toContain("5");
    });
});

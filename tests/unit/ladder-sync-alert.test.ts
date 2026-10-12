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
    LADDER_SYNC_MAX_LISTED_FAILURES,
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

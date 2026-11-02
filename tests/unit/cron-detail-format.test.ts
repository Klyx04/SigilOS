/**
 * `formatDetailValue` — lisibilité du panneau CRON de God.
 *
 * Mesure du 02/11/2026 : la tâche `creator_watch` envoyait des **objets** dans `details`, le
 * panneau affichait `[object Object]` et la raison d'un « 0 annonce » devenait invisible.
 * Ce verrou interdit le retour du `String(v)` nu.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { formatDetailValue } from "@/app/god/components/cron-ui";

describe("formatDetailValue", () => {
    it("rend les scalaires tels quels", () => {
        expect(formatDetailValue("0")).toBe("0");
        expect(formatDetailValue(1)).toBe("1");
        expect(formatDetailValue(false)).toBe("false");
        expect(formatDetailValue(null)).toBe("—");
        expect(formatDetailValue(undefined)).toBe("—");
    });

    it("aplatit un objet en `clé=valeur` — jamais `[object Object]`", () => {
        const rendered = formatDetailValue({ liveStreams: 1, liveGuilds: 0, liveReasons: "aucun" });

        expect(rendered).toBe("liveStreams=1 · liveGuilds=0 · liveReasons=aucun");
        expect(rendered).not.toContain("[object Object]");
    });

    it("ignore les valeurs imbriquées (aperçu, pas un dump)", () => {
        expect(formatDetailValue({ live: { streams: 1 }, liveGuilds: 0 })).toBe("liveGuilds=0");
    });

    it("joint les tableaux", () => {
        expect(formatDetailValue(["a", "b"])).toBe("a, b");
        expect(formatDetailValue([])).toBe("");
    });

    it("borne la longueur", () => {
        const rendered = formatDetailValue({ long: "x".repeat(300) });
        expect(rendered.length).toBeLessThanOrEqual(160);
        expect(rendered.endsWith("…")).toBe(true);
    });

    it("un objet vide ne produit pas de texte trompeur", () => {
        expect(formatDetailValue({})).toBe("—");
    });
});

describe("route `creator_watch` — détails lisibles et résumé causal", () => {
    const ROUTE = fs.readFileSync(
        path.resolve(__dirname, "../../src/app/api/cron/live-watch/route.ts"),
        "utf8",
    );

    it("n'envoie plus d'objets dans `details` (cause du `[object Object]`)", () => {
        expect(ROUTE).not.toContain("details: { live, youtube, youtubeError }");
        expect(ROUTE).toContain("liveGuilds:");
        expect(ROUTE).toContain("liveReasons");
        expect(ROUTE).toContain("youtubeChannels:");
    });

    it("le résumé dit les guildes et les raisons d'un zéro", () => {
        expect(ROUTE).toContain("${live.guilds} guilde(s)");
        expect(ROUTE).toContain("ignorés ${live.skipped}");
        expect(ROUTE).toContain("${youtube.channelsResolved}/${youtube.creators} chaîne(s)");
    });
});

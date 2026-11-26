import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Sentry Rush — lot A du 26/11/2026.
 *
 * 36 : la PiP publique ne doit pas appeler les Server Actions membres (pas de profileId).
 * 38 : un rate limit est un **résultat**, pas une exception.
 * 37 : la coche des donjons d'un bloc est un lot (createMany + updateMany), pas un upsert par donjon.
 * 35 : `donjon-valide` n'a pas d'asset, donc pas de chemin inventé.
 */

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

const ACTIONS = "src/server/actions/optimized-guide-actions.ts";
const HOOK = "src/hooks/use-rush-dungeon-states.ts";
const OVERLAY = "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx";
const DASH = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";

describe("Sentry Rush — lot A", () => {
    it("la PiP publique désactive le chargement des donjons membres", () => {
        expect(read(HOOK)).toContain("enabled = true");
        expect(read(HOOK)).toContain("if (!enabled) return;");
        expect(read(OVERLAY)).toContain("enabled: !isGuest");
    });

    it("un rate limit retourne un résultat, jamais une exception", () => {
        const actions = read(ACTIONS);
        expect(actions).toContain("RATE_LIMIT_RESULT");
        expect(actions).not.toMatch(/if \(!rateOk\) throw/);
        const returns = actions.match(/if \(!rateOk\) return RATE_LIMIT_RESULT;/g) ?? [];
        expect(returns.length).toBeGreaterThanOrEqual(10);
    });

    it("les resets du dashboard et de l'overlay lisent le résultat", () => {
        expect(read(DASH)).toContain("if(!res.success)");
        expect(read(OVERLAY)).toContain(
            'toast.error("error" in res ? res.error : "Erreur de réinitialisation")'
        );
    });

    it("la coche des donjons d'un bloc est un lot, pas un upsert par donjon", () => {
        const actions = read(ACTIONS);
        const start = actions.indexOf("async function applyDungeonChecks");
        const end = actions.indexOf("/** Retire les prérequis", start);
        expect(start).toBeGreaterThan(-1);
        const body = actions.slice(start, end > start ? end : start + 2000);
        expect(body).toContain("createMany");
        expect(body).toContain("updateMany");
        expect(body).not.toContain(".upsert(");
    });
});

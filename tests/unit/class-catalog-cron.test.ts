import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const CRON = "src/app/api/cron/class-watch/route.ts";
const CORE = "src/lib/class-catalog-siphon.ts";
const PURE = "src/lib/class-catalog.ts";
const OPS = "scripts/ops/vps.sh";
const COMPOSE = "docker-compose.prod.yml";
const VPS_DOC = "docs/agents/vps-ops.md";
const MAINTENANCE = "docs/MAINTENANCE.md";

const read = (path: string) => readFileSync(path, "utf8");

describe("veille des classes — cron et reprise", () => {
    it("le cron est protégé par le secret et journalise sous class_watch", () => {
        const code = read(CRON);
        expect(code).toContain("verifyCronSecret(req)");
        expect(code).toContain("syncClassCatalogCore({ apply: true, downloadIcons: true })");
        expect(code).toContain('recordCronExecution("class_watch"');
        expect(code).toContain('enqueueGameDataSync("CLASS_SPELLS"');
        expect(code).toContain("classIds");
        expect(code).toContain("source");
    });

    it("une file occupée ne perd pas le rafraîchissement : fichier pending + reprise", () => {
        const code = read(CRON);
        expect(code).toContain("readPendingClassSpellRefresh");
        expect(code).toContain("mergePendingClassSpellRefresh");
        expect(code).toContain("writePendingClassSpellRefresh");
        expect(code).toContain("stillPending");
        const core = read(CORE);
        expect(core).toContain("CLASS_SPELL_REFRESH_PENDING_PATH");
        expect(core).toContain("mergePendingClassSpellRefresh");
    });

    it("aucune suppression automatique : le core ne supprime ni classe ni manifeste", () => {
        const core = read(CORE);
        expect(core).not.toContain("unlinkSync(CLASS_CATALOG_PATH");
        expect(core).not.toContain("rmSync(CLASS_CATALOG_PATH");
        expect(core).toContain("writeClassCatalogManifest");
        // Le retrait est un état, pas un DELETE.
        const pure = read(PURE);
        expect(pure).toContain('status: ClassLifecycle = prod ? "live" : beta ? "preview" : "retired"');
        expect(pure).toContain('changeType: "REMOVED"');
    });

    it("la prod est obligatoire, la bêta est optionnelle", () => {
        const core = read(CORE);
        expect(core).toContain('fetchBreeds("prod")');
        expect(core).toContain('fetchBreeds("beta")');
        expect(core).toContain("Prod injoignable");
        expect(core).toContain("bêta indisponible");
    });

    it("le runbook VPS et le crontab documentent la veille sur les deux environnements", () => {
        expect(read(OPS)).toContain("class-watch");
        expect(read(OPS)).toContain("CLASS_OPS_SCRIPT");
        expect(read(COMPOSE)).toMatch(/ops-beta:[\s\S]*assets-beta-data/);
        expect(read(COMPOSE)).toMatch(/ops-prod:[\s\S]*assets-prod-data/);
        expect(read(VPS_DOC)).toContain("class-watch");
        expect(read(MAINTENANCE)).toContain("class-watch");
        expect(read(MAINTENANCE)).toContain("$APP_URL_BETA");
        expect(read(MAINTENANCE)).toContain("$APP_URL_PROD");
    });
});

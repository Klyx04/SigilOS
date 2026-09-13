/**
 * Module « Marché » — test du **tour** (S8.22 / D36 / §19.1).
 *
 * Un tour n'est utile que si ses étapes pointent des **ancres réelles** : ce
 * test lit donc la source du provider et vérifie que **chaque** `target`
 * `marche-*` correspond à un `data-tour` effectivement posé dans les écrans du
 * module. Une ancre renommée sans mise à jour du tour casse le test (au lieu de
 * faire silencieusement disparaître une étape en production).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const TOUR_PROVIDER = "src/components/tour/tour-provider.tsx";
const MARCHE_SCREENS_DIR = join("src", "app", "dashboard", "[guildId]", "marche");
const APP_SIDEBAR = "src/components/layout/app-sidebar.tsx";

function readTourProvider(): string {
    return readFileSync(TOUR_PROVIDER, "utf8");
}

/** Bloc source de `MARCHE_STEPS` (borné par le tableau `];`). */
function marcheStepsSource(): string {
    const source = readTourProvider();
    const start = source.indexOf("const MARCHE_STEPS: TourStep[] = [");
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf("\n];", start);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end);
}

/** Liste récursive des fichiers `.tsx`/`.ts` d'un dossier. */
function listFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) out.push(...listFiles(full));
        else if (/\.tsx?$/.test(entry)) out.push(full);
    }
    return out;
}

/** Toutes les ancres `data-tour="..."` réellement posées dans les écrans marché. */
function anchorsInMarcheScreens(): Set<string> {
    const anchors = new Set<string>();
    for (const file of listFiles(MARCHE_SCREENS_DIR)) {
        const content = readFileSync(file, "utf8");
        for (const match of content.matchAll(/data-tour=["']([a-z-]+)["']/g)) {
            anchors.add(match[1]);
        }
    }
    return anchors;
}

describe("market tour — ancres réellement présentes (S8.22)", () => {
    it("déclare le module « marche » dans les phases rejouables", () => {
        const source = readTourProvider();
        const phases = source.slice(source.indexOf("export const MODULE_TOUR_PHASES"), source.indexOf("] as const;"));
        expect(phases).toContain('"marche"');
    });

    it("chaque étape `marche-*` pointe une ancre posée dans les écrans du module", () => {
        const anchors = anchorsInMarcheScreens();
        const targets = [...marcheStepsSource().matchAll(/target: '\[data-tour="([^"]+)"\]'/g)].map((m) => m[1]);

        expect(targets.length).toBeGreaterThanOrEqual(10);

        const marcheTargets = targets.filter((target) => target.startsWith("marche-"));
        expect(marcheTargets.length).toBeGreaterThanOrEqual(9);

        for (const target of marcheTargets) {
            expect(anchors.has(target), `ancre manquante : ${target}`).toBe(true);
        }
    });

    it("couvre la forge réelle, la négociation, la modération et « Mon espace »", () => {
        const source = marcheStepsSource();
        for (const anchor of [
            "marche-header",
            "marche-catalog",
            "marche-filters",
            "marche-create",
            "marche-jet",
            "marche-forge",
            "marche-publish",
            "marche-listing",
            "marche-negotiation",
            "marche-moderation",
            "marche-my-listings",
        ]) {
            expect(source, `étape absente : ${anchor}`).toContain(`[data-tour="${anchor}"]`);
        }
    });

    it("ancre le retour sidebar sur le vrai `tourKey` du module", () => {
        expect(marcheStepsSource()).toContain('[data-tour="sidebar-marche"]');
        // `data-tour="sidebar-marche"` est rendu par `tourKey: "marche"` (app-sidebar).
        expect(readFileSync(APP_SIDEBAR, "utf8")).toContain('tourKey: "marche"');
    });

    it("n'a ni doublon de cible, ni étape sans module/permission", () => {
        const source = marcheStepsSource();
        const targets = [...source.matchAll(/target: '\[data-tour="([^"]+)"\]'/g)].map((m) => m[1]);

        expect(new Set(targets).size).toBe(targets.length);

        const blocks = source.split("target: '").slice(1);
        for (const block of blocks) {
            expect(block).toContain('module: "marche"');
            expect(block).toMatch(/requiresPerm: "(canViewMarket|canManageMarket)"/);
            expect(block).not.toMatch(/\d{15,}/); // aucun snowflake dans une étape
        }
    });
});

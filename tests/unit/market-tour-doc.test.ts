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

/**
 * BUG-6 (constat beta) — « le texte est mangé à droite dans la bulle » et
 * « l'étape de l'éditeur de jet coupe le tutoriel, idem pour la suite ».
 *
 * Deux causes, deux verrous :
 *   1. la bulle était positionnée avec une taille **codée en dur** (320 × 180)
 *      alors qu'elle est `max-w-[320px] sm:max-w-[340px]` ⇒ on mesure sa taille
 *      réelle et on la recadre dans la fenêtre ;
 *   2. les étapes `marche-jet` / `marche-forge` / `marche-publish` /
 *      `marche-negotiation` / `marche-my-listings` pointent des ancres qui vivent
 *      sur **d'autres pages** : l'overlay sautait l'étape (tutoriel « coupé ») ⇒
 *      l'étape déclare un `href` **relatif** et le provider navigue, avec une
 *      allowlist stricte (jamais de redirection ouverte).
 */
describe("BUG-6 — tutoriel lisible et continu", () => {
    const TOUR_OVERLAY = "src/components/tour/tour-overlay.tsx";

    function overlaySource(): string {
        return readFileSync(TOUR_OVERLAY, "utf8");
    }

    it("mesure la bulle au lieu d'une taille codée en dur", () => {
        const overlay = overlaySource();
        expect(overlay).toMatch(/tooltipSize/);
        expect(overlay).toMatch(/new ResizeObserver/);
        expect(overlay).not.toMatch(/const tooltipWidth = 320/);
        expect(overlay).not.toMatch(/const tooltipHeight = 180/);
        // Recadrage : largeur maximale bornée par le design (`max-w-[320px]
        // sm:max-w-[340px]`) **et** par la fenêtre + texte qui respire.
        // BUG-7 : le `maxWidth` inline, sans plafond de design, écrasait les
        // classes CSS et la bulle s'étalait sur toute la largeur de la fenêtre.
        expect(overlay).toMatch(/const designMaxWidth = windowSize\.width >= 640 \? 340 : 320/);
        expect(overlay).toMatch(/const maxWidth = Math\.max\(240, Math\.min\(designMaxWidth, windowSize\.width - margin \* 2\)\)/);
        expect(overlay).toMatch(/maxWidth,/);
        expect(overlay).toMatch(/break-words/);
    });

    it("navigue vers la page de l'étape au lieu de la sauter (une seule fois par destination)", () => {
        const overlay = overlaySource();
        expect(overlay).toMatch(/requestStepNavigation\(activeStepData\.href\)/);
        expect(overlay).toMatch(/navigatedHrefRef/);
        // Le saut anti-centrage reste, mais **après** la tentative de navigation.
        const navigateIndex = overlay.indexOf("requestStepNavigation(activeStepData.href)");
        const skipIndex = overlay.indexOf("attempts > 120 && !settled");
        expect(navigateIndex).toBeGreaterThan(-1);
        expect(skipIndex).toBeGreaterThan(navigateIndex);
    });

    it("les étapes hors page déclarent un `href` relatif, jamais une URL", () => {
        const source = marcheStepsSource();
        const hrefs = [...source.matchAll(/href: "([^"]+)"/g)].map((m) => m[1]);

        expect(hrefs.length).toBeGreaterThanOrEqual(5);
        for (const href of hrefs) {
            expect(href.startsWith("/"), href).toBe(true);
            expect(href).not.toContain("http");
            expect(href).not.toContain("//");
            expect(href).not.toContain("..");
        }
        expect(hrefs).toContain("/marche/nouveau");
        expect(hrefs).toContain("/marche/mes-espaces");
    });

    it("le provider valide le préfixe avant de naviguer (allowlist)", () => {
        const provider = readTourProvider();
        const start = provider.indexOf("const requestStepNavigation = useCallback(");
        expect(start).toBeGreaterThan(-1);
        const body = provider.slice(start, provider.indexOf(");", start));

        expect(body).toMatch(/startsWith\("\/"\)/);
        expect(body).toMatch(/startsWith\("\/\/"\)/);
        expect(body).toMatch(/includes\("\.\."\)/);
        expect(body).toMatch(/includes\(":"\)/);
        expect(body).toMatch(/\^\\\/\[A-Za-z0-9\/_-\]\*\$|\^\/\[A-Za-z0-9\/_-\]\*\$/);
        expect(body).toContain("`/dashboard/${guildId}${relativeHref}`");
    });
});

/**
 * Tours PUBLICS — verrou de comportement (pas de rendu).
 *
 * Ce que ce fichier protège :
 *  1. la visite du guide Rush est **différente** pour un connecté et un anonyme :
 *     les étapes du compte (Metamob, Rush Live) n'apparaissent jamais sans compte,
 *     l'invitation au profil n'apparaît jamais avec un compte ;
 *  2. chaque cible `data-tour` existe **réellement** dans la surface qu'elle vise
 *     (aucun pointeur mort, leçon du `admin-members-tools` fantôme) ;
 *  3. la visite de l'espace visiteur ne s'ouvre **qu'une fois** par navigateur et
 *     se rejoue uniquement sur demande (`?tour=1`) ;
 *  4. les deux phases sont **rejouables** et **fermables** (Passer / Échap) ;
 *  5. les deux surfaces montent bien le même moteur (`TourProvider` + `TourOverlay`).
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
    buildRushPublicSteps,
    buildVisitorSpaceSteps,
    filterPublicTourSteps,
    shouldAutoStartVisitorTour,
    VISITOR_TOUR_QUERY_VALUE,
    VISITOR_TOUR_STORAGE_KEY,
} from "@/lib/public-tour";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const RUSH_CLIENT = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";
const VISITOR_NAV = "src/app/espace-visiteur/_components/visitor-nav.tsx";
const VISITOR_GENERAL = "src/app/espace-visiteur/general/page.tsx";
const VISITOR_LAYOUT = "src/app/espace-visiteur/layout.tsx";
const VISITOR_SETTINGS = "src/app/espace-visiteur/reglages/page.tsx";
const VISITOR_LAUNCHER = "src/app/espace-visiteur/_components/visitor-tour-launcher.tsx";
const RUSH_PAGE = "src/app/guides/rush-sylvestre/page.tsx";
const PROVIDER = "src/components/tour/tour-provider.tsx";
const OVERLAY = "src/components/tour/tour-overlay.tsx";

const TARGET_PATTERN = /^\[data-tour="[a-z0-9-]+"\]$/;

describe("Visite du guide Rush — connecté vs anonyme", () => {
    const anonymous = buildRushPublicSteps({ connected: false });
    const visitor = buildRushPublicSteps({ connected: true });

    it("partage le même tronc commun, dans le même ordre", () => {
        const core = (steps: ReturnType<typeof buildRushPublicSteps>) =>
            steps
                .map((step) => step.target)
                .filter((target) => !target.includes("metamob") && !target.includes("rush-live") && !target.includes("cta"));

        expect(core(anonymous)).toEqual(core(visitor));
        expect(core(anonymous).length).toBeGreaterThanOrEqual(10);
    });

    it("n'affiche jamais les briques du compte à un anonyme", () => {
        expect(anonymous.some((step) => step.target.includes("metamob"))).toBe(false);
        expect(anonymous.some((step) => step.target.includes("rush-live"))).toBe(false);
        expect(visitor.some((step) => step.target.includes("metamob"))).toBe(true);
        expect(visitor.some((step) => step.target.includes("rush-live"))).toBe(true);
    });

    it("insère les briques du compte après l'alignement, avant l'overlay", () => {
        const index = (needle: string) => visitor.findIndex((step) => step.target.includes(needle));
        expect(index("metamob")).toBeGreaterThan(index("alignment"));
        expect(index("rush-live")).toBeGreaterThan(index("metamob"));
        expect(index("rush-live")).toBeLessThan(index("overlay"));
    });

    it("termine l'anonyme par l'invitation au profil, jamais un connecté", () => {
        expect(anonymous.at(-1)?.target).toContain("rush-public-cta");
        expect(visitor.some((step) => step.target.includes("rush-public-cta"))).toBe(false);
    });

    it("donne un texte propre à chaque audience (pas de texte « visiteur » chez l'anonyme)", () => {
        const characterAnonymous = anonymous.find((step) => step.target.includes("rush-public-character"));
        const characterVisitor = visitor.find((step) => step.target.includes("rush-public-character"));
        expect(characterAnonymous?.description).toContain("navigateur");
        expect(characterVisitor?.description).toContain("compte");
    });
});

describe("Filtre d'audience et drapeau de première arrivée", () => {
    const steps = [
        { target: '[data-tour="a"]', title: "A", description: "A", placement: "bottom" as const },
        { target: '[data-tour="b"]', title: "B", description: "B", placement: "bottom" as const, audience: "visitor" as const },
        { target: '[data-tour="c"]', title: "C", description: "C", placement: "bottom" as const, audience: "anonymous" as const },
    ];

    it("garde le tronc et filtre les deux audiences", () => {
        expect(filterPublicTourSteps(steps, { connected: true }).map((step) => step.target)).toEqual([
            '[data-tour="a"]',
            '[data-tour="b"]',
        ]);
        expect(filterPublicTourSteps(steps, { connected: false }).map((step) => step.target)).toEqual([
            '[data-tour="a"]',
            '[data-tour="c"]',
        ]);
    });

    it("s'ouvre une seule fois par navigateur", () => {
        expect(shouldAutoStartVisitorTour(null, null)).toBe(true);
        expect(shouldAutoStartVisitorTour("0", null)).toBe(true);
        expect(shouldAutoStartVisitorTour("1", null)).toBe(false);
    });

    it("se rejoue uniquement sur demande explicite", () => {
        expect(shouldAutoStartVisitorTour("1", VISITOR_TOUR_QUERY_VALUE)).toBe(true);
        expect(shouldAutoStartVisitorTour(null, null)).toBe(true);
        expect(VISITOR_TOUR_STORAGE_KEY).toBe("sigilos:visitor-tour-seen");
    });
});

describe("Visite de l'espace visiteur", () => {
    const steps = buildVisitorSpaceSteps();

    it("couvre la navigation et les panneaux de la page Général", () => {
        expect(steps.length).toBeGreaterThanOrEqual(11);
        const targets = steps.map((step) => step.target);
        for (const anchor of ["visitor-nav", "visitor-nav-general", "visitor-nav-settings", "visitor-identity", "visitor-metamob"]) {
            expect(targets).toContain(`[data-tour="${anchor}"]`);
        }
    });

    it("n'a aucun doublon et reste sur une page (aucune cible conditionnelle)", () => {
        const targets = steps.map((step) => step.target);
        expect(new Set(targets).size).toBe(targets.length);
        expect(targets.some((target) => target.includes("visitor-ocre"))).toBe(false);
    });

    it("décrit chaque onglet de la nav, sans en oublier un", () => {
        const nav = read(VISITOR_NAV);
        const segments = [...nav.matchAll(/tour: "(visitor-nav-[a-z-]+)"/g)].map((match) => match[1]);
        expect(segments.length).toBe(8);
        for (const segment of segments) {
            expect(steps.map((step) => step.target)).toContain(`[data-tour="${segment}"]`);
        }
    });
});

describe("Ancres réelles — aucun pointeur mort", () => {
    it("chaque cible est un sélecteur `data-tour` simple et unique", () => {
        for (const steps of [buildRushPublicSteps({ connected: true }), buildRushPublicSteps({ connected: false }), buildVisitorSpaceSteps()]) {
            const targets = steps.map((step) => step.target);
            expect(new Set(targets).size).toBe(targets.length);
            for (const target of targets) {
                expect(target).toMatch(TARGET_PATTERN);
                expect(target).not.toMatch(/\d{15,}/); // aucun snowflake dans une étape
            }
        }
    });

    it("chaque cible du guide Rush existe dans le client public", () => {
        const source = read(RUSH_CLIENT);
        for (const step of buildRushPublicSteps({ connected: true })) {
            const anchor = step.target.match(/data-tour="([a-z0-9-]+)"/)?.[1];
            expect(anchor).toBeTruthy();
            expect(source, `ancre absente du guide : ${anchor}`).toContain(`data-tour="${anchor}"`);
        }
    });

    it("chaque cible de l'espace visiteur existe dans la nav ou la page Général", () => {
        const nav = read(VISITOR_NAV);
        const general = read(VISITOR_GENERAL);
        for (const step of buildVisitorSpaceSteps()) {
            const anchor = step.target.match(/data-tour="([a-z0-9-]+)"/)?.[1] ?? "";
            const present = anchor.startsWith("visitor-nav-")
                ? nav.includes(`"${anchor}"`)
                : nav.includes(`data-tour="${anchor}"`) || general.includes(`data-tour="${anchor}"`);
            expect(present, `ancre absente de l'espace visiteur : ${anchor}`).toBe(true);
        }
    });
});

describe("Moteur unique, rejouable et fermable", () => {
    it("les deux phases publiques sont rejouables", () => {
        const provider = read(PROVIDER);
        const phases = provider.slice(
            provider.indexOf("export const MODULE_TOUR_PHASES"),
            provider.indexOf("] as const;")
        );
        expect(phases).toContain('"rushPublic"');
        expect(phases).toContain('"visitorSpace"');
        expect(provider).toContain('const storageScope = guildId ?? "public";');
    });

    it("le guide Rush et l'espace visiteur montent le même provider", () => {
        expect(read(RUSH_PAGE)).toMatch(/<TourProvider[\s\S]{0,160}scope="public"/);
        expect(read(RUSH_PAGE)).toMatch(/visitorConnected=\{!!session\?\.user\}/);
        expect(read(VISITOR_LAYOUT)).toMatch(/<TourProvider scope="public" visitorConnected>/);
        expect(read(VISITOR_LAYOUT)).toContain("<TourOverlay />");
        expect(read(RUSH_CLIENT)).toContain("<TourOverlay />");
    });

    it("les deux surfaces offrent un bouton de rejeu", () => {
        expect(read(RUSH_CLIENT)).toContain('startTour("rushPublic")');
        expect(read(VISITOR_SETTINGS)).toContain('href="/espace-visiteur/general?tour=1"');
        expect(read(VISITOR_LAUNCHER)).toContain('startTour("visitorSpace")');
    });

    it("la visite de première arrivée ne se relance pas au rechargement", () => {
        const launcher = read(VISITOR_LAUNCHER);
        expect(launcher).toContain("window.localStorage.setItem(VISITOR_TOUR_STORAGE_KEY, \"1\")");
        expect(launcher).toContain("window.history.replaceState");
        expect(launcher).toContain("shouldAutoStartVisitorTour");
    });

    it("reste fermable : « Passer » et Échap sont dans la bulle partagée", () => {
        const overlay = read(OVERLAY);
        expect(overlay).toContain('aria-label="Passer le tutoriel"');
        expect(overlay).toContain('event.key !== "Escape"');
    });
});

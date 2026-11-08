/**
 * Profil dashboard — **six onglets pour treize sections** (lot P3).
 *
 * Ce que ces cas protègent, dans l'ordre du risque :
 *   ① une section perdue en route (13 clés → un groupe qui n'en porte que 12) ;
 *   ② un lien périmé (`?tab=metiers`) qui n'atterrit plus nulle part ;
 *   ③ une étape de tutoriel qui vise un `data-tour` qui n'existe plus — le spotlight encadre
 *      du vide et le membre est bloqué (défaut déjà payé sur « Tes préférences ») ;
 *   ④ un retour en arrière silencieux vers treize `<TabsContent>`.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
    DEFAULT_PROFILE_TAB,
    PROFILE_TABS,
    RETIRED_SECTIONS,
    isProfileGroupEmpty,
    isProfileTabId,
    profileGroupOf,
    resolveProfileTab,
} from "@/lib/profile-tabs";

const BENTO = "src/components/profile/profile-bento-grid.tsx";
const TOUR = "src/components/tour/tour-provider.tsx";

/** Sections encore affichées, groupe par groupe (douze). `activity` est retirée (cf. plus bas). */
const SECTIONS = [
    "overview", "intro", "achievements",
    "combat", "skins",
    "dofus",
    "mules", "metiers", "artisanat",
    "planning", "services",
    "settings",
] as const;

describe("profil — la table des onglets", () => {
    it("porte exactement huit groupes et les douze sections affichées, sans doublon", () => {
        expect(PROFILE_TABS).toHaveLength(8);
        const sections = PROFILE_TABS.flatMap((tab) => [...tab.members]);
        expect(sections.slice().sort()).toEqual([...SECTIONS].sort());
        expect(new Set(sections).size).toBe(sections.length);
    });

    it("chaque groupe est joignable depuis chacune de ses sections", () => {
        for (const tab of PROFILE_TABS) {
            expect(isProfileTabId(tab.id)).toBe(true);
            for (const section of tab.members) {
                expect(profileGroupOf(section), section).toBe(tab.id);
            }
        }
    });
});

describe("profil — résolution d'un onglet venu de l'extérieur", () => {
    it("une clé de groupe reste elle-même (idempotence)", () => {
        for (const tab of PROFILE_TABS) {
            expect(resolveProfileTab(tab.id)).toBe(tab.id);
        }
    });

    it("chaque ancienne clé atterrit dans son groupe", () => {
        const expected: Record<string, string> = {
            overview: "synthese", intro: "presentation", achievements: "synthese",
            combat: "equipement", skins: "skins",
            dofus: "dofusdex",
            mules: "personnages", metiers: "personnages", artisanat: "personnages",
            planning: "planning", services: "planning",
            settings: "reglages",
        };
        for (const [section, group] of Object.entries(expected)) {
            expect(resolveProfileTab(section), section).toBe(group);
        }
    });

    it("une section retirée garde une destination (activity → synthese)", () => {
        expect(RETIRED_SECTIONS.activity).toBe("synthese");
        expect(resolveProfileTab("activity")).toBe("synthese");
    });

    it("une clé inconnue ou absente retombe sur Synthèse (jamais un onglet fantôme)", () => {
        expect(resolveProfileTab("artisanat-legendaire")).toBe(DEFAULT_PROFILE_TAB);
        expect(resolveProfileTab("")).toBe(DEFAULT_PROFILE_TAB);
        expect(resolveProfileTab(null)).toBe(DEFAULT_PROFILE_TAB);
        expect(resolveProfileTab(undefined)).toBe(DEFAULT_PROFILE_TAB);
        expect(profileGroupOf("inconnu")).toBeNull();
    });
});

describe("profil — un groupe vide disparaît", () => {
    it("vide seulement quand toutes ses sections le sont", () => {
        expect(isProfileGroupEmpty("personnages", { mules: true, metiers: true, artisanat: true })).toBe(true);
        expect(isProfileGroupEmpty("personnages", { mules: true, metiers: false, artisanat: true })).toBe(false);
    });

    it("une section absente de la table est pleine (on ne cache pas par omission)", () => {
        expect(isProfileGroupEmpty("planning", { planning: true })).toBe(false);
    });
});

describe("profil — le regroupement est réellement appliqué", () => {
    it("chaque `<TabsContent>` porte une clé de groupe (aucune ancienne section)", () => {
        // `planning` est à la fois une ancienne section et un groupe : on ne teste donc pas
        // l'absence des treize noms (faux positif garanti) mais **l'appartenance** des valeurs.
        const bento = readFileSync(BENTO, "utf8");
        const values = [...bento.matchAll(/TabsContent value="([a-z]+)"/g)].map((match) => match[1]);
        expect(values).toHaveLength(SECTIONS.length);
        for (const value of values) {
            expect(isProfileTabId(value), `TabsContent value="${value}" : onglet inconnu`).toBe(true);
        }
    });

    it("le panneau « Activité & Présence » n'est plus monté (remplacé par Points de Succès)", () => {
        const bento = readFileSync(BENTO, "utf8");
        expect(bento).not.toContain("ProfileActivityTab");
        expect(bento).toContain("<SuccessSync");
    });

    it("les deux sections du groupe « Planning & services » restent gardées dans le contenu", () => {
        // Le groupe peut s'ouvrir pour Services seul : la permission ne peut plus être portée par
        // l'onglet. Sans ces deux gardes, `canViewAvailability` fuyait par le regroupement.
        const bento = readFileSync(BENTO, "utf8");
        expect(bento).toContain('canViewPlanning && visitedTabs.has("planning")');
        expect(bento).toContain('hasServices && visitedTabs.has("planning")');
    });

    it("chaque étape de tutoriel vise un onglet qui existe", () => {
        // Défaut déjà payé : une étape qui vise un `data-tour` absent encadre du vide.
        const tour = readFileSync(TOUR, "utf8");
        const targets = [...tour.matchAll(/profile-tab-([a-z]+)/g)].map((match) => match[1]);
        expect(targets.length).toBeGreaterThan(0);
        for (const target of targets) {
            expect(isProfileTabId(target), `étape « profile-tab-${target} » : onglet inconnu`).toBe(true);
        }
    });
});

/**
 * Page perso visiteur + fiche publique en lecture seule (refonte du 16/11/2026).
 *
 * 🔒 Ce que ces verrous tiennent : le hero personnel garde les ancres du tour
 * (`visitor-identity`, `visitor-metamob`), les compteurs restent **réels** (distincts par
 * succès/avis, tous personnages), la fiche expose « Avis faits » et les sections lisibles,
 * et aucun écran ne réintroduit une palette en dur.
 */
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fr } from "@/lib/i18n/locales/fr";
import type { VisitorProfile } from "@/lib/public-directory";
import { VisitorProfileCard } from "@/app/visiteurs/_components/visitor-profile-card";

const read = (path: string) => readFileSync(path, "utf8");
const GENERAL = "src/app/espace-visiteur/general/page.tsx";
const CARD = "src/app/visiteurs/_components/visitor-profile-card.tsx";

const PROFILE: VisitorProfile = {
    id: "clx1234567890abcdefghij",
    pseudo: "Rakzia",
    classe: {
        id: "eliotrope",
        name: "Eliotrope",
        icon: "/assets/dofus/classes/eliotrope.png",
    },
    server: {
        id: 295,
        name: "Draconiros",
        icon: "/assets/dofus/servers/draconiros.webp",
    },
    guildName: "Stellium",
    level: 195,
    successPoints: 22_791,
    jobs: [
        {
            id: "forgeron",
            name: "Forgeron",
            icon: "/assets/dofus/jobs/forgeron.png",
            level: 200,
        },
    ],
    achievements: 567,
    bountiesDone: 12,
    introduction: "Chasseuse de primes.",
    objectifs: "Finir les avis.",
    updatedAt: new Date("2026-11-16T10:00:00Z"),
    mules: [
        {
            pseudo: "Rakzia-Mule",
            classe: {
                id: "iop",
                name: "Iop",
                icon: "/assets/dofus/classes/iop.png",
            },
            level: 200,
        },
    ],
    activities: [
        {
            id: "pvm",
            label: "PVM",
            icon: "/assets/dofus/icons/crossedSwords.png",
        },
    ],
    achievementList: [
        {
            id: "ach-1",
            name: "Sans peur",
            points: 30,
            iconUrl: null,
            dungeonName: "Donjon des Tofus",
            characterSlot: "PRINCIPAL",
        },
    ],
    bountyList: [
        {
            id: "bounty-1",
            name: "Ronce",
            level: 60,
            zoneName: "Amakna",
            imageUrl: null,
            characterSlot: "Rakzia-Mule",
        },
    ],
    rush: [
        {
            characterSlot: "PRINCIPAL",
            characterName: "Rakzia",
            classe: {
                id: "eliotrope",
                name: "Eliotrope",
                icon: "/assets/dofus/classes/eliotrope.png",
            },
            completedMilestones: 12,
            completedSteps: 34,
            dungeonChecks: 5,
            currentStep: null,
            updatedAt: new Date("2026-11-16T10:00:00Z"),
        },
    ],
    metamob: {
        pseudo: "Rakzia",
        url: "https://www.metamob.fr/profile/Rakzia",
    },
};

describe("page perso visiteur — hero et compteurs réels", () => {
    it("garde les ancres du tour et les formulaires existants", () => {
        const code = read(GENERAL);
        expect(code).toContain('data-tour="visitor-identity"');
        expect(code).toContain('data-tour="visitor-metamob"');
        expect(code).toContain("<IdentityForm");
        expect(code).toContain("<MetamobForm");
    });

    it("compte les succès et avis distincts, tous personnages", () => {
        const code = read(GENERAL);
        expect(code).toContain("publicDungeonAchievement.findMany");
        expect(code).toContain("publicBountyCompletion.findMany");
        expect(code).toContain('distinct: ["dungeonAchievementId"]');
        expect(code).toContain('distinct: ["bountyId"]');
        expect(code).toContain("showOnDirectory");
        expect(code).toContain("showPresence");
        expect(code).toContain("showRushProgress");
    });

    it("reste sur les tokens de la DA (aucune palette en dur)", () => {
        expect(read(GENERAL)).not.toMatch(/(text|bg|border)-(emerald|amber|zinc|indigo)-/);
        expect(read(CARD)).not.toMatch(/(text|bg|border)-(emerald|amber|zinc|indigo)-/);
    });
});

describe("fiche lecture seule — avis faits et sections lisibles", () => {
    it("rend le hero, les quatre chiffres et les métiers", () => {
        const html = renderToStaticMarkup(
            React.createElement(VisitorProfileCard, {
                profile: PROFILE,
                labels: fr.visitorsPage,
                locale: "fr",
            })
        );
        expect(html).toContain("Profil public");
        expect(html).toContain("Rakzia");
        expect(html).toContain(fr.visitorsPage.profile.bounties);
        expect(html).toContain("12");
        expect(html).toContain("Forgeron");
        expect(html).toContain("Chasseuse de primes.");
    });

    it("rend les sections V5 bis : personnages, activités, succès, avis, Rush, Metamob", () => {
        const html = renderToStaticMarkup(
            React.createElement(VisitorProfileCard, {
                profile: PROFILE,
                labels: fr.visitorsPage,
                locale: "fr",
            })
        );
        expect(html).toContain(fr.visitorsPage.profile.characters);
        expect(html).toContain("Rakzia-Mule");
        expect(html).toContain(fr.visitorsPage.profile.activities);
        expect(html).toContain("PVM");
        expect(html).toContain(fr.visitorsPage.profile.achievements);
        expect(html).toContain("Sans peur");
        expect(html).toContain(fr.visitorsPage.profile.bountiesSection);
        expect(html).toContain("Ronce");
        expect(html).toContain(fr.visitorsPage.profile.rush);
        expect(html).toContain(fr.visitorsPage.profile.metamob);
        expect(html).toContain("https://www.metamob.fr/profile/Rakzia");
    });

    it("propose des filtres sur les listes de succès, d'avis et de métiers", () => {
        const html = renderToStaticMarkup(
            React.createElement(VisitorProfileCard, {
                profile: PROFILE,
                labels: fr.visitorsPage,
                locale: "fr",
            })
        );
        expect(html).toContain(fr.visitorsPage.profile.filterSearchAchievements);
        expect(html).toContain(fr.visitorsPage.profile.filterSearchBounties);
        expect(html).toContain(fr.visitorsPage.profile.filterSearchJobs);
        expect(html).toContain(fr.visitorsPage.profile.filterCharacter);
    });

    it("respecte les consentements : Rush masqué et Metamob absent", () => {
        const html = renderToStaticMarkup(
            React.createElement(VisitorProfileCard, {
                profile: { ...PROFILE, rush: null, metamob: null },
                labels: fr.visitorsPage,
                locale: "fr",
            })
        );
        expect(html).toContain("La progression Rush");
        expect(html).not.toContain("https://www.metamob.fr/profile/Rakzia");
    });
});

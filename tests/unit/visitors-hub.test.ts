/**
 * Hub « Communauté SigilOS » — verrou des **règles pures** et du **périmètre serveur**.
 *
 * Deux familles d'assertions :
 *  1. comportement : les paramètres d'URL sont bornés, la bascule profils/succès garde des
 *     liens propres, et le tableau « qui a validé quoi » partitionne exactement les profils
 *     consentants (une coche hors périmètre est écartée, pas affichée) ;
 *  2. source : chaque requête des succès en commun porte `showOnDirectory` **et** le serveur
 *     du lecteur, et ne lit aucune donnée de guilde ni aucun champ privé.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fr } from "@/lib/i18n/locales/fr";
import { VisitorsHubNav } from "@/app/visiteurs/_components/visitors-hub-nav";
import { SharedSuccesView } from "@/app/visiteurs/_components/shared-succes-view";
import {
    SHARED_SUCCES_MEMBERS_SHOWN,
    SHARED_SUCCES_SEARCH_MAX,
    SHARED_SUCCES_VISITORS_TAKE,
    buildSharedBountyBoard,
    buildSharedSuccesBoard,
    buildVisitorsHubHref,
    parseVisitorsHubSearch,
    type SharedSuccesMember,
} from "@/lib/visitors-hub";

const read = (path: string) => readFileSync(path, "utf8");
const stripComments = (code: string) =>
    code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const SERVER = "src/server/public-succes-communs.ts";
const LIST_PAGE = "src/app/visiteurs/page.tsx";
const PROFILE_PAGE = "src/app/visiteurs/[id]/page.tsx";
const NAV = "src/app/espace-visiteur/_components/visitor-nav.tsx";

const MEMBERS: SharedSuccesMember[] = [
    { id: "p1", pseudo: "Zoé", classe: "iop" },
    { id: "p2", pseudo: "Alice", classe: "feca" },
    { id: "p3", pseudo: null, classe: null },
];

describe("Recherche du hub — bornée, jamais bloquante", () => {
    it("retombe sur les profils quand la vue est absente ou inconnue", () => {
        expect(parseVisitorsHubSearch(undefined)).toEqual({
            vue: "profils",
            donjon: null,
            bounty: null,
            q: "",
            type: null,
            liste: null,
        });
        expect(parseVisitorsHubSearch({ vue: "wow" }).vue).toBe("profils");
    });

    it("ne garde le donjon et la recherche que dans la vue succès", () => {
        expect(parseVisitorsHubSearch({ donjon: "tournesol-affame", q: "tour" })).toEqual({
            vue: "profils",
            donjon: null,
            bounty: null,
            q: "",
            type: null,
            liste: null,
        });
        expect(
            parseVisitorsHubSearch({ vue: "succes", donjon: "tournesol-affame", q: "  tour  " })
        ).toEqual({
            vue: "succes",
            donjon: "tournesol-affame",
            bounty: null,
            q: "tour",
            type: null,
            liste: "donjons",
        });
        expect(
            parseVisitorsHubSearch({ vue: "echanges", donjon: "tournesol-affame", q: "tour" })
        ).toEqual({ vue: "echanges", donjon: null, bounty: null, q: "", type: null, liste: null });
    });

    it("lit l'avis sélectionné dans la vue succès, et rien ailleurs", () => {
        expect(
            parseVisitorsHubSearch({ vue: "succes", avis: "ronce-123", q: "  ronce " })
        ).toEqual({
            vue: "succes",
            donjon: null,
            bounty: "ronce-123",
            q: "ronce",
            type: null,
            liste: "avis",
        });
        expect(parseVisitorsHubSearch({ vue: "succes", avis: "../../etc" }).bounty).toBeNull();
        expect(parseVisitorsHubSearch({ vue: "echanges", avis: "ronce-123" }).bounty).toBeNull();
    });

    it("un ancien lien avec donjon ET avis garde l'avis, jamais les deux détails", () => {
        const parsed = parseVisitorsHubSearch({
            vue: "succes",
            donjon: "directeur-grunob",
            avis: "ambi-guman",
        });
        expect(parsed.liste).toBe("avis");
        expect(parsed.donjon).toBe("directeur-grunob");
        expect(parsed.bounty).toBe("ambi-guman");
        // Le filtre explicite reste prioritaire : `liste=donjons` garde la liste des donjons.
        expect(
            parseVisitorsHubSearch({ vue: "succes", liste: "donjons", avis: "ambi-guman" }).liste
        ).toBe("donjons");
    });

    it("ne garde le filtre de type que dans la vue échanges", () => {
        expect(parseVisitorsHubSearch({ vue: "echanges", type: "boss" }).type).toBe("boss");
        expect(parseVisitorsHubSearch({ vue: "echanges", type: "archimonstre" }).type).toBe(
            "archimonstre"
        );
        expect(parseVisitorsHubSearch({ vue: "echanges", type: "wow" }).type).toBeNull();
        expect(parseVisitorsHubSearch({ vue: "succes", type: "boss" }).type).toBeNull();
    });

    it("borne la recherche et refuse une clé de donjon invalide", () => {
        const parsed = parseVisitorsHubSearch({
            vue: "succes",
            q: "x".repeat(5_000),
            donjon: "../../etc/passwd",
        });
        expect(parsed.q).toHaveLength(SHARED_SUCCES_SEARCH_MAX);
        expect(parsed.donjon).toBeNull();
    });

    it("garde la première valeur quand un paramètre est répété", () => {
        expect(parseVisitorsHubSearch({ vue: ["succes", "profils"] }).vue).toBe("succes");
        expect(parseVisitorsHubSearch({ vue: "succes", donjon: ["a", "b"] }).donjon).toBe("a");
    });

    it("fabrique des liens propres : la vue profils reste l'URL nue", () => {
        expect(buildVisitorsHubHref({ vue: "profils", q: "iop", donjon: "x" })).toBe("/visiteurs");
        expect(buildVisitorsHubHref({ vue: "succes" })).toBe("/visiteurs?vue=succes");
        expect(buildVisitorsHubHref({ vue: "echanges" })).toBe("/visiteurs?vue=echanges");
        expect(buildVisitorsHubHref({ vue: "echanges", type: "boss" })).toBe(
            "/visiteurs?vue=echanges&type=boss"
        );
        expect(
            buildVisitorsHubHref({ vue: "echanges", donjon: "x", q: "iop" })
        ).toBe("/visiteurs?vue=echanges");
        expect(
            buildVisitorsHubHref({ vue: "succes", donjon: "tournesol-affame", q: "tour" })
        ).toBe("/visiteurs?vue=succes&donjon=tournesol-affame&q=tour");
        expect(
            buildVisitorsHubHref({ vue: "succes", bounty: "ronce-123", liste: "avis", q: "ronce" })
        ).toBe("/visiteurs?vue=succes&avis=ronce-123&liste=avis&q=ronce");
    });
});

describe("Succès en commun — qui a validé quoi, sans inventer", () => {
    const ACHIEVEMENTS = [
        {
            id: "a1",
            name: "Sans dégâts",
            slug: "sans-degats",
            points: 10,
            iconUrl: null,
            description: null,
        },
        {
            id: "a2",
            name: "Trio",
            slug: "trio",
            points: 5,
            iconUrl: null,
            description: null,
        },
    ];

    it("partitionne exactement les profils consentants", () => {
        const board = buildSharedSuccesBoard({
            achievements: ACHIEVEMENTS,
            doneRows: [
                { achievementId: "a1", member: MEMBERS[0] },
                { achievementId: "a1", member: MEMBERS[0] },
            ],
            visitors: MEMBERS,
        });
        expect(board.rows[0].done.map((m) => m.id)).toEqual(["p1"]);
        expect(board.rows[0].missing.map((m) => m.id)).toEqual(["p2", "p3"]);
        expect(board.rows[1].done).toEqual([]);
        expect(board.rows[1].missing).toHaveLength(3);
    });

    it("écarte une coche dont le profil n'est plus dans le périmètre", () => {
        const board = buildSharedSuccesBoard({
            achievements: ACHIEVEMENTS,
            doneRows: [
                { achievementId: "a1", member: MEMBERS[0] },
                { achievementId: "a1", member: { id: "p9", pseudo: "Fantôme", classe: null } },
            ],
            visitors: MEMBERS,
        });
        expect(board.rows[0].done.map((m) => m.id)).toEqual(["p1"]);
        expect(board.rows[0].done).toHaveLength(1);
    });

    it("trie les pseudos, vides en dernier", () => {
        const board = buildSharedSuccesBoard({
            achievements: ACHIEVEMENTS,
            doneRows: [],
            visitors: MEMBERS,
        });
        expect(board.rows[0].missing.map((m) => m.pseudo)).toEqual(["Alice", "Zoé", null]);
    });

    it("borne les profils et dit qu'il y en a plus", () => {
        const visitors = Array.from({ length: 5 }, (_, index) => ({
            id: `p${index}`,
            pseudo: `Joueur ${index}`,
            classe: null,
        }));
        const board = buildSharedSuccesBoard({
            achievements: ACHIEVEMENTS,
            doneRows: [],
            visitors,
            visitorCap: 3,
        });
        expect(board.visitorCount).toBe(3);
        expect(board.capped).toBe(true);
        expect(board.rows[0].missing).toHaveLength(3);
    });

    it("rend un tableau vide sans profils, jamais une erreur", () => {
        const board = buildSharedSuccesBoard({
            achievements: ACHIEVEMENTS,
            doneRows: [{ achievementId: "a1", member: MEMBERS[0] }],
            visitors: [],
        });
        expect(board.visitorCount).toBe(0);
        expect(board.rows[0].done).toEqual([]);
        expect(board.rows[0].missing).toEqual([]);
    });
});

describe("Verrou de source — le hub ne lit pas hors périmètre", () => {
    const server = stripComments(read(SERVER));

    it("consentement + serveur du lecteur dans chaque requête", () => {
        expect(server).toContain("showOnDirectory: true");
        expect(server).toContain("dofusServerId: viewer.serverId");
        expect(server.match(/showOnDirectory: true/g)).toHaveLength(4);
        expect(server.match(/dofusServerId: viewer\.serverId/g)).toHaveLength(4);
        expect(server).toContain("SHARED_SUCCES_VISITORS_TAKE + 1");
    });

    it("aucune donnée de guilde, aucun champ privé", () => {
        expect(server).not.toMatch(/guildId/);
        expect(server).not.toContain("metamobApiKey");
        expect(server).not.toContain("altPseudos");
        expect(server).not.toContain("userId");
    });

    it("les pages appellent la garde et restent non indexées", () => {
        const page = stripComments(read(LIST_PAGE));
        expect(page).toContain("resolveDirectoryViewer()");
        expect(page).toContain("index: false");
        expect(page).toContain("VisitorsShell");

        const profile = stripComments(read(PROFILE_PAGE));
        expect(profile).toContain("resolveDirectoryViewer()");
        expect(profile).toContain("if (!profile) notFound()");
        expect(profile).toContain("index: false");
        expect(profile).toContain("VisitorsShell");
    });

    it("l'entrée est visible dans l'espace visiteur (8ᵉ onglet)", () => {
        const nav = stripComments(read(NAV));
        expect(nav).toContain('href: "/visiteurs"');
        expect(nav).toContain("Communauté");
        expect((nav.match(/href: "/g) ?? []).length).toBe(8);
    });
});

describe("Rendu — le hub dit qui a validé, et borne l'affichage", () => {
    const DUNGEON = {
        id: "d1",
        name: "Donjon du Tournesol",
        bossName: "Tournesol Affamé",
        level: 200,
        slug: "tournesol-affame",
        imageUrl: null,
        achievements: 1,
    };
    const ACHIEVEMENTS = [
        {
            id: "a1",
            name: "Sans dégâts",
            slug: "sans-degats",
            points: 10,
            iconUrl: null,
            description: "Ne pas être touché.",
        },
    ];

    it("affiche les deux colonnes et les membres du serveur", () => {
        const board = buildSharedSuccesBoard({
            achievements: ACHIEVEMENTS,
            doneRows: [{ achievementId: "a1", member: MEMBERS[0] }],
            visitors: MEMBERS,
        });
        const html = renderToStaticMarkup(
            React.createElement(SharedSuccesView, {
                dungeons: [DUNGEON],
                selected: { dungeon: DUNGEON, board },
                bounties: [],
                selectedBounty: null,
                liste: "donjons",
                search: "",
                labels: fr.visitorsPage,
            })
        );
        expect(html).toContain("Tournesol Affamé");
        expect(html).toContain("Déjà validé");
        expect(html).toContain("Cherchent encore");
        expect(html).toContain("Zoé");
        expect(html).toContain("Alice");
        expect(html).not.toContain("Fantôme");
    });

    it("compte les membres au-delà de la limite au lieu de tous les rendre", () => {
        const visitors = Array.from({ length: SHARED_SUCCES_MEMBERS_SHOWN + 2 }, (_, index) => ({
            id: `p${index}`,
            pseudo: `Joueur ${index}`,
            classe: null,
        }));
        const board = buildSharedSuccesBoard({
            achievements: ACHIEVEMENTS,
            doneRows: visitors.map((member) => ({ achievementId: "a1", member })),
            visitors,
        });
        const html = renderToStaticMarkup(
            React.createElement(SharedSuccesView, {
                dungeons: [DUNGEON],
                selected: { dungeon: DUNGEON, board },
                bounties: [],
                selectedBounty: null,
                liste: "donjons",
                search: "",
                labels: fr.visitorsPage,
            })
        );
        expect(html).toContain("+ 2 autres");
    });

    it("dit honnêtement quand le serveur dépasse la borne de profils", () => {
        const board = buildSharedSuccesBoard({
            achievements: ACHIEVEMENTS,
            doneRows: [],
            visitors: MEMBERS,
            visitorCap: 1,
        });
        const html = renderToStaticMarkup(
            React.createElement(SharedSuccesView, {
                dungeons: [DUNGEON],
                selected: { dungeon: DUNGEON, board },
                bounties: [],
                selectedBounty: null,
                liste: "donjons",
                search: "",
                labels: fr.visitorsPage,
            })
        );
        expect(html).toContain(
            fr.visitorsPage.hub.capped.replace("{n}", String(SHARED_SUCCES_VISITORS_TAKE))
        );
    });

    it("avis — dédoublonne un profil qui a coché sur deux personnages", () => {
        const bounty = {
            id: "b1",
            name: "Ronce",
            level: 100,
            zoneName: "Amakna",
            slug: "ronce",
            imageUrl: null,
        };
        const board = buildSharedBountyBoard({
            bounty,
            doneRows: [{ member: MEMBERS[0] }, { member: MEMBERS[0] }],
            visitors: MEMBERS,
        });
        expect(board.done).toEqual([MEMBERS[0]]);
        expect(board.missing.map((member) => member.id)).not.toContain(MEMBERS[0].id);
    });

    it("avis — écarte une coche d'un profil sorti du périmètre", () => {
        const bounty = {
            id: "b1",
            name: "Ronce",
            level: 100,
            zoneName: "Amakna",
            slug: "ronce",
            imageUrl: null,
        };
        const board = buildSharedBountyBoard({
            bounty,
            doneRows: [{ member: { id: "ghost", pseudo: "Fantôme", classe: null } }],
            visitors: MEMBERS,
        });
        expect(board.done).toEqual([]);
        expect(board.visitorCount).toBe(MEMBERS.length);
    });

    it("avis — rend le board avec les deux colonnes", () => {
        const bounty = {
            id: "b1",
            name: "Ronce",
            level: 100,
            zoneName: "Amakna",
            slug: "ronce",
            imageUrl: null,
        };
        const board = buildSharedBountyBoard({
            bounty,
            doneRows: [{ member: MEMBERS[0] }],
            visitors: MEMBERS,
        });
        const html = renderToStaticMarkup(
            React.createElement(SharedSuccesView, {
                dungeons: [],
                selected: null,
                bounties: [bounty],
                selectedBounty: { bounty, board },
                liste: "avis",
                search: "",
                labels: fr.visitorsPage,
            })
        );
        expect(html).toContain(fr.visitorsPage.hub.bountyTitle);
        expect(html).toContain("Ronce");
        expect(html).toContain("Déjà validé");
        expect(html).toContain("Cherchent encore");
    });

    it("une seule liste et un seul détail : le filtre bascule, il n'empile pas", () => {
        const dungeonBoard = buildSharedSuccesBoard({
            achievements: ACHIEVEMENTS,
            doneRows: [],
            visitors: MEMBERS,
        });
        const bounty = {
            id: "b1",
            name: "Ronce",
            level: 100,
            zoneName: "Amakna",
            slug: "ronce",
            imageUrl: null,
        };
        const bountyBoard = buildSharedBountyBoard({
            bounty,
            doneRows: [],
            visitors: MEMBERS,
        });
        const base = {
            dungeons: [DUNGEON],
            selected: { dungeon: DUNGEON, board: dungeonBoard },
            bounties: [bounty],
            selectedBounty: { bounty, board: bountyBoard },
            search: "",
            labels: fr.visitorsPage,
        };

        const donjonsHtml = renderToStaticMarkup(
            React.createElement(SharedSuccesView, { ...base, liste: "donjons" as const })
        );
        expect(donjonsHtml).toContain("Tournesol Affamé");
        expect(donjonsHtml).not.toContain("Ronce");
        expect(donjonsHtml).toContain("liste=avis");

        const avisHtml = renderToStaticMarkup(
            React.createElement(SharedSuccesView, { ...base, liste: "avis" as const })
        );
        expect(avisHtml).toContain("Ronce");
        expect(avisHtml).not.toContain("Tournesol Affamé");
        expect(avisHtml).toContain("liste=avis");
    });
});

describe("Bascule du hub — un lien, pas un état client", () => {
    it("marque la vue active et garde les deux destinations", () => {
        const html = renderToStaticMarkup(
            React.createElement(VisitorsHubNav, {
                vue: "succes",
                labels: fr.visitorsPage,
            })
        );
        expect(html).toContain('aria-current="page"');
        expect(html).toContain("?vue=succes");
        expect(html).toContain("Profils");
        expect(html).toContain("Succès en commun");
    });
});

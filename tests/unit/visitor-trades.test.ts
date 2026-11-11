/**
 * Vue « Échanges Metamob » — verrou des **règles pures**, du **périmètre serveur** et du
 * rendu des états. Trois familles :
 *  1. le croisement ne garde que les profils consentants du serveur, jamais le lecteur ;
 *  2. l'ordre de Metamob est conservé, les bornes sont dites, aucune clé ne sort ;
 *  3. les erreurs Metamob deviennent des états d'écran, pas une page cassée.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fr } from "@/lib/i18n/locales/fr";
import { VisitorsHubNav } from "@/app/visiteurs/_components/visitors-hub-nav";
import { VisitorTradesView } from "@/app/visiteurs/_components/visitor-trades-view";
import {
    buildTradeBoard,
    classifyTradeFailure,
    normalizeMetamobPseudo,
    publicTradesMatchesCacheKey,
    publicTradesQuestCacheKey,
    type TradeMatchInput,
    type TradeVisitorInput,
} from "@/lib/public-trades";
import { buildVisitorsHubHref, parseVisitorsHubSearch } from "@/lib/visitors-hub";
import type { VisitorTrades } from "@/server/public-trades";

const read = (path: string) => readFileSync(path, "utf8");
const stripComments = (code: string) =>
    code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const SERVER = "src/server/public-trades.ts";
const PURE = "src/lib/public-trades.ts";
const VIEW = "src/app/visiteurs/_components/visitor-trades-view.tsx";

function monster(id: number, name: string, coversNeed = false) {
    return { id, name, coversNeed };
}

const MATCHES: TradeMatchInput[] = [
    {
        username: "Alice-MM",
        matchScore: 8,
        theyHaveYouWant: [
            monster(1, "Tofu"),
            monster(2, "Bouftou"),
            monster(3, "Larve"),
            monster(4, "Arakne"),
        ],
        youHaveTheyWant: [monster(5, "Pichon")],
    },
    {
        username: "bob-mm",
        matchScore: 3,
        theyHaveYouWant: [monster(6, "Champignon")],
        youHaveTheyWant: [],
    },
    {
        username: "Wylaen",
        matchScore: 12,
        theyHaveYouWant: [monster(7, "Tofu")],
        youHaveTheyWant: [monster(8, "Bouftou")],
    },
    {
        username: "ghost-mm",
        matchScore: 40,
        theyHaveYouWant: [monster(9, "Fantôme")],
        youHaveTheyWant: [],
    },
];

const VISITORS: TradeVisitorInput[] = [
    { id: "p-alice", pseudo: "Alice", classe: "iop", metamobPseudo: " alice-mm " },
    { id: "p-bob", pseudo: "Bob", classe: "xelor", metamobPseudo: "BOB-MM" },
    { id: "p-wylaen", pseudo: "Wylaen", classe: "feca", metamobPseudo: "wylaen" },
];

describe("Normalisation des pseudos Metamob", () => {
    it("ignore casse, espaces et formes Unicode", () => {
        expect(normalizeMetamobPseudo("  Alice-MM ")).toBe("alice-mm");
        expect(normalizeMetamobPseudo("ＡＬＩＣＥ")).toBe("alice");
        expect(normalizeMetamobPseudo(null)).toBe("");
    });
});

describe("Croisement Metamob × profils du serveur", () => {
    const board = buildTradeBoard({
        matches: MATCHES,
        visitors: VISITORS,
        viewerProfileId: "p-wylaen",
        viewerMetamobPseudo: "Wylaen",
        apiTotal: 60,
    });

    it("ne garde que les profils consentants du même serveur, jamais le lecteur", () => {
        expect(board.partners.map((partner) => partner.profileId)).toEqual([
            "p-alice",
            "p-bob",
        ]);
        expect(board.partners.some((partner) => partner.metamobPseudo === "ghost-mm")).toBe(
            false
        );
        expect(board.partners.some((partner) => partner.profileId === "p-wylaen")).toBe(false);
        expect(board.partnersCount).toBe(2);
        expect(board.apiMatches).toBe(4);
        expect(board.apiTotal).toBe(60);
        expect(board.capped).toBe(true);
    });

    it("garde le pseudo Metamob vérifié et borne les monstres", () => {
        const alice = board.partners[0];
        expect(alice.metamobPseudo).toBe("alice-mm");
        expect(alice.matchScore).toBe(8);
        expect(alice.reciprocal).toBe(true);
        expect(alice.theyHave).toHaveLength(3);
        expect(alice.theyHaveMore).toBe(1);
        expect(alice.youHave).toHaveLength(1);
        expect(alice.youHaveMore).toBe(0);

        const bob = board.partners[1];
        expect(bob.reciprocal).toBe(false);
        expect(bob.theyHave).toHaveLength(1);
        expect(bob.youHave).toHaveLength(0);
    });

    it("conserve l'ordre de Metamob", () => {
        const ordered = buildTradeBoard({
            matches: [MATCHES[1], MATCHES[0]],
            visitors: VISITORS,
            viewerProfileId: "p-wylaen",
            viewerMetamobPseudo: "wylaen",
        });
        expect(ordered.partners.map((partner) => partner.profileId)).toEqual([
            "p-bob",
            "p-alice",
        ]);
        expect(ordered.capped).toBe(false);
    });

    it("écarte un partenaire sans aucun monstre et applique la borne d'affichage", () => {
        const empty = buildTradeBoard({
            matches: [
                {
                    username: "alice-mm",
                    matchScore: 0,
                    theyHaveYouWant: [],
                    youHaveTheyWant: [],
                },
            ],
            visitors: VISITORS,
            viewerProfileId: "p-wylaen",
            viewerMetamobPseudo: "wylaen",
        });
        expect(empty.partners).toHaveLength(0);

        const capped = buildTradeBoard({
            matches: MATCHES,
            visitors: VISITORS,
            viewerProfileId: "p-wylaen",
            viewerMetamobPseudo: "wylaen",
            partnerCap: 1,
        });
        expect(capped.partners).toHaveLength(1);
        expect(capped.partnersCount).toBe(2);
        expect(capped.displayCapped).toBe(true);
    });
});

describe("Erreurs Metamob → états d'écran", () => {
    it("clé refusée, quête disparue, reste indisponible", () => {
        expect(classifyTradeFailure({ code: "UNAUTHORIZED" })).toBe("unauthorized");
        expect(classifyTradeFailure({ code: "FORBIDDEN" })).toBe("unauthorized");
        expect(classifyTradeFailure({ code: "NOT_FOUND" })).toBe("not-found");
        expect(classifyTradeFailure(new Error("boom"))).toBe("unavailable");
        expect(classifyTradeFailure(null)).toBe("unavailable");
    });
});

describe("Clés de cache", () => {
    it("sont par lecteur et ne portent aucun secret", () => {
        const matches = publicTradesMatchesCacheKey("user_123");
        const quest = publicTradesQuestCacheKey("user_123");
        expect(matches).toContain("user_123");
        expect(quest).toContain("user_123");
        expect(matches).not.toBe(quest);
        expect(matches).not.toContain("apiKey");
    });
});

describe("Périmètre serveur et étanchéité", () => {
    it("chaque lecture de profils porte le serveur du lecteur et le consentement", () => {
        const server = stripComments(read(SERVER));
        expect(server).toContain("dofusServerId: viewer.serverId");
        expect(server).toContain("showOnDirectory: true");
        expect(server).toContain("metamobPseudo: { in: usernames");
    });

    it("aucune donnée de guilde, aucune clé, aucun log console", () => {
        const server = stripComments(read(SERVER));
        expect(server).not.toContain("guildId");
        expect(server).not.toContain("metamobApiKey");
        expect(server).not.toContain("console.log");
        expect(server).toContain("limit: TRADE_MATCHES_LIMIT");
    });

    it("la règle pure n'importe ni serveur ni base", () => {
        const pure = stripComments(read(PURE));
        expect(pure).not.toContain("@/server");
        expect(pure).not.toContain("@/lib/prisma");
    });

    it("la vue reste un composant serveur", () => {
        const view = stripComments(read(VIEW));
        expect(view).not.toContain('"use client"');
        expect(view).not.toContain("metamobApiKey");
    });
});

function readyState(): Extract<VisitorTrades, { status: "ready" }> {
    return {
        status: "ready",
        viewerMetamobPseudo: "Wylaen",
        quest: {
            characterName: "Wylaen",
            currentStep: 12,
            serverName: "Draconiros",
        },
        hidden: false,
        serverMismatch: false,
        board: buildTradeBoard({
            matches: MATCHES,
            visitors: VISITORS,
            viewerProfileId: "p-wylaen",
            viewerMetamobPseudo: "Wylaen",
            apiTotal: 60,
        }),
    };
}

describe("Rendu des états", () => {
    it("affiche les partenaires, les deux sens et le contact Metamob", () => {
        const html = renderToStaticMarkup(
            React.createElement(VisitorTradesView, {
                state: readyState(),
                labels: fr.visitorsPage,
            })
        ).replace(/&#x27;/g, "'");
        expect(html).toContain("Échanges Metamob");
        expect(html).toContain("Alice");
        expect(html).toContain("alice-mm");
        expect(html).toContain("Il a ce que tu cherches");
        expect(html).toContain("Tu as ce qu'il cherche");
        expect(html).toContain("Échange réciproque");
        expect(html).toContain("https://www.metamob.fr/profile/alice-mm");
        expect(html).toContain("/visiteurs/p-alice");
        expect(html).not.toContain("metamobApiKey");
        expect(html).not.toContain("ghost-mm");
    });

    it("dit quoi faire quand Metamob n'est pas lié", () => {
        const html = renderToStaticMarkup(
            React.createElement(VisitorTradesView, {
                state: { status: "no-metamob", viewerMetamobPseudo: null },
                labels: fr.visitorsPage,
            })
        );
        expect(html).toContain("Lier mon compte Metamob");
        expect(html).toContain("/espace-visiteur/general");
    });

    it("dit honnêtement qu'aucun partenaire n'est un visiteur du serveur", () => {
        const board = buildTradeBoard({
            matches: [MATCHES[3]],
            visitors: VISITORS,
            viewerProfileId: "p-wylaen",
            viewerMetamobPseudo: "Wylaen",
        });
        const state: VisitorTrades = { ...readyState(), board };
        const html = renderToStaticMarkup(
            React.createElement(VisitorTradesView, { state, labels: fr.visitorsPage })
        ).replace(/&#x27;/g, "'");
        expect(html).toContain("aucun n'est un visiteur de ton serveur");
    });
});

describe("Bascule du hub — la troisième vue a son URL", () => {
    it("parse et fabrique le lien de la vue échanges", () => {
        expect(parseVisitorsHubSearch({ vue: "echanges", donjon: "x", q: "y" })).toEqual({
            vue: "echanges",
            donjon: null,
            q: "",
        });
        expect(buildVisitorsHubHref({ vue: "echanges" })).toBe("/visiteurs?vue=echanges");
    });

    it("marque la vue active et garde les trois destinations", () => {
        const html = renderToStaticMarkup(
            React.createElement(VisitorsHubNav, {
                vue: "echanges",
                labels: fr.visitorsPage,
            })
        );
        expect(html).toContain('aria-current="page"');
        expect(html).toContain("?vue=echanges");
        expect(html).toContain("Profils");
        expect(html).toContain("Succès en commun");
        expect(html).toContain("Échanges");
    });
});


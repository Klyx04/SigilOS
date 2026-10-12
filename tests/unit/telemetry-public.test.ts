import { describe, it, expect } from "vitest";
import {
    MIN_PUBLIC_VIEWS_TO_PUBLISH,
    PUBLIC_COUNTER_TTL_DAYS,
    PUBLIC_SCREEN_RULES,
    dayKeyUTC,
    isLikelyBot,
    isPublicTrackedPath,
    listDayKeysUTC,
    publicCounterKey,
    publicCounterKeysForDay,
    publicScreenKey,
    publicScreenLabel,
    splitPublicViews,
} from "@/lib/telemetry/public";

/**
 * Chantier D-2bis (itération 6) — règles **publiques** : allowlist d'écrans, clés de compteur,
 * filtre anti-robot, seuil de publication. Ce fichier verrouille ce qu'on a le droit de compter
 * (et ce qu'on refuse de compter).
 */

describe("publicScreenKey — allowlist, jamais de dénylist", () => {
    it("reconnaît les écrans publics suivis", () => {
        expect(publicScreenKey("/")).toBe("accueil");
        expect(publicScreenKey("/guides")).toBe("guides");
        expect(publicScreenKey("/guides/elevage/dragodindes")).toBe("guides");
        expect(publicScreenKey("/carte-du-monde")).toBe("carte");
        expect(publicScreenKey("/status")).toBe("statut");
    });

    it("ignore la query et le fragment", () => {
        expect(publicScreenKey("/guides?onglet=metiers#top")).toBe("guides");
        expect(publicScreenKey("/almanax?date=2026-09-28")).toBe("almanax");
    });

    it("ne compte rien hors allowlist (dashboard, God, API, chemins relatifs)", () => {
        for (const path of ["/dashboard/abc/missions", "/god", "/api/public-view", "/_next/static", "/overlay", "guides", ""]) {
            expect(publicScreenKey(path), path).toBeNull();
        }
        expect(publicScreenKey(null)).toBeNull();
        expect(publicScreenKey(undefined)).toBeNull();
        expect(isPublicTrackedPath("/guides")).toBe(true);
        expect(isPublicTrackedPath("/dashboard")).toBe(false);
    });

    it("ne confond pas un préfixe partiel avec un écran", () => {
        expect(publicScreenKey("/guides-prives")).toBeNull();
        expect(publicScreenKey("/docs-prives")).toBeNull();
    });

    it("rend le libellé officiel, ou la clé si elle est inconnue", () => {
        expect(publicScreenLabel("carte")).toBe("Carte du monde");
        expect(publicScreenLabel("inconnu")).toBe("inconnu");
    });
});

describe("compteurs — un jour, un écran, aucune identité", () => {
    it("construit des clés bornées", () => {
        expect(publicCounterKey("2026-09-28", "guides")).toBe("stats:public:2026-09-28:guides");
        const keys = publicCounterKeysForDay("2026-09-28");
        expect(keys).toHaveLength(PUBLIC_SCREEN_RULES.length);
        expect(keys.every((key) => key.startsWith("stats:public:2026-09-28:"))).toBe(true);
    });

    it("liste les jours UTC du plus ancien au plus récent", () => {
        const end = new Date(Date.UTC(2026, 8, 28, 12, 0, 0));
        expect(dayKeyUTC(end)).toBe("2026-09-28");
        expect(listDayKeysUTC(end, 3)).toEqual(["2026-09-26", "2026-09-27", "2026-09-28"]);
        expect(listDayKeysUTC(end, 0)).toEqual([]);
        expect(PUBLIC_COUNTER_TTL_DAYS).toBeGreaterThan(365);
    });
});

describe("isLikelyBot — les robots ne sont pas des visites", () => {
    it("écarte les robots connus et les outils en ligne de commande", () => {
        expect(isLikelyBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(true);
        expect(isLikelyBot("curl/8.4.0")).toBe(true);
        expect(isLikelyBot("python-requests/2.31")).toBe(true);
        expect(isLikelyBot("Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0.0.0")).toBe(true);
    });

    it("accepte un navigateur réel et refuse l'absence d'information", () => {
        expect(isLikelyBot("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36")).toBe(false);
        expect(isLikelyBot(null)).toBe(true);
        expect(isLikelyBot("")).toBe(true);
    });
});

describe("splitPublicViews — un écran quasi désert n'est pas publié à l'unité", () => {
    it("publie les écrans au-dessus du seuil, du plus vu au moins vu", () => {
        const split = splitPublicViews([
            { screen: "guides", views: 40 },
            { screen: "accueil", views: 120 },
            { screen: "carte", views: MIN_PUBLIC_VIEWS_TO_PUBLISH },
            { screen: "almanax", views: 3 },
            { screen: "docs", views: 0 },
        ]);

        expect(split.published.map((row) => row.screen)).toEqual(["accueil", "guides", "carte"]);
        expect(split.withheld).toEqual({ screens: 2, views: 3 });
        expect(split.minViews).toBe(MIN_PUBLIC_VIEWS_TO_PUBLISH);
    });

    it("borne les compteurs aberrants et accepte un seuil explicite", () => {
        const split = splitPublicViews(
            [
                { screen: "a", views: Number.NaN },
                { screen: "b", views: -10 },
                { screen: "c", views: 2 },
            ],
            2
        );

        expect(split.published).toEqual([{ screen: "c", views: 2 }]);
        expect(split.withheld).toEqual({ screens: 2, views: 0 });
        expect(split.minViews).toBe(2);
    });

    it("reste stable sans donnée", () => {
        expect(splitPublicViews([])).toEqual({ published: [], withheld: { screens: 0, views: 0 }, minViews: MIN_PUBLIC_VIEWS_TO_PUBLISH });
    });
});

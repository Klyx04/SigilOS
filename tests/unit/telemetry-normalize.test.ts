import { describe, it, expect } from "vitest";
import {
    FALLBACK_MODULE,
    HOME_MODULE,
    PATH_PATTERN_MAX_LENGTH,
    TELEMETRY_DETAILS_MAX_KEYS,
    TELEMETRY_DETAILS_MAX_VALUE_LENGTH,
    humanizeElementId,
    isAutoTrackedElementId,
    isTrackedPath,
    navTelemetryId,
    normalizePathPattern,
    resolveModule,
    sanitizeTelemetryDetails,
} from "@/lib/telemetry/normalize";

/**
 * Chantier D-2 — règles de normalisation de la télémétrie.
 * Ces règles vivaient au fond de `telemetry-actions.ts` (jamais testées) : on vérifie ici
 * le comportement, pas le rendu — bornes, listes de refus, ordre des motifs.
 */

describe("sanitizeTelemetryDetails — invariant « zéro empreinte »", () => {
    it("rejette toute entrée qui n'est pas un objet simple", () => {
        expect(sanitizeTelemetryDetails(null)).toEqual({});
        expect(sanitizeTelemetryDetails(undefined)).toEqual({});
        expect(sanitizeTelemetryDetails("label=click")).toEqual({});
        expect(sanitizeTelemetryDetails(42)).toEqual({});
        expect(sanitizeTelemetryDetails(["a", "b"])).toEqual({});
    });

    it("supprime les clés qui reconstituent une empreinte ou une donnée personnelle", () => {
        const sanitized = sanitizeTelemetryDetails({
            userAgent: "Mozilla/5.0",
            "user-agent": "Mozilla/5.0",
            ua: "Mozilla/5.0",
            screen: "1920x1080",
            screenSize: "1920x1080",
            viewport: "1920x1080",
            window: "1920x1080",
            platform: "Win32",
            ip: "203.0.113.7",
            ipAddress: "203.0.113.7",
            remoteAddr: "203.0.113.7",
            email: "membre@example.org",
            token: "secret",
        });

        expect(sanitized).toEqual({});
    });

    it("ignore la casse et les espaces autour d'une clé interdite", () => {
        expect(sanitizeTelemetryDetails({ "  UserAgent  ": "Mozilla/5.0", " IP ": "1.2.3.4" })).toEqual({});
    });

    it("conserve les primitives utiles en les nettoyant", () => {
        expect(sanitizeTelemetryDetails({ label: "  Claim reward  ", count: 3, ok: true })).toEqual({
            label: "Claim reward",
            count: 3,
            ok: true,
        });
    });

    it("borne la longueur des valeurs texte", () => {
        const sanitized = sanitizeTelemetryDetails({ label: "a".repeat(500) });

        expect(String(sanitized.label)).toHaveLength(TELEMETRY_DETAILS_MAX_VALUE_LENGTH);
    });

    it("borne le nombre de clés conservées (ordre d'insertion)", () => {
        const sanitized = sanitizeTelemetryDetails({
            k1: "1",
            k2: "2",
            k3: "3",
            k4: "4",
            k5: "5",
            k6: "6",
            k7: "7",
            k8: "8",
        });

        expect(Object.keys(sanitized)).toEqual(["k1", "k2", "k3", "k4", "k5", "k6"]);
        expect(Object.keys(sanitized)).toHaveLength(TELEMETRY_DETAILS_MAX_KEYS);
    });

    it("écarte les valeurs non primitives, vides ou non finies", () => {
        expect(sanitizeTelemetryDetails({
            objet: { nested: true },
            tableau: [1, 2],
            nonFini: Number.NaN,
            infini: Number.POSITIVE_INFINITY,
            vide: "   ",
            nul: null,
            absent: undefined,
            "   ": "valeur",
        })).toEqual({});
    });
});

describe("resolveModule — chemin → module du dashboard", () => {
    it("n'attribue aucun module à un chemin absent", () => {
        expect(resolveModule(null)).toBe("Général");
        expect(resolveModule(undefined)).toBe("Général");
        expect(resolveModule("")).toBe("Général");
    });

    it("classe les chemins connus, du plus spécifique au plus général", () => {
        expect(resolveModule("/dashboard/raids/cm3abcdefghijklmnopqrstuv")).toBe("Raid Hub");
        expect(resolveModule("/dashboard/quests/dofus/ebene")).toBe("Quêtes & Succès");
        expect(resolveModule("/dashboard/market")).toBe("Marché");
        expect(resolveModule("/dashboard/stuff-gallery")).toBe("Galerie de Stuffs");
        expect(resolveModule("/dashboard/almanax")).toBe("Almanax");
        expect(resolveModule("/dashboard/shop")).toBe("Boutique");
        expect(resolveModule("/dashboard/minigames")).toBe("Mini-Jeux");
        expect(resolveModule("/dashboard/members")).toBe("Roster & Membres");
    });

    it("range le panneau God dans Administration (avant Configuration)", () => {
        expect(resolveModule("/god/settings")).toBe("Administration God");
        expect(resolveModule("/dashboard/settings")).toBe("Configuration");
    });

    it("distingue l'accueil du module de repli", () => {
        expect(resolveModule("/")).toBe(HOME_MODULE);
        expect(resolveModule("/dashboard")).toBe(HOME_MODULE);
        expect(resolveModule("/une-page-inconnue")).toBe(FALLBACK_MODULE);
        expect(FALLBACK_MODULE).not.toBe(HOME_MODULE);
    });
});

describe("normalizePathPattern — un identifiant ne crée pas une clé par guilde", () => {
    it("remplace CUID, UUID et snowflake par :id", () => {
        expect(normalizePathPattern("/dashboard/cm3abcdefghijklmnopqrstuv/missions")).toBe("/dashboard/:id/missions");
        expect(normalizePathPattern("/dashboard/9f8b7c6d-5e4f-4a3b-9c2d-1e0f3a4b5c6d/members")).toBe("/dashboard/:id/members");
        expect(normalizePathPattern("/dashboard/1234567890123456789/quests")).toBe("/dashboard/:id/quests");
    });

    it("filtre les paramètres sensibles de la requête", () => {
        expect(normalizePathPattern("/dashboard/quests?token=abc&tab=dofus")).toBe("/dashboard/quests?tab=dofus");
        expect(normalizePathPattern("/dashboard?email=a@b.c")).toBe("/dashboard");
    });

    it("retombe sur la racine pour un chemin vide et borne la longueur", () => {
        expect(normalizePathPattern(null)).toBe("/");
        expect(normalizePathPattern("")).toBe("/");
        expect(normalizePathPattern(`/dashboard/${"x".repeat(400)}`)).toHaveLength(PATH_PATTERN_MAX_LENGTH);
    });
});

describe("isTrackedPath — le panneau God ne se surveille pas lui-même", () => {
    it("instrumente les écrans du dashboard", () => {
        expect(isTrackedPath("/dashboard")).toBe(true);
        expect(isTrackedPath("/dashboard/quests")).toBe(true);
        expect(isTrackedPath("/")).toBe(true);
    });

    it("exclut le panneau God, les routes techniques et les chemins invalides", () => {
        expect(isTrackedPath("/god")).toBe(false);
        expect(isTrackedPath("/god/logs")).toBe(false);
        expect(isTrackedPath("/api/telemetry")).toBe(false);
        expect(isTrackedPath("/_next/static/chunk.js")).toBe(false);
        expect(isTrackedPath("/overlay/stream")).toBe(false);
        expect(isTrackedPath("")).toBe(false);
        expect(isTrackedPath(null)).toBe(false);
        expect(isTrackedPath("dashboard")).toBe(false);
    });
});

describe("humanizeElementId — identifiant technique → libellé lisible", () => {
    it("retire le préfixe auto: et humanise les séparateurs", () => {
        expect(humanizeElementId("auto:button:claim-reward")).toBe("Claim reward");
        expect(humanizeElementId("auto:div:open_dofus_panel")).toBe("Open dofus panel");
    });

    it("rend le motif de navigation tel quel", () => {
        expect(humanizeElementId("auto:nav:/dashboard/:id/missions")).toBe("/dashboard/:id/missions");
    });

    it("ne renvoie jamais une chaîne vide", () => {
        expect(humanizeElementId(null)).toBe("Élément non identifié");
        expect(humanizeElementId("")).toBe("Élément non identifié");
        expect(humanizeElementId("auto:div:")).toBe("auto:div:");
    });

    it("reconnaît les identifiants produits automatiquement", () => {
        expect(isAutoTrackedElementId("auto:nav:/dashboard")).toBe(true);
        expect(isAutoTrackedElementId("quests.claim-reward")).toBe(false);
        expect(isAutoTrackedElementId(null)).toBe(false);
    });

    it("humanise les identifiants instrumentés à la main (data-telemetry-id)", () => {
        expect(humanizeElementId("nav:missions")).toBe("Missions");
        expect(humanizeElementId("nav:admin-settings")).toBe("Admin settings");
        expect(humanizeElementId("action:refresh-telemetry")).toBe("Refresh telemetry");
        expect(isAutoTrackedElementId("nav:missions")).toBe(false);
    });
});

describe("navTelemetryId — une clé de navigation par écran, pas par guilde", () => {
    it("retire le paramètre [guildId] du chemin", () => {
        expect(navTelemetryId("/dashboard/cm3abcdefghijklmnopqrstuv/missions")).toBe("nav:missions");
        expect(navTelemetryId("/dashboard/1234567890123456789/ladder")).toBe("nav:ladder");
        expect(navTelemetryId("/dashboard/cm3abcdefghijklmnopqrstuv")).toBe("nav:dashboard");
    });

    it("donne la même clé à la même page pour deux guildes différentes", () => {
        const guildeA = navTelemetryId("/dashboard/cm3aaaaaaaaaaaaaaaaaaa/songes");
        const guildeB = navTelemetryId("/dashboard/999999999999999999/songes");

        expect(guildeA).toBe(guildeB);
        expect(guildeA).toBe("nav:songes");
    });

    it("précise le sous-écran d'administration", () => {
        expect(navTelemetryId("/dashboard/cm3abcdefghijklmnopqrstuv/admin/settings")).toBe("nav:admin-settings");
        expect(navTelemetryId("/dashboard/cm3abcdefghijklmnopqrstuv/admin/permissions")).toBe("nav:admin-permissions");
    });

    it("ignore la query et gère les chemins hors dashboard", () => {
        expect(navTelemetryId("/dashboard/cm3abcdefghijklmnopqrstuv/members?tab=inactifs")).toBe("nav:members");
        expect(navTelemetryId("/docs")).toBe("nav:docs");
        expect(navTelemetryId(null)).toBe("nav:unknown");
    });
});

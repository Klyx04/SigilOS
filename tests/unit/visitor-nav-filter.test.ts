/**
 * Nav de l'espace visiteur — **règle pure** des onglets visibles.
 *
 * Cinq onglets exigent un profil public et rebondissent sur `general` avant sa
 * création. Les afficher quand même produisait cinq clics sans effet à la
 * première arrivée.
 */

import { describe, expect, it } from "vitest";
import { filterVisitorNav, VISITOR_NAV_ALWAYS_OPEN_HREFS } from "@/lib/visitor-nav";

const SEGMENTS = [
    { href: "/espace-visiteur/general", label: "Général" },
    { href: "/espace-visiteur/notifications", label: "Notifications" },
    { href: "/espace-visiteur/mules", label: "Mules" },
    { href: "/espace-visiteur/presentation", label: "Présentation" },
    { href: "/espace-visiteur/succes", label: "Succès" },
    { href: "/espace-visiteur/metiers", label: "Métiers" },
    { href: "/visiteurs", label: "Communauté SigilOS" },
    { href: "/espace-visiteur/reglages", label: "Réglages" },
] as const;

describe("Onglets visibles selon l'existence du profil", () => {
    it("sans profil : seules les portes franchissables (Général, Notifications, Communauté)", () => {
        expect(filterVisitorNav(SEGMENTS, { hasProfile: false }).map((segment) => segment.href)).toEqual([
            "/espace-visiteur/general",
            "/espace-visiteur/notifications",
            "/visiteurs",
        ]);
        expect(VISITOR_NAV_ALWAYS_OPEN_HREFS).toHaveLength(3);
    });

    it("avec profil : les huit onglets, dans l'ordre d'origine", () => {
        expect(filterVisitorNav(SEGMENTS, { hasProfile: true })).toEqual([...SEGMENTS]);
    });

    it("ne modifie jamais la liste source", () => {
        const before = SEGMENTS.map((segment) => segment.href);
        filterVisitorNav(SEGMENTS, { hasProfile: false });
        expect(SEGMENTS.map((segment) => segment.href)).toEqual(before);
    });
});

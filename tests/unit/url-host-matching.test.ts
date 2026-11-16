/**
 * Comparaison de **hostname** (CodeQL 127/128/129) : le choix d'un provider ou d'un
 * raccourci ne doit jamais reposer sur `url.includes("domaine")`, qu'un chemin ou une
 * query string peut contenir.
 */

import { describe, expect, it } from "vitest";
import { hostMatches } from "@/lib/dofusbook-utils";

describe("hostMatches — domaine exact ou sous-domaine, jamais une sous-chaîne", () => {
    it("accepte le domaine et ses sous-domaines", () => {
        expect(hostMatches("barbofus.com", "barbofus.com")).toBe(true);
        expect(hostMatches("www.barbofus.com", "barbofus.com")).toBe(true);
        expect(hostMatches("d-bk.net", "d-bk.net")).toBe(true);
        expect(hostMatches("fr.d-bk.net", "d-bk.net")).toBe(true);
        expect(hostMatches("dofusbook.net", "dofusbook.net")).toBe(true);
    });

    it("refuse un hostname qui contient le domaine sans être lui-même", () => {
        expect(hostMatches("evilbarbofus.com", "barbofus.com")).toBe(false);
        expect(hostMatches("barbofus.com.evil.example", "barbofus.com")).toBe(false);
        expect(hostMatches("evil-d-bk.net", "d-bk.net")).toBe(false);
        expect(hostMatches("", "barbofus.com")).toBe(false);
    });

    it("ignore la casse", () => {
        expect(hostMatches("WWW.BARBOFUS.COM", "barbofus.com")).toBe(true);
        expect(hostMatches("d-BK.net", "d-bk.net")).toBe(true);
    });

    it("ne confond pas un chemin ou une query avec le hostname", () => {
        expect(hostMatches(new URL("https://evil.example/?x=barbofus.com").hostname, "barbofus.com")).toBe(false);
        expect(hostMatches(new URL("https://evil.example/barbofus.com").hostname, "barbofus.com")).toBe(false);
        expect(hostMatches(new URL("https://www.barbofus.com/skin/1").hostname, "barbofus.com")).toBe(true);
    });
});

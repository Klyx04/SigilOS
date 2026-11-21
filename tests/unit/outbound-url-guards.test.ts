/**
 * Gardes d'URL **sortantes** — alertes CodeQL #133/#134 (21/11/2026).
 *
 * Un slug ou un nom de quête ne doit jamais pouvoir changer l'hôte d'une requête : ces
 * règles bornent le charset et la longueur, et l'hôte reste constant côté appelant.
 */
import { describe, expect, it } from "vitest";

import { isSafeDplnQuestUrl, isSafeMetamobQuestSlug } from "@/lib/outbound-url-guards";

describe("gardes d'URL sortantes", () => {
    it("n'accepte qu'un slug Metamob ASCII borné", () => {
        expect(isSafeMetamobQuestSlug("tour-du-chateau")).toBe(true);
        expect(isSafeMetamobQuestSlug("quete-2026")).toBe(true);
        expect(isSafeMetamobQuestSlug("quete_1")).toBe(false);
        expect(isSafeMetamobQuestSlug("../etc/passwd")).toBe(false);
        expect(isSafeMetamobQuestSlug("a".repeat(101))).toBe(false);
        expect(isSafeMetamobQuestSlug("")).toBe(false);
    });

    it("n'accepte que l'hôte DPLN et un slug ASCII en .html", () => {
        expect(isSafeDplnQuestUrl("https://www.dofuspourlesnoobs.com/tour-du-chateau.html")).toBe(true);
        expect(isSafeDplnQuestUrl("https://evil.example/tour.html")).toBe(false);
        expect(isSafeDplnQuestUrl("https://www.dofuspourlesnoobs.com/../admin.html")).toBe(false);
        expect(isSafeDplnQuestUrl("http://www.dofuspourlesnoobs.com/x.html")).toBe(false);
        expect(isSafeDplnQuestUrl("https://www.dofuspourlesnoobs.com/x.html?redirect=1")).toBe(false);
    });
});

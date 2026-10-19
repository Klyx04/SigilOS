import { describe, it, expect } from "vitest";
import { safeExternalUrl, safeImageUrl } from "@/lib/security";

/**
 * Gardes d'URL utilisées pour fermer les alertes CodeQL `js/xss-through-dom`.
 * Le comportement attendu est fail-closed : tout ce qui n'est pas http(s) devient "".
 */
describe("gardes d'URL (CodeQL)", () => {
    it("safeExternalUrl accepte http(s) et conserve les query strings", () => {
        expect(safeExternalUrl("https://dofusdb.fr/x?a=1&b=2")).toBe("https://dofusdb.fr/x?a=1&b=2");
        expect(safeExternalUrl("http://example.org/x")).toBe("http://example.org/x");
    });

    it("safeExternalUrl rejette javascript, data, protocol-relative et relatif", () => {
        expect(safeExternalUrl("javascript:alert(1)")).toBe("");
        expect(safeExternalUrl("data:text/html,<script>alert(1)</script>")).toBe("");
        expect(safeExternalUrl("//evil.example/x")).toBe("");
        expect(safeExternalUrl("/assets/x.png")).toBe("");
        expect(safeExternalUrl(null)).toBe("");
        expect(safeExternalUrl("")).toBe("");
    });

    it("safeExternalUrl neutralise les metacaracteres HTML", () => {
        const value = safeExternalUrl('https://evil.example/" onmouseover="alert(1)');

        expect(value).not.toContain('"');
        expect(value).not.toContain("<");
        expect(value).not.toContain(" ");
    });

    it("safeImageUrl conserve le comportement existant", () => {
        expect(safeImageUrl("https://dofusdb.fr/x.png")).toBe("https://dofusdb.fr/x.png");
        expect(safeImageUrl("javascript:alert(1)")).toBe("");
        expect(safeImageUrl("//evil.example/x.png")).toBe("");
    });
});

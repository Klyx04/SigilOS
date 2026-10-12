import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "@/lib/logger";

/**
 * Garde du 23/09/2026 — « pas mal d'erreur encore… on voit rien » : le call-site passe
 * `{ error }` (un `Error` **imbriqué**). `redact` récursait dans l'objet, or un `Error`
 * n'a **aucune propriété énumérable** ⇒ `{}` : les ~50 logs `Error: {}` du projet
 * perdaient leur message (impossible de diagnostiquer un 429, un nom de monstre, etc.).
 */
describe("logger — un Error imbriqué dans le contexte garde son message", () => {
    const captured: string[] = [];
    let spies: ReturnType<typeof vi.spyOn>[] = [];

    const capture = (...args: unknown[]) => {
        captured.push(args.map((a) => (typeof a === "string" ? a : String(a))).join(" "));
    };

    beforeEach(() => {
        captured.length = 0;
        spies = [
            vi.spyOn(console, "log").mockImplementation(capture),
            vi.spyOn(console, "warn").mockImplementation(capture),
            vi.spyOn(console, "error").mockImplementation(capture),
        ];
    });

    afterEach(() => {
        for (const s of spies) s.mockRestore();
    });

    it("rend `name` + `message` au lieu de `{}`", () => {
        logger.error("[getMonsterStats] Error:", { error: new Error("DofusDB search failed") });
        const out = captured.join("\n");
        expect(out).toContain("DofusDB search failed");
        expect(out).toContain("Error");
        expect(out).not.toContain('"error":{}');
    });

    it("garde aussi les `Error` d'un tableau (allSettled, lots de jobs)", () => {
        logger.warn("[lots] échecs:", { errors: [new Error("boom-1"), new Error("boom-2")] });
        const out = captured.join("\n");
        expect(out).toContain("boom-1");
        expect(out).toContain("boom-2");
    });

    it("ne fuit pas un secret même imbriqué (redaction conservée)", () => {
        logger.error("auth", { token: "s3cr3t-value", nested: { apiKey: "sk-123" } });
        const out = captured.join("\n");
        expect(out).not.toContain("s3cr3t-value");
        expect(out).not.toContain("sk-123");
        expect(out).toContain("[REDACTED]");
    });
});
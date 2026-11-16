/**
 * `safeImageSrc` — verrou CodeQL 123/125 (`js/xss-through-dom`) : une URL saisie dans
 * un embed ne doit jamais atteindre un `src` si elle n'est pas `http(s)` ou un chemin
 * interne. `javascript:` et `data:` sont refusés, l'image est simplement masquée.
 */

import { describe, expect, it } from "vitest";
import { safeImageSrc } from "@/lib/safe-image-url";

describe("safeImageSrc — seules les images http(s) et les chemins internes passent", () => {
    it("accepte les URL http(s) et les chemins internes", () => {
        expect(safeImageSrc("https://cdn.discordapp.com/attachments/1/2/image.png")).toBe(
            "https://cdn.discordapp.com/attachments/1/2/image.png"
        );
        expect(safeImageSrc("http://example.com/image.png")).toBe("http://example.com/image.png");
        expect(safeImageSrc("/uploads/tickets/capture.webp")).toBe("/uploads/tickets/capture.webp");
    });

    it("refuse les protocoles dangereux", () => {
        expect(safeImageSrc("javascript:alert(1)")).toBeNull();
        expect(safeImageSrc("data:image/svg+xml;base64,PHN2Zz4=")).toBeNull();
        expect(safeImageSrc("blob:https://example.com/uuid")).toBeNull();
        expect(safeImageSrc("file:///etc/passwd")).toBeNull();
    });

    it("refuse les protocoles relatifs et les chaînes non parsables", () => {
        expect(safeImageSrc("//evil.example/image.png")).toBeNull();
        expect(safeImageSrc("not a url")).toBeNull();
        expect(safeImageSrc("")).toBeNull();
        expect(safeImageSrc(null)).toBeNull();
        expect(safeImageSrc(undefined)).toBeNull();
    });

    it("nettoie les espaces autour d'une URL valide", () => {
        expect(safeImageSrc("  https://example.com/image.png  ")).toBe("https://example.com/image.png");
        expect(safeImageSrc("  /uploads/image.png  ")).toBe("/uploads/image.png");
    });
});

/**
 * Unit tests for the `UnsavedChangesGuard` helper functions.
 *
 * Couvre deux points critiques du chantier #228 :
 *  - `isDirty` : détection "modifications non sauvegardées" (snapshot JSON).
 *  - `isExecutableScheme` : rejet des schémas exécutables (CodeQL js/incomplete-url-scheme-check)
 *    — sécurité : jamais de `javascript:`/`data:`/`vbscript:` dans router.push / clic `<a>`.
 *
 * Le composant lui-même (hooks React + router) n'est pas testé ici : l'environnement
 * vitest est `node` (pas de jsdom/RTL). L'interception `router.push`/`replace` a été
 * validée à la source : `useRouter()` renvoie l'instance globale modifiable du router.
 */

import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";

// ─── Mocks des dépendances du composant (évite d'exécuter le code client) ───
vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
        refresh: vi.fn(),
        back: vi.fn(),
        forward: vi.fn(),
        prefetch: vi.fn(),
    }),
}));
vi.mock("@/components/ui/dialog", () => ({
    Dialog: ({ children }: { children: ReactNode }) => children,
    DialogContent: ({ children }: { children: ReactNode }) => children,
    DialogHeader: ({ children }: { children: ReactNode }) => children,
    DialogTitle: ({ children }: { children: ReactNode }) => children,
    DialogDescription: ({ children }: { children: ReactNode }) => children,
    DialogFooter: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/ui/button", () => ({
    Button: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("lucide-react", () => ({
    AlertTriangle: () => null,
}));

import { isDirty, isExecutableScheme } from "@/components/ui/unsaved-changes-guard";

describe("UnsavedChangesGuard -> isDirty", () => {
    it("returns false while initial is null (load not finished)", () => {
        expect(isDirty({ name: "x" }, null)).toBe(false);
        expect(isDirty({ name: "x" }, undefined)).toBe(false);
    });

    it("returns false when current === initial", () => {
        expect(isDirty({ a: 1, b: ["x"] }, { a: 1, b: ["x"] })).toBe(false);
    });

    // Limitation documentée : `isDirty` s'appuie sur JSON.stringify (sensible à l'ordre
    // des clés). En pratique les snapshots des formulaires sont construits dans le même
    // ordre → pas de faux-positif. On reflète ce comportement réel dans le test.
    it("returns true when keys are reordered (JSON.stringify est sensible à l'ordre)", () => {
        expect(isDirty({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    });

    it("returns true when a value changed", () => {
        expect(isDirty({ a: 1 }, { a: 2 })).toBe(true);
        expect(isDirty({ a: 1, b: 2 }, { a: 1 })).toBe(true);
    });
});

describe("UnsavedChangesGuard -> isExecutableScheme (sécurité)", () => {
    it("rejects javascript: (insensible à la casse)", () => {
        expect(isExecutableScheme("javascript:alert(1)")).toBe(true);
        expect(isExecutableScheme("JavaScript:alert(1)")).toBe(true);
        expect(isExecutableScheme("JaVaScRiPt:alert(1)")).toBe(true);
    });

    it("rejects javascript: encodé en %xx", () => {
        expect(isExecutableScheme("%6a%61vascript:alert(1)")).toBe(true);
    });

    it("rejects javascript: précédé d'espaces / contrôles / NBSP", () => {
        expect(isExecutableScheme("\rjavascript:alert(1)")).toBe(true);
        expect(isExecutableScheme("\u00a0javascript:alert(1)")).toBe(true);
        expect(isExecutableScheme("  javascript:alert(1)")).toBe(true);
    });

    it("rejects data: et vbscript:", () => {
        expect(isExecutableScheme("data:text/html,<script>alert(1)</script>")).toBe(true);
        expect(isExecutableScheme("vbscript:msgbox(1)")).toBe(true);
    });

    it("accepte les URLs légitimes (http, https, relatif, ancre, mailto, tel)", () => {
        expect(isExecutableScheme("https://sigilos.fr")).toBe(false);
        expect(isExecutableScheme("http://example.com/x")).toBe(false);
        expect(isExecutableScheme("/dashboard/1")).toBe(false);
        expect(isExecutableScheme("#section")).toBe(false);
        expect(isExecutableScheme("mailto:contact@example.com")).toBe(false);
        expect(isExecutableScheme("tel:+33612345678")).toBe(false);
    });

    it("accepte une URL légitime préfixée d'un espace", () => {
        expect(isExecutableScheme("  https://sigilos.fr")).toBe(false);
    });
});

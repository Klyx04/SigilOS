/**
 * Bloc « est en LIVE » — **verrou de deslop** (`docs/RULES.md` § UI).
 *
 * Mesures du 02/11/2026 : l'ancien bloc empilait `font-black`, `uppercase tracking-widest`, un
 * double `animate-ping` et deux pastilles ; il affichait la **miniature du stream** en guise de
 * photo de profil, et importait `Twitch`/`Youtube` de lucide — **dépréciés** (retrait en v1.0,
 * `lucide-react.d.ts:20581`).
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const BADGE = read("src/components/notifications/live-stream-badge.tsx");
const ICONS = read("src/components/icons/brand-icons.tsx");

/** Le CODE seul : le commentaire d'en-tête cite les défauts corrigés, il ne doit pas faire échouer. */
const CODE = BADGE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

describe("bloc live — déslop", () => {
    it("plus de `font-black`, plus de double `animate-ping`, plus de `tracking-widest`", () => {
        expect(CODE).not.toContain("font-black");
        expect(CODE).not.toContain("animate-ping");
        expect(CODE).not.toContain("tracking-widest");
        expect(CODE).not.toContain("uppercase");
    });

    it("les marques Twitch/YouTube sont **locales**, pas les icônes lucide dépréciées", () => {
        expect(BADGE).toContain('from "@/components/icons/brand-icons"');
        expect(BADGE).not.toMatch(/import\s*\{[^}]*\b(Twitch|Youtube)\b[^}]*\}\s*from\s*"lucide-react"/);
        expect(ICONS).toContain("export function TwitchIcon");
        expect(ICONS).toContain("export function YouTubeIcon");
        expect(ICONS).toContain('aria-hidden="true"');
    });

    it("affiche la **photo** du streamer, jamais la miniature du stream", () => {
        expect(CODE).toContain("avatarUrl");
        expect(CODE).not.toContain("thumbnail");
    });

    it("les deux boutons portent un `aria-label` (icône/avatar seul ne porte pas le sens)", () => {
        const labels = BADGE.match(/aria-label=/g) ?? [];
        expect(labels.length).toBeGreaterThanOrEqual(2);
        expect(BADGE).toContain("Masquer les annonces de live");
    });

    it("le dialogue est borné à la largeur de l'écran (mobile 320 px)", () => {
        expect(BADGE).toContain("w-[min(420px,calc(100vw-2rem))]");
    });
});

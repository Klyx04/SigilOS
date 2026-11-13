/**
 * DA unique — surfaces DJ/Quête.
 *
 * Règle `docs/RULES.md` § UI : le produit n'a qu'une direction artistique, celle de la
 * landing. Ce garde-fou interdit les couleurs en dur et les effets « maquette » sur les
 * deux surfaces qui les accumulaient (carte de post + tiroir de détail), et vérifie les
 * deux corrections structurelles : la croix du Sheet ne recouvre plus le badge de statut,
 * et le transfert de lead n'est plus un `<select>` natif.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const CARD = "src/components/dungeon-finder/DjPostCard.tsx";
const DETAIL = "src/components/dungeon-finder/DjPostDetailModal.tsx";
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const FORBIDDEN: Array<{ label: string; pattern: RegExp }> = [
    { label: "couleur emerald en dur", pattern: /\bemerald-\d/ },
    { label: "couleur amber en dur", pattern: /\bamber-\d/ },
    { label: "couleur zinc en dur", pattern: /\bzinc-\d/ },
    { label: "couleur indigo en dur", pattern: /\bindigo-\d/ },
    { label: "backdrop-blur", pattern: /backdrop-blur/ },
    { label: "rayon > 12 px", pattern: /rounded-(2xl|3xl)/ },
    { label: "translation au survol", pattern: /hover:-translate/ },
    { label: "font-black", pattern: /font-black/ },
];

describe("DA landing — surfaces DJ/Quête", () => {
    it("n'utilise ni couleur en dur ni effet décoratif interdit", () => {
        const offenders: string[] = [];
        for (const file of [CARD, DETAIL]) {
            const source = read(file);
            for (const rule of FORBIDDEN) {
                if (rule.pattern.test(source)) offenders.push(`${file} → ${rule.label}`);
            }
        }
        expect(offenders, offenders.join("\n")).toEqual([]);
    });

    it("le tiroir réserve la place de la croix (le badge Ouvert ne passe plus dessous)", () => {
        expect(read(DETAIL)).toContain("pr-12");
    });

    it("le transfert de lead passe par le Select maison, jamais par un select natif", () => {
        const source = read(DETAIL);
        expect(source).toContain(
            'import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";'
        );
        expect(source).not.toContain("<select");
        expect(source).toContain('placeholder="Transférer le lead à…"');
    });

    it("le soutien flottant reste sous les modales", () => {
        expect(read("src/components/shared/support-orb.tsx")).not.toContain("z-[100]");
    });
});

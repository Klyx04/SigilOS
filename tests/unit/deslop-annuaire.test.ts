import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";

/**
 * Garde du deslop de l'annuaire (chantier `M-1`, volet `membres`).
 *
 * Baseline mesurée le 02/10/2026 — c'est ce que cette garde interdit de réintroduire :
 *  - 16 rayons gonflés (`rounded-xl` / `rounded-2xl`), là où la couche registre impose 3/4/6 ;
 *  - 30 lignes de teinte décorative (`bg-info/*`, `bg-warning/*`, `bg-success/*`), c'est-à-dire
 *    un remplissage coloré qui ne signifie rien (le vert marque l'action, l'ocre la donnée de jeu) ;
 *  - 3 fonds noirs translucides, 3 `glass-premium`, 1 animation d'entrée ;
 *  - l'état vide `premium` de `EmptyState` : `rounded-3xl`, `shadow-2xl`, `backdrop-blur-md`,
 *    deux traits en dégradé et **deux halos `blur-[100px]`** (interdits par le contrat).
 *
 * Les teintes **de bord** et de **texte** restent autorisées : c'est l'endroit sanctionné pour
 * un statut court (faction du jeu, absence, administration). Le remplissage, lui, doit rester neutre.
 */

const FILES = [
    "src/components/directory/member-directory.tsx",
    "src/components/directory/member-card.tsx",
];

const FORBIDDEN = [
    "rounded-2xl",
    "rounded-3xl",
    "rounded-xl",
    "glass-premium",
    "bg-black/",
    "animate-in",
    "slide-in-from",
    "bg-gradient",
    "blur-[",
    "backdrop-blur",
    "shadow-2xl",
    "bg-info/",
    "bg-warning/",
    "bg-success/",
    "bg-danger/",
];

describe("deslop de l'annuaire — le slop ne revient pas", () => {
    it.each(FILES)("%s n'utilise plus aucune classe interdite", (file) => {
        const source = readFileSync(file, "utf8");
        for (const pattern of FORBIDDEN) {
            expect(source, `${file} contient « ${pattern} »`).not.toContain(pattern);
        }
    });

    it("les rayons restent serrés (aucun rayon au-delà de 6 px hors pastille)", () => {
        const source = readFileSync(FILES[0], "utf8");
        // `rounded-full` est réservé à une pastille de statut ; tout le reste reste serré.
        const radii = [...source.matchAll(/rounded-(sm|md|lg|full)\b/g)].map((m) => m[1]);
        expect(radii.length).toBeGreaterThan(0);
        expect(new Set(radii)).toEqual(new Set(["sm", "md", "lg", "full"]));
    });
});

describe("deslop de l'annuaire — les filtres partagent une seule source", () => {
    it("les cinq filtres consomment les constantes du contrat registre", () => {
        const source = readFileSync(FILES[0], "utf8");
        // 5 déclencheurs (classe, métier, alignement, ordre, légendaire) + le familier = 6.
        expect((source.match(/FILTER_TRIGGER\b/g) ?? []).length).toBeGreaterThanOrEqual(6);
        expect((source.match(/FILTER_TRIGGER_ACTIVE/g) ?? []).length).toBeGreaterThanOrEqual(6);
        expect((source.match(/FILTER_CLEAR\b/g) ?? []).length).toBeGreaterThanOrEqual(6);
        expect((source.match(/FILTER_CLEAR_ICON/g) ?? []).length).toBeGreaterThanOrEqual(5);
        expect((source.match(/PICKER_ITEM\b/g) ?? []).length).toBeGreaterThanOrEqual(3);
        expect((source.match(/PICKER_TILE\b/g) ?? []).length).toBeGreaterThanOrEqual(2);
    });
});

describe("deslop de l'annuaire — les icônes sont de vrais assets de jeu", () => {
    it("chaque asset cité existe réellement sur le disque", () => {
        const candidates: string[] = [];
        for (const file of FILES) {
            const source = readFileSync(file, "utf8");
            for (const m of source.matchAll(/["'`](\/assets\/dofus\/game-icons\/[\w-]+\.png)["'`]/g)) candidates.push(m[1]);
            for (const m of source.matchAll(/["'`](\/ordres\/[\w-]+\.png)["'`]/g)) candidates.push(m[1]);
            // `GameIcon` reçoit le **nom** du fichier : c'est le composant qui préfixe le dossier.
            for (const m of source.matchAll(/<GameIcon src="([\w-]+\.png)"/g)) {
                candidates.push(`/assets/dofus/game-icons/${m[1]}`);
            }
        }
        const paths = new Set(candidates);
        expect(paths.size).toBeGreaterThanOrEqual(10);
        for (const p of paths) {
            expect(existsSync(`public${p}`), `asset absent : public${p}`).toBe(true);
        }
    });

    it("les filtres n'emploient plus de glyphes génériques, seulement des assets", () => {
        const source = readFileSync(FILES[0], "utf8");
        const importLine = (source.match(/import \{[^}]+\} from "lucide-react";/) ?? [""])[0];
        // Restent légitimes : la loupe (recherche), l'entonnoir (état vide) et la croix (retirer un filtre).
        expect(importLine).toContain("Search");
        expect(importLine).toContain("Filter");
        expect(importLine).toContain("X");
        for (const glyph of ["Swords", "Briefcase", "Shield", "Sparkles", "Users", "Hammer", "Check"]) {
            expect(importLine, `glyphe générique réintroduit : ${glyph}`).not.toMatch(new RegExp(`\\b${glyph}\\b`));
        }
        // Le composant unique d'icône de jeu porte bien tous les filtres.
        expect((source.match(/<GameIcon /g) ?? []).length).toBeGreaterThanOrEqual(8);
        // Plus aucun emoji décoratif dans un libellé.
        expect(source).not.toContain("★");
    });

    it("la fiche membre n'emploie plus de glyphe pour la faction ni pour l'artisan", () => {
        const card = readFileSync(FILES[1], "utf8");
        const importLine = (card.match(/import \{[^}]+\} from "lucide-react";/) ?? [""])[0];
        for (const glyph of ["Swords", "Briefcase", "Shield", "Sparkles", "Hammer", "Users"]) {
            expect(importLine, `glyphe générique réintroduit : ${glyph}`).not.toMatch(new RegExp(`\\b${glyph}\\b`));
        }
        expect(card).toContain("FACTION_EMBLEM");
    });
});

describe("deslop de l'annuaire — rien n'a été cassé", () => {
    it("conserve les ancres de la visite guidée in-app", () => {
        const source = readFileSync(FILES[0], "utf8");
        for (const anchor of ['data-tour="annuaire-grid"', 'data-tour="annuaire-filters"', 'data-tour="annuaire-search"']) {
            expect(source, `ancre ${anchor} disparue`).toContain(anchor);
        }
    });

    it("conserve le mode lecture seule de la démo", () => {
        const directory = readFileSync(FILES[0], "utf8");
        const card = readFileSync(FILES[1], "utf8");
        expect(directory).toMatch(/readOnly=\{readOnly\}/);
        expect(card).toMatch(/readOnly\?: boolean;/);
        expect(card).toMatch(/if \(readOnly\) return <>\{children\}<\/>;/);
    });

    it("l'état vide de l'annuaire n'est plus la variante « premium »", () => {
        const source = readFileSync(FILES[0], "utf8");
        expect(source).toContain('variant="minimal"');
        expect(source).not.toContain('variant="premium"');
    });
});

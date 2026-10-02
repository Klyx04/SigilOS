import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
    DEMO_GUILD,
    DEMO_LEGENDARY_ITEMS,
    DEMO_MEMBERS,
    DEMO_STATS,
} from "@/lib/demo/source";
import { DOFUS_CLASSES, ALIGNMENTS } from "@/lib/dofus-assets";
import { metierIds } from "@/lib/metiers";

/**
 * Gardes du chantier `S` — démo publique (`docs/plans/PLAN-DEMO-PUBLIQUE.md` §5).
 *
 * Trois familles de règles, toutes **mesurables** :
 *  1. **la source est saine** : aucune donnée réelle (dépôt public), source **déterministe**,
 *     champs cohérents avec ce que `MemberCard` lit ;
 *  2. **aucune écriture atteignable** : ni `@/server/actions`, ni `"use server"`, ni Prisma ni `auth()`
 *     dans `src/app/demo/**` et `src/lib/demo/**` (décision D3) ;
 *  3. **la page est honnête** : `noindex` au rodage (D2) et libellé de démonstration présent.
 */

const DEMO_DIRS = ["src/lib/demo"];

/**
 * Fichiers que **ce lot** possède. `src/app/demo/boss-sim/` est une démo **pré-existante** (hors
 * périmètre S-1) : elle lit Dofensive via une action serveur **de lecture**, ce que cette garde ne
 * prétend pas vérifier — on ne l'inclut donc pas pour ne pas publier une couverture illusoire.
 */
const DEMO_FILES = ["src/app/demo/page.tsx", ...DEMO_DIRS.flatMap((dir) => filesUnder(dir))];

function filesUnder(dir: string): string[] {
    const out: string[] = [];
    const walk = (current: string) => {
        for (const entry of readdirSync(current)) {
            const full = join(current, entry);
            if (statSync(full).isDirectory()) walk(full);
            else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
        }
    };
    walk(dir);
    return out;
}

/** Retire les commentaires de ligne pour ne pas tester la prose (les règles y sont citées). */
function codeOnly(source: string): string {
    return source
        .split("\n")
        .filter((line) => {
            const trimmed = line.trim();
            return !(trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*"));
        })
        .join("\n");
}

describe("démo publique — la source ne contient aucune donnée réelle", () => {
    it("borne le volume et garantit des identifiants uniques", () => {
        expect(DEMO_MEMBERS.length).toBeGreaterThanOrEqual(4);
        expect(DEMO_MEMBERS.length).toBeLessThanOrEqual(20);
        const ids = DEMO_MEMBERS.map((m) => m.id);
        expect(new Set(ids).size).toBe(ids.length);
        const pseudos = DEMO_MEMBERS.map((m) => m.pseudoDofus);
        expect(new Set(pseudos).size).toBe(pseudos.length);
    });

    it("n'expose jamais un nom de compte : user.image nul et aucun user.name", () => {
        for (const member of DEMO_MEMBERS) {
            expect(member.user.image).toBeNull();
            expect(Object.keys(member.user)).toEqual(["image"]);
            expect(member.discordNickname.length).toBeGreaterThan(0);
            expect(member.pseudoDofus.length).toBeGreaterThan(0);
        }
    });

    it("ne contient ni e-mail, ni identifiant Discord, ni invitation", () => {
        const json = JSON.stringify(DEMO_MEMBERS);
        expect(json).not.toMatch(/@[a-z0-9.-]+\.(com|fr|net|org)/i);
        expect(json).not.toMatch(/\b\d{17,20}\b/);
        expect(json).not.toMatch(/discord\.gg\//i);
        // L'identifiant de guilde n'est pas un snowflake (il reste lisible et inoffensif).
        expect(DEMO_GUILD.id).toBe("guilde-demonstration");
    });

    it("est déterministe : aucune date calculée à l'exécution", () => {
        const code = codeOnly(readFileSync("src/lib/demo/source.ts", "utf8"));
        expect(code).not.toMatch(/Date\.now\(/);
        expect(code).not.toMatch(/new Date\(\s*\)/);
    });

    it("respecte les référentiels du jeu lus par MemberCard", () => {
        const classIds = new Set<string>(DOFUS_CLASSES.map((c) => c.id));
        const alignmentIds = new Set<string>(ALIGNMENTS.map((a) => a.id));
        for (const member of DEMO_MEMBERS) {
            expect(classIds.has(member.classe)).toBe(true);
            expect(alignmentIds.has(member.alignment)).toBe(true);
            // Cohérence : un membre aligné porte un ordre, un neutre n'en porte pas.
            if (member.alignment === "neutre") {
                expect(member.alignmentOrder).toBeNull();
            } else {
                expect(member.alignmentOrder).toBeTruthy();
            }
            // Les métiers doivent résoudre (sinon la carte affiche un slug brut).
            expect(metierIds(member.metiers).length).toBe(member.metiers.length);
            // Les mules ne sont rendues que si elles sont alignées avec un ordre (member-card.tsx:59).
            for (const mule of member.altPseudos) {
                expect(mule.alignment).not.toBe("neutre");
                expect(mule.alignmentOrder.length).toBeGreaterThan(0);
            }
        }
    });

    it("dérive ses chiffres de la source (jamais recopiés à la main)", () => {
        expect(DEMO_STATS.memberCount).toBe(DEMO_MEMBERS.length);
        expect(DEMO_STATS.mageCount).toBe(
            DEMO_MEMBERS.filter((m) => m.legendaryCrafts.length > 0).length,
        );
        expect(DEMO_STATS.muleCount).toBe(DEMO_MEMBERS.reduce((n, m) => n + m.altPseudos.length, 0));
        expect(DEMO_STATS.jobCount).toBe(DEMO_MEMBERS.reduce((n, m) => n + m.metiers.length, 0));
        // Le filtre de butin légendaire doit pouvoir répondre (member-directory.tsx:116).
        const filtered = DEMO_MEMBERS.filter((m) =>
            m.legendaryCrafts.some((c) => c.id === DEMO_LEGENDARY_ITEMS[0].id),
        );
        expect(filtered.length).toBeGreaterThan(0);
    });
});

describe("démo publique — aucune écriture n'est atteignable (décision D3)", () => {
    it("ne référence aucun point d'écriture ni aucune dépendance serveur", () => {
        expect(DEMO_FILES.length).toBeGreaterThan(0);
        for (const file of DEMO_FILES) {
            const source = readFileSync(file, "utf8");
            expect(source, `${file} importe une action serveur`).not.toMatch(/@\/server\/actions/);
            expect(source, `${file} déclare "use server"`).not.toMatch(/"use server"/);
            expect(source, `${file} atteint Prisma`).not.toMatch(/@\/lib\/prisma/);
            expect(source, `${file} lit une session`).not.toMatch(/from "@\/auth"/);
        }
    });

    it("garde le mode lecture seule branché sur l'annuaire réel", () => {
        const page = readFileSync("src/app/demo/page.tsx", "utf8");
        expect(page).toMatch(/<MemberDirectory/);
        expect(page).toMatch(/\breadOnly\b/);
    });

    it("interdit le retour du lien vers le dashboard dans le mode lecture seule", () => {
        // Le lien ne doit exister que dans l'enveloppe, derrière `readOnly === false`.
        const card = readFileSync("src/components/directory/member-card.tsx", "utf8");
        expect(card).toMatch(/if \(readOnly\) return <>\{children\}<\/>;/);
        expect(card).toMatch(/return <Link href=\{href\}>\{children\}<\/Link>;/);
    });
});

describe("démo publique — la page est honnête (décision D2)", () => {
    it("désindexe la route au rodage", () => {
        const page = readFileSync("src/app/demo/page.tsx", "utf8");
        expect(page).toMatch(/robots:\s*\{\s*index:\s*false/);
    });

    it("affiche un libellé de démonstration et des textes bilingues", () => {
        const page = readFileSync("src/app/demo/page.tsx", "utf8");
        expect(page).toMatch(/d\.bannerLabel/);
        const fr = readFileSync("src/lib/i18n/locales/fr.ts", "utf8");
        const en = readFileSync("src/lib/i18n/locales/en.ts", "utf8");
        expect(fr).toMatch(/demoPage:\s*\{/);
        expect(en).toMatch(/demoPage:\s*\{/);
    });

    it("décrit la guilde présentée sans jamais promettre de données réelles", () => {
        const fr = readFileSync("src/lib/i18n/locales/fr.ts", "utf8");
        const block = fr.slice(fr.indexOf("demoPage: {"), fr.indexOf("// Statut & Maintenance"));
        expect(block).toMatch(/Guilde fictive/);
        expect(block).toMatch(/lecture seule/);
    });
});

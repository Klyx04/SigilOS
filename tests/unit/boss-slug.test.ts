import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { bossSlugWithFallback, bossUrlSegment, slugifyBossName } from "@/lib/boss-slug";
import { canViewRoadmap } from "@/lib/roadmap-access";

/**
 * Slug des fiches boss (`/boss/<slug>`) :
 * - l'algorithme TS sert aux créations (God / siphon) ;
 * - le même algorithme est écrit en SQL dans la migration de backfill ;
 * - les anciennes URL en identifiant doivent rester servies en 308.
 */

const REPO_ROOT = path.resolve(__dirname, "../..");
const readSource = (relativePath: string) => fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");

describe("slugifyBossName — cas réels de la base", () => {
    it("slugifie les noms de boss (accents, apostrophes, parenthèses)", () => {
        expect(slugifyBossName("Tournesol Affamé")).toBe("tournesol-affame");
        expect(slugifyBossName("Mob l'Éponge")).toBe("mob-l-eponge");
        expect(slugifyBossName("Scarabosse Doré")).toBe("scarabosse-dore");
        expect(slugifyBossName("Craqueleur Légendaire")).toBe("craqueleur-legendaire");
        expect(slugifyBossName("Antre de la Reine Nyée")).toBe("antre-de-la-reine-nyee");
        expect(slugifyBossName("Centre du labyrinthe du Minotoror (2)")).toBe("centre-du-labyrinthe-du-minotoror-2");
        expect(slugifyBossName("Comte Harebourg")).toBe("comte-harebourg");
    });

    it("ne produit ni tiret orphelin, ni casse, ni caractère non autorisé", () => {
        for (const name of ["  Espaces   partout  ", "Tirets--doubles", "UPPERCASE", "Épée d'Ô"]) {
            expect(slugifyBossName(name), name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
        }
    });

    it("retombe sur un segment sûr quand le nom ne donne rien", () => {
        expect(slugifyBossName("")).toBe("");
        expect(bossSlugWithFallback("")).toBe("boss");
        expect(bossSlugWithFallback("!!! ???")).toBe("boss");
        expect(bossUrlSegment({ slug: "kardorim", id: "cuid" })).toBe("kardorim");
        expect(bossUrlSegment({ slug: null, id: "cuid" })).toBe("cuid");
        expect(bossUrlSegment({ slug: "  ", id: "cuid" })).toBe("cuid");
    });
});

describe("fiches boss — URL en slug, anciens liens conservés", () => {
    it("résout le segment d'URL par slug OU identifiant, et redirige en 308", () => {
        const page = readSource("src/app/boss/[dungeonId]/page.tsx");

        expect(page).toContain("OR: [{ slug: key }, { id: key }]");
        expect(page).toContain("permanentRedirect(`/boss/${canonicalSegment}`)");
        // Canonical : l'URL en slug, jamais l'identifiant.
        expect(page).toContain("canonical: canonicalUrl");
        expect(page).not.toContain("canonical: `${getAppBaseUrl()}/boss/${dungeonId}`");
    });

    it("publie des URL en slug dans le sitemap", () => {
        const sitemap = readSource("src/app/sitemap.ts");

        expect(sitemap).toContain("url: `${baseUrl}/boss/${d.slug}`");
        expect(sitemap).not.toContain("url: `${baseUrl}/boss/${d.id}`");
    });

    it("déclare la colonne, son unicité et son backfill", () => {
        const schema = readSource("prisma/schema.prisma");
        const migration = readSource("prisma/migrations/20260919130000_add_dungeon_slug/migration.sql");

        expect(schema).toMatch(/slug\s+String\s+@unique/);
        expect(migration).toContain('ALTER TABLE "Dungeon" ADD COLUMN IF NOT EXISTS "slug" TEXT');
        expect(migration).toContain('SET NOT NULL');
        expect(migration).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "Dungeon_slug_key"');
        expect(migration).toContain("row_number() OVER");
    });

    it("garde le fichier de migration sur UNE instruction par ligne (piège schema-engine Prisma 7)", () => {
        const migration = readSource("prisma/migrations/20260919130000_add_dungeon_slug/migration.sql");
        const instructions = migration
            .split(/\r?\n/)
            .map((ligne) => ligne.trim())
            .filter((ligne) => ligne.length > 0 && !ligne.startsWith("--"));

        // Incident beta 19/09/2026 : avec ce fichier écrit sur plusieurs lignes, le
        // schema-engine de Prisma 7 part en **boucle CPU à 100 %** sans exécuter la
        // moindre instruction, tout en gardant le verrou advisory → `migrate deploy`
        // paraît figé, puis la tentative suivante échoue en P1002. La même requête
        // en « une instruction par ligne » passe (vérifié dans les deux sens).
        for (const instruction of instructions) {
            expect(instruction.endsWith(";"), instruction.slice(0, 80)).toBe(true);
        }
    });

    it("fournit un slug à chaque création de donjon", () => {
        const sites = [
            "src/server/actions/game-data-actions.ts",
            "src/server/actions/game-data-admin-actions.ts",
            "src/lib/anomaly-boss-siphon.ts",
        ];

        for (const file of sites) {
            expect(readSource(file), file).toContain("resolveUniqueDungeonSlug");
        }

        // Aucun `dungeon.create` ne doit rester sans slug.
        const actions = readSource("src/server/actions/game-data-actions.ts");
        expect(actions).toContain("slug: await resolveUniqueDungeonSlug(data.bossName.trim())");
    });

    it("pointe les liens internes vers le slug (catalogue, avis, overlay, guide)", () => {
        expect(readSource("src/app/boss/_components/PublicBossCatalogClient.tsx")).toContain("/boss/${boss.slug ?? boss.id}");
        expect(readSource("src/components/succes/SuccesAvisTab.tsx")).toContain("/boss/${fiche.dungeon.slug ?? fiche.dungeon.id}");
        expect(readSource("src/components/boss-overlay/BossOverlayClient.tsx")).toContain("selected.slug ?? selected.id");
        expect(readSource("src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayDungeonCard.tsx")).toContain("dj?.slug ?? dj?.id");
        expect(readSource("src/components/succes/SuccesBossGuide.tsx")).toContain("d.id === dungeonParam || d.slug === dungeonParam");
    });
});

describe("roadmap — plus de contradiction sitemap / redirection", () => {
    it("devient publique dès que la feuille de route est activée", () => {
        expect(canViewRoadmap({ isAdmin: false, roadmapEnabled: true })).toBe(true);
        expect(canViewRoadmap({ isAdmin: true, roadmapEnabled: false })).toBe(true);
        // Un crawler n'a ni session ni guilde : seul le toggle God compte.
        expect(canViewRoadmap({ isAdmin: false, roadmapEnabled: false })).toBe(false);

        const page = readSource("src/app/roadmap/page.tsx");
        expect(page).toContain("canViewRoadmap({ isAdmin, roadmapEnabled: isEnabled })");
        expect(page).not.toContain("isInAnyGuild");
    });

    it("n'annonce la feuille de route au sitemap que si elle est publique", () => {
        const sitemap = readSource("src/app/sitemap.ts");
        const roadmapUrl = "url: `${baseUrl}/roadmap`";

        expect(sitemap).toContain("roadmapEnabled: true");
        // Une seule occurrence, et placée **après** la garde `roadmapEnabled`
        // (donc dans le bloc conditionnel, pas dans les routes statiques).
        expect(sitemap.split(roadmapUrl).length - 1).toBe(1);
        expect(sitemap.indexOf(roadmapUrl)).toBeGreaterThan(sitemap.indexOf("if (config?.roadmapEnabled)"));
    });
});

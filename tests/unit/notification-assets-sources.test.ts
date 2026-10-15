/**
 * Notifications — **sources d'asset** (marché, missions) et **plafond Redis**.
 *
 * Complète `notification-fanout-guards.test.ts` (qui tient la fin des fan-outs et la rétention).
 * Ici, on verrouille les deux lots restants de la session :
 *
 * ① l'**iconographie d'une mission** était recopiée dans **deux** composants
 *    (`calendar/mission-picker.tsx`, `calendar/event-detail-modal.tsx`) : un troisième exemplaire
 *    allait naître avec la notification — on exige la **source unique** ;
 * ② l'**icône d'une annonce du marché** est résolue **une fois**, dans le module de notification,
 *    et non par ses appelants (le `listingId` est déjà transmis) ;
 * ③ **Redis n'est plus le seul composant sans plafond** : la preuve est dans le compose
 *    (`--maxmemory` + politique + journal) **et** le contrôle quotidien doit pouvoir crier.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MissionCategory } from "@prisma/client";
import { MISSION_CATEGORY_IMAGES, missionCategoryImage } from "@/lib/mission-category-images";

const ROOT = process.cwd();
const read = (file: string) => readFileSync(resolve(ROOT, file), "utf8");

/**
 * Retire les commentaires (`#` en début de ligne **ou** en fin de ligne) avant de compter un motif :
 * ce lot **cite** les drapeaux Redis dans ses commentaires d'explication (`--maxmemory 512mb …`),
 * et un garde qui lit le brut les prendrait pour de la configuration — exactement le piège déjà
 * rencontré avec les titres de notification (`notification-fanout-guards.test.ts`).
 */
function withoutComments(source: string): string {
    return source
        .split("\n")
        .map((line) => {
            const idx = line.search(/(^|\s)#/);
            return idx === -1 ? line : line.slice(0, idx);
        })
        .join("\n");
}

const ALL_MISSION_CATEGORIES = Object.values(MissionCategory) as MissionCategory[];

describe("images de catégorie de mission (source unique)", () => {
    it("couvre TOUTE l'enum des catégories de mission", () => {
        for (const category of ALL_MISSION_CATEGORIES) {
            expect(MISSION_CATEGORY_IMAGES[category], category).toBeTruthy();
        }
        expect(Object.keys(MISSION_CATEGORY_IMAGES)).toHaveLength(ALL_MISSION_CATEGORIES.length);
    });

    it("chaque image est un asset interne (elle passera le garde de notification)", () => {
        for (const [category, path] of Object.entries(MISSION_CATEGORY_IMAGES)) {
            expect(path.startsWith("/"), category).toBe(true);
            expect(path.includes("://"), category).toBe(false);
        }
    });

    it("une catégorie inconnue rend null (fail-closed : jamais une image inventée)", () => {
        expect(missionCategoryImage("DONJON")).toBe(MISSION_CATEGORY_IMAGES.DONJON);
        expect(missionCategoryImage("PAS_UNE_CATEGORIE")).toBeNull();
        expect(missionCategoryImage(null)).toBeNull();
        expect(missionCategoryImage(42)).toBeNull();
    });

    it("les écrans consomment la source unique (plus de chemin en dur)", () => {
        for (const file of [
            "src/components/calendar/mission-picker.tsx",
            "src/components/calendar/event-detail-modal.tsx",
        ]) {
            const code = read(file);
            expect(code, file).toContain("MISSION_CATEGORY_IMAGES");
            // Les anciens chemins en dur ne doivent pas revenir : ils divergeraient en silence.
            expect(code, `${file} : chemin d'image en dur`).not.toMatch(/fallbackImage:\s*"\//);
        }
    });
});

describe("asset de l'annonce du marché", () => {
    it("l'icône est résolue dans le module de notification (pas par chacun des appelants)", () => {
        const source = read("src/server/market/notifications.ts");
        expect(source).toContain("resolveListingImage");
        expect(source).toContain("itemImageProxyUrl");
        // Le type d'asset est déclaré : la pastille sait qu'elle montre un objet.
        expect(source).toContain('"ITEM"');
    });
});

describe("asset des notifications de mission", () => {
    it("les DEUX chemins de validation passent le picto de catégorie", () => {
        // Dashboard et Discord doivent produire la même notification (même image).
        expect(read("src/server/actions/mission-actions.ts")).toContain("missionCategoryImage(");
        expect(read("src/server/actions/discord-validation-actions.ts")).toContain("missionCategoryImage(");
    });
});

describe("Redis n'est plus sans plafond", () => {
    it("les DEUX Redis (prod et bêta) sont plafonnés, avec journal et politique explicite", () => {
        const compose = withoutComments(read("docker-compose.prod.yml"));
        const count = (needle: string) => compose.split(needle).length - 1;

        expect(count("--maxmemory 512mb")).toBe(2);
        expect(count("--maxmemory-policy noeviction")).toBe(2);
        expect(count("--appendonly yes")).toBe(2);
        // Un conteneur plafonné côté Redis **et** côté Docker (marge au-dessus de maxmemory).
        expect(count("memory: 640M")).toBe(2);
    });

    it("la maintenance quotidienne contrôle la mémoire et sait alerter", () => {
        const script = withoutComments(read("scripts/maintenance.sh"));
        expect(script).toContain("used_memory");
        expect(script).toContain("maxmemory");
        // Le mot de passe ne doit jamais transiter en argument visible : REDISCLI_AUTH.
        expect(script).toContain("REDISCLI_AUTH");
        expect(script).toContain("send_alert");
    });
});

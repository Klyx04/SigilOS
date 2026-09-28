/**
 * Avis de recherche — **un seul rail de synchronisation**, du bouton God jusqu'à DofusDB.
 *
 * 🐛 Mesure du 27/09/2026 (signalement user : « 0 avis synchronisés » après le bouton
 * « Sync & remplir tous les avis » de l'écran God des avis — alors une route dédiée,
 * aujourd'hui l'onglet « Avis de recherche » des Éditeurs) : ce bouton appelait
 * `syncBountiesCompleteFromDofusDb`, une action **hors rail** qui interrogeait DofusDB par
 * `monsters?typeId=23` → **`total: 0`** (mesuré au `curl`) : la passe ne faisait rien, le toast
 * annonçait pourtant un succès, et l'écriture se faisait par `upsert(name)` **sans** la liste
 * d'exclusion (un avis supprimé dans God pouvait donc revenir). L'appartenance d'un avis est
 * portée par sa **race** (`race∈{32,90,127,147,156}`), jamais par un `typeId`.
 *
 * 🔒 Ce que ce test verrouille : ① le bouton God passe par le lanceur **partagé**
 * (`runInlineGameDataDataset("BOUNTIES")`) et ne ré-écrit pas la boucle des 5 races ; ② le
 * lanceur appelle bien `siphonBountiesRaceAction` (le rail) ; ③ plus AUCUNE requête `typeId=23`
 * dans `src/` (3 sites mesurés morts : 2 synchronisations, 1 filtre « boss » d'un écran public) ;
 * ④ l'avis d'une zone est publié sous **une seule forme**, la forme canonique du proxy d'assets.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../..");
const readSource = (relativePath: string) => fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");

/**
 * Retire les commentaires : la mesure porte sur le CODE, jamais sur la prose (un commentaire qui
 * explique « cette requête était morte » ne doit pas faire échouer la garde). Même convention que
 * `tests/unit/deslop-surfaces-legacy.test.ts`.
 */
const codeOnly = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const PAGE = "src/components/admin/BountyManager.tsx";
const RUNNERS = "src/components/admin/game-data-inline-runners.ts";
const ACTIONS = "src/server/actions/game-data-actions.ts";
const SIPHON = "src/lib/bounty-siphon.ts";

/** Tous les `.ts`/`.tsx` de `src/` — la mesure porte sur le code livré, pas sur la prose des docs. */
function sourceFiles(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) sourceFiles(full, out);
        else if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
    return out;
}

/** Fichiers de `src/` dont le CODE contient la chaîne (commentaires exclus). */
function codeOffenders(fragment: string): string[] {
    return sourceFiles(path.join(REPO_ROOT, "src"))
        .filter((file) => codeOnly(fs.readFileSync(file, "utf8")).includes(fragment))
        .map((file) => path.relative(REPO_ROOT, file).replace(/\\/g, "/"));
}

describe("avis de recherche — un seul rail de synchronisation", () => {
    it("le bouton God appelle le lanceur partagé, jamais une action locale", () => {
        const page = codeOnly(readSource(PAGE));
        expect(page).toContain('runInlineGameDataDataset("BOUNTIES"');
        expect(page).not.toContain("syncBountiesCompleteFromDofusDb");
        // Une seule implémentation : la page ne ré-écrit ni la boucle des races ni l'appel du rail.
        expect(page).not.toContain("BOUNTY_RACE_IDS");
        expect(page).not.toContain("siphonBountiesRaceAction");
    });

    it("le lanceur partagé fait tourner le rail (les 5 races, une à la fois)", () => {
        const runners = codeOnly(readSource(RUNNERS));
        expect(runners).toContain("siphonBountiesRaceAction(raceId)");
        expect(runners).toContain("BOUNTY_RACE_IDS");
        expect(runners).toContain('BOUNTIES: "Avis de recherche (race par race)"');
    });

    it("l'action hors rail `syncBountiesCompleteFromDofusDb` a disparu du code", () => {
        expect(codeOffenders("syncBountiesCompleteFromDofusDb")).toEqual([]);
    });

    it("plus aucune requête DofusDB par `typeId=23` (mesurée à `total: 0`)", () => {
        expect(codeOffenders("typeId=23")).toEqual([]);
    });

    it("le filtre « boss » interroge `isBoss` (DofusDB), pas un typeId mort", () => {
        const actions = codeOnly(readSource(ACTIONS));
        expect(actions).toContain("filter === 'boss' ? `&isBoss=true` : ''");
    });

    it("le siphon ADOPTE la ligne historique du même nom (écriture gardée dans le `WHERE`)", () => {
        const siphon = codeOnly(readSource(SIPHON));
        expect(siphon).toContain("pickAdoptableBounty(rows, target.name)");
        expect(siphon).toContain("db.bounty.updateMany(");
        expect(siphon).toContain("where: { id: existing.id, dofusdbId: null }");
        // La curation God n'est jamais dans ce que le siphon écrit.
        for (const curated of ["doplons", "milice", "rewardType", "mechanics", "position", "rewards"]) {
            expect(siphon).not.toMatch(new RegExp(`^\\s+${curated}:`, "m"));
        }
    });

    it("l'avis d'une zone est publié sous la forme canonique du proxy d'assets", () => {
        const actions = readSource(ACTIONS);
        const start = actions.indexOf("export async function getBountiesForZone");
        expect(start).toBeGreaterThan(-1);
        const rest = actions.slice(start);
        const body = rest.slice(0, rest.indexOf("export async function", 1));
        expect(body).toContain('normalizeDofusAssetStoredUrl("monsters", b.imageUrl, b.dofusdbId)');
        // Jamais d'URL externe inventée (le CDN Ankama publiait une image tierce dans un écran public).
        expect(body).not.toContain("static.ankama.com");
        expect(body).not.toContain("dofusdb.fr");
    });
});

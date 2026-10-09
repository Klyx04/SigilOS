/**
 * Avis de recherche — **une seule porte d'entrée** : l'onglet « Avis de recherche » des
 * **Éditeurs** de l'interface Game Data (fusion **D-4**, décision user du 28/09/2026 :
 * « fusionne cet onglet dans game-data > éditeurs > nouvel onglet avis »).
 *
 * 🐛 Mesure (lecture de code, 28/09/2026) : l'écran vivait dans sa **propre route**
 * (`/god/game-data/bounties`) ⇒ sa propre entrée de navigation, sa propre brique PIM
 * (`game-data-bounties`), sa propre carte d'accès dans l'onglet Game Data et ses propres
 * `revalidatePath`. Trois conséquences : ① deux formes d'URL pour un seul outil,
 * ② un délégué « avis » distinct du module game-data (et un grant orphelin après fusion),
 * ③ une navigation qui grossit à chaque module. L'avis rejoint les autres référentiels
 * (maître/détail, un seul ouvert à la fois).
 *
 * 🔒 Ce que ce test verrouille :
 *  ① la route a disparu (fichier, nav, brique, cible de tab, liens) ;
 *  ② l'éditeur est déclaré dans `EDITORS` (interface Game Data) et rendu par `BountyManager` ;
 *  ③ plus aucun `revalidatePath`/lien ne pointe vers l'ancienne route (aucun pointeur mort) ;
 *  ④ la fusion n'a rien retiré côté réseau : le rail de siphon des avis est intact ;
 *  ⑤ 🛡️ un avis **supprimé** ne revient pas : le siphon applique la liste d'exclusion, la
 *    suppression exclut dès qu'un `dofusdbId` existe, et cette liste curée **survit au
 *    déploiement** (les deux scripts de déploiement la protègent du `git pull`).
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../..");
const readSource = (relativePath: string) => fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");

/** Mesure sur le CODE (jamais sur la prose) : un commentaire qui cite l'ancienne route est légitime. */
const codeOnly = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

/** Tous les `.ts`/`.tsx` de `src/` dont le CODE contient la chaîne. */
function codeOffenders(fragment: string): string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (/\.tsx?$/.test(entry.name) && codeOnly(fs.readFileSync(full, "utf8")).includes(fragment)) {
                out.push(path.relative(REPO_ROOT, full).replace(/\\/g, "/"));
            }
        }
    };
    walk(path.join(REPO_ROOT, "src"));
    return out;
}

const INTERFACE = "src/components/admin/GameDataInterface.tsx";
const ROUTE = "src/app/god/game-data/bounties";


describe("avis de recherche — un éditeur de l'interface Game Data (fusion D-4)", () => {
    it("la route dédiée a disparu (fichier supprimé, plus de page)", () => {
        expect(fs.existsSync(path.join(REPO_ROOT, ROUTE))).toBe(false);
        expect(fs.existsSync(path.join(REPO_ROOT, `${ROUTE}/page.tsx`))).toBe(false);
    });

    it("l'éditeur est déclaré dans les Éditeurs et rendu par `BountyManager`", () => {
        const code = readSource(INTERFACE);
        expect(code).toContain('import BountyManager from "./BountyManager";');
        expect(code).toContain('id: "bounties"');
        expect(code).toContain("render: () => <BountyManager />");
    });

    it("la navigation, la brique PIM et les cibles de tab ne citent plus l'ancienne route", () => {
        // Navigation God : plus d'entrée « avis » (c'est un éditeur, pas une page).
        expect(codeOnly(readSource("src/components/layout/god-nav-config.ts"))).not.toContain("game-data/bounties");
        // PIM : la brique ciblée disparaît (une seule garde : `game-data`).
        expect(codeOnly(readSource("src/lib/god-bricks.ts"))).not.toContain("game-data-bounties");
        expect(codeOnly(readSource("src/lib/god-scopes.ts"))).not.toContain("game-data-bounties");
        expect(codeOnly(readSource("src/app/god/game-data/layout.tsx"))).not.toContain("game-data-bounties");
        // Tab → brique et carte d'accès de l'onglet Game Data.
        const godPage = codeOnly(readSource("src/app/god/page.tsx"));
        expect(godPage).not.toContain("game-data/bounties");
        expect(godPage).not.toContain("game-data-bounties");
    });

    it("plus aucun revalidatePath ni lien mort vers l'ancienne route", () => {
        expect(codeOffenders("/god/game-data/bounties")).toEqual([]);
        expect(codeOnly(readSource("src/server/actions/game-data-admin-actions.ts"))).not.toContain(
            "game-data/bounties",
        );
    });

    it("le rail de siphon des avis reste la seule implémentation (rien n'a été retiré)", () => {
        const actions = readSource("src/server/actions/game-data-admin-actions.ts");
        expect(actions).toContain("export async function siphonBountiesRaceAction");
        expect(actions).toContain("export async function deleteBountyAction");
        expect(actions).toContain("export async function restoreBountyAction");
        expect(readSource("src/components/admin/game-data-inline-runners.ts")).toContain(
            "siphonBountiesRaceAction(raceId)",
        );
    });

    it("🛡️ un avis supprimé ne revient pas : le siphon saute les ids exclus ET les noms exclus", () => {
        const siphon = readSource("src/lib/bounty-siphon.ts");
        expect(siphon).toContain("const ignoredIds = getIgnoredBountyIds();");
        // 🔶 08/10/2026 — les lignes historiques supprimées sans `dofusdbId` étaient
        // recréées (aucune exclusion enregistrée) : le siphon filtre aussi sur le nom.
        expect(siphon).toContain("const ignoredNames = getIgnoredBountyNames();");
        expect(siphon).toContain("!isIgnoredBountyName(t.name, ignoredNames)");
    });

    it("🛡️ la suppression exclut TOUJOURS (même sans `dofusdbId` : exclusion par nom)", () => {
        const code = codeOnly(readSource("src/server/actions/game-data-admin-actions.ts"));
        // 🔶 08/10/2026 — l'ancienne condition `if (bounty.dofusdbId)` laissait les lignes
        // historiques sans exclusion : le siphon les recréait à la passe suivante.
        expect(code).toContain("addIgnoredBounty(bounty.dofusdbId ?? 0, bounty.name);");
    });

    it("🛡️ la liste curée survit au déploiement (les 2 scripts la protègent du `git pull`)", () => {
        expect(readSource("scripts/deploy-cd.sh")).toMatch(
            /PRESERVED=\([\s\S]*?ignored-bounties\.json[\s\S]*?\)/,
        );
        expect(readSource("scripts/deploy.sh")).toContain("public/game-data/ignored-bounties.json");
    });

    /**
     * 🔶 B2 (09/10/2026) — l'UI God des avis cesse d'être du slop ET devient opérable :
     * filtre par type (5 races), section Orphelins + exclusion en masse, libellés FR,
     * zone honnête. Ce test verrouille la structure (pas le pixel).
     */
    it("l'éditeur God filtre par type, affiche les orphelins et parle français", () => {
        const manager = readSource("src/components/admin/BountyManager.tsx");
        // Filtre par type (5 races, libellés courts).
        expect(manager).toContain("bountyRaceShortLabel");
        expect(manager).toContain("BOUNTY_RACE_IDS");
        // Section Orphelins (snapshot + exclusion en masse + garde curation).
        expect(manager).toContain("getBountyOrphansAction");
        expect(manager).toContain("handleExcludeAllOrphans");
        expect(manager).toContain("Tout exclure");
        expect(manager).toContain("filterVisibleBountyOrphans");
        // Libellés FR (fini les onglets EN).
        expect(manager).toContain("Configuration");
        expect(manager).toContain("Récompenses");
        expect(manager).not.toContain(">Rewards<");
        // Zone honnête (jamais « Zone Inconnue »).
        expect(manager).toContain("Zone non exposée");
        expect(manager).not.toContain("Zone Inconnue");
        // Design tokens (fini le amber-500 codé en dur).
        expect(manager).not.toContain("amber-500");
        expect(manager).not.toContain("bg-black/20");
    });

    it("l'action de lecture des orphelins existe et reste gardée", () => {
        const actions = readSource("src/server/actions/game-data-admin-actions.ts");
        expect(actions).toContain("export async function getBountyOrphansAction");
        expect(actions).toContain("getBountyOrphansSnapshot");
        // Même garde que le reste de l'éditeur (jamais d'ouverture anonyme).
        const start = actions.indexOf("export async function getBountyOrphansAction");
        const body = actions.slice(start, start + 1200);
        expect(body).toContain("requireGameDataBounties");
    });
});

/**
 * Synchronisation de l'arbre de travail du VPS — **trois classes de fichiers, une seule
 * décision par chemin** (cause racine mesurée le 30/09/2026).
 *
 * 🐛 Mesure : `./scripts/deploy-cd.sh beta` affichait à CHAQUE déploiement « Des fichiers
 * locaux sont modifiés » avec les mêmes icônes de succès. Cause : `git pull --autostash` ne
 * peut **pas** résorber un fichier **binaire** suivi modifié localement — soit le pop du
 * stash binaire retombe sur l'ancien contenu (conflit, stash conservé), soit il s'applique
 * proprement quand le blob ne bouge pas dans le merge ⇒ les mêmes fichiers reviennent
 * indéfiniment. La purge d'empreintes du 20/09/2026 (`7c69d579`) a réécrit **25** des 28
 * icônes de succès suivies, le serveur a gardé les octets d'AVANT. Aucun écrivain runtime ne
 * touche ces dossiers (`git grep` de tous les `writeFile*` de `src/` : les écritures vont
 * dans `public/uploads/**` non suivi, `public/game-data/{monsters,dungeons,legendary}/*.webp`
 * — galerie God — et `prisma/seed-data/**` — exports God).
 *
 * 2e mesure du 30/09/2026 (`git diff --numstat` + `stat -c %a` sur le VPS, 448 `M`) : la
 * divergence n'est pas toujours de contenu — **11** fichiers ne divergent que par le **MODE**
 * (`old mode 100644` → `new mode 100755`, contenu identique) et **436** binaires divergent en
 * contenu. Le `+x` vient de la synchro d'assets : `sync-assets.ps1` n'impose pas le
 * `--chmod=…Fu=rw,Fg=r,Fo=r` que porte déjà `sync-assets.sh`. Conséquence : restaurer avec
 * `git show HEAD:$f > $f` était **inopérant** — le `>` préserve le mode du fichier existant
 * (`775`) et la garde `cmp -s` ne voit pas le mode ⇒ `dungeon-monsters.json`, pourtant de la
 * classe `GENERATED`, restait listé « modifié » à chaque déploiement (prouvé par le rapport
 * du VPS, pas déduit).
 *
 * ⚖️ Arbitrage du 30/09/2026 (voie sans risque, réversible) : les **436 binaires** de
 * `public/game-data/{monsters,dungeons,legendary,invader,harvest-icons}` et les **7 JSON**
 * réécrits par le panneau God / les scripts de siphon passent en classe **`SERVER_OWNED`** :
 * on n'y touche PAS (le serveur fait foi, aucune perte possible) et le rapport les **compte à
 * part** au lieu de les présenter comme une alerte. La convergence vers la génération du dépôt
 * reste ouverte (`docs/ROADMAP.md` « reste »).
 *
 * 🔒 Ce que ce test verrouille :
 *  ① `deploy-cd.sh` restaure les médias suivis **avant** le pull (classe `REPO_OWNED`) ;
 *  ② cette classe ne contient **jamais** `public/game-data/{monsters,dungeons,legendary}`
 *    (leurs `.webp` sont suivis **et** réécrits par la galerie God : les restaurer écraserait
 *    une écriture volontaire du serveur) ni les listes curées `ignored-*` (classe `PRESERVED`) ;
 *  ③ les deux scripts de déploiement appliquent la **même** liste (aucune divergence) ;
 *  ④ la restauration énumère les fichiers **suivis** via `git ls-files` (un dossier, pas une
 *    liste figée : une nouvelle icône est couverte sans toucher au script) ;
 *  ⑤ le rapport de fin ne compte que les fichiers **suivis** : les caches runtime non suivis
 *    (`.webp` de la galerie God, proxy-cache, preuves téléversées) noyaient le message.
 *  ⑥ la restauration remet **contenu ET mode** (`git checkout --`) et la garde est sensible
 *    au mode (`git diff --quiet HEAD --`) — dans les **deux** scripts.
 *  ⑦ les fichiers portés par le serveur (`SERVER_OWNED`) sont **comptés à part** dans le
 *    rapport et n'entrent **jamais** dans une liste de restauration.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../..");
const deployCd = () => fs.readFileSync(path.join(REPO_ROOT, "scripts/deploy-cd.sh"), "utf8");
const deploySh = () => fs.readFileSync(path.join(REPO_ROOT, "scripts/deploy.sh"), "utf8");

/** Entrées d'un tableau bash `NOM=( … )` (indentation quelconque) ; les commentaires sont ignorés. */
function bashArray(source: string, name: string): string[] {
    const block = source.match(new RegExp(`${name}=\\(([\\s\\S]*?)\\n\\s*\\)`));
    expect(block, `tableau bash « ${name} » introuvable`).not.toBeNull();
    return (block![1].match(/"[^"]+"/g) ?? []).map((entry) => entry.slice(1, -1));
}

describe("scripts de déploiement — synchronisation de l'arbre de travail", () => {
    it("① deploy-cd.sh restaure les médias suivis depuis le dépôt (classe REPO_OWNED)", () => {
        const source = deployCd();
        expect(bashArray(source, "REPO_OWNED")).toContain("public/game-data/achievements");
        // La classe est réellement branchée sur la restauration, pas seulement déclarée.
        expect(source).toMatch(/for p in "\$\{GENERATED\[@\]\}" "\$\{REPO_OWNED\[@\]\}"/);
        expect(source).toMatch(/for f in "\$\{RESTORE\[@\]\}"\s*;\s*do/);
    });

    it("② les `.webp` de la galerie God et les listes curées ne sont JAMAIS restaurés", () => {
        const godOwned = [
            "public/game-data/monsters",
            "public/game-data/dungeons",
            "public/game-data/legendary",
        ];
        const cd = bashArray(deployCd(), "REPO_OWNED");
        const sh = bashArray(deploySh(), "REPO_OWNED");
        for (const dir of godOwned) {
            expect(cd).not.toContain(dir);
            expect(sh).not.toContain(dir);
        }
        // Les listes God restent dans la classe CURÉE (sauvegardée puis restaurée), pas ici.
        expect(cd.some((p) => p.includes("ignored-"))).toBe(false);
    });

    it("③ les deux scripts appliquent la même liste (source unique de la règle)", () => {
        expect(bashArray(deploySh(), "REPO_OWNED")).toEqual(bashArray(deployCd(), "REPO_OWNED"));
    });

    it("④ la restauration énumère les fichiers suivis (dossier, jamais une liste figée)", () => {
        expect(deployCd()).toMatch(/git ls-files -- "\$p"/);
        expect(deploySh()).toMatch(/git ls-files -- "\$_dir"/);
    });

    it("⑤ le rapport de fin ne compte que les fichiers suivis (caches runtime exclus)", () => {
        expect(deployCd()).toContain("git status --porcelain --untracked-files=no");
    });

    it("⑥ la restauration remet aussi le MODE (mesure 30/09 : 11 JSON en 100644 → 100755)", () => {
        for (const source of [deployCd(), deploySh()]) {
            // `git checkout --` remet contenu ET mode de l'index (un `>` aurait gardé le `+x`).
            expect(source).toMatch(/git checkout -- "\$(f|_tracked)"/);
            // Les deux formes aveugles au mode sont bannies : `git show HEAD:$f > $f` écrit le
            // contenu en PRÉSERVANT le mode local (`775`), `cmp -s` ne voit pas le mode.
            expect(source).not.toMatch(/git show "HEAD:\$/);
            expect(source).not.toMatch(/cmp -s - "\$/);
            // Garde de restauration sensible au mode.
            expect(source).toMatch(/git diff --quiet HEAD -- "\$(f|_tracked)"/);
        }
    });

    it("⑦ les fichiers portés par le serveur sont comptés à part — jamais restaurés", () => {
        const source = deployCd();
        const serverOwned = bashArray(source, "SERVER_OWNED");
        // Les 5 dossiers de médias réécrits par la galerie God + les 7 JSON générés.
        for (const dir of [
            "public/game-data/monsters",
            "public/game-data/dungeons",
            "public/game-data/legendary",
            "public/game-data/invader",
            "public/game-data/harvest-icons",
        ]) {
            expect(serverOwned).toContain(dir);
        }
        for (const json of ["worldmap.json", "worlds.json", "zaaps.json", "harvest-resources.json", "secret-passages.json"]) {
            expect(serverOwned).toContain(`public/game-data/${json}`);
        }
        // Jamais branchés sur la restauration (RESTORE = GENERATED + REPO_OWNED uniquement)…
        expect(source).not.toMatch(/for p in "\$\{GENERATED\[@\]\}" "\$\{REPO_OWNED\[@\]\}" "\$\{SERVER_OWNED\[@\]\}"/);
        // … mais bien utilisés par la séparation du rapport (information, pas alerte).
        expect(source).toMatch(/for p in "\$\{SERVER_OWNED\[@\]\}"/);
        expect(source).toMatch(/SERVER_DIRTY=""/);
        expect(source).toMatch(/OTHER_DIRTY=""/);
    });
});

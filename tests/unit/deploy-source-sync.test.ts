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
});

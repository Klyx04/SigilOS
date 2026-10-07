/**
 * Lisibilité de la sortie de déploiement — **ce qui s'affiche doit s'expliquer seul**.
 *
 * 🐛 Quatre mesures du 30/09/2026 sur la sortie de `./scripts/deploy-cd.sh beta` (VPS) :
 *  ① `262 migrations found in prisma/migrations` puis « aucune migration en attente » :
 *    impossible de savoir ce que sont ces 262 (les migrations **du dépôt**) ni pourquoi
 *    rien n'est appliqué (Prisma compare à la table `_prisma_migrations`) ;
 *  ② `✅ 310 fichier(s) migré(s) (autres: 310).` : la catégorisation de
 *    `migrate-uploads.mjs` reposait sur une liste blanche de 4 dossiers, donc **tout le
 *    reste** s'appelait « autres » — un fourre-tout qui n'apprend rien ;
 *  ③ `app  ✓ téléchargée███████░░░]  91%%` : le `✓` était écrit avec `\r` **sans effacer
 *    la fin de la ligne** ⇒ le reste de la barre (plus longue) restait affiché derrière ;
 *    et le `%` compte les **couches** Docker, pas les octets, donc il pouvait s'arrêter
 *    avant la fin alors que l'image était complète ;
 *  ④ `npm notice New major version of npm available!` au milieu de l'étape 5 : l'appel
 *    `npm run seed:docs:prod` n'avait ni `--silent` ni `NO_UPDATE_NOTIFIER` (l'étape 4
 *    les portait, pas l'étape 5 — ni `deploy.sh`, 4 fois) ;
 *  ⑤ (2ᵉ passage du **même** déploiement, code **identique**) la ligne
 *    `262 migrations found in prisma/migrations` **n'a pas été écrite** : Prisma a
 *    affiché 5 lignes au 1ᵉʳ passage, 1 seule au 2ᵉ ⇒ un compte **relu du log**
 *    retombait sur le message muet, sur le nombre même que le lecteur cherche.
 *
 * 🔒 Verrouillé ici :
 *  ① la barre n'écrit **que** sur un terminal (mesuré : 0 octet hors terminal) et efface
 *    la fin de sa ligne ;
 *  ② le téléchargement finit avec une **dernière trame à 100 %**, une ligne propre (elle
 *    écrase la barre) et la **taille** de l'image ;
 *  ③ la sortie brute de `docker pull` n'est pas affichée (elle se mélangeait à la barre)
 *    mais reste **disponible** pour le diagnostic d'échec ;
 *  ④ aucun appel npm des **deux** scripts ne déverse son bandeau ni sa pub de version ;
 *  ⑤ le résumé de la migration uploads nomme la **source**, la **destination** et le
 *    premier dossier **réel** (plus de « autres ») ;
 *  ⑥ les migrations Prisma sont annoncées avec leur **compte**, compté **dans le dépôt**
 *    (jamais dans le bavardage de Prisma), et leur **sens** ;
 *  ⑦ la **dernière ligne** du log d'une commande s'affiche, même quand le flux ne finit
 *    pas par un `\n` : Prisma écrit ses messages en **réécrivant la même ligne** (`\r`),
 *    donc `wc -l` ne voyait qu'une ligne sur trois et le verdict (« 262 migrations
 *    found… », « No pending migrations… ») restait invisible — mesuré le 30/09/2026
 *    sur deux déploiements réels au code identique.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");

const deployCd = () => read("scripts/deploy-cd.sh");
const deploySh = () => read("scripts/deploy.sh");
const migrateUploads = () => read("scripts/migrate-uploads.mjs");

describe("Sortie du déploiement — compréhensible sans explication", () => {
    it("① la barre n'écrit que sur un terminal et efface sa ligne", () => {
        const source = deployCd();
        // Hors terminal (log redirigé, CI), une ligne réécrite en place = du bruit.
        expect(source).toMatch(/\[\[ -t 1 \]\] \|\| return 0/);
        // `\033[K` avant CHAQUE trame : sans lui, le message suivant (plus court que la
        // barre) laissait un morceau de barre affiché derrière lui.
        expect(source).toMatch(/printf "\\r\\033\[K  \$\{C_DIM\}%-20s\$\{C_RESET\} \[/);
        // Le % est borné : un compteur de couches peut annoncer plus que le total.
        expect(source).toMatch(/\(\( pct > 100 \)\) && pct=100/);
    });

    it("② le téléchargement finit à 100 %, sur une ligne propre, avec la taille", () => {
        const source = deployCd();
        expect(source).toMatch(/bar "\$NAME" 1 1/);
        expect(source).toMatch(/printf "\\r\\033\[K  \$\{C_DIM\}%-20s\$\{C_RESET\} \$\{C_GREEN\}✓ téléchargée/);
        expect(source).toContain("--format '{{.Size}}'");
        expect(source).toContain("%s Mo");
        // La ligne d'échec efface elle aussi la barre (aucun résidu après « ✗ ÉCHEC »).
        expect(source).toMatch(/printf "\\r\\033\[K  \$\{C_DIM\}%-20s\$\{C_RESET\} \$\{C_RED\}✗ ÉCHEC/);
    });

    it("③ la sortie brute du pull n'est pas affichée mais reste pour le diagnostic", () => {
        const source = deployCd();
        // Consommée par la boucle qui alimente la barre (jamais écrite à l'écran)…
        expect(source).toContain('tee "$PULL_LOG" | while IFS= read -r line');
        // … et relue, filtrée, seulement quand le pull a échoué.
        expect(source).toContain("grep -viE 'Pulling fs layer|Waiting|Downloading");
        expect(source).toContain('"$PULL_LOG" | tail -3');
    });

    it("④ aucun appel npm ne déverse son bandeau ni sa pub de version", () => {
        const scripts: ReadonlyArray<readonly [string, string]> = [
            ["deploy-cd.sh", deployCd()],
            ["deploy.sh", deploySh()],
        ];
        for (const [name, source] of scripts) {
            // Sans `--silent`, npm réimprime « > temp-sigil@0.1.0 seed:docs:prod ».
            expect(source, name).not.toMatch(/npm run (?!-)/);
            // Sans le notifier coupé : « npm notice New major version of npm available! ».
            const npmLines = source.split("\n").filter((line) => line.includes("npm run --silent"));
            expect(npmLines.length, `${name} : aucun appel npm trouvé`).toBeGreaterThan(0);
            for (const line of npmLines) {
                expect(line, `${name} : ${line.trim()}`).toContain("npm_config_update_notifier=false");
                expect(line, `${name} : ${line.trim()}`).toContain("NO_UPDATE_NOTIFIER=1");
            }
        }
    });

    it("⑤ la migration uploads dit d'où viennent et où vont les fichiers", () => {
        const source = migrateUploads();
        // Plus de fourre-tout « autres » : le premier dossier réel sert de catégorie.
        expect(source).not.toContain('|| "autres"');
        expect(source).toContain('segments.length > 1 ? segments[0] : "(racine)"');
        // Robuste aux deux séparateurs : le script tourne aussi sur un poste Windows.
        expect(source).toContain("split(/[/\\\\]/)");
        // Le résumé nomme la source ET la destination.
        expect(source).toContain("déplacé(s) de public/uploads vers private_uploads");
    });

    it("⑥ les migrations Prisma sont annoncées avec leur compte et leur sens", () => {
        const source = deployCd();
        // Le compte vient du DÉPÔT (mesuré le 30/09/2026 : la ligne « N migrations found »
        // de Prisma n'est pas toujours écrite — 5 lignes puis 1 seule, code identique).
        expect(source).toContain("find prisma/migrations -mindepth 1 -maxdepth 1 -type d");
        expect(source).toContain("migrations connues, aucune à appliquer");
        // Jamais un nombre figé : le script compte.
        expect(source).not.toMatch(/KNOWN_MIGRATIONS:?-?=?\s*262/);
        // Repli documenté (dépôt incomplet) : la ligne du log, quand Prisma l'écrit.
        expect(source).toContain("[0-9]+ migrations? found");
        // …et il ne sert jamais en pratique : le dépôt porte de vraies migrations.
        const dirs = fs
            .readdirSync(path.join(REPO_ROOT, "prisma/migrations"), { withFileTypes: true })
            .filter((entry) => entry.isDirectory());
        expect(dirs.length).toBeGreaterThan(0);
        // L'intitulé de l'étape dit ce qui est fait… et ce qui ne l'est pas.
        expect(source).toContain("aucune ne rejoue, aucune donnée n'est effacée");
    });

    it("⑦ la dernière ligne du log s'affiche, même sans `\\n` final", () => {
        const source = deployCd();
        // 🐛 Mesure du 30/09/2026 (2 déploiements réels au code identique) : une SEULE
        // ligne de Prisma s'affichait (« Loaded Prisma config… ») alors que son verdict
        // (« 262 migrations found… », « No pending migrations… ») était bien dans le log
        // — Prisma réécrit la même ligne (`\r`) et n'achève pas le flux par un `\n`,
        // or `wc -l` ne compte que les `\n`.
        //   ⇒ au flush (process terminé), le compte inclut la dernière ligne…
        expect(source).toContain("awk 'END{print NR}' \"$LOG\"");
        // …et les messages réécrits en place sont remis un par ligne.
        expect(source).toContain("tr '\\r' '\\n'");
        // La boucle de sondage, elle, garde `wc -l` : une ligne en cours d'écriture ne
        // doit pas être réaffichée à chaque tour.
        expect(source).toMatch(/while kill -0 "\$PID"[\s\S]{0,600}wc -l <"\$LOG"/);
    });
});

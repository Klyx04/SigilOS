/**
 * Garde du script de sauvegarde — **un « réussi » doit être prouvé**.
 *
 * 🔎 Mesures du 29/10/2026 (panne R2 : abonnement Cloudflare supprimé) :
 *  ① `docker exec … pg_dumpall | gzip > f` puis `if [ $? -ne 0 ]` testait le code
 *    de `gzip`, jamais celui de `pg_dumpall` : conteneur arrêté = `.gpg` de
 *    ~20 octets annoncé « Réussi » ;
 *  ② après un échec d upload, le script sortait en **code 0** — le crontab ne
 *    voyait rien, seule la notification God le signalait ;
 *  ③ aucun contrôle après upload (objet absent ou tronqué jamais détecté) ;
 *  ④ `restore_db.sh` annonçait « ✅ Restore completed » sans tester le code de
 *    `psql` (une restauration à moitié faite passait pour un succès) ;
 *  ⑤ la procédure « Jour J » documentait une bascule beta → prod que le script
 *    ne savait pas faire (il filtrait la cible, pas la source) ;
 *  ⑥ rétention locale `-mtime +3` à l aveugle et rétention R2 déléguée à une
 *    Lifecycle Rule **externe** (perdue avec l abonnement) : aucune borne en
 *    octets alors que le compte est sur le plan gratuit (10 Go).
 *
 * 🔒 Verrouillé ici : chaque garde ci-dessous correspond à un de ces défauts.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");

const backup = () => read("scripts/backup_db.sh");
const restore = () => read("scripts/restore_db.sh");

describe("Sauvegarde R2 — un succès se prouve", () => {
    it("① le dump échoue vraiment quand pg_dumpall échoue (pipefail)", () => {
        const source = backup();
        expect(source).toMatch(/^set -euo pipefail$/m);
        // Le pipe est dans un `if !` : le code de sortie testé est celui de la
        // commande qui produit les octets, pas celui du compresseur.
        expect(source).toMatch(/if ! docker exec "\$DB_CONTAINER" pg_dumpall -c --if-exists -U "\$DB_USER" \| gzip/);
        // Conteneur arrêté = échec explicite, avant même le dump.
        expect(source).toMatch(/docker inspect -f '\{\{\.State\.Running\}\}'/);
    });

    it("① un dump vide ou tronqué est refusé (taille, gzip, marqueur de fin)", () => {
        const source = backup();
        expect(source).toMatch(/BACKUP_MIN_KB/);
        expect(source).toMatch(/gzip -t/);
        expect(source).toMatch(/PostgreSQL database dump complete/);
        expect(source).toMatch(/gpg --batch --list-packets/);
    });

    it("③ l objet téléversé est vérifié sur R2 (taille identique)", () => {
        const source = backup();
        expect(source).toMatch(/head-object[\s\S]{0,200}ContentLength/);
        expect(source).toMatch(/REMOTE_BYTES[\s\S]{0,120}ENC_BYTES/);
    });

    it("②④ tout échec sort en code 1 (le crontab le voit)", () => {
        const source = backup();
        // L upload est gardé, et le garde mène à un `exit 1`.
        expect(source).toMatch(/if ! aws s3 cp[\s\S]{0,400}?exit 1/);
        expect(source).toMatch(/missing_r2_config[\s\S]{0,80}exit 1/);
    });

    it("⑥ la rotation R2 est bornée en nombre ET en octets", () => {
        const source = backup();
        expect(source).toMatch(/BACKUP_KEEP_DAILY/);
        expect(source).toMatch(/BACKUP_KEEP_MONTHLY/);
        expect(source).toMatch(/BACKUP_R2_MAX_MB/);
        expect(source).toMatch(/plan_r2_rotation/);
        expect(source).toMatch(/aws s3api delete-object/);
        // La rétention R2 ne dépend plus de la Lifecycle Rule de Cloudflare.
        expect(source).not.toMatch(/-mtime/);
        // Un objet hors nomenclature n est jamais supprimé par la rotation.
        expect(source).toMatch(/month_of\[n\] = \(p\[1\] == "sigilos"\)/);
    });

    it("la phrase secrète GPG reste compatible avec les archives existantes", () => {
        // `echo` ajoute un saut de ligne qui fait partie de la phrase secrète :
        // passer à `printf` rendrait illisibles tous les dumps déjà déposés.
        expect(backup()).toMatch(/echo "\$BACKUP_ENCRYPTION_KEY" \| gpg/);
    });

    it("GPG ne demande jamais la phrase secrète (loopback, pas d agent)", () => {
        // Depuis GPG 2.1, `--passphrase-fd` seul est ignoré : gpg-agent ouvre une
        // boîte de saisie (mesuré le 29/10/2026). En cron, sans terminal → échec
        // du chiffrement, donc plus aucune sauvegarde.
        for (const source of [backup(), restore(), read("scripts/restore-drill.sh")]) {
            expect(source).toMatch(/gpg --batch --pinentry-mode loopback/);
            expect(source).not.toMatch(/gpg --batch --yes --passphrase-fd/);
        }
    });
});

describe("Restauration — elle ne ment plus sur son résultat", () => {
    it("④ la restauration tolère « does not exist » et vérifie qu'il y a des comptes", () => {
        const source = restore();
        // `ON_ERROR_STOP=0` + filtre : un dump antérieur à `--if-exists` commence
        // par un `DROP DATABASE` qui échoue sur un cluster neuf (mesuré le 29/10).
        expect(source).toMatch(/psql -v ON_ERROR_STOP=0/);
        expect(source).toMatch(/grep -v 'does not exist'/);
        expect(source).toMatch(/Restauration ÉCHOUÉE/);
        // Une base restaurée sans aucun compte n'est pas une restauration.
        expect(source).toMatch(/select count\(\*\) from "User"/);
    });

    it("⑤ la bascule Jour J lit la source, pas la cible", () => {
        const source = restore();
        expect(source).toMatch(/--from/);
        expect(source).toMatch(/grep "sigilos_\$\{FROM_ENV\}_"/);
    });

    it("le téléchargement R2 échoue proprement et un nom nu est résolu", () => {
        const source = restore();
        expect(source).toMatch(/if ! aws s3 cp/);
        expect(source).toMatch(/"\$BACKUP_DIR\/\$ACTION"/);
    });
});

describe("Répétition de restauration — aucun risque pour la prod", () => {
    it("le conteneur jetable est isolé sur la boucle locale et toujours détruit", () => {
        const source = read("scripts/restore-drill.sh");
        expect(source).toMatch(/sigilos-restore-drill/);
        // Jamais exposé au réseau : le port n'écoute que sur 127.0.0.1.
        expect(source).toMatch(/-p "127\.0\.0\.1:\$\{DRILL_PORT\}:5432"/);
        // Nettoyage garanti, y compris sur erreur ou Ctrl-C.
        expect(source).toMatch(/trap cleanup EXIT/);
        // Le dump déchiffré ne part que dans le conteneur jetable.
        expect(source).toMatch(/gunzip -c "\$DRILL_DEC" \| docker exec -i "\$DRILL_CONTAINER"/);
        expect(source).not.toMatch(/gunzip -c "\$DRILL_DEC" \| docker exec -i "\$DB_CONTAINER"/);
    });
});

describe("PRA — la doc décrit ce que le script sait faire", () => {
    it("la procédure de bascule cite --from beta", () => {
        const doc = read("docs/agents/disaster-recovery.md");
        expect(doc).toMatch(/--download-latest --from beta/);
    });

    it("la clé de chiffrement est décrite comme un prérequis hors site", () => {
        const doc = read("docs/agents/disaster-recovery.md");
        expect(doc).toMatch(/BACKUP_ENCRYPTION_KEY/);
        expect(doc).toMatch(/hors (du )?VPS|gestionnaire de mots de passe/i);
    });
});

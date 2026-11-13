/**
 * `deploy-cd.sh` — un identifiant mort ne doit plus se déguiser en tag absent.
 *
 * Mesure du 20/10/2026 : `list beta` affichait « introuvable (build GHCR ?) » pour
 * les 4 images alors qu'elles existaient. Cause : le token GHCR avait été
 * **régénéré** (donc l'ancien secret était mort), `/root/.docker/config.json`
 * portait encore l'ancien, `imagetools inspect` répondait 403 — et le script
 * jetait l'erreur (`2>/dev/null`) avant d'accuser le build.
 *
 * Preuves de la mesure : `docker login` avec le nouveau token + `docker pull` OK ;
 * `docker manifest inspect` renvoie le JSON du tag ; `buildx` v0.38.0 est présent ;
 * la même commande manuelle affiche `Digest: sha256:90626492b203…`.
 *
 * 🔒 Ce que ce test verrouille : ① l'erreur du registre n'est plus masquée ;
 * ② deux lecteurs (buildx, puis repli `manifest`) ; ③ les **trois** appels
 * (list latest, list <sha>, pré-vol 1.5) passent par la règle, jamais en
 * substitution de commande (les variables de diagnostic seraient perdues dans le
 * sous-shell) ; ④ la raison est nommée ; ⑤ la doc n'annonce plus un renouvellement
 * trimestriel qui n'existe plus.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const SCRIPT = readFileSync("scripts/deploy-cd.sh", "utf8");
/** Retire les commentaires : la prose cite `2>/dev/null` et les anciens messages. */
const CODE = SCRIPT.replace(/^\s*#.*$/gm, "");

describe("deploy-cd.sh — diagnostic GHCR", () => {
    it("① l'erreur du registre n'est plus jetée à la poubelle", () => {
        expect(CODE).not.toMatch(/imagetools inspect[^\n]*2>\/dev\/null/);
        expect(CODE).toMatch(/imagetools inspect[^\n]*2>&1/);
    });

    it("② un seul lecteur, deux chemins : buildx puis repli manifest", () => {
        expect(CODE).toContain("image_digest()");
        expect(CODE).toMatch(/docker buildx imagetools inspect/);
        expect(CODE).toMatch(/docker manifest inspect/);
    });

    it("③ les trois appels passent par la règle, jamais en `$( … )`", () => {
        const appels = CODE.match(/image_digest "/g) ?? [];
        expect(appels).toHaveLength(3);
        // Une substitution de commande s'exécute dans un sous-shell : les variables
        // `GHCR_DIGEST_REASON` / `GHCR_DIGEST_ERROR` n'en sortiraient pas.
        expect(CODE).not.toMatch(/\$\(image_digest/);
    });

    it("④ la raison est nommée, plus de faux « build GHCR »", () => {
        expect(CODE).not.toContain("introuvable (build GHCR ?)");
        expect(CODE).toContain("token GHCR périmé");
        expect(CODE).toContain("tag absent");
        expect(CODE).toContain("registre injoignable");
    });

    it("⑤ la doc acte le token sans expiration et le test par `pull`", () => {
        const doc = readFileSync("docs/MAINTENANCE.md", "utf8");
        expect(doc).toMatch(/sans expiration/);
        expect(doc).not.toMatch(/Renouveler GHCR_TOKEN/);
        expect(doc).toMatch(/docker pull ghcr\.io\/klyx04\/sigilos-app-beta:latest/);
    });
});

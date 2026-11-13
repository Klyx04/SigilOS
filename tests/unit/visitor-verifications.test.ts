/**
 * Espace visiteur (rang 57) — verrou des **vérifications** (D-V16).
 *
 * Deux vérifications, un même vocabulaire :
 *  · **pseudo Dofus** auprès du ladder Ankama — helper partagé avec le profil interne,
 *    repli manuel du toggle God, et **fail-open** (worker indisponible ≠ refus) ;
 *  · **clé Metamob** vérifiée immédiatement (`/v1/me`), sans attendre le worker.
 *
 * La règle de message est pure et testée ; le câblage (garde, rate limit, écriture
 * `where: { userId }`) est verrouillé à la source, comme les autres verrous visiteurs.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { describePseudoVerification } from "@/lib/pseudo-verification";

const read = (path: string) => readFileSync(path, "utf8");

const ACTIONS = "src/server/actions/public-profile-actions.ts";
const PROFILE_ACTIONS = "src/server/actions/profile-actions.ts";
const LADDER = "src/server/ladder-pseudo.ts";
const IDENTITY = "src/app/espace-visiteur/_components/identity-form.tsx";
const MULES = "src/app/espace-visiteur/_components/mules-form.tsx";
const METAMOB = "src/app/espace-visiteur/_components/metamob-form.tsx";

describe("Vérification du pseudo — les quatre issues, un seul message", () => {
    it("pseudo trouvé : succès", () => {
        expect(describePseudoVerification({ found: true, manual: false }).tone).toBe("success");
    });

    it("pseudo introuvable : avertissement, et le message ne promet pas que ça passera", () => {
        const outcome = describePseudoVerification({ found: false, manual: false });
        expect(outcome.tone).toBe("warning");
        expect(outcome.message).toContain("introuvable");
        // Renversé le 08/11/2026 : l'ancien texte (« Tu peux quand même l'enregistrer »)
        // contredisait le refus serveur de `createPublicProfile` et `updatePublicMules`.
        expect(outcome.message).not.toContain("enregistrer");
    });

    it("worker indisponible : avertissement, jamais un refus (fail-open)", () => {
        const outcome = describePseudoVerification({ found: null, manual: false });
        expect(outcome.tone).toBe("warning");
        expect(outcome.message).toContain("indisponible");
        // Même raison : le message ne doit plus dire « Tu peux enregistrer ».
        expect(outcome.message).not.toContain("Tu peux");
    });

    it("toggle God « Fallback Pseudo Manuel » : contrôle court-circuité", () => {
        const outcome = describePseudoVerification({ found: null, manual: true });
        expect(outcome.tone).toBe("warning");
        expect(outcome.message).toContain("manuelle");
    });
});

describe("Câblage des vérifications", () => {
    it("le helper ladder est partagé, plus recopié dans le profil interne", () => {
        expect(read(LADDER)).toMatch(/export async function checkPseudoExistsOnLadder/);
        expect(read(PROFILE_ACTIONS)).toMatch(/from "@\/server\/ladder-pseudo"/);
        expect(read(PROFILE_ACTIONS)).not.toMatch(/async function checkPseudoExistsOnLadder/);
    });

    it("`verifyPublicPseudo` garde, limite et lit le toggle God", () => {
        const code = read(ACTIONS);
        const start = code.indexOf("export async function verifyPublicPseudo");
        const block = code.slice(start, code.indexOf("export async function verifyPublicMetamob"));
        expect(block).toMatch(/getPublicSession\(\)/);
        expect(block).toMatch(/limit\("pseudo-check"/);
        expect(block).toMatch(/isLadderManualFallbackEnabled\(\)/);
        expect(block).toMatch(/checkPseudoExistsOnLadder\(/);
    });

    it("`verifyPublicMetamob` garde, limite, lit la clé et n'écrit que sur le compte courant", () => {
        const code = read(ACTIONS);
        const block = code.slice(code.indexOf("export async function verifyPublicMetamob"));
        expect(block).toMatch(/getPublicAccount\(\)/);
        expect(block).toMatch(/limit\("metamob-check"/);
        expect(block).toMatch(/getMetamobMe\(key\)/);
        expect(block).toMatch(/where: \{ userId: account\.userId \}/);
        expect(block).toMatch(/metamobVerified: true/);
    });

    it("les trois formulaires appellent les actions", () => {
        expect(read(IDENTITY)).toMatch(/verifyPublicPseudo\(\{ pseudo, dofusServerId/);
        expect(read(MULES)).toMatch(/verifyPublicPseudo\(\{ pseudo, dofusServerId: serverId \}/);
        expect(read(METAMOB)).toMatch(/verifyPublicMetamob\(\)/);
    });

    /**
     * F15 (08/11/2026) — « j'ajoute, j'enregistre, et après refresh il n'y a rien ».
     *
     * Le brouillon n'était persisté que par « Ajouter » : remplir la ligne puis cliquer
     * « Enregistrer mes mules » envoyait la **liste vide**. Toast vert, zéro mule en base.
     */
    it("F15 — « Enregistrer mes mules » inclut le brouillon en cours", () => {
        const form = read(MULES);
        const block = form.slice(form.indexOf("const handleSave"), form.indexOf("return (", form.indexOf("const handleSave")));

        expect(block).toMatch(/draft\.pseudo\.trim\(\)/);
        expect(block).toMatch(/next\.push\(/);
        expect(block).toMatch(/updatePublicMules\(next\)/);
        // Le chemin « liste seule » est celui qui perdait la saisie : il ne doit plus exister.
        expect(block).not.toMatch(/updatePublicMules\(list\)/);
    });
});

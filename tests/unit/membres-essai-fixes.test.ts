/**
 * Fiche membre — reprogrammation d'essai et `/valider-recrue` qui tourne dans le vide.
 *
 * 🔎 Mesures du 29/10/2026 (bêta) :
 *  ① « Reprogrammer » écrivait bien la date en base, mais la liste `/admin/members`
 *    restait servie depuis le cache de rendu : en rouvrant la fiche, l'ancienne date
 *    revenait — aucun `revalidatePath` dans `setMemberTrialState` ;
 *  ② une ligne « hors dashboard » forçait `remainingDays: null`, donc le badge d'essai
 *    affichait « 0 j restant » au lieu des jours réels ;
 *  ③ `/valider-recrue` laissait « SigilOS réfléchit… » : `editInteractionMessage`
 *    renvoyait `flags: 64` au PATCH (refusé par Discord, le flag EPHEMERAL ne se
 *    re-spécifie pas) et tronquait le token d'interaction à 200 caractères alors que
 *    les tokens réels en font 250 à 300.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");

describe("Reprogrammation d'essai — la liste est revalidée", () => {
    it("setMemberTrialState invalide la page Membres après écriture", () => {
        const source = read("src/server/actions/member-lifecycle-actions.ts");
        expect(source).toContain('import { revalidatePath } from "next/cache";');
        expect(source).toMatch(/revalidatePath\(`\/dashboard\/\$\{guildId\}\/admin\/members`\)/);
    });
});

describe("/valider-recrue — l'édition de l'interaction aboutit", () => {
    it("le PATCH ne renvoie jamais le flag EPHEMERAL", () => {
        const source = read("src/server/discord.ts");
        // Le flag EPHEMERAL ne se re-spécifie pas à l'édition : le PATCH répond 400 et
        // la réponse différée reste sur « SigilOS réfléchit… » jusqu'à l'expiration.
        expect(source).not.toMatch(/flags: 64,/);
        expect(source).not.toMatch(/\{ flags: 64, \.\.\.payload \}/);
        expect(source).toContain("{ content: payload } : payload");
    });

    it("accepte un token d'interaction de plus de 200 caractères (borné à 1024)", () => {
        const source = read("src/server/discord.ts");
        expect(source).toContain(".slice(0, 1024)");
        expect(source).toContain("{10,1024}");
        expect(source).not.toContain("{10,200}");
    });
});

describe("Durée d'essai réglable par le staff", () => {
    it("l'action borne la durée (1 à 90 jours) sans écraser un réglage absent", () => {
        const source = read("src/server/actions/trial-end-actions.ts");
        expect(source).toContain("z.number().int().min(1).max(90)");
        expect(source).toMatch(/trialDurationDays\?: number/);
        expect(source).toContain("...(duration !== undefined ? { trialDurationDays: duration } : {})");
        // La valeur lue est celle qu'applique `/valider-recrue` (config de guilde).
        expect(source).toContain("trialDurationDays: true");
    });
});

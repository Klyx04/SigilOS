/**
 * Espace visiteur (rang 57) — verrou de la **synchro ladder** (V1e).
 *
 * Le même noyau vivait **inline** dans `updateUserProfile` ; il est maintenant partagé avec le
 * profil public. Ce test tient les deux bouts :
 *
 * 1. **bornes** : le worker Ankama est un tiers, on ne stocke jamais sa valeur brute (niveau
 *    1..300, XP réduite à ses chiffres, points entiers positifs) ;
 * 2. **source** : un seul endroit fait les deux appels (`ladder-snapshot.ts`), et le profil
 *    public n'écrit **jamais** `classe` depuis le ladder (libellé ↔ id, le filtre casserait).
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
    normalizeLadderClass,
    normalizeLadderLevel,
    normalizeLadderPoints,
    normalizeLadderXp,
} from "@/server/ladder-snapshot";

const read = (path: string) => readFileSync(path, "utf8");
const stripComments = (code: string) =>
    code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const SNAPSHOT = "src/server/ladder-snapshot.ts";
const PROFILE_ACTIONS = "src/server/actions/profile-actions.ts";
const PUBLIC_ACTIONS = "src/server/actions/public-profile-actions.ts";

describe("Snapshot ladder — les valeurs du tiers sont bornées", () => {
    it("le niveau reste dans 1..400, entier", () => {
        expect(normalizeLadderLevel(0)).toBe(1);
        expect(normalizeLadderLevel(301)).toBe(301);
        expect(normalizeLadderLevel(401)).toBe(400);
        expect(normalizeLadderLevel("200")).toBe(200);
        expect(normalizeLadderLevel(12.9)).toBe(12);
        expect(normalizeLadderLevel(null)).toBeUndefined();
        expect(normalizeLadderLevel("beaucoup")).toBeUndefined();
    });

    it("les points de succès sont un entier positif, jamais une chaîne", () => {
        expect(normalizeLadderPoints(42.7)).toBe(42);
        expect(normalizeLadderPoints(-1)).toBeUndefined();
        expect(normalizeLadderPoints("42")).toBeUndefined();
        expect(normalizeLadderPoints(Number.NaN)).toBeUndefined();
    });

    it("l'XP ne garde que ses chiffres, 15 au maximum", () => {
        expect(normalizeLadderXp("12 345 678")).toBe(12_345_678n);
        expect(normalizeLadderXp("1".repeat(20))).toBe(BigInt("1".repeat(15)));
        expect(normalizeLadderXp("abc")).toBeUndefined();
        expect(normalizeLadderXp("0")).toBeUndefined();
        expect(normalizeLadderXp(null)).toBeUndefined();
    });

    it("la classe est un libellé borné, jamais vide", () => {
        expect(normalizeLadderClass("  Iop  ")).toBe("Iop");
        expect(normalizeLadderClass("x".repeat(60))).toHaveLength(50);
        expect(normalizeLadderClass("   ")).toBeUndefined();
        expect(normalizeLadderClass(42)).toBeUndefined();
    });
});

describe("Snapshot ladder — un seul noyau, un seul mapping", () => {
    it("le profil interne ne fait plus les deux appels lui-même", () => {
        const code = stripComments(read(PROFILE_ACTIONS));
        expect(code).toContain("fetchLadderSnapshot(pseudoDofus, serverId)");
        // L'ancien bloc inline est bien parti (deux appels + affectations champ par champ).
        expect(code).not.toContain("ladderSnapshot.successPoints = s.points");
        expect(code).not.toContain("ladderSnapshot.totalXp = BigInt(cleanXp)");
    });

    it("le module partagé porte les deux appels et le contrat fail-open", () => {
        const code = stripComments(read(SNAPSHOT));
        expect(code).toContain("type=general");
        expect(code).toContain("DOFUS_LADDER_WORKER_URL");
        expect(code).toContain("return {}");
    });

    it("le profil public écrit son classement sans toucher à la classe", () => {
        const code = stripComments(read(PUBLIC_ACTIONS));
        expect(code).toContain("fetchLadderSnapshot(");
        expect(code).toContain("lastLadderSync: snapshot.lastLadderUpdate");
        expect(code).not.toContain("classe: snapshot");
        expect(code).not.toContain("classe: ladderData");
    });

    it("« Vérifier » son propre pseudo rafraîchit le classement, pas celui d'un autre", () => {
        const code = stripComments(read(PUBLIC_ACTIONS));
        expect(code).toContain("profile.pseudoDofus.toLowerCase() === parsed.data.pseudo.toLowerCase()");
        expect(code).toContain("profile.dofusServerId === parsed.data.dofusServerId");
    });
});

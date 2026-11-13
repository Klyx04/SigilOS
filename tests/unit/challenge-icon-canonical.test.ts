/**
 * Icônes de **défi** (chantier « Raccord DofusDB », lot **R-2**) — un visuel **stocké** ne se rend
 * jamais brut.
 *
 * 🐛 Bug mesuré le 15/10/2026 : les modales du module Donjons & Quêtes affichaient `challenge.iconUrl`
 * **tel quel** et les icônes apparaissaient **assombries**, alors que la page God `?tab=game-data`
 * servait la bonne — elle passe, elle, par la **forme canonique du proxy interne**.
 *
 * 🛡️ Ce que ce test protège : toute URL stockée (DofusDB absolue, chemin legacy du cache disque,
 * forme déjà canonique) ressort en **forme servie** `/api/assets-dofus/challenges/{id}`, et une entrée
 * vide **ne produit rien** (fail-closed, aucune URL inventée).
 */

import { describe, expect, it } from "vitest";
import { normalizeChallengeIconUrl } from "@/lib/dofus-image-url";

describe("normalizeChallengeIconUrl", () => {
    it("réécrit une URL DofusDB vers le proxy interne (le navigateur ne parle plus à DofusDB)", () => {
        const url = normalizeChallengeIconUrl("https://api.dofusdb.fr/img/challenges/977.png");
        expect(url).toContain("/api/assets-dofus/challenges/");
        expect(url).not.toContain("dofusdb.fr");
    });

    it("réécrit un chemin stocké legacy vers le même proxy", () => {
        const url = normalizeChallengeIconUrl("/uploads/assets-dofus/challenges/977.webp");
        expect(url).toContain("/api/assets-dofus/challenges/");
    });

    it("fail-closed : une entrée vide ne produit aucune URL inventée", () => {
        expect(normalizeChallengeIconUrl(null)).toBeNull();
        expect(normalizeChallengeIconUrl(undefined)).toBeNull();
        expect(normalizeChallengeIconUrl("")).toBeNull();
        expect(normalizeChallengeIconUrl("   ")).toBeNull();
    });

    it("idempotent : une forme déjà canonique n'est pas retouchée", () => {
        const canonical = normalizeChallengeIconUrl("/uploads/assets-dofus/challenges/977.webp");
        expect(canonical).not.toBeNull();
        expect(normalizeChallengeIconUrl(canonical)).toBe(canonical);
    });
});

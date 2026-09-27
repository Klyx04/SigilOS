/**
 * Portraits des **avis de recherche** — une seule forme d'URL, servie par le proxy d'assets.
 *
 * 🐛 Mesure beta du 27/09/2026 (signalement user) : la page God « Avis de recherche »
 * (`/god/game-data/bounties`) affichait les portraits **KO** alors que l'onglet Succès
 * (`?view=bounties`, mêmes avis) les affichait correctement.
 * Cause racine mesurée : la valeur stockée est le **chemin du cache disque**
 * (`/uploads/assets-dofus/monsters/N.webp`) — servi par le standalone seulement si le WebP a
 * déjà été siphonné :
 *   · `/uploads/assets-dofus/monsters/4834.webp` → **404**
 *   · `/api/uploads/assets-dofus/monsters/4834.webp` (même fichier) → **200**
 *   · le chemin brut repasse à 200 **après** un passage par le proxy `/api/assets-dofus/…`
 *     (c'est le proxy qui télécharge le WebP).
 * La page God publiait donc le chemin brut (404) tandis que Succès passait par le proxy (200).
 *
 * Ce test verrouille les 3 étages : la règle pure (`src/lib/dofus-image-url.ts`), les points de
 * rendu publics (catalogue + fiche) et le composant de la page God.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { buildBountyBestiaireEntry, buildBountyPublicDungeon, type BountyRowInput } from "@/lib/bounty-fiche";
import { normalizeDofusAssetStoredUrl } from "@/lib/dofus-image-url";

const REPO_ROOT = path.resolve(__dirname, "../..");
const readSource = (relativePath: string) => fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");

/** Ligne `Bounty` d'un avis réel (Predagob 4834), avec la valeur RÉELLE du siphon. */
const AVIS: BountyRowInput = {
    id: "bounty-4834",
    name: "Predagob",
    level: 190,
    zoneName: "Nimotopia",
    imageUrl: "/uploads/assets-dofus/monsters/4834.webp",
    dofusdbId: 4834,
};

describe("avis de recherche — les portraits passent par le proxy d'assets", () => {
    it("le catalogue publie la forme canonique, jamais le chemin stocké", () => {
        expect(buildBountyBestiaireEntry(AVIS).imageUrl).toBe("/api/assets-dofus/monsters/4834");
    });

    it("la fiche publique (et sa carte Open Graph) publient la même forme", () => {
        expect(buildBountyPublicDungeon(AVIS).imageUrl).toBe("/api/assets-dofus/monsters/4834");
    });

    it("sans image stockée : repli sur le proxy via `dofusdbId`", () => {
        expect(buildBountyBestiaireEntry({ ...AVIS, imageUrl: null }).imageUrl).toBe(
            "/api/assets-dofus/monsters/4834"
        );
        expect(buildBountyPublicDungeon({ ...AVIS, imageUrl: null }).imageUrl).toBe(
            "/api/assets-dofus/monsters/4834"
        );
    });

    it("sans id NI image : `null` (l'appelant garde son repli visuel, jamais d'URL inventée)", () => {
        expect(buildBountyBestiaireEntry({ ...AVIS, imageUrl: null, dofusdbId: null }).imageUrl).toBeNull();
        expect(buildBountyPublicDungeon({ ...AVIS, imageUrl: null, dofusdbId: null }).imageUrl).toBeNull();
    });

    it("la page God rend le portrait via la règle partagée (aucun `<img src={imageUrl}>` brut)", () => {
        const src = readSource("src/app/god/game-data/bounties/page.tsx");
        expect(src).toContain('normalizeDofusAssetStoredUrl("monsters"');
        expect(src).not.toContain("<img src={b.imageUrl}");
        expect(src).not.toContain("<img src={selectedBounty.imageUrl}");
    });

    it("la règle pure est partagée : le constructeur de fiche l'applique, sans la réécrire", () => {
        expect(normalizeDofusAssetStoredUrl("monsters", AVIS.imageUrl, AVIS.dofusdbId)).toBe(
            "/api/assets-dofus/monsters/4834"
        );
        expect(readSource("src/lib/bounty-fiche.ts")).toContain('normalizeDofusAssetStoredUrl("monsters"');
    });
});

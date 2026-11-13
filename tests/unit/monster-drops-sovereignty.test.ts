/**
 * Garde — **souveraineté des fiches monstres** et **aucun message système à l'écran**.
 *
 * Défaut mesuré le 31/10/2026 (bêta) : `Kanigroula` servait `drops: []` alors que DofusDB
 * documente **25 butins** et que la base locale en avait **24**. Cause racine : quand DofusDB
 * répond 429 (ou ne trouve rien), `getMonsterStatsCore` fabrique un payload **bestiaire Unity**
 * (`drops: []`) et le renvoie en **succès** ; la passe de sync du cron le **persistait** par
 * dessus la fiche locale et **rafraîchissait** `lastSyncedAt` — la ligne redevenait vide, fraîche,
 * et sortait de la file de réparation. Boucle sans fin.
 *
 * Deux règles en découlent, verrouillées ici :
 *  ① **souverain** : le local n'est jamais écrasé par un échec réseau déguisé en succès ;
 *  ② **muet** : ni visiteur ni membre de guilde ne lit un état technique (synchro, siphon, God).
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { isCompleteMonsterPayload } from "@/lib/data-health";

const read = (path: string) => readFileSync(path, "utf8");

const SYNC = "src/app/api/cron/sync-monster-stats/route.ts";
const CORE = "src/lib/monster-stats-core.ts";
const PUBLIC = "src/app/boss/[dungeonId]/_components/PublicBossDetailClient.tsx";
const GUIDE = "src/components/succes/SuccesBossGuide.tsx";
const BOUNTY = "src/components/succes/BountyFicheView.tsx";
const ZONE = "src/components/worldmap/ZoneDetailModal.tsx";
const FR = "src/lib/i18n/locales/fr.ts";
const EN = "src/lib/i18n/locales/en.ts";

describe("souveraineté — un échec réseau ne remplace jamais la donnée locale", () => {
    it("la sync n'écrit aucun repli bestiaire (`source: \"unity\"`)", () => {
        const code = read(SYNC);
        // Fiches de donjon + titans : sortie anticipée avant `persistMonsterStat`.
        expect(code.match(/data\.source === "unity"/g) ?? []).toHaveLength(2);
        // Veille fiches : un repli compte comme un échec, rien n'est persisté.
        expect(code).toMatch(/res\.data\?\.source !== "unity"/);
        // Le compteur est publié dans le rapport de fin de passe (visibilité ops).
        expect(code).toMatch(/skippedUnityWrites/);
    });

    it("la source répond « aucun butin » ⇒ marqueur `dropsUnavailable` (plus de re-test nocturne)", () => {
        expect(read(CORE)).toMatch(/dropsUnavailable: \(monster\.drops \?\? \[\]\)\.length === 0/);
        // Conséquence : la fiche est « complète » pour la santé des données et la passe de réparation.
        expect(isCompleteMonsterPayload({ drops: [], dropsUnavailable: true })).toBe(true);
        expect(isCompleteMonsterPayload({ drops: [] })).toBe(false);
    });

    it("un dry-run n'écrit pas : l'auto-réparation est coupée quand `persist: false`", () => {
        // Mesure du 31/10/2026 : `reparer-butins` sans `--apply` réparait la fiche (self-healing),
        // puis `--apply` répondait « 0 fiche analysée ». Un dry-run doit être muet.
        expect(read(CORE)).toMatch(/options\?\.persist !== false/);
        expect(read("scripts/succes-speciaux.ts")).toMatch(/\{ persist: apply \}/);
    });

    it("un repli dit POURQUOI (quota / réseau / introuvable) et la passe s'arrête sur quota", () => {
        // Sans cette étiquette, la passe comptait 66 « sans source » là où c'était notre budget.
        expect(read(CORE)).toMatch(/degraded: degradedReason\(/);
        expect(read(CORE)).toMatch(/degraded: "not_found"/);
        expect(read("src/lib/monster-drops-repair.ts")).toMatch(/data\.degraded === "quota"/);
        expect(read("src/lib/monster-drops-repair.ts")).toMatch(/report\.deferred = true/);
        // Le script patiente puis reprend (convergence) au lieu de rendre la main sur un faux constat.
        expect(read("scripts/succes-speciaux.ts")).toMatch(/throttleWaitMs\(\) \+ 1_000/);
    });
});

describe("aucun message système à l'écran (visiteur ET membre de guilde)", () => {
    const SURFACES = [PUBLIC, GUIDE, BOUNTY, ZONE, FR, EN];

    it("plus une seule mention de synchro, de siphon ou de God côté écran", () => {
        for (const path of SURFACES) {
            const code = read(path);
            for (const banned of [
                "synchronisation est en cours",
                "non synchronis", // « Butin/Caractéristiques non synchronisé(e)s »
                "siphon (God",
                "God → Données de jeu",
                "Données synchronisées le",
                "noLootSynced",
            ]) {
                expect(code, `${path} contient « ${banned} »`).not.toContain(banned);
            }
        }
    });

    it("l'état vide du butin est neutre et unique (français + anglais)", () => {
        expect(read(FR)).toContain('noLootFound: "Aucun butin renseigné pour ce boss."');
        expect(read(EN)).toContain('noLootFound: "No loot listed for this boss."');
        // Une seule clé : plus de variante « non synchronisé ».
        expect(read(PUBLIC)).not.toContain("noLootSynced");
        expect(read(GUIDE)).toContain("Aucun butin renseigné pour ce boss.");
    });
});

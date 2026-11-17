/**
 * Missions — **résolution de l'illustration** (règle pure) + propagation au brouillon.
 *
 * 🛡️ Ce que ce test protège (mesure du 17/11/2026, modale « Éditer le slot ») :
 * ① le catalogue officiel ne porte **aucun** visuel pour Songes (23), Anomalies (17) et
 *    Régulations (135) : le résolveur doit les couvrir depuis les assets du jeu ;
 * ② le **titre fait autorité** (« Plongée en Paradoxe IV » → `paradoxe4.png`), avec repli
 *    sur `payload.difficulty`/`payload.level` pour les missions personnalisées ;
 * ③ les 4 **épreuves de Songes** sont reconnues quelle que soit la casse, et
 *    `payload.epreuve` est propagé au brouillon ;
 * ④ les familles de monstres suivent une **règle de translittération** (et 4 alias
 *    mesurés) — **jamais** une liste figée du disque local : le VPS monte
 *    `public/game-data` en bind mount et peut contenir des fichiers plus récents ;
 * ⑤ un fichier absent ne laisse jamais une vignette vide : `fallbackUrl` porte la bannière
 *    de catégorie (`MissionArtworkImage` s'en sert) ;
 * ⑥ les donjons passent par le **proxy** `/api/assets-dofus/monsters/<id>` (zéro 404), le
 *    chemin legacy `/uploads/assets-dofus/...` étant réécrit.
 *
 * Lecture seule : fonctions pures + existence des assets **du dépôt** (non-régression).
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
    monsterFamilyArtworkUrl,
    regulationFamilySlug,
    resolveMissionArtwork,
    resolveSongesEpreuve,
} from "@/lib/mission-artwork";
import {
    getAllOfficialMissions,
    getOfficialMissionById,
    mapOfficialToDraftMission,
} from "@/lib/game-data/guild-missions-catalog";

const publicExists = (url: string) =>
    fs.existsSync(path.resolve(process.cwd(), "public", url.replace(/^\//, "")));

describe("mission-artwork — Songes", () => {
    it("résout chaque palier depuis le TITRE (Paradoxe IV, Rêve I, Cauchemar III)", () => {
        expect(resolveMissionArtwork({ category: "SONGES", title: "Plongée en Paradoxe IV" }).imageUrl)
            .toBe("/assets/missions/paradoxe4.png");
        expect(resolveMissionArtwork({ category: "SONGES", title: "Plongée en Rêve I" }).imageUrl)
            .toBe("/assets/missions/reve1.png");
        expect(resolveMissionArtwork({ category: "SONGES", title: "Plongée en Cauchemar III" }).imageUrl)
            .toBe("/assets/missions/cauchemar3.png");
    });

    it("accepte le payload d'une mission personnalisée (difficulté + niveau)", () => {
        expect(resolveMissionArtwork({
            category: "SONGES",
            title: "",
            payload: { difficulty: "Paradoxe", level: "II", tier: 2 },
        }).imageUrl).toBe("/assets/missions/paradoxe2.png");
    });

    it("ne fabrique pas un fichier qui n'existe pas (Cauchemar IV) : repli de catégorie", () => {
        const artwork = resolveMissionArtwork({ category: "SONGES", title: "Plongée en Cauchemar IV" });
        expect(artwork.imageUrl).toBe("/assets/missions/songes.png");
        expect(artwork.fallbackUrl).toBe("/assets/missions/songes.png");
    });

    it("reconnaît les 4 épreuves quelle que soit la casse et propage le code", () => {
        expect(resolveSongesEpreuve("Épreuve FONSOCAC")).toBe("Fonsocac");
        expect(resolveSongesEpreuve("Épreuve nilezaff")).toBe("Nilezaff");
        expect(resolveSongesEpreuve("", { epreuve: "SINJSONJ" })).toBe("Sinjsonj");
        expect(resolveSongesEpreuve("Épreuve REVERSED")).toBe("Reversed");

        const artwork = resolveMissionArtwork({ category: "SONGES", title: "Épreuve FONSOCAC" });
        expect(artwork.imageUrl).toBe("/assets/missions/epreuves-songes/Fonsocac.png");
        expect(artwork.epreuve).toBe("Fonsocac");
    });

    it("couvre les 23 missions Songes du catalogue avec un fichier présent dans le dépôt", () => {
        const songes = getAllOfficialMissions().filter((m) => m.category === "SONGES");
        expect(songes).toHaveLength(23);
        for (const mission of songes) {
            const { imageUrl } = resolveMissionArtwork({ category: mission.category, title: mission.title });
            expect(imageUrl, mission.title).toMatch(/^\/assets\/missions\//);
            expect(publicExists(imageUrl!), `${mission.title} → ${imageUrl}`).toBe(true);
        }
    });

describe("mission-artwork — Anomalies", () => {
    it("distingue fragments, gardiens, cœur d'anomalie et zone", () => {
        expect(resolveMissionArtwork({ category: "ANOMALIE", title: "Collecte de fragments d'anomalie" }).imageUrl)
            .toBe("/assets/missions/fragment.png");
        expect(resolveMissionArtwork({ category: "ANOMALIE", title: "Stabilisation de gardiens d'anomalie" }).imageUrl)
            .toBe("/assets/missions/3-gardiens.png");
        expect(resolveMissionArtwork({ category: "ANOMALIE", title: "Stabilisation de donjon" }).imageUrl)
            .toBe("/assets/missions/3-gardiens.png");
        expect(resolveMissionArtwork({ category: "ANOMALIE", title: "Au cœur de l'anomalie" }).imageUrl)
            .toBe("/assets/missions/anomalie.png");
        expect(resolveMissionArtwork({ category: "ANOMALIE", title: "Régulation de zone anormale" }).imageUrl)
            .toBe("/assets/missions/ano1.png");
    });

    it("suit le type d'objectif d'une mission personnalisée (payload sans titre)", () => {
        expect(resolveMissionArtwork({ category: "ANOMALIE", payload: { type: "FRAGMENTS" } }).imageUrl)
            .toBe("/assets/missions/fragment.png");
        expect(resolveMissionArtwork({ category: "ANOMALIE", payload: { type: "STABILISATION" } }).imageUrl)
            .toBe("/assets/missions/3-gardiens.png");
    });

    it("couvre les 17 anomalies du catalogue avec un fichier présent dans le dépôt", () => {
        const anomalies = getAllOfficialMissions().filter((m) => m.category === "ANOMALIE");
        expect(anomalies).toHaveLength(17);
        for (const mission of anomalies) {
            const { imageUrl } = resolveMissionArtwork({ category: mission.category, title: mission.title });
            expect(imageUrl, mission.title).toMatch(/^\/assets\/missions\//);
            expect(publicExists(imageUrl!), `${mission.title} → ${imageUrl}`).toBe(true);
        }
    });
});

describe("mission-artwork — Régulations (familles)", () => {
    it("applique la translittération historique du disque (accents → tiret)", () => {
        expect(regulationFamilySlug("Régulation des Nécrotiques")).toBe("n-crotiques");
        expect(regulationFamilySlug("Régulation des Égarés")).toBe("gar-s");
        expect(regulationFamilySlug("Régulation de l'Équipage du Grolandais")).toBe("quipage-du-grolandais");
        expect(regulationFamilySlug("Ventre de la Baleine")).toBeNull();
    });

    it("applique les 4 alias mesurés (Blops, Brûlâmes, Calcinés, Cuirassés)", () => {
        expect(monsterFamilyArtworkUrl("Régulation des Blops")).toBe("/game-data/monsters/blop.webp");
        expect(monsterFamilyArtworkUrl("Régulation des Brûlâmes")).toBe("/game-data/monsters/br-lames.webp");
        expect(monsterFamilyArtworkUrl("Régulation des Calcinés")).toBe("/game-data/monsters/kl-mort.webp");
        expect(monsterFamilyArtworkUrl("Régulation des Cuirassés")).toBe("/game-data/monsters/harrogant.webp");
    });

    it("calcule le chemin SANS le valider contre le disque local (le VPS fait autorité)", () => {
        // Cette famille n'a AUCUN fichier dans le dépôt : le chemin est quand même produit,
        // car `public/game-data` est un bind mount plus frais en production. Le repli visuel
        // reste disponible si le fichier n'existe pas sur ce serveur.
        const artwork = resolveMissionArtwork({ category: "REGULATION", title: "Régulation des Tofus" });
        expect(artwork.imageUrl).toBe("/game-data/monsters/tofus.webp");
        expect(artwork.fallbackUrl).toBe("/banners/regulation.png");
    });

    it("les 135 régulations ont TOUTES un chemin calculé (aucun retour au pictogramme par défaut)", () => {
        const regulations = getAllOfficialMissions().filter((m) => m.category === "REGULATION");
        expect(regulations).toHaveLength(135);
        for (const mission of regulations) {
            const { imageUrl } = resolveMissionArtwork({ category: mission.category, title: mission.title });
            expect(imageUrl, mission.title).toMatch(/^\/game-data\/monsters\/[a-z0-9-]+\.webp$/);
        }
    });

    it("les visuels de famille livrés par le dépôt existent réellement (non-régression)", () => {
        for (const file of ["mis-reux", "n-crotiques", "gliglis", "phorreurs", "br-lames"]) {
            expect(publicExists(`/game-data/monsters/${file}.webp`), file).toBe(true);
        }
    });
});


describe("mission-artwork — Donjons / expéditions / événements", () => {
    it("réécrit le chemin legacy vers le proxy interne (zéro 404)", () => {
        const artwork = resolveMissionArtwork({
            category: "DONJON",
            title: "Cour du Bouftou Royal",
            monsterId: 147,
            monsterImageUrl: "/uploads/assets-dofus/monsters/147.webp",
        });
        expect(artwork.imageUrl).toBe("/api/assets-dofus/monsters/147");
        expect(artwork.fallbackUrl).toBe("/banners/donjon.png");
    });

    it("conserve une illustration locale explicite et refuse une URL arbitraire", () => {
        expect(resolveMissionArtwork({
            category: "DONJON",
            monsterId: 147,
            payload: { imageUrl: "/game-data/dungeons/donjon-bouftou.webp" },
        }).imageUrl).toBe("/game-data/dungeons/donjon-bouftou.webp");

        expect(resolveMissionArtwork({
            category: "DONJON",
            monsterId: 147,
            payload: { imageUrl: "https://exemple.invalid/x.png" },
        }).imageUrl).toBe("/api/assets-dofus/monsters/147");
    });
});

describe("mission-artwork — propagation au brouillon d'édition", () => {
    it("une mission Songes standard reçoit son visuel", () => {
        const mission = getOfficialMissionById(201); // Plongée en Paradoxe IV
        expect(mission).toBeDefined();
        const draft = mapOfficialToDraftMission(mission!);
        expect(draft.payload.imageUrl).toBe("/assets/missions/paradoxe4.png");
        expect(draft.payload.epreuve).toBeUndefined();
    });

    it("une épreuve de Songes reçoit son visuel ET son code d'épreuve", () => {
        const mission = getOfficialMissionById(434); // Épreuve FONSOCAC
        expect(mission).toBeDefined();
        const draft = mapOfficialToDraftMission(mission!);
        expect(draft.payload.epreuve).toBe("Fonsocac");
        expect(draft.payload.imageUrl).toBe("/assets/missions/epreuves-songes/Fonsocac.png");
    });

    it("une anomalie reçoit le visuel de son objectif (et non le pictogramme générique)", () => {
        const mission = getOfficialMissionById(412); // Collecte de fragments d'anomalie
        expect(mission).toBeDefined();
        const draft = mapOfficialToDraftMission(mission!);
        expect(draft.payload.imageUrl).toBe("/assets/missions/fragment.png");
    });
});

});

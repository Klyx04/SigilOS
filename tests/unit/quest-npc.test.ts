/**
 * PNJ **donneur** d'une quête — le nom, résolu **localement** (aucun réseau, aucune migration).
 *
 * 📏 Mesures du 16/10/2026 :
 *  · DofusDB `/npcs/{id}` expose `name.fr` + `look` mais **aucune image** (`/img/npcs/813.png` →
 *    **404**, alors que `/img/monsters/813.png` → **200** : la collection `npcs` n'existe pas) ;
 *  · DofusDude n'a **pas** d'endpoint PNJ (`/dofus3/v1/fr/npcs` → **404**) ;
 *  · en revanche le dépôt porte **6 494** PNJ siphonnés du client Dofus
 *    (`prisma/seed-data/npcs/npcs-client.json`, via `scripts/siphon-npcs-client.py`) ;
 *  · l'**id** est déjà dans la donnée stockée : les textes d'objectif du résumé de quête
 *    (`GameQuest.contentJson`) gardent le format DofusDB « Aller voir `{npc,813}` ».
 *
 * ⇒ on affiche le **nom** sans rien siphonner ni migrer ; le **portrait** n'existe nulle part et
 * n'est donc jamais affiché.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { npcIdFromQuestContent, npcNameById, resolveQuestNpc, type NpcNameEntry } from "@/lib/npc-name";

const REPO_ROOT = path.resolve(__dirname, "../..");
const readSource = (relativePath: string) => fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");

/** Table réelle du dépôt (celle que le serveur charge au runtime). */
const REAL_NPCS = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "prisma", "seed-data", "npcs", "npcs-client.json"), "utf8")
) as NpcNameEntry[];

const digest = (textes: string[]) => ({
    version: 1,
    steps: [{ id: 1, name: "Étape 1", objectives: textes.map((text, i) => ({ id: i + 1, text, mapId: 1 })), rewards: {} }],
});

describe("npc-name — règles pures (id lu dans la donnée déjà stockée)", () => {
    it("extrait l'id du premier objectif qui nomme un PNJ (« Aller voir {npc,813} »)", () => {
        expect(npcIdFromQuestContent(digest(["Aller voir {npc,813}"]))).toBe(813);
        // Le premier objectif sans PNJ n'empêche pas de trouver le suivant.
        expect(npcIdFromQuestContent(digest(["Parler au garde", "Aller voir {npc,4370}"]))).toBe(4370);
        // Deux PNJ : le premier de l'ordre canonique (donc du début de quête).
        expect(npcIdFromQuestContent(digest(["Aller voir {npc,12}", "Aller voir {npc,34}"]))).toBe(12);
    });

    it("ne fabrique jamais un id : sans jeton PNJ ou sans donnée, c'est `null`", () => {
        expect(npcIdFromQuestContent(digest(["Combat de 5 monstres"]))).toBeNull();
        expect(npcIdFromQuestContent(null)).toBeNull();
        expect(npcIdFromQuestContent({})).toBeNull();
        expect(npcIdFromQuestContent("pas un objet")).toBeNull();
        // Un id nul ou non entier est refusé.
        expect(npcIdFromQuestContent(digest(["Aller voir {npc,0}"]))).toBeNull();
    });

    it("résout le nom dans la table locale — vérifié sur la VRAIE table du dépôt", () => {
        expect(REAL_NPCS.length).toBeGreaterThan(6000);
        expect(npcNameById(REAL_NPCS, 813)).toBe("Maître des clefs");
        expect(npcNameById(REAL_NPCS, 1232)).toBe("Félix Nowel");
        // Id inconnu, id inexploitable, table absente : `null` (jamais un nom inventé).
        expect(npcNameById(REAL_NPCS, 99999999)).toBeNull();
        expect(npcNameById(REAL_NPCS, null)).toBeNull();
        expect(npcNameById(null, 813)).toBeNull();
    });

    it("rend la référence complète (id + nom) ou rien", () => {
        expect(resolveQuestNpc(digest(["Aller voir {npc,813}"]), REAL_NPCS)).toEqual({ id: 813, name: "Maître des clefs" });
        expect(resolveQuestNpc(digest(["Aller voir {npc,99999999}"]), REAL_NPCS)).toBeNull();
        expect(resolveQuestNpc(digest(["Combat"]), REAL_NPCS)).toBeNull();
    });
});

describe("npc-name — câblage (dashboard ET embed, même source)", () => {
    it("le post publie la référence et l'embed la pose — sans appel réseau", () => {
        const src = readSource("src/server/actions/dungeon-finder-actions.ts");
        expect(src).toContain("questNpc: resolveQuestNpc(questContentById.get(Number(p.questId)), npcEntries)");
        expect(src).toContain("questNpc?: { id: number; name: string } | null");
        // Même résolveur pour l'embed Discord (donc site et Discord ne divergent pas).
        expect(src).toContain("async function resolvePostQuestNpc(");
        expect(src).toContain('if (post.mode === "QUETE") {');
        expect(src).toContain('fields.push({ name: "🧑‍🌾 Aller voir", value: npc.name, inline: true })');
        // La source est LOCALE : aucun fetch DofusDB pour un nom de PNJ.
        const npcData = readSource("src/server/game/npc-data.ts");
        expect(npcData).toContain('"prisma", "seed-data", "npcs", "npcs-client.json"');
        expect(npcData).not.toContain("fetch(");
        const lib = readSource("src/lib/npc-name.ts");
        expect(lib).not.toContain("fetch(");
    });

    it("le détail du post affiche « Aller voir <nom> » quand la quête en porte un", () => {
        const detail = readSource("src/components/dungeon-finder/DjPostDetailModal.tsx");
        expect(detail).toContain("post.questNpc && (");
        expect(detail).toContain("{post.questNpc.name}");
    });
});

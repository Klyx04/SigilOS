/**
 * Simulation tactique — **tous les boss de la salle sont posables**.
 *
 * 🐛 Demande user du 11/10/2026 : « on devrait être en mesure pour les doubles boss
 * Frigost de poser à la fois le Comte Harebourg et son boss associé, et pour les 4
 * Cavaliers de l'Apocalypse on devrait pouvoir poser les 4 cavaliers, pas uniquement
 * Servitude ».
 *
 * Cause mesurée : `SpellRangeGrid` filtrait `!m.isBoss` — tout boss autre que celui de
 * l'en-tête était donc écarté de la salle (le boss de l'en-tête occupant la place 1).
 *
 * 🔒 Ce que la garde verrouille : ① un double boss laisse poser les DEUX ; ② les 4
 * Cavaliers sont tous posables ; ③ le boss déjà en place 1 n'est jamais proposé deux
 * fois ; ④ la grille consomme bien la règle pure (et ne refiltre plus sur `isBoss`).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { selectableRoomMonsters } from "@/lib/simulation-room-monsters";

describe("simulation — monstres posables dans la salle (boss compris)", () => {
    it("① double boss Frigost : le boss associé est posable à côté du Comte", () => {
        const salle = [
            { name: "Comte Harebourg", isBoss: true },
            { name: "Sylargh", isBoss: true },
            { name: "Frizz", isBoss: false },
        ];
        expect(selectableRoomMonsters(salle, "Comte Harebourg").map((m) => m.name)).toEqual([
            "Sylargh",
            "Frizz",
        ]);
    });

    it("② les 4 Cavaliers de l'Apocalypse sont tous posables (et pas seulement Servitude)", () => {
        const salle = [
            { name: "Servitude", isBoss: true },
            { name: "Misère", isBoss: true },
            { name: "Désolation", isBoss: true },
            { name: "Angoisse", isBoss: true },
        ];
        const posables = selectableRoomMonsters(salle, "Servitude");
        // 3 proposés + Servitude déjà en place 1 = les 4 Cavaliers sur la grille.
        expect(posables).toHaveLength(3);
        expect(posables.map((m) => m.name)).toEqual(["Misère", "Désolation", "Angoisse"]);
    });

    it("③ le boss déjà placé en position 1 n'est jamais proposé deux fois", () => {
        const salle = [{ name: "Comte Harebourg", isBoss: true }, { name: "Sylargh", isBoss: true }];
        const posables = selectableRoomMonsters(salle, "  comte   HAREBOURG ");
        expect(posables.map((m) => m.name)).toEqual(["Sylargh"]);
    });

    it("④ la grille consomme la règle pure et ne refiltre plus sur `isBoss`", () => {
        const code = readFileSync("src/components/succes/SpellRangeGrid.tsx", "utf8");
        expect(code).toMatch(/selectableRoomMonsters\(monsters, bossName\)/);
        // Le filtre fautif (« monstres accompagnateurs hors boss ») a disparu.
        expect(code).not.toMatch(/!\s*m\.isBoss/);
    });

    it("⑤ l'overlay ne renvoie plus sur la fiche du boss principal quand on choisit un autre boss", () => {
        // Même maladie que la grille : `if (m.isBoss || …) setActiveMonsterName(null)`
        // rendait Sylargh (ou les 3 autres Cavaliers) inaccessibles — le clic ramenait au
        // boss de l'en-tête. Seul CE boss doit ramener à l'état par défaut.
        const code = readFileSync("src/components/boss-overlay/BossOverlayClient.tsx", "utf8");
        expect(code).not.toMatch(/if \(m\.isBoss \|\| m\.name === selected\?\.bossName\)/);
        expect(code).toMatch(/setActiveMonsterName\(m\.name === selected\?\.bossName \? null : m\.name\)/);
    });
});

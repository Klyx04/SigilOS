import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { DO_TAGS } from "@/lib/dofus-tags";

/**
 * Les filtres affichent les vrais assets du jeu (aucun emoji) : chaque icône
 * référencée par `DO_TAGS` + les icônes d'onglets de la fiche stuff doivent
 * exister sur disque (même garde-fou que BUG-4 pour les stats).
 */
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const PUBLIC_DIR = path.join(PROJECT_ROOT, "public");

const BUILD_TAB_ICONS = [
    "/assets/dofus/game-icons/crossed-swords.png",
    "/assets/dofus-ui/pictos/sort.png",
    "/assets/dofus/game-icons/chest.png",
    "/assets/dofus-ui/pictos/combat-tactique.png",
];

describe("🏷️ Filtres & onglets — vrais assets du jeu", () => {
    it("chaque tag élément/bi-élément/stats a au moins une icône réelle", () => {
        const withIcons = ["eau", "feu", "terre", "air", "multi", "tank", "dopou", "pp", "terrefeu", "terreeau", "terreair", "feueau", "feuair", "eauair", "ini", "retpm", "retpa", "sagesse", "multinocrit", "docrit", "soin"];
        for (const id of withIcons) {
            const tag = DO_TAGS.find((t) => t.id === id);
            expect(tag, `tag ${id} manquant`).toBeDefined();
            expect(tag?.icons?.length ?? 0, `tag ${id} sans icône`).toBeGreaterThan(0);
        }
    });

    it("chaque icône de tag existe sur disque (aucun 404)", () => {
        const missing: string[] = [];
        for (const tag of DO_TAGS) {
            for (const icon of tag.icons ?? []) {
                if (!fs.existsSync(path.join(PUBLIC_DIR, icon.replace(/^\//, "")))) {
                    missing.push(`${tag.id} → ${icon}`);
                }
            }
        }
        expect(missing).toEqual([]);
    });

    it("les 4 icônes d'onglets de la fiche stuff existent sur disque", () => {
        for (const icon of BUILD_TAB_ICONS) {
            expect(fs.existsSync(path.join(PUBLIC_DIR, icon.replace(/^\//, ""))), `${icon} manquant`).toBe(true);
        }
    });

    it("l'icône d'ennemi poutch de la simulation existe sur disque", () => {
        expect(fs.existsSync(path.join(PUBLIC_DIR, "assets", "icons", "poutch.png")), "poutch.png manquant").toBe(true);
    });
});

describe("🔔 Fenêtre de notifications — assets du jeu", () => {
    const NOTIF_ICONS = [
        "/assets/dofus/game-icons/bell-on.png",
        "/assets/dofus/game-icons/bell-off.png",
        "/assets/icons/icone-quete.png",
        "/assets/icons/succes.png",
        "/assets/dofus-ui/pictos/songes.png",
        "/assets/dofus-ui/pictos/donjon.png",
        "/assets/missions/event.png",
        "/assets/dofus/game-icons/question-mark.png",
        "/assets/icons/ocre.png",
        "/assets/dofus/game-icons/shop.png",
        "/assets/dofus/game-icons/shield.png",
    ];

    it("chaque icône de catégorie existe sur disque (aucun 404)", () => {
        for (const icon of NOTIF_ICONS) {
            expect(fs.existsSync(path.join(PUBLIC_DIR, icon.replace(/^\//, ""))), `${icon} manquant`).toBe(true);
        }
    });
});

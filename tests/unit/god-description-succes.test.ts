/**
 * God game-data — la description **siphonnée** d'un succès doit être visible ET corrigeable.
 *
 * Constat user du 10/12/2026 : « affiche dans l'éditeur God game-data la description siphonnée
 * de chaque succès que je peux éditer / ajouter à la volée ». Or l'éditeur ne montrait que des
 * icônes : la mécanique écrite par `achievement-details-siphon.ts` (colonne
 * `DungeonAchievement.description`, le titre restant le « Spécial » partagé — `Challenge.slug`
 * est `@unique`, on ne peut pas avoir une ligne « Spécial » par donjon) était invisible, donc
 * incorrigible à la main quand le siphon n'a rien trouvé.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(p, "utf8");

const ACTIONS = "src/server/actions/game-data-admin-actions.ts";
const CLIENT = "src/components/admin/DungeonManager.tsx";

/** Corps de `updateDungeonAchievementDescription` (de sa signature à l'action suivante). */
function actionBody(): string {
    const code = read(ACTIONS);
    const start = code.indexOf("export async function updateDungeonAchievementDescription");
    expect(start, "l'action d'édition de la description a disparu").toBeGreaterThan(-1);
    return code.slice(start, code.indexOf("export async function createDungeon", start));
}

describe("description d'un succès — écrite par le siphon, corrigeable dans le God", () => {
    it("l'action est fail-closed (super-admin), bornée et journalisée", () => {
        const body = actionBody();
        expect(body).toContain("requireSuperAdmin()");
        expect(body).toContain('return { success: false, error: "Accès refusé" }');
        // Le bornage vit juste au-dessus de l'action (schéma dédié) : on lit le fichier entier.
        expect(read(ACTIONS)).toContain("const DungeonAchievementDescriptionSchema = z.string().max(600)");
        expect(body).toContain("logGameDataWrite(");
    });

    it("écrit la colonne PAR DONJON, jamais le challenge partagé « Spécial »", () => {
        const body = actionBody();
        expect(body).toContain("db.dungeonAchievement.update");
        expect(body).not.toContain("db.challenge.update");
        // Une description vide efface la valeur, elle ne laisse pas une chaîne vide en base.
        expect(body).toContain("clean || null");
    });

    it("le God AFFICHE la description de chaque succès (plus seulement l'icône)", () => {
        const client = read(CLIENT);
        expect(client).toContain('a.description?.trim() || "aucune description siphonnée"');
        expect(client).toContain("a.challenge.name");
        // Le type client porte la colonne : sans elle, l'affichage serait `undefined` silencieux.
        expect(client).toMatch(/achievements: \{ id: string;[^}]*description\?: string \| null;/);
    });

    it("et permet de la poser à la volée : champ borné + une seule porte d'écriture", () => {
        const client = read(CLIENT);
        expect(client).toContain("maxLength={600}");
        expect(client).toContain("updateDungeonAchievementDescription");
        expect(client).toContain("saveAchievementDescription");
        // Mise à jour optimiste ciblée : on ne recharge pas les 141 donjons pour un champ.
        expect(client).toContain("a.id === id ? { ...a, description:");
    });
});

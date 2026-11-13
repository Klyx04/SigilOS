import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Missions UI Deslop & Normes", () => {
    const missionCardPath = path.resolve(process.cwd(), "src/components/missions/mission-card.tsx");
    const guildProgressBarPath = path.resolve(process.cwd(), "src/components/missions/guild-progress-bar.tsx");
    const categoryFormsPath = path.resolve(process.cwd(), "src/components/missions/category-forms.tsx");
    const missionCardCode = fs.readFileSync(missionCardPath, "utf-8");
    const guildProgressBarCode = fs.readFileSync(guildProgressBarPath, "utf-8");
    const categoryFormsCode = fs.readFileSync(categoryFormsPath, "utf-8");

    it("utilise ano1.png pour les missions anomalie (et non anomalie.png)", () => {
        expect(missionCardCode).toContain('"/assets/missions/ano1.png"');
        expect(categoryFormsCode).toContain('"/assets/missions/ano1.png"');
        // Vérifie qu'ano1.png existe sur le disque
        const ano1DiskPath = path.resolve(process.cwd(), "public/assets/missions/ano1.png");
        expect(fs.existsSync(ano1DiskPath)).toBe(true);
    });

    it("ne décolore plus les images anomalie et songes (pas de mix-blend-luminosity ni grayscale)", () => {
        // L'illustration ne doit plus avoir de mix-blend-luminosity ni opacity-70 qui noircit/décolore l'image
        expect(missionCardCode).not.toContain("mix-blend-luminosity");
        expect(missionCardCode).not.toContain("grayscale-[0.2]");
        expect(missionCardCode).not.toContain("object-cover opacity-70 mix-blend-luminosity");
    });

    it("supprime les badges du palier (Bronze, Argent, Or, Platine) et garde l'XP par jalon", () => {
        // Les gros badges avec médailles/trophées et libellés Bronze/Argent/Or/Platine sont supprimés
        expect(guildProgressBarCode).not.toContain('label: "Bronze"');
        expect(guildProgressBarCode).not.toContain('label: "Argent"');
        expect(guildProgressBarCode).not.toContain('label: "Or"');
        expect(guildProgressBarCode).not.toContain('label: "Platine"');
        // L'XP par jalon est conservée
        expect(guildProgressBarCode).toContain("step.xp");
        expect(guildProgressBarCode).toContain("xpDisplay");
    });

    it("supprime la classe d'animation kitch mission-card-ring", () => {
        expect(missionCardCode).not.toContain("mission-card-ring");
    });

    it("affiche l'asset / illustration dans les cartes de la grille de mission-editor", () => {
        const missionEditorPath = path.resolve(process.cwd(), "src/components/missions/mission-editor.tsx");
        const missionEditorCode = fs.readFileSync(missionEditorPath, "utf-8");

        expect(missionEditorCode).toContain("imageUrl");
        expect(missionEditorCode).toContain("/uploads/assets-dofus/monsters/");
        expect(missionEditorCode).toContain("img");
        expect(missionEditorCode).toContain("CategoryIcon");
    });

    it("propose directement le choix silencieux vs reping Discord dans mission-publish-flow-dialog lors d'un republish", () => {
        const publishDialogPath = path.resolve(process.cwd(), "src/components/missions/mission-publish-flow-dialog.tsx");
        const publishDialogCode = fs.readFileSync(publishDialogPath, "utf-8");

        // Présence du mode republish direct
        expect(publishDialogCode).toContain("handleSilentSave");
        expect(publishDialogCode).toContain("handleRepingSave");
        expect(publishDialogCode).toContain("Enregistrer sans ping");
        expect(publishDialogCode).toContain("Repinger la guilde sur Discord");
        // Première publication
        expect(publishDialogCode).toContain("handleFirstPublish");
        expect(publishDialogCode).toContain("DiscordEmbedPreview");
    });
});

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
        // Source unique = le résolveur d'artwork ; `mission-card` ne construit plus de chemin.
        const resolverCode = fs.readFileSync(
            path.resolve(process.cwd(), "src/lib/mission-artwork.ts"),
            "utf-8",
        );
        expect(resolverCode).toContain('"/assets/missions/ano1.png"');
        expect(categoryFormsCode).toContain('"/assets/missions/ano1.png"');
        expect(missionCardCode).toContain("resolveMissionArtwork");
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

        // Le visuel ne se construit plus dans le composant : il vient du résolveur unique
        // (Songes/Anomalies/familles + proxy `/api/assets-dofus/monsters/<id>`).
        expect(missionEditorCode).toContain("resolveMissionArtwork");
        expect(missionEditorCode).toContain("MissionArtworkImage");
        expect(missionEditorCode).toContain("fallbackSrc");
        expect(missionEditorCode).toContain("CategoryIcon");
    });

    it("n'affiche plus de pictogramme de catégorie devant le titre de la mission", () => {
        // Retiré le 17/11/2026 (demande user) : le glyphe générique collé au titre faisait
        // doublon avec l'illustration réelle et le libellé de catégorie du corps de carte.
        expect(missionCardCode).not.toContain('<Icon className={cn("w-3.5 h-3.5", config.color)} />');
        const validationCode = fs.readFileSync(
            path.resolve(process.cwd(), "src/components/missions/validation-card.tsx"),
            "utf-8",
        );
        expect(validationCode).not.toContain("CATEGORY_CONFIG");
        expect(validationCode).not.toContain("config.icon");
    });

    it("propose directement le choix silencieux vs reping Discord dans mission-publish-flow-dialog lors d'un republish", () => {
        const publishDialogPath = path.resolve(process.cwd(), "src/components/missions/mission-publish-flow-dialog.tsx");
        const publishDialogCode = fs.readFileSync(publishDialogPath, "utf-8");

        // Présence du mode republish direct
        expect(publishDialogCode).toContain("handleSilentSave");
        expect(publishDialogCode).toContain("handleRepingSave");
        expect(publishDialogCode).toContain("Enregistrer sans annonce Discord");
        expect(publishDialogCode).toContain("Repinger la guilde sur Discord");
        // Première publication
        expect(publishDialogCode).toContain("handleFirstPublish");
        expect(publishDialogCode).toContain("DiscordEmbedPreview");
    });
});

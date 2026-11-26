import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Panneau « Ma progression par Dofus » — vue **personnelle** par défaut, granulaire sur demande.
 *
 * Mesure du 26/11/2026 : les blocs se mettaient à jour en local, mais le panneau restait sur
 * la prop serveur (agrégat « au moins un personnage »). Il fallait donc :
 *  · démarrer sur le personnage actif, avec le même compteur de **quêtes** que la carte de bloc ;
 *  · garder « Tous les personnages » pour la vue granulaire de la guilde ;
 *  · alimenter le panneau avec l'état **local** du personnage actif, pas seulement le serveur.
 */

const PANEL = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/GuildStatusPanel.tsx";
const TIMELINE = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";
const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("panneau Dofus — personnage actif d'abord", () => {
    it("démarre sur Mon personnage, avec la bascule Tous les personnages", () => {
        const panel = read(PANEL);
        expect(panel).toContain('useState<"all" | "me">("me")');
        expect(panel).toContain("groupGuildProgressByCharacter");
        expect(panel).toContain("excludeLegacyProfilesForViewer");
        expect(panel).toContain("panelCharacters");
        expect(panel).toContain("Tous les personnages");
        expect(panel).toContain("Mon personnage");
    });

    it("les cartes et la fiche lisent les personnages, pas les profils", () => {
        const panel = read(PANEL);
        expect(panel).toContain("panelCharacters.flatMap");
        expect(panel).toContain("panelProgress.some");
        expect(panel).toContain("character.characterSlot");
        expect(panel).toContain("character.name");
        expect(panel).toContain("personnage(s) engagé(s)");
    });

    it("le pourcentage personnel suit les quêtes, pas les blocs", () => {
        const panel = read(PANEL);
        expect(panel).toContain("viewerDone");
        expect(panel).toContain("viewerTotal");
        expect(panel).toContain("viewerPct");
        expect(panel).toContain("const displayPct = personal ? d.viewerPct : d.pct");
        expect(panel).toContain("quêtes validées par ${characterLabel}");
    });

    it("la timeline remplace les lignes du personnage actif par son état local", () => {
        const timeline = read(TIMELINE);
        expect(timeline).toContain("viewerProgressRows");
        expect(timeline).toContain("mergeViewerProgressRows");
        expect(timeline).toContain("guildProgress={guildProgressForDofusPanel}");
    });

    it("le refresh de la progression est un debounce TRAILING", () => {
        const timeline = read(TIMELINE);
        const start = timeline.indexOf("const scheduleLiveRefresh");
        const block = timeline.slice(start, start + 900);
        expect(block).toContain("window.clearTimeout(liveRefreshTimer.current)");
        expect(block).toContain("window.setTimeout");
    });
});

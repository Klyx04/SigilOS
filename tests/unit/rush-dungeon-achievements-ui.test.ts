/**
 * Bloc I — câblage des succès de donjon dans les trois surfaces.
 *
 * Ce que ces verrous tiennent (lecture de fichier, pas de rendu) :
 *  · le `+` est proposé par la carte et filtré par la règle unique ;
 *  · le panneau et la fiche détail transmettent le callback ;
 *  · le dashboard et l'overlay montent la modale, le guide public passe par sa couture ;
 *  · le guide public n'importe aucun code `@/server/` ;
 *  · la coquille pleine et la mini-modale gardent leurs contrats de taille/qualité.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const CARD = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayDungeonCard.tsx";
const DUNGEON_PANEL = "src/components/dofus-quests/rush/RushQuestDungeonsPanel.tsx";
const DETAIL = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayQuestDetailModal.tsx";
const LIST_ITEM = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayQuestListItem.tsx";
const DASHBOARD = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";
const PUBLIC = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";
const OVERLAY = "src/app/overlay/guide/[guildId]/[slug]/GuideOverlayClient.tsx";
const PANEL_UI = "src/components/dofus-quests/rush/DungeonAchievementsPanel.tsx";
const FULL_MODAL = "src/components/dofus-quests/rush/DungeonAchievementsModal.tsx";
const MINI_MODAL =
    "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayDungeonAchievementsModal.tsx";
const SEAM = "src/app/guides/rush-sylvestre/_actions/public-dungeon-achievements.ts";

describe("Carte donjon — le bouton +", () => {
    it("n'ouvre que les donjons requis et résolus (règle unique)", () => {
        const code = read(CARD);
        expect(code).toContain('import { canOpenDungeonAchievements } from "@/lib/rush-dungeon-achievements"');
        expect(code).toMatch(/canOpenDungeonAchievements\(dj\)/);
        expect(code).toContain("Voir les succès de");
    });
});

describe("Panneau et fiche détail — pass-through", () => {
    it("le panneau des donjons transmet le callback", () => {
        expect(read(DUNGEON_PANEL)).toContain("onOpenAchievements={onOpenAchievements}");
    });

    it("la fiche détail transmet le callback", () => {
        const code = read(DETAIL);
        expect(code).toContain("onOpenAchievements?: (dungeonKey: string, dungeon: DungeonInfo) => void");
        expect(code).toContain("onOpenAchievements={onOpenAchievements}");
    });

    it("la ligne de quête de l'overlay transmet le callback au popover", () => {
        const code = read(LIST_ITEM);
        expect(code).toContain("onOpenAchievements?: (sequenceId: string, dungeonKey: string, dungeon: DungeonInfo) => void");
        expect(code).toMatch(/onOpenAchievements\(seq\.id, key, dungeon\)/);
    });
});

describe("Dashboard — modale pleine", () => {
    it("monte la modale et utilise la table canonique par l'action du panneau", () => {
        const code = read(DASHBOARD);
        expect(code).toContain('import { DungeonAchievementsModal } from "@/components/dofus-quests/rush/DungeonAchievementsModal"');
        expect(code).toContain("getRushDungeonAchievementPanel(");
        expect(code).toContain("toggleDungeonAchievement(");
        expect(code).toMatch(/mode="member"/);
    });

    it("le + est gaté par canViewSucces (RBAC)", () => {
        expect(read(DASHBOARD)).toContain("canViewSucces ? openDungeonAchievements : undefined");
    });
});

describe("Guide public — couture serveur", () => {
    it("n'importe aucun code @/server/", () => {
        // On teste l'IMPORT, pas une mention en commentaire (le fichier documente le verrou).
        expect(read(PUBLIC)).not.toMatch(/from\s+["']@\/server\//);
    });

    it("passe par la couture _actions dédiée", () => {
        const code = read(PUBLIC);
        expect(code).toContain('from "@/app/guides/rush-sylvestre/_actions/public-dungeon-achievements"');
        expect(code).toContain("getMyRushDungeonAchievementPanel(");
        expect(code).toContain("getRushDungeonAchievementCatalogue(");
        expect(code).toContain("toggleMyRushDungeonAchievement(");
    });

    it("la couture appelle les gardes serveur existantes", () => {
        const code = read(SEAM);
        expect(code).toContain("getPublicRushDungeonAchievementPanel");
        expect(code).toContain("togglePublicDungeonAchievement");
        expect(code).toContain("getPublicDungeonAchievements");
    });
});

describe("Overlay — mini-modale", () => {
    it("monte la mini-modale et déduit le mode de la surface", () => {
        const code = read(OVERLAY);
        expect(code).toContain('import { RushOverlayDungeonAchievementsModal } from "./components/RushOverlayDungeonAchievementsModal"');
        expect(code).toContain("achievementPanelMode({ guildId, isGuest, feedbackSignedIn })");
        expect(code).toContain("<RushOverlayDungeonAchievementsModal");
    });

    it("le guest ne reçoit aucun toggler", () => {
        expect(read(OVERLAY)).toContain('toggle={achievementMode === "guest" ? undefined : activeAchievementToggler}');
    });
});

describe("Panneau partagé — lecture seule et DA", () => {
    it("le mode guest ne peut pas cocher", () => {
        expect(read(PANEL_UI)).toContain('mode !== "guest"');
    });

    it("n'affiche ni les points +10 ni de case au lecteur seul", () => {
        const code = read(PANEL_UI);
        expect(code).not.toContain("+{achievement.points}");
        expect(code).toContain("{canEdit ? (");
    });

    it("réutilise les deux boutons d'état partagés", () => {
        expect(read(PANEL_UI)).toContain('import { DungeonStateButton } from "./DungeonStateButton"');
        expect(read(PANEL_UI)).toContain("<DungeonStateButton");
    });

    it("aucun filtre CSS ni flou sur la liste", () => {
        const code = read(PANEL_UI);
        expect(code).not.toMatch(/backdrop-blur|blur-\w/);
        expect(code).not.toMatch(/style=\{\{[^}]*filter/);
    });

    it("la modale pleine est en qualité haute et largeur bornée", () => {
        const code = read(FULL_MODAL);
        expect(code).toContain('data-quality="high"');
        expect(code).toContain("w-[min(42rem,calc(100vw-2rem))]");
    });

    it("la mini-modale est en qualité basse et largeur bornée", () => {
        const code = read(MINI_MODAL);
        expect(code).toContain('data-quality="low"');
        expect(code).toContain("w-[min(21.25rem,calc(100vw-1rem))]");
        expect(code).toContain("ownerDocument");
    });
});

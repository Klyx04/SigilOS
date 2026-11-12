/**
 * Chantier 4 — **finitions anonymes** (F3 → F6) du guide public.
 *
 * Ce que ce verrou protège :
 *
 * 1. **F3/F5** : un anonyme n'a ni Metamob ni Rush Live — le trou de la rangée ne doit pas
 *    rester vide, et il ne doit pas être rempli par une tuile factice. Le panneau dit ce
 *    qu'un profil apporte, **sans second bouton** (le CTA du bandeau reste le seul) ;
 * 2. **F4** : la rangée recherche + Options respire (le champ et le menu ne sont plus collés) ;
 * 3. **F6** : au-delà de trois prérequis, la page replie la liste — l'overlay garde sa modale,
 *    on ne duplique pas une troisième forme.
 */

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dofusMilestoneStats } from "@/lib/rush-dofus-progress";

const read = (path: string) => readFileSync(path, "utf8");
const stripComments = (code: string) =>
    code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const PUBLIC = "src/app/guides/rush-sylvestre/_components/PublicRushGuideClient.tsx";
const MEMBER = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/RushTimelineClient.tsx";
const OVERLAY = "src/app/overlay/guide/[guildId]/[slug]/components/RushOverlayQuestListItem.tsx";
const MEMBER_PANEL = "src/app/dashboard/[guildId]/quetes-dofus/guide/[slug]/GuildStatusPanel.tsx";
const DOFUS_PANEL = "src/app/guides/rush-sylvestre/_components/PublicDofusProgressPanel.tsx";
const DETAIL_MODAL = "src/components/dofus-quests/rush/RushDofusDetailModal.tsx";

describe("F6 — les prérequis s'ouvrent dans la modale de l'overlay", () => {
    it("la page publique et le guide membre utilisent la MÊME modale", () => {
        const pub = stripComments(read(PUBLIC));
        const member = stripComments(read(MEMBER));
        expect(pub).toContain("<RushOverlayPrereqModal");
        expect(member).toContain("<RushOverlayPrereqModal");
        // Une seule ligne cliquable, comme l'overlay : plus de mur de chips.
        expect(pub).toContain("quêtes à terminer avant");
        expect(member).toContain("quêtes à terminer");
    });

    it("plus aucun mur de chips : le repli `<details>` a disparu", () => {
        const pub = stripComments(read(PUBLIC));
        const member = stripComments(read(MEMBER));
        expect(pub).not.toContain("RushPrereqCollapse");
        expect(member).not.toContain("RushPrereqCollapse");
        expect(member).not.toMatch(/prereqRefs\.map\(/);
        expect(existsSync("src/components/dofus-quests/rush/RushPrereqCollapse.tsx")).toBe(false);
        expect(existsSync("src/lib/rush-prereq-display.ts")).toBe(false);
    });

    it("l'overlay garde sa forme (même composant, aucune variante)", () => {
        const overlay = stripComments(read(OVERLAY));
        expect(overlay).toContain("RushOverlayPrereqModal");
    });
});

describe("F3/F4/F5 — la rangée anonyme respire et dit ce qu'un profil apporte", () => {
    const pub = stripComments(read(PUBLIC));

    it("F3 — la rangée des tuiles a un espacement commun (plus de tuiles collées)", () => {
        expect(pub).toContain('className="flex flex-wrap items-stretch gap-4 px-4 py-3.5 sm:px-5"');
    });

    it("F4 — la rangée recherche + Options n'est plus collée", () => {
        expect(pub).toContain(
            'className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5"'
        );
        expect(pub).toContain('className="relative min-w-0 flex-1 sm:max-w-lg"');
    });

    it("F5 — l'espace libre porte le panneau, et AUCUN second bouton", () => {
        const start = pub.indexOf("{!visitor && !isConnected ? (");
        expect(start).toBeGreaterThan(-1);
        const end = pub.indexOf(") : null}", start);
        const panel = pub.slice(start, end);
        expect(panel).toContain("Avec un profil visiteur");
        // Les trois gains annoncés, dans l'ordre du brief : communauté, sauvegarde, Metamob.
        expect(panel).toContain("quêtes validées");
        expect(panel).toContain("progression sauvegardée");
        expect(panel).toContain("Metamob Ocre");
        // Le CTA reste celui du bandeau : une seule action mise en avant par écran.
        expect(panel).not.toContain("<button");
        expect(panel).not.toContain("<Link");
    });

    it("F5 — le panneau n'apparaît ni pour un connecté ni sur mobile", () => {
        expect(pub).toContain("!visitor && !isConnected");
        expect(pub).toContain("hidden min-w-0 flex-1 items-center border-l border-border pl-4 md:flex");
    });
});

describe("F1 — progression personnelle par Dofus, et l'Ocre en deux mesures", () => {
    it("compte les blocs par Dofus, ignore un bloc sans Dofus ou d'un Dofus inconnu", () => {
        const stats = dofusMilestoneStats(
            [
                { id: "o1", dofusId: "ocre" },
                { id: "o2", dofusId: "ocre" },
                { id: "e1", dofusId: "emeraude" },
                { id: "sans-dofus", dofusId: null },
                { id: "sans-champ" },
                { id: "inconnu", dofusId: "dofus-qui-n-existe-pas" },
            ],
            ["o1"]
        );
        expect(stats.map((stat) => stat.id)).toEqual(["ocre", "emeraude"]);
        expect(stats[0]).toMatchObject({ id: "ocre", done: 1, total: 2, pct: 50 });
        expect(stats[1]).toMatchObject({ id: "emeraude", done: 0, total: 1, pct: 0 });
    });

    it("rend une liste vide quand rien n'est rattaché à un Dofus", () => {
        expect(dofusMilestoneStats([{ id: "a" }], [])).toEqual([]);
        expect(dofusMilestoneStats([], [])).toEqual([]);
    });

    it("un bloc coché deux fois ne compte qu'une fois", () => {
        const stats = dofusMilestoneStats([{ id: "o1", dofusId: "ocre" }], ["o1", "o1"]);
        expect(stats[0]).toMatchObject({ done: 1, total: 1, pct: 100 });
    });

    it("la page branche la règle sur le guide COMPLET, pas sur la route filtrée", () => {
        const pub = stripComments(read(PUBLIC));
        expect(pub).toContain("dofusMilestoneStats(rawMilestones, completedIds)");
        expect(pub).toContain("<PublicDofusProgressPanel");
    });

    it("chaque Dofus est cliquable, dans LES DEUX vues (plus de rangée morte)", () => {
        const panel = stripComments(read(DOFUS_PANEL));
        // Une fois dans « Moi », une fois dans « Communauté » : même geste, même fiche.
        expect(panel.match(/onClick=\{\(\) => setOpenDofusId\(stat\.id\)\}/g)?.length).toBe(2);
        expect(panel).toContain("<RushDofusDetailModal");
        expect(panel).toContain("completedSeqIds.has(sequence.id)");
        expect(panel).toContain("sequence.id === bookmarkedSeqId");
    });

    it("l'onglet Communauté n'existe que pour un compte, et se charge À LA DEMANDE", () => {
        const panel = stripComments(read(DOFUS_PANEL));
        expect(panel).toContain("canSeeCommunity ? (");
        expect(panel).toContain("communityRequested.current");
        expect(panel).toContain("loadCommunityProgress");
        // La vue « Moi » ne déclenche aucune requête : un anonyme n'en fait jamais.
        expect(panel).toContain('view !== "community"');
        // ✅ Bug du 11/11 : `community.status` dans les dépendances relançait l'effet et son
        // nettoyage annulait la requête en vol — « Chargement… » infini. Le verrou l'interdit.
        expect(panel).not.toContain("[canSeeCommunity, view, community.status]");
        expect(panel).toContain("[canSeeCommunity, view]");
    });

    it("l'Ocre affiche les blocs ET les captures, jamais un pourcentage unique", () => {
        const panel = stripComments(read(DOFUS_PANEL));
        const modal = stripComments(read(DETAIL_MODAL));
        expect(panel).toContain("{stat.done}/{stat.total}");
        expect(panel).toMatch(/stat\.id === "ocre" \? \([\s\S]{0,200}ocreRowLabel/);
        expect(panel).toContain("<RushDofusDetailModal");
        // La fiche porte l'icône Ocre et les DEUX mesures, avec les deux cas honnêtes.
        expect(modal).toContain("Captures Metamob");
        expect(modal).toContain("showOcreBand");
        expect(modal).toMatch(/demande un compte/i);
        expect(modal).toContain("indisponibles pour l'instant");
    });

    it("la fiche de détail est LA MÊME pour l'interne et le public", () => {
        const internal = stripComments(read(MEMBER_PANEL));
        const modal = stripComments(read(DETAIL_MODAL));
        expect(internal).toContain("<RushDofusDetailModal");
        expect(internal).toContain("questStatusForMembers");
        expect(modal).toContain("icone-quete.png");
        for (const label of ["Validée", "En cours", "À faire", "Membres engagés"]) {
            expect(modal, label).toContain(label);
        }
    });

    it("l'ancien panneau communautaire est supprimé (aucun doublon)", () => {
        expect(existsSync("src/app/guides/rush-sylvestre/_components/PublicCommunityPanel.tsx")).toBe(false);
    });

    it("le pont Ocre remonte le résumé (captures, étape) sans exposer la clé", () => {
        const bridge = stripComments(read("src/components/dofus-quests/rush/PublicOcreDungeonBridge.tsx"));
        expect(bridge).toContain("progress: result.progress");
        expect(bridge).toContain("captured: result.captured");
        expect(bridge).toContain("stepCount: result.stepCount ?? null");
        expect(bridge).not.toMatch(/apiKey|metamobApiKey/i);
    });
});



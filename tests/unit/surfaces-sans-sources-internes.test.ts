/**
 * Surfaces utilisateur — **plus aucune mention des sources internes** (Dofensive).
 *
 * Demande user (verbatim) : « on ne parle plus de dofensive nulle part stp sur les landing /
 * interne c'est que pour nous côté god » · « dans le status vire dofusdb et dofensive aussi et
 * modifie metamob par synchro module metamob ».
 *
 * Ce que ce verrou protège :
 * - la page **Statut** ne liste plus DofusDB ni Dofensive, et nomme « Synchro module Metamob » ;
 * - les fiches ne portent plus de libellé de provenance (« Fiche locale — … ») ;
 * - les liens/outils publics ne pointent plus vers Dofensive ;
 * - les mentions légales et la doc in-app ne l'attribuent plus ;
 * - les variantes de salle ne sont plus étiquetées « Dofensive (…) ».
 *
 * Dofensive reste autorisé **côté God** (`src/components/admin/**`, actions God, crons) :
 * c'est notre siphon, pas une source produit. Lecture seule.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const STATUS = "src/app/status/_components/status-client.tsx";
const MONSTER_FICHE = "src/components/succes/MonsterFicheView.tsx";
const LEGAL = "src/app/legal/mentions/page.tsx";
const QUICK_TOOLS = "src/components/ressources/QuickToolsPanel.tsx";
const RESOURCES = "src/server/actions/resources-actions.ts";
const BOSS_GUIDE = "src/components/songes/BossGuide.tsx";
const DEFI = "src/components/succes/SuccesDefiTab.tsx";
const DOCS = "src/lib/docs-catalog.ts";

describe("surfaces publiques — aucune source interne nommée", () => {
    it("la page Statut ne liste que les services produit", () => {
        const src = read(STATUS);
        expect(src).not.toContain('name: "DofusDB"');
        expect(src).not.toContain('name: "Dofensive"');
        expect(src).toContain('name: "Synchro module Metamob"');
    });

    it("la fiche monstre n'affiche plus de libellé de provenance", () => {
        const src = read(MONSTER_FICHE);
        expect(src).not.toContain("Fiche locale");
        expect(src).not.toContain("Fiche siphonnée");
        expect(src).not.toContain("client de jeu");
    });

    it("les mentions légales n'attribuent plus Dofensive (DofusDB reste, licence LPNC-IA)", () => {
        const src = read(LEGAL);
        expect(src).not.toContain("Dofensive");
        expect(src).toContain("DofusDB");
        expect(src).toContain("LPNC-IA");
    });

    it("les outils et liens publics ne pointent plus vers Dofensive", () => {
        expect(read(QUICK_TOOLS)).not.toContain("Dofensive");
        expect(read(RESOURCES)).not.toContain("Dofensive");
        expect(read(BOSS_GUIDE)).not.toContain("Dofensive");
        expect(read(DEFI)).not.toContain("Dofensive");
    });

    it("la documentation in-app ne le cite plus", () => {
        expect(read(DOCS)).not.toContain("Dofensive");
    });

    it("les variantes de salle sont nommées « Variante », jamais « Dofensive »", () => {
        const files = [
            "src/lib/dungeons/fers-tyrannie.ts",
            "src/lib/dungeons/sentence-balance.ts",
            "src/lib/dungeons/tal-kasha.ts",
            "src/lib/dungeons/tour-solar.ts",
            "src/lib/dungeons/trone-sang.ts",
        ];
        for (const file of files) {
            const src = read(file);
            expect(src, file).toContain('label: "Variante (');
            expect(src, file).not.toContain('label: "Dofensive (');
        }
    });
});

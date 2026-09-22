import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Refonte Succès : hub en 4 gros blocs (style Guides) + quêtes dans
 * l'onglet de chaque fiche boss / titan, suppression de la vue globale
 * « Quêtes & Succès » (succès dupliqués de « Mes Succès »).
 */

const REPO_ROOT = path.resolve(__dirname, "../..");
const readSource = (relativePath: string) => fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
const exists = (relativePath: string) => fs.existsSync(path.join(REPO_ROOT, relativePath));

describe("succes hub — 4 blocs + retour", () => {
    it("affiche les 4 blocs (Mes Succès, Succès Commun, Fiches, Défi), sans la vue globale", () => {
        const src = readSource("src/components/succes/SuccesClient.tsx");
        expect(src).toContain("Mes Succès");
        expect(src).toContain("Succès Commun");
        expect(src).toContain("Fiches");
        expect(src).toContain("Défi");
        expect(src).not.toContain("SuccesQuestsTab");
        expect(src).not.toContain('view === "quetes"');
    });

    it("ouvre sur le menu par défaut, avec un bouton de retour dans les vues", () => {
        const src = readSource("src/components/succes/SuccesClient.tsx");
        expect(src).toContain('"menu"');
        expect(src).toContain("Retour au menu Succès");
    });

    it("redirige l'ancien ?view=quetes vers la fiche boss avec l'onglet quêtes", () => {
        const src = readSource("src/components/succes/SuccesClient.tsx");
        expect(src).toContain('rawView === "quetes"');
        expect(src).toContain('params.set("view", "boss")');
        expect(src).toContain('params.set("onglet", "quetes")');
    });

    it("sous-sélecteur : assets distinctifs bruts (ano1, avitons, titan) en 20px, jamais maskés", () => {
        const src = readSource("src/components/succes/SuccesClient.tsx");
        expect(src).toContain("/assets/missions/ano1.png");
        expect(src).toContain("/assets/dofus/icons/titan.png");
        expect(src).toContain("w-5 h-5 object-contain");
        expect(src).not.toContain("AssetIcon");
        expect(src).not.toContain("maskImage");
    });

    it("garde les liens profonds (boss, anomalies, avis, titans, moi, guilde, defi)", () => {
        const src = readSource("src/components/succes/SuccesClient.tsx");
        for (const v of ["boss", "anomalies", "bounties", "titans", '"moi"', '"guilde"', '"defi"']) {
            expect(src, v).toContain(v);
        }
    });

    it("vue globale supprimée (zéro doublon de succès)", () => {
        expect(exists("src/components/succes/SuccesQuestsTab.tsx")).toBe(false);
    });
});

describe("onglet Quêtes des fiches boss / titans", () => {
    it("fiche boss : onglet Quêtes après Monstres de la salle, boss classiques uniquement", () => {
        const src = readSource("src/components/succes/SuccesBossGuide.tsx");
        expect(src).toContain("SuccesBossQuests");
        expect(src).toContain("Quêtes (");
        expect(src).toContain("!selected?.isAnomalyBoss");
        expect(src).toContain('detailTab === "quetes"');
    });

    it("fiche boss : réutilise les quêtes déjà chargées (zéro requête en plus)", () => {
        const src = readSource("src/components/succes/SuccesBossGuide.tsx");
        expect(src).toContain("linkedQuestsByDungeon[selected.id]");
        // Le fetch existait déjà mais n'était jamais affiché (donnée morte).
        expect(src).toContain("getLinkedQuests(guildId, d.name, d.bossName");
    });

    it("fiche boss : ?onglet=quetes ouvre directement les quêtes", () => {
        const src = readSource("src/components/succes/SuccesBossGuide.tsx");
        expect(src).toContain('searchParams.get("onglet") === "quetes"');
    });

    it("fiche titan : onglet Quêtes alimenté par getLinkedQuests", () => {
        const src = readSource("src/components/succes/SuccesTitanTab.tsx");
        expect(src).toContain("SuccesBossQuests");
        expect(src).toContain("Quêtes (");
        expect(src).toContain("getLinkedQuests(guildId, selected.name, selected.name");
        expect(src).toContain('detailTab === "quetes"');
    });

    it("affichage partagé : pas de bloc Succès du donjon (déjà dans Mes Succès)", () => {
        const src = readSource("src/components/succes/SuccesBossQuests.tsx");
        expect(src).toContain("Quêtes liées");
        expect(src).not.toContain("Succès du Donjon");
        expect(src).not.toContain("SUCCÈS DU DONJON");
    });
});

describe("anti-slop du nouveau code", () => {
    it("hub : cartes neutres, aucune pastille teintée — l'immersion vient des assets nus", () => {
        const src = readSource("src/components/succes/SuccesClient.tsx");
        for (const tint of ["bg-success/10", "bg-info/10", "bg-warning/10"]) {
            expect(src, tint).not.toContain(tint);
        }
        expect(src).toContain("tracking-[0.18em]");
        expect(src).toContain("Encyclopédie");
    });

    it("hub + quêtes : aucun gradient, blur, ombre XL ni emoji", () => {
        for (const f of [
            "src/components/succes/SuccesClient.tsx",
            "src/components/succes/SuccesBossQuests.tsx",
        ]) {
            const src = readSource(f);
            expect(src, `${f} gradient`).not.toContain("bg-gradient");
            expect(src, `${f} blur`).not.toContain("blur-");
            expect(src, `${f} shadow-xl`).not.toContain("shadow-xl");
            expect(src, `${f} shadow-2xl`).not.toContain("shadow-2xl");
        }
        const quests = readSource("src/components/succes/SuccesBossQuests.tsx");
        for (const emoji of ["👑", "✨", "✔", "🔴", "🟢"]) {
            expect(quests, `emoji ${emoji}`).not.toContain(emoji);
        }
    });
});

describe("déslop mes succès + succès commun — couleur en micro-indicateurs, jamais en fond", () => {
    it("mes succès : aucun fond teinté, aucun gradient, aucun bouton contouré bleu", () => {
        const src = readSource("src/components/succes/SuccesTracker.tsx");
        for (const banned of ["bg-success/10", "bg-info/10", "bg-warning/15", "bg-gradient", "border-warning/50", "border-info/30 bg-info/10", "border-warning/40 bg-warning/15"]) {
            expect(src, banned).not.toContain(banned);
        }
        expect(src).not.toContain("🏆");
    });

    it("succès commun : pills neutres + pastille 6px, titres neutres, sans emoji", () => {
        const src = readSource("src/components/succes/SuccesDirectory.tsx");
        for (const banned of ["bg-danger/5", "bg-success/10", "bg-info/10", "border-warning/50", "🎉"]) {
            expect(src, banned).not.toContain(banned);
        }
        expect(src).toContain("MemberRow");
        expect(src).toContain("text-muted-foreground");
    });

    it("fiches boss : un seul onglet Sorts (mécaniques clés + détail fusionnés)", () => {
        const src = readSource("src/components/succes/SuccesBossGuide.tsx");
        expect(src).toContain("Sorts (");
        expect(src).toContain("Mécaniques clés");
        expect(src).toContain("Sorts détaillés (");
        expect(src).not.toContain("Tous les sorts (");
        expect(src).not.toContain('"overview"');
    });

    it("sorts détaillés : repliés par défaut (accordéon, reset à chaque fiche)", () => {
        const src = readSource("src/components/succes/SuccesBossGuide.tsx");
        expect(src).toContain("const [showAllSpells, setShowAllSpells] = useState(false)");
        expect(src).toContain("{showAllSpells && (");
        expect(src).toContain("aria-expanded={showAllSpells}");
    });
});

describe("encyclopédie boss — rangs, caractéristiques, propriétés (données siphonnées)", () => {
    it("section encyclo : identité, rangs, tableau, résistances, propriétés", () => {
        const src = readSource("src/components/succes/SuccesBossEncyclo.tsx");
        for (const expected of ["Rang :", "Caractéristiques", "Résistances", "Propriétés", "Esquive PA", "Esquive PM"]) {
            expect(src, expected).toContain(expected);
        }
        expect(src).toContain("/assets/dofus/stats/pv.png");
        expect(src).toContain("/assets/dofus/stats/sagesse.png");
        // Grille dense (pavé resserré) : pas de divide-y plein panneau.
        expect(src).toContain("xl:grid-cols-4");
        expect(src).not.toContain("divide-y");
    });

    it("encyclo : ligne Donjons façon DofusDB (donnée locale, jamais inventée)", () => {
        const src = readSource("src/components/succes/SuccesBossEncyclo.tsx");
        expect(src).toContain("Donjons:");
        expect(src).toContain("dungeonName");
    });

    it("encyclo : aucun champ inventé — absent ⇒ masqué + note de synchronisation", () => {
        const src = readSource("src/components/succes/SuccesBossEncyclo.tsx");
        expect(src).toContain("en cours de synchronisation");
        expect(src).not.toContain("👑");
        expect(src).not.toContain("✨");
    });

    it("fiche boss : section encyclo branchée, paliers et barre unifiée supprimés", () => {
        const src = readSource("src/components/succes/SuccesBossGuide.tsx");
        expect(src).toContain("SuccesBossEncyclo");
        expect(src).not.toContain("Paliers de Grades");
        expect(src).not.toContain("Grades & Paliers");
        expect(src).not.toContain("Barre unifiée PV/PA/PM");
    });
});

describe("overlay encyclopédie — 4e onglet Butin, stats lisibles", () => {
    it("4 onglets dont Butin, drops sortis de l'onglet Stats", () => {
        const src = readSource("src/components/boss-overlay/BossOverlayClient.tsx");
        expect(src).toContain('"loot"');
        expect(src).toContain('label: isEn ? "Loot" : "Butin"');
        expect(src).toContain('tab === "loot"');
        expect(src).toContain("Aucun butin");
    });

    it("stats et résistances agrandies (lisibles en overlay)", () => {
        const src = readSource("src/components/boss-overlay/BossOverlayClient.tsx");
        expect(src).toContain("text-[15px]");
        expect(src).toContain("w-5 h-5 object-contain");
        expect(src).toContain("flex-1 h-1 rounded-full");
    });
});

describe("encyclo — pictos via le référentiel officiel (module stuff)", () => {
    it("Force/Intel/Chance/Agi passent par dofus-stats-theme, jamais en dur", () => {
        const src = readSource("src/components/succes/SuccesBossEncyclo.tsx");
        expect(src).toContain("resolveDofusStatTheme");
        expect(src).toContain("dofusStatAssetUrl");
        expect(src).not.toContain("/assets/module-succes/terre.png");
        expect(src).not.toContain("/assets/module-succes/Intelligence.png");
    });
});

describe("succès commun — listes denses + pagination, jamais d'empilement", () => {
    it("colonnes membres en lignes denses paginées (24/page), sans pills ni bouton empileur", () => {
        const src = readSource("src/components/succes/SuccesDirectory.tsx");
        expect(src).not.toContain("MemberPill");
        expect(src).not.toContain("24 de plus");
        expect(src).not.toContain("onShowMore");
        expect(src).toContain("MEMBER_PAGE_SIZE = 24");
        expect(src).toContain("sur {members.length}");
    });
});

describe("avis de recherche — homogène aux fiches boss", () => {
    it("ouvre un avis à l'arrivée (jamais d'écran vide), via la section encyclo partagée", () => {
        const src = readSource("src/components/succes/SuccesAvisTab.tsx");
        expect(src).toContain("autoSelectedRef");
        expect(src).toContain("SuccesBossEncyclo");
        expect(src).not.toContain("Choisissez un avis de recherche");
    });

    it("onglets soulignés comme les fiches boss, sans rose ni pastilles", () => {
        const src = readSource("src/components/succes/SuccesAvisTab.tsx");
        expect(src).toContain("border-foreground/60 text-foreground");
        expect(src).not.toContain("rose-500");
        expect(src).not.toContain("rose-400");
        expect(src).not.toContain("bg-warning/15");
    });
});

describe("tutoriel + documentation", () => {
    it("tour revu : menu 4 blocs + quêtes dans les fiches, plus de Sept vues", () => {
        const src = readSource("src/components/tour/tour-provider.tsx");
        expect(src).toContain("Menu du Module Succès");
        expect(src).toContain("Fiches & Quêtes liées");
        expect(src).toContain("Kardorim");
        expect(src).not.toContain("Sept vues complémentaires");
        expect(src).not.toContain("« Quêtes & Succès » pour les quêtes associées");
    });

    it("doc du module : hub 4 blocs + onglet Quêtes, sans vue globale", () => {
        const src = readSource("src/lib/docs-catalog.ts");
        expect(src).toContain("quatre blocs");
        expect(src).toContain("onglet <strong>Quêtes</strong>");
        expect(src).not.toContain("<strong>Quêtes &amp; Succès :</strong>");
    });
});

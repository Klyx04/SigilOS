"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import MonsterFamilyManager from "./MonsterFamilyManager";
import ChallengeManager from "./ChallengeManager";
import DungeonManager from "./DungeonManager";
import ZoneManager from "./ZoneManager";
import DataExportImport from "./DataExportImport";
import LegendaryManager from "./LegendaryManager";
import GameQuestManager from "./GameQuestManager";
import QuestSyncPanel from "./QuestSyncPanel";
import { QuestSiphonPanel } from "./QuestSiphonPanel";
import ArchimonstreManager from "./ArchimonstreManager";
import { GameDataMonsterManager } from "./GameDataMonsterManager";
import { DofusDbHarvestSyncManager } from "./DofusDbHarvestSyncManager";
import { GameDataSiphonPanel } from "./GameDataSiphonPanel";
import { GameItemSiphonPanel } from "./GameItemSiphonPanel";
import DefiManager from "./DefiManager";
import TitanManager from "./TitanManager";
import { GameDataSyncStatePanel } from "./GameDataSyncStatePanel";
import { GameDataLocalToolsPanel } from "./GameDataLocalToolsPanel";

/**
 * Tableau de bord God « Données de jeu » — **interface dédiée, 4 entrées**.
 *
 * Refonte du 22/09/2026 (demande : « moins de boutons, une interface dédiée ») : la barre
 * comptait **15 onglets** qui débordaient (scroll horizontal obligatoire) et chaque panneau
 * répétait les mêmes actions. Désormais :
 *
 * 1. **Tableau** — ce qui se lit AVANT de cliquer : état par dataset, couverture, santé des
 *    données. Chaque ligne sait où aller (« Ouvrir » → le bon outil).
 * 2. **Siphons DofusDB** — tout ce qui parle au réseau, derrière le limiteur partagé.
 * 3. **Éditeurs** — les référentiels corrigés à la main : **un seul ouvert à la fois**
 *    (maître/détail vertical) au lieu de 10 onglets supplémentaires dans la barre.
 * 4. **Outils locaux** — ce qui s'exécute **sans réseau** + import/export.
 *
 * Les identifiants d'éditeur sont les anciens identifiants d'onglet : `DataHealthPanel`
 * continue de router par `onGoTab` sans modification.
 */

type MainTab = "tableau" | "siphons" | "editeurs" | "outils";

const MAIN_TABS: { id: MainTab; label: string }[] = [
    { id: "tableau", label: "📊 Tableau" },
    { id: "siphons", label: "🛰️ Siphons DofusDB" },
    { id: "editeurs", label: "📚 Éditeurs" },
    { id: "outils", label: "🧰 Outils locaux" },
];

interface EditorEntry {
    id: string;
    label: string;
    caption: string;
    render: () => React.ReactNode;
}

/** Les 10 référentiels éditables — une entrée = un dataset = un écran. */
const EDITORS: EditorEntry[] = [
    { id: "families", label: "Familles", caption: "Familles de monstres, résistances, zones", render: () => <MonsterFamilyManager /> },
    { id: "zones", label: "Zones", caption: "Zones, sous-zones, arches", render: () => <ZoneManager /> },
    { id: "challenges", label: "Succès", caption: "Succès de combat & points", render: () => <ChallengeManager /> },
    { id: "dungeons", label: "Donjons", caption: "Donjons, salles, boss", render: () => <DungeonManager /> },
    { id: "defis", label: "Défis boss", caption: "Défis de guilde (boss, paliers)", render: () => <DefiManager /> },
    { id: "titans", label: "Titans", caption: "Titans & conditions", render: () => <TitanManager /> },
    { id: "legendary", label: "Légendaires", caption: "Objets légendaires", render: () => <LegendaryManager /> },
    { id: "archimonstres", label: "Archis & Boss", caption: "Archimonstres & boss d'anomalie", render: () => <ArchimonstreManager /> },
    { id: "monstres-speciaux", label: "Monstres spéciaux", caption: "Monstres hors combat standard", render: () => <GameDataMonsterManager /> },
    {
        id: "quests",
        label: "Quêtes",
        caption: "Siphon local + édition des quêtes",
        render: () => (
            <div className="space-y-6">
                <QuestSiphonPanel />
                <GameQuestManager />
            </div>
        ),
    },
];

const EDITOR_IDS = new Set(EDITORS.map((e) => e.id));

export default function GameDataInterface() {
    const [activeTab, setActiveTab] = useState<MainTab>("tableau");
    const [activeEditor, setActiveEditor] = useState<string>("families");

    /**
     * Cible unique : un onglet principal, ou un éditeur (maître/détail).
     * `DataHealthPanel` appelle toujours `onGoTab("zones")`, etc. → même comportement.
     */
    const goTo = (target: string) => {
        if (EDITOR_IDS.has(target)) {
            setActiveEditor(target);
            setActiveTab("editeurs");
            return;
        }
        setActiveTab(target as MainTab);
    };

    const editor = EDITORS.find((e) => e.id === activeEditor) ?? EDITORS[0];

    return (
        <div className="bg-surface/50 backdrop-blur-sm rounded-3xl border border-border/50 p-6">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MainTab)} className="w-full">
                <TabsList className="flex flex-wrap justify-start gap-2 w-full bg-elevated/50 mb-6 p-2.5 rounded-2xl h-auto">
                    {MAIN_TABS.map((tab) => (
                        <TabsTrigger
                            key={tab.id}
                            value={tab.id}
                            className="px-4 py-2.5 rounded-xl font-bold text-sm data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
                        >
                            {tab.label}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {/* 1. TABLEAU — l'état d'abord : chaque ligne sait où aller. La couverture
                    par source → cible est DANS le panneau d'état (repliée) : un seul tableau. */}
                <TabsContent value="tableau" className="space-y-4">
                    <GameDataSyncStatePanel onGo={goTo} />
                </TabsContent>

                {/* 2. SIPHONS RÉSEAU — tout ce qui sort sur Internet, au même endroit. */}
                <TabsContent value="siphons" className="space-y-6">
                    <p className="text-sm text-muted-foreground">
                        Tous ces siphons passent par le{" "}
                        <strong className="text-foreground">limiteur partagé</strong> (30 requêtes/min vers
                        DofusDB, <code>Retry-After</code> honoré) : fini les 429 en boucle. Les datasets
                        marqués « en arrière-plan » dans le tableau continuent après la fermeture de l&apos;onglet.
                    </p>
                    <GameDataSiphonPanel />
                    <GameItemSiphonPanel />
                    <QuestSyncPanel />
                    <DofusDbHarvestSyncManager />
                </TabsContent>

                {/* 3. ÉDITEURS — un référentiel à la fois : fin de la barre qui déborde. */}
                <TabsContent value="editeurs">
                    <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-5">
                        <nav aria-label="Référentiels" className="lg:sticky lg:top-20 lg:self-start">
                            <ul className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 custom-scrollbar">
                                {EDITORS.map((entry) => {
                                    const active = entry.id === editor.id;
                                    return (
                                        <li key={entry.id} className="shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => setActiveEditor(entry.id)}
                                                aria-current={active ? "true" : undefined}
                                                className={cn(
                                                    "w-full text-left rounded-xl border px-3 py-2 transition-colors",
                                                    active
                                                        ? "border-primary/50 bg-primary/10 text-foreground"
                                                        : "border-border/60 text-muted-foreground hover:bg-elevated/60 hover:text-foreground",
                                                )}
                                            >
                                                <span className="block text-sm font-bold whitespace-nowrap">{entry.label}</span>
                                                <span className="hidden lg:block text-[11px] text-muted-foreground">
                                                    {entry.caption}
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </nav>
                        <section aria-label={editor.label} className="min-w-0">
                            <header className="mb-4">
                                <h3 className="text-sm font-black uppercase tracking-wider text-foreground">{editor.label}</h3>
                                <p className="text-[11px] text-muted-foreground">{editor.caption}</p>
                            </header>
                            {editor.render()}
                        </section>
                    </div>
                </TabsContent>

                {/* 4. OUTILS LOCAUX — maintenance sans réseau + import/export. */}
                <TabsContent value="outils" className="space-y-6">
                    <GameDataLocalToolsPanel />
                    <DataExportImport />
                </TabsContent>
            </Tabs>
        </div>
    );
}

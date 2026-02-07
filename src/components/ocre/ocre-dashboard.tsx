"use client";

// =============================================================================
// OCRE DASHBOARD - Main quest progress dashboard with pagination
// =============================================================================

import { useState, useMemo, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    AlertTriangle,
    Package,
    Gift,
    Bug,
    ChevronLeft,
    ChevronRight,
    ArrowRightLeft,
    Loader2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Progress } from "@/components/ui/progress";
// import { ProgressRing } from "./progress-ring"; // Removed as we use bars now
import { OcreStatCard, StatsGrid } from "./ocre-stats";
import { OcreMonsterCard } from "./ocre-monster-card";
import { OcreFilterBar, type OcreFilters, type MonsterType, type SortOption } from "./ocre-filter-bar";
import {
    forceRefreshOcre,
    getGuildExchangeMap,
    findOcreExchangePartners,
    getAvailableOcreQuests,
    switchOcreQuest,
    type OcreProgressData,
    type ExchangePartner,
} from "@/server/actions/ocre-actions";
import type { OcreMonster } from "@/lib/metamob-client";

// Constants
const ITEMS_PER_PAGE = 48;

interface OcreDashboardProps {
    data: OcreProgressData;
    guildId: string;
}

export function OcreDashboard({ data, guildId }: OcreDashboardProps) {
    // Filter state
    const [filters, setFilters] = useState<OcreFilters>({
        searchQuery: "",
        selectedType: "all",
        selectedStep: "all",
        selectedZone: "all",
        minQuantity: 0,
        sortBy: "step-asc",
    });

    // Other state
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [exchangeMap, setExchangeMap] = useState<Record<number, number>>({});
    const [exchangeMapLoading, setExchangeMapLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);

    // Load exchange map on mount
    const loadExchangeMap = useCallback(async () => {
        setExchangeMapLoading(true);
        const result = await getGuildExchangeMap(guildId);
        if (result.success && result.data) {
            setExchangeMap(result.data.availableExchanges);
        }
        setExchangeMapLoading(false);
    }, [guildId]);

    // Extract unique steps and zones from monsters
    const { steps, zones } = useMemo(() => {
        const uniqueSteps = new Set<number>();
        const uniqueZones = new Set<string>();

        data.monsters.forEach((m) => {
            if (m.step) uniqueSteps.add(m.step);
            if (m.zone) uniqueZones.add(m.zone);
        });

        return {
            steps: Array.from(uniqueSteps).sort((a, b) => a - b),
            zones: Array.from(uniqueZones).sort((a, b) => a.localeCompare(b, "fr")),
        };
    }, [data.monsters]);

    // Categorize monsters
    const { manquants, possedes, doublons } = useMemo(() => {
        return {
            manquants: data.monsters.filter((m) => m.state === "MANQUANT"),
            possedes: data.monsters.filter((m) => m.state !== "MANQUANT"), // Includes Doublons
            doublons: data.monsters.filter((m) => m.state === "DOUBLON"),
        };
    }, [data.monsters]);

    // Sort function
    const sortMonsters = (monsters: OcreMonster[]): OcreMonster[] => {
        return [...monsters].sort((a, b) => {
            switch (filters.sortBy) {
                case "name-asc":
                    return a.name.localeCompare(b.name, "fr");
                case "name-desc":
                    return b.name.localeCompare(a.name, "fr");
                case "step-asc":
                    return (a.step ?? 999) - (b.step ?? 999);
                case "step-desc":
                    return (b.step ?? 0) - (a.step ?? 0);
                default:
                    return 0;
            }
        });
    };

    // Filter function
    const filterMonsters = (monsters: OcreMonster[]) => {
        let filtered = monsters;

        // Filter by type
        if (filters.selectedType !== "all") {
            filtered = filtered.filter((m) => m.type === filters.selectedType);
        }

        // Filter by step
        if (filters.selectedStep !== "all") {
            const stepNum = parseInt(filters.selectedStep, 10);
            filtered = filtered.filter((m) => m.step === stepNum);
        }

        // Filter by zone
        if (filters.selectedZone !== "all") {
            filtered = filtered.filter((m) => m.zone === filters.selectedZone);
        }

        // Filter by min quantity
        if (filters.minQuantity > 0) {
            filtered = filtered.filter((m) => (m.owned || 0) >= filters.minQuantity);
        }

        // Filter by search query
        if (filters.searchQuery.trim()) {
            const query = filters.searchQuery.toLowerCase();
            filtered = filtered.filter((m) =>
                m.name.toLowerCase().includes(query) ||
                (m.zone && m.zone.toLowerCase().includes(query))
            );
        }

        // Apply sorting
        filtered = sortMonsters(filtered);

        return filtered;
    };

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [filters]);

    // Quest Switcher State
    const [showSwitchDialog, setShowSwitchDialog] = useState(false);
    const [isSwitching, setIsSwitching] = useState(false);
    const [availableQuests, setAvailableQuests] = useState<OcreProgressData["questInfo"][] | any[]>([]);
    const [questsLoading, setQuestsLoading] = useState(false);

    // Handlers
    const handleRefresh = async () => {
        setIsRefreshing(true);
        const result = await forceRefreshOcre(guildId);
        if (result.success) {
            if (result.data?.questUpdated) {
                toast.success("🎉 Nouvelle quête détectée et mise à jour !");
            } else {
                toast.success("Synchronisation forcée réussie !");
            }
            setTimeout(() => window.location.reload(), 500);
        } else {
            toast.error(result.error || "Erreur lors du rafraîchissement");
            setIsRefreshing(false);
        }
    };

    const handleOpenSwitch = async () => {
        setQuestsLoading(true);
        setShowSwitchDialog(true);
        const result = await getAvailableOcreQuests(guildId);
        if (result.success && result.data) {
            setAvailableQuests(result.data.sort((a, b) => b.quest_template.id - a.quest_template.id));
        } else {
            toast.error("Impossible de charger les quêtes");
            setShowSwitchDialog(false);
        }
        setQuestsLoading(false);
    };

    const handleSwitch = async (questSlug: string) => {
        setIsSwitching(true);
        const result = await switchOcreQuest(guildId, questSlug);
        if (result.success) {
            toast.success("Quête active mise à jour !");
            setShowSwitchDialog(false);
            window.location.reload();
        } else {
            toast.error(result.error || "Impossible de changer de quête");
            setIsSwitching(false);
        }
    };

    // Find exchange partners for a specific monster
    const handleFindExchanges = async (_monsterId: number): Promise<ExchangePartner[]> => {
        const result = await findOcreExchangePartners({ guildId, direction: "they_have" });
        if (result.success && result.data) {
            return result.data;
        }
        return [];
    };

    // Progress Calculation Helpers
    const getProgressColor = (current: number, total: number) => {
        if (current === total) return "bg-emerald-500";
        if (current > total * 0.7) return "bg-emerald-400";
        if (current > total * 0.3) return "bg-amber-400";
        return "bg-red-400";
    };

    const renderProgressBar = (label: string, category: { total: number; gathered: number }) => {
        if (!category) return null;
        const total = category.total || 1; // Avoid div by zero
        const percent = Math.min(100, Math.round((category.gathered / total) * 100));
        return (
            <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-muted-foreground">{label}</span>
                    <span className="text-muted-foreground">
                        <span className={category.gathered === total ? "text-emerald-500 font-bold" : "text-foreground"}>
                            {category.gathered}
                        </span>
                        /{total}
                    </span>
                </div>
                <Progress value={percent} className="h-1.5" indicatorClassName={getProgressColor(category.gathered, total)} />
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Quest Switcher Dialog */}
            <Dialog open={showSwitchDialog} onOpenChange={setShowSwitchDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Choisir la quête active</DialogTitle>
                        <DialogDescription>
                            Sélectionnez la quête Ocre que vous souhaitez suivre sur SigilOS.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
                        {questsLoading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
                            </div>
                        ) : availableQuests.length === 0 ? (
                            <div className="text-center py-6 text-muted-foreground">
                                Aucune quête Ocre trouvée.
                            </div>
                        ) : (
                            availableQuests.map((quest) => (
                                <div
                                    key={quest.slug}
                                    onClick={() => handleSwitch(quest.slug)}
                                    className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-amber-500/30 cursor-pointer transition-all group"
                                >
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-zinc-200">{quest.server.name}</span>
                                            <Badge variant="secondary" className="text-[10px] h-5 bg-black/20">
                                                {quest.quest_template.id === 1 ? "Unity" : quest.quest_template.id === 2 ? "Rétro" : "Custom"}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <UserCircle className="h-3.5 w-3.5" />
                                            <span>{quest.character_name}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                                            Étape {quest.current_step}
                                        </Badge>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Header with Progress (Metamob Style) */}
            <div className="flex flex-col md:flex-row items-center gap-6 p-6 rounded-2xl bg-gradient-to-br from-amber-500/10 via-card/50 to-card/30 border border-amber-500/20 backdrop-blur-xl">
                <div className="flex-1 md:w-1/2">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
                            Quête de l&apos;Éternelle Moisson
                        </h2>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white"
                            title="Changer de quête"
                            onClick={handleOpenSwitch}
                        >
                            <ArrowRightLeft className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                    <p className="text-muted-foreground mt-1 flex items-center gap-2">
                        <span>{data.questInfo.characterName}</span>
                        <span className="text-zinc-600">•</span>
                        <span>{data.questInfo.serverName}</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                        <Badge variant="outline" className="border-amber-500/30 text-amber-400">
                            📍 Étape {data.questInfo.currentStep}/{data.questInfo.totalSteps}
                        </Badge>
                        {data.questInfo.parallelQuests > 1 && (
                            <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                                🔄 {data.questInfo.parallelQuests} quêtes parallèles
                            </Badge>
                        )}
                        <Badge variant="outline" className="border-purple-500/30 text-purple-400">
                            ⚡ {data.stats.progressPercent}% Global
                        </Badge>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-2 md:gap-1">
                    <span className="text-xs text-muted-foreground/60 font-medium uppercase tracking-wider hidden md:block">
                        Dernière synchro
                    </span>
                    <span className="text-xs text-zinc-400 bg-black/20 px-2 py-1 rounded-md border border-white/5 font-mono whitespace-nowrap">
                        {data.lastSync ? new Date(data.lastSync).toLocaleString("fr-FR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit"
                        }) : "Jamais"}
                    </span>

                    {/* Compact stats for mobile/tablet */}
                    <div className="md:hidden flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="bg-black/40 text-xs">
                            {data.stats.possedes}/{data.stats.total}
                        </Badge>
                    </div>
                </div>

                <div className="w-full md:w-1/2 grid gap-4 hidden md:grid">
                    {renderProgressBar("Monstres", data.stats.monsters)}
                    {renderProgressBar("Gardiens de Donjon", data.stats.bosses)}
                    {renderProgressBar("Archimonstres", data.stats.archis)}
                </div>
            </div>

            {/* Mobile Progress Bars (Separate) */}
            <div className="md:hidden grid gap-4 p-4 rounded-xl bg-card/30 border border-white/5">
                {renderProgressBar("Monstres", data.stats.monsters)}
                {renderProgressBar("Gardiens de Donjon", data.stats.bosses)}
                {renderProgressBar("Archimonstres", data.stats.archis)}
            </div>

            {/* Stats Grid */}
            <StatsGrid>
                <OcreStatCard
                    label="Total Monstres"
                    value={data.stats.total}
                    icon={Bug}
                    color="purple"
                    delay={0}
                />
                <OcreStatCard
                    label="Manquants"
                    value={data.stats.manquants}
                    icon={AlertTriangle}
                    color="red"
                    delay={0.1}
                />
                <OcreStatCard
                    label="Possédés (Min 1)"
                    value={data.stats.possedes}
                    icon={Package}
                    color="green"
                    delay={0.2}
                />
                <OcreStatCard
                    label="Doublons (Min 2)"
                    value={data.stats.doublons}
                    icon={Gift}
                    color="amber"
                    delay={0.3}
                />
            </StatsGrid>

            {/* Filter Bar */}
            <OcreFilterBar
                filters={filters}
                onFiltersChange={setFilters}
                steps={steps}
                zones={zones}
                isRefreshing={isRefreshing}
                onRefresh={handleRefresh}
                guildId={guildId}
            />

            {/* Tabs */}
            <Tabs defaultValue="manquants" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-card/30 backdrop-blur-sm border border-white/10">
                    <TabsTrigger value="manquants" className="gap-2 data-[state=active]:bg-zinc-800">
                        <span className="text-zinc-400">●</span>
                        <span className="hidden sm:inline">Manquants</span>
                        <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                            {filterMonsters(manquants).length}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="possedes" className="gap-2 data-[state=active]:bg-emerald-500/20">
                        <span className="text-emerald-400">●</span>
                        <span className="hidden sm:inline">Possédés</span>
                        <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                            {filterMonsters(possedes).length}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="doublons" className="gap-2 data-[state=active]:bg-amber-500/20">
                        <span className="text-amber-400">●</span>
                        <span className="hidden sm:inline">Doublons</span>
                        <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                            {filterMonsters(doublons).length}
                        </Badge>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="manquants" className="mt-6">
                    <MonsterGrid
                        monsters={filterMonsters(manquants)}
                        guildId={guildId}
                        exchangeMap={exchangeMap}
                        emptyMessage={
                            filters.searchQuery || filters.selectedType !== "all" || filters.selectedStep !== "all"
                                ? "Aucun monstre ne correspond aux filtres"
                                : "Félicitations ! Vous avez tous les monstres ! 🎉"
                        }
                        currentPage={currentPage}
                        onPageChange={setCurrentPage}
                        onFindExchanges={handleFindExchanges}
                    />
                </TabsContent>

                <TabsContent value="possedes" className="mt-6">
                    <MonsterGrid
                        monsters={filterMonsters(possedes)}
                        guildId={guildId}
                        exchangeMap={{}}
                        emptyMessage={
                            filters.searchQuery || filters.selectedType !== "all" || filters.selectedStep !== "all"
                                ? "Aucun monstre ne correspond aux filtres"
                                : "Vous n'avez encore aucun monstre possédé"
                        }
                        showExchangeButton={false}
                        currentPage={currentPage}
                        onPageChange={setCurrentPage}
                    />
                </TabsContent>

                <TabsContent value="doublons" className="mt-6">
                    <MonsterGrid
                        monsters={filterMonsters(doublons)}
                        guildId={guildId}
                        exchangeMap={{}}
                        emptyMessage={
                            filters.searchQuery || filters.selectedType !== "all" || filters.selectedStep !== "all"
                                ? "Aucun doublon ne correspond aux filtres"
                                : "Vous n'avez pas de doublons à proposer"
                        }
                        showExchangeButton={false}
                        currentPage={currentPage}
                        onPageChange={setCurrentPage}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}

// -----------------------------------------------------------------------------
// Helper Components
// -----------------------------------------------------------------------------

function UserCircle({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="10" r="3" />
            <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" />
        </svg>
    );
}

// -----------------------------------------------------------------------------
// Monster Grid Sub-component with Pagination
// -----------------------------------------------------------------------------

interface MonsterGridProps {
    monsters: OcreMonster[];
    guildId: string;
    exchangeMap: Record<number, number>;
    emptyMessage: string;
    showExchangeButton?: boolean;
    currentPage: number;
    onPageChange: (page: number) => void;
    onFindExchanges?: (monsterId: number) => Promise<ExchangePartner[]>;
}

function MonsterGrid({
    monsters,
    guildId,
    exchangeMap,
    emptyMessage,
    showExchangeButton = true,
    currentPage,
    onPageChange,
    onFindExchanges,
}: MonsterGridProps) {
    const totalPages = Math.ceil(monsters.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedMonsters = monsters.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    if (monsters.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <Bug className="h-16 w-16 text-muted-foreground/20 mb-4" />
                <p className="text-muted-foreground">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Pagination Info */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                    {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, monsters.length)} sur {monsters.length} monstres
                </span>
                {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onPageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="min-w-[80px] text-center">
                            Page {currentPage} / {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onPageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </div>

            {/* Monster Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {paginatedMonsters.map((monster) => (
                    <OcreMonsterCard
                        key={monster.id}
                        monster={monster}
                        guildId={guildId}
                        availableExchanges={exchangeMap[monster.id] || 0}
                        showExchangeButton={showExchangeButton}
                        onFindExchanges={onFindExchanges ? () => onFindExchanges(monster.id) : undefined}
                    />
                ))}
            </div>

            {/* Bottom Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center gap-2 pt-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Précédent
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                    >
                        Suivant
                        <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                </div>
            )}
        </div>
    );
}

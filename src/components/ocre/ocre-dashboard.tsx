"use client";

// =============================================================================
// OCRE DASHBOARD - Main quest progress dashboard with pagination
// =============================================================================

import { useState, useMemo, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    AlertTriangle,
    Package,
    Gift,
    Bug,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

import { ProgressRing } from "./progress-ring";
import { OcreStatCard, StatsGrid } from "./ocre-stats";
import { OcreMonsterCard } from "./ocre-monster-card";
import { OcreFilterBar, type OcreFilters, type MonsterType, type SortOption } from "./ocre-filter-bar";
import {
    refreshOcreCache,
    getGuildExchangeMap,
    findOcreExchangePartners,
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
        sortBy: "step-asc",
        showExchangeableOnly: false,
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

    useEffect(() => {
        loadExchangeMap();
    }, [loadExchangeMap]);

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

    // Count monsters with available exchanges
    const monstersWithExchanges = useMemo(() => {
        return manquants.filter((m) => exchangeMap[m.id] && exchangeMap[m.id] > 0).length;
    }, [manquants, exchangeMap]);

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
    const filterMonsters = (monsters: OcreMonster[], applyExchangeFilter = false) => {
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

        // Filter by search query
        if (filters.searchQuery.trim()) {
            const query = filters.searchQuery.toLowerCase();
            filtered = filtered.filter((m) =>
                m.name.toLowerCase().includes(query) ||
                (m.zone && m.zone.toLowerCase().includes(query))
            );
        }

        // Filter exchangeable only
        if (applyExchangeFilter && filters.showExchangeableOnly) {
            filtered = filtered.filter((m) => exchangeMap[m.id] && exchangeMap[m.id] > 0);
        }

        // Apply sorting
        filtered = sortMonsters(filtered);

        return filtered;
    };

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [filters]);

    // Handlers
    const handleRefresh = async () => {
        setIsRefreshing(true);
        const result = await refreshOcreCache(guildId);
        if (result.success) {
            if (result.data?.questUpdated) {
                toast.success("🎉 Nouvelle quête détectée et mise à jour !");
            } else {
                toast.success("Synchronisation réussie !");
            }
            setTimeout(() => window.location.reload(), 500);
        } else {
            toast.error(result.error || "Erreur lors du rafraîchissement");
            setIsRefreshing(false);
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

    return (
        <div className="space-y-6">
            {/* Header with Progress */}
            <div className="flex flex-col md:flex-row items-center gap-6 p-6 rounded-2xl bg-gradient-to-br from-amber-500/10 via-card/50 to-card/30 border border-amber-500/20 backdrop-blur-xl">
                <ProgressRing
                    progress={data.stats.progressPercent}
                    size={130}
                    strokeWidth={10}
                    label="Progression"
                    sublabel={`${data.stats.total - data.stats.manquants}/${data.stats.total}`}
                />

                <div className="flex-1 text-center md:text-left">
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
                        Quête de l&apos;Éternelle Moisson
                    </h2>
                    <p className="text-muted-foreground mt-1">
                        {data.questInfo.characterName} • {data.questInfo.serverName}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-3 justify-center md:justify-start">
                        <Badge variant="outline" className="border-amber-500/30 text-amber-400">
                            📍 Étape {data.questInfo.currentStep}/{data.questInfo.totalSteps}
                        </Badge>
                        {data.questInfo.parallelQuests > 1 && (
                            <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                                🔄 {data.questInfo.parallelQuests} quêtes parallèles
                            </Badge>
                        )}
                        {!exchangeMapLoading && monstersWithExchanges > 0 && (
                            <Badge className="bg-emerald-600 text-white">
                                ✨ {monstersWithExchanges} échangeables dans la guilde
                            </Badge>
                        )}
                    </div>
                </div>
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
                    subValue={
                        !exchangeMapLoading && monstersWithExchanges > 0
                            ? `${monstersWithExchanges} échangeables`
                            : undefined
                    }
                    delay={0.1}
                />
                <OcreStatCard
                    label="Possédés"
                    value={data.stats.possedes}
                    icon={Package}
                    color="green"
                    delay={0.2}
                />
                <OcreStatCard
                    label="Doublons"
                    value={data.stats.doublons}
                    icon={Gift}
                    color="amber"
                    delay={0.3}
                />
            </StatsGrid>

            {/* New Filter Bar */}
            <OcreFilterBar
                filters={filters}
                onFiltersChange={setFilters}
                steps={steps}
                zones={zones}
                exchangeableCount={exchangeMapLoading ? 0 : monstersWithExchanges}
                isRefreshing={isRefreshing}
                onRefresh={handleRefresh}
            />

            {/* Tabs */}
            <Tabs defaultValue="manquants" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-card/30 backdrop-blur-sm border border-white/10">
                    <TabsTrigger value="manquants" className="gap-2 data-[state=active]:bg-red-500/20">
                        <span className="text-red-400">●</span>
                        <span className="hidden sm:inline">Manquants</span>
                        <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                            {filterMonsters(manquants, true).length}
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
                        monsters={filterMonsters(manquants, true)}
                        guildId={guildId}
                        exchangeMap={exchangeMap}
                        emptyMessage={
                            filters.searchQuery || filters.selectedType !== "all" || filters.selectedStep !== "all"
                                ? filters.showExchangeableOnly
                                    ? "Aucun monstre échangeable ne correspond aux filtres"
                                    : "Aucun monstre ne correspond aux filtres"
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

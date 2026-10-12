"use client";

// =============================================================================
// OCRE DASHBOARD - Main quest progress dashboard with pagination
// =============================================================================

import { useState, useMemo, useEffect, useCallback } from "react";
import { getDofusServerImage } from "@/lib/dofus-assets";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    AlertTriangle,
    Gift,
    Bug,
    ChevronLeft,
    ChevronRight,
    ArrowRightLeft,
    Loader2,
    Sparkles,
    CheckCircle2,
    Plus,
    Minus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import { Progress } from "@/components/ui/progress";
import { OcreStatCard, StatsGrid } from "./ocre-stats";
import { OcreMonsterCard } from "./ocre-monster-card";
import { OcreFilterBar, type OcreFilters } from "./ocre-filter-bar";
import { OcreExchangeModal } from "./ocre-exchange-modal";
import { OcreTradeInbox } from "./ocre-trade-inbox";
import { OcreGuildDirectory } from "./ocre-guild-directory";

import {
    forceRefreshOcre,
    getGuildExchangeMap,
    findMonsterOwnersAction,
    type OcreProgressData,
    type ExchangePartner,
} from "@/server/actions/ocre-actions";
import type { OcreMonster } from "@/lib/metamob-client";

// Constants
const ITEMS_PER_PAGE = 48;

interface OcreDashboardProps {
    data: OcreProgressData;
    guildId: string;
    hasOcreChannel?: boolean;
}

export function OcreDashboard({ data, guildId, hasOcreChannel }: OcreDashboardProps) {
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
    const [exchangeMap, setExchangeMap] = useState<Record<number, number>>({});
    const [exchangeMapLoading, setExchangeMapLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);

    // Selection Mode
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedMonsterIds, setSelectedMonsterIds] = useState<Set<number>>(new Set());
    const [isBulkUpdating, setIsBulkUpdating] = useState(false);

    const toggleMonsterSelection = useCallback((id: number) => {
        setSelectedMonsterIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const handleBulkUpdate = async (type: 'inc' | 'dec' | 'set', value?: number) => {
        if (selectedMonsterIds.size === 0) return;
        setIsBulkUpdating(true);
        try {
            const updates = Array.from(selectedMonsterIds).map(id => {
                const m = data.monsters.find(x => x.id === id);
                let newQty = m?.owned || 0;
                if (type === 'inc') newQty += 1;
                else if (type === 'dec') newQty = Math.max(0, newQty - 1);
                else if (type === 'set' && value !== undefined) newQty = value;
                return { monster_id: id, quantity: newQty };
            });

            const { bulkUpdateMonsterQuantitiesAction } = await import("@/server/actions/ocre-actions");
            const res = await bulkUpdateMonsterQuantitiesAction({ guildId, monsters: updates });
            if (res.success) {
                toast.success(`${selectedMonsterIds.size} monstres mis à jour !`);
                setIsSelectionMode(false);
                setSelectedMonsterIds(new Set());
                window.location.reload();
            } else {
                toast.error(res.error || "Erreur lors de la mise à jour groupée");
            }
        } catch {
            toast.error("Erreur réseau");
        } finally {
            setIsBulkUpdating(false);
        }
    };

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
    const sortMonsters = useCallback((monsters: OcreMonster[]): OcreMonster[] => {
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
    }, [filters.sortBy]);

    // Filter function
    const filterMonsters = useCallback((monsters: OcreMonster[]) => {
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
    }, [filters, sortMonsters]);

    // Filtered and sorted lists
    // Note: filterMonsters is already a useCallback — no extra useMemo needed.
    // The React Compiler handles memoization automatically.
    const filteredManquants = filterMonsters(manquants);
    const filteredPossedes = filterMonsters(possedes);
    const filteredDoublons = filterMonsters(doublons);

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [filters]);



    // Find exchange partners for a specific monster
    const handleFindExchanges = async (_monsterId: number): Promise<ExchangePartner[]> => {
        const result = await findMonsterOwnersAction({ guildId, monsterId: _monsterId });
        if (result.success && result.data) {
            return result.data;
        }
        return [];
    };

    // Progress Calculation Helpers
    const getProgressColor = (current: number, total: number) => {
        if (current === total) return "bg-success";
        if (current > total * 0.7) return "bg-success";
        if (current > total * 0.3) return "bg-warning";
        return "bg-danger";
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
                        <span className={category.gathered === total ? "text-success font-bold" : "text-foreground"}>
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
            {/* Header with Progress (Metamob Style) */}
            <div className="rounded-lg border border-border bg-card p-5">
                <div className="flex flex-col md:flex-row gap-6">
                    {/* Left Side: Character & Quest Info */}
                    <div className="flex-1 space-y-4">
                        <div className="flex flex-col gap-1">
                            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                                <Sparkles className="h-4 w-4 text-warning" aria-hidden="true" />
                                Quête de l&apos;Éternelle Moisson
                            </h2>
                            <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                <a
                                    href={`https://www.metamob.fr/profile/${data.questInfo.characterName}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-semibold text-foreground hover:text-warning transition-colors flex items-center gap-1 group/link"
                                >
                                    {data.questInfo.characterName}
                                    <ArrowRightLeft className="h-3 w-3 opacity-0 group-hover/link:opacity-100 transition-all -rotate-45" />
                                </a>
                                <span className="opacity-40">•</span>
                                {getDofusServerImage(data.questInfo.serverName) && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={getDofusServerImage(data.questInfo.serverName)!}
                                        alt=""
                                        loading="lazy"
                                        decoding="async"
                                        draggable={false}
                                        className="h-5 w-5 rounded object-cover border border-black/30"
                                    />
                                )}
                                <span>{data.questInfo.serverName}</span>
                                <Badge variant="outline" className="ml-2 border-warning/30 text-warning text-caption h-5 px-1.5">
                                    Unity
                                </Badge>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex flex-col rounded-md border border-border bg-surface px-3 py-2 min-w-[100px]">
                                <span className="text-xs font-medium text-muted-foreground">Étape actuelle</span>
                                <span className="text-lg font-bold text-warning">{data.questInfo.currentStep}<span className="text-muted-foreground/30 text-xs ml-1">/ {data.questInfo.totalSteps}</span></span>
                            </div>
                            <div className="flex flex-col rounded-md border border-border bg-surface px-3 py-2 min-w-[100px]">
                                <span className="text-xs font-medium text-muted-foreground">Progression</span>
                                <span className="text-lg font-bold text-success">{data.stats.progressPercent}%</span>
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Progress Bars */}
                    <div className="w-full md:w-[350px] space-y-4 rounded-lg border border-border bg-surface p-4">
                        {renderProgressBar("Gardiens", data.stats.bosses)}
                        {renderProgressBar("Archimonstres", data.stats.archis)}
                    </div>
                </div>

            </div>

            {/* Main Navigation Sub-menu */}
            <Tabs defaultValue="progression" className="w-full space-y-8">
                <TabsList className="flex items-center justify-start h-auto p-1 bg-surface border border-border rounded-lg w-full gap-1 overflow-x-auto no-scrollbar shrink-0">
                    <TabsTrigger
                        value="progression"
                        className="flex-1 py-2.5 px-4 rounded-md text-xs font-semibold text-muted-foreground data-[state=active]:bg-elevated data-[state=active]:text-warning hover:bg-surface transition-colors"
                    >
                        Progression
                    </TabsTrigger>
                    <TabsTrigger
                        value="monstres"
                        className="flex-1 py-2.5 px-4 rounded-md text-xs font-semibold text-muted-foreground data-[state=active]:bg-elevated data-[state=active]:text-warning hover:bg-surface transition-colors"
                    >
                        Bestiaire
                    </TabsTrigger>
                    <TabsTrigger
                        value="echanges"
                        className="flex-1 py-2.5 px-4 rounded-md text-xs font-semibold text-muted-foreground data-[state=active]:bg-elevated data-[state=active]:text-warning hover:bg-surface transition-colors"
                    >
                        Échanges
                    </TabsTrigger>
                    <TabsTrigger
                        value="membres"
                        className="flex-1 py-2.5 px-4 rounded-md text-xs font-semibold text-muted-foreground data-[state=active]:bg-elevated data-[state=active]:text-warning hover:bg-surface transition-colors"
                    >
                        Membres
                    </TabsTrigger>
                </TabsList>

                {/* Tab: Summary & Global Stats */}
                <TabsContent value="progression" className="space-y-6 outline-none mt-0">
                    <div className="grid gap-4">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vue d&apos;ensemble</h3>
                        <StatsGrid>
                            <OcreStatCard
                                label="Total éléments"
                                value={data.stats.total}
                                icon={Bug}
                                color="purple"
                            />
                            <OcreStatCard
                                label="Acquis / validés"
                                value={data.stats.acquired}
                                icon={CheckCircle2}
                                color="green"
                            />
                            <OcreStatCard
                                label="Reste à trouver"
                                value={data.stats.remaining}
                                icon={AlertTriangle}
                                color="red"
                            />
                            <OcreStatCard
                                label="Doublons"
                                value={data.stats.doublons}
                                icon={Gift}
                                color="amber"
                            />
                        </StatsGrid>
                    </div>

                    {/* Les pierres d'âme à prévoir vivent désormais dans l'encart du module
                        (page Quête Ocre) : une seule source, calculée par `buildOcrePlan`. */}
                </TabsContent>

                {/* Tab: Monsters & Search */}
                <TabsContent value="monstres" className="space-y-6 outline-none mt-0">
                    {/* Filter Bar */}
                    <OcreFilterBar
                        filters={filters}
                        onFiltersChange={setFilters}
                        steps={steps}
                        zones={zones}
                        guildId={guildId}
                        showMarketplace={false}
                        hasOcreChannel={hasOcreChannel}
                        selectionMode={isSelectionMode}
                        onSelectionModeToggle={() => {
                            setIsSelectionMode(!isSelectionMode);
                            setSelectedMonsterIds(new Set());
                        }}
                    />

                    {/* Secondary Tabs (Grid) */}
                    <Tabs defaultValue="manquants" className="w-full">
                        <div className="overflow-x-auto no-scrollbar pb-1">
                            <TabsList className="inline-flex w-auto bg-surface/50 backdrop-blur-sm border border-border p-1.5 rounded-2xl min-w-full sm:min-w-0 gap-2">
                                <TabsTrigger value="manquants" className="gap-3 rounded-xl py-3 px-6 data-[state=active]:bg-elevated data-[state=active]:text-danger data-[state=active]:shadow-lg border border-transparent data-[state=active]:border-danger/20 hover:bg-surface transition-all font-bold tracking-tight">
                                    <span className="hidden sm:inline">Manquants</span>
                                    <Badge variant="secondary" className="h-5 px-1.5 text-caption bg-danger/10 text-danger border-none font-black">
                                        {filteredManquants.length}
                                    </Badge>
                                </TabsTrigger>
                                <TabsTrigger value="possedes" className="gap-3 rounded-xl py-3 px-6 data-[state=active]:bg-elevated data-[state=active]:text-success data-[state=active]:shadow-lg border border-transparent data-[state=active]:border-success/20 hover:bg-surface transition-all font-bold tracking-tight">
                                    <span className="hidden sm:inline">Possédés</span>
                                    <Badge variant="secondary" className="h-5 px-1.5 text-caption bg-success/10 text-success border-none font-black">
                                        {filteredPossedes.length}
                                    </Badge>
                                </TabsTrigger>
                                <TabsTrigger value="doublons" className="gap-3 rounded-xl py-3 px-6 data-[state=active]:bg-elevated data-[state=active]:text-warning data-[state=active]:shadow-lg border border-transparent data-[state=active]:border-warning/20 hover:bg-surface transition-all font-bold tracking-tight">
                                    <span className="hidden sm:inline">Doublons</span>
                                    <Badge variant="secondary" className="h-5 px-1.5 text-caption bg-warning/10 text-warning border-none font-black">
                                        {filteredDoublons.length}
                                    </Badge>
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <TabsContent value="manquants" className="mt-6 outline-none">
                            <MonsterGrid
                                monsters={filteredManquants}
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
                                isSelectionMode={isSelectionMode}
                                selectedIds={selectedMonsterIds}
                                onToggleSelection={toggleMonsterSelection}
                            />
                        </TabsContent>

                        <TabsContent value="possedes" className="mt-6 outline-none">
                            <MonsterGrid
                                monsters={filteredPossedes}
                                guildId={guildId}
                                exchangeMap={{}}
                                emptyMessage={
                                    filters.searchQuery || filters.selectedType !== "all" || filters.selectedStep !== "all"
                                        ? "Aucun monstre ne correspond aux filtres"
                                        : "Vous n'avez encore aucun monstre possédé"
                                }
                                currentPage={currentPage}
                                onPageChange={setCurrentPage}
                                isSelectionMode={isSelectionMode}
                                selectedIds={selectedMonsterIds}
                                onToggleSelection={toggleMonsterSelection}
                            />
                        </TabsContent>

                        <TabsContent value="doublons" className="mt-6 outline-none">
                            <MonsterGrid
                                monsters={filteredDoublons}
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
                                isSelectionMode={isSelectionMode}
                                selectedIds={selectedMonsterIds}
                                onToggleSelection={toggleMonsterSelection}
                            />
                        </TabsContent>
                    </Tabs>
                </TabsContent>

                {/* Tab: Exchange Hub */}
                <TabsContent value="echanges" className="outline-none mt-0 space-y-8">
                    {/* Active Trade Requests Section */}
                    <OcreTradeInbox guildId={guildId} />

                    {/* Discovery Section (Placeholder styled as discovery) */}
                    <div className="flex flex-col items-center justify-center py-12 text-center space-y-6 bg-background/30 rounded-3xl border border-dashed border-border">
                        <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center border border-success/20">
                            <Sparkles className="h-8 w-8 text-success" />
                        </div>
                        <div className="max-w-sm space-y-2">
                            <h3 className="text-lg font-bold uppercase tracking-wider">Trouver de nouveaux partenaires</h3>
                            <p className="text-muted-foreground text-xs leading-relaxed">
                                Analysez les doublons des membres de la guilde pour trouver les archimonstres qui vous manquent.
                            </p>
                        </div>
                        <OcreExchangeModal
                            guildId={guildId}
                            hasOcreChannel={hasOcreChannel}
                            trigger={
                                <Button size="lg" className="bg-success hover:bg-success text-success-foreground rounded-2xl h-11 px-8 font-bold shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] text-xs">
                                    Lancer la recherche de doublons
                                </Button>
                            }
                        />
                    </div>
                </TabsContent>

                {/* Tab: Guild Directory (Membres) */}
                <TabsContent value="membres" className="outline-none mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <OcreGuildDirectory guildId={guildId} />
                </TabsContent>
            </Tabs>

            {/* Floating Bulk Action Bar */}
            <AnimatePresence>
                {isSelectionMode && selectedMonsterIds.size > 0 && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-[90vw] max-w-2xl"
                    >
                        <div className="bg-surface/90 backdrop-blur-2xl border border-warning/30 rounded-3xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4 pl-2">
                                <div className="h-10 w-10 rounded-2xl bg-warning/10 flex items-center justify-center border border-warning/20">
                                    <Badge className="bg-warning text-warning-foreground font-black">{selectedMonsterIds.size}</Badge>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-foreground uppercase tracking-wider">Monstres sélectionnés</span>
                                    <span className="text-caption text-muted-foreground italic">Actions groupées Metamob</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-10 rounded-xl bg-background/50 hover:bg-success/10 hover:text-success font-bold border-border"
                                    onClick={() => handleBulkUpdate('inc')}
                                    disabled={isBulkUpdating}
                                >
                                    {isBulkUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                                    +1
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-10 rounded-xl bg-background/50 hover:bg-danger/10 hover:text-danger font-bold border-border"
                                    onClick={() => handleBulkUpdate('dec')}
                                    disabled={isBulkUpdating}
                                >
                                    <Minus className="h-4 w-4 mr-2" />
                                    -1
                                </Button>
                                <div className="w-px h-8 bg-surface mx-1" />
                                <Button
                                    size="sm"
                                    className="h-10 px-6 rounded-xl bg-warning hover:bg-warning text-warning-foreground font-bold transition-all active:scale-95"
                                    onClick={() => handleBulkUpdate('set', 1)}
                                    disabled={isBulkUpdating}
                                >
                                    Possédé (1)
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
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
    isSelectionMode?: boolean;
    selectedIds?: Set<number>;
    onToggleSelection?: (id: number) => void;
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
    isSelectionMode = false,
    selectedIds = new Set(),
    onToggleSelection,
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
                        isSelected={selectedIds.has(monster.id)}
                        isSelectionMode={isSelectionMode}
                        onToggleSelection={onToggleSelection}
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

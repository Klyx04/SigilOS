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
    Sparkles,
    Check,
    User,
    CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Progress } from "@/components/ui/progress";
// import { ProgressRing } from "./progress-ring"; // Removed as we use bars now
import { OcreStatCard, StatsGrid } from "./ocre-stats";
import { OcreMonsterCard } from "./ocre-monster-card";
import { OcreFilterBar, type OcreFilters, type MonsterType, type SortOption } from "./ocre-filter-bar";
import { OcreExchangeModal } from "./ocre-exchange-modal";
import { OcreTradeInbox } from "./ocre-trade-inbox";
import {
    forceRefreshOcre,
    getGuildExchangeMap,
    findMonsterOwnersAction,
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

    // Quest Switcher State
    const [showSwitchDialog, setShowSwitchDialog] = useState(false);
    const [isSwitching, setIsSwitching] = useState(false);
    const [availableQuests, setAvailableQuests] = useState<OcreProgressData["questInfo"][] | any[]>([]);
    const [questsLoading, setQuestsLoading] = useState(false);

    // Handlers
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
        const result = await findMonsterOwnersAction({ guildId, monsterId: _monsterId });
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
                                    className="flex flex-col p-4 rounded-2xl border border-border bg-muted/30 hover:bg-accent/20 hover:border-amber-500/30 cursor-pointer transition-all group"
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20 group-hover:scale-110 transition-transform">
                                                <User className="h-5 w-5 text-amber-500" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-foreground">{quest.character_name}</span>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <span>{quest.server.name}</span>
                                                    <span className="opacity-30">•</span>
                                                    <Badge variant="secondary" className="text-[9px] h-4 px-1 bg-background/50">
                                                        {quest.quest_template.id === 1 ? "Unity" : "Rétro"}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                        <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 px-2 py-0.5 text-[10px] font-bold">
                                            Étape {quest.current_step}
                                        </Badge>
                                    </div>

                                    <Button
                                        size="sm"
                                        className="w-full h-9 rounded-xl text-xs font-bold gap-2 bg-background border border-border hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-all"
                                    >
                                        <Check className="h-3 w-3" />
                                        Activer cette quête
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Header with Progress (Metamob Style) */}
            <div className="relative overflow-hidden p-6 rounded-2xl bg-card border border-border shadow-xl">
                {/* Background Decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 blur-3xl -mr-32 -mt-32 pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row gap-8">
                    {/* Left Side: Character & Quest Info */}
                    <div className="flex-1 space-y-4">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-amber-500 fill-amber-500/20" />
                                Quête de l&apos;Éternelle Moisson
                            </h2>
                            <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                <a
                                    href={`https://www.metamob.fr/profile/${data.questInfo.characterName}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-semibold text-foreground hover:text-amber-500 transition-colors flex items-center gap-1 group/link"
                                >
                                    {data.questInfo.characterName}
                                    <ArrowRightLeft className="h-3 w-3 opacity-0 group-hover/link:opacity-100 transition-all -rotate-45" />
                                </a>
                                <span className="opacity-40">•</span>
                                <span>{data.questInfo.serverName}</span>
                                <Badge variant="outline" className="ml-2 border-amber-500/30 text-amber-500 text-[10px] h-5 px-1.5">
                                    Unity
                                </Badge>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex flex-col bg-background/50 border border-border px-3 py-2 rounded-xl min-w-[100px]">
                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Étape Actuelle</span>
                                <span className="text-lg font-bold text-amber-500">{data.questInfo.currentStep}<span className="text-muted-foreground/30 text-xs ml-1">/ {data.questInfo.totalSteps}</span></span>
                            </div>
                            <div className="flex flex-col bg-background/50 border border-border px-3 py-2 rounded-xl min-w-[100px]">
                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Progression</span>
                                <span className="text-lg font-bold text-emerald-500">{data.stats.progressPercent}%</span>
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                className="h-10 px-4 rounded-xl border-dashed border-border hover:border-amber-500/50 hover:bg-amber-500/5 transition-all group"
                                onClick={handleOpenSwitch}
                            >
                                <ArrowRightLeft className="h-4 w-4 mr-2 text-muted-foreground group-hover:text-amber-500 transition-colors" />
                                <span className="text-xs font-semibold">Changer de quête / perso</span>
                            </Button>
                        </div>
                    </div>

                    {/* Right Side: Progress Bars */}
                    <div className="w-full md:w-[350px] space-y-4 bg-background/30 p-5 rounded-3xl border border-border/50 shadow-inner">
                        {renderProgressBar("Gardiens", data.stats.bosses)}
                        {renderProgressBar("Archimonstres", data.stats.archis)}
                    </div>
                </div>

            </div>

            {/* Main Navigation Sub-menu */}
            <Tabs defaultValue="progression" className="w-full space-y-8">
                <TabsList className="flex items-center justify-start h-auto p-1.5 bg-zinc-900/50 border border-white/5 rounded-2xl w-full gap-3 overflow-x-auto no-scrollbar shrink-0">
                    <TabsTrigger
                        value="progression"
                        className="flex-1 py-3 px-6 rounded-xl data-[state=active]:bg-zinc-800 data-[state=active]:text-amber-500 data-[state=active]:shadow-lg hover:bg-white/5 transition-all font-bold uppercase tracking-widest text-xs border border-transparent data-[state=active]:border-amber-500/20"
                    >
                        Progression
                    </TabsTrigger>
                    <TabsTrigger
                        value="monstres"
                        className="flex-1 py-3 px-6 rounded-xl data-[state=active]:bg-zinc-800 data-[state=active]:text-amber-500 data-[state=active]:shadow-lg hover:bg-white/5 transition-all font-bold uppercase tracking-widest text-xs border border-transparent data-[state=active]:border-amber-500/20"
                    >
                        Bestiaire
                    </TabsTrigger>
                    <TabsTrigger
                        value="echanges"
                        className="flex-1 py-3 px-6 rounded-xl data-[state=active]:bg-zinc-800 data-[state=active]:text-amber-500 data-[state=active]:shadow-lg hover:bg-white/5 transition-all font-bold uppercase tracking-widest text-xs border border-transparent data-[state=active]:border-amber-500/20"
                    >
                        Échanges
                    </TabsTrigger>
                </TabsList>

                {/* Tab: Summary & Global Stats */}
                <TabsContent value="progression" className="space-y-8 outline-none mt-0">
                    <div className="grid gap-6">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/50">Vue d&apos;ensemble</h3>
                        <StatsGrid>
                            <OcreStatCard
                                label="Total Éléments"
                                value={data.stats.total}
                                icon={Bug}
                                color="purple"
                                delay={0}
                            />
                            <OcreStatCard
                                label="Acquis / Validés"
                                value={data.stats.acquired}
                                icon={CheckCircle2}
                                color="green"
                                delay={0.1}
                            />
                            <OcreStatCard
                                label="Reste à trouver"
                                value={data.stats.remaining}
                                icon={AlertTriangle}
                                color="red"
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
                    </div>

                    <div className="p-8 rounded-3xl border border-dashed border-border flex flex-col items-center justify-center text-center space-y-4">
                        <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                            <Sparkles className="h-6 w-6 text-amber-500" />
                        </div>
                        <div className="max-w-xs">
                            <h4 className="font-bold text-foreground">Astuce Ocre</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                                Utilisez la synchronisation Metamob pour mettre à jour vos captures automatiquement et trouver des partenaires d&apos;échange dans la guilde.
                            </p>
                        </div>
                    </div>
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
                    />

                    {/* Secondary Tabs (Grid) */}
                    <Tabs defaultValue="manquants" className="w-full">
                        <div className="overflow-x-auto no-scrollbar pb-1">
                            <TabsList className="inline-flex w-auto bg-zinc-900/50 backdrop-blur-sm border border-white/5 p-1.5 rounded-2xl min-w-full sm:min-w-0 gap-2">
                                <TabsTrigger value="manquants" className="gap-3 rounded-xl py-3 px-6 data-[state=active]:bg-zinc-800 data-[state=active]:text-red-400 data-[state=active]:shadow-lg border border-transparent data-[state=active]:border-red-500/20 hover:bg-white/5 transition-all font-bold tracking-tight">
                                    <span className="hidden sm:inline">Manquants</span>
                                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-red-500/10 text-red-500 border-none font-black">
                                        {filteredManquants.length}
                                    </Badge>
                                </TabsTrigger>
                                <TabsTrigger value="possedes" className="gap-3 rounded-xl py-3 px-6 data-[state=active]:bg-zinc-800 data-[state=active]:text-emerald-400 data-[state=active]:shadow-lg border border-transparent data-[state=active]:border-emerald-500/20 hover:bg-white/5 transition-all font-bold tracking-tight">
                                    <span className="hidden sm:inline">Possédés</span>
                                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-emerald-500/10 text-emerald-500 border-none font-black">
                                        {filteredPossedes.length}
                                    </Badge>
                                </TabsTrigger>
                                <TabsTrigger value="doublons" className="gap-3 rounded-xl py-3 px-6 data-[state=active]:bg-zinc-800 data-[state=active]:text-amber-400 data-[state=active]:shadow-lg border border-transparent data-[state=active]:border-amber-500/20 hover:bg-white/5 transition-all font-bold tracking-tight">
                                    <span className="hidden sm:inline">Doublons</span>
                                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-amber-500/10 text-amber-500 border-none font-black">
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
                                showExchangeButton={false}
                                currentPage={currentPage}
                                onPageChange={setCurrentPage}
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
                        <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                            <Sparkles className="h-8 w-8 text-emerald-500" />
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
                                <Button size="lg" className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl h-11 px-8 font-bold shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] text-xs">
                                    Lancer la recherche de doublons
                                </Button>
                            }
                        />
                    </div>
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

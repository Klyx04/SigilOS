"use client";

import { useState, useMemo, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { MonsterCard } from "./monster-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Search, AlertTriangle, Package, Gift, Bug, RefreshCw, MapPin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import {
    refreshMyMetamobCache,
    getGuildDoublonsMap,
    type MyArchimonstresData,
    type DoublonsMapData
} from "@/server/actions/metamob-actions";
import { toast } from "sonner";
import type { MetamobMonster } from "@/lib/metamob-api";

interface ArchiHubProps {
    data: MyArchimonstresData;
    guildId: string;
}

export function ArchiHub({ data, guildId }: ArchiHubProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedZone, setSelectedZone] = useState<string>("all");
    const [showExchangeableOnly, setShowExchangeableOnly] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Pre-loaded exchange availability map
    const [doublonsMap, setDoublonsMap] = useState<Record<number, number>>({});
    const [doublonsLoading, setDoublonsLoading] = useState(true);

    const loadDoublonsMap = async () => {
        setDoublonsLoading(true);
        const result = await getGuildDoublonsMap(guildId);
        if (result.success && result.data) {
            setDoublonsMap(result.data.availableExchanges);
        }
        setDoublonsLoading(false);
    };

    // Load doublons map once on mount
    useEffect(() => {
        loadDoublonsMap();
    }, [guildId]);

    // Extract unique zones from monsters
    const zones = useMemo(() => {
        const uniqueZones = new Set<string>();
        data.monsters.forEach((m) => {
            if (m.zone) uniqueZones.add(m.zone);
        });
        return Array.from(uniqueZones).sort();
    }, [data.monsters]);

    // Categorize monsters
    const { manquants, possedes, doublons } = useMemo(() => {
        return {
            manquants: data.monsters.filter((m) => m.etat === "MANQUANT"),
            possedes: data.monsters.filter((m) => m.etat === "POSSEDE"),
            doublons: data.monsters.filter((m) => m.etat === "DOUBLON"),
        };
    }, [data.monsters]);

    // Count monsters with available exchanges
    const monstersWithExchanges = useMemo(() => {
        return manquants.filter(m => doublonsMap[m.id] && doublonsMap[m.id] > 0).length;
    }, [manquants, doublonsMap]);

    // Filter monsters by search query, zone, and exchangeable
    const filterMonsters = (monsters: MetamobMonster[], applyExchangeFilter = false) => {
        let filtered = monsters;

        // Filter by zone
        if (selectedZone !== "all") {
            filtered = filtered.filter((m) => m.zone === selectedZone);
        }

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                (m) =>
                    m.nom.toLowerCase().includes(query) ||
                    m.zone.toLowerCase().includes(query) ||
                    (m.souszone && m.souszone.toLowerCase().includes(query))
            );
        }

        // Filter exchangeable only (only for manquants tab)
        if (applyExchangeFilter && showExchangeableOnly) {
            filtered = filtered.filter(m => doublonsMap[m.id] && doublonsMap[m.id] > 0);
        }

        return filtered;
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        const result = await refreshMyMetamobCache(guildId);
        if (result.success) {
            toast.success("Données actualisées ! Rechargez la page pour voir les changements.");
            // Also refresh the doublons map
            loadDoublonsMap();
        } else {
            toast.error(result.error || "Erreur lors du rafraîchissement");
        }
        setIsRefreshing(false);
    };

    const clearFilters = () => {
        setSearchQuery("");
        setSelectedZone("all");
        setShowExchangeableOnly(false);
    };

    const hasActiveFilters = searchQuery.trim() !== "" || selectedZone !== "all" || showExchangeableOnly;

    return (
        <div className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    label="Total Archimonstres"
                    value={data.stats.total}
                    icon={<Bug className="h-5 w-5" />}
                    color="text-primary"
                />
                <StatCard
                    label="Manquants"
                    value={data.stats.manquants}
                    icon={<AlertTriangle className="h-5 w-5" />}
                    color="text-red-500"
                    subValue={!doublonsLoading && monstersWithExchanges > 0
                        ? `${monstersWithExchanges} échangeables`
                        : undefined
                    }
                    subColor="text-emerald-500"
                />
                <StatCard
                    label="Possédés"
                    value={data.stats.possedes}
                    icon={<Package className="h-5 w-5" />}
                    color="text-emerald-500"
                />
                <StatCard
                    label="Doublons"
                    value={data.stats.doublons}
                    icon={<Gift className="h-5 w-5" />}
                    color="text-amber-500"
                />
            </div>

            {/* Filters Bar */}
            <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Rechercher un archimonstre..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>

                {/* Zone Filter */}
                <Select value={selectedZone} onValueChange={setSelectedZone}>
                    <SelectTrigger className="w-[180px]">
                        <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                        <SelectValue placeholder="Toutes les zones" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Toutes les zones</SelectItem>
                        {zones.map((zone) => (
                            <SelectItem key={zone} value={zone}>
                                {zone}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Exchangeable Only Toggle */}
                <Toggle
                    pressed={showExchangeableOnly}
                    onPressedChange={setShowExchangeableOnly}
                    className="gap-2 data-[state=on]:bg-emerald-600 data-[state=on]:text-white"
                    disabled={doublonsLoading || monstersWithExchanges === 0}
                >
                    <Sparkles className="h-4 w-4" />
                    <span className="hidden sm:inline">Échangeables</span>
                    {monstersWithExchanges > 0 && (
                        <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                            {monstersWithExchanges}
                        </Badge>
                    )}
                </Toggle>

                {/* Clear Filters */}
                {hasActiveFilters && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        Effacer
                    </Button>
                )}

                {/* Refresh */}
                <Button
                    variant="outline"
                    size="icon"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                >
                    <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                </Button>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="manquants" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="manquants" className="gap-2">
                        <span className="hidden sm:inline">🔴</span>
                        Manquants
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                            {filterMonsters(manquants, true).length}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="possedes" className="gap-2">
                        <span className="hidden sm:inline">🟢</span>
                        Possédés
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                            {filterMonsters(possedes).length}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="doublons" className="gap-2">
                        <span className="hidden sm:inline">🟡</span>
                        Doublons
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                            {filterMonsters(doublons).length}
                        </Badge>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="manquants" className="mt-6">
                    <MonsterGrid
                        monsters={filterMonsters(manquants, true)}
                        guildId={guildId}
                        emptyMessage={hasActiveFilters
                            ? showExchangeableOnly
                                ? "Aucun monstre échangeable ne correspond aux filtres"
                                : "Aucun monstre manquant ne correspond aux filtres"
                            : "Vous avez tous les archimonstres ! 🎉"
                        }
                        showOwners
                        doublonsMap={doublonsMap}
                    />
                </TabsContent>

                <TabsContent value="possedes" className="mt-6">
                    <MonsterGrid
                        monsters={filterMonsters(possedes)}
                        guildId={guildId}
                        emptyMessage={hasActiveFilters
                            ? "Aucun monstre possédé ne correspond aux filtres"
                            : "Aucun archimonstre avec un seul exemplaire"
                        }
                        showOwners={false}
                        doublonsMap={{}}
                    />
                </TabsContent>

                <TabsContent value="doublons" className="mt-6">
                    <MonsterGrid
                        monsters={filterMonsters(doublons)}
                        guildId={guildId}
                        emptyMessage={hasActiveFilters
                            ? "Aucun doublon ne correspond aux filtres"
                            : "Vous n'avez pas de doublons à proposer"
                        }
                        showOwners={false}
                        doublonsMap={{}}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

function StatCard({
    label,
    value,
    icon,
    color,
    subValue,
    subColor,
}: {
    label: string;
    value: number;
    icon: React.ReactNode;
    color: string;
    subValue?: string;
    subColor?: string;
}) {
    return (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-4">
                <div className="flex items-center gap-3">
                    <div className={`${color}`}>{icon}</div>
                    <div>
                        <p className="text-2xl font-bold">{value}</p>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        {subValue && (
                            <p className={`text-xs font-medium ${subColor || "text-muted-foreground"}`}>
                                ✨ {subValue}
                            </p>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function MonsterGrid({
    monsters,
    guildId,
    emptyMessage,
    showOwners,
    doublonsMap,
}: {
    monsters: MetamobMonster[];
    guildId: string;
    emptyMessage: string;
    showOwners: boolean;
    doublonsMap: Record<number, number>;
}) {
    if (monsters.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <Bug className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <ScrollArea className="h-[600px] pr-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {monsters.map((monster) => (
                    <MonsterCard
                        key={monster.id}
                        monster={monster}
                        guildId={guildId}
                        showOwners={showOwners}
                        availableHelpers={doublonsMap[monster.id] || 0}
                    />
                ))}
            </div>
        </ScrollArea>
    );
}

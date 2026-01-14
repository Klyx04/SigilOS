"use client";

import { useState, useMemo } from "react";
import { Package, Plus, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { addDreamBonus } from "@/server/actions/songes/dream-run-actions";
import type { DreamRunBonus } from "@prisma/client";

// @ts-ignore - JSON import
import bonusData from "@/../src/bonus_songes.json";
import type { SongesBonus } from "@/lib/songes/types";

interface BonusInventoryProps {
    bonuses: DreamRunBonus[];
    runId: string;
    pointsReve?: number; // Optional now, not used for purchase restrictions
}

const RARITY_COLORS = {
    Commun: "text-gray-300 border-gray-500/30 bg-gray-900/20",
    Rare: "text-blue-300 border-blue-500/30 bg-blue-900/20",
    Épique: "text-purple-300 border-purple-500/30 bg-purple-900/20",
    Légendaire: "text-amber-300 border-amber-500/30 bg-amber-900/20",
};

// Sous-filtres par type selon specs V2
const SUBFILTERS_BY_TYPE: Record<string, string[]> = {
    actif: ["Épique", "Légendaire"],
    passif: [], // Pas de sous-filtre car uniquement Légendaire
    bonus: ["Commun", "Rare", "Épique"],
    consommable: ["Rare", "Épique"],
};

export function BonusInventory({ bonuses, runId }: BonusInventoryProps) {
    const [shopOpen, setShopOpen] = useState(false);
    const [typeFilter, setTypeFilter] = useState<string | null>(null);
    const [rarityFilter, setRarityFilter] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(false);

    const typedBonusData = bonusData as SongesBonus[];

    // Get available rarity subfilters based on type
    const availableRarities = typeFilter ? SUBFILTERS_BY_TYPE[typeFilter] : [];

    // Filter logic with search
    const filteredShop = useMemo(() => {
        return typedBonusData.filter((b) => {
            if (typeFilter && b.type !== typeFilter) return false;
            if (rarityFilter && b.rarete !== rarityFilter) return false;
            if (searchQuery && !b.nom.toLowerCase().includes(searchQuery.toLowerCase())) return false;
            return true;
        });
    }, [typedBonusData, typeFilter, rarityFilter, searchQuery]);

    const handleTypeFilter = (type: string | null) => {
        setTypeFilter(type);
        setRarityFilter(null); // Reset rarity when type changes
    };

    const handleBuy = async (bonus: SongesBonus) => {
        setLoading(true);
        await addDreamBonus({
            runId,
            bonusName: bonus.nom,
            bonusType: bonus.type,
            bonusRarete: bonus.rarete,
            cost: 0, // No cost system anymore
        });
        setShopOpen(false);
        setLoading(false);
    };

    return (
        <div className="rounded-xl bg-gradient-to-b from-[#1a0933] to-[#0d0520] border border-purple-500/30 p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Package className="w-5 h-5 text-purple-400" />
                    Bonus ({bonuses.length})
                </h3>

                <Dialog open={shopOpen} onOpenChange={setShopOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" variant="outline" className="border-purple-500/30 text-purple-300">
                            <Plus className="w-4 h-4 mr-1" />
                            Acheter
                        </Button>
                    </DialogTrigger>

                    <DialogContent className="bg-[#1a0933] border-purple-500/30 text-white max-w-2xl max-h-[80vh] overflow-auto">
                        <DialogHeader>
                            <DialogTitle>
                                🛒 Fontaine Onirique
                            </DialogTitle>
                        </DialogHeader>

                        {/* Search Field */}
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                            <Input
                                placeholder="Rechercher un bonus..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 bg-purple-900/30 border-purple-500/30 text-white placeholder:text-purple-400/50"
                            />
                        </div>

                        {/* Type Filters */}
                        <div className="mb-2">
                            <div className="text-xs text-purple-300/70 mb-1">Type</div>
                            <div className="flex gap-2 flex-wrap">
                                <Button
                                    size="sm"
                                    variant={typeFilter === null ? "default" : "outline"}
                                    onClick={() => handleTypeFilter(null)}
                                    className="text-xs"
                                >
                                    Tous
                                </Button>
                                {["bonus", "passif", "actif", "consommable"].map((type) => (
                                    <Button
                                        key={type}
                                        size="sm"
                                        variant={typeFilter === type ? "default" : "outline"}
                                        onClick={() => handleTypeFilter(type)}
                                        className="text-xs capitalize"
                                    >
                                        {type}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Rarity Subfilters (when type is selected and has subfilters) */}
                        {typeFilter && availableRarities.length > 0 && (
                            <div className="mb-4">
                                <div className="text-xs text-purple-300/70 mb-1">Rareté</div>
                                <div className="flex gap-2 flex-wrap">
                                    <Button
                                        size="sm"
                                        variant={rarityFilter === null ? "default" : "outline"}
                                        onClick={() => setRarityFilter(null)}
                                        className="text-xs"
                                    >
                                        Toutes
                                    </Button>
                                    {availableRarities.map((rarity) => (
                                        <Button
                                            key={rarity}
                                            size="sm"
                                            variant={rarityFilter === rarity ? "default" : "outline"}
                                            onClick={() => setRarityFilter(rarity)}
                                            className={`text-xs ${RARITY_COLORS[rarity as keyof typeof RARITY_COLORS] || ""}`}
                                        >
                                            {rarity}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Results count */}
                        <div className="text-xs text-purple-300/50 mb-2">
                            {filteredShop.length} bonus trouvés
                        </div>

                        {/* Bonus Grid */}
                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {filteredShop.slice(0, 50).map((bonus, i) => (
                                <div
                                    key={i}
                                    className={`p-3 rounded-lg border ${RARITY_COLORS[bonus.rarete]} flex justify-between items-start gap-4`}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm">{bonus.nom}</div>
                                        <div className="text-xs opacity-70 line-clamp-2">{bonus.effets}</div>
                                        <div className="text-xs mt-1 flex gap-2">
                                            <span className="capitalize">{bonus.type}</span>
                                            <span>•</span>
                                            <span>{bonus.rarete}</span>
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        disabled={loading}
                                        onClick={() => handleBuy(bonus)}
                                        className="bg-purple-600 hover:bg-purple-500 text-white"
                                    >
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ajouter"}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Owned Bonuses */}
            {bonuses.length === 0 ? (
                <div className="text-center py-6 text-purple-300/50">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Aucun bonus acquis</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {bonuses.map((bonus) => (
                        <div
                            key={bonus.id}
                            className={`p-2 rounded-lg border text-sm ${RARITY_COLORS[bonus.bonusRarete as keyof typeof RARITY_COLORS]}`}
                        >
                            <div className="font-medium">{bonus.bonusName}</div>
                            <div className="text-xs opacity-70 capitalize">{bonus.bonusType}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

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
    guildId: string;
    bonuses: DreamRunBonus[];
    runId: string;
    pointsReve?: number; // Optional now, not used for purchase restrictions
    isLeader?: boolean;
    onUpdate?: () => void;
}

const RARITY_STYLES = {
    Commun: "border-slate-600 bg-slate-900/40 text-slate-300 shadow-[0_0_10px_rgba(148,163,184,0.1)] hover:border-slate-500",
    Rare: "border-blue-500/40 bg-blue-950/30 text-blue-200 shadow-[0_0_15px_rgba(59,130,246,0.15)] hover:border-blue-400 hover:shadow-[0_0_20px_rgba(59,130,246,0.25)]",
    Épique: "border-purple-500/40 bg-[#1a0b2e]/60 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.15)] hover:border-purple-400 hover:shadow-[0_0_20px_rgba(168,85,247,0.25)]",
    Légendaire: "border-amber-500/40 bg-[#2e1a0b]/60 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.15)] hover:border-amber-400 hover:shadow-[0_0_20px_rgba(245,158,11,0.25)]",
};

// Sous-filtres par type selon specs V2
const SUBFILTERS_BY_TYPE: Record<string, string[]> = {
    actif: ["Épique", "Légendaire"],
    passif: [], // Pas de sous-filtre car uniquement Légendaire
    bonus: ["Commun", "Rare", "Épique"],
    consommable: ["Rare", "Épique"],
};

// ... imports
import { deleteDreamBonus } from "@/server/actions/songes/dream-run-actions";
import { Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import Image from "next/image";

// Minor bonuses list provided by user
const MINOR_BONUSES = [
    { name: "5% Dégâts", type: "MINEUR", effet: "+5% Dommages finaux", icon: "⚔️" },
    { name: "20% Vitalité", type: "MINEUR", effet: "+20% Vitalité", icon: "❤️" },
    { name: "2 Portée", type: "MINEUR", effet: "+2 Portée", icon: "🏹" },
    { name: "1 PA", type: "MINEUR", effet: "+1 Point d'Action", icon: "⚡" },
    { name: "1 PM", type: "MINEUR", effet: "+1 Point de Mouvement", icon: "🦶" },
    { name: "Sorts : +1 Portée", type: "MINEUR", effet: "Augmente la portée maximale des sorts de 1", icon: "🎯" },
    { name: "Sorts : -1 Relance", type: "MINEUR", effet: "Réduit l'intervalle de relance des sorts de 1", icon: "🔄" },
    { name: "Sorts : +1 Lancer/Tour", type: "MINEUR", effet: "Augmente le nombre de lancers par tour de 1", icon: "🔢" },
    { name: "Sorts : +1 Lancer/Cible", type: "MINEUR", effet: "Augmente le nombre de lancers par cible de 1", icon: "🎯" },
    { name: "Tempête Astrale", type: "MINEUR", effet: "Invoque une tempête astrale en début de combat", icon: "🌪️" },
    { name: "5 Points de Rêve", type: "MINEUR", effet: "Gagne instantanément 5 PR (devrait être géré par edit floor normalement)", icon: "✨" },
    { name: "15 Points de Rêve", type: "MINEUR", effet: "Gagne instantanément 15 PR", icon: "✨" },
    { name: "Armes : +1 Lancer/Tour", type: "MINEUR", effet: "Augmente le nombre de lancers d'arme par tour de 1", icon: "🗡️" },
    { name: "Armes : +1 Portée", type: "MINEUR", effet: "Augmente la portée de l'arme de 1", icon: "📏" },
];

export function BonusInventory({ guildId, bonuses, runId, isLeader = false, onUpdate }: BonusInventoryProps) {
    const [shopOpen, setShopOpen] = useState(false);
    const [typeFilter, setTypeFilter] = useState<string | null>(null);
    const [rarityFilter, setRarityFilter] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(false);

    const typedBonusData = bonusData as SongesBonus[];
    const availableRarities = typeFilter ? SUBFILTERS_BY_TYPE[typeFilter] : [];

    const filteredShop = useMemo(() => {
        return typedBonusData.filter((b) => {
            if (typeFilter && b.type !== typeFilter) return false;
            if (rarityFilter && b.rarete !== rarityFilter) return false;
            if (searchQuery && !b.nom.toLowerCase().includes(searchQuery.toLowerCase())) return false;
            return true;
        });
    }, [typedBonusData, typeFilter, rarityFilter, searchQuery]);

    // Separate grouped bonuses into Major and Minor
    const { groupedMajor, groupedMinor } = useMemo(() => {
        const majorGroups: Record<string, { count: number; instances: DreamRunBonus[] }> = {};
        const minorGroups: Record<string, { count: number; instances: DreamRunBonus[] }> = {};

        for (const b of bonuses) {
            const key = `${b.bonusName}-${b.bonusType}`;
            const target = b.bonusType === 'MINEUR' ? minorGroups : majorGroups;

            if (!target[key]) {
                target[key] = { count: 0, instances: [] };
            }
            target[key].count++;
            target[key].instances.push(b);
        }

        const toArray = (groups: typeof majorGroups) => Object.values(groups).map(g => ({
            ...g.instances[0],
            count: g.count,
            allIds: g.instances.map(i => i.id)
        })).sort((a, b) => a.bonusName.localeCompare(b.bonusName));

        return {
            groupedMajor: toArray(majorGroups),
            groupedMinor: toArray(minorGroups)
        };
    }, [bonuses]);

    const handleTypeFilter = (type: string | null) => {
        setTypeFilter(type);
        setRarityFilter(null);
    };

    const handleDelete = async (bonusId: string) => {
        if (!confirm("Supprimer ce bonus ?")) return;
        setLoading(true);
        const res = await deleteDreamBonus(guildId, { runId, bonusId });
        setLoading(false);
        if (res.success) {
            toast.success("Bonus supprimé");
            onUpdate?.();
        } else {
            toast.error(res.error);
        }
    };

    const handleAddMinor = async (bonus: typeof MINOR_BONUSES[0]) => {
        setLoading(true);
        const res = await addDreamBonus(guildId, {
            runId,
            bonusName: bonus.name,
            bonusType: "MINEUR",
            bonusRarete: "Commun",
            cost: 0
        });
        setLoading(false);
        if (res.success) {
            toast.success("Bonus mineur ajouté");
            onUpdate?.();
        } else {
            toast.error(res.error);
        }
    };

    const handleBuy = async (bonus: SongesBonus) => {
        setLoading(true);
        const res = await addDreamBonus(guildId, {
            runId,
            bonusName: bonus.nom,
            bonusType: bonus.type,
            bonusRarete: bonus.rarete,
            cost: 0,
        });
        setLoading(false);
        if (res.success) {
            toast.success("Bonus acheté !");
            onUpdate?.();
        } else {
            toast.error(res.error || "Erreur lors de l'achat");
        }
    };

    // Helper to render a bonus item row (Inventory view)
    const renderBonusRow = (group: typeof groupedMajor[0], isMinor: boolean) => (
        <div
            key={group.id}
            className={`group relative p-3 rounded-lg border text-sm flex justify-between items-center transition-all bg-[#130720] hover:bg-[#1a0e2e]
                 ${isMinor ? 'border-zinc-800 text-zinc-400' : RARITY_STYLES[group.bonusRarete as keyof typeof RARITY_STYLES] ? RARITY_STYLES[group.bonusRarete as keyof typeof RARITY_STYLES].split(' ')[0] : 'border-gray-500'}
            `}
        >
            <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded flex items-center justify-center bg-black/40 font-bold text-lg border border-white/10
                    ${group.bonusRarete === 'Légendaire' ? 'text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'text-purple-400'}
                 `}>
                    {isMinor ? '✨' : group.bonusName.charAt(0)}
                </div>

                <div>
                    <div className="font-bold flex items-center gap-2 text-base text-gray-200">
                        {group.bonusName}
                        {group.count > 1 && (
                            <span className="bg-purple-600 text-white text-[10px] px-1.5 py-0.5 rounded ml-2 border border-purple-400/50 shadow-sm">
                                x{group.count}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {isLeader && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 hover:bg-red-950/50 transition-all rounded-full"
                    onClick={() => handleDelete(group.allIds[group.allIds.length - 1])}
                >
                    <Trash2 className="w-4 h-4" />
                </Button>
            )}
        </div>
    );

    return (
        <div className="rounded-xl border border-purple-500/20 bg-[#0a0118]/95 p-6 overflow-hidden relative shadow-2xl">
            {/* Background Noise */}
            <div className="absolute inset-0 opacity-5 bg-[url('/noise.png')] mix-blend-overlay pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between mb-6 relative z-10">
                <div>
                    <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-200 to-indigo-200 flex items-center gap-3">
                        <Package className="w-5 h-5 text-purple-400" />
                        Inventaire Onirique
                    </h3>
                    <p className="text-sm text-purple-400/50 mt-1">
                        Bonus actifs et bénédictions
                    </p>
                </div>

                {isLeader && (
                    <Dialog open={shopOpen} onOpenChange={setShopOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-purple-600 hover:bg-purple-500 text-white border border-purple-400/30 shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-all hover:scale-105">
                                <Plus className="w-4 h-4 mr-2" />
                                Ouvrir la Fontaine
                            </Button>
                        </DialogTrigger>

                        <DialogContent className="bg-[#0f0518] border-purple-500/30 text-white w-full sm:max-w-[1400px] h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl shadow-purple-900/20">
                            <div className="p-6 border-b border-purple-500/20 bg-[#150a25]">
                                <DialogHeader>
                                    <DialogTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-200 via-pink-200 to-amber-200">
                                        Fontaine des Songes
                                    </DialogTitle>
                                </DialogHeader>
                            </div>

                            <Tabs defaultValue="shop" className="flex-1 flex flex-col overflow-hidden">
                                <div className="px-6 pt-6 pb-6 bg-[#150a25] shadow-lg z-20 relative">
                                    <TabsList className="bg-purple-900/40 border border-purple-500/20 w-full p-1 h-auto grid grid-cols-2 gap-2">
                                        <TabsTrigger value="shop" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white py-3 px-4 font-bold uppercase tracking-wider transition-all">Fontaine Majeure</TabsTrigger>
                                        <TabsTrigger value="minor" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white py-3 px-4 font-bold uppercase tracking-wider transition-all">Bonus Mineurs</TabsTrigger>
                                    </TabsList>
                                </div>

                                <TabsContent value="shop" className="flex-1 overflow-hidden flex flex-col gap-4 p-6 bg-[#0a0118] relative">
                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-purple-900/10 via-transparent to-transparent pointer-events-none" />

                                    {/* Filters Bar */}
                                    <div className="flex flex-col gap-4 relative z-10 p-4 rounded-xl bg-white/5 border border-white/5 backdrop-blur-sm">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                                            <Input
                                                placeholder="Rechercher un pouvoir..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="pl-10 bg-black/40 border-purple-500/30 text-white placeholder:text-purple-400/30 focus-visible:ring-purple-500/50"
                                            />
                                        </div>

                                        <div className="flex gap-4 items-center flex-wrap">
                                            <div className="flex gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
                                                {["bonus", "passif", "actif", "consommable"].map((type) => (
                                                    <Button
                                                        key={type}
                                                        size="sm"
                                                        variant={typeFilter === type ? "secondary" : "ghost"}
                                                        onClick={() => handleTypeFilter(typeFilter === type ? null : type)}
                                                        className={`text-xs capitalize ${typeFilter === type ? 'bg-purple-600 text-white hover:bg-purple-500' : 'text-purple-300 hover:text-white hover:bg-white/5'}`}
                                                    >
                                                        {type}
                                                    </Button>
                                                ))}
                                            </div>

                                            {typeFilter && availableRarities.length > 0 && (
                                                <div className="flex gap-1 bg-black/40 p-1 rounded-lg border border-white/5 animate-in fade-in slide-in-from-left-4">
                                                    {availableRarities.map((rarity) => (
                                                        <Button
                                                            key={rarity}
                                                            size="sm"
                                                            variant={rarityFilter === rarity ? "secondary" : "ghost"}
                                                            onClick={() => setRarityFilter(rarityFilter === rarity ? null : rarity)}
                                                            className={`text-xs ${rarityFilter === rarity
                                                                ? 'bg-amber-600 text-white hover:bg-amber-500'
                                                                : 'text-amber-200/70 hover:text-amber-100 hover:bg-amber-900/20'}`}
                                                        >
                                                            {rarity}
                                                        </Button>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="ml-auto text-xs text-purple-400/50 italic">
                                                {filteredShop.length} résultats
                                            </div>
                                        </div>
                                    </div>

                                    {/* Grid Results */}
                                    <div className="overflow-y-auto pr-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6 gap-4 pb-20">
                                        {filteredShop.slice(0, 50).map((bonus, i) => {
                                            // Robust color mapping
                                            const getRarityColor = (r: string) => {
                                                if (r === 'Légendaire') return 'bg-amber-500';
                                                if (r === 'Épique') return 'bg-purple-500';
                                                if (r === 'Rare') return 'bg-blue-500';
                                                return 'bg-slate-500';
                                            };
                                            const colorClass = getRarityColor(bonus.rarete);
                                            const textColor = bonus.rarete === 'Légendaire' ? 'text-amber-400' : bonus.rarete === 'Épique' ? 'text-purple-400' : 'text-slate-200';
                                            const fullEffects = bonus.effets.replace(/\|/g, " • ");

                                            return (
                                                <div key={`${bonus.nom}-${i}`} title={fullEffects} className="flex rounded-xl border border-white/10 bg-[#120820] overflow-hidden group hover:bg-[#1a0e2e] transition-all h-[130px]">
                                                    {/* Left Colored Bar */}
                                                    <div className={`w-2 self-stretch ${colorClass} opacity-80`} />

                                                    {/* Main Content */}
                                                    <div className="flex-1 p-4 flex gap-3 min-w-0">
                                                        <div className="flex-1 flex flex-col min-w-0">
                                                            {/* Header */}
                                                            <div className="flex items-start justify-between gap-2 mb-1">
                                                                <div className={`font-bold text-base truncate ${textColor}`}>
                                                                    {bonus.nom}
                                                                </div>
                                                            </div>

                                                            {/* Description with Line Clamp */}
                                                            <div className="text-sm text-gray-300/90 leading-snug font-medium mb-auto line-clamp-3" style={{ wordBreak: 'break-word' }}>
                                                                {fullEffects}
                                                            </div>

                                                            {/* Tags Footer */}
                                                            <div className="flex gap-2 text-[10px] uppercase tracking-wider font-bold opacity-60 text-gray-400 pt-2 shrink-0">
                                                                <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5 whitespace-nowrap">{bonus.type}</span>
                                                                <span className={`${textColor} whitespace-nowrap`}>{bonus.rarete}</span>
                                                            </div>
                                                        </div>

                                                        {/* Button (Right aligned, vertically centered) */}
                                                        <div className="flex flex-col justify-center shrink-0">
                                                            <Button
                                                                disabled={loading}
                                                                onClick={() => handleBuy(bonus)}
                                                                className="h-9 w-20 bg-purple-600/20 border border-purple-500/30 hover:bg-purple-600 text-white rounded transition-colors text-xs"
                                                            >
                                                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ajouter"}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </TabsContent>

                                <TabsContent value="minor" className="flex-1 overflow-auto p-6 bg-[#0a0118] pb-20">
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8 gap-4">
                                        {MINOR_BONUSES.map((bonus, i) => (
                                            <div key={i} className="group relative p-4 rounded-xl bg-[#150a25] border border-purple-500/20 hover:border-purple-400/50 hover:bg-[#1f0f35] transition-all duration-300 hover:shadow-xl hover:shadow-purple-900/20 flex flex-col justify-between h-full min-h-[180px]">
                                                <div className="flex flex-col items-center text-center gap-3">
                                                    <div className="w-12 h-12 rounded-full bg-purple-900/30 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform duration-300 border border-purple-500/20 group-hover:border-purple-400">
                                                        {bonus.icon}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-sm text-white group-hover:text-purple-200">{bonus.name}</div>
                                                        <div className="text-xs text-purple-400/70 mt-1 leading-snug">{bonus.effet}</div>
                                                    </div>
                                                </div>
                                                <div className="mt-4 pt-4 border-t border-white/5 w-full">
                                                    <Button
                                                        onClick={() => handleAddMinor(bonus)}
                                                        disabled={loading}
                                                        className="w-full bg-purple-600/20 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/30 transition-all text-xs font-bold uppercase tracking-wider"
                                                    >
                                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ajouter"}
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {/* Inventory List (Separated) */}
            <div className="space-y-6 relative z-10">
                {groupedMajor.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-xs uppercase tracking-widest text-purple-400/70 font-bold mb-2 pl-1">Bonus Majeurs</h4>
                        {groupedMajor.map(group => renderBonusRow(group, false))}
                    </div>
                )}

                {groupedMinor.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-xs uppercase tracking-widest text-purple-400/70 font-bold mb-2 pl-1">Bonus Mineurs</h4>
                        {groupedMinor.map(group => renderBonusRow(group, true))}
                    </div>
                )}

                {groupedMajor.length === 0 && groupedMinor.length === 0 && (
                    <div className="text-center py-12 text-purple-400/30 italic bg-black/20 rounded-xl border border-dashed border-purple-500/20">
                        Aucun bonus actif.
                    </div>
                )}
            </div>
        </div>
    );
}

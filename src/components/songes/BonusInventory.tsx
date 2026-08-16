"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { Package, Plus, Loader2, Search, Sparkles, X, Star } from "lucide-react";
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

// ... imports
import { deleteDreamBonus } from "@/server/actions/songes/dream-run-actions";
import { Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface BonusInventoryProps {
    guildId: string;
    bonuses: DreamRunBonus[];
    runId: string;
    pointsReve?: number;
    isLeader?: boolean;
    onUpdate?: () => void;
}

// ─────────────────────────────────────────────
// DESIGN SYSTEM — rareté
// ─────────────────────────────────────────────
const RARITY_CONFIG = {
    Légendaire: {
        bar: "bg-amber-400",
        glow: "",
        border: "border-amber-500/40",
        bg: "bg-gradient-to-br from-[#1c1100] to-[#0f0a00]",
        text: "text-amber-300",
        badge: "bg-amber-500/20 text-amber-300 border-amber-500/30",
        icon: "🟡",
        dot: "bg-amber-400",
    },
    Épique: {
        bar: "bg-violet-500",
        glow: "",
        border: "border-violet-500/40",
        bg: "bg-gradient-to-br from-[#120b20] to-[#0a0712]",
        text: "text-violet-300",
        badge: "bg-violet-500/20 text-violet-300 border-violet-500/30",
        icon: "🟣",
        dot: "bg-violet-400",
    },
    Rare: {
        bar: "bg-sky-500",
        glow: "",
        border: "border-sky-500/30",
        bg: "bg-gradient-to-br from-[#051218] to-[#03090f]",
        text: "text-sky-300",
        badge: "bg-sky-500/20 text-sky-300 border-sky-500/30",
        icon: "🔵",
        dot: "bg-sky-400",
    },
    Commun: {
        bar: "bg-slate-500",
        glow: "",
        border: "border-slate-600/30",
        bg: "bg-gradient-to-br from-[#0e1016] to-[#080b10]",
        text: "text-slate-300",
        badge: "bg-slate-500/20 text-slate-300 border-slate-500/30",
        icon: "⚪",
        dot: "bg-slate-400",
    },
};

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
    passif: { label: "Passif", color: "text-amber-400", icon: "✦" },
    actif: { label: "Actif", color: "text-violet-400", icon: "⚡" },
    bonus: { label: "Bonus", color: "text-sky-400", icon: "▲" },
    consommable: { label: "Conso", color: "text-emerald-400", icon: "◆" },
};

const SUBFILTERS_BY_TYPE: Record<string, string[]> = {
    actif: ["Épique", "Légendaire"],
    passif: [],
    bonus: ["Commun", "Rare", "Épique"],
    consommable: ["Rare", "Épique"],
};

const MINOR_BONUSES = [
    { name: "5% Dégâts", type: "MINEUR", effet: "+5% Dommages finaux", icon: "⚔️" },
    { name: "20% Vitalité", type: "MINEUR", effet: "+20% Vitalité", icon: "❤️" },
    { name: "2 Portée", type: "MINEUR", effet: "+2 Portée", icon: "🏹" },
    { name: "1 PA", type: "MINEUR", effet: "+1 Point d'Action", icon: "⚡" },
    { name: "1 PM", type: "MINEUR", effet: "+1 Point de Mouvement", icon: "🦶" },
    { name: "Sorts : +1 Portée", type: "MINEUR", effet: "Portée maximale des sorts +1", icon: "🎯" },
    { name: "Sorts : -1 Relance", type: "MINEUR", effet: "Intervalle de relance des sorts -1", icon: "🔄" },
    { name: "Sorts : +1 Lancer/Tour", type: "MINEUR", effet: "Nombre de lancers par tour +1", icon: "🔢" },
    { name: "Sorts : +1 Lancer/Cible", type: "MINEUR", effet: "Nombre de lancers par cible +1", icon: "🎯" },
    { name: "Tempête Astrale", type: "MINEUR", effet: "Invoque une tempête astrale en début de combat", icon: "🌪️" },
    { name: "5 Points de Rêve", type: "MINEUR", effet: "+5 Points de Rêve immédiats", icon: "✨" },
    { name: "15 Points de Rêve", type: "MINEUR", effet: "+15 Points de Rêve immédiats", icon: "✨" },
    { name: "Armes : +1 Lancer/Tour", type: "MINEUR", effet: "Nombre de lancers d'arme par tour +1", icon: "🗡️" },
    { name: "Armes : +2 Portée", type: "MINEUR", effet: "Portée de l'arme +2", icon: "📏" },
];

export function BonusInventory({ guildId, bonuses, runId, isLeader = false, onUpdate }: BonusInventoryProps) {
    const [shopOpen, setShopOpen] = useState(false);
    const [typeFilter, setTypeFilter] = useState<string | null>(null);
    const [rarityFilter, setRarityFilter] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(false);

    const typedBonusData = bonusData as (SongesBonus & { nouveau?: boolean })[];
    const availableRarities = typeFilter ? SUBFILTERS_BY_TYPE[typeFilter] : [];

    const filteredShop = useMemo(() => {
        return typedBonusData.filter((b) => {
            if (typeFilter && b.type !== typeFilter) return false;
            if (rarityFilter && b.rarete !== rarityFilter) return false;
            if (searchQuery && !b.nom.toLowerCase().includes(searchQuery.toLowerCase())) return false;
            return true;
        });
    }, [typedBonusData, typeFilter, rarityFilter, searchQuery]);

    const { groupedMajor, groupedMinor } = useMemo(() => {
        const majorGroups: Record<string, { count: number; instances: DreamRunBonus[] }> = {};
        const minorGroups: Record<string, { count: number; instances: DreamRunBonus[] }> = {};

        for (const b of bonuses) {
            const key = `${b.bonusName}-${b.bonusType}`;
            const target = b.bonusType === "MINEUR" ? minorGroups : majorGroups;
            if (!target[key]) target[key] = { count: 0, instances: [] };
            target[key].count++;
            target[key].instances.push(b);
        }

        const toArray = (groups: typeof majorGroups) =>
            Object.values(groups)
                .map((g) => ({ ...g.instances[0], count: g.count, allIds: g.instances.map((i) => i.id) }))
                .sort((a, b) => a.bonusName.localeCompare(b.bonusName));

        return { groupedMajor: toArray(majorGroups), groupedMinor: toArray(minorGroups) };
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
        if (res.success) { toast.success("Bonus supprimé"); onUpdate?.(); }
        else toast.error(res.error);
    };

    const handleAddMinor = async (bonus: (typeof MINOR_BONUSES)[0]) => {
        setLoading(true);
        const res = await addDreamBonus(guildId, { runId, bonusName: bonus.name, bonusType: "MINEUR", bonusRarete: "Commun", cost: 0 });
        setLoading(false);
        if (res.success) { toast.success("Bonus mineur ajouté"); onUpdate?.(); }
        else toast.error(res.error);
    };

    const handleBuy = async (bonus: SongesBonus) => {
        setLoading(true);
        const res = await addDreamBonus(guildId, { runId, bonusName: bonus.nom, bonusType: bonus.type, bonusRarete: bonus.rarete, cost: 0 });
        setLoading(false);
        if (res.success) { toast.success("Bonus enregistré !"); onUpdate?.(); }
        else toast.error(res.error || "Erreur lors de l'ajout");
    };

    // ─────────────────────────────────────────────
    // INVENTAIRE : ligne de bonus
    // ─────────────────────────────────────────────
    const renderBonusRow = (group: (typeof groupedMajor)[0], isMinor: boolean) => {
        const rarityKey = group.bonusRarete as keyof typeof RARITY_CONFIG;
        const rar = RARITY_CONFIG[rarityKey] ?? RARITY_CONFIG.Commun;
        return (
            <div
                key={group.id}
                className={`group relative flex items-center gap-3 px-4 py-2.5 rounded-lg border transition-all
                    ${isMinor ? "border-white/5 bg-white/[0.02]" : `${rar.border} ${rar.bg} ${rar.glow}`}
                `}
            >
                {/* Dot couleur */}
                <div className={`w-2 h-2 rounded-full shrink-0 ${isMinor ? "bg-slate-500" : rar.dot}`} />

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-semibold text-sm ${isMinor ? "text-slate-300" : rar.text}`}>
                            {group.bonusName}
                        </span>
                        {group.count > 1 && (
                            <span className="text-caption font-bold bg-white/10 px-1.5 py-0.5 rounded border border-white/10 text-white/60">
                                ×{group.count}
                            </span>
                        )}
                        {!isMinor && (
                            <span className={`text-caption uppercase tracking-wider font-bold opacity-60 ${isMinor ? "text-slate-400" : rar.text}`}>
                                {group.bonusRarete}
                            </span>
                        )}
                    </div>
                </div>

                {isLeader && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 hover:bg-red-950/50 transition-all rounded-full shrink-0"
                        onClick={() => handleDelete(group.allIds[group.allIds.length - 1])}
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                )}
            </div>
        );
    };

    // ─────────────────────────────────────────────
    // SHOP : carte bonus
    // ─────────────────────────────────────────────
    const renderShopCard = (bonus: SongesBonus & { nouveau?: boolean }, i: number) => {
        const rar = RARITY_CONFIG[bonus.rarete as keyof typeof RARITY_CONFIG] ?? RARITY_CONFIG.Commun;
        const typ = TYPE_CONFIG[bonus.type] ?? { label: bonus.type, color: "text-white", icon: "•" };
        const fullEffects = bonus.effets?.replace(/\|/g, " · ") || "";

        return (
            <div
                key={`${bonus.nom}-${i}`}
                className={`relative flex flex-col rounded-xl border overflow-hidden transition-all duration-200 group
                    hover:scale-[1.01] hover:z-10 ${rar.border} ${rar.bg} ${rar.glow}`}
            >
                {/* Barre latérale colorée */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${rar.bar}`} />

                <div className="pl-3 pr-3 pt-3 pb-2 flex flex-col gap-2 flex-1">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                            <p className={`font-bold text-sm leading-tight ${rar.text}`}>
                                {bonus.nom}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className={`text-caption font-bold uppercase tracking-wide ${typ.color}`}>
                                    {typ.icon} {typ.label}
                                </span>
                                <span className="text-white/20">·</span>
                                <span className={`text-caption uppercase font-semibold tracking-wide ${rar.text} opacity-70`}>
                                    {bonus.rarete}
                                </span>
                                {bonus.nouveau && (
                                    <span className="text-caption font-black uppercase tracking-widest text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                                        NOUVEAU 3.5
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Effets */}
                    {fullEffects && (
                        <p className="text-caption text-white/55 leading-relaxed line-clamp-3 flex-1">
                            {fullEffects}
                        </p>
                    )}

                    {/* Infos supplémentaires */}
                    {(bonus as any).infos && (
                        <p className="text-caption text-white/35 italic leading-tight">
                            {(bonus as any).infos}
                        </p>
                    )}
                </div>

                {/* Footer : bouton */}
                {isLeader && (
                    <div className="px-3 pb-3">
                        <Button
                            disabled={loading}
                            onClick={() => handleBuy(bonus)}
                            className={`w-full h-8 text-xs font-bold uppercase tracking-wider transition-all border
                                ${rar.badge} hover:opacity-90`}
                            variant="outline"
                        >
                            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Enregistrer"}
                        </Button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="rounded-xl border border-white/8 bg-[#07030f]/95 overflow-hidden relative shadow-2xl">
            {/* Fond subtil */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(109,40,217,0.06),transparent_60%)] pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/6 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                        <Package className="w-4 h-4 text-indigo-300" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-white tracking-wide">Inventaire Onirique</h3>
                        <p className="text-xs text-white/30 mt-0.5">
                            {bonuses.length} bonus actif{bonuses.length > 1 ? "s" : ""}
                        </p>
                    </div>
                </div>

                {isLeader && (
                    <Dialog open={shopOpen} onOpenChange={setShopOpen}>
                        <DialogTrigger asChild>
                            <Button
                                size="sm"
                                className="bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/30   transition-all text-xs font-bold gap-1.5"
                            >
                                <Image src="/assets/songes/boutique.png" alt="Fontaine" width={16} height={16} className="object-contain" />
                                Fontaine Onirique
                            </Button>
                        </DialogTrigger>

                        {/* ──────────────────────────────────────────────── */}
                        {/* MODALE FONTAINE                                  */}
                        {/* ──────────────────────────────────────────────── */}
                        <DialogContent className="bg-[#08040e] border-white/10 text-white w-full sm:max-w-[1400px] h-[92vh] flex flex-col p-0 overflow-hidden shadow-2xl shadow-black/60">
                            {/* Titre */}
                            <div className="px-6 py-5 border-b border-white/6 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 flex items-center justify-center shrink-0 drop-shadow-[0_0_10px_rgba(99,102,241,0.3)]">
                                        <Image src="/assets/songes/boutique.png" alt="Fontaine" width={48} height={48} className="object-contain" />
                                    </div>
                                    <div>
                                        <DialogTitle className="text-lg font-black text-white tracking-wide">
                                            Fontaine des Songes
                                        </DialogTitle>
                                        <p className="text-xs text-white/30 mt-0.5">Choisissez les bonus de votre run</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-caption font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded tracking-widest uppercase">
                                        MAJ 3.5
                                    </span>
                                </div>
                            </div>

                            <Tabs defaultValue="shop" className="flex-1 flex flex-col overflow-hidden">
                                {/* Onglets */}
                                <div className="px-6 pt-4 pb-0 shrink-0">
                                    <TabsList className="bg-white/4 border border-white/8 w-auto inline-flex gap-1 p-1">
                                        <TabsTrigger
                                            value="shop"
                                            className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]: text-white/50 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all rounded"
                                        >
                                            Fontaine Majeure
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="minor"
                                            className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]: text-white/50 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all rounded"
                                        >
                                            Bonus Mineurs
                                        </TabsTrigger>
                                    </TabsList>
                                </div>

                                {/* ─── SHOP MAJEUR ─── */}
                                <TabsContent value="shop" className="flex-1 overflow-hidden flex flex-col gap-0 mt-0">
                                    {/* Barre de filtres */}
                                    <div className="px-6 py-4 border-b border-white/5 flex flex-col gap-3 shrink-0">
                                        <div className="flex gap-3 items-center flex-wrap">
                                            {/* Recherche */}
                                            <div className="relative flex-1 min-w-[200px] max-w-xs">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                                                <Input
                                                    placeholder="Rechercher..."
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    className="pl-9 h-8 bg-white/4 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-indigo-500/50 text-sm"
                                                />
                                                {searchQuery && (
                                                    <button
                                                        onClick={() => setSearchQuery("")}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>

                                            {/* Filtre type */}
                                            <div className="flex gap-1">
                                                {["bonus", "passif", "actif", "consommable"].map((type) => {
                                                    const tc = TYPE_CONFIG[type];
                                                    return (
                                                        <button
                                                            key={type}
                                                            onClick={() => handleTypeFilter(typeFilter === type ? null : type)}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all border
                                                                ${typeFilter === type
                                                                    ? `${tc.color} bg-white/8 border-white/15`
                                                                    : "text-white/35 border-transparent hover:text-white/60 hover:bg-white/5"
                                                                }`}
                                                        >
                                                            {tc.icon} {type}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            {/* Filtre rareté */}
                                            {typeFilter && availableRarities.length > 0 && (
                                                <div className="flex gap-1 animate-in fade-in slide-in-from-left-2">
                                                    {availableRarities.map((rarity) => {
                                                        const rr = RARITY_CONFIG[rarity as keyof typeof RARITY_CONFIG];
                                                        return (
                                                            <button
                                                                key={rarity}
                                                                onClick={() => setRarityFilter(rarityFilter === rarity ? null : rarity)}
                                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all border
                                                                    ${rarityFilter === rarity
                                                                        ? `${rr.text} ${rr.border} bg-white/5`
                                                                        : "text-white/30 border-transparent hover:text-white/50 hover:bg-white/4"
                                                                    }`}
                                                            >
                                                                {rr.icon} {rarity}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            <span className="ml-auto text-xs text-white/25 tabular-nums">
                                                {filteredShop.length} résultat{filteredShop.length > 1 ? "s" : ""}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Grille */}
                                    <div className="flex-1 overflow-y-auto px-6 py-4">
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
                                            {filteredShop.map((bonus, i) => renderShopCard(bonus as SongesBonus & { nouveau?: boolean }, i))}
                                        </div>
                                        {filteredShop.length === 0 && (
                                            <div className="flex flex-col items-center justify-center py-20 text-white/20">
                                                <Search className="w-8 h-8 mb-3 opacity-30" />
                                                <p className="text-sm">Aucun bonus trouvé</p>
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>

                                {/* ─── BONUS MINEURS ─── */}
                                <TabsContent value="minor" className="flex-1 overflow-auto px-6 py-4 mt-0">
                                    <p className="text-xs text-white/30 mb-4">
                                        Bonus passifs permanents obtenus avant chaque combat.
                                    </p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-7 gap-3">
                                        {MINOR_BONUSES.map((bonus, i) => (
                                            <div
                                                key={i}
                                                className="group flex flex-col items-center text-center gap-2 p-4 rounded-xl border border-white/6 bg-white/3 hover:bg-white/6 hover:border-white/10 transition-all"
                                            >
                                                <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center text-2xl group- transition-transform">
                                                    {bonus.icon}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-white/80 leading-tight">{bonus.name}</p>
                                                    <p className="text-caption text-white/35 mt-0.5 leading-snug">{bonus.effet}</p>
                                                </div>
                                                {isLeader && (
                                                    <Button
                                                        onClick={() => handleAddMinor(bonus)}
                                                        disabled={loading}
                                                        variant="outline"
                                                        className="w-full h-7 text-caption font-bold uppercase tracking-wider bg-white/4 border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all"
                                                    >
                                                        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Ajouter"}
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {/* ─── INVENTAIRE ─── */}
            <div className="px-5 py-4 space-y-4 relative z-10">
                {groupedMajor.length > 0 && (
                    <div>
                        <p className="text-caption font-black uppercase tracking-widest text-white/20 mb-2 pl-1">Bonus Majeurs</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {groupedMajor.map((group) => renderBonusRow(group, false))}
                        </div>
                    </div>
                )}

                {groupedMinor.length > 0 && (
                    <div>
                        <p className="text-caption font-black uppercase tracking-widest text-white/20 mb-2 pl-1">Bonus Mineurs</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {groupedMinor.map((group) => renderBonusRow(group, true))}
                        </div>
                    </div>
                )}

                {groupedMajor.length === 0 && groupedMinor.length === 0 && (
                    <div className="py-10 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-white/3 border border-white/6 flex items-center justify-center mx-auto mb-3">
                            <Sparkles className="w-5 h-5 text-white/15" />
                        </div>
                        <p className="text-sm text-white/20 italic">Aucun bonus actif.</p>
                        {isLeader && (
                            <p className="text-xs text-white/15 mt-1">Ouvre la Fontaine pour en ajouter.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

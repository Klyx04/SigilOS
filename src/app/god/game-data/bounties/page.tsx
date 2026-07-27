"use client";

import React, { useState, useEffect } from "react";
import {
    Search, Save, Info, Sparkles, Coins, ShieldAlert,
    ArrowLeft, Loader2, Edit3, Image as ImageIcon,
    Plus, Trash2, Map as MapIcon, SwatchBook,
    Layers, Crosshair, ExternalLink, Copy, Check, MapPin
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { DocContent } from '@/components/doc/doc-content';
import { AdvancedEditor } from '@/components/editor/advanced-editor';
import { AssetGalleryModal } from "@/components/admin/asset-gallery-modal";

import { getAllBounties } from "@/server/actions/admin-actions";
import { updateGodBountyRecord } from "@/server/actions/game-data-actions";

const REWARD_TYPES = [
    { id: "Aliton", label: "Alitons", icon: "/assets/avis/aliton.png" },
    { id: "Aviton", label: "Avitons", icon: "/assets/avis/avitons.png" },
    { id: "Kama de glace", label: "Kamas de glace", icon: "/assets/avis/kamas_de_glace.png" },
];

export default function GodBountiesPage() {
    const [galleryOpen, setGalleryOpen] = useState(false);
    const [galleryType, setGalleryType] = useState<"portraits" | "maps">("portraits");
    const [galleryTargetField, setGalleryTargetField] = useState<"imageUrl" | "mapUrl">("imageUrl");
    const router = useRouter();
    const [bounties, setBounties] = useState<any[]>([]);
    const [filteredBounties, setFilteredBounties] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [selectedBounty, setSelectedBounty] = useState<any>(null);
    const [saving, setSaving] = useState(false);
    const [previewMode, setPreviewMode] = useState(false);
    const [subareaNames, setSubareaNames] = useState<string[]>([]);
    const [zoneSearch, setZoneSearch] = useState('');
    const [zoneOpen, setZoneOpen] = useState(false);

    // Load worldmap subarea names client-side (public file, no server action needed)
    useEffect(() => {
        fetch('/game-data/worldmap.json')
            .then(r => r.json())
            .then(data => {
                const names: string[] = (data.subareas || [])
                    .map((sa: any) => typeof sa.name === 'string' ? sa.name : (sa.name?.fr || ''))
                    .filter(Boolean)
                    .sort((a: string, b: string) => a.localeCompare(b, 'fr'));
                setSubareaNames([...new Set(names)] as string[]);
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        setLoading(true);
        getAllBounties().then(data => {
            setBounties(data);
            setFilteredBounties(data);
            setLoading(false);
        });
    }, []);

    useEffect(() => {
        const filtered = bounties.filter(b =>
            b.name.toLowerCase().includes(search.toLowerCase()) ||
            (b.zoneName && b.zoneName.toLowerCase().includes(search.toLowerCase()))
        );
        setFilteredBounties(filtered);
    }, [search, bounties]);

    const handleSelectBounty = (b: any) => {
        let rewards = b.rewards;
        if (!Array.isArray(rewards) || rewards.length === 0) {
            rewards = [{ type: b.rewardType || "Aliton", amount: b.doplons || 0 }];
        }
        setSelectedBounty({ ...b, rewards });
    };

    const handleSave = async () => {
        if (!selectedBounty) return;
        setSaving(true);
        try {
            const primaryReward = selectedBounty.rewards?.[0];
            const dataToSave = {
                ...selectedBounty,
                doplons: primaryReward?.amount || 0,
                rewardType: primaryReward?.type || "Aliton"
            };

            const res = await updateGodBountyRecord(selectedBounty.id, dataToSave);
            if (res.success) {
                toast.success("Avis mis à jour avec succès");
                setBounties(prev => prev.map(b => b.id === selectedBounty.id ? { ...b, ...dataToSave } : b));
            } else {
                toast.error(res.error || "Erreur lors de la sauvegarde");
            }
        } catch (e) {
            toast.error("Erreur technique lors de la sauvegarde");
        } finally {
            setSaving(false);
        }
    };

    const addReward = () => {
        const newRewards = [...(selectedBounty.rewards || []), { type: "Aliton", amount: 0 }];
        setSelectedBounty({ ...selectedBounty, rewards: newRewards });
    };

    const removeReward = (index: number) => {
        const newRewards = selectedBounty.rewards.filter((_: any, i: number) => i !== index);
        setSelectedBounty({ ...selectedBounty, rewards: newRewards });
    };

    const updateReward = (index: number, field: string, value: any) => {
        const newRewards = selectedBounty.rewards.map((r: any, i: number) =>
            i === index ? { ...r, [field]: value } : r
        );
        setSelectedBounty({ ...selectedBounty, rewards: newRewards });
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-screen bg-[#050505]">
                <div className="flex flex-col items-center gap-6">
                    <div className="relative">
                        <Loader2 className="animate-spin text-amber-500" size={48} />
                        <div className="absolute inset-0 blur-2xl bg-amber-500/20 animate-pulse" />
                    </div>
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em]">Chargement des Archives...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#050505] overflow-hidden">
            {/* Header */}
            <header className="p-4 sm:p-8 border-b border-white/5 flex flex-col lg:flex-row lg:items-center justify-between bg-black/40 backdrop-blur-2xl shrink-0 z-10 gap-6">
                <div className="flex items-center gap-8">
                    <div className="flex flex-col">
                        <h1 className="text-xl sm:text-3xl font-black text-white uppercase italic tracking-tighter flex items-center gap-4 leading-none">
                            <ShieldAlert className="text-amber-500" size={24} />
                            Avis de Recherche
                        </h1>
                        <p className="text-zinc-500 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] mt-2 ml-1">
                            Base de données tactique · {bounties.length} Records
                        </p>
                    </div>
                </div>

                <div className="relative w-full lg:w-96 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-amber-500 transition-colors" size={18} />
                    <Input
                        placeholder="Rechercher une cible..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-12 bg-white/5 border-white/5 text-white font-bold italic h-12 rounded-2xl focus-visible:ring-amber-500/50 group-hover:bg-white/[0.07] transition-all"
                    />
                </div>
            </header>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* Bounty List */}
                <div className={cn(
                    "w-full lg:w-[380px] border-r border-white/5 overflow-y-auto p-4 sm:p-6 space-y-3 bg-black/20 shrink-0 custom-scrollbar transition-all duration-500",
                    selectedBounty && "hidden lg:block"
                )}>
                    {filteredBounties.map(b => (
                        <button
                            key={b.id}
                            onClick={() => handleSelectBounty(b)}
                            className={cn(
                                "w-full flex items-center gap-4 p-4 rounded-2xl transition-all text-left group border relative overflow-hidden",
                                selectedBounty?.id === b.id
                                    ? 'bg-amber-500/10 border-amber-500/40 shadow-[0_0_30px_rgba(245,158,11,0.05)]'
                                    : 'bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10'
                            )}
                        >
                            <div className="w-14 h-14 rounded-xl bg-black/60 flex items-center justify-center overflow-hidden border border-white/10 shrink-0 group-hover:scale-105 transition-transform relative z-10">
                                {b.imageUrl ? (
                                    <img src={b.imageUrl} alt="" className="w-12 h-12 object-contain" />
                                ) : (
                                    <ShieldAlert size={24} className="text-zinc-800" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0 relative z-10">
                                <p className={cn(
                                    "text-sm font-black uppercase italic truncate tracking-tight",
                                    selectedBounty?.id === b.id ? "text-amber-400" : "text-zinc-200"
                                )}>
                                    {b.name}
                                </p>
                                <p className="text-[10px] font-bold text-zinc-500 truncate mt-1 flex items-center gap-2">
                                    <MapIcon size={10} /> {b.zoneName || "Zone Inconnue"}
                                </p>
                            </div>
                            {b.mechanics && (
                                <div className="w-1 h-1 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)] relative z-10" />
                            )}
                            {selectedBounty?.id === b.id && (
                                <div className="absolute right-0 top-0 bottom-0 w-1 bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,1)]" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Editor Section */}
                <div className={cn(
                    "flex-1 overflow-y-auto bg-[#080808] custom-scrollbar transition-all duration-500",
                    !selectedBounty && "hidden lg:block"
                )}>
                    {selectedBounty ? (
                        <div className="p-4 sm:p-8 lg:p-12 max-w-5xl mx-auto space-y-8 lg:space-y-12">
                            <div className="lg:hidden mb-4">
                                <Button 
                                    variant="ghost" 
                                    onClick={() => setSelectedBounty(null)}
                                    className="text-zinc-500 hover:text-white pl-0"
                                >
                                    <ArrowLeft className="mr-2" size={16} /> Retour à la liste
                                </Button>
                            </div>

                            <Tabs defaultValue="general" className="space-y-8 lg:space-y-12">
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between sticky top-0 py-2 bg-[#080808] z-20 gap-4">
                                    <TabsList className="bg-black/40 border border-white/5 p-1 h-auto lg:h-14 rounded-xl lg:rounded-2xl flex-wrap lg:flex-nowrap">
                                        <TabsTrigger value="general" className="flex-1 lg:flex-none rounded-lg lg:rounded-xl px-4 lg:px-8 py-2 lg:py-0 font-black uppercase italic text-[9px] lg:text-[11px] tracking-widest data-[state=active]:bg-amber-500 data-[state=active]:text-black transition-all">
                                            Config
                                        </TabsTrigger>
                                        <TabsTrigger value="rewards" className="flex-1 lg:flex-none rounded-lg lg:rounded-xl px-4 lg:px-8 py-2 lg:py-0 font-black uppercase italic text-[9px] lg:text-[11px] tracking-widest data-[state=active]:bg-amber-500 data-[state=active]:text-black transition-all">
                                            Rewards
                                        </TabsTrigger>
                                        <TabsTrigger value="mechanics" className="flex-1 lg:flex-none rounded-lg lg:rounded-xl px-4 lg:px-8 py-2 lg:py-0 font-black uppercase italic text-[9px] lg:text-[11px] tracking-widest data-[state=active]:bg-amber-500 data-[state=active]:text-black transition-all">
                                            Briefing
                                        </TabsTrigger>
                                    </TabsList>

                                    <div className="flex items-center gap-4">
                                        <Button
                                            onClick={handleSave}
                                            disabled={saving}
                                            className="bg-amber-500 hover:bg-amber-600 text-black font-black uppercase italic px-12 h-14 rounded-2xl shadow-2xl shadow-amber-500/20 active:scale-95 transition-all"
                                        >
                                            {saving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" size={20} />}
                                            Mettre à jour
                                        </Button>
                                    </div>
                                </div>

                                <TabsContent value="general" className="mt-0 space-y-12">
                                    <div className="grid grid-cols-2 gap-12">
                                        <div className="space-y-8">
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em] italic ml-1 flex items-center gap-2 drop-shadow-sm">
                                                        <Crosshair size={12} /> Portrait Cible
                                                    </label>
                                                    <button 
                                                        onClick={() => { setGalleryType("portraits"); setGalleryOpen(true); }}
                                                        className="w-full aspect-square rounded-3xl bg-zinc-950/80 border border-white/10 flex items-center justify-center overflow-hidden relative group shadow-xl transition-all hover:border-amber-500/50"
                                                    >
                                                        {selectedBounty.imageUrl ? (
                                                            <img src={selectedBounty.imageUrl} alt="" className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-700" />
                                                        ) : (
                                                            <ImageIcon size={48} className="text-zinc-700" />
                                                        )}
                                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                                            <ImageIcon size={24} className="text-amber-500" />
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-white">Changer</span>
                                                        </div>
                                                    </button>
                                                    <div className="flex gap-2">
                                                        <Input
                                                            value={selectedBounty.imageUrl || ""}
                                                            onChange={(e) => setSelectedBounty({ ...selectedBounty, imageUrl: e.target.value })}
                                                            placeholder="Portrait URL..."
                                                            className="flex-1 bg-zinc-950/50 border-white/10 font-mono text-[10px] text-zinc-400 h-11 rounded-xl focus-visible:ring-amber-500/50"
                                                        />
                                                        <Button 
                                                            onClick={() => { setGalleryType("portraits"); setGalleryOpen(true); }}
                                                            variant="outline"
                                                            className="h-11 w-11 p-0 rounded-xl border-white/10 bg-zinc-950/50 hover:bg-amber-500 hover:text-black"
                                                        >
                                                            <SwatchBook size={18} />
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em] italic ml-1 flex items-center gap-2 drop-shadow-sm">
                                                        <MapIcon size={12} /> Zone de Spawn
                                                    </label>
                                                    <button 
                                                        onClick={() => { setGalleryType("maps"); setGalleryOpen(true); }}
                                                        className="w-full aspect-square rounded-3xl bg-zinc-950/80 border border-white/10 flex items-center justify-center overflow-hidden relative group shadow-xl transition-all hover:border-amber-500/50"
                                                    >
                                                        {selectedBounty.mapUrl ? (
                                                            <img src={selectedBounty.mapUrl} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all duration-700" />
                                                        ) : (
                                                            <MapIcon size={48} className="text-zinc-700" />
                                                        )}
                                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                                            <MapIcon size={24} className="text-amber-500" />
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-white">Changer</span>
                                                        </div>
                                                    </button>
                                                    <div className="flex gap-2">
                                                        <Input
                                                            value={selectedBounty.mapUrl || ""}
                                                            onChange={(e) => setSelectedBounty({ ...selectedBounty, mapUrl: e.target.value })}
                                                            placeholder="Minimap URL..."
                                                            className="flex-1 bg-zinc-950/50 border-white/10 font-mono text-[10px] text-zinc-400 h-11 rounded-xl focus-visible:ring-amber-500/50"
                                                        />
                                                        <Button 
                                                            onClick={() => { setGalleryType("maps"); setGalleryOpen(true); }}
                                                            variant="outline"
                                                            className="h-11 w-11 p-0 rounded-xl border-white/10 bg-zinc-950/50 hover:bg-amber-500 hover:text-black"
                                                        >
                                                            <SwatchBook size={18} />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-8">
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-amber-500/50 uppercase tracking-[0.3em] italic ml-1">Identité de l'avis</label>
                                                <Input
                                                    value={selectedBounty.name}
                                                    onChange={(e) => setSelectedBounty({ ...selectedBounty, name: e.target.value })}
                                                    className="text-2xl font-black bg-black/40 border-white/5 h-16 italic rounded-2xl focus-visible:ring-amber-500/50"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black text-amber-500/50 uppercase tracking-[0.3em] italic ml-1">Niveau prérequis &gt;</label>
                                                    <Input
                                                        type="number"
                                                        value={selectedBounty.level}
                                                        onChange={(e) => setSelectedBounty({ ...selectedBounty, level: parseInt(e.target.value) })}
                                                        className="bg-black/40 border-white/5 font-black h-14 rounded-2xl text-lg text-amber-500 focus-visible:ring-amber-500/30"
                                                    />
                                                </div>
                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black text-amber-500/50 uppercase tracking-[0.3em] italic ml-1">Origine / Milice</label>
                                                    <Input
                                                        value={selectedBounty.milice || ""}
                                                        onChange={(e) => setSelectedBounty({ ...selectedBounty, milice: e.target.value })}
                                                        className="bg-black/40 border-white/5 font-black h-14 rounded-2xl text-lg italic focus-visible:ring-amber-500/30"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-amber-500/50 uppercase tracking-[0.3em] italic ml-1 flex items-center justify-between">
                                                    <span>Position de départ (NPC / Milice)</span>
                                                    <span className="text-[8px] opacity-40">Format: X,Y (ex: 4,-18)</span>
                                                </label>
                                                <div className="relative group">
                                                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-amber-500 transition-colors" size={18} />
                                                    <Input
                                                        value={selectedBounty.position || ""}
                                                        onChange={(e) => setSelectedBounty({ ...selectedBounty, position: e.target.value })}
                                                        placeholder="4,-18"
                                                        className="pl-12 bg-black/40 border-white/5 font-black h-14 rounded-2xl focus-visible:ring-amber-500/30 text-amber-500"
                                                    />
                                                    {selectedBounty.position && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(`/travel ${selectedBounty.position}`);
                                                                toast.success("Commande /travel copiée !");
                                                            }}
                                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-zinc-500 hover:text-white h-10 px-4 rounded-xl"
                                                        >
                                                            <Copy size={12} className="mr-2" /> /travel
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-amber-500/50 uppercase tracking-[0.3em] italic ml-1">Lien DofusPourLesNoobs (DPNL)</label>
                                                <div className="relative group">
                                                    <ExternalLink className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-amber-500 transition-colors" size={18} />
                                                    <Input
                                                        value={selectedBounty.dpnlUrl || ""}
                                                        onChange={(e) => setSelectedBounty({ ...selectedBounty, dpnlUrl: e.target.value })}
                                                        placeholder="https://www.dofuspourlesnoobs.com/..."
                                                        className="pl-12 bg-black/40 border-white/5 font-bold h-14 rounded-2xl focus-visible:ring-amber-500/30"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-3 relative">
                                                <label className="text-[10px] font-black text-amber-500/50 uppercase tracking-[0.3em] italic ml-1 flex items-center justify-between">
                                                    <span className="flex items-center gap-2"><MapPin size={11} /> Localisation (Zones)</span>
                                                    {selectedBounty.zoneName && (
                                                        <span className={cn(
                                                            "text-[8px] font-black uppercase px-2 py-0.5 rounded-md",
                                                            subareaNames.includes(selectedBounty.zoneName)
                                                                ? "bg-emerald-500/10 text-emerald-400"
                                                                : "bg-rose-500/10 text-rose-400"
                                                        )}>
                                                            {subareaNames.includes(selectedBounty.zoneName) ? '✓ Zone trouvée' : '⚠ Zone introuvable'}
                                                        </span>
                                                    )}
                                                </label>
                                                <div className="relative">
                                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" size={16} />
                                                    <input
                                                        value={zoneOpen ? zoneSearch : (selectedBounty.zoneName || '')}
                                                        onChange={(e) => {
                                                            setZoneSearch(e.target.value);
                                                            if (!zoneOpen) setZoneOpen(true);
                                                        }}
                                                        onFocus={() => {
                                                            setZoneSearch(selectedBounty.zoneName || '');
                                                            setZoneOpen(true);
                                                        }}
                                                        onBlur={() => setTimeout(() => setZoneOpen(false), 150)}
                                                        placeholder="Rechercher une zone du worldmap..."
                                                        className="w-full pl-12 pr-4 bg-black/40 border border-white/5 font-bold h-14 rounded-2xl text-white text-sm focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 transition-all"
                                                    />
                                                    {zoneOpen && (
                                                        <div className="absolute top-full left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-[#0d1117] border border-white/10 rounded-2xl shadow-2xl z-50">
                                                            {(() => {
                                                                const q = zoneSearch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
                                                                const filtered = subareaNames.filter(n =>
                                                                    n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(q)
                                                                ).slice(0, 40);
                                                                if (filtered.length === 0) return (
                                                                    <div className="px-4 py-3 text-zinc-600 text-[10px] italic text-center">Aucune zone trouvée</div>
                                                                );
                                                                return filtered.map(name => (
                                                                    <button
                                                                        key={name}
                                                                        type="button"
                                                                        onMouseDown={() => {
                                                                            setSelectedBounty({ ...selectedBounty, zoneName: name });
                                                                            setZoneSearch(name);
                                                                            setZoneOpen(false);
                                                                        }}
                                                                        className={cn(
                                                                            "w-full text-left px-4 py-2.5 text-sm font-bold transition-colors border-b border-white/5 last:border-0 flex items-center justify-between group",
                                                                            selectedBounty.zoneName === name
                                                                                ? "bg-amber-500/10 text-amber-400"
                                                                                : "text-zinc-300 hover:bg-white/5 hover:text-white"
                                                                        )}
                                                                    >
                                                                        <span>{name}</span>
                                                                        {selectedBounty.zoneName === name && <Check size={12} className="text-amber-400 flex-shrink-0" />}
                                                                    </button>
                                                                ));
                                                            })()}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="rewards" className="mt-0 space-y-8">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <h3 className="text-xl font-black text-white uppercase italic tracking-tight flex items-center gap-3">
                                                <Coins className="text-amber-500" size={24} />
                                                Dotations de Capture
                                            </h3>
                                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Liste des récompenses obtenues à la remise de l'avis</p>
                                        </div>
                                        <Button
                                            onClick={addReward}
                                            className="bg-white/5 border border-white/10 hover:bg-white/10 text-white font-black uppercase italic rounded-xl px-6 h-12"
                                        >
                                            <Plus size={18} className="mr-2" /> Ajouter
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        {selectedBounty.rewards?.map((reward: any, idx: number) => (
                                            <div key={idx} className="p-6 rounded-3xl bg-black/40 border border-white/5 flex items-center gap-8 relative group hover:border-amber-500/30 transition-all">
                                                <div className="w-16 h-16 rounded-2xl bg-black border border-white/5 flex items-center justify-center shrink-0">
                                                    <img
                                                        src={REWARD_TYPES.find(t => t.id === reward.type)?.icon || "/assets/avis/aliton.png"}
                                                        alt=""
                                                        className="w-12 h-12 object-contain"
                                                    />
                                                </div>

                                                <div className="flex-1 grid grid-cols-3 gap-8">
                                                    <div className="space-y-2">
                                                        <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] italic ml-1">Type de monnaie</label>
                                                        <div className="flex flex-wrap gap-2">
                                                            {REWARD_TYPES.map(type => (
                                                                <button
                                                                    key={type.id}
                                                                    onClick={() => updateReward(idx, "type", type.id)}
                                                                    className={cn(
                                                                        "px-4 py-2 rounded-xl text-[10px] font-black uppercase italic transition-all border",
                                                                        reward.type === type.id
                                                                            ? "bg-amber-500 text-black border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                                                                            : "bg-white/5 text-zinc-500 border-white/5 hover:border-white/10"
                                                                    )}
                                                                >
                                                                    {type.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] italic ml-1">Montant</label>
                                                        <Input
                                                            type="number"
                                                            value={reward.amount}
                                                            onChange={(e) => updateReward(idx, "amount", parseInt(e.target.value) || 0)}
                                                            className="bg-black/60 border-white/5 font-black h-12 rounded-xl text-lg text-amber-500 focus-visible:ring-amber-500/30"
                                                        />
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => removeReward(idx)}
                                                    className="p-3 text-zinc-700 hover:text-rose-500 transition-colors bg-white/5 rounded-xl border border-white/5 hover:border-rose-500/20"
                                                >
                                                    <Trash2 size={20} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </TabsContent>

                                <TabsContent value="mechanics" className="mt-0 space-y-8">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <h3 className="text-xl font-black text-white uppercase italic tracking-tight flex items-center gap-3">
                                                <Sparkles className="text-amber-500" size={24} />
                                                Briefing Tactique
                                            </h3>
                                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Supporte le Markdown pour un formattage riche</p>
                                        </div>
                                        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                                            <button
                                                onClick={() => setPreviewMode(false)}
                                                className={cn("px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all", !previewMode ? "bg-amber-500 text-black" : "text-zinc-500 hover:text-white")}
                                            >
                                                Édition
                                            </button>
                                            <button
                                                onClick={() => setPreviewMode(true)}
                                                className={cn("px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all", previewMode ? "bg-amber-500 text-black" : "text-zinc-500 hover:text-white")}
                                            >
                                                Aperçu
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-6">
                                        <div className="p-1 rounded-[2.5rem] bg-gradient-to-br from-white/5 to-transparent border border-white/5 shadow-2xl relative overflow-hidden group min-h-[500px]">
                                            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500/20 group-hover:bg-amber-500 transition-all shadow-[0_0_20px_rgba(245,158,11,0.5)]" />
                                            {!previewMode ? (
                                                <div className="relative h-full">
                                                    <AdvancedEditor
                                                        initialContent={selectedBounty.mechanics || ""}
                                                        onChange={(html) => setSelectedBounty({ ...selectedBounty, mechanics: html })}
                                                        contentClassName="min-h-[500px]"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="p-10">
                                                    <DocContent 
                                                        content={selectedBounty.mechanics || "<p><em>Aucun contenu à prévisualiser</em></p>"} 
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-8 opacity-40 min-h-[600px]">
                            <div className="relative">
                                <ShieldAlert size={120} className="text-zinc-900" />
                                <div className="absolute inset-0 animate-pulse bg-amber-500/5 rounded-full blur-3xl" />
                            </div>
                            <div className="space-y-4">
                                <p className="text-4xl font-black uppercase italic tracking-tighter text-zinc-800">Archive Scellée</p>
                                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-600">Sélectionnez une cible pour engager le protocole d'édition</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <AssetGalleryModal
                open={galleryOpen}
                onOpenChange={setGalleryOpen}
                initialType={galleryType}
                onSelect={(url) => {
                    if (galleryType === "portraits") {
                        setSelectedBounty({ ...selectedBounty, imageUrl: url });
                    } else {
                        setSelectedBounty({ ...selectedBounty, mapUrl: url });
                    }
                }}
                title={galleryType === "portraits" ? "Sélecteur de Portraits" : "Sélecteur de Minimaps"}
            />

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.08);
                }
            `}</style>
        </div>
    );
}

"use client";

import React, { useState, useEffect } from "react";
import { 
    Search, Save, Info, Sparkles, Coins, ShieldAlert, 
    ArrowLeft, Loader2, Edit3, Image as ImageIcon 
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { getAllBounties, updateBountyRecord } from "@/server/actions/admin-actions";

export default function BountiesAdminPage({ params }: { params: { guildId: string } }) {
    const router = useRouter();
    const [bounties, setBounties] = useState<any[]>([]);
    const [filteredBounties, setFilteredBounties] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [selectedBounty, setSelectedBounty] = useState<any>(null);
    const [saving, setSaving] = useState(false);

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

    const handleSave = async () => {
        if (!selectedBounty) return;
        setSaving(true);
        try {
            const res = await updateBountyRecord(params.guildId, selectedBounty.id, selectedBounty);
            if (res.success) {
                toast.success("Avis mis à jour avec succès");
                // Refresh local list
                setBounties(prev => prev.map(b => b.id === selectedBounty.id ? selectedBounty : b));
            } else {
                toast.error(res.error || "Erreur lors de la sauvegarde");
            }
        } catch (e) {
            toast.error("Erreur technique lors de la sauvegarde");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="animate-spin text-danger" size={48} />
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-[#080a10]">
            {/* Header */}
            <header className="p-8 border-b border-border flex items-center justify-between bg-black/20 backdrop-blur-xl">
                <div>
                    <button 
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-foreground/40 hover:text-foreground transition-colors text-caption font-black uppercase italic mb-2"
                    >
                        <ArrowLeft size={14} /> Retour Admin
                    </button>
                    <h1 className="text-4xl font-black text-foreground uppercase italic tracking-tighter flex items-center gap-4">
                        <ShieldAlert className="text-danger" size={32} />
                        Gestion des Avis <span className="text-danger/10">GOD MODE</span>
                    </h1>
                </div>

                <div className="relative w-96">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/20" size={18} />
                    <Input 
                        placeholder="Chercher un avis ou une zone..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-12 bg-surface border-border text-foreground font-bold italic"
                    />
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Bounty List */}
                <div className="w-1/3 border-r border-border overflow-y-auto p-4 space-y-2 bg-black/10">
                    {filteredBounties.map(b => (
                        <button
                            key={b.id}
                            onClick={() => setSelectedBounty({ ...b })}
                            className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all text-left ${
                                selectedBounty?.id === b.id 
                                    ? 'bg-danger/20 border border-danger/40' 
                                    : 'bg-surface border border-border hover:bg-surface'
                            }`}
                        >
                            <div className="w-12 h-12 rounded-xl bg-black flex items-center justify-center overflow-hidden border border-border">
                                <img src={b.imageUrl} alt="" className="w-10 h-10 object-contain" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-black text-foreground truncate uppercase italic">{b.name}</p>
                                <p className="text-caption font-bold text-foreground/40 truncate">{b.zoneName || "Zone Inconnue"}</p>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Editor Section */}
                <div className="flex-1 overflow-y-auto p-12">
                    {selectedBounty ? (
                        <div className="max-w-4xl mx-auto space-y-12">
                            {/* Visual Preview */}
                            <div className="grid grid-cols-2 gap-12">
                                <div className="space-y-6">
                                    <div className="aspect-video rounded-[2rem] bg-black border border-border flex items-center justify-center overflow-hidden relative group">
                                        <img src={selectedBounty.imageUrl} alt="" className="w-full h-full object-contain" />
                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="outline" className="gap-2 bg-surface border-border-strong">
                                                <ImageIcon size={16} /> Changer l'image
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-8">
                                    <div className="space-y-2">
                                        <label className="text-caption font-black text-danger/60 uppercase tracking-widest italic">Nom de l'avis</label>
                                        <Input 
                                            value={selectedBounty.name} 
                                            onChange={(e) => setSelectedBounty({...selectedBounty, name: e.target.value})}
                                            className="text-2xl font-black bg-surface border-border h-16 uppercase italic" 
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-caption font-black text-danger/60 uppercase tracking-widest italic">Niveau</label>
                                            <Input 
                                                type="number"
                                                value={selectedBounty.level} 
                                                onChange={(e) => setSelectedBounty({...selectedBounty, level: parseInt(e.target.value)})}
                                                className="bg-surface border-border font-bold" 
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-caption font-black text-danger/60 uppercase tracking-widest italic">Zone(s)</label>
                                            <Input 
                                                value={selectedBounty.zoneName} 
                                                onChange={(e) => setSelectedBounty({...selectedBounty, zoneName: e.target.value})}
                                                className="bg-surface border-border font-bold" 
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Rewards & Mechanics */}
                            <div className="grid grid-cols-2 gap-8">
                                <div className="p-8 rounded-[2rem] bg-surface border border-border space-y-6">
                                    <h3 className="text-lg font-black text-foreground uppercase italic flex items-center gap-3">
                                        <Coins className="text-warning" size={20} /> Récompenses
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-caption font-black text-foreground/40 uppercase tracking-widest italic">Quantité</label>
                                            <Input 
                                                type="number"
                                                value={selectedBounty.doplons} 
                                                onChange={(e) => setSelectedBounty({...selectedBounty, doplons: parseInt(e.target.value)})}
                                                className="bg-surface border-border font-black h-12" 
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-caption font-black text-foreground/40 uppercase tracking-widest italic">Type</label>
                                            <select 
                                                value={selectedBounty.rewardType}
                                                onChange={(e) => setSelectedBounty({...selectedBounty, rewardType: e.target.value})}
                                                className="w-full h-12 bg-surface border border-border rounded-xl px-4 text-foreground font-black uppercase italic"
                                            >
                                                <option value="Doplon">Doplons</option>
                                                <option value="Aliton">Alitons (PVP)</option>
                                                <option value="Aviton">Avitons</option>
                                                <option value="Kama de glace">Kamas de glace</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-caption font-black text-foreground/40 uppercase tracking-widest italic">Milice / Ordre</label>
                                        <Input 
                                            value={selectedBounty.milice} 
                                            onChange={(e) => setSelectedBounty({...selectedBounty, milice: e.target.value})}
                                            className="bg-surface border-border font-bold" 
                                        />
                                    </div>
                                </div>

                                <div className="p-8 rounded-[2rem] bg-surface border border-border space-y-6">
                                    <h3 className="text-lg font-black text-foreground uppercase italic flex items-center gap-3">
                                        <Sparkles className="text-info" size={20} /> Mécaniques
                                    </h3>
                                    <div className="space-y-2 h-full flex flex-col">
                                        <label className="text-caption font-black text-foreground/40 uppercase tracking-widest italic">Résumé Tactique</label>
                                        <Textarea 
                                            value={selectedBounty.mechanics} 
                                            onChange={(e) => setSelectedBounty({...selectedBounty, mechanics: e.target.value})}
                                            className="flex-1 min-h-[150px] bg-surface border-border font-medium text-foreground/60 leading-relaxed" 
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-4 p-8 border-t border-border">
                                <Button 
                                    variant="ghost" 
                                    className="text-foreground/40 uppercase italic font-black"
                                    onClick={() => setSelectedBounty(null)}
                                >
                                    Annuler
                                </Button>
                                <Button 
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="bg-danger hover:bg-danger text-danger-foreground font-black uppercase italic px-12 h-16 rounded-2xl shadow-xl shadow-rose-500/20"
                                >
                                    {saving ? <Loader2 className="animate-spin" /> : <Save className="mr-2" size={20} />}
                                    Sauvegarder les modifications
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-20">
                            <Edit3 size={80} />
                            <div className="space-y-2">
                                <p className="text-2xl font-black uppercase italic italic">Sélectionnez un avis</p>
                                <p className="text-sm font-bold uppercase italic italic tracking-widest">Pour modifier ses caractéristiques</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

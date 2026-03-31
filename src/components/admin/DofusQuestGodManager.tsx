"use client";

import { useState, useEffect, useCallback } from "react";
import { 
    getDofusManagementData, 
    upsertDofusItem, 
    deleteDofusItem,
    upsertQuestChain,
    deleteQuestChain,
    upsertQuestEntry,
    deleteQuestEntry,
    pumpQuestsFromDofusDB
} from "@/server/actions/dofus-quest-admin-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { 
    Gem, 
    Plus, 
    Trash2, 
    Edit2, 
    ChevronRight, 
    ChevronDown, 
    MapPin, 
    BookOpen, 
    Castle, 
    Trophy,
    ExternalLink,
    Search,
    RefreshCw,
    Zap
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle,
    DialogDescription 
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { seedDofusData } from "@/server/actions/dofus-quest-actions";

export default function DofusQuestGodManager() {
    const [dofusList, setDofusList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDofusId, setSelectedDofusId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [isSeeding, setIsSeeding] = useState(false);
    
    // Pumping state
    const [isPumpOpen, setIsPumpOpen] = useState(false);
    const [pumpIds, setPumpIds] = useState("");
    const [pumping, setPumping] = useState(false);
    const [targetChainId, setTargetChainId] = useState<string | null>(null);

    // Editing states
    const [editingDofus, setEditingDofus] = useState<any | null>(null);
    const [editingChain, setEditingChain] = useState<any | null>(null);
    const [editingEntry, setEditingEntry] = useState<any | null>(null);
    const [isDofusDialogOpen, setIsDofusDialogOpen] = useState(false);
    const [isChainDialogOpen, setIsChainDialogOpen] = useState(false);
    const [isEntryDialogOpen, setIsEntryDialogOpen] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        const result = await getDofusManagementData();
        if (result.success && result.data) {
            setDofusList(result.data);
            if (!selectedDofusId && result.data.length > 0) {
                setSelectedDofusId(result.data[0].id);
            }
        }
        setLoading(false);
    }, [selectedDofusId]);

    useEffect(() => { loadData(); }, [loadData]);

    const selectedDofus = dofusList.find(d => d.id === selectedDofusId);

    // --- Actions ---

    async function handleSeed() {
        if (!confirm("Attention: Cela va écraser les chaînes existantes par les données du JSON de référence. Continuer ?")) return;
        setIsSeeding(true);
        const res = await seedDofusData("GOD"); // Use a placeholder or actual guildId if needed by the action
        if (res.success) {
            toast.success(res.message);
            loadData();
        } else {
            toast.error(res.error);
        }
        setIsSeeding(false);
    }

    const filteredDofus = dofusList.filter(d => 
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        d.slug.toLowerCase().includes(searchQuery.toLowerCase())
    );

    async function handlePump() {
        if (!targetChainId) return;
        const ids = pumpIds.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        if (ids.length === 0) return toast.error("Entrez des IDs valides");
        
        setPumping(true);
        const res = await pumpQuestsFromDofusDB(targetChainId, ids);
        setPumping(false);

        if (res.success) {
            toast.success(`${res.data?.count} quêtes importées !`);
            setIsPumpOpen(false);
            setPumpIds("");
            loadData();
        } else {
            toast.error(res.error);
        }
    }


    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[700px] overflow-hidden">
            {/* Sidebar: Dofus List */}
            <div className="lg:col-span-1 bg-zinc-950/40 border border-white/5 rounded-3xl flex flex-col overflow-hidden">
                <div className="p-4 border-b border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-white uppercase tracking-tighter italic">Dofus Catalogue</h3>
                        <Button 
                            variant="ghost" size="icon" 
                            onClick={handleSeed}
                            disabled={isSeeding}
                            className="h-8 w-8 text-zinc-500 hover:text-indigo-400"
                            title="Seed from JSON"
                        >
                            <RefreshCw className={`w-4 h-4 ${isSeeding ? "animate-spin" : ""}`} />
                        </Button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                        <Input 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Rechercher..." 
                            className="pl-9 h-9 bg-zinc-900/50 border-white/5 text-xs text-white"
                        />
                    </div>
                </div>
                <ScrollArea className="flex-1">
                    <div className="p-2 space-y-1">
                        {filteredDofus.map(dofus => (
                            <button
                                key={dofus.id}
                                onClick={() => setSelectedDofusId(dofus.id)}
                                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                                    selectedDofusId === dofus.id 
                                        ? "bg-indigo-500/10 border border-indigo-500/20 text-indigo-400" 
                                        : "hover:bg-white/5 border border-transparent text-zinc-500 hover:text-white"
                                }`}
                            >
                                <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-white/5 p-1 flex items-center justify-center shrink-0">
                                    {dofus.imageUrl ? <img src={dofus.imageUrl} alt={dofus.name} /> : <Gem className="w-4 h-4" />}
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="text-xs font-black truncate">{dofus.name}</div>
                                    <div className="text-[10px] opacity-50 uppercase font-bold tracking-widest">{dofus.slug}</div>
                                </div>
                                {selectedDofusId === dofus.id && <ChevronRight className="w-4 h-4" />}
                            </button>
                        ))}
                    </div>
                </ScrollArea>
                <div className="p-3 border-t border-white/5">
                    <Button 
                        onClick={() => { setEditingDofus(null); setIsDofusDialogOpen(true); }}
                        className="w-full bg-zinc-900 hover:bg-zinc-800 border border-white/5 text-white italic font-black text-xs uppercase"
                    >
                        <Plus className="w-3 h-3 mr-2" /> Nouveau Dofus
                    </Button>
                </div>
            </div>

            {/* Main Content: Tree Editor */}
            <div className="lg:col-span-3 bg-zinc-950/40 border border-white/5 rounded-3xl flex flex-col overflow-hidden relative">
                {selectedDofus ? (
                    <>
                        {/* Selected Dofus Header */}
                        <div className="p-6 border-b border-white/5 bg-zinc-900/20 flex items-center justify-between">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 rounded-2xl bg-zinc-950/50 border border-white/5 p-2 flex items-center justify-center shadow-2xl" style={{ boxShadow: `0 0 30px ${selectedDofus.color}20` }}>
                                    {selectedDofus.imageUrl ? <img src={selectedDofus.imageUrl} alt={selectedDofus.name} className="w-full h-full object-contain" /> : <Gem className="w-8 h-8 text-zinc-700" />}
                                </div>
                                <div className="space-y-1">
                                    <h2 className="text-2xl font-black text-white italic flex items-center gap-3">
                                        {selectedDofus.name}
                                        <Badge variant="outline" className="text-[10px] bg-zinc-950 border-white/10 uppercase tracking-widest font-black py-0">
                                            {selectedDofus.rarity}
                                        </Badge>
                                    </h2>
                                    <p className="text-zinc-500 text-xs max-w-xl truncate">{selectedDofus.description || "Aucune description"}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm" onClick={() => { setEditingDofus(selectedDofus); setIsDofusDialogOpen(true); }} className="text-zinc-500 hover:text-white">
                                    <Edit2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Quest Chains */}
                        <ScrollArea className="flex-1 p-6">
                            <div className="space-y-12 max-w-4xl mx-auto pb-12">
                                {selectedDofus.questChains.length === 0 ? (
                                    <div className="py-20 text-center space-y-4">
                                        <BookOpen className="w-12 h-12 text-zinc-800 mx-auto" />
                                        <div className="space-y-1">
                                            <p className="text-white font-bold opacity-50">Aucune chaîne de quêtes</p>
                                            <p className="text-zinc-600 text-xs">Commencez par ajouter une section de prérequis ou de quêtes principales.</p>
                                        </div>
                                        <Button onClick={() => { setEditingChain({ dofusId: selectedDofus.id }); setIsChainDialogOpen(true); }} className="bg-indigo-600 hover:bg-indigo-500 text-white italic font-black text-xs uppercase">
                                            <Plus className="w-3 h-3 mr-2" /> Créer la première chaîne
                                        </Button>
                                    </div>
                                ) : (
                                    selectedDofus.questChains.map((chain: any) => (
                                        <div key={chain.id} className="space-y-6">
                                            <div className="flex items-center justify-between border-b border-white/5 pb-4">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${chain.sectionType === "PREREQUISITE" ? "bg-amber-500/10 text-amber-500" : "bg-indigo-500/10 text-indigo-500"}`}>
                                                        {chain.sectionType === "PREREQUISITE" ? <Trophy className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                                                    </div>
                                                    <div>
                                                        <h3 className="text-lg font-black text-white italic tracking-tighter uppercase">{chain.sectionName}</h3>
                                                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{chain.sectionType === "PREREQUISITE" ? "Conditions d'accès" : "Suite de quêtes"}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button 
                                                        variant="ghost" size="sm" 
                                                        onClick={() => { setTargetChainId(chain.id); setIsPumpOpen(true); }} 
                                                        className="h-8 w-8 text-zinc-500 hover:text-amber-400"
                                                        title="DofusDB Bulk Pump"
                                                    >
                                                        <Zap className="w-3.5 h-3.5" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => { setEditingChain(chain); setIsChainDialogOpen(true); }} className="h-8 w-8 text-zinc-500 hover:text-white">
                                                        <Edit2 className="w-3 h-3" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => { setEditingEntry({ chainId: chain.id }); setIsEntryDialogOpen(true); }} className="h-8 px-3 text-[10px] font-black uppercase italic bg-zinc-900 hover:bg-zinc-800 border border-white/5 text-zinc-400 hover:text-white">
                                                        <Plus className="w-3 h-3 mr-2" /> Étape
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="space-y-3 pl-12 relative">
                                                {/* Vertical line connector */}
                                                <div className="absolute left-[20px] top-0 bottom-0 w-px bg-white/5" />
                                                
                                                {chain.entries.map((entry: any) => (
                                                   <div key={entry.id} className="relative group p-4 bg-zinc-900/30 border border-white/5 rounded-2xl flex items-center justify-between hover:border-white/10 transition-all hover:bg-zinc-900/50">
                                                        {/* Horizontal connector hook */}
                                                        <div className="absolute -left-[32px] top-1/2 w-[32px] h-px bg-white/5" />
                                                        
                                                        <div className="flex items-center gap-4">
                                                            <div className={`w-10 h-10 rounded-xl bg-zinc-950 border border-white/5 flex items-center justify-center ${entry.questType === "DUNGEON" ? "text-rose-400" : "text-cyan-400"}`}>
                                                                {entry.questType === "DUNGEON" ? <Castle className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                                                            </div>
                                                            <div className="space-y-0.5">
                                                                <h4 className="text-sm font-black text-white italic tracking-tighter">
                                                                    {entry.name}
                                                                    {entry.isLast && <Badge className="ml-2 h-4 text-[8px] bg-green-500/20 text-green-400 border-none uppercase font-black">Final</Badge>}
                                                                    {entry.isOptional && <Badge className="ml-2 h-4 text-[8px] bg-zinc-500/10 text-zinc-500 border-none uppercase font-black">Optionnel</Badge>}
                                                                </h4>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-bold uppercase">
                                                                        <MapPin className="w-2.5 h-2.5" />
                                                                        {entry.zone || "Zone inconnue"}
                                                                    </div>
                                                                    {entry.dofusdbId && (
                                                                        <Badge variant="outline" className="px-1 text-[8px] opacity-40 font-mono tracking-tighter">
                                                                            ID:{entry.dofusdbId}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Button variant="ghost" size="sm" onClick={() => { setEditingEntry(entry); setIsEntryDialogOpen(true); }} className="h-7 w-7 text-zinc-500 hover:text-white">
                                                                <Edit2 className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                   </div> 
                                                ))}
                                                
                                                {chain.entries.length === 0 && (
                                                    <div className="p-4 border border-dashed border-white/5 rounded-2xl text-center">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700 italic">Aucune étape dans cette chaîne</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                                
                                {selectedDofus.questChains.length > 0 && (
                                    <div className="pt-8 border-t border-white/5 flex justify-center">
                                         <Button onClick={() => { setEditingChain({ dofusId: selectedDofus.id }); setIsChainDialogOpen(true); }} className="bg-zinc-900 hover:bg-zinc-800 text-white italic font-black text-xs uppercase border border-white/5">
                                            <Plus className="w-3 h-3 mr-2" /> Ajouter une autre chaîne
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center gap-4 animate-in fade-in duration-500">
                        <div className="w-20 h-20 rounded-3xl bg-zinc-950 border border-white/5 flex items-center justify-center text-zinc-800 shadow-2xl">
                             <Gem className="w-10 h-10" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-xl font-black text-white italic">Sélectionnez un Dofus</h3>
                            <p className="text-zinc-500 text-sm font-medium">Choisissez un Dofus dans la liste pour gérer ses quêtes et prérequis.</p>
                        </div>
                    </div>
                )}
            </div>

            <Dialog open={isPumpOpen} onOpenChange={setIsPumpOpen}>
                <DialogContent className="bg-zinc-950 border-white/10 text-white max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black italic flex items-center gap-2 uppercase tracking-tighter">
                            <Zap className="w-5 h-5 text-amber-500" /> DofusDB Pumper
                        </DialogTitle>
                        <DialogDescription className="text-zinc-500 text-xs">
                            Collez une liste d'IDs de quêtes ou donjons séparés par des virgules pour les importer instantanément.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <textarea 
                            value={pumpIds}
                            onChange={e => setPumpIds(e.target.value)}
                            placeholder="1699, 1700, 1701..."
                            className="w-full h-32 bg-zinc-900 border border-white/5 rounded-xl p-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <Button 
                            onClick={handlePump} 
                            disabled={pumping}
                            className="w-full h-12 bg-white text-black font-black uppercase text-xs italic hover:bg-zinc-200"
                        >
                            {pumping ? "⚡ Pompage en cours..." : "Lancer l'importation automatique"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Editing Dialogs (Abstracted for brevity in this scratch tool) */}
            <DofusEditDialog 
                open={isDofusDialogOpen} 
                onOpenChange={setIsDofusDialogOpen} 
                dofus={editingDofus} 
                onSuccess={loadData} 
            />
            
            <ChainEditDialog 
                open={isChainDialogOpen} 
                onOpenChange={setIsChainDialogOpen} 
                chain={editingChain} 
                dofusId={selectedDofusId}
                onSuccess={loadData} 
            />
            
            <EntryEditDialog 
                open={isEntryDialogOpen} 
                onOpenChange={setIsEntryDialogOpen} 
                entry={editingEntry}
                onSuccess={loadData} 
            />
        </div>
    );
}

// --- Sub-components (Simplified Editor Dialogs) ---

function DofusEditDialog({ open, onOpenChange, dofus, onSuccess }: any) {
    const [formData, setFormData] = useState<any>({ name: "", nameShort: "", slug: "", rarity: "MAJEUR", isPrimordial: false, levelRecommended: 1, color: "#ffffff", imageUrl: "", description: "" });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (dofus) setFormData({ ...dofus });
        else setFormData({ name: "", nameShort: "", slug: "", rarity: "MAJEUR", isPrimordial: false, levelRecommended: 1, color: "#ffffff", imageUrl: "", description: "" });
    }, [dofus, open]);

    async function handleSubmit(e: any) {
        e.preventDefault();
        setLoading(true);
        const res = await upsertDofusItem(dofus?.id || null, formData);
        if (res.success) {
            toast.success("Dofus sauvegardé");
            onOpenChange(false);
            onSuccess();
        } else toast.error(res.error);
        setLoading(false);
    }

    async function handleDelete() {
        if (!confirm("Supprimer CE DOFUS et TOUTES SES QUÊTES ? Irréversible.")) return;
        setLoading(true);
        const res = await deleteDofusItem(dofus.id);
        if (res.success) {
            toast.success("Dofus supprimé");
            onOpenChange(false);
            onSuccess();
        } else toast.error(res.error);
        setLoading(false);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-zinc-950 border-white/10 text-white max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black italic uppercase tracking-tighter">
                        {dofus ? "Modifier le Dofus" : "Ajouter un Dofus"}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-zinc-500 italic">Nom Complet</label>
                            <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-zinc-900 border-white/5 text-sm" placeholder="Dofus des Glaces" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-zinc-500 italic">Nom Court</label>
                            <Input value={formData.nameShort} onChange={e => setFormData({...formData, nameShort: e.target.value})} className="bg-zinc-900 border-white/5 text-sm" placeholder="Glaces" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-zinc-500 italic">Slug (unique)</label>
                            <Input value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} className="bg-zinc-900 border-white/5 text-sm" placeholder="des-glaces" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-zinc-500 italic">Couleur Accent (HEX)</label>
                            <div className="flex gap-2">
                                <Input value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} className="bg-zinc-900 border-white/5 text-sm" placeholder="#ffffff" />
                                <div className="w-10 h-10 rounded-lg border border-white/10 shrink-0" style={{ background: formData.color }} />
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex justify-between items-center pt-6">
                        {dofus && (
                            <Button type="button" variant="ghost" onClick={handleDelete} className="text-rose-500 hover:text-rose-400 hover:bg-rose-500/10">
                                <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                            </Button>
                        )}
                        <div className="flex gap-2 ml-auto">
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
                            <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-500 text-white font-black italic text-xs uppercase tracking-widest px-8">
                                {loading ? "..." : "Sauvegarder"}
                            </Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function ChainEditDialog({ open, onOpenChange, chain, dofusId, onSuccess }: any) {
    const [formData, setFormData] = useState<any>({ dofusId: "", sectionType: "MAIN_CHAIN", sectionName: "", description: "", chainOrder: 0 });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (chain) setFormData({ ...chain, dofusId: chain.dofusId || dofusId });
        else setFormData({ dofusId: dofusId || "", sectionType: "MAIN_CHAIN", sectionName: "", description: "", chainOrder: 0 });
    }, [chain, dofusId, open]);

    async function handleSubmit(e: any) {
        e.preventDefault();
        setLoading(true);
        const res = await upsertQuestChain(chain?.id || null, formData);
        if (res.success) {
            toast.success("Chaîne sauvegardée");
            onOpenChange(false);
            onSuccess();
        } else toast.error(res.error);
        setLoading(false);
    }

    async function handleDelete() {
        if (!confirm("Supprimer cette section ?")) return;
        setLoading(true);
        const res = await deleteQuestChain(chain.id);
        if (res.success) {
            toast.success("Chaîne supprimée");
            onOpenChange(false);
            onSuccess();
        } else toast.error(res.error);
        setLoading(false);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-zinc-950 border-white/10 text-white">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black italic uppercase tracking-tighter">
                        {chain?.id ? "Modifier la Section" : "Ajouter une Section"}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-zinc-500 italic">Type</label>
                        <select 
                            value={formData.sectionType} 
                            onChange={e => setFormData({...formData, sectionType: e.target.value})}
                            className="w-full h-10 bg-zinc-900 border border-white/5 rounded-lg text-sm px-3 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                            <option value="PREREQUISITE">Prérequis (Access)</option>
                            <option value="MAIN_CHAIN">Quêtes Principales</option>
                            <option value="OPTIONAL">Quêtes Optionnelles</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-zinc-500 italic">Nom de la Section</label>
                        <Input value={formData.sectionName} onChange={e => setFormData({...formData, sectionName: e.target.value})} className="bg-zinc-900 border-white/5 text-sm" placeholder="Ex: Mais où sont les Dofus ?" />
                    </div>
                    
                    <div className="flex justify-between items-center pt-6">
                        {chain?.id && (
                            <Button type="button" variant="ghost" onClick={handleDelete} className="text-rose-500 hover:text-rose-400">
                                <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                            </Button>
                        )}
                        <div className="flex gap-2 ml-auto">
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
                            <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-500 text-white font-black italic text-xs uppercase px-8">
                                {loading ? "..." : "Sauvegarder"}
                            </Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function EntryEditDialog({ open, onOpenChange, entry, onSuccess }: any) {
    const [formData, setFormData] = useState<any>({ chainId: "", name: "", zone: "", questType: "QUEST", stepOrder: 0, isOptional: false, isLast: false, dofusdbId: "", mapId: "", coords: { x: null, y: null }, notes: "" });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (entry) setFormData({ ...entry, dofusdbId: entry.dofusdbId || "", mapId: entry.mapId || "", coords: entry.coords || { x: null, y: null } });
        else setFormData({ chainId: "", name: "", zone: "", questType: "QUEST", stepOrder: 0, isOptional: false, isLast: false, dofusdbId: "", mapId: "", coords: { x: null, y: null }, notes: "" });
    }, [entry, open]);

    async function handleSubmit(e: any) {
        e.preventDefault();
        setLoading(true);
        const res = await upsertQuestEntry(entry?.id || null, {
            ...formData,
            dofusdbId: formData.dofusdbId ? parseInt(formData.dofusdbId) : null,
            mapId: formData.mapId ? parseInt(formData.mapId) : null,
            stepOrder: parseInt(formData.stepOrder) || 0
        });
        if (res.success) {
            toast.success("Étape sauvegardée");
            onOpenChange(false);
            onSuccess();
        } else toast.error(res.error);
        setLoading(false);
    }

    async function handleDelete() {
        if (!confirm("Supprimer cette étape ?")) return;
        setLoading(true);
        const res = await deleteQuestEntry(entry.id);
        if (res.success) {
            toast.success("Étape supprimée");
            onOpenChange(false);
            onSuccess();
        } else toast.error(res.error);
        setLoading(false);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-zinc-950 border-white/10 text-white max-w-xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black italic uppercase tracking-tighter">
                        {entry?.id ? "Modifier l'Étape" : "Ajouter une Étape"}
                    </DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[500px] pr-4">
                    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-zinc-500 italic">Nom de la Quête / Étape</label>
                            <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-zinc-900 border-white/5 text-sm" placeholder="Ex: L'Arc d'Ontas" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-zinc-500 italic">Type</label>
                                <select 
                                    value={formData.questType} 
                                    onChange={e => setFormData({...formData, questType: e.target.value})}
                                    className="w-full h-10 bg-zinc-900 border border-white/5 rounded-lg text-sm px-3 focus:outline-none"
                                >
                                    <option value="QUEST">📚 Quête</option>
                                    <option value="DUNGEON">🏰 Donjon</option>
                                    <option value="ACHIEVEMENT">🏆 Succès</option>
                                    <option value="REQUIREMENT">🚩 Prérequis</option>
                                    <option value="JOB">⚒️ Métier</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-zinc-500 italic">Zone (Facultatif)</label>
                                <Input value={formData.zone} onChange={e => setFormData({...formData, zone: e.target.value})} className="bg-zinc-900 border-white/5 text-sm" placeholder="Ex: Astrub" />
                            </div>
                        </div>
                        <div className="grid grid-cols-4 gap-4 pb-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-zinc-500 block">DofusDB ID</label>
                                <Input type="number" value={formData.dofusdbId} onChange={e => setFormData({...formData, dofusdbId: e.target.value})} className="bg-zinc-900 border-white/5 text-sm text-center" />
                            </div>
                             <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-zinc-500 block">MAP ID</label>
                                <Input type="number" value={formData.mapId} onChange={e => setFormData({...formData, mapId: e.target.value})} className="bg-zinc-900 border-white/5 text-sm text-center" />
                            </div>
                             <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-zinc-500 block">COORD X</label>
                                <Input type="number" value={formData.coords?.x ?? ""} onChange={e => setFormData({...formData, coords: { ...formData.coords, x: parseInt(e.target.value) || null }})} className="bg-zinc-900 border-white/5 text-sm text-center font-bold" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-zinc-500 block">COORD Y</label>
                                <Input type="number" value={formData.coords?.y ?? ""} onChange={e => setFormData({...formData, coords: { ...formData.coords, y: parseInt(e.target.value) || null }})} className="bg-zinc-900 border-white/5 text-sm text-center font-bold" />
                            </div>
                        </div>

                         <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
                             <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-zinc-500 block text-center">Ordre d'affichage</label>
                                <Input type="number" value={formData.stepOrder} onChange={e => setFormData({...formData, stepOrder: e.target.value})} className="bg-zinc-900 border-white/5 text-sm text-center" />
                            </div>
                            <div className="flex items-center justify-center gap-4 pt-4">
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" checked={formData.isLast} onChange={e => setFormData({...formData, isLast: e.target.checked})} className="accent-indigo-500" />
                                    <label className="text-[10px] font-black uppercase text-zinc-500 italic">Dernière ?</label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" checked={formData.isOptional} onChange={e => setFormData({...formData, isOptional: e.target.checked})} className="accent-zinc-500" />
                                    <label className="text-[10px] font-black uppercase text-zinc-500 italic">Optionnelle ?</label>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3 pt-2">
                             <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                <label className="text-[10px] font-black uppercase text-zinc-500 italic">Prérequis Internes ({formData.requirements?.length || 0})</label>
                                <Button 
                                    type="button" variant="ghost" size="sm" 
                                    onClick={() => setFormData({ ...formData, requirements: [...(formData.requirements || []), { type: "QUEST", name: "", description: "" }]})}
                                    className="h-6 px-2 text-[10px] bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white"
                                >
                                    <Plus className="w-3 h-3 mr-1" /> Ajouter
                                </Button>
                             </div>
                             <div className="space-y-2">
                                {(formData.requirements || []).map((req: any, idx: number) => (
                                    <div key={idx} className="flex gap-2 p-2 bg-zinc-900/50 rounded-xl border border-white/5 relative group">
                                         <select 
                                            value={req.type} 
                                            onChange={e => {
                                                const newReqs = [...formData.requirements];
                                                newReqs[idx].type = e.target.value;
                                                setFormData({ ...formData, requirements: newReqs });
                                            }}
                                            className="bg-black/40 border border-white/5 rounded-lg text-[10px] px-2 focus:outline-none"
                                        >
                                            <option value="QUEST">Quête</option>
                                            <option value="LEVEL">Niveau</option>
                                            <option value="JOB">Métier</option>
                                            <option value="SUCCESS">Succès</option>
                                        </select>
                                        <Input 
                                            value={req.name} 
                                            onChange={e => {
                                                const newReqs = [...formData.requirements];
                                                newReqs[idx].name = e.target.value;
                                                setFormData({ ...formData, requirements: newReqs });
                                            }}
                                            className="h-8 bg-black/40 border-white/5 text-[10px] flex-1" 
                                            placeholder="Nom ou valeur..." 
                                        />
                                        <Button 
                                            type="button" variant="ghost" size="icon" 
                                            onClick={() => {
                                                const newReqs = formData.requirements.filter((_: any, i: number) => i !== idx);
                                                setFormData({ ...formData, requirements: newReqs });
                                            }}
                                            className="h-8 w-8 text-zinc-700 hover:text-rose-500"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                ))}
                                {(!formData.requirements || formData.requirements.length === 0) && (
                                    <p className="text-[10px] text-zinc-700 italic text-center py-2">Aucun prérequis défini</p>
                                )}
                             </div>
                        </div>

                        <div className="flex justify-between items-center pt-6">
                            {entry?.id && (
                                <Button type="button" variant="ghost" onClick={handleDelete} className="text-rose-500 hover:text-rose-400">
                                    <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                                </Button>
                            )}
                            <div className="flex gap-2 ml-auto">
                                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
                                <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-500 text-white font-black italic text-xs uppercase px-8">
                                    {loading ? "..." : "Sauvegarder"}
                                </Button>
                            </div>
                        </div>
                    </form>
                </ScrollArea>
                
            </DialogContent>
        </Dialog>
    );
}

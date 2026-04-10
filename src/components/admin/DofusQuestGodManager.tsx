"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { 
    getDofusManagementData, 
    upsertDofusItem, 
    deleteDofusItem,
    upsertQuestChain,
    deleteQuestChain,
    upsertQuestEntry,
    deleteQuestEntry
} from "@/server/actions/dofus-quest-admin-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { 
    Gem, Plus, Trash2, Edit2, ChevronRight, 
    MapPin, BookOpen, Castle, Trophy, Search 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle 
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DofusHealthChecker from "./DofusHealthChecker";


export default function DofusQuestGodManager() {
    const params = useParams();
    const guildId = (params?.guildId as string) || "";

    const [dofusList, setDofusList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDofusId, setSelectedDofusId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

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
    const filteredDofus = dofusList.filter(d => 
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        d.slug.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase">God Mode: Quêtes Dofus</h1>
                    <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest mt-1">Édition de la matrice et monitoring de santé</p>
                </div>
            </div>

            <Tabs defaultValue="editor" className="w-full">
                <TabsList className="bg-zinc-950/50 border border-white/5 p-1 rounded-2xl mb-8">
                    <TabsTrigger value="editor" className="data-[state=active]:bg-white data-[state=active]:text-black rounded-xl px-6 font-black uppercase text-[10px] tracking-widest">
                        Éditeur de Matrice
                    </TabsTrigger>
                    <TabsTrigger value="health" className="data-[state=active]:bg-rose-500 data-[state=active]:text-white rounded-xl px-6 font-black uppercase text-[10px] tracking-widest">
                        Santé des Données
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="editor">
                    <div className="flex flex-col lg:flex-row gap-6 items-start">

            {/* Sidebar: Dofus List */}
            <div className="w-full lg:w-80 shrink-0 bg-zinc-950/40 backdrop-blur-xl border border-white/5 rounded-3xl flex flex-col group/sidebar shadow-2xl overflow-hidden">
                <div className="p-5 border-b border-white/5 space-y-4 bg-zinc-900/20">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-white uppercase tracking-widest italic flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-indigo-400" />
                            Catalogue
                        </h3>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <Input 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Rechercher un Dofus..." 
                            className="pl-9 bg-black/40 border-white/10 text-white placeholder:text-zinc-600 rounded-xl focus-visible:ring-indigo-500/50"
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar max-h-[500px] p-3 space-y-1 relative">
                    {loading ? (
                        <div className="p-8 text-center text-zinc-500 animate-pulse text-xs uppercase font-black tracking-widest">
                            Chargement...
                        </div>
                    ) : filteredDofus.length === 0 ? (
                        <div className="p-8 text-center text-zinc-600 text-xs uppercase font-black">
                            Aucun résultat
                        </div>
                    ) : (
                        filteredDofus.map(dofus => (
                            <button
                                key={dofus.id}
                                onClick={() => setSelectedDofusId(dofus.id)}
                                className={`w-full flex items-center gap-4 p-3 rounded-2xl transition-all duration-300 ${
                                    selectedDofusId === dofus.id 
                                        ? "bg-indigo-500/10 border border-indigo-500/20 shadow-[inset_0_0_20px_rgba(99,102,241,0.05)]" 
                                        : "hover:bg-white/5 border border-transparent"
                                }`}
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                                    selectedDofusId === dofus.id ? "bg-indigo-500/20 border-indigo-500/30" : "bg-black/50 border-white/5"
                                }`}>
                                    {dofus.imageUrl ? (
                                        <img src={dofus.imageUrl} alt={dofus.name} className="w-6 h-6 object-contain drop-shadow-lg" />
                                    ) : (
                                        <Gem className={`w-5 h-5 ${selectedDofusId === dofus.id ? "text-indigo-400" : "text-zinc-600"}`} />
                                    )}
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                    <div className={`text-sm font-black truncate transition-colors ${selectedDofusId === dofus.id ? "text-indigo-400" : "text-zinc-300"}`}>
                                        {dofus.name}
                                    </div>
                                    <div className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest truncate">
                                        {dofus.slug}
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
                <div className="p-4 border-t border-white/5 bg-zinc-900/20 mt-auto">
                    <Button 
                        onClick={() => { setEditingDofus(null); setIsDofusDialogOpen(true); }}
                        className="w-full bg-white text-black hover:bg-zinc-200 font-black text-xs uppercase tracking-widest rounded-xl h-11"
                    >
                        <Plus className="w-4 h-4 mr-2" /> Créer Dofus
                    </Button>
                </div>
            </div>

            {/* Main Content: Tree Editor */}
            <div className="flex-1 bg-zinc-950/40 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/5">
                {selectedDofus ? (
                    <div className="flex flex-col h-full h-fit">
                        {/* Selected Dofus Header */}
                        <div className="p-8 border-b border-white/5 bg-zinc-900/20 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                                <div className="flex items-center gap-6">
                                    <div 
                                        className="w-20 h-20 rounded-3xl bg-zinc-950 border border-white/10 p-3 flex items-center justify-center shadow-2xl relative"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-3xl" />
                                        {selectedDofus.imageUrl ? (
                                            <img src={selectedDofus.imageUrl} alt={selectedDofus.name} className="w-full h-full object-contain drop-shadow-xl relative z-10" />
                                        ) : (
                                            <Gem className="w-10 h-10 text-zinc-700 relative z-10" />
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3">
                                            <h2 className="text-3xl font-black text-white italic tracking-tighter">
                                                {selectedDofus.name}
                                            </h2>
                                            <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] uppercase font-black px-2 py-1">
                                                {selectedDofus.rarity}
                                            </Badge>
                                        </div>
                                        <p className="text-zinc-500 text-sm max-w-xl leading-relaxed">
                                            {selectedDofus.description || "Aucune description renseignée pour ce Dofus."}
                                        </p>
                                    </div>
                                </div>
                                <Button 
                                    variant="outline" 
                                    onClick={() => { setEditingDofus(selectedDofus); setIsDofusDialogOpen(true); }} 
                                    className="border-white/10 bg-black/40 hover:bg-white/5 text-zinc-400 hover:text-white font-black uppercase text-[10px] tracking-widest rounded-xl shrink-0"
                                >
                                    <Edit2 className="w-3 h-3 mr-2" /> Éditer Dofus
                                </Button>
                            </div>
                        </div>

                        {/* Quest Chains */}
                        <div className="p-8 space-y-12">
                            {selectedDofus.questChains.length === 0 ? (
                                <div className="py-24 text-center border-2 border-dashed border-white/5 rounded-3xl bg-zinc-900/10">
                                    <BookOpen className="w-16 h-16 text-zinc-800 mx-auto mb-6" />
                                    <h4 className="text-xl font-black text-white italic mb-2">Structure Vide</h4>
                                    <p className="text-zinc-500 text-sm mb-8 max-w-md mx-auto">
                                        L'arbre de quête est totalement vierge. Commencez à dessiner votre arbre en ajoutant le premier bloc (Prérequis ou Quêtes).
                                    </p>
                                    <Button 
                                        onClick={() => { setEditingChain({ dofusId: selectedDofus.id }); setIsChainDialogOpen(true); }} 
                                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-xs tracking-widest rounded-xl h-12 px-8"
                                    >
                                        <Plus className="w-4 h-4 mr-2" /> Ajouter une section
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-8 relative">
                                    {/* Line mapping */}
                                    <div className="absolute left-10 top-8 bottom-0 w-px bg-gradient-to-b from-white/10 via-white/5 to-transparent hidden md:block" />

                                    {selectedDofus.questChains.map((chain: any, index: number) => (
                                        <div key={chain.id} className="relative z-10 group/chain">
                                            {/* Section Header */}
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/30 border border-white/5 rounded-2xl p-4 md:p-5 hover:bg-zinc-900/50 transition-colors">
                                                <div className="flex items-center gap-5">
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border shadow-lg ${
                                                        chain.sectionType === "PREREQUISITE" 
                                                            ? "bg-amber-500/10 border-amber-500/20 text-amber-500" 
                                                            : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                                                    }`}>
                                                        {chain.sectionType === "PREREQUISITE" ? <Trophy className="w-6 h-6" /> : <BookOpen className="w-6 h-6" />}
                                                    </div>
                                                    <div>
                                                        <h3 className="text-xl font-black text-white italic tracking-tighter uppercase">{chain.sectionName}</h3>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <div className="w-2 h-2 rounded-full bg-zinc-600" />
                                                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                                                                {chain.sectionType === "PREREQUISITE" ? "Conditions Initiales" : "Trame Narrative"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button variant="ghost" size="sm" onClick={() => { setEditingChain(chain); setIsChainDialogOpen(true); }} className="h-10 w-10 text-zinc-500 hover:text-white hover:bg-white/5 rounded-xl border border-transparent hover:border-white/10">
                                                        <Edit2 className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => { setEditingEntry({ chainId: chain.id }); setIsEntryDialogOpen(true); }} className="h-10 px-4 text-xs font-black uppercase italic bg-zinc-900 hover:bg-zinc-800 border border-white/5 text-zinc-400 hover:text-white rounded-xl">
                                                        <Plus className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Étape</span>
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Entries Timeline */}
                                            <div className="mt-4 md:ml-32 space-y-3">
                                                {chain.entries.length === 0 ? (
                                                    <div className="p-6 border border-dashed border-white/5 rounded-2xl bg-black/20 text-center">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 italic">Vierge — Ajoutez des quêtes à cette section</p>
                                                    </div>
                                                ) : (
                                                    chain.entries.map((entry: any) => (
                                                        <div key={entry.id} className="group p-4 bg-zinc-950/50 backdrop-blur-md border border-white/5 rounded-2xl flex items-center justify-between hover:border-white/20 transition-all shadow-md">
                                                            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 min-w-0">
                                                                {/* Icon */}
                                                                <div className={`w-10 h-10 rounded-xl bg-black/50 border border-white/5 flex items-center justify-center shrink-0 ${
                                                                    entry.questType === "DUNGEON" ? "text-rose-400" : "text-sky-400"
                                                                }`}>
                                                                    {entry.questType === "DUNGEON" ? <Castle className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                                                                </div>
                                                                
                                                                {/* Content */}
                                                                <div className="space-y-1.5 min-w-0">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                         <h4 className="text-base font-black text-white italic tracking-tighter truncate">
                                                                            {entry.name}
                                                                        </h4>
                                                                        {entry.isLast && <Badge className="bg-emerald-500/20 text-emerald-400 border-none uppercase font-black text-[9px] px-1.5 py-0.5 rounded-md">Final</Badge>}
                                                                        {entry.isOptional && <Badge className="bg-zinc-500/20 text-zinc-400 border-none uppercase font-black text-[9px] px-1.5 py-0.5 rounded-md">Optionnel</Badge>}
                                                                        {entry.externalRef && <Badge className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 uppercase font-black text-[9px] px-1.5 py-0.5 rounded-md flex items-center gap-1"><BookOpen className="w-2.5 h-2.5" /> DPLN OK</Badge>}
                                                                    </div>
                                                                    
                                                                    {/* Dungeons Required display in card */}
                                                                    {Array.isArray(entry.dungeonsRequired) && entry.dungeonsRequired.length > 0 && (
                                                                        <div className="flex flex-wrap gap-1.5 mt-0.5">
                                                                            {entry.dungeonsRequired.map((d: any, i: number) => (
                                                                                <div key={i} className="flex items-center gap-1.5 px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                                                                                    {d.id && <img src={`https://api.dofusdb.fr/img/monsters/${d.id}.png`} className="w-3 h-3 object-contain" alt="" />}
                                                                                    {!d.id && <Castle className="w-2.5 h-2.5 text-rose-500" />}
                                                                                    <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest">{d.name}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                    <div className="flex flex-wrap items-center gap-3 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                                                                        <div className="flex items-center gap-1.5 text-zinc-400">
                                                                            <MapPin className="w-3 h-3 text-emerald-400/70" />
                                                                            <span className="truncate max-w-[150px]">{entry.zone || "Zone inconnue"}</span>
                                                                        </div>
                                                                        {entry.dofusdbId && (
                                                                            <>
                                                                                <div className="w-1 h-1 rounded-full bg-zinc-700" />
                                                                                <span className="font-mono text-zinc-600">ID:{entry.dofusdbId}</span>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Actions */}
                                                            <div className="pl-4 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    onClick={() => { setEditingEntry(entry); setIsEntryDialogOpen(true); }} 
                                                                    className="h-9 w-9 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-xl border border-white/5"
                                                                >
                                                                    <Edit2 className="w-3.5 h-3.5" />
                                                                </Button>
                                                            </div>
                                                        </div> 
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    <div className="pt-8 flex justify-center border-t border-white/5 mt-8 border-dashed">
                                        <Button 
                                            onClick={() => { setEditingChain({ dofusId: selectedDofus.id }); setIsChainDialogOpen(true); }} 
                                            className="bg-zinc-900 border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white font-black uppercase text-[10px] tracking-widest rounded-xl h-10 px-6 shadow-lg"
                                        >
                                            <Plus className="w-3 h-3 mr-2" /> Nouvelle Section
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="h-[500px] flex flex-col items-center justify-center p-12 text-center gap-6 animate-in fade-in duration-500">
                        <div className="relative">
                            <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full" />
                            <div className="w-24 h-24 rounded-[2rem] bg-zinc-950 border border-white/5 flex items-center justify-center text-zinc-800 shadow-2xl relative">
                                <Gem className="w-12 h-12" />
                            </div>
                        </div>
                        <div className="space-y-2 max-w-sm">
                            <h3 className="text-2xl font-black text-white italic tracking-tighter">SÉLECTIONNEZ UN DOFUS</h3>
                            <p className="text-zinc-500 text-sm leading-relaxed">
                                Ouvrez le dictionnaire complet depuis le menu latéral pour éditer ou structurer son arbre de quête manuellement.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>

        <DofusEditDialog open={isDofusDialogOpen} onOpenChange={setIsDofusDialogOpen} dofus={editingDofus} onSuccess={loadData} />
        <ChainEditDialog open={isChainDialogOpen} onOpenChange={setIsChainDialogOpen} chain={editingChain} dofusId={selectedDofusId} onSuccess={loadData} />
        <EntryEditDialog open={isEntryDialogOpen} onOpenChange={setIsEntryDialogOpen} entry={editingEntry} onSuccess={loadData} />
    </TabsContent>

    <TabsContent value="health">
        <DofusHealthChecker />
    </TabsContent>
</Tabs>
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
            <DialogContent className="bg-zinc-950 border-white/10 text-white max-w-2xl rounded-3xl p-8">
                <DialogHeader className="mb-6">
                    <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">
                        {dofus ? "Modifier le Dofus" : "Créer un Dofus"}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Nom Complet</label>
                            <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-black/40 border-white/5 h-11 rounded-xl" placeholder="Ex: Dofus des Glaces" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Nom Court</label>
                            <Input value={formData.nameShort} onChange={e => setFormData({...formData, nameShort: e.target.value})} className="bg-black/40 border-white/5 h-11 rounded-xl" placeholder="Glaces" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Slug (unique)</label>
                            <Input value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} className="bg-black/40 border-white/5 h-11 rounded-xl" placeholder="des-glaces" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Couleur (HEX)</label>
                            <div className="flex gap-3">
                                <Input value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} className="bg-black/40 border-white/5 h-11 rounded-xl flex-1 font-mono text-sm" placeholder="#ffffff" />
                                <div className="w-11 h-11 rounded-xl border border-white/10 shrink-0 shadow-inner" style={{ background: formData.color }} />
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-8 border-t border-white/5 mt-8">
                        {dofus ? (
                            <Button type="button" variant="ghost" onClick={handleDelete} className="text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl h-11 px-6">
                                <Trash2 className="w-4 h-4 mr-2" /> DANGER: Supprimer
                            </Button>
                        ) : <div />}
                        <div className="flex gap-3 ml-auto">
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl h-11 text-zinc-400 hover:text-white">Annuler</Button>
                            <Button type="submit" disabled={loading} className="bg-white text-black hover:bg-zinc-200 font-black italic text-[10px] uppercase tracking-widest rounded-xl h-11 px-8 shadow-xl">
                                {loading ? "Travail en cours..." : "Enregistrer"}
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
            toast.success("Section sauvegardée");
            onOpenChange(false);
            onSuccess();
        } else toast.error(res.error);
        setLoading(false);
    }

    async function handleDelete() {
        if (!confirm("Supprimer la section entière et ses quêtes ?")) return;
        setLoading(true);
        const res = await deleteQuestChain(chain.id);
        if (res.success) {
            toast.success("Section supprimée");
            onOpenChange(false);
            onSuccess();
        } else toast.error(res.error);
        setLoading(false);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-zinc-950 border-white/10 text-white rounded-3xl p-8 max-w-md">
                <DialogHeader className="mb-6">
                    <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">
                        {chain?.id ? "Éditer la Section" : "Nouvelle Section"}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Nature</label>
                        <select 
                            value={formData.sectionType} 
                            onChange={e => setFormData({...formData, sectionType: e.target.value})}
                            className="w-full h-11 bg-black/40 border border-white/5 rounded-xl text-sm px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
                        >
                            <option value="PREREQUISITE">🔑 Prérequis strict</option>
                            <option value="MAIN_CHAIN">📜 Quête Principale</option>
                            <option value="RESOURCE_CHAIN">⚔️ Donjon / Drop</option>
                            <option value="OPTIONAL">✨ Contenu Optionnel</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Titre</label>
                        <Input value={formData.sectionName} onChange={e => setFormData({...formData, sectionName: e.target.value})} className="bg-black/40 border-white/5 h-11 rounded-xl" placeholder="Ex: Voyage au bout du monde" />
                    </div>
                    
                    <div className="flex justify-between items-center pt-8 border-t border-white/5 mt-8">
                        {chain?.id && (
                            <Button type="button" variant="ghost" onClick={handleDelete} className="text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl px-4">
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        )}
                        <div className="flex gap-3 ml-auto">
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl text-zinc-400 hover:text-white">Annuler</Button>
                            <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-500 text-white font-black italic text-[10px] uppercase tracking-widest rounded-xl px-8 shadow-xl hover:scale-[1.02] transition-transform">
                                {loading ? "..." : "Valider"}
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
        if (entry) setFormData({ 
            ...entry, 
            dofusdbId: entry.dofusdbId || "", 
            mapId: entry.mapId || "", 
            coords: entry.coords || { x: null, y: null }, 
            externalRef: entry.externalRef || "",
            dungeonsRequired: Array.isArray(entry.dungeonsRequired) ? entry.dungeonsRequired : []
        });
        else setFormData({ 
            chainId: "", 
            name: "", 
            zone: "", 
            questType: "QUEST", 
            stepOrder: 0, 
            isOptional: false, 
            isLast: false, 
            dofusdbId: "", 
            mapId: "", 
            coords: { x: null, y: null }, 
            notes: "", 
            externalRef: "",
            dungeonsRequired: []
        });
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
            toast.success("Étape enregistrée");
            onOpenChange(false);
            onSuccess();
        } else toast.error(res.error);
        setLoading(false);
    }

    async function handleDelete() {
        if (!confirm("Purger cette étape de la matrice ?")) return;
        setLoading(true);
        const res = await deleteQuestEntry(entry.id);
        if (res.success) {
            toast.success("Étape effacée");
            onOpenChange(false);
            onSuccess();
        } else toast.error(res.error);
        setLoading(false);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-zinc-950 border-white/10 text-white max-w-2xl rounded-3xl overflow-hidden p-0">
                <div className="p-8 border-b border-white/5 bg-zinc-900/30">
                    <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">
                        {entry?.id ? "Paramètres de l'étape" : "Nouvelle Étape"}
                    </DialogTitle>
                </div>
                
                <div className="max-h-[60vh] overflow-y-auto custom-scrollbar p-8">
                    <form onSubmit={handleSubmit} className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Intitulé de la Quête</label>
                                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-black/40 border-white/5 h-12 rounded-xl text-lg font-black" placeholder="Ex: La Vengeance du Bouftou" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-indigo-400 italic">Lien Stratégie (DPLN)</label>
                                <Input value={formData.externalRef || ""} onChange={e => setFormData({...formData, externalRef: e.target.value})} className="bg-indigo-500/10 border-indigo-500/20 h-12 rounded-xl text-xs font-medium" placeholder="https://www.dofuspourlesnoobs.com/..." />
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-900/20 p-6 rounded-2xl border border-white/5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Nature</label>
                                <select 
                                    value={formData.questType} 
                                    onChange={e => setFormData({...formData, questType: e.target.value})}
                                    className="w-full h-11 bg-black/40 border border-white/5 rounded-xl text-sm px-4 focus:outline-none"
                                >
                                    <option value="QUEST">📚 Quête Standard</option>
                                    <option value="DUNGEON">🏰 Donjon Requis</option>
                                    <option value="RESOURCE">🪵 Ressource à fournir</option>
                                    <option value="OTHER_DOFUS">💎 Nécessite un Dofus</option>
                                    <option value="ACHIEVEMENT">🏆 Validation de Succès</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Zone liée</label>
                                <Input value={formData.zone} onChange={e => setFormData({...formData, zone: e.target.value})} className="bg-black/40 border-white/5 h-11 rounded-xl" placeholder="Ex: Astrub" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">ID Base (DB)</label>
                                <Input type="number" value={formData.dofusdbId} onChange={e => setFormData({...formData, dofusdbId: e.target.value})} className="bg-black/40 border-white/5 h-11 rounded-xl text-center font-mono" placeholder="4294" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">MAP ID</label>
                                <Input type="number" value={formData.mapId} onChange={e => setFormData({...formData, mapId: e.target.value})} className="bg-black/40 border-white/5 h-11 rounded-xl text-center font-mono" placeholder="Aucun" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-emerald-500 block">Coord X</label>
                                <Input type="number" value={formData.coords?.x ?? ""} onChange={e => setFormData({...formData, coords: { ...formData.coords, x: parseInt(e.target.value) || null }})} className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400 h-11 rounded-xl text-center font-black" placeholder="-" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-emerald-500 block">Coord Y</label>
                                <Input type="number" value={formData.coords?.y ?? ""} onChange={e => setFormData({...formData, coords: { ...formData.coords, y: parseInt(e.target.value) || null }})} className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400 h-11 rounded-xl text-center font-black" placeholder="-" />
                            </div>
                        </div>

                        {/* Toggles */}
                        <div className="flex flex-wrap gap-4 pt-4 border-t border-white/5">
                            <label className="flex items-center gap-3 p-3 bg-zinc-900/30 rounded-xl border border-white/5 cursor-pointer hover:bg-white/5 transition-colors">
                                <input type="checkbox" checked={formData.isLast} onChange={e => setFormData({...formData, isLast: e.target.checked})} className="w-5 h-5 accent-indigo-500" />
                                <span className="text-xs font-black uppercase tracking-widest text-zinc-300">Point Final</span>
                            </label>
                            <label className="flex items-center gap-3 p-3 bg-zinc-900/30 rounded-xl border border-white/5 cursor-pointer hover:bg-white/5 transition-colors">
                                <input type="checkbox" checked={formData.isOptional} onChange={e => setFormData({...formData, isOptional: e.target.checked})} className="w-5 h-5 accent-zinc-500" />
                                <span className="text-xs font-black uppercase tracking-widest text-zinc-300">Quête Optionnelle</span>
                            </label>
                            <label className="flex items-center gap-3 p-3 bg-zinc-900/30 rounded-xl border border-white/5 cursor-pointer hover:bg-white/5 transition-colors">
                                <input type="checkbox" checked={formData.isDungeon} onChange={e => setFormData({...formData, isDungeon: e.target.checked})} className="w-5 h-5 accent-rose-500" />
                                <span className="text-xs font-black uppercase tracking-widest text-zinc-300">Valide un Donjon</span>
                            </label>
                        </div>

                        {/* Manual Dungeon Selection (Visible only if isDungeon is checked) */}
                        {formData.isDungeon && (
                            <div className="space-y-4 p-6 bg-rose-500/5 rounded-3xl border border-rose-500/10 animate-in slide-in-from-top-4 duration-300">
                                <div className="flex items-center justify-between border-b border-rose-500/10 pb-4">
                                    <div className="flex items-center gap-3">
                                        <Castle className="w-5 h-5 text-rose-500" />
                                        <h5 className="text-[10px] font-black uppercase tracking-widest text-rose-500">Donjon(s) Requis</h5>
                                    </div>
                                    <Button 
                                        type="button" 
                                        onClick={() => {
                                            const newDungeon = { name: "", id: null, img: null, dplnUrl: "" };
                                            setFormData({
                                                ...formData,
                                                dungeonsRequired: [...(formData.dungeonsRequired || []), newDungeon]
                                            });
                                        }}
                                        className="h-8 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 font-black text-[9px] uppercase tracking-widest rounded-lg px-3"
                                    >
                                        <Plus className="w-3 h-3 mr-1.5" /> Ajouter
                                    </Button>
                                </div>

                                <div className="space-y-3">
                                    {(formData.dungeonsRequired || []).length === 0 ? (
                                        <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest text-center py-2 italic">Aucun donjon spécifié — Cliquez sur Ajouter</p>
                                    ) : (
                                        formData.dungeonsRequired.map((d: any, idx: number) => (
                                            <div key={idx} className="flex gap-4 items-center p-4 bg-black/40 rounded-2xl border border-white/5 group/dungeon">
                                                {/* Boss Image Preview */}
                                                <div className="w-12 h-12 rounded-xl bg-black border border-white/10 flex items-center justify-center p-1 shrink-0 overflow-hidden shadow-inner">
                                                    {d.img && d.img.includes('api.dofusdb.fr') ? (
                                                        <img src={d.img} alt="Boss" className="w-full h-full object-contain" />
                                                    ) : d.id ? (
                                                        <img src={`https://api.dofusdb.fr/img/monsters/${d.id}.png`} alt="Boss" className="w-full h-full object-contain" />
                                                    ) : (
                                                        <Castle className="w-5 h-5 text-zinc-800" />
                                                    )}
                                                </div>

                                                <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4">
                                                    <div className="md:col-span-5 space-y-1">
                                                        <label className="text-[8px] font-black uppercase tracking-widest text-zinc-600 ml-1">Nom du Donjon</label>
                                                        <Input 
                                                            value={d.name} 
                                                            onChange={(e) => {
                                                                const newList = [...formData.dungeonsRequired];
                                                                newList[idx] = { ...d, name: e.target.value };
                                                                setFormData({ ...formData, dungeonsRequired: newList });
                                                            }}
                                                            className="bg-black/60 border-white/5 h-9 rounded-xl text-xs" 
                                                            placeholder="Ex: Crypte de Kardorim" 
                                                        />
                                                    </div>
                                                    <div className="md:col-span-5 space-y-1">
                                                        <label className="text-[8px] font-black uppercase tracking-widest text-indigo-400 ml-1">Lien Stratégie DPLN</label>
                                                        <Input 
                                                            value={d.dplnUrl || ""} 
                                                            onChange={(e) => {
                                                                const newList = [...formData.dungeonsRequired];
                                                                newList[idx] = { ...d, dplnUrl: e.target.value };
                                                                setFormData({ ...formData, dungeonsRequired: newList });
                                                            }}
                                                            className="bg-indigo-500/10 border-indigo-500/30 h-9 rounded-xl text-[10px]" 
                                                            placeholder="https://www.dofuspourlesnoobs.com/..." 
                                                        />
                                                    </div>
                                                    <div className="md:col-span-2 space-y-1 text-center">
                                                        <label className="text-[8px] font-black uppercase tracking-widest text-zinc-600">ID Boss</label>
                                                        <Input 
                                                            value={d.id || ""} 
                                                            onChange={(e) => {
                                                                const val = e.target.value ? parseInt(e.target.value) : null;
                                                                const newList = [...formData.dungeonsRequired];
                                                                newList[idx] = { 
                                                                    ...d, 
                                                                    id: val,
                                                                    img: val ? `https://api.dofusdb.fr/img/monsters/${val}.png` : null 
                                                                };
                                                                setFormData({ ...formData, dungeonsRequired: newList });
                                                            }}
                                                            className="bg-black/60 border-white/5 h-9 rounded-xl text-xs text-center font-mono" 
                                                            placeholder="ID" 
                                                        />
                                                    </div>
                                                </div>

                                                <Button 
                                                    type="button" 
                                                    variant="ghost" 
                                                    onClick={() => {
                                                        const newList = formData.dungeonsRequired.filter((_: any, i: number) => i !== idx);
                                                        setFormData({ ...formData, dungeonsRequired: newList });
                                                    }}
                                                    className="h-9 w-9 text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl shrink-0"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </form>
                </div>
                
                <div className="flex justify-between items-center p-6 border-t border-white/5 bg-zinc-900/30">
                    {entry?.id ? (
                        <Button type="button" variant="ghost" onClick={handleDelete} className="text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl">
                            <Trash2 className="w-4 h-4 mr-2" /> Expulser
                        </Button>
                    ) : <div/>}
                    <div className="flex gap-3 ml-auto">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl text-zinc-400 hover:text-white">Fermer</Button>
                        <Button type="button" onClick={handleSubmit} disabled={loading} className="bg-indigo-600 hover:bg-indigo-500 text-white font-black italic text-[10px] uppercase tracking-widest rounded-xl px-8 shadow-xl">
                            Sauvegarder
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

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
    MapPin, BookOpen, Castle, Trophy, Search,
    ArrowUp, ArrowDown,
    ExternalLink, Info
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle 
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function DofusQuestGodManager() {
    const params = useParams();
    const guildId = (params?.guildId as string) || "";

    const [dofusList, setDofusList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDofusId, setSelectedDofusId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

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
                    <h1 className="text-3xl font-black text-white tracking-tight">God Mode : Quêtes Dofus</h1>
                    <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest mt-1">Édition de la matrice</p>
                </div>
            </div>

            <Tabs defaultValue="editor" className="w-full">
                <TabsList className="bg-zinc-950/50 border border-white/5 p-1 rounded-2xl mb-8">
                    <TabsTrigger value="editor" className="data-[state=active]:bg-white data-[state=active]:text-black rounded-xl px-6 font-black uppercase text-[10px] tracking-widest">
                        Éditeur de Matrice
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="editor">
                    <div className="flex flex-col lg:flex-row gap-6 items-start">
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
                        <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Rechercher un Dofus..." className="pl-9 bg-black/40 border-white/10 text-white placeholder:text-zinc-600 rounded-xl focus-visible:ring-indigo-500/50" />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar max-h-[500px] p-3 space-y-1 relative">
                    {loading ? (
                        <div className="p-8 text-center text-zinc-500 animate-pulse text-xs uppercase font-black tracking-widest">Chargement...</div>
                    ) : filteredDofus.length === 0 ? (
                        <div className="p-8 text-center text-zinc-600 text-xs uppercase font-black">Aucun résultat</div>
                    ) : (
                        filteredDofus.map(dofus => (
                            <button key={dofus.id} onClick={() => setSelectedDofusId(dofus.id)} className={`w-full flex items-center gap-4 p-3 rounded-2xl transition-all duration-300 ${selectedDofusId === dofus.id ? "bg-indigo-500/10 border border-indigo-500/20" : "hover:bg-white/5 border border-transparent"}`}>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${selectedDofusId === dofus.id ? "bg-indigo-500/20 border-indigo-500/30" : "bg-black/50 border-white/5"}`}>
                                    {dofus.imageUrl ? <img src={dofus.imageUrl} alt={dofus.name} className="w-6 h-6 object-contain drop-shadow-lg" /> : <Gem className={`w-5 h-5 ${selectedDofusId === dofus.id ? "text-indigo-400" : "text-zinc-600"}`} />}
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                    <div className={`text-sm font-black truncate ${selectedDofusId === dofus.id ? "text-indigo-400" : "text-zinc-300"}`}>{dofus.name}</div>
                                    <div className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest truncate">{dofus.slug}</div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
                <div className="p-4 border-t border-white/5 bg-zinc-900/20 mt-auto">
                    <Button onClick={() => { setEditingDofus(null); setIsDofusDialogOpen(true); }} className="w-full bg-white text-black hover:bg-zinc-200 font-black text-xs uppercase tracking-widest rounded-xl h-11"><Plus className="w-4 h-4 mr-2" /> Créer Dofus</Button>
                </div>
            </div>
            <div className="flex-1 bg-zinc-950/40 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/5">
                {selectedDofus ? (
                    <div className="flex flex-col h-full h-fit">
                        <div className="p-8 border-b border-white/5 bg-zinc-900/20 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                                <div className="flex items-center gap-6">
                                    <div className="w-20 h-20 rounded-3xl bg-zinc-950 border border-white/10 p-3 flex items-center justify-center shadow-2xl relative">
                                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-3xl" />
                                        {selectedDofus.imageUrl ? <img src={selectedDofus.imageUrl} alt={selectedDofus.name} className="w-full h-full object-contain drop-shadow-xl relative z-10" /> : <Gem className="w-10 h-10 text-zinc-700 relative z-10" />}
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3">
                                            <h2 className="text-3xl font-black text-white italic tracking-tighter">{selectedDofus.name}</h2>
                                            <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] uppercase font-black px-2 py-1">{selectedDofus.rarity}</Badge>
                                        </div>
                                        <p className="text-zinc-500 text-sm max-w-xl leading-relaxed">{selectedDofus.description || "Aucune description renseignée pour ce Dofus."}</p>
                                    </div>
                                </div>
                                <Button variant="outline" onClick={() => { setEditingDofus(selectedDofus); setIsDofusDialogOpen(true); }} className="border-white/10 bg-black/40 hover:bg-white/5 text-zinc-400 hover:text-white font-black uppercase text-[10px] tracking-widest rounded-xl shrink-0"><Edit2 className="w-3 h-3 mr-2" /> Éditer Dofus</Button>
                            </div>
                        </div>
                        <div className="p-8 space-y-12">
                            {selectedDofus.questChains.length === 0 ? (
                                <div className="py-24 text-center border-2 border-dashed border-white/5 rounded-3xl bg-zinc-900/10">
                                    <BookOpen className="w-16 h-16 text-zinc-800 mx-auto mb-6" />
                                    <h4 className="text-xl font-black text-white mb-2">Structure Vide</h4>
                                    <p className="text-zinc-500 text-sm mb-8 max-w-md mx-auto">L'arbre de quête est totalement vierge.</p>
                                    <Button onClick={() => { setEditingChain({ dofusId: selectedDofus.id }); setIsChainDialogOpen(true); }} className="bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-xs tracking-widest rounded-xl h-12 px-8"><Plus className="w-4 h-4 mr-2" /> Ajouter une section</Button>
                                </div>
                            ) : (
                                <div className="space-y-8 relative">
                                    <div className="absolute left-10 top-8 bottom-0 w-px bg-gradient-to-b from-white/10 via-white/5 to-transparent hidden md:block" />
                                    {selectedDofus.questChains.map((chain: any) => (
                                        <div key={chain.id} className="relative z-10 group/chain">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/30 border border-white/5 rounded-2xl p-4 md:p-5 hover:bg-zinc-900/50 transition-colors">
                                                <div className="flex items-center gap-5">
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${chain.sectionType === "PREREQUISITE" ? "bg-amber-500/10 border-amber-500/20" : "bg-indigo-500/10 border-indigo-500/20"}`}>
                                                        {chain.sectionIcon ? (
                                                            /* eslint-disable-next-line @next/next/no-img-element */
                                                            <img src={`/assets/icons/${chain.sectionIcon}.png`} alt="" className="w-9 h-9 object-contain" />
                                                        ) : chain.sectionType === "PREREQUISITE" ? <Trophy className="w-6 h-6 text-amber-500" /> : <BookOpen className="w-6 h-6 text-indigo-400" />}
                                                    </div>
                                                    <div>
                                                        <h3 className="text-xl font-black text-white tracking-tight uppercase">{chain.sectionName}</h3>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <div className="w-2 h-2 rounded-full bg-zinc-600" />
                                                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{chain.sectionType === "PREREQUISITE" ? "Conditions Initiales" : "Trame Narrative"}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Button variant="ghost" size="sm" onClick={async () => { const { reorderQuestChain } = await import("@/server/actions/dofus-quest-admin-actions"); const res = await reorderQuestChain(chain.id, "up"); if (res.success) { toast.success("Section déplacée"); loadData(); } else toast.error(res.error || "Erreur"); }} className="h-10 w-10 text-zinc-500 hover:text-indigo-400 hover:bg-white/5 rounded-xl border border-transparent hover:border-white/10" title="Monter"><ArrowUp className="w-4 h-4" /></Button>
                                                    <Button variant="ghost" size="sm" onClick={async () => { const { reorderQuestChain } = await import("@/server/actions/dofus-quest-admin-actions"); const res = await reorderQuestChain(chain.id, "down"); if (res.success) { toast.success("Section déplacée"); loadData(); } else toast.error(res.error || "Erreur"); }} className="h-10 w-10 text-zinc-500 hover:text-indigo-400 hover:bg-white/5 rounded-xl border border-transparent hover:border-white/10" title="Descendre"><ArrowDown className="w-4 h-4" /></Button>
                                                    <Button variant="ghost" size="sm" onClick={() => { setEditingChain(chain); setIsChainDialogOpen(true); }} className="h-10 w-10 text-zinc-500 hover:text-white hover:bg-white/5 rounded-xl border border-transparent hover:border-white/10"><Edit2 className="w-4 h-4" /></Button>
                                                    <Button variant="ghost" size="sm" onClick={() => { setEditingEntry({ chainId: chain.id }); setIsEntryDialogOpen(true); }} className="h-10 px-4 text-xs font-black uppercase italic bg-zinc-900 hover:bg-zinc-800 border border-white/5 text-zinc-400 hover:text-white rounded-xl"><Plus className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Étape</span></Button>
                                                </div>
                                            </div>
                                            <div className="mt-4 md:ml-32 space-y-3">
                                                {chain.entries.length === 0 ? (
                                                    <div className="p-6 border border-dashed border-white/5 rounded-2xl bg-black/20 text-center"><p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 italic">Vierge</p></div>
                                                ) : (
                                                    chain.entries.map((entry: any) => (
                                                        <div key={entry.id} className="group p-4 bg-zinc-950/50 backdrop-blur-md border border-white/5 rounded-2xl flex items-center justify-between hover:border-white/20 transition-all shadow-md">
                                                            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 min-w-0">
                                                                <div className={`w-10 h-10 rounded-xl bg-black/50 border border-white/5 flex items-center justify-center shrink-0 ${entry.questType === "DUNGEON" ? "text-rose-400" : "text-sky-400"}`}>
                                                                    {entry.questType === "DUNGEON" ? <Castle className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                                                                </div>
                                                                <div className="space-y-1.5 min-w-0">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <h4 className="text-base font-black text-white italic tracking-tighter truncate">{entry.name}</h4>
                                                                        {entry.isLast && <Badge className="bg-emerald-500/20 text-emerald-400 border-none uppercase font-black text-[9px] px-1.5 py-0.5 rounded-md">Final</Badge>}
                                                                        {entry.isOptional && <Badge className="bg-zinc-500/20 text-zinc-400 border-none uppercase font-black text-[9px] px-1.5 py-0.5 rounded-md">Optionnel</Badge>}
                                                                        {entry.isDungeon && <Badge className="bg-rose-500/20 text-rose-400 border-none uppercase font-black text-[9px] px-1.5 py-0.5 rounded-md">Donjon</Badge>}
                                                                        {entry.level && <Badge className="bg-amber-500/20 text-amber-400 border-none uppercase font-black text-[9px] px-1.5 py-0.5 rounded-md">N{entry.level}</Badge>}
                                                                        {entry.externalRef && <Badge className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 uppercase font-black text-[9px] px-1.5 py-0.5 rounded-md flex items-center gap-1"><BookOpen className="w-2.5 h-2.5" /> DPLN</Badge>}
                                                                    </div>
                                                                    <div className="flex flex-wrap items-center gap-3 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                                                                        <div className="flex items-center gap-1.5 text-zinc-400">
                                                                            <MapPin className="w-3 h-3 text-emerald-400/70" />
                                                                            <span className="truncate max-w-[150px]">{entry.zone || "Zone inconnue"}</span>
                                                                        </div>
                                                                        {entry.dofusdbId && <><div className="w-1 h-1 rounded-full bg-zinc-700" /><span className="font-mono text-zinc-600">ID:{entry.dofusdbId}</span></>}
                                                                        {entry.npcName && <><div className="w-1 h-1 rounded-full bg-zinc-700" /><span>{entry.npcName}</span></>}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="pl-4 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                                                <Button variant="ghost" size="icon" onClick={async () => { const { reorderQuestEntry } = await import("@/server/actions/dofus-quest-admin-actions"); const res = await reorderQuestEntry(entry.id, "up"); if (res.success) { toast.success("Déplacée"); loadData(); } else toast.error(res.error || "Erreur"); }} className="h-9 w-9 bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-indigo-400 rounded-xl border border-white/5" title="Monter"><ArrowUp className="w-3.5 h-3.5" /></Button>
                                                                <Button variant="ghost" size="icon" onClick={async () => { const { reorderQuestEntry } = await import("@/server/actions/dofus-quest-admin-actions"); const res = await reorderQuestEntry(entry.id, "down"); if (res.success) { toast.success("Déplacée"); loadData(); } else toast.error(res.error || "Erreur"); }} className="h-9 w-9 bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-indigo-400 rounded-xl border border-white/5" title="Descendre"><ArrowDown className="w-3.5 h-3.5" /></Button>
                                                                <Button variant="ghost" size="icon" onClick={() => { setEditingEntry(entry); setIsEntryDialogOpen(true); }} className="h-9 w-9 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-xl border border-white/5"><Edit2 className="w-3.5 h-3.5" /></Button>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    <div className="pt-8 flex justify-center border-t border-white/5 mt-8 border-dashed">
                                        <Button onClick={() => { setEditingChain({ dofusId: selectedDofus.id }); setIsChainDialogOpen(true); }} className="bg-zinc-900 border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white font-black uppercase text-[10px] tracking-widest rounded-xl h-10 px-6"><Plus className="w-3 h-3 mr-2" /> Nouvelle Section</Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="h-[500px] flex flex-col items-center justify-center p-12 text-center gap-6 animate-in fade-in duration-500">
                        <div className="relative">
                            <div className="w-24 h-24 rounded-[2rem] bg-zinc-950 border border-white/5 flex items-center justify-center text-zinc-800 relative">
                                <Gem className="w-12 h-12" />
                            </div>
                        </div>
                        <div className="space-y-2 max-w-sm">
                            <h3 className="text-2xl font-black text-white tracking-tight">SÉLECTIONNEZ UN DOFUS</h3>
                            <p className="text-zinc-500 text-sm leading-relaxed">Ouvrez le dictionnaire complet depuis le menu latéral.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
        <DofusEditDialog open={isDofusDialogOpen} onOpenChange={setIsDofusDialogOpen} dofus={editingDofus} onSuccess={loadData} />
        <ChainEditDialog open={isChainDialogOpen} onOpenChange={setIsChainDialogOpen} chain={editingChain} dofusId={selectedDofusId} onSuccess={loadData} />
        <EntryEditDialog open={isEntryDialogOpen} onOpenChange={setIsEntryDialogOpen} entry={editingEntry} onSuccess={loadData} />
    </TabsContent>
</Tabs>
</div>
);
}

// ─── Dofus Edit Dialog ─────────────────────────────────────────────────────
function DofusEditDialog({ open, onOpenChange, dofus, onSuccess }: any) {
    const [formData, setFormData] = useState<any>({ name: "", nameShort: "", slug: "", rarity: "MAJEUR", isPrimordial: false, levelRecommended: 1, color: "#ffffff", imageUrl: "", description: "" });
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        if (dofus) setFormData({ ...dofus });
        else setFormData({ name: "", nameShort: "", slug: "", rarity: "MAJEUR", isPrimordial: false, levelRecommended: 1, color: "#ffffff", imageUrl: "", description: "" });
    }, [dofus, open]);
    async function handleSubmit(e: any) { e.preventDefault(); setLoading(true); const res = await upsertDofusItem(dofus?.id || null, formData); if (res.success) { toast.success("Dofus sauvegardé"); onOpenChange(false); onSuccess(); } else toast.error(res.error); setLoading(false); }
    async function handleDelete() { if (!confirm("Supprimer CE DOFUS et TOUTES SES QUÊTES ?")) return; setLoading(true); const res = await deleteDofusItem(dofus.id); if (res.success) { toast.success("Dofus supprimé"); onOpenChange(false); onSuccess(); } else toast.error(res.error); setLoading(false); }
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-zinc-950 border-white/10 text-white max-w-2xl rounded-3xl p-8">
                <DialogHeader className="mb-6"><DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">{dofus ? "Modifier le Dofus" : "Créer un Dofus"}</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Nom</label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-black/40 border-white/5 h-11 rounded-xl" /></div>
                        <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Nom court</label><Input value={formData.nameShort} onChange={e => setFormData({...formData, nameShort: e.target.value})} className="bg-black/40 border-white/5 h-11 rounded-xl" /></div>
                        <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Slug</label><Input value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} className="bg-black/40 border-white/5 h-11 rounded-xl" /></div>
                        <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Couleur</label><Input value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} className="bg-black/40 border-white/5 h-11 rounded-xl font-mono" /></div>
                    </div>
                    <div className="flex justify-between pt-8 border-t border-white/5 mt-8">
                        {dofus ? <Button type="button" variant="ghost" onClick={handleDelete} className="text-rose-500 hover:bg-rose-500/10 rounded-xl"><Trash2 className="w-4 h-4 mr-2" /> Supprimer</Button> : <div />}
                        <div className="flex gap-3 ml-auto">
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl text-zinc-400 hover:text-white">Annuler</Button>
                            <Button type="submit" disabled={loading} className="bg-white text-black hover:bg-zinc-200 font-black italic text-[10px] uppercase tracking-widest rounded-xl px-8">{loading ? "..." : "Enregistrer"}</Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ─── Chain Edit Dialog ─────────────────────────────────────────────────────
function ChainEditDialog({ open, onOpenChange, chain, dofusId, onSuccess }: any) {
    const [formData, setFormData] = useState<any>({ dofusId: "", sectionType: "MAIN_CHAIN", sectionName: "", description: "", chainOrder: 0, sectionIcon: "serie-de-quete" });
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        if (chain) setFormData({ ...chain, dofusId: chain.dofusId || dofusId });
        else setFormData({ dofusId: dofusId || "", sectionType: "MAIN_CHAIN", sectionName: "", description: "", chainOrder: 0, sectionIcon: "serie-de-quete" });
    }, [chain, dofusId, open]);
    async function handleSubmit(e: any) { e.preventDefault(); setLoading(true); const res = await upsertQuestChain(chain?.id || null, formData); if (res.success) { toast.success("Section sauvegardée"); onOpenChange(false); onSuccess(); } else toast.error(res.error); setLoading(false); }
    async function handleDelete() { if (!confirm("Supprimer la section entière ?")) return; setLoading(true); const res = await deleteQuestChain(chain.id); if (res.success) { toast.success("Section supprimée"); onOpenChange(false); onSuccess(); } else toast.error(res.error); setLoading(false); }
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-zinc-950 border-white/10 text-white rounded-3xl p-8 max-w-md">
                <DialogHeader className="mb-6"><DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">{chain?.id ? "Éditer la Section" : "Nouvelle Section"}</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Nature</label>
                        <select value={formData.sectionType} onChange={e => setFormData({...formData, sectionType: e.target.value})} className="w-full h-11 bg-black/40 border border-white/5 rounded-xl text-sm px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
                            <option value="PREREQUISITE">🔑 Prérequis</option>
                            <option value="MAIN_CHAIN">📜 Quête Principale</option>
                            <option value="RESOURCE_CHAIN">⚔️ Donjon / Drop</option>
                            <option value="OPTIONAL">✨ Optionnel</option>
                        </select>
                    </div>
                    <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Titre</label><Input value={formData.sectionName} onChange={e => setFormData({...formData, sectionName: e.target.value})} className="bg-black/40 border-white/5 h-11 rounded-xl" /></div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Icône du bloc</label>
                        <div className="grid grid-cols-2 gap-2">
                            {[["serie-de-quete", "Série de quêtes"], ["icone-succes", "Succès"]].map(([val, label]) => (
                                <button key={val} type="button" onClick={() => setFormData({ ...formData, sectionIcon: val })}
                                    className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${formData.sectionIcon === val ? "border-indigo-500/60 bg-indigo-500/15" : "border-white/10 bg-black/40 hover:border-white/20"}`}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={`/assets/icons/${val}.png`} alt={label} className="w-8 h-8 object-contain" />
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-300">{label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-between items-center pt-8 border-t border-white/5 mt-8">
                        {chain?.id ? <Button type="button" variant="ghost" onClick={handleDelete} className="text-rose-500 hover:bg-rose-500/10 rounded-xl"><Trash2 className="w-4 h-4" /></Button> : <div />}
                        <div className="flex gap-3 ml-auto">
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl text-zinc-400 hover:text-white">Annuler</Button>
                            <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-500 text-white font-black italic text-[10px] uppercase tracking-widest rounded-xl px-8">{loading ? "..." : "Valider"}</Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ─── Entry Edit Dialog (V2 enrichie) ──────────────────────────────────────
function EntryEditDialog({ open, onOpenChange, entry, onSuccess }: any) {
    const [formData, setFormData] = useState<any>({
        chainId: "", name: "", zone: "", questType: "QUEST", stepOrder: 0,
        isOptional: false, isLast: false, isDungeon: false,
        level: "", npcName: "", npcSubArea: "",
        notes: "", externalRef: "",
        positions: [] as { x: number; y: number; label?: string }[],
        dofusdbUrl: "", dofuspourlesnoobsUrl: "",
        weight: 1
    });
    const [prerequisites, setPrerequisites] = useState<any[]>([]);
    const [siblingEntries, setSiblingEntries] = useState<any[]>([]);
    const [loadingPrereqs, setLoadingPrereqs] = useState(false);
    const [prereqSearch, setPrereqSearch] = useState("");
    const [loading, setLoading] = useState(false);

    // Position GPS input state
    const [positionsInput, setPositionsInput] = useState("");

    useEffect(() => {
        if (entry?.id && open) {
            setLoadingPrereqs(true);
            Promise.all([
                import("@/server/actions/dofus-quest-admin-actions").then(m => m.getQuestPrerequisites(entry.id)),
                import("@/server/actions/dofus-quest-admin-actions").then(m => m.getSiblingQuestEntries(entry.chainId, entry.id))
            ]).then(([prereqRes, siblingRes]) => {
                if (prereqRes.success && prereqRes.data) setPrerequisites(prereqRes.data.from.map((p: any) => p.fromQuest));
                if (siblingRes.success && siblingRes.data) setSiblingEntries(siblingRes.data);
                setLoadingPrereqs(false);
            }).catch(() => setLoadingPrereqs(false));
        } else { setPrerequisites([]); setSiblingEntries([]); }
    }, [entry?.id, entry?.chainId, open]);

    useEffect(() => {
        if (entry) {
            const positions = entry.positions as any[] || [];
            setFormData({
                chainId: entry.chainId || "",
                name: entry.name || "",
                zone: entry.zone || "",
                questType: entry.questType || "QUEST",
                stepOrder: entry.stepOrder || 0,
                isOptional: entry.isOptional || false,
                isLast: entry.isLast || false,
                isDungeon: entry.isDungeon || false,
                level: entry.level || "",
                npcName: entry.npcName || "",
                npcSubArea: entry.npcSubArea || "",
                notes: entry.notes || "",
                externalRef: entry.externalRef || "",
                positions: Array.isArray(positions) ? positions.map((p: any) => ({
                    x: typeof p?.x === "number" ? p.x : parseInt(p?.x, 10) || 0,
                    y: typeof p?.y === "number" ? p.y : parseInt(p?.y, 10) || 0,
                    label: p?.label || "",
                })) : [],
                dofusdbUrl: entry.dofusdbUrl || "",
                dofuspourlesnoobsUrl: entry.dofuspourlesnoobsUrl || "",
                weight: entry.weight ?? 1
            });
        } else {
            setFormData({
                chainId: "", name: "", zone: "", questType: "QUEST", stepOrder: 0,
                isOptional: false, isLast: false, isDungeon: false,
                level: "", npcName: "", npcSubArea: "",
                notes: "", externalRef: "",
                positions: [], dofusdbUrl: "", dofuspourlesnoobsUrl: "",
                weight: 1
            });
        }
    }, [entry, open]);

    async function handleSubmit(e: any) {
        e.preventDefault();
        setLoading(true);
        const res = await upsertQuestEntry(entry?.id || null, {
            chainId: formData.chainId,
            name: formData.name,
            zone: formData.zone,
            questType: formData.questType,
            stepOrder: parseInt(formData.stepOrder) || 0,
            isOptional: formData.isOptional,
            isLast: formData.isLast,
            requirements: { level: formData.level ? parseInt(formData.level) : null, npc: formData.npcName, subarea: formData.npcSubArea },
            notes: formData.notes,
            externalRef: formData.externalRef,
            positions: formData.positions,
            dofusdbUrl: formData.dofusdbUrl,
            dofuspourlesnoobsUrl: formData.dofuspourlesnoobsUrl,
        } as any);
        if (res.success) { toast.success("Étape enregistrée"); onOpenChange(false); onSuccess(); }
        else toast.error(res.error);
        setLoading(false);
    }

    async function handleDelete() {
        if (!confirm("Purger cette étape ?")) return;
        setLoading(true);
        const res = await deleteQuestEntry(entry.id);
        if (res.success) { toast.success("Étape effacée"); onOpenChange(false); onSuccess(); }
        else toast.error(res.error);
        setLoading(false);
    }

    // Add a GPS launch position from text "x, y" (façon Rush Sylvestre)
    const addPositionFromInput = () => {
        const text = positionsInput.trim();
        if (!text) return;
        const match = text.match(/(-?\d+)[,\s]+(-?\d+)/);
        if (match) {
            const pos = { x: parseInt(match[1], 10), y: parseInt(match[2], 10) };
            setFormData((prev: any) => ({ ...prev, positions: [...(prev.positions || []), pos] }));
            setPositionsInput("");
            toast.success(`📍 ${pos.x}, ${pos.y} ajouté`, { duration: 1500 });
        } else toast.error("Format attendu : -2, 0 ou 10, -22");
    };

    const removePosition = (idx: number) => {
        setFormData((prev: any) => ({ ...prev, positions: (prev.positions || []).filter((_: any, i: number) => i !== idx) }));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-zinc-950 border-white/10 text-white max-w-3xl rounded-3xl overflow-hidden p-0">
                <div className="p-6 border-b border-white/5 bg-zinc-900/30">
                    <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">
                        {entry?.id ? "✏️ Paramètres de l'étape" : "➕ Nouvelle Étape"}
                    </DialogTitle>
                </div>
                <div className="max-h-[70vh] overflow-y-auto custom-scrollbar p-6">
                    <div className="space-y-6">
                        {/* Core info row */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1 md:col-span-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Nom</label>
                                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-black/40 border-white/5 h-11 rounded-xl text-base font-bold" placeholder="La Vengeance du Bouftou" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Niveau</label>
                                <Input type="number" value={formData.level} onChange={e => setFormData({...formData, level: e.target.value})} className="bg-black/40 border-white/5 h-11 rounded-xl text-center font-mono" placeholder="120" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Zone</label>
                                <Input value={formData.zone} onChange={e => setFormData({...formData, zone: e.target.value})} className="bg-black/40 border-white/5 h-11 rounded-xl" placeholder="Astrub" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">PNJ</label>
                                <Input value={formData.npcName || ""} onChange={e => setFormData({...formData, npcName: e.target.value})} className="bg-black/40 border-white/5 h-11 rounded-xl" placeholder="Mage Xelor" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Sous-zone</label>
                                <Input value={formData.npcSubArea || ""} onChange={e => setFormData({...formData, npcSubArea: e.target.value})} className="bg-black/40 border-white/5 h-11 rounded-xl" placeholder="Cité d'Astrub" />
                            </div>
                        </div>
                        {/* Options toggles */}
                        <div className="flex flex-wrap gap-3">
                            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-zinc-900/30 border border-white/5 cursor-pointer hover:bg-white/5 transition-colors">
                                <input type="checkbox" checked={formData.isDungeon} onChange={e => setFormData({...formData, isDungeon: e.target.checked})} className="w-4 h-4 accent-rose-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-rose-400">Donjon</span>
                            </label>
                            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-zinc-900/30 border border-white/5 cursor-pointer hover:bg-white/5 transition-colors">
                                <input type="checkbox" checked={formData.isLast} onChange={e => setFormData({...formData, isLast: e.target.checked})} className="w-4 h-4 accent-emerald-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Finale</span>
                            </label>
                            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-zinc-900/30 border border-white/5 cursor-pointer hover:bg-white/5 transition-colors">
                                <input type="checkbox" checked={formData.isOptional} onChange={e => setFormData({...formData, isOptional: e.target.checked})} className="w-4 h-4 accent-zinc-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Optionnelle</span>
                            </label>
                        </div>
                        {/* Positions GPS (façon Rush Sylvestre) */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2"><MapPin className="w-3 h-3" /> Positions GPS <span className="text-zinc-600 font-normal normal-case tracking-normal">(ex: -2, 0 ; 10, -22)</span></label>
                            {formData.positions.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {formData.positions.map((p: any, idx: number) => (
                                        <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold font-mono">
                                            {p.x}, {p.y}
                                            <button type="button" onClick={() => removePosition(idx)} className="text-emerald-400/50 hover:text-rose-400"><Trash2 className="w-2.5 h-2.5" /></button>
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div className="flex gap-2">
                                <Input value={positionsInput} onChange={e => setPositionsInput(e.target.value)} placeholder="10, -22" className="bg-black/40 border-emerald-500/20 h-9 rounded-xl text-xs font-mono flex-1" onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addPositionFromInput())} />
                                <button type="button" onClick={addPositionFromInput} className="h-9 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-[10px] font-black uppercase tracking-wider shrink-0">📍 Ajouter</button>
                            </div>
                        </div>

                        {/* Liens DofusDB / DofusNoobs + Notes */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2"><ExternalLink className="w-3 h-3 text-sky-400" /> URL DofusDB</label>
                                <Input value={formData.dofusdbUrl || ""} onChange={e => setFormData({...formData, dofusdbUrl: e.target.value})} className="bg-sky-500/10 border-sky-500/20 h-11 rounded-xl text-xs" placeholder="https://dofusdb.fr/fr/database/quest/..." />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2"><BookOpen className="w-3 h-3" /> URL DofusNoobs</label>
                                <Input value={formData.dofuspourlesnoobsUrl || ""} onChange={e => setFormData({...formData, dofuspourlesnoobsUrl: e.target.value})} className="bg-indigo-500/10 border-indigo-500/20 h-11 rounded-xl text-xs" placeholder="https://www.dofuspourlesnoobs.com/..." />
                            </div>
                            <div className="space-y-1 md:col-span-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2"><Info className="w-3 h-3" /> Notes</label>
                                <textarea value={formData.notes || ""} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full h-20 bg-black/40 border border-white/5 rounded-xl text-xs p-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 resize-none" placeholder="Infos complémentaires..." />
                            </div>
                        </div>

                        {/* Prérequis section (already done) */}
                        {entry?.id && (
                            <div className="border-t border-white/5 pt-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2"><span>🔗</span> PRÉREQUIS</h4>
                                    <span className="text-[10px] text-zinc-600 font-bold">{prerequisites.length} lié{prerequisites.length > 1 ? "s" : ""}</span>
                                </div>
                                {loadingPrereqs ? <div className="text-[10px] text-zinc-500 italic py-2">Chargement...</div> : prerequisites.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                        {prerequisites.map((p: any) => (
                                            <div key={p.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold">
                                                <span className="truncate max-w-[120px]">{p.name}</span>
                                                <button onClick={async () => {
                                                    const { getQuestPrerequisites, removeQuestPrerequisite } = await import("@/server/actions/dofus-quest-admin-actions");
                                                    const res = await getQuestPrerequisites(entry.id);
                                                    if (res.success && res.data) {
                                                        const link = res.data.from.find((f: any) => f.fromQuest?.id === p.id);
                                                        if (link) {
                                                            const delRes = await removeQuestPrerequisite(link.id);
                                                            if (delRes.success) { toast.success(`Prérequis "${p.name}" retiré`); setPrerequisites(prev => prev.filter((x: any) => x.id !== p.id)); }
                                                            else toast.error(delRes.error || "Erreur");
                                                        }
                                                    }
                                                }} className="text-rose-400/50 hover:text-rose-400"><Trash2 className="w-2.5 h-2.5" /></button>
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="text-[10px] text-zinc-600 italic mb-3">Aucun prérequis défini</p>}
                                {siblingEntries.length > 0 && (
                                    <div className="space-y-2">
                                        <input value={prereqSearch} onChange={e => setPrereqSearch(e.target.value)} placeholder="Rechercher une quête comme prérequis..." className="w-full h-9 bg-black/40 border border-white/5 rounded-xl text-xs px-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50" />
                                        <div className="max-h-[120px] overflow-y-auto custom-scrollbar space-y-0.5">
                                            {siblingEntries.filter((s: any) => !prerequisites.some((p: any) => p.id === s.id) && s.name.toLowerCase().includes(prereqSearch.toLowerCase())).slice(0, 8).map((s: any) => (
                                                <button key={s.id} onClick={async () => {
                                                    const { addQuestPrerequisite } = await import("@/server/actions/dofus-quest-admin-actions");
                                                    const res = await addQuestPrerequisite(s.id, entry.id);
                                                    if (res.success) { toast.success(`Prérequis "${s.name}" ajouté`); setPrerequisites(prev => [...prev, s]); }
                                                    else toast.error(res.error || "Erreur");
                                                }} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-indigo-500/10 text-left transition-all text-[10px] text-zinc-400 hover:text-indigo-300 font-medium">
                                                    <Plus className="w-2.5 h-2.5 shrink-0" />
                                                    <span className="truncate">{s.name}</span>
                                                    <span className="text-zinc-600 shrink-0 ml-auto">{s.chain?.sectionName}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex justify-between items-center p-6 border-t border-white/5 bg-zinc-900/30">
                    {entry?.id ? <Button type="button" variant="ghost" onClick={handleDelete} className="text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl"><Trash2 className="w-4 h-4 mr-2" /> Supprimer</Button> : <div/>}
                    <div className="flex gap-3 ml-auto">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl text-zinc-400 hover:text-white">Fermer</Button>
                        <Button type="button" onClick={handleSubmit} disabled={loading} className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl px-8">Sauvegarder</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
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
import { AsyncCombobox } from "@/components/ui/async-combobox";
import { searchZonesDetected } from "@/server/actions/game-data-actions";
import { searchDungeonsLocal } from "@/server/actions/dofus-search-actions";
import { toast } from "sonner";
import { safeImageUrl, isSafeImageUrl } from "@/lib/security";
import { 
    Gem, Plus, Trash2, Edit2, 
    MapPin, BookOpen, Castle, Trophy, Search,
    ArrowUp, ArrowDown,
    ExternalLink, Info, Sword, Skull, Copy, ImageIcon
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
                    <h1 className="text-3xl font-black text-foreground tracking-tight">God Mode : Quêtes Dofus</h1>
                    <p className="text-muted-foreground text-sm font-bold uppercase tracking-widest mt-1">Édition de la matrice</p>
                </div>
            </div>

            <Tabs defaultValue="editor" className="w-full">
                <TabsList className="bg-background/50 border border-border p-1 rounded-2xl mb-8">
                    <TabsTrigger value="editor" className="data-[state=active]:bg-background data-[state=active]:text-foreground rounded-xl px-6 font-black uppercase text-caption tracking-widest">
                        Éditeur de Matrice
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="editor">
                    <div className="flex flex-col lg:flex-row gap-6 items-start">
            <div className="w-full lg:w-80 shrink-0 bg-background/40 backdrop-blur-xl border border-border rounded-3xl flex flex-col group/sidebar shadow-2xl overflow-hidden">
                <div className="p-5 border-b border-border space-y-4 bg-surface/20">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-foreground uppercase tracking-widest italic flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-info" />
                            Catalogue
                        </h3>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Rechercher un Dofus..." className="pl-9 bg-muted/40 border-border text-foreground placeholder:text-muted-foreground rounded-xl focus-visible:ring-ring/50" />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar max-h-[500px] p-3 space-y-1 relative">
                    {loading ? (
                        <div className="p-8 text-center text-muted-foreground animate-pulse text-xs uppercase font-black tracking-widest">Chargement...</div>
                    ) : filteredDofus.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground text-xs uppercase font-black">Aucun résultat</div>
                    ) : (
                        filteredDofus.map(dofus => (
                            <button key={dofus.id} onClick={() => setSelectedDofusId(dofus.id)} className={`w-full flex items-center gap-4 p-3 rounded-2xl transition-all duration-300 ${selectedDofusId === dofus.id ? "bg-info/10 border border-info/20" : "hover:bg-surface border border-transparent"}`}>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${selectedDofusId === dofus.id ? "bg-info/20 border-info/30" : "bg-black/50 border-border"}`}>
                                    {dofus.imageUrl ? <img src={dofus.imageUrl} alt={dofus.name} className="w-6 h-6 object-contain drop-shadow-lg" /> : <Gem className={`w-5 h-5 ${selectedDofusId === dofus.id ? "text-info" : "text-muted-foreground"}`} />}
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                    <div className={`text-sm font-black truncate ${selectedDofusId === dofus.id ? "text-info" : "text-foreground"}`}>{dofus.name}</div>
                                    <div className="text-caption text-muted-foreground uppercase font-bold tracking-widest truncate">{dofus.slug}</div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
                <div className="p-4 border-t border-border bg-surface/20 mt-auto">
                    <Button onClick={() => { setEditingDofus(null); setIsDofusDialogOpen(true); }} className="w-full bg-background text-foreground hover:bg-surface font-black text-xs uppercase tracking-widest rounded-xl h-11"><Plus className="w-4 h-4 mr-2" /> Créer Dofus</Button>
                </div>
            </div>
            <div className="flex-1 bg-background/40 backdrop-blur-xl border border-border rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/5">
                {selectedDofus ? (
                    <div className="flex flex-col h-full h-fit">
                        <div className="p-8 border-b border-border bg-surface/20 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-info/5 blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                                <div className="flex items-center gap-6">
                                    <div className="w-20 h-20 rounded-3xl bg-background border border-border p-3 flex items-center justify-center shadow-2xl relative">
                                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-3xl" />
                                        {selectedDofus.imageUrl ? <img src={selectedDofus.imageUrl} alt={selectedDofus.name} className="w-full h-full object-contain drop-shadow-xl relative z-10" /> : <Gem className="w-10 h-10 text-muted-foreground relative z-10" />}
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3">
                                            <h2 className="text-3xl font-black text-foreground italic tracking-tighter">{selectedDofus.name}</h2>
                                            <Badge className="bg-info/10 text-info border border-info/20 text-caption uppercase font-black px-2 py-1">{selectedDofus.rarity}</Badge>
                                        </div>
                                        <p className="text-muted-foreground text-sm max-w-xl leading-relaxed">{selectedDofus.description || "Aucune description renseignée pour ce Dofus."}</p>
                                    </div>
                                </div>
                                <Button variant="outline" onClick={() => { setEditingDofus(selectedDofus); setIsDofusDialogOpen(true); }} className="border-border bg-muted/40 hover:bg-surface text-muted-foreground hover:text-foreground font-black uppercase text-caption tracking-widest rounded-xl shrink-0"><Edit2 className="w-3 h-3 mr-2" /> Éditer Dofus</Button>
                            </div>
                        </div>
                        <div className="p-8 space-y-12">
                            {selectedDofus.questChains.length === 0 ? (
                                <div className="py-24 text-center border-2 border-dashed border-border rounded-3xl bg-surface/10">
                                    <BookOpen className="w-16 h-16 text-foreground mx-auto mb-6" />
                                    <h4 className="text-xl font-black text-foreground mb-2">Structure Vide</h4>
                                    <p className="text-muted-foreground text-sm mb-8 max-w-md mx-auto">L'arbre de quête est totalement vierge.</p>
                                    <Button onClick={() => { setEditingChain({ dofusId: selectedDofus.id }); setIsChainDialogOpen(true); }} className="bg-info hover:bg-info text-info-foreground font-black uppercase text-xs tracking-widest rounded-xl h-12 px-8"><Plus className="w-4 h-4 mr-2" /> Ajouter une section</Button>
                                </div>
                            ) : (
                                <div className="space-y-8 relative">
                                    <div className="absolute left-10 top-8 bottom-0 w-px bg-gradient-to-b from-white/10 via-white/5 to-transparent hidden md:block" />
                                    {selectedDofus.questChains.map((chain: any) => (
                                        <div key={chain.id} className="relative z-10 group/chain">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface/30 border border-border rounded-2xl p-4 md:p-5 hover:bg-surface/50 transition-colors">
                                                <div className="flex items-center gap-5">
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${chain.sectionType === "PREREQUISITE" ? "bg-warning/10 border-warning/20" : "bg-info/10 border-info/20"}`}>
                                                        {chain.sectionIcon ? (
                                                            /* eslint-disable-next-line @next/next/no-img-element */
                                                            <img src={`/assets/icons/${chain.sectionIcon}.png`} alt="" className="w-9 h-9 object-contain" />
                                                        ) : chain.sectionType === "PREREQUISITE" ? <Trophy className="w-6 h-6 text-warning" /> : <BookOpen className="w-6 h-6 text-info" />}
                                                    </div>
                                                    <div>
                                                        <h3 className="text-xl font-black text-foreground tracking-tight uppercase">{chain.sectionName}</h3>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <div className="w-2 h-2 rounded-full bg-muted" />
                                                            <p className="text-caption text-muted-foreground font-bold uppercase tracking-widest">{chain.sectionType === "PREREQUISITE" ? "Conditions Initiales" : "Trame Narrative"}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Button variant="ghost" size="sm" onClick={async () => { const { reorderQuestChain } = await import("@/server/actions/dofus-quest-admin-actions"); const res = await reorderQuestChain(chain.id, "up"); if (res.success) { toast.success("Section déplacée"); loadData(); } else toast.error(res.error || "Erreur"); }} className="h-10 w-10 text-muted-foreground hover:text-info hover:bg-surface rounded-xl border border-transparent hover:border-border" title="Monter"><ArrowUp className="w-4 h-4" /></Button>
                                                    <Button variant="ghost" size="sm" onClick={async () => { const { reorderQuestChain } = await import("@/server/actions/dofus-quest-admin-actions"); const res = await reorderQuestChain(chain.id, "down"); if (res.success) { toast.success("Section déplacée"); loadData(); } else toast.error(res.error || "Erreur"); }} className="h-10 w-10 text-muted-foreground hover:text-info hover:bg-surface rounded-xl border border-transparent hover:border-border" title="Descendre"><ArrowDown className="w-4 h-4" /></Button>
                                                    <Button variant="ghost" size="sm" onClick={() => { setEditingChain(chain); setIsChainDialogOpen(true); }} className="h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-surface rounded-xl border border-transparent hover:border-border"><Edit2 className="w-4 h-4" /></Button>
                                                    <Button variant="ghost" size="sm" onClick={() => { setEditingEntry({ chainId: chain.id }); setIsEntryDialogOpen(true); }} className="h-10 px-4 text-xs font-black uppercase italic bg-surface hover:bg-elevated border border-border text-muted-foreground hover:text-foreground rounded-xl"><Plus className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Étape</span></Button>
                                                </div>
                                            </div>
                                            <div className="mt-4 md:ml-32 space-y-3">
                                                {chain.entries.length === 0 ? (
                                                    <div className="p-6 border border-dashed border-border rounded-2xl bg-muted/20 text-center"><p className="text-caption font-black uppercase tracking-widest text-muted-foreground italic">Vierge</p></div>
                                                ) : (
                                                    chain.entries.map((entry: any) => (
                                                        <div key={entry.id} className="group p-4 bg-background/50 backdrop-blur-md border border-border rounded-2xl flex items-center justify-between hover:border-border-strong transition-all shadow-md">
                                                            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 min-w-0">
                                                                <div className={`w-12 h-12 rounded-xl bg-black/50 border border-border overflow-hidden flex items-center justify-center shrink-0 ${entry.questType === "DUNGEON" ? "text-danger" : "text-sky-400"}`}>
                                                                    {entry.localImageUrl ? (
                                                                        /* eslint-disable-next-line @next/next/no-img-element */
                                                                        <img src={entry.localImageUrl} alt="" className="w-full h-full object-contain p-0.5" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                                                    ) : entry.questType === "DUNGEON" ? <Castle className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                                                                </div>
                                                                <div className="space-y-1.5 min-w-0">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <h4 className="text-base font-black text-foreground italic tracking-tighter truncate">{entry.name}</h4>
                                                                        {entry.isLast && <Badge className="bg-success/20 text-success border-none uppercase font-black text-caption px-1.5 py-0.5 rounded-md">Final</Badge>}
                                                                        {entry.isOptional && <Badge className="bg-muted/20 text-muted-foreground border-none uppercase font-black text-caption px-1.5 py-0.5 rounded-md">Optionnel</Badge>}
                                                                        {entry.isDungeon && <Badge className="bg-danger/20 text-danger border-none uppercase font-black text-caption px-1.5 py-0.5 rounded-md">Donjon</Badge>}
                                                                        {entry.level && <Badge className="bg-warning/20 text-warning border-none uppercase font-black text-caption px-1.5 py-0.5 rounded-md">Reco. N{entry.level}</Badge>}
                                                                        {Array.isArray(entry.dungeonsRequired) && entry.dungeonsRequired.length > 0 && <Badge className="bg-indigo-500/20 text-indigo-300 border-none uppercase font-black text-caption px-1.5 py-0.5 rounded-md flex items-center gap-1"><Sword className="w-2.5 h-2.5" /> {entry.dungeonsRequired.length} donjon{entry.dungeonsRequired.length > 1 ? "s" : ""}</Badge>}
                                                                        {Array.isArray(entry.positions) && entry.positions.length > 0 && <Badge className="bg-success/20 text-success border-none uppercase font-black text-caption px-1.5 py-0.5 rounded-md flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {entry.positions.length} pos.</Badge>}
                                                                        {entry.externalRef && <Badge className="bg-info/20 text-info border border-info/30 uppercase font-black text-caption px-1.5 py-0.5 rounded-md flex items-center gap-1"><BookOpen className="w-2.5 h-2.5" /> DPLN</Badge>}
                                                                    </div>
                                                                    <div className="flex flex-wrap items-center gap-3 text-caption text-muted-foreground font-bold uppercase tracking-widest">
                                                                        <div className="flex items-center gap-1.5 text-muted-foreground">
                                                                            <MapPin className="w-3 h-3 text-success/70" />
                                                                            <span className="truncate max-w-[150px]">{entry.zone || "Zone inconnue"}</span>
                                                                        </div>
                                                                        {entry.dofusdbId && <><div className="w-1 h-1 rounded-full bg-muted" /><span className="font-mono text-muted-foreground">ID:{entry.dofusdbId}</span></>}
                                                                        {entry.npcName && <><div className="w-1 h-1 rounded-full bg-muted" /><span>{entry.npcName}</span></>}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="pl-4 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                                                <Button variant="ghost" size="icon" onClick={async () => { const { reorderQuestEntry } = await import("@/server/actions/dofus-quest-admin-actions"); const res = await reorderQuestEntry(entry.id, "up"); if (res.success) { toast.success("Déplacée"); loadData(); } else toast.error(res.error || "Erreur"); }} className="h-9 w-9 bg-surface hover:bg-surface text-muted-foreground hover:text-info rounded-xl border border-border" title="Monter"><ArrowUp className="w-3.5 h-3.5" /></Button>
                                                                <Button variant="ghost" size="icon" onClick={async () => { const { reorderQuestEntry } = await import("@/server/actions/dofus-quest-admin-actions"); const res = await reorderQuestEntry(entry.id, "down"); if (res.success) { toast.success("Déplacée"); loadData(); } else toast.error(res.error || "Erreur"); }} className="h-9 w-9 bg-surface hover:bg-surface text-muted-foreground hover:text-info rounded-xl border border-border" title="Descendre"><ArrowDown className="w-3.5 h-3.5" /></Button>
                                                                <Button variant="ghost" size="icon" onClick={() => { setEditingEntry(entry); setIsEntryDialogOpen(true); }} className="h-9 w-9 bg-surface hover:bg-surface text-muted-foreground hover:text-foreground rounded-xl border border-border"><Edit2 className="w-3.5 h-3.5" /></Button>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    <div className="pt-8 flex justify-center border-t border-border mt-8 border-dashed">
                                        <Button onClick={() => { setEditingChain({ dofusId: selectedDofus.id }); setIsChainDialogOpen(true); }} className="bg-surface border border-border hover:border-border-strong text-foreground hover:text-foreground font-black uppercase text-caption tracking-widest rounded-xl h-10 px-6"><Plus className="w-3 h-3 mr-2" /> Nouvelle Section</Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="h-[500px] flex flex-col items-center justify-center p-12 text-center gap-6 animate-in fade-in duration-300">
                        <div className="relative">
                            <div className="w-24 h-24 rounded-[2rem] bg-background border border-border flex items-center justify-center text-foreground relative">
                                <Gem className="w-12 h-12" />
                            </div>
                        </div>
                        <div className="space-y-2 max-w-sm">
                            <h3 className="text-2xl font-black text-foreground tracking-tight">SÉLECTIONNEZ UN DOFUS</h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">Ouvrez le dictionnaire complet depuis le menu latéral.</p>
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
            <DialogContent className="bg-background border-border text-foreground max-w-2xl rounded-3xl p-8">
                <DialogHeader className="mb-6"><DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">{dofus ? "Modifier le Dofus" : "Créer un Dofus"}</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2"><label className="text-caption font-black uppercase tracking-widest text-muted-foreground">Nom</label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-muted/40 border-border h-11 rounded-xl" /></div>
                        <div className="space-y-2"><label className="text-caption font-black uppercase tracking-widest text-muted-foreground">Nom court</label><Input value={formData.nameShort} onChange={e => setFormData({...formData, nameShort: e.target.value})} className="bg-muted/40 border-border h-11 rounded-xl" /></div>
                        <div className="space-y-2"><label className="text-caption font-black uppercase tracking-widest text-muted-foreground">Slug</label><Input value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} className="bg-muted/40 border-border h-11 rounded-xl" /></div>
                        <div className="space-y-2"><label className="text-caption font-black uppercase tracking-widest text-muted-foreground">Couleur</label><Input value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} className="bg-muted/40 border-border h-11 rounded-xl font-mono" /></div>
                    </div>
                    {/* #225 — Icône / image du Dofus (module, page dédiée et cartes). Prévisualisation + URL. */}
                    <div className="space-y-2">
                        <label className="text-caption font-black uppercase tracking-widest text-muted-foreground">Icône / Image</label>
                        <div className="flex items-center gap-4">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={safeImageUrl(formData.imageUrl || "") || "/assets/icons/serie-de-quete.png"}
                                alt="Aperçu de l'icône"
                                className="w-14 h-14 rounded-xl object-contain bg-muted/30 border border-border p-1"
                            />
                            <Input
                                value={formData.imageUrl || ""}
                                onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                                placeholder="Chemin local (ex: /module-dofus/Dokille.png) ou URL https://…"
                                className="bg-muted/40 border-border h-11 rounded-xl font-mono"
                            />
                        </div>
                        <p className="text-caption text-muted-foreground leading-relaxed italic">
                            Asset local <span className="font-mono text-foreground">/module-dofus/…</span> recommandé, ou URL https:// externe. Cette icône remplace la couleur sur le module, la page du Dofus et les cartes.
                        </p>
                    </div>
                    <div className="flex justify-between pt-8 border-t border-border mt-8">
                        {dofus ? <Button type="button" variant="ghost" onClick={handleDelete} className="text-danger hover:bg-danger/10 rounded-xl"><Trash2 className="w-4 h-4 mr-2" /> Supprimer</Button> : <div />}
                        <div className="flex gap-3 ml-auto">
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl text-muted-foreground hover:text-foreground">Annuler</Button>
                            <Button type="submit" disabled={loading} className="bg-background text-foreground hover:bg-surface font-black italic text-caption uppercase tracking-widest rounded-xl px-8">{loading ? "..." : "Enregistrer"}</Button>
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
            <DialogContent className="bg-background border-border text-foreground rounded-3xl p-8 max-w-md">
                <DialogHeader className="mb-6"><DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">{chain?.id ? "Éditer la Section" : "Nouvelle Section"}</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-caption font-black uppercase tracking-widest text-muted-foreground">Type de section</label>
                        {/* #148 — 3 choix lisibles : Prérequis / Série de Quête / Succès (sectionType + sectionIcon dérivés) */}
                        {(() => {
                            const nature = formData.sectionType === "PREREQUISITE" ? "pre" : formData.sectionType === "RESOURCE_CHAIN" ? "succes" : "serie";
                            const setNature = (v: string) => {
                                if (v === "pre") setFormData({ ...formData, sectionType: "PREREQUISITE", sectionIcon: "serie-de-quete" });
                                else if (v === "succes") setFormData({ ...formData, sectionType: "RESOURCE_CHAIN", sectionIcon: "icone-succes" });
                                else setFormData({ ...formData, sectionType: "MAIN_CHAIN", sectionIcon: "serie-de-quete" });
                            };
                            return (
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { v: "pre", label: "Prérequis", icon: "/assets/icons/serie-de-quete.png", color: "text-warning" },
                                        { v: "serie", label: "Série de Quête", icon: "/assets/icons/serie-de-quete.png", color: "text-info" },
                                        { v: "succes", label: "Succès", icon: "/assets/icons/icone-succes.png", color: "text-success" },
                                    ].map((opt) => (
                                        <button key={opt.v} type="button" onClick={() => setNature(opt.v)}
                                            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${nature === opt.v ? "border-info/60 bg-info/15" : "border-border bg-black/40 hover:border-border-strong"}`}>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={opt.icon} alt={opt.label} className="w-8 h-8 object-contain" />
                                            <span className={`text-caption font-black uppercase tracking-wider ${nature === opt.v ? "text-foreground" : "text-muted-foreground"}`}>{opt.label}</span>
                                        </button>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>
                    <div className="space-y-2"><label className="text-caption font-black uppercase tracking-widest text-muted-foreground">Titre</label><Input value={formData.sectionName} onChange={e => setFormData({...formData, sectionName: e.target.value})} className="bg-muted/40 border-border h-11 rounded-xl" /></div>
                    <div className="flex justify-between items-center pt-8 border-t border-border mt-8">
                        {chain?.id ? <Button type="button" variant="ghost" onClick={handleDelete} className="text-danger hover:bg-danger/10 rounded-xl"><Trash2 className="w-4 h-4" /></Button> : <div />}
                        <div className="flex gap-3 ml-auto">
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl text-muted-foreground hover:text-foreground">Annuler</Button>
                            <Button type="submit" disabled={loading} className="bg-info hover:bg-info text-info-foreground font-black italic text-caption uppercase tracking-widest rounded-xl px-8">{loading ? "..." : "Valider"}</Button>
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
        localImageUrl: "",
        dungeons: [] as any[],
        weight: 1
    });
    const [prerequisites, setPrerequisites] = useState<any[]>([]);
    const [siblingEntries, setSiblingEntries] = useState<any[]>([]);
    // #146 : prérequis préparés en mode CRÉATION (l'étape n'existe pas encore en base) —
    // les liens sont appliqués à la sauvegarde, une fois l'entrée créée.
    const [pendingPrereqIds, setPendingPrereqIds] = useState<string[]>([]);
    const [loadingPrereqs, setLoadingPrereqs] = useState(false);
    const [prereqSearch, setPrereqSearch] = useState("");
    const [loading, setLoading] = useState(false);
    // Libellé de zone pour le combobox (valeur existante hors résultats game-data)
    const [zoneLabel, setZoneLabel] = useState("");

    // Position GPS input state
    const [positionsInput, setPositionsInput] = useState("");

    // #148 — Sélecteur multi-donjons (même pattern que Rush Sylvestre admin)
    const [dungeonQuery, setDungeonQuery] = useState("");
    const [dungeonResults, setDungeonResults] = useState<any[]>([]);

    // #146 : prérequis dispo aussi en CRÉATION (une entrée avec chainId suffit).
    // En édition, on charge les liens existants ; en création, on charge les candidats du même Dofus.
    useEffect(() => {
        setPrerequisites([]);
        setSiblingEntries([]);
        setPendingPrereqIds([]);
        if (!open || !entry?.chainId) return;
        setLoadingPrereqs(true);
        (async () => {
            const mod = await import("@/server/actions/dofus-quest-admin-actions");
            const siblingRes = await mod.getSiblingQuestEntries(entry.chainId, entry?.id);
            if (siblingRes.success && siblingRes.data) setSiblingEntries(siblingRes.data);
            if (entry?.id) {
                const prereqRes = await mod.getQuestPrerequisites(entry.id);
                if (prereqRes.success && prereqRes.data) setPrerequisites(prereqRes.data.from.map((p: any) => p.fromQuest));
            }
            setLoadingPrereqs(false);
        })().catch(() => setLoadingPrereqs(false));
    }, [entry?.id, entry?.chainId, open]);

    useEffect(() => {
        setPrereqSearch("");
        setPendingPrereqIds([]);
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
                localImageUrl: entry.localImageUrl || "",
                dungeons: Array.isArray(entry.dungeonsRequired) ? entry.dungeonsRequired : [],
                weight: entry.weight ?? 1
            });
            setZoneLabel(entry.zone || "");
        } else {
            setFormData({
                chainId: "", name: "", zone: "", questType: "QUEST", stepOrder: 0,
                isOptional: false, isLast: false, isDungeon: false,
                level: "", npcName: "", npcSubArea: "",
                notes: "", externalRef: "",
                positions: [], dofusdbUrl: "", dofuspourlesnoobsUrl: "",
                localImageUrl: "", dungeons: [],
                weight: 1
            });
            setZoneLabel("");
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
            // CodeQL High — ne JAMAIS persister une URL d'image non allowlistée.
            localImageUrl: isSafeImageUrl(formData.localImageUrl) ? String(formData.localImageUrl).trim() : null,
            dungeonsRequired: formData.dungeons,
        } as any);
        if (res.success) {
            // #146 : en création, on lie les prérequis préparés une fois l'étape créée en base.
            const newEntryId = (res.data as any)?.id;
            if (!entry?.id && pendingPrereqIds.length > 0 && newEntryId) {
                const mod = await import("@/server/actions/dofus-quest-admin-actions");
                let linked = 0;
                for (const pid of pendingPrereqIds) {
                    const linkRes = await mod.addQuestPrerequisite(pid, newEntryId);
                    if (linkRes.success) linked++;
                }
                toast.success(linked === pendingPrereqIds.length
                    ? `Étape enregistrée · ${linked} prérequis liés`
                    : `Étape enregistrée · ${linked}/${pendingPrereqIds.length} prérequis liés`);
            } else {
                toast.success("Étape enregistrée");
            }
            onOpenChange(false); onSuccess();
        }
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

    // #148 — Sélecteur multi-donjons (pattern Rush Sylvestre admin)
    const handleDungeonSearch = async (q: string) => {
        setDungeonQuery(q);
        if (q.length < 2) { setDungeonResults([]); return; }
        const res = await searchDungeonsLocal(q);
        if (res.success) setDungeonResults(res.data as any[]);
    };

    const addDungeon = (d: any) => {
        if (!formData.dungeons.some((sd: any) => sd.id === d.id)) {
            setFormData((prev: any) => ({ ...prev, dungeons: [...prev.dungeons, d] }));
        }
        setDungeonQuery(""); setDungeonResults([]);
    };

    const removeDungeon = (id: string) => {
        setFormData((prev: any) => ({ ...prev, dungeons: prev.dungeons.filter((d: any) => d.id !== id) }));
    };

    // #148 — Image de la quête : localImageUrl prioritaire, sinon tentative image DofusDB (id), sinon icône livre.
    // CodeQL High — URL allowlistée (http(s)/relatif) avant usage dans <img src> (fail-closed).
    const questImageUrl = safeImageUrl(
        (formData.localImageUrl || "").trim()
            || (formData.dofusdbId ? `https://static.ankama.com/dofus/www/game/quests/${formData.dofusdbId}.png` : "")
    );

    const copyPosition = (x: number, y: number) => {
        navigator.clipboard?.writeText(`/travel ${x},${y}`).then(() => toast.success(`Copié : /travel ${x},${y}`)).catch(() => {});
    };

    // #146 — zones siphonnées depuis dofusdb stockées en game-data local → pas d'écriture manuelle.
    // #148 — + zones détectées à la volée depuis l'API DofusDB (sous-zones + régions).
    const zoneFetcher = useCallback(async (query: string) => {
        const res = await searchZonesDetected(query);
        if (res.success && res.data) {
            return res.data.map((z: any) => ({
                value: z.name,
                label: z.name,
                subLabel: z.level ? `Niv. ${z.level}` : (z.source === "dofusdb" ? "DofusDB" : undefined),
            }));
        }
        return [];
    }, []);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-background border-border text-foreground max-w-3xl rounded-3xl overflow-hidden p-0">
                <div className="p-6 border-b border-border bg-surface/30">
                    <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">
                        {entry?.id ? "✏️ Paramètres de l'étape" : "➕ Nouvelle Étape"}
                    </DialogTitle>
                </div>
                <div className="max-h-[70vh] overflow-y-auto custom-scrollbar p-6">
                    <div className="space-y-6">
                        {/* Core info row */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1 md:col-span-2">
                                <label className="text-caption font-black uppercase tracking-widest text-muted-foreground">Nom</label>
                                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-black/40 border-border h-11 rounded-xl text-base font-bold" placeholder="La Vengeance du Bouftou" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-caption font-black uppercase tracking-widest text-muted-foreground">Niveau recommandé</label>
                                <Input type="number" value={formData.level} onChange={e => setFormData({...formData, level: e.target.value})} className="bg-black/40 border-border h-11 rounded-xl text-center font-mono" placeholder="120" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <label className="text-caption font-black uppercase tracking-widest text-muted-foreground">Zone</label>
                                {/* #146 : sélecteur zones game-data (siphon dofusdb) */}
                                <AsyncCombobox
                                    value={formData.zone}
                                    initialLabel={zoneLabel}
                                    onSelect={(val) => { setFormData((prev: any) => ({ ...prev, zone: val })); setZoneLabel(val); }}
                                    fetcher={zoneFetcher}
                                    placeholder="Choisir une zone (game-data)..."
                                    searchPlaceholder="Rechercher une zone..."
                                    emptyText="Aucune zone en game-data"
                                    className="bg-black/40 border-border h-11 rounded-xl"
                                />
                            </div>
                            {/* #148 — Image de la quête grossie (rendu auto à la place de l'icône livre) */}
                            <div className="space-y-1 md:col-span-2">
                                <label className="text-caption font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><ImageIcon className="w-3 h-3 text-warning" /> Image de la quête</label>
                                <div className="flex items-center gap-3">
                                    <div className="w-16 h-16 rounded-xl bg-black/40 border border-border overflow-hidden flex items-center justify-center shrink-0">
                                        {questImageUrl ? (
                                            /* eslint-disable-next-line @next/next/no-img-element */
                                            <img src={questImageUrl} alt="Aperçu de la quête" className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                        ) : (
                                            /* eslint-disable-next-line @next/next/no-img-element */
                                            <img src="/assets/icons/icone-quete.png" alt="Icône quête" className="w-8 h-8 object-contain opacity-70" />
                                        )}
                                    </div>
                                    <Input value={formData.localImageUrl || ""} onChange={e => setFormData({...formData, localImageUrl: e.target.value})} className="bg-black/40 border-border h-11 rounded-xl text-xs font-mono flex-1" placeholder="https://… (image du livre de la quête)" />
                                </div>
                            </div>
                        </div>
                        {/* #148 — Donjons liés (sélecteur multi-donjons, pattern Rush Sylvestre) */}
                        <div className="space-y-2">
                            <label className="text-caption font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2"><Sword className="w-3 h-3" /> Donjons liés <span className="text-muted-foreground font-normal normal-case tracking-normal">(liaison metamob affichée côté membres)</span></label>
                            {formData.dungeons.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {formData.dungeons.map((d: any) => (
                                        <span key={d.id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-caption font-bold">
                                            {d.imageUrl ? (
                                                /* eslint-disable-next-line @next/next/no-img-element */
                                                <img src={d.imageUrl} alt="" className="w-4 h-4 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                            ) : <Skull className="w-3 h-3" />}
                                            {d.name}
                                            <button type="button" onClick={() => removeDungeon(d.id)} className="text-indigo-300/50 hover:text-danger"><Trash2 className="w-2.5 h-2.5" /></button>
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div className="flex gap-2 flex-wrap">
                                <Input value={dungeonQuery} onChange={e => handleDungeonSearch(e.target.value)} placeholder="Ajouter un donjon…" className="bg-black/40 border-indigo-500/20 h-9 rounded-xl text-xs flex-1 min-w-[180px]" />
                                {dungeonResults.length > 0 && (
                                    <div className="w-full space-y-0.5">
                                        {dungeonResults.map((d: any) => (
                                            <button key={d.id} type="button" onClick={() => addDungeon(d)}
                                                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-indigo-500/10 text-left transition-all text-caption text-muted-foreground hover:text-indigo-300 font-medium">
                                                {d.imageUrl ? (
                                                    /* eslint-disable-next-line @next/next/no-img-element */
                                                    <img src={d.imageUrl} alt="" className="w-4 h-4 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                                ) : <Skull className="w-3 h-3 shrink-0" />}
                                                <span className="truncate">{d.name}</span>
                                                <span className="text-muted-foreground shrink-0 ml-auto">{d.level ? `Niv. ${d.level}` : ""}</span>
                                                <Plus className="w-2.5 h-2.5 shrink-0" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* Positions GPS (façon Rush Sylvestre) */}
                        <div className="space-y-2">
                            <label className="text-caption font-black uppercase tracking-widest text-success flex items-center gap-2"><MapPin className="w-3 h-3" /> Positions GPS <span className="text-muted-foreground font-normal normal-case tracking-normal">(ex: -2, 0 ; 10, -22)</span></label>
                            {formData.positions.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {formData.positions.map((p: any, idx: number) => (
                                        <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-success/10 border border-success/20 text-success text-caption font-bold font-mono">
                                            {p.x}, {p.y}
                                            <button type="button" onClick={() => copyPosition(p.x, p.y)} className="text-success/50 hover:text-success" title="Copier /travel X,Y"><Copy className="w-2.5 h-2.5" /></button>
                                            <button type="button" onClick={() => removePosition(idx)} className="text-success/50 hover:text-danger"><Trash2 className="w-2.5 h-2.5" /></button>
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div className="flex gap-2">
                                <Input value={positionsInput} onChange={e => setPositionsInput(e.target.value)} placeholder="10, -22" className="bg-black/40 border-success/20 h-9 rounded-xl text-xs font-mono flex-1" onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addPositionFromInput())} />
                                <button type="button" onClick={addPositionFromInput} className="h-9 px-3 rounded-xl bg-success/10 border border-success/20 text-success hover:bg-success/20 text-caption font-black uppercase tracking-wider shrink-0">📍 Ajouter</button>
                            </div>
                        </div>

                        {/* Liens DofusDB / DofusNoobs + Notes */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-caption font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><ExternalLink className="w-3 h-3 text-sky-400" /> URL DofusDB</label>
                                <Input value={formData.dofusdbUrl || ""} onChange={e => setFormData({...formData, dofusdbUrl: e.target.value})} className="bg-sky-500/10 border-sky-500/20 h-11 rounded-xl text-xs" placeholder="https://dofusdb.fr/fr/database/quest/..." />
                            </div>
                            <div className="space-y-1">
                                <label className="text-caption font-black uppercase tracking-widest text-info flex items-center gap-2"><BookOpen className="w-3 h-3" /> URL DofusNoobs</label>
                                <Input value={formData.dofuspourlesnoobsUrl || ""} onChange={e => setFormData({...formData, dofuspourlesnoobsUrl: e.target.value})} className="bg-info/10 border-info/20 h-11 rounded-xl text-xs" placeholder="https://www.dofuspourlesnoobs.com/..." />
                            </div>
                            <div className="space-y-1 md:col-span-2">
                                <label className="text-caption font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Info className="w-3 h-3" /> Notes</label>
                                <textarea value={formData.notes || ""} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full h-20 bg-muted/40 border border-border rounded-xl text-xs p-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-info/50 resize-none" placeholder="Infos complémentaires..." />
                            </div>
                        </div>

                        {/* Prérequis section (#146) : dispo aussi en CRÉATION (chainId présent) */}
                        {entry?.chainId && (
                            <div className="border-t border-border pt-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-caption font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><span>🔗</span> PRÉREQUIS</h4>
                                    <span className="text-caption text-muted-foreground font-bold">
                                        {prerequisites.length} lié{prerequisites.length > 1 ? "s" : ""}
                                        {pendingPrereqIds.length > 0 && <span className="text-amber-500"> · +{pendingPrereqIds.length} en attente</span>}
                                    </span>
                                </div>
                                {!entry?.id && (
                                    <p className="text-caption text-amber-500/90 italic mb-2">💡 Les prérequis sélectionnés seront liés à la sauvegarde de l'étape.</p>
                                )}
                                {loadingPrereqs ? <div className="text-caption text-muted-foreground italic py-2">Chargement...</div> : prerequisites.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                        {prerequisites.map((p: any) => (
                                            <div key={p.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-info/10 border border-info/20 text-info text-caption font-bold">
                                                <span className="truncate max-w-[120px]">{p.name}</span>
                                                <button onClick={async () => {
                                                    if (!entry?.id) {
                                                        // Création : simple retrait de la préparation locale.
                                                        setPrerequisites(prev => prev.filter((x: any) => x.id !== p.id));
                                                        setPendingPrereqIds(prev => prev.filter((x: any) => x !== p.id));
                                                        toast.success(`Prérequis "${p.name}" retiré`);
                                                        return;
                                                    }
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
                                                }} className="text-danger/50 hover:text-danger"><Trash2 className="w-2.5 h-2.5" /></button>
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="text-caption text-muted-foreground italic mb-3">Aucun prérequis défini</p>}
                                {siblingEntries.length > 0 && (
                                    <div className="space-y-2">
                                        <input value={prereqSearch} onChange={e => setPrereqSearch(e.target.value)} placeholder="Rechercher une quête comme prérequis..." className="w-full h-9 bg-muted/40 border border-border rounded-xl text-xs px-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-info/50" />
                                        <div className="max-h-[120px] overflow-y-auto custom-scrollbar space-y-0.5">
                                            {siblingEntries.filter((s: any) => !prerequisites.some((p: any) => p.id === s.id) && s.name.toLowerCase().includes(prereqSearch.toLowerCase())).slice(0, 8).map((s: any) => (
                                                <button key={s.id} onClick={async () => {
                                                    if (!entry?.id) {
                                                        // Création : on prépare le lien, appliqué après la sauvegarde.
                                                        setPrerequisites(prev => [...prev, s]);
                                                        setPendingPrereqIds(prev => [...prev, s.id]);
                                                        toast.success(`Prérequis "${s.name}" préparé`);
                                                        return;
                                                    }
                                                    const { addQuestPrerequisite } = await import("@/server/actions/dofus-quest-admin-actions");
                                                    const res = await addQuestPrerequisite(s.id, entry.id);
                                                    if (res.success) { toast.success(`Prérequis "${s.name}" ajouté`); setPrerequisites(prev => [...prev, s]); }
                                                    else toast.error(res.error || "Erreur");
                                                }} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-info/10 text-left transition-all text-caption text-muted-foreground hover:text-info font-medium">
                                                    <Plus className="w-2.5 h-2.5 shrink-0" />
                                                    <span className="truncate">{s.name}</span>
                                                    <span className="text-muted-foreground shrink-0 ml-auto">{s.chain?.sectionName}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex justify-between items-center p-6 border-t border-border bg-surface/30">
                    {entry?.id ? <Button type="button" variant="ghost" onClick={handleDelete} className="text-danger hover:text-danger hover:bg-danger/10 rounded-xl"><Trash2 className="w-4 h-4 mr-2" /> Supprimer</Button> : <div/>}
                    <div className="flex gap-3 ml-auto">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl text-muted-foreground hover:text-foreground">Fermer</Button>
                        <Button type="button" onClick={handleSubmit} disabled={loading} className="bg-info hover:bg-info text-info-foreground font-black text-caption uppercase tracking-widest rounded-xl px-8">Sauvegarder</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

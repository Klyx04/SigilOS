"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getDofusItemsForTagging, updateDofusTags, upsertDofusItem, deleteDofusItem } from "@/server/actions/dofus-quest-admin-actions";
import { toast } from "sonner";
import { 
    Crown, 
    Star, 
    Sparkles, 
    GripVertical, 
    ArrowUp, 
    ArrowDown, 
    Loader2, 
    CheckCircle, 
    Check, 
    X, 
    Plus, 
    Tag, 
    Trash2 
} from "lucide-react";

type DofusTag = {
    id: string;
    name: string;
    nameShort: string;
    slug: string;
    imageUrl: string | null;
    localImageUrl: string | null;
    color: string | null;
    isPrimordial: boolean;
    isMeta: boolean;
    isSylvestreReq: boolean;
    displayOrder: number;
    rarity: string;
    filterCategory: string;
};

const TAG_CONFIG = [
    {
        key: "isPrimordial",
        label: "Primordial",
        icon: Crown,
        color: "#fbbf24",
        bg: "bg-amber-500/10",
        border: "border-amber-500/30",
        activeBg: "bg-amber-500/20",
        activeBorder: "border-amber-500",
        textColor: "text-amber-400",
        desc: "Dofus de niveau haut, difficile à obtenir",
    },
    {
        key: "isSylvestreReq",
        label: "Prérequis Sylvestre",
        icon: Star,
        color: "#34d399",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/30",
        activeBg: "bg-emerald-500/20",
        activeBorder: "border-emerald-500",
        textColor: "text-emerald-400",
        desc: "Requis pour obtenir le Dofus Sylvestre",
    },
    {
        key: "isMeta",
        label: "Méta / Objectif final",
        icon: Sparkles,
        color: "#818cf8",
        bg: "bg-indigo-500/10",
        border: "border-indigo-500/30",
        activeBg: "bg-indigo-500/20",
        activeBorder: "border-indigo-500",
        textColor: "text-indigo-400",
        desc: "Dofus final comme le Sylvestre (1 max)",
    },
] as const;

export function DofusTagManager() {
    const [items, setItems] = useState<DofusTag[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const loadData = () => {
        setLoading(true);
        getDofusItemsForTagging().then((res) => {
            if (res.success && res.data) setItems(res.data);
            setLoading(false);
        });
    };

    useEffect(() => {
        loadData();
    }, []);

    const updateItemLocally = (id: string, updates: Partial<DofusTag>) => {
        setItems((prev) => prev.map((i) => i.id === id ? { ...i, ...updates } : i));
    };

    const handleTagToggle = async (item: DofusTag, tagKey: keyof Pick<DofusTag, "isPrimordial" | "isMeta" | "isSylvestreReq">) => {
        const newVal = !item[tagKey];

        // isMeta only 1 at a time
        if (tagKey === "isMeta" && newVal) {
            const existing = items.find((i) => i.isMeta && i.id !== item.id);
            if (existing) {
                toast.warning(`Le tag "Méta" est déjà attribué à : ${existing.name}. Retirez-le d'abord.`);
                return;
            }
        }

        // Optimistic update
        updateItemLocally(item.id, { [tagKey]: newVal });
        setSaving(item.id);

        startTransition(async () => {
            const res = await updateDofusTags(item.id, { [tagKey]: newVal });
            setSaving(null);
            if (!res.success) {
                toast.error(res.error || "Erreur");
                // Rollback
                updateItemLocally(item.id, { [tagKey]: !newVal });
            } else {
                toast.success(`Tag mis à jour pour "${item.nameShort}"`);
            }
        });
    };

    const handleFieldUpdate = async (item: DofusTag, field: "rarity" | "filterCategory", value: string) => {
        if (item[field] === value) return;

        updateItemLocally(item.id, { [field]: value });
        setSaving(item.id);

        startTransition(async () => {
            const res = await updateDofusTags(item.id, { [field]: value });
            setSaving(null);
            if (!res.success) {
                toast.error(res.error || "Erreur");
                // Rollback
                updateItemLocally(item.id, { [field]: item[field] });
            }
        });
    };

    const handleOrderChange = async (item: DofusTag, direction: "up" | "down") => {
        const idx = items.findIndex((i) => i.id === item.id);
        const swapIdx = direction === "up" ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= items.length) return;

        const swapItem = items[swapIdx];
        const newItems = [...items];
        [newItems[idx], newItems[swapIdx]] = [newItems[swapIdx], newItems[idx]];
        
        const newOrder1 = swapItem.displayOrder;
        const newOrder2 = item.displayOrder;
        newItems[idx] = { ...newItems[idx], displayOrder: newOrder2 };
        newItems[swapIdx] = { ...newItems[swapIdx], displayOrder: newOrder1 };
        setItems(newItems);

        setSaving(item.id);
        await Promise.all([
            updateDofusTags(item.id, { displayOrder: newOrder1 }),
            updateDofusTags(swapItem.id, { displayOrder: newOrder2 }),
        ]);
        setSaving(null);
        toast.success("Ordre mis à jour");
    };

    const [showCreate, setShowCreate] = useState(false);
    const [newItem, setNewItem] = useState({ name: "", slug: "", rarity: "Nouveau", filterCategory: "Autres" });

    // Derive unique tags for suggestions
    const uniqueRarities = useMemo(() => Array.from(new Set(items.map(i => i.rarity).filter(Boolean))), [items]);
    const uniqueCategories = useMemo(() => Array.from(new Set(items.map(i => i.filterCategory).filter(Boolean))), [items]);

    const handleCreate = async () => {
        setLoading(true);
        const res = await upsertDofusItem(null, {
            name: newItem.name,
            nameShort: newItem.name,
            slug: newItem.slug.toLowerCase().replace(/\s+/g, "-"),
            rarity: newItem.rarity,
            filterCategory: newItem.filterCategory,
            isPrimordial: false,
            levelRecommended: 200,
            displayOrder: items.length + 1
        } as any);

        if (res.success) {
            toast.success("Dofus créé !");
            setShowCreate(false);
            setNewItem({ name: "", slug: "", rarity: "Nouveau", filterCategory: "Autres" });
            loadData();
        } else {
            toast.error(res.error || "Erreur lors de la création");
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Supprimer ce Dofus ?")) return;
        setLoading(true);
        const res = await deleteDofusItem(id);
        if (res.success) {
            toast.success("Supprimé");
            loadData();
        } else {
            toast.error(res.error || "Erreur");
            setLoading(false);
        }
    };

    if (loading && items.length === 0) {
        return (
            <div className="flex items-center justify-center py-20 gap-3 text-zinc-500">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm font-bold uppercase tracking-widest">Chargement…</span>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header & Tag Library */}
            <div className="flex flex-col gap-6 bg-zinc-950/40 p-6 rounded-3xl border border-white/5 backdrop-blur-md">
                <div className="flex items-center justify-between">
                   <div>
                        <h3 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                            <Tag className="w-5 h-5 text-indigo-400" />
                            Bibliothèque & Création
                        </h3>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Gérez vos tags et créez des coquilles vides</p>
                   </div>
                   <button 
                        onClick={() => setShowCreate(!showCreate)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${showCreate ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/20'}`}
                   >
                        {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        {showCreate ? "Annuler" : "Ajouter une Coquille Vide"}
                   </button>
                </div>

                <AnimatePresence>
                    {showCreate && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden border-t border-white/5 pt-6"
                        >
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase text-zinc-500 tracking-widest ml-2">Nom du Dofus</label>
                                    <input 
                                        type="text" 
                                        placeholder="Ex: Forgelave"
                                        value={newItem.name}
                                        onChange={e => setNewItem({...newItem, name: e.target.value})}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase text-zinc-500 tracking-widest ml-2">Slug (URL)</label>
                                    <input 
                                        type="text" 
                                        placeholder="ex: forgelave"
                                        value={newItem.slug}
                                        onChange={e => setNewItem({...newItem, slug: e.target.value})}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase text-zinc-500 tracking-widest ml-2">Rareté</label>
                                    <input 
                                        type="text" 
                                        list="rarities"
                                        placeholder="Primordial, Rare..."
                                        value={newItem.rarity}
                                        onChange={e => setNewItem({...newItem, rarity: e.target.value})}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                                    />
                                </div>
                                <div className="flex items-end pb-0.5">
                                    <button 
                                        onClick={handleCreate}
                                        disabled={!newItem.name || !newItem.slug}
                                        className="w-full h-10 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:hover:bg-emerald-600 text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-all shadow-lg shadow-emerald-950"
                                    >
                                        Confirmer la Création
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-3">
                        <span className="text-[9px] font-black uppercase text-zinc-600 tracking-widest">Vos Raretés :</span>
                        <div className="flex flex-wrap gap-2">
                            {uniqueRarities.map(r => (
                                <span key={r} className="px-2 py-0.5 bg-zinc-800 border border-white/5 rounded text-[9px] font-bold text-zinc-400 uppercase">{r}</span>
                            ))}
                        </div>
                    </div>
                    <div className="w-px h-4 bg-white/10" />
                    <div className="flex items-center gap-3">
                        <span className="text-[9px] font-black uppercase text-zinc-600 tracking-widest">Vos Catégories :</span>
                        <div className="flex flex-wrap gap-2">
                            {uniqueCategories.map(c => (
                                <span key={c} className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded text-[9px] font-bold text-indigo-400 uppercase">{c}</span>
                            ))}
                        </div>
                    </div>
                </div>

                <datalist id="rarities">
                    {uniqueRarities.map(r => <option key={r} value={r} />)}
                </datalist>
                <datalist id="categories">
                    {uniqueCategories.map(c => <option key={c} value={c} />)}
                </datalist>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 pb-4 border-b border-white/5">
                {TAG_CONFIG.map((tag) => {
                    const Icon = tag.icon;
                    return (
                        <div
                            key={tag.key}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${tag.bg} ${tag.border}`}
                        >
                            <Icon className={`w-3.5 h-3.5 ${tag.textColor}`} />
                            <span className={`text-xs font-black uppercase tracking-widest ${tag.textColor}`}>{tag.label}</span>
                        </div>
                    );
                })}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-white/5 border-white/10">
                    <GripVertical className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="text-xs font-black uppercase tracking-widest text-zinc-500">Ordre d'affichage</span>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-2xl border border-white/5">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/[0.02]">
                                <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Dofus</th>
                                <th className="text-center px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Rareté / Tag Principal</th>
                                {TAG_CONFIG.map((tag) => (
                                    <th key={tag.key} className="text-center px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 whitespace-nowrap">
                                        {tag.label}
                                    </th>
                                ))}
                                <th className="text-center px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 whitespace-nowrap">Catégorie Filtre</th>
                                <th className="text-center px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Ordre</th>
                                <th className="text-center px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.03]">
                            {items.map((item, idx) => {
                                const isSaving = saving === item.id;
                                const img = item.localImageUrl || item.imageUrl;

                                return (
                                    <tr
                                        key={item.id}
                                        className="group hover:bg-white/[0.02] transition-colors"
                                    >
                                        {/* Name */}
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center border border-white/10 bg-black/40">
                                                    {img ? (
                                                        <img src={img} alt={item.nameShort} className="w-7 h-7 object-contain" />
                                                    ) : (
                                                        <div className="w-5 h-5 rounded-full" style={{ background: item.color || "#6366f1" }} />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-white italic uppercase tracking-tight">{item.nameShort}</p>
                                                    <p className="text-[10px] text-zinc-600 font-medium">{item.slug}</p>
                                                </div>
                                                {isSaving && <Loader2 className="w-3.5 h-3.5 text-zinc-500 animate-spin ml-1" />}
                                            </div>
                                        </td>

                                        {/* Rarity Input */}
                                        <td className="px-4 py-3">
                                            <input
                                                type="text"
                                                defaultValue={item.rarity}
                                                onBlur={(e) => handleFieldUpdate(item, "rarity", e.target.value)}
                                                className="w-full max-w-[120px] mx-auto block bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-widest text-white text-center focus:outline-none focus:border-white/30"
                                            />
                                        </td>

                                        {/* Tag toggles */}
                                        {TAG_CONFIG.map((tag) => {
                                            const Icon = tag.icon;
                                            const isActive = !!item[tag.key as keyof DofusTag];
                                            return (
                                                <td key={tag.key} className="text-center px-4 py-3">
                                                    <button
                                                        onClick={() => handleTagToggle(item, tag.key as any)}
                                                        disabled={isSaving}
                                                        title={tag.desc}
                                                        className={`
                                                            w-9 h-9 rounded-xl mx-auto flex items-center justify-center border transition-all duration-200
                                                            ${isActive
                                                                ? `${tag.activeBg} ${tag.activeBorder} ${tag.textColor} shadow-[0_0_12px_rgba(0,0,0,0.3)]`
                                                                : "bg-white/[0.03] border-white/10 text-zinc-700 hover:text-zinc-400 hover:border-white/20"
                                                            }
                                                            disabled:opacity-40 cursor-pointer
                                                        `}
                                                    >
                                                        <Icon className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            );
                                        })}

                                        {/* Filter Category Input */}
                                        <td className="px-4 py-3">
                                            <input
                                                type="text"
                                                defaultValue={item.filterCategory}
                                                onBlur={(e) => handleFieldUpdate(item, "filterCategory", e.target.value)}
                                                className="w-full max-w-[100px] mx-auto block bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center focus:outline-none focus:border-white/30"
                                            />
                                        </td>

                                        {/* Order */}
                                        <td className="text-center px-4 py-3">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => handleOrderChange(item, "up")}
                                                    disabled={idx === 0 || isSaving}
                                                    className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/[0.03] border border-white/10 text-zinc-600 hover:text-white hover:border-white/30 transition-all disabled:opacity-20 cursor-pointer"
                                                >
                                                    <ArrowUp className="w-3.5 h-3.5" />
                                                </button>
                                                <span className="text-xs font-black text-zinc-600 w-6 text-center tabular-nums">{item.displayOrder}</span>
                                                <button
                                                    onClick={() => handleOrderChange(item, "down")}
                                                    disabled={idx === items.length - 1 || isSaving}
                                                    className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/[0.03] border border-white/10 text-zinc-600 hover:text-white hover:border-white/30 transition-all disabled:opacity-20 cursor-pointer"
                                                >
                                                    <ArrowDown className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>

                                        {/* Actions */}
                                        <td className="px-4 py-3 text-center">
                                            <button 
                                                onClick={() => handleDelete(item.id)}
                                                className="p-2 text-zinc-700 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

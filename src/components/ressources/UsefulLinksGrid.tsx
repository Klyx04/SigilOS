"use client";

import { useEffect, useState, useTransition } from "react";
import { ExternalLink, Plus, Edit2, Trash2, Save, X, GripVertical, Settings2 } from "lucide-react";
import {
    getResourceCategories,
    upsertResourceCategory,
    deleteResourceCategory,
    upsertResourceLink,
    deleteResourceLink
} from "@/server/actions/resources-actions";
import { cn } from "@/lib/utils";

interface ResourceLink {
    id: string;
    title: string;
    description: string | null;
    url: string;
    emoji: string | null;
    isOfficial: boolean;
    order: number;
}

interface ResourceCategory {
    id: string;
    label: string;
    color: string;
    order: number;
    links: ResourceLink[];
}

export function UsefulLinksGrid({ guildId, isSuperAdmin }: { guildId: string, isSuperAdmin: boolean }) {
    const [categories, setCategories] = useState<ResourceCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    // UI States
    const [editingCatId, setEditingCatId] = useState<string | null>(null);
    const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
    const [addingToCatId, setAddingToCatId] = useState<string | null>(null);

    useEffect(() => {
        refreshData();
    }, [guildId]);

    async function refreshData() {
        setLoading(true);
        const data = await getResourceCategories(guildId);
        setCategories(data as any);
        setLoading(false);
    }

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-h-[400px]">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-64 rounded-2xl bg-white/[0.02] border border-white/5 animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {isSuperAdmin && (
                <div className="flex justify-end pr-2">
                    <button
                        onClick={() => setEditingCatId("new")}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                    >
                        <Plus className="h-3.5 w-3.5" /> Nouvelle Catégorie
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {categories.map((cat) => (
                    <div
                        key={cat.id}
                        className="relative overflow-hidden rounded-2xl p-5 space-y-3 group"
                        style={{
                            background: "linear-gradient(135deg, rgba(19,23,26,0.8), rgba(14,17,16,0.6))",
                            border: `1px solid ${cat.color}18`,
                            backdropFilter: "blur(20px)",
                        }}
                    >
                        {/* Ambient glow */}
                        <div
                            className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-5 group-hover:opacity-10 transition-opacity duration-700 pointer-events-none"
                            style={{ background: cat.color, transform: "translate(30%, -30%)" }}
                        />

                        {/* Category header */}
                        <div
                            className="flex items-center justify-between pb-3"
                            style={{ borderBottom: `1px solid ${cat.color}12` }}
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-1.5 h-5 rounded-full flex-shrink-0"
                                    style={{ background: cat.color, boxShadow: `0 0 8px ${cat.color}80` }}
                                />
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                                    {cat.label}
                                </h3>
                            </div>

                            {isSuperAdmin && (
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => setAddingToCatId(cat.id)}
                                        className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-white transition-colors"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        onClick={() => setEditingCatId(cat.id)}
                                        className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-white transition-colors"
                                    >
                                        <Edit2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Links - Scrollable area */}
                        <div className="space-y-1 relative max-h-[320px] overflow-y-auto pr-2 custom-scrollbar transition-all scroll-smooth">
                            <style jsx>{`
                                .custom-scrollbar::-webkit-scrollbar {
                                    width: 4px;
                                }
                                .custom-scrollbar::-webkit-scrollbar-track {
                                    background: transparent;
                                }
                                .custom-scrollbar::-webkit-scrollbar-thumb {
                                    background: rgba(255, 255, 255, 0.1);
                                    border-radius: 10px;
                                }
                                .custom-scrollbar:hover::-webkit-scrollbar-thumb {
                                    background: ${cat.color}80;
                                }
                            `}</style>
                            {cat.links.length === 0 && (
                                <div className="py-10 text-center text-zinc-600 text-[10px] font-medium tracking-widest uppercase italic">
                                    Aucun lien pour le moment
                                </div>
                            )}
                            {cat.links.map((link) => (
                                <div key={link.id} className="relative group/link-container">
                                    <a
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group/link flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200"
                                        style={{
                                            border: "1px solid transparent",
                                        }}
                                        onMouseEnter={(e) => {
                                            (e.currentTarget as HTMLElement).style.background = `${cat.color}08`;
                                            (e.currentTarget as HTMLElement).style.borderColor = `${cat.color}18`;
                                        }}
                                        onMouseLeave={(e) => {
                                            (e.currentTarget as HTMLElement).style.background = "transparent";
                                            (e.currentTarget as HTMLElement).style.borderColor = "transparent";
                                        }}
                                    >
                                        <div
                                            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg transition-transform duration-200 group-hover/link:scale-110 overflow-hidden relative"
                                            style={{ background: `${cat.color}10`, border: `1px solid ${cat.color}20` }}
                                        >
                                            {(() => {
                                                try {
                                                    const hostname = new URL(link.url).hostname;
                                                    return (
                                                        <img
                                                            src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=128`}
                                                            alt={link.title}
                                                            className="w-5 h-5 object-contain"
                                                            loading="lazy"
                                                        />
                                                    );
                                                } catch {
                                                    return <span>{link.emoji || "🔗"}</span>;
                                                }
                                            })()}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-white group-hover/link:text-white/90 transition-colors truncate">
                                                    {link.title}
                                                </span>
                                                {link.isOfficial && (
                                                    <span
                                                        className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full flex-shrink-0"
                                                        style={{
                                                            background: "rgba(239,68,68,0.12)",
                                                            color: "#ef4444",
                                                            border: "1px solid rgba(239,68,68,0.2)",
                                                        }}
                                                    >
                                                        Officiel
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-zinc-500 leading-tight truncate">{link.description}</p>
                                        </div>

                                        <ExternalLink
                                            className="h-3.5 w-3.5 flex-shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity duration-200"
                                            style={{ color: cat.color }}
                                        />
                                    </a>

                                    {isSuperAdmin && (
                                        <div className="absolute top-1/2 -translate-y-1/2 right-10 flex gap-1 opacity-0 group-hover/link-container:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => setEditingLinkId(link.id)}
                                                className="p-1 px-2 bg-black/60 hover:bg-black/80 text-zinc-400 hover:text-white rounded border border-white/5 text-[10px] transition-colors"
                                            >
                                                Edit
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal de Category Edit */}
            {(editingCatId) && (
                <CategoryModal
                    guildId={guildId}
                    category={editingCatId === "new" ? null : categories.find(c => c.id === editingCatId)}
                    onClose={() => setEditingCatId(null)}
                    onSuccess={() => { setEditingCatId(null); refreshData(); }}
                />
            )}

            {/* Modal de Link Edit/Add */}
            {(editingLinkId || addingToCatId) && (
                <LinkModal
                    guildId={guildId}
                    categoryId={addingToCatId || categories.find(c => c.links.some(l => l.id === editingLinkId))?.id || ""}
                    link={editingLinkId ? categories.flatMap(c => c.links).find(l => l.id === editingLinkId) : null}
                    onClose={() => { setEditingLinkId(null); setAddingToCatId(null); }}
                    onSuccess={() => { setEditingLinkId(null); setAddingToCatId(null); refreshData(); }}
                />
            )}
        </div>
    );
}

function CategoryModal({ guildId, category, onClose, onSuccess }: any) {
    const [label, setLabel] = useState(category?.label || "");
    const [color, setColor] = useState(category?.color || "#10b981");
    const [order, setOrder] = useState(category?.order || 0);
    const [isPending, startTransition] = useTransition();

    const handleSave = () => {
        startTransition(async () => {
            await upsertResourceCategory(guildId, { id: category?.id, label, color, order });
            onSuccess();
        });
    };

    const handleDelete = () => {
        if (!confirm("Supprimer cette catégorie et tous ses liens ?")) return;
        startTransition(async () => {
            await deleteResourceCategory(category.id, guildId);
            onSuccess();
        });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="w-full max-w-md bg-[#0f1113] border border-white/10 rounded-2xl p-6 shadow-2xl relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors">
                    <X className="h-5 w-5" />
                </button>

                <h2 className="text-xl font-black uppercase tracking-widest text-white mb-6">
                    {category ? "Editer Catégorie" : "Nouvelle Catégorie"}
                </h2>

                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 mb-1.5 block">Nom</label>
                        <input value={label} onChange={e => setLabel(e.target.value)} type="text" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-colors" />
                    </div>
                    <div>
                        <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 mb-1.5 block">Couleur (Hex)</label>
                        <div className="flex gap-3">
                            <input value={color} onChange={e => setColor(e.target.value)} type="text" className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-colors" />
                            <div className="w-12 h-12 rounded-xl border border-white/10" style={{ background: color }} />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 mb-1.5 block">Ordre</label>
                        <input value={order} onChange={e => setOrder(parseInt(e.target.value))} type="number" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-colors" />
                    </div>
                </div>

                <div className="flex items-center gap-3 mt-8">
                    {category && (
                        <button onClick={handleDelete} className="flex items-center justify-center gap-2 p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl transition-all">
                            <Trash2 className="h-5 w-5" />
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={isPending}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-sm font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20"
                    >
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Save className="h-4 w-4" />}
                        {category ? "Enregistrer" : "Créer"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function Loader2({ className }: any) { return <Settings2 className={className} />; } // Generic icon fallback

function LinkModal({ guildId, categoryId, link, onClose, onSuccess }: any) {
    const [title, setTitle] = useState(link?.title || "");
    const [desc, setDesc] = useState(link?.description || "");
    const [url, setUrl] = useState(link?.url || "");
    const [emoji, setEmoji] = useState(link?.emoji || "🔗");
    const [isOfficial, setIsOfficial] = useState(link?.isOfficial || false);
    const [order, setOrder] = useState(link?.order || 0);
    const [isPending, startTransition] = useTransition();

    const handleSave = () => {
        startTransition(async () => {
            await upsertResourceLink(guildId, {
                id: link?.id,
                categoryId,
                title,
                description: desc,
                url,
                emoji,
                isOfficial,
                order
            });
            onSuccess();
        });
    };

    const handleDelete = () => {
        if (!confirm("Supprimer ce lien ?")) return;
        startTransition(async () => {
            await deleteResourceLink(link.id, guildId);
            onSuccess();
        });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="w-full max-w-md bg-[#0f1113] border border-white/10 rounded-2xl p-6 shadow-2xl relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors">
                    <X className="h-5 w-5" />
                </button>

                <h2 className="text-xl font-black uppercase tracking-widest text-white mb-6">
                    {link ? "Editer Lien" : "Ajouter un Lien"}
                </h2>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    <div className="grid grid-cols-4 gap-3">
                        <div className="col-span-1">
                            <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 mb-1.5 block">Emoji (Optionnel)</label>
                            <input value={emoji} onChange={e => setEmoji(e.target.value)} type="text" placeholder="🔗" className="text-center w-full bg-white/5 border border-white/10 rounded-xl px-2 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-colors" />
                        </div>
                        <div className="col-span-3">
                            <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 mb-1.5 block">Titre</label>
                            <input value={title} onChange={e => setTitle(e.target.value)} type="text" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-colors" />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 mb-1.5 block">URL</label>
                        <input value={url} onChange={e => setUrl(e.target.value)} type="text" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-emerald-500/50 transition-colors" />
                    </div>
                    <div>
                        <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 mb-1.5 block">Description</label>
                        <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-emerald-500/50 transition-colors resize-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 mb-1.5 block">Ordre</label>
                            <input value={order} onChange={e => setOrder(parseInt(e.target.value))} type="number" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-colors" />
                        </div>
                        <div className="flex items-center h-full pt-6">
                            <label className="flex items-center gap-3 cursor-pointer group/check">
                                <div className={cn(
                                    "w-6 h-6 rounded border transition-all flex items-center justify-center",
                                    isOfficial ? "bg-red-500 border-red-500" : "bg-white/5 border-white/10"
                                )}>
                                    {isOfficial && <Save className="h-3 w-3 text-white" />}
                                </div>
                                <input type="checkbox" checked={isOfficial} onChange={e => setIsOfficial(e.target.checked)} className="hidden" />
                                <span className="text-[10px] uppercase font-black tracking-widest text-zinc-400 group-hover/check:text-white transition-colors">Officiel ?</span>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 mt-8">
                    {link && (
                        <button onClick={handleDelete} className="flex items-center justify-center gap-2 p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl transition-all">
                            <Trash2 className="h-5 w-5" />
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={isPending}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-sm font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20"
                    >
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Save className="h-4 w-4" />}
                        {link ? "Mettre à jour" : "Ajouter"}
                    </button>
                </div>
            </div>
        </div>
    );
}

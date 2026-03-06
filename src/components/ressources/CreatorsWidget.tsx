"use client";

import { Tv, ExternalLink, Loader2, Plus, Edit2, Trash2, X, Settings2, Youtube, MonitorPlay, Sparkles } from "lucide-react";
import { useEffect, useState, useTransition, useCallback } from "react";
import { getContentCreators, upsertContentCreator, deleteContentCreator } from "@/server/actions/resources-actions";
import { getAggregatedFeed } from "@/server/actions/feed-actions";

interface Creator {
    id?: string;
    name: string;
    role: string;
    youtube?: string | null;
    twitch?: string | null;
    handle?: string | null;
    color: string;
    order: number;
}

export function CreatorsWidget({ guildId, isSuperAdmin }: { guildId: string, isSuperAdmin: boolean }) {
    const [creators, setCreators] = useState<Creator[]>([]);
    const [liveData, setLiveData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    // UI States for Admin
    const [isEditingMode, setIsEditingMode] = useState(false);
    const [editingCreator, setEditingCreator] = useState<Creator | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const load = useCallback(async () => {
        try {
            // 1. Get creators from DB
            const data = await getContentCreators(guildId);
            setCreators(data || []);

            // 2. Get status/feed data
            const res = await getAggregatedFeed(guildId);
            if (res.success && res.data) {
                setLiveData(res.data);
            }
        } catch (e) {
            console.error("Creators Load Error:", e);
        } finally {
            setLoading(false);
        }
    }, [guildId]);

    useEffect(() => {
        load();
    }, [load]);

    const getStatus = (handle?: string | null) => {
        if (!handle || !liveData.length) return "offline";
        const h = handle.toLowerCase().replace('@', '').trim();

        // Filter live items for this handle
        const creatorItems = liveData.filter(d =>
            d.creatorId?.toLowerCase().includes(h)
        );

        if (creatorItems.length === 0) return "offline";

        // Check Twitch Live status
        if (creatorItems.some(i => i.type === "TWITCH")) return "live";

        // Check if recent YouTube video (within 48h)
        const youngest = [...creatorItems].sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime())[0];
        const ageHours = (new Date().getTime() - new Date(youngest.published).getTime()) / (1000 * 60 * 60);
        return ageHours < 48 ? "video" : "offline";
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCreator) return;

        startTransition(async () => {
            const res = await upsertContentCreator(guildId, editingCreator);
            if (res.success) {
                await load();
                setIsModalOpen(false);
                setEditingCreator(null);
            }
        });
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Supprimer ce créateur ?")) return;
        startTransition(async () => {
            const res = await deleteContentCreator(id, guildId);
            if (res.success) {
                await load();
            }
        });
    };

    if (loading) return (
        <div className="w-full h-40 flex flex-col items-center justify-center bg-black/20 rounded-[2.5rem] border border-white/5 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-red-500/50" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 animate-pulse">Chargement du Hub Créateurs...</span>
        </div>
    );

    return (
        <div className="w-full flex flex-col gap-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20 shadow-inner group">
                        <Tv className="h-6 w-6 text-red-400 group-hover:scale-110 transition-transform" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-white tracking-tight">Elite Creators Hub</h3>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">Flux Communautaire SigilOS</span>
                            <div className="h-1 w-1 rounded-full bg-zinc-700" />
                            <span className="text-[10px] text-red-500/60 font-black uppercase tracking-widest">{creators.length} Créateurs</span>
                        </div>
                    </div>
                </div>

                {isSuperAdmin && (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsEditingMode(!isEditingMode)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border transition-all text-[10px] font-black uppercase tracking-widest ${isEditingMode ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-white/5 border-white/10 text-zinc-500 hover:text-white hover:border-white/20'}`}
                        >
                            <Settings2 className="h-4 w-4" /> {isEditingMode ? "Quitter l'édition" : "Gérer les slots"}
                        </button>
                        <button
                            onClick={() => { setEditingCreator({ name: "", role: "", color: "#ef4444", order: creators.length }); setIsModalOpen(true); }}
                            className="flex items-center gap-3 px-6 py-2.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-red-600/20 hover:scale-105 active:scale-95 translate-y-[-1px]"
                        >
                            <Plus className="h-4 w-4" /> Ajouter un slot
                        </button>
                    </div>
                )}
            </div>

            {/* Grid display with scrollable container */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pr-2 max-h-[700px] overflow-y-auto custom-scrollbar pb-6 px-1">
                {creators.length === 0 ? (
                    <div className="col-span-full py-20 text-center border border-dashed border-white/5 rounded-[2rem] bg-white/[0.02]">
                        <p className="text-zinc-600 text-xs font-bold uppercase tracking-widest">Aucun créateur configuré</p>
                    </div>
                ) : creators.map((c) => {
                    const status = getStatus(c.handle ?? undefined);
                    return (
                        <div
                            key={c.id}
                            className="group relative rounded-[2rem] p-6 border transition-all duration-500 hover:shadow-2xl hover:bg-white/[0.02]"
                            style={{
                                background: "rgba(10,10,12,0.4)",
                                borderColor: isEditingMode ? `${c.color}60` : "rgba(255,255,255,0.06)",
                                boxShadow: isEditingMode ? `0 0 20px ${c.color}10` : "none"
                            }}
                        >
                            {/* Admin Controls */}
                            {isEditingMode && (
                                <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
                                    <button
                                        onClick={() => { setEditingCreator(c); setIsModalOpen(true); }}
                                        className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-110"
                                    >
                                        <Edit2 className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        onClick={() => c.id && handleDelete(c.id)}
                                        className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all hover:scale-110"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            )}

                            <div
                                className="absolute top-8 left-0 w-1 h-12 rounded-r-full"
                                style={{ background: c.color }}
                            />

                            <div className="flex items-start gap-5 mb-6">
                                <div
                                    className="h-16 w-16 rounded-[1.25rem] flex items-center justify-center text-xl font-black relative shadow-2xl overflow-hidden group-hover:scale-105 transition-transform duration-500 shrink-0"
                                    style={{ background: `${c.color}15`, color: c.color, border: `1px solid ${c.color}25` }}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
                                    {c.name.substring(0, 2).toUpperCase()}
                                    {status === "live" && (
                                        <div className="absolute top-1 right-1 h-3.5 w-3.5 rounded-full bg-red-500 border-2 border-[#0a0a0c] animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 pt-1">
                                    <div className="text-lg font-black text-white group-hover:text-white/90 transition-colors truncate">
                                        {c.name}
                                    </div>
                                    <div className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mt-1 truncate">{c.role}</div>
                                </div>
                            </div>

                            <div className="h-10 mb-6 flex items-center">
                                {status === "live" ? (
                                    <div className="flex items-center gap-2.5 text-red-500 bg-red-500/10 px-4 py-2 rounded-2xl border border-red-500/20 w-fit">
                                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.25em]">En Direct</span>
                                    </div>
                                ) : status === "video" ? (
                                    <div className="flex items-center gap-3 text-blue-400 bg-blue-500/10 px-4 py-2 rounded-2xl border border-blue-500/20 w-fit animate-[pulse_3s_infinite] shadow-[0_0_20px_rgba(59,130,246,0.15)]">
                                        <div className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.25em]">Nouveau Contenu</span>
                                    </div>
                                ) : (
                                    <div className="text-zinc-600 text-[9px] font-black uppercase tracking-[0.3em] ml-1 opacity-30">Actuellement Offline</div>
                                )}
                            </div>

                            <div className="flex items-center gap-3">
                                {c.youtube && (
                                    <a href={c.youtube} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-[#ef4444] bg-[#ef4444]/10 hover:bg-[#ef4444]/20 border border-[#ef4444]/10 transition-all hover:scale-[1.03] active:scale-[0.98]">
                                        <Youtube className="h-4 w-4" /> YouTube
                                    </a>
                                )}
                                {c.twitch && (
                                    <a href={c.twitch} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-[#a855f7] bg-[#a855f7]/10 hover:bg-[#a855f7]/20 border border-[#a855f7]/10 transition-all hover:scale-[1.03] active:scale-[0.98]">
                                        <MonitorPlay className="h-4 w-4" /> Twitch
                                    </a>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal Admin */}
            {isModalOpen && editingCreator && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
                    <div className="w-full max-w-xl bg-[#0a0a0c] rounded-[3rem] border border-white/10 p-10 shadow-3xl relative animate-in zoom-in-95 duration-200">
                        <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-zinc-500 hover:text-white transition-all">
                            <X className="h-6 w-6" />
                        </button>

                        <div className="flex items-center gap-6 mb-10">
                            <div className="w-16 h-16 rounded-3xl bg-red-500/10 flex items-center justify-center border border-red-500/20 shadow-inner">
                                <Settings2 className="h-8 w-8 text-red-500" />
                            </div>
                            <div>
                                <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Nexus Creator Config</h3>
                                <p className="text-xs text-zinc-500 font-bold uppercase tracking-[0.3em] mt-1">Plateforme Community Hub</p>
                            </div>
                        </div>

                        <form onSubmit={handleSave} className="space-y-6">
                            <div className="grid grid-cols-5 gap-6">
                                <div className="col-span-3 space-y-2">
                                    <label className="text-[11px] font-black uppercase tracking-widest text-zinc-500 ml-2">Nom Public</label>
                                    <input
                                        required
                                        type="text"
                                        value={editingCreator.name}
                                        onChange={e => setEditingCreator({ ...editingCreator, name: e.target.value })}
                                        className="w-full bg-white/[0.03] border border-white/5 rounded-2xl px-5 py-4 text-sm text-white outline-none focus:border-red-500/50"
                                        placeholder="Ex: Huz"
                                    />
                                </div>
                                <div className="col-span-2 space-y-2">
                                    <label className="text-[11px] font-black uppercase tracking-widest text-zinc-500 ml-2">Couleur Signature</label>
                                    <div className="flex gap-3">
                                        <input
                                            type="color"
                                            value={editingCreator.color}
                                            onChange={e => setEditingCreator({ ...editingCreator, color: e.target.value })}
                                            className="h-12 w-12 rounded-xl border border-white/10 p-1 bg-black/40 cursor-pointer overflow-hidden"
                                        />
                                        <input
                                            type="text"
                                            value={editingCreator.color}
                                            onChange={e => setEditingCreator({ ...editingCreator, color: e.target.value })}
                                            className="flex-1 bg-white/[0.03] border border-white/5 rounded-2xl px-4 text-xs font-mono text-white/50 outline-none focus:border-red-500/50"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-zinc-500 ml-2">Rôle / Bio courte</label>
                                <input
                                    required
                                    type="text"
                                    value={editingCreator.role}
                                    onChange={e => setEditingCreator({ ...editingCreator, role: e.target.value })}
                                    className="w-full bg-white/[0.03] border border-white/5 rounded-2xl px-5 py-4 text-sm text-white outline-none focus:border-red-500/50"
                                    placeholder="Ex: Forgemagie & Statistiques"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-widest text-zinc-500 ml-2 flex items-center gap-2">
                                    Handle de Détection <Sparkles className="h-3 w-3 text-amber-500" />
                                </label>
                                <input
                                    type="text"
                                    value={editingCreator.handle || ""}
                                    onChange={e => setEditingCreator({ ...editingCreator, handle: e.target.value })}
                                    className="w-full bg-white/[0.03] border border-white/5 rounded-2xl px-5 py-3 text-sm text-amber-400 outline-none focus:border-red-500/50"
                                    placeholder="Ex: huzounet (Nom de chaine Twitch ou handle YT sans @)"
                                />
                                <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest ml-2 italic">C'est cet ID qui permet de savoir quand le créateur est en live.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-6 pt-2">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black uppercase tracking-widest text-zinc-500 ml-2">Canal YouTube</label>
                                    <input
                                        type="url"
                                        value={editingCreator.youtube || ""}
                                        onChange={e => setEditingCreator({ ...editingCreator, youtube: e.target.value })}
                                        className="w-full bg-white/[0.03] border border-white/5 rounded-2xl px-5 py-3 text-xs text-red-400 outline-none focus:border-red-500/50"
                                        placeholder="URL Chaine"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black uppercase tracking-widest text-zinc-500 ml-2">Canal Twitch</label>
                                    <input
                                        type="url"
                                        value={editingCreator.twitch || ""}
                                        onChange={e => setEditingCreator({ ...editingCreator, twitch: e.target.value })}
                                        className="w-full bg-white/[0.03] border border-white/5 rounded-2xl px-5 py-3 text-xs text-purple-400 outline-none focus:border-red-500/50"
                                        placeholder="URL Stream"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-4 pt-10">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-5 rounded-[1.5rem] bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-[11px] font-black uppercase tracking-widest transition-all"
                                >
                                    Annuler
                                </button>
                                <button
                                    disabled={isPending}
                                    type="submit"
                                    className="flex-[2] py-5 rounded-[1.5rem] bg-red-600 hover:bg-red-500 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-2xl shadow-red-600/20 disabled:opacity-50 flex items-center justify-center gap-3"
                                >
                                    {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sauvegarder"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

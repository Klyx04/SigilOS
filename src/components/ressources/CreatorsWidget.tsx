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
        } catch {
            // Silently fail — component shows empty state gracefully

        } finally {
            setLoading(false);
        }
    }, [guildId]);

    useEffect(() => {
        load();
    }, [load]);

    const getCreatorActivity = (handle?: string | null) => {
        if (!handle || !liveData.length) return { status: "offline" };
        const h = handle.toLowerCase().replace('@', '').trim();

        // Filter live items for this handle
        const creatorItems = liveData.filter(d =>
            d.creatorId?.toLowerCase().includes(h)
        );

        if (creatorItems.length === 0) return { status: "offline" };

        // Check Twitch Live status
        const liveStream = creatorItems.find(i => i.type === "TWITCH");
        if (liveStream) return { status: "live", link: liveStream.url, item: liveStream };

        // Check if recent YouTube video (within 48h)
        const sorted = [...creatorItems].sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());
        const youngest = sorted[0];
        const ageHours = (new Date().getTime() - new Date(youngest.published).getTime()) / (1000 * 60 * 60);

        if (ageHours < 48) return { status: "video", link: youngest.url, item: youngest };

        return { status: "offline", link: youngest.url, item: youngest };
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
        <div className="w-full h-40 flex flex-col items-center justify-center bg-black/20 rounded-[2.5rem] border border-border gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-danger/50" />
            <span className="text-caption font-black uppercase tracking-[0.2em] text-muted-foreground animate-pulse">Chargement du Hub Créateurs...</span>
        </div>
    );

    return (
        <div className="w-full flex flex-col gap-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-danger/10 flex items-center justify-center border border-danger/20 shadow-inner group">
                        <Tv className="h-6 w-6 text-danger group- transition-transform" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-foreground tracking-tight">Elite Creators Hub</h3>
                        <div className="flex items-center gap-2">
                            <span className="text-caption text-muted-foreground font-bold tracking-widest uppercase">Flux Communautaire SigilOS</span>
                            <div className="h-1 w-1 rounded-full bg-muted" />
                            <span className="text-caption text-danger/60 font-black uppercase tracking-widest">{creators.length} Créateurs</span>
                        </div>
                    </div>
                </div>

                {isSuperAdmin && (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsEditingMode(!isEditingMode)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border transition-all text-caption font-black uppercase tracking-widest ${isEditingMode ? 'bg-danger/20 border-danger/40 text-danger' : 'bg-surface border-border text-muted-foreground hover:text-danger-foreground hover:border-border-strong'}`}
                        >
                            <Settings2 className="h-4 w-4" /> {isEditingMode ? "Quitter l'édition" : "Gérer les slots"}
                        </button>
                        <button
                            onClick={() => { setEditingCreator({ name: "", role: "", color: "#ef4444", order: creators.length }); setIsModalOpen(true); }}
                            className="flex items-center gap-3 px-6 py-2.5 rounded-2xl bg-danger hover:bg-danger text-danger-foreground text-caption font-black uppercase tracking-widest transition-all shadow-xl shadow-red-600/20  active:scale-95 translate-y-[-1px]"
                        >
                            <Plus className="h-4 w-4" /> Ajouter un slot
                        </button>
                    </div>
                )}
            </div>

            {/* Grid display with scrollable container */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pr-2 max-h-[700px] overflow-y-auto custom-scrollbar pb-6 px-1">
                {creators.length === 0 ? (
                    <div className="col-span-full py-20 text-center border border-dashed border-border rounded-[2rem] bg-surface">
                        <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest">Aucun créateur configuré</p>
                    </div>
                ) : creators.map((c) => {
                    const activity = getCreatorActivity(c.handle ?? undefined);
                    const status = activity.status;

                    // Generate an avatar URL based on handle or link
                    let avatarUrl = null;
                    if (c.youtube) {
                        const handleMatch = c.youtube.match(/@([a-zA-Z0-9_-]+)/);
                        if (handleMatch) avatarUrl = `https://unavatar.io/youtube/${handleMatch[1]}?fallback=false`;
                    }
                    if (!avatarUrl && c.twitch) {
                        const twitchName = c.twitch.split('/').pop();
                        if (twitchName) avatarUrl = `https://unavatar.io/twitch/${twitchName}?fallback=false`;
                    }

                    return (
                        <div
                            key={c.id}
                            className="group relative rounded-[2rem] p-6 border transition-all duration-300 hover:shadow-2xl hover:bg-surface"
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
                                        className="p-2.5 rounded-xl bg-surface hover:bg-elevated text-foreground transition-all "
                                    >
                                        <Edit2 className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        onClick={() => c.id && handleDelete(c.id)}
                                        className="p-2.5 rounded-xl bg-danger/10 hover:bg-danger/20 text-danger transition-all "
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
                                    className="h-16 w-16 rounded-[1.25rem] flex items-center justify-center text-xl font-black relative shadow-2xl overflow-hidden group- transition-transform duration-300 shrink-0"
                                    style={{ background: `${c.color}15`, color: c.color, border: `1px solid ${c.color}25` }}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent z-10 pointer-events-none" />
                                    {avatarUrl ? (
                                        <>
                                            <img
                                                src={avatarUrl}
                                                alt={c.name}
                                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity mix-blend-luminosity hover:mix-blend-normal"
                                                onError={(e) => {
                                                    (e.target as HTMLElement).style.display = 'none';
                                                    (e.target as HTMLElement).nextElementSibling!.classList.remove('hidden');
                                                }}
                                            />
                                            <span className="hidden">
                                                {c.name.substring(0, 2).toUpperCase()}
                                            </span>
                                        </>
                                    ) : (
                                        <span>{c.name.substring(0, 2).toUpperCase()}</span>
                                    )}
                                    {status === "live" && (
                                        <div className="absolute top-1 right-1 h-3.5 w-3.5 rounded-full bg-danger border-2 border-background animate-pulse  z-20" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 pt-1">
                                    <div className="text-lg font-black text-foreground group-hover:text-foreground/90 transition-colors truncate">
                                        {c.name}
                                    </div>
                                    <div className="text-caption font-black text-muted-foreground uppercase tracking-[0.2em] mt-1 truncate">{c.role}</div>
                                </div>
                            </div>

                            <div className="h-10 mb-6 flex items-center">
                                {status === "live" ? (
                                    <a href={activity.link || c.twitch || "#"} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-danger bg-danger/10 hover:bg-danger/20 px-4 py-2 rounded-2xl border border-danger/20 w-fit transition-colors group/live">
                                        <div className="w-2 h-2 rounded-full bg-danger group-hover/live:animate-none animate-pulse " />
                                        <span className="text-caption font-black uppercase tracking-widest">En Direct</span>
                                    </a>
                                ) : status === "video" ? (
                                    <a href={activity.link || c.youtube || "#"} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-info bg-info/10 hover:bg-info/20 px-4 py-2 rounded-2xl border border-info/20 w-fit transition-all  active:scale-95  group/video">
                                        <div className="w-2 h-2 rounded-full bg-info animate-ping group-hover/video:animate-none group-hover/video:w-3 group-hover/video:h-3 transition-all" />
                                        <span className="text-caption font-black uppercase tracking-widest">Nouveau Contenu</span>
                                    </a>
                                ) : (
                                    <div className="text-muted-foreground text-caption font-black uppercase tracking-widest ml-1 opacity-30">Actuellement Offline</div>
                                )}
                            </div>

                            <div className="flex items-center gap-3">
                                {c.youtube && (
                                    <a href={c.youtube} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl text-caption font-black uppercase tracking-widest text-[#ef4444] bg-[#ef4444]/10 hover:bg-[#ef4444]/20 border border-[#ef4444]/10 transition-all hover:scale-[1.03] active:scale-[0.98]">
                                        <Youtube className="h-4 w-4" /> YouTube
                                    </a>
                                )}
                                {c.twitch && (
                                    <a href={c.twitch} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl text-caption font-black uppercase tracking-widest text-[#a855f7] bg-[#a855f7]/10 hover:bg-[#a855f7]/20 border border-[#a855f7]/10 transition-all hover:scale-[1.03] active:scale-[0.98]">
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
                    <div className="w-full max-w-xl bg-background rounded-[3rem] border border-border p-10 shadow-3xl relative animate-in zoom-in-95 duration-200">
                        <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 p-3 bg-surface hover:bg-surface rounded-2xl text-muted-foreground hover:text-foreground transition-all">
                            <X className="h-6 w-6" />
                        </button>

                        <div className="flex items-center gap-6 mb-10">
                            <div className="w-16 h-16 rounded-3xl bg-danger/10 flex items-center justify-center border border-danger/20 shadow-inner">
                                <Settings2 className="h-8 w-8 text-danger" />
                            </div>
                            <div>
                                <h3 className="text-3xl font-black text-foreground uppercase tracking-tighter">Nexus Creator Config</h3>
                                <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">Plateforme Community Hub</p>
                            </div>
                        </div>

                        <form onSubmit={handleSave} className="space-y-6">
                            <div className="grid grid-cols-5 gap-6">
                                <div className="col-span-3 space-y-2">
                                    <label className="text-caption font-black uppercase tracking-widest text-muted-foreground ml-2">Nom Public</label>
                                    <input
                                        required
                                        type="text"
                                        value={editingCreator.name}
                                        onChange={e => setEditingCreator({ ...editingCreator, name: e.target.value })}
                                        className="w-full bg-surface border border-border rounded-2xl px-5 py-4 text-sm text-foreground outline-none focus:border-danger/50"
                                        placeholder="Ex: Huz"
                                    />
                                </div>
                                <div className="col-span-2 space-y-2">
                                    <label className="text-caption font-black uppercase tracking-widest text-muted-foreground ml-2">Couleur Signature</label>
                                    <div className="flex gap-3">
                                        <input
                                            type="color"
                                            value={editingCreator.color}
                                            onChange={e => setEditingCreator({ ...editingCreator, color: e.target.value })}
                                            className="h-12 w-12 rounded-xl border border-border p-1 bg-black/40 cursor-pointer overflow-hidden"
                                        />
                                        <input
                                            type="text"
                                            value={editingCreator.color}
                                            onChange={e => setEditingCreator({ ...editingCreator, color: e.target.value })}
                                            className="flex-1 bg-surface border border-border rounded-2xl px-4 text-xs font-mono text-foreground/50 outline-none focus:border-danger/50"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-caption font-black uppercase tracking-widest text-muted-foreground ml-2">Rôle / Bio courte</label>
                                <input
                                    required
                                    type="text"
                                    value={editingCreator.role}
                                    onChange={e => setEditingCreator({ ...editingCreator, role: e.target.value })}
                                    className="w-full bg-surface border border-border rounded-2xl px-5 py-4 text-sm text-foreground outline-none focus:border-danger/50"
                                    placeholder="Ex: Forgemagie & Statistiques"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-caption font-black uppercase tracking-widest text-muted-foreground ml-2 flex items-center gap-2">
                                    Handle de Détection <Sparkles className="h-3 w-3 text-warning" />
                                </label>
                                <input
                                    type="text"
                                    value={editingCreator.handle || ""}
                                    onChange={e => setEditingCreator({ ...editingCreator, handle: e.target.value })}
                                    className="w-full bg-surface border border-border rounded-2xl px-5 py-3 text-sm text-warning outline-none focus:border-danger/50"
                                    placeholder="Ex: huzounet (Nom de chaine Twitch ou handle YT sans @)"
                                />
                                <p className="text-caption text-muted-foreground font-bold uppercase tracking-widest ml-2 italic">C'est cet ID qui permet de savoir quand le créateur est en live.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-6 pt-2">
                                <div className="space-y-2">
                                    <label className="text-caption font-black uppercase tracking-widest text-muted-foreground ml-2">Canal YouTube</label>
                                    <input
                                        type="url"
                                        value={editingCreator.youtube || ""}
                                        onChange={e => setEditingCreator({ ...editingCreator, youtube: e.target.value })}
                                        className="w-full bg-surface border border-border rounded-2xl px-5 py-3 text-xs text-danger outline-none focus:border-danger/50"
                                        placeholder="URL Chaine"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-caption font-black uppercase tracking-widest text-muted-foreground ml-2">Canal Twitch</label>
                                    <input
                                        type="url"
                                        value={editingCreator.twitch || ""}
                                        onChange={e => setEditingCreator({ ...editingCreator, twitch: e.target.value })}
                                        className="w-full bg-surface border border-border rounded-2xl px-5 py-3 text-xs text-info outline-none focus:border-danger/50"
                                        placeholder="URL Stream"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-4 pt-10">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-5 rounded-[1.5rem] bg-surface hover:bg-surface text-muted-foreground hover:text-foreground text-caption font-black uppercase tracking-widest transition-all"
                                >
                                    Annuler
                                </button>
                                <button
                                    disabled={isPending}
                                    type="submit"
                                    className="flex-[2] py-5 rounded-[1.5rem] bg-danger hover:bg-danger text-danger-foreground text-caption font-black uppercase tracking-widest transition-all shadow-2xl shadow-red-600/20 disabled:opacity-50 flex items-center justify-center gap-3"
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

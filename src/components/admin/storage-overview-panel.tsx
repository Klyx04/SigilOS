"use client";

import { useState, useEffect, useCallback } from "react";
import {
    getStorageOverview, godDeleteFile, setGuildStorageLimit, getGuildLogsStats, cleanOrphanStorage,
    type StorageGuildEntry, type StorageOverview, type PendingFile, type GuildAsset, type AssetDbField, type DiskFile
} from "@/server/actions/storage-actions";
import {
    HardDrive, FolderOpen, Loader2, RefreshCw,
    FileImage, Coins, Trophy, Shield, Search, Clock, Image as ImageIcon,
    X, Trash2, Handshake, ScrollText, AlertTriangle,
    ChevronRight
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "Ko", "Mo", "Go"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const TYPE_CFG = {
    MISSION: { label: "Mission", color: "text-danger", bg: "bg-danger/10", border: "border-danger/20", dot: "bg-danger", barColor: "bg-danger" },
    KAMA: { label: "Kamas, Prêts & Coffre", color: "text-warning", bg: "bg-warning/10", border: "border-warning/20", dot: "bg-warning", barColor: "bg-warning" },
    ACHIEVEMENT: { label: "Succès", color: "text-info", bg: "bg-info/10", border: "border-info/20", dot: "bg-info", barColor: "bg-info" },
    LOAN_PROOF: { label: "Prêt & Coffre", color: "text-info", bg: "bg-info/10", border: "border-info/20", dot: "bg-info", barColor: "bg-info" },
    PRESENTATION: { label: "Présentation Guilde", color: "text-success", bg: "bg-success/10", border: "border-success/20", dot: "bg-success", barColor: "bg-success" },
    ICON: { label: "Icône", color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20", dot: "bg-sky-500", barColor: "bg-sky-500" },
    BANNER: { label: "Bannière de guilde", color: "text-success", bg: "bg-success/10", border: "border-success/20", dot: "bg-success", barColor: "bg-success" },
    PHOTO: { label: "Photo de guilde", color: "text-info", bg: "bg-info/10", border: "border-info/20", dot: "bg-info", barColor: "bg-info" },
};

// ─── Path Display ─────────────────────────────────────────────────────────────

function PathDisplay({ path, colorClass, guildName }: { path: string; colorClass: string; guildName?: string }) {
    // Normalize path to look like project root path (F-17 affichage : URLs /api/storage/ → private_uploads/)
    const clean = path
        .replace(/^\/(api\/storage|uploads)\//, "private_uploads/")
        .replace(/^\/private_uploads\//, "private_uploads/")
        .replace(/\/$/, "");
    const segments = clean.split("/");

    return (
        <div className="flex flex-wrap items-center gap-1.5 py-2">
            <span className="text-caption font-mono text-foreground font-black tracking-tighter uppercase whitespace-nowrap bg-background px-2 py-1 rounded-lg border border-border shadow-sm">SigilOS /</span>
            {segments.map((seg, i) => {
                const isId = (seg.length > 20 && /^[a-z0-9]+$/.test(seg)) || /^\d{17,20}$/.test(seg);
                if (!seg) return null;
                const label = isId && guildName ? guildName : seg;
                return (
                    <div key={i} className="flex items-center gap-1.5">
                        <span 
                            title={isId && guildName ? `${seg} (${guildName})` : seg} 
                            className={cn(
                                "text-caption font-mono font-black px-2 py-1.5 rounded-lg border shadow-sm transition-all whitespace-nowrap",
                                isId ? "text-success/80 bg-success/5 border-success/20" : `${colorClass} bg-surface border-border opacity-90`
                            )}
                        >
                            {label}
                        </span>
                        {i < segments.length - 1 && <span className="text-muted-foreground text-caption font-mono font-black mx-0.5">/</span>}
                    </div>
                );
            })}
        </div>
    );
}

// ─── Countdown chip ───────────────────────────────────────────────────────────

function useCountdown(expiresAt: Date) {
    const getMs = () => Math.max(0, new Date(expiresAt).getTime() - Date.now());
    const [ms, setMs] = useState(getMs);
    useEffect(() => {
        const id = setInterval(() => setMs(getMs()), 1000);
        return () => clearInterval(id);
    }, [expiresAt]);
    
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    const s = Math.floor((ms % 60_000) / 1_000);
    return { label: `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`, urgent: ms < 2 * 3_600_000, expired: ms === 0, ms };
}

function CountdownChip({ 
    modifiedAt, 
    providedExpiresAt, 
    labelPrefix = "SUPPRESSION DANS : ",
    durationMs = 4 * 60 * 60 * 1000 // default to 4h grace for orphans
}: { 
    modifiedAt?: Date; 
    providedExpiresAt?: Date | string; 
    labelPrefix?: string;
    durationMs?: number;
}) {
    // If we have an absolute expiry date (like for pending files), use it.
    // Otherwise calculate from modification date + duration.
    const targetDate = providedExpiresAt 
        ? new Date(providedExpiresAt) 
        : new Date(new Date(modifiedAt!).getTime() + durationMs);
        
    const { label, urgent, expired } = useCountdown(targetDate);

    if (expired) return <span className="text-caption font-black px-1.5 py-0.5 rounded bg-danger/20 text-danger uppercase">PRÊT POUR NETTOYAGE</span>;
    return (
        <span className={cn(
            "text-caption font-mono font-black px-1.5 py-0.5 rounded flex items-center gap-1.5 whitespace-nowrap", 
            urgent ? "bg-danger/10 text-danger animate-pulse" : "bg-elevated text-muted-foreground"
        )}>
            <Clock className="w-2.5 h-2.5" />
            {labelPrefix}{label}
        </span>
    );
}

// ─── Explorer Dialog ─────────────────────────────────────────────────────────

interface LightboxItem {
    url: string;
    type: keyof typeof TYPE_CFG;
    label: string;
    filename?: string;
    sizeBytes?: number;
    isLocal?: boolean;
    isPending?: boolean;
    expiresAt?: Date | string;
    dbClear?: { guildId: string; field: AssetDbField };
}

function FileExplorerDialog({ 
    open, onOpenChange, 
    files, label, type, onDeleted 
}: { 
    open: boolean; onOpenChange: (o: boolean) => void;
    files: DiskFile[]; label: string; type: keyof typeof TYPE_CFG;
    onDeleted: () => void;
}) {
    const cfg = TYPE_CFG[type];
    const [lightbox, setLightbox] = useState<LightboxItem | null>(null);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl bg-background border-border p-0 overflow-hidden outline-none">
                <DialogHeader className="p-6 border-b border-border bg-surface/80 backdrop-blur-md">
                    <div className="flex items-center gap-4 text-left">
                        <div className={cn("p-3 rounded-2xl shadow-xl", cfg.bg, cfg.color)}>
                            <FolderOpen className="w-6 h-6" />
                        </div>
                        <div>
                            <DialogTitle className="text-2xl font-black text-foreground uppercase tracking-tight">{label}</DialogTitle>
                            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mt-1 opacity-80">{files.length} fichiers physiques</p>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-6 max-h-[60vh] overflow-y-auto no-scrollbar">
                    {files.length === 0 ? (
                        <div className="text-center py-20 text-muted-foreground text-xs font-bold uppercase tracking-widest border-2 border-dashed border-border rounded-[2rem]">
                            Aucun fichier physique détecté
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {files.map((f, i) => (
                                <div key={i} className="group relative rounded-[1.5rem] overflow-hidden border border-border bg-surface/50 hover:border-border-strong transition-all aspect-square">
                                    <button 
                                        className="absolute inset-0 z-10" 
                                        onClick={() => setLightbox({ url: f.url, type, label, filename: f.filename, sizeBytes: f.sizeBytes, isLocal: true, isPending: f.isPending, expiresAt: f.expiresAt })}
                                    />
                                    <img src={f.url} alt="" title={f.filename} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-300" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />
                                    
                                    <div className="absolute top-2 left-2 z-20">
                                        {(() => {
                                            if (f.isPending && f.expiresAt) {
                                                return <CountdownChip providedExpiresAt={f.expiresAt} labelPrefix="EXP : " />;
                                            }
                                            
                                            if (label.includes("Orphelin")) {
                                                return <CountdownChip modifiedAt={f.modifiedAt} durationMs={4 * 3600000} labelPrefix="" />;
                                            }
                                            if (type === "LOAN_PROOF") {
                                                return <CountdownChip modifiedAt={f.modifiedAt} durationMs={7 * 24 * 3600000} labelPrefix="RETENTION : " />;
                                            }
                                            return (
                                                <span className="text-caption font-black px-1.5 py-0.5 rounded bg-success/10 text-success border border-success/20 uppercase tracking-widest flex items-center gap-1 shadow-2xl">
                                                    <Shield className="w-2 h-2" />
                                                    Permanent
                                                </span>
                                            );
                                        })()}
                                    </div>

                                    <div className="absolute bottom-3 left-3 right-3 space-y-0.5 pointer-events-none drop-shadow-md">
                                        <p className="text-caption font-black text-foreground truncate uppercase tracking-tighter">{f.filename}</p>
                                        <p className="text-caption font-mono font-black text-foreground opacity-80">{formatBytes(f.sizeBytes)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {lightbox && (
                    <Lightbox 
                        item={lightbox} 
                        onClose={() => setLightbox(null)} 
                        onDeleted={() => { onDeleted(); setLightbox(null); }} 
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

// ─── Pending Validation Dialog ──────────────────────────────────────────────

function PendingValidationDialog({ 
    open, onOpenChange, 
    files, label, type, onDeleted 
}: { 
    open: boolean; onOpenChange: (o: boolean) => void;
    files: PendingFile[]; label: string; type: keyof typeof TYPE_CFG;
    onDeleted: () => void;
}) {
    const cfg = TYPE_CFG[type];
    const [lightbox, setLightbox] = useState<LightboxItem | null>(null);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl bg-background border-border p-0 overflow-hidden outline-none">
                <DialogHeader className="p-6 border-b border-border bg-surface/50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-left">
                            <div className={cn("p-3 rounded-2xl bg-warning/10 text-warning shadow-xl")}>
                                <Clock className="w-6 h-6" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-black text-foreground uppercase tracking-tighter leading-none">WAITING ROOM</DialogTitle>
                                <p className="text-caption font-black text-muted-foreground uppercase tracking-[0.2em] mt-2">{label} — {files.length} submissions</p>
                            </div>
                        </div>
                        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 font-black px-3 py-1 text-caption tracking-widest uppercase">Expiration 24h</Badge>
                    </div>
                </DialogHeader>

                <div className="p-6 max-h-[60vh] overflow-y-auto no-scrollbar">
                    {files.length === 0 ? (
                        <div className="text-center py-20 text-muted-foreground text-xs font-bold uppercase tracking-widest border-2 border-dashed border-border rounded-[2rem]">
                            Aucun record en attente
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {files.map((f, i) => (
                                <div key={i} className="group relative rounded-[1.5rem] overflow-hidden border border-border bg-surface/50 hover:border-border-strong transition-all aspect-square">
                                    <button 
                                        className="absolute inset-0 z-10" 
                                        onClick={() => setLightbox({ url: f.url, type: f.type, label: cfg.label, filename: f.filename, sizeBytes: f.sizeBytes, isLocal: true, expiresAt: f.expiresAt })}
                                    />
                                    <img src={f.url} alt="" title={f.memberName} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-300" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />
                                    
                                    <div className="absolute top-2 left-2 z-20">
                                        <CountdownChip providedExpiresAt={f.expiresAt} labelPrefix="EXP : " />
                                    </div>

                                    <div className="absolute bottom-3 left-3 right-3 space-y-0.5 pointer-events-none">
                                        <p className="text-caption font-black text-foreground truncate">{f.memberName}</p>
                                        <p className="text-caption font-mono text-muted-foreground">{formatBytes(f.sizeBytes)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {lightbox && (
                    <Lightbox 
                        item={lightbox} 
                        onClose={() => setLightbox(null)} 
                        onDeleted={() => { onDeleted(); setLightbox(null); }} 
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function StorageOverviewPanel() {
    const [overview, setOverview] = useState<StorageOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [orphansOpen, setOrphansOpen] = useState(false);
    const [sortBy, setSortBy] = useState<'size' | 'name' | 'files'>('size');
    const [page, setPage] = useState(1);
    const [activeTab, setActiveTab] = useState<'guildes' | 'orphelins' | 'logs'>('guildes');
    const [logs, setLogs] = useState<Awaited<ReturnType<typeof getGuildLogsStats>>["data"] | null>(null);
    const PAGE_SIZE = 25;

    const purgeOrphans = async () => {
        const res = await cleanOrphanStorage();
        if (res.success) {
            toast.success(`Purge : ${res.deletedCount ?? 0} fichier(s), ${((res.freedBytes || 0) / 1024 / 1024).toFixed(1)} Mo libérés`);
            load(true);
        } else {
            toast.error(res.error || "Erreur lors de la purge");
        }
    };

    const load = useCallback(async (force = false) => {
        setLoading(true);
        const res = await getStorageOverview(force);
        if (res.success && res.data) setOverview(res.data);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    // Logs par guilde (30j) — chargés une fois à l'ouverture
    useEffect(() => {
        getGuildLogsStats().then((res) => { if (res.success && res.data) setLogs(res.data); }).catch(() => {});
    }, []);

    const filteredGuilds = overview?.guilds.filter(g => 
        g.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        g.discordGuildId.includes(searchTerm)
    ) || [];

    const sortedGuilds = [...filteredGuilds].sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'files') return (b.missionsCount + b.kamaCount + b.achievementCount + b.presentationCount) - (a.missionsCount + a.kamaCount + a.achievementCount + a.presentationCount);
        return b.totalBytes - a.totalBytes;
    });

    const totalPages = Math.max(1, Math.ceil(sortedGuilds.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const pagedGuilds = sortedGuilds.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const changeSearch = (v: string) => { setSearchTerm(v); setPage(1); };

    if (loading && !overview) return (
        <div className="flex flex-col items-center justify-center py-40 gap-6">
            <Loader2 className="w-10 h-10 text-warning animate-spin" />
            <span className="text-caption font-black text-muted-foreground uppercase tracking-widest animate-pulse">Exploration physique...</span>
        </div>
    );

    return (
        <div className="w-full space-y-8 pb-20">
            {/* ── En-tête : titre + stats globales + actions ── */}
            <div className="flex flex-wrap items-end justify-between gap-6">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">Stockage &amp; Captures</h2>
                    <p className="text-sm text-muted-foreground mt-1 max-w-2xl">Espace disque par guilde, captures en attente, seuils personnalisables et fichiers orphelins.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                    <div className="flex items-center gap-2 rounded-2xl bg-surface/60 border border-border px-4 py-2.5">
                        <HardDrive className="w-4 h-4 text-info" />
                        <span className="text-caption font-black text-muted-foreground uppercase tracking-widest">Total</span>
                        <span className="text-sm font-black font-mono text-foreground">{formatBytes(overview?.totalBytes || 0)}</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl bg-surface/60 border border-border px-4 py-2.5">
                        <FileImage className="w-4 h-4 text-success" />
                        <span className="text-caption font-black text-muted-foreground uppercase tracking-widest">Fichiers</span>
                        <span className="text-sm font-black font-mono text-foreground">{overview?.totalFiles || 0}</span>
                    </div>
                    <button onClick={() => setOrphansOpen(true)} className={cn("flex items-center gap-2 rounded-2xl border px-4 py-2.5 transition-all", (overview?.orphanFiles.length || 0) > 0 ? "bg-danger/10 border-danger/25 text-danger hover:bg-danger/15" : "bg-surface/60 border-border text-muted-foreground hover:text-danger-foreground")}>
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-caption font-black uppercase tracking-widest">{overview?.orphanFiles.length || 0} orphelin(s)</span>
                    </button>
                    <button onClick={() => load(true)} title="Rafraîchir le scan disque (force)" className="p-2.5 rounded-2xl bg-surface/60 border border-border text-muted-foreground hover:text-foreground transition-all">
                        <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                    </button>
                </div>
            </div>

                    {/* ── Onglets ── */}
                    <div className="flex items-center gap-1 border-b border-border overflow-x-auto no-scrollbar">
                        {([
                            { id: "guildes" as const, label: "Guildes", icon: Shield },
                            { id: "orphelins" as const, label: "Fichiers orphelins", icon: AlertTriangle },
                            { id: "logs" as const, label: "Logs par guilde", icon: ScrollText },
                        ]).map((tab) => {
                            const Icon = tab.icon;
                            const badge = tab.id === "orphelins" ? overview?.orphanFiles.length || 0 : tab.id === "logs" ? logs?.totals.total : undefined;
                            return (
                                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn("flex items-center gap-2 px-4 py-3 -mb-px border-b-2 text-caption font-black uppercase tracking-widest transition-all whitespace-nowrap", activeTab === tab.id ? "border-info text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                    {badge != null && badge > 0 && (
                                        <span className={cn("flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-caption font-black", tab.id === "orphelins" ? "bg-danger text-danger-foreground" : "bg-info text-info-foreground")}>{badge > 99 ? "99+" : badge}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {activeTab === "guildes" && (
                        <div className="space-y-4">
                            {/* Barre d'outils : recherche + tri + vue */}
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="relative flex-1 min-w-[220px] group">
                                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-info transition-colors">
                                        <Search className="w-4 h-4" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Rechercher une guilde..."
                                        value={searchTerm}
                                        onChange={(e) => changeSearch(e.target.value)}
                                        className="w-full bg-surface/40 border border-border rounded-xl py-2.5 pl-11 pr-4 text-sm focus:border-info/50 focus:bg-surface/60 transition-all outline-none"
                                    />
                                </div>
                                <div className="flex items-center gap-1 p-1 bg-surface/40 border border-border rounded-xl">
                                    <span className="px-2 text-caption font-black text-muted-foreground uppercase tracking-widest">Tri</span>
                                    {([['size', 'Taille'], ['name', 'Nom'], ['files', 'Fichiers']] as const).map(([key, label]) => (
                                        <button key={key} onClick={() => setSortBy(key)} className={cn("px-3 py-1.5 rounded-lg text-caption font-black uppercase tracking-widest transition-all", sortBy === key ? "bg-info text-info-foreground" : "text-muted-foreground hover:text-info-foreground")}>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* Contenu : liste (table) */}
                            <div className="bg-surface/40 border border-border rounded-2xl overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-surface">
                                        <tr>
                                            <th className="px-6 py-4 text-caption font-black text-muted-foreground uppercase tracking-widest border-b border-border">Guilde</th>
                                            <th className="px-6 py-4 text-caption font-black text-muted-foreground uppercase tracking-widest border-b border-border text-right font-mono">Taille Totale</th>
                                            <th className="px-6 py-4 text-caption font-black text-muted-foreground uppercase tracking-widest border-b border-border text-center">Fichiers</th>
                                            <th className="px-6 py-4 text-caption font-black text-muted-foreground uppercase tracking-widest border-b border-border">Répartition</th>
                                            <th className="px-6 py-4 text-caption font-black text-muted-foreground uppercase tracking-widest border-b border-border text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pagedGuilds.map((guild) => (
                                            <GuildRow key={guild.guildId} guild={guild} onReload={() => load(true)} />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {sortedGuilds.length === 0 && (
                                <div className="h-48 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl text-muted-foreground text-xs font-black uppercase tracking-widest">
                                    Aucune correspondance
                                </div>
                            )}

                            {/* Pagination */}
                            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                                <span className="text-xs font-mono font-black text-muted-foreground">{sortedGuilds.length} guildes</span>
                                {totalPages > 1 && (
                                    <div className="flex items-center gap-1.5">
                                        <button onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} className="px-3 py-1.5 rounded-lg bg-surface/60 border border-border text-caption font-black disabled:opacity-30 hover:bg-surface transition-all">‹</button>
                                        <span className="text-caption font-mono font-black text-foreground">{currentPage} / {totalPages}</span>
                                        <button onClick={() => setPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages} className="px-3 py-1.5 rounded-lg bg-surface/60 border border-border text-caption font-black disabled:opacity-30 hover:bg-surface transition-all">›</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                {/* ── Onglet Fichiers orphelins ── */}
                {activeTab === "orphelins" && (
                    <div className="rounded-3xl border border-border bg-surface/40 p-6 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-black text-foreground uppercase tracking-widest">Fichiers orphelins</h3>
                                <p className="text-sm text-muted-foreground mt-1">Fichiers présents sur le disque mais plus référencés en base.</p>
                            </div>
                            <button onClick={purgeOrphans} className="flex items-center gap-2 rounded-xl bg-danger/10 border border-danger/25 text-danger px-4 py-2 text-caption font-black uppercase tracking-widest hover:bg-danger/15 transition-all">
                                <Trash2 className="w-4 h-4" /> Tout nettoyer
                            </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-muted/30 border border-border px-4 py-3 text-sm text-muted-foreground">
                            <span className="font-black text-foreground text-2xl">{overview?.orphanFiles.length || 0}</span>
                            <span>fichier(s) orphelin(s) détecté(s)</span>
                            <button onClick={() => setOrphansOpen(true)} className="ml-auto underline decoration-dotted underline-offset-4 hover:text-foreground transition-colors">Voir la liste</button>
                        </div>
                    </div>
                )}

                {/* ── Onglet Logs par guilde ── */}
                {activeTab === "logs" && logs && (
                    <div className="rounded-3xl border border-border bg-surface/40 p-6 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-info/10 border border-info/20 text-info">
                                    <ScrollText className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-foreground uppercase tracking-widest">Logs par Guilde</h3>
                                    <p className="text-caption font-black text-muted-foreground uppercase tracking-widest">30 derniers jours — activité (services/modules) + audit sécurité</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xl font-black text-foreground leading-none font-mono">{logs.totals.total}</p>
                                <p className="text-caption font-black text-muted-foreground uppercase tracking-widest mt-1">logs au total</p>
                            </div>
                        </div>

                        <div className="overflow-x-auto no-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-surface">
                                    <tr>
                                        <th className="px-5 py-3 text-caption font-black text-muted-foreground uppercase tracking-widest border-b border-border">Guilde</th>
                                        <th className="px-5 py-3 text-caption font-black text-muted-foreground uppercase tracking-widest border-b border-border text-right">Activité</th>
                                        <th className="px-5 py-3 text-caption font-black text-muted-foreground uppercase tracking-widest border-b border-border text-right">Audit</th>
                                        <th className="px-5 py-3 text-caption font-black text-muted-foreground uppercase tracking-widest border-b border-border text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.rows.slice(0, 15).map((row) => (
                                        <tr key={row.guildId} className="border-b border-border hover:bg-surface transition-colors">
                                            <td className="px-5 py-3 text-caption font-black text-foreground">{row.name}</td>
                                            <td className="px-5 py-3 text-caption font-mono text-muted-foreground text-right">{row.serviceLogs}</td>
                                            <td className="px-5 py-3 text-caption font-mono text-muted-foreground text-right">{row.auditLogs}</td>
                                            <td className="px-5 py-3 text-caption font-mono font-black text-foreground text-right">{row.total}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

            {/* Orphans Modal */}
            <FileExplorerDialog 
                open={orphansOpen} 
                onOpenChange={setOrphansOpen} 
                files={overview?.orphanFiles || []} 
                label="Fichiers Orphelins" 
                type="MISSION" 
                onDeleted={() => load(true)} 
            />
        </div>
    );
}

function StorageLimitEditor({ guildId, limitBytes, onSaved }: { guildId: string; limitBytes: number; onSaved?: () => void }) {
    const [value, setValue] = useState<string>(limitBytes ? String(Math.round(limitBytes / 1024 / 1024)) : "");
    const [saving, setSaving] = useState(false);
    const save = async () => {
        const mb = Number(value);
        const bytes = Number.isFinite(mb) && mb > 0 ? Math.round(mb * 1024 * 1024) : null;
        setSaving(true);
        const res = await setGuildStorageLimit(guildId, bytes);
        setSaving(false);
        if (res.success) {
            toast.success(bytes ? `Limite réglée à ${mb} Mo` : "Limite par défaut (512 Mo) restaurée");
            onSaved?.();
        } else {
            toast.error(res.error || "Erreur");
        }
    };
    return (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <input
                type="number"
                min={1}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="512"
                title="Seuil de stockage (Mo) — vide = défaut 512 Mo"
                className="w-16 h-7 rounded-lg bg-surface border border-border text-caption font-mono px-2 text-foreground focus:outline-none focus:border-success/40"
            />
            <span className="text-caption font-black text-muted-foreground uppercase">Mo</span>
            <button
                onClick={save}
                disabled={saving}
                className="h-7 px-2.5 rounded-lg bg-surface hover:bg-surface text-caption font-black uppercase tracking-widest text-foreground disabled:opacity-50 transition-all"
            >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "OK"}
            </button>
        </div>
    );
}

function StorageMiniItem({ 
    type, count, bytes, files, onReload, dir, pendingFiles, guildName 
}: { 
    type: keyof typeof TYPE_CFG; count: number; bytes: number; files: DiskFile[]; onReload: () => void; dir: string; pendingFiles: PendingFile[]; guildName?: string 
}) {
    const [explorerOpen, setExplorerOpen] = useState(false);
    const [pendingOpen, setPendingOpen] = useState(false);
    const cfg = TYPE_CFG[type];
    
    // Filtre les fichiers en attente de validation pour cette catégorie
    const myPending = pendingFiles.filter(pf => {
        if (pf.type === "MISSION") return type === "MISSION";
        if (pf.type === "KAMA") return type === "KAMA";
        if (pf.type === "ACHIEVEMENT") return type === "ACHIEVEMENT";
        return false;
    });

    // Compte à rebours de la plus proche auto-suppression (fichiers en attente)
    const earliestPending = myPending.length > 0
        ? myPending.reduce((a, b) => new Date(a.expiresAt).getTime() < new Date(b.expiresAt).getTime() ? a : b)
        : null;

    const icon = type === "MISSION" ? <FileImage className="w-4 h-4" /> :
                type === "KAMA" ? <Coins className="w-4 h-4" /> :
                type === "PRESENTATION" ? <ImageIcon className="w-4 h-4" /> :
                type === "LOAN_PROOF" ? <Handshake className="w-4 h-4" /> :
                <Trophy className="w-4 h-4" />;

    return (
        <>
            <div 
                className={cn(
                    "p-5 rounded-[2.5rem] border transition-all relative group/item overflow-hidden",
                    count > 0 || myPending.length > 0 ? "bg-surface/40 border-border" : "bg-background/20 border-border opacity-50 grayscale"
                )}
            >
                <div className="flex items-start justify-between mb-4">
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover/item:rotate-12 shadow-2xl", cfg.bg, cfg.color)}>
                        {icon}
                    </div>
                    <div className="flex items-center gap-2">
                        {myPending.length > 0 && (
                            <button 
                                onClick={() => setPendingOpen(true)}
                                className="px-3 py-1.5 bg-warning/10 hover:bg-warning/20 rounded-xl text-warning text-caption font-black uppercase tracking-widest transition-all border border-warning/20 shadow-xl flex items-center gap-2"
                            >
                                <Clock className="w-3.5 h-3.5" />
                                {myPending.length} EN ATTENTE
                            </button>
                        )}
                        {count > 0 && (
                            <button 
                                onClick={() => setExplorerOpen(true)}
                                className="p-3 bg-surface hover:bg-surface rounded-2xl text-muted-foreground hover:text-foreground transition-all shadow-xl"
                            >
                                <FolderOpen className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <p className="text-caption font-black text-muted-foreground uppercase tracking-widest leading-none">{cfg.label}</p>
                        <div className="flex items-center gap-2 mt-2">
                            <p className="text-[28px] font-black text-foreground tracking-tighter leading-none">{count}</p>
                            <p className="text-caption font-mono text-muted-foreground uppercase">{formatBytes(bytes)}</p>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-border">
                        <p className="text-caption font-black text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                            <HardDrive className="w-2.5 h-2.5" />
                            Chemin Physique
                        </p>
                        <PathDisplay path={dir} colorClass={cfg.color} guildName={guildName} />
                        {earliestPending && (
                            <div className="mt-2 flex items-center gap-2">
                                <CountdownChip providedExpiresAt={earliestPending.expiresAt} labelPrefix="EXP : " />
                                <span className="text-caption font-black text-muted-foreground uppercase tracking-widest">auto-suppression</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <FileExplorerDialog 
                open={explorerOpen} 
                onOpenChange={setExplorerOpen} 
                files={files} 
                label={cfg.label} 
                type={type} 
                onDeleted={onReload} 
            />

            {/* Salle d'attente (pending validation) */}
            <PendingValidationDialog 
                open={pendingOpen} 
                onOpenChange={setPendingOpen} 
                files={myPending} 
                label={cfg.label} 
                type={type} 
                onDeleted={onReload} 
            />
        </>
    );
}

function DeleteButton({ fileUrl, dbClear, onDeleted, label = "Supprimer" }: { fileUrl: string; dbClear?: { guildId: string; field: AssetDbField }; onDeleted: () => void; label?: string }) {
    const [loading, setLoading] = useState(false);
    const del = async () => {
        if (!confirm(`Confirmer la suppression irréversible de : ${fileUrl} ?`)) return;
        setLoading(true);
        const res = await godDeleteFile(fileUrl, dbClear);
        if (res.success) {
            toast.success("Fichier supprimé définitivement");
            onDeleted(); 
        } else {
            toast.error(res.error || "Erreur lors de la suppression");
        }
        setLoading(false);
    };
    return (
        <button onClick={del} disabled={loading} className="px-4 py-2 bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20 rounded-xl flex items-center gap-2 font-black uppercase text-caption tracking-widest transition-colors shadow-2xl" title={label}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 shrink-0" />}
            {label}
        </button>
    );
}

function GuildAssetsStrip({ guild, onReload }: { guild: StorageGuildEntry; onReload: () => void }) {
    const assets = guild.assets || [];
    if (assets.length === 0) return null;
    return (
        <div className="mt-6 border-t border-border pt-5">
            <p className="text-caption font-black text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                <ImageIcon className="w-3 h-3" /> Assets Guilde (icône / bannière / photo)
            </p>
            <div className="flex flex-wrap gap-4">
                {assets.map(asset => {
                    const cfg = TYPE_CFG[asset.type as keyof typeof TYPE_CFG] || TYPE_CFG.ICON;
                    return (
                        <div key={asset.type} className="w-40">
                            <div className="h-24 rounded-xl overflow-hidden border border-border bg-black/40 flex items-center justify-center">
                                <img
                                    src={asset.url}
                                    alt={asset.label}
                                    className="w-full h-full object-cover"
                                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                />
                            </div>
                            <div className="mt-1.5 flex items-center justify-between gap-2">
                                <span className={cn("text-caption font-black uppercase tracking-widest", cfg.color)}>{asset.label}</span>
                                {asset.dbField && asset.isLocal ? (
                                    <button
                                        onClick={async () => {
                                            const field = asset.dbField as AssetDbField;
                                            if (!confirm(`Confirmer la suppression irréversible de : ${asset.url} ?`)) return;
                                            const res = await godDeleteFile(asset.url, { guildId: guild.guildId, field });
                                            if (res.success) { toast.success("Asset supprimé"); onReload(); }
                                            else toast.error(res.error || "Erreur lors de la suppression");
                                        }}
                                        title={`Supprimer ${asset.label}`}
                                        className="p-1.5 rounded-lg bg-danger/10 hover:bg-danger/20 text-danger transition-colors"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                ) : (
                                    <a href={asset.url} target="_blank" rel="noreferrer" className="text-caption font-black text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground">Voir</a>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function GuildRow({ guild, onReload }: { guild: StorageGuildEntry; onReload: () => void }) {
    const subTotal = guild.missionsBytes + guild.kamaBytes + guild.achievementBytes + guild.presentationBytes;
    const totalCount = guild.missionsCount + guild.kamaCount + guild.achievementCount + guild.presentationCount;
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <>
            <tr className={cn(
                "group/row hover:bg-surface transition-colors cursor-pointer border-b border-border",
                isExpanded && "bg-surface"
            )} onClick={() => setIsExpanded(!isExpanded)}>
                <td className="px-8 py-6">
                    <div className="flex items-center gap-4 text-left">
                        <div className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center overflow-hidden shrink-0">
                            {guild.assets.find(a => a.type === "ICON") ? (
                                <img src={guild.assets.find(a => a.type === "ICON")!.url} alt="" className="w-full h-full object-cover" />
                            ) : <Shield className="w-3.5 h-3.5 text-muted-foreground" />}
                        </div>
                        <div>
                            <p className="text-sm font-black text-foreground uppercase tracking-tighter group-hover/row:text-info transition-colors leading-tight">{guild.name}</p>
                            <p className="text-caption font-mono font-bold text-muted-foreground tracking-tighter">{guild.discordGuildId}</p>
                        </div>
                    </div>
                </td>
                <td className="px-8 py-6 text-right font-mono font-black text-info">{formatBytes(subTotal)}</td>
                <td className="px-8 py-6 text-center font-black text-muted-foreground text-xs">{totalCount}</td>
                <td className="px-8 py-6">
                    <div className="flex items-center gap-1.5">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1 bg-danger/5 px-2 py-1 rounded-md border border-danger/10">
                                        <div className="w-1.5 h-1.5 rounded-full bg-danger" />
                                        <span className="text-caption font-black text-danger/80">{guild.missionsCount}</span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent className="bg-background border-danger/20 text-danger font-black text-caption uppercase tracking-widest">
                                    Missions: {formatBytes(guild.missionsBytes)}
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1 bg-warning/5 px-2 py-1 rounded-md border border-warning/10">
                                        <div className="w-1.5 h-1.5 rounded-full bg-warning" />
                                        <span className="text-caption font-black text-warning/80">{guild.kamaCount}</span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent className="bg-background border-warning/20 text-warning font-black text-caption uppercase tracking-widest">
                                    Kamas: {formatBytes(guild.kamaBytes)}
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1 bg-info/5 px-2 py-1 rounded-md border border-info/10">
                                        <div className="w-1.5 h-1.5 rounded-full bg-info" />
                                        <span className="text-caption font-black text-info/80">{guild.achievementCount}</span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent className="bg-background border-info/20 text-info font-black text-caption uppercase tracking-widest">
                                    Succès: {formatBytes(guild.achievementBytes)}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </td>
                <td className="px-8 py-6 text-right">
                    <div className={cn("inline-flex items-center justify-center p-2 rounded-xl bg-surface transition-all", isExpanded && "bg-info text-info-foreground shadow-lg shadow-indigo-500/20")}>
                        <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-all", isExpanded ? "rotate-90 text-foreground" : "group-hover/row:translate-x-1")} />
                    </div>
                </td>
            </tr>
            {isExpanded && (
                <tr className="bg-background animate-in slide-in-from-top-2 duration-300">
                    <td colSpan={5} className="px-8 py-8 space-y-6">
                        {/* Seuil & utilisation */}
                        <div className="flex flex-wrap items-center gap-3 bg-black/30 border border-border rounded-2xl px-4 py-3">
                            <div className="flex-1 min-w-[220px]">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-caption font-black text-muted-foreground uppercase tracking-widest">Utilisation du seuil</span>
                                    <span className="text-caption font-mono font-black text-foreground">{guild.usagePercent}%</span>
                                </div>
                                <div className="h-2 bg-surface rounded-full overflow-hidden">
                                    <div className={cn("h-full rounded-full", guild.usagePercent > 100 ? "bg-danger" : guild.usagePercent > 80 ? "bg-warning" : "bg-success")} style={{ width: `${Math.min(100, guild.usagePercent)}%` }} />
                                </div>
                            </div>
                            {guild.overLimit && (
                                <span className="inline-flex items-center gap-1.5 bg-danger/10 border border-danger/30 text-danger text-caption font-black uppercase tracking-widest px-2 py-1 rounded-lg">
                                    <AlertTriangle className="w-3 h-3" /> Seuil dépassé
                                </span>
                            )}
                            <div className="flex items-center gap-2 border-l border-border pl-4">
                                <span className="text-caption font-black text-muted-foreground uppercase tracking-widest">Limite</span>
                                <StorageLimitEditor guildId={guild.guildId} limitBytes={guild.limitBytes} onSaved={onReload} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            <StorageMiniItem type="MISSION" count={guild.missionsCount} bytes={guild.missionsBytes} files={guild.missionsFiles} dir={guild.missionsDir} pendingFiles={guild.pendingFiles} onReload={onReload} guildName={guild.name} />
                            <StorageMiniItem type="KAMA" count={guild.kamaCount} bytes={guild.kamaBytes} files={guild.kamaFiles} dir={guild.kamaDir} pendingFiles={guild.pendingFiles} onReload={onReload} guildName={guild.name} />
                            <StorageMiniItem type="ACHIEVEMENT" count={guild.achievementCount} bytes={guild.achievementBytes} files={guild.achievementFiles} dir={guild.achievementDir} pendingFiles={guild.pendingFiles} onReload={onReload} guildName={guild.name} />
                            <StorageMiniItem type="PRESENTATION" count={guild.presentationCount} bytes={guild.presentationBytes} files={guild.presentationFiles} dir={guild.presentationDir} pendingFiles={guild.pendingFiles} onReload={onReload} guildName={guild.name} />
                        </div>

                        <GuildAssetsStrip guild={guild} onReload={onReload} />
                    </td>
                </tr>
            )}
        </>
    );
}

function Lightbox({ item, onClose, onDeleted }: { item: LightboxItem; onClose: () => void; onDeleted: () => void }) {
    const cfg = TYPE_CFG[item.type as keyof typeof TYPE_CFG] || TYPE_CFG.MISSION;
    const [isZoomed, setIsZoomed] = useState(false);
    
    return (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col p-4 md:p-8 animate-in fade-in duration-300">
            <div className="absolute inset-0" onClick={onClose} />
            <div className="relative w-full max-w-6xl mx-auto h-full flex flex-col space-y-6" onClick={e => e.stopPropagation()}>
                {/* Header pinned to top */}
                <div className="flex-none flex items-center justify-between px-2 md:px-6">
                    <div className="flex items-center gap-4">
                        <div className={cn("p-3 rounded-2xl hidden md:block", cfg.bg, cfg.color)}>
                            <ImageIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm md:text-xl font-black text-foreground uppercase tracking-tight truncate max-w-[200px] md:max-w-md">{item.filename}</p>
                            <p className="text-xs font-medium text-muted-foreground">{formatBytes(item.sizeBytes || 0)} · {item.label}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <DeleteButton fileUrl={item.url} onDeleted={onDeleted} label="Supprimer Définitivement" />
                        <button onClick={onClose} className="p-3 shrink-0 text-muted-foreground hover:text-foreground transition-colors bg-surface rounded-2xl hover:bg-surface">
                            <X className="w-5 h-5 md:w-6 md:h-6" />
                        </button>
                    </div>
                </div>
                
                {/* Image restricted to available height */}
                <div 
                    className={cn(
                        "flex-1 min-h-0 relative rounded-[2rem] bg-black/50 border border-border shadow-2xl p-4 transition-all",
                        isZoomed ? "overflow-auto flex items-start justify-start cursor-zoom-out" : "overflow-hidden flex items-center justify-center text-center cursor-zoom-in"
                    )}
                    onClick={() => setIsZoomed(!isZoomed)}
                >
                    <img 
                        src={item.url} 
                        alt="Aperçu" 
                        className={cn(
                            "select-none transition-transform duration-300",
                            isZoomed ? "w-auto h-auto max-w-none max-h-none origin-top-left" : "max-h-full max-w-full object-contain"
                        )}
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement?.setAttribute('data-error', 'Image indisponible (404/403) ou corrompue');
                        }}
                    />
                    <style jsx>{`
                        div[data-error]::before {
                            content: attr(data-error);
                            color: #ef4444;
                            font-size: 14px;
                            font-weight: 900;
                            text-transform: uppercase;
                        }
                    `}</style>
                </div>
            </div>
        </div>
    );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import {
    getStorageOverview, godDeleteFile, setGuildStorageLimit, getGuildLogsStats,
    type StorageGuildEntry, type StorageOverview, type PendingFile, type GuildAsset, type AssetDbField, type DiskFile
} from "@/server/actions/storage-actions";
import {
    HardDrive, FolderOpen, Loader2, RefreshCw,
    FileImage, Coins, Trophy, Shield, Search, Clock, Image as ImageIcon,
    X, Trash2, Handshake, ScrollText, AlertTriangle,
    LayoutGrid, List, ChevronRight
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getInternalSystemStatus } from "@/server/actions/god-system-actions";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "Ko", "Mo", "Go"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const TYPE_CFG = {
    MISSION: { label: "Mission", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20", dot: "bg-rose-500", barColor: "bg-rose-500" },
    KAMA: { label: "Kamas & Coffres", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", dot: "bg-amber-500", barColor: "bg-amber-500" },
    ACHIEVEMENT: { label: "Succès", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", dot: "bg-purple-500", barColor: "bg-purple-500" },
    LOAN_PROOF: { label: "Prêt & Coffre", color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20", dot: "bg-cyan-500", barColor: "bg-cyan-500" },
    PRESENTATION: { label: "Présentation Guilde", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", dot: "bg-emerald-500", barColor: "bg-emerald-500" },
    ICON: { label: "Icône", color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20", dot: "bg-sky-500", barColor: "bg-sky-500" },
    BANNER: { label: "Bannière de guilde", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", dot: "bg-emerald-500", barColor: "bg-emerald-500" },
    PHOTO: { label: "Photo de guilde", color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20", dot: "bg-indigo-500", barColor: "bg-indigo-500" },
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
            <span className="text-[10px] font-mono text-zinc-300 font-black tracking-tighter uppercase whitespace-nowrap bg-zinc-950 px-2 py-1 rounded-lg border border-white/10 shadow-sm">SigilOS /</span>
            {segments.map((seg, i) => {
                const isId = (seg.length > 20 && /^[a-z0-9]+$/.test(seg)) || /^\d{17,20}$/.test(seg);
                if (!seg) return null;
                const label = isId && guildName ? guildName : seg;
                return (
                    <div key={i} className="flex items-center gap-1.5">
                        <span 
                            title={isId && guildName ? `${seg} (${guildName})` : seg} 
                            className={cn(
                                "text-[10px] font-mono font-black px-2 py-1.5 rounded-lg border shadow-sm transition-all whitespace-nowrap",
                                isId ? "text-emerald-400/80 bg-emerald-500/5 border-emerald-500/20" : `${colorClass} bg-zinc-900 border-white/[0.15] opacity-90`
                            )}
                        >
                            {label}
                        </span>
                        {i < segments.length - 1 && <span className="text-zinc-700 text-[10px] font-mono font-black mx-0.5">/</span>}
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

    if (expired) return <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-red-500/20 text-red-500 uppercase">PRÊT POUR NETTOYAGE</span>;
    return (
        <span className={cn(
            "text-[8px] font-mono font-black px-1.5 py-0.5 rounded flex items-center gap-1.5 whitespace-nowrap", 
            urgent ? "bg-red-500/10 text-red-400 animate-pulse" : "bg-zinc-800 text-zinc-400"
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
            <DialogContent className="max-w-5xl bg-zinc-950 border-white/5 p-0 overflow-hidden outline-none">
                <DialogHeader className="p-6 border-b border-white/10 bg-zinc-900/80 backdrop-blur-md">
                    <div className="flex items-center gap-4 text-left">
                        <div className={cn("p-3 rounded-2xl shadow-xl", cfg.bg, cfg.color)}>
                            <FolderOpen className="w-6 h-6" />
                        </div>
                        <div>
                            <DialogTitle className="text-2xl font-black text-white uppercase tracking-tight">{label}</DialogTitle>
                            <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mt-1 opacity-80">{files.length} fichiers physiques</p>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-6 max-h-[60vh] overflow-y-auto no-scrollbar">
                    {files.length === 0 ? (
                        <div className="text-center py-20 text-zinc-700 text-xs font-bold uppercase tracking-widest border-2 border-dashed border-white/5 rounded-[2rem]">
                            Aucun fichier physique détecté
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {files.map((f, i) => (
                                <div key={i} className="group relative rounded-[1.5rem] overflow-hidden border border-white/5 bg-zinc-900/50 hover:border-white/20 transition-all aspect-square">
                                    <button 
                                        className="absolute inset-0 z-10" 
                                        onClick={() => setLightbox({ url: f.url, type, label, filename: f.filename, sizeBytes: f.sizeBytes, isLocal: true, isPending: f.isPending, expiresAt: f.expiresAt })}
                                    />
                                    <img src={f.url} alt="" title={f.filename} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-500" />
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
                                                <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase tracking-widest flex items-center gap-1 shadow-2xl">
                                                    <Shield className="w-2 h-2" />
                                                    Permanent
                                                </span>
                                            );
                                        })()}
                                    </div>

                                    <div className="absolute bottom-3 left-3 right-3 space-y-0.5 pointer-events-none drop-shadow-md">
                                        <p className="text-[10px] font-black text-white truncate uppercase tracking-tighter">{f.filename}</p>
                                        <p className="text-[9px] font-mono font-black text-zinc-300 opacity-80">{formatBytes(f.sizeBytes)}</p>
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
            <DialogContent className="max-w-5xl bg-zinc-950 border-white/5 p-0 overflow-hidden outline-none">
                <DialogHeader className="p-6 border-b border-white/5 bg-zinc-900/50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-left">
                            <div className={cn("p-3 rounded-2xl bg-amber-500/10 text-amber-500 shadow-xl")}>
                                <Clock className="w-6 h-6" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-black text-white uppercase tracking-tighter leading-none">WAITING ROOM</DialogTitle>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mt-2">{label} — {files.length} submissions</p>
                            </div>
                        </div>
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 font-black px-3 py-1 text-[10px] tracking-widest uppercase">Expiration 24h</Badge>
                    </div>
                </DialogHeader>

                <div className="p-6 max-h-[60vh] overflow-y-auto no-scrollbar">
                    {files.length === 0 ? (
                        <div className="text-center py-20 text-zinc-700 text-xs font-bold uppercase tracking-widest border-2 border-dashed border-white/5 rounded-[2rem]">
                            Aucun record en attente
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {files.map((f, i) => (
                                <div key={i} className="group relative rounded-[1.5rem] overflow-hidden border border-white/5 bg-zinc-900/50 hover:border-white/20 transition-all aspect-square">
                                    <button 
                                        className="absolute inset-0 z-10" 
                                        onClick={() => setLightbox({ url: f.url, type: f.type, label: cfg.label, filename: f.filename, sizeBytes: f.sizeBytes, isLocal: true, expiresAt: f.expiresAt })}
                                    />
                                    <img src={f.url} alt="" title={f.memberName} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-500" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />
                                    
                                    <div className="absolute top-2 left-2 z-20">
                                        <CountdownChip providedExpiresAt={f.expiresAt} labelPrefix="EXP : " />
                                    </div>

                                    <div className="absolute bottom-3 left-3 right-3 space-y-0.5 pointer-events-none">
                                        <p className="text-[10px] font-black text-white truncate">{f.memberName}</p>
                                        <p className="text-[8px] font-mono text-zinc-500">{formatBytes(f.sizeBytes)}</p>
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
    const [systemStatus, setSystemStatus] = useState<any>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [sortBy, setSortBy] = useState<'size' | 'name' | 'files'>('size');
    const [page, setPage] = useState(1);
    const [logs, setLogs] = useState<Awaited<ReturnType<typeof getGuildLogsStats>>["data"] | null>(null);
    const PAGE_SIZE = 25;

    const load = useCallback(async () => {
        setLoading(true);
        const [res, status] = await Promise.all([getStorageOverview(), getInternalSystemStatus()]);
        if (res.success && res.data) setOverview(res.data);
        if (status) setSystemStatus(status);
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
            <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
            <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em] animate-pulse">Exploration physique...</span>
        </div>
    );

    const diskInfo = systemStatus?.disk;

    return (
        <div className="w-full space-y-8 pb-20">
            {/* Header & Stats */}
            <div className="flex flex-col xl:flex-row gap-8 items-start">
                <div className="w-full xl:w-[400px] 2xl:w-[450px] space-y-6">
                    <div className="p-8 rounded-[3rem] bg-zinc-900/10 border border-white/5 backdrop-blur-3xl relative overflow-hidden group shadow-2xl">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-[50px] rounded-full -mr-10 -mt-10" />
                        
                        <div className="flex items-center justify-between mb-10">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
                                    <HardDrive className="w-6 h-6" />
                                </div>
                                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Stockage</h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center bg-black/40 rounded-xl p-1 border border-white/5 mr-2">
                                    <button 
                                        onClick={() => setViewMode('grid')}
                                        className={cn("p-2 rounded-lg transition-all", viewMode === 'grid' ? "bg-indigo-500 text-black" : "text-zinc-500 hover:text-white")}
                                    >
                                        <LayoutGrid className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => setViewMode('list')}
                                        className={cn("p-2 rounded-lg transition-all", viewMode === 'list' ? "bg-indigo-500 text-black" : "text-zinc-500 hover:text-white")}
                                    >
                                        <List className="w-4 h-4" />
                                    </button>
                                </div>
                                <button onClick={load} className="p-2 text-zinc-500 hover:text-white transition-colors">
                                    <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-6 relative z-10">
                            <div className="space-y-1">
                                <div className="flex items-baseline gap-2">
                                    <p className="text-[40px] font-black text-white tracking-tighter leading-none">{formatBytes(overview?.totalBytes || 0)}</p>
                                    {diskInfo && <span className="text-[10px] font-black text-zinc-400">/ {diskInfo.totalMb} Mo</span>}
                                </div>
                                <p className="text-[10px] font-black text-zinc-300 uppercase tracking-[0.2em] mt-1 opacity-90">Occupé par SigilOS</p>
                            </div>

                            <div className="pt-6 border-t border-white/10 flex gap-12">
                                <div className="space-y-1">
                                    <p className="text-xl font-black text-white leading-none">{overview?.totalFiles || 0}</p>
                                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mt-1">Fichiers</p>
                                </div>
                                <button onClick={() => setOrphansOpen(true)} className="space-y-1 text-left group/btn">
                                    <p className={cn("text-2xl font-black leading-none transition-colors", (overview?.orphanFiles.length || 0) > 0 ? "text-rose-500 group-hover/btn:text-rose-400" : "text-emerald-500 font-black")}>
                                        {overview?.orphanFiles.length || 0}
                                    </p>
                                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mt-1 group-hover/btn:text-white transition-colors underline decoration-dotted underline-offset-4">Orphelins</p>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Search Filter */}
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-amber-500 transition-colors">
                            <Search className="w-4 h-4" />
                        </div>
                        <input
                            type="text"
                            placeholder="RECHERCHER UNE GUILDE..."
                            value={searchTerm}
                            onChange={(e) => changeSearch(e.target.value)}
                            className="w-full bg-zinc-900/20 border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-[10px] font-black uppercase tracking-widest focus:border-amber-500/50 focus:bg-zinc-900/40 transition-all outline-none"
                        />
                    </div>
                </div>

                <div className="flex-1 w-full overflow-hidden">
                    {/* Tri + pagination (scalabilité : centaines de guildes) */}
                    <div className="flex items-center justify-between gap-4 pb-4">
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Tri</span>
                            <div className="flex gap-1 p-1 bg-white/[0.02] border border-white/5 rounded-xl">
                                {([['size', 'Taille'], ['name', 'Nom'], ['files', 'Fichiers']] as const).map(([key, label]) => (
                                    <button
                                        key={key}
                                        onClick={() => setSortBy(key)}
                                        className={cn(
                                            "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                            sortBy === key ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
                                        )}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-mono font-black text-zinc-500">{sortedGuilds.length} guildes</span>
                            {totalPages > 1 && (
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => setPage(Math.max(1, currentPage - 1))}
                                        disabled={currentPage <= 1}
                                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-black disabled:opacity-30 transition-all"
                                    >
                                        ‹
                                    </button>
                                    <span className="text-[10px] font-mono font-black text-zinc-300">{currentPage} / {totalPages}</span>
                                    <button
                                        onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                                        disabled={currentPage >= totalPages}
                                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-black disabled:opacity-30 transition-all"
                                    >
                                        ›
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {viewMode === 'grid' ? (
                        <div className={cn(
                            "grid gap-10 lg:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3"
                        )}>
                            {pagedGuilds.map((guild) => (
                                <GuildCard key={guild.guildId} guild={guild} onReload={load} />
                            ))}
                        </div>
                    ) : (
                        <div className="bg-zinc-900/10 border border-white/5 rounded-[3rem] overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-white/5">
                                    <tr>
                                        <th className="px-8 py-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-white/5">Guilde</th>
                                        <th className="px-8 py-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-white/5 text-right font-mono">Taille Totale</th>
                                        <th className="px-8 py-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-white/5 text-center">Fichiers</th>
                                        <th className="px-8 py-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-white/5">Répartition</th>
                                        <th className="px-8 py-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-white/5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedGuilds.map((guild) => (
                                        <GuildRow key={guild.guildId} guild={guild} onReload={load} />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {sortedGuilds.length === 0 && (
                        <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[3rem] text-zinc-700 text-xs font-black uppercase tracking-[0.3em]">
                            Aucune correspondance physique
                        </div>
                    )}
                </div>

                {/* Logs par guilde (30 jours) */}
                {logs && (
                    <div className="p-8 rounded-[3rem] bg-zinc-900/10 border border-white/5 backdrop-blur-3xl space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                                <ScrollText className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white uppercase tracking-widest">Logs par Guilde</h3>
                                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">30 derniers jours — activité (services/modules) + audit sécurité</p>
                            </div>
                            <div className="ml-auto text-right">
                                <p className="text-2xl font-black text-white leading-none">{logs.totals.total}</p>
                                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mt-1">logs au total</p>
                            </div>
                        </div>

                        <div className="overflow-x-auto no-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-white/5">
                                    <tr>
                                        <th className="px-5 py-3 text-[9px] font-black text-zinc-500 uppercase tracking-widest border-b border-white/5">Guilde</th>
                                        <th className="px-5 py-3 text-[9px] font-black text-zinc-500 uppercase tracking-widest border-b border-white/5 text-right">Activité</th>
                                        <th className="px-5 py-3 text-[9px] font-black text-zinc-500 uppercase tracking-widest border-b border-white/5 text-right">Audit</th>
                                        <th className="px-5 py-3 text-[9px] font-black text-zinc-500 uppercase tracking-widest border-b border-white/5 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.rows.slice(0, 15).map((row) => (
                                        <tr key={row.guildId} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                                            <td className="px-5 py-3 text-[11px] font-black text-white">{row.name}</td>
                                            <td className="px-5 py-3 text-[11px] font-mono text-zinc-400 text-right">{row.serviceLogs}</td>
                                            <td className="px-5 py-3 text-[11px] font-mono text-zinc-400 text-right">{row.auditLogs}</td>
                                            <td className="px-5 py-3 text-[11px] font-mono font-black text-zinc-200 text-right">{row.total}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Orphans Modal */}
            <FileExplorerDialog 
                open={orphansOpen} 
                onOpenChange={setOrphansOpen} 
                files={overview?.orphanFiles || []} 
                label="Fichiers Orphelins" 
                type="MISSION" 
                onDeleted={load} 
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
                className="w-16 h-7 rounded-lg bg-zinc-900 border border-white/10 text-[10px] font-mono px-2 text-zinc-200 focus:outline-none focus:border-emerald-500/40"
            />
            <span className="text-[9px] font-black text-zinc-500 uppercase">Mo</span>
            <button
                onClick={save}
                disabled={saving}
                className="h-7 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest text-zinc-300 disabled:opacity-50 transition-all"
            >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "OK"}
            </button>
        </div>
    );
}

function GuildCard({ guild, onReload }: { guild: StorageGuildEntry; onReload: () => void }) {
    const subTotal = guild.missionsBytes + guild.kamaBytes + guild.achievementBytes + guild.presentationBytes;
    const totalCount = guild.missionsCount + guild.kamaCount + guild.achievementCount + guild.presentationCount;
    
    return (
        <div className="p-8 rounded-[3rem] bg-zinc-900/10 border border-white/5 backdrop-blur-3xl space-y-8 relative group overflow-hidden">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-950 border border-white/5 flex items-center justify-center overflow-hidden shrink-0">
                        {guild.assets.find(a => a.type === "ICON") ? (
                            <img src={guild.assets.find(a => a.type === "ICON")!.url} alt="" className="w-full h-full object-cover" />
                        ) : <Shield className="w-5 h-5 text-zinc-600" />}
                    </div>
                    <div>
                        <h3 className="text-base font-black text-white uppercase tracking-tighter">{guild.name}</h3>
                        <p className="text-[10px] font-mono font-black text-zinc-400 tracking-tighter opacity-80">{guild.discordGuildId}</p>
                    </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                    {guild.overLimit && (
                        <span className="inline-flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 text-red-500 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg">
                            <AlertTriangle className="w-3 h-3" /> Seuil dépassé
                        </span>
                    )}
                    <p className="text-2xl font-black text-white tracking-tighter">{formatBytes(subTotal)}</p>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest opacity-90">{totalCount} fichiers</p>
                </div>
            </div>

            {/* Seuil & utilisation */}
            <div className="flex items-center gap-3 bg-black/30 border border-white/5 rounded-2xl px-4 py-3">
                <div className="flex-1">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Utilisation du seuil</span>
                        <span className="text-[10px] font-mono font-black text-zinc-300">{guild.usagePercent}%</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", guild.usagePercent > 100 ? "bg-red-500" : guild.usagePercent > 80 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${Math.min(100, guild.usagePercent)}%` }} />
                    </div>
                </div>
                <div className="flex items-center gap-2 border-l border-white/10 pl-4">
                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Limite</span>
                    <StorageLimitEditor guildId={guild.guildId} limitBytes={guild.limitBytes} onSaved={onReload} />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <StorageMiniItem type="MISSION" count={guild.missionsCount} bytes={guild.missionsBytes} files={guild.missionsFiles} dir={guild.missionsDir} pendingFiles={guild.pendingFiles} onReload={onReload} guildName={guild.name} />
                <StorageMiniItem type="KAMA" count={guild.kamaCount} bytes={guild.kamaBytes} files={guild.kamaFiles} dir={guild.kamaDir} pendingFiles={guild.pendingFiles} onReload={onReload} guildName={guild.name} />
                <StorageMiniItem type="ACHIEVEMENT" count={guild.achievementCount} bytes={guild.achievementBytes} files={guild.achievementFiles} dir={guild.achievementDir} pendingFiles={guild.pendingFiles} onReload={onReload} guildName={guild.name} />
                <StorageMiniItem type="LOAN_PROOF" count={guild.loansProofsCount} bytes={guild.loansProofsBytes} files={guild.loansProofsFiles} dir={guild.loansProofsDir} pendingFiles={guild.pendingFiles} onReload={onReload} guildName={guild.name} />
                <div className="col-span-2">
                    <StorageMiniItem type="PRESENTATION" count={guild.presentationCount} bytes={guild.presentationBytes} files={guild.presentationFiles} dir={guild.presentationDir} pendingFiles={guild.pendingFiles} onReload={onReload} guildName={guild.name} />
                </div>
            </div>
            
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 blur-[30px] rounded-full -mr-12 -mt-12 opacity-0 group-hover:opacity-100 transition-opacity" />
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
                    count > 0 || myPending.length > 0 ? "bg-zinc-900/40 border-white/5" : "bg-zinc-950/20 border-white/[0.02] opacity-50 grayscale"
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
                                className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 rounded-xl text-amber-500 text-[10px] font-black uppercase tracking-widest transition-all border border-amber-500/20 shadow-xl flex items-center gap-2"
                            >
                                <Clock className="w-3.5 h-3.5" />
                                {myPending.length} EN ATTENTE
                            </button>
                        )}
                        {count > 0 && (
                            <button 
                                onClick={() => setExplorerOpen(true)}
                                className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-zinc-500 hover:text-white transition-all shadow-xl"
                            >
                                <FolderOpen className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">{cfg.label}</p>
                        <div className="flex items-center gap-2 mt-2">
                            <p className="text-[28px] font-black text-white tracking-tighter leading-none">{count}</p>
                            <p className="text-[10px] font-mono text-zinc-500 uppercase">{formatBytes(bytes)}</p>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-white/[0.03]">
                        <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                            <HardDrive className="w-2.5 h-2.5" />
                            Chemin Physique
                        </p>
                        <PathDisplay path={dir} colorClass={cfg.color} guildName={guildName} />
                        {earliestPending && (
                            <div className="mt-2 flex items-center gap-2">
                                <CountdownChip providedExpiresAt={earliestPending.expiresAt} labelPrefix="EXP : " />
                                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">auto-suppression</span>
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
        <button onClick={del} disabled={loading} className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl flex items-center gap-2 font-black uppercase text-[10px] tracking-widest transition-colors shadow-2xl" title={label}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 shrink-0" />}
            {label}
        </button>
    );
}

function GuildRow({ guild, onReload }: { guild: StorageGuildEntry; onReload: () => void }) {
    const subTotal = guild.missionsBytes + guild.kamaBytes + guild.achievementBytes + guild.presentationBytes;
    const totalCount = guild.missionsCount + guild.kamaCount + guild.achievementCount + guild.presentationCount;
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <>
            <tr className={cn(
                "group/row hover:bg-white/[0.02] transition-colors cursor-pointer border-b border-white/[0.02]",
                isExpanded && "bg-white/[0.03]"
            )} onClick={() => setIsExpanded(!isExpanded)}>
                <td className="px-8 py-6">
                    <div className="flex items-center gap-4 text-left">
                        <div className="w-8 h-8 rounded-lg bg-zinc-950 border border-white/5 flex items-center justify-center overflow-hidden shrink-0">
                            {guild.assets.find(a => a.type === "ICON") ? (
                                <img src={guild.assets.find(a => a.type === "ICON")!.url} alt="" className="w-full h-full object-cover" />
                            ) : <Shield className="w-3.5 h-3.5 text-zinc-600" />}
                        </div>
                        <div>
                            <p className="text-sm font-black text-white uppercase tracking-tighter group-hover/row:text-indigo-400 transition-colors leading-tight">{guild.name}</p>
                            <p className="text-[9px] font-mono font-bold text-zinc-600 tracking-tighter">{guild.discordGuildId}</p>
                        </div>
                    </div>
                </td>
                <td className="px-8 py-6 text-right font-mono font-black text-indigo-400">{formatBytes(subTotal)}</td>
                <td className="px-8 py-6 text-center font-black text-zinc-400 text-xs">{totalCount}</td>
                <td className="px-8 py-6">
                    <div className="flex items-center gap-1.5">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1 bg-rose-500/5 px-2 py-1 rounded-md border border-rose-500/10">
                                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                        <span className="text-[10px] font-black text-rose-500/80">{guild.missionsCount}</span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent className="bg-zinc-950 border-rose-500/20 text-rose-400 font-black text-[10px] uppercase tracking-widest">
                                    Missions: {formatBytes(guild.missionsBytes)}
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1 bg-amber-500/5 px-2 py-1 rounded-md border border-amber-500/10">
                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                        <span className="text-[10px] font-black text-amber-500/80">{guild.kamaCount}</span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent className="bg-zinc-950 border-amber-500/20 text-amber-400 font-black text-[10px] uppercase tracking-widest">
                                    Kamas: {formatBytes(guild.kamaBytes)}
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1 bg-purple-500/5 px-2 py-1 rounded-md border border-purple-500/10">
                                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                        <span className="text-[10px] font-black text-purple-500/80">{guild.achievementCount}</span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent className="bg-zinc-950 border-purple-500/20 text-purple-400 font-black text-[10px] uppercase tracking-widest">
                                    Succès: {formatBytes(guild.achievementBytes)}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </td>
                <td className="px-8 py-6 text-right">
                    <div className={cn("inline-flex items-center justify-center p-2 rounded-xl bg-white/5 transition-all", isExpanded && "bg-indigo-500 text-black shadow-lg shadow-indigo-500/20")}>
                        <ChevronRight className={cn("w-4 h-4 text-zinc-500 transition-all", isExpanded ? "rotate-90 text-black" : "group-hover/row:translate-x-1")} />
                    </div>
                </td>
            </tr>
            {isExpanded && (
                <tr className="bg-zinc-950 animate-in slide-in-from-top-2 duration-300">
                    <td colSpan={5} className="px-8 py-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                            <StorageMiniItem type="MISSION" count={guild.missionsCount} bytes={guild.missionsBytes} files={guild.missionsFiles} dir={guild.missionsDir} pendingFiles={guild.pendingFiles} onReload={onReload} guildName={guild.name} />
                            <StorageMiniItem type="KAMA" count={guild.kamaCount} bytes={guild.kamaBytes} files={guild.kamaFiles} dir={guild.kamaDir} pendingFiles={guild.pendingFiles} onReload={onReload} guildName={guild.name} />
                            <StorageMiniItem type="ACHIEVEMENT" count={guild.achievementCount} bytes={guild.achievementBytes} files={guild.achievementFiles} dir={guild.achievementDir} pendingFiles={guild.pendingFiles} onReload={onReload} guildName={guild.name} />
                            <StorageMiniItem type="LOAN_PROOF" count={guild.loansProofsCount} bytes={guild.loansProofsBytes} files={guild.loansProofsFiles} dir={guild.loansProofsDir} pendingFiles={guild.pendingFiles} onReload={onReload} guildName={guild.name} />
                            <StorageMiniItem type="PRESENTATION" count={guild.presentationCount} bytes={guild.presentationBytes} files={guild.presentationFiles} dir={guild.presentationDir} pendingFiles={guild.pendingFiles} onReload={onReload} guildName={guild.name} />
                        </div>
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
                            <p className="text-sm md:text-xl font-black text-white uppercase tracking-tight truncate max-w-[200px] md:max-w-md">{item.filename}</p>
                            <p className="text-xs font-medium text-zinc-500">{formatBytes(item.sizeBytes || 0)} · {item.label}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <DeleteButton fileUrl={item.url} onDeleted={onDeleted} label="Supprimer Définitivement" />
                        <button onClick={onClose} className="p-3 shrink-0 text-zinc-500 hover:text-white transition-colors bg-white/5 rounded-2xl hover:bg-white/10">
                            <X className="w-5 h-5 md:w-6 md:h-6" />
                        </button>
                    </div>
                </div>
                
                {/* Image restricted to available height */}
                <div 
                    className={cn(
                        "flex-1 min-h-0 relative rounded-[2rem] bg-black/50 border border-white/5 shadow-2xl p-4 transition-all",
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

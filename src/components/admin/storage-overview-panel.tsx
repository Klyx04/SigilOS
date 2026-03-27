"use client";

import { useState, useEffect, useCallback } from "react";
import {
    getStorageOverview, godDeleteFile,
    type StorageGuildEntry, type StorageOverview, type PendingFile, type GuildAsset, type AssetDbField, type DiskFile
} from "@/server/actions/storage-actions";
import {
    HardDrive, FolderOpen, Loader2, AlertTriangle, RefreshCw,
    FileImage, Coins, Trophy, Shield, Search, Clock, Image as ImageIcon,
    X, Trash2, ExternalLink, Globe, ChevronDown, Handshake
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

function useCountdown(expiresAt: Date) {
    const getMs = () => Math.max(0, new Date(expiresAt).getTime() - Date.now());
    const [ms, setMs] = useState(getMs);
    useEffect(() => {
        const id = setInterval(() => setMs(getMs()), 1000);
        return () => clearInterval(id);
    });
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    const s = Math.floor((ms % 60_000) / 1_000);
    return { label: `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`, urgent: ms < 2 * 3_600_000, expired: ms === 0 };
}

const TYPE_CFG = {
    MISSION: { label: "Mission", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20", dot: "bg-rose-500", barColor: "bg-rose-500" },
    KAMA: { label: "Kamas & Coffres", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", dot: "bg-amber-500", barColor: "bg-amber-500" },
    ACHIEVEMENT: { label: "Succès", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", dot: "bg-purple-500", barColor: "bg-purple-500" },
    LOAN_PROOF: { label: "Prêt/Coffre", color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20", dot: "bg-cyan-500", barColor: "bg-cyan-500" },
    ICON: { label: "Icône", color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20", dot: "bg-sky-500", barColor: "bg-sky-500" },
    BANNER: { label: "Bannière de guilde", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", dot: "bg-emerald-500", barColor: "bg-emerald-500" },
    PHOTO: { label: "Photo de guilde", color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20", dot: "bg-indigo-500", barColor: "bg-indigo-500" },
};

// ─── Path Display ─────────────────────────────────────────────────────────────

function PathDisplay({ path, colorClass }: { path: string; colorClass: string }) {
    const clean = path.replace(/^\/uploads\//, "").replace(/\/$/, "");
    const segments = clean.split("/");
    return (
        <div className="mt-2 overflow-x-auto">
            <div className="flex items-center gap-0.5 min-w-max">
                <span className="text-xs text-zinc-600 font-mono select-all">/uploads/</span>
                {segments.map((seg, i) => {
                    const isCuid = seg.length > 20 && /^[a-z0-9]+$/.test(seg);
                    return (
                        <span key={i} className="flex items-center gap-0.5">
                            {i > 0 && <span className="text-zinc-700 text-xs mx-0.5">›</span>}
                            <span title={seg} className={cn("text-xs font-mono font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap", isCuid ? "text-zinc-500 bg-zinc-800/80" : `${colorClass} bg-zinc-800/80`)}>
                                {seg}
                            </span>
                        </span>
                    );
                })}
                <span className="text-zinc-600 text-xs font-mono ml-0.5">/</span>
            </div>
        </div>
    );
}

// ─── Storage Bar ─────────────────────────────────────────────────────────────

function StorageBar({ value, max, color }: { value: number; max: number; color: string }) {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
    return (
        <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${pct}%` }} />
        </div>
    );
}

// ─── Countdown chip ───────────────────────────────────────────────────────────

function CountdownChip({ expiresAt }: { expiresAt: Date }) {
    const { label, urgent, expired } = useCountdown(expiresAt);
    if (expired) return <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">EXPIRÉ</span>;
    return (
        <span className={cn("text-[9px] font-mono font-black px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0", urgent ? "bg-red-500/15 text-red-400 animate-pulse" : "bg-zinc-800 text-zinc-400")}>
            <Clock className="w-2.5 h-2.5" />{label}
        </span>
    );
}

// ─── Delete confirm button ────────────────────────────────────────────────────

function DeleteButton({ fileUrl, onDeleted, dbClear, label = "Supprimer" }: {
    fileUrl: string; onDeleted: () => void; label?: string;
    dbClear?: { guildId: string; field: AssetDbField };
}) {
    const [confirm, setConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        setDeleting(true);
        const res = await godDeleteFile(fileUrl, dbClear);
        setDeleting(false);
        if (res.success) { toast.success("Fichier supprimé du VPS"); onDeleted(); }
        else { toast.error(res.error || "Erreur suppression"); }
        setConfirm(false);
    };

    if (confirm) return (
        <div className="flex items-center gap-1">
            <button onClick={handleDelete} disabled={deleting}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black bg-red-500 text-white hover:bg-red-400 transition-colors disabled:opacity-50">
                {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                CONFIRMER
            </button>
            <button onClick={() => setConfirm(false)} className="text-zinc-600 hover:text-white px-1"><X className="w-3 h-3" /></button>
        </div>
    );
    return (
        <button onClick={() => setConfirm(true)} className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all" title={label}>
            <Trash2 className="w-3.5 h-3.5" />
        </button>
    );
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

type LightboxItem = { url: string; type: string; label: string; memberName?: string; sizeBytes?: number; expiresAt?: Date; isLocal?: boolean; filename?: string; dbClear?: { guildId: string; field: AssetDbField } };

function Lightbox({ item, onClose, onDeleted }: { item: LightboxItem; onClose: () => void; onDeleted: () => void }) {
    const cfg = TYPE_CFG[item.type as keyof typeof TYPE_CFG] || TYPE_CFG.MISSION;
    const isLocal = item.isLocal !== false && item.url.startsWith("/");

    return (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
            <div className="relative max-w-3xl w-full bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={cn("w-2 h-2 rounded-full shrink-0", cfg.dot)} />
                        <div className="min-w-0">
                            <p className="text-xs font-black text-white uppercase tracking-widest">
                                {cfg.label}{item.memberName ? ` — ${item.memberName}` : ""}
                            </p>
                            <p className="text-[9px] font-mono text-zinc-500 break-all mt-0.5">{item.filename || item.url}{item.sizeBytes ? ` · ${formatBytes(item.sizeBytes)}` : ""}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {item.expiresAt && <CountdownChip expiresAt={new Date(item.expiresAt)} />}
                        {!isLocal && <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-white"><ExternalLink className="w-4 h-4" /></a>}
                        {isLocal && <DeleteButton fileUrl={item.url} dbClear={item.dbClear} onDeleted={() => { onDeleted(); onClose(); }} label="Supprimer du VPS" />}
                        <button onClick={onClose} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
                    </div>
                </div>
                <div className="relative w-full max-h-[70vh] bg-black flex items-center justify-center overflow-hidden">
                    <img src={item.url} alt={item.label} className="max-h-[70vh] w-auto object-contain" />
                </div>
            </div>
        </div>
    );
}

// ─── Disk Files Gallery ───────────────────────────────────────────────────────

function DiskFilesGallery({ files, type, onReload }: { files: DiskFile[]; type: "MISSION" | "KAMA" | "ACHIEVEMENT"; onReload: () => void }) {
    const [lightbox, setLightbox] = useState<LightboxItem | null>(null);
    const [expanded, setExpanded] = useState(false);
    const cfg = TYPE_CFG[type];
    const shown = expanded ? files : files.slice(0, 8);

    if (files.length === 0) return (
        <div className="text-center py-3 text-zinc-700 text-[10px] font-bold uppercase tracking-widest">Aucun fichier</div>
    );

    return (
        <>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-4 gap-4">
                {shown.map((f, i) => (
                    <div key={i} className="group relative rounded-xl overflow-hidden border border-white/5 bg-zinc-950 hover:border-white/20 transition-all">
                        {/* Thumbnail */}
                        <button className="block w-full aspect-square overflow-hidden relative" onClick={() => setLightbox({ url: f.url, type, label: cfg.label, filename: f.filename, sizeBytes: f.sizeBytes, isLocal: true })}>
                            <img src={f.url} alt={f.filename} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                        </button>
                        {/* Delete on hover */}
                        <div className="absolute top-1 right-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                            <DeleteButton fileUrl={f.url} onDeleted={onReload} />
                        </div>
                        {/* Bottom info */}
                        <div className="px-1.5 py-1 space-y-0.5">
                            <p className="text-[8px] font-mono text-zinc-400 truncate" title={f.filename}>{f.filename}</p>
                            <p className="text-[7px] font-mono text-zinc-600">{formatBytes(f.sizeBytes)}</p>
                        </div>
                    </div>
                ))}
            </div>
            {files.length > 8 && (
                <button onClick={() => setExpanded(e => !e)} className="mt-2 w-full text-center text-[10px] font-black text-zinc-600 hover:text-white transition-colors flex items-center justify-center gap-1">
                    <ChevronDown className={cn("w-3 h-3 transition-transform", expanded && "rotate-180")} />
                    {expanded ? "Réduire" : `Voir ${files.length - 8} fichiers de plus`}
                </button>
            )}
            {lightbox && <Lightbox item={lightbox} onClose={() => setLightbox(null)} onDeleted={onReload} />}
        </>
    );
}

// ─── Guild Assets Gallery ─────────────────────────────────────────────────────

function AssetsGallery({ assets, guildId, onReload }: { assets: GuildAsset[]; guildId: string; onReload: () => void }) {
    const [lightbox, setLightbox] = useState<LightboxItem | null>(null);

    if (assets.length === 0) return (
        <div className="text-center py-4 text-zinc-700 text-xs font-bold uppercase tracking-widest">Aucun asset configuré</div>
    );

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 gap-4">
                {assets.map((a, i) => {
                    const cfg = TYPE_CFG[a.type] || TYPE_CFG.ICON;
                    const isDiscord = !a.isLocal;
                    const dbClear = a.isLocal && a.dbField ? { guildId, field: a.dbField as AssetDbField } : undefined;
                    const friendlyLabel = a.type === "BANNER" ? "Bannière de guilde" : a.type === "PHOTO" ? "Photo de guilde" : "Icône de guilde";
                    return (
                        <div key={i} className="group relative rounded-xl overflow-hidden border border-white/5 bg-zinc-900/60 hover:border-white/20 transition-all">
                            <button className="relative block w-full aspect-video overflow-hidden" onClick={() => setLightbox({ url: a.url, type: a.type, label: friendlyLabel, isLocal: a.isLocal, dbClear })}>
                                <img src={a.url} alt={friendlyLabel} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                            </button>
                            <div className="flex items-center justify-between px-3 py-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">{friendlyLabel}</p>
                                        {isDiscord && <span className="text-[8px] font-black px-1 py-px rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-0.5 w-fit mt-0.5"><Globe className="w-2 h-2" />CDN Discord</span>}
                                        {a.isLocal && <p className="text-[8px] font-mono text-zinc-600 truncate mt-0.5" title={a.url}>{a.url}</p>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                    {isDiscord ? (
                                        <a href={a.url} target="_blank" rel="noopener noreferrer" className="p-1 text-zinc-500 hover:text-white"><ExternalLink className="w-3.5 h-3.5" /></a>
                                    ) : (
                                        <DeleteButton fileUrl={a.url} dbClear={dbClear} onDeleted={onReload} label="Supprimer l'asset du VPS" />
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            {lightbox && <Lightbox item={lightbox} onClose={() => setLightbox(null)} onDeleted={onReload} />}
        </>
    );
}

// ─── Pending Gallery ─────────────────────────────────────────────────────────

function PendingGallery({ files, onReload }: { files: PendingFile[]; onReload: () => void }) {
    const [lightbox, setLightbox] = useState<LightboxItem | null>(null);
    if (files.length === 0) return <div className="text-center py-6 text-zinc-700 text-xs font-bold uppercase tracking-widest">Aucun fichier en attente</div>;
    return (
        <>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-4 gap-4">
                {files.map(f => {
                    const cfg = TYPE_CFG[f.type];
                    return (
                        <div key={f.submissionId} className="group relative rounded-xl overflow-hidden border border-white/5 bg-zinc-900/60 aspect-square hover:border-white/20 transition-all hover:scale-[1.02]">
                            <button className="absolute inset-0 z-10" onClick={() => setLightbox({ url: f.url, type: f.type, label: cfg.label, memberName: f.memberName, sizeBytes: f.sizeBytes, expiresAt: f.expiresAt, isLocal: true, filename: f.filename })} />
                            <img src={f.url} alt={f.memberName} className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />
                            <div className={cn("absolute top-2 left-2 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border", cfg.bg, cfg.color, cfg.border)}>{cfg.label}</div>
                            <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                                <DeleteButton fileUrl={f.url} onDeleted={onReload} />
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 p-2 space-y-1 pointer-events-none">
                                <p className="text-[9px] font-black text-white truncate">{f.memberName}</p>
                                <CountdownChip expiresAt={new Date(f.expiresAt)} />
                            </div>
                        </div>
                    );
                })}
            </div>
            {lightbox && <Lightbox item={lightbox} onClose={() => setLightbox(null)} onDeleted={onReload} />}
        </>
    );
}

// ─── Category Block ───────────────────────────────────────────────────────────

type CategorySection = "files" | "pending" | null;

function CategoryBlock({
    type, dir, count, bytes, totalBytes, files, pending, pendingFiles, activeLoanProofs, onReload
}: {
    type: "MISSION" | "KAMA" | "ACHIEVEMENT" | "LOAN_PROOF";
    dir: string; count: number; bytes: number; totalBytes: number;
    files: DiskFile[];
    pending: number; pendingFiles: PendingFile[];
    activeLoanProofs?: number;
    onReload: () => void;
}) {
    const [section, setSection] = useState<CategorySection>(null);
    const cfg = TYPE_CFG[type];
    const icon = type === "MISSION" ? <FileImage className="w-3.5 h-3.5" /> :
        type === "KAMA" ? <Coins className="w-3.5 h-3.5" /> :
            type === "LOAN_PROOF" ? <Handshake className="w-3.5 h-3.5" /> :
                <Trophy className="w-3.5 h-3.5" />;
    const myPending = pendingFiles.filter(f => f.type === type);
    const toggle = (s: CategorySection) => setSection(p => p === s ? null : s);

    return (
        <div className={cn("rounded-xl border overflow-hidden", cfg.bg, cfg.border)}>
            {/* Header */}
            <div className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                    <div className={cn("flex items-center gap-1.5", cfg.color)}>
                        {icon}
                        <span className="text-[10px] font-black uppercase tracking-widest">{cfg.label}s</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {myPending.length > 0 && (
                            <button onClick={() => toggle("pending")}
                                className={cn("flex items-center gap-1 text-[9px] font-black px-2 py-1 rounded-md border shadow-sm transition-all hover:-translate-y-0.5",
                                    section === "pending" ? "bg-yellow-400 text-black border-yellow-400" : "bg-yellow-500/20 text-yellow-300 border-yellow-500/30 hover:bg-yellow-500/30")}>
                                <Clock className="w-3 h-3" /> {myPending.length} En attente
                            </button>
                        )}
                        {count > 0 && (
                            <button onClick={() => toggle("files")}
                                className={cn("flex items-center gap-1 text-[9px] font-black px-2 py-1 rounded-md border shadow-sm transition-all hover:-translate-y-0.5",
                                    section === "files" ? "bg-white text-black border-white" : `${cfg.bg} ${cfg.color} ${cfg.border} hover:opacity-80`)}>
                                <FolderOpen className="w-3 h-3" />
                                {section === "files" ? "Masquer" : `Voir ${count} fichier${count > 1 ? "s" : ""}`}
                            </button>
                        )}
                    </div>
                </div>
                <StorageBar value={bytes} max={totalBytes || 1} color={cfg.barColor} />
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono font-bold">
                    <span>{count} fichier{count !== 1 ? "s" : ""}</span>
                    <span>{formatBytes(bytes)}</span>
                </div>
                {pending > 0 && (
                    <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 bg-yellow-500/10 text-yellow-400 border-yellow-500/20 font-black self-start w-fit">{pending} record(s) BDD en délai d'attente</Badge>
                )}
                {type === "KAMA" && activeLoanProofs !== undefined && activeLoanProofs > 0 && (
                    <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 bg-cyan-500/10 text-cyan-400 border-cyan-500/20 font-black self-start w-fit">{activeLoanProofs} prêts/coffre actifs enregistrés</Badge>
                )}
                <PathDisplay path={dir} colorClass={cfg.color} />
            </div>

            {/* Gallery: real disk files */}
            {section === "files" && files.length > 0 && (
                <div className="border-t border-white/5 p-3 space-y-2">
                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Fichiers sur disque</p>
                    <DiskFilesGallery files={files} type={type === "LOAN_PROOF" ? "MISSION" : type} onReload={onReload} />
                </div>
            )}

            {/* Gallery: pending */}
            {section === "pending" && myPending.length > 0 && (
                <div className="border-t border-white/5 p-3 space-y-2">
                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5 text-yellow-400" />En attente de validation
                    </p>
                    <PendingGallery files={myPending} onReload={onReload} />
                </div>
            )}
        </div>
    );
}

// ─── Guild Row ────────────────────────────────────────────────────────────────

function GuildStorageRow({ guild, maxBytes, onReload }: { guild: StorageGuildEntry; maxBytes: number; onReload: () => void }) {
    const [showAssets, setShowAssets] = useState(false);
    const totalBytes = guild.missionsBytes + guild.kamaBytes + guild.achievementBytes;
    const totalFiles = guild.missionsCount + guild.kamaCount + guild.achievementCount;

    return (
        <div className="rounded-2xl border border-white/5 bg-zinc-900/30 hover:bg-zinc-900/40 transition-all">
            <div className="p-5 space-y-5">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                        {guild.assets.find(a => a.type === "ICON") ? (
                            <img src={guild.assets.find(a => a.type === "ICON")!.url} alt="" className="w-10 h-10 rounded-xl object-cover" />
                        ) : <Shield className="w-4 h-4 text-indigo-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-black text-white truncate uppercase tracking-tight">{guild.name}</p>
                        <p className="text-[9px] text-zinc-600 font-mono">{guild.discordGuildId}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                        {guild.assets.length > 0 && (
                            <button onClick={() => setShowAssets(v => !v)}
                                className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all",
                                    showAssets ? "bg-white text-black border-white" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20")}>
                                <ImageIcon className="w-3 h-3" /> {guild.assets.length} asset{guild.assets.length > 1 ? "s" : ""}
                            </button>
                        )}
                        <div className="text-right">
                            <p className="text-sm font-black text-white font-mono">{formatBytes(totalBytes)}</p>
                            <p className="text-[9px] text-zinc-500">{totalFiles} fichiers</p>
                        </div>
                    </div>
                </div>

                {/* Global bar */}
                <div className="px-2">
                    <StorageBar value={totalBytes} max={maxBytes} color="bg-indigo-500" />
                </div>

                {/* 3 category blocks: missions, kamas/vault, succès */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <CategoryBlock type="MISSION" dir={guild.missionsDir}
                        count={guild.missionsCount} bytes={guild.missionsBytes} totalBytes={totalBytes}
                        files={guild.missionsFiles} pending={guild.pendingMissions}
                        pendingFiles={guild.pendingFiles} onReload={onReload} />
                    <CategoryBlock type="KAMA" dir={guild.kamaDir}
                        count={guild.kamaCount} bytes={guild.kamaBytes} totalBytes={totalBytes}
                        files={guild.kamaFiles} pending={guild.pendingKamas}
                        pendingFiles={guild.pendingFiles} activeLoanProofs={guild.activeLoanProofs} onReload={onReload} />
                    <CategoryBlock type="ACHIEVEMENT" dir={guild.achievementDir}
                        count={guild.achievementCount} bytes={guild.achievementBytes} totalBytes={totalBytes}
                        files={guild.achievementFiles} pending={0}
                        pendingFiles={guild.pendingFiles} onReload={onReload} />
                </div>

                {/* Assets (only if any) */}
                {guild.assets.length > 0 && showAssets && (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-3">
                        <div className="flex items-center gap-2">
                            <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Assets de présentation</span>
                            <span className="text-[9px] text-zinc-600">(CDN Discord = lecture seule)</span>
                        </div>
                        <AssetsGallery assets={guild.assets} guildId={guild.guildId} onReload={onReload} />
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function StorageOverviewPanel() {
    const [data, setData] = useState<StorageOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        const res = await getStorageOverview();
        if (res.success && res.data) setData(res.data);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const filtered = data?.guilds.filter(g =>
        g.name.toLowerCase().includes(search.toLowerCase()) || g.discordGuildId.includes(search)
    ) ?? [];

    const maxBytes = data ? Math.max(...data.guilds.map(g => g.missionsBytes + g.kamaBytes + g.achievementBytes), 1) : 1;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                        <HardDrive className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-widest">Cartographie du Stockage VPS</h3>
                        <p className="text-[10px] text-zinc-500 font-mono mt-0.5 select-all">~/SigilOS/public/uploads/</p>
                    </div>
                </div>
                <Button variant="ghost" size="sm" onClick={load} disabled={loading}
                    className="h-8 w-8 p-0 rounded-xl border border-white/5 text-zinc-500 hover:text-white">
                    <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                </Button>
            </div>

            {/* Global stats */}
            {data && (
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: "Total utilisé", value: formatBytes(data.totalBytes), accent: false },
                        { label: "Fichiers totaux", value: String(data.totalFiles), accent: false },
                        { label: "Fichiers orphelins", value: String(data.orphanFiles.length), accent: data.orphanFiles.length > 0 },
                    ].map(({ label, value, accent }) => (
                        <div key={label} className={cn("p-4 rounded-2xl border text-center", accent ? "border-amber-500/20 bg-amber-500/5" : "border-white/5 bg-zinc-900/30")}>
                            <p className={cn("text-2xl font-black font-mono", accent ? "text-amber-400" : "text-white")}>{value}</p>
                            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-1">{label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-5 text-[9px] font-black uppercase tracking-widest text-zinc-600 flex-wrap">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500" />Missions</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500" />Kamas</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-purple-500" />Succès</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-cyan-500" />Prêts &amp; Coffre</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" />Assets guilde</div>
            </div>

            {/* Search */}
            {data && data.guilds.length > 1 && (
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Filtrer par nom de guilde ou Discord ID…"
                        className="w-full h-9 pl-9 pr-8 text-xs bg-zinc-900/50 border border-white/5 rounded-xl text-white placeholder:text-zinc-700 focus:outline-none focus:border-indigo-500/40 font-mono" />
                    {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white"><X className="w-3 h-3" /></button>}
                </div>
            )}

            {/* Orphan warning */}
            {data && data.orphanFiles.length > 0 && (
                <div className="flex flex-col gap-3 px-4 py-3 rounded-2xl border border-amber-500/20 bg-amber-500/5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                            <p className="text-xs text-amber-300">
                                <span className="font-black">{data.orphanFiles.length} fichier(s) abandonné(s)</span> sur le disque sans correspondances BDD après 4h.
                            </p>
                        </div>
                        <Button 
                            size="sm"
                            disabled={loading}
                            onClick={async () => {
                                setLoading(true);
                                const { cleanOrphanStorage } = await import("@/server/actions/storage-actions");
                                const res = await cleanOrphanStorage();
                                if (res.success) {
                                    toast.success(`${res.deletedCount} fichier(s) orphelin(s) supprimé(s).`);
                                    load();
                                } else {
                                    toast.error(res.error || "Erreur de nettoyage.");
                                    setLoading(false);
                                }
                            }}
                            className="bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500 hover:text-black font-black uppercase text-[10px] h-8 px-3"
                        >
                            Purger {data.orphanFiles.length} fichier{data.orphanFiles.length > 1 ? "s" : ""}
                        </Button>
                    </div>

                    <div className="mt-2 border-t border-amber-500/20 pt-3">
                        <div className="flex items-center gap-2 mb-2 text-amber-500/80">
                            <FolderOpen className="w-3.5 h-3.5" />
                            <p className="text-[10px] uppercase font-black tracking-widest text-inherit">Aperçu avant purge :</p>
                        </div>
                        {/* We use 'MISSION' type to render standard image previews */}
                        <DiskFilesGallery files={data.orphanFiles} type="MISSION" onReload={load} />
                    </div>
                </div>
            )}

            {/* Existing pending and assets... */}

            {/* Guild list */}
            {loading ? (
                <div className="flex items-center justify-center py-16 text-zinc-600 gap-3">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm font-bold uppercase tracking-widest">Scan VPS en cours…</span>
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-zinc-600 gap-2">
                    <FolderOpen className="w-10 h-10 opacity-30" />
                    <p className="text-sm font-bold">{search ? "Aucune guilde correspondante" : "Aucune guilde"}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(guild => (
                        <GuildStorageRow key={guild.guildId} guild={guild} maxBytes={maxBytes} onReload={load} />
                    ))}
                </div>
            )}
        </div>
    );
}

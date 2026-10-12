'use client';

import { useState, useEffect, useTransition, useMemo } from 'react';
import { 
    getArchimonstres, 
    syncOcreArchimonstres, 
    syncWorldMonsters, 
    syncDofusBosses, 
    deleteArchimonstre,
    getIgnoredMonstersAction,
    restoreIgnoredMonsterAction,
    clearAllIgnoredMonstersAction
} from '@/server/actions/game-data-actions';
import { 
    RefreshCw, 
    Trash2, 
    Search, 
    Loader2, 
    CheckCircle2, 
    XCircle, 
    MapPin, 
    Crown, 
    RotateCcw, 
    ChevronLeft, 
    ChevronRight,
    ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
    archimonstre: { label: 'Archi', color: 'bg-warning/20 text-warning border-warning/30' },
    boss:         { label: 'Boss',  color: 'bg-danger/20 text-danger border-danger/30' },
    monstre:      { label: 'Mob',   color: 'bg-muted/20 text-foreground border-border/30' },
};

const WORLD_LABELS: Record<number, string> = {
    1: '🌍 Monde XII', 2: '❄️ Frigost', 3: '🐲 Pandala', 4: '🌀 Dim.',
};

const PAGE_SIZE = 25;

export default function ArchimonstreManager() {
    const [rows, setRows] = useState<any[]>([]);
    const [ignoredList, setIgnoredList] = useState<{ names: string[]; dofusdbIds: number[] }>({ names: [], dofusdbIds: [] });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);

    const [syncStatus, setSyncStatus] = useState<{ synced?: number; skipped?: number; error?: string } | null>(null);
    const [bossSyncing, setBossSyncing] = useState(false);
    const [catalogSync, setCatalogSync] = useState<{
        status: 'idle' | 'running' | 'done' | 'error';
        synced?: number;
        skipped?: number;
        total?: number;
        processed?: number;
        error?: string;
    }>({ status: 'idle' });

    const [isPending, startTransition] = useTransition();
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [restoringItem, setRestoringItem] = useState<string | null>(null);
    const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

    const loadIgnored = async () => {
        const res = await getIgnoredMonstersAction();
        if (res.success && res.data) {
            setIgnoredList(res.data);
        }
    };

    const loadData = async (s = search, t = typeFilter) => {
        setLoading(true);
        if (t === 'ignored') {
            await loadIgnored();
            setLoading(false);
            return;
        }
        const res = await getArchimonstres({ search: s || undefined, type: t });
        if (res.success && res.data) {
            setRows(res.data);
        }
        await loadIgnored();
        setLoading(false);
        setCurrentPage(1);
    };

    useEffect(() => { loadData(); }, []); // eslint-disable-line

    const handleSync = () => {
        setSyncStatus(null);
        startTransition(async () => {
            const res = await syncOcreArchimonstres();
            if (res.success && res.data) {
                setSyncStatus({ synced: res.data.synced, skipped: res.data.skipped });
                await loadData();
            } else {
                setSyncStatus({ error: res.error });
            }
        });
    };

    const handleBossSync = async () => {
        setBossSyncing(true);
        try {
            const res = await syncDofusBosses();
            if (res.success && res.data) {
                toast.success(`${res.data.synced} Boss synchronisés avec succès !`);
                setTypeFilter('boss');
                await loadData(search, 'boss');
            } else {
                toast.error(res.error || 'Erreur synchronisation Boss');
            }
        } catch {
            toast.error('Erreur réseau ou serveur');
        } finally {
            setBossSyncing(false);
        }
    };

    const handleCatalogueSync = () => {
        setCatalogSync({ status: 'running' });
        let totalSynced = 0;
        let totalSkipped = 0;
        let total = 0;
        let processed = 0;

        const runBatch = async (skip: number) => {
            const res = await syncWorldMonsters({ skip, batchSize: 50 });
            if (!res.success || !res.data) {
                setCatalogSync({ status: 'error', error: res.error || 'Erreur lors de la synchronisation' });
                return;
            }
            const d = res.data;
            total = d.total;
            totalSynced += d.synced;
            totalSkipped += d.skipped;
            processed = d.nextSkip;
            setCatalogSync({ status: 'running', synced: totalSynced, skipped: totalSkipped, total, processed });

            if (d.done) {
                setCatalogSync({ status: 'done', synced: totalSynced, skipped: totalSkipped, total, processed });
                await loadData();
            } else {
                runBatch(d.nextSkip);
            }
        };

        runBatch(0).catch(() => {
            setCatalogSync({ status: 'error', error: 'Erreur réseau ou serveur' });
        });
    };

    const handleDelete = async (id: string, name: string) => {
        setDeletingId(id);
        const res = await deleteArchimonstre(id);
        if (res.success) {
            toast.success(`"${name}" supprimé et ajouté aux exclus.`);
            setRows(r => r.filter(x => x.id !== id));
            await loadIgnored();
        } else {
            toast.error(res.error || 'Erreur lors de la suppression');
        }
        setDeletingId(null);
    };

    const handleRestoreIgnored = async (name: string, dofusdbId?: number) => {
        setRestoringItem(name);
        const res = await restoreIgnoredMonsterAction(name, dofusdbId);
        if (res.success) {
            toast.success(`"${name}" restauré ! Vous pouvez relancer la sync pour le réintégrer.`);
            await loadIgnored();
        } else {
            toast.error(res.error || 'Erreur lors de la restauration');
        }
        setRestoringItem(null);
    };

    const handleClearAllIgnored = async () => {
        if (!confirm("Voulez-vous vraiment réinitialiser toutes les exclusions ? Tous les monstres supprimés pourront être re-synchronisés.")) return;
        const res = await clearAllIgnoredMonstersAction();
        if (res.success) {
            toast.success("Liste des exclusions réinitialisée.");
            await loadIgnored();
        }
    };

    const handleSearch = (v: string) => {
        setSearch(v);
        if (searchTimer) clearTimeout(searchTimer);
        setSearchTimer(setTimeout(() => loadData(v, typeFilter), 300));
    };

    const handleType = (t: string) => { 
        setTypeFilter(t); 
        loadData(search, t); 
    };

    const types = ['all', 'archimonstre', 'boss', 'monstre', 'ignored'];
    const withSubarea = rows.filter(r => Array.isArray(r.subareaIds) && r.subareaIds.length > 0).length;

    // Filtered & Paginated items
    const filteredIgnoredNames = useMemo(() => {
        if (!search) return ignoredList.names;
        return ignoredList.names.filter(n => n.toLowerCase().includes(search.toLowerCase()));
    }, [ignoredList.names, search]);

    const totalItems = typeFilter === 'ignored' ? filteredIgnoredNames.length : rows.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    const paginatedRows = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return rows.slice(start, start + PAGE_SIZE);
    }, [rows, currentPage]);

    const paginatedIgnored = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredIgnoredNames.slice(start, start + PAGE_SIZE);
    }, [filteredIgnoredNames, currentPage]);

    return (
        <div className="space-y-5">
            {/* Header + Sync Actions */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <p className="text-sm text-muted-foreground">
                        {typeFilter === 'ignored' ? (
                            <>
                                <span className="text-foreground font-bold">{ignoredList.names.length}</span> créatures dans la liste d'exclusion
                            </>
                        ) : (
                            <>
                                <span className="text-foreground font-bold">{rows.length}</span> {typeFilter === 'boss' ? 'boss / gardiens de donjon' : typeFilter === 'archimonstre' ? 'archimonstres' : typeFilter === 'monstre' ? 'monstres' : 'créatures'} en base
                                {rows.length > 0 && (
                                    <> · <span className={withSubarea === rows.length ? 'text-success' : 'text-warning'}>
                                        {withSubarea}/{rows.length} avec zone résolue
                                    </span></>
                                )}
                            </>
                        )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Synchronisé depuis Metamob (zones) + DofusDB (images/coords/boss)
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={handleBossSync}
                        disabled={bossSyncing}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-sm transition-all active:scale-95 shadow-lg shadow-rose-600/20"
                    >
                        {bossSyncing ? <Loader2 size={15} className="animate-spin" /> : <Crown size={15} />}
                        {bossSyncing ? 'Sync Boss…' : 'Sync Boss (DofusDB)'}
                    </button>
                    <button
                        onClick={handleSync}
                        disabled={isPending}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-warning hover:bg-warning disabled:opacity-50 text-warning-foreground font-bold text-sm transition-all active:scale-95 shadow-lg shadow-amber-500/20"
                    >
                        {isPending ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                        {isPending ? 'Synchronisation…' : 'Sync depuis Metamob'}
                    </button>
                    <button
                        onClick={handleCatalogueSync}
                        disabled={catalogSync.status === 'running'}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-foreground font-bold text-sm transition-all active:scale-95 shadow-lg shadow-sky-500/20"
                    >
                        {catalogSync.status === 'running' ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                        {catalogSync.status === 'running'
                            ? 'Sync Catalogue…'
                            : catalogSync.status === 'done'
                                ? 'Re-sync Catalogue'
                                : 'Sync Catalogue Dofus'}
                    </button>
                </div>
            </div>

            {/* ⚠️ 23/09/2026 — ces 3 apports restent ICI (et n'ont pas de bouton au Tableau) :
                ce sont 3 sources distinctes propres à cet éditeur — Metamob (zones des
                archimonstres), DofusDB (boss Dofus), catalogue des monstres du monde —,
                qu'aucun des 11 datasets du 📊 Tableau ne couvre. À l'inverse, « Siphonner
                les boss d'anomalie » a été retiré de l'éditeur Donjons : c'était le dataset
                ANOMALY_BOSSES (doublon). */}
            <p className="text-[11px] text-muted-foreground leading-relaxed">
                Sources de cet éditeur (aucune n&apos;est un dataset du 📊 Tableau) : <strong className="text-foreground">Sync Boss (DofusDB)</strong> ·
                {' '}<strong className="text-foreground">Sync depuis Metamob</strong> (zones/coords des archimonstres) ·
                {' '}<strong className="text-foreground">Sync Catalogue Dofus</strong> (monstres du monde, par lots).
            </p>

            {/* Catalogue sync progress banner */}
            {catalogSync.status !== 'idle' && catalogSync.status !== 'done' && (
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${
                    catalogSync.status === 'error'
                        ? 'bg-danger/10 border-danger/20 text-danger'
                        : 'bg-sky-500/10 border-sky-500/20 text-sky-300'
                }`}>
                    {catalogSync.status === 'error' ? <XCircle size={16} className="shrink-0" /> : <Loader2 size={16} className="animate-spin shrink-0" />}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                            <span>
                                {catalogSync.status === 'error'
                                    ? catalogSync.error
                                    : `Sync catalogue DofusDB… ${catalogSync.processed ?? 0}/${catalogSync.total ?? '…'}`}
                            </span>
                            <span className="text-muted-foreground">
                                {catalogSync.status !== 'error' && `✅ ${catalogSync.synced ?? 0} · ⏭ ${catalogSync.skipped ?? 0}`}
                            </span>
                        </div>
                        {catalogSync.status === 'running' && catalogSync.total ? (
                            <div className="mt-2 h-1.5 w-full bg-sky-950/50 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-sky-500 transition-all duration-300"
                                    style={{ width: `${Math.min(100, ((catalogSync.processed || 0) / catalogSync.total) * 100)}%` }}
                                />
                            </div>
                        ) : null}
                    </div>
                </div>
            )}
            {catalogSync.status === 'done' && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl border text-sm bg-success/10 border-success/20 text-success">
                    <CheckCircle2 size={16} className="shrink-0" />
                    <span>Catalogue DofusDB synchronisé — {catalogSync.synced} ajoutés/mis à jour · {catalogSync.skipped} ignorés (total {catalogSync.total})</span>
                </div>
            )}

            {/* Sync status banner */}
            {syncStatus && (
                <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm ${
                    syncStatus.error
                        ? 'bg-danger/10 border-danger/20 text-danger'
                        : 'bg-success/10 border-success/20 text-success'
                }`}>
                    {syncStatus.error ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                    {syncStatus.error
                        ? syncStatus.error
                        : `✅ ${syncStatus.synced} synchronisés · ${syncStatus.skipped} ignorés`}
                </div>
            )}

            {/* Search & Filter Pills */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[220px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Rechercher une créature…"
                        value={search}
                        onChange={e => handleSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 rounded-xl bg-elevated border border-border text-foreground placeholder-muted-foreground text-sm focus:outline-none focus:border-primary"
                    />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                    {types.map(t => {
                        const isIgnoredTab = t === 'ignored';
                        const count = isIgnoredTab ? ignoredList.names.length : null;
                        return (
                            <button 
                                key={t} 
                                onClick={() => handleType(t)}
                                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                                    typeFilter === t
                                        ? isIgnoredTab
                                            ? 'bg-rose-500/20 border-rose-500/40 text-rose-500'
                                            : 'bg-primary/20 border-primary/40 text-primary'
                                        : 'bg-elevated border-border text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                {isIgnoredTab ? (
                                    <>
                                        <Trash2 size={13} />
                                        <span>Exclus</span>
                                        {count !== null && count > 0 && (
                                            <span className="px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-500 text-caption font-black">
                                                {count}
                                            </span>
                                        )}
                                    </>
                                ) : t === 'all' ? (
                                    'Tous'
                                ) : (
                                    TYPE_LABELS[t]?.label ?? t
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* View: Ignored / Excluded Monsters */}
            {typeFilter === 'ignored' ? (
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs">
                        <div className="flex items-center gap-2 text-rose-500 font-bold">
                            <ShieldAlert size={16} />
                            <span>Ces monstres ont été supprimés et sont exclus de tous les futurs cycles de synchronisation.</span>
                        </div>
                        {ignoredList.names.length > 0 && (
                            <button
                                onClick={handleClearAllIgnored}
                                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold transition-all"
                            >
                                ♻️ Tout restaurer
                            </button>
                        )}
                    </div>

                    {filteredIgnoredNames.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-2xl bg-surface/50">
                            <p className="font-bold">Aucune créature dans la liste des exclusions</p>
                            <p className="text-xs text-muted-foreground mt-1">Lorsque vous supprimez un monstre avec l'icône poubelle, il apparaît ici pour vous permettre de le restaurer si besoin.</p>
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-sm">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-elevated/60 border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                                        <th className="text-left px-5 py-3">Nom de la créature</th>
                                        <th className="text-left px-5 py-3">Statut</th>
                                        <th className="text-right px-5 py-3">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {paginatedIgnored.map((name) => (
                                        <tr key={name} className="hover:bg-elevated/30 transition-colors">
                                            <td className="px-5 py-3 font-bold text-foreground capitalize">
                                                {name}
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className="px-2.5 py-0.5 rounded-full text-caption font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                                    Exclu des synchronisations
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <button
                                                    onClick={() => handleRestoreIgnored(name)}
                                                    disabled={restoringItem === name}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-elevated hover:bg-surface border border-border text-foreground hover:text-emerald-500 text-xs font-bold transition-all"
                                                >
                                                    {restoringItem === name ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                                                    <span>Restaurer</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : (
                /* View: Active Monsters Table with Anti-Lag Pagination */
                <>
                    {loading ? (
                        <div className="flex items-center justify-center py-20 text-muted-foreground">
                            <Loader2 size={24} className="animate-spin mr-2" /> Chargement des données…
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-2xl bg-surface/50">
                            <p className="font-bold">
                                {typeFilter === 'boss' ? 'Aucun boss en base' : typeFilter === 'archimonstre' ? 'Aucun archimonstre en base' : typeFilter === 'monstre' ? 'Aucun monstre en base' : 'Aucune entrée en base'}
                            </p>
                            <p className="text-xs mt-1 text-muted-foreground max-w-md mx-auto">
                                {search ? 'Aucun résultat pour cette recherche.' : typeFilter === 'boss' ? 'Cliquez sur "Sync Boss (DofusDB)" pour importer instantanément les ~209 gardiens de donjon.' : 'Cliquez sur "Sync depuis Metamob", "Sync Boss" ou "Sync Catalogue Dofus" pour importer les données.'}
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-sm">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-elevated/60 border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                                        <th className="text-left px-4 py-3">Monstre</th>
                                        <th className="text-left px-4 py-3">Type</th>
                                        <th className="text-left px-4 py-3">Zone</th>
                                        <th className="text-left px-4 py-3">Monde</th>
                                        <th className="text-left px-4 py-3">Lvl</th>
                                        <th className="text-left px-4 py-3 font-mono">SubareaIds</th>
                                        <th className="px-4 py-3 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {paginatedRows.map(row => (
                                        <tr key={row.id} className="hover:bg-elevated/40 transition-colors group">
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center gap-2.5">
                                                    {row.imageUrl
                                                        ? <img src={row.imageUrl} alt={row.name} className="w-7 h-7 object-contain rounded shrink-0" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                                                        : <div className="w-7 h-7 rounded bg-elevated flex items-center justify-center text-muted-foreground text-xs shrink-0">?</div>
                                                    }
                                                    <span className="text-foreground font-bold truncate max-w-[200px]">{row.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${TYPE_LABELS[row.type]?.color ?? 'bg-muted/20 text-foreground border-border/30'}`}>
                                                    {TYPE_LABELS[row.type]?.label ?? row.type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5 text-foreground">
                                                <div className="flex items-center gap-1">
                                                    <MapPin size={12} className="text-muted-foreground shrink-0" />
                                                    <span className="truncate max-w-[150px] font-medium">{row.zone || '—'}</span>
                                                </div>
                                                {row.subzone && <div className="text-caption text-muted-foreground ml-4 truncate max-w-[150px]">{row.subzone}</div>}
                                            </td>
                                            <td className="px-4 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                                                {WORLD_LABELS[row.worldMapId] ?? `Monde ${row.worldMapId}`}
                                            </td>
                                            <td className="px-4 py-2.5 text-foreground font-bold">{row.level || '—'}</td>
                                            <td className="px-4 py-2.5 font-mono text-caption text-muted-foreground">
                                                {Array.isArray(row.subareaIds) && row.subareaIds.length > 0
                                                    ? `[${(row.subareaIds as number[]).join(', ')}]`
                                                    : <span className="text-danger/70 font-sans">⚠ non résolu</span>
                                                }
                                            </td>
                                            <td className="px-4 py-2.5 text-right">
                                                <button 
                                                    onClick={() => handleDelete(row.id, row.name)} 
                                                    disabled={deletingId === row.id}
                                                    title="Supprimer et exclure des futures synchronisations"
                                                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-danger/20 text-danger transition-all disabled:opacity-50"
                                                >
                                                    {deletingId === row.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {/* Pagination Controls (Anti-lag) */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
                    <span className="text-muted-foreground font-medium">
                        Page <span className="text-foreground font-bold">{currentPage}</span> sur <span className="text-foreground font-bold">{totalPages}</span> ({totalItems} éléments au total)
                    </span>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-2 rounded-lg bg-elevated border border-border text-foreground hover:bg-surface disabled:opacity-40 disabled:hover:bg-elevated transition-all"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="px-3 py-1 font-bold text-foreground">{currentPage}</span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="p-2 rounded-lg bg-elevated border border-border text-foreground hover:bg-surface disabled:opacity-40 disabled:hover:bg-elevated transition-all"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

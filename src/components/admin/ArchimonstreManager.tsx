'use client';

import { useState, useEffect, useTransition } from 'react';
import { getArchimonstres, syncOcreArchimonstres, syncWorldMonsters, deleteArchimonstre } from '@/server/actions/game-data-actions';
import { RefreshCw, Trash2, Search, Loader2, CheckCircle2, XCircle, MapPin } from 'lucide-react';

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
    archimonstre: { label: 'Archi', color: 'bg-warning/20 text-warning border-warning/30' },
    boss:         { label: 'Boss',  color: 'bg-danger/20 text-danger border-danger/30' },
    monstre:      { label: 'Mob',   color: 'bg-muted/20 text-foreground border-border/30' },
};

const WORLD_LABELS: Record<number, string> = {
    1: '🌍 Monde XII', 2: '❄️ Frigost', 3: '🐲 Pandala', 4: '🌀 Dim.',
};

export default function ArchimonstreManager() {
    const [rows, setRows]     = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [syncStatus, setSyncStatus] = useState<{ synced?: number; skipped?: number; error?: string } | null>(null);
    // Sync catalogue DofusDB (progression par batchs)
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
    const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

    const loadData = async (s = search, t = typeFilter) => {
        setLoading(true);
        const res = await getArchimonstres({ search: s || undefined, type: t });
        if (res.success && res.data) setRows(res.data);
        setLoading(false);
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

    // Sync complète du catalogue DofusDB (boucle par batchs avec progression)
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

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        await deleteArchimonstre(id);
        setRows(r => r.filter(x => x.id !== id));
        setDeletingId(null);
    };

    const handleSearch = (v: string) => {
        setSearch(v);
        if (searchTimer) clearTimeout(searchTimer);
        setSearchTimer(setTimeout(() => loadData(v, typeFilter), 400));
    };

    const handleType = (t: string) => { setTypeFilter(t); loadData(search, t); };

    const types = ['all', 'archimonstre', 'boss', 'monstre'];
    const withSubarea = rows.filter(r => Array.isArray(r.subareaIds) && r.subareaIds.length > 0).length;

    return (
        <div className="space-y-5">
            {/* Header + Sync */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <p className="text-sm text-muted-foreground">
                        <span className="text-foreground font-bold">{rows.length}</span> archimonstres en base
                        {rows.length > 0 && (
                            <> · <span className={withSubarea === rows.length ? 'text-success' : 'text-warning'}>
                                {withSubarea}/{rows.length} avec zone résolue
                            </span></>
                        )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Synchronisé depuis Metamob (zones) + DofusDB (images/coords)
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={handleSync}
                        disabled={isPending}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-warning hover:bg-warning disabled:opacity-50 text-foreground font-bold text-sm transition-all active:scale-95 shadow-lg shadow-amber-500/20"
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

            {/* Catalogue sync progress */}
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
                            <div className="mt-2 h-1.5 bg-elevated rounded-full overflow-hidden">
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

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[180px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Rechercher…"
                        value={search}
                        onChange={e => handleSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 rounded-lg bg-elevated border border-border text-foreground placeholder-slate-500 text-sm focus:outline-none focus:border-warning/50"
                    />
                </div>
                <div className="flex gap-1">
                    {types.map(t => (
                        <button key={t} onClick={() => handleType(t)}
                            className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                                typeFilter === t
                                    ? 'bg-warning/20 border-warning/40 text-warning'
                                    : 'bg-elevated border-border text-muted-foreground hover:text-foreground'
                            }`}>
                            {t === 'all' ? 'Tous' : TYPE_LABELS[t]?.label ?? t}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                    <Loader2 size={20} className="animate-spin mr-2" /> Chargement…
                </div>
            ) : rows.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-xl">
                    <p className="font-semibold">Aucun archimonstre</p>
                    <p className="text-sm mt-1 text-muted-foreground">
                        {search ? 'Aucun résultat pour cette recherche.' : 'Cliquez sur "Sync depuis Metamob" pour importer les données.'}
                    </p>
                </div>
            ) : (
                <div className="rounded-xl border border-border/50 overflow-hidden text-sm">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-elevated/60 border-b border-border/50 text-muted-foreground text-xs uppercase tracking-wider">
                                <th className="text-left px-4 py-2.5">Monstre</th>
                                <th className="text-left px-4 py-2.5">Type</th>
                                <th className="text-left px-4 py-2.5">Zone Metamob</th>
                                <th className="text-left px-4 py-2.5">Monde</th>
                                <th className="text-left px-4 py-2.5">Lvl</th>
                                <th className="text-left px-4 py-2.5 font-mono">SubareaIds</th>
                                <th className="px-4 py-2.5 w-8"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                            {rows.map(row => (
                                <tr key={row.id} className="hover:bg-elevated/30 transition-colors group">
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-2.5">
                                            {row.imageUrl
                                                ? <img src={row.imageUrl} alt={row.name} className="w-7 h-7 object-contain rounded" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                                                : <div className="w-7 h-7 rounded bg-muted flex items-center justify-center text-muted-foreground text-xs">?</div>
                                            }
                                            <span className="text-foreground font-medium">{row.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <span className={`px-2 py-0.5 rounded-full text-xs border ${TYPE_LABELS[row.type]?.color ?? 'bg-muted/20 text-foreground border-border/30'}`}>
                                            {TYPE_LABELS[row.type]?.label ?? row.type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2.5 text-foreground">
                                        <div className="flex items-center gap-1">
                                            <MapPin size={11} className="text-muted-foreground shrink-0" />
                                            <span className="truncate max-w-[160px]">{row.zone || '—'}</span>
                                        </div>
                                        {row.subzone && <div className="text-xs text-muted-foreground ml-3.5 truncate max-w-[160px]">{row.subzone}</div>}
                                    </td>
                                    <td className="px-4 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                                        {WORLD_LABELS[row.worldMapId] ?? `Monde ${row.worldMapId}`}
                                    </td>
                                    <td className="px-4 py-2.5 text-muted-foreground">{row.level || '—'}</td>
                                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                                        {Array.isArray(row.subareaIds) && row.subareaIds.length > 0
                                            ? `[${(row.subareaIds as number[]).join(', ')}]`
                                            : <span className="text-danger/60">⚠ manquant</span>
                                        }
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <button onClick={() => handleDelete(row.id)} disabled={deletingId === row.id}
                                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-danger/20 text-danger transition-all disabled:opacity-50">
                                            {deletingId === row.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

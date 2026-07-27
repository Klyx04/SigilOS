'use client';

import { useState, useEffect, useTransition } from 'react';
import { getArchimonstres, syncOcreArchimonstres, deleteArchimonstre } from '@/server/actions/game-data-actions';
import { RefreshCw, Trash2, Search, Loader2, CheckCircle2, XCircle, MapPin } from 'lucide-react';

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
    archimonstre: { label: 'Archi', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    boss:         { label: 'Boss',  color: 'bg-red-500/20 text-red-300 border-red-500/30' },
    monstre:      { label: 'Mob',   color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
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
                    <p className="text-sm text-slate-400">
                        <span className="text-white font-bold">{rows.length}</span> archimonstres en base
                        {rows.length > 0 && (
                            <> · <span className={withSubarea === rows.length ? 'text-emerald-400' : 'text-amber-400'}>
                                {withSubarea}/{rows.length} avec zone résolue
                            </span></>
                        )}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Synchronisé depuis Metamob (zones) + DofusDB (images/coords)
                    </p>
                </div>
                <button
                    onClick={handleSync}
                    disabled={isPending}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold text-sm transition-all active:scale-95 shadow-lg shadow-amber-500/20"
                >
                    {isPending ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                    {isPending ? 'Synchronisation…' : 'Sync depuis Metamob'}
                </button>
            </div>

            {/* Sync status banner */}
            {syncStatus && (
                <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm ${
                    syncStatus.error
                        ? 'bg-red-500/10 border-red-500/20 text-red-300'
                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
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
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Rechercher…"
                        value={search}
                        onChange={e => handleSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500/50"
                    />
                </div>
                <div className="flex gap-1">
                    {types.map(t => (
                        <button key={t} onClick={() => handleType(t)}
                            className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                                typeFilter === t
                                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                            }`}>
                            {t === 'all' ? 'Tous' : TYPE_LABELS[t]?.label ?? t}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center py-16 text-slate-500">
                    <Loader2 size={20} className="animate-spin mr-2" /> Chargement…
                </div>
            ) : rows.length === 0 ? (
                <div className="text-center py-16 text-slate-500 border border-dashed border-slate-700 rounded-xl">
                    <p className="font-semibold">Aucun archimonstre</p>
                    <p className="text-sm mt-1 text-slate-600">
                        {search ? 'Aucun résultat pour cette recherche.' : 'Cliquez sur "Sync depuis Metamob" pour importer les données.'}
                    </p>
                </div>
            ) : (
                <div className="rounded-xl border border-slate-700/50 overflow-hidden text-sm">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-800/60 border-b border-slate-700/50 text-slate-400 text-xs uppercase tracking-wider">
                                <th className="text-left px-4 py-2.5">Monstre</th>
                                <th className="text-left px-4 py-2.5">Type</th>
                                <th className="text-left px-4 py-2.5">Zone Metamob</th>
                                <th className="text-left px-4 py-2.5">Monde</th>
                                <th className="text-left px-4 py-2.5">Lvl</th>
                                <th className="text-left px-4 py-2.5 font-mono">SubareaIds</th>
                                <th className="px-4 py-2.5 w-8"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/30">
                            {rows.map(row => (
                                <tr key={row.id} className="hover:bg-slate-800/30 transition-colors group">
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-2.5">
                                            {row.imageUrl
                                                ? <img src={row.imageUrl} alt={row.name} className="w-7 h-7 object-contain rounded" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                                                : <div className="w-7 h-7 rounded bg-slate-700 flex items-center justify-center text-slate-500 text-xs">?</div>
                                            }
                                            <span className="text-white font-medium">{row.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <span className={`px-2 py-0.5 rounded-full text-xs border ${TYPE_LABELS[row.type]?.color ?? 'bg-slate-500/20 text-slate-300 border-slate-500/30'}`}>
                                            {TYPE_LABELS[row.type]?.label ?? row.type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2.5 text-slate-300">
                                        <div className="flex items-center gap-1">
                                            <MapPin size={11} className="text-slate-500 shrink-0" />
                                            <span className="truncate max-w-[160px]">{row.zone || '—'}</span>
                                        </div>
                                        {row.subzone && <div className="text-xs text-slate-500 ml-3.5 truncate max-w-[160px]">{row.subzone}</div>}
                                    </td>
                                    <td className="px-4 py-2.5 text-slate-400 text-xs whitespace-nowrap">
                                        {WORLD_LABELS[row.worldMapId] ?? `Monde ${row.worldMapId}`}
                                    </td>
                                    <td className="px-4 py-2.5 text-slate-400">{row.level || '—'}</td>
                                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">
                                        {Array.isArray(row.subareaIds) && row.subareaIds.length > 0
                                            ? `[${(row.subareaIds as number[]).join(', ')}]`
                                            : <span className="text-red-400/60">⚠ manquant</span>
                                        }
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <button onClick={() => handleDelete(row.id)} disabled={deletingId === row.id}
                                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-red-400 transition-all disabled:opacity-50">
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

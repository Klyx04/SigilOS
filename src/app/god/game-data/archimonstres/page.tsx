'use client';

import { useState, useEffect, useTransition } from 'react';
import { getArchimonstres, syncOcreArchimonstres, deleteArchimonstre } from '@/server/actions/game-data-actions';
import { RefreshCw, Trash2, Search, Filter, MapPin, Globe, Loader2, CheckCircle2, XCircle, ChevronDown } from 'lucide-react';

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
    archimonstre: { label: 'Archimonstre', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    boss:          { label: 'Boss',          color: 'bg-red-500/20 text-red-300 border-red-500/30' },
    monstre:       { label: 'Monstre',       color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
};

const WORLD_LABELS: Record<number, string> = {
    1: '🌍 Monde des Douze',
    2: '❄️ Frigost',
    3: '🐲 Pandala',
    4: '🌀 Dimensions',
};

export default function ArchimonstresPage() {
    const [rows, setRows]       = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch]   = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [syncStatus, setSyncStatus] = useState<{ synced?: number; skipped?: number; error?: string } | null>(null);
    const [isPending, startTransition] = useTransition();
    const [deletingId, setDeletingId] = useState<string | null>(null);

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
                setSyncStatus({ error: res.error || 'Erreur inconnue' });
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
        const t = setTimeout(() => loadData(v, typeFilter), 400);
        return () => clearTimeout(t);
    };

    const handleTypeFilter = (t: string) => {
        setTypeFilter(t);
        loadData(search, t);
    };

    const types = ['all', 'archimonstre', 'boss', 'monstre'];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight">
                        Archimonstres — Quête Ocre
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        {rows.length} entrée{rows.length !== 1 ? 's' : ''} en base •
                        Synchronisés depuis Metamob + DofusDB
                    </p>
                </div>

                <button
                    onClick={handleSync}
                    disabled={isPending}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold text-sm transition-all active:scale-95 shadow-lg shadow-amber-500/20"
                >
                    {isPending
                        ? <Loader2 size={16} className="animate-spin" />
                        : <RefreshCw size={16} />
                    }
                    {isPending ? 'Synchronisation…' : 'Synchroniser depuis Metamob'}
                </button>
            </div>

            {/* Sync status */}
            {syncStatus && (
                <div className={`flex items-center gap-3 p-4 rounded-xl border text-sm ${
                    syncStatus.error
                        ? 'bg-red-500/10 border-red-500/20 text-red-300'
                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                }`}>
                    {syncStatus.error
                        ? <XCircle size={18} />
                        : <CheckCircle2 size={18} />
                    }
                    {syncStatus.error
                        ? syncStatus.error
                        : `✅ ${syncStatus.synced} synchronisés, ${syncStatus.skipped} ignorés`
                    }
                </div>
            )}

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Rechercher un monstre…"
                        value={search}
                        onChange={e => handleSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500/50 focus:bg-white/8"
                    />
                </div>
                <div className="flex items-center gap-2">
                    {types.map(t => (
                        <button
                            key={t}
                            onClick={() => handleTypeFilter(t)}
                            className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                                typeFilter === t
                                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                            }`}
                        >
                            {t === 'all' ? 'Tous' : (TYPE_LABELS[t]?.label ?? t)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center py-20 text-slate-500">
                    <Loader2 size={24} className="animate-spin mr-3" />
                    Chargement…
                </div>
            ) : rows.length === 0 ? (
                <div className="text-center py-20 text-slate-500">
                    <p className="text-lg font-semibold">Aucun archimonstre</p>
                    <p className="text-sm mt-1">Cliquez sur "Synchroniser" pour importer les données depuis Metamob.</p>
                </div>
            ) : (
                <div className="rounded-2xl border border-white/10 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-white/5 border-b border-white/10 text-slate-400 text-xs uppercase tracking-wider">
                                <th className="text-left px-4 py-3">Monstre</th>
                                <th className="text-left px-4 py-3">Type</th>
                                <th className="text-left px-4 py-3">Zone</th>
                                <th className="text-left px-4 py-3">Monde</th>
                                <th className="text-left px-4 py-3">Lvl</th>
                                <th className="text-left px-4 py-3">SubareaIds</th>
                                <th className="px-4 py-3 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {rows.map(row => (
                                <tr key={row.id} className="hover:bg-white/3 transition-colors group">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            {row.imageUrl ? (
                                                <img
                                                    src={row.imageUrl}
                                                    alt={row.name}
                                                    className="w-8 h-8 object-contain rounded"
                                                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                />
                                            ) : (
                                                <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-slate-600">?</div>
                                            )}
                                            <span className="text-white font-medium">{row.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded-full text-xs border ${TYPE_LABELS[row.type]?.color ?? 'bg-slate-500/20 text-slate-300 border-slate-500/30'}`}>
                                            {TYPE_LABELS[row.type]?.label ?? row.type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-300">
                                        <div className="flex items-center gap-1.5">
                                            <MapPin size={12} className="text-slate-500 shrink-0" />
                                            <span className="truncate max-w-[180px]">{row.zone || '—'}</span>
                                        </div>
                                        {row.subzone && (
                                            <div className="text-xs text-slate-500 ml-4 truncate max-w-[180px]">{row.subzone}</div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-slate-400 text-xs">
                                        {WORLD_LABELS[row.worldMapId] ?? `Monde ${row.worldMapId}`}
                                    </td>
                                    <td className="px-4 py-3 text-slate-400">{row.level || '—'}</td>
                                    <td className="px-4 py-3 text-slate-500 text-xs font-mono">
                                        {Array.isArray(row.subareaIds) && row.subareaIds.length > 0
                                            ? `[${(row.subareaIds as number[]).join(', ')}]`
                                            : <span className="text-red-400/70">⚠ manquant</span>
                                        }
                                    </td>
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => handleDelete(row.id)}
                                            disabled={deletingId === row.id}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-all disabled:opacity-50"
                                            title="Supprimer"
                                        >
                                            {deletingId === row.id
                                                ? <Loader2 size={14} className="animate-spin" />
                                                : <Trash2 size={14} />
                                            }
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

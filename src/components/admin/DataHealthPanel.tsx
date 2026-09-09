'use client';

import { useEffect, useState } from 'react';
import { Activity, CheckCircle2, Loader2, ArrowRight, FlaskConical, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    getDataHealthOverview,
    checkBossFicheGaps,
} from '@/server/actions/data-health-actions';
import type { DataHealthRow, BossFicheGap } from '@/lib/data-health';
import { getSiphonInventory, triggerBatchAssetSiphonAction } from '@/server/actions/asset-siphon-actions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function relativeTime(iso: string | null): string {
    if (!iso) return 'Jamais';
    const diff = Date.now() - new Date(iso).getTime();
    if (!Number.isFinite(diff) || diff < 0) return '—';
    const min = Math.floor(diff / 60000);
    if (min < 1) return "à l'instant";
    if (min < 60) return `il y a ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 48) return `il y a ${h}h`;
    return new Date(iso).toLocaleDateString('fr-FR');
}

interface GapTarget {
    key: string;
    label: string;
    sub: string;
    target: { id: string; name: string; dungeonName?: string; remoteUrl?: string };
}

export function DataHealthPanel({ onGoTab }: { onGoTab: (tab: string) => void }) {
    const [rows, setRows] = useState<DataHealthRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [checking, setChecking] = useState(false);
    const [gaps, setGaps] = useState<GapTarget[] | null>(null);
    const [gapKind, setGapKind] = useState<'fiches' | 'images' | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [syncing, setSyncing] = useState(false);

    const loadOverview = async () => {
        setLoading(true);
        try {
            const res = await getDataHealthOverview();
            if (res.success && res.data) setRows(res.data.rows);
            else toast.error(res.error || 'Vue indisponible');
        } catch {
            toast.error('Vue indisponible');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadOverview();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const checkGaps = async (kind: 'fiches' | 'images') => {
        setChecking(true);
        setGaps(null);
        setSelected(new Set());
        setGapKind(kind);
        try {
            if (kind === 'fiches') {
                const res = await checkBossFicheGaps();
                if (!res.success || !res.data) {
                    toast.error(res.error || 'Dry-run impossible');
                    return;
                }
                const list = res.data.gaps.map((g: BossFicheGap) => ({
                    key: `f:${g.bossName}::${g.dungeonName}`,
                    label: `${g.bossName} — fiche ${g.reason}`,
                    sub: `${g.dungeonName}${g.lastSyncedAt ? ` · sync ${relativeTime(g.lastSyncedAt)}` : ''}`,
                    target: { id: g.bossName, name: g.bossName, dungeonName: g.dungeonName },
                }));
                setGaps(list);
                setSelected(new Set(list.map((g) => g.key)));
                if (list.length === 0) toast.success('Aucun écart : toutes les fiches sont fraîches');
            } else {
                const res = await getSiphonInventory({ status: 'missing', limit: 100 });
                if (!res.success || !res.data) {
                    toast.error(res.error || 'Dry-run impossible');
                    return;
                }
                const list = res.data.items
                    .filter((i) => !i.hasLocalImage)
                    .map((i) => ({
                        key: `i:${i.id}::${i.dungeonName || ''}`,
                        label: `${i.name} — image manquante`,
                        sub: i.dungeonName || '',
                        target: {
                            id: String(i.id),
                            name: i.name,
                            dungeonName: i.dungeonName,
                            remoteUrl: i.remoteImageUrl || undefined,
                        },
                    }));
                setGaps(list);
                setSelected(new Set(list.map((g) => g.key)));
                if (list.length === 0) toast.success('Aucune image manquante');
            }
        } finally {
            setChecking(false);
        }
    };

    const toggle = (key: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const syncSelected = async () => {
        if (!gaps || selected.size === 0) {
            toast.error('Sélectionne au moins un élément');
            return;
        }
        setSyncing(true);
        try {
            const targets = gaps.filter((g) => selected.has(g.key)).map((g) => g.target);
            const res = await triggerBatchAssetSiphonAction(targets);
            if (res.success && res.data) {
                toast.success(`Sync : ${res.data.siphoned} OK, ${res.data.errors} erreurs (${res.data.skipped} ignorés)`);
                setGaps(null);
                setSelected(new Set());
                loadOverview();
            } else {
                toast.error(res.error || 'Sync impossible');
            }
        } finally {
            setSyncing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-3">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm font-medium">Chargement de l'état des données…</span>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span>Lecture seule — source → cible, fraîcheur, couverture réelle, dernier run. Le dry-run n'écrit jamais.</span>
            </div>

            <div className="rounded-2xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border bg-surface/60">
                            <th className="p-3">Dataset</th>
                            <th className="p-3 hidden md:table-cell">Source → Cible</th>
                            <th className="p-3">Couverture</th>
                            <th className="p-3 hidden lg:table-cell">Dernier run</th>
                            <th className="p-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                        {rows.map((r) => (
                            <tr key={r.id} className="hover:bg-elevated/40 transition-colors">
                                <td className="p-3">
                                    <div className="font-bold text-foreground">{r.dataset}</div>
                                    {r.fraicheur && <div className="text-caption text-muted-foreground">{r.fraicheur}</div>}
                                </td>
                                <td className="p-3 hidden md:table-cell text-xs text-muted-foreground">
                                    {r.source} <ArrowRight className="w-3 h-3 inline mx-1" /> {r.cible}
                                </td>
                                <td className="p-3">
                                    <div className="text-xs font-semibold text-foreground">{r.couverture}</div>
                                    {r.couverturePct !== null && (
                                        <div className="mt-1 h-1.5 w-28 rounded-full bg-surface overflow-hidden">
                                            <div
                                                className={cn("h-full rounded-full", r.couverturePct >= 90 ? "bg-emerald-500" : r.couverturePct >= 50 ? "bg-amber-500" : "bg-red-500")}
                                                style={{ width: `${Math.min(100, r.couverturePct)}%` }}
                                            />
                                        </div>
                                    )}
                                </td>
                                <td className="p-3 hidden lg:table-cell text-xs text-muted-foreground">
                                    {relativeTime(r.dernierRun)}
                                </td>
                                <td className="p-3 text-right whitespace-nowrap">
                                    {(r.id === 'boss-fiches' || r.id === 'images') && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="mr-2 text-xs font-bold"
                                            disabled={checking}
                                            onClick={() => checkGaps(r.id === 'boss-fiches' ? 'fiches' : 'images')}
                                            title="Dry-run : liste les écarts sans rien écrire"
                                        >
                                            <FlaskConical className="w-3.5 h-3.5 mr-1" />
                                            Vérifier
                                        </Button>
                                    )}
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-xs font-bold"
                                        onClick={() => onGoTab(r.goTab)}
                                    >
                                        {r.goLabel} <ArrowRight className="w-3.5 h-3.5 ml-1" />
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {checking && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Analyse des écarts (lecture seule)…
                </div>
            )}

            {gaps && !checking && (
                <div className="rounded-2xl border border-border p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <h4 className="text-sm font-black text-foreground">
                            Écarts {gapKind === 'fiches' ? 'fiches' : 'images'} ({gaps.length})
                            <span className="ml-2 text-[11px] font-medium text-muted-foreground">dry-run — rien n'a été écrit</span>
                        </h4>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground font-semibold">{selected.size} sélectionné(s)</span>
                            <Button size="sm" disabled={syncing || selected.size === 0} onClick={syncSelected} className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white">
                                {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Play className="w-3.5 h-3.5 mr-1" />}
                                Synchroniser la sélection
                            </Button>
                        </div>
                    </div>
                    {gaps.length === 0 ? (
                        <p className="text-sm text-emerald-400 font-semibold flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" /> Rien à synchroniser.
                        </p>
                    ) : (
                        <div className="max-h-72 overflow-y-auto divide-y divide-border/40 rounded-xl border border-border/60">
                            {gaps.map((g) => (
                                <label key={g.key} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-elevated/40 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={selected.has(g.key)}
                                        onChange={() => toggle(g.key)}
                                        className="w-4 h-4 rounded accent-emerald-600"
                                    />
                                    <span className="flex-1 min-w-0">
                                        <span className="block font-semibold text-foreground truncate">{g.label}</span>
                                        {g.sub && <span className="block text-caption text-muted-foreground truncate">{g.sub}</span>}
                                    </span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

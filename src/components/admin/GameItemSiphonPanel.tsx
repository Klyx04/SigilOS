'use client';

import { useState, useEffect, useTransition } from 'react';
import {
    Package,
    RefreshCw,
    Download,
    Search,
    CheckCircle2,
    Layers,
    Sparkles,
    ShieldCheck,
    Scroll,
    Flame,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
    getGameItemsStats,
    siphonGameItemsBatch,
    siphonMarketReferentials,
    searchLocalGameItems,
    type GameItemSearchResult,
} from '@/server/actions/game-item-actions';

export function GameItemSiphonPanel() {
    const [stats, setStats] = useState<{
        totalItems: number;
        totalWithRecipe: number;
        totalWebpImages: number;
        byCategory: Record<string, number>;
        lastUpdated: string | null;
    } | null>(null);

    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    // Siphon progress
    const [isSiphoning, setIsSiphoning] = useState(false);
    // S2.5bis — siphon des référentiels d'effets & de caractéristiques (marché).
    const [isSiphoningRefs, setIsSiphoningRefs] = useState(false);
    const [progressValue, setProgressValue] = useState(0);
    const [siphonStatus, setSiphonStatus] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);

    // Search
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<GameItemSearchResult[]>([]);
    const [searching, setSearching] = useState(false);

    const loadStats = async () => {
        setLoading(true);
        try {
            const res = await getGameItemsStats();
            if (res.success && res.data) {
                setStats(res.data);
            }
        } catch (err) {
            console.error('Erreur chargement stats items:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStats();
    }, []);

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!searchQuery.trim() || searchQuery.trim().length < 2) {
            setSearchResults([]);
            return;
        }
        setSearching(true);
        try {
            const res = await searchLocalGameItems(searchQuery, 'all', 20);
            if (res.success && res.data) {
                setSearchResults(res.data);
            }
        } finally {
            setSearching(false);
        }
    };

    const handleStartSiphon = async () => {
        setIsSiphoning(true);
        setProgressValue(0);
        setLogs((prev) => ['🚀 Démarrage du siphon des items DofusDB par lots de 50...', ...prev]);

        startTransition(async () => {
            let currentSkip = 0;
            let totalInserted = 0;
            let totalUpdated = 0;
            let hasMore = true;
            const BATCH_SIZE = 50;

            try {
                while (hasMore) {
                    const res = await siphonGameItemsBatch(currentSkip, BATCH_SIZE);
                    if (!res.success || !res.data) {
                        setLogs((prev) => [`❌ Erreur lot skip=${currentSkip}: ${res.error || 'Inconnue'}`, ...prev]);
                        break;
                    }

                    totalInserted += res.data.inserted;
                    totalUpdated += res.data.updated;
                    hasMore = res.data.hasMore;
                    currentSkip = res.data.nextSkip;

                    const percent = Math.min(Math.round((currentSkip / 20000) * 100), 100);
                    setProgressValue(percent);
                    setSiphonStatus(`${currentSkip} items analysés (Nouveaux: ${totalInserted}, Mis à jour: ${totalUpdated})`);

                    // Log ponctuel
                    if (currentSkip % 250 === 0 || !hasMore) {
                        setLogs((prev) => [
                            `📦 Progression: ${currentSkip} items traités (${totalInserted} créés, ${totalUpdated} MAJ)`,
                            ...prev,
                        ]);
                    }

                    // Petite pause de politesse
                    await new Promise((r) => setTimeout(r, 100));
                }

                setLogs((prev) => [
                    `✅ Synchronisation terminée ! ${totalInserted} items créés, ${totalUpdated} mis à jour.`,
                    ...prev,
                ]);
            } catch (err: any) {
                setLogs((prev) => [`❌ Exception siphon: ${err?.message}`, ...prev]);
            } finally {
                setIsSiphoning(false);
                loadStats();
            }
        });
    };

    /**
     * S2.5bis — siphonne les référentiels DofusDB `/effects` + `/characteristics`
     * (libellés FR, icônes, « % ») qui alimentent l'éditeur de jet et la carte d'item.
     */
    const handleSiphonReferentials = async () => {
        setIsSiphoningRefs(true);
        setLogs((prev) => ['📚 Siphon des référentiels (effets & caractéristiques)...', ...prev]);
        startTransition(async () => {
            try {
                const res = await siphonMarketReferentials();
                if (!res.success || !res.data) {
                    setLogs((prev) => [`❌ Référentiels: ${res.error || 'Inconnue'}`, ...prev]);
                    return;
                }
                const { characteristics, effects } = res.data;
                setLogs((prev) => [
                    `✅ Référentiels synchronisés : ${characteristics} caractéristique(s), ${effects} effet(s).`,
                    ...prev,
                ]);
            } catch (err: any) {
                setLogs((prev) => [`❌ Exception référentiels: ${err?.message}`, ...prev]);
            } finally {
                setIsSiphoningRefs(false);
            }
        });
    };

    return (
        <div className="space-y-6">
            {/* Header Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-surface border border-border flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-caption font-bold uppercase text-muted-foreground">Items en Base</span>
                        <Package className="w-5 h-5 text-violet-400" />
                    </div>
                    <div className="mt-4">
                        <div className="text-2xl font-black text-foreground">
                            {loading ? '...' : stats?.totalItems.toLocaleString('fr-FR') || 0}
                        </div>
                        <span className="text-caption text-muted-foreground font-medium">Référentiel BDD</span>
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-surface border border-border flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-caption font-bold uppercase text-muted-foreground">Recettes Intégrées</span>
                        <Scroll className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="mt-4">
                        <div className="text-2xl font-black text-foreground">
                            {loading ? '...' : stats?.totalWithRecipe.toLocaleString('fr-FR') || 0}
                        </div>
                        <span className="text-caption text-muted-foreground font-medium">Craft & Ingrédients</span>
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-surface border border-border flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-caption font-bold uppercase text-muted-foreground">Images WebP</span>
                        <ShieldCheck className="w-5 h-5 text-success" />
                    </div>
                    <div className="mt-4">
                        <div className="text-2xl font-black text-foreground">
                            {loading ? '...' : stats?.totalWebpImages.toLocaleString('fr-FR') || 0}
                        </div>
                        <span className="text-caption text-muted-foreground font-medium">WebP réellement sur disque</span>
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-surface border border-border flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-caption font-bold uppercase text-muted-foreground">Action GOD</span>
                        <Flame className="w-5 h-5 text-warning" />
                    </div>
                    <div className="mt-4">
                        <Button
                            onClick={handleStartSiphon}
                            disabled={isSiphoning || isPending}
                            className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl gap-2 shadow-sm"
                        >
                            {isSiphoning ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    Synchronisation...
                                </>
                            ) : (
                                <>
                                    <Download className="w-4 h-4" />
                                    Synchroniser DofusDB
                                </>
                            )}
                        </Button>
                        <Button
                            onClick={handleSiphonReferentials}
                            disabled={isSiphoningRefs || isPending}
                            variant="outline"
                            className="w-full mt-2 rounded-xl gap-2"
                        >
                            {isSiphoningRefs ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    Référentiels...
                                </>
                            ) : (
                                <>
                                    <Layers className="w-4 h-4" />
                                    Synchroniser les référentiels
                                </>
                            )}
                        </Button>
                        <p className="text-caption text-muted-foreground mt-2">
                            Effets &amp; caractéristiques DofusDB (libellés FR, icônes, « % ») — requis par
                            l&apos;éditeur de jet FM du Marché.
                        </p>
                    </div>
                </div>
            </div>

            {/* Siphon progress bar */}
            {isSiphoning && (
                <div className="p-5 rounded-2xl bg-surface border border-violet-500/30 space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-sm">
                        <span className="font-bold text-violet-400 flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin" /> {siphonStatus || 'Traitement en cours...'}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">{progressValue}%</span>
                    </div>
                    <Progress value={progressValue} className="h-2" />
                </div>
            )}

            {/* Local Search Test & Preview */}
            <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-label font-bold text-foreground">Explorer le catalogue local</h3>
                        <p className="text-caption text-muted-foreground font-medium">
                            Testez la recherche instantanée (0ms, sans solliciter aucune API externe)
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSearch} className="flex gap-3">
                    <div className="relative flex-1">
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Rechercher un item local (ex: Voile d'Encre, Gloursonne, Gelano)..."
                            className="pl-10 h-11 bg-background/80 rounded-xl"
                        />
                        <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                    </div>
                    <Button type="submit" disabled={searching} className="h-11 px-5 rounded-xl font-bold gap-2">
                        {searching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        Rechercher
                    </Button>
                </form>

                {searchResults.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                        {searchResults.map((item) => (
                            <div
                                key={item.id}
                                className="p-3.5 rounded-xl bg-background/60 border border-border/70 flex items-center gap-3.5 hover:border-violet-500/40 transition-colors"
                            >
                                <div className="w-10 h-10 rounded-lg bg-surface border border-border flex items-center justify-center shrink-0">
                                    <img
                                        src={`/api/assets-dofus/items/${item.ankamaId}`}
                                        alt={item.name}
                                        className="w-8 h-8 object-contain"
                                    />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-body-sm font-bold text-foreground truncate">{item.name}</div>
                                    <div className="flex items-center gap-2 text-caption text-muted-foreground">
                                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">
                                            Niv. {item.level}
                                        </Badge>
                                        <span>{item.typeName}</span>
                                        {item.hasRecipe && (
                                            <span className="text-emerald-400 font-semibold text-[10px]">✨ Recette</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Terminal logs */}
            {logs.length > 0 && (
                <div className="p-4 rounded-2xl bg-black/80 border border-border space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                        <span>Journal d&apos;activité du Siphon</span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setLogs([])}
                            className="h-6 text-[10px] text-muted-foreground hover:text-foreground"
                        >
                            Effacer
                        </Button>
                    </div>
                    <div className="max-h-48 overflow-y-auto font-mono text-xs text-foreground/80 space-y-1 custom-scrollbar">
                        {logs.map((log, idx) => (
                            <div key={idx}>{log}</div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

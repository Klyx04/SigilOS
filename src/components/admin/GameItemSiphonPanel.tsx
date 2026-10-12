'use client';

import { useState, useEffect } from 'react';
import {
    Package,
    RefreshCw,
    Search,
    ShieldCheck,
    Scroll,
    Flame,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    getGameItemsStats,
    searchLocalGameItems,
    type GameItemSearchResult,
} from '@/server/actions/game-item-actions';

/**
 * Référentiel local des items (`GameItem`) — **écran de consultation**.
 *
 * ⚠️ Les deux lancements (items = ITEMS, référentiels = REFERENTIALS) vivent depuis le
 * 23/09/2026 dans **📊 Tableau** (`GameDataSyncStatePanel` → `game-data-inline-runners.ts`) :
 * une seule porte d'entrée, une seule implémentation. Ici : couverture, recettes, WebP,
 * recherche locale — rien à lancer.
 */
export function GameItemSiphonPanel() {
    const [stats, setStats] = useState<{
        totalItems: number;
        totalWithRecipe: number;
        totalWebpImages: number;
        byCategory: Record<string, number>;
        lastUpdated: string | null;
    } | null>(null);

    const [loading, setLoading] = useState(true);

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

    // ── Le lancement GÉNÉRIQUE (items DofusDB = ITEMS) est dans **📊 Tableau** depuis le
    // 23/09/2026 : une seule porte d'entrée, une seule implémentation
    // (`game-data-inline-runners.ts`, qui porte la boucle + le backoff 429).
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
                        <span className="text-caption font-bold uppercase text-muted-foreground">Lancement</span>
                        <Flame className="w-5 h-5 text-warning" />
                    </div>
                    <div className="mt-4 space-y-2">
                        <p className="text-caption text-muted-foreground">
                            Ce référentiel se lance depuis <strong className="text-foreground">📊 Tableau</strong>
                            {' '}— une seule porte d&apos;entrée :
                        </p>
                        <ul className="text-caption text-muted-foreground space-y-1 list-disc pl-4">
                            <li>
                                <strong className="text-foreground">Items &amp; ressources</strong> : bouton
                                {' '}« ⏳ En arrière-plan » (survit à la fermeture de l&apos;onglet) ou son repli « ▶ Ici ».
                            </li>
                            <li>
                                <strong className="text-foreground">Référentiels</strong> (libellés FR, icônes, « % ») :
                                bouton « ▶ Lancer ici ».
                            </li>
                        </ul>
                        <p className="text-caption text-muted-foreground">
                            Ici : consultation (couverture BDD, recettes, WebP, recherche locale).
                        </p>
                        <p className="text-caption text-warning/90">
                            Les retouches <strong>sans réseau</strong> (effets natifs manquants, libellés
                            d&apos;effets gabarits) sont dans l&apos;onglet <strong>🧰 Outils locaux</strong>.
                        </p>
                    </div>
                </div>
            </div>

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
        </div>
    );
}

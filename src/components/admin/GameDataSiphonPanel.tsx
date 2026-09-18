'use client';

import { useState, useEffect, useTransition } from 'react';
import {
    ShieldCheck,
    RefreshCw,
    Download,
    HardDrive,
    Database,
    MapPin,
    Search,
    CheckCircle2,
    AlertTriangle,
    Layers,
    FileImage,
    Sparkles,
    Swords,
    ChevronRight,
    Terminal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
    getSiphonDashboardStats,
    getSiphonInventory,
    triggerBatchAssetSiphonAction,
    warmClassSpellbook,
    type SiphonDashboardStats,
    type SiphonInventoryItem,
} from '@/server/actions/asset-siphon-actions';
import { siphonDungeonMonstersDatasetAction, siphonBountiesRaceAction } from '@/server/actions/game-data-admin-actions';
import { BOUNTY_RACE_IDS, BOUNTY_RACE_NAMES } from '@/lib/bounty';
import { getClassName } from '@/lib/dofusbook-utils';
import { toast } from 'sonner';

/**
 * Vignette boss via le proxy `/api/assets-dofus` (jamais de 404 : local →
 * siphon à la volée → placeholder SVG 200). `onError` → icône, en dernier recours.
 */
function BossThumb({ item }: { item: SiphonInventoryItem }) {
    const [failed, setFailed] = useState(false);
    const proxySrc = item.id
        ? `/api/assets-dofus/monsters/${encodeURIComponent(String(item.id))}${item.remoteImageUrl ? `?url=${encodeURIComponent(item.remoteImageUrl)}` : ""}`
        : null;
    const src = item.localImageUrl || (!failed ? proxySrc : null);
    if (!src) {
        return <Swords className="w-4 h-4 text-muted-foreground" />;
    }
    return (
        <img
            src={src}
            alt={item.name}
            className="w-full h-full object-contain"
            loading="lazy"
            onError={() => setFailed(true)}
        />
    );
}

/** Taille lisible du même périmètre que le compteur affiché. */
function formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 Ko';
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function GameDataSiphonPanel() {
    const [stats, setStats] = useState<SiphonDashboardStats | null>(null);
    const [inventory, setInventory] = useState<SiphonInventoryItem[]>([]);
    const [totalItems, setTotalItems] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    // Filtres
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'cached' | 'missing'>('all');

    // Logs et progression
    const [logs, setLogs] = useState<string[]>([]);
    const [isSiphoning, setIsSiphoning] = useState(false);
    const [isSiphoningDataset, setIsSiphoningDataset] = useState(false);
    const [isSiphoningBounties, setIsSiphoningBounties] = useState(false);
    const [isWarmingSpells, setIsWarmingSpells] = useState(false);
    const [progressValue, setProgressValue] = useState(0);
    // Résumé persistant après la fin du run (la barre ne disparaît plus dans le vide)
    const [siphonSummary, setSiphonSummary] = useState<string | null>(null);

    const handleSiphonDungeonDataset = async () => {
        setIsSiphoningDataset(true);
        setLogs((prev) => ['🚀 Siphonnage du catalogue Donjons & Familles DofusDB en cours...', ...prev]);
        try {
            const res = await siphonDungeonMonstersDatasetAction();
            if (res.success && res.data) {
                const data = res.data;
                toast.success(`Catalogue synchronisé : ${data.totalDungeons} donjons et ${data.totalMonsters} monstres archivés en local !`);
                setLogs((prev) => [
                    `✅ Catalogue 100% à jour : ${data.totalDungeons} donjons, ${data.totalMonsters} monstres (${data.totalBossFamilies} familles).`,
                    ...prev
                ]);
                await loadData();
            } else {
                toast.error(res.error || 'Erreur lors du siphon du catalogue');
            }
        } catch (e: any) {
            toast.error(`Erreur : ${e.message}`);
        } finally {
            setIsSiphoningDataset(false);
        }
    };

    /**
     * Siphon des **avis de recherche** (96 avis, 5 races) : un appel serveur PAR
     * RACE plutôt qu'un seul appel de 60 s+ sujet aux coupures/timeout ("An
     * unexpected response was received from the server"). Chaque race écrit son
     * résumé dans le journal dès réception ⇒ suivi temps réel + progression.
     * Idempotent (relançable sans effet de bord).
     */
    const handleSiphonBounties = async () => {
        setIsSiphoningBounties(true);
        setSiphonSummary(null);
        setLogs((prev) => ['🚀 Siphonnage des avis de recherche (DofusDB + Dofensive), race par race…', ...prev]);
        const totals = { synced: 0, unchanged: 0, total: 0, unproven: 0, images: 0, errors: 0 };
        let failed = false;
        try {
            for (let i = 0; i < BOUNTY_RACE_IDS.length; i++) {
                const raceId = BOUNTY_RACE_IDS[i] as number;
                const raceName = BOUNTY_RACE_NAMES[raceId] ?? `Race ${raceId}`;
                setLogs((prev) => [`⏳ Race ${raceName} (${i + 1}/${BOUNTY_RACE_IDS.length}) en cours…`, ...prev]);
                try {
                    const res = await siphonBountiesRaceAction(raceId);
                    if (res.success && res.data) {
                        const data = res.data;
                        totals.synced += data.synced;
                        totals.unchanged += data.unchanged;
                        totals.total += data.total;
                        totals.unproven += data.unproven;
                        totals.images += data.images;
                        totals.errors += data.errors.length;
                        setLogs((prev) => [
                            `✅ ${raceName} : ${data.total} avis (${data.synced} écrits, ${data.unchanged} inchangés, ${data.unproven} non prouvés, ${data.images} icônes)` +
                            (data.errors.length > 0 ? ` — ${data.errors.length} erreur(s) : ${data.errors.slice(0, 3).join(' · ')}` : ''),
                            ...prev
                        ]);
                    } else {
                        failed = true;
                        totals.errors += 1;
                        setLogs((prev) => [`❌ ${raceName} : ${res.error || 'échec'} — passe suivante conservée.`, ...prev]);
                    }
                } catch (e: any) {
                    failed = true;
                    totals.errors += 1;
                    setLogs((prev) => [`❌ ${raceName} : ${e?.message || e} — passe suivante conservée.`, ...prev]);
                }
                setProgressValue(Math.round(((i + 1) / BOUNTY_RACE_IDS.length) * 100));
            }
            const summary = `Avis de recherche : ${totals.total} avis (${totals.synced} écrits, ${totals.unchanged} inchangés, ${totals.unproven} non prouvés, ${totals.images} icônes, ${totals.errors} erreur(s)).`;
            setSiphonSummary(summary);
            setLogs((prev) => [`🎉 ${summary}`, ...prev]);
            if (!failed) {
                toast.success(`Avis de recherche : ${totals.total} avis résolus (${totals.synced} écrits, ${totals.images} icônes) !`);
            } else {
                toast.error('Siphon terminé avec des erreurs — voir le journal.');
            }
            await loadData();
        } finally {
            setIsSiphoningBounties(false);
        }
    };

    /**
     * Grimoires des 19 classes (DofusDB → `ClassSpellbook` + icônes WebP disque) :
     * un appel serveur PAR CLASSE, comme les avis race par race (un appel unique
     * de ~10 min casserait sur timeout). Idempotent (upsert + skip disque).
     */
    const CLASS_IDS = Array.from({ length: 19 }, (_, i) => i + 1);

    const handleWarmClassSpells = async () => {
        setIsWarmingSpells(true);
        setSiphonSummary(null);
        setLogs((prev) => ['🚀 Pré-chauffe des grimoires (DofusDB → BDD + icônes disque), classe par classe…', ...prev]);
        const totals = { spells: 0, grades: 0, icons: 0, iconErrors: 0, errors: 0 };
        let failed = false;
        try {
            for (let i = 0; i < CLASS_IDS.length; i++) {
                const classId = CLASS_IDS[i] as number;
                const label = getClassName(classId);
                setLogs((prev) => [`⏳ ${label} (${i + 1}/${CLASS_IDS.length}) en cours…`, ...prev]);
                try {
                    const res = await warmClassSpellbook(classId);
                    if (res.success && res.data) {
                        const d = res.data;
                        totals.spells += d.spells;
                        totals.grades += d.grades;
                        totals.icons += d.iconsSiphoned;
                        totals.iconErrors += d.iconsFailed;
                        setLogs((prev) => [
                            `✅ ${label} : ${d.spells} sorts (${d.grades} grades) persistés, ${d.iconsSiphoned} icônes OK` +
                            (d.iconsFailed > 0 ? `, ${d.iconsFailed} icône(s) en échec` : ''),
                            ...prev,
                        ]);
                    } else {
                        failed = true;
                        totals.errors += 1;
                        setLogs((prev) => [`❌ ${label} : ${res.error || 'échec'} — passe suivante conservée.`, ...prev]);
                    }
                } catch (e: any) {
                    failed = true;
                    totals.errors += 1;
                    setLogs((prev) => [`❌ ${label} : ${e?.message || e} — passe suivante conservée.`, ...prev]);
                }
                setProgressValue(Math.round(((i + 1) / CLASS_IDS.length) * 100));
            }
            const summary = `Grimoires : ${totals.spells} sorts (${totals.grades} grades) persistés, ${totals.icons} icônes OK, ${totals.errors + totals.iconErrors} erreur(s).`;
            setSiphonSummary(summary);
            setLogs((prev) => [`🎉 ${summary}`, ...prev]);
            if (!failed && totals.iconErrors === 0) {
                toast.success(`Grimoires : ${totals.spells} sorts persistés, ${totals.icons} icônes sur disque !`);
            } else {
                toast.error('Warm terminé avec des erreurs — voir le journal.');
            }
            await loadData();
        } finally {
            setIsWarmingSpells(false);
        }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const [statsRes, invRes] = await Promise.all([
                getSiphonDashboardStats(),
                getSiphonInventory({ search, status: statusFilter, limit: 100 }),
            ]);

            if (statsRes.success && statsRes.data) {
                setStats(statsRes.data);
            }
            if (invRes.success && invRes.data) {
                setInventory(invRes.data.items);
                setTotalItems(invRes.data.total);
            }
        } catch (err) {
            console.error('Erreur chargement données siphon:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [statusFilter]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        loadData();
    };

    const handleSiphonAllMissing = async () => {
        const missingTargets = inventory.filter((i) => !i.hasLocalImage || !i.hasDbStat);
        if (missingTargets.length === 0) {
            setLogs((prev) => ['ℹ️ Tous les éléments affichés sont déjà 100% autonomes et en cache local.', ...prev]);
            return;
        }

        setIsSiphoning(true);
        setProgressValue(0);
        setSiphonSummary(null);
        setLogs((prev) => [`🚀 Démarrage du siphon de ${missingTargets.length} éléments par lots de 5...`, ...prev]);

        startTransition(async () => {
            let totalSiphoned = 0;
            let totalErrors = 0;
            let totalSkipped = 0;
            const CHUNK_SIZE = 5;

            try {
                for (let i = 0; i < missingTargets.length; i += CHUNK_SIZE) {
                    const chunk = missingTargets.slice(i, i + CHUNK_SIZE);
                    const res = await triggerBatchAssetSiphonAction(
                        chunk.map((t) => ({
                            id: t.id,
                            // Doubles boss : siphonner le vrai monstre (« Klime »), pas le libellé (« Comte et Klime »)
                            name: t.resolvedMonsterName || t.name,
                            dungeonName: t.dungeonName,
                            remoteUrl: t.remoteImageUrl || undefined,
                        }))
                    );

                    if (res.success && res.data) {
                        const batchData = res.data;
                        totalSiphoned += batchData.siphoned;
                        totalErrors += batchData.errors;
                        totalSkipped += batchData.skipped ?? 0;
                        if (batchData.details && batchData.details.length > 0) {
                            setLogs((prev) => [...batchData.details, ...prev]);
                        }
                    } else if (res.error) {
                        totalErrors += chunk.length;
                        setLogs((prev) => [`❌ Erreur sur le lot : ${res.error}`, ...prev]);
                    }

                    const progress = Math.min(100, Math.round(((i + chunk.length) / missingTargets.length) * 100));
                    setProgressValue(progress);
                }

                const summary = `Siphon terminé : ${totalSiphoned} siphonnés, ${totalSkipped} ignorés, ${totalErrors} erreurs.`;
                setSiphonSummary(summary);
                setLogs((prev) => [`🎉 ${summary}`, ...prev]);
            } catch (error) {
                setLogs((prev) => [`❌ Exception globale : ${String(error)}`, ...prev]);
            } finally {
                setIsSiphoning(false);
                await loadData();
            }
        });
    };

    const handleSingleSiphon = async (item: SiphonInventoryItem) => {
        setLogs((prev) => [`⏳ Siphon de ${item.name} (${item.dungeonName || 'Donjon'})...`, ...prev]);
        try {
            const res = await triggerBatchAssetSiphonAction(
                [{ id: item.id, name: item.resolvedMonsterName || item.name, dungeonName: item.dungeonName, remoteUrl: item.remoteImageUrl || undefined }],
                { forceRefresh: true }
            );
            if (res.success && res.data) {
                setLogs((prev) => [`✅ ${item.name} synchronisé avec succès !`, ...prev]);
                await loadData();
            }
        } catch (err) {
            setLogs((prev) => [`❌ Échec du siphon pour ${item.name}`, ...prev]);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header : chiffres honnêtes (pas de score) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                <div className="p-5 rounded-2xl bg-surface/80 border border-border/70 backdrop-blur-sm relative overflow-hidden shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-caption font-black text-muted-foreground uppercase tracking-widest">
                            Fiches fraîches
                        </span>
                        <ShieldCheck className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-foreground">
                            {stats?.freshDungeons ?? 0} <span className="text-sm font-medium text-muted-foreground">/ {stats?.totalDungeons ?? 0} donjons</span>
                        </span>
                    </div>
                    <Progress
                        value={stats && stats.totalDungeons > 0 ? Math.round((stats.freshDungeons / stats.totalDungeons) * 100) : 0}
                        className="mt-3 h-2 bg-emerald-950/40"
                    />
                    <p className="text-caption text-muted-foreground mt-1">Fiches synchronisées il y a moins de 24 h</p>
                </div>

                <div className="p-5 rounded-2xl bg-surface/80 border border-border/70 backdrop-blur-sm shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-caption font-black text-muted-foreground uppercase tracking-widest">
                            Fiches en BDD
                        </span>
                        <Database className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div className="mt-3">
                        <span className="text-3xl font-black text-foreground">
                            {stats?.totalMonsterStatsInDb ?? 0} <span className="text-sm font-medium text-muted-foreground">lignes</span>
                        </span>
                    </div>
                    <p className="text-caption text-muted-foreground mt-1">Toutes sources (boss + titans) · {stats?.totalDungeons ?? 0} donjons au référentiel</p>
                </div>

                <div className="p-5 rounded-2xl bg-surface/80 border border-border/70 backdrop-blur-sm shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-caption font-black text-muted-foreground uppercase tracking-widest">
                            Maps Dofensive
                        </span>
                        <MapPin className="w-5 h-5 text-sky-500" />
                    </div>
                    <div className="mt-3">
                        <span className="text-3xl font-black text-foreground">
                            {stats?.totalDofensiveMapsInDb ?? 0} <span className="text-sm font-medium text-muted-foreground">maps</span>
                        </span>
                    </div>
                    <p className="text-caption text-muted-foreground mt-1">Grilles 40×14, obstacles et spawns</p>
                </div>

                <div className="p-5 rounded-2xl bg-surface/80 border border-border/70 backdrop-blur-sm shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-caption font-black text-muted-foreground uppercase tracking-widest">
                            Images WebP sur Disque
                        </span>
                        <HardDrive className="w-5 h-5 text-amber-500" />
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-foreground">{stats?.storage.monstersCount ?? 0}</span>
                        <span className="text-caption text-amber-500 font-bold">({formatBytes(stats?.storage.monstersSizeBytes ?? 0)})</span>
                    </div>
                    <p className="text-caption text-muted-foreground mt-1">WebP monstres réellement sur disque</p>
                </div>

                <div className="p-5 rounded-2xl bg-surface/80 border border-border/70 backdrop-blur-sm shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-caption font-black text-muted-foreground uppercase tracking-widest">
                            Grimoires de classes
                        </span>
                        <Sparkles className="w-5 h-5 text-violet-500" />
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-foreground">
                            {stats?.classSpellbooksWarmed ?? 0} <span className="text-sm font-medium text-muted-foreground">/ 19 classes</span>
                        </span>
                    </div>
                    <Progress
                        value={Math.round(((stats?.classSpellbooksWarmed ?? 0) / 19) * 100)}
                        className="mt-3 h-2 bg-violet-950/40"
                    />
                    <p className="text-caption text-muted-foreground mt-1">{stats?.classSpellsStored ?? 0} sorts persistés en BDD</p>
                </div>
            </div>

            {/* Barre de contrôles & Filtres */}
            <div className="p-5 rounded-2xl bg-elevated/60 border border-border/80 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 max-w-md">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Rechercher un boss ou un donjon..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 bg-background/80 rounded-xl"
                        />
                    </div>
                    <Button type="submit" variant="secondary" size="sm" className="rounded-xl font-bold">
                        Filtrer
                    </Button>
                </form>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-xl bg-background/80 p-1 border border-border">
                        <button
                            type="button"
                            onClick={() => setStatusFilter('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                statusFilter === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Tous ({totalItems})
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('cached')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                statusFilter === 'cached' ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            🟢 En cache local
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('missing')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                statusFilter === 'missing' ? 'bg-amber-600 text-white' : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            ⚠️ À siphoner
                        </button>
                    </div>

                    <Button
                        onClick={handleSiphonDungeonDataset}
                        disabled={isSiphoningDataset || isPending}
                        variant="secondary"
                        className="rounded-xl gap-2"
                        title="Régénère le catalogue JSON local (public/game-data/dungeon-monsters.json) — n'alimente PAS la BDD Donjons (CRUD manuel onglet Donjons)"
                    >
                        {isSiphoningDataset ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                        Régénérer le catalogue JSON
                    </Button>

                    <Button
                        onClick={handleSiphonBounties}
                        disabled={isSiphoningBounties || isPending}
                        className="rounded-xl gap-2"
                        title="Siphonne les 96 avis de recherche race par race (DofusDB monster-races/32|90|127|147|156 + Dofensive /monsters/{id}) : lignes Bounty par dofusdbId, fiches MonsterStat, sorts et icônes"
                    >
                        {isSiphoningBounties ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Siphonner les avis de recherche
                    </Button>

                    <Button
                        onClick={handleWarmClassSpells}
                        disabled={isWarmingSpells || isPending}
                        className="rounded-xl gap-2"
                        title="Pré-chauffe les 19 grimoires de classes (DofusDB → BDD ClassSpellbook + icônes WebP sur disque), classe par classe. Idempotent."
                    >
                        {isWarmingSpells ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        Pré-chauffer sorts de classes (19)
                    </Button>

                    <Button
                        onClick={handleSiphonAllMissing}
                        disabled={isSiphoning || isPending}
                        variant="secondary"
                        className="rounded-xl gap-2"
                        title="Siphonne les éléments manquants parmi les 100 affichés (filtre ci-dessus)"
                    >
                        {isSiphoning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Siphonner les manquants affichés (100 max)
                    </Button>

                    <Button
                        onClick={loadData}
                        variant="outline"
                        size="icon"
                        disabled={loading}
                        className="rounded-xl"
                        title="Rafraîchir les données"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* Console de sortie / Logs en direct — EN HAUT, sous les contrôles :
                visible sans scroller dès qu'un siphon tourne, alimentée au fil
                de l'eau (une ligne par lot/race dès réception). */}
            {(logs.length > 0 || isSiphoning || isSiphoningDataset || isSiphoningBounties || isWarmingSpells) && (
                <div className="p-5 rounded-2xl bg-black/80 border border-border/80 font-mono text-xs text-emerald-400 space-y-2 max-h-72 overflow-y-auto">
                    <div className="flex items-center gap-2 text-white font-bold border-b border-white/10 pb-2">
                        <Terminal className="w-4 h-4 text-emerald-400" />
                        <span>Journal de siphonnage en direct</span>
                        {(isSiphoning || isSiphoningDataset || isSiphoningBounties || isWarmingSpells) && (
                            <span className="ml-auto flex items-center gap-1.5 text-emerald-400 font-sans font-bold">
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                En cours…
                            </span>
                        )}
                    </div>
                    {logs.length === 0 && (
                        <div className="leading-relaxed text-muted-foreground">
                            Démarrage…
                        </div>
                    )}
                    {logs.map((log, index) => (
                        <div key={index} className="leading-relaxed">
                            {log}
                        </div>
                    ))}
                </div>
            )}

            {/* Barre de progression pendant le siphon + résumé persistant après */}
            {(isSiphoning || siphonSummary) && (
                <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                        <span>
                            {isSiphoning
                                ? "Siphonnage & compression WebP en cours (concurrence 2 + jitter anti-flag)..."
                                : siphonSummary}
                        </span>
                        <span>{isSiphoning ? `${progressValue}%` : "100%"}</span>
                    </div>
                    <Progress value={isSiphoning ? progressValue : 100} className="h-2 bg-emerald-950/60" />
                </div>
            )}

            {/* Tableau d'inventaire */}
            <div className="rounded-2xl border border-border/80 bg-surface/60 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-elevated/80 border-b border-border/80 text-xs font-black text-muted-foreground uppercase tracking-wider">
                            <tr>
                                <th className="p-4">Monstre / Boss</th>
                                <th className="p-4">Donjon associé</th>
                                <th className="p-4">Fiche Stats (BDD)</th>
                                <th className="p-4">Image WebP (Disque)</th>
                                <th className="p-4">Map Dofensive</th>
                                <th className="p-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                            {inventory.map((item, index) => {
                                const isComplete = item.hasDbStat && item.hasLocalImage && item.hasDofensiveMap;

                                return (
                                    <tr key={`${item.type}-${item.id}-${item.dungeonName || index}`} className="hover:bg-elevated/40 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-background border border-border/80 flex items-center justify-center p-1 overflow-hidden shrink-0">
                                                    <BossThumb item={item} />
                                                </div>
                                                <div>
                                                    <div className="font-black text-foreground flex items-center gap-2">
                                                        {item.name}
                                                        {isComplete && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 inline" />}
                                                    </div>
                                                    <div className="text-caption text-muted-foreground">ID: #{item.id}</div>
                                                    {item.resolvedMonsterName && item.resolvedMonsterName !== item.name && (
                                                        <div className="text-caption text-muted-foreground/70" title="Double boss : le siphon cible le vrai monstre, pas le libellé du donjon">
                                                            Monstre siphonné : {item.resolvedMonsterName}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        <td className="p-4">
                                            <div className="font-bold text-foreground">{item.dungeonName || '—'}</div>
                                            {item.level && <div className="text-caption text-muted-foreground">Niveau {item.level}</div>}
                                        </td>

                                        <td className="p-4">
                                            {item.hasDbStat ? (
                                                <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-bold">
                                                    ✓ En BDD locale
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-amber-500/10 border-amber-500/20 text-amber-400 font-bold">
                                                    ⚠️ À synchroniser
                                                </Badge>
                                            )}
                                        </td>

                                        <td className="p-4">
                                            {item.hasLocalImage ? (
                                                <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-bold">
                                                    ✓ WebP Local
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-sky-500/10 border-sky-500/20 text-sky-400 font-bold" title="Aucun WebP local — URL distante non vérifiée">
                                                    Distant — non siphonné
                                                </Badge>
                                            )}
                                        </td>

                                        <td className="p-4">
                                            {item.hasDofensiveMap ? (
                                                <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-bold">
                                                    ✓ Map 40×14
                                                </Badge>
                                            ) : (
                                                <span className="text-caption text-muted-foreground/40 font-medium px-2 py-0.5 rounded bg-surface/50 border border-border/30" title="Aucune map trouvée par matching de nom — pas forcément absente côté Dofensive">
                                                    Non résolue (matching nom)
                                                </span>
                                            )}
                                        </td>

                                        <td className="p-4 text-right">
                                            <Button
                                                onClick={() => handleSingleSiphon(item)}
                                                variant="secondary"
                                                size="sm"
                                                className="rounded-lg text-xs font-bold"
                                                title="Force le resync (ignore la fraîcheur 24h)"
                                            >
                                                Forcer resync
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}

                            {inventory.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                        Aucun élément ne correspond aux filtres actuels.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

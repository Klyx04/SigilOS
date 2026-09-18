"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, ExternalLink, Loader2, MapPin, Crown, Users, Search, Calendar, Layers, Swords, Clock, ScrollText, Zap, Target } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getUserTitansData, toggleTitanCompleted } from "@/server/actions/titan-actions";
import { getMonsterStats, getDungeonMonsters } from "@/server/actions/game-data-actions";
import { getBossDofensiveSpells, getDofensiveDungeonForBoss, type DofensiveDungeonInfo } from "@/server/actions/dofensive-actions";
import { mergeDofensiveSpells } from "@/lib/dofensive-spells";
import { resolveDofusAssetImageUrl } from "@/lib/dofus-image-url";
import { SpellRangeGrid } from "@/components/succes/SpellRangeGrid";

interface Titan {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    zone?: string | null;
    level?: number | null;
    imageUrl?: string | null;
    dofensiveUrl?: string | null;
    dpnlUrl?: string | null;
    dofuspourlesnoobsUrl?: string | null;
    mapName?: string | null;
    dofusdbId?: number | null;
    questName?: string | null;
    questUrl?: string | null;
    scheduleConfig?: any;
    seasonBosses?: { season: string; bossName: string }[] | null;
    seasons: string[];
    currentSeason?: string | null;
    maxMembers?: number;
}

interface TitanProgressEntry {
    titanId: string;
    profileId: string;
    pseudo?: string;
    image?: string | null;
    dofusClass?: string | null;
    completedAt: string | null;
}

function formatSchedule(schedule?: any): string {
    if (!schedule) return "Disponibilité non renseignée";
    const days: string[] = [];
    if (Array.isArray(schedule.daysOfWeek)) {
        const labels = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
        schedule.daysOfWeek.forEach((d: number) => {
            if (labels[d]) days.push(labels[d]);
        });
    }
    const time = schedule.startTime && schedule.endTime ? `${schedule.startTime} → ${schedule.endTime}` : null;
    const parts: string[] = [];
    if (schedule.onlyWeekend) parts.push("Week-end uniquement");
    if (days.length) parts.push(`Jours : ${days.join(", ")}`);
    if (time) parts.push(time);
    if (schedule.maxWinsPerWeekend) parts.push(`${schedule.maxWinsPerWeekend} victoires max / week-end`);
    return parts.length ? parts.join(" · ") : "Disponibilité non renseignée";
}

/**
 * Résout la meilleure source d'image du titan (stats DofusDB > image locale > fallback)
 * — **toujours via le proxy interne** `/api/assets-dofus/monsters/{id}` : le navigateur
 * ne doit jamais hotlinker `api.dofusdb.fr` (le serveur sert le WebP siphonné, cache 1 an).
 */
function titanImage(t: Titan, stats?: any): string | null {
    const src = stats?.imageUrl || t.imageUrl;
    return resolveDofusAssetImageUrl("monsters", t.dofusdbId, src) ?? src ?? null;
}

function MonsterImage({ src, alt = "", className = "", monsterId }: { src?: string | null; alt?: string; className?: string; monsterId?: number | string }) {
    const targetId = monsterId;
    const initialSrc = targetId ? `/api/assets-dofus/monsters/${targetId}${src ? `?url=${encodeURIComponent(src)}` : ""}` : (src || null);
    const [currentSrc, setCurrentSrc] = useState<string | null>(initialSrc);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        const newSrc = targetId ? `/api/assets-dofus/monsters/${targetId}${src ? `?url=${encodeURIComponent(src)}` : ""}` : (src || null);
        setCurrentSrc(newSrc);
        setFailed(false);
    }, [src, targetId]);
    const handleError = () => setFailed(true);
    if (!currentSrc || failed) {
        return (
            <span className={cn("inline-flex items-center justify-center text-muted-foreground/40 bg-elevated", className)}>
                <Swords className="w-1/2 h-1/2 max-w-6 max-h-6" />
            </span>
        );
    }
    return <img src={currentSrc} alt={alt} className={className} loading="lazy" onError={handleError} />;
}

export function SuccesTitanTab({ guildId, canEdit }: { guildId: string; canEdit: boolean }) {
    const [titans, setTitans] = useState<Titan[]>([]);
    const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
    const [progress, setProgress] = useState<TitanProgressEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [filter, setFilter] = useState<"all" | "done" | "todo">("all");
    const [stats, setStats] = useState<any>(null);
    const [loadingStats, setLoadingStats] = useState(false);
    const [activeGradeIndex, setActiveGradeIndex] = useState(0);
    const [detailTab, setDetailTab] = useState<"info" | "sim" | "monsters">("info");
    const [activeSpellId, setActiveSpellId] = useState<number | undefined>(undefined);
    const [dungeonMaps, setDungeonMaps] = useState<DofensiveDungeonInfo | null | undefined>(undefined);
    const [family, setFamily] = useState<{ familyId: number | null; monsters: { id: number; name: string; imageUrl: string | null; isBoss: boolean }[] } | null>(null);

    useEffect(() => {
        let cancelled = false;
        getUserTitansData(guildId)
            .then((res) => {
                if (cancelled) return;
                if (res.success && res.data) {
                    setTitans(res.data.titans);
                    setCompletedIds(new Set(res.data.completedTitanIds));
                    setProgress(res.data.progress);
                } else {
                    toast.error(res.error || "Erreur");
                }
            })
            .catch(() => toast.error("Impossible de charger les titans"))
            .finally(() => !cancelled && setLoading(false));
        return () => { cancelled = true; };
    }, [guildId]);

    const filtered = useMemo(() => {
        let list = titans;
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter((d) => d.name.toLowerCase().includes(q) || (d.zone || "").toLowerCase().includes(q));
        }
        if (filter === "done") list = list.filter((d) => completedIds.has(d.id));
        else if (filter === "todo") list = list.filter((d) => !completedIds.has(d.id));
        return list;
    }, [titans, search, filter, completedIds]);

    const selected = titans.find((d) => d.id === selectedId) ?? null;

    // Stats & sorts du titan (local-first via getMonsterStats / Dofensive).
    useEffect(() => {
        if (!selected) { setStats(null); return; }
        let cancelled = false;
        setLoadingStats(true);
        setStats(null);
        getMonsterStats(selected.name, undefined)
            .then(async (res) => {
                if (cancelled) return;
                if (res.success && res.data) {
                    let data = res.data;
                    const dRes = await getBossDofensiveSpells(selected.name, undefined);
                    if (dRes.success && dRes.data) {
                        data = { ...data, spells: mergeDofensiveSpells(data.spells ?? [], dRes.data) };
                    }
                    if (!cancelled) setStats(data);
                }
            })
            .catch(() => {})
            .finally(() => { if (!cancelled) setLoadingStats(false); });
        return () => { cancelled = true; };
    }, [selected]);

    // Maps Dofensive + monstres de salle du titan (onglet Simulation / Monstres de salle).
    useEffect(() => {
        if (!selected) { setDungeonMaps(undefined); setFamily(null); return; }
        let cancelled = false;
        const name = selected.name;
        const map = selected.mapName ?? undefined;
        getDungeonMonsters(name, map)
            .then((res) => { if (!cancelled && res.success && res.data) setFamily(res.data); })
            .catch(() => {});
        getDofensiveDungeonForBoss(name, map)
            .then((res) => { if (!cancelled) setDungeonMaps(res.success && res.data ? res.data : null); })
            .catch(() => { if (!cancelled) setDungeonMaps(null); });
        setDetailTab("info");
        return () => { cancelled = true; };
    }, [selected]);

    async function handleToggle(id: string) {
        if (!canEdit) return;
        const prev = new Set(completedIds);
        const next = new Set(completedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setCompletedIds(next);
        const res = await toggleTitanCompleted(guildId, id);
        if (!res.success || res.data?.completed === (!prev.has(id))) {
            setCompletedIds(prev);
            toast.error(res.error || "Erreur");
        } else {
            toast.success(res.data?.completed ? "Titan validé ✓" : "Titan décoché");
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
            {/* Liste */}
            <div className="space-y-3">
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher un titan…"
                        className="w-full pl-9 pr-3 py-2.5 bg-surface/60 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-warning/30"
                    />
                </div>

                <div className="flex gap-1.5 p-1 bg-surface/60 rounded-xl border border-border">
                    {(["all", "done", "todo"] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={cn(
                                "flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-colors",
                                filter === f ? "bg-amber-600 text-white" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {f === "all" ? "Tous" : f === "done" ? "Validé" : "À faire"}
                        </button>
                    ))}
                </div>

                <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar">
                    {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Aucun titan.</p>}
                    {filtered.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setSelectedId(t.id)}
                            className={cn(
                                "w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-colors",
                                selectedId === t.id ? "border-amber-600/40 bg-amber-600/10" : "border-border bg-surface/40 hover:bg-elevated/60"
                            )}
                        >
                            <div className="w-11 h-11 rounded-lg bg-elevated border border-border flex items-center justify-center shrink-0 overflow-hidden">
                                {titanImage(t) ? <img src={titanImage(t)!} alt={t.name} className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /> : <Crown className="w-5 h-5 text-amber-500" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-foreground truncate">{t.name}</p>
                                <p className="text-[11px] text-muted-foreground">Niveau {t.level ?? "—"} · {t.zone || "—"}</p>
                            </div>
                            {completedIds.has(t.id) ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                            ) : (
                                <Circle className="w-5 h-5 text-muted-foreground/40 shrink-0" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Détail */}
            {selected ? (
                <div className="bg-surface/40 border border-border rounded-2xl p-6 space-y-5 min-w-0">
                    <div className="flex flex-wrap items-start gap-4">
                        <div className="w-24 h-24 rounded-2xl bg-elevated border border-border flex items-center justify-center overflow-hidden shrink-0">
                            {titanImage(selected, stats) ? <img src={titanImage(selected, stats)!} alt={selected.name} className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /> : <Crown className="w-10 h-10 text-amber-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-2xl font-black text-foreground">{selected.name}</h2>
                                <span className="px-2 py-0.5 rounded-md bg-amber-600/15 border border-amber-600/30 text-[11px] font-bold text-amber-500">TITAN</span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{selected.zone && (<span className="inline-flex items-center gap-1 mr-3"><MapPin className="w-3.5 h-3.5" /> {selected.zone}</span>)}<span className="inline-flex items-center gap-1"><Swords className="w-3.5 h-3.5" /> Niveau {selected.level ?? "—"}</span></p>
                            <div className="flex flex-wrap gap-2 mt-4">
                                {canEdit && (
                                    <button
                                        onClick={() => handleToggle(selected.id)}
                                        className={cn(
                                            "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors",
                                            completedIds.has(selected.id) ? "bg-emerald-600 text-white" : "bg-surface border border-border text-foreground hover:bg-elevated"
                                        )}
                                    >
                                        {completedIds.has(selected.id) ? <><CheckCircle2 className="w-4 h-4" /> Je l'ai vaincu</> : <><Circle className="w-4 h-4" /> Marquer je l'ai vaincu</>}
                                    </button>
                                )}
                                {selected.dofuspourlesnoobsUrl && (
                                    <a href={selected.dofuspourlesnoobsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-surface text-foreground text-xs font-bold hover:bg-elevated transition-colors"><ExternalLink className="w-3.5 h-3.5" /> DofusPourLesNoobs</a>
                                )}
                            </div>
                        </div>
                    </div>

                    {selected.currentSeason && (
                        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-surface/60 border border-border">
                            <Calendar className="w-4 h-4 text-amber-500" />
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Saison en cours</span>
                            <span className="ml-auto text-sm font-bold text-foreground">{selected.currentSeason}</span>
                        </div>
                    )}

                    <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-surface/60 border border-border">
                        <Clock className="w-4 h-4 text-muted-foreground mt-0.5" />
                        <div>
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Disponibilité</span>
                            <p className="text-sm text-foreground mt-0.5">{formatSchedule(selected.scheduleConfig)}</p>
                        </div>
                    </div>

                    {selected.maxMembers && (
                        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-surface/60 border border-border">
                            <Users className="w-4 h-4 text-muted-foreground" />
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Composition</span>
                            <span className="ml-auto text-sm font-bold text-foreground">{selected.maxMembers} joueurs max</span>
                        </div>
                    )}

                    {selected.mapName && (
                        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-surface/60 border border-border">
                            <Layers className="w-4 h-4 text-muted-foreground" />
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Map isométrique</span>
                            <span className="ml-auto text-sm font-bold text-foreground">{selected.mapName}</span>
                        </div>
                    )}

                    {selected.questName && (
                        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-surface/60 border border-border">
                            <ScrollText className="w-4 h-4 text-muted-foreground" />
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Quête liée</span>
                            {selected.questUrl ? (
                                <a href={selected.questUrl} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-sm font-bold text-info hover:underline">{selected.questName}<ExternalLink className="w-3 h-3" /></a>
                            ) : (
                                <span className="ml-auto text-sm font-bold text-foreground">{selected.questName}</span>
                            )}
                        </div>
                    )}

                    {/* Onglets : Stats & Sorts / Simulation / Monstres de salle */}
                    {(() => {
                        const roomMonsters = family?.monsters ?? [];
                        const tabList = [
                            { id: "info", label: "Stats & Sorts", icon: Swords },
                            { id: "sim", label: "Simulation", icon: Target },
                            ...(roomMonsters.length > 1 ? [{ id: "monsters", label: `Monstres de salle (${roomMonsters.length})`, icon: Users }] : []),
                        ];
                        return (
                            <div className="flex items-center gap-1.5 p-1 bg-surface border border-border rounded-xl overflow-x-auto no-scrollbar">
                                {tabList.map((tb) => {
                                    const Icon = tb.icon;
                                    const active = detailTab === tb.id;
                                    return (
                                        <button
                                            key={tb.id}
                                            type="button"
                                            onClick={() => setDetailTab(tb.id as any)}
                                            className={cn(
                                                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap",
                                                active
                                                    ? "bg-warning/15 text-warning border border-warning/30"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-elevated/50"
                                            )}
                                        >
                                            <Icon className={cn("w-3.5 h-3.5", active ? "text-warning" : "text-muted-foreground")} />
                                            <span>{tb.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })()}

                    {detailTab === "info" && (<>
                    {/* Stats & sorts (local-first) */}
                    {loadingStats ? (
                        <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                    ) : stats ? (() => {
                        const grades = stats.grades ?? [];
                        const gradeIdx = activeGradeIndex < grades.length ? activeGradeIndex : (grades.length ? grades.length - 1 : 0);
                        const g = grades[gradeIdx] ?? null;
                        const resists = g?.resists ?? {};
                        return (
                            <div className="space-y-4">
                                {grades.length > 1 && (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Butin</span>
                                        {grades.map((gr: any, idx: number) => (
                                            <button key={idx} onClick={() => setActiveGradeIndex(idx)} className={cn("px-2 py-0.5 rounded-md text-[11px] font-bold border", idx === gradeIdx ? "bg-amber-600 text-white border-amber-600" : "bg-surface border-border text-muted-foreground")}>Butin {4 + idx}</button>
                                        ))}
                                    </div>
                                )}
                                {/* Vitalité & Résistances */}
                                <div className="flex flex-wrap items-center gap-2 sm:gap-3 py-1 border-y border-border/40">
                                    {/* PV / PA / PM */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-surface border border-border/70" title="Points de Vie">
                                            <img src="/assets/module-succes/vitalite.png" alt="PV" className="w-4 h-4 object-contain" />
                                            <span className="text-sm font-bold text-foreground tabular-nums">{g?.lifePoints?.toLocaleString("fr-FR") ?? "—"}</span>
                                            <span className="text-[11px] font-bold text-muted-foreground">PV</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-info/10 border border-info/20" title="Points d'Action">
                                            <span className="text-sm font-bold text-info tabular-nums">{g?.actionPoints ?? "—"}</span>
                                            <span className="text-[11px] font-bold text-info/80">PA</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-success/10 border border-success/20" title="Points de Mouvement">
                                            <span className="text-sm font-bold text-success tabular-nums">{g?.movementPoints ?? "—"}</span>
                                            <span className="text-[11px] font-bold text-success/80">PM</span>
                                        </div>
                                    </div>
                                    <div className="hidden sm:block h-5 w-px bg-border/80 mx-0.5" />
                                    {/* Résistances élémentaires */}
                                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface/70 border border-border/60" title="Résistance Neutre">
                                            <img src="/assets/module-succes/neutre.png" alt="Neutre" className="w-4 h-4 object-contain" />
                                            <b className="text-sm font-bold text-foreground tabular-nums">{resists.neutral ?? 0}%</b>
                                            <span className="text-[11px] font-bold text-muted-foreground hidden sm:inline">Neutre</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-warning/10 border border-warning/20" title="Résistance Terre">
                                            <img src="/assets/module-succes/terre.png" alt="Terre" className="w-4 h-4 object-contain" />
                                            <b className="text-sm font-bold text-warning tabular-nums">{resists.earth ?? 0}%</b>
                                            <span className="text-[11px] font-bold text-warning/80 hidden sm:inline">Terre</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-danger/10 border border-danger/20" title="Résistance Feu">
                                            <img src="/assets/module-succes/Intelligence.png" alt="Feu" className="w-4 h-4 object-contain" />
                                            <b className="text-sm font-bold text-danger tabular-nums">{resists.fire ?? 0}%</b>
                                            <span className="text-[11px] font-bold text-danger/80 hidden sm:inline">Feu</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-info/10 border border-info/20" title="Résistance Eau">
                                            <img src="/assets/module-succes/eau.png" alt="Eau" className="w-4 h-4 object-contain" />
                                            <b className="text-sm font-bold text-info tabular-nums">{resists.water ?? 0}%</b>
                                            <span className="text-[11px] font-bold text-info/80 hidden sm:inline">Eau</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-success/10 border border-success/20" title="Résistance Air">
                                            <img src="/assets/module-succes/Agility.png" alt="Air" className="w-4 h-4 object-contain" />
                                            <b className="text-sm font-bold text-success tabular-nums">{resists.air ?? 0}%</b>
                                            <span className="text-[11px] font-bold text-success/80 hidden sm:inline">Air</span>
                                        </div>
                                    </div>
                                </div>

                                {Array.isArray(stats.spells) && stats.spells.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Sorts détaillés ({stats.spells.length})</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {stats.spells.map((spell: any, i: number) => {
                                                const hasRange = spell.range != null;
                                                const rangeStr = hasRange
                                                    ? (spell.minRange === spell.range ? `${spell.range} PO` : `${spell.minRange ?? 0}-${spell.range} PO`)
                                                    : null;
                                                const criticals = Array.isArray(spell.criticalEffects) ? spell.criticalEffects : [];
                                                const effects = Array.isArray(spell.effectDetails) && spell.effectDetails.length > 0
                                                    ? spell.effectDetails
                                                    : (Array.isArray(spell.effects) ? spell.effects : []);
                                                return (
                                                    <div key={spell.id ?? i} className="rounded-xl bg-surface/60 border border-border p-3 space-y-2">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-9 h-9 rounded-lg bg-background border border-border flex items-center justify-center p-0.5 shrink-0 overflow-hidden">
                                                                {spell.imageUrl ? (
                                                                    <img src={`/api/assets-dofus/spells/${spell.id}?url=${encodeURIComponent(spell.imageUrl)}`} alt={spell.name ?? ""} className="w-full h-full object-contain" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                                                ) : (
                                                                    <Zap className="w-4 h-4 text-warning" />
                                                                )}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="font-bold text-foreground truncate">{spell.name ?? `Sort ${i + 1}`}</p>
                                                                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                                                    {spell.apCost != null && (
                                                                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-info/10 border border-info/20 text-info shrink-0">
                                                                            <img src="/assets/dofus/stats/pa.png" alt="PA" className="w-3 h-3 object-contain" />{spell.apCost}
                                                                        </span>
                                                                    )}
                                                                    {rangeStr && (
                                                                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-accent/10 border border-accent/20 text-accent shrink-0">
                                                                            <img src="/assets/dofus/stats/po.png" alt="PO" className="w-3 h-3 object-contain" />{rangeStr}
                                                                        </span>
                                                                    )}
                                                                    {spell.grade != null && <span className="text-[10px] font-bold text-muted-foreground bg-background border border-border px-1 py-px rounded">Niv. {spell.grade}</span>}
                                                                    {spell.criticalChance != null && spell.criticalChance > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-warning/10 border border-warning/20 text-warning">CC {spell.criticalChance}%</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {spell.description && <p className="text-[11px] text-muted-foreground leading-relaxed">{spell.description}</p>}
                                                        {effects.length > 0 && (
                                                            <div className="space-y-1">
                                                                <span className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Effet principal</span>
                                                                <ul className="space-y-1">
                                                                    {effects.slice(0, 6).map((eff: any, ei: number) => {
                                                                        const label = typeof eff === "string" ? eff : eff?.label ?? "";
                                                                        if (!label) return null;
                                                                        return (
                                                                            <li key={ei} className="text-[11px] text-muted-foreground leading-relaxed">
                                                                                <span className="text-foreground font-semibold">{label}</span>{eff?.duration ? ` · ${eff.duration}` : ""}
                                                                            </li>
                                                                        );
                                                                    })}
                                                                </ul>
                                                            </div>
                                                        )}
                                                        {criticals.length > 0 && (
                                                            <p className="text-[11px] text-danger mt-1">⚠️ <span className="uppercase tracking-wider text-[9px]">Critique</span> {criticals.slice(0, 3).join(" · ")}</p>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })() : (
                        <p className="text-xs text-muted-foreground">Stats non disponibles (rien de synchronisé pour ce titan). Lancez le cron de sync.</p>
                    )}

                    {selected.seasonBosses && selected.seasonBosses.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Boss de phase 4 par saison</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {selected.seasonBosses.map((b, i) => (
                                    <div key={i} className="px-3 py-2.5 rounded-xl bg-surface border border-border text-sm">
                                        <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest">{b.season}</p>
                                        <p className="font-bold text-foreground">{b.bossName}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {selected.description && (
                        <p className="text-sm text-muted-foreground leading-relaxed">{selected.description}</p>
                    )}

                    {(() => {
                        const done = progress.filter((p) => p.titanId === selected.id);
                        if (done.length === 0) return null;
                        return (
                            <div className="space-y-2">
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">L'ont déjà vaincu</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {done.map((m, i) => (
                                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface border border-warning/20 text-[11px] font-bold text-foreground">
                                            <span className="w-1.5 h-1.5 rounded-full bg-warning"></span>
                                            {m.pseudo}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}
                    </>)}

                    {/* Onglet Simulation */}
                    {detailTab === "sim" && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Target className="w-4 h-4 text-warning" />
                                <h4 className="text-sm font-bold text-foreground">Simulation & Portée des Sorts</h4>
                            </div>
                            {loadingStats ? (
                                <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                            ) : stats?.spells && stats.spells.length > 0 ? (
                                <SpellRangeGrid
                                    spells={stats.spells}
                                    activeSpellId={activeSpellId}
                                    onSelectSpell={(s) => setActiveSpellId(s.id)}
                                    bossName={selected.name}
                                    bossImageUrl={stats?.imageUrl ?? selected.imageUrl ?? undefined}
                                    dungeonMaps={dungeonMaps?.maps ?? undefined}
                                    dungeonName={dungeonMaps?.dungeonName}
                                    grades={stats?.grades?.map((g: any) => ({ level: g.level })) ?? []}
                                    activeGradeIndex={activeGradeIndex}
                                    onGradeChange={(idx) => setActiveGradeIndex(idx)}
                                    monsters={(family?.monsters ?? []).map((m) => ({ id: m.id, name: m.name, isBoss: m.isBoss, imageUrl: m.imageUrl }))}
                                    entityScale={4}
                                    allowFreeCasterMove
                                />
                            ) : (
                                <p className="text-xs text-muted-foreground">Aucun sort disponible pour la simulation. Lancez le cron de sync.</p>
                            )}
                        </div>
                    )}

                    {/* Onglet Monstres de salle */}
                    {detailTab === "monsters" && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-warning" />
                                <h4 className="text-sm font-bold text-foreground">Monstres de la salle</h4>
                            </div>
                            {family && family.monsters.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {family.monsters.map((m) => (
                                        <div key={m.id} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface border border-border">
                                            <div className="w-9 h-9 rounded-lg bg-elevated border border-border flex items-center justify-center overflow-hidden shrink-0">
                                                <MonsterImage src={m.imageUrl} alt={m.name} monsterId={m.id} className="w-full h-full object-contain" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-foreground truncate">{m.isBoss && "👑 "}{m.name}</p>
                                                <p className="text-[11px] text-muted-foreground">{m.isBoss ? "Gardien du titan" : "Monstre de salle"}</p>
                                            </div>
                                            {m.isBoss && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-warning/15 border border-warning/30 text-warning">Boss</span>}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground">Aucun monstre de salle renseigné pour ce titan.</p>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className="hidden lg:flex flex-col items-center justify-center py-24 text-muted-foreground border border-dashed border-border rounded-2xl bg-background/40">
                    <Crown className="w-12 h-12 mb-4 opacity-20" />
                    <p className="font-medium">Sélectionne un titan pour voir ses détails.</p>
                </div>
            )}
        </div>
    );
}

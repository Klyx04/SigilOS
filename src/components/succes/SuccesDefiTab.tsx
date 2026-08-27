"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, ExternalLink, Loader2, MapPin, Swords, Users, Search, Calendar } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getUserDefisData, toggleDefiCompleted } from "@/server/actions/defi-actions";

interface BossRef {
    name: string;
    dofusdbId?: number | null;
    imageUrl?: string | null;
}

interface Defi {
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
    bossNames: BossRef[] | null;
    isPermanent?: boolean;
    startDate?: string | null;
    endDate?: string | null;
}

interface DefiProgressEntry {
    defiId: string;
    profileId: string;
    completedAt: string | null;
}

export function SuccesDefiTab({ guildId, canEdit }: { guildId: string; canEdit: boolean }) {
    const [defis, setDefis] = useState<Defi[]>([]);
    const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
    const [progress, setProgress] = useState<DefiProgressEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [filter, setFilter] = useState<"all" | "done" | "todo">("all");

    useEffect(() => {
        let cancelled = false;
        getUserDefisData(guildId)
            .then((res) => {
                if (cancelled) return;
                if (res.success && res.data) {
                    setDefis(res.data.defis);
                    setCompletedIds(new Set(res.data.completedDefiIds));
                    setProgress(res.data.progress);
                } else {
                    toast.error(res.error || "Erreur");
                }
            })
            .catch(() => toast.error("Impossible de charger les défis"))
            .finally(() => !cancelled && setLoading(false));
        return () => { cancelled = true; };
    }, [guildId]);

    const filtered = useMemo(() => {
        let list = defis;
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter((d) => d.name.toLowerCase().includes(q) || (d.zone || "").toLowerCase().includes(q));
        }
        if (filter === "done") list = list.filter((d) => completedIds.has(d.id));
        else if (filter === "todo") list = list.filter((d) => !completedIds.has(d.id));
        return list;
    }, [defis, search, filter, completedIds]);

    const selected = defis.find((d) => d.id === selectedId) ?? null;

    async function handleToggle(id: string) {
        if (!canEdit) return;
        const prev = new Set(completedIds);
        const next = new Set(completedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setCompletedIds(next);
        const res = await toggleDefiCompleted(guildId, id);
        if (!res.success) {
            setCompletedIds(prev);
            toast.error(res.error || "Erreur");
        }
    }

    const membersWhoDid = (defiId: string) => progress.filter((p) => p.defiId === defiId).length;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6" data-tour="succes-defi">
            {/* Sidebar : liste + filtres */}
            <div className="space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher un défi / une zone…"
                        className="w-full bg-surface/70 border border-border rounded-xl pl-10 pr-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-warning/30"
                    />
                </div>

                <div className="flex items-center gap-2">
                    {(["all", "todo", "done"] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors",
                                filter === f ? "bg-warning/10 border-warning/30 text-warning" : "bg-surface/60 border-border text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {f === "all" ? "Tous" : f === "done" ? "Fait ✓" : "À faire"}
                        </button>
                    ))}
                </div>

                <div className="space-y-2">
                    {loading ? (
                        <p className="text-center text-muted-foreground text-sm py-10 flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</p>
                    ) : filtered.length === 0 ? (
                        <p className="text-center text-muted-foreground text-sm py-10">Aucun défi trouvé.</p>
                    ) : filtered.map((d) => {
                        const done = completedIds.has(d.id);
                        return (
                            <button
                                key={d.id}
                                onClick={() => setSelectedId(d.id)}
                                className={cn(
                                    "w-full flex items-center gap-3 p-3 rounded-2xl border transition-all group text-left relative overflow-hidden",
                                    selectedId === d.id ? "border-warning/40 bg-warning/5" : "border-border bg-surface/40 hover:bg-elevated"
                                )}
                            >
                                <div className="w-10 h-10 rounded-xl overflow-hidden bg-background border border-border shrink-0">
                                    {d.imageUrl
                                        ? <img src={d.imageUrl} alt={d.name} className="w-full h-full object-contain p-1" />
                                        : <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Swords className="w-5 h-5" /></div>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-foreground truncate">{d.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{d.zone || "Zone inconnue"}{d.level ? ` · Lvl ${d.level}` : ""}</p>
                                </div>
                                <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => { e.stopPropagation(); handleToggle(d.id); }}
                                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); handleToggle(d.id); } }}
                                    className="shrink-0"
                                    title={done ? "Fait — décocher" : "Cocher comme fait"}
                                >
                                    {done ? <CheckCircle2 className="w-5 h-5 text-success" /> : <Circle className="w-5 h-5 text-muted-foreground/50 group-hover:text-warning" />}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Panneau de détail */}
            {selected ? (
                <div className="bg-surface/90 border border-border rounded-2xl p-6 space-y-5">
                    <div className="flex items-start gap-4">
                        <div className="w-20 h-20 rounded-2xl bg-background border border-border flex items-center justify-center p-2 shrink-0 overflow-hidden">
                            {selected.imageUrl
                                ? <img src={selected.imageUrl} alt={selected.name} className="w-full h-full object-contain" />
                                : <Swords className="w-8 h-8 text-warning/60" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                                {selected.name}
                                {completedIds.has(selected.id) && <CheckCircle2 className="w-5 h-5 text-success" />}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                                {(selected.isPermanent ?? true)
                                    ? <><Calendar className="w-3.5 h-3.5 text-warning/70" /> Dispo en perpétuel</>
                                    : <><Calendar className="w-3.5 h-3.5 text-warning/70" /> {selected.startDate ? new Date(selected.startDate).toLocaleDateString("fr-FR") : "?"} → {selected.endDate ? new Date(selected.endDate).toLocaleDateString("fr-FR") : "?"}</>}
                            </p>
                                <MapPin className="w-3.5 h-3.5 text-warning" />
                                {selected.zone || "Zone inconnue"} {selected.level ? `· Lvl ${selected.level}` : ""}
                            </p>
                        </div>
                    </div>

                    {canEdit && (
                        <button
                            onClick={() => handleToggle(selected.id)}
                            className={cn(
                                "w-full py-3 rounded-xl font-bold uppercase tracking-wider transition-colors",
                                completedIds.has(selected.id) ? "bg-surface border border-success/40 text-success" : "bg-warning text-warning-foreground hover:bg-warning"
                            )}
                        >
                            {completedIds.has(selected.id) ? "✓ Défi validé — décocher" : "Cocher « je l'ai fait »"}
                        </button>
                    )}

                    <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        <Users className="w-3.5 h-3.5 text-warning" /> {membersWhoDid(selected.id)} membre(s) l'ont fait
                    </div>

                    {selected.bossNames && selected.bossNames.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Boss du défi</p>
                            <div className="flex flex-wrap gap-2">
                                {selected.bossNames.map((b, i) => (
                                    <span key={i} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface border border-border text-sm font-semibold text-foreground">
                                        {b.imageUrl ? <img src={b.imageUrl} alt={b.name} className="w-5 h-5 object-contain" /> : <Swords className="w-4 h-4 text-warning" />}
                                        {b.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {selected.description && (
                        <p className="text-sm text-muted-foreground leading-relaxed">{selected.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                        {selected.dofensiveUrl && (
                            <a href={selected.dofensiveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-surface text-foreground text-xs font-bold hover:bg-elevated transition-colors">
                                <ExternalLink className="w-3.5 h-3.5" /> Dofensive
                            </a>
                        )}
                        {selected.dofuspourlesnoobsUrl && (
                            <a href={selected.dofuspourlesnoobsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-surface text-foreground text-xs font-bold hover:bg-elevated transition-colors">
                                <ExternalLink className="w-3.5 h-3.5" /> DofusPourLesNoobs
                            </a>
                        )}
                    </div>
                </div>
            ) : (
                <div className="hidden lg:flex flex-col items-center justify-center py-24 text-muted-foreground border border-dashed border-border rounded-2xl bg-background/40">
                    <Swords className="w-12 h-12 mb-4 opacity-20" />
                    <p className="font-medium">Sélectionne un défi pour voir ses détails.</p>
                </div>
            )}
        </div>
    );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
    pseudo?: string;
    image?: string | null;
    dofusClass?: string | null;
    completedAt: string | null;
}

interface GuildMemberRef {
    id: string;
    pseudo: string;
    image: string | null;
    dofusClass: string | null;
}

export function SuccesDefiTab({ guildId, canEdit }: { guildId: string; canEdit: boolean }) {
    const [defis, setDefis] = useState<Defi[]>([]);
    const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
    const [progress, setProgress] = useState<DefiProgressEntry[]>([]);
    const [members, setMembers] = useState<GuildMemberRef[]>([]);
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
                    if (res.data.members) setMembers(res.data.members);
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
                                <div className="w-16 h-11 rounded-xl overflow-hidden bg-background border border-border shrink-0">
                                    {d.imageUrl
                                        ? <img src={d.imageUrl} alt={d.name} className="w-full h-full object-cover" />
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
                    {/* Visuel du défi — bandeau pleine largeur : les visuels de défi sont des panoramas,
                        illisibles dans un petit cadre carré. */}
                    <div className="relative w-full h-44 sm:h-60 rounded-2xl bg-background border border-border overflow-hidden">
                        {selected.imageUrl
                            ? <img src={selected.imageUrl} alt={selected.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                            : <div className="w-full h-full flex items-center justify-center"><Swords className="w-12 h-12 text-warning/50" /></div>}
                    </div>

                    <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                            <h3 className="text-2xl font-bold text-foreground flex items-center gap-2">
                                {selected.name}
                                {completedIds.has(selected.id) && <CheckCircle2 className="w-5 h-5 text-success" />}
                            </h3>
                            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-3">
                                <span className="flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-warning" />
                                    {selected.zone || "Zone inconnue"} {selected.level ? `· Lvl ${selected.level}` : ""}
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-warning/70" />
                                    {(selected.isPermanent ?? true)
                                        ? "Dispo en perpétuel"
                                        : `${selected.startDate ? new Date(selected.startDate).toLocaleDateString("fr-FR") : "?"} → ${selected.endDate ? new Date(selected.endDate).toLocaleDateString("fr-FR") : "?"}`}
                                </span>
                            </div>
                        </div>
                    </div>

                    {canEdit && (
                        <button
                            onClick={() => handleToggle(selected.id)}
                            className={cn(
                                "w-full py-3 rounded-xl font-bold uppercase tracking-wider transition-colors shadow-2xs",
                                completedIds.has(selected.id) ? "bg-surface border border-success/40 text-success hover:bg-success/5" : "bg-warning text-warning-foreground hover:bg-warning/90"
                            )}
                        >
                            {completedIds.has(selected.id) ? "✓ Défi validé — décocher" : "Cocher « je l'ai fait »"}
                        </button>
                    )}

                    {/* Entraide & Annuaire Guilde (#198.1) */}
                    <div className="p-4 rounded-2xl bg-surface/60 border border-border space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <Users className="w-4 h-4 text-warning" /> Entraide de Guilde
                            </span>
                            <Link
                                href={`/dashboard/${guildId}/donjons-et-quetes`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-warning/15 hover:bg-warning/25 text-warning border border-warning/30 text-xs font-bold transition-all shadow-2xs"
                            >
                                <Swords className="w-3.5 h-3.5" />
                                <span>Organiser une sortie</span>
                            </Link>
                        </div>

                        {/* Répartition : Ont validé / Ont besoin */}
                        {(() => {
                            const completedMembers = progress.filter((p) => p.defiId === selected.id);
                            const completedProfileIds = new Set(completedMembers.map((p) => p.profileId));
                            const pendingMembers = members.filter((m) => !completedProfileIds.has(m.id));

                            return (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                    {/* Ont validé */}
                                    <div className="p-3 rounded-xl bg-background/60 border border-border space-y-2">
                                        <div className="flex items-center justify-between text-xs font-bold">
                                            <span className="text-success flex items-center gap-1.5">
                                                <CheckCircle2 className="w-3.5 h-3.5" /> Ont réussi ({completedMembers.length})
                                            </span>
                                        </div>
                                        {completedMembers.length === 0 ? (
                                            <p className="text-[11px] text-muted-foreground italic">Aucun membre pour l'instant</p>
                                        ) : (
                                            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                                                {completedMembers.map((m, i) => (
                                                    <span
                                                        key={i}
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface border border-success/20 text-[11px] font-bold text-foreground"
                                                        title={m.dofusClass ? `${m.pseudo} (${m.dofusClass})` : m.pseudo}
                                                    >
                                                        <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                                                        {m.pseudo}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Ont besoin / Pas encore fait */}
                                    <div className="p-3 rounded-xl bg-background/60 border border-border space-y-2">
                                        <div className="flex items-center justify-between text-xs font-bold">
                                            <span className="text-warning flex items-center gap-1.5">
                                                <Circle className="w-3.5 h-3.5 text-warning" /> En recherche ({pendingMembers.length})
                                            </span>
                                        </div>
                                        {pendingMembers.length === 0 ? (
                                            <p className="text-[11px] text-muted-foreground italic">Tous les membres l'ont validé !</p>
                                        ) : (
                                            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                                                {pendingMembers.map((m, i) => (
                                                    <span
                                                        key={i}
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface border border-warning/20 text-[11px] font-bold text-foreground"
                                                        title={m.dofusClass ? `${m.pseudo} (${m.dofusClass})` : m.pseudo}
                                                    >
                                                        <span className="w-1.5 h-1.5 rounded-full bg-warning"></span>
                                                        {m.pseudo}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}
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

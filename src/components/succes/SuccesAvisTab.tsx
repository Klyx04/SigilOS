"use client";

/**
 * Onglet « Fiches Avis de recherche » (chantier 16/09/2026) — module Succès.
 *
 * Même exigence que les onglets Fiches Boss / Anomalies / Titans : **une seule source de
 * vérité** par donnée. Ici, tout vient du **siphon** (`Bounty` + `MonsterStat`) via
 * `getBountyFiche` (lecture **locale**) : sorts, grades, butin, zone de traque, prime,
 * critères de chasse et carte de simulation (grille locale ou **repli déclaré**).
 * Aucune saisie à la main, aucun appel DofusDB/Dofensive à l'ouverture d'une fiche.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    ExternalLink,
    Loader2,
    MapPin,
    Search,
    Sparkles,
    Swords,
    Target,
    Zap,
    Flame,
    Gem,
    Compass,
    Shield,
    Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getBestiaireCatalog, type BestiaireEntry } from "@/server/actions/game-data-actions";
import { getBountyFiche, type BountyFichePayload } from "@/server/actions/bounty-actions";
import { SpellRangeGrid } from "@/components/succes/SpellRangeGrid";
import { useBossOverlay } from "@/hooks/use-boss-overlay";

type DetailTab = "info" | "sorts" | "sim" | "loot";

/** Icône de monstre via le proxy d'assets (jamais de 404 : placeholder interne sinon). */
function MonsterImage({ src, alt = "", className = "", monsterId }: { src?: string | null; alt?: string; className?: string; monsterId?: number | string }) {
    const target = monsterId;
    const initialSrc = target ? `/api/assets-dofus/monsters/${target}${src ? `?url=${encodeURIComponent(src)}` : ""}` : src || null;
    const [currentSrc, setCurrentSrc] = useState<string | null>(initialSrc);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        setCurrentSrc(target ? `/api/assets-dofus/monsters/${target}${src ? `?url=${encodeURIComponent(src)}` : ""}` : src || null);
        setFailed(false);
    }, [src, target]);
    if (!currentSrc || failed) {
        return (
            <span className={cn("inline-flex items-center justify-center bg-elevated text-muted-foreground/40", className)}>
                <Swords className="w-1/2 h-1/2 max-w-6 max-h-6" />
            </span>
        );
    }
    return <img src={currentSrc} alt={alt} className={className} loading="lazy" onError={() => setFailed(true)} />;
}

export function SuccesAvisTab({ guildId }: { guildId: string }) {
    const [catalog, setCatalog] = useState<BestiaireEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [fiche, setFiche] = useState<BountyFichePayload | null>(null);
    const [loadingFiche, setLoadingFiche] = useState(false);
    const [detailTab, setDetailTab] = useState<DetailTab>("info");
    const [activeGradeIndex, setActiveGradeIndex] = useState(0);
    const [activeSpellId, setActiveSpellId] = useState<number | undefined>(undefined);
    const { openBossOverlay } = useBossOverlay(guildId);

    // 1. Catalogue des avis — **uniquement** les lignes siphonnées (`isBountyMonster`).
    useEffect(() => {
        let cancelled = false;
        getBestiaireCatalog()
            .then((res) => {
                if (cancelled) return;
                if (res.success && Array.isArray(res.data)) {
                    setCatalog(res.data.filter((e) => e.type === "bounty"));
                }
            })
            .catch(() => {})
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        const list = q
            ? catalog.filter((e) => e.bossName.toLowerCase().includes(q) || e.name.toLowerCase().includes(q))
            : catalog;
        return [...list].sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || a.bossName.localeCompare(b.bossName, "fr"));
    }, [catalog, search]);

    // 2. Fiche locale de l'avis sélectionné (aucun appel sortant).
    useEffect(() => {
        if (!selectedId) {
            setFiche(null);
            return;
        }
        let cancelled = false;
        setLoadingFiche(true);
        getBountyFiche(selectedId)
            .then((res) => {
                if (cancelled) return;
                setFiche(res.success && res.data ? res.data : null);
                setActiveGradeIndex(0);
                setActiveSpellId(undefined);
            })
            .catch(() => {
                if (!cancelled) setFiche(null);
            })
            .finally(() => {
                if (!cancelled) setLoadingFiche(false);
            });
        return () => { cancelled = true; };
    }, [selectedId]);

    const selected = filtered.find((e) => e.id === selectedId) ?? catalog.find((e) => e.id === selectedId) ?? null;
    const stats = fiche?.monsterStats ?? null;
    const grades: any[] = Array.isArray(stats?.grades) ? stats.grades : [];
    const activeGrade = grades[activeGradeIndex] ?? grades[0] ?? null;
    const spells: any[] = Array.isArray(stats?.spells) ? stats.spells : [];
    const drops: any[] = Array.isArray(stats?.drops) ? stats.drops : [];

    const tabs = (
        [
            { id: "info" as DetailTab, label: "Fiche", icon: Shield },
            { id: "sorts" as DetailTab, label: `Sorts (${spells.length})`, icon: Zap },
            { id: "sim" as DetailTab, label: "Simulation", icon: Target },
            { id: "loot" as DetailTab, label: `Butin (${drops.length})`, icon: Gem },
        ]
    ).filter((t) => !(t.id === "loot" && drops.length === 0));

    return (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            {/* ── LISTE ─────────────────────────────────────────────────────── */}
            <div className="rounded-2xl border border-border bg-surface/70 p-3 space-y-3">
                <div className="flex items-center justify-between">
                    <p className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">
                        Avis de recherche
                    </p>
                    <span className="font-mono text-[11px] text-muted-foreground">{filtered.length}</span>
                </div>
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher un avis ou une zone…"
                        className="w-full rounded-lg border border-border bg-background/60 py-1.5 pl-8 pr-2 text-xs outline-none focus:border-warning/40"
                    />
                </div>
                <div className="max-h-[60vh] space-y-1 overflow-y-auto pr-0.5">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <p className="py-8 text-center text-xs text-muted-foreground">
                            Aucun avis de recherche en base — lancez le siphon (God → Données de jeu).
                        </p>
                    ) : (
                        filtered.map((e) => (
                            <button
                                key={e.id}
                                type="button"
                                onClick={() => setSelectedId(e.id)}
                                className={cn(
                                    "flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors",
                                    selectedId === e.id
                                        ? "border-rose-500/40 bg-rose-500/10"
                                        : "border-transparent bg-elevated/40 hover:bg-elevated/70"
                                )}
                            >
                                <MonsterImage
                                    src={e.imageUrl}
                                    monsterId={e.dofusdbId ?? undefined}
                                    className="h-9 w-9 shrink-0 rounded-lg object-contain"
                                />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-xs font-semibold text-foreground">{e.bossName}</span>
                                    <span className="block truncate text-[10px] text-rose-400/70">{e.name}</span>
                                </span>
                                {e.level > 0 && <span className="font-mono text-[10px] text-muted-foreground">niv. {e.level}</span>}
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* ── FICHE ─────────────────────────────────────────────────────── */}
            <div className="min-w-0">
                {!selectedId ? (
                    <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-2xl border border-border bg-surface/50 p-8 text-center">
                        <Target className="mb-3 h-8 w-8 text-rose-400/70" />
                        <p className="text-sm font-semibold text-foreground">Choisissez un avis de recherche</p>
                        <p className="mt-1 max-w-md text-xs text-muted-foreground">
                            Sorts, résistances, butin, zone de traque et simulation — servis depuis la base locale.
                        </p>
                    </div>
                ) : loadingFiche ? (
                    <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-border bg-surface/50">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : !fiche ? (
                    <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-border bg-surface/50 p-8 text-center text-xs text-muted-foreground">
                        Fiche indisponible pour cet avis (données non siphonnées ?).
                    </div>
                ) : (
                    <div className="space-y-4 rounded-2xl border border-border bg-surface/50 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <MonsterImage
                                    src={fiche.monsterStats?.imageUrl ?? selected?.imageUrl}
                                    monsterId={fiche.meta.dofusdbId ?? undefined}
                                    className="h-16 w-16 shrink-0 rounded-xl border border-border bg-background/60 object-contain p-1"
                                />
                                <div className="min-w-0">
                                    <p className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                                        <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 font-semibold normal-case text-rose-300">
                                            {fiche.meta.raceName}
                                        </span>
                                        <span className="font-mono normal-case">niv. {fiche.dungeon.level}</span>
                                        {fiche.stale && <span className="normal-case text-amber-300/90">données datées</span>}
                                    </p>
                                    <h2 className="mt-0.5 truncate text-xl font-semibold text-foreground">{fiche.dungeon.bossName}</h2>
                                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Compass className="h-3.5 w-3.5 opacity-70" /> Zone de traque :{" "}
                                        <span className="text-foreground/90">{fiche.meta.zone ?? "non documentée"}</span>
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => openBossOverlay({ monsterName: fiche.dungeon.bossName, dungeonName: fiche.dungeon.name })}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-foreground/90 px-3 py-2 text-[11px] font-semibold text-background transition-colors hover:bg-foreground"
                                >
                                    <Sparkles className="h-3.5 w-3.5" /> Overlay
                                </button>
                                <Link
                                    href={`/boss/${fiche.dungeon.id}`}
                                    target="_blank"
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                                >
                                    <ExternalLink className="h-3.5 w-3.5" /> Fiche publique
                                </Link>
                            </div>
                        </div>
                        <div className="grid gap-2 rounded-xl border border-border bg-background/40 p-3 text-[11px] sm:grid-cols-2">
                            {fiche.meta.travelCommand && (
                                <button
                                    type="button"
                                    onClick={() => navigator.clipboard.writeText(fiche.meta.travelCommand as string)}
                                    className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-2 py-0.5 font-mono text-muted-foreground transition-colors hover:text-foreground"
                                    title="Copier la commande de trajet"
                                >
                                    <MapPin className="h-3 w-3" /> {fiche.meta.travelCommand}
                                </button>
                            )}
                            {fiche.meta.rewards.length > 0 && (
                                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                    <Gem className="h-3.5 w-3.5 opacity-70" /> Prime :{" "}
                                    <strong className="font-medium text-foreground/90">
                                        {fiche.meta.rewards.map((r) => `${r.amount > 0 ? `${r.amount} ` : ""}${r.type}`).join(" + ")}
                                    </strong>
                                </span>
                            )}
                            {fiche.meta.milice && (
                                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                    <Shield className="h-3.5 w-3.5 opacity-70" /> {fiche.meta.milice}
                                </span>
                            )}
                            {fiche.meta.battleMapLabel && (
                                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                    <Info className="h-3.5 w-3.5" /> Simulation : {fiche.meta.battleMapLabel}
                                </span>
                            )}
                            {fiche.meta.criteria.length > 0 && (
                                <p className="text-muted-foreground sm:col-span-2">
                                    <span className="text-foreground/70">Critères de chasse :</span> {fiche.meta.criteria.join(" · ")}
                                </p>
                            )}
                        </div>
                        {/* Onglets de la fiche */}
                        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-background/40 p-1">
                            {tabs.map((t) => {
                                const Icon = t.icon;
                                return (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setDetailTab(t.id)}
                                        className={cn(
                                            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors",
                                            detailTab === t.id
                                                ? "bg-warning/15 text-warning"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <Icon className="h-3.5 w-3.5" /> {t.label}
                                    </button>
                                );
                            })}
                            {grades.length > 1 && (
                                <span className="ml-auto flex items-center gap-1 pr-1">
                                    <Flame className="h-3.5 w-3.5 text-muted-foreground" />
                                    {grades.map((g: any, i: number) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => setActiveGradeIndex(i)}
                                            className={cn(
                                                "rounded-md px-1.5 py-0.5 font-mono text-[10px] transition-colors",
                                                activeGradeIndex === i
                                                    ? "bg-warning/20 text-warning"
                                                    : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            {g.level}
                                        </button>
                                    ))}
                                </span>
                            )}
                        </div>

                        {detailTab === "info" && (
                            <div className="space-y-3">
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    {[
                                        { label: "PV", value: activeGrade?.lifePoints },
                                        { label: "PA", value: activeGrade?.actionPoints },
                                        { label: "PM", value: activeGrade?.movementPoints },
                                    ].map((s) => (
                                        <div key={s.label} className="rounded-xl border border-border bg-background/40 py-2">
                                            <p className="font-mono text-lg font-semibold text-foreground">{s.value ?? "—"}</p>
                                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="space-y-1.5 rounded-xl border border-border bg-background/40 p-3">
                                    <p className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">Résistances</p>
                                    {(["neutral", "earth", "fire", "water", "air"] as const).map((k) => {
                                        const labels: Record<string, string> = {
                                            neutral: "Neutre",
                                            earth: "Terre",
                                            fire: "Feu",
                                            water: "Eau",
                                            air: "Air",
                                        };
                                        const v = Number(activeGrade?.resists?.[k] ?? 0);
                                        return (
                                            <div key={k} className="flex items-center gap-2 text-[11px]">
                                                <span className="w-14 shrink-0 text-muted-foreground">{labels[k]}</span>
                                                <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                                                    <span
                                                        className={cn("block h-full rounded-full", v < 0 ? "bg-rose-500/80" : "bg-sky-400/70")}
                                                        style={{ width: `${Math.min(100, Math.abs(v))}%` }}
                                                    />
                                                </span>
                                                <span className={cn("w-10 shrink-0 text-right font-mono", v < 0 ? "text-rose-400" : "text-foreground/80")}>
                                                    {v}%
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {detailTab === "sorts" && (
                            <div className="space-y-2">
                                {spells.length === 0 ? (
                                    <p className="py-6 text-center text-xs text-muted-foreground">
                                        Aucun sort : ni DofusDB ni Dofensive n&apos;en référencent pour cet avis (certains
                                        avis, comme « Ronce », n&apos;en lancent aucun).
                                    </p>
                                ) : (
                                    spells.map((s: any) => (
                                        <div key={s.id} className="rounded-xl border border-border bg-background/40 p-3">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-xs font-semibold text-foreground">{s.name}</span>
                                                {s.apCost !== undefined && (
                                                    <span className="font-mono text-[10px] text-muted-foreground">{s.apCost} PA</span>
                                                )}
                                                {s.range !== undefined && (
                                                    <span className="font-mono text-[10px] text-muted-foreground">
                                                        {s.minRange && s.minRange !== s.range ? `${s.minRange}-${s.range}` : s.range} PO
                                                    </span>
                                                )}
                                                {s.castTestLos === false && <span className="text-[10px] text-emerald-400/80">sans LdV</span>}
                                            </div>
                                            {s.description && (
                                                <p className="mt-1 text-[11px] italic text-muted-foreground">{s.description}</p>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                        {detailTab === "sim" && (
                            spells.length > 0 ? (
                                <SpellRangeGrid
                                    spells={spells}
                                    activeSpellId={activeSpellId}
                                    onSelectSpell={(s) => setActiveSpellId(s.id)}
                                    bossName={fiche.dungeon.bossName}
                                    bossImageUrl={fiche.monsterStats?.imageUrl ?? fiche.dungeon.imageUrl ?? undefined}
                                    dungeonMaps={fiche.dungeonMaps?.maps ?? undefined}
                                    dungeonName={fiche.dungeonMaps?.dungeonName}
                                    grades={grades.map((g: any) => ({ level: g.level }))}
                                    activeGradeIndex={activeGradeIndex}
                                    onGradeChange={(idx) => setActiveGradeIndex(idx)}
                                    monsters={[]}
                                    allowFreeCasterMove
                                />
                            ) : (
                                <p className="py-6 text-center text-xs text-muted-foreground">
                                    Aucun sort disponible pour la simulation.
                                </p>
                            )
                        )}
                        {detailTab === "loot" && (
                            <div className="grid gap-2 sm:grid-cols-2">
                                {drops.map((d: any) => (
                                    <div key={`${d.objectId}-${d.name ?? ""}`} className="flex items-center gap-2.5 rounded-xl border border-border bg-background/40 p-2.5">
                                        {d.objectId ? (
                                            <img
                                                src={`/api/assets-dofus/items/${d.objectId}`}
                                                alt=""
                                                className="h-9 w-9 shrink-0 object-contain"
                                                loading="lazy"
                                                onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }}
                                            />
                                        ) : null}
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-xs text-foreground">{d.name ?? `Objet #${d.objectId}`}</span>
                                            {Array.isArray(d.percentByGrade) && d.percentByGrade.length > 0 && (
                                                <span className="block font-mono text-[10px] text-muted-foreground">
                                                    {d.percentByGrade[activeGradeIndex] ?? d.percentByGrade[0]} %
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}


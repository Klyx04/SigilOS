"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
    Trophy,
    Users,
    Search,
    ChevronDown,
    ChevronLeft,
    Loader2,
    Swords,
    Info,
    RotateCcw,
    X,
} from "lucide-react";
import { getDungeonDirectory } from "@/server/actions/dungeon-finder-actions";
import { getDungeonsWithAchievements } from "@/server/actions/game-data-actions";
import { DOFUS_CLASSES, getClass } from "@/lib/dofus-assets";
import { cn } from "@/lib/utils";

interface Dungeon {
    id: string;
    name: string;
    bossName: string;
    level: number;
    imageUrl?: string | null;
    isExpedition?: boolean;
    dofuspourlesnoobsUrl?: string | null;
    dpnlUrl?: string | null;
    dofensiveUrl?: string | null;
}

interface DirectoryMember {
    id: string;
    name: string;
    imageUrl: string | null;
    classe: string | null;
}

interface DirectoryAchievement {
    achievementId: string;
    achievementName: string;
    iconUrl: string | null;
    points: number;
    hasCompleted: DirectoryMember[];
    missing: DirectoryMember[];
}

interface SuccesDirectoryProps {
    guildId: string;
}

/**
 * Ligne membre dense (annuaire, pas de pills) : avatar + pseudo + classe.
 * Le statut se lit à la colonne (« Cherchent encore » / « Déjà validé »).
 */
function MemberRow({ member }: { member: DirectoryMember }) {
    const cls = member.classe ? getClass(member.classe) : null;
    return (
        <div className="flex items-center gap-2 py-1 min-w-0">
            <div className="w-5 h-5 rounded-full overflow-hidden shrink-0 bg-background border border-border">
                {member.imageUrl ? (
                    <img src={member.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                    <Users className="w-3 h-3 m-auto text-muted-foreground/60" />
                )}
            </div>
            <span className="text-xs font-bold text-foreground truncate flex-1 min-w-0">{member.name}</span>
            {cls && (
                <img src={cls.icon} alt={member.classe || ""} className="w-4 h-4 object-contain shrink-0" title={member.classe || undefined} loading="lazy" />
            )}
        </div>
    );
}

const MEMBER_PAGE_SIZE = 24;

/**
 * Colonne de membres en liste dense + vraie pagination (jamais d'empilement
 * infini : 24 lignes par page, compteur « 1–24 sur 99 »).
 */
function MemberColumn({
    title,
    members,
    page,
    onPage,
    emptyLabel,
}: {
    title: string;
    members: DirectoryMember[];
    page: number;
    onPage: (next: number) => void;
    emptyLabel: string;
}) {
    if (members.length === 0) {
        return (
            <div>
                <p className="text-caption font-bold uppercase tracking-widest mb-2 text-muted-foreground">
                    {title}
                </p>
                <p className="text-xs text-muted-foreground italic py-2">{emptyLabel}</p>
            </div>
        );
    }
    const pageCount = Math.max(1, Math.ceil(members.length / MEMBER_PAGE_SIZE));
    const safePage = Math.min(Math.max(1, page), pageCount);
    const start = (safePage - 1) * MEMBER_PAGE_SIZE;
    const visible = members.slice(start, start + MEMBER_PAGE_SIZE);
    return (
        <div>
            <p className="text-caption font-bold uppercase tracking-widest mb-1 text-muted-foreground">
                {title}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                {visible.map((m) => (
                    <MemberRow key={m.id} member={m} />
                ))}
            </div>
            {pageCount > 1 && (
                <div className="mt-2 flex items-center gap-2">
                    <button
                        type="button"
                        disabled={safePage <= 1}
                        onClick={() => onPage(safePage - 1)}
                        aria-label="Page précédente"
                        className="w-7 h-7 rounded-lg border border-border bg-surface text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-elevated transition-colors disabled:opacity-40 disabled:cursor-default"
                    >
                        ‹
                    </button>
                    <span className="text-[11px] font-bold text-muted-foreground tabular-nums">
                        {start + 1}–{start + visible.length} sur {members.length}
                    </span>
                    <button
                        type="button"
                        disabled={safePage >= pageCount}
                        onClick={() => onPage(safePage + 1)}
                        aria-label="Page suivante"
                        className="w-7 h-7 rounded-lg border border-border bg-surface text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-elevated transition-colors disabled:opacity-40 disabled:cursor-default"
                    >
                        ›
                    </button>
                </div>
            )}
        </div>
    );
}

/**
 * #138 — Vue « Guilde » du module Succès (refonte de DungeonDirectory).
 * Social d'abord : pour chaque succès, qui cherche encore / qui l'a déjà validé.
 * La fiche boss (drops, sorts, carte) est un tiroir secondaire — plus le hero.
 * Aucun modal posts : « Chercher un groupe » navigue vers /donjons-et-quetes.
 */
export function SuccesDirectory({ guildId }: SuccesDirectoryProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [dungeons, setDungeons] = useState<Dungeon[]>([]);
    const [loadingDb, setLoadingDb] = useState(true);
    const [search, setSearch] = useState("");
    const [directory, setDirectory] = useState<DirectoryAchievement[]>([]);
    const [loadingDir, setLoadingDir] = useState(false);
    const autoSelectedRef = useRef(false);
    // Refonte Succès Commun — accordéon par succès + filtres pseudo / classe / état.
    const [expandedAchievementId, setExpandedAchievementId] = useState<string | null>(null);
    const [memberQuery, setMemberQuery] = useState("");
    const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
    const [memberStatus, setMemberStatus] = useState<"all" | "missing" | "completed">("all");
    const [missingPage, setMissingPage] = useState(1);
    const [completedPage, setCompletedPage] = useState(1);
    const [classPopoverOpen, setClassPopoverOpen] = useState(false);

    const selectedDungeonId = searchParams.get("dungeon");
    const selectedDungeon = dungeons.find((d) => d.id === selectedDungeonId) || null;

    const updateParam = useCallback(
        (key: string, value: string | null) => {
            const params = new URLSearchParams(searchParams.toString());
            if (value === null) params.delete(key);
            else params.set(key, value);
            router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
        },
        [router, searchParams]
    );

    // #138 UI : jamais de panneau vide à droite — auto-sélection du 1er donjon UNE SEULE fois
    // au chargement (le « Retour à la liste » mobile efface l'URL sans être surchargé).
    useEffect(() => {
        if (autoSelectedRef.current || loadingDb || dungeons.length === 0) return;
        if (selectedDungeonId) {
            autoSelectedRef.current = true;
            return;
        }
        autoSelectedRef.current = true;
        updateParam("dungeon", dungeons[0].id);
    }, [loadingDb, dungeons, selectedDungeonId, updateParam]);

    useEffect(() => {
        let cancelled = false;
        getDungeonsWithAchievements().then((res) => {
            if (cancelled) return;
            if (res.success && res.data) {
                const unique = Array.from(new Map((res.data as any[]).map((d) => [d.id, d])).values()) as Dungeon[];
                setDungeons(unique.sort((a, b) => a.level - b.level));
            }
            setLoadingDb(false);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    // Chargement du directory (qui a / qui cherche) à la sélection.
    useEffect(() => {
        if (!selectedDungeon) return;
        let cancelled = false;
        setLoadingDir(true);
        setDirectory([]);
        getDungeonDirectory(guildId, selectedDungeon.id).then((dirRes) => {
            if (cancelled) return;
            if (dirRes.success && dirRes.data) setDirectory(dirRes.data);
            setLoadingDir(false);
        });
        return () => {
            cancelled = true;
        };
    }, [selectedDungeon, guildId]);

    // Refonte Succès Commun — à l'arrivée sur un donjon, ouvrir le succès le plus pertinent :
    // 1. succès ciblé dans l'URL (?achievementId=), 2. premier non terminé, 3. premier de la liste.
    const processedDungeonRef = useRef<string | null>(null);
    useEffect(() => {
        if (!selectedDungeon || loadingDir || directory.length === 0) return;
        if (processedDungeonRef.current === selectedDungeon.id) return;
        processedDungeonRef.current = selectedDungeon.id;

        const urlAchv = searchParams.get("achievementId");
        const inList = urlAchv ? directory.some((a) => a.achievementId === urlAchv) : false;
        setExpandedAchievementId(
            inList ? (urlAchv as string) : directory.find((a) => a.missing.length > 0)?.achievementId ?? directory[0]?.achievementId ?? null
        );

        // Classes actives depuis l'URL (&classes=iop,pandawa).
        const urlClasses = (searchParams.get("classes") || "")
            .split(",")
            .map((c) => c.trim().toLowerCase())
            .filter((c) => DOFUS_CLASSES.some((cl) => cl.id === c));
        setSelectedClasses(urlClasses);

        setMemberQuery("");
        setMemberStatus("all");
        setMissingPage(1);
        setCompletedPage(1);

        // Un achievementId obsolète (appartenait à un autre donjon) est nettoyé de l'URL.
        if (!inList && urlAchv) {
            const params = new URLSearchParams(searchParams.toString());
            params.delete("achievementId");
            router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
        }
    }, [selectedDungeon, loadingDir, directory, searchParams, router]);

    // À chaque changement de succès ouvert ou de filtres : retour page 1.
    useEffect(() => {
        setMissingPage(1);
        setCompletedPage(1);
    }, [expandedAchievementId, memberQuery, selectedClasses, memberStatus]);

    const toggleAchievement = useCallback(
        (achievementId: string) => {
            setExpandedAchievementId((prev) => (prev === achievementId ? null : achievementId));
            setClassPopoverOpen(false);
            const params = new URLSearchParams(searchParams.toString());
            const next = expandedAchievementId === achievementId ? null : achievementId;
            if (next) params.set("achievementId", next);
            else params.delete("achievementId");
            router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
        },
        [router, searchParams, expandedAchievementId]
    );

    const toggleClass = useCallback(
        (classId: string) => {
            const next = selectedClasses.includes(classId)
                ? selectedClasses.filter((c) => c !== classId)
                : [...selectedClasses, classId];
            setSelectedClasses(next);
            const params = new URLSearchParams(searchParams.toString());
            if (next.length > 0) params.set("classes", next.join(","));
            else params.delete("classes");
            router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
        },
        [router, searchParams, selectedClasses]
    );

    const expandedAchv = directory.find((a) => a.achievementId === expandedAchievementId) || null;

    const normalizeQuery = useCallback(
        (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
        []
    );

    // Filtres côté client scopes au succès ouvert (jamais au donjon entier).
    const filteredMembers = useMemo(() => {
        if (!expandedAchv) return { missing: [] as DirectoryMember[], hasCompleted: [] as DirectoryMember[] };
        const q = normalizeQuery(memberQuery.trim());
        const matches = (m: DirectoryMember) => {
            if (selectedClasses.length > 0) {
                const clsId = m.classe ? getClass(m.classe)?.id || m.classe.toLowerCase() : "";
                if (!clsId || !selectedClasses.includes(clsId)) return false;
            }
            if (!q) return true;
            const cls = m.classe ? getClass(m.classe) : null;
            return (
                normalizeQuery(m.name).includes(q) ||
                normalizeQuery(m.classe || "").includes(q) ||
                (cls ? normalizeQuery(cls.name).includes(q) : false)
            );
        };
        return {
            missing: expandedAchv.missing.filter(matches),
            hasCompleted: expandedAchv.hasCompleted.filter(matches),
        };
    }, [expandedAchv, memberQuery, selectedClasses, normalizeQuery]);

    // Comptes de membres par classe (pour la popover de filtre classe).
    const classCounts = useMemo(() => {
        const counts = new Map<string, number>();
        if (!expandedAchv) return counts;
        for (const m of [...expandedAchv.missing, ...expandedAchv.hasCompleted]) {
            if (!m.classe) continue;
            const clsId = getClass(m.classe)?.id || m.classe.toLowerCase();
            counts.set(clsId, (counts.get(clsId) || 0) + 1);
        }
        return counts;
    }, [expandedAchv]);

    const hasActiveFilters = memberQuery.trim() !== "" || selectedClasses.length > 0;

    const filteredDungeons = useMemo(() => {
        const term = search.toLowerCase();
        if (!term) return dungeons;
        return dungeons.filter((d) => d.name.toLowerCase().includes(term) || d.bossName.toLowerCase().includes(term));
    }, [dungeons, search]);

    if (loadingDb) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-warning" />
                <p className="font-medium">Chargement de la base de données…</p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Recherche */}
            <div className="relative" data-tour="succes-search">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher un donjon ou un boss…"
                                                                        className="w-full h-11 pl-9 pr-8 rounded-xl bg-surface border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {search && (
                    <button
                        onClick={() => setSearch("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label="Effacer la recherche"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            <div className="grid lg:grid-cols-[340px_1fr] gap-4 items-start">
                {/* ─── LISTE DES DONJONS ─── */}
                <div className={cn("space-y-2 lg:sticky lg:top-20 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1 custom-scrollbar", selectedDungeon && "hidden lg:block")}>
                    {filteredDungeons.length === 0 ? (
                        <div className="py-16 text-center text-muted-foreground">
                            <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
                            <p className="font-medium">Aucun donjon trouvé.</p>
                        </div>
                    ) : (
                        filteredDungeons.map((d) => {
                            const active = d.id === selectedDungeonId;
                            return (
                                <button
                                    key={d.id}
                                    onClick={() => updateParam("dungeon", d.id)}
                                    className={cn(
                                        "w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-colors min-h-16",
                                        active
                                            ? "bg-elevated/90 border-border-strong"
                                            : "bg-surface/70 border-border hover:bg-elevated/70"
                                    )}
                                >
                                    {d.imageUrl ? (
                                        <img src={d.imageUrl} alt="" className="w-11 h-11 rounded-xl object-cover border border-border bg-background shrink-0" loading="lazy" />
                                    ) : (
                                        <div className="w-11 h-11 rounded-xl bg-background border border-border flex items-center justify-center shrink-0">
                                            <Trophy className="w-5 h-5 text-muted-foreground/50" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-foreground truncate">{d.name}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {d.bossName} · LVL {d.level}
                                        </p>
                                    </div>
                                    <Users className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                                </button>
                            );
                        })
                    )}
                </div>

                {/* ─── DÉTAIL SOCIAL DU DONJON SÉLECTIONNÉ ─── */}
                <div className={cn(!selectedDungeon && "hidden lg:block")}>
                    {selectedDungeon ? (
                        <div className="bg-surface/70 border border-border rounded-2xl overflow-hidden">
                            <div className="border-b border-border p-5 space-y-4">
                                <button
                                    onClick={() => updateParam("dungeon", null)}
                                    className="lg:hidden inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground min-h-11 px-1"
                                >
                                    <ChevronLeft className="w-4 h-4" /> Retour à la liste
                                </button>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                    <div className="relative shrink-0">
                                        {selectedDungeon.imageUrl ? (
                                            <img src={selectedDungeon.imageUrl} alt="" className="w-16 h-16 rounded-2xl object-cover border border-border" />
                                        ) : (
                                            <div className="w-16 h-16 rounded-2xl bg-background border border-border flex items-center justify-center">
                                                <Trophy className="w-7 h-7 text-muted-foreground/50" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h2 className="text-lg font-black text-foreground leading-tight">{selectedDungeon.name}</h2>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Boss : {selectedDungeon.bossName} · LVL {selectedDungeon.level}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {selectedDungeon.dofuspourlesnoobsUrl && (
                                            <a
                                                href={selectedDungeon.dofuspourlesnoobsUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 px-3 py-2 min-h-11 rounded-xl border border-border bg-surface text-xs font-bold text-foreground hover:bg-elevated transition-colors"
                                            >
                                                <img
                                                    src="https://www.dofuspourlesnoobs.com/favicon.ico"
                                                    alt=""
                                                    className="w-3.5 h-3.5 rounded-sm shrink-0"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).style.display = "none";
                                                    }}
                                                />
                                                Guide DPNL
                                            </a>
                                        )}
                                        <Link
                                            href={`/dashboard/${guildId}/donjons-et-quetes?dungeonId=${selectedDungeon.id}${
                                                expandedAchievementId ? `&achievementId=${expandedAchievementId}` : ""
                                            }`}
                                            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-11 rounded-xl border border-border bg-surface text-foreground text-xs font-bold uppercase tracking-wide hover:bg-elevated transition-colors"
                                        >
                                            <Swords className="w-4 h-4 text-muted-foreground" /> Chercher un groupe
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            {/* Social d'abord : qui a / qui cherche, par succès */}
                            <div className="p-5">
                                {loadingDir ? (
                                    <div className="space-y-3 py-2">
                                        {[0, 1, 2, 3].map((i) => (
                                            <div key={i} className="border border-border rounded-xl overflow-hidden bg-background/30 animate-pulse">
                                                <div className="flex items-center gap-3 px-4 py-3 bg-surface/60">
                                                    <div className="w-8 h-8 rounded-lg bg-elevated border border-border shrink-0" />
                                                    <div className="flex-1 space-y-2">
                                                        <div className="h-3 w-2/3 rounded bg-elevated" />
                                                        <div className="h-2 w-1/2 rounded bg-elevated/60" />
                                                    </div>
                                                    <div className="h-6 w-20 rounded-full bg-elevated/60 shrink-0" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : directory.length === 0 ? (
                                    <div className="py-16 text-center text-muted-foreground">
                                        <Info className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                        <p className="font-medium">Aucun succès enregistré pour ce donjon.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {/* En-tête : progression globale du donjon */}
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-caption font-black uppercase tracking-widest text-muted-foreground">
                                                Succès du donjon · {directory.filter((a) => a.missing.length === 0).length} / {directory.length}
                                            </p>
                                            {directory.every((a) => a.missing.length === 0) && (
                                                <span className="text-xs font-black uppercase tracking-wide text-muted-foreground bg-surface border border-border px-2 py-1 rounded-full">
                                                    Toute la guilde a tout validé
                                                </span>
                                            )}
                                        </div>

                                        {/* Résumé compact : une ligne par succès, un seul ouvert à la fois */}
                                        <div className="space-y-1.5">
                                        {directory.map((achv) => {
                                            const missingCount = achv.missing.length;
                                            const doneCount = achv.hasCompleted.length;
                                            const totalCount = missingCount + doneCount;
                                            const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
                                            const isOpen = expandedAchievementId === achv.achievementId;
                                            const everyone = missingCount === 0;
                                            return (
                                                <div key={achv.achievementId} className="border border-border rounded-xl overflow-hidden bg-background/30">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleAchievement(achv.achievementId)}
                                                        aria-expanded={isOpen}
                                                        className={cn(
                                                            "w-full flex items-center gap-3 px-4 py-2.5 min-h-11 text-left transition-colors",
                                                            isOpen ? "bg-surface/70" : "hover:bg-surface/40"
                                                        )}
                                                    >
                                                        {achv.iconUrl ? (
                                                            <img src={achv.iconUrl} alt="" className="w-8 h-8 rounded-lg bg-surface border border-border p-1 object-contain shrink-0" loading="lazy" />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center shrink-0">
                                                                <Trophy className="w-4 h-4 text-muted-foreground/50" />
                                                            </div>
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-sm font-bold text-foreground truncate">{achv.achievementName}</p>
                                                                {everyone && (
                                                                    <span className="text-[10px] font-black uppercase tracking-wide text-muted-foreground bg-surface border border-border px-1.5 py-0.5 rounded-full shrink-0">
                                                                        Tous validé
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <div className="w-16 h-1.5 rounded-full bg-background border border-border overflow-hidden shrink-0">
                                                                    <div className="h-full rounded-full bg-warning transition-all" style={{ width: `${pct}%` }} />
                                                                </div>
                                                                <span className="text-caption font-semibold text-muted-foreground">
                                                                    {doneCount} / {totalCount} validés · {missingCount} manquent · {pct} %
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <ChevronDown className={cn("w-4 h-4 text-muted-foreground/50 shrink-0 transition-transform", isOpen && "rotate-180")} />
                                                    </button>

                                                    {isOpen && (
                                                        <div className="border-t border-border p-4 space-y-4">
                                                            {/* Recherche pseudo / classe */}
                                                            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                                                                <div className="relative flex-1 min-w-0">
                                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                                                                    <input
                                                                        value={memberQuery}
                                                                        onChange={(e) => setMemberQuery(e.target.value)}
                                                                        placeholder="Rechercher un pseudo ou une classe…"
                    className="w-full h-11 pl-9 pr-8 rounded-xl bg-surface border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                                    />
                                                                    {memberQuery && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setMemberQuery("")}
                                                                            aria-label="Effacer la recherche"
                                                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                                                        >
                                                                            <X className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                </div>

                                                                {/* Filtre classe (multi-sélection, classes partagées dans l'URL &classes=) */}
                                                                <div className="relative shrink-0">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setClassPopoverOpen((v) => !v)}
                                                                        className={cn(
                                                                            "inline-flex items-center gap-2 h-11 px-3 rounded-xl border text-xs font-bold transition-colors",
                                                                            selectedClasses.length > 0
                                                                                ? "border-border-strong bg-elevated text-foreground"
                                                                                : "border-border bg-surface text-muted-foreground hover:bg-elevated"
                                                                        )}
                                                                    >
                                                                        <Users className="w-4 h-4" />
                                                                        {selectedClasses.length > 0
                                                                            ? `${selectedClasses.length} classe${selectedClasses.length > 1 ? "s" : ""}`
                                                                            : "Classe : Toutes"}
                                                                        <ChevronDown className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    {classPopoverOpen && (
                                                                        <>
                                                                            <div className="fixed inset-0 z-10" onClick={() => setClassPopoverOpen(false)} />
                                                                            <div className="absolute right-0 z-20 mt-2 w-64 max-h-80 overflow-y-auto custom-scrollbar bg-surface border border-border rounded-2xl shadow-2xl p-2 space-y-0.5">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setSelectedClasses([]);
                                                                                        setClassPopoverOpen(false);
                                                                                    }}
                                                                                    className={cn(
                                                                                        "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-colors",
                                                                                         selectedClasses.length === 0 ? "text-foreground" : "text-muted-foreground hover:bg-elevated"
                                                                                    )}
                                                                                >
                                                                                    <span>Toutes classes</span>
                                                                                    <span className="text-caption font-semibold text-muted-foreground">{missingCount + doneCount}</span>
                                                                                </button>
                                                                                {DOFUS_CLASSES.map((cls) => {
                                                                                    const count = classCounts.get(cls.id) || 0;
                                                                                    const active = selectedClasses.includes(cls.id);
                                                                                    return (
                                                                                        <button
                                                                                            key={cls.id}
                                                                                            type="button"
                                                                                            onClick={() => toggleClass(cls.id)}
                                                                                            className={cn(
                                                                                                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-colors",
                                                                                                active ? "bg-elevated text-foreground" : "text-muted-foreground hover:bg-elevated"
                                                                                            )}
                                                                                        >
                                                                                            <img src={cls.icon} alt="" className="w-4 h-4 object-contain shrink-0" />
                                                                                            <span className="flex-1 text-left">{cls.name}</span>
                                                                                            {count > 0 && <span className="text-caption font-semibold text-muted-foreground">{count}</span>}
                                                                                        </button>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {/* Filtre d'état */}
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                {([
                                                                    { id: "all", label: "Tous" },
                                                                    { id: "missing", label: "Cherchent encore" },
                                                                    { id: "completed", label: "Déjà validé" },
                                                                ] as const).map((s) => (
                                                                    <button
                                                                        key={s.id}
                                                                        type="button"
                                                                        onClick={() => setMemberStatus(s.id)}
                                                                        className={cn(
                                                                            "px-3.5 py-2 min-h-11 rounded-xl border text-xs font-bold transition-colors",
                                                                            memberStatus === s.id
                                                                                ? "bg-elevated border-border-strong text-foreground"
                                                                                : "bg-surface/70 border-border text-muted-foreground hover:bg-elevated/70"
                                                                        )}
                                                                    >
                                                                        {s.label}
                                                                    </button>
                                                                ))}
                                                                <span className="text-caption font-semibold text-muted-foreground lg:ml-auto">
                                                                    {filteredMembers.missing.length + filteredMembers.hasCompleted.length} résultats ·{" "}
                                                                    {filteredMembers.missing.length} cherchent encore · {filteredMembers.hasCompleted.length} déjà validé
                                                                </span>
                                                            </div>

                                                            {/* Colonnes membres : scoped au succès ouvert, listes denses + pagination 24/page */}
                                                            {hasActiveFilters &&
                                                            filteredMembers.missing.length === 0 &&
                                                            filteredMembers.hasCompleted.length === 0 ? (
                                                                <div className="py-10 text-center text-muted-foreground border border-dashed border-border rounded-xl bg-background/40">
                                                                    <Users className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                                                    <p className="text-sm font-medium">Aucun membre ne correspond à ces filtres.</p>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setMemberQuery("");
                                                                            setSelectedClasses([]);
                                                                        }}
                                                                        className="mt-3 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border bg-surface text-xs font-bold text-foreground hover:bg-elevated transition-colors"
                                                                    >
                                                                        <RotateCcw className="w-3.5 h-3.5" /> Réinitialiser
                                                                    </button>
                                                                </div>
                                                            ) : memberStatus === "missing" ? (
                                                                <MemberColumn
                                                                    title={`Cherchent encore (${filteredMembers.missing.length})`}
                                                                    members={filteredMembers.missing}
                                                                    page={missingPage}
                                                                    onPage={setMissingPage}
                                                                    emptyLabel="Toute la guilde a validé ce succès !"
                                                                />
                                                            ) : memberStatus === "completed" ? (
                                                                <MemberColumn
                                                                    title={`Déjà validé (${filteredMembers.hasCompleted.length})`}
                                                                    members={filteredMembers.hasCompleted}
                                                                    page={completedPage}
                                                                    onPage={setCompletedPage}
                                                                    emptyLabel="Personne ne l'a encore validé."
                                                                />
                                                            ) : (
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                                    <MemberColumn
                                                                        title={`Cherchent encore (${filteredMembers.missing.length})`}
                                                                        members={filteredMembers.missing}
                                                                        page={missingPage}
                                                                        onPage={setMissingPage}
                                                                        emptyLabel="Toute la guilde a validé ce succès !"
                                                                    />
                                                                    <MemberColumn
                                                                        title={`Déjà validé (${filteredMembers.hasCompleted.length})`}
                                                                        members={filteredMembers.hasCompleted}
                                                                        page={completedPage}
                                                                        onPage={setCompletedPage}
                                                                        emptyLabel="Personne ne l'a encore validé."
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        </div>
                                    </div>
                                )}

                            </div>
                        </div>
                    ) : (
                        <div className="hidden lg:flex flex-col items-center justify-center py-24 text-muted-foreground border border-dashed border-border rounded-2xl bg-background/40">
                            <Users className="w-12 h-12 mb-4 opacity-20" />
                            <p className="font-medium">Sélectionne un donjon pour voir qui a quoi.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

"use client";

import { useEffect, useState, useMemo } from "react";
import { 
    Trophy, 
    Users, 
    TrendingUp, 
    Crown, 
    Search, 
    X, 
    Gem, 
    CheckCircle2, 
    BookOpen, 
    Medal, 
    Info, 
    BarChart3, 
    Flag, 
    ChevronRight,
    ArrowUpRight,
    Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import type { GuildDofusStats, MemberDofusSummary, GuildMemberSummary } from "@/server/actions/dofus-quest-actions";
import { getDofusColor } from "./dofus-colors";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface GuildDofusOverviewProps {
    stats: GuildDofusStats[];
    topMembers: MemberDofusSummary[];
    members?: GuildMemberSummary[];
    totalMembers: number;
    guildId?: string;
    onMemberClick?: (profileId: string, pseudo: string, avatarUrl?: string) => void;
}

export function GuildDofusOverview({ stats, topMembers, members = [], totalMembers, guildId, onMemberClick }: GuildDofusOverviewProps) {
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("Tous");
    const [selectedDofus, setSelectedDofus] = useState<GuildDofusStats | null>(null);
    const [drawerSearch, setDrawerSearch] = useState("");
    const [drawerTab, setDrawerTab] = useState<"all" | "in_progress" | "obtained">("all");
    const [memberQuery, setMemberQuery] = useState("");

    // Fermeture du drawer sur Échap
    useEffect(() => {
        if (!selectedDofus) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setSelectedDofus(null);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [selectedDofus]);

    // Catégories uniques
    const categories = useMemo(() => {
        const cats = new Set<string>();
        cats.add("Tous");
        stats.forEach(s => {
            const cat = (s as any).filterCategory || "Autres";
            cats.add(cat);
        });
        return Array.from(cats);
    }, [stats]);

    const filteredStats = useMemo(() => {
        return stats.filter(s => {
            const matchesSearch = s.nameShort.toLowerCase().includes(search.toLowerCase()) || 
                                 s.name.toLowerCase().includes(search.toLowerCase());
            const matchesCat = categoryFilter === "Tous" || (s as any).filterCategory === categoryFilter;
            return matchesSearch && matchesCat;
        });
    }, [stats, search, categoryFilter]);

    const insights = useMemo(() => {
        if (stats.length === 0) return null;
        const uniqueObtained = stats.filter(s => s.obtainedCount > 0).length;
        const globalRate = Math.round(stats.reduce((sum, s) => sum + s.obtainedPercent, 0) / stats.length);
        const sorted = [...stats].sort((a, b) => b.obtainedPercent - a.obtainedPercent);
        return {
            uniqueObtained,
            globalRate,
            most: sorted[0],
            least: sorted[sorted.length - 1],
        };
    }, [stats]);

    const filteredMembers = useMemo(() => {
        if (!memberQuery.trim()) return [];
        const q = memberQuery.toLowerCase();
        return (members || [])
            .filter(m => (m.pseudo || "").toLowerCase().includes(q))
            .slice(0, 8);
    }, [members, memberQuery]);

    // Membres du drawer filtrés & groupés
    const drawerMembers = useMemo(() => {
        if (!selectedDofus) return { inProgress: [], obtained: [] };
        const q = drawerSearch.toLowerCase().trim();
        
        const all = selectedDofus.membersProgress.filter(m => 
            !q || m.pseudo.toLowerCase().includes(q)
        );

        const inProgress = all
            .filter(m => !m.isObtained)
            .sort((a, b) => b.percent - a.percent);

        const obtained = all
            .filter(m => m.isObtained)
            .sort((a, b) => a.pseudo.localeCompare(b.pseudo));

        return { inProgress, obtained };
    }, [selectedDofus, drawerSearch]);

    return (
        <div className="flex flex-col gap-8 pt-4">
            {/* ── 👤 MEMBRES : CLASSEMENT DOFUS & GRILLE D'ENTRAIDE ── */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                
                {/* 🏆 TABLE D'HONNEUR (Colonne Gauche) */}
                <div className="xl:col-span-4 flex flex-col gap-4">
                    <div className="flex items-center gap-3 px-2">
                        <Trophy className="w-5 h-5 text-warning" />
                        <h3 className="text-base font-black text-foreground uppercase tracking-tight">
                            Table d'Honneur
                        </h3>
                        <div className="h-px flex-1 bg-border" />
                        <span className="text-caption text-muted-foreground font-bold uppercase tracking-wider flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" />
                            {totalMembers} Membres
                        </span>
                    </div>

                    {/* Rechercher un membre */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Chercher un membre..."
                            value={memberQuery}
                            onChange={(e) => setMemberQuery(e.target.value)}
                            className="pl-9 pr-8 py-2 text-caption font-bold bg-surface border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-border-strong transition-all w-full"
                        />
                        {memberQuery && (
                            <button
                                onClick={() => setMemberQuery("")}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}

                        {/* Résultats de recherche membre instantanés */}
                        {filteredMembers.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1.5 bg-background border border-border rounded-xl shadow-2xl p-1.5 z-30 flex flex-col gap-1">
                                {filteredMembers.map(m => (
                                    <button
                                        key={m.profileId}
                                        onClick={() => {
                                            setMemberQuery("");
                                            onMemberClick?.(m.profileId, m.pseudo, m.image || undefined);
                                        }}
                                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-surface text-left transition-colors"
                                    >
                                        <div className="w-6 h-6 rounded-md overflow-hidden bg-surface flex-shrink-0 border border-border">
                                            {m.image ? (
                                                <img src={m.image} alt={m.pseudo} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-caption flex items-center justify-center h-full font-bold uppercase text-muted-foreground">{m.pseudo[0]}</span>
                                            )}
                                        </div>
                                        <span className="text-caption font-bold text-foreground truncate flex-1">{m.pseudo}</span>
                                        <span className="text-caption text-muted-foreground font-mono tabular-nums flex-shrink-0">{m.dofusObtained}/{m.dofusTotal}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Liste des tops */}
                    <div className="flex flex-col gap-2">
                        {topMembers.slice(0, 10).map((member, index) => {
                            const isFirst = index === 0;
                            const isSecond = index === 1;
                            const isThird = index === 2;
                            
                            return (
                                <div
                                    key={member.profileId}
                                    onClick={() => onMemberClick?.(member.profileId, member.pseudo, member.image || undefined)}
                                    title={`${member.pseudo} — ${member.dofusObtained}/${member.dofusTotal} Dofus obtenus`}
                                    className={`group/member flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-colors cursor-pointer border ${
                                        isFirst 
                                            ? "bg-warning/5 border-warning/30 hover:border-warning/50" 
                                            : isSecond
                                            ? "bg-surface border-border hover:border-border-strong"
                                            : isThird
                                            ? "bg-surface border-border hover:border-border-strong"
                                            : "bg-surface/50 border-border hover:bg-surface hover:border-border-strong"
                                    }`}
                                >
                                    <div className="w-5 flex-shrink-0 flex items-center justify-center font-bold text-caption">
                                        {isFirst ? (
                                            <Crown className="w-4 h-4 text-warning" />
                                        ) : isSecond ? (
                                            <Medal className="w-4 h-4 text-foreground" />
                                        ) : isThird ? (
                                            <Medal className="w-4 h-4 text-warning/80" />
                                        ) : (
                                            <span className="text-muted-foreground">#{index + 1}</span>
                                        )}
                                    </div>
                                    
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden border border-border bg-background">
                                        {member.image ? (
                                            <img src={member.image} alt={member.pseudo} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-caption font-bold text-muted-foreground">
                                                {member.pseudo.charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className="text-caption font-bold text-foreground truncate">
                                            {member.pseudo}
                                        </p>
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <span className="text-caption font-mono font-bold text-foreground">
                                                {member.dofusObtained}
                                            </span>
                                            <span className="text-caption text-muted-foreground">
                                                / {member.dofusTotal} Dofus
                                            </span>
                                        </div>
                                    </div>

                                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover/member:text-foreground group-hover/member:translate-x-0.5 transition-transform" />
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── 🌌 GRILLE D'ENTRAIDE DOFUS (Colonne Droite) ── */}
                <div className="xl:col-span-8 flex flex-col gap-4">
                    {/* Header + Filtres */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2">
                        <div className="flex items-center gap-2">
                            <Gem className="w-5 h-5 text-warning" />
                            <h3 className="text-base font-black text-foreground uppercase tracking-tight">
                                Progression & Entraide Guilde
                            </h3>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1 sm:w-48">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Filtrer un Dofus..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-8 pr-3 py-1.5 text-caption font-bold bg-surface border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-border-strong transition-all w-full"
                                />
                            </div>

                            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                <SelectTrigger className="w-[130px] h-8 bg-surface border-border text-caption font-bold text-foreground rounded-xl">
                                    <SelectValue placeholder="Catégorie" />
                                </SelectTrigger>
                                <SelectContent className="bg-popover border-border text-popover-foreground rounded-xl shadow-2xl">
                                    {categories.map(cat => (
                                        <SelectItem key={cat} value={cat} className="text-caption font-bold text-foreground focus:bg-accent focus:text-accent-foreground cursor-pointer">
                                            {cat}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* KPIs Résumé */}
                    {insights && (
                        <div className="grid grid-cols-3 gap-2.5">
                            <div className="p-3 rounded-xl bg-surface border border-border flex items-center gap-2.5">
                                <Gem className="w-4 h-4 text-warning flex-shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-caption font-bold text-muted-foreground uppercase tracking-wide truncate">Obtenus (≥1)</p>
                                    <p className="text-sm font-black text-foreground tabular-nums">{insights.uniqueObtained} <span className="text-caption text-muted-foreground font-normal">/ {stats.length}</span></p>
                                </div>
                            </div>
                            <div className="p-3 rounded-xl bg-surface border border-border flex items-center gap-2.5">
                                <TrendingUp className="w-4 h-4 text-success flex-shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-caption font-bold text-muted-foreground uppercase tracking-wide truncate">Taux global</p>
                                    <p className="text-sm font-black text-success tabular-nums">{insights.globalRate}%</p>
                                </div>
                            </div>
                            <div className="p-3 rounded-xl bg-surface border border-border flex items-center gap-2.5">
                                <Crown className="w-4 h-4 text-warning flex-shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-caption font-bold text-muted-foreground uppercase tracking-wide truncate">Plus avancé</p>
                                    <p className="text-sm font-black text-foreground truncate">{insights.most.nameShort}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* GRILLE COMPACTE DES DOFUS (2 à 3 colonnes) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filteredStats.map((s) => {
                            const isAllDone = s.obtainedCount === s.totalMembers && s.totalMembers > 0;
                            const hasAny = s.obtainedCount > 0;
                            const activeInProgress = s.membersProgress.filter(m => !m.isObtained && m.percent > 0);

                            return (
                                <div
                                    key={s.dofusId}
                                    onClick={() => {
                                        setSelectedDofus(s);
                                        setDrawerSearch("");
                                        setDrawerTab("all");
                                    }}
                                    className="p-3.5 rounded-2xl bg-surface border border-border hover:border-border-strong hover:bg-surface/80 transition-all cursor-pointer flex flex-col justify-between gap-3 group relative"
                                >
                                    {/* Top Row : Icon + Nom + Ratio */}
                                    <div className="flex items-start gap-3">
                                        <div className="w-11 h-11 rounded-xl bg-background border border-border flex items-center justify-center flex-shrink-0 p-1">
                                            {s.imageUrl ? (
                                                <img 
                                                    src={s.slug === "dofoozbz" ? "/module-dofus/Dofus_Dofoozbz.png" : s.imageUrl.replace(/^\/public/, "")} 
                                                    alt={s.nameShort} 
                                                    className="w-full h-full object-contain" 
                                                />
                                            ) : (
                                                <Gem className="w-6 h-6 text-muted-foreground" />
                                            )}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-1">
                                                <span className="text-body-sm font-black text-foreground truncate group-hover:text-warning transition-colors">
                                                    {s.nameShort}
                                                </span>
                                                <span className={`text-caption font-bold px-1.5 py-0.5 rounded ${hasAny ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"}`}>
                                                    {s.obtainedCount}/{s.totalMembers}
                                                </span>
                                            </div>
                                            <p className="text-caption text-muted-foreground truncate">
                                                {(s as any).filterCategory || "Quête"}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Progression Bar & Entraide quick preview */}
                                    <div className="space-y-1.5">
                                        <div className="w-full h-1.5 bg-background border border-border rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-300"
                                                style={{
                                                    width: `${s.obtainedPercent}%`,
                                                    background: isAllDone ? "#10b981" : "#f59e0b",
                                                }}
                                            />
                                        </div>

                                        <div className="flex items-center justify-between text-caption text-muted-foreground">
                                            <span>{s.obtainedPercent}% guilde</span>
                                            {activeInProgress.length > 0 ? (
                                                <span className="text-foreground font-bold">
                                                    {activeInProgress.length} en cours
                                                </span>
                                            ) : (
                                                <span>—</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── 📖 DRAWER LATÉRAL D'ENTRAIDE GUILDE ── */}
            <AnimatePresence>
                {selectedDofus && (
                    <div className="fixed inset-0 z-50 flex justify-end">
                        {/* Overlay backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setSelectedDofus(null)}
                        />

                        {/* Slide-over panel */}
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="relative w-full max-w-lg bg-background border-l border-border h-full shadow-2xl flex flex-col z-10"
                        >
                            {/* Header */}
                            <div className="p-5 border-b border-border flex items-start justify-between gap-4 bg-surface">
                                <div className="flex items-center gap-3.5">
                                    <div className="w-12 h-12 rounded-xl bg-background border border-border p-1.5 flex items-center justify-center flex-shrink-0">
                                        {selectedDofus.imageUrl ? (
                                            <img 
                                                src={selectedDofus.slug === "dofoozbz" ? "/module-dofus/Dofus_Dofoozbz.png" : selectedDofus.imageUrl.replace(/^\/public/, "")} 
                                                alt={selectedDofus.nameShort} 
                                                className="w-full h-full object-contain" 
                                            />
                                        ) : (
                                            <Gem className="w-6 h-6 text-muted-foreground" />
                                        )}
                                    </div>
                                    <div>
                                        <div className="inline-flex items-center gap-1.5 text-caption font-bold text-muted-foreground uppercase tracking-wider">
                                            <span>Entraide Guilde</span>
                                            <span>•</span>
                                            <span>{selectedDofus.obtainedCount}/{selectedDofus.totalMembers} possédés</span>
                                        </div>
                                        <h2 className="text-lg font-black text-foreground">
                                            {selectedDofus.name}
                                        </h2>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setSelectedDofus(null)}
                                    className="p-2 rounded-lg bg-background border border-border text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Actions rapides (Accès Quêtes / Guide) */}
                            {guildId && (
                                <div className="p-4 bg-surface/50 border-b border-border flex items-center justify-between gap-2">
                                    <span className="text-caption font-bold text-muted-foreground">
                                        Voir la quête complète & étapes
                                    </span>
                                    <Link
                                        href={`/dashboard/${guildId}/quetes-dofus/${selectedDofus.slug}`}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-foreground text-background text-caption font-bold hover:bg-foreground/90 transition-colors"
                                    >
                                        Ouvrir le guide <ArrowUpRight className="w-3.5 h-3.5" />
                                    </Link>
                                </div>
                            )}

                            {/* Recherche & Filtres dans le drawer */}
                            <div className="p-4 border-b border-border space-y-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                    <input
                                        type="text"
                                        placeholder="Filtrer les membres..."
                                        value={drawerSearch}
                                        onChange={(e) => setDrawerSearch(e.target.value)}
                                        className="pl-9 pr-3 py-2 text-caption font-bold bg-surface border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-border-strong transition-all w-full"
                                    />
                                </div>

                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => setDrawerTab("all")}
                                        className={`px-3 py-1 rounded-lg text-caption font-bold transition-colors ${
                                            drawerTab === "all" ? "bg-foreground text-background" : "bg-surface border border-border text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                        Tous ({drawerMembers.inProgress.length + drawerMembers.obtained.length})
                                    </button>
                                    <button
                                        onClick={() => setDrawerTab("in_progress")}
                                        className={`px-3 py-1 rounded-lg text-caption font-bold transition-colors ${
                                            drawerTab === "in_progress" ? "bg-warning text-warning-foreground" : "bg-surface border border-border text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                        En cours ({drawerMembers.inProgress.length})
                                    </button>
                                    <button
                                        onClick={() => setDrawerTab("obtained")}
                                        className={`px-3 py-1 rounded-lg text-caption font-bold transition-colors ${
                                            drawerTab === "obtained" ? "bg-success text-success-foreground" : "bg-surface border border-border text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                        Obtenus ({drawerMembers.obtained.length})
                                    </button>
                                </div>
                            </div>

                            {/* Liste scrollable des membres avec étapes actives */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {/* 1. SECTION EN COURS */}
                                {(drawerTab === "all" || drawerTab === "in_progress") && drawerMembers.inProgress.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-caption font-bold text-warning uppercase tracking-wider px-1">
                                            <span>⚔️ En cours d'obtention</span>
                                            <span>{drawerMembers.inProgress.length} membres</span>
                                        </div>

                                        <div className="space-y-2">
                                            {drawerMembers.inProgress.map((m) => (
                                                <div
                                                    key={m.profileId}
                                                    onClick={() => {
                                                        setSelectedDofus(null);
                                                        onMemberClick?.(m.profileId, m.pseudo, m.image || undefined);
                                                    }}
                                                    className="p-3 rounded-xl border border-border bg-surface hover:border-warning/50 transition-colors cursor-pointer space-y-2"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-7 h-7 rounded-lg overflow-hidden bg-background border border-border flex items-center justify-center">
                                                                {m.image ? (
                                                                    <img src={m.image} alt={m.pseudo} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <span className="text-caption font-bold text-muted-foreground">{m.pseudo[0]}</span>
                                                                )}
                                                            </div>
                                                            <span className="text-caption font-bold text-foreground">
                                                                {m.pseudo}
                                                            </span>
                                                        </div>
                                                        <span className="text-caption font-mono font-bold text-warning">
                                                            {m.percent}%
                                                        </span>
                                                    </div>

                                                    {/* Étape / Quête en cours */}
                                                    {m.currentQuestNames && m.currentQuestNames.length > 0 && (
                                                        <div className="flex items-center gap-1.5 text-caption bg-background/60 p-2 rounded-lg border border-border/60">
                                                            <Flag className="w-3 h-3 text-warning flex-shrink-0" />
                                                            <span className="text-muted-foreground font-bold">Étape :</span>
                                                            <span className="text-foreground font-medium truncate">
                                                                {m.currentQuestNames.join(" · ")}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 2. SECTION OBTENUS */}
                                {(drawerTab === "all" || drawerTab === "obtained") && drawerMembers.obtained.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-caption font-bold text-success uppercase tracking-wider px-1">
                                            <span>✓ Possèdent le Dofus</span>
                                            <span>{drawerMembers.obtained.length} membres</span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {drawerMembers.obtained.map((m) => (
                                                <div
                                                    key={m.profileId}
                                                    onClick={() => {
                                                        setSelectedDofus(null);
                                                        onMemberClick?.(m.profileId, m.pseudo, m.image || undefined);
                                                    }}
                                                    className="p-2.5 rounded-xl border border-border bg-surface/50 hover:bg-surface transition-colors cursor-pointer flex items-center gap-2.5"
                                                >
                                                    <div className="w-7 h-7 rounded-lg overflow-hidden bg-background border border-border flex items-center justify-center flex-shrink-0">
                                                        {m.image ? (
                                                            <img src={m.image} alt={m.pseudo} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-caption font-bold text-muted-foreground">{m.pseudo[0]}</span>
                                                        )}
                                                    </div>
                                                    <span className="text-caption font-bold text-foreground truncate flex-1">
                                                        {m.pseudo}
                                                    </span>
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {drawerMembers.inProgress.length === 0 && drawerMembers.obtained.length === 0 && (
                                    <div className="p-8 text-center text-muted-foreground text-caption font-bold">
                                        Aucun membre trouvé pour ce filtre.
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

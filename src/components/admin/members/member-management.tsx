"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
    Users, 
    ShieldCheck, 
    ShieldAlert, 
    Search, 
    Filter, 
    Mail, 
    ExternalLink,
    RefreshCw,
    Info,
    LayoutGrid,
    Settings2,
    UserCircle,
    Download,
    UserX,
    CheckCircle2,
    Calendar,
    ChevronRight,
    ArrowUpRight,
    Trophy,
    ArrowUpDown,
    Bell,
    Send,
    Loader2,
    Check,
    MessageSquare,
    Mic,
    Ban,
    ChevronLeft
} from "lucide-react";
import { 
    Card, 
    CardContent, 
    CardDescription, 
    CardHeader, 
    CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
    Tabs, 
    TabsContent, 
    TabsList, 
    TabsTrigger 
} from "@/components/ui/tabs";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { 
    getMemberReconciliation, 
    sendManualRosterReport,
    type MemberReconciliationData, 
    type RoleStats 
} from "@/server/actions/member-actions";
import { toast } from "sonner";
import { 
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { MemberStatsOverview } from "@/components/admin/member-stats-overview";
import { MemberManagementTable } from "@/components/admin/member-management-table";
import { MemberSyncButton } from "@/components/admin/member-sync-button";
import { DailyReportButton } from "@/components/admin/daily-report-button";
import { MemberDiscordCharts } from "@/components/admin/members/member-discord-charts";
import { MemberBlacklist } from "@/components/admin/members/member-blacklist";
import { RelanceModal, type RelanceTarget } from "@/components/admin/members/relance-modal";

// Static color map to avoid Tailwind CSS purging dynamic class names
const STAT_COLORS = [
    {
        glow: "bg-info/10",
        label: "text-info",
        indicator: "bg-info",
        sublabel: "text-info/70",
    },
    {
        glow: "bg-success/10",
        label: "text-success",
        indicator: "bg-success",
        sublabel: "text-success/70",
    },
    {
        glow: "bg-warning/10",
        label: "text-warning",
        indicator: "bg-warning",
        sublabel: "text-warning/70",
    },
    {
        glow: "bg-info/10",
        label: "text-info",
        indicator: "bg-info",
        sublabel: "text-info/70",
    },
];

/** Build the Discord CDN avatar URL for a guild member */
function getDiscordAvatarUrl(discordId: string, avatar: string | null | undefined): string | undefined {
    if (!avatar) return undefined;
    const ext = avatar.startsWith("a_") ? "gif" : "webp";
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.${ext}?size=80`;
}

/** Deterministic fallback color based on Discord user ID (matches Discord client) */
const DISCORD_COLORS = ["bg-violet-600", "bg-info", "bg-info", "bg-info", "bg-success"];
function getDiscordFallbackColor(discordId: string): string {
    const hash = parseInt(discordId.slice(-4), 10) || 0;
    return DISCORD_COLORS[hash % DISCORD_COLORS.length];
}

interface Member {
    id: string;
    userId: string;
    status: "ACTIVE" | "ARCHIVED" | "BANNED";
    createdAt: string;
    updatedAt: string;
    archivedAt: string | null;
    scheduledDeletion: string | null;
    archiveReason: string | null;
    pseudoDofus: string | null;
    discordNickname: string | null;
    user: {
        name: string | null;
        image: string | null;
        accounts: Array<{ providerAccountId: string }>;
    };
}

interface MemberManagementProps {
    guildId: string;
    initialStats: {
        active: number;
        archived: number;
        banned: number;
        total: number;
        maxMembers: number;
    };
    initialMembers: {
        ownerId?: string | null;
        members: Member[];
    };
    welcomeBadgeName: string;
    isSuperAdmin: boolean;
    channels: any[];
    roles: any[];
    canManageMembers: boolean;
    canManageRelance: boolean;
    currentUserId: string;
}

// Sub-component for individual role audit trigger
function ManualAuditButton({ guildId, roleId }: { guildId: string, roleId: string }) {
    const [isPending, startTransition] = React.useTransition();
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSend = () => {
        startTransition(async () => {
            const res = await sendManualRosterReport(guildId, roleId);
            if (res.success) {
                toast.success("Rapport d'audit envoyé sur Discord !");
                setIsSuccess(true);
                setTimeout(() => setIsSuccess(false), 3000);
            } else {
                toast.error(res.error || "Échec de l'envoi");
            }
        });
    };

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button 
                        size="sm" 
                        variant="ghost" 
                        disabled={isPending}
                        onClick={handleSend}
                        className={`h-7 w-7 p-0 rounded-lg transition-all ${isSuccess ? 'text-success bg-success/10' : 'text-muted-foreground hover:text-violet-400 hover:bg-violet-500/10'}`}
                    >
                        {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : isSuccess ? <Check className="w-3 h-3" /> : <Send className="w-3 h-3" />}
                    </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-black border-border text-caption font-black uppercase tracking-widest">
                    {isPending ? "Envoi..." : isSuccess ? "Envoyé !" : "Envoyer Audit sur Discord"}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

export default function MemberManagement({ 
    guildId, 
    initialStats, 
    initialMembers, 
    welcomeBadgeName, 
    isSuperAdmin,
    channels,
    roles,
    canManageMembers,
    canManageRelance,
    currentUserId
}: MemberManagementProps) {
    const [mounted, setMounted] = useState(false);
    const [activeTab, setActiveTab] = useState("audit");
    // #74 — modale dédiée « Relancer » (solo ou bulk)
    const [relanceTargets, setRelanceTargets] = useState<RelanceTarget[] | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState<{
        members: MemberReconciliationData[];
        stats: RoleStats[];
        authorizedRoles: string[];
    } | null>(null);

    const [memberList, setMemberList] = useState({
        members: initialMembers.members,
        ownerId: initialMembers.ownerId
    });

    const [idTarget, setIdTarget] = useState<{ id: string, name: string } | null>(null);
    const [isUpdating, setIsUpdating] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [joinedFilter, setJoinedFilter] = useState<string>("all");
    const [actionFilter, setActionFilter] = useState<string>("all");
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'joinedAt', direction: 'desc' });
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 15;

    const fetchData = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            const res = await getMemberReconciliation(guildId);
            if (res.success && res.data) {
                setData(res.data);
                if (isRefresh) toast.success("Données synchronisées avec Discord");
            } else {
                toast.error(res.error || "Erreur de synchronisation");
            }
        } catch (error) {
            toast.error("Le service Discord est temporairement indisponible");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [guildId]);

    // Reset pagination when search or filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [search, roleFilter, statusFilter, joinedFilter, actionFilter]);

    const filteredAuditMembers = useMemo(() => {
        if (!data) return [];
        const filtered = data.members.filter(m => {
            const matchesSearch = 
                m.displayName.toLowerCase().includes(search.toLowerCase()) || 
                m.username.toLowerCase().includes(search.toLowerCase()) ||
                m.discordId.includes(search) ||
                (m.ankamaId && m.ankamaId.toLowerCase().includes(search.toLowerCase()));
            
            const matchesRole = roleFilter === "all" || m.roles.includes(roleFilter);
            
            const matchesStatus = 
                statusFilter === "all" || 
                (statusFilter === "dashboard" && m.hasDashboardProfile) ||
                (statusFilter === "missing" && !m.hasDashboardProfile);

            const matchesAction = 
                actionFilter === "all" ||
                (actionFilter === "relancer" && !m.hasDashboardProfile) ||
                (actionFilter === "voir" && m.hasDashboardProfile);

            const matchesJoined = joinedFilter === "all" || (() => {
                if (!m.joinedAt) return false;
                const joinedDate = new Date(m.joinedAt);
                const now = new Date();
                const diffTime = Math.abs(now.getTime() - joinedDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (joinedFilter === "week") return diffDays <= 7;
                if (joinedFilter === "month") return diffDays <= 30;
                if (joinedFilter === "old") return diffDays > 180;
                return true;
            })();

            return matchesSearch && matchesRole && matchesStatus && matchesJoined;
        });

        // Apply Sorting
        filtered.sort((a, b) => {
            let valA: any = a[sortConfig.key as keyof MemberReconciliationData];
            let valB: any = b[sortConfig.key as keyof MemberReconciliationData];

            if (sortConfig.key === 'joinedAt') {
                valA = valA ? new Date(valA).getTime() : 0;
                valB = valB ? new Date(valB).getTime() : 0;
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [data, search, roleFilter, statusFilter, joinedFilter, actionFilter, sortConfig]);

    const paginatedAuditMembers = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredAuditMembers.slice(start, start + pageSize);
    }, [filteredAuditMembers, currentPage]);

    const totalPages = Math.ceil(filteredAuditMembers.length / pageSize);

    const toggleSort = (key: string) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const missingMebersCount = useMemo(() => {
        if (!data) return 0;
        return data.members.filter(m => !m.hasDashboardProfile).length;
    }, [data]);

    // Mounting guard MUST be after all hook declarations (useState, useEffect, useMemo)
    if (!mounted) {
        return <div className="min-h-[800px] animate-pulse bg-surface/10 rounded-3xl" />;
    }

    return (
        <div className="relative min-h-[800px] space-y-8 pb-20">
            {/* Background Decorative Elements */}
            <div className="absolute inset-0 -z-10 bg-[#030303] overflow-hidden pointer-events-none rounded-3xl">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-600/10 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-info/10 blur-[100px] rounded-full" />
                <div className="absolute top-[20%] right-[10%] w-[20%] h-[20%] bg-success/5 blur-[80px] rounded-full" />
            </div>

            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 px-2">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-violet-600/20 border border-violet-500/30 rounded-2xl backdrop-blur-xl shadow-lg shadow-violet-500/10">
                            <Users className="w-8 h-8 text-violet-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl lg:text-5xl font-black tracking-tight text-foreground italic uppercase leading-none">
                                Gestion <span className="text-violet-500">Membres</span>
                            </h1>
                            <p className="text-muted-foreground font-black mt-1.5 flex items-center gap-2 uppercase text-caption tracking-[0.2em] italic">
                                <ShieldCheck className="w-3.5 h-3.5 text-success" />
                                Audit et réconciliation Discord / Dashboard
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button 
                        variant="outline" 
                        onClick={() => fetchData(true)}
                        disabled={refreshing || loading}
                        className="bg-surface/60 border-border hover:bg-elevated hover:border-violet-500/30 transition-all rounded-2xl px-6 h-12 backdrop-blur-xl group text-caption font-black uppercase tracking-widest"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 mr-2.5 group-hover:text-violet-400 transition-colors ${refreshing ? 'animate-spin' : ''}`} />
                        {refreshing ? "Mise à jour..." : "Actualiser"}
                    </Button>
                </div>
            </div>

            {/* Unified Summary Statistics */}
            {canManageMembers && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: "Total Discord", value: data?.members.length || "...", sub: "Membres humains détectés", icon: Users, progress: false },
                        { label: "Inscrits Dashboard", value: data?.members.filter(m => m.hasDashboardProfile).length || 0, sub: `${(data && data.members.length > 0) ? Math.round((data.members.filter(m => m.hasDashboardProfile).length / data.members.length) * 100) : 0}% de couverture`, icon: CheckCircle2, progress: true },
                        { label: "Manquants Dashboard", value: missingMebersCount, sub: "Membres à inviter sur le site", icon: ShieldAlert, progress: false },
                        { label: "Rôles Actifs", value: data?.stats.length || 0, sub: "Rôles mappés sur le Dashboard", icon: Trophy, progress: false }
                    ].map((stat, i) => {
                        const colors = STAT_COLORS[i];
                        return (
                            <Card key={i} className="bg-surface/30 border-border rounded-xl relative overflow-hidden">
                                <CardHeader className="pb-3">
                                    <CardDescription className={`flex items-center gap-2 ${colors.label} font-semibold uppercase text-caption tracking-wide`}>
                                        <stat.icon className="w-3 h-3" />
                                        {stat.label}
                                    </CardDescription>
                                    <CardTitle className="text-3xl font-bold text-foreground">{stat.value}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {stat.progress ? (
                                        <div className="space-y-1.5">
                                            <Progress 
                                                value={data ? (data.members.filter(m => m.hasDashboardProfile).length / data.members.length) * 100 : 0} 
                                                className="h-1.5 bg-surface"
                                                indicatorClassName={colors.indicator}
                                            />
                                            <p className={`text-caption ${colors.sublabel} font-medium uppercase tracking-wide`}>{stat.sub}</p>
                                        </div>
                                    ) : (
                                        <p className="text-caption text-muted-foreground font-medium uppercase tracking-wide">{stat.sub}</p>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                {/* Tabs with scroll on mobile */}
                <div className="overflow-x-auto no-scrollbar -mx-2 px-2 pb-2">
                    <TabsList className="bg-background/80 p-1.5 rounded-xl border border-border w-full sm:w-fit flex flex-wrap sm:flex-nowrap gap-1.5">
                    {[
                        { id: "audit", label: "📊 Audit Discord vs Dashboard", icon: ShieldCheck, requiresFull: true },
                        { id: "management", label: "👥 Liste Roster & Membres", icon: UserCircle, requiresFull: true },
                        { id: "blacklist", label: "🚫 Blacklist Guilde", icon: Ban, requiresFull: true },
                    ].map(tab => {
                        const isDisabled = tab.requiresFull && !canManageMembers;
                        
                        return (
                            <TooltipProvider key={tab.id}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="inline-block flex-1 sm:flex-none">
                                            <TabsTrigger 
                                                value={tab.id} 
                                                disabled={isDisabled}
                                                className={`w-full rounded-lg px-4 py-2.5 text-xs font-semibold text-muted-foreground data-[state=active]:bg-surface data-[state=active]:text-foreground transition-colors gap-2 ${isDisabled ? 'opacity-40 cursor-not-allowed saturate-0' : ''}`}
                                            >
                                                {isDisabled ? <ShieldAlert className="w-4 h-4 text-muted-foreground" /> : <tab.icon className="w-4 h-4" />}
                                                {tab.label}
                                            </TabsTrigger>
                                        </div>
                                    </TooltipTrigger>
                                    {isDisabled && (
                                        <TooltipContent className="bg-surface border-border text-caption font-black uppercase tracking-widest text-warning">
                                            Permission &quot;Gestion des Membres&quot; requise
                                        </TooltipContent>
                                    )}
                                </Tooltip>
                            </TooltipProvider>
                        );
                    })}
                </TabsList>
                </div>

                {/* --- TAB 1: AUDIT --- */}
                <TabsContent value="audit" className="space-y-8 animate-in fade-in duration-150 min-h-[600px]">
                    <p className="text-sm text-muted-foreground -mt-4">
                        Compare les membres présents sur Discord avec les profils enregistrés sur le Dashboard : couverture, rôles mappés et profils manquants.
                    </p>
                    <div className="space-y-8">
                        {/* Bottom Utility Cards */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Embedded Sync Card */}
                            <Card className="bg-surface/40 border-border rounded-2xl overflow-hidden">
                                <CardHeader className="bg-surface py-5 border-b border-border px-6">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-xl bg-info/20 flex items-center justify-center">
                                            <RefreshCw className="w-4 h-4 text-info" />
                                        </div>
                                        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-foreground">Outils & Sync</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6 space-y-4 relative z-10">
                                    <MemberSyncButton guildId={guildId} />
                                    <DailyReportButton guildId={guildId} />
                                    <div className="flex flex-col gap-1 pt-4 border-t border-border">
                                        <span className="text-caption font-semibold text-muted-foreground">Rapport automatique hebdomadaire</span>
                                        <p className="text-caption text-muted-foreground leading-relaxed">
                                            Un récap des membres et de l'activité de la guilde est envoyé automatiquement chaque lundi à 04h00 dans le canal de notifications système. Le bouton « Envoyer le rapport » le génère immédiatement.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-surface/40 border-border rounded-2xl overflow-hidden">
                                <CardHeader className="bg-surface py-5 border-b border-border px-6">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-xl bg-success/20 flex items-center justify-center">
                                            <ShieldCheck className="w-4 h-4 text-success" />
                                        </div>
                                        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-foreground">Audit & Rôles</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6 space-y-6">
                                    {data?.stats.length === 0 ? (
                                        <div className="text-center py-6 space-y-2">
                                            <Settings2 className="w-8 h-8 text-muted-foreground mx-auto" />
                                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Aucun rôle mappé</p>
                                            <p className="text-caption text-muted-foreground leading-relaxed italic">Configurez les rôles dans Paramètres {">"} Rôles pour activer l&apos;audit.</p>
                                        </div>
                                    ) : (
                                        data?.stats.map(s => {
                                            const percent = s.totalDiscord > 0 ? (s.totalDashboard / s.totalDiscord) * 100 : 0;
                                            return (
                                                <div key={s.roleId} className="space-y-3 group/role cursor-default">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2 max-w-[200px]">
                                                            <div 
                                                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                                                style={{ backgroundColor: s.roleColor ? `#${s.roleColor.toString(16).padStart(6, '0')}` : '#71717a' }}
                                                            />
                                                            <span className="text-xs font-black text-foreground truncate group-hover/role:text-foreground transition-colors">{s.roleName}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-caption font-black text-muted-foreground bg-surface px-2 py-0.5 rounded-lg tabular-nums">
                                                                {s.totalDashboard}/{s.totalDiscord}
                                                            </span>
                                                            <ManualAuditButton guildId={guildId} roleId={s.roleId} />
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex-1 h-2 bg-black/60 rounded-full overflow-hidden border border-border p-[1px]">
                                                            <div 
                                                                className={`h-full rounded-full transition-all duration-300  ${
                                                                    percent === 100 ? 'bg-success' : 
                                                                    percent > 70 ? 'bg-violet-500' : 
                                                                    percent > 30 ? 'bg-info' : 'bg-warning'
                                                                }`}
                                                                style={{ width: `${percent}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-caption font-black text-foreground w-8 text-right italic">{percent.toFixed(0)}%</span>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        <div className="space-y-4">
                            {/* Filter Bar */}
                            <div className="flex flex-col md:flex-row gap-4 p-4 bg-surface/40 border border-border rounded-2xl">
                                <div className="relative flex-1 group">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-foreground transition-colors" />
                                    <Input 
                                        placeholder="Rechercher par pseudo ou ID..." 
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="pl-12 h-12 bg-black/40 border-border text-foreground rounded-xl focus:ring-white/10 focus:border-border-strong transition-colors placeholder:text-muted-foreground font-medium"
                                    />
                                </div>
                                <div className="overflow-x-auto no-scrollbar -mx-4 px-4">
                                    <div className="flex gap-2 min-w-max pb-2">
                                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                                        <SelectTrigger className="w-[200px] h-12 bg-black/40 border-border rounded-xl text-xs font-semibold text-foreground uppercase tracking-wide">
                                            <SelectValue placeholder="Tous les rôles" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-background border-border rounded-xl">
                                            <SelectItem value="all" className="uppercase text-caption font-medium tracking-wide">Tous les rôles</SelectItem>
                                            {data?.stats.map(s => (
                                                <SelectItem key={s.roleId} value={s.roleId} className="text-caption font-medium uppercase tracking-wide">
                                                    {s.roleName}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                                        <SelectTrigger className="w-[140px] h-12 bg-black/40 border-border rounded-xl text-caption font-semibold text-foreground uppercase tracking-wide">
                                            <SelectValue placeholder="Dashboard" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-background border-border rounded-xl">
                                            <SelectItem value="all" className="uppercase text-caption font-medium tracking-wide text">Tous</SelectItem>
                                            <SelectItem value="dashboard" className="uppercase text-caption font-medium tracking-wide">Inscrits</SelectItem>
                                            <SelectItem value="missing" className="uppercase text-caption font-medium tracking-wide">Absents</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    <Select value={joinedFilter} onValueChange={setJoinedFilter}>
                                        <SelectTrigger className="w-[150px] h-12 bg-black/40 border-border rounded-xl text-caption font-semibold text-muted-foreground uppercase tracking-wide">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                                                <SelectValue placeholder="Rejoint le" />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent className="bg-background border-border rounded-xl">
                                            <SelectItem value="all" className="uppercase text-caption font-medium tracking-wide">Tout temps</SelectItem>
                                            <SelectItem value="week" className="uppercase text-caption font-medium tracking-wide">{"< 1 semaine"}</SelectItem>
                                            <SelectItem value="month" className="uppercase text-caption font-medium tracking-wide">{"< 1 mois"}</SelectItem>
                                            <SelectItem value="old" className="uppercase text-caption font-medium tracking-wide">{"> 6 mois"}</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    <Select value={actionFilter} onValueChange={setActionFilter}>
                                        <SelectTrigger className="w-[140px] h-12 bg-black/40 border-border rounded-xl text-caption font-semibold text-muted-foreground uppercase tracking-wide">
                                            <SelectValue placeholder="Actions" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-background border-border rounded-xl">
                                            <SelectItem value="all" className="uppercase text-caption font-medium tracking-wide">Toutes</SelectItem>
                                            <SelectItem value="relancer" className="uppercase text-caption font-medium tracking-wide text">À relancer</SelectItem>
                                            <SelectItem value="voir" className="uppercase text-caption font-medium tracking-wide text">À voir</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    {/* #74 — Relance groupée sur les membres filtrés */}
                                    <Button
                                        size="sm"
                                        onClick={() => setRelanceTargets(
                                            filteredAuditMembers.map(m => ({ id: m.discordId, name: m.displayName }))
                                        )}
                                        className="h-12 rounded-xl bg-warning/10 border border-warning/30 text-warning hover:bg-warning hover:text-foreground hover:border-warning text-caption font-semibold uppercase tracking-wide px-4 gap-2"
                                    >
                                        <Bell className="w-3.5 h-3.5" />
                                        Relance groupée
                                        <span className="px-1.5 py-0.5 rounded-md bg-warning/20 text-warning text-caption">
                                            {filteredAuditMembers.length}
                                        </span>
                                    </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="rounded-2xl border border-border bg-surface/40 overflow-x-auto no-scrollbar">
                                <Table className="min-w-[800px] lg:min-w-0">
                                    <TableHeader className="bg-surface border-b border-border">
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="pl-8 py-6 text-caption font-semibold uppercase text-muted-foreground tracking-wide">
                                                <button onClick={() => toggleSort('displayName')} className="flex items-center gap-2 hover:text-foreground transition-colors">
                                                    Membre Discord
                                                    <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === 'displayName' ? 'text-success' : ''}`} />
                                                </button>
                                            </TableHead>
                                            <TableHead className="text-caption font-semibold uppercase text-muted-foreground tracking-wide py-6">Rôles Discord</TableHead>
                                            <TableHead className="py-6 text-caption font-semibold uppercase text-muted-foreground tracking-wide">
                                                <button onClick={() => toggleSort('joinedAt')} className="flex items-center gap-2 hover:text-foreground transition-colors">
                                                    Arrivée
                                                    <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === 'joinedAt' ? 'text-success' : ''}`} />
                                                </button>
                                            </TableHead>
                                            <TableHead className="py-6 text-caption font-semibold uppercase text-muted-foreground tracking-wide">
                                                <button onClick={() => toggleSort('hasDashboardProfile')} className="flex items-center gap-2 hover:text-foreground transition-colors">
                                                    Status
                                                    <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === 'hasDashboardProfile' ? 'text-success' : ''}`} />
                                                </button>
                                            </TableHead>
                                            <TableHead className="text-caption font-semibold uppercase text-muted-foreground tracking-wide pr-8 text-right py-6">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-96 text-center">
                                                    <div className="flex flex-col items-center gap-6">
                                                        <RefreshCw className="w-10 h-10 text-muted-foreground animate-spin" />
                                                        <div className="space-y-2">
                                                            <span className="text-sm font-semibold uppercase tracking-wide text-foreground">Calcul du différentiel</span>
                                                            <p className="text-xs text-muted-foreground">Récupération des profils Discord autorisés...</p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : paginatedAuditMembers.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-48 text-center">
                                                    <div className="flex flex-col items-center gap-2 opacity-40">
                                                        <Search className="w-8 h-8 text-muted-foreground mb-2" />
                                                        <p className="text-sm font-medium text-muted-foreground uppercase">Aucun membre autorisé trouvé</p>
                                                        <p className="text-xs text-muted-foreground">Vérifiez vos filtres ou la configuration des rôles.</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            paginatedAuditMembers.map(member => (
                                                <TableRow key={member.discordId} className="group border-b border-border hover:bg-surface transition-colors">
                                                    <TableCell className="pl-8 py-5">
                                                        <div className="flex items-center gap-4">
                                                            <div className="relative">
                                                                <Avatar className="w-12 h-12 rounded-xl border border-border transition-colors">
                                                                    <AvatarImage
                                                                        src={getDiscordAvatarUrl(member.discordId, member.avatar)}
                                                                        alt={member.displayName}
                                                                        className="object-cover rounded-xl"
                                                                    />
                                                                    <AvatarFallback className={`rounded-xl text-foreground font-semibold text-lg uppercase ${getDiscordFallbackColor(member.discordId)}`}>
                                                                        {member.displayName.charAt(0)}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-lg border-2 border-[#030303] flex items-center justify-center ${member.hasDashboardProfile ? 'bg-success' : 'bg-warning'}`}>
                                                                    {member.hasDashboardProfile ? <CheckCircle2 className="w-3 h-3 text-foreground" /> : <ShieldAlert className="w-3 h-3 text-foreground" />}
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col leading-tight">
                                                                <span className="font-black text-base text-foreground group-hover:text-foreground transition-colors">{member.displayName}</span>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-caption text-muted-foreground font-bold uppercase tracking-widest">@{member.username}</span>
                                                                    {member.ankamaId && (
                                                                        <span className="text-caption text-violet-400 font-black tracking-tight uppercase px-1.5 py-0.5 rounded bg-violet-600/10 border border-violet-500/20">{member.ankamaId}</span>
                                                                    )}
                                                                    {member.hasDashboardProfile && (
                                                                        <div className="flex items-center gap-2 ml-1">
                                                                            <span className="text-caption text-info font-black flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                                                                <MessageSquare className="w-2.5 h-2.5" /> {member.discordMessageCountWeekly || 0}
                                                                            </span>
                                                                            <span className="text-caption text-success font-black flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                                                                <Mic className="w-2.5 h-2.5" /> {(member.discordVoiceTimeWeekly || 0) < 60 ? `${member.discordVoiceTimeWeekly || 0}m` : `${Math.round((member.discordVoiceTimeWeekly || 0) / 60)}h`}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {member.roles.slice(0, 2).map(rId => {
                                                                const roleInfo = data?.stats.find(s => s.roleId === rId);
                                                                if (!roleInfo) return null;
                                                                return (
                                                                    <Badge 
                                                                        key={rId} 
                                                                        variant="outline" 
                                                                        className="text-caption h-5 font-semibold border-border uppercase tracking-wide rounded-md px-1.5"
                                                                        style={{ 
                                                                            color: roleInfo.roleColor ? `#${roleInfo.roleColor.toString(16).padStart(6, '0')}` : undefined,
                                                                            backgroundColor: roleInfo.roleColor ? `#${roleInfo.roleColor.toString(16).padStart(6, '0')}20` : undefined
                                                                        }}
                                                                    >
                                                                        {roleInfo.roleName}
                                                                    </Badge>
                                                                );
                                                            })}
                                                            {member.roles.length > 2 && (
                                                                <Badge variant="outline" className="text-caption h-5 font-semibold border-border text-muted-foreground bg-surface uppercase tracking-wide">
                                                                    +{member.roles.length - 2}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-xs font-medium text-muted-foreground tabular-nums">
                                                        {member.joinedAt ? format(new Date(member.joinedAt), "dd MMM yyyy", { locale: fr }) : "Inconnu"}
                                                    </TableCell>
                                                    <TableCell>
                                                        {member.hasDashboardProfile ? (
                                                            <div className="flex items-center gap-1.5 text-success font-semibold text-caption uppercase tracking-wide bg-success/10 px-2 py-1 rounded-lg w-fit">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-success" />
                                                                Inscrit
                             </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5 text-warning font-semibold text-caption uppercase tracking-wide bg-warning/10 px-2 py-1 rounded-lg w-fit">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-warning" />
                                                                Absent
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="pr-8 text-right">
                                                         {member.hasDashboardProfile ? (
                                                             <Button variant="outline" size="sm" className="h-9 rounded-xl border-border bg-surface hover:bg-success hover:text-foreground hover:border-success transition-colors text-caption font-semibold uppercase tracking-wide p-0 w-9" asChild>
                                                                 <a href={`/dashboard/${guildId}/members/${member.profileId}`} target="_blank">
                                                                     <ArrowUpRight className="w-4 h-4" />
                                                                 </a>
                                                             </Button>
                                                         ) : (
                                                             <Button 
                                                                 variant="outline" 
                                                                 size="sm" 
                                                                 className="h-9 rounded-xl border-warning/30 bg-warning/10 hover:bg-warning hover:text-foreground hover:border-warning transition-colors text-caption font-semibold uppercase tracking-wide px-3 gap-1.5"
                                                                 onClick={() => setRelanceTargets([{ id: member.discordId, name: member.displayName }])}
                                                             >
                                                                 <Bell className="w-3.5 h-3.5" />
                                                                 Relancer
                                                             </Button>
                                                         )}
                                                     </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination UI */}
                            {totalPages > 1 && (
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-6 px-4 py-4 bg-surface/20 border border-border rounded-xl animate-in fade-in duration-150">
                                    <div className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
                                        Affichage de {Math.min(filteredAuditMembers.length, (currentPage - 1) * pageSize + 1)} à {Math.min(filteredAuditMembers.length, currentPage * pageSize)} sur {filteredAuditMembers.length} membres
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className="w-9 h-9 rounded-xl bg-surface border-border hover:bg-surface disabled:opacity-30 transition-all"
                                        >
                                            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                                        </Button>

                                        <div className="flex items-center gap-1.5 px-4 h-9 rounded-xl bg-surface border border-border">
                                            <span className="text-caption font-black text-foreground">{currentPage}</span>
                                            <span className="text-caption font-black text-muted-foreground">/</span>
                                            <span className="text-caption font-black text-muted-foreground">{totalPages}</span>
                                        </div>

                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            className="w-9 h-9 rounded-xl bg-surface border-border hover:bg-surface disabled:opacity-30 transition-all"
                                        >
                                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>


                    </div>
                </TabsContent>

                {/* --- TAB 2: MANAGEMENT --- */}
                <TabsContent value="management" className="space-y-6 animate-in fade-in duration-150 min-h-[600px]">
                    <p className="text-sm text-muted-foreground -mt-4">
                        Liste des membres de la guilde : statut, arrivée, présence sur le Dashboard, archivage et relances Discord.
                    </p>
                    <MemberStatsOverview stats={initialStats} />
                    <div className="p-1 px-3 bg-surface/40 border border-border rounded-3xl backdrop-blur-xl overflow-hidden shadow-2xl">
                        <MemberManagementTable 
                            initialMembers={memberList.members}
                            guildId={guildId}
                            welcomeBadgeName={welcomeBadgeName}
                            isSuperAdmin={isSuperAdmin}
                            isAdmin={canManageMembers}
                            ownerId={memberList.ownerId}
                            currentUserId={currentUserId}
                        />
                    </div>
                </TabsContent>

                {/* --- TAB 3: BLACKLIST --- */}
                <TabsContent value="blacklist" className="space-y-6 animate-in fade-in duration-150 min-h-[600px]">
                    <p className="text-sm text-muted-foreground -mt-4">
                        Membres exclus de la guilde : blocage Dashboard et Discord, géré depuis les deux côtés.
                    </p>
                    <MemberBlacklist guildId={guildId} />
                </TabsContent>
            </Tabs>

            {/* #74 — Modale dédiée « Relancer » (solo ou bulk) */}
            {relanceTargets && (
                <RelanceModal
                    guildId={guildId}
                    targets={relanceTargets}
                    channels={channels}
                    onClose={() => setRelanceTargets(null)}
                />
            )}
        </div>
    );
}

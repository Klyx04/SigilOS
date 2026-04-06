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
    Check
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
import { format } from "date-fns";
import { fr } from "date-fns/locale";
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
import { RelanceClient } from "@/components/admin/relance/relance-client";

interface Member {
    id: string;
    userId: string;
    status: "ACTIVE" | "ARCHIVED" | "BANNED";
    createdAt: string;
    updatedAt: string;
    archivedAt: string | null;
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
    initialHistory: any[];
    canManageMembers: boolean;
    canManageRelance: boolean;
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
                        className={`h-7 w-7 p-0 rounded-lg transition-all ${isSuccess ? 'text-emerald-500 bg-emerald-500/10' : 'text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10'}`}
                    >
                        {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : isSuccess ? <Check className="w-3 h-3" /> : <Send className="w-3 h-3" />}
                    </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-black border-white/10 text-[10px] font-black uppercase tracking-widest">
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
    initialHistory,
    canManageMembers,
    canManageRelance
}: MemberManagementProps) {
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState(() => {
        if (!canManageMembers && canManageRelance) return "relances";
        return "audit";
    });
    const [data, setData] = useState<{
        members: MemberReconciliationData[];
        stats: RoleStats[];
        authorizedRoles: string[];
    } | null>(null);

    const [memberList, setMemberList] = useState({
        members: initialMembers.members,
        ownerId: initialMembers.ownerId
    });

    // Filters for Audit Tab
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [joinedFilter, setJoinedFilter] = useState<string>("all");
    const [actionFilter, setActionFilter] = useState<string>("all");
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'joinedAt', direction: 'desc' });

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

    return (
        <div className="relative min-h-[800px] space-y-8 pb-20">
            {/* Background Decorative Elements */}
            <div className="absolute inset-0 -z-10 bg-[#030303] overflow-hidden pointer-events-none rounded-3xl">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-600/10 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-indigo-600/10 blur-[100px] rounded-full" />
                <div className="absolute top-[20%] right-[10%] w-[20%] h-[20%] bg-emerald-600/5 blur-[80px] rounded-full" />
            </div>

            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 px-2">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-violet-600/20 border border-violet-500/30 rounded-2xl backdrop-blur-xl shadow-lg shadow-violet-500/10">
                            <Users className="w-8 h-8 text-violet-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl lg:text-5xl font-black tracking-tight text-white italic uppercase leading-none">
                                Gestion <span className="text-violet-500">Membres</span>
                            </h1>
                            <p className="text-zinc-500 font-black mt-1.5 flex items-center gap-2 uppercase text-[10px] tracking-[0.2em] italic">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
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
                        className="bg-zinc-900/60 border-white/10 hover:bg-zinc-800 hover:border-violet-500/30 transition-all rounded-2xl px-6 h-12 backdrop-blur-xl group text-[10px] font-black uppercase tracking-widest"
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
                        { label: "Total Discord", value: data?.members.length || "...", sub: "Membres humains détectés", icon: Users, color: "blue" },
                        { label: "Inscrits Dashboard", value: data?.members.filter(m => m.hasDashboardProfile).length || 0, sub: `${data ? Math.round((data.members.filter(m => m.hasDashboardProfile).length / data.members.length) * 100) : 0}% de couverture`, icon: CheckCircle2, color: "emerald", progress: true },
                        { label: "Manquants Dashboard", value: missingMebersCount, sub: "Membres à inviter sur le site", icon: ShieldAlert, color: "amber" },
                        { label: "Rôles Actifs", value: data?.stats.length || 0, sub: "Rôles mappés sur le Dashboard", icon: Trophy, color: "purple" }
                    ].map((stat, i) => (
                        <Card key={i} className="bg-zinc-900/30 border-white/5 backdrop-blur-xl rounded-2xl shadow-2xl relative overflow-hidden group">
                            <div className={`absolute top-0 right-0 w-24 h-24 bg-${stat.color}-500/10 blur-[40px] rounded-full translate-x-12 -translate-y-12`} />
                            <CardHeader className="pb-3">
                                <CardDescription className={`flex items-center gap-2 text-${stat.color}-400 font-bold uppercase text-[10px] tracking-[0.2em]`}>
                                    <stat.icon className="w-3 h-3" />
                                    {stat.label}
                                </CardDescription>
                                <CardTitle className="text-4xl font-black text-white">{stat.value}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {stat.progress ? (
                                    <div className="space-y-1.5">
                                        <Progress 
                                            value={data ? (data.members.filter(m => m.hasDashboardProfile).length / data.members.length) * 100 : 0} 
                                            className="h-1.5 bg-white/5"
                                            indicatorClassName={`bg-${stat.color}-500`}
                                        />
                                        <p className={`text-[10px] text-${stat.color}-500/70 font-black uppercase tracking-widest`}>{stat.sub}</p>
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight">{stat.sub}</p>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                {/* Tabs with scroll on mobile */}
                <div className="overflow-x-auto no-scrollbar -mx-2 px-2">
                    <TabsList className="bg-zinc-900/50 p-1.5 rounded-[22px] border border-white/5 backdrop-blur-xl w-fit flex-nowrap whitespace-nowrap">
                    {[
                        { id: "audit", label: "Audit & Sync", icon: ShieldCheck, requiresFull: true },
                        { id: "management", label: "Roster & Historique", icon: UserCircle, requiresFull: true },
                        { id: "relances", label: "Relances Discord", icon: Bell, requiresFull: false },
                    ].map(tab => {
                        const isDisabled = tab.requiresFull && !canManageMembers;
                        
                        return (
                            <TooltipProvider key={tab.id}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="inline-block">
                                            <TabsTrigger 
                                                value={tab.id} 
                                                disabled={isDisabled}
                                                className={`rounded-[16px] px-6 py-2.5 data-[state=active]:bg-violet-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-violet-600/20 data-[state=active]:border-t data-[state=active]:border-white/20 transition-all text-[11px] font-black uppercase tracking-[0.15em] gap-2.5 ${isDisabled ? 'opacity-40 cursor-not-allowed saturate-0' : ''}`}
                                            >
                                                {isDisabled ? <ShieldAlert className="w-4 h-4 text-zinc-500" /> : <tab.icon className="w-4 h-4" />}
                                                {tab.label}
                                            </TabsTrigger>
                                        </div>
                                    </TooltipTrigger>
                                    {isDisabled && (
                                        <TooltipContent className="bg-zinc-900 border-white/10 text-[10px] font-black uppercase tracking-widest text-amber-500">
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
                <TabsContent value="audit" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="space-y-8">
                        <div className="space-y-4">
                            {/* Filter Bar */}
                            <div className="flex flex-col md:flex-row gap-4 p-4 bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl shadow-xl">
                                <div className="relative flex-1 group">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-violet-400 transition-colors" />
                                    <Input 
                                        placeholder="Rechercher par pseudo ou ID..." 
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="pl-12 h-12 bg-black/40 border-white/5 text-white rounded-2xl focus:ring-violet-500/20 focus:border-violet-500/50 transition-all placeholder:text-zinc-600 font-medium"
                                    />
                                </div>
                                <div className="overflow-x-auto no-scrollbar -mx-4 px-4">
                                    <div className="flex gap-2 min-w-max pb-2">
                                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                                        <SelectTrigger className="w-[200px] h-12 bg-black/40 border-white/5 rounded-2xl text-xs font-black text-zinc-300 uppercase tracking-widest">
                                            <SelectValue placeholder="Tous les rôles" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-zinc-950 border-white/10 rounded-2xl">
                                            <SelectItem value="all" className="uppercase text-[10px] font-black tracking-widest">Tous les rôles</SelectItem>
                                            {data?.stats.map(s => (
                                                <SelectItem key={s.roleId} value={s.roleId} className="text-[10px] font-black uppercase tracking-widest">
                                                    {s.roleName}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                                        <SelectTrigger className="w-[140px] h-12 bg-black/40 border-white/5 rounded-2xl text-[10px] font-black text-zinc-300 uppercase tracking-widest">
                                            <SelectValue placeholder="Dashboard" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-zinc-950 border-white/10 rounded-2xl">
                                            <SelectItem value="all" className="uppercase text-[10px] font-black tracking-widest text">Tous</SelectItem>
                                            <SelectItem value="dashboard" className="uppercase text-[10px] font-black tracking-widest">Inscrits</SelectItem>
                                            <SelectItem value="missing" className="uppercase text-[10px] font-black tracking-widest">Absents</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    <Select value={joinedFilter} onValueChange={setJoinedFilter}>
                                        <SelectTrigger className="w-[150px] h-12 bg-black/40 border-white/5 rounded-2xl text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-3.5 h-3.5 text-violet-400" />
                                                <SelectValue placeholder="Rejoint le" />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent className="bg-zinc-950 border-white/10 rounded-2xl">
                                            <SelectItem value="all" className="uppercase text-[10px] font-black tracking-widest">Tout temps</SelectItem>
                                            <SelectItem value="week" className="uppercase text-[10px] font-black tracking-widest">{"< 1 semaine"}</SelectItem>
                                            <SelectItem value="month" className="uppercase text-[10px] font-black tracking-widest">{"< 1 mois"}</SelectItem>
                                            <SelectItem value="old" className="uppercase text-[10px] font-black tracking-widest">{"> 6 mois"}</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    <Select value={actionFilter} onValueChange={setActionFilter}>
                                        <SelectTrigger className="w-[140px] h-12 bg-black/40 border-white/5 rounded-2xl text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                            <SelectValue placeholder="Actions" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-zinc-950 border-white/10 rounded-2xl">
                                            <SelectItem value="all" className="uppercase text-[10px] font-black tracking-widest">Toutes</SelectItem>
                                            <SelectItem value="relancer" className="uppercase text-[10px] font-black tracking-widest text">À relancer</SelectItem>
                                            <SelectItem value="voir" className="uppercase text-[10px] font-black tracking-widest text">À voir</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    </div>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="rounded-[32px] border border-white/10 bg-zinc-900/40 backdrop-blur-2xl overflow-x-auto no-scrollbar shadow-2xl relative group">
                                <Table className="min-w-[800px] lg:min-w-0">
                                    <TableHeader className="bg-white/[0.02] border-b border-white/5">
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="pl-8 py-6 text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em]">
                                                <button onClick={() => toggleSort('displayName')} className="flex items-center gap-2 hover:text-white transition-colors">
                                                    Membre Discord
                                                    <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === 'displayName' ? 'text-violet-400' : ''}`} />
                                                </button>
                                            </TableHead>
                                            <TableHead className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] py-6">Rôles Discord</TableHead>
                                            <TableHead className="py-6 text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em]">
                                                <button onClick={() => toggleSort('joinedAt')} className="flex items-center gap-2 hover:text-white transition-colors">
                                                    Arrivée
                                                    <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === 'joinedAt' ? 'text-violet-400' : ''}`} />
                                                </button>
                                            </TableHead>
                                            <TableHead className="py-6 text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em]">
                                                <button onClick={() => toggleSort('hasDashboardProfile')} className="flex items-center gap-2 hover:text-white transition-colors">
                                                    Status
                                                    <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === 'hasDashboardProfile' ? 'text-violet-400' : ''}`} />
                                                </button>
                                            </TableHead>
                                            <TableHead className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] pr-8 text-right py-6">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-96 text-center">
                                                    <div className="flex flex-col items-center gap-6">
                                                        <div className="relative">
                                                            <RefreshCw className="w-12 h-12 text-violet-500 animate-spin" />
                                                            <div className="absolute inset-0 blur-xl bg-violet-500/20 animate-pulse" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <span className="text-sm font-black uppercase tracking-[0.3em] text-white">Calcul du différentiel</span>
                                                            <p className="text-xs text-zinc-500">Récupération des profils Discord autorisés...</p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredAuditMembers.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-48 text-center">
                                                    <div className="flex flex-col items-center gap-2 opacity-40">
                                                        <Search className="w-8 h-8 text-zinc-500 mb-2" />
                                                        <p className="text-sm font-bold text-zinc-400 uppercase italic">Aucun membre autorisé trouvé</p>
                                                        <p className="text-xs text-zinc-600">Vérifiez vos filtres ou la configuration des rôles.</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredAuditMembers.map(member => (
                                                <TableRow key={member.discordId} className="group border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                                                    <TableCell className="pl-8 py-5">
                                                        <div className="flex items-center gap-4">
                                                            <div className="relative">
                                                                <div className="w-12 h-12 rounded-2xl bg-zinc-800 border border-white/5 flex items-center justify-center font-black text-lg text-zinc-400 group-hover:border-violet-500/50 transition-all uppercase italic rotate-3 group-hover:rotate-0">
                                                                    {member.displayName.charAt(0)}
                                                                </div>
                                                                <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-lg border-2 border-[#030303] flex items-center justify-center shadow-lg ${member.hasDashboardProfile ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}>
                                                                    {member.hasDashboardProfile ? <CheckCircle2 className="w-3 h-3 text-white" /> : <ShieldAlert className="w-3 h-3 text-white" />}
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col leading-tight">
                                                                <span className="font-black text-base text-zinc-200 group-hover:text-white transition-colors">{member.displayName}</span>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">@{member.username}</span>
                                                                    {member.ankamaId && (
                                                                        <span className="text-[9px] text-violet-400 font-black tracking-tight uppercase px-1.5 py-0.5 rounded bg-violet-600/10 border border-violet-500/20">{member.ankamaId}</span>
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
                                                                        className="text-[9px] h-5 font-black border-white/10 uppercase tracking-[0.1em] rounded-md px-1.5 backdrop-blur-md"
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
                                                                <Badge variant="outline" className="text-[9px] h-5 font-black border-white/5 text-zinc-400 bg-white/5 uppercase tracking-tighter">
                                                                    +{member.roles.length - 2}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-xs font-medium text-zinc-400 tabular-nums">
                                                        {member.joinedAt ? format(new Date(member.joinedAt), "dd MMM yyyy", { locale: fr }) : "Inconnu"}
                                                    </TableCell>
                                                    <TableCell>
                                                        {member.hasDashboardProfile ? (
                                                            <div className="flex items-center gap-1.5 text-emerald-400 font-black text-[10px] uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded-lg w-fit">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                                Inscrit
                             </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5 text-amber-500 font-black text-[10px] uppercase tracking-widest bg-amber-500/10 px-2 py-1 rounded-lg w-fit">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                                                Absent
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="pr-8 text-right">
                                                        {member.hasDashboardProfile ? (
                                                            <Button variant="outline" size="sm" className="h-9 rounded-xl border-white/5 bg-white/5 hover:bg-violet-600 hover:text-white hover:border-violet-500 transition-all text-[10px] font-black uppercase tracking-widest p-0 w-9" asChild>
                                                                <a href={`/dashboard/${guildId}/members/${member.profileId}`} target="_blank">
                                                                    <ArrowUpRight className="w-4 h-4" />
                                                                </a>
                                                            </Button>
                                                        ) : (
                                                            <div className="w-9 h-9" /> // Placeholder pour garder l'alignement
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Bottom Utility Cards */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Embedded Sync Card */}
                            <Card className="bg-zinc-900/40 backdrop-blur-xl border-indigo-500/20 rounded-[32px] overflow-hidden shadow-2xl relative group">
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <CardHeader className="bg-white/[0.03] py-5 border-b border-indigo-500/10 px-6 relative z-10">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-xl bg-indigo-600/20 flex items-center justify-center">
                                            <RefreshCw className="w-4 h-4 text-indigo-400" />
                                        </div>
                                        <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-white italic">Outils & Sync</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6 space-y-4 relative z-10">
                                    <MemberSyncButton guildId={guildId} />
                                    <DailyReportButton guildId={guildId} />
                                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                        <span className="text-[10px] font-black uppercase text-zinc-600 tracking-widest">Planification</span>
                                        <Badge variant="outline" className="text-[9px] bg-zinc-800 border-none font-black text-indigo-400">HEBDOMADAIRE LUNDI 04:00 AM</Badge>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-zinc-900/40 backdrop-blur-xl border-white/10 rounded-[32px] overflow-hidden shadow-2xl">
                                <CardHeader className="bg-white/[0.03] py-5 border-b border-white/5 px-6">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-xl bg-emerald-600/20 flex items-center justify-center">
                                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                                        </div>
                                        <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-white italic">Audit & Rôles</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6 space-y-6">
                                    {data?.stats.length === 0 ? (
                                        <div className="text-center py-6 space-y-2">
                                            <Settings2 className="w-8 h-8 text-zinc-600 mx-auto" />
                                            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Aucun rôle mappé</p>
                                            <p className="text-[10px] text-zinc-600 leading-relaxed italic">Configurez les rôles dans Paramètres {">"} Rôles pour activer l&apos;audit.</p>
                                        </div>
                                    ) : (
                                        data?.stats.map(s => {
                                            const percent = s.totalDiscord > 0 ? (s.totalDashboard / s.totalDiscord) * 100 : 0;
                                            return (
                                                <div key={s.roleId} className="space-y-3 group/role cursor-default">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2 max-w-[200px]">
                                                            <div 
                                                                className="w-1.5 h-1.5 rounded-full shrink-0 shadow-lg"
                                                                style={{ backgroundColor: s.roleColor ? `#${s.roleColor.toString(16).padStart(6, '0')}` : '#71717a' }}
                                                            />
                                                            <span className="text-xs font-black text-zinc-300 truncate group-hover/role:text-white transition-colors">{s.roleName}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-black text-zinc-500 bg-white/5 px-2 py-0.5 rounded-lg tabular-nums">
                                                                {s.totalDashboard}/{s.totalDiscord}
                                                            </span>
                                                            <ManualAuditButton guildId={guildId} roleId={s.roleId} />
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex-1 h-2 bg-black/60 rounded-full overflow-hidden border border-white/5 p-[1px]">
                                                            <div 
                                                                className={`h-full rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(0,0,0,0.5)] ${
                                                                    percent === 100 ? 'bg-emerald-500' : 
                                                                    percent > 70 ? 'bg-violet-500' : 
                                                                    percent > 30 ? 'bg-indigo-500' : 'bg-amber-600'
                                                                }`}
                                                                style={{ width: `${percent}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-[11px] font-black text-white w-8 text-right italic">{percent.toFixed(0)}%</span>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* --- TAB 2: MANAGEMENT --- */}
                <TabsContent value="management" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <MemberStatsOverview stats={initialStats} />
                    <div className="p-1 px-3 bg-zinc-900/40 border border-white/5 rounded-3xl backdrop-blur-xl overflow-hidden shadow-2xl">
                        <MemberManagementTable 
                            initialMembers={memberList.members}
                            guildId={guildId}
                            welcomeBadgeName={welcomeBadgeName}
                            isSuperAdmin={isSuperAdmin}
                            isAdmin={canManageMembers}
                            ownerId={memberList.ownerId}
                        />
                    </div>
                </TabsContent>

                {/* --- TAB 3: RELANCES --- */}
                <TabsContent value="relances" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-zinc-900/40 border border-white/5 rounded-3xl backdrop-blur-xl overflow-hidden shadow-2xl">
                        <RelanceClient 
                            guildId={guildId}
                            channels={channels}
                            roles={roles}
                            initialHistory={initialHistory}
                        />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}

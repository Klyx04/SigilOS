"use client";

import React, { useState, useTransition, useMemo } from "react";
import {
    Users,
    Clock,
    UserCheck,
    UserX,
    Shield,
    Sparkles,
    Search,
    Filter,
    Plus,
    CheckCircle2,
    Calendar,
    ChevronRight,
    Trophy,
    Award,
    Edit2,
    MoreVertical,
    FileSpreadsheet,
    Download,
    RefreshCw,
    AlertCircle,
    Info,
    Sliders,
    MessageSquare,
    Save,
    RotateCcw,
    Layers,
    Tag,
    UserPlus,
    X,
    ExternalLink
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    getGuildLifecycleData,
    updateMemberLifecycleStatus,
    validateMemberTrial,
    extendMemberTrial,
    recordMemberDeparture,
    reintegrateMember,
    updateMemberRecruiter,
    updateMemberAlts,
    updateMemberStaffNotes,
    updateGuildLifecycleConfig,
    type GuildLifecycleData,
    type LifecycleMemberSummary,
    type RecruiterLeaderboardEntry,
} from "@/server/actions/member-lifecycle-actions";

interface MemberLifecycleManagerProps {
    guildId: string;
    initialData: GuildLifecycleData;
    roles: Array<{ id: string; name: string; color: number }>;
    channels: Array<{ id: string; name: string; type: number }>;
    canManageMembers: boolean;
    isAdmin: boolean;
}

export function MemberLifecycleManager({
    guildId,
    initialData,
    roles,
    channels,
    canManageMembers,
    isAdmin,
}: MemberLifecycleManagerProps) {
    const [data, setData] = useState<GuildLifecycleData>(initialData);
    const [isPending, startTransition] = useTransition();

    // Filters & Search
    const [searchQuery, setSearchQuery] = useState("");
    const [recruiterFilter, setRecruiterFilter] = useState<string>("ALL");
    const [seniorityFilter, setSeniorityFilter] = useState<string>("ALL");
    const [departureFilter, setDepartureFilter] = useState<string>("ALL");

    // Dialog states
    const [selectedMember, setSelectedMember] = useState<LifecycleMemberSummary | null>(null);
    const [departureModalOpen, setDepartureModalOpen] = useState(false);
    const [departureReason, setDepartureReason] = useState("");
    const [departureCategory, setDepartureCategory] = useState<"VOLUNTARY" | "INACTIVITY" | "BEHAVIOR" | "OTHER">("INACTIVITY");
    const [isBanAction, setIsBanAction] = useState(false);

    const [altsModalOpen, setAltsModalOpen] = useState(false);
    const [tempAlts, setTempAlts] = useState<string[]>([]);
    const [newAltInput, setNewAltInput] = useState("");

    const [notesModalOpen, setNotesModalOpen] = useState(false);
    const [tempNotes, setTempNotes] = useState("");

    const [recruiterModalOpen, setRecruiterModalOpen] = useState(false);
    const [selectedRecruiterId, setSelectedRecruiterId] = useState<string>("");

    // Config form state
    const [configState, setConfigState] = useState(initialData.config);

    const refreshData = () => {
        startTransition(async () => {
            const res = await getGuildLifecycleData(guildId);
            if (res.success && res.data) {
                setData(res.data);
                setConfigState(res.data.config);
                toast.success("Données actualisées");
            } else {
                toast.error(res.error || "Erreur de rafraîchissement");
            }
        });
    };

    // Filtered Active Members
    const filteredMembers = useMemo(() => {
        return data.members.filter((m) => {
            const q = searchQuery.toLowerCase();
            const matchesSearch =
                m.displayName.toLowerCase().includes(q) ||
                (m.pseudoDofus && m.pseudoDofus.toLowerCase().includes(q)) ||
                (m.discordNickname && m.discordNickname.toLowerCase().includes(q)) ||
                (m.ankamaId && m.ankamaId.toLowerCase().includes(q)) ||
                m.mules.some((alt) => alt.pseudo.toLowerCase().includes(q));

            const matchesRecruiter =
                recruiterFilter === "ALL" || m.recruitedById === recruiterFilter;

            let matchesSeniority = true;
            if (seniorityFilter === "NEW") matchesSeniority = m.seniorityDays <= 30;
            else if (seniorityFilter === "REGULAR") matchesSeniority = m.seniorityDays > 30 && m.seniorityDays <= 180;
            else if (seniorityFilter === "VETERAN") matchesSeniority = m.seniorityDays > 180;

            return matchesSearch && matchesRecruiter && matchesSeniority;
        });
    }, [data.members, searchQuery, recruiterFilter, seniorityFilter]);

    // Filtered Departed Members
    const filteredDeparted = useMemo(() => {
        return data.departedMembers.filter((m) => {
            const q = searchQuery.toLowerCase();
            const matchesSearch =
                m.displayName.toLowerCase().includes(q) ||
                (m.departureReason && m.departureReason.toLowerCase().includes(q)) ||
                (m.recruiterName && m.recruiterName.toLowerCase().includes(q));

            const matchesCategory =
                departureFilter === "ALL" ||
                (departureFilter === "BANNED" && m.status === "BANNED") ||
                (departureFilter === "ARCHIVED" && m.status === "ARCHIVED") ||
                (departureFilter === m.departureCategory);

            return matchesSearch && matchesCategory;
        });
    }, [data.departedMembers, searchQuery, departureFilter]);

    // Actions
    const handleValidateTrial = (profileId: string) => {
        startTransition(async () => {
            const res = await validateMemberTrial(guildId, profileId);
            if (res.success) {
                toast.success(res.data?.message || "Essai validé !");
                refreshData();
            } else {
                toast.error(res.error || "Erreur");
            }
        });
    };

    const handleExtendTrial = (profileId: string) => {
        startTransition(async () => {
            const res = await extendMemberTrial(guildId, profileId, 7);
            if (res.success) {
                toast.success(res.data?.message || "Essai prolongé de 7 jours");
                refreshData();
            } else {
                toast.error(res.error || "Erreur");
            }
        });
    };

    const handleOpenDeparture = (member: LifecycleMemberSummary, isBan: boolean = false) => {
        setSelectedMember(member);
        setIsBanAction(isBan);
        setDepartureReason("");
        setDepartureCategory(isBan ? "BEHAVIOR" : "INACTIVITY");
        setDepartureModalOpen(true);
    };

    const handleConfirmDeparture = () => {
        if (!selectedMember) return;
        if (!departureReason.trim()) {
            toast.error("Veuillez renseigner un motif");
            return;
        }

        startTransition(async () => {
            const res = await recordMemberDeparture(guildId, {
                profileId: selectedMember.id,
                reason: departureReason.trim(),
                category: departureCategory,
                isBan: isBanAction,
            });

            if (res.success) {
                toast.success(res.data?.message || "Action enregistrée");
                setDepartureModalOpen(false);
                refreshData();
            } else {
                toast.error(res.error || "Erreur");
            }
        });
    };

    const handleReintegrate = (profileId: string) => {
        startTransition(async () => {
            const res = await reintegrateMember(guildId, profileId);
            if (res.success) {
                toast.success(res.data?.message || "Membre réintégré");
                refreshData();
            } else {
                toast.error(res.error || "Erreur");
            }
        });
    };

    const handleOpenAlts = (member: LifecycleMemberSummary) => {
        setSelectedMember(member);
        setTempAlts(member.mules.map((m) => m.pseudo));
        setNewAltInput("");
        setAltsModalOpen(true);
    };

    const handleSaveAlts = () => {
        if (!selectedMember) return;
        startTransition(async () => {
            const res = await updateMemberAlts(guildId, selectedMember.id, tempAlts);
            if (res.success) {
                toast.success("Mules mises à jour");
                setAltsModalOpen(false);
                refreshData();
            } else {
                toast.error(res.error || "Erreur");
            }
        });
    };

    const handleOpenNotes = (member: LifecycleMemberSummary) => {
        setSelectedMember(member);
        setTempNotes(member.staffNotes || "");
        setNotesModalOpen(true);
    };

    const handleSaveNotes = () => {
        if (!selectedMember) return;
        startTransition(async () => {
            const res = await updateMemberStaffNotes(guildId, selectedMember.id, tempNotes);
            if (res.success) {
                toast.success("Notes enregistrées");
                setNotesModalOpen(false);
                refreshData();
            } else {
                toast.error(res.error || "Erreur");
            }
        });
    };

    const handleOpenRecruiter = (member: LifecycleMemberSummary) => {
        setSelectedMember(member);
        setSelectedRecruiterId(member.recruitedById || "NONE");
        setRecruiterModalOpen(true);
    };

    const handleSaveRecruiter = () => {
        if (!selectedMember) return;
        const newRecruiterId = selectedRecruiterId === "NONE" ? null : selectedRecruiterId;
        startTransition(async () => {
            const res = await updateMemberRecruiter(guildId, selectedMember.id, newRecruiterId);
            if (res.success) {
                toast.success("Recruteur mis à jour");
                setRecruiterModalOpen(false);
                refreshData();
            } else {
                toast.error(res.error || "Erreur");
            }
        });
    };

    const handleSaveConfig = () => {
        startTransition(async () => {
            const res = await updateGuildLifecycleConfig(guildId, configState);
            if (res.success) {
                toast.success("Paramètres enregistrés !");
                refreshData();
            } else {
                toast.error(res.error || "Erreur");
            }
        });
    };

    // Export CSV
    const handleExportCSV = () => {
        const headers = [
            "Pseudo Dofus",
            "Surnom Discord",
            "Tag Ankama",
            "Date d'arrivée",
            "Ancienneté (jours)",
            "Statut",
            "Période d'essai",
            "Recruté par",
            "Nombre de mules",
            "Mules",
            "Notes Staff",
        ];

        const rows = data.members.map((m) => [
            `"${m.pseudoDofus || ""}"`,
            `"${m.discordNickname || ""}"`,
            `"${m.ankamaId || ""}"`,
            `"${m.joinedAt.split("T")[0]}"`,
            m.seniorityDays,
            m.lifecycleStatus,
            m.trialRemainingDays !== null ? `${m.trialRemainingDays}j restants` : "Confirmé",
            `"${m.recruiterName || "Non spécifié"}"`,
            m.muleCount,
            `"${m.mules.map((alt) => alt.pseudo).join(", ")}"`,
            `"${(m.staffNotes || "").replace(/"/g, '""')}"`,
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(";"), ...rows.map((e) => e.join(";"))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `sigilos_membres_${guildId}_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Export CSV téléchargé");
    };

    const mulePercentage = configState.muleLimitEnabled && configState.maxGuildMules > 0
        ? Math.min(100, Math.round((data.totalMulesCount / configState.maxGuildMules) * 100))
        : 0;

    return (
        <div className="space-y-6">
            {/* Top Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-surface/50 backdrop-blur-sm border-border hover:border-primary/40 transition-all shadow-sm">
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Membres Actifs</span>
                        <div className="p-2 rounded-xl bg-primary/10 text-primary">
                            <Users className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-black">{data.totalActiveCount}</div>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <span className="text-success font-semibold">100%</span> synchronisés
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-surface/50 backdrop-blur-sm border-border hover:border-warning/40 transition-all shadow-sm">
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">En Période d&apos;Essai</span>
                        <div className="p-2 rounded-xl bg-warning/10 text-warning">
                            <Clock className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-black text-warning">{data.totalTrialCount}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {data.config.trialEnabled ? `${data.config.trialDurationDays} jours par défaut` : "Essai désactivé"}
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-surface/50 backdrop-blur-sm border-border hover:border-info/40 transition-all shadow-sm">
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mules de Guilde</span>
                        <div className="p-2 rounded-xl bg-info/10 text-info">
                            <Layers className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="flex items-baseline justify-between">
                            <span className="text-2xl font-black">{data.totalMulesCount}</span>
                            {configState.muleLimitEnabled && (
                                <span className="text-xs text-muted-foreground">
                                    / {configState.maxGuildMules} max ({data.mulesAvailableCount ?? 0} libres)
                                </span>
                            )}
                        </div>
                        {configState.muleLimitEnabled ? (
                            <div className="mt-2 space-y-1">
                                <Progress value={mulePercentage} className="h-1.5" />
                                <div className="text-[10px] text-muted-foreground text-right">{mulePercentage}% du quota</div>
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground mt-1">Quota illimité</p>
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-surface/50 backdrop-blur-sm border-border hover:border-destructive/40 transition-all shadow-sm">
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Historique & Départs</span>
                        <div className="p-2 rounded-xl bg-destructive/10 text-destructive">
                            <UserX className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-black">{data.totalDepartedCount}</div>
                        <p className="text-xs text-muted-foreground mt-1">Archivés avec motif</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Tabs Navigation */}
            <Tabs defaultValue="directory" className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-3">
                    <TabsList className="bg-surface/60 border border-border p-1 rounded-xl">
                        <TabsTrigger value="directory" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs font-semibold">
                            <Users className="h-3.5 w-3.5 mr-1.5" />
                            Annuaire Actif ({data.totalActiveCount})
                        </TabsTrigger>
                        <TabsTrigger value="trial" className="rounded-lg data-[state=active]:bg-warning data-[state=active]:text-warning-foreground text-xs font-semibold">
                            <Clock className="h-3.5 w-3.5 mr-1.5" />
                            Période d&apos;Essai ({data.totalTrialCount})
                        </TabsTrigger>
                        <TabsTrigger value="mules" className="rounded-lg data-[state=active]:bg-info data-[state=active]:text-info-foreground text-xs font-semibold">
                            <Layers className="h-3.5 w-3.5 mr-1.5" />
                            Mules & Alts ({data.totalMulesCount})
                        </TabsTrigger>
                        <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground text-xs font-semibold">
                            <UserX className="h-3.5 w-3.5 mr-1.5" />
                            Départs & Bans ({data.totalDepartedCount})
                        </TabsTrigger>
                        {isAdmin && (
                            <TabsTrigger value="settings" className="rounded-lg data-[state=active]:bg-secondary text-xs font-semibold">
                                <Sliders className="h-3.5 w-3.5 mr-1.5" />
                                Paramètres
                            </TabsTrigger>
                        )}
                    </TabsList>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={refreshData}
                            disabled={isPending}
                            className="h-8 text-xs rounded-lg"
                        >
                            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isPending && "animate-spin")} />
                            Actualiser
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExportCSV}
                            className="h-8 text-xs rounded-lg"
                        >
                            <Download className="h-3.5 w-3.5 mr-1.5" />
                            Export Excel/CSV
                        </Button>
                    </div>
                </div>

                {/* ════════════════════════════════════════════════════════════
                    ONGLET 1 : ANNUAIRE ACTIF
                ════════════════════════════════════════════════════════════ */}
                <TabsContent value="directory" className="space-y-4">
                    {/* Search & Filter Bar */}
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <div className="relative flex-1 w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Rechercher par pseudo Dofus, Discord, Tag Ankama ou mule..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-9 text-xs bg-surface/50"
                            />
                        </div>

                        <Select value={recruiterFilter} onValueChange={setRecruiterFilter}>
                            <SelectTrigger className="w-[180px] h-9 text-xs">
                                <SelectValue placeholder="Recruteur" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Tous les recruteurs</SelectItem>
                                {data.recruiterLeaderboard.map((r) => (
                                    <SelectItem key={r.recruiterId} value={r.recruiterId}>
                                        {r.recruiterName} ({r.totalRecruits})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={seniorityFilter} onValueChange={setSeniorityFilter}>
                            <SelectTrigger className="w-[160px] h-9 text-xs">
                                <SelectValue placeholder="Ancienneté" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Toute ancienneté</SelectItem>
                                <SelectItem value="NEW">Nouveaux (≤ 30j)</SelectItem>
                                <SelectItem value="REGULAR">Habitués (30j - 180j)</SelectItem>
                                <SelectItem value="VETERAN">Vétérans (&gt; 180j)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Table View */}
                    <div className="border border-border rounded-xl bg-surface/40 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left border-collapse">
                                <thead>
                                    <tr className="bg-surface/80 border-b border-border text-muted-foreground font-semibold">
                                        <th className="py-3 px-4">Membre & Discord</th>
                                        <th className="py-3 px-4">Tag Ankama</th>
                                        <th className="py-3 px-4">Date d&apos;arrivée</th>
                                        <th className="py-3 px-4">Ancienneté</th>
                                        <th className="py-3 px-4">Statut</th>
                                        <th className="py-3 px-4">Mules ({data.totalMulesCount})</th>
                                        <th className="py-3 px-4">Recruté par</th>
                                        <th className="py-3 px-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {filteredMembers.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="py-8 text-center text-muted-foreground">
                                                Aucun membre ne correspond à vos critères.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredMembers.map((m) => (
                                            <tr key={m.id} className="hover:bg-surface/70 transition-colors">
                                                {/* Member identity */}
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-2.5">
                                                        <Avatar className="h-8 w-8 border border-border/80">
                                                            <AvatarImage src={m.avatar || undefined} />
                                                            <AvatarFallback className="text-[10px] font-bold">
                                                                {m.displayName.slice(0, 2).toUpperCase()}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <div className="font-bold text-foreground flex items-center gap-1.5">
                                                                <span>{m.pseudoDofus || m.displayName}</span>
                                                                {m.pseudoDofus && (
                                                                    <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono border-primary/30 text-primary">
                                                                        Ladder
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            {m.discordNickname && m.discordNickname !== m.pseudoDofus && (
                                                                <div className="text-[10px] text-muted-foreground">
                                                                    Discord: {m.discordNickname}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Ankama Tag */}
                                                <td className="py-3 px-4">
                                                    {m.ankamaId ? (
                                                        <span className="font-mono text-muted-foreground bg-surface/80 px-2 py-0.5 rounded border border-border text-[11px]">
                                                            {m.ankamaId}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground/50 italic text-[10px]">Non renseigné</span>
                                                    )}
                                                </td>

                                                {/* Arrival Date */}
                                                <td className="py-3 px-4 text-muted-foreground">
                                                    {new Date(m.joinedAt).toLocaleDateString("fr-FR")}
                                                </td>

                                                {/* Seniority */}
                                                <td className="py-3 px-4">
                                                    <Badge
                                                        variant="secondary"
                                                        className={cn(
                                                            "font-mono text-[10px] font-bold",
                                                            m.seniorityDays >= 365 && "bg-amber-500/10 text-amber-500 border-amber-500/30",
                                                            m.seniorityDays >= 90 && m.seniorityDays < 365 && "bg-info/10 text-info border-info/30",
                                                            m.seniorityDays < 90 && "bg-muted text-muted-foreground"
                                                        )}
                                                    >
                                                        {m.seniorityDays} jours
                                                    </Badge>
                                                </td>

                                                {/* Lifecycle Status */}
                                                <td className="py-3 px-4">
                                                    {m.lifecycleStatus === "TRIAL" ? (
                                                        <Badge className="bg-warning/20 text-warning border-warning/40 text-[10px] hover:bg-warning/30">
                                                            Essai ({m.trialRemainingDays !== null ? `${m.trialRemainingDays}j` : "En cours"})
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-[10px]">
                                                            Confirmé
                                                        </Badge>
                                                    )}
                                                </td>

                                                {/* Mules */}
                                                <td className="py-3 px-4">
                                                    {m.muleCount > 0 ? (
                                                        <div className="flex items-center gap-1">
                                                            <Badge
                                                                variant="outline"
                                                                className="cursor-pointer hover:bg-info/20 text-info border-info/40 text-[10px]"
                                                                onClick={() => handleOpenAlts(m)}
                                                            >
                                                                {m.muleCount} mule{m.muleCount > 1 ? "s" : ""}
                                                            </Badge>
                                                        </div>
                                                    ) : (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleOpenAlts(m)}
                                                            className="h-6 text-[10px] text-muted-foreground hover:text-foreground px-1.5"
                                                        >
                                                            + Ajouter
                                                        </Button>
                                                    )}
                                                </td>

                                                {/* Recruiter */}
                                                <td className="py-3 px-4">
                                                    {m.recruiterName ? (
                                                        <button
                                                            onClick={() => handleOpenRecruiter(m)}
                                                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors text-left"
                                                        >
                                                            <Avatar className="h-4 w-4">
                                                                <AvatarImage src={m.recruiterAvatar || undefined} />
                                                                <AvatarFallback className="text-[8px]">
                                                                    {m.recruiterName.slice(0, 1)}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <span className="truncate max-w-[100px]">{m.recruiterName}</span>
                                                        </button>
                                                    ) : (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleOpenRecruiter(m)}
                                                            className="h-6 text-[10px] text-muted-foreground/60 px-1"
                                                        >
                                                            Non défini
                                                        </Button>
                                                    )}
                                                </td>

                                                {/* Actions */}
                                                <td className="py-3 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => handleOpenNotes(m)}
                                                                        className={cn("h-7 w-7", m.staffNotes ? "text-primary" : "text-muted-foreground")}
                                                                    >
                                                                        <MessageSquare className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    {m.staffNotes ? `Notes: ${m.staffNotes}` : "Ajouter une note staff"}
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>

                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => handleOpenDeparture(m, false)}
                                                                        className="h-7 w-7 text-muted-foreground hover:text-warning"
                                                                    >
                                                                        <UserX className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>Enregistrer un départ</TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>

                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => handleOpenDeparture(m, true)}
                                                                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                                    >
                                                                        <Shield className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>Bannir / Exclure avec motif</TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </TabsContent>

                {/* ════════════════════════════════════════════════════════════
                    ONGLET 2 : PÉRIODE D'ESSAI & RECRUTEMENT
                ════════════════════════════════════════════════════════════ */}
                <TabsContent value="trial" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* List of trial members */}
                        <div className="lg:col-span-2 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-warning" />
                                        Membres actuellement en période d&apos;essai ({data.trialMembers.length})
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Suivi des échéances et validation en 1 clic.
                                    </p>
                                </div>
                            </div>

                            {data.trialMembers.length === 0 ? (
                                <Card className="p-8 text-center bg-surface/30 border-dashed">
                                    <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-2 opacity-80" />
                                    <h4 className="text-sm font-bold text-foreground">Aucun membre en période d&apos;essai</h4>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Tous les membres actuels de la guilde sont confirmés !
                                    </p>
                                </Card>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {data.trialMembers.map((m) => {
                                        const isUrgent = m.trialRemainingDays !== null && m.trialRemainingDays <= 2;
                                        const isExpired = m.trialRemainingDays !== null && m.trialRemainingDays <= 0;

                                        return (
                                            <Card
                                                key={m.id}
                                                className={cn(
                                                    "p-4 bg-surface/50 border transition-all space-y-3",
                                                    isExpired && "border-destructive/60 bg-destructive/5",
                                                    isUrgent && !isExpired && "border-warning/60 bg-warning/5"
                                                )}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-center gap-2.5">
                                                        <Avatar className="h-9 w-9">
                                                            <AvatarImage src={m.avatar || undefined} />
                                                            <AvatarFallback>{m.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <div className="font-bold text-sm text-foreground">{m.displayName}</div>
                                                            <div className="text-[11px] text-muted-foreground">
                                                                Arrivé le {new Date(m.joinedAt).toLocaleDateString("fr-FR")}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <Badge
                                                        className={cn(
                                                            "text-[10px] font-bold",
                                                            isExpired && "bg-destructive text-destructive-foreground",
                                                            isUrgent && !isExpired && "bg-warning text-warning-foreground",
                                                            !isUrgent && !isExpired && "bg-secondary text-secondary-foreground"
                                                        )}
                                                    >
                                                        {isExpired ? "Expiré !" : `${m.trialRemainingDays}j restants`}
                                                    </Badge>
                                                </div>

                                                <div className="text-xs text-muted-foreground space-y-1 bg-surface/60 p-2.5 rounded-lg border border-border/50">
                                                    <div className="flex justify-between">
                                                        <span>Recruté par :</span>
                                                        <span className="font-semibold text-foreground">{m.recruiterName || "Non spécifié"}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Mules déclarées :</span>
                                                        <span className="font-semibold text-foreground">{m.muleCount}</span>
                                                    </div>
                                                    {m.staffNotes && (
                                                        <div className="pt-1 text-[11px] border-t border-border/50 text-foreground italic">
                                                            « {m.staffNotes} »
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-1.5 pt-1">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleValidateTrial(m.id)}
                                                        disabled={isPending}
                                                        className="flex-1 h-8 text-xs bg-success hover:bg-success/90 text-white"
                                                    >
                                                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                                        Valider
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleExtendTrial(m.id)}
                                                        disabled={isPending}
                                                        className="h-8 text-xs"
                                                    >
                                                        +7j
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleOpenDeparture(m, false)}
                                                        disabled={isPending}
                                                        className="h-8 text-xs text-destructive hover:bg-destructive/10"
                                                    >
                                                        Fin
                                                    </Button>
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Recruiter Leaderboard Widget */}
                        <div className="space-y-4">
                            <Card className="p-4 bg-surface/50 border-border">
                                <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                                            <Trophy className="h-4 w-4 text-amber-500" />
                                            Leaderboard des Recruteurs
                                        </CardTitle>
                                        <CardDescription className="text-xs mt-0.5">
                                            Top staff & taux de rétention
                                        </CardDescription>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0 space-y-3">
                                    {data.recruiterLeaderboard.length === 0 ? (
                                        <div className="text-xs text-muted-foreground py-4 text-center">
                                            Aucun recrutement enregistré pour l&apos;instant.
                                        </div>
                                    ) : (
                                        data.recruiterLeaderboard.map((r, index) => (
                                            <div
                                                key={r.recruiterId}
                                                className="flex items-center justify-between p-2 rounded-lg bg-surface/70 border border-border/40 text-xs"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <div className="font-bold text-xs w-4 text-center">
                                                        {index === 0 && "🥇"}
                                                        {index === 1 && "🥈"}
                                                        {index === 2 && "🥉"}
                                                        {index > 2 && `${index + 1}.`}
                                                    </div>
                                                    <Avatar className="h-6 w-6">
                                                        <AvatarImage src={r.recruiterAvatar || undefined} />
                                                        <AvatarFallback className="text-[9px]">
                                                            {r.recruiterName.slice(0, 1)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div className="font-bold text-foreground">{r.recruiterName}</div>
                                                        <div className="text-[10px] text-muted-foreground">
                                                            {r.confirmedRecruits} validés / {r.totalRecruits} total
                                                        </div>
                                                    </div>
                                                </div>

                                                <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                                                    {r.totalRecruits} recrues
                                                </Badge>
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* ════════════════════════════════════════════════════════════
                    ONGLET 3 : MULES & ALTS
                ════════════════════════════════════════════════════════════ */}
                <TabsContent value="mules" className="space-y-4">
                    {/* Header with quota progress */}
                    <Card className="p-4 bg-surface/50 border-border">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                    <Layers className="h-4 w-4 text-info" />
                                    Gestion des Mules & Personnages Secondaires
                                </h3>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Les mules sont déclarées par les joueurs sur leur profil ou éditables par le staff ici.
                                </p>
                            </div>

                            {configState.muleLimitEnabled && (
                                <div className="flex items-center gap-3">
                                    <div className="text-right">
                                        <div className="text-sm font-black text-foreground">
                                            {data.totalMulesCount} / {configState.maxGuildMules} mules
                                        </div>
                                        <div className="text-[11px] text-muted-foreground">
                                            {data.mulesAvailableCount} places disponibles
                                        </div>
                                    </div>
                                    <div className="w-24">
                                        <Progress value={mulePercentage} className="h-2" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Mules List */}
                    <div className="border border-border rounded-xl bg-surface/40 overflow-hidden">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead>
                                <tr className="bg-surface/80 border-b border-border text-muted-foreground font-semibold">
                                    <th className="py-3 px-4">Membre Principal</th>
                                    <th className="py-3 px-4">Nombre de mules</th>
                                    <th className="py-3 px-4">Liste des Personnages Secondaires (Mules)</th>
                                    <th className="py-3 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                                {data.members
                                    .filter((m) => m.muleCount > 0)
                                    .map((m) => (
                                        <tr key={m.id} className="hover:bg-surface/70 transition-colors">
                                            <td className="py-3 px-4 font-bold text-foreground">
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-6 w-6">
                                                        <AvatarImage src={m.avatar || undefined} />
                                                        <AvatarFallback className="text-[9px]">{m.displayName.slice(0, 2)}</AvatarFallback>
                                                    </Avatar>
                                                    <span>{m.displayName}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 font-mono font-bold text-info">
                                                {m.muleCount}
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {m.mules.map((alt, idx) => (
                                                        <Badge
                                                            key={idx}
                                                            variant="secondary"
                                                            className="text-[11px] font-mono py-0.5 px-2 bg-surface/80 border border-border"
                                                        >
                                                            {alt.pseudo}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleOpenAlts(m)}
                                                    className="h-7 text-xs"
                                                >
                                                    <Edit2 className="h-3 w-3 mr-1" />
                                                    Modifier
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </TabsContent>

                {/* ════════════════════════════════════════════════════════════
                    ONGLET 4 : HISTORIQUE & DÉPARTS
                ════════════════════════════════════════════════════════════ */}
                <TabsContent value="history" className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <div className="relative flex-1 w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Rechercher dans l'historique par pseudo ou motif..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-9 text-xs bg-surface/50"
                            />
                        </div>

                        <Select value={departureFilter} onValueChange={setDepartureFilter}>
                            <SelectTrigger className="w-[180px] h-9 text-xs">
                                <SelectValue placeholder="Catégorie" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Tous les départs</SelectItem>
                                <SelectItem value="BANNED">Bannis / Exclus</SelectItem>
                                <SelectItem value="ARCHIVED">Départs normaux</SelectItem>
                                <SelectItem value="INACTIVITY">Inactivité</SelectItem>
                                <SelectItem value="VOLUNTARY">Volontaire</SelectItem>
                                <SelectItem value="BEHAVIOR">Comportement</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="border border-border rounded-xl bg-surface/40 overflow-hidden">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead>
                                <tr className="bg-surface/80 border-b border-border text-muted-foreground font-semibold">
                                    <th className="py-3 px-4">Ancien Membre</th>
                                    <th className="py-3 px-4">Date Départ</th>
                                    <th className="py-3 px-4">Ancienneté Passée</th>
                                    <th className="py-3 px-4">Type</th>
                                    <th className="py-3 px-4">Motif Précis</th>
                                    <th className="py-3 px-4">Recruteur Origine</th>
                                    <th className="py-3 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                                {filteredDeparted.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-8 text-center text-muted-foreground">
                                            Aucun départ enregistré.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredDeparted.map((m) => (
                                        <tr key={m.id} className="hover:bg-surface/70 transition-colors">
                                            <td className="py-3 px-4 font-bold text-foreground">
                                                {m.displayName}
                                            </td>
                                            <td className="py-3 px-4 text-muted-foreground">
                                                {m.archivedAt ? new Date(m.archivedAt).toLocaleDateString("fr-FR") : "-"}
                                            </td>
                                            <td className="py-3 px-4 font-mono text-muted-foreground">
                                                {m.seniorityDays} jours
                                            </td>
                                            <td className="py-3 px-4">
                                                {m.status === "BANNED" ? (
                                                    <Badge className="bg-destructive/20 text-destructive border-destructive/40 text-[10px]">
                                                        Banni
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-[10px]">
                                                        Départ
                                                    </Badge>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-foreground font-medium max-w-[250px] truncate">
                                                {m.departureReason || <span className="italic text-muted-foreground">Non renseigné</span>}
                                            </td>
                                            <td className="py-3 px-4 text-muted-foreground">
                                                {m.recruiterName || "-"}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleReintegrate(m.id)}
                                                    disabled={isPending}
                                                    className="h-7 text-xs text-success hover:bg-success/10 border-success/30"
                                                >
                                                    <RotateCcw className="h-3 w-3 mr-1" />
                                                    Réintégrer
                                                </Button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </TabsContent>

                {/* ════════════════════════════════════════════════════════════
                    ONGLET 5 : PARAMÈTRES
                ════════════════════════════════════════════════════════════ */}
                {isAdmin && (
                    <TabsContent value="settings" className="space-y-6">
                        <Card className="p-6 bg-surface/50 border-border space-y-6">
                            <div>
                                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                                    <Sliders className="h-5 w-5 text-primary" />
                                    Configuration du Recrutement & Cycle de Vie
                                </h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Personnalisez le comportement du module pour votre guilde. Tout est optionnel et s&apos;adapte à vos règles.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Période d'essai */}
                                <div className="space-y-4 p-4 rounded-xl bg-surface/70 border border-border">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label className="font-bold text-sm">Période d&apos;essai</Label>
                                            <p className="text-xs text-muted-foreground">
                                                Active le suivi des jours restants et les alertes.
                                            </p>
                                        </div>
                                        <Switch
                                            checked={configState.trialEnabled}
                                            onCheckedChange={(checked) => setConfigState({ ...configState, trialEnabled: checked })}
                                        />
                                    </div>

                                    {configState.trialEnabled && (
                                        <div className="space-y-2 pt-2">
                                            <Label className="text-xs">Durée par défaut (en jours)</Label>
                                            <Input
                                                type="number"
                                                min={1}
                                                max={90}
                                                value={configState.trialDurationDays}
                                                onChange={(e) => setConfigState({ ...configState, trialDurationDays: parseInt(e.target.value) || 14 })}
                                                className="h-9 text-xs"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Quota de mules */}
                                <div className="space-y-4 p-4 rounded-xl bg-surface/70 border border-border">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label className="font-bold text-sm">Limiter les Mules en guilde</Label>
                                            <p className="text-xs text-muted-foreground">
                                                Affiche la jauge et prévient si le quota est dépassé.
                                            </p>
                                        </div>
                                        <Switch
                                            checked={configState.muleLimitEnabled}
                                            onCheckedChange={(checked) => setConfigState({ ...configState, muleLimitEnabled: checked })}
                                        />
                                    </div>

                                    {configState.muleLimitEnabled && (
                                        <div className="space-y-2 pt-2">
                                            <Label className="text-xs">Nombre max de mules autorisé</Label>
                                            <Input
                                                type="number"
                                                min={1}
                                                max={500}
                                                value={configState.maxGuildMules}
                                                onChange={(e) => setConfigState({ ...configState, maxGuildMules: parseInt(e.target.value) || 35 })}
                                                className="h-9 text-xs"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Rôles Discord */}
                                <div className="space-y-4 p-4 rounded-xl bg-surface/70 border border-border">
                                    <Label className="font-bold text-sm">Rôles Discord associés</Label>
                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Rôle &quot;Arrivant / Candidat&quot;</Label>
                                            <Select
                                                value={configState.arrivingRoleId || "NONE"}
                                                onValueChange={(val) => setConfigState({ ...configState, arrivingRoleId: val === "NONE" ? null : val })}
                                            >
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue placeholder="Sélectionner un rôle" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="NONE">Aucun rôle</SelectItem>
                                                    {roles.map((r) => (
                                                        <SelectItem key={r.id} value={r.id}>
                                                            {r.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Rôle &quot;En Période d&apos;Essai&quot;</Label>
                                            <Select
                                                value={configState.trialRoleId || "NONE"}
                                                onValueChange={(val) => setConfigState({ ...configState, trialRoleId: val === "NONE" ? null : val })}
                                            >
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue placeholder="Sélectionner un rôle" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="NONE">Aucun rôle</SelectItem>
                                                    {roles.map((r) => (
                                                        <SelectItem key={r.id} value={r.id}>
                                                            {r.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Rôle &quot;Membre Confirmé&quot;</Label>
                                            <Select
                                                value={configState.confirmedRoleId || "NONE"}
                                                onValueChange={(val) => setConfigState({ ...configState, confirmedRoleId: val === "NONE" ? null : val })}
                                            >
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue placeholder="Sélectionner un rôle" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="NONE">Aucun rôle</SelectItem>
                                                    {roles.map((r) => (
                                                        <SelectItem key={r.id} value={r.id}>
                                                            {r.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>

                                {/* Salons Discord */}
                                <div className="space-y-4 p-4 rounded-xl bg-surface/70 border border-border">
                                    <Label className="font-bold text-sm">Salons Discord d&apos;Alertes</Label>
                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Salon pour les alertes fin d&apos;essai</Label>
                                        <Select
                                            value={configState.recruitmentAlertChannelId || "NONE"}
                                            onValueChange={(val) => setConfigState({ ...configState, recruitmentAlertChannelId: val === "NONE" ? null : val })}
                                        >
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue placeholder="Sélectionner un salon" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="NONE">Aucun salon</SelectItem>
                                                {channels.map((c) => (
                                                    <SelectItem key={c.id} value={c.id}>
                                                        #{c.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            {/* Template message de bienvenue */}
                            <div className="space-y-2 p-4 rounded-xl bg-surface/70 border border-border">
                                <Label className="font-bold text-sm">Modèle de message de bienvenue (Markdown)</Label>
                                <p className="text-xs text-muted-foreground">
                                    Variables disponibles : <code className="text-primary font-mono">&#123;pseudo&#125;</code>, <code className="text-primary font-mono">&#123;essai_jours&#125;</code>, <code className="text-primary font-mono">&#123;dashboard_url&#125;</code>
                                </p>
                                <Textarea
                                    rows={4}
                                    value={configState.recruitmentWelcomeTemplate || ""}
                                    onChange={(e) => setConfigState({ ...configState, recruitmentWelcomeTemplate: e.target.value })}
                                    placeholder="# 👋 Bienvenue {pseudo} ! ⏱ Essai : {essai_jours} jours..."
                                    className="text-xs font-mono"
                                />
                            </div>

                            <div className="flex justify-end">
                                <Button
                                    onClick={handleSaveConfig}
                                    disabled={isPending}
                                    className="h-9 text-xs"
                                >
                                    <Save className="h-3.5 w-3.5 mr-1.5" />
                                    Enregistrer la configuration
                                </Button>
                            </div>
                        </Card>
                    </TabsContent>
                )}
            </Tabs>

            {/* ════════════════════════════════════════════════════════════
                MODALS / DIALOGS
            ════════════════════════════════════════════════════════════ */}

            {/* Modal Départ / Ban */}
            <Dialog open={departureModalOpen} onOpenChange={setDepartureModalOpen}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold flex items-center gap-2">
                            {isBanAction ? <Shield className="h-5 w-5 text-destructive" /> : <UserX className="h-5 w-5 text-warning" />}
                            {isBanAction ? `Bannir / Exclure ${selectedMember?.displayName}` : `Enregistrer le départ de ${selectedMember?.displayName}`}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            {isBanAction
                                ? "Ce membre sera marqué comme banni et exclu du dashboard. Le motif sera archivé."
                                : "Ce membre passera en statut archivé. Les données restent conservées."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold">Catégorie</Label>
                            <Select value={departureCategory} onValueChange={(val: any) => setDepartureCategory(val)}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="INACTIVITY">Inactivité (absent du jeu / vocal)</SelectItem>
                                    <SelectItem value="VOLUNTARY">Départ volontaire (changement de guilde)</SelectItem>
                                    <SelectItem value="BEHAVIOR">Comportement / Toxicité / Insultes</SelectItem>
                                    <SelectItem value="OTHER">Autre motif</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold">Motif précis (obligatoire)</Label>
                            <Textarea
                                rows={3}
                                placeholder="ex: Joueur fantôme, ne donne plus de nouvelles depuis 3 semaines..."
                                value={departureReason}
                                onChange={(e) => setDepartureReason(e.target.value)}
                                className="text-xs"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setDepartureModalOpen(false)}>
                            Annuler
                        </Button>
                        <Button
                            variant={isBanAction ? "destructive" : "default"}
                            size="sm"
                            onClick={handleConfirmDeparture}
                            disabled={isPending}
                        >
                            Confirmer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal Mules */}
            <Dialog open={altsModalOpen} onOpenChange={setAltsModalOpen}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold flex items-center gap-2">
                            <Layers className="h-5 w-5 text-info" />
                            Mules de {selectedMember?.displayName}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Ajoutez ou retirez les personnages secondaires de ce membre.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="flex items-center gap-2">
                            <Input
                                placeholder="Pseudo de la mule..."
                                value={newAltInput}
                                onChange={(e) => setNewAltInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && newAltInput.trim()) {
                                        e.preventDefault();
                                        if (!tempAlts.includes(newAltInput.trim())) {
                                            setTempAlts([...tempAlts, newAltInput.trim()]);
                                            setNewAltInput("");
                                        }
                                    }
                                }}
                                className="h-8 text-xs flex-1"
                            />
                            <Button
                                size="sm"
                                onClick={() => {
                                    if (newAltInput.trim() && !tempAlts.includes(newAltInput.trim())) {
                                        setTempAlts([...tempAlts, newAltInput.trim()]);
                                        setNewAltInput("");
                                    }
                                }}
                                className="h-8 text-xs"
                            >
                                <Plus className="h-3.5 w-3.5" />
                            </Button>
                        </div>

                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {tempAlts.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic text-center py-2">
                                    Aucune mule enregistrée pour ce membre.
                                </p>
                            ) : (
                                tempAlts.map((alt, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between p-2 rounded-lg bg-surface/70 border border-border text-xs"
                                    >
                                        <span className="font-mono font-bold text-foreground">{alt}</span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setTempAlts(tempAlts.filter((_, i) => i !== index))}
                                            className="h-5 w-5 text-muted-foreground hover:text-destructive"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setAltsModalOpen(false)}>
                            Annuler
                        </Button>
                        <Button size="sm" onClick={handleSaveAlts} disabled={isPending}>
                            Enregistrer ({tempAlts.length})
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal Notes Staff */}
            <Dialog open={notesModalOpen} onOpenChange={setNotesModalOpen}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold flex items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-primary" />
                            Notes Staff : {selectedMember?.displayName}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Ces notes sont privées et visibles uniquement par les membres du staff.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-2">
                        <Textarea
                            rows={4}
                            placeholder="ex: Vu en vocal le 01/09, joue principalement Sacri eau..."
                            value={tempNotes}
                            onChange={(e) => setTempNotes(e.target.value)}
                            className="text-xs"
                        />
                    </div>

                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setNotesModalOpen(false)}>
                            Annuler
                        </Button>
                        <Button size="sm" onClick={handleSaveNotes} disabled={isPending}>
                            Enregistrer la note
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal Recruteur */}
            <Dialog open={recruiterModalOpen} onOpenChange={setRecruiterModalOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold flex items-center gap-2">
                            <UserPlus className="h-5 w-5 text-primary" />
                            Recruteur pour {selectedMember?.displayName}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Sélectionnez l&apos;officier ou membre du staff qui a recruté ce joueur.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-2">
                        <Select value={selectedRecruiterId} onValueChange={setSelectedRecruiterId}>
                            <SelectTrigger className="h-9 text-xs">
                                <SelectValue placeholder="Choisir un recruteur" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="NONE">Aucun recruteur assigné</SelectItem>
                                {data.members.map((m) => (
                                    <SelectItem key={m.id} value={m.id}>
                                        {m.displayName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setRecruiterModalOpen(false)}>
                            Annuler
                        </Button>
                        <Button size="sm" onClick={handleSaveRecruiter} disabled={isPending}>
                            Valider
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

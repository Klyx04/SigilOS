"use client";

import { useState, useEffect, useMemo } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Search,
    MoreVertical,
    UserX,
    CheckCircle2,
    ShieldAlert,
    RotateCcw,
    Mail,
    UserCheck,
    Clock,
    Trash2,
    Sparkles,
    Send,
    Edit,
    ArrowUpDown,
    Copy,
    Check,
    Crown,
    Palmtree,
    CalendarDays,
    ChevronLeft,
    ChevronRight
} from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "../ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription, 
    DialogFooter 
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { updateMemberProfileStatus, updateMemberPseudo, updateMemberAnkamaId } from "@/server/actions/user-actions";
import { deleteProfileByAdmin, reactivateProfileByAdmin } from "@/server/actions/lifecycle-actions";
import { transferGuildOwnership } from "@/server/actions/god-lifecycle-actions";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { ProbationGrantDialog } from "../../app/dashboard/[guildId]/admin/_components/probation-grant-dialog";
import { sendWelcomeMessage } from "@/server/actions/onboarding-admin-actions";
import { VacationEditDialog } from "./members/vacation-edit-dialog";
import { ArchiveDurationDialog } from "./archive-duration-dialog";

interface Member {
    id: string;
    userId: string;
    status: "ACTIVE" | "ARCHIVED" | "BANNED";
    createdAt: string; // ISO string from server
    updatedAt: string; // ISO string from server
    archivedAt: string | null; // ISO string from server
    archiveReason: string | null;
    pseudoDofus: string | null;
    ankamaId?: string | null;
    discordNickname: string | null;
    discordRoleName?: string | null;
    discordRoleColor?: number | null;
    user: {
        name: string | null;
        image: string | null;
        accounts: Array<{ providerAccountId: string }>;
    };
    scheduledDeletion: string | null;
    vacationStart?: string | null;
    vacationEnd?: string | null;
}

interface MemberManagementTableProps {
    initialMembers: Member[];
    guildId: string;
    welcomeBadgeName: string;
    isSuperAdmin?: boolean;
    isAdmin?: boolean; // Guild admin (canManageMembers) — can delete & reactivate
    ownerId?: string | null;
    currentUserId?: string; // NextAuth user ID of the logged-in admin
}

export function MemberManagementTable({ initialMembers, guildId, welcomeBadgeName, isSuperAdmin = false, isAdmin = false, ownerId = null, currentUserId = "" }: MemberManagementTableProps) {
    const [search, setSearch] = useState("");
    const [members, setMembers] = useState(initialMembers);
    const [activeTab, setActiveTab] = useState<"ALL" | "ACTIVE" | "ARCHIVED" | "BANNED">("ACTIVE");
    const [isUpdating, setIsUpdating] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc"); // desc = newer first
    const [roleFilter, setRoleFilter] = useState("all");
    const [joinedFilter, setJoinedFilter] = useState("all");
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 15;

    // Dialog state
    const [badgeTarget, setBadgeTarget] = useState<{ id: string, name: string } | null>(null);
    const [idTarget, setIdTarget] = useState<{ id: string, name: string, currentId?: string | null } | null>(null);
    const [namePart, setNamePart] = useState("");
    const [digitsPart, setDigitsPart] = useState("");
    
    const [vacationTarget, setVacationTarget] = useState<Member | null>(null);
    const [archiveTarget, setArchiveTarget] = useState<{ id: string, name: string } | null>(null);

    const filteredMembers = useMemo(() => {
        return members
            .filter((member: Member) =>
                activeTab === "ALL" || member.status === activeTab
            )
            .filter((member: Member) =>
                member.user.name?.toLowerCase().includes(search.toLowerCase()) ||
                (member.user.accounts[0]?.providerAccountId || "").includes(search) ||
                member.pseudoDofus?.toLowerCase().includes(search.toLowerCase()) ||
                member.ankamaId?.toLowerCase().includes(search.toLowerCase())
            )
            .filter((member: Member) => 
                roleFilter === "all" || member.discordRoleName === roleFilter
            )
            .filter((member: Member) => {
                if (joinedFilter === "all") return true;
                const createdDate = new Date(member.createdAt);
                const now = new Date();
                const diffDays = Math.ceil(Math.abs(now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
                if (joinedFilter === "week") return diffDays <= 7;
                if (joinedFilter === "month") return diffDays <= 30;
                if (joinedFilter === "old") return diffDays > 180;
                return true;
            })
            .sort((a, b) => {
                const dateA = new Date(a.createdAt).getTime();
                const dateB = new Date(b.createdAt).getTime();
                return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
            });
    }, [members, activeTab, search, roleFilter, joinedFilter, sortOrder]);

    const paginatedMembers = useMemo(() => {
        return filteredMembers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    }, [filteredMembers, currentPage]);

    const totalPages = useMemo(() => {
        return Math.ceil(filteredMembers.length / pageSize);
    }, [filteredMembers.length]);

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, search, roleFilter, joinedFilter]);

    const uniqueRoles = [...new Set(members.map(m => m.discordRoleName).filter(Boolean))];

    const handleStatusUpdate = async (profileId: string, status: "ACTIVE" | "ARCHIVED" | "BANNED") => {
        if (status === "ARCHIVED") {
            const member = members.find(m => m.id === profileId);
            setArchiveTarget({ 
                id: profileId, 
                name: member?.pseudoDofus || member?.user.name || "Membre" 
            });
            return;
        }

        setIsUpdating(profileId);
        try {
            const res = await updateMemberProfileStatus(profileId, status);
            if (res.success) {
                setMembers(prev => prev.map(m =>
                    m.id === profileId ? { ...m, status, updatedAt: new Date().toISOString() } : m
                ));
                toast.success(`Statut mis à jour : ${status}`);
            } else {
                toast.error(res.error || "Erreur lors de la mise à jour");
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Erreur lors de la mise à jour");
        } finally {
            setIsUpdating(null);
        }
    };

    // Dedicated reactivation handler — calls the new server action with full audit log + session invalidation
    const handleReactivate = async (profileId: string, previousStatus: "ARCHIVED" | "BANNED") => {
        const label = previousStatus === "BANNED" ? "Débannir et réintégrer" : "Réactiver";
        const warning = previousStatus === "BANNED"
            ? `⚠️ Réintégrer ce membre banni ? Il pourra à nouveau accéder au dashboard.`
            : `Réactiver le profil de ce membre archivé ?`;

        if (!confirm(warning)) return;

        setIsUpdating(profileId);
        try {
            const res = await reactivateProfileByAdmin(guildId, profileId);
            if (res.success) {
                setMembers(prev => prev.map(m =>
                    m.id === profileId ? { ...m, status: "ACTIVE", updatedAt: new Date().toISOString() } : m
                ));
                toast.success(`✅ ${label} avec succès`);
            } else {
                toast.error(res.error || "Erreur lors de la réactivation");
            }
        } catch (error) {
            toast.error("Erreur de communication");
        } finally {
            setIsUpdating(null);
        }
    };

    const handleDelete = async (profileId: string) => {
        if (!confirm("⚠️ Action irréversible. Supprimer définitivement toutes les données de ce membre pour cette guilde ?")) return;

        setIsUpdating(profileId);
        try {
            const res = await deleteProfileByAdmin(guildId, profileId);
            if (res.success) {
                setMembers(prev => prev.filter(m => m.id !== profileId));
                toast.success("Profil supprimé définitivement");
            } else {
                toast.error(res.error || "Erreur lors de la suppression");
            }
        } catch (error) {
            toast.error("Erreur de communication");
        } finally {
            setIsUpdating(null);
        }
    };

    const handleTransferOwnership = async (userId: string, memberName: string) => {
        if (!confirm(`⚠️ ATTENTION : Transférer la PROPRIÉTÉ de cette guilde à ${memberName} ?\n\nCette personne deviendra le nouvel administrateur principal.`)) return;
        
        setIsUpdating(userId);
        try {
            const res = await transferGuildOwnership(guildId, userId);
            if (res.success) {
                toast.success(`Propriété transférée avec succès à ${memberName} !`);
                window.location.reload(); // Refresh to update context
            } else {
                toast.error(res.error || "Échec du transfert");
            }
        } catch (error) {
            toast.error("Erreur de communication");
        } finally {
            setIsUpdating(null);
        }
    };


    const handleUpdatePseudo = async (profileId: string) => {
        const currentMember = members.find(m => m.id === profileId);
        const newPseudo = prompt("Entrez le pseudo Dofus de ce membre :", currentMember?.pseudoDofus || "");

        if (newPseudo === null || newPseudo === currentMember?.pseudoDofus) return;

        setIsUpdating(profileId);
        try {
            const res = await updateMemberPseudo(profileId, newPseudo);
            if (res.success) {
                setMembers(prev => prev.map(m =>
                    m.id === profileId ? { ...m, pseudoDofus: newPseudo } : m
                ));
                toast.success("Pseudo mis à jour !");
            }
        } catch (error) {
            toast.error("Erreur lors de la mise à jour");
        } finally {
            setIsUpdating(null);
        }
    };

    const openIdDialog = (member: Member) => {
        setIdTarget({ id: member.id, name: member.pseudoDofus || member.user.name || "Membre", currentId: member.ankamaId });
        if (member.ankamaId && member.ankamaId.includes('#')) {
            const [n, d] = member.ankamaId.split('#');
            setNamePart(n || "");
            setDigitsPart(d || "");
        } else {
            setNamePart("");
            setDigitsPart("");
        }
    };

    const handleSaveAnkamaId = async () => {
        if (!idTarget) return;
        
        const fullId = `${namePart}#${digitsPart}`;
        setIsUpdating(idTarget.id);
        try {
            const res = await updateMemberAnkamaId(idTarget.id, fullId);
            if (res.success) {
                setMembers(prev => prev.map(m =>
                    m.id === idTarget.id ? { ...m, ankamaId: fullId } : m
                ));
                toast.success("ID Dofus mis à jour !");
                setIdTarget(null);
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Erreur lors de la mise à jour");
        } finally {
            setIsUpdating(null);
        }
    };

    const isIdValid = /^[a-zA-Z0-9\-]{1,50}$/.test(namePart) && /^[0-9]{4}$/.test(digitsPart);

    const handleWelcome = async (profileId: string, memberName: string) => {
        if (!confirm(`Souhaiter la bienvenue à ${memberName} ? Cela publiera un message sur le Mur Social et sur Discord (si configuré).`)) return;
        
        setIsUpdating(profileId);
        try {
            const res = await sendWelcomeMessage(guildId, profileId);
            if (res.success) {
                toast.success(`Message de bienvenue envoyé pour ${memberName} ! ✨`);
            } else {
                toast.error(res.error || "Échec de l'envoi");
            }
        } catch (error) {
            toast.error("Erreur de communication");
        } finally {
            setIsUpdating(null);
        }
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copié !`);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex bg-zinc-900/50 p-1.5 rounded-[22px] border border-white/5 backdrop-blur-xl">
                    {["ACTIVE", "ARCHIVED", "BANNED", "ALL"].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-5 py-2.5 rounded-[16px] text-[10px] font-black uppercase tracking-[0.15em] transition-all ${activeTab === tab
                                ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20 border-t border-white/20"
                                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                                }`}
                        >
                            {tab === "ACTIVE" ? "Actifs" : tab === "ARCHIVED" ? "Archivés" : tab === "BANNED" ? "Bannis" : "Tous"}
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                        <SelectTrigger className="w-[170px] h-11 bg-black/40 border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap overflow-hidden pr-8 focus:ring-violet-500/20">
                            <SelectValue placeholder="Rôle" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-950 border-white/10 rounded-2xl">
                            <SelectItem value="all" className="text-[10px] font-black uppercase tracking-widest">Tous les rôles</SelectItem>
                            {uniqueRoles.map(role => (
                                <SelectItem key={role} value={role!} className="text-[10px] font-black uppercase tracking-widest">
                                    {role}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={joinedFilter} onValueChange={setJoinedFilter}>
                        <SelectTrigger className="w-[170px] h-11 bg-black/40 border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap overflow-hidden pr-8 focus:ring-violet-500/20">
                            <SelectValue placeholder="Arrivée" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-950 border-white/10 rounded-2xl">
                            <SelectItem value="all" className="text-[10px] font-black uppercase tracking-widest">Toutes époques</SelectItem>
                            <SelectItem value="week" className="text-[10px] font-black uppercase tracking-widest">{"< 1 semaine"}</SelectItem>
                            <SelectItem value="month" className="text-[10px] font-black uppercase tracking-widest">{"< 1 mois"}</SelectItem>
                            <SelectItem value="old" className="text-[10px] font-black uppercase tracking-widest">{"> 6 mois"}</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <Input
                            placeholder="Rechercher..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-12 bg-black/40 border-white/5 h-11 text-sm rounded-2xl focus:ring-violet-500/20 focus:border-violet-500/50 transition-all placeholder:text-zinc-600 font-medium"
                        />
                    </div>
                </div>
            </div>

            <div className="rounded-[32px] border border-white/10 bg-zinc-900/40 backdrop-blur-2xl overflow-x-auto no-scrollbar shadow-2xl relative group">
                <Table className="min-w-[800px] lg:min-w-0">
                    <TableHeader className="bg-white/[0.02] border-b border-white/5">
                        <TableRow className="hover:bg-transparent border-none">
                            <TableHead className="pl-8 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 py-6">Membre</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 py-6">Statut</TableHead>
                            <TableHead className="py-6">
                                <button
                                    onClick={() => setSortOrder(prev => prev === "desc" ? "asc" : "desc")}
                                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 hover:text-white transition-colors"
                                >
                                    Arrivée
                                    <ArrowUpDown className="w-3 h-3" />
                                </button>
                            </TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 py-6">Activité</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 py-6">Discord ID</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 py-6">Ankama ID</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 py-6">Suppression</TableHead>
                            <TableHead className="text-right text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 py-6 pr-8">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedMembers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-32 text-center text-zinc-500 italic">
                                        Aucun membre trouvé pour ces critères.
                                    </TableCell>
                                </TableRow>
                            ) : paginatedMembers.map((member) => {
                                // 🔒 Block destructive actions for self and Discord guild owner
                                const isSelf = !!currentUserId && member.userId === currentUserId;
                                const isOwner = !!ownerId && member.user.accounts[0]?.providerAccountId === ownerId;
                                const isProtected = isSelf || isOwner;

                                return (
                            <TableRow key={member.id} className="group border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors border-none">
                                <TableCell className="pl-8 py-5">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10 border border-white/5 group-hover:border-violet-500/40 transition-all rounded-2xl shadow-lg">
                                            <AvatarImage src={member.user.image || ""} className="object-cover rounded-2xl" />
                                            <AvatarFallback className="bg-zinc-850 text-zinc-400 text-xs font-black uppercase rounded-2xl">
                                                {member.user.name?.[0] || "?"}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col leading-tight">
                                            <div className="font-black text-base text-zinc-200 group-hover:text-white transition-colors flex items-center gap-2">
                                                {member.pseudoDofus || member.user.name}
                                                {member.user.accounts[0]?.providerAccountId === ownerId && (
                                                    <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20 stroke-[3]" />
                                                )}
                                                {!member.pseudoDofus && (
                                                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase font-black tracking-widest leading-none">
                                                        Pseudo manquant
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-1">
                                                <span>@{member.discordNickname || member.user.name}</span>
                                            </div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1.5">
                                        <Badge
                                            variant="outline"
                                            className={`capitalize text-[9px] font-black tracking-[0.1em] px-2 py-1 rounded-lg w-fit ${member.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.05)]" :
                                                member.status === "ARCHIVED" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                                    "bg-red-500/10 text-red-400 border-red-500/20"
                                                }`}
                                        >
                                            {member.status === "ACTIVE" && <UserCheck className="w-2.5 h-2.5 mr-1" />}
                                            {member.status === "ARCHIVED" && <Clock className="w-2.5 h-2.5 mr-1" />}
                                            {member.status === "BANNED" && <ShieldAlert className="w-2.5 h-2.5 mr-1" />}
                                            {member.status.toLowerCase()}
                                        </Badge>
                                        {member.vacationStart && (
                                            <Badge 
                                                variant="outline" 
                                                onClick={() => setVacationTarget(member)}
                                                className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 cursor-pointer hover:bg-cyan-500/20 transition-colors text-[9px] font-black tracking-[0.1em] px-2 py-1 rounded-lg w-fit"
                                            >
                                                <Palmtree className="w-2.5 h-2.5 mr-1" />
                                                Vacances
                                            </Badge>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-xs font-medium text-zinc-400 tabular-nums">
                                    {new Date(member.createdAt).toLocaleDateString("fr-FR", { day: 'numeric', month: 'short', year: 'numeric' })}
                                </TableCell>
                                <TableCell className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight">
                                    {formatDistanceToNow(new Date(member.updatedAt ?? member.archivedAt ?? new Date()), { addSuffix: true, locale: fr })}
                                </TableCell>
                                <TableCell>
                                    <div 
                                        onClick={() => copyToClipboard(member.user.accounts[0]?.providerAccountId || "", "ID Discord")}
                                        className="flex items-center gap-2 group/copy cursor-pointer w-fit"
                                    >
                                        <code className="text-[10px] px-2 py-1 rounded bg-zinc-800 text-zinc-350 font-mono border border-white/5 group-hover/copy:border-white/20 transition-all">
                                            {member.user.accounts[0]?.providerAccountId || "Unknown"}
                                        </code>
                                        <Copy className="w-3 h-3 text-zinc-650 group-hover/copy:text-zinc-450 opacity-0 group-hover/copy:opacity-100 transition-all" />
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {member.ankamaId ? (
                                        <div 
                                            onClick={() => copyToClipboard(member.ankamaId!, "ID Dofus")}
                                            className="flex items-center gap-2 group/id relative cursor-pointer w-fit"
                                        >
                                            <div className="px-2 py-1 rounded bg-indigo-500/20 border border-indigo-500/40 group-hover/id:border-indigo-400 transition-all">
                                                <span className="text-[10px] font-black text-indigo-400 font-mono tracking-tight uppercase">{member.ankamaId}</span>
                                            </div>
                                            <Copy className="w-3 h-3 text-indigo-600 group-hover/id:text-indigo-400 opacity-0 group-hover/id:opacity-100 transition-all" />
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={() => openIdDialog(member)}
                                            className="text-[9px] font-black uppercase text-zinc-650 hover:text-zinc-400 transition-colors italic flex items-center gap-1"
                                        >
                                            <Edit className="w-3 h-3" />
                                            Ajouter ID
                                        </button>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {member.scheduledDeletion ? (() => {
                                        const deletionDate = new Date(member.scheduledDeletion);
                                        const now = new Date();
                                        const diffTime = deletionDate.getTime() - now.getTime();
                                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                        const isUrgent = diffDays <= 2;

                                        return (
                                            <div className="flex flex-col gap-1">
                                                <div className={`flex items-center gap-1.5 font-black text-[10px] uppercase tracking-widest px-2 py-1 rounded-lg w-fit ${
                                                    isUrgent ? 'bg-red-500/10 text-red-500 animate-pulse' : 'bg-orange-500/10 text-orange-400'
                                                }`}>
                                                    <Clock className="w-3 h-3" />
                                                    {diffDays <= 0 ? "Imminent" : `J-${diffDays}`}
                                                </div>
                                                <span className="text-[9px] text-zinc-650 font-medium italic pl-1">
                                                    {format(deletionDate, "dd/MM HH:mm")}
                                                </span>
                                            </div>
                                        );
                                    })() : (
                                        <span className="text-[10px] text-zinc-750 font-bold uppercase tracking-widest pl-2">
                                            -
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell className="pr-8 text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white" disabled={isUpdating === member.id}>
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48 bg-zinc-950 border-white/10 text-zinc-300 rounded-2xl shadow-xl">
                                            <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-2 py-1.5">Actions Membre</DropdownMenuLabel>
                                            <DropdownMenuSeparator className="bg-white/5" />
                                            {member.status !== "ACTIVE" && (isAdmin || isSuperAdmin) && (
                                                <DropdownMenuItem onClick={() => handleReactivate(member.id, member.status as "ARCHIVED" | "BANNED")} className="gap-2 focus:bg-emerald-500/10 focus:text-emerald-400 cursor-pointer text-[11px] font-black uppercase tracking-wider">
                                                    <RotateCcw className="h-3.5 w-3.5 text-emerald-500" />
                                                    {member.status === "BANNED" ? "Debannir & Reintegrer" : "Reactiver"}
                                                </DropdownMenuItem>
                                            )}
                                            {member.status === "ACTIVE" && !isProtected && (
                                                <DropdownMenuItem onClick={() => handleStatusUpdate(member.id, "ARCHIVED")} className="gap-2 focus:bg-amber-500/10 focus:text-amber-400 cursor-pointer text-[11px] font-black uppercase tracking-wider">
                                                    <UserX className="h-3.5 w-3.5 text-amber-500" />
                                                    Archiver
                                                </DropdownMenuItem>
                                            )}
                                            {!isProtected && (
                                                <DropdownMenuItem onClick={() => handleStatusUpdate(member.id, "BANNED")} className="gap-2 focus:bg-red-500/10 focus:text-red-400 cursor-pointer text-[11px] font-black uppercase tracking-wider">
                                                    <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
                                                    Bannir (SigilOS)
                                                </DropdownMenuItem>
                                            )}
                                            {isProtected && (
                                                <DropdownMenuItem disabled className="gap-2 text-zinc-600 cursor-not-allowed text-[10px] font-black uppercase tracking-wider">
                                                    <ShieldAlert className="h-3.5 w-3.5" />
                                                    {isSelf ? "Votre compte" : "Proprietaire protege"}
                                                </DropdownMenuItem>
                                            )}
                                            <DropdownMenuSeparator className="bg-white/5" />
                                            <DropdownMenuItem onClick={() => openIdDialog(member)} className="gap-2 focus:bg-indigo-500/10 focus:text-indigo-400 cursor-pointer text-[11px] font-black uppercase tracking-wider">
                                                <Edit className="h-3.5 w-3.5 text-indigo-400" />
                                                Modifier ID Dofus
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setVacationTarget(member)} className="gap-2 focus:bg-cyan-500/10 focus:text-cyan-400 cursor-pointer text-[11px] font-black uppercase tracking-wider">
                                                <Palmtree className="h-3.5 w-3.5 text-cyan-400" />
                                                Modifier Vacances
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleUpdatePseudo(member.id)} className="gap-2 focus:bg-amber-500/10 focus:text-amber-400 cursor-pointer text-[11px] font-black uppercase tracking-wider">
                                                <Edit className="h-3.5 w-3.5 text-amber-500" />
                                                Modifier Pseudo
                                            </DropdownMenuItem>
                                            {(isAdmin || isSuperAdmin) && (
                                                <>
                                                    <DropdownMenuSeparator className="bg-white/5" />
                                                    {isSuperAdmin && (
                                                        <DropdownMenuItem onClick={() => handleTransferOwnership(member.userId, member.pseudoDofus || member.user.name || "Membre")} className="gap-2 focus:bg-violet-600 focus:text-white text-violet-400 cursor-pointer text-[11px] font-black uppercase tracking-wider">
                                                            <UserCheck className="h-3.5 w-3.5" />
                                                            Proprietaire
                                                        </DropdownMenuItem>
                                                    )}
                                                    {(isSuperAdmin || member.status !== "ACTIVE") && !isProtected && (
                                                        <DropdownMenuItem onClick={() => handleDelete(member.id)} className="gap-2 focus:bg-red-650 focus:text-white text-red-500 cursor-pointer text-[11px] font-black uppercase tracking-wider">
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                            Supprimer
                                                        </DropdownMenuItem>
                                                    )}
                                                </>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                                );
                            })}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination UI */}
            {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6 px-4 py-4 bg-zinc-900/20 border border-white/5 rounded-3xl animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                        Affichage de {Math.min(filteredMembers.length, (currentPage - 1) * pageSize + 1)} à {Math.min(filteredMembers.length, currentPage * pageSize)} sur {filteredMembers.length} membres
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="w-9 h-9 rounded-xl bg-white/5 border-white/10 hover:bg-white/10 disabled:opacity-30 transition-all"
                        >
                            <ChevronLeft className="w-4 h-4 text-zinc-400" />
                        </Button>

                        <div className="flex items-center gap-1.5 px-4 h-9 rounded-xl bg-white/5 border border-white/10">
                            <span className="text-[10px] font-black text-white">{currentPage}</span>
                            <span className="text-[10px] font-black text-zinc-600">/</span>
                            <span className="text-[10px] font-black text-zinc-400">{totalPages}</span>
                        </div>

                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="w-9 h-9 rounded-xl bg-white/5 border-white/10 hover:bg-white/10 disabled:opacity-30 transition-all"
                        >
                            <ChevronRight className="w-4 h-4 text-zinc-400" />
                        </Button>
                    </div>
                </div>
            )}

            {badgeTarget && (
                <ProbationGrantDialog
                    guildId={guildId}
                    profileId={badgeTarget.id}
                    memberName={badgeTarget.name}
                    roleName={welcomeBadgeName}
                    open={!!badgeTarget}
                    onOpenChange={(open) => !open && setBadgeTarget(null)}
                />
            )}

            <Dialog open={!!idTarget} onOpenChange={(open) => !open && setIdTarget(null)}>
                <DialogContent className="sm:max-w-[425px] bg-zinc-950 border-white/10 text-white p-0 overflow-hidden rounded-[24px]">
                    <div className="p-6 pb-2">
                        <DialogHeader>
                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
                                <Edit className="w-6 h-6 text-indigo-400" />
                            </div>
                            <DialogTitle className="text-xl font-black tracking-tight">ID Dofus (Ankama)</DialogTitle>
                            <DialogDescription className="text-zinc-500 italic">
                                Mise à jour de l'ID pour <span className="text-white font-bold">{idTarget?.name}</span>. Respectez le format Nom#0000.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="px-6 py-6 space-y-6">
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
                            <div className="flex-1 space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 pl-1">Nom / Pseudo</label>
                                <Input 
                                    placeholder="Nom"
                                    value={namePart}
                                    onChange={(e) => setNamePart(e.target.value)}
                                    className="bg-zinc-900/50 border-white/10 text-sm font-bold h-11 focus:ring-indigo-500/30 rounded-xl"
                                    maxLength={50}
                                />
                            </div>
                            <div className="pt-6 font-black text-xl text-zinc-700">#</div>
                            <div className="w-24 space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 pl-1">4 Chiffres</label>
                                <Input 
                                    placeholder="0000"
                                    value={digitsPart}
                                    onChange={(e) => setDigitsPart(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                    className="bg-zinc-900/50 border-white/10 text-sm font-bold text-center h-11 focus:ring-indigo-500/30 rounded-xl"
                                    maxLength={4}
                                />
                            </div>
                        </div>

                        {!isIdValid && (namePart || digitsPart) && (
                            <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/10 flex items-start gap-3">
                                <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                <p className="text-[10px] text-zinc-500 leading-relaxed italic">
                                    Format invalide : Le nom doit faire max 50 caractères et il faut exactement 4 chiffres après le #.
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="px-6 py-4 bg-white/5 flex justify-end gap-3 lg:gap-2">
                        <Button variant="ghost" onClick={() => setIdTarget(null)} className="font-bold text-zinc-500 hover:text-white uppercase text-[10px] tracking-widest rounded-xl">
                            Annuler
                        </Button>
                        <Button 
                            onClick={handleSaveAnkamaId}
                            disabled={!isIdValid || isUpdating === idTarget?.id}
                            className={`bg-indigo-600 hover:bg-indigo-500 text-white font-black px-8 py-2 rounded-xl transition-all ${isIdValid ? 'shadow-lg shadow-indigo-600/20' : 'opacity-50'}`}
                        >
                            {isUpdating === idTarget?.id ? "Mise à jour..." : "Enregistrer"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {vacationTarget && (
                <VacationEditDialog 
                    open={!!vacationTarget}
                    onOpenChange={(open) => !open && setVacationTarget(null)}
                    guildId={guildId}
                    profileId={vacationTarget.id}
                    userId={vacationTarget.userId}
                    memberName={vacationTarget.pseudoDofus || vacationTarget.user.name || "Membre"}
                    initialVacationStart={vacationTarget.vacationStart || null}
                    initialVacationEnd={vacationTarget.vacationEnd || null}
                    onSuccess={(start, end) => {
                        setMembers(prev => prev.map(m => 
                            m.id === vacationTarget.id ? { ...m, vacationStart: start, vacationEnd: end } : m
                        ));
                    }}
                />
            )}

            {archiveTarget && (
                <ArchiveDurationDialog 
                    open={!!archiveTarget}
                    onOpenChange={(open) => !open && setArchiveTarget(null)}
                    memberId={archiveTarget.id}
                    memberName={archiveTarget.name}
                    onSuccess={() => {
                        setMembers(prev => prev.map(m =>
                            m.id === archiveTarget.id ? { ...m, status: "ARCHIVED", updatedAt: new Date().toISOString() } : m
                        ));
                    }}
                />
            )}
        </div>
    );
}

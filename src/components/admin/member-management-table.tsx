"use client";

import { useState } from "react";
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
    CalendarDays
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
}

export function MemberManagementTable({ initialMembers, guildId, welcomeBadgeName, isSuperAdmin = false, isAdmin = false, ownerId = null }: MemberManagementTableProps) {
    const [search, setSearch] = useState("");
    const [members, setMembers] = useState(initialMembers);
    const [activeTab, setActiveTab] = useState<"ALL" | "ACTIVE" | "ARCHIVED" | "BANNED">("ACTIVE");
    const [isUpdating, setIsUpdating] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc"); // desc = newer first
    const [roleFilter, setRoleFilter] = useState("all");
    const [joinedFilter, setJoinedFilter] = useState("all");

    // Dialog state
    const [badgeTarget, setBadgeTarget] = useState<{ id: string, name: string } | null>(null);
    const [idTarget, setIdTarget] = useState<{ id: string, name: string, currentId?: string | null } | null>(null);
    const [namePart, setNamePart] = useState("");
    const [digitsPart, setDigitsPart] = useState("");
    
    const [vacationTarget, setVacationTarget] = useState<Member | null>(null);

    const filteredMembers = members
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

    const uniqueRoles = [...new Set(members.map(m => m.discordRoleName).filter(Boolean))];

    const handleStatusUpdate = async (profileId: string, status: "ACTIVE" | "ARCHIVED" | "BANNED") => {
        setIsUpdating(profileId);
        try {
            await updateMemberProfileStatus(profileId, status);
            setMembers(prev => prev.map(m =>
                m.id === profileId ? { ...m, status, updatedAt: new Date().toISOString() } : m
            ));
            toast.success(`Statut mis à jour : ${status}`);
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
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-white/5">
                    {["ACTIVE", "ARCHIVED", "BANNED", "ALL"].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === tab
                                ? "bg-violet-500 text-white shadow-lg shadow-violet-500/20 border-t border-white/20"
                                : "text-zinc-500 hover:text-zinc-300"
                                }`}
                        >
                            {tab === "ACTIVE" ? "Actifs" : tab === "ARCHIVED" ? "Archivés" : tab === "BANNED" ? "Bannis" : "Tous"}
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                        <SelectTrigger className="w-[170px] h-9 bg-zinc-900/50 border-white/10 text-[10px] font-black uppercase tracking-widest whitespace-nowrap overflow-hidden pr-8">
                            <SelectValue placeholder="Rôle" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-950 border-white/10">
                            <SelectItem value="all" className="text-[10px] font-black uppercase tracking-widest">Tous les rôles</SelectItem>
                            {uniqueRoles.map(role => (
                                <SelectItem key={role} value={role!} className="text-[10px] font-black uppercase tracking-widest">
                                    {role}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={joinedFilter} onValueChange={setJoinedFilter}>
                        <SelectTrigger className="w-[170px] h-9 bg-zinc-900/50 border-white/10 text-[10px] font-black uppercase tracking-widest whitespace-nowrap overflow-hidden pr-8">
                            <SelectValue placeholder="Arrivée" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-950 border-white/10">
                            <SelectItem value="all" className="text-[10px] font-black uppercase tracking-widest">Toutes époques</SelectItem>
                            <SelectItem value="week" className="text-[10px] font-black uppercase tracking-widest">{"< 1 semaine"}</SelectItem>
                            <SelectItem value="month" className="text-[10px] font-black uppercase tracking-widest">{"< 1 mois"}</SelectItem>
                            <SelectItem value="old" className="text-[10px] font-black uppercase tracking-widest">{"> 6 mois"}</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <Input
                            placeholder="Rechercher..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 bg-zinc-900/50 border-white/10 h-9 text-sm rounded-xl"
                        />
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-zinc-900/20 overflow-x-auto no-scrollbar">
                <Table className="min-w-[800px] lg:min-w-0">
                    <TableHeader className="bg-white/5 border-b border-white/5">
                        <TableRow className="hover:bg-transparent border-none">
                            <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 py-4">Membre</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 py-4">Statut</TableHead>
                            <TableHead className="py-4">
                                <button
                                    onClick={() => setSortOrder(prev => prev === "desc" ? "asc" : "desc")}
                                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 hover:text-white transition-colors"
                                >
                                    Arrivée
                                    <ArrowUpDown className="w-3 h-3" />
                                </button>
                            </TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 py-4">Activité</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 py-4">Discord ID</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 py-4">Ankama ID</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 py-4">Suppression</TableHead>
                            <TableHead className="text-right text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 py-4 pr-8">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredMembers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-32 text-center text-zinc-500">
                                    Aucun membre trouvé.
                                </TableCell>
                            </TableRow>
                        ) : filteredMembers.map((member) => (
                            <TableRow key={member.id} className="hover:bg-white/5 transition-colors border-white/5">
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8 border border-white/10">
                                            <AvatarImage src={member.user.image || ""} />
                                            <AvatarFallback className="bg-violet-500/20 text-violet-400 text-xs">
                                                {member.user.name?.[0] || "?"}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                            <div className="font-medium text-sm text-white flex items-center gap-2">
                                                {member.pseudoDofus || member.user.name}
                                                {member.user.accounts[0]?.providerAccountId === ownerId && (
                                                    <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20 stroke-[3]" />
                                                )}
                                                {!member.pseudoDofus && (
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase font-black">
                                                        Pseudo manquant
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-zinc-500 flex items-center gap-1">
                                                <span>Discord : {member.discordNickname || member.user.name}</span>
                                            </div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant="outline"
                                        className={`capitalize text-[9px] font-black tracking-[0.1em] px-2 py-0.5 rounded-md ${member.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.05)]" :
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
                                            className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 cursor-pointer hover:bg-cyan-500/20 transition-colors"
                                        >
                                            <Palmtree className="w-2.5 h-2.5 mr-1" />
                                            Vacances
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-[10px] text-zinc-400 font-medium">
                                    {new Date(member.createdAt).toLocaleDateString("fr-FR", { day: 'numeric', month: 'short', year: 'numeric' })}
                                </TableCell>
                                <TableCell className="text-xs text-zinc-500">
                                    {formatDistanceToNow(new Date(member.updatedAt ?? member.archivedAt ?? new Date()), { addSuffix: true, locale: fr })}
                                </TableCell>
                                <TableCell>
                                    <div 
                                        onClick={() => copyToClipboard(member.user.accounts[0]?.providerAccountId || "", "ID Discord")}
                                        className="flex items-center gap-2 group/copy cursor-pointer w-fit"
                                    >
                                        <code className="text-[10px] px-2 py-1 rounded bg-zinc-800 text-zinc-300 font-mono border border-white/5 group-hover/copy:border-white/20 transition-all">
                                            {member.user.accounts[0]?.providerAccountId || "Unknown"}
                                        </code>
                                        <Copy className="w-3 h-3 text-zinc-600 group-hover/copy:text-zinc-400 opacity-0 group-hover/copy:opacity-100 transition-all" />
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
                                            className="text-[9px] font-black uppercase text-zinc-600 hover:text-zinc-400 transition-colors italic flex items-center gap-1"
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
                                                <span className="text-[9px] text-zinc-600 font-medium italic pl-1">
                                                    {format(deletionDate, "dd/MM HH:mm")}
                                                </span>
                                            </div>
                                        );
                                    })() : (
                                        <span className="text-[10px] text-zinc-700 font-medium uppercase tracking-widest pl-2">
                                            -
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white" disabled={isUpdating === member.id}>
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48 bg-zinc-950 border-white/10 text-zinc-300">
                                            <DropdownMenuLabel className="text-xs text-zinc-500">Actions Membre</DropdownMenuLabel>
                                            <DropdownMenuSeparator className="bg-white/5" />

                                            {/* REACTIVATION — visible aux admins de guilde ET au superadmin */}
                                            {member.status !== "ACTIVE" && (isAdmin || isSuperAdmin) && (
                                                <DropdownMenuItem
                                                    onClick={() => handleReactivate(member.id, member.status as "ARCHIVED" | "BANNED")}
                                                    className="gap-2 focus:bg-emerald-500/10 focus:text-emerald-400 cursor-pointer"
                                                >
                                                    <RotateCcw className="h-3.5 w-3.5" />
                                                    {member.status === "BANNED" ? "🛑 Débannir & Réintégrer" : "✅ Réactiver"}
                                                </DropdownMenuItem>
                                            )}

                                            {member.status === "ACTIVE" && (
                                                <DropdownMenuItem
                                                    onClick={() => handleStatusUpdate(member.id, "ARCHIVED")}
                                                    className="gap-2 focus:bg-amber-500/10 focus:text-amber-400 cursor-pointer"
                                                >
                                                    <UserX className="h-3.5 w-3.5" />
                                                    Archiver
                                                </DropdownMenuItem>
                                            )}

                                            <DropdownMenuItem
                                                onClick={() => handleStatusUpdate(member.id, "BANNED")}
                                                className="gap-2 focus:bg-red-500/10 focus:text-red-400 cursor-pointer"
                                            >
                                                <ShieldAlert className="h-3.5 w-3.5" />
                                                Bannir (SigilOS)
                                            </DropdownMenuItem>

                                            <DropdownMenuSeparator className="bg-white/5" />
                                            <DropdownMenuLabel className="text-[10px] text-zinc-600 font-black uppercase tracking-widest px-2 py-1.5 font-bold">Nouveau Membre</DropdownMenuLabel>

                                            <DropdownMenuItem
                                                onClick={() => setBadgeTarget({ id: member.id, name: member.user.name || "Membre" })}
                                                className="gap-2 focus:bg-amber-500/10 focus:text-amber-400 cursor-pointer"
                                            >
                                                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                                                Attribuer Badge {welcomeBadgeName}
                                            </DropdownMenuItem>

                                            <DropdownMenuItem
                                                onClick={() => handleWelcome(member.id, member.pseudoDofus || member.user.name || "Nouveau membre")}
                                                className="gap-2 focus:bg-violet-500/10 focus:text-violet-400 cursor-pointer"
                                            >
                                                <Send className="h-3.5 w-3.5 text-violet-500" />
                                                Souhaiter la Bienvenue
                                            </DropdownMenuItem>

                                            <DropdownMenuItem
                                                onClick={() => openIdDialog(member)}
                                                className="gap-2 focus:bg-indigo-500/10 focus:text-indigo-400 cursor-pointer"
                                            >
                                                <Edit className="h-3.5 w-3.5 text-indigo-400" />
                                                Modifier l'ID Dofus
                                            </DropdownMenuItem>

                                            <DropdownMenuItem
                                                onClick={() => setVacationTarget(member)}
                                                className="gap-2 focus:bg-cyan-500/10 focus:text-cyan-400 cursor-pointer"
                                            >
                                                <Palmtree className="h-3.5 w-3.5 text-cyan-400" />
                                                Modifier Vacances
                                            </DropdownMenuItem>

                                            <DropdownMenuItem
                                                onClick={() => handleUpdatePseudo(member.id)}
                                                className="gap-2 focus:bg-amber-500/10 focus:text-amber-400 cursor-pointer"
                                            >
                                                <Edit className="h-3.5 w-3.5" />
                                                Modifier le Pseudo Dofus
                                            </DropdownMenuItem>

                                            {/* DELETE — visible aux admins de guilde ET au superadmin (seulement profils non-actifs pour les non-superadmins) */}
                                            {(isAdmin || isSuperAdmin) && (
                                                <>
                                                    <DropdownMenuSeparator className="bg-white/5" />
                                                    {isSuperAdmin && (
                                                        <DropdownMenuItem
                                                            onClick={() => handleTransferOwnership(member.userId, member.pseudoDofus || member.user.name || "Membre")}
                                                            className="gap-2 focus:bg-violet-600 focus:text-white text-violet-400 cursor-pointer font-bold"
                                                        >
                                                            <UserCheck className="h-3.5 w-3.5" />
                                                            Promouvoir Propriétaire
                                                        </DropdownMenuItem>
                                                    )}
                                                    {/* Non-superadmin admins can only delete ARCHIVED/BANNED profiles */}
                                                    {(isSuperAdmin || member.status !== "ACTIVE") && (
                                                        <DropdownMenuItem
                                                            onClick={() => handleDelete(member.id)}
                                                            className="gap-2 focus:bg-red-600 focus:text-white text-red-400 cursor-pointer"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                            Supprimer définitivement
                                                        </DropdownMenuItem>
                                                    )}
                                                </>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

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
                                    className="bg-zinc-900/50 border-white/10 text-sm font-bold h-11 focus:ring-indigo-500/30"
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
                                    className="bg-zinc-900/50 border-white/10 text-sm font-bold text-center h-11 focus:ring-indigo-500/30"
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
                        <Button variant="ghost" onClick={() => setIdTarget(null)} className="font-bold text-zinc-500 hover:text-white uppercase text-[10px] tracking-widest">
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
        </div>
    );
}

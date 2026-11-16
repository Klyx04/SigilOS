"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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
    ChevronRight,
    ExternalLink,
    Loader2
} from "lucide-react";
import { getDisplayName, getGameDisplayName } from "@/lib/display-name";
import { formatDofusLevel, toTotalDofusLevel } from "@/lib/dofus-level";
import { buildAnkamaLadderUrl } from "@/lib/god-guild-owner";

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
import { deleteProfileByAdmin, reactivateProfileByAdmin, getGuildMemberBans, liftGuildMemberBan, deleteGuildMemberBan } from "@/server/actions/lifecycle-actions";
import { transferGuildOwnershipAction } from "@/server/actions/guild-owner-actions";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DiscordAvatarImage } from "@/components/shared/discord-avatar-image";
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
    /** Pseudo Dofus (ladder) saisi/synchronisé, distinct de `pseudoDofus` si les deux existent. */
    dofusPseudo?: string | null;
    /** Points de succès ladder (source : `UserProfile.achievementPoints`). */
    achievementPoints?: number | null;
    successPoints?: number | null;
    dofusLevel?: number | null;
    /** XP totale ladder, sérialisée en chaîne (BigInt). */
    totalXp?: string | number | null;
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
    /** Affiche les colonnes d'ID (Discord / Ankama). Faux quand le Registre les porte déjà. */
    showIds?: boolean;
    /** Serveur Dofus de la guilde : sert au lien ladder du membre. */
    dofusServerId?: number | null;
}

export function MemberManagementTable({ initialMembers, guildId, welcomeBadgeName, isSuperAdmin = false, isAdmin = false, ownerId = null, currentUserId = "", showIds = true, dofusServerId = null }: MemberManagementTableProps) {
    const [search, setSearch] = useState("");
    const [members, setMembers] = useState(initialMembers);
    const [activeTab, setActiveTab] = useState<"ALL" | "ACTIVE" | "ARCHIVED" | "BANNED" | "EXCLUDED">("ACTIVE");
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
    const [transferTarget, setTransferTarget] = useState<{ userId: string, memberName: string } | null>(null);
    const [confirmationGuildName, setConfirmationGuildName] = useState("");

    // ── F-01 : exclusions (tombstones) — membres supprimés/bannis dont le profil n'existe plus ──
    const [excludedBans, setExcludedBans] = useState<any[]>([]);

    const loadExcludedBans = useCallback(() => {
        getGuildMemberBans(guildId).then((res: any) => {
            if (res.success && Array.isArray(res.data)) setExcludedBans(res.data);
        }).catch(() => { /* non bloquant */ });
    }, [guildId]);

    useEffect(() => {
        loadExcludedBans();
    }, [loadExcludedBans]);

    const handleLiftExclusion = async (ban: any) => {
        if (!confirm(`Lever l'exclusion de ${ban.memberName || ban.discordId} ?\n\nLe membre pourra de nouveau accéder au dashboard s'il est toujours sur le serveur.`)) return;
        setIsUpdating(ban.discordId);
        try {
            const res = await liftGuildMemberBan(guildId, ban.discordId);
            if (res.success) {
                // F-01 (31/10/2026) : la levée ne fait que retirer le verrou. Si la personne n'est
                // plus sur le serveur Discord, elle n'existe dans **aucune** source : elle
                // n'apparaîtra pas dans les actifs. On le dit, au lieu de promettre un retour.
                const stillInGuild = members.some(m =>
                    m.user.accounts?.some(a => a.providerAccountId === ban.discordId),
                );
                toast.success(
                    stillInGuild
                        ? "Exclusion levée — le membre est toujours sur le serveur Discord."
                        : "Exclusion levée. Ce membre n'est plus sur le serveur Discord : il n'apparaîtra pas dans les actifs.",
                );
                setExcludedBans(prev => prev.filter(b => b.discordId !== ban.discordId));
            } else {
                toast.error(res.error || "Erreur lors de la levée d'exclusion");
            }
        } catch (e) {
            toast.error("Erreur de communication");
        } finally {
            setIsUpdating(null);
        }
    };

    /**
     * Suppression **définitive** d'une exclusion (31/10/2026) : une exclusion est une protection
     * contre le ré-provisionnement, pas une fiche. Quand l'admin a tranché, elle doit pouvoir
     * disparaître — sinon la liste se remplit à vie (mesure : **27** sur la bêta, aucune action).
     */
    const handleDeleteExclusion = async (ban: any) => {
        if (!confirm(
            `Supprimer définitivement l'exclusion de ${ban.memberName || ban.discordId} ?\n\n`
            + "• La protection contre un retour est retirée (il pourra être recréé s'il revient sur le serveur Discord).\n"
            + "• Le profil n'est pas modifié : pour débloquer un profil banni, utilisez « Lever l'exclusion ».\n"
            + "• L'action est journalisée."
        )) return;
        setIsUpdating(ban.discordId);
        try {
            const res = await deleteGuildMemberBan(guildId, ban.discordId);
            if (res.success) {
                toast.success("Exclusion supprimée définitivement");
                setExcludedBans(prev => prev.filter(b => b.discordId !== ban.discordId));
            } else {
                toast.error(res.error || "Erreur lors de la suppression");
            }
        } catch {
            toast.error("Erreur de communication");
        } finally {
            setIsUpdating(null);
        }
    };

    const filteredMembers = useMemo(() => {
        if (activeTab === "EXCLUDED") return [];
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
                name: getGameDisplayName(member) || "Membre" 
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
        const label = previousStatus === "BANNED" ? "Réintégrer" : "Réactiver";
        const warning = previousStatus === "BANNED"
            ? `⚠️ Réintégrer ce membre exclu ? Il pourra à nouveau accéder au dashboard.`
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
        if (!confirm(
            "⚠️ EXCLURE ce membre de SigilOS ?\n\n" +
            "IMPACTS RÉELS :\n" +
            "• Ses données SigilOS pour CETTE guilde (missions, succès, progression) sont définitivement supprimées.\n" +
            "• Si c'est sa SEULE guilde : son COMPTE entier (identifiant, connexion Discord, sessions) est effacé.\n" +
            "• Il GARDE son rôle Discord : sans protection, il serait réinstancié dès son prochain accès. On pose donc un blocage (tombstone) → il apparaît dans l'onglet « Exclus ».\n\n" +
            "Action RÉVERSIBLE : vous pouvez le RÉINTÉGRER depuis l'onglet « Exclus » à tout moment."
        )) return;

        setIsUpdating(profileId);
        try {
            const res = await deleteProfileByAdmin(guildId, profileId);
            if (res.success) {
                setMembers(prev => prev.filter(m => m.id !== profileId));
                toast.success("Membre exclu (réintégrable depuis l'onglet Exclus)");
                loadExcludedBans(); // F-01 : la suppression crée un tombstone → le membre ne peut plus être ré-provisionné
            } else {
                toast.error(res.error || "Erreur lors de la suppression");
            }
        } catch (error) {
            toast.error("Erreur de communication");
        } finally {
            setIsUpdating(null);
        }
    };

    const handleOpenTransferModal = (userId: string, memberName: string) => {
        setTransferTarget({ userId, memberName });
        setConfirmationGuildName("");
    };

    const handleExecuteTransferOwnership = async () => {
        if (!transferTarget) return;
        setIsUpdating(transferTarget.userId);
        try {
            const res = await transferGuildOwnershipAction(guildId, transferTarget.userId, confirmationGuildName);
            if (res.success) {
                toast.success(`Propriété transférée avec succès à ${res.newOwnerName || transferTarget.memberName} !`);
                setTransferTarget(null);
                window.location.reload();
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
        setIdTarget({ id: member.id, name: getGameDisplayName(member) || "Membre", currentId: member.ankamaId });
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
                <div className="flex bg-surface/50 p-1 rounded-xl border border-border">
                    {["ACTIVE", "ARCHIVED", "BANNED", "EXCLUDED", "ALL"].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${activeTab === tab
                                ? "bg-surface text-foreground"
                                : "text-muted-foreground hover:text-foreground hover:bg-surface"
                                }`}
                        >
                            {tab === "ACTIVE" ? "Actifs" : tab === "ARCHIVED" ? "Archivés" : tab === "BANNED" ? "Bannis" : tab === "EXCLUDED" ? "Exclus" : "Tous"}
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                        <SelectTrigger className="w-[170px] h-11 bg-muted/40 border-border rounded-xl text-xs font-medium whitespace-nowrap overflow-hidden pr-8">
                            <SelectValue placeholder="Rôle" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border-border rounded-xl">
                            <SelectItem value="all" className="text-xs font-medium">Tous les rôles</SelectItem>
                            {uniqueRoles.map(role => (
                                <SelectItem key={role} value={role!} className="text-xs font-medium">
                                    {role}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={joinedFilter} onValueChange={setJoinedFilter}>
                        <SelectTrigger className="w-[170px] h-11 bg-muted/40 border-border rounded-xl text-xs font-medium whitespace-nowrap overflow-hidden pr-8">
                            <SelectValue placeholder="Arrivée" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border-border rounded-xl">
                            <SelectItem value="all" className="text-xs font-medium">Toutes époques</SelectItem>
                            <SelectItem value="week" className="text-xs font-medium">{"< 1 semaine"}</SelectItem>
                            <SelectItem value="month" className="text-xs font-medium">{"< 1 mois"}</SelectItem>
                            <SelectItem value="old" className="text-xs font-medium">{"> 6 mois"}</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                        <Input
                            placeholder="Rechercher..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 bg-muted/40 border-border h-11 text-sm rounded-xl focus:border-border-strong transition-colors placeholder:text-muted-foreground font-medium"
                        />
                    </div>
                </div>
            </div>

            {activeTab === "EXCLUDED" ? (
                <div className="rounded-xl border border-border bg-surface/40 overflow-hidden">
                    {excludedBans.length === 0 ? (
                        <div className="h-40 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                            <ShieldAlert className="w-7 h-7 opacity-40" />
                            <p className="italic text-sm">Aucune exclusion active.</p>
                            <p className="text-xs text-muted-foreground">
                                Les membres bannis ou supprimés du dashboard apparaîtront ici (protection anti-ré-provisionnement).
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {excludedBans.map(ban => (
                                <div key={ban.id} className="flex items-center justify-between gap-4 px-6 md:px-8 py-5">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="h-10 w-10 rounded-xl bg-danger/10 border border-danger/20 flex items-center justify-center shrink-0">
                                            <ShieldAlert className="w-5 h-5 text-danger" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-semibold text-sm md:text-base text-foreground flex items-center gap-2 truncate">
                                                {/* #105 — nickname/pseudo du membre exclu (plus de simple ID Discord) */}
                                                <span className="truncate">{ban.memberName || ban.discordId}</span>
                                            </div>
                                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                                                <span className="text-muted-foreground font-mono normal-case">{ban.discordId}</span>
                                                <span>{ban.reason} · {formatDistanceToNow(new Date(ban.createdAt), { addSuffix: true, locale: fr })}</span>
                                                {ban.bannedByName ? <span>· par {ban.bannedByName}</span> : ""}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={isUpdating === ban.discordId}
                                            onClick={() => handleLiftExclusion(ban)}
                                            className="rounded-lg text-xs font-medium border-success/30 text-success hover:bg-success/10 hover:text-success"
                                        >
                                            {isUpdating === ban.discordId ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <UserCheck className="w-3.5 h-3.5 mr-2" />}
                                            Réintégrer
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={isUpdating === ban.discordId}
                                            onClick={() => handleDeleteExclusion(ban)}
                                            aria-label={`Supprimer définitivement l'exclusion de ${ban.memberName || ban.discordId}`}
                                            className="rounded-lg text-xs font-medium border-danger/30 text-danger hover:bg-danger/10 hover:text-danger"
                                        >
                                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                                            Supprimer
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
            <div className="rounded-xl border border-border bg-surface/40 overflow-x-auto no-scrollbar">
                <Table className="min-w-[800px] lg:min-w-0">
                    <TableHeader className="border-b border-border bg-surface">
                        <TableRow className="border-none hover:bg-transparent">
                            <TableHead className="py-4 pl-6 text-xs font-medium text-muted-foreground">Membre</TableHead>
                            <TableHead className="py-4 text-xs font-medium text-muted-foreground">Statut</TableHead>
                            <TableHead className="py-4">
                                <button
                                    onClick={() => setSortOrder(prev => prev === "desc" ? "asc" : "desc")}
                                    className="flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                                >
                                    Arrivée
                                    <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                                </button>
                            </TableHead>
                            <TableHead className="py-4 text-xs font-medium text-muted-foreground">Activité</TableHead>
                            {showIds && (
                                <>
                                    <TableHead className="py-4 text-xs font-medium text-muted-foreground">Discord ID</TableHead>
                                    <TableHead className="py-4 text-xs font-medium text-muted-foreground">Ankama ID</TableHead>
                                </>
                            )}
                            <TableHead className="py-4 text-xs font-medium text-muted-foreground">Suppression</TableHead>
                            <TableHead className="py-4 pr-6 text-right text-xs font-medium text-muted-foreground">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedMembers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={showIds ? 8 : 6} className="h-32 text-center text-muted-foreground italic">
                                        Aucun membre trouvé pour ces critères.
                                    </TableCell>
                                </TableRow>
                            ) : paginatedMembers.map((member) => {
                                // 🔒 Block destructive actions for self and Discord guild owner
                                const isSelf = !!currentUserId && member.userId === currentUserId;
                                const isOwner = !!ownerId && member.user.accounts[0]?.providerAccountId === ownerId;
                                const isProtected = isSelf || isOwner;
                                // Ladder : pseudo Dofus (ladder) + niveau + points + lien Ankama.
                                const dofusPseudo =
                                    member.pseudoDofus?.trim() || member.dofusPseudo?.trim() || null;
                                const memberLevel = toTotalDofusLevel(
                                    member.dofusLevel ?? null,
                                    member.totalXp ?? null,
                                );
                                const ladderPoints = member.achievementPoints ?? member.successPoints ?? null;
                                const ladderUrl = buildAnkamaLadderUrl(dofusPseudo, dofusServerId);

                                return (
                            <TableRow key={member.id} className="group border-b border-border hover:bg-surface transition-colors border-none">
                                <TableCell className="pl-8 py-5">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10 rounded-xl border border-border transition-colors group-hover:border-border-strong">
                                            <DiscordAvatarImage src={member.user.image || ""} className="rounded-xl object-cover" />
                                            <AvatarFallback className="rounded-xl bg-elevated text-xs font-semibold text-muted-foreground">
                                                {getDisplayName(member)?.[0] || "?"}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex min-w-0 flex-col leading-tight">
                                            <div className="flex flex-wrap items-center gap-2 text-base font-semibold text-foreground">
                                                {getGameDisplayName(member)}
                                                {member.user.accounts[0]?.providerAccountId === ownerId && (
                                                    <Crown className="h-3.5 w-3.5 text-warning" aria-label="Propriétaire" />
                                                )}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                @{getDisplayName(member)}
                                            </div>
                                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                                                {dofusPseudo ? (
                                                    <>
                                                        <span>
                                                            Dofus :{" "}
                                                            <span className="font-medium text-foreground">{dofusPseudo}</span>
                                                        </span>
                                                        <span>
                                                            ·{" "}
                                                            {memberLevel !== null
                                                                ? formatDofusLevel(memberLevel)
                                                                : "niveau non synchronisé"}
                                                        </span>
                                                        {ladderPoints !== null ? <span>· {ladderPoints} pts</span> : null}
                                                        {ladderUrl ? (
                                                            <a
                                                                href={ladderUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 font-medium text-foreground transition-colors hover:text-accent"
                                                            >
                                                                Ladder
                                                                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                                            </a>
                                                        ) : null}
                                                    </>
                                                ) : (
                                                    <span className="text-warning">Pseudo Dofus non renseigné</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1.5">
                                        <Badge
                                            variant="outline"
                                            className={`w-fit rounded-full px-2 py-1 text-caption font-medium ${
                                                member.status === "ACTIVE"
                                                    ? "border-success/20 bg-success/10 text-success"
                                                    : member.status === "ARCHIVED"
                                                        ? "border-warning/20 bg-warning/10 text-warning"
                                                        : "border-danger/20 bg-danger/10 text-danger"
                                            }`}
                                        >
                                            {member.status === "ACTIVE" && <UserCheck className="mr-1 h-3 w-3" />}
                                            {member.status === "ARCHIVED" && <Clock className="mr-1 h-3 w-3" />}
                                            {member.status === "BANNED" && <ShieldAlert className="mr-1 h-3 w-3" />}
                                            {member.status === "ACTIVE" ? "Actif" : member.status === "ARCHIVED" ? "Archivé" : "Banni"}
                                        </Badge>
                                        {member.vacationStart && (
                                            <Badge 
                                                variant="outline" 
                                                onClick={() => setVacationTarget(member)}
                                                className="w-fit cursor-pointer rounded-lg border-info/20 bg-info/10 px-2 py-1 text-xs font-medium text-info transition-colors hover:bg-info/20"
                                            >
                                                <Palmtree className="w-2.5 h-2.5 mr-1" />
                                                Vacances
                                            </Badge>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-xs font-medium text-muted-foreground tabular-nums">
                                    {new Date(member.createdAt).toLocaleDateString("fr-FR", { day: 'numeric', month: 'short', year: 'numeric' })}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(member.updatedAt ?? member.archivedAt ?? new Date()), { addSuffix: true, locale: fr })}
                                </TableCell>
                                {showIds && (
                                    <TableCell>
                                        <div 
                                            onClick={() => copyToClipboard(member.user.accounts[0]?.providerAccountId || "", "ID Discord")}
                                            className="flex items-center gap-2 group/copy cursor-pointer w-fit"
                                        >
                                            <code className="text-caption px-2 py-1 rounded bg-elevated text-muted-foreground font-mono border border-border group-hover/copy:border-border-strong transition-all">
                                                {member.user.accounts[0]?.providerAccountId || "Unknown"}
                                            </code>
                                            <Copy className="w-3 h-3 text-muted-foreground group-hover/copy:text-muted-foreground opacity-0 group-hover/copy:opacity-100 transition-all" />
                                        </div>
                                    </TableCell>
                                )}
                                {showIds && (
                                    <TableCell>
                                        {member.ankamaId ? (
                                            <div 
                                                onClick={() => copyToClipboard(member.ankamaId!, "ID Dofus")}
                                                className="flex items-center gap-2 group/id relative cursor-pointer w-fit"
                                            >
                                                <div className="px-2 py-1 rounded bg-info/20 border border-info/40 group-hover/id:border-info transition-all">
                                                    <span className="text-xs font-medium text-info font-mono tracking-tight">{member.ankamaId}</span>
                                                </div>
                                                <Copy className="w-3 h-3 text-info group-hover/id:text-info opacity-0 group-hover/id:opacity-100 transition-all" />
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => openIdDialog(member)}
                                                className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                                            >
                                                <Edit className="w-3 h-3" />
                                                Ajouter ID
                                            </button>
                                        )}
                                    </TableCell>
                                )}
                                <TableCell>
                                    {member.scheduledDeletion ? (() => {
                                        const deletionDate = new Date(member.scheduledDeletion);
                                        const now = new Date();
                                        const diffTime = deletionDate.getTime() - now.getTime();
                                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                        const isUrgent = diffDays <= 2;

                                        return (
                                            <div className="flex flex-col gap-1">
                                                <div className={`flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium ${
                                                    isUrgent ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'
                                                }`}>
                                                    <Clock className="w-3 h-3" />
                                                    {diffDays <= 0 ? "Imminent" : `J-${diffDays}`}
                                                </div>
                                                <span className="text-caption text-muted-foreground font-medium italic pl-1">
                                                    {format(deletionDate, "dd/MM HH:mm")}
                                                </span>
                                            </div>
                                        );
                                    })() : (
                                        <span className="pl-2 text-xs text-muted-foreground">
                                            -
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell className="pr-8 text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" disabled={isUpdating === member.id}>
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-60 rounded-xl border border-border bg-background text-foreground">
                                            <DropdownMenuLabel className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                                                Actions
                                            </DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            {member.status !== "ACTIVE" && (isAdmin || isSuperAdmin) && (
                                                <DropdownMenuItem onClick={() => handleReactivate(member.id, member.status as "ARCHIVED" | "BANNED")} className="cursor-pointer gap-2 text-sm focus:bg-success/10 focus:text-success">
                                                    <RotateCcw className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                                                    {member.status === "BANNED" ? "Réintégrer" : "Réactiver"}
                                                </DropdownMenuItem>
                                            )}
                                            {member.status === "ACTIVE" && !isProtected && (
                                                <DropdownMenuItem onClick={() => handleStatusUpdate(member.id, "ARCHIVED")} className="cursor-pointer gap-2 text-sm focus:bg-warning/10 focus:text-warning">
                                                    <UserX className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
                                                    Archiver
                                                </DropdownMenuItem>
                                            )}
                                            {!isProtected && (
                                                <DropdownMenuItem onClick={() => handleStatusUpdate(member.id, "BANNED")} className="cursor-pointer gap-2 text-sm focus:bg-danger/10 focus:text-danger">
                                                    <ShieldAlert className="h-3.5 w-3.5 text-danger" aria-hidden="true" />
                                                    Bannir de la guilde (profil conservé)
                                                </DropdownMenuItem>
                                            )}
                                            {isProtected && (
                                                <DropdownMenuItem disabled className="cursor-not-allowed gap-2 text-sm text-muted-foreground">
                                                    <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                                                    {isSelf ? "Ton compte" : "Propriétaire protégé"}
                                                </DropdownMenuItem>
                                            )}
                                            <DropdownMenuSeparator />
                                            <DropdownMenuLabel className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                                                Fiche Dofus
                                            </DropdownMenuLabel>
                                            <DropdownMenuItem onClick={() => handleUpdatePseudo(member.id)} className="cursor-pointer gap-2 text-sm focus:bg-warning/10 focus:text-warning">
                                                <Edit className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
                                                Pseudo Dofus
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => openIdDialog(member)} className="cursor-pointer gap-2 text-sm focus:bg-info/10 focus:text-info">
                                                <Edit className="h-3.5 w-3.5 text-info" aria-hidden="true" />
                                                ID Dofus
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setVacationTarget(member)} className="cursor-pointer gap-2 text-sm focus:bg-info/10 focus:text-info">
                                                <Palmtree className="h-3.5 w-3.5 text-info" aria-hidden="true" />
                                                Indisponibilité
                                            </DropdownMenuItem>
                                            {(isAdmin || isSuperAdmin) && (
                                                <>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuLabel className="px-2 py-1.5 text-xs font-medium text-danger">
                                                        Danger
                                                    </DropdownMenuLabel>
                                                    {(isSuperAdmin || (ownerId && currentUserId === ownerId)) && !isProtected && member.status === "ACTIVE" && (
                                                        <DropdownMenuItem onClick={() => handleOpenTransferModal(member.userId, getGameDisplayName(member) || "Membre")} className="cursor-pointer gap-2 text-sm text-warning focus:bg-warning/15 focus:text-warning">
                                                            <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                                                            Transférer la propriété
                                                        </DropdownMenuItem>
                                                    )}
                                                    {(isSuperAdmin || member.status !== "ACTIVE") && !isProtected && (
                                                        <DropdownMenuItem onClick={() => handleDelete(member.id)} className="cursor-pointer gap-2 text-sm text-danger focus:bg-danger/10 focus:text-danger">
                                                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                                            Exclure (profil supprimé)
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
            )}

            {/* Pagination UI */}
            {totalPages > 1 && (
                <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-border bg-surface/20 px-4 py-3 sm:flex-row">
                    <div className="text-xs text-muted-foreground">
                        Affichage de {Math.min(filteredMembers.length, (currentPage - 1) * pageSize + 1)} à {Math.min(filteredMembers.length, currentPage * pageSize)} sur {filteredMembers.length} membres
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
                            <span className="text-xs font-medium text-foreground tabular-nums">{currentPage}</span>
                            <span className="text-xs text-muted-foreground">/</span>
                            <span className="text-xs text-muted-foreground tabular-nums">{totalPages}</span>
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
                <DialogContent className="sm:max-w-[425px] bg-background border-border text-foreground p-0 overflow-hidden rounded-xl">
                    <div className="p-6 pb-2">
                        <DialogHeader>
                            <div className="w-12 h-12 rounded-xl bg-info/10 border border-info/20 flex items-center justify-center mb-4">
                                <Edit className="w-6 h-6 text-info" />
                            </div>
                            <DialogTitle className="text-lg font-semibold tracking-tight">ID Dofus (Ankama)</DialogTitle>
                            <DialogDescription className="text-muted-foreground">
                                Mise à jour de l'ID pour <span className="text-foreground font-semibold">{idTarget?.name}</span>. Respectez le format Nom#0000.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="px-6 py-6 space-y-6">
                        <div className="p-4 rounded-xl bg-surface border border-border flex items-center gap-3">
                            <div className="flex-1 space-y-2">
                                <label className="pl-1 text-xs font-medium text-muted-foreground">Nom / Pseudo</label>
                                <Input 
                                    placeholder="Nom"
                                    value={namePart}
                                    onChange={(e) => setNamePart(e.target.value)}
                                    className="bg-surface/50 border-border text-sm font-medium h-11 rounded-xl"
                                    maxLength={50}
                                />
                            </div>
                            <div className="pt-6 text-lg font-medium text-muted-foreground">#</div>
                            <div className="w-24 space-y-2">
                                <label className="pl-1 text-xs font-medium text-muted-foreground">4 Chiffres</label>
                                <Input 
                                    placeholder="0000"
                                    value={digitsPart}
                                    onChange={(e) => setDigitsPart(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                    className="bg-surface/50 border-border text-sm font-medium text-center h-11 rounded-xl"
                                    maxLength={4}
                                />
                            </div>
                        </div>

                        {!isIdValid && (namePart || digitsPart) && (
                            <div className="p-3 rounded-xl bg-danger/5 border border-danger/10 flex items-start gap-3">
                                <ShieldAlert className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                                <p className="text-caption text-muted-foreground leading-relaxed italic">
                                    Format invalide : Le nom doit faire max 50 caractères et il faut exactement 4 chiffres après le #.
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="px-6 py-4 bg-surface flex justify-end gap-3 lg:gap-2">
                        <Button variant="ghost" onClick={() => setIdTarget(null)} className="rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground">
                            Annuler
                        </Button>
                        <Button 
                            onClick={handleSaveAnkamaId}
                            disabled={!isIdValid || isUpdating === idTarget?.id}
                            className={`bg-info hover:bg-info/90 text-info-foreground text-sm font-medium px-6 py-2 rounded-lg transition-colors ${isIdValid ? '' : 'opacity-50'}`}
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
                    memberName={getGameDisplayName(vacationTarget) || "Membre"}
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

            {transferTarget && (
                <Dialog open={!!transferTarget} onOpenChange={(open) => !open && setTransferTarget(null)}>
                    <DialogContent className="sm:max-w-[460px] bg-background border-border text-foreground p-0 overflow-hidden rounded-xl">
                        <div className="p-6 space-y-4">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight text-warning">
                                    <ShieldAlert className="w-5 h-5" />
                                    Transférer la Propriété de Guilde
                                </DialogTitle>
                                <DialogDescription className="text-muted-foreground text-sm space-y-2 pt-2">
                                    <p>
                                        Vous êtes sur le point de transférer la <strong>propriété totale</strong> de cet espace SigilOS à <strong className="text-foreground">{transferTarget.memberName}</strong>.
                                    </p>
                                    <p className="text-xs font-semibold text-danger/90">
                                        ⚠️ Cette action est irréversible. Vous céderez vos droits d'administrateur principal.
                                    </p>
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-2 pt-2">
                                <label className="text-xs font-medium text-muted-foreground">
                                    Tapez le nom de la guilde pour confirmer :
                                </label>
                                <Input
                                    value={confirmationGuildName}
                                    onChange={(e) => setConfirmationGuildName(e.target.value)}
                                    placeholder="Nom exact de la guilde"
                                    className="bg-surface border-border text-foreground"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-surface/50 border-t border-border flex justify-end gap-3">
                            <Button 
                                variant="ghost" 
                                onClick={() => setTransferTarget(null)} 
                                className="text-sm font-medium text-muted-foreground hover:text-foreground"
                            >
                                Annuler
                            </Button>
                            <Button
                                onClick={handleExecuteTransferOwnership}
                                disabled={!confirmationGuildName.trim() || isUpdating === transferTarget.userId}
                                className="rounded-lg bg-warning px-6 text-sm font-medium text-warning-foreground hover:bg-warning/90"
                            >
                                {isUpdating === transferTarget.userId ? "Transfert en cours..." : "Confirmer le Transfert"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}

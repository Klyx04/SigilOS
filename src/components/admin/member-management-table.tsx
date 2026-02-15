"use client";

import { useState } from "react";
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
    Trash2
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
import { Badge } from "@/components/ui/badge";
import { updateMemberProfileStatus } from "@/server/actions/user-actions";
import { deleteProfileByAdmin } from "@/server/actions/lifecycle-actions";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface Member {
    id: string;
    userId: string;
    status: "ACTIVE" | "ARCHIVED" | "BANNED";
    updatedAt: Date;
    archivedAt: Date | null;
    archiveReason: string | null;
    user: {
        name: string | null;
        image: string | null;
        accounts: Array<{ providerAccountId: string }>;
    };
}

interface MemberManagementTableProps {
    initialMembers: Member[];
    guildId: string;
}

export function MemberManagementTable({ initialMembers, guildId }: MemberManagementTableProps) {
    const [search, setSearch] = useState("");
    const [members, setMembers] = useState(initialMembers);
    const [activeTab, setActiveTab] = useState<"ALL" | "ACTIVE" | "ARCHIVED" | "BANNED">("ACTIVE");
    const [isUpdating, setIsUpdating] = useState<string | null>(null);

    const filteredMembers = members
        .filter((member: Member) =>
            activeTab === "ALL" || member.status === activeTab
        )
        .filter((member: Member) =>
            member.user.name?.toLowerCase().includes(search.toLowerCase()) ||
            member.user.accounts[0]?.providerAccountId.includes(search)
        );

    const handleStatusUpdate = async (profileId: string, status: "ACTIVE" | "ARCHIVED" | "BANNED") => {
        setIsUpdating(profileId);
        try {
            await updateMemberProfileStatus(profileId, status);
            setMembers(prev => prev.map(m =>
                m.id === profileId ? { ...m, status, updatedAt: new Date() } : m
            ));
            toast.success(`Statut mis à jour : ${status}`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Erreur lors de la mise à jour");
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

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-white/5">
                    {["ACTIVE", "ARCHIVED", "BANNED", "ALL"].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab
                                ? "bg-violet-500 text-white shadow-lg"
                                : "text-zinc-500 hover:text-zinc-300"
                                }`}
                        >
                            {tab === "ACTIVE" ? "Actifs" : tab === "ARCHIVED" ? "Archivés" : tab === "BANNED" ? "Bannis" : "Tous"}
                        </button>
                    ))}
                </div>

                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <Input
                        placeholder="Rechercher..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10 bg-zinc-900/50 border-white/10 h-9 text-sm"
                    />
                </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-zinc-900/20 overflow-hidden">
                <Table>
                    <TableHeader className="bg-white/5">
                        <TableRow className="hover:bg-transparent">
                            <TableHead>Membre</TableHead>
                            <TableHead>ID Discord</TableHead>
                            <TableHead>Statut</TableHead>
                            <TableHead>Dernière activité</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredMembers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-32 text-center text-zinc-500">
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
                                        <div className="font-medium text-sm text-white">
                                            {member.user.name}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <code className="text-[10px] px-2 py-1 rounded bg-zinc-800 text-zinc-400 font-mono">
                                        {member.user.accounts[0]?.providerAccountId || "Unknown"}
                                    </code>
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant="outline"
                                        className={`capitalize text-[10px] font-black tracking-widest ${member.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                            member.status === "ARCHIVED" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                                "bg-red-500/10 text-red-400 border-red-500/20"
                                            }`}
                                    >
                                        {member.status === "ACTIVE" && <UserCheck className="w-2.5 h-2.5 mr-1" />}
                                        {member.status === "ARCHIVED" && <Clock className="w-2.5 h-2.5 mr-1" />}
                                        {member.status === "BANNED" && <ShieldAlert className="w-2.5 h-2.5 mr-1" />}
                                        {member.status.toLowerCase()}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-zinc-500">
                                    {formatDistanceToNow(new Date(member.updatedAt || member.archivedAt || new Date()), { addSuffix: true, locale: fr })}
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

                                            {member.status !== "ACTIVE" && (
                                                <DropdownMenuItem
                                                    onClick={() => handleStatusUpdate(member.id, "ACTIVE")}
                                                    className="gap-2 focus:bg-emerald-500/10 focus:text-emerald-400 cursor-pointer"
                                                >
                                                    <RotateCcw className="h-3.5 w-3.5" />
                                                    {member.status === "BANNED" ? "Débannir" : "Réactiver"}
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

                                            <DropdownMenuItem
                                                onClick={() => handleDelete(member.id)}
                                                className="gap-2 focus:bg-red-600 focus:text-white text-red-400 cursor-pointer"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                                Supprimer définitivement
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

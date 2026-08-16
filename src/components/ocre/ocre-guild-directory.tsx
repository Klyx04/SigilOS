"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
    Search, 
    Users, 
    CheckCircle2, 
    XCircle, 
    AlertCircle, 
    Clock, 
    Shield, 
    ArrowRight, 
    RefreshCw,
    ExternalLink
} from "lucide-react";
import { getGuildMetamobDirectory, type MetamobDirectoryMember } from "@/server/actions/ocre-actions";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import Image from "next/image";
import { getDisplayName } from "@/lib/display-name";


interface OcreGuildDirectoryProps {
    guildId: string;
}

export function OcreGuildDirectory({ guildId }: OcreGuildDirectoryProps) {
    const [members, setMembers] = useState<MetamobDirectoryMember[]>([]);
    const [filteredMembers, setFilteredMembers] = useState<MetamobDirectoryMember[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "linked" | "unlinked">("all");
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    const fetchDirectory = async () => {
        setLoading(true);
        const res = await getGuildMetamobDirectory(guildId);
        if (res.success && res.data) {
            setMembers(res.data);
            setFilteredMembers(res.data);
        } else {
            toast.error(res.error || "Impossible de charger l'annuaire");
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchDirectory();
    }, [guildId]);

    // Filter logic
    useEffect(() => {
        let result = members;

        // Search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            result = result.filter(m => 
                (m.user.name && m.user.name.toLowerCase().includes(query)) ||
                (m.pseudoDofus && m.pseudoDofus.toLowerCase().includes(query)) ||
                (m.metamobPseudo && m.metamobPseudo.toLowerCase().includes(query))
            );
        }

        // Status filter
        if (statusFilter === "linked") {
            result = result.filter(m => m.metamobVerified && m.metamobPseudo);
        } else if (statusFilter === "unlinked") {
            result = result.filter(m => !m.metamobVerified || !m.metamobPseudo);
        }

        setFilteredMembers(result);
    }, [searchQuery, statusFilter, members]);

    const getProgressColor = (percent?: number) => {
        if (!percent) return "bg-muted";
        if (percent === 100) return "bg-success";
        if (percent > 70) return "bg-success";
        if (percent > 30) return "bg-warning";
        return "bg-danger";
    };

    return (
        <div className="space-y-6">
            {/* Header controls */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Rechercher un membre, pseudo Dofus ou Metamob..."
                        className="pl-10 h-11 bg-surface/50 border-border rounded-2xl text-xs placeholder:text-muted-foreground focus-visible:ring-warning/30 transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Filter buttons */}
                <div className="flex items-center gap-1.5 p-1 bg-surface/50 border border-border rounded-2xl shrink-0">
                    <Button
                        size="sm"
                        variant="ghost"
                        className={`h-9 px-4 rounded-xl text-xs font-bold transition-all ${
                            statusFilter === "all"
                                ? "bg-elevated text-warning border border-warning/10 shadow-lg"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => setStatusFilter("all")}
                    >
                        Tous ({members.length})
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className={`h-9 px-4 rounded-xl text-xs font-bold transition-all ${
                            statusFilter === "linked"
                                ? "bg-elevated text-success border border-success/10 shadow-lg"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => setStatusFilter("linked")}
                    >
                        Liés ({members.filter(m => m.metamobVerified).length})
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className={`h-9 px-4 rounded-xl text-xs font-bold transition-all ${
                            statusFilter === "unlinked"
                                ? "bg-elevated text-danger border border-danger/10 shadow-lg"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => statusFilter !== "unlinked" ? setStatusFilter("unlinked") : setStatusFilter("all")}
                    >
                        Non liés ({members.filter(m => !m.metamobVerified).length})
                    </Button>

                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 rounded-xl hover:bg-elevated text-muted-foreground hover:text-foreground"
                        onClick={fetchDirectory}
                        disabled={loading}
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-warning" : ""}`} />
                    </Button>
                </div>
            </div>

            {/* Grid of members */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <Card key={i} className="bg-card/20 border-border h-44 animate-pulse">
                            <CardContent className="p-5 flex gap-4">
                                <div className="h-12 w-12 rounded-2xl bg-elevated" />
                                <div className="flex-1 space-y-2 mt-1">
                                    <div className="h-4 bg-elevated rounded w-2/3" />
                                    <div className="h-3 bg-elevated rounded w-1/2" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : filteredMembers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center bg-surface/20 rounded-3xl border border-dashed border-border">
                    <Users className="h-16 w-16 text-muted-foreground/10 mb-4" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground/60">Aucun membre trouvé</h3>
                    <p className="text-xs text-muted-foreground/40 mt-1 max-w-xs leading-relaxed">
                        Ajustez vos filtres ou vérifiez l&apos;orthographe de votre recherche.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredMembers.map((member) => {
                        const isLinked = member.metamobVerified && member.metamobPseudo;
                        const hasSnapshot = member.progressPercent !== undefined;

                        return (
                            <Card 
                                key={member.id} 
                                className={`relative group overflow-hidden bg-card/20 backdrop-blur-md border border-border hover:border-border hover:bg-card/30 transition-all duration-300 ${
                                    isLinked ? "" : "opacity-80 hover:opacity-100"
                                }`}
                            >
                                <CardContent className="p-5 flex flex-col justify-between h-full min-h-[170px] gap-4">
                                    <div className="flex gap-4 items-start">
                                        {/* Avatar */}
                                        <div className="relative h-12 w-12 rounded-2xl overflow-hidden border border-border shrink-0 bg-background/50 flex items-center justify-center group- transition-transform">
                                            {member.user.image ? (
                                                <Image 
                                                    src={member.user.image} 
                                                    alt={getDisplayName(member) || "Avatar"} 
                                                    fill 
                                                    sizes="48px"
                                                    className="object-cover" 
                                                />
                                            ) : (
                                                <Users className="h-5 w-5 text-muted-foreground" />
                                            )}
                                        </div>

                                        {/* Identity */}
                                        <div className="flex-1 min-w-0 space-y-1">
                                            <div className="flex items-center gap-1.5 justify-between">
                                                <span className="font-bold text-sm text-foreground truncate block leading-tight">
                                                    {getDisplayName(member) || "Dofusien"}
                                                </span>
                                                {isLinked ? (
                                                    <Badge className="bg-success/10 text-success border-none px-2 py-0.5 text-caption font-black tracking-wider uppercase shrink-0">
                                                        Lié
                                                    </Badge>
                                                ) : (
                                                    <Badge className="bg-danger/10 text-danger border-none px-2 py-0.5 text-caption font-black tracking-wider uppercase shrink-0">
                                                        Non lié
                                                    </Badge>
                                                )}
                                            </div>

                                            <div className="flex flex-col gap-0.5 text-caption text-muted-foreground">
                                                {member.pseudoDofus && (
                                                    <span className="truncate">
                                                        Dofus : <span className="text-foreground font-semibold">{member.pseudoDofus}</span>
                                                    </span>
                                                )}
                                                {isLinked && member.metamobPseudo && (
                                                    <span className="truncate flex items-center gap-1">
                                                        Metamob : 
                                                        <a 
                                                            href={`https://www.metamob.fr/profile/${encodeURIComponent(member.metamobPseudo)}`} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="text-warning hover:text-warning font-bold hover:underline transition-colors flex items-center gap-0.5"
                                                        >
                                                            {member.metamobPseudo}
                                                            <ExternalLink className="h-2.5 w-2.5 inline" />
                                                        </a>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stats & Progress */}
                                    {isLinked ? (
                                        <div className="space-y-2 pt-2 border-t border-border">
                                            {hasSnapshot ? (
                                                <>
                                                    <div className="flex items-center justify-between text-caption">
                                                        <span className="text-muted-foreground">
                                                            {member.serverName || "Serveur"}
                                                            <span className="opacity-30 mx-1.5">•</span>
                                                            Étape {member.currentStep ?? 0}
                                                        </span>
                                                        <span className="font-extrabold text-foreground">
                                                            {member.progressPercent}%
                                                        </span>
                                                    </div>
                                                    <div className="relative">
                                                        <Progress 
                                                            value={member.progressPercent ?? 0} 
                                                            className="h-1.5" 
                                                            indicatorClassName={getProgressColor(member.progressPercent)}
                                                        />
                                                    </div>
                                                    {member.metamobLastSync && (
                                                        <div className="flex items-center gap-1 text-caption text-muted-foreground italic mt-1 justify-end">
                                                            <Clock className="h-2.5 w-2.5" />
                                                            Sync {formatDistanceToNow(new Date(member.metamobLastSync), { addSuffix: true, locale: fr })}
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="flex items-center gap-2 p-2.5 bg-warning/5 border border-warning/10 rounded-xl">
                                                    <AlertCircle className="h-4 w-4 text-warning shrink-0" />
                                                    <span className="text-caption text-warning font-semibold leading-normal">
                                                        Compte lié mais aucune synchronisation effectuée.
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center p-4 bg-background/40 rounded-xl border border-border text-center mt-2">
                                            <span className="text-caption text-muted-foreground italic leading-normal">
                                                Ce membre n&apos;a pas configuré son compte Metamob. Les échanges automatiques ne sont pas disponibles.
                                            </span>
                                        </div>
                                    )}
                                </CardContent>

                                {/* Aesthetic border glow on hover */}
                                <div className="absolute inset-0 bg-gradient-to-r from-warning/0 via-warning/5 to-warning/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none -z-10" />
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

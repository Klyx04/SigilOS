"use client";

import { useEffect, useRef, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Users, Search, X, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { searchGuildMembers, type GuildMemberSearchResult } from "@/server/actions/search-actions";
import { getClass } from "@/lib/dofus-assets";
import { ClassIcon } from "@/components/shared/class-icon";

interface ActiveUser {
    id: string;
    name: string;
    image: string | null;
    lastActive: Date | null;
    isAfk?: boolean;
}

interface PresenceModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    users: ActiveUser[];
    canSearch?: boolean;
}

export function PresenceModal({ isOpen, onOpenChange, users, canSearch = false }: PresenceModalProps) {
    const { guildId } = useParams() as { guildId: string };

    // ─── Recherche membre (scopée guilde, fail-closed côté serveur) ─────────
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<GuildMemberSearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isSearchActive = query.trim().length >= 2;

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (!isSearchActive) {
            setResults([]);
            setSearching(false);
            return;
        }

        setSearching(true);
        debounceRef.current = setTimeout(async () => {
            const res = await searchGuildMembers(guildId, query.trim());
            setResults(res);
            setSearching(false);
        }, 250);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [query, isSearchActive, guildId]);

    // Réinitialiser la recherche à chaque ouverture
    useEffect(() => {
        if (isOpen) {
            setQuery("");
            setResults([]);
            setSearching(false);
        }
    }, [isOpen]);

    const memberClass = (classe: string | null) => (classe ? getClass(classe) : null);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="bg-background border-border sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-foreground uppercase tracking-widest text-sm font-black">
                        <Users className="w-4 h-4 text-info" />
                        {isSearchActive ? "Recherche de membres" : `Membres En Ligne (${users.length})`}
                    </DialogTitle>
                </DialogHeader>

                {canSearch && (
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Chercher un membre de la guilde…"
                            aria-label="Rechercher un membre de la guilde"
                            autoComplete="off"
                            maxLength={60}
                            className="w-full h-10 rounded-xl bg-surface border border-border pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-info/50 transition-colors"
                        />
                        {query && (
                            <button
                                type="button"
                                onClick={() => setQuery("")}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                                aria-label="Effacer la recherche"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                )}

                <div className="mt-4 space-y-2.5 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    {isSearchActive ? (
                        searching ? (
                            <div className="py-8 flex flex-col items-center gap-3">
                                <Loader2 className="w-6 h-6 animate-spin text-info" />
                                <p className="text-xs text-muted-foreground">Recherche dans la guilde…</p>
                            </div>
                        ) : results.length > 0 ? (
                            results.map((member) => {
                                const cls = memberClass(member.classe);
                                return (
                                    <Link
                                        key={member.profileId}
                                        href={`/dashboard/${guildId}/members/${encodeURIComponent(member.slug)}`}
                                        onClick={() => onOpenChange(false)}
                                        className="flex items-center gap-3 p-2.5 rounded-xl bg-surface border border-border hover:border-info/40 hover:bg-surface transition-colors group"
                                    >
                                        <div className="relative">
                                            <Avatar className="h-10 w-10 border border-border group-hover:border-info/50 transition-all">
                                                <AvatarImage src={member.image || ""} />
                                                <AvatarFallback className="bg-elevated text-xs font-bold">
                                                    {member.name.substring(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-sm font-bold text-foreground group-hover:text-foreground transition-colors truncate">
                                                {member.name}
                                            </span>
                                            <span className="text-caption font-medium text-muted-foreground truncate">
                                                {member.pseudoDofus
                                                    ? <>Dofus : <span className="text-info/80">{member.pseudoDofus}</span></>
                                                    : "Membre de la guilde"}
                                                {cls && (
                                                    <span className="inline-flex items-center gap-1 ml-2">
                                                        <ClassIcon classId={member.classe as never} size={11} />
                                                        {cls.name}
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    </Link>
                                );
                            })
                        ) : (
                            <div className="py-8 text-center">
                                <p className="text-muted-foreground text-sm">Aucun membre trouvé pour « {query.trim()} ».</p>
                            </div>
                        )
                    ) : users.length > 0 ? (
                        users.map((user) => {
                            const lastActiveDate = user.lastActive ? new Date(user.lastActive) : null;
                            const diffMinutes = lastActiveDate ? (Date.now() - lastActiveDate.getTime()) / 60000 : 0;
                            const isAfk = user.isAfk || diffMinutes > 15;

                            return (
                                <div key={user.id} className="flex items-center justify-between p-2.5 rounded-xl bg-surface border border-border hover:border-border transition-colors group">
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <Avatar className={`h-10 w-10 border transition-all ${isAfk ? 'border-warning/40 group-hover:border-warning' : 'border-border group-hover:border-success/50'}`}>
                                                <AvatarImage src={user.image || ""} />
                                                <AvatarFallback className="bg-elevated text-xs font-bold">
                                                    {(user.name || "??").substring(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>

                                            {/* Status Indicator Light: Yellow/Amber if AFK > 15min, Green if Active <= 15min */}
                                            <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 border-2 border-[#09090b] rounded-full transition-all ${
                                                isAfk 
                                                    ? 'bg-warning ' 
                                                    : 'bg-success '
                                            }`} />
                                        </div>
                                        <div className="flex flex-col">
                                            <Link href={`/dashboard/${guildId}/members/${user.id}`} onClick={() => onOpenChange(false)}>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-foreground group-hover:text-foreground transition-colors cursor-pointer hover:underline">{user.name}</span>
                                                    {isAfk && (
                                                        <span className="px-1.5 py-0.5 rounded text-caption font-black uppercase tracking-wider bg-warning/10 text-warning border border-warning/20">
                                                            AFK
                                                        </span>
                                                    )}
                                                </div>
                                            </Link>
                                            <span className={`text-caption font-medium ${isAfk ? 'text-warning/80' : 'text-muted-foreground'}`}>
                                                {isAfk 
                                                    ? (lastActiveDate ? `AFK depuis ${formatDistanceToNow(lastActiveDate, { locale: fr })}` : "AFK (> 15 min)")
                                                    : (lastActiveDate ? `Actif ${formatDistanceToNow(lastActiveDate, { addSuffix: true, locale: fr })}` : "Actif à l'instant")
                                                }
                                            </span>
                                        </div>
                                    </div>
                                    <div className={`h-2 w-2 rounded-full animate-pulse ${isAfk ? 'bg-warning' : 'bg-success'}`} />
                                </div>
                            );
                        })
                    ) : (
                        <div className="py-8 text-center">
                            <p className="text-muted-foreground italic text-sm">Personne n'est connecté pour le moment.</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

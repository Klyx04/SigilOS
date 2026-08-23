"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Loader2, User } from "lucide-react";
import { searchGuildMembers } from "@/server/actions/user-actions";

interface MemberResult {
    id: string;
    name: string;
    subtitle?: string;
    image?: string | null;
}

interface MemberSearchModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    guildId: string;
    onSelect: (member: MemberResult) => void;
    excludeIds?: string[];
    title?: string;
}

export function MemberSearchModal({
    open,
    onOpenChange,
    guildId,
    onSelect,
    excludeIds = [],
    title = "Sélectionner un membre",
}: MemberSearchModalProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<MemberResult[]>([]);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    // Focus input on open
    useEffect(() => {
        if (open) {
            setQuery("");
            setResults([]);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [open]);

    const doSearch = useCallback(
        async (q: string) => {
            if (q.length < 2) {
                setResults([]);
                return;
            }
            setLoading(true);
            try {
                const res = await searchGuildMembers(guildId, q);
                if (res.success && res.data) {
                    setResults(
                        res.data.filter((m: MemberResult) => !excludeIds.includes(m.id))
                    );
                }
            } catch {
                // silently fail
            } finally {
                setLoading(false);
            }
        },
        [guildId, excludeIds]
    );

    const handleQueryChange = (value: string) => {
        setQuery(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => doSearch(value), 300);
    };

    const handleSelect = (member: MemberResult) => {
        onSelect(member);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-sm bg-background border-border text-foreground">
                <DialogHeader>
                    <DialogTitle className="text-base font-black flex items-center gap-2">
                        <User className="h-4 w-4 text-info" />
                        {title}
                    </DialogTitle>
                </DialogHeader>

                {/* Search Input */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => handleQueryChange(e.target.value)}
                        placeholder="Rechercher par pseudo, nom Discord..."
                        className="pl-10 bg-surface border-border text-foreground placeholder:text-muted-foreground"
                        autoComplete="off"
                    />
                    {loading && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-info animate-spin" />
                    )}
                </div>

                {/* Results */}
                <div className="max-h-64 overflow-y-auto -mx-1 px-1">
                    {query.length > 0 && query.length < 2 && (
                        <p className="text-xs text-muted-foreground text-center py-4">
                            Tape au moins 2 caractères...
                        </p>
                    )}

                    {!loading && query.length >= 2 && results.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">
                            Aucun membre trouvé.
                        </p>
                    )}

                    {results.map((member) => (
                        <button
                            key={member.id}
                            type="button"
                            onClick={() => handleSelect(member)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface transition-colors text-left group"
                        >
                            <Avatar className="h-8 w-8 rounded-lg border border-border group-hover:border-info/30 transition-colors">
                                <AvatarImage src={member.image || undefined} />
                                <AvatarFallback className="text-caption bg-elevated font-bold">
                                    {member.name.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-foreground truncate group-hover:text-info transition-colors">
                                    {member.name}
                                </p>
                                {member.subtitle && (
                                    <p className="text-caption text-muted-foreground truncate">
                                        {member.subtitle}
                                    </p>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}

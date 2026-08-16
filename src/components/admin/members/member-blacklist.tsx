"use client";

import React, { useState, useEffect, useTransition } from "react";
import { 
    Ban, 
    Search, 
    Plus, 
    Trash2, 
    Calendar, 
    User, 
    Clock, 
    AlertCircle,
    Loader2,
    ShieldAlert,
    Ban as BanIcon,
    HelpCircle,
    Pencil,
    Check,
    X
} from "lucide-react";
import { 
    Tooltip, 
    TooltipContent, 
    TooltipProvider, 
    TooltipTrigger 
} from "@/components/ui/tooltip";
import { 
    Card, 
    CardContent, 
    CardDescription, 
    CardHeader, 
    CardTitle 
} from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { 
    addBlacklistEntry, 
    getBlacklistEntries, 
    deleteBlacklistEntry,
    editBlacklistEntry,
    getBlacklistConfig
} from "@/server/actions/blacklist-actions";
import { getDiscordChannelInfo } from "@/server/actions/discord-actions";
import { Hash } from "lucide-react";

interface BlacklistEntry {
    id: string;
    content: string;
    addedByName: string;
    createdAt: Date;
}

interface MemberBlacklistProps {
    guildId: string;
}

export function MemberBlacklist({ guildId }: MemberBlacklistProps) {
    const [entries, setEntries] = useState<BlacklistEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [newContent, setNewContent] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState("");
    const [isPending, startTransition] = useTransition();
    const [blacklistChannelId, setBlacklistChannelId] = useState<string | null>(null);
    const [targetChannelName, setTargetChannelName] = useState("annonces");

    const renderFormattedContent = (text: string) => {
        const pseudoRegex = /([a-zA-Z0-9_-]+)(#\d{4})/g;
        const guildRegex = /(Guilde\s+)(\[.*?\])/g;

        const parts: (string | React.ReactNode)[] = [text];

        const mappedParts = parts.flatMap(part => {
            if (typeof part !== 'string') return part;
            const subParts: (string | React.ReactNode)[] = [];
            let lastIndex = 0;
            let match;
            const regex = new RegExp(pseudoRegex);
            while ((match = regex.exec(part)) !== null) {
                subParts.push(part.substring(lastIndex, match.index));
                subParts.push(<span key={`p-${match.index}`} className="text-danger font-black">{match[1]}</span>);
                subParts.push(<span key={`t-${match.index}`} className="text-muted-foreground font-medium">{match[2]}</span>);
                lastIndex = regex.lastIndex;
            }
            subParts.push(part.substring(lastIndex));
            return subParts;
        });

        const finalParts = mappedParts.flatMap(part => {
            if (typeof part !== 'string') return part;
            const subParts: (string | React.ReactNode)[] = [];
            let lastIndex = 0;
            let match;
            const regex = new RegExp(guildRegex);
            while ((match = regex.exec(part)) !== null) {
                subParts.push(part.substring(lastIndex, match.index));
                subParts.push(<span key={`g-${match.index}`} className="text-warning font-black uppercase tracking-tighter">{match[1]}</span>);
                subParts.push(<span key={`gn-${match.index}`} className="text-warning font-bold italic">{match[2]}</span>);
                lastIndex = regex.lastIndex;
            }
            subParts.push(part.substring(lastIndex));
            return subParts;
        });

        return finalParts;
    };

    const fetchEntries = async (query?: string) => {
        setLoading(true);
        try {
            const res = await getBlacklistEntries(guildId, query);
            if (res.success && res.data) {
                setEntries(res.data);
            }
        } catch (error) {
            toast.error("Erreur de chargement");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEntries();
        
        // Fetch Blacklist Config
        getBlacklistConfig(guildId).then(res => {
            if (res.success && res.data?.blacklistChannelId) {
                setBlacklistChannelId(res.data.blacklistChannelId);
                getDiscordChannelInfo(guildId, res.data.blacklistChannelId).then(chanRes => {
                    if (chanRes.success && chanRes.data) {
                        setTargetChannelName(chanRes.data.name);
                    }
                });
            }
        });
    }, [guildId]);

    const handleSearch = (val: string) => {
        setSearch(val);
        fetchEntries(val);
    };

    const handleAdd = () => {
        if (!newContent.trim()) {
            toast.error("Le contenu ne peut pas être vide");
            return;
        }

        startTransition(async () => {
            const res = await addBlacklistEntry({ guildId, content: newContent });
            if (res.success) {
                toast.success("Entrée ajoutée à la blacklist");
                setNewContent("");
                fetchEntries(search);
            } else {
                toast.error(res.error || "Une erreur est survenue");
            }
        });
    };

    const handleDelete = (id: string) => {
        if (!confirm("Voulez-vous vraiment supprimer cette entrée ?")) return;

        startTransition(async () => {
            const res = await deleteBlacklistEntry(guildId, id);
            if (res.success) {
                toast.success("Entrée supprimée");
                fetchEntries(search);
            } else {
                toast.error(res.error || "Une erreur est survenue");
            }
        });
    };

    const handleStartEdit = (entry: BlacklistEntry) => {
        setEditingId(entry.id);
        setEditContent(entry.content);
    };

    const handleSaveEdit = () => {
        if (!editingId) return;
        if (!editContent.trim()) {
            toast.error("Le contenu ne peut pas être vide");
            return;
        }

        startTransition(async () => {
            const res = await editBlacklistEntry(guildId, editingId, editContent);
            if (res.success) {
                toast.success("Entrée modifiée");
                setEditingId(null);
                fetchEntries(search);
            } else {
                toast.error(res.error || "Erreur lors de la modification");
            }
        });
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-150">
            {/* Header / Add Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1 bg-surface/40 border-border rounded-2xl overflow-hidden h-fit border-t border-t-white/10">
                    <CardHeader className="bg-surface border-b border-border px-6 py-5">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-danger/10 border border-danger/20 rounded-xl">
                                <Plus className="w-5 h-5 text-danger" />
                            </div>
                            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-foreground">Ajouter une entrée</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between px-1">
                                <label className="text-caption font-semibold uppercase text-muted-foreground tracking-wide">Détails de l&apos;individu</label>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="p-1.5 cursor-help bg-surface hover:bg-danger/20 rounded-lg transition-colors group/tooltip border border-border hover:border-danger/20">
                                            <HelpCircle className="w-4 h-4 text-muted-foreground group-hover/tooltip:text-danger transition-colors" />
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" sideOffset={15} className="bg-background border border-border p-5 max-w-[300px] space-y-3 rounded-2xl z-[100]">
                                        <div className="flex items-center gap-3 mb-1">
                                            <div className="w-1.5 h-4 bg-danger rounded-full " />
                                            <p className="text-xs font-semibold uppercase text-foreground tracking-wide">Comment remplir ?</p>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-caption text-foreground leading-relaxed italic">
                                                Tapez <span className="text-danger font-semibold italic">/whois pseudo</span> en jeu ou cliquez sur un joueur <span className="text-foreground font-bold">&gt; Informations &gt; Détails</span>.
                                            </p>
                                            <p className="text-caption text-muted-foreground leading-relaxed">
                                                Copiez ensuite <span className="text-foreground font-medium">toute la ligne</span> de log et collez-la ici. SigilOS s&apos;occupe du reste !
                                            </p>
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <Textarea 
                                placeholder="Pseudo, compte Dofus, raison... (Pas de liens autorisés)"
                                value={newContent}
                                onChange={(e) => setNewContent(e.target.value)}
                                className="min-h-[120px] bg-muted/40 border-border text-foreground rounded-3xl focus:ring-danger/20 focus:border-danger/50 transition-all placeholder:text-muted-foreground font-medium resize-none p-4"
                            />
                        </div>

                        {blacklistChannelId && newContent.trim() && (
                            <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center gap-2 p-3 bg-danger/10 border border-danger/20 rounded-xl shadow-inner">
                                    <div className="w-8 h-8 rounded-lg bg-danger/20 flex items-center justify-center border border-danger/30">
                                        <Hash className="w-4 h-4 text-danger" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-caption font-black uppercase tracking-widest text-muted-foreground">Destination Discord</span>
                                        <span className="text-xs font-bold text-foreground">Log envoyé dans <span className="text-danger italic">#{targetChannelName}</span></span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <Button 
                            className="w-full h-12 bg-danger hover:bg-danger text-danger-foreground rounded-2xl font-black uppercase tracking-widest gap-2 shadow-lg shadow-red-600/20"
                            onClick={handleAdd}
                            disabled={isPending}
                        >
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                            Inscrire à la Blacklist
                        </Button>
                        <p className="text-caption text-muted-foreground italic text-center px-4 leading-relaxed">
                            Cette liste est purement informative et n&apos;influence pas l&apos;accès automatique au dashboard.
                        </p>

                        {/* Discord Sync Promo */}
                        <Link 
                            href={`/dashboard/${guildId}/admin/settings?tab=blacklist`}
                            className="block group/sync mt-4"
                        >
                            <div className="p-4 rounded-2xl bg-surface border border-border hover:border-danger/30 hover:bg-danger/5 transition-all duration-300">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-1.5 rounded-lg bg-elevated border border-border group-hover/sync:bg-danger/20 group-hover/sync:border-danger/30 transition-colors">
                                        <ShieldAlert className="w-3.5 h-3.5 text-muted-foreground group-hover/sync:text-danger" />
                                    </div>
                                    <p className="text-caption font-black uppercase tracking-widest text-muted-foreground group-hover/sync:text-foreground transition-colors">Synchro Discord</p>
                                </div>
                                <p className="text-caption text-muted-foreground group-hover/sync:text-foreground leading-loose">
                                    Les administrateurs peuvent <span className="text-foreground font-bold">coupler un salon Discord</span> pour une synchro en temps réel.
                                </p>
                                <div className="mt-3 flex items-center gap-1.5 text-caption font-black uppercase tracking-widest text-danger/60 group-hover/sync:text-danger transition-colors">
                                    Configurer maintenant
                                    <Plus className="w-3 h-3 group-hover/sync:translate-x-0.5 transition-transform" />
                                </div>
                            </div>
                        </Link>
                    </CardContent>
                </Card>

                <div className="lg:col-span-2 space-y-6">
                    {/* Search Bar */}
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-danger transition-colors" />
                        <Input 
                            placeholder="Rechercher dans la blacklist..." 
                            value={search}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="pl-12 h-14 bg-surface/40 border-border text-foreground rounded-xl focus:ring-danger/20 focus:border-danger/50 transition-colors placeholder:text-muted-foreground font-medium"
                        />
                    </div>

                    {/* Entries List */}
                    <div className="rounded-2xl border border-border bg-surface/40 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-surface border-b border-border">
                                <TableRow className="hover:bg-transparent border-none">
                                    <TableHead className="pl-8 py-6 text-caption font-semibold uppercase text-muted-foreground tracking-wide">Détails du Signalement</TableHead>
                                    <TableHead className="py-6 text-caption font-semibold uppercase text-muted-foreground tracking-wide w-[200px]">Auteur & Date</TableHead>
                                    <TableHead className="text-caption font-semibold uppercase text-muted-foreground tracking-wide pr-8 text-right py-6 w-[80px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <AnimatePresence mode="popLayout">
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={3} className="h-64 text-center">
                                                <div className="flex flex-col items-center gap-4">
                                                    <Loader2 className="w-8 h-8 text-danger animate-spin" />
                                                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Chargement de la blacklist...</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : entries.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={3} className="h-64 text-center">
                                                <div className="flex flex-col items-center gap-4 opacity-40">
                                                    <BanIcon className="w-12 h-12 text-muted-foreground" />
                                                    <div className="space-y-1">
                                                        <p className="text-sm font-semibold uppercase tracking-wide text-foreground">Blacklist vide</p>
                                                        <p className="text-caption text-muted-foreground italic">Aucun signalement ne correspond à votre recherche.</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        entries.map((entry) => (
                                            <motion.tr 
                                                layout
                                                key={entry.id} 
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                className="group border-b border-border hover:bg-surface transition-colors"
                                            >
                                                <TableCell className="pl-8 py-6">
                                                    {editingId === entry.id ? (
                                                        <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                                                            <Textarea 
                                                                value={editContent}
                                                                onChange={(e) => setEditContent(e.target.value)}
                                                                className="bg-muted/60 border-border text-foreground text-sm font-medium rounded-2xl min-h-[80px]"
                                                            />
                                                            <div className="flex items-center gap-2">
                                                                <Button 
                                                                    size="sm" 
                                                                    className="bg-success hover:bg-success text-success-foreground h-8 px-4 font-black uppercase tracking-widest text-caption rounded-lg"
                                                                    onClick={handleSaveEdit}
                                                                    disabled={isPending}
                                                                >
                                                                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-2" />}
                                                                    Valider
                                                                </Button>
                                                                <Button 
                                                                    size="sm" 
                                                                    variant="ghost"
                                                                    className="text-muted-foreground hover:text-foreground h-8 px-4 font-black uppercase tracking-widest text-caption rounded-lg"
                                                                    onClick={() => setEditingId(null)}
                                                                    disabled={isPending}
                                                                >
                                                                    Annuler
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-1">
                                                            <div className="text-sm font-bold text-foreground group-hover:text-foreground transition-colors leading-relaxed whitespace-pre-wrap break-words italic">
                                                                &ldquo;{renderFormattedContent(entry.content)}&rdquo;
                                                            </div>
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="py-6">
                                                    <div className="flex flex-col gap-1.5 justify-center h-full">
                                                        <div className="flex items-center gap-2 text-muted-foreground group-hover:text-danger transition-colors">
                                                            <User className="w-3 h-3" />
                                                            <span className="text-caption font-black uppercase tracking-wider">{entry.addedByName}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-muted-foreground">
                                                            <Clock className="w-3 h-3" />
                                                            <span className="text-caption font-bold tabular-nums">
                                                                {format(new Date(entry.createdAt), "dd MMM yyyy, HH:mm", { locale: fr })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="pr-8 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm" 
                                                            className="h-9 w-9 p-0 rounded-xl text-muted-foreground hover:text-warning hover:bg-warning/10 transition-all opacity-0 group-hover:opacity-100"
                                                            onClick={() => handleStartEdit(entry)}
                                                            disabled={editingId === entry.id}
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </Button>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm" 
                                                            className="h-9 w-9 p-0 rounded-xl text-muted-foreground hover:text-danger hover:bg-danger/10 transition-all opacity-0 group-hover:opacity-100"
                                                            onClick={() => handleDelete(entry.id)}
                                                            disabled={editingId === entry.id}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </motion.tr>
                                        ))
                                    )}
                                </AnimatePresence>
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>
        </div>
    );
}

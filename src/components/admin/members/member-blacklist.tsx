"use client";

/**
 * Onglet **Blacklist** — habillage conforme à la politique anti-slop :
 * une seule teinte d'accent (`accent`), rayons ≤ 8 px, aucun `font-black` ni italique
 * décoratif, majuscules réservées aux en-têtes de colonnes, actions toujours visibles
 * (jamais `opacity-0` au survol : inaccessible au clavier et au tactile).
 *
 * Comportement inchangé : liste, recherche, ajout, édition inline, suppression, rappel
 * de la synchronisation Discord et état vide.
 */

import React, { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
    Ban,
    Check,
    Clock,
    Hash,
    HelpCircle,
    Loader2,
    Pencil,
    Search,
    ShieldAlert,
    Trash2,
    User,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    addBlacklistEntry,
    deleteBlacklistEntry,
    editBlacklistEntry,
    getBlacklistConfig,
    getBlacklistEntries,
} from "@/server/actions/blacklist-actions";
import { getDiscordChannelInfo } from "@/server/actions/discord-actions";

interface BlacklistEntry {
    id: string;
    content: string;
    addedByName: string;
    createdAt: Date;
}

interface MemberBlacklistProps {
    guildId: string;
}

/**
 * Message rendu après une mutation — il dit **ce qui est réellement arrivé à l'embed**
 * (publié, mis à jour, reposté, supprimé, ou Discord indisponible). Plus de succès muet.
 */
function discordSyncToast(
    status: string | undefined,
    action: "ajouté" | "modifié" | "supprimé"
): { kind: "success" | "warning"; text: string } {
    switch (status) {
        case "posted":
            return { kind: "success", text: `Signalement ${action} · embed publié sur Discord` };
        case "updated":
            return { kind: "success", text: `Signalement ${action} · embed Discord mis à jour` };
        case "reposted":
            return { kind: "success", text: `Signalement ${action} · embed reposté sur Discord` };
        case "deleted":
            return { kind: "success", text: `Signalement ${action} · message Discord supprimé` };
        case "no_channel":
            return { kind: "success", text: `Signalement ${action} (aucun salon Discord configuré)` };
        default:
            return {
                kind: "warning",
                text: `Signalement ${action}, mais Discord n’a pas pu être mis à jour`,
            };
    }
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

    /**
     * Met en avant le pseudo et son discriminant (`Pseudo#1234`) et la raison sociale
     * `Guilde [TAG]` — **sans** couleur d'accent supplémentaire (une seule teinte par écran).
     */
    const renderFormattedContent = (text: string) => {
        const pseudoRegex = /([a-zA-Z0-9_-]+)(#\d{4})/g;
        const guildRegex = /(Guilde\s+)(\[.*?\])/g;

        const withPseudos = [text].flatMap((part): (string | React.ReactNode)[] => {
            const subParts: (string | React.ReactNode)[] = [];
            let lastIndex = 0;
            let match: RegExpExecArray | null;
            const regex = new RegExp(pseudoRegex);
            while ((match = regex.exec(part)) !== null) {
                subParts.push(part.substring(lastIndex, match.index));
                subParts.push(
                    <span key={`p-${match.index}`} className="font-semibold text-danger">
                        {match[1]}
                    </span>
                );
                subParts.push(
                    <span key={`t-${match.index}`} className="text-danger/70">
                        {match[2]}
                    </span>
                );
                lastIndex = regex.lastIndex;
            }
            subParts.push(part.substring(lastIndex));
            return subParts;
        });

        return withPseudos.flatMap((part): (string | React.ReactNode)[] => {
            if (typeof part !== "string") return [part];
            const subParts: (string | React.ReactNode)[] = [];
            let lastIndex = 0;
            let match: RegExpExecArray | null;
            const regex = new RegExp(guildRegex);
            while ((match = regex.exec(part)) !== null) {
                subParts.push(part.substring(lastIndex, match.index));
                subParts.push(
                    <span key={`g-${match.index}`} className="font-medium text-warning">
                        {match[1]}
                    </span>
                );
                subParts.push(
                    <span key={`gn-${match.index}`} className="font-medium text-warning">
                        {match[2]}
                    </span>
                );
                lastIndex = regex.lastIndex;
            }
            subParts.push(part.substring(lastIndex));
            return subParts;
        });
    };

    const fetchEntries = useCallback(async (query?: string) => {
        setLoading(true);
        try {
            const res = await getBlacklistEntries(guildId, query);
            if (res.success && res.data) {
                setEntries(res.data);
            }
        } catch {
            toast.error("Erreur de chargement");
        } finally {
            setLoading(false);
        }
    }, [guildId]);

    useEffect(() => {
        void fetchEntries();

        getBlacklistConfig(guildId).then((res) => {
            if (res.success && res.data?.blacklistChannelId) {
                setBlacklistChannelId(res.data.blacklistChannelId);
                getDiscordChannelInfo(guildId, res.data.blacklistChannelId).then((chanRes) => {
                    if (chanRes.success && chanRes.data) {
                        setTargetChannelName(chanRes.data.name ?? "Salon masqué");
                    }
                });
            }
        });
        // Une seule passe de configuration au montage, pour la guilde courante.
    }, [guildId, fetchEntries]);

    const handleSearch = (value: string) => {
        setSearch(value);
        fetchEntries(value);
    };

    const handleAdd = () => {
        if (!newContent.trim()) {
            toast.error("Le contenu ne peut pas être vide");
            return;
        }

        startTransition(async () => {
            const res = await addBlacklistEntry({ guildId, content: newContent });
            if (res.success) {
                const notice = discordSyncToast(res.data?.discord, "ajouté");
                if (notice.kind === "warning") toast.warning(notice.text);
                else toast.success(notice.text);
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
                const notice = discordSyncToast(res.data?.discord, "supprimé");
                if (notice.kind === "warning") toast.warning(notice.text);
                else toast.success(notice.text);
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
                const notice = discordSyncToast(res.data?.discord, "modifié");
                if (notice.kind === "warning") toast.warning(notice.text);
                else toast.success(notice.text);
                setEditingId(null);
                fetchEntries(search);
            } else {
                toast.error(res.error || "Erreur lors de la modification");
            }
        });
    };

    return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
            {/* ── Formulaire ─────────────────────────────────────────────── */}
            <section className="h-fit min-w-0 rounded-lg border border-border-strong bg-surface p-4">
                <div className="flex items-center gap-2">
                    <Ban className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <h2 className="text-sm font-semibold text-foreground">Ajouter une entrée</h2>
                </div>

                <div className="mt-4 space-y-1.5">
                    <label htmlFor="blacklist-content" className="text-xs font-medium text-foreground">
                        Détails de l’individu
                    </label>
                    <Textarea
                        id="blacklist-content"
                        placeholder="Pseudo, compte Dofus, raison…"
                        value={newContent}
                        onChange={(event) => setNewContent(event.target.value)}
                        maxLength={500}
                        aria-describedby="blacklist-help"
                        className="min-h-[120px] resize-none rounded-md border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-accent/60"
                    />
                    <p id="blacklist-help" className="flex items-start gap-1.5 text-caption leading-relaxed text-muted-foreground">
                        <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>
                            Tapez <span className="font-medium text-foreground">/whois pseudo</span> en jeu, puis collez la
                            ligne de log. Les liens ne sont pas autorisés.
                        </span>
                    </p>
                </div>

                {blacklistChannelId && newContent.trim() && (
                    <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-elevated/50 px-3 py-2">
                        <Hash className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <div className="min-w-0">
                            <p className="text-caption text-muted-foreground">Destination Discord</p>
                            <p className="truncate text-xs text-foreground">Log envoyé dans #{targetChannelName}</p>
                        </div>
                    </div>
                )}

                <Button type="button" className="mt-4 w-full gap-2" onClick={handleAdd} disabled={isPending}>
                    {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                        <Ban className="h-4 w-4" aria-hidden="true" />
                    )}
                    Inscrire à la blacklist
                </Button>

                <p className="mt-2 text-caption leading-relaxed text-muted-foreground">
                    Cette liste est informative : elle ne modifie pas l’accès au dashboard.
                </p>

                <Link
                    href={`/dashboard/${guildId}/admin/settings?tab=blacklist`}
                    className="mt-4 block rounded-md border border-border bg-elevated/40 p-3 transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                    <div className="flex items-start gap-2">
                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground">Synchronisation Discord</p>
                            <p className="mt-0.5 text-caption leading-relaxed text-muted-foreground">
                                Coupler un salon pour recevoir les signalements en temps réel.
                            </p>
                            <p className="mt-1 text-xs font-medium text-accent">Configurer le salon</p>
                        </div>
                    </div>
                </Link>
            </section>

            {/* ── Liste ──────────────────────────────────────────────────── */}
            <section className="min-w-0 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative min-w-0 flex-1">
                        <Search
                            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                            aria-hidden="true"
                        />
                        <Input
                            aria-label="Rechercher dans la blacklist"
                            placeholder="Rechercher dans la blacklist…"
                            value={search}
                            onChange={(event) => handleSearch(event.target.value)}
                            className="h-9 pl-8"
                        />
                    </div>
                    <Badge variant="outline" className="tabular-nums">
                        {entries.length}
                    </Badge>
                </div>

                <div className="overflow-hidden rounded-lg border border-border-strong bg-surface">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="text-caption uppercase text-muted-foreground">
                                    Détails du signalement
                                </TableHead>
                                <TableHead className="w-[190px] text-caption uppercase text-muted-foreground">
                                    Auteur &amp; date
                                </TableHead>
                                <TableHead className="w-[88px] text-right">
                                    <span className="sr-only">Actions</span>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={3} className="py-12 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
                                            <p className="text-caption text-muted-foreground">Chargement de la blacklist…</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : entries.length === 0 ? (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={3} className="py-12 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <Ban className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                                            <p className="text-sm font-medium text-foreground">
                                                {search.trim() ? "Aucun résultat" : "Blacklist vide"}
                                            </p>
                                            <p className="text-caption text-muted-foreground">
                                                {search.trim()
                                                    ? `Aucun signalement ne correspond à « ${search.trim()} ».`
                                                    : "Aucun signalement enregistré pour l’instant."}
                                            </p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                entries.map((entry) => (
                                    <TableRow key={entry.id}>
                                        <TableCell className="max-w-0 whitespace-normal py-3 align-top">
                                            {editingId === entry.id ? (
                                                <div className="space-y-2">
                                                    <Textarea
                                                        value={editContent}
                                                        onChange={(event) => setEditContent(event.target.value)}
                                                        aria-label={`Modifier le signalement de ${entry.addedByName}`}
                                                        className="min-h-[80px] rounded-md border-border bg-background text-sm"
                                                    />
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            className="gap-1.5"
                                                            onClick={handleSaveEdit}
                                                            disabled={isPending}
                                                        >
                                                            {isPending ? (
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                                            ) : (
                                                                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                                            )}
                                                            Enregistrer
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => setEditingId(null)}
                                                            disabled={isPending}
                                                        >
                                                            Annuler
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                                                    {renderFormattedContent(entry.content)}
                                                </p>
                                            )}
                                        </TableCell>
                                        <TableCell className="py-3 align-top">
                                            <div className="flex flex-col gap-1 text-caption text-muted-foreground">
                                                <span className="flex items-center gap-1.5">
                                                    <User className="h-3 w-3 shrink-0" aria-hidden="true" />
                                                    <span className="truncate">{entry.addedByName}</span>
                                                </span>
                                                <span className="flex items-center gap-1.5 tabular-nums">
                                                    <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                                                    {format(new Date(entry.createdAt), "dd MMM yyyy, HH:mm", { locale: fr })}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-3 text-right align-top">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0"
                                                    onClick={() => handleStartEdit(entry)}
                                                    disabled={editingId === entry.id}
                                                    aria-label={`Modifier le signalement de ${entry.addedByName}`}
                                                >
                                                    <Pencil className="h-4 w-4" aria-hidden="true" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-danger"
                                                    onClick={() => handleDelete(entry.id)}
                                                    disabled={editingId === entry.id}
                                                    aria-label={`Supprimer le signalement de ${entry.addedByName}`}
                                                >
                                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </section>
        </div>
    );
}

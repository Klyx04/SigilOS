"use client";

import { useState } from "react";
import {
    FileText,
    Download,
    ExternalLink,
    Search,
    Clock,
    User,
    CheckCircle2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface TicketTranscriptsTabProps {
    guildId: string;
    tickets: any[];
}

export function TicketTranscriptsTab({ guildId, tickets }: TicketTranscriptsTabProps) {
    const [search, setSearch] = useState("");

    const archiveRows = tickets
        .filter((t) => Array.isArray(t.transcripts) && t.transcripts.length > 0)
        .filter((t) => {
            if (!search) return true;
            const s = search.toLowerCase();
            return (
                String(t.creatorDiscordName || "").toLowerCase().includes(s) ||
                String(t.ticketNumber).includes(s) ||
                String(t.journey?.name || t.category?.name || "").toLowerCase().includes(s)
            );
        });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <FileText className="h-5 w-5 text-amber-400" /> Archives des tickets
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        Deux documents par ticket : une archive <strong>partageable</strong> (conversation seule) et une{" "}
                        <strong>annexe interne</strong> (notes du staff), jamais exposée par un lien public.
                    </p>
                </div>

                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Rechercher par membre ou #ID..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 h-8 text-xs"
                    />
                </div>
            </div>

            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-surface/50 border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                            <tr>
                                <th className="py-3.5 px-4 font-semibold">Ticket</th>
                                <th className="py-3.5 px-4 font-semibold">Demandeur</th>
                                <th className="py-3.5 px-4 font-semibold">Catégorie</th>
                                <th className="py-3.5 px-4 font-semibold">Fermé le</th>
                                <th className="py-3.5 px-4 font-semibold">Messages</th>
                                <th className="py-3.5 px-4 text-right font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 text-xs">
                            {archiveRows.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                                        Aucune archive pour le moment — elle est écrite à la fermeture d'un ticket.
                                    </td>
                                </tr>
                            ) : (
                                archiveRows.map((t) => {
                                    const shareable = (t.transcripts as any[]).find((a) => a.kind === "SHAREABLE");
                                    const internal = (t.transcripts as any[]).find((a) => a.kind === "INTERNAL");
                                    const reference = shareable || internal;
                                    return (
                                        <tr key={t.id} className="hover:bg-surface/30 transition-colors">
                                            <td className="py-3.5 px-4 font-bold text-amber-400 font-mono">
                                                #{t.ticketNumber}
                                            </td>

                                            <td className="py-3.5 px-4 font-medium text-foreground">
                                                {t.creatorDiscordName}
                                            </td>

                                            <td className="py-3.5 px-4 text-muted-foreground">
                                                <Badge variant="outline" className="text-[10px]">
                                                    {t.journey?.name || t.category?.name || "—"}
                                                </Badge>
                                            </td>

                                            <td className="py-3.5 px-4 text-muted-foreground">
                                                {t.closedAt ? new Date(t.closedAt).toLocaleDateString("fr-FR") : "—"}
                                            </td>

                                            <td className="py-3.5 px-4 text-muted-foreground space-y-1">
                                                <div>
                                                    <span className="font-semibold text-foreground">
                                                        {reference?.messageCount ?? 0}
                                                    </span>{" "}
                                                    messages
                                                </div>
                                                {reference?.partial && (
                                                    <Badge variant="outline" className="text-[10px]">
                                                        ⚠️ Archive partielle
                                                    </Badge>
                                                )}
                                                {reference?.expiresAt && (
                                                    <div className="text-[10px]">
                                                        Expire le{" "}
                                                        {new Date(reference.expiresAt).toLocaleDateString("fr-FR")}
                                                    </div>
                                                )}
                                            </td>

                                            <td className="py-3.5 px-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {shareable && (
                                                        <>
                                                            <a
                                                                href={`/api/tickets/transcript/${shareable.secretToken}`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                            >
                                                                <Button size="sm" variant="outline" className="h-7 text-xs px-2.5">
                                                                    <ExternalLink className="h-3 w-3 mr-1" /> Voir
                                                                </Button>
                                                            </a>

                                                            <a
                                                                href={`/api/tickets/transcript/${shareable.secretToken}?download=1`}
                                                            >
                                                                <Button size="sm" variant="ghost" className="h-7 text-xs px-2">
                                                                    <Download className="h-3 w-3" />
                                                                </Button>
                                                            </a>
                                                        </>
                                                    )}

                                                    {internal && (
                                                        <Badge
                                                            variant="outline"
                                                            className="text-[10px]"
                                                            title="Contient les notes internes : réservé au staff, jamais servi par un lien public."
                                                        >
                                                            🔒 Annexe staff
                                                        </Badge>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

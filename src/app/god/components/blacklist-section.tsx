"use client";

import { useState, useTransition } from "react";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export function BlacklistSection({ bans }: { bans: any[] }) {
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [banType, setBanType] = useState<'GUILD' | 'USER'>('GUILD');
    const [banDiscordId, setBanDiscordId] = useState('');
    const [banReason, setBanReason] = useState('');
    const [isPending, startTransition] = useTransition();

    const handleAddBan = () => {
        if (!banDiscordId.trim() || !banReason.trim()) return;
        startTransition(async () => {
            const { banEntity } = await import('@/server/actions/god-lifecycle-actions');
            const res = await banEntity(banType, banDiscordId.trim(), banReason.trim());
            if (res.success) {
                toast.success("Bannissement enregistré");
                setIsAddOpen(false);
                setBanDiscordId("");
                setBanReason("");
                window.location.reload();
            } else {
                toast.error(res.error || "Erreur lors du ban");
            }
        });
    };

    const handleUnban = (banId: string) => {
        if (!confirm("Lever ce bannissement ?")) return;
        startTransition(async () => {
            const { unbanEntity } = await import('@/server/actions/god-lifecycle-actions');
            const res = await unbanEntity(banId);
            if (res.success) {
                toast.success("Bannissement levé");
                window.location.reload();
            } else {
                toast.error(res.error || "Erreur");
            }
        });
    };

    return (
        <div className="rounded-xl border border-border bg-surface/10 p-5 space-y-4">
            <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Shield className="h-4 w-4 text-danger" aria-hidden="true" />
                        Blacklist & Restriction Plateforme
                    </h3>
                    <p className="text-xs text-muted-foreground">
                        {bans.length === 0
                            ? "Aucun bannissement actif."
                            : `${bans.length} bannissement${bans.length > 1 ? "s" : ""} actif${bans.length > 1 ? "s" : ""} — accès bot et plateforme bloqués pour les IDs ci-dessous.`}
                    </p>
                </div>

                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="gap-2">
                            + Nouveau Ban
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md rounded-xl border border-border bg-background p-6 text-foreground">
                        <DialogHeader>
                            <DialogTitle className="text-base font-semibold text-foreground">Ajouter un Bannissement</DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground">
                                Bloque immédiatement l'accès au bot et au dashboard pour la guilde ou l'utilisateur.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="mt-4 space-y-4">
                            <select
                                value={banType}
                                onChange={(e) => setBanType(e.target.value as any)}
                                className="h-10 w-full rounded-lg border border-border bg-elevated px-3 text-sm text-foreground focus:border-border-strong focus:outline-none"
                            >
                                <option value="GUILD">Guilde Discord ID</option>
                                <option value="USER">Utilisateur Discord ID</option>
                            </select>
                            <Input
                                placeholder="ID Discord (ex: 123456789...)"
                                value={banDiscordId}
                                onChange={(e) => setBanDiscordId(e.target.value)}
                                className="font-mono text-xs"
                            />
                            <Input
                                placeholder="Raison du bannissement..."
                                value={banReason}
                                onChange={(e) => setBanReason(e.target.value)}
                                className="text-xs"
                            />
                            <Button
                                onClick={handleAddBan}
                                disabled={isPending || !banDiscordId.trim() || !banReason.trim()}
                                className="h-11 w-full rounded-lg"
                            >
                                {isPending ? "Enregistrement..." : "Appliquer le ban"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {bans.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {bans.map((ban: any) => (
                        <div key={ban.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface/10 p-4">
                            <div className="min-w-0">
                                <span className="rounded-full border border-destructive/30 bg-destructive/15 px-2 py-0.5 text-caption font-semibold uppercase text-destructive">
                                    {ban.entityType === 'GUILD' ? 'Guilde' : 'Utilisateur'}
                                </span>
                                <div className="mt-1 truncate font-mono text-xs text-foreground">{ban.discordId}</div>
                                <div className="text-xs text-muted-foreground">{ban.reason}</div>
                            </div>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleUnban(ban.id)}
                                disabled={isPending}
                                className="shrink-0 text-muted-foreground hover:text-foreground"
                            >
                                Lever
                            </Button>
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

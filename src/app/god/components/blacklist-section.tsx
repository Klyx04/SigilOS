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
        <div className="p-8 rounded-[2.5rem] bg-zinc-950/40 border border-white/5 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/5 pb-4 gap-4">
                <div className="space-y-1">
                    <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <Shield className="w-4 h-4 text-rose-400" />
                        Blacklist & Restriction Plateforme
                    </h3>
                    <p className="text-zinc-500 text-xs font-medium">
                        Bannissements plateforme (accès bot et plateforme bloqués pour les IDs spécifiés).
                    </p>
                </div>

                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20 font-black uppercase tracking-widest text-caption px-4 py-2 rounded-xl gap-2">
                            + Nouveau Ban
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-zinc-950 border-white/10 text-white max-w-md rounded-3xl p-6 backdrop-blur-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-black uppercase tracking-tight text-rose-400">Ajouter un Bannissement</DialogTitle>
                            <DialogDescription className="text-zinc-400 text-xs">
                                Bloque immédiatement l'accès au bot et au dashboard pour la guilde ou l'utilisateur.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                            <select
                                value={banType}
                                onChange={(e) => setBanType(e.target.value as any)}
                                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white focus:outline-none"
                            >
                                <option value="GUILD">🏰 Guilde Discord ID</option>
                                <option value="USER">👤 Utilisateur Discord ID</option>
                            </select>
                            <Input
                                placeholder="ID Discord (ex: 123456789...)"
                                value={banDiscordId}
                                onChange={(e) => setBanDiscordId(e.target.value)}
                                className="bg-zinc-900 border-white/10 text-xs font-mono"
                            />
                            <Input
                                placeholder="Raison du bannissement..."
                                value={banReason}
                                onChange={(e) => setBanReason(e.target.value)}
                                className="bg-zinc-900 border-white/10 text-xs font-medium"
                            />
                            <Button
                                onClick={handleAddBan}
                                disabled={isPending || !banDiscordId.trim() || !banReason.trim()}
                                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-black uppercase tracking-wider text-xs h-12 rounded-xl"
                            >
                                {isPending ? "Enregistrement..." : "Appliquer le ban"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {bans.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 text-xs font-bold uppercase tracking-wider bg-zinc-900/20 rounded-2xl border border-white/5">
                    ✅ Aucun bannissement actif
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {bans.map((ban: any) => (
                        <div key={ban.id} className="p-4 rounded-2xl bg-zinc-900/30 border border-rose-500/10 flex items-center justify-between">
                            <div>
                                <span className="text-caption font-black uppercase px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                    {ban.entityType === 'GUILD' ? '🏰 Guilde' : '👤 User'}
                                </span>
                                <div className="text-xs font-mono font-bold text-white mt-1">{ban.discordId}</div>
                                <div className="text-caption text-zinc-500 font-medium">{ban.reason}</div>
                            </div>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleUnban(ban.id)}
                                disabled={isPending}
                                className="text-xs font-bold text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10"
                            >
                                Lever
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

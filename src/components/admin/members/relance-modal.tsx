"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { sendRelance, getRelanceConfig } from "@/server/actions/relance-actions";
import { ChannelPreview } from "@/components/shared/ChannelPreview";
import { toast } from "sonner";
import { Bell, Loader2, Send, Users, Search, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RelanceTarget {
    id: string; // Discord ID (snowflake)
    name: string; // Pseudo affiché (@nickname)
}

interface RelanceModalProps {
    guildId: string;
    targets: RelanceTarget[];
    /** Conservé pour rétro-compat — plus utilisé : le canal vient de la config guilde (#104). */
    channels?: any[];
    onClose: () => void;
}

/** Chantier #74 + #104 — interface dédiée « Relancer » : ping @nickname solo/bulk, message dédié,
 *  canal préconfiguré par l'admin (Paramètres > Relances), preview embed, recherche membre. */
export function RelanceModal({ guildId, targets, onClose }: RelanceModalProps) {
    const [message, setMessage] = useState("");
    const [search, setSearch] = useState("");
    const [delivery, setDelivery] = useState<"CHANNEL" | "DM">("CHANNEL");
    const [isPending, startTransition] = useTransition();
    // #104 — canal de relance préconfiguré par l'admin + nom de guilde (footer embed).
    const [relanceChannelId, setRelanceChannelId] = useState<string | null>(null);
    const [guildName, setGuildName] = useState("");
    const [configLoaded, setConfigLoaded] = useState(false);
    // #77 — liste des membres avec cases à cocher (on peut retirer certaines personnes
    // avant l'envoi, que ce soit en ping canal ou en MP)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(targets.map(t => t.id)));

    useEffect(() => {
        let cancelled = false;
        getRelanceConfig(guildId).then(res => {
            if (cancelled) return;
            if (res.success && res.data) {
                setRelanceChannelId(res.data.relanceChannelId);
                setGuildName(res.data.guildName);
            }
            setConfigLoaded(true);
        }).catch(() => setConfigLoaded(true));
        return () => { cancelled = true; };
    }, [guildId]);

    // #104 — recherche membre dans la modale (filtre la liste cochable).
    const visibleTargets = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return targets;
        return targets.filter(t => t.name.toLowerCase().includes(q));
    }, [targets, search]);

    const selectedTargets = targets.filter(t => selectedIds.has(t.id));
    const isBulk = targets.length > 1;
    const hasChannel = !!relanceChannelId;

    const toggleTarget = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        setSelectedIds(prev => (prev.size === targets.length ? new Set<string>() : new Set(targets.map(t => t.id))));
    };

    const handleSend = () => {
        if (selectedTargets.length === 0) return toast.error("Aucun membre sélectionné");
        if (delivery === "CHANNEL" && !hasChannel) return toast.error("Aucun canal de relance configuré (Admin > Paramètres > Relances)");
        if (!message.trim()) return toast.error("Écrivez un message de relance");

        startTransition(async () => {
            const res = await sendRelance({
                guildId,
                targetUserIds: selectedTargets.map(t => t.id),
                type: delivery,
                message: message.trim(),
                channelId: delivery === "CHANNEL" ? relanceChannelId || undefined : undefined,
                criteria: undefined,
            });
            if (res.success) {
                toast.success(`Relance envoyée à ${selectedTargets.length} membre${selectedTargets.length > 1 ? "s" : ""} !`);
                onClose();
            } else {
                toast.error(res.error || "Erreur lors de l'envoi");
            }
        });
    };

    return (
        <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-lg bg-zinc-950 border-white/10 rounded-3xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-white">
                        <Bell className="w-5 h-5 text-amber-400" />
                        Relancer {isBulk ? "la sélection" : "ce membre"}
                    </DialogTitle>
                    <DialogDescription className="text-zinc-500">
                        Ping {isBulk ? "groupé" : "solo"} de {selectedTargets.length} / {targets.length} membre{targets.length > 1 ? "s" : ""} sélectionné{selectedTargets.length > 1 ? "s" : ""}.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    {/* #77 + #104 — Liste des membres cochables + recherche */}
                    {isBulk && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-semibold text-zinc-300 uppercase tracking-widest">Membres ciblés</Label>
                                <button
                                    type="button"
                                    onClick={toggleAll}
                                    className="text-caption font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                                >
                                    {selectedIds.size === targets.length ? "Tout décocher" : "Tout cocher"}
                                </button>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Rechercher un membre..."
                                    className="h-10 pl-9 bg-zinc-900/50 border-white/10 text-sm"
                                />
                            </div>
                            <div className="max-h-44 overflow-y-auto rounded-xl border border-white/10 bg-zinc-900/40 divide-y divide-white/5">
                                {visibleTargets.length === 0 && (
                                    <div className="px-3 py-4 text-caption text-zinc-500 text-center">Aucun membre ne correspond à la recherche.</div>
                                )}
                                {visibleTargets.map((t) => {
                                    const checked = selectedIds.has(t.id);
                                    return (
                                        <label
                                            key={t.id}
                                            className={cn(
                                                "flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors",
                                                checked ? "bg-emerald-500/[0.06]" : "hover:bg-white/[0.03]"
                                            )}
                                        >
                                            <Checkbox
                                                checked={checked}
                                                onCheckedChange={() => toggleTarget(t.id)}
                                                className={checked ? "border-emerald-500/60" : ""}
                                            />
                                            <span className={cn("text-sm truncate", checked ? "text-white" : "text-zinc-400")}>
                                                {t.name}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label className="text-xs font-black text-zinc-300 uppercase tracking-widest">Livraison</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => setDelivery("CHANNEL")}
                                className={cn("p-3 rounded-xl border text-left transition-colors",
                                    delivery === "CHANNEL" ? "bg-amber-500/10 border-amber-500/40" : "bg-zinc-900/40 border-white/10 hover:border-white/20")}>
                                <span className="flex items-center gap-2 text-sm font-bold text-white">
                                    <Send className="w-4 h-4 text-amber-400" /> Canal
                                </span>
                                <span className="text-caption text-zinc-500 mt-1 block">Message public dans un salon (@mention)</span>
                            </button>
                            <button type="button" onClick={() => setDelivery("DM")}
                                className={cn("p-3 rounded-xl border text-left transition-colors",
                                    delivery === "DM" ? "bg-indigo-500/10 border-indigo-500/40" : "bg-zinc-900/40 border-white/10 hover:border-white/20")}>
                                <span className="flex items-center gap-2 text-sm font-bold text-white">
                                    <Users className="w-4 h-4 text-indigo-400" /> Message privé
                                </span>
                                <span className="text-caption text-zinc-500 mt-1 block">MP via le bot Discord (pas de ping public)</span>
                            </button>
                        </div>
                    </div>

                    {delivery === "CHANNEL" && (
                        <div className="space-y-2 rounded-xl border border-white/10 bg-zinc-900/40 p-3">
                            <Label className="text-xs font-semibold text-zinc-300 uppercase tracking-widest">Canal de diffusion configuré</Label>
                            {!configLoaded ? (
                                <div className="flex items-center gap-1.5 text-caption text-zinc-500">
                                    <Loader2 className="w-3 h-3 animate-spin" /> Résolution du salon…
                                </div>
                            ) : hasChannel ? (
                                <ChannelPreview guildId={guildId} channelId={relanceChannelId!} color="amber" />
                            ) : (
                                <div className="flex items-center gap-1.5 text-caption text-amber-400/90">
                                    <AlertTriangle className="w-3 h-3" />
                                    Aucun canal configuré — définissez-le dans Admin &gt; Paramètres &gt; Relances.
                                </div>
                            )}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label className="text-xs font-semibold text-zinc-300 uppercase tracking-widest">Message de relance</Label>
                        <Textarea value={message} onChange={(e) => setMessage(e.target.value)}
                            placeholder="Écrivez votre message de relance..."
                            rows={4} className="bg-zinc-900/50 border-white/10 text-sm resize-none" />
                        <p className="text-caption text-zinc-600">
                            {message.trim().length}/2000
                        </p>
                    </div>

                    {/* #104 — Preview embed côté admin (fidèle à ce qui partira sur Discord) */}
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold text-zinc-300 uppercase tracking-widest">Aperçu de l'embed</Label>
                        <div className="rounded-xl border border-white/10 bg-[#2b2d31] p-3">
                            <div className="flex gap-3">
                                <div className="w-1 self-stretch rounded bg-amber-500" />
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-bold text-white">
                                        {delivery === "DM" ? "🔔 Rappel de Guilde - SigilOS" : "🔔 Rappel de Guilde"}
                                    </div>
                                    <div className="text-sm text-zinc-300 whitespace-pre-wrap break-words mt-1">
                                        {message.trim() || "Votre message apparaîtra ici…"}
                                    </div>
                                    <div className="text-caption text-zinc-500 mt-2">
                                        {delivery === "DM"
                                            ? `Envoyé par un administrateur depuis ${guildName}`
                                            : `SigilOS • ${guildName}`}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="border-t border-white/5 pt-4 flex gap-3">
                    <Button variant="ghost" onClick={onClose} disabled={isPending} className="text-zinc-400 hover:text-white">
                        Annuler
                    </Button>
                    <Button onClick={handleSend} disabled={isPending || selectedTargets.length === 0}
                        className="bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase tracking-widest text-xs h-10 px-5 rounded-xl disabled:opacity-40">
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                        Envoyer la relance
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


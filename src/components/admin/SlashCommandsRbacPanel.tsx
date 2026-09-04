"use client";

import { useState } from "react";
import { 
    Terminal, 
    ShieldCheck, 
    Check, 
    X, 
    AlertCircle, 
    Save, 
    Info,
    Hash
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { updateGuildSlashCommandPermissionAction } from "@/server/actions/slash-command-actions";

interface CommandItem {
    command: {
        name: string;
        description: string;
        usage: string;
        category: string;
    };
    isEnabled: boolean;
    roleIds: string[];
    channelIds?: string[];
}

export function SlashCommandsRbacPanel({
    guildId,
    initialMatrix,
    discordRoles,
    discordChannels = []
}: {
    guildId: string;
    initialMatrix: CommandItem[];
    discordRoles: { id: string; name: string; color?: string }[];
    discordChannels?: { id: string; name: string }[];
}) {
    const [matrix, setMatrix] = useState<CommandItem[]>(
        initialMatrix.map(m => ({ ...m, channelIds: m.channelIds || [] }))
    );
    const [isSaving, setIsSaving] = useState<string | null>(null);

    const handleToggleEnabled = (commandName: string) => {
        setMatrix(prev => prev.map(item => {
            if (item.command.name === commandName) {
                return { ...item, isEnabled: !item.isEnabled };
            }
            return item;
        }));
    };

    const handleToggleRole = (commandName: string, roleId: string) => {
        setMatrix(prev => prev.map(item => {
            if (item.command.name === commandName) {
                const current = item.roleIds;
                const next = current.includes(roleId) 
                    ? current.filter(id => id !== roleId)
                    : [...current, roleId];
                return { ...item, roleIds: next };
            }
            return item;
        }));
    };

    const handleToggleChannel = (commandName: string, channelId: string) => {
        setMatrix(prev => prev.map(item => {
            if (item.command.name === commandName) {
                const current = item.channelIds || [];
                const next = current.includes(channelId)
                    ? current.filter(id => id !== channelId)
                    : [...current, channelId];
                return { ...item, channelIds: next };
            }
            return item;
        }));
    };

    const handleResetChannels = (commandName: string) => {
        setMatrix(prev => prev.map(item => {
            if (item.command.name === commandName) {
                return { ...item, channelIds: [] };
            }
            return item;
        }));
    };

    const handleSave = async (commandName: string) => {
        const item = matrix.find(m => m.command.name === commandName);
        if (!item) return;

        setIsSaving(commandName);
        try {
            const res = await updateGuildSlashCommandPermissionAction({
                guildId,
                commandName,
                roleIds: item.roleIds,
                channelIds: item.channelIds || [],
                isEnabled: item.isEnabled
            });

            if (res.success) {
                toast.success(`Permissions pour /${commandName} mises à jour avec succès !`);
            } else {
                toast.error(res.error || "Échec de l'enregistrement");
            }
        } catch {
            toast.error("Erreur de communication avec le serveur");
        } finally {
            setIsSaving(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-surface border border-border">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent flex items-center justify-center border border-accent/20">
                        <Terminal className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-foreground">Commandes Slash Discord</h3>
                        <p className="text-xs text-muted-foreground">
                            Configurez la disponibilité et les rôles Discord autorisés à exécuter chaque commande du bot.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {matrix.map((item) => (
                    <div 
                        key={item.command.name}
                        className={cn(
                            "p-5 rounded-3xl border transition-all flex flex-col justify-between gap-4",
                            item.isEnabled 
                                ? "bg-surface border-border hover:border-accent/40" 
                                : "bg-elevated/40 border-border/40 opacity-70"
                        )}
                    >
                        <div className="space-y-3">
                            <div className="flex items-start justify-between gap-2">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <code className="text-sm font-black font-mono text-accent bg-accent-soft px-2 py-0.5 rounded-lg">
                                            /{item.command.name}
                                        </code>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                            {item.command.category}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground font-medium">
                                        {item.command.description}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => handleToggleEnabled(item.command.name)}
                                    className={cn(
                                        "px-2.5 py-1 rounded-full text-[11px] font-black border transition-all shrink-0",
                                        item.isEnabled 
                                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                                            : "bg-rose-500/10 text-rose-500 border-rose-500/30"
                                    )}
                                >
                                    {item.isEnabled ? "Activée" : "Désactivée"}
                                </button>
                            </div>

                            {/* Role selector */}
                            <div className="space-y-2 pt-2 border-t border-border/60">
                                <div className="flex items-center justify-between text-[11px]">
                                    <span className="font-bold text-muted-foreground">Rôles Discord Autorisés :</span>
                                    <span className="text-[10px] text-muted-foreground font-mono">
                                        {item.roleIds.length === 0 ? "Tous les membres" : `${item.roleIds.length} rôle(s)`}
                                    </span>
                                </div>

                                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                                    {discordRoles.length === 0 ? (
                                        <p className="text-[11px] text-muted-foreground italic">Aucun rôle Discord synchronisé</p>
                                    ) : (
                                        discordRoles.map((role) => {
                                            const isSelected = item.roleIds.includes(role.id);
                                            return (
                                                <button
                                                    key={role.id}
                                                    type="button"
                                                    onClick={() => handleToggleRole(item.command.name, role.id)}
                                                    className={cn(
                                                        "px-2 py-0.5 rounded-lg text-[11px] font-bold border transition-all",
                                                        isSelected
                                                            ? "bg-accent text-accent-foreground border-accent"
                                                            : "bg-surface text-muted-foreground border-border hover:text-foreground"
                                                    )}
                                                >
                                                    {role.name}
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Channel selector */}
                            <div className="space-y-2 pt-2 border-t border-border/60">
                                <div className="flex items-center justify-between text-[11px]">
                                    <span className="font-bold text-muted-foreground flex items-center gap-1">
                                        <Hash className="w-3 h-3 text-muted-foreground" />
                                        Salons Discord Autorisés :
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-mono font-bold text-muted-foreground">
                                            {(item.channelIds?.length || 0) === 0 ? (
                                                <span className="text-emerald-500">Tous les salons</span>
                                            ) : (
                                                <span className="text-accent">{item.channelIds?.length} salon(s)</span>
                                            )}
                                        </span>
                                        {(item.channelIds?.length || 0) > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => handleResetChannels(item.command.name)}
                                                className="text-[10px] text-muted-foreground hover:text-danger underline transition-colors"
                                            >
                                                Réinitialiser
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                                    {discordChannels.length === 0 ? (
                                        <p className="text-[11px] text-muted-foreground italic">Aucun salon textuel trouvé</p>
                                    ) : (
                                        discordChannels.map((channel) => {
                                            const isSelected = item.channelIds?.includes(channel.id);
                                            return (
                                                <button
                                                    key={channel.id}
                                                    type="button"
                                                    onClick={() => handleToggleChannel(item.command.name, channel.id)}
                                                    className={cn(
                                                        "px-2 py-0.5 rounded-lg text-[11px] font-medium border transition-all flex items-center gap-1",
                                                        isSelected
                                                            ? "bg-accent/15 text-accent border-accent font-bold"
                                                            : "bg-surface text-muted-foreground border-border hover:text-foreground"
                                                    )}
                                                >
                                                    <span className="opacity-60">#</span>
                                                    <span>{channel.name}</span>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-2 border-t border-border/60">
                            <Button
                                size="sm"
                                disabled={isSaving === item.command.name}
                                onClick={() => handleSave(item.command.name)}
                                className="h-8 px-4 rounded-xl text-xs font-black gap-1.5"
                            >
                                <Save className="w-3.5 h-3.5" />
                                {isSaving === item.command.name ? "Enregistrement..." : "Sauvegarder"}
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

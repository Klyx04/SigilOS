"use client";

import { useState, useMemo } from "react";
import { 
    Terminal, 
    ShieldCheck, 
    Save, 
    Hash
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MultiSelect, type Option } from "@/components/ui/multi-select";
import { toast } from "sonner";
import { updateGuildSlashCommandPermissionAction } from "@/server/actions/slash-command-actions";

interface CommandItem {
    command: {
        name: string;
        description: string;
        usage: string;
        category: string;
        staffOnly?: boolean;
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

    // Helper sécurisé pour parser la couleur Discord (nombre entier ou hex string)
    const parseRoleColor = (rawColor: unknown): number | undefined => {
        if (typeof rawColor === "number") return rawColor > 0 ? rawColor : undefined;
        if (typeof rawColor === "string") {
            const cleaned = rawColor.replace(/^#/, "").trim();
            const parsed = parseInt(cleaned, 16);
            return !isNaN(parsed) && parsed > 0 ? parsed : undefined;
        }
        return undefined;
    };

    // Options mémorisées pour les dropdowns fluides
    const roleOptions: Option[] = useMemo(() => {
        return discordRoles.map(r => ({
            label: r.name,
            value: r.id,
            color: parseRoleColor(r.color)
        }));
    }, [discordRoles]);

    const channelOptions: Option[] = useMemo(() => {
        return discordChannels.map(c => ({
            label: `# ${c.name}`,
            value: c.id
        }));
    }, [discordChannels]);

    const handleToggleEnabled = (commandName: string) => {
        setMatrix(prev => prev.map(item => {
            if (item.command.name === commandName) {
                return { ...item, isEnabled: !item.isEnabled };
            }
            return item;
        }));
    };

    const handleRolesChange = (commandName: string, roleIds: string[]) => {
        setMatrix(prev => prev.map(item => {
            if (item.command.name === commandName) {
                return { ...item, roleIds };
            }
            return item;
        }));
    };

    const handleChannelsChange = (commandName: string, channelIds: string[]) => {
        setMatrix(prev => prev.map(item => {
            if (item.command.name === commandName) {
                return { ...item, channelIds };
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
                            Configurez la disponibilité, les rôles et les salons autorisés à exécuter chaque commande du bot via des sélecteurs déroulants fluides.
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
                                        {item.command.staffOnly && (
                                            <span className="text-[10px] font-black uppercase tracking-wider text-warning border border-warning/40 bg-warning/10 px-1.5 py-0.5 rounded-md">
                                                Staff
                                            </span>
                                        )}
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

                            {/* Dropdown Rôles Discord */}
                            <div className="space-y-1.5 pt-2 border-t border-border/60">
                                <div className="flex items-center justify-between text-[11px]">
                                    <label className="font-bold text-muted-foreground flex items-center gap-1.5">
                                        <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                                        Rôles Discord Autorisés
                                    </label>
                                    <span className="text-[10px] font-mono">
                                        {item.roleIds.length === 0 ? (
                                            <span className="text-emerald-500 font-semibold">Tous les membres</span>
                                        ) : (
                                            <span className="text-accent font-semibold">{item.roleIds.length} rôle(s)</span>
                                        )}
                                    </span>
                                </div>
                                <MultiSelect
                                    options={roleOptions}
                                    selected={item.roleIds}
                                    onChange={(roles) => handleRolesChange(item.command.name, roles)}
                                    placeholder="Tous les membres (aucun filtre de rôle)"
                                    className="bg-muted/40 border-border hover:border-border-strong text-foreground text-xs min-h-[38px]"
                                />
                            </div>

                            {/* Dropdown Salons Discord */}
                            <div className="space-y-1.5 pt-2 border-t border-border/60">
                                <div className="flex items-center justify-between text-[11px]">
                                    <label className="font-bold text-muted-foreground flex items-center gap-1.5">
                                        <Hash className="w-3.5 h-3.5 text-accent" />
                                        Salons Discord Autorisés
                                    </label>
                                    <span className="text-[10px] font-mono">
                                        {(item.channelIds?.length || 0) === 0 ? (
                                            <span className="text-emerald-500 font-semibold">Tous les salons</span>
                                        ) : (
                                            <span className="text-accent font-semibold">{item.channelIds?.length} salon(s)</span>
                                        )}
                                    </span>
                                </div>
                                <MultiSelect
                                    options={channelOptions}
                                    selected={item.channelIds || []}
                                    onChange={(channels) => handleChannelsChange(item.command.name, channels)}
                                    placeholder="Tous les salons (exécutable partout)"
                                    className="bg-muted/40 border-border hover:border-border-strong text-foreground text-xs min-h-[38px]"
                                />
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

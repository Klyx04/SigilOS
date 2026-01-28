"use client";

import { useState } from "react";
import { Plus, Trash2, Power, PowerOff, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addAllowedGuild, removeAllowedGuild, toggleGuildActive } from "@/server/actions/super-admin-actions";
import { toast } from "sonner";

interface AllowedGuild {
    id: string;
    discordGuildId: string;
    name: string | null;
    tier: string;
    isActive: boolean;
    addedBy: string;
    addedAt: Date;
    expiresAt: Date | null;
    notes: string | null;
}

interface GuildManagerProps {
    initialGuilds: AllowedGuild[];
}

export function GuildManager({ initialGuilds }: GuildManagerProps) {
    const [guilds, setGuilds] = useState(initialGuilds);
    const [newGuildId, setNewGuildId] = useState("");
    const [newGuildName, setNewGuildName] = useState("");
    const [newGuildNotes, setNewGuildNotes] = useState("");
    const [isAdding, setIsAdding] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const handleAdd = async () => {
        if (!newGuildId.trim()) {
            toast.error("L'ID Discord est requis");
            return;
        }

        setIsAdding(true);
        try {
            const guild = await addAllowedGuild({
                discordGuildId: newGuildId.trim(),
                name: newGuildName.trim() || undefined,
                notes: newGuildNotes.trim() || undefined,
            });
            setGuilds([guild, ...guilds]);
            setNewGuildId("");
            setNewGuildName("");
            setNewGuildNotes("");
            toast.success("Guilde ajoutée à la liste blanche");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Erreur lors de l'ajout");
        } finally {
            setIsAdding(false);
        }
    };

    const handleRemove = async (discordGuildId: string) => {
        if (!confirm("Supprimer cette guilde de la liste blanche ?")) return;

        try {
            await removeAllowedGuild(discordGuildId);
            setGuilds(guilds.filter(g => g.discordGuildId !== discordGuildId));
            toast.success("Guilde retirée");
        } catch (error) {
            toast.error("Erreur lors de la suppression");
        }
    };

    const handleToggle = async (discordGuildId: string) => {
        try {
            const updated = await toggleGuildActive(discordGuildId);
            setGuilds(guilds.map(g => g.discordGuildId === discordGuildId ? updated : g));
            toast.success(updated.isActive ? "Guilde activée" : "Guilde désactivée");
        } catch (error) {
            toast.error("Erreur lors du changement de statut");
        }
    };

    const handleCopy = (id: string) => {
        navigator.clipboard.writeText(id);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <div className="space-y-6">
            {/* Add Form */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Ajouter une Guilde</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Input
                        placeholder="Discord Guild ID *"
                        value={newGuildId}
                        onChange={(e) => setNewGuildId(e.target.value)}
                        className="bg-zinc-800 border-zinc-700"
                    />
                    <Input
                        placeholder="Nom (optionnel)"
                        value={newGuildName}
                        onChange={(e) => setNewGuildName(e.target.value)}
                        className="bg-zinc-800 border-zinc-700"
                    />
                    <Input
                        placeholder="Notes (optionnel)"
                        value={newGuildNotes}
                        onChange={(e) => setNewGuildNotes(e.target.value)}
                        className="bg-zinc-800 border-zinc-700"
                    />
                    <Button
                        onClick={handleAdd}
                        disabled={isAdding}
                        className="bg-amber-600 hover:bg-amber-700"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        {isAdding ? "Ajout..." : "Ajouter"}
                    </Button>
                </div>
            </div>

            {/* Guilds Table */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg overflow-hidden">
                <table className="w-full">
                    <thead className="bg-zinc-800/50">
                        <tr>
                            <th className="text-left px-4 py-3 text-xs text-zinc-400 font-medium">Statut</th>
                            <th className="text-left px-4 py-3 text-xs text-zinc-400 font-medium">ID Discord</th>
                            <th className="text-left px-4 py-3 text-xs text-zinc-400 font-medium">Nom</th>
                            <th className="text-left px-4 py-3 text-xs text-zinc-400 font-medium">Tier</th>
                            <th className="text-left px-4 py-3 text-xs text-zinc-400 font-medium">Notes</th>
                            <th className="text-left px-4 py-3 text-xs text-zinc-400 font-medium">Ajouté le</th>
                            <th className="text-right px-4 py-3 text-xs text-zinc-400 font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                        {guilds.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                                    Aucune guilde autorisée. Ajoutez-en une ci-dessus.
                                </td>
                            </tr>
                        ) : guilds.map((guild) => (
                            <tr key={guild.id} className={!guild.isActive ? "opacity-50" : ""}>
                                <td className="px-4 py-3">
                                    <button
                                        onClick={() => handleToggle(guild.discordGuildId)}
                                        className={`p-1.5 rounded ${guild.isActive ? "text-green-400 hover:bg-green-500/10" : "text-zinc-500 hover:bg-zinc-700/50"}`}
                                        title={guild.isActive ? "Désactiver" : "Activer"}
                                    >
                                        {guild.isActive ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                                    </button>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <code className="text-xs text-zinc-300 font-mono">{guild.discordGuildId}</code>
                                        <button
                                            onClick={() => handleCopy(guild.discordGuildId)}
                                            className="text-zinc-500 hover:text-white"
                                        >
                                            {copiedId === guild.discordGuildId ? (
                                                <Check className="w-3 h-3 text-green-400" />
                                            ) : (
                                                <Copy className="w-3 h-3" />
                                            )}
                                        </button>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-white">
                                    {guild.name || <span className="text-zinc-500">—</span>}
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`text-xs px-2 py-1 rounded ${guild.tier === "PREMIUM" ? "bg-amber-500/20 text-amber-400" :
                                            guild.tier === "FREE" ? "bg-green-500/20 text-green-400" :
                                                "bg-zinc-700 text-zinc-300"
                                        }`}>
                                        {guild.tier}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-xs text-zinc-400 max-w-[200px] truncate">
                                    {guild.notes || <span className="text-zinc-600">—</span>}
                                </td>
                                <td className="px-4 py-3 text-xs text-zinc-400">
                                    {new Date(guild.addedAt).toLocaleDateString("fr-FR")}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <button
                                        onClick={() => handleRemove(guild.discordGuildId)}
                                        className="text-red-400/60 hover:text-red-400 p-1.5 rounded hover:bg-red-500/10"
                                        title="Supprimer"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

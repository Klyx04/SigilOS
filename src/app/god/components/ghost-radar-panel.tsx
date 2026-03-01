"use client";

import { useState } from "react";
import { scanGhostGuilds, forceBotLeaveGuild } from "@/server/actions/god-discord-actions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Radar, Skull, Server, ShieldAlert, Loader2, Play } from "lucide-react";

export function GhostRadarPanel() {
    const [isScanning, setIsScanning] = useState(false);
    const [ghosts, setGhosts] = useState<{ id: string; name: string; icon: string | null }[] | null>(null);
    const [kickingIds, setKickingIds] = useState<Set<string>>(new Set());

    const handleScan = async () => {
        setIsScanning(true);
        try {
            const res = await scanGhostGuilds();
            if (res.success && res.ghosts) {
                setGhosts(res.ghosts);
                if (res.ghosts.length === 0) {
                    toast.success("Aucun serveur fantôme détecté !");
                } else {
                    toast.warning(`${res.ghosts.length} serveurs fantômes trouvés !`);
                }
            } else {
                toast.error(res.error || "Erreur lors du scan");
            }
        } catch (e) {
            toast.error("Erreur inattendue");
        } finally {
            setIsScanning(false);
        }
    };

    const handleKick = async (guildId: string, guildName: string) => {
        if (!confirm(`Forcer le bot à quitter "${guildName}" ?`)) return;

        setKickingIds(new Set([...kickingIds, guildId]));
        try {
            const res = await forceBotLeaveGuild(guildId);
            if (res.success) {
                toast.success(`Le bot a quitté ${guildName}`);
                setGhosts(ghosts?.filter(g => g.id !== guildId) || null);
            } else {
                toast.error(res.error || "Erreur lors de l'expulsion");
            }
        } catch (e) {
            toast.error("Erreur inattendue");
        } finally {
            const newKickingIds = new Set(kickingIds);
            newKickingIds.delete(guildId);
            setKickingIds(newKickingIds);
        }
    };

    return (
        <div className="bg-zinc-900/30 border border-white/5 rounded-3xl p-8 backdrop-blur-xl">
            <div className="flex items-start justify-between mb-8">
                <div>
                    <h3 className="text-xl font-black text-rose-500 flex items-center gap-3 uppercase tracking-widest">
                        <Radar className="w-6 h-6 animate-pulse" />
                        Radar Anti-Fantômes
                    </h3>
                    <p className="text-zinc-500 mt-2 text-sm">
                        Détecte les serveurs Discord qui ont invité le bot mais qui ne sont pas sur liste blanche.
                    </p>
                </div>
                <Button
                    onClick={handleScan}
                    disabled={isScanning}
                    size="lg"
                    className="bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all font-bold uppercase tracking-widest border border-rose-500/20"
                >
                    {isScanning ? (
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                        <Play className="w-5 h-5 mr-2" />
                    )}
                    {isScanning ? "Scan en cours..." : "Lancer le scan"}
                </Button>
            </div>

            {ghosts !== null && (
                <div className="space-y-4">
                    {ghosts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 border border-white/5 rounded-2xl bg-black/20 text-emerald-500">
                            <ShieldAlert className="w-12 h-12 mb-4 opacity-50" />
                            <p className="font-bold uppercase tracking-widest text-sm">Secteur Sécurisé</p>
                            <p className="text-xs text-zinc-500 mt-2">Aucune anomalie détectée sur le réseau Discord.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {ghosts.map((guild) => (
                                <div key={guild.id} className="flex items-center justify-between p-4 bg-black/40 border border-white/5 rounded-2xl hover:border-rose-500/30 transition-colors">
                                    <div className="flex items-center gap-4">
                                        {guild.icon ? (
                                            <img
                                                src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`}
                                                alt={guild.name}
                                                className="w-12 h-12 rounded-xl grayscale opacity-70"
                                            />
                                        ) : (
                                            <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center border border-white/5">
                                                <Server className="w-5 h-5 text-zinc-500" />
                                            </div>
                                        )}
                                        <div>
                                            <h4 className="font-bold text-white">{guild.name}</h4>
                                            <code className="text-[10px] text-zinc-500">{guild.id}</code>
                                        </div>
                                    </div>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        className="font-bold uppercase tracking-widest text-[10px]"
                                        onClick={() => handleKick(guild.id, guild.name)}
                                        disabled={kickingIds.has(guild.id)}
                                    >
                                        {kickingIds.has(guild.id) ? (
                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        ) : (
                                            <Skull className="w-4 h-4 mr-2" />
                                        )}
                                        Expulser le bot
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

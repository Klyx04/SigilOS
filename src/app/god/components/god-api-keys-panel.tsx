"use client";

import { useState } from "react";
import { 
    Key, 
    ShieldCheck, 
    AlertTriangle, 
    Trash2, 
    Globe, 
    Clock, 
    Layers, 
    Search 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { revokeGuildApiKeyAction } from "@/server/actions/api-key-actions";

export function GodApiKeysPanel({ initialKeys }: { initialKeys: any[] }) {
    const [keys, setKeys] = useState<any[]>(initialKeys);
    const [searchQuery, setSearchQuery] = useState("");

    const handleRevoke = async (guildId: string, apiKeyId: string) => {
        if (!confirm("Attention SuperAdmin : Voulez-vous forcer la révocation immédiate de cette clé d'API ?")) {
            return;
        }

        try {
            const res = await revokeGuildApiKeyAction(guildId, apiKeyId);
            if (res.success) {
                setKeys(prev => prev.map(k => k.id === apiKeyId ? { ...k, revokedAt: new Date() } : k));
                toast.success("Clé d'API révoquée par SuperAdmin");
            } else {
                toast.error(res.error || "Échec de la révocation");
            }
        } catch {
            toast.error("Erreur serveur");
        }
    };

    const filteredKeys = keys.filter(k => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            k.name.toLowerCase().includes(q) ||
            k.prefix.toLowerCase().includes(q) ||
            (k.guild?.name && k.guild.name.toLowerCase().includes(q))
        );
    });

    const activeCount = keys.filter(k => !k.revokedAt).length;

    return (
        <div className="space-y-6">
            <div className="p-6 sm:p-8 rounded-[2rem] border border-border bg-surface shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div className="space-y-1">
                        <h3 className="text-sm font-black text-foreground uppercase tracking-wider flex items-center gap-2">
                            <Key className="w-4 h-4 text-accent" />
                            Surveillance des Clés d'API Publiques (Anti-Scraping)
                        </h3>
                        <p className="text-muted-foreground text-caption font-medium">
                            Monitoring de tous les jetons d'accès émis pour des applications tierces avec kill-switch centralisé.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground bg-elevated px-3 py-1.5 rounded-xl border border-border">
                            {activeCount} active(s) / {keys.length} totale(s)
                        </span>
                    </div>
                </div>

                <div className="mb-6">
                    <div className="relative">
                        <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Rechercher par nom d'app, guilde ou préfixe..."
                            className="pl-10 h-10 rounded-2xl bg-elevated/40"
                        />
                    </div>
                </div>

                {filteredKeys.length === 0 ? (
                    <div className="py-12 text-center text-xs text-muted-foreground italic">
                        Aucune clé d'API trouvée.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-border text-[10px] font-black uppercase text-muted-foreground tracking-wider">
                                    <th className="py-3 px-4">Application</th>
                                    <th className="py-3 px-4">Guilde</th>
                                    <th className="py-3 px-4">Préfixe</th>
                                    <th className="py-3 px-4">Scopes</th>
                                    <th className="py-3 px-4">Statut</th>
                                    <th className="py-3 px-4">Dernier Appel</th>
                                    <th className="py-3 px-4 text-right">Kill-Switch</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                                {filteredKeys.map((k) => {
                                    const isRevoked = !!k.revokedAt;
                                    return (
                                        <tr key={k.id} className="hover:bg-elevated/40 transition-colors">
                                            <td className="py-3 px-4 font-bold text-foreground">
                                                {k.name}
                                            </td>
                                            <td className="py-3 px-4 font-semibold text-muted-foreground">
                                                {k.guild?.name || "Guilde inconnue"}
                                            </td>
                                            <td className="py-3 px-4 font-mono text-[11px] text-accent">
                                                {k.prefix}...
                                            </td>
                                            <td className="py-3 px-4 text-muted-foreground">
                                                {k.scopes.join(", ")}
                                            </td>
                                            <td className="py-3 px-4">
                                                {isRevoked ? (
                                                    <span className="text-[10px] font-black text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                                                        Révoquée
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                                        Active
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 font-mono text-muted-foreground">
                                                {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString("fr-FR", {
                                                    day: "2-digit",
                                                    month: "2-digit",
                                                    hour: "2-digit",
                                                    minute: "2-digit"
                                                }) : "Jamais"}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                {!isRevoked && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleRevoke(k.guildId, k.id)}
                                                        className="h-7 px-2.5 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 text-xs font-bold gap-1"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                        Révoquer
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

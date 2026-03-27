"use client";

import { useState } from "react";
import { deleteGhostUser, cleanupGhostUsers } from "@/server/actions/super-admin-actions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trash2, AlertTriangle, UserX, Loader2 } from "lucide-react";

interface TargetPurgePanelProps {
    ghostUsers: any[];
}

export function TargetPurgePanel({ ghostUsers }: TargetPurgePanelProps) {
    const [isPurgingAll, setIsPurgingAll] = useState(false);
    const [purgingId, setPurgingId] = useState<string | null>(null);

    const handlePurgeAll = async () => {
        if (!confirm("Voulez-vous purger TOUS les comptes orphelins vieux de plus de 24h ?")) return;
        setIsPurgingAll(true);
        try {
            const res = await cleanupGhostUsers();
            if (res.success) {
                toast.success(`${res.count} comptes purgés !`);
            } else {
                toast.error("Erreur lors de la purge.");
            }
        } catch (e: any) {
            toast.error(e.message || "Erreur inattendue");
        } finally {
            setIsPurgingAll(false);
        }
    };

    const handleDeleteUser = async (user: any) => {
        if (!confirm(`Purger définitivement le compte de ${user.name || "Inconnu"} ?`)) return;
        setPurgingId(user.id);
        try {
            const res = await deleteGhostUser(user.id);
            if (res.success) {
                toast.success(`Compte ${user.name || user.id} purgé avec succès.`);
            }
        } catch (e: any) {
            toast.error(e.message || "Impossible de purger l'utilisateur.");
        } finally {
            setPurgingId(null);
        }
    };

    return (
        <div className="bg-zinc-900/10 border border-white/5 rounded-3xl p-8 backdrop-blur-xl h-full flex flex-col">
            <div className="flex items-center justify-between mb-8">
                <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Target Purge Zone
                </h3>
                <div className="flex items-center gap-4">
                    <span className="text-2xl font-black text-rose-400">{ghostUsers.length}</span>
                    {ghostUsers.length > 0 && (
                        <Button
                            variant="destructive"
                            size="sm"
                            disabled={isPurgingAll}
                            onClick={handlePurgeAll}
                            className="bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white border border-rose-500/20 font-bold uppercase tracking-widest text-[10px]"
                        >
                            {isPurgingAll ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Trash2 className="w-3 h-3 mr-2" />}
                            Purger Auto
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {ghostUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 border border-white/5 rounded-2xl bg-black/20 text-emerald-500 mt-4">
                        <UserX className="w-12 h-12 mb-4 opacity-50" />
                        <p className="font-bold uppercase tracking-widest text-sm">Zone Propre</p>
                        <p className="text-xs text-zinc-500 mt-2 text-center">Aucun compte orphelin polluant la base de données.</p>
                    </div>
                ) : (
                    ghostUsers.map((user) => (
                        <div key={user.id} className="flex items-center justify-between p-3 bg-black/40 border border-white/5 rounded-2xl hover:border-zinc-700 transition-colors group">
                            <div className="flex items-center gap-3">
                                {user.image ? (
                                    <img src={user.image} alt="Avatar" className="w-10 h-10 rounded-xl grayscale opacity-70 border border-white/10" />
                                ) : (
                                    <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center border border-white/5">
                                        <UserX className="w-4 h-4 text-zinc-500" />
                                    </div>
                                )}
                                <div>
                                    <h4 className="font-bold text-sm text-white">{user.name || "Utilisateur sans nom"}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[9px] font-mono text-zinc-500">ID: {user.accounts?.[0]?.providerAccountId || user.id.slice(0, 8)}</span>
                                        <span className="w-1 h-1 bg-zinc-700 rounded-full" />
                                        <span className="text-[9px] text-amber-500 uppercase tracking-widest">
                                            {new Date(user.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteUser(user)}
                                disabled={purgingId === user.id || isPurgingAll}
                                className="h-8 w-8 text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all"
                                title="Purger définitivement"
                            >
                                {purgingId === user.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </Button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

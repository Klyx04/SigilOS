"use client";

import { useState, useMemo } from "react";
import { deleteGhostUser, cleanupGhostUsers } from "@/server/actions/super-admin-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trash2, AlertTriangle, UserX, Loader2, CheckCircle2, Search, Copy, Clock, Calendar, MousePointer2, CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface TargetPurgePanelProps {
    ghostUsers: any[];
}

export function TargetPurgePanel({ ghostUsers }: TargetPurgePanelProps) {
    const [isPurgingAll, setIsPurgingAll] = useState(false);
    const [purgingId, setPurgingId] = useState<string | null>(null);
    const [search, setSearch] = useState("");

    const filteredUsers = useMemo(() => {
        if (!search) return ghostUsers;
        const s = search.toLowerCase();
        return ghostUsers.filter(u => 
            u.name?.toLowerCase().includes(s) || 
            u.id.toLowerCase().includes(s) || 
            u.accounts?.[0]?.providerAccountId?.includes(s)
        );
    }, [ghostUsers, search]);

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

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("ID copié !");
    };

    return (
        <div className="flex h-full flex-col gap-5">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div className="space-y-1">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
                        Comptes sans profil
                    </h3>
                    <p className="text-xs text-muted-foreground">
                        Comptes créés mais jamais reliés à une guilde ni à un profil visiteur.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative min-w-[200px] flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                        <Input
                            placeholder="Rechercher (nom, ID, Discord)…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="h-10 pl-9 text-sm"
                        />
                    </div>

                    <div className="flex items-center gap-4 rounded-xl border border-border bg-surface/10 px-4 py-2">
                        <div className="flex flex-col items-center">
                            <span className="text-2xl font-semibold tabular-nums text-warning">{ghostUsers.length}</span>
                            <span className="text-xs text-muted-foreground">Total</span>
                        </div>
                        {ghostUsers.length > 0 && (
                            <Button
                                variant="destructive"
                                size="sm"
                                disabled={isPurgingAll}
                                onClick={handlePurgeAll}
                                className="h-9 gap-2"
                            >
                                {isPurgingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
                                Purger tout
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Aide au diagnostic */}
            <div className="flex items-start gap-3 rounded-xl border border-warning/20 bg-warning/5 p-4">
                <UserX className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                    Ces comptes n&apos;ont <strong className="text-foreground">ni profil de guilde ni profil visiteur</strong>.
                    Vérifie l&apos;activité (sessions) avant de purger : un compte sans session est probablement
                    un robot ou une connexion interrompue.
                </p>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar relative z-10">
                {filteredUsers.length === 0 ? (
                    <div className="mt-2 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/10 py-14 text-muted-foreground">
                        {search ? (
                            <p className="text-xs font-medium">Aucun résultat pour « {search} »</p>
                        ) : (
                            <>
                                <CheckCircle2 className="mb-3 h-10 w-10 opacity-30" aria-hidden="true" />
                                <p className="text-xs font-medium">Aucune cible détectée</p>
                            </>
                        )}
                    </div>
                ) : (
                    filteredUsers.map((user) => {
                        const discordId = user.accounts?.[0]?.providerAccountId;
                        const lastActivity = user.sessions?.[0]?.expires;
                        
                        return (
                            <div key={user.id} className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-surface/10 p-4 transition-colors hover:border-border-strong sm:flex-row sm:items-center">
                                <div className="flex items-center gap-4">
                                    <div className="relative shrink-0">
                                        {user.image ? (
                                            <img src={user.image} alt="" className="w-12 h-12 rounded-xl opacity-80 group-hover:opacity-100 transition-opacity" />
                                        ) : (
                                            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-elevated">
                                                <UserX className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                                            </div>
                                        )}
                                        {user._count?.sessions > 0 && (
                                            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-success" title="Session active" />
                                        )}
                                    </div>
                                    
                                    <div className="space-y-1.5 overflow-hidden">
                                        <div className="flex items-center gap-3">
                                            <h4 className="truncate text-sm font-medium text-foreground">{user.name || "Utilisateur"}</h4>
                                            {discordId && (
                                                <button 
                                                    onClick={() => copyToClipboard(discordId)}
                                                    className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                                                    title="Copier l'ID Discord"
                                                    aria-label="Copier l'ID Discord"
                                                >
                                                    <Copy className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                        
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                                <Calendar className="h-3 w-3" aria-hidden="true" />
                                                <span className="text-xs">Créé le {new Date(user.createdAt).toLocaleDateString("fr-FR")}</span>
                                            </div>
                                            
                                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                                <MousePointer2 className="h-3 w-3" aria-hidden="true" />
                                                <span className="text-xs">{user._count?.sessions ?? 0} session{(user._count?.sessions ?? 0) > 1 ? "s" : ""}</span>
                                            </div>

                                            {user._count?.guildEvents > 0 && (
                                                <div className="flex items-center gap-1.5 text-warning">
                                                    <CalendarCheck className="h-3 w-3" aria-hidden="true" />
                                                    <span className="text-xs">{user._count.guildEvents} événement{(user._count.guildEvents ?? 0) > 1 ? "s" : ""}</span>
                                                </div>
                                            )}

                                            {lastActivity && (
                                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                                    <Clock className="h-3 w-3" aria-hidden="true" />
                                                    <span className="text-xs">Actif le {new Date(lastActivity).toLocaleDateString("fr-FR")}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 justify-end shrink-0">
                                    <div className="flex flex-col items-end mr-4 hidden md:flex gap-1.5">
                                         <span className={cn(
                                             "rounded-full border px-2 py-0.5 text-xs font-medium",
                                             user._count?.sessions > 0 ? "border-success/30 bg-success/10 text-success" : "border-border bg-surface/10 text-muted-foreground"
                                         )}>
                                             {user._count?.sessions > 0 ? "Interactif" : "Sans session"}
                                         </span>
                                         
                                         {/* New indicator for Whitelist membership */}
                                         {user.memberInWhitelists && user.memberInWhitelists.length > 0 && (
                                             <div className="flex flex-col items-end gap-1">
                                                 <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                                                     Sur whitelist
                                                 </span>
                                                 <div className="flex max-w-[150px] flex-wrap justify-end gap-1">
                                                     {user.memberInWhitelists.map((gName: string, idx: number) => (
                                                         <span key={idx} className="whitespace-nowrap text-xs text-muted-foreground">{gName}</span>
                                                     ))}
                                                 </div>
                                             </div>
                                         )}
                                     </div>

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDeleteUser(user)}
                                        disabled={purgingId === user.id || isPurgingAll}
                                        className="h-9 w-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                        aria-label={`Purger ${user.name || "ce compte"}`}
                                    >
                                        {purgingId === user.id ? <Loader2 className="h-4 w-4 animate-spin text-destructive" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
                                    </Button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

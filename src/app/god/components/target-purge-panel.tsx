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
        <div className="bg-zinc-900/10 border border-white/5 rounded-3xl p-8 backdrop-blur-xl h-full flex flex-col gap-6 shadow-2xl relative overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                <div className="space-y-1">
                    <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest flex items-center gap-3">
                        <AlertTriangle className="w-4 h-4" />
                        Target Purge Zone
                    </h3>
                    <p className="text-zinc-500 text-caption font-bold uppercase tracking-widest">Identification & Nettoyage des Ghost Users</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-4">
                    <div className="relative group flex-1 min-w-[200px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-amber-500 transition-colors" />
                        <Input 
                            placeholder="Rechercher (Nom, ID, Discord)..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-12 h-12 bg-black/40 border-white/5 focus:border-amber-500/50 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all"
                        />
                    </div>

                    <div className="flex items-center gap-6 bg-black/40 px-6 py-3 rounded-2xl border border-white/5 shadow-inner">
                        <div className="flex flex-col items-center">
                            <span className="text-3xl font-black text-rose-500 leading-none">{ghostUsers.length}</span>
                            <span className="text-caption font-black text-rose-500/50 uppercase tracking-tighter mt-1">Total</span>
                        </div>
                        {ghostUsers.length > 0 && (
                            <Button
                                variant="destructive"
                                size="sm"
                                disabled={isPurgingAll}
                                onClick={handlePurgeAll}
                                className="bg-rose-500 text-white hover:bg-rose-600 font-black uppercase tracking-widest text-caption h-10 px-5 "
                            >
                                {isPurgingAll ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Trash2 className="w-3 h-3 mr-2" />}
                                Purge Globale
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Explanatory Banner */}
            <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-5 flex gap-4 items-start relative z-10">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 shrink-0">
                    <UserX className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                    <h4 className="text-caption font-black text-amber-500 uppercase tracking-widest leading-none">Aide au Diagnostic</h4>
                    <p className="text-caption text-zinc-500 leading-relaxed font-bold uppercase tracking-tight">
                        Ces utilisateurs ont un compte mais **aucun** profil de guilde. 
                        Vérifie l'activité (sessions) avant de purger. Un utilisateur avec 0 session est probablement un robot ou une erreur de connexion.
                    </p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar relative z-10">
                {filteredUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 border border-dashed border-white/5 rounded-[2.5rem] bg-black/20 text-zinc-600 mt-2">
                        {search ? (
                            <p className="font-black uppercase tracking-widest text-xs">Aucun résultat pour "{search}"</p>
                        ) : (
                            <>
                                <CheckCircle2 className="w-12 h-12 mb-4 opacity-20" />
                                <p className="font-black uppercase tracking-widest text-xs">Aucune cible détectée</p>
                            </>
                        )}
                    </div>
                ) : (
                    filteredUsers.map((user) => {
                        const discordId = user.accounts?.[0]?.providerAccountId;
                        const lastActivity = user.sessions?.[0]?.expires;
                        
                        return (
                            <div key={user.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-black/40 border border-white/5 rounded-2xl hover:bg-black/60 hover:border-white/10 transition-all group gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="relative shrink-0">
                                        {user.image ? (
                                            <img src={user.image} alt="" className="w-12 h-12 rounded-xl opacity-80 group-hover:opacity-100 transition-opacity" />
                                        ) : (
                                            <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center border border-white/5">
                                                <UserX className="w-5 h-5 text-zinc-600" />
                                            </div>
                                        )}
                                        {user._count?.sessions > 0 && (
                                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-black animate-pulse" title="Session active" />
                                        )}
                                    </div>
                                    
                                    <div className="space-y-1.5 overflow-hidden">
                                        <div className="flex items-center gap-3">
                                            <h4 className="font-black text-sm text-white tracking-tight truncate uppercase italic">{user.name || "Utilisateur"}</h4>
                                            {discordId && (
                                                <button 
                                                    onClick={() => copyToClipboard(discordId)}
                                                    className="p-1.5 rounded-md hover:bg-white/5 text-zinc-600 hover:text-white transition-all"
                                                    title="Copier Discord ID"
                                                >
                                                    <Copy className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                        
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                            <div className="flex items-center gap-1.5 text-zinc-500">
                                                <Calendar className="w-3 h-3" />
                                                <span className="text-caption font-bold uppercase tracking-tighter">Créé: {new Date(user.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            
                                            <div className="flex items-center gap-1.5 text-zinc-500">
                                                <MousePointer2 className="w-3 h-3" />
                                                <span className="text-caption font-bold uppercase tracking-tighter">{user._count?.sessions} sessions</span>
                                            </div>

                                            {user._count?.guildEvents > 0 && (
                                                <div className="flex items-center gap-1.5 text-amber-500">
                                                    <CalendarCheck className="w-3 h-3" />
                                                    <span className="text-caption font-bold uppercase tracking-tighter text-amber-500/80">{user._count.guildEvents} events</span>
                                                </div>
                                            )}

                                            {lastActivity && (
                                                <div className="flex items-center gap-1.5 text-blue-400/70 italic">
                                                    <Clock className="w-3 h-3" />
                                                    <span className="text-caption font-bold uppercase tracking-tighter">Actif: {new Date(lastActivity).toLocaleDateString()}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 justify-end shrink-0">
                                    <div className="flex flex-col items-end mr-4 hidden md:flex gap-1.5">
                                         <span className={cn(
                                             "text-caption font-black uppercase tracking-widest px-2 py-0.5 rounded-md border",
                                             user._count?.sessions > 0 ? "text-emerald-500 border-emerald-500/20 bg-emerald-500/5" : "text-zinc-600 border-white/5 bg-white/5"
                                         )}>
                                             {user._count?.sessions > 0 ? "Interactif" : "Visiteur"}
                                         </span>
                                         
                                         {/* New indicator for Whitelist membership */}
                                         {user.memberInWhitelists && user.memberInWhitelists.length > 0 && (
                                             <div className="flex flex-col items-end gap-1">
                                                 <span className="text-caption font-black uppercase tracking-tighter text-amber-500/80 bg-amber-500/5 border border-amber-500/10 px-1.5 rounded-sm">
                                                     Sur Whitelist
                                                 </span>
                                                 <div className="flex flex-wrap gap-1 justify-end max-w-[150px]">
                                                     {user.memberInWhitelists.map((gName: string, idx: number) => (
                                                         <span key={idx} className="text-caption text-zinc-500 whitespace-nowrap">{gName}</span>
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
                                        className="h-10 w-10 text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"
                                    >
                                        {purgingId === user.id ? <Loader2 className="w-4 h-4 animate-spin text-rose-500" /> : <Trash2 className="w-4 h-4" />}
                                    </Button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
            
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-rose-500/5 blur-[120px] rounded-full -mr-32 -mb-32 pointer-events-none" />
        </div>
    );
}

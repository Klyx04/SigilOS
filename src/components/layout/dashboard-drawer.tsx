"use client";

import { useState, useEffect } from "react";
import { 
    Sheet, 
    SheetContent, 
    SheetHeader, 
    SheetTitle, 
    SheetTrigger 
} from "@/components/ui/sheet";
import { 
    ChevronRight, 
    LayoutDashboard, 
    Shield, 
    PlusCircle, 
    Crown, 
    ExternalLink,
    Loader2,
    Settings2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { getGuildsSeparated } from "@/server/actions/user-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface DashboardDrawerProps {
    children: React.ReactNode;
    clientId?: string;
}

export function DashboardDrawer({ children, clientId = "1458259008355045519" }: DashboardDrawerProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [guilds, setGuilds] = useState<{ active: any[], pending: any[] }>({ active: [], pending: [] });

    const loadGuilds = async () => {
        setLoading(true);
        try {
            const data = await getGuildsSeparated();
            setGuilds({ active: data.active, pending: data.pending });
        } catch (error) {
            console.error("Failed to load guilds for drawer:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            loadGuilds();
        }
    }, [open]);

    // Auto-refresh when bot is successfully invited from the drawer link
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data === "sigilos-bot-invited" && event.origin === window.location.origin) {
                window.location.reload();
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, []);

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                {children}
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md bg-zinc-950/80 backdrop-blur-2xl border-l border-white/10 p-0 overflow-hidden flex flex-col">
                <div className="absolute inset-0 z-0 pointer-events-none">
                    <div className="absolute top-[-10%] right-[-10%] w-[300px] h-[300px] bg-emerald-500/10 rounded-full blur-[100px]" />
                    <div className="absolute bottom-[-10%] left-[-10%] w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[100px]" />
                </div>

                <SheetHeader className="p-8 pb-4 relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-lg">
                            <LayoutDashboard className="w-5 h-5 text-emerald-400" />
                        </div>
                        <SheetTitle className="text-2xl font-black text-white italic tracking-tighter uppercase">Gestion SigilOS</SheetTitle>
                    </div>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Gestion Multi-Guilde & Déploiement</p>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8 relative z-10">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                            <p className="text-xs font-black text-zinc-500 uppercase tracking-widest animate-pulse">Chargement de vos accès...</p>
                        </div>
                    ) : (
                        <>
                            {/* ACTIVE GUILDS */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-2">
                                    <h3 className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <Shield className="w-3 h-3" /> Vos Accès Actifs
                                    </h3>
                                    <span className="text-[10px] font-bold text-zinc-600 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">{guilds.active.length}</span>
                                </div>

                                <div className="grid gap-3">
                                    <AnimatePresence mode="popLayout">
                                        {guilds.active.map((guild, i) => (
                                            <motion.div
                                                key={guild.id}
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.05 }}
                                            >
                                                <Link 
                                                    href={`/dashboard/${guild.id}`}
                                                    onClick={() => setOpen(false)}
                                                    className="group flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-emerald-500/30 transition-all shadow-xl"
                                                >
                                                    <Avatar className="h-12 w-12 rounded-xl border border-white/10 group-hover:border-emerald-500/50 transition-colors">
                                                        <AvatarImage src={guild.icon || ""} alt={guild.name} />
                                                        <AvatarFallback className="bg-zinc-900 text-zinc-500 font-black rounded-xl text-xs">
                                                            {guild.name.substring(0, 2).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-black text-white group-hover:text-emerald-400 transition-colors truncate uppercase italic tracking-tighter">
                                                            {guild.name}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest truncate">
                                                                {guild.isAdmin ? "Administrateur" : "Membre Actif"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                                                </Link>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>

                                    {guilds.active.length === 0 && (
                                        <div className="p-8 text-center rounded-2xl border border-dashed border-white/5 bg-white/5">
                                            <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest italic">Aucun accès détecté</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* PENDING / DEPLOYMENT */}
                            {guilds.pending.length > 0 && (
                                <div className="space-y-4 pt-4 border-t border-white/5">
                                    <div className="flex items-center justify-between px-2">
                                        <h3 className="text-[11px] font-black text-amber-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                            <PlusCircle className="w-3 h-3" /> Déploiement Disponible
                                        </h3>
                                    </div>

                                    <div className="grid gap-3">
                                        {guilds.pending.map((guild, i) => (
                                            <motion.div
                                                key={guild.id}
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: 0.2 + (i * 0.05) }}
                                                className="group flex items-center gap-4 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 hover:bg-amber-500/10 transition-all border-dashed"
                                            >
                                                <Avatar className="h-10 w-10 rounded-xl border border-white/10 opacity-60">
                                                    <AvatarImage src={guild.icon || ""} alt={guild.name} />
                                                    <AvatarFallback className="bg-zinc-900 text-zinc-600 font-bold rounded-xl text-[10px]">
                                                        {guild.name.substring(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0 text-left">
                                                    <div className="text-xs font-black text-zinc-300 truncate uppercase tracking-tighter">
                                                        {guild.name}
                                                    </div>
                                                    <p className="text-[9px] font-bold text-amber-500/60 uppercase tracking-widest mt-0.5">Admin Discord Détecté</p>
                                                </div>
                                                <Link 
                                                    href={`https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands&guild_id=${guild.id}&redirect_uri=${encodeURIComponent(window.location.origin + '/onboarding/success')}&response_type=code`}
                                                    target="_blank"
                                                    className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 hover:bg-amber-500 hover:text-white transition-all shadow-inner"
                                                >
                                                    <PlusCircle className="w-4 h-4" />
                                                </Link>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Quick Help / Info */}
                            <div className="p-5 rounded-3xl bg-indigo-500/5 border border-indigo-500/10 space-y-2 mt-10">
                                <div className="flex items-center gap-2 text-indigo-400">
                                    <Settings2 className="w-4 h-4" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Le saviez-vous ?</span>
                                </div>
                                <p className="text-[9px] text-zinc-500 font-bold leading-relaxed uppercase tracking-tight opacity-70">
                                    SigilOS est multi-guilde. Vous pouvez passer d'un empire à l'autre sans jamais vous déconnecter. Toutes vos récompenses sont centralisées sur votre profil global.
                                </p>
                            </div>
                        </>
                    )}
                </div>

                <div className="p-8 border-t border-white/5 bg-black/40 backdrop-blur-md relative z-10 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-1">Session Active</div>
                        <Link 
                            href="/api/auth/signout"
                            className="text-[10px] font-black text-white hover:text-red-500 transition-colors italic uppercase tracking-tighter truncate group/logout flex items-center gap-2"
                        >
                            Explorateur Galactique
                            <span className="text-[8px] opacity-0 group-hover/logout:opacity-100 transition-opacity text-red-500 lowercase font-mono">(déconnexion)</span>
                        </Link>
                    </div>
                    <Button 
                        onClick={() => setOpen(false)}
                        variant="outline"
                        className="h-auto px-5 py-2.5 rounded-xl border-white/10 bg-white/5 text-[9px] font-black uppercase tracking-widest hover:bg-white/10 hover:text-emerald-400 transition-all shadow-2xl"
                    >
                        Fermer
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}

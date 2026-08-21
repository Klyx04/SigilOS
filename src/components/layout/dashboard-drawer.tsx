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
import { buildDiscordBotInviteUrl } from "@/lib/discord-permissions";

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
            <SheetContent className="w-full sm:max-w-md bg-background/90 border-l border-border p-0 overflow-hidden flex flex-col">
                <SheetHeader className="p-8 pb-4 relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center shadow-lg">
                            <LayoutDashboard className="w-5 h-5 text-success" />
                        </div>
                        <SheetTitle className="text-xl font-bold text-foreground italic tracking-tight">Gestion SigilOS</SheetTitle>
                    </div>
                    <p className="text-caption font-semibold text-muted-foreground uppercase tracking-wider">Gestion Multi-Guilde & Déploiement</p>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8 relative z-10">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Loader2 className="w-8 h-8 animate-spin text-success" />
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider animate-pulse">Chargement de vos accès...</p>
                        </div>
                    ) : (
                        <>
                            {/* ACTIVE GUILDS */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-2">
                                    <h3 className="text-caption font-semibold text-success uppercase tracking-wider flex items-center gap-2">
                                        <Shield className="w-3 h-3" /> Vos Accès Actifs
                                    </h3>
                                    <span className="text-caption font-semibold text-muted-foreground bg-surface px-2 py-0.5 rounded-full border border-border">{guilds.active.length}</span>
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
                                                    className="group flex items-center gap-4 p-4 rounded-2xl bg-surface border border-border hover:bg-surface hover:border-success/30 transition-colors"
                                                >
                                                    <Avatar className="h-12 w-12 rounded-xl border border-border group-hover:border-success/50 transition-colors">
                                                        <AvatarImage src={guild.icon || ""} alt={guild.name} />
                                                        <AvatarFallback className="bg-surface text-muted-foreground font-semibold rounded-xl text-xs">
                                                            {guild.name.substring(0, 2).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-semibold text-foreground group-hover:text-success transition-colors truncate">
                                                            {guild.name}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <div className={cn("w-1.5 h-1.5 rounded-full", guild.hasAccess ? "bg-success animate-pulse" : "bg-warning")} />
                                                            <span className={cn("text-caption font-medium truncate", guild.hasAccess ? "text-muted-foreground" : "text-warning/90")}>
                                                                {guild.accessLabel}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-success transition-colors" />
                                                </Link>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>

                                    {guilds.active.length === 0 && (
                                        <div className="p-8 text-center rounded-2xl border border-dashed border-border bg-surface">
                                            <p className="text-xs font-semibold text-muted-foreground">Aucun accès détecté</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* PENDING / DEPLOYMENT */}
                            {guilds.pending.length > 0 && (
                                <div className="space-y-4 pt-4 border-t border-border">
                                    <div className="flex items-center justify-between px-2">
                                        <h3 className="text-caption font-semibold text-success uppercase tracking-wider flex items-center gap-2">
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
                                                className="group flex items-center gap-4 p-4 rounded-2xl bg-success/5 border border-success/10 hover:bg-success/10 transition-colors border-dashed"
                                            >
                                                <Avatar className="h-10 w-10 rounded-xl border border-border opacity-60">
                                                    <AvatarImage src={guild.icon || ""} alt={guild.name} />
                                                    <AvatarFallback className="bg-surface text-muted-foreground font-bold rounded-xl text-caption">
                                                        {guild.name.substring(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0 text-left">
                                                    <div className="text-xs font-semibold text-foreground truncate">
                                                        {guild.name}
                                                    </div>
                                                    <p className="text-caption font-medium text-muted-foreground/70 mt-0.5">Admin Discord Détecté</p>
                                                </div>
                                                <Link 
                                                    href={buildDiscordBotInviteUrl(clientId, {
                                                        guildId: guild.id,
                                                        redirectUri: `${window.location.origin}/onboarding/success`,
                                                    }) ?? "#"}
                                                    target="_blank"
                                                    className="w-8 h-8 rounded-lg bg-success/20 flex items-center justify-center text-success hover:bg-success hover:text-success-foreground transition-colors"
                                                >
                                                    <PlusCircle className="w-4 h-4" />
                                                </Link>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Quick Help / Info */}
                            <div className="p-5 rounded-3xl bg-success/5 border border-success/10 space-y-2 mt-10">
                                <div className="flex items-center gap-2 text-success">
                                    <Settings2 className="w-4 h-4" />
                                    <span className="text-caption font-semibold uppercase tracking-wider">Le saviez-vous ?</span>
                                </div>
                                <p className="text-caption text-muted-foreground leading-relaxed opacity-70">
                                    SigilOS est multi-guilde. Vous pouvez passer d'un empire à l'autre sans jamais vous déconnecter. Toutes vos récompenses sont centralisées sur votre profil global.
                                </p>
                            </div>
                        </>
                    )}
                </div>

                <div className="p-8 border-t border-border bg-black/40 backdrop-blur-md relative z-10 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="text-caption font-semibold text-muted-foreground uppercase tracking-wider mb-1">Session Active</div>
                        <Link 
                            href="/api/auth/signout"
                            className="text-label font-semibold text-foreground hover:text-danger transition-colors truncate group/logout flex items-center gap-2"
                        >
                            Explorateur Galactique
                            <span className="text-caption opacity-0 group-hover/logout:opacity-100 transition-opacity text-danger lowercase font-mono">(déconnexion)</span>
                        </Link>
                    </div>
                    <Button 
                        onClick={() => setOpen(false)}
                        variant="outline"
                        className="h-auto px-5 py-2.5 rounded-xl border-border bg-surface text-caption font-semibold uppercase tracking-wider hover:bg-surface hover:text-success transition-colors"
                    >
                        Fermer
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}

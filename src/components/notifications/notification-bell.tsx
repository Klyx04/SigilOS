"use client";

import { useEffect, useState, useRef } from "react";
import { Bell, Check, Info, X, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getUnreadNotifications, markAllAsRead, markAsRead, type Notification } from "@/server/actions/notification-actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * Icônes des catégories : vrais assets du jeu (aucun emoji, aucune illustration IA).
 * Partagé avec le centre de notifications (`dashboard/[guildId]/notifications`).
 */
export const CATEGORY_ICONS: Record<string, string> = {
    ALL: "/assets/dofus/game-icons/bell-on.png",
    MISSION: "/assets/icons/icone-quete.png",
    SUCCESS: "/assets/icons/succes.png",
    SONGES: "/assets/dofus-ui/pictos/songes.png",
    DONJONS: "/assets/dofus-ui/pictos/donjon.png",
    EVENT: "/assets/missions/event.png",
    POLL: "/assets/dofus/game-icons/question-mark.png",
    OCRE: "/assets/icons/ocre.png",
    MARKET: "/assets/dofus/game-icons/shop.png",
    ADMIN_ALERT: "/assets/dofus/game-icons/shield.png",
    SYSTEM: "/assets/dofus/game-icons/bell-on.png",
};

export function CategoryIcon({ category, size = 14 }: { category: string; size?: number }) {
    const src = CATEGORY_ICONS[category];
    if (!src) return null;
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" aria-hidden="true" width={size} height={size} loading="lazy" className="object-contain shrink-0" />
    );
}

export function NotificationBell({ userId, guildId, mode = "popover", className }: { userId: string, guildId: string, mode?: "popover" | "simple", className?: string }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [activeCategory, setActiveCategory] = useState<string>("ALL");
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const lastCheckedRef = useRef<Date>(new Date());

    const fetchNotifications = async (isPolling = false) => {
        const res = await getUnreadNotifications(guildId);
        if (res.success && res.data) {
            const fresh = res.data;
            setNotifications(fresh);

            if (isPolling) {
                const newNotifs = fresh.filter(n => new Date(n.createdAt) > lastCheckedRef.current);
                newNotifs.forEach(n => {
                    // Freshness check: Only toast if created within last 60 seconds
                    // Prevents spamming old unread notifications on remount/ref reset
                    const diff = new Date().getTime() - new Date(n.createdAt).getTime();
                    if (diff < 60000) {
                        const icon = n.type === 'MISSION_VALIDATED' ? <Check className="w-4 h-4 text-success" /> :
                            n.type === 'MISSION_REJECTED' ? <X className="w-4 h-4 text-danger" /> :
                                <Info className="w-4 h-4 text-info" />;

                        toast(n.title, {
                            description: n.message,
                            icon: icon,
                            duration: 5000,
                        });
                    }
                });

                if (newNotifs.length > 0) {
                    const maxDate = newNotifs.reduce((acc, curr) => {
                        const d = new Date(curr.createdAt);
                        return d > acc ? d : acc;
                    }, lastCheckedRef.current);
                    lastCheckedRef.current = maxDate;
                }
            } else {
                if (fresh.length > 0) {
                    const maxDate = fresh.reduce((acc, curr) => {
                        const d = new Date(curr.createdAt);
                        return d > acc ? d : acc;
                    }, new Date(0));
                    if (maxDate > lastCheckedRef.current) {
                        lastCheckedRef.current = maxDate;
                    }
                }
            }
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchNotifications(false);
        const interval = setInterval(() => fetchNotifications(true), 10000);
        return () => clearInterval(interval);
    }, []);

    const unreadCount = notifications.length;

    if (mode === "simple") {
        return (
            <div className={cn("relative flex items-center justify-center w-full h-full", className)}>
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex min-w-[1.125rem] h-4.5 px-1 items-center justify-center rounded-full bg-danger text-[10px] font-black text-danger-foreground ring-2 ring-background animate-in zoom-in duration-200">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
                <span className="sr-only">Notifications</span>
            </div>
        );
    }

    const handleMarkAllRead = async () => {
        await markAllAsRead(guildId);
        setNotifications([]);
        toast.success("Toutes les notifications marquées comme lues");
    };

    const handleNotificationClick = async (n: Notification) => {
        if (!n.read) {
            await markAsRead(n.id, guildId);
            setNotifications(prev => prev.filter(item => item.id !== n.id));
        }
        if (n.link) {
            router.push(n.link);
            setIsOpen(false);
        }
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className={cn("relative text-muted-foreground hover:text-foreground transition-colors", className)}>
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 z-10 flex min-w-[1rem] h-4 px-1 items-center justify-center rounded-full bg-danger text-[9px] font-black text-danger-foreground ring-2 ring-background animate-in zoom-in duration-200 shadow-sm">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                    )}
                    <span className="sr-only">Notifications</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[min(calc(100vw-2rem),24rem)] p-0 overflow-hidden rounded-[4px] border border-border bg-popover shadow-2xl"
                align="end"
                side="bottom"
                sideOffset={8}
                collisionPadding={16}
                avoidCollisions
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
                    <h4 className="font-bold text-xs uppercase tracking-widest text-foreground">Notifications</h4>
                    {unreadCount > 0 && (
                        <Button variant="ghost" size="sm" className="h-auto px-2 py-1 text-caption font-black uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors cursor-pointer" onClick={handleMarkAllRead}>
                            Tout lu
                            <Check className="ml-1 h-3 w-3" />
                        </Button>
                    )}
                </div>

                {/* Filtres : retour à la ligne (jamais coupés, jamais scrollés hors vue) */}
                <div className="flex flex-wrap items-center gap-1.5 p-2 border-b border-border bg-surface/50">
                    {[
                        { id: "ALL", label: "Toutes" },
                        { id: "MISSION", label: "Missions" },
                        { id: "SONGES", label: "Songes" },
                        { id: "DONJONS", label: "Donjons" },
                        { id: "EVENT", label: "Events" },
                        { id: "POLL", label: "Sondages" },
                        { id: "MARKET", label: "Marché" },
                        { id: "ADMIN_ALERT", label: "Admin" },
                    ].map((cat) => {
                        const count = cat.id === "ALL"
                            ? notifications.length
                            : notifications.filter(n => n.category === cat.id).length;

                        return (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className={cn(
                                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-caption font-bold transition-colors border",
                                    activeCategory === cat.id
                                        ? "bg-info/15 text-info border-info/30"
                                        : "bg-surface border-border text-muted-foreground hover:text-foreground hover:bg-elevated"
                                )}
                            >
                                <CategoryIcon category={cat.id} />
                                {cat.label}
                                <span className="text-caption opacity-60 tabular-nums">({count})</span>
                            </button>
                        );
                    })}
                </div>

                <ScrollArea className="h-[350px]">
                    {isLoading ? (
                        <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-4">
                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            Chargement...
                        </div>
                    ) : notifications.filter(n => activeCategory === "ALL" || n.category === activeCategory).length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground gap-3 px-6 text-center">
                            <div className="w-16 h-16 rounded-[4px] bg-elevated border border-border flex items-center justify-center overflow-hidden">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/assets/dofus/game-icons/bell-off.png" alt="" aria-hidden="true" width={40} height={40} loading="lazy" className="object-contain opacity-80" />
                            </div>
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                {activeCategory === "ALL" ? "Aucune notification" : "Aucune notification dans ce filtre"}
                            </p>
                            <p className="text-caption text-muted-foreground/70">
                                Les nouveautés (missions, songes, donjons, marché…) arrivent ici.
                            </p>
                        </div>
                    ) : (
                        <div className="grid divide-y divide-border">
                            {notifications
                                .filter(n => activeCategory === "ALL" || n.category === activeCategory)
                                .map((n) => (
                                <div
                                    key={n.id}
                                    className="p-3 hover:bg-elevated/50 cursor-pointer transition-colors flex items-start gap-3"
                                    onClick={() => handleNotificationClick(n)}
                                >
                                    <div className="w-9 h-9 rounded-[4px] bg-elevated border border-border flex items-center justify-center overflow-hidden shrink-0">
                                        <CategoryIcon category={n.category || "ALL"} size={22} />
                                    </div>
                                    <div className="space-y-1 overflow-hidden flex-1 min-w-0">
                                        <p className="text-sm font-bold text-foreground leading-tight truncate">{n.title}</p>
                                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{n.message}</p>
                                        <p className="text-caption text-muted-foreground font-mono pt-1">
                                            {new Date(n.createdAt).toLocaleDateString("fr-FR")} à {new Date(n.createdAt).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
                <div className="p-2 border-t border-border bg-surface">
                    <Button variant="ghost" size="sm" className="w-full text-caption font-bold uppercase tracking-wider h-9 hover:bg-elevated hover:text-foreground transition-colors" asChild>
                        <Link href={`/dashboard/${guildId}/notifications`}>
                            Voir toutes les notifications
                        </Link>
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}

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
            <PopoverContent className="w-84 p-0 overflow-hidden rounded-2xl border border-border bg-popover/98 backdrop-blur-xl shadow-2xl" align="end">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
                    <h4 className="font-bold text-xs uppercase tracking-widest text-foreground">Notifications</h4>
                    {unreadCount > 0 && (
                        <Button variant="ghost" size="sm" className="h-auto px-2 py-1 text-caption font-black uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors" onClick={handleMarkAllRead}>
                            Tout lu
                            <Check className="ml-1 h-3 w-3" />
                        </Button>
                    )}
                </div>

                {/* Filter Chips */}
                <div className="flex items-center gap-1.5 p-2 border-b border-border bg-surface/50 overflow-x-auto no-scrollbar">
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
                                    "px-2.5 py-1 rounded-lg text-caption font-bold whitespace-nowrap transition-colors border",
                                    activeCategory === cat.id
                                        ? "bg-info/15 text-info border-info/30"
                                        : "bg-surface border-border text-muted-foreground hover:text-foreground hover:bg-elevated"
                                )}
                            >
                                {cat.label}
                                <span className="ml-1 text-caption opacity-60">({count})</span>
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
                        <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground gap-4">
                            <div className="w-12 h-12 rounded-full bg-surface border border-border flex items-center justify-center">
                                <Bell className="h-6 w-6 opacity-30 text-muted-foreground" />
                            </div>
                            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                                {activeCategory === "ALL" ? "Aucune notification" : "Aucune notification dans ce filtre"}
                            </p>
                        </div>
                    ) : (
                        <div className="grid divide-y divide-border">
                            {notifications
                                .filter(n => activeCategory === "ALL" || n.category === activeCategory)
                                .map((n) => (
                                <div
                                    key={n.id}
                                    className="p-4 hover:bg-elevated/50 cursor-pointer transition-colors flex items-start gap-3"
                                    onClick={() => handleNotificationClick(n)}
                                >
                                    <div className={cn(
                                        "h-2 w-2 mt-1.5 rounded-full flex-shrink-0",
                                        n.type === 'MISSION_VALIDATED' ? "bg-success" :
                                            n.type === 'MISSION_REJECTED' ? "bg-danger" : "bg-info"
                                    )} />
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

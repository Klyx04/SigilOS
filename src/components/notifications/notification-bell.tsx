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
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const lastCheckedRef = useRef<Date>(new Date());

    const fetchNotifications = async (isPolling = false) => {
        const res = await getUnreadNotifications();
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
                        const icon = n.type === 'MISSION_VALIDATED' ? <Check className="w-4 h-4 text-green-500" /> :
                            n.type === 'MISSION_REJECTED' ? <X className="w-4 h-4 text-red-500" /> :
                                <Info className="w-4 h-4 text-blue-500" />;

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
                    <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white ring-2 ring-zinc-950 animate-in zoom-in duration-300">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
                <span className="sr-only">Notifications</span>
            </div>
        );
    }

    const handleMarkAllRead = async () => {
        await markAllAsRead();
        setNotifications([]);
        toast.success("Toutes les notifications marquées comme lues");
    };

    const handleNotificationClick = async (n: Notification) => {
        if (!n.read) {
            await markAsRead(n.id);
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
                <Button variant="ghost" size="icon" className={cn("relative text-zinc-400 hover:text-white transition-colors", className)}>
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white ring-2 ring-zinc-950 animate-in zoom-in duration-300">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                    )}
                    <span className="sr-only">Notifications</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 overflow-hidden rounded-2xl border-white/10 bg-[#0d0f11]/95 backdrop-blur-3xl shadow-[0_30px_60px_rgba(0,0,0,0.7)]" align="end">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/5">
                    <h4 className="font-bold text-xs uppercase tracking-widest text-white">Notifications</h4>
                    {unreadCount > 0 && (
                        <Button variant="ghost" size="sm" className="h-auto px-2 py-1 text-[10px] font-black uppercase tracking-tighter text-zinc-500 hover:text-primary transition-colors" onClick={handleMarkAllRead}>
                            Tout lu
                            <Check className="ml-1 h-3 w-3" />
                        </Button>
                    )}
                </div>
                <ScrollArea className="h-[350px]">
                    {isLoading ? (
                        <div className="p-12 text-center text-xs text-zinc-500 flex flex-col items-center gap-4">
                            <Loader2 className="w-5 h-5 animate-spin text-zinc-700" />
                            Chargement...
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[300px] text-zinc-500 gap-4">
                            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                                <Bell className="h-6 w-6 opacity-20" />
                            </div>
                            <p className="text-xs font-medium uppercase tracking-widest">Aucune notification</p>
                        </div>
                    ) : (
                        <div className="grid divide-y divide-white/5">
                            {notifications.map((n) => (
                                <div
                                    key={n.id}
                                    className="p-4 hover:bg-muted/50 cursor-pointer transition-colors flex items-start gap-3"
                                    onClick={() => handleNotificationClick(n)}
                                >
                                    <div className={cn(
                                        "h-2 w-2 mt-1.5 rounded-full flex-shrink-0",
                                        n.type === 'MISSION_VALIDATED' ? "bg-green-500" :
                                            n.type === 'MISSION_REJECTED' ? "bg-red-500" : "bg-blue-500"
                                    )} />
                                    <div className="space-y-1 overflow-hidden">
                                        <p className="text-sm font-bold text-zinc-100 leading-tight group-hover:text-white transition-colors">{n.title}</p>
                                        <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">{n.message}</p>
                                        <p className="text-[10px] text-zinc-600 font-mono pt-1">
                                            {new Date(n.createdAt).toLocaleDateString()} at {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
                <div className="p-2 border-t border-white/5 bg-white/5">
                    <Button variant="ghost" size="sm" className="w-full text-[10px] font-black uppercase tracking-widest h-10 hover:bg-white/5 hover:text-white transition-all" asChild>
                        <Link href={`/dashboard/${guildId}/notifications`}>
                            Voir toutes les notifications
                        </Link>
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}

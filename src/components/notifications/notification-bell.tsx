"use client";

import { useEffect, useState, useRef } from "react";
import { Bell, Check, Info, X } from "lucide-react";
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

export function NotificationBell({ userId }: { userId: string }) {
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
                    const icon = n.type === 'MISSION_VALIDATED' ? <Check className="w-4 h-4 text-green-500" /> :
                        n.type === 'MISSION_REJECTED' ? <X className="w-4 h-4 text-red-500" /> :
                            <Info className="w-4 h-4 text-blue-500" />;

                    toast(n.title, {
                        description: n.message,
                        icon: icon,
                        duration: 5000,
                    });
                });

                if (newNotifs.length > 0) {
                    const maxDate = newNotifs.reduce((acc, curr) => {
                        const d = new Date(curr.createdAt);
                        return d > acc ? d : acc;
                    }, lastCheckedRef.current);
                    lastCheckedRef.current = maxDate;
                }
            } else {
                // Initial Load: set ref to latest date found
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

    // Poll every 10 seconds for responsiveness
    useEffect(() => {
        fetchNotifications(false);
        const interval = setInterval(() => fetchNotifications(true), 10000);
        return () => clearInterval(interval);
    }, []);

    const unreadCount = notifications.length;

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
                <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-background animate-pulse" />
                    )}
                    <span className="sr-only">Notifications</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
                    <h4 className="font-semibold text-sm">Notifications</h4>
                    {unreadCount > 0 && (
                        <Button variant="ghost" size="sm" className="h-auto px-2 text-xs text-muted-foreground hover:text-primary" onClick={handleMarkAllRead}>
                            Tout lu
                            <Check className="ml-1 h-3 w-3" />
                        </Button>
                    )}
                </div>
                <ScrollArea className="h-[300px]">
                    {isLoading ? (
                        <div className="p-4 text-center text-xs text-muted-foreground">Chargement...</div>
                    ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground gap-2">
                            <Bell className="h-8 w-8 opacity-20" />
                            <p className="text-xs">Aucune nouvelle notification</p>
                        </div>
                    ) : (
                        <div className="grid divide-y divide-border/50">
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
                                        <p className="text-sm font-medium leading-none truncate pr-4">{n.title}</p>
                                        <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                                        <p className="text-[10px] text-muted-foreground/60 pt-1">
                                            {new Date(n.createdAt).toLocaleDateString()} {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}

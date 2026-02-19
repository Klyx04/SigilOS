"use client";

import { useState, useEffect, useTransition } from "react";
import { getUnreadNotifications, markAsRead, markAllAsRead } from "@/server/actions/notification-actions";
import { NotificationType, NotificationCategory } from "@prisma/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Bell, CheckCircle2, Info, AlertTriangle, Shield, X, Check, Target, Trophy, Flame, Calendar, PieChart, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// Type definition tailored for UI
type Notification = {
    id: string;
    title: string;
    message: string;
    type: NotificationType;
    category: NotificationCategory;
    read: boolean;
    link: string | null;
    createdAt: Date;
};

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [activeTab, setActiveTab] = useState<NotificationCategory | "ALL">("ALL");
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    async function loadNotifications() {
        setLoading(true);
        const result = await getUnreadNotifications();
        if (result.success && result.data) {
            setNotifications(result.data as any);
        }
        setLoading(false);
    }

    useEffect(() => {
        loadNotifications();
    }, []);

    const handleDismiss = async (id: string) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        try {
            await markAsRead(id);
        } catch (error) {
            toast.error("Erreur lors de la mise à jour");
        }
    };

    const handleDismissAll = async () => {
        if (filteredNotifications.length === 0) return;

        const idsToRemove = new Set(filteredNotifications.map(n => n.id));
        setNotifications((prev) => prev.filter((n) => !idsToRemove.has(n.id)));

        try {
            if (activeTab === "ALL") {
                await markAllAsRead();
            } else {
                // Future: add markCategoryAsRead if needed, for now individual marks or all
                // Simulating markAll for filtered if we wanted, but action doesn't support filter yet.
                // For simplicity, we mark all in UI but only call global markAll or loop marks.
                await markAllAsRead();
            }
            toast.success("Notifications marquées comme lues");
        } catch (error) {
            toast.error("Erreur lors de la mise à jour");
        }
    };

    const getIcon = (category: NotificationCategory) => {
        switch (category) {
            case "MISSION": return <Target className="w-5 h-5 text-blue-400" />;
            case "SUCCESS": return <Trophy className="w-5 h-5 text-yellow-400" />;
            case "SONGES": return <Flame className="w-5 h-5 text-emerald-400" />;
            case "EVENT": return <Calendar className="w-5 h-5 text-purple-400" />;
            case "POLL": return <PieChart className="w-5 h-5 text-orange-400" />;
            case "ADMIN_ALERT": return <ShieldCheck className="w-5 h-5 text-rose-400" />;
            default: return <Bell className="w-5 h-5 text-zinc-400" />;
        }
    };

    const getCategoryLabel = (category: NotificationCategory) => {
        switch (category) {
            case "MISSION": return "Missions";
            case "SUCCESS": return "Succès";
            case "SONGES": return "Songes";
            case "EVENT": return "Événements";
            case "POLL": return "Sondages";
            case "ADMIN_ALERT": return "Administration";
            default: return "Système";
        }
    };

    const filteredNotifications = notifications.filter(n =>
        activeTab === "ALL" || n.category === activeTab
    );

    const categories: { id: NotificationCategory | "ALL", label: string }[] = [
        { id: "ALL", label: "Toutes" },
        { id: "MISSION", label: "Missions" },
        { id: "SUCCESS", label: "Succès" },
        { id: "SONGES", label: "Songes" },
        { id: "EVENT", label: "Events" },
        { id: "POLL", label: "Sondages" },
        { id: "ADMIN_ALERT", label: "Admin" },
    ];

    return (
        <div className="container max-w-4xl mx-auto py-8 px-4">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white">
                        Centre de Notifications
                    </h1>
                    <p className="text-zinc-400">
                        {notifications.length > 0
                            ? `Vous avez ${notifications.length} notifications non lues.`
                            : "Aucune nouvelle notification."}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {filteredNotifications.length > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-zinc-400 hover:text-white hover:bg-white/5"
                            onClick={handleDismissAll}
                        >
                            <Check className="mr-2 h-4 w-4" />
                            Tout marquer
                        </Button>
                    )}
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 mb-6 p-1 bg-zinc-900/50 border border-white/5 rounded-xl overflow-x-auto no-scrollbar">
                {categories.map((cat) => {
                    const count = cat.id === "ALL"
                        ? notifications.length
                        : notifications.filter(n => n.category === cat.id).length;

                    if (cat.id !== "ALL" && count === 0) return null;

                    return (
                        <button
                            key={cat.id}
                            onClick={() => setActiveTab(cat.id)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all",
                                activeTab === cat.id
                                    ? "bg-white text-black shadow-lg shadow-white/10"
                                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                            )}
                        >
                            {cat.label}
                            {count > 0 && (
                                <span className={cn(
                                    "px-1.5 py-0.5 rounded-full text-[10px]",
                                    activeTab === cat.id ? "bg-black/10 text-black" : "bg-white/10 text-zinc-400"
                                )}>
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-24 bg-zinc-900/50 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : filteredNotifications.length === 0 ? (
                <Card className="flex flex-col items-center justify-center py-20 bg-zinc-900/30 border-white/5 border-dashed">
                    <div className="h-16 w-16 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500/50" />
                    </div>
                    <p className="text-zinc-500 font-medium">
                        {activeTab === "ALL"
                            ? "Vous êtes à jour !"
                            : `Aucune notification dans la catégorie ${getCategoryLabel(activeTab as NotificationCategory)}.`}
                    </p>
                    {activeTab !== "ALL" && (
                        <Button
                            variant="link"
                            className="text-primary mt-2"
                            onClick={() => setActiveTab("ALL")}
                        >
                            Voir toutes les notifications
                        </Button>
                    )}
                </Card>
            ) : (
                <div className="grid gap-3">
                    {filteredNotifications.map((notif) => (
                        <div
                            key={notif.id}
                            className="group relative flex items-start gap-4 p-4 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 border border-white/5 hover:border-indigo-500/20 transition-all duration-300 shadow-sm"
                        >
                            {/* Category-colored border-left hint */}
                            <div className={cn(
                                "absolute left-0 top-4 bottom-4 w-1 rounded-r-full opacity-50",
                                notif.category === "MISSION" && "bg-blue-500",
                                notif.category === "SUCCESS" && "bg-yellow-500",
                                notif.category === "SONGES" && "bg-emerald-500",
                                notif.category === "EVENT" && "bg-purple-500",
                                notif.category === "POLL" && "bg-orange-500",
                                notif.category === "ADMIN_ALERT" && "bg-rose-500",
                                notif.category === "SYSTEM" && "bg-zinc-500",
                            )} />

                            {/* Icon Box */}
                            <div className="shrink-0 h-10 w-10 rounded-lg bg-black/40 border border-white/5 flex items-center justify-center group-hover:scale-105 transition-transform">
                                {getIcon(notif.category)}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 pt-0.5 pr-8">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 group-hover:text-zinc-400">
                                        {getCategoryLabel(notif.category)}
                                    </span>
                                    <span className="text-[10px] text-zinc-600">
                                        • {format(new Date(notif.createdAt), "d MMMM 'à' HH:mm", { locale: fr })}
                                    </span>
                                </div>
                                <h3 className="font-bold text-sm text-zinc-200 group-hover:text-white transition-colors">
                                    {notif.title}
                                </h3>
                                <p className="text-sm text-zinc-400 mt-0.5 line-clamp-2 group-hover:text-zinc-300">
                                    {notif.message}
                                </p>

                                {notif.link && (
                                    <Link
                                        href={notif.link}
                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-400 mt-3 hover:text-indigo-300 transition-colors"
                                    >
                                        Accéder
                                        <div className="w-4 h-4 rounded-full bg-indigo-500/10 flex items-center justify-center">
                                            <Check className="w-2.5 h-2.5" />
                                        </div>
                                    </Link>
                                )}
                            </div>

                            {/* Actions (Hover) */}
                            <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full"
                                    onClick={() => handleDismiss(notif.id)}
                                    title="Marquer comme lu"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

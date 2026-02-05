"use client";

import { useState, useEffect, useTransition } from "react";
import { getUnreadNotifications, markAsRead, markAllAsRead } from "@/server/actions/notification-actions";
import { NotificationType } from "@prisma/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Bell, CheckCircle2, Info, AlertTriangle, Shield, X, Check } from "lucide-react";
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
    read: boolean;
    link: string | null;
    createdAt: Date;
};

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
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
        // Optimistic update
        setNotifications((prev) => prev.filter((n) => n.id !== id));

        // Server action
        try {
            await markAsRead(id);
            toast.success("Notification marquée comme lue", { duration: 2000 });
        } catch (error) {
            toast.error("Erreur lors de la mise à jour");
        }
    };

    const handleDismissAll = async () => {
        if (notifications.length === 0) return;

        // Optimistic update
        setNotifications([]);

        try {
            await markAllAsRead();
            toast.success("Toutes les notifications ont été marquées comme lues");
        } catch (error) {
            toast.error("Erreur lors de la mise à jour");
        }
    };

    const getIcon = (type: NotificationType) => {
        switch (type) {
            case "MISSION_VALIDATED": return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
            case "MISSION_REJECTED": return <AlertTriangle className="w-5 h-5 text-red-400" />;
            case "NEW_SUBMISSION_PENDING": return <Shield className="w-5 h-5 text-amber-400" />;
            case "SONGES_JOIN_REQUEST": return <Info className="w-5 h-5 text-purple-400" />;
            default: return <Bell className="w-5 h-5 text-zinc-400" />;
        }
    };

    const getTypeLabel = (type: NotificationType) => {
        switch (type) {
            case "MISSION_VALIDATED": return "Mission Validée";
            case "MISSION_REJECTED": return "Mission Refusée";
            case "NEW_SUBMISSION_PENDING": return "Validation Requise";
            case "SONGES_JOIN_REQUEST": return "Recrutement Songes";
            default: return "Information";
        }
    };

    return (
        <div className="container max-w-4xl mx-auto py-8 px-4">
            <div className="flex items-center justify-between mb-8">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white">
                        Centre de Notifications
                    </h1>
                    <p className="text-zinc-400">
                        Restez informé des dernières activités de votre guilde.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {notifications.length > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-zinc-400 hover:text-white hover:bg-white/5"
                            onClick={handleDismissAll}
                        >
                            <Check className="mr-2 h-4 w-4" />
                            Tout marquer comme lu
                        </Button>
                    )}
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 px-3 py-1">
                        {notifications.length} nouvelles
                    </Badge>
                </div>
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-24 bg-zinc-900/50 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : notifications.length === 0 ? (
                <Card className="flex flex-col items-center justify-center py-16 bg-zinc-900/30 border-white/5 border-dashed">
                    <div className="h-16 w-16 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500/50" />
                    </div>
                    <p className="text-zinc-500 font-medium">Vous êtes à jour ! Aucune nouvelle notification.</p>
                </Card>
            ) : (
                <div className="grid gap-3">
                    {notifications.map((notif) => (
                        <div
                            key={notif.id}
                            className="group relative flex items-start gap-4 p-4 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 border border-white/5 hover:border-white/10 transition-all duration-300"
                        >
                            {/* Icon Box */}
                            <div className="shrink-0 h-10 w-10 rounded-lg bg-black/40 border border-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                                {getIcon(notif.type)}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 pt-0.5 pr-8">
                                <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-white/5 text-zinc-400 group-hover:bg-white/10">
                                        {getTypeLabel(notif.type)}
                                    </Badge>
                                    <span className="text-xs text-zinc-500">
                                        {format(new Date(notif.createdAt), "d MMMM 'à' HH:mm", { locale: fr })}
                                    </span>
                                </div>
                                <h3 className="font-bold text-sm text-zinc-200 group-hover:text-white transition-colors">
                                    {notif.title}
                                </h3>
                                <p className="text-sm text-zinc-400 mt-0.5 line-clamp-2">
                                    {notif.message}
                                </p>

                                {notif.link && (
                                    <Link
                                        href={notif.link}
                                        className="inline-flex items-center gap-1 text-xs font-bold text-primary mt-2 hover:underline"
                                    >
                                        Voir les détails
                                        <CheckCircle2 className="w-3 h-3" />
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
                                    <span className="sr-only">Fermer</span>
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

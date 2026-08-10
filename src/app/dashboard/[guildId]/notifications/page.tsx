"use client";

import { useState, useEffect, useTransition } from "react";
import { getUnreadNotifications, getAllNotifications, markAsRead, markAllAsRead } from "@/server/actions/notification-actions";
import { replyToServiceRequestAction } from "@/server/actions/service-actions";
import { NotificationType, NotificationCategory } from "@prisma/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Bell, CheckCircle2, Info, AlertTriangle, Shield, X, Check, Target, Trophy, Flame, Calendar, PieChart, ShieldCheck, Swords, Gem, MessageSquare, Loader2, Eye, EyeOff, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter, useParams } from "next/navigation";

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
    const [statusFilter, setStatusFilter] = useState<"ALL" | "UNREAD" | "READ">("UNREAD");
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const params = useParams();
    const guildId = params?.guildId as string;

    const [replyNotif, setReplyNotif] = useState<Notification | null>(null);
    const [replyText, setReplyText] = useState("");
    const [replyPending, setReplyPending] = useState(false);

    const handleSendReply = async () => {
        if (!replyNotif || !replyText.trim()) return;
        setReplyPending(true);
        try {
            const url = new URL(replyNotif.link || "", window.location.origin);
            const replyTo = url.searchParams.get("replyTo") || "";
            const listingId = url.searchParams.get("listingId") || "";

            if (!replyTo || !listingId) {
                toast.error("Données de notification invalides.");
                setReplyPending(false);
                return;
            }

            const res = await replyToServiceRequestAction(
                guildId,
                replyTo,
                listingId,
                replyText.trim(),
                ""
            );

            if (res.success) {
                toast.success("Votre réponse a été envoyée !");
                setReplyNotif(null);
                setReplyText("");
                handleDismiss(replyNotif.id);
            } else {
                toast.error(res.error || "Impossible d'envoyer la réponse.");
            }
        } catch (error) {
            toast.error("Erreur serveur.");
        } finally {
            setReplyPending(false);
        }
    };

    async function loadNotifications() {
        setLoading(true);
        // Load all notifications (read and unread)
        const result = await getAllNotifications(guildId);
        if (result.success && result.data) {
            setNotifications(result.data as any);
        }
        setLoading(false);
    }

    useEffect(() => {
        loadNotifications();
    }, []);

    const handleDismiss = async (id: string) => {
        setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
        try {
            await markAsRead(id, guildId);
        } catch (error) {
            toast.error("Erreur lors de la mise à jour");
        }
    };

    const handleDismissAll = async () => {
        if (filteredNotifications.length === 0) return;

        const idsToRemove = new Set(filteredNotifications.map(n => n.id));
        setNotifications((prev) => prev.map((n) => idsToRemove.has(n.id) ? { ...n, read: true } : n));

        try {
            await markAllAsRead(guildId);
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
            case "DONJONS": return <Swords className="w-5 h-5 text-indigo-400" />;
            case "OCRE": return <Gem className="w-5 h-5 text-emerald-500" />;
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
            case "DONJONS": return "Donjons";
            case "OCRE": return "Ocre";
            default: return "Système";
        }
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    // First filter by Status (UNREAD / READ / ALL)
    const statusFiltered = notifications.filter(n => {
        if (statusFilter === "UNREAD") return !n.read;
        if (statusFilter === "READ") return n.read;
        return true;
    });

    // Then filter by Category
    const filteredNotifications = statusFiltered.filter(n =>
        activeTab === "ALL" || n.category === activeTab
    );

    const categories: { id: NotificationCategory | "ALL", label: string }[] = [
        { id: "ALL", label: "Toutes les catégories" },
        { id: "MISSION", label: "Missions" },
        { id: "SUCCESS", label: "Succès" },
        { id: "SONGES", label: "Songes" },
        { id: "DONJONS", label: "Donjons" },
        { id: "EVENT", label: "Events" },
        { id: "POLL", label: "Sondages" },
        { id: "OCRE", label: "Ocre" },
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
                        {unreadCount > 0
                            ? `Vous avez ${unreadCount} notification${unreadCount > 1 ? "s" : ""} non lue${unreadCount > 1 ? "s" : ""}.`
                            : "Aucune nouvelle notification non lue."}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-zinc-400 hover:text-white hover:bg-white/5"
                            onClick={handleDismissAll}
                        >
                            <Check className="mr-2 h-4 w-4 text-emerald-500" />
                            Tout marquer comme lu
                        </Button>
                    )}
                </div>
            </div>

            {/* Status Filter (Unread / Read / All) */}
            <div className="flex items-center gap-2 mb-4 p-1.5 bg-zinc-950 border border-white/10 rounded-2xl">
                {[
                    { id: "UNREAD", label: "Non lues", count: unreadCount, icon: Bell },
                    { id: "READ", label: "Historique (Lues)", count: notifications.filter(n => n.read).length, icon: CheckCircle2 },
                    { id: "ALL", label: "Toutes", count: notifications.length, icon: Filter },
                ].map((st) => (
                    <button
                        key={st.id}
                        onClick={() => setStatusFilter(st.id as any)}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                            statusFilter === st.id
                                ? "bg-white/10 text-white border border-white/20 shadow-lg shadow-white/5"
                                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                        )}
                    >
                        <st.icon className={cn("w-3.5 h-3.5", statusFilter === st.id ? "text-cyan-400" : "text-zinc-600")} />
                        {st.label}
                        <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold",
                            statusFilter === st.id ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30" : "bg-white/5 text-zinc-600"
                        )}>
                            {st.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Category Filter Tabs (ALWAYS VISIBLE) */}
            <div className="flex items-center gap-1.5 mb-6 p-1.5 bg-zinc-900/50 border border-white/5 rounded-2xl overflow-x-auto no-scrollbar">
                {categories.map((cat) => {
                    const count = cat.id === "ALL"
                        ? statusFiltered.length
                        : statusFiltered.filter(n => n.category === cat.id).length;

                    return (
                        <button
                            key={cat.id}
                            onClick={() => setActiveTab(cat.id)}
                            className={cn(
                                "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border",
                                activeTab === cat.id
                                    ? "bg-cyan-600 text-white border-cyan-400/50 shadow-md shadow-cyan-900/30 font-black"
                                    : "bg-white/[0.02] border-white/5 text-zinc-400 hover:text-white hover:bg-white/5"
                            )}
                        >
                            {cat.label}
                            <span className={cn(
                                "px-1.5 py-0.5 rounded-md text-[10px] font-black",
                                activeTab === cat.id ? "bg-black/30 text-cyan-200" : "bg-white/10 text-zinc-500"
                            )}>
                                {count}
                            </span>
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
                                notif.category === "DONJONS" && "bg-indigo-500",
                                notif.category === "OCRE" && "bg-emerald-600",
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

                                {notif.link && (() => {
                                    const isServiceReply = notif.link.includes("replyTo=") && notif.link.includes("listingId=");
                                    return (
                                        <div className="flex items-center gap-3 mt-3">
                                            <Link
                                                href={notif.link}
                                                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                                            >
                                                Accéder
                                                <div className="w-4 h-4 rounded-full bg-indigo-500/10 flex items-center justify-center">
                                                    <Check className="w-2.5 h-2.5" />
                                                </div>
                                            </Link>
                                            {isServiceReply && (
                                                <Button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setReplyNotif(notif);
                                                    }}
                                                    className="h-7 px-3 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black uppercase tracking-widest rounded-lg flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.15)] hover:shadow-[0_0_20px_rgba(6,182,212,0.25)] transition-all"
                                                >
                                                    <MessageSquare className="w-3.5 h-3.5" />
                                                    Répondre
                                                </Button>
                                            )}
                                        </div>
                                    );
                                })()}
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

            <Dialog open={!!replyNotif} onOpenChange={(open) => !open && setReplyNotif(null)}>
                <DialogContent className="max-w-md bg-zinc-950 border border-white/10 shadow-2xl rounded-3xl text-white p-6 backdrop-blur-xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0">
                                <MessageSquare className="w-4 h-4 text-cyan-400" />
                            </div>
                            Répondre à la demande
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {replyNotif && (
                            <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-xs text-zinc-400 italic">
                                "{replyNotif.message}"
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label className="text-zinc-400 text-xs font-black uppercase tracking-widest">Votre réponse</Label>
                            <Textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Saisissez votre message pour le client..."
                                className="bg-black/30 border-white/10 text-white rounded-xl placeholder:text-zinc-600 focus:border-cyan-500/50 resize-none h-28 text-xs leading-relaxed"
                                maxLength={500}
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button
                            variant="ghost"
                            onClick={() => setReplyNotif(null)}
                            className="flex-1 border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 font-bold h-10 transition-all rounded-xl"
                        >
                            Annuler
                        </Button>
                        <Button
                            onClick={handleSendReply}
                            disabled={replyPending || !replyText.trim()}
                            className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-black h-10 shadow-lg shadow-cyan-900/20 rounded-xl transition-all"
                        >
                            {replyPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Envoyer"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

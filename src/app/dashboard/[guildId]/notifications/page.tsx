"use client";

import { useState, useEffect, useTransition } from "react";
import { getAllNotifications, markAllAsRead, deleteNotification } from "@/server/actions/notification-actions";
import { replyToServiceRequestAction } from "@/server/actions/service-actions";
import { NotificationType, NotificationCategory } from "@prisma/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Bell, CheckCircle2, Info, AlertTriangle, Shield, X, Check, MessageSquare, Loader2, Eye, EyeOff, Filter } from "lucide-react";
import { CategoryIcon } from "@/components/notifications/notification-bell";
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

    /** ✕ d'une carte : suppression définitive (retire la ligne dans toutes les vues). */
    const handleDismiss = async (id: string) => {
        const previous = notifications;
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        try {
            const res = await deleteNotification(id, guildId);
            if (!res.success) {
                setNotifications(previous);
                toast.error(res.error || "Suppression impossible");
            }
        } catch (error) {
            setNotifications(previous);
            toast.error("Erreur lors de la suppression");
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

    /** Icône de catégorie : vrai asset du jeu (même map que la fenêtre). */
    const getIcon = (category: NotificationCategory) => (
        <CategoryIcon category={String(category)} size={22} />
    );

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
            case "MARKET": return "Marché";
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
        { id: "ALL", label: "Toutes" },
        { id: "MISSION", label: "Missions" },
        { id: "SUCCESS", label: "Succès" },
        { id: "SONGES", label: "Songes" },
        { id: "DONJONS", label: "Donjons" },
        { id: "EVENT", label: "Events" },
        { id: "POLL", label: "Sondages" },
        { id: "OCRE", label: "Ocre" },
        { id: "MARKET", label: "Marché" },
        { id: "ADMIN_ALERT", label: "Admin" },
    ];

    return (
        <div className="container max-w-4xl mx-auto py-8 px-4">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-black italic uppercase tracking-tighter text-foreground">
                        Centre de Notifications
                    </h1>
                    <p className="text-muted-foreground">
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
                            className="text-muted-foreground hover:text-foreground hover:bg-surface"
                            onClick={handleDismissAll}
                        >
                            <Check className="mr-2 h-4 w-4 text-success" />
                            Tout marquer comme lu
                        </Button>
                    )}
                </div>
            </div>

            {/* Status Filter (Unread / Read / All) */}
            <div className="flex flex-wrap items-center gap-2 mb-4 p-1.5 bg-surface/50 border border-border rounded-2xl">
                {[
                    { id: "UNREAD", label: "Non lues", count: unreadCount, icon: Bell },
                    { id: "READ", label: "Historique (Lues)", count: notifications.filter(n => n.read).length, icon: CheckCircle2 },
                    { id: "ALL", label: "Toutes", count: notifications.length, icon: Filter },
                ].map((st) => (
                    <button
                        key={st.id}
                        onClick={() => setStatusFilter(st.id as any)}
                        className={cn(
                            "flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2 px-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors",
                            statusFilter === st.id
                                ? "bg-surface text-foreground border border-border shadow-xs"
                                : "text-muted-foreground hover:text-foreground hover:bg-surface/60"
                        )}
                    >
                        <st.icon className={cn("w-3.5 h-3.5 shrink-0", statusFilter === st.id ? "text-info" : "text-muted-foreground")} />
                        <span className="whitespace-nowrap">{st.label}</span>
                        <span className={cn(
                            "min-w-[24px] text-center px-1.5 py-0.5 rounded-full text-caption font-bold tabular-nums",
                            statusFilter === st.id ? "bg-info/15 text-info border border-info/25" : "bg-muted/40 text-muted-foreground"
                        )}>
                            {st.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Filtres catégories : retour à la ligne partout (jamais coupés sur mobile) */}
            <div className="flex flex-wrap items-center gap-1.5 mb-6 p-2 bg-surface/30 border border-border rounded-[4px]">
                {categories.map((cat) => {
                    const count = cat.id === "ALL"
                        ? statusFiltered.length
                        : statusFiltered.filter(n => n.category === cat.id).length;

                    return (
                        <button
                            key={cat.id}
                            onClick={() => setActiveTab(cat.id)}
                            className={cn(
                                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-xs font-bold transition-colors border cursor-pointer",
                                activeTab === cat.id
                                    ? "bg-info/15 text-info border-info/30"
                                    : "bg-surface border-border text-muted-foreground hover:text-foreground hover:bg-elevated"
                            )}
                        >
                            <CategoryIcon category={cat.id} size={14} />
                            <span className="whitespace-nowrap">{cat.label}</span>
                            <span className={cn(
                                "min-w-[20px] text-center px-1.5 py-0.5 rounded-[4px] text-caption font-black tabular-nums",
                                activeTab === cat.id ? "bg-info/20 text-info" : "bg-muted/30 text-muted-foreground"
                            )}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>


            <div className="min-h-[55vh]">
            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-24 bg-surface/50 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : filteredNotifications.length === 0 ? (
                <Card className="flex flex-col items-center justify-center py-20 bg-surface/30 border-border border-dashed">
                    <div className="h-16 w-16 rounded-[4px] bg-elevated/50 flex items-center justify-center mb-4 border border-border overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/assets/dofus/game-icons/bell-off.png" alt="" aria-hidden="true" width={40} height={40} loading="lazy" className="object-contain opacity-80" />
                    </div>
                    <p className="text-muted-foreground font-medium">
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
                            className="group relative flex items-start gap-4 p-4 rounded-[4px] bg-surface border border-border hover:border-border-strong hover:bg-elevated/30 transition-colors shadow-xs"
                        >
                            {/* Category-colored border-left hint */}
                            <div className={cn(
                                "absolute left-0 top-3 bottom-3 w-1 rounded-r-full opacity-60",
                                notif.category === "MISSION" && "bg-info",
                                notif.category === "SUCCESS" && "bg-warning",
                                notif.category === "SONGES" && "bg-success",
                                notif.category === "EVENT" && "bg-info",
                                notif.category === "POLL" && "bg-warning",
                                notif.category === "ADMIN_ALERT" && "bg-danger",
                                notif.category === "DONJONS" && "bg-info",
                                notif.category === "OCRE" && "bg-success",
                                notif.category === "MARKET" && "bg-primary",
                                notif.category === "SYSTEM" && "bg-muted",
                            )} />

                            {/* Icon Box : asset du jeu */}
                            <div className="shrink-0 h-10 w-10 rounded-[4px] bg-elevated border border-border flex items-center justify-center overflow-hidden">
                                {getIcon(notif.category)}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 pt-0.5 pr-8">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-caption font-black uppercase tracking-wider text-muted-foreground group-hover:text-muted-foreground">
                                        {getCategoryLabel(notif.category)}
                                    </span>
                                    <span className="text-caption text-muted-foreground">
                                        • {format(new Date(notif.createdAt), "d MMMM 'à' HH:mm", { locale: fr })}
                                    </span>
                                </div>
                                <h3 className="font-bold text-sm text-foreground group-hover:text-foreground transition-colors">
                                    {notif.title}
                                </h3>
                                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2 group-hover:text-foreground">
                                    {notif.message}
                                </p>

                                {notif.link && (() => {
                                    const isServiceReply = notif.link.includes("replyTo=") && notif.link.includes("listingId=");
                                    return (
                                        <div className="flex items-center gap-3 mt-3">
                                            <Link
                                                href={notif.link}
                                                className="inline-flex items-center gap-1.5 text-xs font-bold text-info hover:text-info transition-colors"
                                            >
                                                Accéder
                                                <div className="w-4 h-4 rounded-full bg-info/10 flex items-center justify-center">
                                                    <Check className="w-2.5 h-2.5" />
                                                </div>
                                            </Link>
                                            {isServiceReply && (
                                                <Button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setReplyNotif(notif);
                                                    }}
                                                    className="h-7 px-3 bg-info hover:bg-info text-info-foreground text-xs font-black uppercase tracking-widest rounded-lg flex items-center gap-1.5   transition-all"
                                                >
                                                    <MessageSquare className="w-3.5 h-3.5" />
                                                    Répondre
                                                </Button>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Supprimer : toujours visible au tactile, au survol sur desktop */}
                            <div className="absolute right-2 top-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-danger hover:bg-danger/10 rounded-[4px]"
                                    onClick={() => handleDismiss(notif.id)}
                                    title="Supprimer cette notification"
                                    aria-label="Supprimer cette notification"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            </div>

            <Dialog open={!!replyNotif} onOpenChange={(open) => !open && setReplyNotif(null)}>
                <DialogContent className="max-w-md bg-background border border-border shadow-2xl rounded-3xl text-foreground p-6 backdrop-blur-xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-info/20 border border-info/30 flex items-center justify-center shrink-0">
                                <MessageSquare className="w-4 h-4 text-info" />
                            </div>
                            Répondre à la demande
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {replyNotif && (
                            <div className="p-3 bg-surface border border-border rounded-xl text-xs text-muted-foreground italic">
                                "{replyNotif.message}"
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs font-black uppercase tracking-widest">Votre réponse</Label>
                            <Textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Saisissez votre message pour le client..."
                                className="bg-muted/30 border-border text-foreground rounded-xl placeholder:text-muted-foreground focus:border-info/50 resize-none h-28 text-xs leading-relaxed"
                                maxLength={500}
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button
                            variant="ghost"
                            onClick={() => setReplyNotif(null)}
                            className="flex-1 border border-border bg-surface text-foreground hover:text-foreground hover:bg-surface font-bold h-10 transition-all rounded-xl"
                        >
                            Annuler
                        </Button>
                        <Button
                            onClick={handleSendReply}
                            disabled={replyPending || !replyText.trim()}
                            className="flex-1 bg-info hover:bg-info text-info-foreground font-black h-10 shadow-lg shadow-cyan-900/20 rounded-xl transition-all"
                        >
                            {replyPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Envoyer"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

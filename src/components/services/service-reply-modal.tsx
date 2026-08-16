"use client";

import { useState, useEffect, useTransition, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { getUnreadNotifications, markAsRead } from "@/server/actions/notification-actions";
import { sendServiceReplyAction } from "@/server/actions/service-actions";
import { NotificationType, NotificationCategory } from "@prisma/client";

/**
 * Type local aligné sur la sortie de getUnreadNotifications
 */
type ServiceNotification = {
    id: string;
    title: string;
    message: string;
    type: NotificationType;
    category: NotificationCategory;
    read: boolean;
    link: string | null;
    createdAt: Date;
};

/**
 * Modale GLOBALE de dialogue service (one-shot).
 *
 * - Poll le flux de notifications non lues (même rythme que la cloche : ~10s).
 * - Dès qu'une notification SERVICE_REQUEST ou SERVICE_REPLY arrive, elle affiche
 *   une modale "mini dialogue" permettant de répondre directement.
 * - MARQUAGE LU IMMÉDIAT À L'AFFICHAGE : la modale ne réapparaît pas au refresh
 *   / changement de page (auto-suppression visuelle).
 * - Réponses limitées (anti-surcharge) côté serveur via Redis.
 *
 * Affichée dans le layout Dashboard → visible sur TOUTE page / refresh / navigation.
 *
 * Flux à sens unique (client → passeur → client) :
 * - SERVICE_REQUEST  : reçue par le PASSEUR → il peut répondre (textarea + bouton Répondre).
 * - SERVICE_REPLY    : reçue par le CLIENT → consultation seule (pas de réponse possible,
 *   le guard serveur refuserait — le client n'a pas à répondre à nouveau).
 */
export function ServiceReplyModal({ guildId }: { guildId: string }) {
    const [notifs, setNotifs] = useState<ServiceNotification[]>([]);
    const [current, setCurrent] = useState<ServiceNotification | null>(null);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [replyText, setReplyText] = useState("");
    const [isPending, startTransition] = useTransition();
    const [isMounted, setIsMounted] = useState(false);
    const processedRef = useRef<Set<string>>(new Set());
    const shownRef = useRef<Set<string>>(new Set());

    // Ne poll que côté client (évite SSR mismatch)
    useEffect(() => {
        setIsMounted(true);
    }, []);

    const parseLink = useCallback((link: string | null) => {
        if (!link) return null;
        try {
            const url = new URL(link, window.location.origin);
            const replyTo = url.searchParams.get("replyTo") || "";
            const listingId = url.searchParams.get("listingId") || "";
            if (!replyTo || !listingId) return null;
            return { replyTo, listingId };
        } catch {
            return null;
        }
    }, []);

    const fetchAndQueue = useCallback(async () => {
        const res = await getUnreadNotifications(guildId);
        if (!res.success || !res.data) return;

        const serviceNotifs = (res.data as ServiceNotification[])
            .filter(n =>
                (n.type === "SERVICE_REQUEST" || n.type === "SERVICE_REPLY") &&
                parseLink(n.link) !== null
            )
            .filter(n => !processedRef.current.has(n.id));

        if (serviceNotifs.length === 0) return;

        // Marque les nouvelles comme lues IMMÉDIATEMENT (one-shot : ne réapparaissent pas)
        for (const n of serviceNotifs) {
            processedRef.current.add(n.id);
            if (!n.read) {
                markAsRead(n.id, guildId).catch(() => {});
            }
        }

        setNotifs(prev => [...prev, ...serviceNotifs]);
    }, [parseLink]);

    useEffect(() => {
        if (!isMounted) return;
        fetchAndQueue();
        const interval = setInterval(fetchAndQueue, 10000);
        return () => clearInterval(interval);
    }, [isMounted, fetchAndQueue]);

    // Affiche la file une par une
    useEffect(() => {
        if (notifs.length > 0 && currentIndex === -1) {
            const first = notifs[0];
            if (!shownRef.current.has(first.id)) {
                shownRef.current.add(first.id);
                setCurrent(first);
                setCurrentIndex(0);
                setReplyText("");
            }
        }
    }, [notifs, currentIndex]);

    const handleClose = (skip = false) => {
        if (current) {
            setNotifs(prev => prev.filter(n => n.id !== current.id));
            if (!skip) {
                markAsRead(current.id, guildId).catch(() => {});
            }
        }
        setCurrent(null);
        setCurrentIndex(-1);
        setReplyText("");
    };

    const handleSendReply = () => {
        if (!current || !replyText.trim()) return;
        const parsed = parseLink(current.link);
        if (!parsed) {
            toast.error("Données de notification invalides.");
            handleClose(true);
            return;
        }

        startTransition(async () => {
            const res = await sendServiceReplyAction(
                guildId,
                parsed.listingId,
                replyText.trim(),
                { toUserId: parsed.replyTo }
            );
            if (res.success) {
                toast.success("Votre réponse a été envoyée !");
                handleClose();
            } else {
                toast.error(res.error || "Impossible d'envoyer la réponse.");
            }
        });
    };

    if (!isMounted) return null;

    const isRequest = current?.type === "SERVICE_REQUEST";

    return (
        <Dialog open={!!current} onOpenChange={(open) => !open && handleClose(true)}>
            <DialogContent className="max-w-lg bg-background border border-border shadow-2xl rounded-3xl text-foreground p-0 gap-0 overflow-hidden backdrop-blur-xl">
                <DialogHeader className="p-5 pb-4 border-b border-border bg-surface/30 flex flex-row items-center gap-3 space-y-0">
                    <div className="w-8 h-8 rounded-xl bg-info/20 border border-info/30 flex items-center justify-center shrink-0 shadow-inner">
                        <MessageSquare className="w-4 h-4 text-info" strokeWidth={2.5} />
                    </div>
                    <DialogTitle className="text-base font-black flex-1">
                        Dialogue Service
                    </DialogTitle>
                </DialogHeader>

                <div className="p-6 space-y-5">
                    {current && (
                        <>
                            <div className="rounded-2xl border border-white/8 bg-surface p-4">
                                <p className="text-caption font-black uppercase tracking-widest text-muted-foreground mb-2">
                                    {isRequest ? "Nouvelle demande" : "Réponse"}
                                </p>
                                <h3 className="font-bold text-sm text-foreground">{current.title.replace(/^💬\s*/, "")}</h3>
                                <p className="text-sm text-foreground mt-1.5 leading-relaxed">{current.message}</p>
                            </div>

                            {isRequest && (
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground text-xs font-black uppercase tracking-widest">Votre réponse</Label>
                                    <Textarea
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        placeholder="Saisissez votre message..."
                                        className="bg-black/30 border-border text-foreground rounded-xl placeholder:text-muted-foreground focus:border-info/50 resize-none h-24 text-xs leading-relaxed"
                                        maxLength={500}
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="px-6 pb-6 flex gap-3 border-t border-border pt-5 bg-surface/30">
                    {isRequest ? (
                        <>
                            <Button
                                variant="ghost"
                                onClick={() => handleClose(true)}
                                className="flex-1 border border-border bg-surface text-foreground hover:text-foreground hover:bg-surface font-bold h-12 transition-all rounded-xl"
                            >
                                Plus tard
                            </Button>
                            <Button
                                onClick={handleSendReply}
                                disabled={isPending || !replyText.trim()}
                                className="flex-1 bg-info hover:bg-info text-info-foreground font-black h-12 shadow-lg shadow-cyan-900/20 rounded-xl transition-all"
                            >
                                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Répondre"}
                            </Button>
                        </>
                    ) : (
                        <Button
                            onClick={() => handleClose(true)}
                            className="flex-1 bg-info hover:bg-info text-info-foreground font-black h-12 shadow-lg shadow-cyan-900/20 rounded-xl transition-all"
                        >
                            Fermer
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
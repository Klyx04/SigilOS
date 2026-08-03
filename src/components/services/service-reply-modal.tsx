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
        const res = await getUnreadNotifications();
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
                markAsRead(n.id).catch(() => {});
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
                markAsRead(current.id).catch(() => {});
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

    return (
        <Dialog open={!!current} onOpenChange={(open) => !open && handleClose(true)}>
            <DialogContent className="max-w-lg bg-zinc-950 border border-white/10 shadow-2xl rounded-3xl text-white p-0 gap-0 overflow-hidden backdrop-blur-xl">
                <DialogHeader className="p-5 pb-4 border-b border-white/5 bg-slate-900/30 flex flex-row items-center gap-3 space-y-0">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0 shadow-inner">
                        <MessageSquare className="w-4 h-4 text-cyan-400" strokeWidth={2.5} />
                    </div>
                    <DialogTitle className="text-base font-black flex-1">
                        Dialogue Service
                    </DialogTitle>
                </DialogHeader>

                <div className="p-6 space-y-5">
                    {current && (
                        <>
                            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                                    {current.type === "SERVICE_REQUEST" ? "Nouvelle demande" : "Réponse"}
                                </p>
                                <h3 className="font-bold text-sm text-white">{current.title.replace(/^💬\s*/, "")}</h3>
                                <p className="text-sm text-zinc-300 mt-1.5 leading-relaxed">{current.message}</p>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-zinc-400 text-xs font-black uppercase tracking-widest">Votre réponse</Label>
                                <Textarea
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    placeholder="Saisissez votre message..."
                                    className="bg-black/30 border-white/10 text-white rounded-xl placeholder:text-zinc-600 focus:border-cyan-500/50 resize-none h-24 text-xs leading-relaxed"
                                    maxLength={500}
                                />
                            </div>
                        </>
                    )}
                </div>

                <div className="px-6 pb-6 flex gap-3 border-t border-white/5 pt-5 bg-slate-900/30">
                    <Button
                        variant="ghost"
                        onClick={() => handleClose(true)}
                        className="flex-1 border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 font-bold h-12 transition-all rounded-xl"
                    >
                        Plus tard
                    </Button>
                    <Button
                        onClick={handleSendReply}
                        disabled={isPending || !replyText.trim()}
                        className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-black h-12 shadow-lg shadow-cyan-900/20 rounded-xl transition-all"
                    >
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Répondre"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
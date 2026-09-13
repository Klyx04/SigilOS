"use client";

/**
 * Centre de négociation (S4.10, §14.1) — écran **privé** de « Mon espace ».
 *
 * Deux listes, une seule origine de données (`getMyMarketData`) : les offres
 * **reçues** sur mes annonces, et **mes offres** (déposées, ou en attente de ma
 * réponse quand une contre-offre me revient). Les capacités (`canRespond` /
 * `canCancel`) sont calculées **serveur** : l'écran n'invente aucune règle
 * (§13.4), il les présente et délègue aux server actions.
 */

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MARKET_OFFER_STATUS_CLASSES, MARKET_OFFER_STATUS_LABELS } from "@/server/actions/market-constants";
import { formatKamas } from "@/lib/market/kamas";
import { cn } from "@/lib/utils";
import { cancelMarketOffer, respondToMarketOffer, type MarketCounterpartProfile } from "@/server/actions/market-actions";
import { MarketStatLines, type MarketStatLine } from "@/components/market/market-stat-lines";
import { DiscordProfileBubble } from "@/components/shared/discord-profile-bubble";
import { toast } from "sonner";
import { ArrowLeftRight, Check, Handshake, Loader2, X, XCircle } from "lucide-react";

type OfferStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED" | "EXPIRED";

/** Offre telle que le centre de négociation la reçoit (`MyMarketData`, S4.10). */
export type NegotiationOffer = {
    id: string;
    listingId: string;
    listingTitle: string;
    status: OfferStatus;
    /** `true` = contre-offre rattachée à une offre précédente (§11.4). */
    isCounter: boolean;
    /** `AUTHOR` = je l'ai déposée · `COUNTERPART` = c'est à moi de répondre. */
    role: "AUTHOR" | "COUNTERPART";
    offeredKamas: number | null;
    tradeDescription: string | null;
    note: string | null;
    createdAt: string;
    expiresAt: string | null;
    counterpartLabel: string | null;
    /**
     * S8.14 — **bulle profil** de l'autre partie : DTO **minimal**
     * `{ id, name, image, classe }` (`id` = identifiant **interne**, jamais un
     * snowflake Discord). `null` quand l'offre vient de moi.
     */
    counterpart: MarketCounterpartProfile | null;
    /**
     * S8.15 — **jet déclaré** de l'annonce concernée (icônes officielles) : les
     * offres se jugeaient sans jamais revoir l'objet. Déjà résolu côté serveur.
     */
    listingStats: MarketStatLine[];
    canRespond: boolean;
    canCancel: boolean;
};

interface MarketNegotiationPanelProps {
    guildId: string;
    received: NegotiationOffer[];
    sent: NegotiationOffer[];
}

/** Résumé d'une offre : montant et/ou troc, jamais un blanc muet (§0.1). */
function offerSummary(offer: NegotiationOffer): string {
    const parts: string[] = [];
    if (offer.offeredKamas !== null) parts.push(formatKamas(offer.offeredKamas));
    if (offer.tradeDescription) parts.push(`Troc : ${offer.tradeDescription}`);
    return parts.length > 0 ? parts.join(" · ") : "Aucun montant ni troc";
}

/** Qui parle, dans quel sens : l'écran lève toute ambiguïté (§11.4). */
function roleLabel(offer: NegotiationOffer): string {
    if (offer.role === "AUTHOR") return offer.isCounter ? "Ta contre-offre" : "Ton offre";
    return offer.isCounter ? "Contre-offre reçue" : "Offre reçue";
}

interface OfferRowProps {
    guildId: string;
    offer: NegotiationOffer;
    isPending: boolean;
    onRespond: (offer: NegotiationOffer, decision: "ACCEPT" | "DECLINE") => void;
    onCounter: (offer: NegotiationOffer) => void;
    onCancel: (offer: NegotiationOffer) => void;
}

function OfferRow({ guildId, offer, isPending, onRespond, onCounter, onCancel }: OfferRowProps) {
    return (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface/60 p-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-black uppercase tracking-wider">
                        {roleLabel(offer)}
                    </Badge>
                    <Badge
                        variant="outline"
                        className={cn(
                            "text-[10px] font-black uppercase tracking-wider",
                            MARKET_OFFER_STATUS_CLASSES[offer.status]
                        )}
                    >
                        {MARKET_OFFER_STATUS_LABELS[offer.status]}
                    </Badge>
                    <Link
                        href={`/dashboard/${guildId}/marche/${offer.listingId}`}
                        className="truncate text-sm font-semibold text-foreground hover:underline"
                    >
                        {offer.listingTitle}
                    </Link>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{offerSummary(offer)}</p>
                {/* S8.15 — le jet de l'annonce, avec ses icônes officielles. */}
                {offer.listingStats.length > 0 ? (
                    <MarketStatLines stats={offer.listingStats} className="mt-2" />
                ) : null}
                {offer.note ? (
                    <p className="mt-0.5 truncate text-xs italic text-muted-foreground">« {offer.note} »</p>
                ) : null}
                {/* S8.14 — bulle profil du demandeur / acheteur (avatar + pseudo + classe) */}
                {offer.counterpart ? (
                    <DiscordProfileBubble
                        profile={offer.counterpart}
                        label={offer.isCounter ? "Contre-offreur" : "Demandeur"}
                        size="sm"
                        className="mt-1.5"
                    />
                ) : null}
                <p className="mt-1 text-[11px] text-muted-foreground">
                    {new Date(offer.createdAt).toLocaleDateString("fr-FR")}
                    {offer.status === "PENDING" && offer.expiresAt
                        ? ` · expire le ${new Date(offer.expiresAt).toLocaleDateString("fr-FR")}`
                        : ""}
                </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
                {offer.canRespond && (
                    <>
                        <Button size="sm" className="gap-2" disabled={isPending} onClick={() => onRespond(offer, "ACCEPT")}>
                            {isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Check className="h-3.5 w-3.5" />
                            )}
                            Accepter
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="gap-2"
                            disabled={isPending}
                            onClick={() => onCounter(offer)}
                        >
                            <ArrowLeftRight className="h-3.5 w-3.5" />
                            Contre-offre
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="gap-2 text-danger hover:text-danger"
                            disabled={isPending}
                            onClick={() => onRespond(offer, "DECLINE")}
                        >
                            <X className="h-3.5 w-3.5" />
                            Refuser
                        </Button>
                    </>
                )}

                {offer.canCancel && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        disabled={isPending}
                        onClick={() => onCancel(offer)}
                    >
                        <XCircle className="h-3.5 w-3.5" />
                        Retirer
                    </Button>
                )}

                {!offer.canRespond && !offer.canCancel && (
                    <span className="text-[11px] text-muted-foreground">
                        {offer.status === "PENDING" ? "En attente de l'autre partie" : "Négociation close"}
                    </span>
                )}
            </div>
        </div>
    );
}

export function MarketNegotiationPanel({ guildId, received, sent }: MarketNegotiationPanelProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [counterFor, setCounterFor] = useState<NegotiationOffer | null>(null);
    const [counterKamas, setCounterKamas] = useState("");
    const [counterTrade, setCounterTrade] = useState("");
    const [counterNote, setCounterNote] = useState("");

    function run(action: () => Promise<{ success: boolean; error?: string }>, successMessage: string) {
        startTransition(async () => {
            const result = await action();
            if (result.success) {
                toast.success(successMessage);
                router.refresh();
            } else {
                toast.error(result.error || "Action impossible.");
            }
        });
    }

    function respond(offer: NegotiationOffer, decision: "ACCEPT" | "DECLINE") {
        run(
            () => respondToMarketOffer(guildId, offer.id, decision),
            decision === "ACCEPT" ? "Offre acceptée : l'annonce est réservée." : "Offre refusée."
        );
    }

    function cancel(offer: NegotiationOffer) {
        run(() => cancelMarketOffer(guildId, offer.id), "Offre retirée.");
    }

    function openCounter(offer: NegotiationOffer) {
        setCounterFor(offer);
        // On part de la proposition en face, à ajuster : jamais un écran vide (§0.1).
        setCounterKamas(offer.offeredKamas !== null ? String(offer.offeredKamas) : "");
        setCounterTrade(offer.tradeDescription ?? "");
        setCounterNote("");
    }

    function submitCounter() {
        const offer = counterFor;
        if (!offer) return;
        startTransition(async () => {
            const result = await respondToMarketOffer(guildId, offer.id, "COUNTER", {
                offeredKamas: counterKamas,
                tradeDescription: counterTrade,
                note: counterNote,
            });
            if (result.success) {
                toast.success("Contre-offre envoyée.");
                setCounterFor(null);
                router.refresh();
            } else {
                toast.error(result.error || "Contre-offre refusée.");
            }
        });
    }

    const pendingCount =
        received.filter((offer) => offer.canRespond).length + sent.filter((offer) => offer.canRespond).length;
    const nothing = received.length === 0 && sent.length === 0;

    return (
        <section className="space-y-4" data-tour="marche-negotiation">
            <div className="flex flex-wrap items-center gap-2">
                <Handshake className="h-4 w-4 text-gold" />
                <h2 className="text-sm font-black uppercase tracking-wider text-foreground">Centre de négociation</h2>
                {pendingCount > 0 && (
                    <Badge
                        variant="outline"
                        className="text-[10px] font-black uppercase tracking-wider text-warning border-warning/30 bg-warning/10"
                    >
                        {pendingCount} à traiter
                    </Badge>
                )}
            </div>

            {nothing ? (
                <EmptyState
                    icon={Handshake}
                    title="Aucune négociation en cours"
                    description="Les offres reçues sur tes annonces, et celles que tu as déposées, apparaîtront ici."
                />
            ) : (
                <div className="space-y-4">
                    {received.length > 0 && (
                        <Card className="border-border bg-surface/60">
                            <CardContent className="space-y-3 p-4">
                                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                                    Offres reçues ({received.length})
                                </p>
                                <div className="space-y-2">
                                    {received.map((offer) => (
                                        <OfferRow
                                            key={offer.id}
                                            guildId={guildId}
                                            offer={offer}
                                            isPending={isPending}
                                            onRespond={respond}
                                            onCounter={openCounter}
                                            onCancel={cancel}
                                        />
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                    {sent.length > 0 && (
                        <Card className="border-border bg-surface/60">
                            <CardContent className="space-y-3 p-4">
                                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                                    Mes offres ({sent.length})
                                </p>
                                <div className="space-y-2">
                                    {sent.map((offer) => (
                                        <OfferRow
                                            key={offer.id}
                                            guildId={guildId}
                                            offer={offer}
                                            isPending={isPending}
                                            onRespond={respond}
                                            onCounter={openCounter}
                                            onCancel={cancel}
                                        />
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                    {counterFor && (
                        <Card className="border-gold/40 bg-surface/60">
                            <CardContent className="space-y-3 p-4">
                                <p className="text-xs font-black uppercase tracking-wider text-gold">
                                    Contre-offre sur « {counterFor.listingTitle} »
                                </p>
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="market-counter-kamas">Kamas (facultatif)</Label>
                                        <Input
                                            id="market-counter-kamas"
                                            value={counterKamas}
                                            onChange={(event) => setCounterKamas(event.target.value)}
                                            placeholder="12 500 k"
                                            maxLength={32}
                                        />
                                    </div>
                                    <div className="space-y-1.5 sm:col-span-2">
                                        <Label htmlFor="market-counter-trade">Troc proposé (facultatif)</Label>
                                        <Input
                                            id="market-counter-trade"
                                            value={counterTrade}
                                            onChange={(event) => setCounterTrade(event.target.value)}
                                            placeholder="Ex : 3 runes PA + 1 Dofus Turquoise"
                                            maxLength={500}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="market-counter-note">Message (facultatif)</Label>
                                    <Textarea
                                        id="market-counter-note"
                                        value={counterNote}
                                        onChange={(event) => setCounterNote(event.target.value)}
                                        rows={2}
                                        maxLength={500}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    L&apos;offre en face est refusée et remplacée par la tienne (§11.4) : renseigne un
                                    montant ou un troc, une contre-offre vide est refusée.
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button className="gap-2" disabled={isPending} onClick={submitCounter}>
                                        {isPending ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <ArrowLeftRight className="h-4 w-4" />
                                        )}
                                        Envoyer la contre-offre
                                    </Button>
                                    <Button variant="ghost" disabled={isPending} onClick={() => setCounterFor(null)}>
                                        Annuler
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}
        </section>
    );
}

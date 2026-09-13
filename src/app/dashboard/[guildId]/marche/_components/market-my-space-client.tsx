"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MARKET_STATUS_CLASSES, MARKET_STATUS_LABELS } from "@/server/actions/market-constants";
import { formatKamas } from "@/lib/market/kamas";
import { formatMarketDate } from "@/lib/market/format-date";
import { cn } from "@/lib/utils";
import {
    deleteMarketListing,
    publishMarketListing,
    renewMarketListing,
    withdrawMarketListing,
} from "@/server/actions/market-actions";
import { toast } from "sonner";
import { Boxes, Loader2, Pencil, Plus, RefreshCw, Store, Trash2, Upload, XCircle } from "lucide-react";
import { MarketNegotiationPanel, type NegotiationOffer } from "./market-negotiation-panel";
import { MarketStatLines, type MarketStatLine } from "@/components/market/market-stat-lines";
import { DiscordProfileBubble, type DiscordProfileDTO } from "@/components/shared/discord-profile-bubble";

type MyListing = {
    id: string;
    title: string;
    status: "DRAFT" | "ACTIVE" | "RESERVED" | "SOLD" | "EXPIRED" | "WITHDRAWN";
    priceKamas: number | null;
    publishedAt: string | null;
    expiresAt: string | null;
    renewCount: number;
    itemName: string | null;
    /**
     * S8.15 — **jet déclaré** : déjà sérialisé par `getMyMarketData` (aucune
     * requête supplémentaire). Optionnel : une annonce sans jet n'affiche rien.
     */
    stats?: MarketStatLine[];
};

interface MarketMySpaceClientProps {
    guildId: string;
    /** S8.14 — bulle profil du membre courant (« tu publies en tant que »). */
    viewer?: DiscordProfileDTO | null;
    active: MyListing[];
    archived: MyListing[];
    /** S4.10 — offres reçues sur mes annonces (centre de négociation). */
    received: NegotiationOffer[];
    /** S4.10 — mes offres déposées + les contre-offres qui m'attendent. */
    sent: NegotiationOffer[];
}

export function MarketMySpaceClient({ guildId, viewer, active, archived, received, sent }: MarketMySpaceClientProps) {
    const router = useRouter();
    const [tab, setTab] = useState<"active" | "archived">("active");
    const [isPending, startTransition] = useTransition();

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

    const rows = tab === "active" ? active : archived;

    return (
        <div className="space-y-6">
            {/* S8.14 — bulle profil du membre courant (avatar Discord + pseudo). */}
            {viewer ? (
                <Card className="border-border bg-surface/60">
                    <CardContent className="flex flex-wrap items-center gap-3 p-4">
                        <DiscordProfileBubble profile={viewer} label="Tu publies en tant que" />
                        <p className="text-xs text-muted-foreground sm:ml-auto">
                            Les annonces listées ci-dessous sont les tiennes.
                        </p>
                    </CardContent>
                </Card>
            ) : null}

            <MarketNegotiationPanel guildId={guildId} received={received} sent={sent} />

            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1 rounded-xl border border-border p-1">
                    <Button variant={tab === "active" ? "secondary" : "ghost"} size="sm" className="h-8" onClick={() => setTab("active")}>
                        En cours ({active.length})
                    </Button>
                    <Button variant={tab === "archived" ? "secondary" : "ghost"} size="sm" className="h-8" onClick={() => setTab("archived")}>
                        Terminées ({archived.length})
                    </Button>
                </div>
                <Button asChild className="gap-2 sm:ml-auto">
                    <Link href={`/dashboard/${guildId}/marche/nouveau`}>
                        <Plus className="w-4 h-4" />
                        Nouvelle annonce
                    </Link>
                </Button>
            </div>

            {rows.length === 0 ? (
                <EmptyState
                    icon={Boxes}
                    title={tab === "active" ? "Aucune annonce en cours" : "Aucune annonce terminée"}
                    description={
                        tab === "active"
                            ? "Publie ta première annonce pour la voir apparaître ici."
                            : "Les annonces vendues, expirées ou retirées apparaîtront ici."
                    }
                />
            ) : (
                <div className="space-y-3">
                    {rows.map((listing) => (
                        <Card key={listing.id} className="bg-surface/60 border-border">
                            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <Store className="w-4 h-4 text-gold shrink-0" />
                                        <p className="font-semibold text-foreground truncate">{listing.title}</p>
                                        <Badge
                                            variant="outline"
                                            className={cn("text-[10px] font-black uppercase tracking-wider", MARKET_STATUS_CLASSES[listing.status])}
                                        >
                                            {MARKET_STATUS_LABELS[listing.status]}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {listing.itemName ? `${listing.itemName} · ` : ""}
                                        {formatKamas(listing.priceKamas)}
                                        {listing.expiresAt ? ` · expire le ${formatMarketDate(listing.expiresAt)}` : ""}
                                    </p>
                                    {/* S8.15 — jet déclaré avec les icônes officielles
                                        (avant : aucune ligne de stats sur cet écran). */}
                                    {listing.stats && listing.stats.length > 0 ? (
                                        <MarketStatLines stats={listing.stats} className="mt-2" />
                                    ) : null}
                                </div>

                                <div className="flex flex-wrap items-center gap-2 shrink-0">
                                    <Button asChild size="sm" variant="ghost">
                                        <Link href={`/dashboard/${guildId}/marche/${listing.id}`}>Fiche</Link>
                                    </Button>

                                    {/* S7.13 — édition par le créateur (statuts éditables). */}
                                    {["DRAFT", "ACTIVE", "EXPIRED"].includes(listing.status) && (
                                        <Button asChild size="sm" variant="ghost" className="gap-2">
                                            <Link href={`/dashboard/${guildId}/marche/${listing.id}/modifier`}>
                                                <Pencil className="w-3.5 h-3.5" />
                                                Modifier
                                            </Link>
                                        </Button>
                                    )}

                                    {listing.status === "DRAFT" && (
                                        <Button
                                            size="sm"
                                            className="gap-2"
                                            disabled={isPending}
                                            onClick={() => run(() => publishMarketListing(guildId, listing.id), "Annonce publiée.")}
                                        >
                                            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                            Publier
                                        </Button>
                                    )}

                                    {listing.status === "EXPIRED" && listing.renewCount < 1 && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="gap-2"
                                            disabled={isPending}
                                            onClick={() => run(() => renewMarketListing(guildId, listing.id), "Annonce renouvelée.")}
                                        >
                                            <RefreshCw className="w-3.5 h-3.5" />
                                            Renouveler
                                        </Button>
                                    )}

                                    {["DRAFT", "ACTIVE", "RESERVED"].includes(listing.status) && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="gap-2"
                                            disabled={isPending}
                                            onClick={() => run(() => withdrawMarketListing(guildId, listing.id), "Annonce retirée.")}
                                        >
                                            <XCircle className="w-3.5 h-3.5" />
                                            Retirer
                                        </Button>
                                    )}

                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="text-danger hover:text-danger"
                                        disabled={isPending}
                                        onClick={() => run(() => deleteMarketListing(guildId, listing.id), "Annonce supprimée.")}
                                        title="Supprimer définitivement"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}


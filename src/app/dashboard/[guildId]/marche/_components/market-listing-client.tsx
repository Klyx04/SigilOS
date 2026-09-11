"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    MARKET_ORIGIN_CLASSES,
    MARKET_ORIGIN_LABELS,
    MARKET_QUALITY_CLASSES,
    MARKET_QUALITY_LABELS,
    MARKET_REPORT_REASON_LABELS,
    MARKET_REPORT_REASONS,
    MARKET_STATUS_CLASSES,
    MARKET_STATUS_LABELS,
    MARKET_TYPE_LABELS,
} from "@/server/actions/market-constants";
import { formatKamas } from "@/lib/market/kamas";
import { normalizeNativeRange } from "@/lib/market/effects";
import { cn } from "@/lib/utils";
import { MarketItemCard } from "@/components/market/market-item-card";
import { StatIcon } from "@/components/market/stat-icon";
import {
    deleteMarketListing,
    publishMarketListing,
    renewMarketListing,
    reportMarketListing,
    reserveMarketListing,
    withdrawMarketListing,
} from "@/server/actions/market-actions";
import { resyncMarketListing, restoreMarketListing, takeDownMarketListing } from "@/server/actions/market-admin-actions";
import { toast } from "sonner";
import {
    AlertTriangle,
    Flag,
    Handshake,
    Loader2,
    Package,
    RefreshCw,
    ShieldAlert,
    Store,
    Trash2,
    Upload,
    XCircle,
} from "lucide-react";

type SerializedListing = {
    id: string;
    type: "EQUIPMENT" | "RESOURCE" | "SERVICE" | "WANTED";
    status: "DRAFT" | "ACTIVE" | "RESERVED" | "SOLD" | "EXPIRED" | "WITHDRAWN";
    title: string;
    description: string | null;
    forgedBy: string | null;
    itemName: string | null;
    itemIconUrl: string | null;
    itemLevel: number | null;
    itemTypeName: string | null;
    priceKamas: number | null;
    negotiable: boolean;
    acceptsTrade: boolean;
    quantity: number | null;
    unitLabel: string | null;
    minQuantity: number | null;
    publishedAt: string | null;
    expiresAt: string | null;
    renewCount: number;
    profileId: string;
    profile: {
        id: string;
        pseudoDofus: string | null;
        classe: string | null;
        user: { name: string | null; image: string | null } | null;
    } | null;
    stats: {
        id: string;
        effectId: number;
        characteristic: number | null;
        label: string;
        actualValue: number;
        quality: string;
        origin: string;
        naturalMin: number | null;
        naturalMax: number | null;
    }[];
    components: { id: string; name: string; quantity: number; unitLabel: string | null }[];
};

interface MarketListingClientProps {
    guildId: string;
    listing: SerializedListing;
    isOwner: boolean;
    canManage: boolean;
    averagePrice: number | null;
    itemSetName: string | null;
    realWeight: number | null;
    itemDescription: string | null;
    discordState: { syncStatus: string | null; lastError: string | null; published: boolean } | null;
}

/**
 * S7.6 — Plage native lisible : jamais `[10 à 0]`.
 * Utilise la **même** normalisation que le serveur (`normalizeNativeRange`, S7.4).
 */
function formatDeclaredRange(min: number | null, max: number | null): string {
    if (min == null || max == null) return "";
    const { from, to } = normalizeNativeRange(min, max);
    return from === to ? ` [${from}]` : ` [${from} à ${to}]`;
}

export function MarketListingClient({
    guildId,
    listing,
    isOwner,
    canManage,
    averagePrice,
    itemSetName,
    realWeight,
    itemDescription,
    discordState,
}: MarketListingClientProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [reason, setReason] = useState("");
    // S4.11 — signalement (membre) et retrait de modération (modérateur).
    const [reportOpen, setReportOpen] = useState(false);
    const [reportReason, setReportReason] = useState<(typeof MARKET_REPORT_REASONS)[number]>("JET_MISMATCH");
    const [reportDetails, setReportDetails] = useState("");
    const [moderationNote, setModerationNote] = useState("");

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

    const sellerName = listing.profile?.pseudoDofus || listing.profile?.user?.name || "Membre";

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Colonne principale */}
            <div className="lg:col-span-2 space-y-6">
                {/* S3.8 — bandeau « à resynchroniser » (jamais bloquant) */}
                {listing.status === "ACTIVE" && discordState?.syncStatus === "FAILED" && (
                    <div className="flex items-center gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3">
                        <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-warning">Synchronisation Discord en échec</p>
                            <p className="text-[11px] text-muted-foreground">
                                L&apos;annonce est bien enregistrée sur SigilOS. La publication Discord sera
                                rejouée automatiquement.
                            </p>
                        </div>
                        {canManage && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                disabled={isPending}
                                onClick={() =>
                                    run(() => resyncMarketListing(guildId, listing.id), "Synchronisation relancée.")
                                }
                            >
                                <RefreshCw className="w-4 h-4" />
                                Resynchroniser
                            </Button>
                        )}
                    </div>
                )}

                {/* S2.15 — carte d'item (anatomie §12.3) */}
                <MarketItemCard
                    data={{
                        name: listing.itemName || listing.title,
                        level: listing.itemLevel,
                        typeName: listing.itemTypeName,
                        itemSetName,
                        iconUrl: listing.itemIconUrl,
                        description: itemDescription,
                        forgedBy: listing.forgedBy,
                        realWeight,
                        averagePrice,
                        priceKamas: listing.priceKamas,
                        unitLabel: listing.unitLabel,
                        stats: listing.stats,
                        components: listing.components,
                    }}
                />

                <Card className="bg-surface/60 border-border">
                    <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Store className="w-4 h-4 text-gold" />
                            Le lot / l&apos;objet
                        </CardTitle>
                        <Badge
                            variant="outline"
                            className={cn("text-[10px] font-black uppercase tracking-wider", MARKET_STATUS_CLASSES[listing.status])}
                        >
                            {MARKET_STATUS_LABELS[listing.status]}
                        </Badge>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {listing.type === "EQUIPMENT" ? (
                            <div className="flex items-center gap-4">
                                <div className="relative h-16 w-16 shrink-0 rounded-2xl border border-border bg-background/60 overflow-hidden">
                                    {listing.itemIconUrl ? (
                                        <Image src={listing.itemIconUrl} alt={listing.itemName ?? listing.title} fill sizes="64px" className="object-contain p-1" unoptimized />
                                    ) : (
                                        <Store className="w-6 h-6 text-muted-foreground absolute inset-0 m-auto" />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <p className="font-bold text-foreground">{listing.itemName ?? listing.title}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {listing.itemTypeName ?? MARKET_TYPE_LABELS[listing.type]}
                                        {listing.itemLevel ? ` · Niv. ${listing.itemLevel}` : ""}
                                    </p>
                                    {listing.forgedBy && (
                                        <p className="text-xs text-gold mt-1">Modifié par {listing.forgedBy}</p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                                    <Package className="w-4 h-4 text-info" />
                                    Contenu du lot ({listing.components.length})
                                </p>
                                {listing.components.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">
                                        {listing.quantity ? `${listing.quantity} ${listing.unitLabel ?? "unités"}` : "Lot vide"}
                                    </p>
                                ) : (
                                    <ul className="space-y-1">
                                        {listing.components.map((component) => (
                                            <li key={component.id} className="flex items-center justify-between text-sm border-b border-border/60 py-1.5">
                                                <span className="text-foreground truncate">{component.name}</span>
                                                <span className="font-bold tabular-nums">{component.quantity.toLocaleString("fr-FR")}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {listing.minQuantity && (
                                    <p className="text-xs text-muted-foreground">
                                        Quantité minimale par acheteur : {listing.minQuantity.toLocaleString("fr-FR")}
                                    </p>
                                )}
                            </div>
                        )}

                        {listing.description && (
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap border-t border-border pt-3">
                                {listing.description}
                            </p>
                        )}
                    </CardContent>
                </Card>

                {listing.stats.length > 0 && (
                    <Card className="bg-surface/60 border-border">
                        <CardHeader>
                            <CardTitle className="text-base">Jet déclaré</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {listing.stats.map((stat) => (
                                <div key={stat.id} className="flex items-center justify-between gap-3 text-sm border-b border-border/60 py-1.5">
                                    <span className="flex min-w-0 items-center gap-2 text-foreground">
                                        <StatIcon
                                            characteristicId={stat.characteristic}
                                            effectId={stat.effectId}
                                            label={stat.label}
                                        />
                                        <span className="truncate">
                                            {stat.label}
                                            <span className="text-muted-foreground">
                                                {formatDeclaredRange(stat.naturalMin, stat.naturalMax)}
                                            </span>
                                        </span>
                                    </span>
                                    <span
                                        className={cn(
                                            "font-bold tabular-nums",
                                            MARKET_QUALITY_CLASSES[(stat.quality as keyof typeof MARKET_QUALITY_CLASSES) ?? "NORMAL"],
                                            MARKET_ORIGIN_CLASSES[(stat.origin as keyof typeof MARKET_ORIGIN_CLASSES) ?? "NATIVE"]
                                        )}
                                    >
                                        {stat.actualValue}
                                        <span className="ml-2 text-[10px] uppercase tracking-wider">
                                            {MARKET_QUALITY_LABELS[(stat.quality as keyof typeof MARKET_QUALITY_LABELS) ?? "NORMAL"]}
                                            {stat.origin === "EXO" ? ` · ${MARKET_ORIGIN_LABELS.EXO}` : ""}
                                        </span>
                                    </span>
                                </div>
                            ))}
                            <p className="text-[11px] text-muted-foreground pt-2">
                                Un over ou un exo n&apos;est jamais refusé : c&apos;est la valeur du marché FM. Seules les
                                fautes de frappe manifestes sont bloquées.
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Colonne latérale */}
            <div className="space-y-6">
                <Card className="bg-surface/60 border-border">
                    <CardContent className="p-5 space-y-4">
                        <div>
                            <p className="text-[11px] uppercase tracking-wider font-black text-muted-foreground">Prix</p>
                            <p className="text-2xl font-black text-gold tabular-nums">{formatKamas(listing.priceKamas)}</p>
                            <p className="text-xs text-muted-foreground">
                                {listing.negotiable ? "Négociable" : "Prix ferme"}
                                {listing.acceptsTrade ? " · Troc accepté" : ""}
                            </p>
                        </div>

                        <div className="border-t border-border pt-3 space-y-1 text-xs text-muted-foreground">
                            <p>Vendeur : <span className="text-foreground font-semibold">{sellerName}</span></p>
                            {listing.publishedAt && <p>Publiée le {new Date(listing.publishedAt).toLocaleDateString("fr-FR")}</p>}
                            {listing.expiresAt && <p>Expire le {new Date(listing.expiresAt).toLocaleDateString("fr-FR")}</p>}
                            {listing.renewCount > 0 && <p>Renouvelée {listing.renewCount} fois</p>}
                        </div>

                        <p className="text-[11px] text-muted-foreground border-t border-border pt-3">
                            L&apos;échange se conclut <strong>en jeu</strong> : SigilOS n&apos;effectue ni le transfert
                            d&apos;objets ni celui des kamas, et ne garantit pas la transaction.
                        </p>
                    </CardContent>
                </Card>

                {/* Actions acheteur (S4.2) — réserver au prix (verrou §11.3) */}
                {!isOwner && (
                    <Card className="bg-surface/60 border-border">
                        <CardHeader>
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Handshake className="w-4 h-4 text-success" />
                                Acheter
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {listing.status === "ACTIVE" ? (
                                <>
                                    <Button
                                        className="w-full gap-2"
                                        disabled={isPending}
                                        onClick={() =>
                                            run(
                                                () => reserveMarketListing(guildId, listing.id),
                                                "Annonce réservée. Le vendeur est prévenu."
                                            )
                                        }
                                    >
                                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Handshake className="w-4 h-4" />}
                                        Réserver au prix
                                    </Button>
                                    <p className="text-[11px] text-muted-foreground">
                                        La réservation bloque l&apos;annonce pour les autres membres pendant la durée
                                        prévue par la guilde. L&apos;échange se conclut toujours en jeu.
                                    </p>
                                </>
                            ) : (
                                <p className="text-xs text-muted-foreground">
                                    Cette annonce n&apos;est plus disponible à la réservation.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Signalement (S4.11, §6.9) — jamais sa propre annonce, une fois par annonce */}
                {!isOwner && (
                    <Card className="bg-surface/60 border-border">
                        <CardHeader>
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Flag className="w-4 h-4 text-warning" />
                                Signaler cette annonce
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {reportOpen ? (
                                <>
                                    <select
                                        value={reportReason}
                                        onChange={(event) =>
                                            setReportReason(
                                                event.target.value as (typeof MARKET_REPORT_REASONS)[number]
                                            )
                                        }
                                        className="w-full h-10 rounded-xl border border-border bg-background/60 px-3 text-sm"
                                    >
                                        {MARKET_REPORT_REASONS.map((value) => (
                                            <option key={value} value={value}>
                                                {MARKET_REPORT_REASON_LABELS[value]}
                                            </option>
                                        ))}
                                    </select>
                                    <textarea
                                        value={reportDetails}
                                        onChange={(event) => setReportDetails(event.target.value)}
                                        rows={3}
                                        maxLength={500}
                                        placeholder="Contexte (facultatif) : ce qui ne correspond pas, quand, avec qui…"
                                        className="w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
                                    />
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Button
                                            size="sm"
                                            className="gap-2"
                                            disabled={isPending}
                                            onClick={() =>
                                                run(
                                                    () =>
                                                        reportMarketListing(
                                                            guildId,
                                                            listing.id,
                                                            reportReason,
                                                            reportDetails
                                                        ),
                                                    "Signalement transmis à la modération."
                                                )
                                            }
                                        >
                                            <Flag className="w-3.5 h-3.5" />
                                            Envoyer le signalement
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            disabled={isPending}
                                            onClick={() => setReportOpen(false)}
                                        >
                                            Annuler
                                        </Button>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">
                                        Un signalement ouvre un <strong>dossier</strong> : la modération tranche, aucune
                                        sanction automatique.
                                    </p>
                                </>
                            ) : (
                                <Button
                                    variant="outline"
                                    className="w-full gap-2"
                                    disabled={isPending}
                                    onClick={() => setReportOpen(true)}
                                >
                                    <Flag className="w-4 h-4" />
                                    Signaler
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Actions vendeur (S1.22 / S1.31) — et modération (S4.11) */}
                {(isOwner || canManage) && (
                    <Card className="bg-surface/60 border-border">
                        <CardHeader>
                            <CardTitle className="text-sm flex items-center gap-2">
                                <ShieldAlert className="w-4 h-4 text-warning" />
                                Actions du vendeur
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {isOwner && listing.status === "DRAFT" && (
                                <Button
                                    className="w-full gap-2"
                                    disabled={isPending}
                                    onClick={() => run(() => publishMarketListing(guildId, listing.id), "Annonce publiée.")}
                                >
                                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                    Publier l&apos;annonce
                                </Button>
                            )}
                            {isOwner && listing.status === "EXPIRED" && listing.renewCount < 1 && (
                                <Button
                                    variant="outline"
                                    className="w-full gap-2"
                                    disabled={isPending}
                                    onClick={() => run(() => renewMarketListing(guildId, listing.id), "Annonce renouvelée.")}
                                >
                                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                    Renouveler (une seule fois)
                                </Button>
                            )}
                            {isOwner && ["DRAFT", "ACTIVE", "RESERVED", "EXPIRED"].includes(listing.status) && (
                                <>
                                    <input
                                        value={reason}
                                        onChange={(event) => setReason(event.target.value)}
                                        placeholder="Motif du retrait (facultatif)"
                                        maxLength={200}
                                        className="w-full h-10 rounded-xl border border-border bg-background/60 px-3 text-sm"
                                    />
                                    <Button
                                        variant="outline"
                                        className="w-full gap-2"
                                        disabled={isPending}
                                        onClick={() => run(() => withdrawMarketListing(guildId, listing.id, reason), "Annonce retirée.")}
                                    >
                                        <XCircle className="w-4 h-4" />
                                        Retirer l&apos;annonce
                                    </Button>
                                </>
                            )}
                            {isOwner && (
                                <Button
                                    variant="ghost"
                                    className="w-full gap-2 text-danger hover:text-danger"
                                    disabled={isPending}
                                    onClick={() => run(() => deleteMarketListing(guildId, listing.id), "Annonce supprimée.")}
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Supprimer définitivement
                                </Button>
                            )}
                            {!isOwner && canManage && (
                                <>
                                    {(listing.status === "ACTIVE" || listing.status === "RESERVED") && (
                                        <>
                                            <input
                                                value={moderationNote}
                                                onChange={(event) => setModerationNote(event.target.value)}
                                                placeholder="Motif du retrait (visible du vendeur)"
                                                maxLength={200}
                                                className="w-full h-10 rounded-xl border border-border bg-background/60 px-3 text-sm"
                                            />
                                            <Button
                                                variant="outline"
                                                className="w-full gap-2 text-danger hover:text-danger"
                                                disabled={isPending}
                                                onClick={() =>
                                                    run(
                                                        () =>
                                                            takeDownMarketListing(guildId, listing.id, moderationNote),
                                                        "Annonce retirée pour modération."
                                                    )
                                                }
                                            >
                                                <XCircle className="w-4 h-4" />
                                                Retirer pour modération
                                            </Button>
                                        </>
                                    )}
                                    {listing.status === "WITHDRAWN" && (
                                        <Button
                                            variant="outline"
                                            className="w-full gap-2"
                                            disabled={isPending}
                                            onClick={() =>
                                                run(
                                                    () => restoreMarketListing(guildId, listing.id),
                                                    "Annonce restaurée."
                                                )
                                            }
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                            Restaurer l&apos;annonce
                                        </Button>
                                    )}
                                    <p className="text-[11px] text-muted-foreground">
                                        Chaque retrait et chaque restauration est journalisé dans l&apos;audit de
                                        l&apos;annonce. Le vendeur peut corriger puis republier une annonce retirée.
                                    </p>
                                </>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}


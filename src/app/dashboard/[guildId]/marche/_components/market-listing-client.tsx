"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    MARKET_OFFER_STATUS_LABELS,
    MARKET_ORIGIN_CLASSES,
    MARKET_ORIGIN_LABELS,
    MARKET_QUALITY_CLASSES,
    MARKET_QUALITY_LABELS,
    MARKET_REPORT_REASON_LABELS,
    MARKET_REPORT_REASONS,
} from "@/server/actions/market-constants";
import { formatKamas } from "@/lib/market/kamas";
import { formatMarketDate, formatMarketDateTime } from "@/lib/market/format-date";
import { normalizeNativeRange } from "@/lib/market/effects";
import { cn } from "@/lib/utils";
import { MarketItemCard } from "@/components/market/market-item-card";
import { StatIcon } from "@/components/market/stat-icon";
import { DiscordProfileBubble, type DiscordProfileDTO } from "@/components/shared/discord-profile-bubble";
import {
    cancelMarketReservation,
    createMarketOffer,
    deleteMarketListing,
    publishMarketListing,
    releaseMarketReservation,
    renewMarketListing,
    reportMarketListing,
    reserveMarketListing,
    withdrawMarketListing,
} from "@/server/actions/market-actions";
import { resyncMarketListing, restoreMarketListing, takeDownMarketListing } from "@/server/actions/market-admin-actions";
import { toast } from "sonner";
import {
    AlertTriangle,
    ExternalLink,
    Flag,
    Handshake,
    Loader2,
    Pencil,
    RefreshCw,
    ShieldAlert,
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
    /**
     * S8.10 — **forge réelle déclarée** (D40/D41). La présence de
     * `transcendenceRuneId` vaut « Transcendé » (aucun booléen redondant) ;
     * `transcendenceLabel` est le libellé d'effet dénormalisé.
     */
    transcendenceRuneId: number | null;
    transcendenceLabel: string | null;
    strikeElement: string | null;
    elementPotionId: number | null;
    elementPotionTier: number | null;
    huntingWeapon: string | null;
    publishedAt: string | null;
    expiresAt: string | null;
    renewCount: number;
    /** S7.8 — échéance de la réservation en cours (portée par l'annonce). */
    reservedUntil: string | null;
    /**
     * S7.8 — **réservation active** telle qu'affichée au dashboard (§13.7) :
     * l'écran est privé à la guilde, le pseudo y est donc légitime (il ne l'est
     * jamais dans le salon Discord, qui n'expose que le compteur d'offres).
     */
    reservation: {
        id: string;
        status: string;
        expiresAt: string;
        buyerProfileId: string;
        /** Pseudo Dofus du réservataire (jamais un identifiant Discord). */
        buyerLabel: string;
        buyerClasse: string | null;
        /**
         * Constat beta — avatar Discord du réservataire : le bloc « annonce
         * réservée » montre **qui** a réservé (bulle profil + lien lecture seule).
         */
        buyerImage: string | null;
        /** `true` si c'est **le membre courant** qui a réservé. */
        isMine: boolean;
    } | null;
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
    /**
     * Constat beta — le bloc « annonce réservée » montre **qui** a réservé
     * (avatar Discord + lien vers son profil lecture seule) : le lien n'est
     * rendu que si le lecteur a le droit de consulter l'annuaire (fail-closed :
     * jamais un lien vers un écran interdit).
     */
    canViewRoster: boolean;
    averagePrice: number | null;
    itemSetName: string | null;
    realWeight: number | null;
    itemDescription: string | null;
    /** Nom **réel** du catalogue (repli : nom figé sur l'annonce, puis titre). */
    itemName: string | null;
    /** Famille d'objet (Équipements / Cosmétique / Ressources-Autres). */
    itemFamilyLabel: string | null;
    /**
     * `true` = l'annonce porte un **jet déclaré** (objet modifiable + stats).
     * Un lot, un cosmétique ou une vente brute n'affichent **jamais** de jet :
     * la règle est calculée côté serveur (D17), l'UI ne fait qu'obéir.
     */
    declaredJet: boolean;
    /** 🏅 Capacité légendaire du catalogue (`effectId` 1175) — décision user 14/09. */
    isLegendary: boolean;
    /**
     * 🕒 Constat beta 14/09 (décision user : timeline des offres) — historique
     * **anonyme** : statut + date seuls (§13.7 : jamais un montant ni un offrant).
     */
    offerHistory: { id: string; status: string; at: string }[];
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

/** S7.8 — date + heure d'une échéance de réservation, **déterministe** (BUG-9). */
function formatDeadline(iso: string | null): string {
    return formatMarketDateTime(iso);
}

export function MarketListingClient({
    guildId,
    listing,
    isOwner,
    canManage,
    canViewRoster,
    averagePrice,
    itemSetName,
    realWeight,
    itemDescription,
    itemName,
    itemFamilyLabel,
    declaredJet,
    isLegendary,
    offerHistory,
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

    /**
     * BUG-3 (R3) — « Faire une offre » depuis la fiche : le montant et le message
     * restent **privés** (seul le vendeur les voit, dans « Mon espace »). Le
     * formulaire n'est qu'une saisie : la règle vit côté serveur
     * (`createMarketOfferCore`, montant borné, annonce négociable et non terminale).
     */
    const [offerOpen, setOfferOpen] = useState(false);
    const [offerKamas, setOfferKamas] = useState("");
    const [offerNote, setOfferNote] = useState("");

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
    /**
     * S8.14 — DTO **minimal** de la bulle profil du vendeur (`id` interne, nom,
     * avatar, classe). Aucun email, aucun token, aucun identifiant Discord.
     */
    const sellerProfile: DiscordProfileDTO | null = listing.profile
        ? {
              id: listing.profile.id,
              name: sellerName,
              image: listing.profile.user?.image ?? null,
              classe: listing.profile.classe,
          }
        : null;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" data-tour="marche-listing">
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

                {/* S2.15 — carte d'item (anatomie §12.3). Constat beta : **un seul
                    bloc** pour l'objet — l'ancienne carte « Le lot / l'objet »
                    dupliquait le contenu du lot (déjà rendu ici) et affichait un
                    objet en double sur une annonce d'équipement. */}
                <MarketItemCard
                    data={{
                        // Constat beta — le nom affiché est celui **du catalogue**
                        // (l'annonce peut porter un titre commercial).
                        name: itemName || listing.itemName || listing.title,
                        level: listing.itemLevel,
                        typeName: listing.itemTypeName,
                        itemSetName,
                        iconUrl: listing.itemIconUrl,
                        description: itemDescription,
                        forgedBy: listing.forgedBy,
                        // 🏅 Décision user (14/09) — mention « Objet légendaire » seule.
                        isLegendary,
                        realWeight,
                        averagePrice,
                        priceKamas: listing.priceKamas,
                        unitLabel: listing.unitLabel,
                        // Constat beta — quantité du lot + minimum par acheteur :
                        // rappelés ici, la carte « Le lot / l'objet » ayant disparu.
                        quantity: listing.quantity,
                        minQuantity: listing.minQuantity,
                        // S8.10 — forge réelle déclarée → bloc STATUT (S8.4).
                        transcended: listing.transcendenceRuneId !== null,
                        transcendenceLabel: listing.transcendenceLabel,
                        strikeElement: listing.strikeElement,
                        huntingWeapon: listing.huntingWeapon,
                        // Constat beta — **aucune ligne de stat** pour un lot, un
                        // cosmétique ou une vente brute : `declaredJet` est calculé
                        // côté serveur (famille + jet réellement déclaré, D17).
                        stats: declaredJet ? listing.stats : [],
                        components: listing.components,
                    }}
                />

                {/* 🕒 Constat beta 14/09 — **timeline des offres** (décision user :
                    « un historique en live des offres validées / non validées, une
                    sorte de timeline sous l'item » ; placement retenu : **sous la
                    carte d'item**, repliée par défaut ⇒ un équipement à 17 lignes
                    ne pousse jamais les boutons d'achat hors de l'écran).

                    🔒 §13.7 — timeline **anonyme** : statut + date uniquement,
                    **jamais** un montant ni l'identité d'un offrant. */}
                {offerHistory.length > 0 && (
                    <details className="rounded-2xl border border-border bg-surface/60 px-4 py-3" data-tour="marche-offers-timeline">
                        <summary className="cursor-pointer list-none text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                            Historique des offres ({offerHistory.length})
                        </summary>
                        <ul className="mt-3 space-y-1.5">
                            {offerHistory.map((entry) => (
                                <li key={entry.id} className="flex items-center gap-2 text-xs">
                                    <span
                                        className={cn(
                                            "h-1.5 w-1.5 shrink-0 rounded-full",
                                            entry.status === "ACCEPTED"
                                                ? "bg-success"
                                                : entry.status === "PENDING"
                                                  ? "bg-info"
                                                  : "bg-muted-foreground/50"
                                        )}
                                        aria-hidden="true"
                                    />
                                    <span className="text-foreground/90">
                                        {MARKET_OFFER_STATUS_LABELS[
                                            entry.status as keyof typeof MARKET_OFFER_STATUS_LABELS
                                        ] ?? entry.status}
                                    </span>
                                    <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                                        {formatMarketDateTime(entry.at)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <p className="mt-3 text-[11px] text-muted-foreground">
                            Montants et identités des offrants restent privés (visibles du vendeur
                            uniquement, dans la négociation).
                        </p>
                    </details>
                )}

                {itemFamilyLabel && (
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px] font-black uppercase tracking-wider">
                            {itemFamilyLabel}
                        </Badge>
                        <span className="text-caption text-muted-foreground">
                            {declaredJet
                                ? "Jet déclaré par le vendeur — over et exo acceptés par conception."
                                : "Vente brute : aucune statistique n'est déclarée sur cette annonce."}
                        </span>
                    </div>
                )}

                {/* Note du vendeur (précédemment portée par la carte dupliquée). */}
                {listing.description && (
                    <Card className="bg-surface/60 border-border">
                        <CardContent className="p-4">
                            <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                                Note du vendeur
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                                {listing.description}
                            </p>
                        </CardContent>
                    </Card>
                )}

                {declaredJet && (
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

                        <div className="border-t border-border pt-3 space-y-2 text-xs text-muted-foreground">
                            {/* S8.14 — bulle profil du vendeur (avatar + pseudo + classe) */}
                            {sellerProfile ? (
                                <DiscordProfileBubble profile={sellerProfile} label="Vendeur" size="sm" />
                            ) : (
                                <p>
                                    Vendeur : <span className="text-foreground font-semibold">{sellerName}</span>
                                </p>
                            )}
                            {listing.publishedAt && <p>Publiée le {formatMarketDate(listing.publishedAt)}</p>}
                            {listing.expiresAt && <p>Expire le {formatMarketDate(listing.expiresAt)}</p>}
                            {listing.renewCount > 0 && <p>Renouvelée {listing.renewCount} fois</p>}
                        </div>

                        {/* S7.8/S7.9 — réservation ACTIVE : **qui**, jusqu'à quand (§13.7).
                            Constat beta : le réservataire s'affiche avec son avatar Discord
                            + un lien vers son profil **lecture seule** (rendu uniquement si
                            le lecteur a le droit de consulter l'annuaire : fail-closed). */}
                        {listing.reservation && (
                            <div className="rounded-xl border border-info/30 bg-info/10 px-3 py-2 space-y-2">
                                <p className="text-[11px] font-black uppercase tracking-wider text-info">
                                    {listing.reservation.isMine
                                        ? "Tu as réservé cette annonce"
                                        : "Annonce réservée"}
                                </p>

                                {!listing.reservation.isMine && (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <DiscordProfileBubble
                                            profile={{
                                                id: listing.reservation.buyerProfileId,
                                                name: listing.reservation.buyerLabel,
                                                image: listing.reservation.buyerImage,
                                                classe: listing.reservation.buyerClasse,
                                            }}
                                            label="Réservé par"
                                            size="sm"
                                        />
                                        {canViewRoster && (
                                            <Button asChild size="sm" variant="ghost" className="gap-1">
                                                <Link
                                                    href={`/dashboard/${guildId}/members/${listing.reservation.buyerProfileId}`}
                                                >
                                                    Voir le profil
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </Link>
                                            </Button>
                                        )}
                                    </div>
                                )}

                                <p className="text-[11px] text-muted-foreground">
                                    {listing.reservation.isMine ? (
                                        <>
                                            Le vendeur a été prévenu. Rendez-vous en jeu avant le{" "}
                                            <span className="font-semibold text-foreground">
                                                {formatDeadline(listing.reservation.expiresAt)}
                                            </span>
                                            .
                                        </>
                                    ) : (
                                        <>
                                            Réservation jusqu&apos;au{" "}
                                            <span className="font-semibold text-foreground">
                                                {formatDeadline(listing.reservation.expiresAt)}
                                            </span>
                                            . Sans échange en jeu d&apos;ici là, l&apos;annonce repasse
                                            automatiquement en vente.
                                        </>
                                    )}
                                </p>
                            </div>
                        )}

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
                            ) : listing.reservation?.isMine ? (
                                <div className="space-y-2">
                                    <p className="text-xs text-info">
                                        Tu as réservé cette annonce jusqu&apos;au{" "}
                                        {formatDeadline(listing.reservation.expiresAt)}. Le vendeur a été
                                        prévenu.
                                    </p>
                                    {/* 🕒 Constat beta 14/09 — le réservataire pouvait se désister
                                        **uniquement** depuis l'embed Discord (`mkt:cancel`) ; la
                                        fiche du dashboard n'exposait rien. Même action serveur
                                        (`cancelMarketReservation` → `cancelMarketReservationCore`,
                                        §13.4) : aucune règle dupliquée. */}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full gap-2"
                                        disabled={isPending}
                                        onClick={() =>
                                            run(
                                                () => cancelMarketReservation(guildId, listing.reservation!.id),
                                                "Réservation annulée : l'annonce repart en vente."
                                            )
                                        }
                                    >
                                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                                        Me désister
                                    </Button>
                                </div>
                            ) : listing.reservation ? (
                                <p className="text-xs text-muted-foreground">
                                    Déjà réservée par{" "}
                                    <span className="font-semibold text-foreground">
                                        {listing.reservation.buyerLabel}
                                    </span>{" "}
                                    jusqu&apos;au {formatDeadline(listing.reservation.expiresAt)}.
                                </p>
                            ) : (
                                <p className="text-xs text-muted-foreground">
                                    Cette annonce n&apos;est plus disponible à la réservation.
                                </p>
                            )}

                            {/* BUG-3 (R3, ratifié) — « Faire une offre » reste possible même
                                si quelqu&apos;un a réservé : on peut toujours proposer un prix.
                                Montant et message restent **privés** (vendeur uniquement). */}
                            {listing.negotiable && ["ACTIVE", "RESERVED"].includes(listing.status) && (
                                <div className="space-y-2 border-t border-border pt-3">
                                    {offerOpen ? (
                                        <>
                                            <input
                                                value={offerKamas}
                                                onChange={(event) => setOfferKamas(event.target.value)}
                                                placeholder="Ton prix en kamas (ex. 12 500)"
                                                inputMode="numeric"
                                                maxLength={20}
                                                className="w-full h-10 rounded-xl border border-border bg-background/60 px-3 text-sm"
                                            />
                                            <input
                                                value={offerNote}
                                                onChange={(event) => setOfferNote(event.target.value)}
                                                placeholder="Message au vendeur (facultatif)"
                                                maxLength={500}
                                                className="w-full h-10 rounded-xl border border-border bg-background/60 px-3 text-sm"
                                            />
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    className="flex-1"
                                                    disabled={isPending}
                                                    onClick={() => setOfferOpen(false)}
                                                >
                                                    Annuler
                                                </Button>
                                                <Button
                                                    className="flex-1 gap-2"
                                                    disabled={isPending}
                                                    onClick={() =>
                                                        run(
                                                            () =>
                                                                createMarketOffer(guildId, listing.id, {
                                                                    offeredKamas: offerKamas,
                                                                    note: offerNote,
                                                                }).then((result) => {
                                                                    if (result.success) {
                                                                        setOfferOpen(false);
                                                                        setOfferKamas("");
                                                                        setOfferNote("");
                                                                    }
                                                                    return result;
                                                                }),
                                                            "Offre envoyée au vendeur (montant privé)."
                                                        )
                                                    }
                                                >
                                                    {isPending ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Flag className="w-4 h-4" />
                                                    )}
                                                    Envoyer l&apos;offre
                                                </Button>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground">
                                                Ton montant reste <strong>privé</strong> : seul le vendeur le voit, dans son
                                                espace de négociation.
                                            </p>
                                        </>
                                    ) : (
                                        <Button
                                            variant="outline"
                                            className="w-full gap-2"
                                            onClick={() => setOfferOpen(true)}
                                        >
                                            <Flag className="w-4 h-4" />
                                            Faire une offre
                                        </Button>
                                    )}
                                </div>
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
                            {/* S7.13 — le vendeur corrige son annonce (jet, quantité, prix). */}
                            {isOwner && ["DRAFT", "ACTIVE", "EXPIRED"].includes(listing.status) && (
                                <Button asChild variant="outline" className="w-full gap-2">
                                    <Link href={`/dashboard/${guildId}/marche/${listing.id}/modifier`}>
                                        <Pencil className="w-4 h-4" />
                                        Modifier l&apos;annonce
                                    </Link>
                                </Button>
                            )}
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
                            {/* R3 (ratifié) — « Lever la réservation » : le vendeur rend
                                l'annonce disponible (l'acheteur est prévenu) et les offres
                                reçues redeviennent acceptables. Propriétaire uniquement. */}
                            {isOwner && listing.status === "RESERVED" && listing.reservation && (
                                <Button
                                    variant="outline"
                                    className="w-full gap-2"
                                    disabled={isPending}
                                    onClick={() =>
                                        run(
                                            () =>
                                                releaseMarketReservation(guildId, listing.reservation!.id),
                                            "Réservation levée : l'annonce repasse en vente."
                                        )
                                    }
                                >
                                    <XCircle className="w-4 h-4" />
                                    Lever la réservation
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


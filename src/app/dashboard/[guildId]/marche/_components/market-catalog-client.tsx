"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import {
    MARKET_STATUS_CLASSES,
    MARKET_STATUS_LABELS,
    MARKET_TYPE_LABELS,
} from "@/server/actions/market-constants";
import { formatGroupedInteger, formatKamas } from "@/lib/market/kamas";
import { formatMarketDateTime } from "@/lib/market/format-date";
import { MarketItemIcon } from "@/components/market/market-item-icon";
import { cn } from "@/lib/utils";
import {
    AlertTriangle,
    Boxes,
    LayoutGrid,
    Plus,
    Search,
    Settings,
    ShieldAlert,
    Store,
    Table2,
} from "lucide-react";

type SerializedListing = {
    id: string;
    type: "EQUIPMENT" | "RESOURCE" | "SERVICE" | "WANTED";
    status: "DRAFT" | "ACTIVE" | "RESERVED" | "SOLD" | "EXPIRED" | "WITHDRAWN";
    title: string;
    itemName: string | null;
    itemIconUrl: string | null;
    /** Identifiant Ankama du catalogue : repli sûr du proxy d'icône (BUG-1). */
    dofusDbItemId: number | null;
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
    /** S7.9 — échéance de la réservation en cours (annonce `RESERVED`). */
    reservedUntil: string | null;
    profile: {
        id: string;
        pseudoDofus: string | null;
        classe: string | null;
        userId: string;
        user: { name: string | null; image: string | null } | null;
    } | null;
    stats: { id: string; label: string; actualValue: number }[];
    components: { id: string; name: string; quantity: number; unitLabel: string | null }[];
};

interface MarketCatalogClientProps {
    guildId: string;
    listings: SerializedListing[];
    canManage: boolean;
    isAdmin: boolean;
    channelConfigured: boolean;
}

/** S7.9 — échéance lisible (« 12/09/2026 20:30 »), **déterministe** (BUG-9). */
function formatDeadline(iso: string | null): string {
    return formatMarketDateTime(iso);
}

export function MarketCatalogClient({
    guildId,
    listings,
    canManage,
    isAdmin,
    channelConfigured,
}: MarketCatalogClientProps) {
    const [search, setSearch] = useState("");
    const [type, setType] = useState<string>("ALL");
    const [status, setStatus] = useState<string>("ALL");
    const [sort, setSort] = useState<string>("recent");
    const [hideTerminal, setHideTerminal] = useState(true);
    const [view, setView] = useState<"cards" | "table">("cards");

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        const rows = listings.filter((listing) => {
            if (type !== "ALL" && listing.type !== type) return false;
            if (status !== "ALL" && listing.status !== status) return false;
            if (hideTerminal && ["SOLD", "EXPIRED", "WITHDRAWN"].includes(listing.status)) return false;
            if (term) {
                const haystack = `${listing.title} ${listing.itemName ?? ""} ${listing.profile?.pseudoDofus ?? ""}`.toLowerCase();
                if (!haystack.includes(term)) return false;
            }
            return true;
        });

        const sorted = [...rows];
        if (sort === "price_asc") sorted.sort((a, b) => (a.priceKamas ?? Infinity) - (b.priceKamas ?? Infinity));
        if (sort === "price_desc") sorted.sort((a, b) => (b.priceKamas ?? -1) - (a.priceKamas ?? -1));
        if (sort === "level_desc") sorted.sort((a, b) => (b.itemLevel ?? 0) - (a.itemLevel ?? 0));
        if (sort === "recent") {
            sorted.sort(
                (a, b) =>
                    new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime()
            );
        }
        return sorted;
    }, [listings, search, type, status, sort, hideTerminal]);

    return (
        <div className="space-y-6" data-tour="marche-catalog">
            {/* Bandeau d'aide : salon Discord non configuré (§9.2) */}
            {!channelConfigured && (
                <Card className="border-warning/30 bg-warning/5">
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-bold text-foreground">Salon Discord non configuré</p>
                                <p className="text-xs text-muted-foreground">
                                    Les annonces ne seront pas publiées tant qu&apos;un salon n&apos;est pas choisi.
                                    Le marché reste utilisable sur le dashboard.
                                </p>
                            </div>
                        </div>
                        {isAdmin && (
                            <Button asChild variant="outline" size="sm" className="sm:ml-auto shrink-0">
                                <Link href={`/dashboard/${guildId}/admin/settings?tab=marche`}>Configurer</Link>
                            </Button>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Barre d'action */}
            <div className="flex flex-wrap items-center gap-3">
                <Button asChild className="gap-2" data-tour="marche-create">
                    <Link href={`/dashboard/${guildId}/marche/nouveau`}>
                        <Plus className="w-4 h-4" />
                        Publier une annonce
                    </Link>
                </Button>
                <Button asChild variant="outline" className="gap-2" data-tour="marche-my-listings">
                    <Link href={`/dashboard/${guildId}/marche/mes-espaces`}>
                        <Boxes className="w-4 h-4" />
                        Mon espace
                    </Link>
                </Button>
                {isAdmin && (
                    <Button asChild variant="ghost" className="gap-2 sm:ml-auto" data-tour="marche-settings-link">
                        <Link href={`/dashboard/${guildId}/admin/settings?tab=marche`}>
                            <Settings className="w-4 h-4" />
                            Réglages du marché
                        </Link>
                    </Button>
                )}
                {canManage && (
                    <Button asChild variant="outline" className="gap-2">
                        <Link href={`/dashboard/${guildId}/marche/moderation`}>
                            <ShieldAlert className="w-4 h-4" />
                            Modération
                        </Link>
                    </Button>
                )}
            </div>

            {/* Filtres */}
            <Card className="bg-surface/60 border-border" data-tour="marche-filters">
                <CardContent className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 items-center">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Rechercher un objet, un vendeur…"
                                className="h-10 pl-9"
                            />
                        </div>
                        <Select value={type} onValueChange={setType}>
                            <SelectTrigger className="h-10">
                                <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Tous les types</SelectItem>
                                <SelectItem value="EQUIPMENT">Équipement</SelectItem>
                                <SelectItem value="RESOURCE">Ressources</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger className="h-10">
                                <SelectValue placeholder="Statut" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Tous les statuts</SelectItem>
                                <SelectItem value="ACTIVE">Disponible</SelectItem>
                                <SelectItem value="RESERVED">Réservé</SelectItem>
                                <SelectItem value="SOLD">Vendu</SelectItem>
                                <SelectItem value="EXPIRED">Expiré</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={sort} onValueChange={setSort}>
                            <SelectTrigger className="h-10">
                                <SelectValue placeholder="Trier" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="recent">Plus récentes</SelectItem>
                                <SelectItem value="price_asc">Prix croissant</SelectItem>
                                <SelectItem value="price_desc">Prix décroissant</SelectItem>
                                <SelectItem value="level_desc">Niveau décroissant</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-wrap items-center gap-6">
                        <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                            <Switch checked={hideTerminal} onCheckedChange={setHideTerminal} />
                            Masquer vendues / expirées
                        </label>

                        <div className="flex items-center gap-1 ml-auto rounded-xl border border-border p-1">
                            <Button
                                variant={view === "cards" ? "secondary" : "ghost"}
                                size="sm"
                                className="h-8 gap-2"
                                onClick={() => setView("cards")}
                            >
                                <LayoutGrid className="w-4 h-4" />
                                Cartes
                            </Button>
                            <Button
                                variant={view === "table" ? "secondary" : "ghost"}
                                size="sm"
                                className="h-8 gap-2"
                                onClick={() => setView("table")}
                            >
                                <Table2 className="w-4 h-4" />
                                Tableau
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Résultats */}
            {filtered.length === 0 ? (
                <EmptyState
                    icon={Store}
                    title="Aucune annonce"
                    description="Aucune annonce ne correspond à ces filtres. Publie la première annonce du marché !"
                />
            ) : view === "cards" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filtered.map((listing) => (
                        <MarketListingCard key={listing.id} guildId={guildId} listing={listing} />
                    ))}
                </div>
            ) : (
                <MarketTable guildId={guildId} listings={filtered} />
            )}
        </div>
    );
}


/** Badge de statut — tokens uniquement (DoD visuelle §10.6). */
function StatusBadge({ status }: { status: SerializedListing["status"] }) {
    return (
        <Badge variant="outline" className={cn("text-[10px] font-black uppercase tracking-wider", MARKET_STATUS_CLASSES[status])}>
            {MARKET_STATUS_LABELS[status]}
        </Badge>
    );
}

/** Carte d'annonce (vue « Cartes », maquette A). */
function MarketListingCard({ guildId, listing }: { guildId: string; listing: SerializedListing }) {
    const sellerName = listing.profile?.pseudoDofus || listing.profile?.user?.name || "Membre";
    return (
        <Card className="bg-surface/60 border-border hover:border-border-strong transition-colors overflow-hidden">
            <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                    <div className="h-12 w-12 shrink-0 rounded-xl border border-border bg-background/60 flex items-center justify-center overflow-hidden">
                        <MarketItemIcon
                            src={listing.itemIconUrl}
                            ankamaId={listing.dofusDbItemId}
                            alt={listing.itemName ?? listing.title}
                            size={44}
                            className="p-1"
                            fallback={<Store className="w-5 h-5 text-muted-foreground" />}
                        />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-foreground truncate">{listing.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                            {listing.itemName || MARKET_TYPE_LABELS[listing.type]}
                            {listing.itemLevel ? ` · Niv. ${listing.itemLevel}` : ""}
                            {listing.itemTypeName ? ` · ${listing.itemTypeName}` : ""}
                        </p>
                    </div>
                    <StatusBadge status={listing.status} />
                </div>

                <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-black text-gold tabular-nums">{formatKamas(listing.priceKamas)}</span>
                    <span className="text-[11px] text-muted-foreground truncate">
                        {listing.negotiable ? "Négociable" : "Prix ferme"}
                        {listing.acceptsTrade ? " · Troc accepté" : ""}
                    </span>
                </div>

                {/* S7.9 — une annonce réservée affiche son échéance (jamais un simple badge). */}
                {listing.status === "RESERVED" && listing.reservedUntil && (
                    <p className="text-[11px] font-semibold text-info">
                        Réservé jusqu&apos;au {formatDeadline(listing.reservedUntil)}
                    </p>
                )}

                {listing.components.length > 0 && (
                    <div className="text-[11px] text-muted-foreground border-t border-border pt-2 space-y-0.5">
                        {listing.components.slice(0, 2).map((component) => (
                            <p key={component.id} className="truncate">
                                {formatGroupedInteger(component.quantity)} × {component.name}
                            </p>
                        ))}
                        {listing.components.length > 2 && <p>+ {listing.components.length - 2} autre(s)</p>}
                    </div>
                )}

                <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                    <span className="text-[11px] text-muted-foreground truncate">{sellerName}</span>
                    <Button asChild size="sm" variant="outline">
                        <Link href={`/dashboard/${guildId}/marche/${listing.id}`}>Voir la fiche</Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}


/** Vue « Tableau » dense (maquette B). */
function MarketTable({ guildId, listings }: { guildId: string; listings: SerializedListing[] }) {
    return (
        <Card className="bg-surface/60 border-border overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                            <th className="text-left font-bold px-4 py-3">Objet</th>
                            <th className="text-left font-bold px-4 py-3">Type</th>
                            <th className="text-left font-bold px-4 py-3">Contenu / Jet</th>
                            <th className="text-right font-bold px-4 py-3">Prix</th>
                            <th className="text-left font-bold px-4 py-3">Vendeur</th>
                            <th className="text-left font-bold px-4 py-3">Statut</th>
                            <th className="text-right font-bold px-4 py-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {listings.map((listing) => (
                            <tr key={listing.id} className="border-b border-border/60 hover:bg-foreground/[0.02]">
                                <td className="px-4 py-3">
                                    <p className="font-semibold text-foreground truncate max-w-[220px]">{listing.title}</p>
                                    <p className="text-[11px] text-muted-foreground truncate max-w-[220px]">
                                        {listing.itemName || "—"}
                                        {listing.itemLevel ? ` · Niv. ${listing.itemLevel}` : ""}
                                    </p>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">{MARKET_TYPE_LABELS[listing.type]}</td>
                                <td className="px-4 py-3 text-muted-foreground">
                                    {listing.type === "RESOURCE"
                                        ? listing.components.length > 0
                                            ? `${formatGroupedInteger(listing.components[0].quantity)} × ${listing.components[0].name}${listing.components.length > 1 ? ` (+${listing.components.length - 1})` : ""}`
                                            : listing.quantity
                                                ? `${formatGroupedInteger(listing.quantity)} ${listing.unitLabel ?? "unités"}`
                                                : "—"
                                        : listing.stats.length > 0
                                            ? `${listing.stats.length} stat(s) déclarée(s)`
                                            : "—"}
                                </td>
                                <td className="px-4 py-3 text-right font-black text-gold tabular-nums">
                                    {formatKamas(listing.priceKamas)}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground truncate max-w-[140px]">
                                    {listing.profile?.pseudoDofus || listing.profile?.user?.name || "Membre"}
                                </td>
                                <td className="px-4 py-3">
                                    <StatusBadge status={listing.status} />
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <Button asChild size="sm" variant="ghost">
                                        <Link href={`/dashboard/${guildId}/marche/${listing.id}`}>Ouvrir</Link>
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}


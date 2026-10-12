"use client";

/**
 * God « Marché » — panneau de supervision (S8.18 / §18.2).
 *
 * L'écran **ne décide rien** : il lit (`getGodMarketOverview`) et délègue
 * chaque action aux server actions `god-market-actions` (toutes gardées par
 * `isSuperAdmin()` **côté serveur**).
 * Aucun identifiant externe ici : seuls des **ids internes** renvoyés par le serveur.
 *
 * 🧭 Décisions user (18/09/2026) : les « rôles notifiables » sont un réglage
 * **local par nature** ⇒ ils vivent **uniquement** dans *Réglages → Marché* de la
 * guilde ; le journal d'audit du marché a migré vers **God → Audit Logs → onglet
 * « Marché »** (`listGodMarketAuditLogs`). Cette page ne garde que la supervision :
 * indicateurs, santé Discord, preuves & médias, réglages globaux.
 */

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { RefreshCw, Trash2, Save, ExternalLink, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import { MARKET_SETTINGS_BOUNDS, MARKET_SETTINGS_DEFAULTS } from "@/server/actions/market-constants";
import { parseReminderDays } from "@/lib/market/reminder-days";
import { formatMarketDateTime } from "@/lib/market/format-date";
import {
    getGodMarketOverview,
    purgeGodMarketMedia,
    regenerateGodMarketImage,
    resyncGodMarketDiscord,
    saveGodMarketSettings,
    type GodMarketOverview,
} from "@/server/actions/god-market-actions";

/** Taille lisible (jamais un nombre d'octets brut à l'écran). */
function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`;
    const units = ["Ko", "Mo", "Go", "To"];
    let value = bytes / 1024;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
    }
    return `${value.toFixed(1)} ${units[unit]}`;
}

export function GodMarketPanel({ initialOverview }: { initialOverview: GodMarketOverview }) {
    const [overview, setOverview] = useState<GodMarketOverview>(initialOverview);
    const [isPending, startTransition] = useTransition();
    const [busy, setBusy] = useState<string | null>(null);

    const [lockModule, setLockModule] = useState(initialOverview.settings.lockedCount > 0);
    const [mediaRetentionDays, setMediaRetentionDays] = useState(
        initialOverview.settings.mediaRetentionDaysInUse[0] ?? MARKET_SETTINGS_DEFAULTS.marketMediaRetentionDays
    );
    const [logRetentionDays, setLogRetentionDays] = useState(
        initialOverview.settings.logRetentionDaysInUse[0] ?? MARKET_SETTINGS_DEFAULTS.marketLogRetentionDays
    );

    // T4 (D-B) — **défauts globaux** « Durées, plafonds & rappels » : le God fixe
    // les valeurs une fois pour toutes les guildes (« valeurs en base » remontées
    // par `getGodMarketOverview().settings`).
    const [maxActivePerMember, setMaxActivePerMember] = useState(
        initialOverview.settings.marketMaxActivePerMemberInUse[0] ?? MARKET_SETTINGS_DEFAULTS.marketMaxActivePerMember
    );
    const [defaultDurationDays, setDefaultDurationDays] = useState(
        initialOverview.settings.marketDefaultDurationDaysInUse[0] ??
            MARKET_SETTINGS_DEFAULTS.marketDefaultDurationDays
    );
    const [maxLifetimeDays, setMaxLifetimeDays] = useState(
        initialOverview.settings.marketMaxLifetimeDaysInUse[0] ?? MARKET_SETTINGS_DEFAULTS.marketMaxLifetimeDays
    );
    const [reservationHours, setReservationHours] = useState(
        initialOverview.settings.marketReservationHoursInUse[0] ?? MARKET_SETTINGS_DEFAULTS.marketReservationHours
    );
    const [offerHours, setOfferHours] = useState(
        initialOverview.settings.marketOfferHoursInUse[0] ?? MARKET_SETTINGS_DEFAULTS.marketOfferHours
    );
    const [reminderDays, setReminderDays] = useState(
        (initialOverview.settings.marketReminderDaysInUse.length > 0
            ? initialOverview.settings.marketReminderDaysInUse
            : MARKET_SETTINGS_DEFAULTS.marketReminderDays
        ).join(", ")
    );
    const [negotiationsEnabled, setNegotiationsEnabled] = useState(
        initialOverview.settings.negotiationsEnabledInUse.length > 0
            ? initialOverview.settings.negotiationsEnabledInUse.every(Boolean)
            : MARKET_SETTINGS_DEFAULTS.marketNegotiationsEnabled
    );

    /** Recharge la vue complète (mêmes garanties serveur). */
    async function refresh() {
        const result = await getGodMarketOverview();
        if (!result.success) {
            toast.error(result.error);
            return;
        }
        setOverview(result.data);
    }

    /** Rejoue la synchronisation Discord (une annonce ou un lot de 25). */
    function resync(listingId?: string) {
        startTransition(async () => {
            setBusy(listingId ?? "batch");
            try {
                const result = await resyncGodMarketDiscord(listingId ? { listingId } : { limit: 25 });
                if (!result.success) {
                    toast.error(result.error);
                    return;
                }
                const { resynced, recreated, stillFailed } = result.data;
                toast.success(`Resynchronisé : ${resynced} · recréé : ${recreated} · en échec : ${stillFailed}`);
                await refresh();
            } finally {
                setBusy(null);
            }
        });
    }

    /** Régénère la carte PNG + l'embed d'une annonce. */
    function regenerateImage(listingId: string) {
        startTransition(async () => {
            setBusy(listingId);
            try {
                const result = await regenerateGodMarketImage({ listingId });
                if (!result.success) {
                    toast.error(result.error);
                    return;
                }
                toast.success("Carte régénérée et embed réécrit");
                await refresh();
            } finally {
                setBusy(null);
            }
        });
    }

    /** Purge cross-guild des médias expirés (lot borné côté serveur). */
    function purgeMedia() {
        startTransition(async () => {
            setBusy("purge");
            try {
                const result = await purgeGodMarketMedia({ limit: 50 });
                if (!result.success) {
                    toast.error(result.error);
                    return;
                }
                const { purgedListings, mediaDeleted, bytesDeleted, filesFailed } = result.data;
                toast.success(
                    `${purgedListings} annonce(s), ${mediaDeleted} fichier(s) (${formatBytes(bytesDeleted)}), ${filesFailed} échec(s)`
                );
                await refresh();
            } finally {
                setBusy(null);
            }
        });
    }

    /**
     * Applique les réglages globaux : verrou plateforme, rétention **et**
     * défauts « Durées, plafonds & rappels » (T4 / D-B).
     *
     * ⚠️ La saisie des jours de rappel est **refusée** si inexploitable : on
     * n'écrit jamais une valeur arbitraire en base (fail-closed).
     */
    function saveSettings() {
        const parsedReminderDays = parseReminderDays(reminderDays);
        if (!parsedReminderDays) {
            toast.error(
                `Jours de rappel invalides : indique 1 à 3 valeurs entre ${MARKET_SETTINGS_BOUNDS.marketReminderDays.min} et ${MARKET_SETTINGS_BOUNDS.marketReminderDays.max} (ex. « 7, 15 »).`
            );
            return;
        }

        startTransition(async () => {
            setBusy("settings");
            try {
                const result = await saveGodMarketSettings({
                    lockModule,
                    mediaRetentionDays,
                    logRetentionDays,
                    marketMaxActivePerMember: maxActivePerMember,
                    marketDefaultDurationDays: defaultDurationDays,
                    marketMaxLifetimeDays: maxLifetimeDays,
                    marketReminderDays: parsedReminderDays,
                    marketReservationHours: reservationHours,
                    marketOfferHours: offerHours,
                    marketNegotiationsEnabled: negotiationsEnabled,
                });
                if (!result.success) {
                    toast.error(result.error);
                    return;
                }
                toast.success(
                    `Réglages appliqués — verrou : ${result.data.lockedGuilds} guilde(s)${
                        result.data.retentionUpdated ? " · rétention mise à jour" : ""
                    }${result.data.settingsUpdated ? " · durées/plafonds poussés" : ""}`
                );
                await refresh();
            } finally {
                setBusy(null);
            }
        });
    }

    const { totals, settings, health } = overview;
    const disabled = isPending || busy !== null;

    /**
     * T4 (D-B) — champs **bornés** des défauts globaux « Durées, plafonds &
     * rappels » : mêmes bornes et mêmes libellés que la rétention (jamais une
     * valeur libre), avec les « valeurs en base » affichées sous chaque champ.
     */
    const durationFields: {
        id: string;
        label: string;
        value: number;
        onChange: (value: number) => void;
        bounds: { min: number; max: number };
        inUse: number[];
    }[] = [
        {
            id: "god-market-max-active",
            label: "Annonces actives / membre",
            value: maxActivePerMember,
            onChange: setMaxActivePerMember,
            bounds: MARKET_SETTINGS_BOUNDS.marketMaxActivePerMember,
            inUse: settings.marketMaxActivePerMemberInUse,
        },
        {
            id: "god-market-default-duration",
            label: "Durée par défaut (jours)",
            value: defaultDurationDays,
            onChange: setDefaultDurationDays,
            bounds: MARKET_SETTINGS_BOUNDS.marketDefaultDurationDays,
            inUse: settings.marketDefaultDurationDaysInUse,
        },
        {
            id: "god-market-max-lifetime",
            label: "Durée de vie maximale (jours)",
            value: maxLifetimeDays,
            onChange: setMaxLifetimeDays,
            bounds: MARKET_SETTINGS_BOUNDS.marketMaxLifetimeDays,
            inUse: settings.marketMaxLifetimeDaysInUse,
        },
        {
            id: "god-market-reservation-hours",
            label: "Durée d'une réservation (h)",
            value: reservationHours,
            onChange: setReservationHours,
            bounds: MARKET_SETTINGS_BOUNDS.marketReservationHours,
            inUse: settings.marketReservationHoursInUse,
        },
        {
            id: "god-market-offer-hours",
            label: "Durée de vie d'une offre (h)",
            value: offerHours,
            onChange: setOfferHours,
            bounds: MARKET_SETTINGS_BOUNDS.marketOfferHours,
            inUse: settings.marketOfferHoursInUse,
        },
    ];


    const indicators: { label: string; value: number | string; tone: string }[] = [
        { label: "Annonces actives", value: totals.active, tone: "text-success" },
        { label: "Réservées", value: totals.reserved, tone: "text-warning" },
        { label: "Brouillons", value: totals.draft, tone: "text-muted-foreground" },
        { label: "Vendues", value: totals.sold, tone: "text-info" },
        { label: "Retirées", value: totals.withdrawn, tone: "text-danger" },
        { label: "Archivées", value: totals.deleted, tone: "text-muted-foreground" },
        { label: "Réservations en cours", value: totals.reservationsActive, tone: "text-warning" },
        { label: "Offres en attente", value: totals.offersPending, tone: "text-info" },
        { label: "Signalements ouverts", value: totals.reportsOpen, tone: "text-danger" },
        { label: "Preuves", value: totals.mediaCount, tone: "text-muted-foreground" },
        { label: "Volume preuves", value: formatBytes(totals.mediaBytes), tone: "text-muted-foreground" },
        { label: "Sync Discord en échec", value: totals.syncFailed, tone: "text-danger" },
    ];

    return (
        <div className="space-y-8">
            {/* ── Indicateurs ─────────────────────────────────────────────── */}
            <section className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                    <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground">
                        Indicateurs (toutes guildes)
                    </h2>
                    <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={disabled}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Actualiser
                    </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
                    {indicators.map((item) => (
                        <Card key={item.label} className="border-border">
                            <CardContent className="p-4 space-y-1">
                                <p className="text-caption uppercase tracking-wider text-muted-foreground font-semibold">
                                    {item.label}
                                </p>
                                <p className={`text-xl font-bold ${item.tone}`}>{item.value}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
                <p className="text-caption text-muted-foreground">
                    {settings.guildCount} guilde(s) · {settings.enabledCount} module(s) actif(s) · {settings.lockedCount}{" "}
                    verrouillée(s) par le staff · sync en attente : {totals.syncPending}
                </p>
            </section>

            {/* ── Santé Discord (§18.2) ───────────────────────────────────── */}
            <section className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                    <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground">
                        Santé Discord ({health.length})
                    </h2>
                    <Button variant="outline" size="sm" onClick={() => resync()} disabled={disabled}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Resynchroniser un lot (25)
                    </Button>
                </div>

                {health.length === 0 ? (
                    <EmptyState
                        icon={CheckCircle2}
                        title="Aucun message divergent"
                        description="Tous les messages Discord publiés correspondent à l'état en base."
                    />
                ) : (
                    <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border">
                        {health.map((row) => (
                            <div key={row.listingId} className="p-4 flex flex-col lg:flex-row lg:items-center gap-3">
                                <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Badge variant={row.syncStatus === "FAILED" ? "destructive" : "secondary"}>
                                            {row.syncStatus}
                                        </Badge>
                                        <span className="font-semibold text-foreground truncate">{row.listingTitle}</span>
                                        <span className="text-caption text-muted-foreground">
                                            {row.guildName ?? "Guilde inconnue"} · {row.listingStatus}
                                        </span>
                                    </div>
                                    <p className="text-caption text-muted-foreground font-mono truncate">
                                        dernière synchro : {formatMarketDateTime(row.lastSyncedAt)}
                                        {row.lastError ? ` · erreur : ${row.lastError}` : ""}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <a
                                        href={row.imageUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-caption text-info inline-flex items-center gap-1 hover:underline"
                                    >
                                        Carte <ExternalLink className="w-3 h-3" />
                                    </a>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => void regenerateImage(row.listingId)}
                                        disabled={disabled}
                                    >
                                        Régénérer l&apos;image
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => void resync(row.listingId)}
                                        disabled={disabled}
                                    >
                                        Resynchroniser
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* ── Médias (§18.2) ──────────────────────────────────────────── */}
            <section className="space-y-4">
                <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground">Preuves & médias</h2>
                <Card className="border-border">
                    <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                        <div className="flex-1 space-y-1">
                            <p className="text-foreground font-semibold">
                                {totals.mediaCount} fichier(s) · {formatBytes(totals.mediaBytes)}
                            </p>
                            <p className="text-caption text-muted-foreground">
                                Purge des preuves des annonces terminées depuis plus de la rétention configurée
                                (actuellement : {settings.mediaRetentionDaysInUse.join(" / ") || "—"} jour(s)).
                            </p>
                        </div>
                        <Button variant="outline" onClick={purgeMedia} disabled={disabled}>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Purger les médias expirés (50)
                        </Button>
                    </CardContent>
                </Card>
            </section>

            {/* ── Réglages globaux (§18.2) ────────────────────────────────── */}
            <section className="space-y-4">
                <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground">
                    Réglages globaux (toutes guildes)
                </h2>
                <Card className="border-border">
                    <CardContent className="p-4 space-y-5">
                        <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                                <Label htmlFor="god-market-lock" className="font-semibold">
                                    Verrouiller le module Marché
                                </Label>
                                <p className="text-caption text-muted-foreground max-w-xl">
                                    Pose (ou retire) le verrou plateforme sur toutes les guildes. Le module est alors
                                    effectivement désactivé ; la bascule choisie par chaque guilde est conservée et
                                    reprend telle quelle au déverrouillage.
                                </p>
                            </div>
                            <Switch
                                id="god-market-lock"
                                checked={lockModule}
                                onCheckedChange={setLockModule}
                                disabled={disabled}
                            />
                        </div>

                        {/* T4 (D-B) — défauts globaux « Durées, plafonds & rappels » */}
                        <div className="rounded-2xl border border-border bg-surface/40 p-4 space-y-3">
                            <div>
                                <p className="text-label font-bold text-foreground">Durées, plafonds &amp; rappels</p>
                                <p className="text-caption text-muted-foreground">
                                    Valeurs globales appliquées à toutes les guildes d&apos;un coup : le panneau de
                                    guilde devient un écran facultatif (exception locale). Chaque champ est borné et
                                    journalisé dans l&apos;audit God.
                                </p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {durationFields.map((field) => (
                                    <div key={field.id} className="space-y-2">
                                        <Label htmlFor={field.id}>{field.label}</Label>
                                        <Input
                                            id={field.id}
                                            type="number"
                                            min={field.bounds.min}
                                            max={field.bounds.max}
                                            value={field.value}
                                            onChange={(event) => field.onChange(Number(event.target.value))}
                                            disabled={disabled}
                                        />
                                        <p className="text-caption text-muted-foreground">
                                            Valeurs en base : {field.inUse.join(" / ") || "—"} · bornes{" "}
                                            {field.bounds.min}–{field.bounds.max}
                                        </p>
                                    </div>
                                ))}
                                <div className="space-y-2">
                                    <Label htmlFor="god-market-reminder-days">Rappels (jours après publication)</Label>
                                    <Input
                                        id="god-market-reminder-days"
                                        type="text"
                                        inputMode="numeric"
                                        value={reminderDays}
                                        onChange={(event) => setReminderDays(event.target.value)}
                                        placeholder="7, 15"
                                        disabled={disabled}
                                    />
                                    <p className="text-caption text-muted-foreground">
                                        Valeurs en base : {settings.marketReminderDaysInUse.join(" / ") || "—"} · 1 à 3
                                        valeurs, bornes {MARKET_SETTINGS_BOUNDS.marketReminderDays.min}–
                                        {MARKET_SETTINGS_BOUNDS.marketReminderDays.max}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background/40 p-3">
                                <div>
                                    <Label htmlFor="god-market-negotiations" className="font-semibold">
                                        Négociations (offres) activées
                                    </Label>
                                    <p className="text-caption text-muted-foreground">
                                        Une annonce non négociable reste sans bouton « Faire une offre », même si ce
                                        réglage est actif.
                                    </p>
                                </div>
                                <Switch
                                    id="god-market-negotiations"
                                    checked={negotiationsEnabled}
                                    onCheckedChange={setNegotiationsEnabled}
                                    disabled={disabled}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="god-market-media-retention">Rétention des preuves (jours)</Label>
                                <Input
                                    id="god-market-media-retention"
                                    type="number"
                                    min={MARKET_SETTINGS_BOUNDS.marketMediaRetentionDays.min}
                                    max={MARKET_SETTINGS_BOUNDS.marketMediaRetentionDays.max}
                                    value={mediaRetentionDays}
                                    onChange={(event) => setMediaRetentionDays(Number(event.target.value))}
                                    disabled={disabled}
                                />
                                <p className="text-caption text-muted-foreground">
                                    Valeurs en base : {settings.mediaRetentionDaysInUse.join(" / ") || "—"} · bornes{" "}
                                    {MARKET_SETTINGS_BOUNDS.marketMediaRetentionDays.min}–
                                    {MARKET_SETTINGS_BOUNDS.marketMediaRetentionDays.max}
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="god-market-log-retention">Rétention du journal (jours)</Label>
                                <Input
                                    id="god-market-log-retention"
                                    type="number"
                                    min={MARKET_SETTINGS_BOUNDS.marketLogRetentionDays.min}
                                    max={MARKET_SETTINGS_BOUNDS.marketLogRetentionDays.max}
                                    value={logRetentionDays}
                                    onChange={(event) => setLogRetentionDays(Number(event.target.value))}
                                    disabled={disabled}
                                />
                                <p className="text-caption text-muted-foreground">
                                    Valeurs en base : {settings.logRetentionDaysInUse.join(" / ") || "—"} · bornes{" "}
                                    {MARKET_SETTINGS_BOUNDS.marketLogRetentionDays.min}–
                                    {MARKET_SETTINGS_BOUNDS.marketLogRetentionDays.max}
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <Button onClick={saveSettings} disabled={disabled}>
                                <Save className="w-4 h-4 mr-2" />
                                Enregistrer
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </section>
        </div>
    );
}


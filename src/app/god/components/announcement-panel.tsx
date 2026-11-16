"use client";

import ReactMarkdown from "react-markdown";
import { useEffect, useState, useTransition } from "react";
import {
    AlertTriangle,
    Info,
    Loader2,
    Megaphone,
    Radio,
    Send,
    Wrench,
    X,
} from "lucide-react";
import {
    broadcastDiscordAnnouncement,
    clearSystemAnnouncement,
    getStelliumChannels,
    setSystemAnnouncement,
    type SystemAnnouncement,
} from "@/server/actions/announcement-actions";
import { cn } from "@/lib/utils";

interface AnnouncementPanelProps {
    currentAnnouncement: SystemAnnouncement | null;
}

const BANNER_TYPE_LABEL = {
    info: "Information",
    warning: "Avertissement",
    maintenance: "Maintenance",
} as const;

const DISCORD_TYPE_LABEL = {
    maintenance: "Maintenance",
    update: "Mise à jour",
    info: "Information",
} as const;

const BANNER_TYPE_CLASS = {
    info: "border-info/20 bg-info/10 text-info",
    warning: "border-warning/20 bg-warning/10 text-warning",
    maintenance: "border-accent/20 bg-accent-soft text-accent",
} as const;

const BANNER_TYPE_ICON = {
    info: Info,
    warning: AlertTriangle,
    maintenance: Wrench,
} as const;

type BannerType = keyof typeof BANNER_TYPE_ICON;

function BannerIcon({ type, className }: { type: BannerType; className?: string }) {
    const Icon = BANNER_TYPE_ICON[type];
    return <Icon className={className} aria-hidden />;
}

function formatDate(iso: string): string {
    return new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "Europe/Paris",
    }).format(new Date(iso));
}

export function AnnouncementPanel({ currentAnnouncement }: AnnouncementPanelProps) {
    const [bannerMessage, setBannerMessage] = useState("");
    const [bannerType, setBannerType] = useState<BannerType>("maintenance");
    const [bannerExpiry, setBannerExpiry] = useState<number>(60);
    const [bannerPending, startBannerTransition] = useTransition();
    const [bannerResult, setBannerResult] = useState<string | null>(null);

    const [discordMessage, setDiscordMessage] = useState("");
    const [discordType, setDiscordType] = useState<"maintenance" | "update" | "info">("maintenance");
    const [mentionEveryone, setMentionEveryone] = useState(false);
    const [discordPending, startDiscordTransition] = useTransition();
    const [discordResult, setDiscordResult] = useState<string | null>(null);

    const [activeAnnouncement, setActiveAnnouncement] = useState(currentAnnouncement);

    const [stelliumChannels, setStelliumChannels] = useState<{ id: string; name: string | null }[]>([]);
    const [stelliumChannelId, setStelliumChannelId] = useState<string>("");

    useEffect(() => {
        getStelliumChannels().then(setStelliumChannels);
    }, []);

    const handleSetBanner = () => {
        if (!bannerMessage.trim()) return;
        startBannerTransition(async () => {
            const result = await setSystemAnnouncement(bannerMessage, bannerType, bannerExpiry || undefined);
            if (result.success) {
                setBannerResult("Bandeau activé");
                setActiveAnnouncement({
                    message: bannerMessage,
                    type: bannerType,
                    createdAt: new Date().toISOString(),
                    expiresAt: bannerExpiry ? new Date(Date.now() + bannerExpiry * 60000).toISOString() : undefined,
                });
                setBannerMessage("");
            } else {
                setBannerResult(`Erreur : ${result.error}`);
            }
            setTimeout(() => setBannerResult(null), 3000);
        });
    };

    const handleClearBanner = () => {
        startBannerTransition(async () => {
            const result = await clearSystemAnnouncement();
            if (result.success) {
                setBannerResult("Bandeau désactivé");
                setActiveAnnouncement(null);
            } else {
                setBannerResult(`Erreur : ${result.error}`);
            }
            setTimeout(() => setBannerResult(null), 3000);
        });
    };

    const handleBroadcast = () => {
        if (!discordMessage.trim()) return;
        startDiscordTransition(async () => {
            const result = await broadcastDiscordAnnouncement(
                discordMessage,
                discordType,
                mentionEveryone,
                stelliumChannelId || undefined
            );
            if (result.success) {
                setDiscordResult(`Envoyé à ${result.sent} guilde(s)${result.failed ? ` (${result.failed} échec)` : ""}`);
                setDiscordMessage("");
            } else {
                setDiscordResult(`Erreur : ${result.error}`);
            }
            setTimeout(() => setDiscordResult(null), 5000);
        });
    };

    return (
        <div className="space-y-4">
            <section className="rounded-xl border border-border bg-surface">
                <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
                    <div className="flex items-center gap-2">
                        <Radio className="h-4 w-4 text-accent" aria-hidden />
                        <div>
                            <h3 className="text-sm font-medium text-foreground">Bandeau du dashboard</h3>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                Message affiché en haut de tous les dashboards.
                            </p>
                        </div>
                    </div>
                    {activeAnnouncement && (
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-success/20 bg-success/10 px-2 py-0.5 text-xs text-success">
                            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
                            Diffusion en cours
                        </span>
                    )}
                </header>
                <div className="space-y-4 p-4">
                    {activeAnnouncement && (
                        <div className={cn("rounded-lg border p-3", BANNER_TYPE_CLASS[activeAnnouncement.type])}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex min-w-0 items-start gap-2">
                                    <BannerIcon type={activeAnnouncement.type} className="mt-0.5 h-4 w-4 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-sm">{activeAnnouncement.message}</p>
                                        <p className="mt-1 text-xs opacity-80">
                                            {BANNER_TYPE_LABEL[activeAnnouncement.type]} · depuis le {formatDate(activeAnnouncement.createdAt)}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleClearBanner}
                                    disabled={bannerPending}
                                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-danger/20 bg-danger/10 px-2.5 py-1.5 text-xs text-danger transition-colors hover:bg-danger/20 disabled:opacity-50"
                                >
                                    <X className="h-3.5 w-3.5" aria-hidden />
                                    Couper la diffusion
                                </button>
                            </div>
                        </div>
                    )}

                    <textarea
                        value={bannerMessage}
                        onChange={(event) => setBannerMessage(event.target.value)}
                        placeholder="Écrivez le message qui apparaîtra sur tous les dashboards…"
                        className="h-28 w-full resize-none rounded-lg border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                        maxLength={200}
                    />

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-background p-1">
                            {(["info", "warning", "maintenance"] as const).map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setBannerType(type)}
                                    className={cn(
                                        "rounded-md border px-3 py-1.5 text-xs transition-colors",
                                        bannerType === type
                                            ? BANNER_TYPE_CLASS[type]
                                            : "border-transparent text-muted-foreground hover:text-foreground",
                                    )}
                                >
                                    {BANNER_TYPE_LABEL[type]}
                                </button>
                            ))}
                        </div>
                        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                            Durée
                            <select
                                value={bannerExpiry}
                                onChange={(event) => setBannerExpiry(Number(event.target.value))}
                                className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                            >
                                <option value={30}>30 min</option>
                                <option value={60}>1 h</option>
                                <option value={120}>2 h</option>
                                <option value={360}>6 h</option>
                                <option value={720}>12 h</option>
                                <option value={0}>Permanent</option>
                            </select>
                        </label>
                    </div>

                    <div className="rounded-lg border border-border bg-background p-3">
                        <p className="text-xs text-muted-foreground">Aperçu</p>
                        <div className="mt-2">
                            {bannerMessage ? (
                                <div className={cn("rounded-lg border p-3", BANNER_TYPE_CLASS[bannerType])}>
                                    <div className="flex items-center gap-2">
                                        <BannerIcon type={bannerType} className="h-4 w-4 shrink-0" />
                                        <p className="text-sm">{bannerMessage}</p>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">Tapez un message pour voir l&apos;aperçu…</p>
                            )}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleSetBanner}
                        disabled={bannerPending || !bannerMessage.trim()}
                        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {bannerPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Radio className="h-4 w-4" aria-hidden />}
                        Activer le bandeau
                    </button>
                    {bannerResult && <p className="text-sm text-muted-foreground" role="status">{bannerResult}</p>}
                </div>
            </section>
            <section className="rounded-xl border border-border bg-surface">
                <header className="flex items-center gap-2 border-b border-border px-4 py-3">
                    <Send className="h-4 w-4 text-accent" aria-hidden />
                    <div>
                        <h3 className="text-sm font-medium text-foreground">Broadcast Discord</h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            Message envoyé dans les salons d&apos;annonces des guildes.
                        </p>
                    </div>
                </header>
                <div className="space-y-4 p-4">
                    <textarea
                        value={discordMessage}
                        onChange={(event) => setDiscordMessage(event.target.value)}
                        placeholder="Le message sera envoyé sur tous les salons d'annonces des guildes…"
                        className="h-40 w-full resize-none rounded-lg border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                        maxLength={500}
                    />

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-background p-1">
                            {(["maintenance", "update", "info"] as const).map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setDiscordType(type)}
                                    className={cn(
                                        "rounded-md border px-3 py-1.5 text-xs transition-colors",
                                        discordType === type
                                            ? "border-accent/20 bg-accent-soft text-accent"
                                            : "border-transparent text-muted-foreground hover:text-foreground",
                                    )}
                                >
                                    {DISCORD_TYPE_LABEL[type]}
                                </button>
                            ))}
                        </div>
                        <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                            <input
                                type="checkbox"
                                checked={mentionEveryone}
                                onChange={() => setMentionEveryone((previous) => !previous)}
                                className="h-4 w-4 rounded border-border accent-accent"
                            />
                            @everyone
                        </label>
                    </div>

                    {stelliumChannels.length > 0 && (
                        <div className="rounded-lg border border-border bg-background p-3">
                            <label className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <Megaphone className="h-3.5 w-3.5" aria-hidden />
                                Cibleur de salon spécifique (guilde de développement)
                                <select
                                    value={stelliumChannelId}
                                    onChange={(event) => setStelliumChannelId(event.target.value)}
                                    className="ml-auto rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                                >
                                    <option value="">Toutes les guildes (salons d&apos;annonces configurés)</option>
                                    {stelliumChannels.map((channel) => (
                                        <option key={channel.id} value={channel.id}>
                                            # {channel.name ?? "Salon masqué"}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    )}

                    <div className="rounded-lg border border-border bg-background p-3">
                        <p className="text-xs text-muted-foreground">Aperçu</p>
                        <div className="mt-2 rounded-lg border-l-4 border-accent bg-surface p-3">
                            <p className="text-sm font-medium text-foreground">{DISCORD_TYPE_LABEL[discordType]}</p>
                            <div className="mt-1 break-words text-sm text-muted-foreground">
                                {discordMessage ? (
                                    <ReactMarkdown>{discordMessage}</ReactMarkdown>
                                ) : (
                                    "Le contenu du message apparaîtra ici…"
                                )}
                            </div>
                        </div>
                        {mentionEveryone && <p className="mt-2 text-xs text-muted-foreground">@everyone</p>}
                    </div>

                    <button
                        type="button"
                        onClick={handleBroadcast}
                        disabled={discordPending || !discordMessage.trim()}
                        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {discordPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
                        Envoyer globalement
                    </button>
                    {discordResult && <p className="text-sm text-muted-foreground" role="status">{discordResult}</p>}
                </div>
            </section>
        </div>
    );
}

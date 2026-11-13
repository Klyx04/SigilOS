"use client";

import { useState, useEffect } from "react";
import {
    AlertTriangle,
    Zap,
    UserMinus,
    Trash2,
    ShieldAlert,
    Info,
    Bell,
    Swords,
    Trophy,
    ShieldCheck,
    Store,
    ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { archiveProfile, handleGdprDeletionRequest } from "@/server/actions/lifecycle-actions";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { DiscordOwnershipModal } from "./discord-ownership-modal";
import { updateNotificationPrefs } from "@/server/actions/profile-actions";
import { PwaSettingsRow } from "@/components/pwa/PwaRegistration";
import {
    MARKET_NOTIFICATION_PREF_KEYS,
    MARKET_NOTIFICATION_PREF_LABELS,
    MARKET_NOTIFICATION_TYPES,
    type MarketNotificationPrefKey,
    type MarketNotificationPrefs,
} from "@/lib/market/notifications";
import { cn } from "@/lib/utils";

interface NotificationPrefs {
    missions: boolean;
    songes: boolean;
    donjons: boolean;
    events: boolean;
    ladder: boolean;
    paliers: boolean;
    objectifs: boolean;
    dofus: boolean;
    polls: boolean;
    admin_validations: boolean;
    ocre: boolean;
    /** §11.9 — Marché : un booléen **par type** (`market.<clé>`), défaut activé. */
    market?: MarketNotificationPrefs | null;
}

/**
 * §11.9 — normalise `notificationPrefs.market` : les huit types sont toujours
 * présents côté client, un `false` explicite étant le **seul** cas de coupure
 * (même règle que le serveur, `isMarketNotificationEnabled`).
 */
function buildMarketPrefs(prefs?: NotificationPrefs | null): Required<MarketNotificationPrefs> {
    const raw = prefs?.market ?? {};
    return MARKET_NOTIFICATION_TYPES.reduce((acc, type) => {
        const key = MARKET_NOTIFICATION_PREF_KEYS[type];
        acc[key] = raw[key] !== false;
        return acc;
    }, {} as Required<MarketNotificationPrefs>);
}

/* ── Groupes de notifications ─────────────────────────────────────────────── */

const GUILD_NOTIF_KEYS = ["missions", "songes", "donjons", "events", "objectifs", "polls", "ocre"] as const;
const PROGRESS_NOTIF_KEYS = ["ladder", "paliers", "dofus"] as const;

const NOTIF_LABELS: Record<string, string> = {
    missions: "Missions",
    songes: "Songes",
    donjons: "Donjons & Quêtes",
    events: "Événements",
    objectifs: "Objectifs de la semaine",
    polls: "Sondages",
    ocre: "Quête Ocre",
    ladder: "Succès & Ladder",
    paliers: "Paliers de points",
    dofus: "Dofus validés",
};

interface UserSettingsProps {
    guildId: string;
    guildName: string;
    profileId: string;
    notificationPrefs?: NotificationPrefs | null;
    onNotificationPrefsSave?: (prefs: any) => void;
    isAdmin: boolean;
    targetUserId?: string;
    showPresence: boolean;
    onPresenceToggle: (enabled: boolean) => void;
}

export function UserSettings({
    guildId,
    guildName,
    profileId,
    notificationPrefs,
    onNotificationPrefsSave,
    isAdmin,
    targetUserId,
    showPresence,
    onPresenceToggle
}: UserSettingsProps) {
    const [performanceMode, setPerformanceMode] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showOwnershipModal, setShowOwnershipModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const toggleExpand = (groupId: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupId)) next.delete(groupId);
            else next.add(groupId);
            return next;
        });
    };

    // Default values: true if not specified
    const prefs = {
        missions: notificationPrefs?.missions ?? true,
        songes: notificationPrefs?.songes ?? true,
        donjons: notificationPrefs?.donjons ?? true,
        events: notificationPrefs?.events ?? true,
        ladder: notificationPrefs?.ladder ?? true,
        paliers: notificationPrefs?.paliers ?? true,
        objectifs: notificationPrefs?.objectifs ?? true,
        dofus: notificationPrefs?.dofus ?? true,
        polls: notificationPrefs?.polls ?? true,
        admin_validations: notificationPrefs?.admin_validations ?? true,
        ocre: notificationPrefs?.ocre ?? true,
    };

    // §11.9 — Marché : un interrupteur par type, état local (UI optimiste).
    const [marketPrefs, setMarketPrefs] = useState<Required<MarketNotificationPrefs>>(
        () => buildMarketPrefs(notificationPrefs)
    );

    /**
     * Bascule un interrupteur Marché.
     */
    const handleMarketPrefChange = async (key: MarketNotificationPrefKey, checked: boolean) => {
        const previous = marketPrefs;
        const next = { ...marketPrefs, [key]: checked };

        setMarketPrefs(next);
        setLoading(true);
        onNotificationPrefsSave?.({ market: next });

        const res = await updateNotificationPrefs({
            guildId,
            prefs: { market: next },
            targetUserId
        });

        if (res.success) {
            toast.success("Préférences enregistrées");
        } else {
            toast.error(res.error || "Erreur");
            setMarketPrefs(previous);
            onNotificationPrefsSave?.({ market: previous });
        }
        setLoading(false);
    };

    const handleUpdatePrefs = async (newPrefs: Partial<NotificationPrefs>) => {
        setLoading(true);
        onNotificationPrefsSave?.(newPrefs);

        const res = await updateNotificationPrefs({
            guildId,
            prefs: { ...newPrefs, market: newPrefs.market ?? undefined },
            targetUserId
        });

        if (res.success) {
            toast.success("Préférences enregistrées");
        } else {
            toast.error(res.error || "Erreur");
            // Rollback on fail
            onNotificationPrefsSave?.(Object.fromEntries(
                Object.entries(newPrefs).map(([key, value]) => [key, !value])
            ));
        }
        setLoading(false);
    };

    /** Bascule toutes les prefs d'un groupe (guilde / progression). */
    const handleGroupToggle = async (keys: readonly string[], enabled: boolean) => {
        const newPrefs: Partial<NotificationPrefs> = {};
        for (const key of keys) {
            (newPrefs as any)[key] = enabled;
        }
        await handleUpdatePrefs(newPrefs);
    };

    /** Bascule tous les types du Marché d'un coup. */
    const handleMarketGroupToggle = async (enabled: boolean) => {
        const previous = marketPrefs;
        const next = MARKET_NOTIFICATION_TYPES.reduce((acc, type) => {
            acc[MARKET_NOTIFICATION_PREF_KEYS[type]] = enabled;
            return acc;
        }, {} as Required<MarketNotificationPrefs>);

        setMarketPrefs(next);
        setLoading(true);
        onNotificationPrefsSave?.({ market: next });

        const res = await updateNotificationPrefs({
            guildId,
            prefs: { market: next },
            targetUserId
        });

        if (res.success) {
            toast.success("Préférences enregistrées");
        } else {
            toast.error(res.error || "Erreur");
            setMarketPrefs(previous);
            onNotificationPrefsSave?.({ market: previous });
        }
        setLoading(false);
    };

    // Load performance mode from localStorage
    useEffect(() => {
        const saved = localStorage.getItem("sigilos-performance-mode") === "true";
        setPerformanceMode(saved);
        if (saved) document.documentElement.classList.add("reduce-motion");
    }, []);

    const togglePerformanceMode = (enabled: boolean) => {
        setPerformanceMode(enabled);
        localStorage.setItem("sigilos-performance-mode", String(enabled));

        if (enabled) {
            document.documentElement.classList.add("reduce-motion");
            toast.info("Mode Performance activé : Animations réduites.");
        } else {
            document.documentElement.classList.remove("reduce-motion");
            toast.info("Mode Performance désactivé.");
        }
    };

    const [archiveDuration, setArchiveDuration] = useState<number>(3);

    const handleLeaveGuild = async () => {
        setIsDeleting(true);
        try {
            const res = await archiveProfile(guildId, undefined, archiveDuration);
            if (res.success) {
                toast.success(`Profil archivé. Redirection...`);
                window.location.href = `/dashboard/${guildId}`;
            } else {
                toast.error(res.error || "Une erreur est survenue");
            }
        } catch (error) {
            toast.error("Erreur de communication avec le serveur");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeleteAccount = async () => {
        setIsDeleting(true);
        try {
            const res = await handleGdprDeletionRequest();
            if (res.success) {
                toast.success("Compte supprimé définitivement. Déconnexion...");
                await signOut({ redirect: false });
                window.location.href = "/";
            } else {
                const isOwnershipError = res.error?.toLowerCase().includes("proprié");
                if (isOwnershipError) {
                    setShowOwnershipModal(true);
                } else {
                    toast.error(res.error || "Une erreur est survenue");
                }
            }
        } catch (error) {
            toast.error("Erreur de communication avec le serveur");
        } finally {
            setIsDeleting(false);
        }
    };

    /* ── Helpers notation groupe ──────────────────────────────────────────── */
    const isGroupOn = (keys: readonly string[]) =>
        keys.some(k => prefs[k as keyof typeof prefs]);
    const isMarketOn = Object.values(marketPrefs).some(v => v);

    return (
        <div className="flex flex-col gap-8">
            {/* TOP ROW: Performance & Notifications */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* PERFORMANCE SECTION */}
                <div className="bg-surface/50 border border-border rounded-2xl p-6 space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-warning/10 rounded-xl">
                            <Zap className="w-5 h-5 text-warning" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-foreground">Interface & Performance</h3>
                            <p className="text-sm text-muted-foreground">Optimisez votre lecture</p>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-border">
                        <div className="flex items-center justify-between p-4 bg-surface rounded-xl border border-border group hover:border-warning/30 transition-all">
                            <div className="space-y-1">
                                <Label htmlFor="perf-mode" className="text-sm font-medium text-foreground group-hover:text-foreground transition-colors">
                                    Mode Performance
                                </Label>
                                <p className="text-caption text-muted-foreground leading-tight">
                                    Réduit les animations et flous.
                                </p>
                            </div>
                            <Switch
                                id="perf-mode"
                                checked={performanceMode}
                                onCheckedChange={togglePerformanceMode}
                            />
                        </div>

                        {/* Installation PWA */}
                        <PwaSettingsRow />

                        <div className="flex items-start gap-3 p-4 bg-info/5 rounded-xl border border-info/10">
                            <Info className="w-5 h-5 text-info mt-0.5" />
                            <p className="text-xs text-info/80 leading-relaxed">
                                Ce réglage est sauvegardé localement sur ce navigateur. Il n&apos;affecte pas votre profil sur d&apos;autres appareils.
                            </p>
                        </div>
                    </div>
                </div>

                {/* NOTIFICATIONS SECTION — groupé */}
                <div className="bg-surface/50 border border-border rounded-2xl p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-info/10 rounded-xl">
                            <Bell className="w-5 h-5 text-info" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-foreground">Notifications</h3>
                            <p className="text-sm text-muted-foreground">Choisissez ce qui vous intéresse</p>
                        </div>
                    </div>

                    <div className="space-y-2 pt-2">
                        {/* ── Groupe : Activité de guilde ──────────────────── */}
                        <div className="rounded-2xl border border-border bg-surface overflow-hidden">
                            <div className="flex items-center gap-3 p-3">
                                <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center shrink-0">
                                    <Swords className="w-4 h-4 text-info" />
                                </div>
                                <button
                                    type="button"
                                    className="flex-1 text-left min-w-0"
                                    onClick={() => toggleExpand("guild")}
                                >
                                    <p className="text-sm font-semibold text-foreground">Activité de guilde</p>
                                    <p className="text-caption text-muted-foreground truncate">Missions, songes, donjons, événements</p>
                                </button>
                                <Switch
                                    checked={isGroupOn(GUILD_NOTIF_KEYS)}
                                    onCheckedChange={(checked) => handleGroupToggle(GUILD_NOTIF_KEYS, checked)}
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                                    onClick={() => toggleExpand("guild")}
                                    aria-label="Personnaliser"
                                >
                                    <ChevronDown className={cn("w-4 h-4 transition-transform", expandedGroups.has("guild") && "rotate-180")} />
                                </button>
                            </div>
                            {expandedGroups.has("guild") && (
                                <div className="border-t border-border px-4 py-2 space-y-0.5">
                                    {GUILD_NOTIF_KEYS.map(key => (
                                        <div key={key} className="flex items-center justify-between py-1.5">
                                            <span className="text-sm text-muted-foreground">{NOTIF_LABELS[key]}</span>
                                            <Switch
                                                checked={prefs[key]}
                                                onCheckedChange={(checked) => handleUpdatePrefs({ [key]: checked })}
                                                disabled={loading}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ── Groupe : Classement & Succès ─────────────────── */}
                        <div className="rounded-2xl border border-border bg-surface overflow-hidden">
                            <div className="flex items-center gap-3 p-3">
                                <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                                    <Trophy className="w-4 h-4 text-success" />
                                </div>
                                <button
                                    type="button"
                                    className="flex-1 text-left min-w-0"
                                    onClick={() => toggleExpand("progress")}
                                >
                                    <p className="text-sm font-semibold text-foreground">Classement & Succès</p>
                                    <p className="text-caption text-muted-foreground truncate">Ladder, paliers, dofus validés</p>
                                </button>
                                <Switch
                                    checked={isGroupOn(PROGRESS_NOTIF_KEYS)}
                                    onCheckedChange={(checked) => handleGroupToggle(PROGRESS_NOTIF_KEYS, checked)}
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                                    onClick={() => toggleExpand("progress")}
                                    aria-label="Personnaliser"
                                >
                                    <ChevronDown className={cn("w-4 h-4 transition-transform", expandedGroups.has("progress") && "rotate-180")} />
                                </button>
                            </div>
                            {expandedGroups.has("progress") && (
                                <div className="border-t border-border px-4 py-2 space-y-0.5">
                                    {PROGRESS_NOTIF_KEYS.map(key => (
                                        <div key={key} className="flex items-center justify-between py-1.5">
                                            <span className="text-sm text-muted-foreground">{NOTIF_LABELS[key]}</span>
                                            <Switch
                                                checked={prefs[key]}
                                                onCheckedChange={(checked) => handleUpdatePrefs({ [key]: checked })}
                                                disabled={loading}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ── Groupe : Marché ──────────────────────────────── */}
                        <div className="rounded-2xl border border-border bg-surface overflow-hidden">
                            <div className="flex items-center gap-3 p-3">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                    <Store className="w-4 h-4 text-primary" />
                                </div>
                                <button
                                    type="button"
                                    className="flex-1 text-left min-w-0"
                                    onClick={() => toggleExpand("market")}
                                >
                                    <p className="text-sm font-semibold text-foreground">Marché</p>
                                    <p className="text-caption text-muted-foreground truncate">Offres, réservations, rappels</p>
                                </button>
                                <Switch
                                    checked={isMarketOn}
                                    onCheckedChange={handleMarketGroupToggle}
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                                    onClick={() => toggleExpand("market")}
                                    aria-label="Personnaliser"
                                >
                                    <ChevronDown className={cn("w-4 h-4 transition-transform", expandedGroups.has("market") && "rotate-180")} />
                                </button>
                            </div>
                            {expandedGroups.has("market") && (
                                <div className="border-t border-border px-4 py-2 space-y-0.5">
                                    {MARKET_NOTIFICATION_TYPES.map((type) => {
                                        const key = MARKET_NOTIFICATION_PREF_KEYS[type];
                                        const { label } = MARKET_NOTIFICATION_PREF_LABELS[key];
                                        return (
                                            <div key={key} className="flex items-center justify-between py-1.5">
                                                <span className="text-sm text-muted-foreground">{label}</span>
                                                <Switch
                                                    checked={marketPrefs[key]}
                                                    onCheckedChange={(checked) => handleMarketPrefChange(key, checked)}
                                                    disabled={loading}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* ── Admin (admin uniquement) ─────────────────────── */}
                        {isAdmin && (
                            <div className="rounded-2xl border border-border bg-surface overflow-hidden">
                                <div className="flex items-center gap-3 p-3">
                                    <div className="w-8 h-8 rounded-lg bg-muted/10 flex items-center justify-center shrink-0">
                                        <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-foreground">Alertes Admin</p>
                                        <p className="text-caption text-muted-foreground truncate">Missions en attente de validation</p>
                                    </div>
                                    <Switch
                                        checked={prefs.admin_validations}
                                        onCheckedChange={(checked) => handleUpdatePrefs({ admin_validations: checked })}
                                        disabled={loading}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── COMPTE & CONFIDENTIALITÉ (RGPD) ─────────────────────────────── */}
            <div className="bg-surface/50 border border-border rounded-2xl p-4 sm:p-6 lg:p-8 space-y-6">
                <div className="flex items-center gap-4 border-b border-border pb-5">
                    <div className="p-2.5 bg-danger/10 rounded-xl border border-danger/20">
                        <ShieldAlert className="w-5 h-5 text-danger" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-foreground">Compte & Confidentialité</h3>
                        <p className="text-sm text-muted-foreground">Gérez vos données personnelles (RGPD)</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-stretch">
                    {/* ARCHIVER — Réversible */}
                    <div className="flex flex-col p-5 sm:p-6 bg-surface/60 rounded-2xl border border-success/20 hover:border-success/40 transition-all">
                        <div className="flex-1 space-y-3">
                            <span className="text-caption font-black uppercase tracking-widest text-success bg-success/10 px-2.5 py-1 rounded-full border border-success/20">
                                Réversible
                            </span>
                            <h4 className="text-xl font-bold text-foreground">Archiver mon profil</h4>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Désactive votre profil sur <b className="text-foreground">{guildName}</b> uniquement.
                                Vos données (XP, missions, inventaire) restent intactes. Réactivation possible à tout moment.
                            </p>
                            <ul className="space-y-1.5 text-sm text-foreground">
                                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-success" /> Données conservées</li>
                                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-success" /> Autres guildes non affectées</li>
                                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-success" /> Réactivation sur demande</li>
                            </ul>
                        </div>

                        <div className="mt-6 pt-4 border-t border-border">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="sigil-destructive" className="w-full h-auto min-h-[3rem] py-2 whitespace-normal text-caption sm:text-xs md:text-sm gap-2 font-bold bg-surface hover:bg-success/20 text-foreground hover:text-success border border-border hover:border-success/50 transition-all flex items-center justify-center text-center">
                                        <UserMinus className="w-4 h-4 shrink-0" />
                                        ARCHIVER MON PROFIL SUR <span className="block sm:inline">{guildName.toUpperCase()}</span>
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-surface border-border text-foreground">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Archiver votre profil sur {guildName} ?</AlertDialogTitle>
                                        <AlertDialogDescription asChild>
                                            <div className="text-muted-foreground space-y-3">
                                                <p>Votre profil de guilde sera <b className="text-foreground">archivé</b>, pas supprimé.</p>
                                                <div className="bg-elevated/50 rounded-xl p-3 space-y-1.5 text-xs">
                                                    <p className="flex items-center gap-2"><span className="text-success">&#10003;</span> XP et données conservées</p>
                                                    <p className="flex items-center gap-2"><span className="text-success">&#10003;</span> Rejoindre à tout moment via Discord</p>
                                                    <p className="flex items-center gap-2"><span className="text-warning">!</span> Accès au tableau de bord de cette guilde suspendu</p>
                                                    <p className="flex items-center gap-2"><span className="text-info">i</span> Autres guildes non affectées</p>
                                                </div>
                                                <div className="pt-2 space-y-2">
                                                    <p className="text-xs font-bold text-foreground">Durée d&apos;archivage :</p>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        {[3, 6, 12].map(duration => (
                                                            <button
                                                                key={duration}
                                                                type="button"
                                                                onClick={() => setArchiveDuration(duration)}
                                                                className={`p-2 rounded-xl text-xs font-bold transition-all border ${
                                                                    archiveDuration === duration
                                                                        ? "bg-success/20 text-success border-success/50 ring-1 ring-success/30"
                                                                        : "bg-elevated/50 text-muted-foreground border-border hover:bg-surface"
                                                                }`}
                                                            >
                                                                {duration} Mois
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel className="bg-transparent border-border">Annuler</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={handleLeaveGuild}
                                            disabled={isDeleting}
                                            variant="sigil-destructive"
                                            className="h-10 px-6"
                                        >
                                            Confirmer l&apos;archivage
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>

                    {/* SUPPRIMER — Irréversible */}
                    <div className="flex flex-col p-5 sm:p-6 bg-black/60 rounded-2xl border border-danger/30 hover:border-danger/60 transition-all">
                        <div className="flex-1 space-y-3">
                            <span className="text-caption font-black uppercase tracking-widest text-danger bg-danger/10 px-2.5 py-1 rounded-full border border-danger/20 inline-flex items-center gap-1.5">
                                <AlertTriangle className="w-3 h-3" />
                                Irréversible
                            </span>
                            <h4 className="text-xl font-bold text-foreground">Suppression définitive</h4>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Efface <b className="text-danger">définitivement</b> votre compte SigilOS et toutes vos données,
                                sur <b className="text-danger">toutes les guildes</b>. Aucun retour possible.
                            </p>
                            <ul className="space-y-1.5 text-sm text-foreground">
                                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-danger" /> Effacement sur toutes les guildes</li>
                                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-danger" /> XP, succès, inventaire : perdus</li>
                                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-danger" /> Irréversible (droit à l&apos;oubli RGPD)</li>
                            </ul>
                        </div>

                        <div className="mt-6 pt-4 border-t border-danger/10">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="sigil-destructive" className="w-full h-auto min-h-[3rem] py-2 whitespace-normal text-caption sm:text-xs md:text-sm gap-2 font-bold bg-danger/10 hover:bg-danger text-danger hover:text-danger-foreground border border-danger/30 transition-all flex items-center justify-center text-center">
                                        <Trash2 className="w-4 h-4 shrink-0" />
                                        SUPPRIMER MON COMPTE SIGILOS
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-surface border-danger/20 text-foreground">
                                    <AlertDialogHeader>
                                        <div className="p-3 bg-danger/10 rounded-full w-fit mx-auto mb-4 border border-danger/20">
                                            <AlertTriangle className="w-8 h-8 text-danger" />
                                        </div>
                                        <AlertDialogTitle className="text-center text-xl">Droit à l&apos;oubli total (RGPD)</AlertDialogTitle>
                                        <AlertDialogDescription asChild>
                                            <div className="text-muted-foreground text-center space-y-3">
                                                <p>
                                                    Suppression <b className="text-danger">définitive</b> de votre identité SigilOS globale.
                                                </p>
                                                <div className="bg-black/50 rounded-xl p-4 space-y-2 text-xs text-left border border-danger/20 shadow-inner">
                                                    <p className="flex items-center gap-2"><span className="text-danger border border-danger/20 bg-danger/10 rounded p-0.5">X</span> Effacement sur <b className="text-foreground">toutes</b> vos guildes</p>
                                                    <p className="flex items-center gap-2"><span className="text-danger border border-danger/20 bg-danger/10 rounded p-0.5">X</span> XP, inventaires, succès : détruits</p>
                                                    <p className="flex items-center gap-2"><span className="text-danger border border-danger/20 bg-danger/10 rounded p-0.5">X</span> Irrécupérable, même par le support</p>
                                                </div>
                                                <p className="text-caption text-muted-foreground pt-2 italic">
                                                    Pour une simple pause sur une guilde, utilisez l&apos;archivage à la place.
                                                </p>
                                            </div>
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="sm:justify-center gap-3">
                                        <AlertDialogCancel className="bg-elevated text-foreground border-border hover:bg-muted sm:w-32">Annuler</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={handleDeleteAccount}
                                            disabled={isDeleting}
                                            variant="sigil-destructive"
                                            className="h-10 px-8 bg-danger hover:bg-danger font-bold "
                                        >
                                            OUI, TOUT SUPPRIMER
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>
                </div>
            </div>

            <DiscordOwnershipModal
                isOpen={showOwnershipModal}
                onClose={() => setShowOwnershipModal(false)}
                guildName={guildName}
            />
        </div>
    );
}

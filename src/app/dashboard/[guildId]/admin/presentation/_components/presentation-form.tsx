"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { UnsavedChangesGuard, isDirty } from "@/components/ui/unsaved-changes-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    getAdminPresentationData,
    updateGuildPresentation,
    uploadPresentationImage,
    deletePresentationImage,
    getDiscordMembersForSelection,
    type PresentationUpdateData,
    type DiscordMemberOption,
} from "@/server/actions/presentation-actions";
import {
    DOFUS_UNITY_SERVERS,
    AVAILABLE_ACTIVITIES,
    ACTIVITY_ASSETS,
    FOUNDER_CROWN_ASSET,
    MANIFESTO_ASSET,
    GUILD_BLASON_ASSET,
} from "@/lib/presentation-constants";
import { getDofusServerImage } from "@/lib/dofus-assets";
import {
    Upload,
    X,
    ExternalLink,
    Loader2,
    Crown,
    Shield,
    Gamepad2,
    MessageCircle,
    Check,
    Star,
    UserPlus,
    Users,
    Image as ImageIcon,
    AlertCircle,
    ArrowLeft,
    ArrowRight,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { MemberSelector } from "./member-selector";

type Props = {
    guildId: string;
};

// Validation helpers
const DISCORD_URL_REGEX = /^https?:\/\/(discord\.gg|discord\.com\/invite)\/[\w-]+$/;

// Only block HTML injection - allow all other characters
const validatePseudo = (value: string): boolean => {
    if (!value) return true; // Empty is ok (optional)
    // Block HTML special chars only
    return !/[<>"'&]/.test(value);
};

const validateDiscordUrl = (value: string): boolean => {
    if (!value) return true;
    return DISCORD_URL_REGEX.test(value);
};

// Calculate completeness score
const calculateCompleteness = (
    bannerUrl: string | null,
    photoUrl: string | null,
    history: string,
    founder: string,
    coLeaders: string[],
    brasDroits: string[],
    activities: string[],
    recruiting: boolean,
    recruitmentRequirements: string,
    discord: string
) => {
    return Math.round(
        (bannerUrl ? 20 : 0) +
        (photoUrl ? 20 : 0) +
        (history.length > 50 ? 20 : 0) +
        ((founder || coLeaders.some(c => c.trim()) || brasDroits.some(b => b.trim())) ? 10 : 0) +
        (activities.length > 0 ? 10 : 0) +
        ((recruitmentRequirements || recruiting) ? 10 : 0) +
        (discord ? 10 : 0)
    );
};

// Sanitize history text (remove URLs)
const sanitizeHistoryText = (text: string): string => {
    // Remove URLs
    return text.replace(/https?:\/\/[^\s]+/gi, "[lien supprimé]");
};

// ── Rédaction en étapes : un cap à la fois, pas cinq onglets interchangeables ──
const STEPS = [
    { id: "roots", label: "Fondations", hint: "Serveur, fondation, porte Discord" },
    { id: "staff", label: "État-major", hint: "Meneur, co-leaders, bras droits" },
    { id: "tale", label: "Récit", hint: "Manifeste et chasses de la guilde" },
    { id: "images", label: "Étendards", hint: "Bannière et photo de guilde" },
    { id: "recruit", label: "Recrutement", hint: "Statut, seuils, pré-requis" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

// Bouton de choix de serveur avec sa vignette officielle (assets du jeu).
// Sélection = trait net + check, jamais de fond teinté.
const ServerPickButton = ({ name, selected, onPick }: {
    name: string;
    selected: boolean;
    onPick: () => void;
}) => {
    const img = getDofusServerImage(name);
    return (
        <button
            type="button"
            onClick={onPick}
            aria-pressed={selected}
            className={cn(
                "flex min-w-0 items-center gap-3 rounded-md border px-3 py-2.5 text-left text-sm font-medium transition-colors",
                selected
                    ? "border-border-strong bg-surface text-foreground"
                    : "border-border bg-transparent text-muted-foreground hover:border-border-strong hover:text-foreground"
            )}
        >
            {img && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={img}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="h-12 w-12 shrink-0 rounded-md border border-black/30 object-cover"
                />
            )}
            <span className="min-w-0 flex-1 truncate">{name}</span>
            {selected && <Check className="h-4 w-4 shrink-0 text-foreground" aria-hidden="true" />}
        </button>
    );
};

function StepHeading({ eyebrow, title, desc, asset }: { eyebrow: string; title: string; desc: string; asset?: string }) {
    return (
        <div className="flex items-start gap-4">
            {asset && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={asset}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="h-11 w-11 shrink-0 rounded-md border border-border bg-surface object-contain p-1"
                />
            )}
            <div className="min-w-0">
                <p className="reg-eyebrow">{eyebrow}</p>
                <h3 className="mt-1 text-lg font-bold tracking-tight">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </div>
        </div>
    );
}

export function PresentationForm({ guildId }: Props) {
    const [isPending, startTransition] = useTransition();
    const [isLoading, setIsLoading] = useState(true);
    const [members, setMembers] = useState<DiscordMemberOption[]>([]);
    const [stepIndex, setStepIndex] = useState(0);

    // Form state
    const [enabled, setEnabled] = useState(false);
    const [history, setHistory] = useState("");
    const [activities, setActivities] = useState<string[]>([]);
    const [founder, setFounder] = useState("");
    const [coLeaders, setCoLeaders] = useState<string[]>([]); // Max 3
    const [brasDroits, setBrasDroits] = useState<string[]>([]); // Max 10
    const [discord, setDiscord] = useState("");
    const [recruiting, setRecruiting] = useState(false);
    const [recruitmentRequirements, setRecruitmentRequirements] = useState("");
    const [server, setServer] = useState("");
    // `true` quand le serveur affiché est hérité de la config guilde
    // (l'admin n'a jamais fait de choix présentation explicite).
    const [serverInherited, setServerInherited] = useState(false);
    const [bannerType, setBannerType] = useState<"discord" | "custom">("discord");
    const [bannerUrl, setBannerUrl] = useState<string | null>(null);
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const [foundedDate, setFoundedDate] = useState<Date | null>(null);
    const [memberCount, setMemberCount] = useState<string>("");
    const [discordRequired, setDiscordRequired] = useState(false);
    const [minLevel, setMinLevel] = useState<string>("");
    const [minSuccesses, setMinSuccesses] = useState<string>("");

    // Validation errors
    const [errors, setErrors] = useState<Record<string, string>>({});

    // #228 — Snapshot initial (données chargées) → détection « sale ».
    const [initialSnapshot, setInitialSnapshot] = useState<any>(null);

    const currentState = () => ({
        enabled, history, activities, founder, coLeaders, brasDroits, discord, recruiting,
        recruitmentRequirements, server, bannerType, bannerUrl, photoUrl, foundedDate,
        discordRequired, minLevel, minSuccesses, memberCount,
    });
    const dirty = isDirty(currentState(), initialSnapshot);

    // Load initial data
    useEffect(() => {
        async function loadData() {
            const [dataResult, membersResult] = await Promise.all([
                getAdminPresentationData(guildId),
                getDiscordMembersForSelection(guildId),
            ]);

            if (dataResult.success && dataResult.data) {
                const d = dataResult.data;
                setEnabled(d.enabled);
                setHistory(d.history || "");
                setActivities(d.activities || []);
                setFounder(d.founder || "");
                // Initialize brasDroits from team data
                const existingTeam = d.team || [];
                setCoLeaders(d.coLeaders || []);
                setBrasDroits(existingTeam);
                setDiscord(d.discord || "");
                setRecruiting(d.recruiting);
                setRecruitmentRequirements(d.recruitmentRequirements || "");
                setServer(d.server || "");
                setServerInherited(!d.serverExplicit && !!d.guildServerName);
                setBannerType(d.bannerType || "discord");
                setBannerUrl(d.bannerUrl);
                setPhotoUrl(d.photoUrl);
                setFoundedDate(d.foundedDate);
                setDiscordRequired(d.discordRequired);
                setMinLevel(d.minLevel?.toString() || "");
                setMinSuccesses(d.minSuccesses?.toString() || "");
                setMemberCount(d.memberCount?.toString() || "");

                // #228 — Snapshot de référence pour la garde anti-navigation.
                setInitialSnapshot({
                    enabled: d.enabled, history: d.history || "", activities: d.activities || [],
                    founder: d.founder || "", coLeaders: d.coLeaders || [], brasDroits: d.team || [],
                    discord: d.discord || "", recruiting: d.recruiting, recruitmentRequirements: d.recruitmentRequirements || "",
                    server: d.server || "", bannerType: d.bannerType || "discord", bannerUrl: d.bannerUrl,
                    photoUrl: d.photoUrl, foundedDate: d.foundedDate, discordRequired: d.discordRequired,
                    minLevel: d.minLevel?.toString() || "", minSuccesses: d.minSuccesses?.toString() || "",
                    memberCount: d.memberCount?.toString() || "",
                });
            }

            if (membersResult.success && membersResult.members) {
                setMembers(membersResult.members);
            }

            setIsLoading(false);
        }

        loadData();
    }, [guildId]);

    // Handle form submission
    const handleSubmit = () => {
        // Validate before submit
        const newErrors: Record<string, string> = {};

        if (founder && !validatePseudo(founder)) {
            newErrors.founder = "Format invalide";
        }
        coLeaders.forEach((cl, i) => {
            if (cl && !validatePseudo(cl)) {
                newErrors[`coLeader${i}`] = "Format invalide";
            }
        });
        brasDroits.forEach((bd, i) => {
            if (bd && !validatePseudo(bd)) {
                newErrors[`brasDroit${i}`] = "Format invalide";
            }
        });
        if (discord && !validateDiscordUrl(discord)) {
            newErrors.discord = "Lien invalide";
        }
        if (minLevel) {
            const num = parseInt(minLevel, 10);
            if (isNaN(num) || num < 0 || num > 200) {
                newErrors.minLevel = "0-200 requis";
            }
        }
        if (minSuccesses) {
            const num = parseInt(minSuccesses, 10);
            if (isNaN(num) || num < 0 || num > 25000) {
                newErrors.minSuccesses = "0-25000 requis";
            }
        }

        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) {
            toast.error("Veuillez corriger les erreurs");
            return;
        }

        startTransition(async () => {
            const data: PresentationUpdateData = {
                enabled,
                history: sanitizeHistoryText(history) || null,
                activities,
                founder: founder || null,
                coLeaders: coLeaders.filter(cl => cl.trim().length > 0), // Filter out empty strings
                team: brasDroits.filter(b => b.trim().length > 0), // Filter out empty strings
                discord: discord || null,
                recruiting,
                recruitmentRequirements: recruitmentRequirements || null,
                server: server || null,
                bannerType,
                bannerUrl,
                photoUrl,
                discordRequired,
                minLevel: minLevel ? parseInt(minLevel, 10) : null,
                minSuccesses: minSuccesses ? parseInt(minSuccesses, 10) : null,
                foundedDate,
                memberCount: memberCount ? parseInt(memberCount, 10) : null,
            };

            const result = await updateGuildPresentation(guildId, data);

            if (result.success) {
                toast.success("Présentation mise à jour");
                // La sauvegarde devient la nouvelle référence → plus rien de « sale ».
                setInitialSnapshot(currentState());
            } else {
                toast.error(result.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    // Handle image upload
    const handleImageUpload = async (
        e: React.ChangeEvent<HTMLInputElement>,
        type: "banner" | "photo"
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // 🛡️ NSFW Safety Check
        const { analyzeImageSafety } = await import("@/lib/safety-client");
        const safety = await analyzeImageSafety(file);
        if (!safety.isSafe) {
            toast.error(safety.reason || "Contenu inapproprié détecté. L'image a été bloquée.");
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        startTransition(async () => {
            try {
                // Dynamic import
                const { compressImage } = await import("@/lib/image-compression");

                // Compress image
                const compressedDataUrl = await compressImage(file, {
                    maxWidth: 1920,
                    maxHeight: 1080,
                    quality: 0.8
                });

                // Convert Data URL to Blob manually (avoiding fetch entirely)
                const arr = compressedDataUrl.split(',');
                const mime = arr[0].match(/:(.*?);/)?.[1] || "image/webp";
                const bstr = atob(arr[1]);
                let n = bstr.length;
                const u8arr = new Uint8Array(n);
                while (n--) {
                    u8arr[n] = bstr.charCodeAt(n);
                }

                // Create a proper File object
                const filename = file.name.replace(/\.[^/.]+$/, "") + ".webp";
                const compressedFile = new File([u8arr], filename, { type: mime });

                // Create new FormData with compressed file
                const compressedFormData = new FormData();
                compressedFormData.append("file", compressedFile);

                const result = await uploadPresentationImage(guildId, compressedFormData, type);

                if (result.success && result.url) {
                    if (type === "banner") {
                        setBannerUrl(result.url);
                        setBannerType("custom");
                    } else {
                        setPhotoUrl(result.url);
                    }
                    toast.success("Image compressée et uploadée avec succès");
                } else {
                    console.error("Upload failed:", result.error);
                    toast.error(result.error || "Erreur lors de l'upload");
                }
            } catch (error) {
                console.error("Upload process error:", error);

                // More detailed error message
                let message = "Erreur lors du traitement de l'image";
                if (error instanceof Error) {
                    message += `: ${error.message}`;
                }
                toast.error(message);
            }
        });
    };

    // Handle image deletion - deletes file from disk and updates database
    const handleDeleteImage = (type: "banner" | "photo") => {
        // Update local state immediately
        if (type === "banner") {
            setBannerUrl(null);
        } else {
            setPhotoUrl(null);
        }

        // Call server action to delete file and update database
        startTransition(async () => {
            const result = await deletePresentationImage(guildId, type);

            if (result.success) {
                toast.success("Image supprimée");
            } else {
                toast.error(result.error || "Erreur lors de la suppression");
            }
        });
    };

    // Toggle activity
    const toggleActivity = (activityId: string) => {
        setActivities((prev) =>
            prev.includes(activityId)
                ? prev.filter((a) => a !== activityId)
                : [...prev, activityId]
        );
    };

    // Update bras droit
    const updateBrasDroit = (index: number, value: string) => {
        const newBrasDroits = [...brasDroits];
        newBrasDroits[index] = value;
        setBrasDroits(newBrasDroits);
    };

    // Update co-leader
    const updateCoLeader = (index: number, value: string) => {
        const newCoLeaders = [...coLeaders];
        newCoLeaders[index] = value;
        setCoLeaders(newCoLeaders);
        // Clear error on change
        if (errors[`coLeader${index}`]) {
            setErrors(prev => {
                const n = { ...prev };
                delete n[`coLeader${index}`];
                return n;
            });
        }
    };


    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const completeness = calculateCompleteness(
        bannerUrl, photoUrl, history, founder, coLeaders, brasDroits, activities, recruiting, recruitmentRequirements, discord
    );
    const step: StepId = STEPS[stepIndex].id;
    const isLast = stepIndex === STEPS.length - 1;

    const goNext = () => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
    const goPrev = () => setStepIndex((i) => Math.max(i - 1, 0));

    const serverGroups: { label: string; icon: React.ElementType; names: readonly { name: string }[] }[] = [
        { label: "Serveurs Épiques", icon: Shield, names: DOFUS_UNITY_SERVERS.epique },
        { label: "Serveurs Monocompte", icon: Crown, names: DOFUS_UNITY_SERVERS.monocompte },
        { label: "Serveurs Classiques", icon: Gamepad2, names: DOFUS_UNITY_SERVERS.classique },
        { label: "Serveurs Pionniers Monocompte", icon: Star, names: DOFUS_UNITY_SERVERS.pionnierMono },
        { label: "Serveurs Pionniers", icon: Users, names: DOFUS_UNITY_SERVERS.pionnier },
    ];

    return (
        <div className="registre space-y-6">
            {/* Chapeau : avancement + visibilité, une seule ligne chacun. */}
            <div className="reg-panel p-6">
                <div className="flex items-center justify-between gap-4">
                    <p className="reg-eyebrow">Rédaction de la page</p>
                    <p className="reg-mono text-sm font-semibold">{completeness} %</p>
                </div>
                <div className="reg-progress mt-3" role="progressbar" aria-valuenow={completeness} aria-valuemin={0} aria-valuemax={100}>
                    <span style={{ width: `${completeness}%` }} />
                </div>
                {completeness < 100 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                        Il manque {
                            !bannerUrl ? "un étendard" :
                                !photoUrl ? "une photo de guilde" :
                                    history.length <= 50 ? "un récit plus fourni" :
                                        "quelques détails"
                        } avant une page complète.
                    </p>
                )}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
                    <div>
                        <p className="text-sm font-semibold">Visible dans l&apos;annuaire</p>
                        <p className="text-xs text-muted-foreground">La page publique suit exactement cette rédaction.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link
                            href={`/guilds/${guildId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="reg-link-quiet inline-flex items-center gap-1.5 text-sm"
                        >
                            Voir la page publique
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                        <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Visible dans l'annuaire" />
                    </div>
                </div>
            </div>

            {/* Étapes : où on est, ce qui reste. */}
            <nav aria-label="Étapes de rédaction">
                <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {STEPS.map((s, i) => {
                        const active = i === stepIndex;
                        const done = i < stepIndex;
                        return (
                            <li key={s.id}>
                                <button
                                    type="button"
                                    onClick={() => setStepIndex(i)}
                                    aria-current={active ? "step" : undefined}
                                    className={cn(
                                        "w-full rounded-md border px-3 py-2.5 text-left transition-colors",
                                        active
                                            ? "border-border-strong bg-surface"
                                            : "border-border bg-transparent hover:border-border-strong"
                                    )}
                                >
                                    <span className="flex items-center gap-2">
                                        <span className={cn(
                                            "reg-mono text-xs font-bold",
                                            active || done ? "text-foreground" : "text-muted-foreground"
                                        )}>
                                            {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : `0${i + 1}`}
                                        </span>
                                        <span className={cn(
                                            "text-sm font-bold",
                                            active || done ? "text-foreground" : "text-muted-foreground"
                                        )}>
                                            {s.label}
                                        </span>
                                    </span>
                                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{s.hint}</span>
                                </button>
                            </li>
                        );
                    })}
                </ol>
            </nav>

            {/* Contenu de l'étape courante. */}
            <div className="reg-panel p-6 md:p-8">
                {step === "roots" && (
                    <div className="space-y-8">
                        <StepHeading
                            eyebrow="Étape 1 sur 5 · Fondations"
                            title="D'où parle la guilde"
                            desc="Le serveur et la date ancrent la page dans le monde ; le lien Discord est la porte d'entrée des recrues."
                            asset="/assets/dofus/icons/zaap.png"
                        />

                        <div className="space-y-4">
                            <p className="text-sm font-semibold">Serveur Dofus Unity</p>
                            {serverGroups.map((group) => (
                                <div key={group.label}>
                                    <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        <group.icon className="h-3.5 w-3.5" aria-hidden="true" />
                                        {group.label}
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                                        {group.names.map((s) => (
                                            <ServerPickButton
                                                key={s.name}
                                                name={s.name}
                                                selected={server === s.name}
                                                onPick={() => { setServer(s.name); setServerInherited(false); }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {server && (
                                <div className="flex items-center justify-between pt-1">
                                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                        Serveur retenu :
                                        {getDofusServerImage(server) && (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={getDofusServerImage(server)!}
                                                alt=""
                                                loading="lazy"
                                                decoding="async"
                                                draggable={false}
                                                className="h-10 w-10 rounded-md border border-black/30 object-cover"
                                            />
                                        )}
                                        <span className="font-medium text-foreground">{server}</span>
                                        {serverInherited && (
                                            <span className="text-xs text-muted-foreground">· hérité de la config guilde</span>
                                        )}
                                    </p>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => { setServer(""); setServerInherited(false); }}
                                        className="text-muted-foreground hover:text-foreground"
                                    >
                                        <X className="mr-1 h-4 w-4" />
                                        Effacer
                                    </Button>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 gap-6 border-t border-border pt-6 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Date de fondation</Label>
                                <p className="text-xs text-muted-foreground">Sert à calculer l&apos;ancienneté affichée.</p>
                                <Input
                                    type="date"
                                    value={foundedDate ? foundedDate.toISOString().split('T')[0] : ""}
                                    onChange={(e) => setFoundedDate(e.target.value ? new Date(e.target.value) : null)}
                                    className="bg-transparent"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Lien Discord</Label>
                                <Input
                                    value={discord}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === "" || /^https?:\/\/[a-zA-Z0-9./-]*$/.test(val)) {
                                            setDiscord(val);
                                            if (errors.discord) {
                                                setErrors(prev => {
                                                    const n = { ...prev };
                                                    delete n.discord;
                                                    return n;
                                                });
                                            }
                                        }
                                    }}
                                    onBlur={() => {
                                        if (discord && !validateDiscordUrl(discord)) {
                                            setErrors(prev => ({ ...prev, discord: "Lien invalide" }));
                                        }
                                    }}
                                    placeholder="https://discord.gg/votre-invite"
                                    className={cn(errors.discord && "border-danger/50")}
                                />
                                {errors.discord ? (
                                    <p className="flex items-center gap-1 text-xs text-danger">
                                        <AlertCircle className="h-3 w-3" />
                                        {errors.discord}
                                    </p>
                                ) : (
                                    <p className="text-xs text-muted-foreground">Format : discord.gg/xxx ou discord.com/invite/xxx</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {step === "staff" && (
                    <div className="space-y-8">
                        <StepHeading
                            eyebrow="Étape 2 sur 5 · État-major"
                            title="Qui tient la barre"
                            desc="Un meneur nommé rassure ; le reste de l'équipage se complète au fil des nominations."
                            asset={GUILD_BLASON_ASSET}
                        />

                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={FOUNDER_CROWN_ASSET} alt="" loading="lazy" decoding="async" draggable={false} className="h-5 w-5 object-contain" />
                                Meneur de guilde
                            </Label>
                            <MemberSelector
                                value={founder}
                                onChange={(val) => {
                                    setFounder(val);
                                    if (errors.founder) {
                                        setErrors(prev => {
                                            const n = { ...prev };
                                            delete n.founder;
                                            return n;
                                        });
                                    }
                                }}
                                members={members}
                                placeholder="Rechercher le meneur..."
                                error={!!errors.founder}
                            />
                            {errors.founder && (
                                <p className="mt-2 flex items-center gap-1 text-xs text-danger">
                                    <AlertCircle className="h-3 w-3" />
                                    {errors.founder}
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-1 gap-6 border-t border-border pt-6 lg:grid-cols-2">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="flex items-center gap-2 text-sm font-semibold">
                                        <Star className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                                        Co-leaders
                                    </p>
                                    <span className="reg-mono text-xs text-muted-foreground">
                                        {coLeaders.filter(c => c.trim()).length}/3
                                    </span>
                                </div>
                                <div className="space-y-2">
                                    {coLeaders.map((cl, i) => (
                                        <div key={i} className="group flex items-center gap-2 rounded-md border border-border p-1.5">
                                            <div className="min-w-0 flex-1">
                                                <MemberSelector
                                                    value={cl}
                                                    onChange={(val) => updateCoLeader(i, val)}
                                                    members={members}
                                                    placeholder={`Co-leader ${i + 1}`}
                                                    error={!!errors[`coLeader${i}`]}
                                                    className="border-0 bg-transparent px-2 focus:ring-0"
                                                />
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-muted-foreground opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                                                onClick={() => setCoLeaders(coLeaders.filter((_, index) => index !== i))}
                                                aria-label="Retirer ce co-leader"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    ))}
                                    {coLeaders.length < 3 && (
                                        <Button
                                            variant="outline"
                                            onClick={() => setCoLeaders([...coLeaders, ""])}
                                            className="min-h-[44px] w-full border-dashed bg-transparent text-muted-foreground hover:text-foreground"
                                        >
                                            <UserPlus className="mr-2 h-4 w-4" />
                                            Ajouter un co-leader
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="flex items-center gap-2 text-sm font-semibold">
                                        <Shield className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                                        Bras droits
                                    </p>
                                    <span className="reg-mono text-xs text-muted-foreground">
                                        {brasDroits.filter(b => b.trim()).length}/10
                                    </span>
                                </div>
                                <div className="space-y-2">
                                    {brasDroits.map((bd, i) => (
                                        <div key={i} className="group flex items-center gap-2 rounded-md border border-border p-1.5">
                                            <div className="min-w-0 flex-1">
                                                <MemberSelector
                                                    value={bd}
                                                    onChange={(val) => updateBrasDroit(i, val)}
                                                    members={members}
                                                    placeholder={`Bras droit ${i + 1}`}
                                                    error={!!errors[`brasDroit${i}`]}
                                                    className="border-0 bg-transparent px-2 focus:ring-0"
                                                />
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-muted-foreground opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                                                onClick={() => setBrasDroits(brasDroits.filter((_, index) => index !== i))}
                                                aria-label="Retirer ce bras droit"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    ))}
                                    {brasDroits.length < 10 && (
                                        <Button
                                            variant="outline"
                                            onClick={() => setBrasDroits([...brasDroits, ""])}
                                            className="min-h-[44px] w-full border-dashed bg-transparent text-muted-foreground hover:text-foreground"
                                        >
                                            <UserPlus className="mr-2 h-4 w-4" />
                                            Ajouter un bras droit
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {step === "tale" && (
                    <div className="space-y-8">
                        <StepHeading
                            eyebrow="Étape 3 sur 5 · Récit"
                            title="Ce que la guilde raconte"
                            desc="Trois phrases d'origine valent mieux qu'une page vide. Les liens sont retirés à l'enregistrement."
                            asset={MANIFESTO_ASSET}
                        />
                        <div className="space-y-2">
                            <Label>Manifeste</Label>
                            <Textarea
                                value={history}
                                onChange={(e) => setHistory(e.target.value)}
                                onBlur={() => setHistory(sanitizeHistoryText(history))}
                                placeholder="D'où vient la guilde, ce qu'elle cherche, ce qu'elle refuse..."
                                rows={8}
                                maxLength={5000}
                                className="bg-transparent"
                            />
                            <p className="reg-mono text-xs text-muted-foreground">{history.length}/5000</p>
                        </div>
                        <div className="space-y-3 border-t border-border pt-6">
                            <p className="text-sm font-semibold">Chasses de la guilde</p>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {AVAILABLE_ACTIVITIES.map((activity) => {
                                    const selected = activities.includes(activity.id);
                                    return (
                                        <button
                                            key={activity.id}
                                            type="button"
                                            onClick={() => toggleActivity(activity.id)}
                                            aria-pressed={selected}
                                            className={cn(
                                                "rounded-md border p-4 text-left transition-colors",
                                                selected
                                                    ? "border-border-strong bg-surface"
                                                    : "border-border bg-transparent hover:border-border-strong"
                                            )}
                                        >
                                            <span className="flex items-center gap-3">
                                                {ACTIVITY_ASSETS[activity.id] && (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={ACTIVITY_ASSETS[activity.id]}
                                                        alt=""
                                                        loading="lazy"
                                                        decoding="async"
                                                        draggable={false}
                                                        className="h-10 w-10 shrink-0 rounded-md border border-border bg-surface object-contain p-1"
                                                    />
                                                )}
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate font-semibold text-foreground">
                                                        {activity.label}
                                                    </span>
                                                    {activity.subtitle && (
                                                        <span className="mt-0.5 block text-xs text-muted-foreground">{activity.subtitle}</span>
                                                    )}
                                                </span>
                                                {selected && <Check className="h-4 w-4 shrink-0 text-foreground" aria-hidden="true" />}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {step === "images" && (
                    <div className="space-y-8">
                        <StepHeading
                            eyebrow="Étape 4 sur 5 · Étendards"
                            title="À quoi ressemble la guilde"
                            desc="Un étendard net fait la moitié de l'accueil. Les deux visuels sont facultatifs."
                            asset="/assets/dofus/modules/bannerBlason.png"
                        />
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Étendard</Label>
                                    <span className="text-xs text-muted-foreground">16:9 recommandé</span>
                                </div>
                                <div className="flex gap-4">
                                    <label className="flex cursor-pointer items-center gap-2">
                                        <input
                                            type="radio"
                                            name="bannerType"
                                            checked={bannerType === "discord"}
                                            onChange={() => setBannerType("discord")}
                                        />
                                        <span className="text-sm">Sans étendard</span>
                                    </label>
                                    <label className="flex cursor-pointer items-center gap-2">
                                        <input
                                            type="radio"
                                            name="bannerType"
                                            checked={bannerType === "custom"}
                                            onChange={() => setBannerType("custom")}
                                        />
                                        <span className="text-sm">Image envoyée</span>
                                    </label>
                                </div>
                                {bannerType === "custom" && (
                                    <div className="space-y-3">
                                        {bannerUrl && (
                                            <div className="group relative h-48 overflow-hidden rounded-md border border-border">
                                                <Image
                                                    src={bannerUrl}
                                                    alt="Aperçu de l'étendard"
                                                    fill
                                                    className="object-cover"
                                                    unoptimized={true}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteImage("banner")}
                                                    aria-label="Supprimer l'étendard"
                                                    className="absolute right-2 top-2 rounded-full bg-background/80 p-2 opacity-0 transition-opacity hover:bg-background group-hover:opacity-100"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                        )}
                                        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border px-4 py-6 transition-colors hover:border-border-strong">
                                            <Upload className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-sm text-muted-foreground">
                                                {bannerUrl ? "Changer" : "Envoyer"} un étendard
                                            </span>
                                            <input
                                                type="file"
                                                accept="image/jpeg,image/png,image/webp"
                                                onChange={(e) => handleImageUpload(e, "banner")}
                                                className="hidden"
                                            />
                                        </label>
                                        <p className="text-xs text-muted-foreground">960×540 px, 2 Mo max.</p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Photo de guilde</Label>
                                    <span className="text-xs text-muted-foreground">Facultatif</span>
                                </div>
                                {photoUrl && (
                                    <div className="group relative h-52 overflow-hidden rounded-md border border-border">
                                        <Image
                                            src={photoUrl}
                                            alt="Aperçu de la photo"
                                            fill
                                            className="object-cover"
                                            unoptimized={true}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteImage("photo")}
                                            aria-label="Supprimer la photo"
                                            className="absolute right-2 top-2 rounded-full bg-background/80 p-2 opacity-0 transition-opacity hover:bg-background group-hover:opacity-100"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}
                                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border px-4 py-6 transition-colors hover:border-border-strong">
                                    <Upload className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">
                                        {photoUrl ? "Changer" : "Envoyer"} une photo
                                    </span>
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={(e) => handleImageUpload(e, "photo")}
                                        className="hidden"
                                    />
                                </label>
                                <p className="text-xs text-muted-foreground">800×600 px, 2 Mo max.</p>
                            </div>
                        </div>
                    </div>
                )}

                {step === "recruit" && (
                    <div className="space-y-8">
                        <StepHeading
                            eyebrow="Étape 5 sur 5 · Recrutement"
                            title="Qui peut frapper à la porte"
                            desc="Des seuils lisibles évitent les candidatures perdues. Tout est facultatif."
                            asset="/assets/dofus/modules/quest.png"
                        />
                        <div className="flex items-center justify-between rounded-md border border-border p-4">
                            <div>
                                <p className="flex items-center gap-2 text-sm font-semibold">
                                    <UserPlus className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                                    Recrutement ouvert
                                </p>
                                <p className="mt-0.5 text-xs text-muted-foreground">Fermé = la page le dit franchement.</p>
                            </div>
                            <Switch checked={recruiting} onCheckedChange={setRecruiting} aria-label="Recrutement ouvert" />
                        </div>

                        {recruiting && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                                    <div className="rounded-md border border-border p-4">
                                        <div className="mb-2 flex items-center justify-between">
                                            <Label className="flex items-center gap-2">
                                                <MessageCircle className="h-4 w-4 text-muted-foreground" />
                                                Discord requis
                                            </Label>
                                            <Switch checked={discordRequired} onCheckedChange={setDiscordRequired} aria-label="Discord requis" />
                                        </div>
                                    </div>
                                    <div className="rounded-md border border-border p-4">
                                        <Label className="mb-2 block text-sm">Niveau minimum</Label>
                                        <Input
                                            type="number"
                                            value={minLevel}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                const num = parseInt(val, 10);
                                                if (val === "" || (num >= 0 && num <= 200)) {
                                                    setMinLevel(val);
                                                    if (errors.minLevel) {
                                                        setErrors(prev => {
                                                            const n = { ...prev };
                                                            delete n.minLevel;
                                                            return n;
                                                        });
                                                    }
                                                }
                                            }}
                                            placeholder="0-200"
                                            min={0}
                                            max={200}
                                            className={cn("bg-transparent", errors.minLevel && "border-danger/50")}
                                        />
                                        {errors.minLevel ? (
                                            <p className="mt-1 text-xs text-danger">{errors.minLevel}</p>
                                        ) : (
                                            <p className="mt-1 text-xs text-muted-foreground">Facultatif</p>
                                        )}
                                    </div>
                                    <div className="rounded-md border border-border p-4">
                                        <Label className="mb-2 block text-sm">Succès minimum</Label>
                                        <Input
                                            type="number"
                                            value={minSuccesses}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                const num = parseInt(val, 10);
                                                if (val === "" || (num >= 0 && num <= 25000)) {
                                                    setMinSuccesses(val);
                                                    if (errors.minSuccesses) {
                                                        setErrors(prev => {
                                                            const n = { ...prev };
                                                            delete n.minSuccesses;
                                                            return n;
                                                        });
                                                    }
                                                }
                                            }}
                                            placeholder="0-25000"
                                            min={0}
                                            max={25000}
                                            className={cn("bg-transparent", errors.minSuccesses && "border-danger/50")}
                                        />
                                        {errors.minSuccesses ? (
                                            <p className="mt-1 text-xs text-danger">{errors.minSuccesses}</p>
                                        ) : (
                                            <p className="mt-1 text-xs text-muted-foreground">Facultatif</p>
                                        )}
                                    </div>
                                    <div className="rounded-md border border-border p-4">
                                        <Label className="mb-2 flex items-center gap-2 text-sm">
                                            <Users className="h-4 w-4 text-muted-foreground" />
                                            Membres actuels
                                        </Label>
                                        <Input
                                            type="number"
                                            value={memberCount}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                const num = parseInt(val, 10);
                                                if (val === "" || (num >= 0 && num <= 350)) {
                                                    setMemberCount(val);
                                                }
                                            }}
                                            placeholder="0-350"
                                            min={0}
                                            max={350}
                                            className="bg-transparent"
                                        />
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {memberCount ? `Places libres : ${350 - parseInt(memberCount)}` : "Facultatif"}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="recruitReq">Autres pré-requis</Label>
                                    <Textarea
                                        id="recruitReq"
                                        value={recruitmentRequirements}
                                        onChange={(e) => setRecruitmentRequirements(e.target.value)}
                                        placeholder="Ce que la guilde attend vraiment..."
                                        rows={4}
                                        maxLength={1000}
                                        className="bg-transparent"
                                    />
                                    <p className="reg-mono text-xs text-muted-foreground">
                                        {recruitmentRequirements.length}/1000
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Pied d'étape : retour, suite, enregistrement final. */}
                <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
                    <div className="flex items-center gap-3">
                        {stepIndex > 0 ? (
                            <button type="button" onClick={goPrev} className="reg-btn reg-btn-secondary">
                                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                                Retour
                            </button>
                        ) : (
                            <span className="reg-mono text-xs text-muted-foreground">Étape 1 sur {STEPS.length}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {dirty && (
                            <span className="text-xs text-muted-foreground">Modifications non enregistrées</span>
                        )}
                        {!isLast ? (
                            <button type="button" onClick={goNext} className="reg-btn reg-btn-primary">
                                Continuer
                                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={isPending}
                                className="reg-btn reg-btn-primary"
                            >
                                {isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                ) : (
                                    <Check className="h-4 w-4" aria-hidden="true" />
                                )}
                                Enregistrer la page
                            </button>
                        )}
                    </div>
                </div>
                <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    L&apos;enregistrement s&apos;applique à toutes les étapes d&apos;un coup — la garde
                    anti-oubli surveille la sortie.
                </p>
            </div>

            {/* #228 — Garde anti-navigation : alerte si des modifications ne sont pas sauvegardées. */}
            <UnsavedChangesGuard hasUnsavedChanges={dirty} />
        </div>
    );
}

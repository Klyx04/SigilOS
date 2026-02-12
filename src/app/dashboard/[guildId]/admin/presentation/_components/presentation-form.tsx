"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
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
} from "@/lib/presentation-constants";
import {
    Save,
    Eye,
    EyeOff,
    Upload,
    X,
    ExternalLink,
    Loader2,
    Crown,
    Shield,
    Server,
    Gamepad2,
    MessageCircle,
    Check,
    Star,
    UserPlus,
    Users,
    Image as ImageIcon,
    AlertCircle,
    Sparkles,
    Trophy,
    Castle,
    Calendar // Added
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { MemberSelector } from "./member-selector";

type Props = {
    guildId: string;
};

// Validation helpers
const PSEUDO_REGEX = /^[\w\-À-ÿ]{2,30}$/;
const DISCORD_URL_REGEX = /^https?:\/\/(discord\.gg|discord\.com\/invite)\/[\w-]+$/;

const validatePseudo = (value: string): boolean => {
    if (!value) return true; // Empty is ok (optional)
    return PSEUDO_REGEX.test(value);
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

const getCompletenessColor = (score: number) => {
    if (score < 50) return "bg-red-500";
    if (score < 80) return "bg-amber-500";
    return "bg-emerald-500";
};



// Sanitize history text (remove URLs)
const sanitizeHistoryText = (text: string): string => {
    // Remove URLs
    return text.replace(/https?:\/\/[^\s]+/gi, "[lien supprimé]");
};

// Section header with save button
interface SectionHeaderProps {
    title: string;
    icon: React.ElementType;
    section: string;
    color?: string;
    onSave: (section: string) => void;
    isPending: boolean;
}

const SectionHeader = ({ title, icon: Icon, section, color = "text-indigo-400", onSave, isPending }: SectionHeaderProps) => (
    <div className="flex items-center justify-between group">
        <h2 className={cn("text-lg font-semibold text-white flex items-center gap-2")}>
            <Icon className={cn("w-5 h-5", color)} />
            {title}
        </h2>
        <Button
            variant="ghost"
            size="sm"
            onClick={() => onSave(section)}
            disabled={isPending}
            className="opacity-0 group-hover:opacity-100 transition-opacity h-8 gap-1.5 text-xs text-zinc-400 hover:text-white"
        >
            <Save className="w-3.5 h-3.5" />
            Sauvegarder
        </Button>
    </div>
);

export function PresentationForm({ guildId }: Props) {
    const [isPending, startTransition] = useTransition();
    const [isLoading, setIsLoading] = useState(true);
    const [members, setMembers] = useState<DiscordMemberOption[]>([]);

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
    const [bannerType, setBannerType] = useState<"discord" | "custom">("discord");
    const [bannerUrl, setBannerUrl] = useState<string | null>(null);
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const [foundedDate, setFoundedDate] = useState<Date | null>(null);
    const [discordRequired, setDiscordRequired] = useState(false);
    const [minLevel, setMinLevel] = useState<string>("");
    const [minSuccesses, setMinSuccesses] = useState<string>("");

    // Validation errors
    const [errors, setErrors] = useState<Record<string, string>>({});

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
                setBannerType(d.bannerType || "discord");
                setBannerUrl(d.bannerUrl);
                setPhotoUrl(d.photoUrl);
                setDiscordRequired(d.discordRequired);
                setMinLevel(d.minLevel?.toString() || "");
                setMinSuccesses(d.minSuccesses?.toString() || "");
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
            };

            const result = await updateGuildPresentation(guildId, data);

            if (result.success) {
                toast.success("Présentation mise à jour");
            } else {
                toast.error(result.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    // Section-specific save
    const handleSaveSection = (section: string) => {
        // For now, save everything (we can optimize later)
        handleSubmit();
        toast.success(`Section "${section}" sauvegardée`);
    };

    // Handle image upload
    const handleImageUpload = async (
        e: React.ChangeEvent<HTMLInputElement>,
        type: "banner" | "photo"
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;

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
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        );
    }

    const completeness = calculateCompleteness(
        bannerUrl, photoUrl, history, founder, coLeaders, brasDroits, activities, recruiting, recruitmentRequirements, discord
    );

    return (
        <div className="space-y-6">
            {/* Completeness & Public Link Header */}
            <div className="flex flex-col md:flex-row gap-6 md:items-start justify-between bg-zinc-900/50 p-6 rounded-xl border border-white/5">
                <div className="flex-1 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-amber-500" />
                            Qualité de la page
                        </h2>
                        <span className={`text-sm font-bold ${completeness === 100 ? "text-emerald-400" : "text-zinc-400"
                            }`}>{completeness}%</span>
                    </div>
                    <Progress value={completeness} className="h-2 bg-zinc-800" indicatorClassName={getCompletenessColor(completeness)} />
                    {completeness < 100 && (
                        <p className="text-xs text-zinc-500">
                            Astuce : Ajoutez {
                                !bannerUrl ? "une bannière" :
                                    !photoUrl ? "un logo" :
                                        !history ? "une histoire" :
                                            "plus de détails"
                            } pour améliorer votre score.
                        </p>
                    )}
                </div>

                <Link href={`/guilds/${guildId}`} target="_blank">
                    <Button variant="outline" className="gap-2 border-dashed border-zinc-700 hover:bg-zinc-800 w-full md:w-auto h-full">
                        <ExternalLink className="w-4 h-4" />
                        Voir page publique
                    </Button>
                </Link>
            </div>
            {/* Visibility Toggle - Always visible */}
            <div className="bg-zinc-900/50 rounded-xl border border-white/5 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            {enabled ? (
                                <Eye className="w-5 h-5 text-emerald-400" />
                            ) : (
                                <EyeOff className="w-5 h-5 text-zinc-500" />
                            )}
                            Visibilité dans l&apos;annuaire
                        </h2>
                        <p className="text-sm text-zinc-400 mt-1">
                            Rendre votre guilde visible publiquement
                        </p>
                    </div>
                    <Switch
                        checked={enabled}
                        onCheckedChange={setEnabled}
                    />
                </div>

                {enabled && (
                    <a
                        href={`/guilds/${guildId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-4 text-sm text-indigo-400 hover:text-indigo-300"
                    >
                        Voir la page publique
                        <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                )}
            </div>

            {/* Tabs Navigation */}
            <Tabs defaultValue="general" className="w-full">
                <div className="flex items-center justify-center mb-6">
                    <TabsList className="bg-black/40 backdrop-blur-md border border-white/10 p-1 h-11 rounded-full">
                        <TabsTrigger
                            value="general"
                            className="rounded-full px-5 data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-300 data-[state=active]:border-indigo-500/30 border border-transparent transition-all"
                        >
                            <Server className="w-4 h-4 mr-2" />
                            Général
                        </TabsTrigger>
                        <TabsTrigger
                            value="team"
                            className="rounded-full px-5 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300 data-[state=active]:border-amber-500/30 border border-transparent transition-all"
                        >
                            <Crown className="w-4 h-4 mr-2" />
                            Direction
                        </TabsTrigger>
                        <TabsTrigger
                            value="content"
                            className="rounded-full px-5 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-300 data-[state=active]:border-emerald-500/30 border border-transparent transition-all"
                        >
                            <Gamepad2 className="w-4 h-4 mr-2" />
                            Contenu
                        </TabsTrigger>
                        <TabsTrigger
                            value="images"
                            className="rounded-full px-5 data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300 data-[state=active]:border-purple-500/30 border border-transparent transition-all"
                        >
                            <ImageIcon className="w-4 h-4 mr-2" />
                            Images
                        </TabsTrigger>
                        <TabsTrigger
                            value="recruitment"
                            className="rounded-full px-5 data-[state=active]:bg-pink-500/20 data-[state=active]:text-pink-300 data-[state=active]:border-pink-500/30 border border-transparent transition-all"
                        >
                            <UserPlus className="w-4 h-4 mr-2" />
                            Recrutement
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* GENERAL TAB */}
                <TabsContent value="general" className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                    {/* Server Selection - Grid Style */}
                    <div className="bg-zinc-900/50 rounded-xl border border-white/5 p-6 space-y-4">
                        <SectionHeader title="Serveur Dofus Unity" icon={Server} section="server" onSave={handleSaveSection} isPending={isPending} />

                        <div className="space-y-4">
                            {/* Épiques */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <Shield className="w-4 h-4 text-emerald-500" />
                                    <p className="text-sm font-medium text-emerald-500">Serveurs Épiques</p>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                    {DOFUS_UNITY_SERVERS.epique.map((s) => (
                                        <button
                                            key={s.name}
                                            type="button"
                                            onClick={() => setServer(s.name)}
                                            className={cn(
                                                "relative px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border",
                                                server === s.name
                                                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)]"
                                                    : "bg-zinc-900/40 border-white/5 text-zinc-400 hover:border-white/10 hover:bg-white/5"
                                            )}
                                        >
                                            <span className="relative z-10">{s.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Monocompte */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <Trophy className="w-4 h-4 text-amber-500" />
                                    <p className="text-sm font-medium text-amber-500">Serveurs Monocompte</p>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                    {DOFUS_UNITY_SERVERS.monocompte.map((s) => (
                                        <button
                                            key={s.name}
                                            type="button"
                                            onClick={() => setServer(s.name)}
                                            className={cn(
                                                "relative px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border",
                                                server === s.name
                                                    ? "bg-amber-500/10 border-amber-500 text-amber-400 shadow-[0_0_15px_-3px_rgba(245,158,11,0.2)]"
                                                    : "bg-zinc-900/40 border-white/5 text-zinc-400 hover:border-white/10 hover:bg-white/5"
                                            )}
                                        >
                                            <span className="relative z-10">{s.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Classiques */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <Gamepad2 className="w-4 h-4 text-zinc-400" />
                                    <p className="text-sm font-medium text-zinc-400">Serveurs Classiques</p>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                    {DOFUS_UNITY_SERVERS.classique.map((s) => (
                                        <button
                                            key={s.name}
                                            type="button"
                                            onClick={() => setServer(s.name)}
                                            className={cn(
                                                "relative px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border",
                                                server === s.name
                                                    ? "bg-white/10 border-white text-white shadow-[0_0_15px_-3px_rgba(255,255,255,0.2)]"
                                                    : "bg-zinc-900/40 border-white/5 text-zinc-400 hover:border-white/10 hover:bg-white/5"
                                            )}
                                        >
                                            <span className="relative z-10">{s.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Pionniers Mono */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <Sparkles className="w-4 h-4 text-indigo-400" />
                                    <p className="text-sm font-medium text-indigo-400">Serveurs Pionniers Monocompte</p>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                    {DOFUS_UNITY_SERVERS.pionnierMono.map((s) => (
                                        <button
                                            key={s.name}
                                            type="button"
                                            onClick={() => setServer(s.name)}
                                            className={cn(
                                                "relative px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border",
                                                server === s.name
                                                    ? "bg-indigo-500/10 border-indigo-500 text-indigo-400 shadow-[0_0_15px_-3px_rgba(99,102,241,0.2)]"
                                                    : "bg-zinc-900/40 border-white/5 text-zinc-400 hover:border-white/10 hover:bg-white/5"
                                            )}
                                        >
                                            <span className="relative z-10">{s.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Pionniers Multi */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <Users className="w-4 h-4 text-blue-500" />
                                    <p className="text-sm font-medium text-blue-500">Serveurs Pionniers</p>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                    {DOFUS_UNITY_SERVERS.pionnier.map((s) => (
                                        <button
                                            key={s.name}
                                            type="button"
                                            onClick={() => setServer(s.name)}
                                            className={cn(
                                                "relative px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border",
                                                server === s.name
                                                    ? "bg-blue-500/10 border-blue-500 text-blue-400 shadow-[0_0_15px_-3px_rgba(59,130,246,0.2)]"
                                                    : "bg-zinc-900/40 border-white/5 text-zinc-400 hover:border-white/10 hover:bg-white/5"
                                            )}
                                        >
                                            <span className="relative z-10">{s.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {server && (
                                <div className="flex items-center justify-between pt-2">
                                    <p className="text-sm text-zinc-400">
                                        Serveur sélectionné : <span className="text-white font-medium">{server}</span>
                                    </p>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setServer("")}
                                        className="text-zinc-500 hover:text-white"
                                    >
                                        <X className="w-4 h-4 mr-1" />
                                        Effacer
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Founded Date */}
                    <div className="bg-zinc-900/50 rounded-xl border border-white/5 p-6 space-y-4">
                        <SectionHeader title="Date de fondation" icon={Calendar} section="foundedDate" color="text-amber-500" onSave={handleSaveSection} isPending={isPending} />
                        <div className="space-y-2">
                            <p className="text-sm text-zinc-400">Cette date servira à calculer l'ancienneté de votre guilde.</p>
                            <Input
                                type="date"
                                value={foundedDate ? foundedDate.toISOString().split('T')[0] : ""}
                                onChange={(e) => setFoundedDate(e.target.value ? new Date(e.target.value) : null)}
                                className="bg-zinc-800/50 border-white/10 w-full md:w-auto"
                            />
                        </div>
                    </div>

                    {/* Discord Link */}
                    <div className="bg-zinc-900/50 rounded-xl border border-white/5 p-6 space-y-4">
                        <SectionHeader title="Lien Discord" icon={MessageCircle} section="discord" color="text-[#5865F2]" onSave={handleSaveSection} isPending={isPending} />
                        <div className="space-y-2">
                            <Input
                                value={discord}
                                onChange={(e) => {
                                    // Only allow valid Discord URL characters
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
                                className={cn(
                                    "bg-zinc-800/50 border-white/10",
                                    errors.discord && "border-red-500/50"
                                )}
                            />
                            {errors.discord ? (
                                <p className="text-xs text-red-400 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {errors.discord}
                                </p>
                            ) : (
                                <p className="text-xs text-zinc-500">
                                    Format : discord.gg/xxx ou discord.com/invite/xxx
                                </p>
                            )}
                        </div>
                    </div>
                </TabsContent>

                {/* TEAM TAB */}
                <TabsContent value="team" className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                    {/* Founder Section */}
                    <div className="bg-zinc-900/50 rounded-xl border border-white/5 p-4 space-y-3">
                        <SectionHeader title="Fondateur" icon={Crown} section="founder" color="text-amber-400" onSave={handleSaveSection} isPending={isPending} />
                        <div className="bg-amber-500/5 rounded-xl border border-amber-500/10 p-3">
                            <Label className="text-amber-500 mb-2 block">Chef de guilde</Label>
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
                                placeholder="Rechercher le chef de guilde..."
                                error={!!errors.founder}
                                className="bg-zinc-900/50 border-amber-500/20 focus:border-amber-400"
                            />
                            {errors.founder && (
                                <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {errors.founder}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Co-Leaders Section */}
                        <div className="bg-zinc-900/50 rounded-xl border border-white/5 p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <SectionHeader title="Co-leaders" icon={Star} section="coleaders" color="text-yellow-400" onSave={handleSaveSection} isPending={isPending} />
                                <span className="bg-yellow-500/10 text-yellow-400 text-xs px-2 py-1 rounded-full font-mono">
                                    {coLeaders.filter(c => c.trim()).length}/3
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {coLeaders.map((cl, i) => (
                                    <div key={i} className="flex gap-2 items-center bg-zinc-900/50 p-1.5 rounded-lg border border-white/5 group hover:border-white/10 transition-colors">
                                        <div className="flex-1 min-w-0">
                                            <MemberSelector
                                                value={cl}
                                                onChange={(val) => updateCoLeader(i, val)}
                                                members={members}
                                                placeholder={`Co-leader ${i + 1}`}
                                                error={!!errors[`coLeader${i}`]}
                                                className="border-0 bg-transparent h-8 focus:ring-0 px-2"
                                            />
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => {
                                                const newCoLeaders = coLeaders.filter((_, index) => index !== i);
                                                setCoLeaders(newCoLeaders);
                                            }}
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                ))}

                                {coLeaders.length < 3 && (
                                    <Button
                                        variant="outline"
                                        onClick={() => setCoLeaders([...coLeaders, ""])}
                                        className="h-full min-h-[44px] border-dashed border-zinc-700 text-zinc-500 hover:text-white hover:bg-zinc-800 bg-transparent"
                                    >
                                        <UserPlus className="w-4 h-4 mr-2" />
                                        Ajouter
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Bras Droits Section */}
                        <div className="bg-zinc-900/50 rounded-xl border border-white/5 p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <SectionHeader title="Bras Droits" icon={Shield} section="brasdroits" color="text-indigo-400" onSave={handleSaveSection} isPending={isPending} />
                                <span className="bg-indigo-500/10 text-indigo-400 text-xs px-2 py-1 rounded-full font-mono">
                                    {brasDroits.filter(b => b.trim()).length}/10
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {brasDroits.map((bd, i) => (
                                    <div key={i} className="flex gap-2 items-center bg-zinc-900/50 p-1.5 rounded-lg border border-white/5 group hover:border-white/10 transition-colors">
                                        <div className="flex-1 min-w-0">
                                            <MemberSelector
                                                value={bd}
                                                onChange={(val) => updateBrasDroit(i, val)}
                                                members={members}
                                                placeholder={`Bras droit ${i + 1}`}
                                                error={!!errors[`brasDroit${i}`]}
                                                className="border-0 bg-transparent h-8 focus:ring-0 px-2"
                                            />
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => {
                                                const newBras = brasDroits.filter((_, index) => index !== i);
                                                setBrasDroits(newBras);
                                            }}
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                ))}

                                {brasDroits.length < 10 && (
                                    <Button
                                        variant="outline"
                                        onClick={() => setBrasDroits([...brasDroits, ""])}
                                        className="h-full min-h-[44px] border-dashed border-zinc-700 text-zinc-500 hover:text-white hover:bg-zinc-800 bg-transparent"
                                    >
                                        <UserPlus className="w-4 h-4 mr-2" />
                                        Ajouter
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* CONTENT TAB */}
                <TabsContent value="content" className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                    {/* History */}
                    <div className="bg-zinc-900/50 rounded-xl border border-white/5 p-6 space-y-4">
                        <SectionHeader title="Notre Histoire 📜" icon={Gamepad2} section="history" color="text-emerald-400" onSave={handleSaveSection} isPending={isPending} />
                        <p className="text-xs text-zinc-500">Emojis autorisés ✨ | Les liens seront supprimés automatiquement</p>
                        <Textarea
                            value={history}
                            onChange={(e) => setHistory(e.target.value)}
                            onBlur={() => setHistory(sanitizeHistoryText(history))}
                            placeholder="Racontez l'histoire de votre guilde... 🎮"
                            rows={8}
                            maxLength={5000}
                            className="bg-zinc-800/50 border-white/10"
                        />
                        <p className="text-xs text-zinc-500">{history.length}/5000 caractères</p>
                    </div>

                    {/* Activities */}
                    <div className="bg-zinc-900/50 rounded-xl border border-white/5 p-6 space-y-4">
                        <SectionHeader title="Nos Activités" icon={Gamepad2} section="activities" color="text-emerald-400" onSave={handleSaveSection} isPending={isPending} />
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {AVAILABLE_ACTIVITIES.map((activity) => (
                                <button
                                    key={activity.id}
                                    type="button"
                                    onClick={() => toggleActivity(activity.id)}
                                    className={cn(
                                        "p-4 rounded-xl border transition-all text-left",
                                        activities.includes(activity.id)
                                            ? "bg-emerald-500/20 border-emerald-500/50"
                                            : "bg-zinc-800/50 border-white/5 hover:border-white/20"
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className={cn(
                                            "font-semibold",
                                            activities.includes(activity.id) ? "text-emerald-300" : "text-zinc-300"
                                        )}>
                                            {activity.label}
                                        </span>
                                        {activities.includes(activity.id) && (
                                            <Check className="w-4 h-4 text-emerald-400" />
                                        )}
                                    </div>
                                    {activity.subtitle && (
                                        <p className="text-xs text-zinc-500 mt-1">{activity.subtitle}</p>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </TabsContent>

                {/* IMAGES TAB */}
                <TabsContent value="images" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-zinc-900/50 rounded-xl border border-white/5 p-6 space-y-6">
                        <SectionHeader title="Images" icon={ImageIcon} section="images" color="text-purple-400" onSave={handleSaveSection} isPending={isPending} />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Banner */}
                            <div className="space-y-3">
                                <Label>Bannière</Label>
                                <div className="flex gap-4 mb-3">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="bannerType"
                                            checked={bannerType === "discord"}
                                            onChange={() => setBannerType("discord")}
                                            className="text-indigo-500"
                                        />
                                        <span className="text-sm text-zinc-300">Sans bannière</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="bannerType"
                                            checked={bannerType === "custom"}
                                            onChange={() => setBannerType("custom")}
                                            className="text-indigo-500"
                                        />
                                        <span className="text-sm text-zinc-300">Bannière personnalisée</span>
                                    </label>
                                </div>

                                {bannerType === "custom" && (
                                    <div className="space-y-3">
                                        {bannerUrl && (
                                            <div className="relative h-48 rounded-lg overflow-hidden group">
                                                <Image
                                                    src={bannerUrl}
                                                    alt="Banner preview"
                                                    fill
                                                    className="object-cover"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteImage("banner")}
                                                    className="absolute top-2 right-2 p-2 bg-red-500/80 hover:bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X className="w-4 h-4 text-white" />
                                                </button>
                                            </div>
                                        )}
                                        <label className="flex items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-white/10 rounded-lg cursor-pointer hover:border-indigo-500/50 transition-colors">
                                            <Upload className="w-4 h-4 text-zinc-400" />
                                            <span className="text-sm text-zinc-400">
                                                {bannerUrl ? "Changer" : "Uploader"} une bannière
                                            </span>
                                            <input
                                                type="file"
                                                accept="image/jpeg,image/png,image/webp"
                                                onChange={(e) => handleImageUpload(e, "banner")}
                                                className="hidden"
                                            />
                                        </label>
                                        <p className="text-xs text-zinc-500">
                                            📐 Format Discord : 960×540px (16:9) | Max 2MB | Optionnel
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Photo */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Photo de guilde</Label>
                                    <span className="text-xs text-zinc-500">Optionnel</span>
                                </div>
                                {photoUrl && (
                                    <div className="relative h-52 rounded-lg overflow-hidden group">
                                        <Image
                                            src={photoUrl}
                                            alt="Photo preview"
                                            fill
                                            className="object-cover"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteImage("photo")}
                                            className="absolute top-2 right-2 p-2 bg-red-500/80 hover:bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="w-4 h-4 text-white" />
                                        </button>
                                    </div>
                                )}
                                <label className="flex items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-white/10 rounded-lg cursor-pointer hover:border-indigo-500/50 transition-colors">
                                    <Upload className="w-4 h-4 text-zinc-400" />
                                    <span className="text-sm text-zinc-400">
                                        {photoUrl ? "Changer" : "Uploader"} une photo
                                    </span>
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={(e) => handleImageUpload(e, "photo")}
                                        className="hidden"
                                    />
                                </label>
                                <p className="text-xs text-zinc-500">
                                    📐 Recommandé : 800×600px | Max 2MB
                                </p>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* RECRUITMENT TAB */}
                <TabsContent value="recruitment" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-zinc-900/50 rounded-xl border border-white/5 p-6 space-y-6">
                        <div className="flex items-center justify-between">
                            <SectionHeader title="Recrutement" icon={UserPlus} section="recruitment" color="text-pink-400" onSave={handleSaveSection} isPending={isPending} />
                            <Switch
                                checked={recruiting}
                                onCheckedChange={setRecruiting}
                            />
                        </div>

                        {recruiting && (
                            <div className="space-y-6">
                                <p className="text-sm text-zinc-400 p-3 bg-pink-500/10 border border-pink-500/20 rounded-lg">
                                    ℹ️ Ces informations seront affichées sur la page publique de votre guilde.
                                </p>

                                {/* Requirements Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Discord Required */}
                                    <div className="p-4 bg-zinc-800/50 rounded-xl border border-white/5">
                                        <div className="flex items-center justify-between mb-2">
                                            <Label className="text-zinc-300 flex items-center gap-2">
                                                <MessageCircle className="w-4 h-4 text-[#5865F2]" />
                                                Discord obligatoire
                                            </Label>
                                            <Switch
                                                checked={discordRequired}
                                                onCheckedChange={setDiscordRequired}
                                            />
                                        </div>
                                    </div>

                                    {/* Min Level */}
                                    <div className="p-4 bg-zinc-800/50 rounded-xl border border-white/5">
                                        <Label className="text-zinc-300 text-sm mb-2 block">Niveau minimum</Label>
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
                                            className={cn(
                                                "bg-zinc-900/50 border-white/10",
                                                errors.minLevel && "border-red-500/50"
                                            )}
                                        />
                                        {errors.minLevel ? (
                                            <p className="text-xs text-red-400 mt-1">{errors.minLevel}</p>
                                        ) : (
                                            <p className="text-xs text-zinc-500 mt-1">Optionnel</p>
                                        )}
                                    </div>

                                    {/* Min Successes */}
                                    <div className="p-4 bg-zinc-800/50 rounded-xl border border-white/5">
                                        <Label className="text-zinc-300 text-sm mb-2 block">Succès minimum</Label>
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
                                            className={cn(
                                                "bg-zinc-900/50 border-white/10",
                                                errors.minSuccesses && "border-red-500/50"
                                            )}
                                        />
                                        {errors.minSuccesses ? (
                                            <p className="text-xs text-red-400 mt-1">{errors.minSuccesses}</p>
                                        ) : (
                                            <p className="text-xs text-zinc-500 mt-1">Optionnel</p>
                                        )}
                                    </div>
                                </div>

                                {/* Additional Requirements */}
                                <div className="space-y-2">
                                    <Label htmlFor="recruitReq">Autres pré-requis</Label>
                                    <Textarea
                                        id="recruitReq"
                                        value={recruitmentRequirements}
                                        onChange={(e) => setRecruitmentRequirements(e.target.value)}
                                        placeholder="Décrivez vos attentes..."
                                        rows={4}
                                        maxLength={1000}
                                        className="bg-zinc-800/50 border-white/10"
                                    />
                                    <p className="text-xs text-zinc-500">
                                        {recruitmentRequirements.length}/1000 caractères
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>

            {/* Global Save Button */}
            <div className="flex justify-end sticky bottom-4">
                <Button
                    onClick={handleSubmit}
                    disabled={isPending}
                    size="lg"
                    className="bg-indigo-600 hover:bg-indigo-700 gap-2 shadow-lg shadow-indigo-500/20"
                >
                    {isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Save className="w-4 h-4" />
                    )}
                    Tout sauvegarder
                </Button>
            </div>
        </div>
    );
}

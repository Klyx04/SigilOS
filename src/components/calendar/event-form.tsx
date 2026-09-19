"use client";

/**
 * EventForm V3 - Fixed Date Handling + 4 Types
 * Types: RAID_OFFICIAL, EVENT_GUILD, SESSION_MISSIONS, SORTIE_FARM
 */

import { useState, useEffect, useMemo } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parse, addHours, isBefore, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import {
    Calendar as CalendarIcon,
    Clock,
    Loader2,
    Users,
    Info,
    AlertTriangle,
    Shield,
    Globe,
    Lock,
    Crown,
    Swords as SwordsIcon,
    ChevronsUpDown,
    Check,
    Hash,
    X,
    Coins
} from "lucide-react";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { raidImagePath } from "@/lib/calendar-event-images";
import { DofusUiIcon } from "@/components/shared/dofus-ui-icon";
import { calendarEventTheme } from "@/lib/calendar-event-theme";
import { MissionPicker } from "./mission-picker";
import Link from "next/link";
import { getDiscordRolesAction } from "@/server/actions/user-actions";
import { getUserRaidEligibility } from "@/server/actions/kama-actions";
import { PingEstimate } from "@/components/shared/ping-estimate";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";

// ============================================
// 4 EVENT TYPES (Almanax removed)
// ============================================

interface TypeConfig {
    label: string;
    shortLabel: string;
    bg: string;
    border: string;
    text: string;
    preset: {
        defaultDuration: number;
        maxParticipants?: number;
    };
}

// ============================================
// RAID SUBTYPES
// ============================================

const RAID_TYPES = [
    {
        id: "jardin",
        label: "Sanctuaire des Jardins Éternels",
        short: "Jardins Éternels",
        min: 8,
        max: 16,
        // Illustration SigilOS (portrait 3:4) — le sélecteur l'affiche entière, jamais rognée.
        image: raidImagePath("jardin"),
        thumbnail: "https://static.ankama.com/dofus/www/game/monsters/200/5131.png",
    },
    {
        id: "gigalodon",
        label: "Gouffre du Gigalodon",
        short: "Gigalodon",
        min: 8,
        max: 12,
        image: raidImagePath("gigalodon"),
        thumbnail: "https://static.ankama.com/dofus/www/game/monsters/200/5129.png",
    },
] as const;

const TYPE_CONFIG: Record<string, TypeConfig> = {
    RAID_OFFICIAL: {
        label: "Raid Officiel 3.6",
        shortLabel: "Raid 3.6",
        bg: "bg-danger/10",
        border: "border-danger/30",
        text: "text-danger",
        preset: { defaultDuration: 3, maxParticipants: 12 }
    },
    EVENT_GUILD: {
        label: "Event Guilde (Mini-jeux)",
        shortLabel: "Event Guilde",
        bg: "bg-info/10",
        border: "border-info/30",
        text: "text-info",
        preset: { defaultDuration: 2 }
    },
    SESSION_MISSIONS: {
        label: "Missions Guilde",
        shortLabel: "Missions Guilde",
        bg: "bg-warning/10",
        border: "border-warning/30",
        text: "text-warning",
        preset: { defaultDuration: 4, maxParticipants: 8 }
    },
    SORTIE_FARM: {
        label: "Sortie Farm / Drop",
        shortLabel: "Sortie Farm",
        bg: "bg-success/10",
        border: "border-success/30",
        text: "text-success",
        preset: { defaultDuration: 2 }
    },
    OTHERS: {
        label: "Autres activités",
        shortLabel: "Autres",
        bg: "bg-muted/10",
        border: "border-border/30",
        text: "text-muted-foreground",
        preset: { defaultDuration: 2 }
    },
};

const EVENT_TYPES = Object.keys(TYPE_CONFIG);

// ============================================
// ZOD SCHEMA with better date validation
// ============================================

const isPastDay = (d: Date) => {
    const startOfToday = startOfDay(new Date());
    const checkDate = startOfDay(d);
    return checkDate < startOfToday;
};

const getValidStartDate = (d?: Date | string) => {
    if (!d) return new Date();
    const parsed = new Date(d);
    return isPastDay(parsed) ? new Date() : parsed;
};

const eventFormSchema = z.object({
    title: z.string().min(3, "Le titre doit faire au moins 3 caractères").max(100),
    description: z.string().max(2000).optional(),
    type: z.string(),
    date: z.date({ required_error: "Date requise" }),
    startTime: z.string().min(5, "Heure requise"),
    endTime: z.string().min(5, "Heure requise"),
    maxParticipants: z.coerce.number().min(1).optional().nullable(),
    publishOnDiscord: z.boolean().optional(),
    mentionRoleIds: z.array(z.string()).optional(),
}).refine((data) => {
    return !isPastDay(data.date);
}, {
    message: "Impossible de créer un événement sur un jour passé",
    path: ["date"]
}).refine((data) => {
    // Validate end time is after start time
    const start = parse(data.startTime, "HH:mm", new Date());
    const end = parse(data.endTime, "HH:mm", new Date());
    // Handle case where end is next day (e.g., 23:00 - 01:00)
    if (data.endTime < data.startTime) return true; // Considered next day
    return !isBefore(end, start);
}, {
    message: "L'heure de fin doit être après l'heure de début",
    path: ["endTime"]
});

type EventFormValues = z.infer<typeof eventFormSchema>;

// ============================================
// COMPONENT
// ============================================

interface DiscordChannels {
    calendarNotifyChannelId?: string | null;
    raidNotifyChannelId?: string | null;
    raidGigalodonNotifyChannelId?: string | null;
    raidSanctuaireNotifyChannelId?: string | null;
}

interface EventFormProps {
    guildId: string;
    initialData?: any;
    onSubmit: (data: any) => Promise<void>;
    discordChannels?: DiscordChannels;
    canManageRaid?: boolean;
    userPseudo?: string;
    discordRoles?: { id: string, name: string, color?: string | number }[];
}

export function EventForm({ guildId, initialData, onSubmit, discordChannels, canManageRaid, userPseudo, discordRoles: providedRoles }: EventFormProps) {
    const [step, setStep] = useState<1 | 2>(1);
    const [submitting, setSubmitting] = useState(false);
    
    // Raid eligibility (kamas gate) for the creator
    const [creatorRaidEligibility, setCreatorRaidEligibility] = useState<{ isEligible: boolean; totalDonated: number } | null>(null);
    
    // Helper to normalize discord role colors
    const normalizeRoles = (roles: any[]) => roles.map(r => ({
        ...r,
        color: typeof r.color === 'number' 
            ? `#${r.color.toString(16).padStart(6, '0')}` 
            : r.color
    }));

    const [discordRoles, setDiscordRoles] = useState<{ id: string, name: string, color?: string }[]>(
        providedRoles ? normalizeRoles(providedRoles) : []
    );
    const [isLoadingRoles, setIsLoadingRoles] = useState(false);
    const [roleOpen, setRoleOpen] = useState(false);
    const [targetChannelName, setTargetChannelName] = useState<string>("annonces");
    
    // Fallback to EVENT_GUILD for unknown types
    const validType = initialData?.type && TYPE_CONFIG[initialData.type] ? initialData.type : "EVENT_GUILD";
    const [selectedType, setSelectedType] = useState<string>(validType);
    const [selectedMissions, setSelectedMissions] = useState<string[]>(initialData?.metadata?.missionIds || []);
    // Raid-specific state
    const [raidType, setRaidType] = useState<"jardin" | "gigalodon">(initialData?.metadata?.raidType || "gigalodon");
    const [raidCaptain, setRaidCaptain] = useState<string>(initialData?.metadata?.raidCaptain || userPseudo || "");
    const [openToExternal, setOpenToExternal] = useState<boolean>(initialData?.metadata?.openToExternal ?? false);
    const [allowedRoleIds, setAllowedRoleIds] = useState<string[]>(initialData?.metadata?.allowedRoleIds || []);
    const [whitelistedRoleIds, setWhitelistedRoleIds] = useState<string[]>([]);

    const isRaid = selectedType === "RAID_OFFICIAL";

    const [configChannels, setConfigChannels] = useState<{ 
        calendarNotifyChannelId?: string | null; 
        raidNotifyChannelId?: string | null;
        raidGigalodonNotifyChannelId?: string | null;
        raidSanctuaireNotifyChannelId?: string | null;
        calendarPingRoleIds?: string[];
        raidPingRoleIds?: string[];
    }>({});

    // Fetch Target Channels & Whitelisted Roles + Ping Roles
    useEffect(() => {
        if (guildId) {
            import("@/server/actions/calendar-actions").then(m => {
                m.getCalendarPublicConfig(guildId).then(res => {
                    if (res.success && res.data) {
                        setConfigChannels({
                            calendarNotifyChannelId: res.data.calendarNotifyChannelId,
                            raidNotifyChannelId: res.data.raidNotifyChannelId,
                            raidGigalodonNotifyChannelId: res.data.raidGigalodonNotifyChannelId,
                            raidSanctuaireNotifyChannelId: res.data.raidSanctuaireNotifyChannelId,
                            calendarPingRoleIds: res.data.calendarPingRoleIds || [],
                            raidPingRoleIds: res.data.raidPingRoleIds || [],
                        });

                        setWhitelistedRoleIds(res.data.raidAllowedSignUpRoleIds || []);

                        // No auto-fill: default = aucun rôle pingé
                        // L'utilisateur doit sélectionner les rôles explicitement
                        // pour que son événement ait de la visibilité
                    }
                });
            });
        }
    }, [guildId]);

    const whitelistedRoles = useMemo(() => {
        if (whitelistedRoleIds && whitelistedRoleIds.length > 0 && discordRoles.length > 0) {
            const filtered = discordRoles.filter(r => whitelistedRoleIds.includes(r.id));
            return filtered; // No fallback — if whitelist is set but roles don't exist, show empty
        }
        return discordRoles;
    }, [whitelistedRoleIds, discordRoles]);

    // Ping whitelist: which roles the admin allows for pings on this event type
    const pingAllowedRoleIds = useMemo(() => {
        if (isRaid) {
            return configChannels.raidPingRoleIds || [];
        }
        return configChannels.calendarPingRoleIds || [];
    }, [isRaid, configChannels.raidPingRoleIds, configChannels.calendarPingRoleIds]);

    const pingAllowedRoles = useMemo(() => {
        // Fail-closed: when a ping whitelist is configured, show ONLY those roles
        // (even if empty). Never fall back to all roles — an admin must see the
        // same whitelisted roles as any member.
        if (pingAllowedRoleIds && pingAllowedRoleIds.length > 0) {
            return discordRoles.filter(r => pingAllowedRoleIds.includes(r.id));
        }
        return discordRoles;
    }, [pingAllowedRoleIds, discordRoles]);

    // Determine if Discord publishing is available for the CURRENT event type.
    // Raids are fully independent from the calendar channel — they never fall back to it.
    const canPublishForType = isRaid
        ? (raidType === "gigalodon"
            ? !!(discordChannels?.raidGigalodonNotifyChannelId || configChannels.raidGigalodonNotifyChannelId
                || discordChannels?.raidNotifyChannelId || configChannels.raidNotifyChannelId)
            : !!(discordChannels?.raidSanctuaireNotifyChannelId || configChannels.raidSanctuaireNotifyChannelId
                || discordChannels?.raidNotifyChannelId || configChannels.raidNotifyChannelId))
        : !!(discordChannels?.calendarNotifyChannelId || configChannels.calendarNotifyChannelId);

    const activeChannelId = isRaid
        ? (raidType === "gigalodon"
            ? configChannels.raidGigalodonNotifyChannelId || configChannels.raidNotifyChannelId
            : configChannels.raidSanctuaireNotifyChannelId || configChannels.raidNotifyChannelId)
        : configChannels.calendarNotifyChannelId;

    // Fetch Target Channel Name
    useEffect(() => {
        if (canPublishForType && guildId && activeChannelId) {
            import("@/server/actions/discord-actions").then(d => {
                d.getDiscordChannelInfo(guildId, activeChannelId).then(chanRes => {
                    if (chanRes.success && chanRes.data) {
                        setTargetChannelName(chanRes.data.name ?? "Salon masqué");
                    }
                });
            });
        } else {
            setTargetChannelName("annonces");
        }
    }, [canPublishForType, guildId, activeChannelId]);

    // Fetch roles if not provided or when raid type selected
    useEffect(() => {
        if (canPublishForType && guildId) {
            setIsLoadingRoles(true);
            // Apply the admin's ping whitelist for the current event type — same roles
            // for members AND admins. (ignoreWhitelist is only used in admin settings panels.)
            getDiscordRolesAction(guildId, { context: isRaid ? "raid" : "calendar" }).then(res => {
                if (res.success && res.roles) {
                    setDiscordRoles(normalizeRoles(res.roles.filter((r: any) => r.name !== "@everyone")));
                }
            }).catch(err => console.error("Error fetching Discord roles:", err))
            .finally(() => setIsLoadingRoles(false));
        }
    }, [guildId, canPublishForType, isRaid]);

    // Fetch raid eligibility for the creator
    useEffect(() => {
        getUserRaidEligibility(guildId).then(res => {
            if (res.success) {
                setCreatorRaidEligibility({
                    isEligible: res.isEligible ?? false,
                    totalDonated: res.totalDonated ?? 0
                });
            }
        });
    }, [guildId]);

    const form = useForm<EventFormValues>({
        resolver: zodResolver(eventFormSchema),
        defaultValues: initialData ? {
            title: initialData.title || "",
            description: initialData.description || "",
            type: validType,
            date: initialData.startDate ? getValidStartDate(initialData.startDate) : new Date(),
            startTime: initialData.startDate 
                ? format(new Date(initialData.startDate), "HH:mm") 
                : "20:00",
            endTime: initialData.endDate 
                ? format(new Date(initialData.endDate), "HH:mm") 
                : "22:00",
            maxParticipants: initialData.maxParticipants || undefined,
            publishOnDiscord: false, // Default to false when editing
            mentionRoleIds: initialData.metadata?.mentionRoleIds || [],
        } : {
            title: "",
            description: "",
            type: "EVENT_GUILD",
            date: new Date(),
            startTime: "20:00",
            endTime: "22:00",
            maxParticipants: undefined,
            publishOnDiscord: canPublishForType,
            mentionRoleIds: [],
        },
    });

    // Watch start time to auto-update end time
    const startTime = form.watch("startTime");

    // Apply preset when type changes
    const handleTypeChange = (type: string) => {
        setSelectedType(type);
        form.setValue("type", type);

        const config = TYPE_CONFIG[type];
        if (config && !initialData) {
            if (config.preset.maxParticipants) {
                form.setValue("maxParticipants", config.preset.maxParticipants);
            }
            // Auto-calculate end time based on duration
            updateEndTime(startTime, config.preset.defaultDuration);
        }
    };

    // When raid subtype changes, auto-set max participants (locked)
    const handleRaidTypeChange = (rt: "jardin" | "gigalodon") => {
        setRaidType(rt);
        const raidDef = RAID_TYPES.find(r => r.id === rt);
        if (raidDef) form.setValue("maxParticipants", raidDef.max);
    };

    // Helper to update end time
    const updateEndTime = (start: string, durationHours: number) => {
        if (start) {
            const [hours, minutes] = start.split(":").map(Number);
            const startDate = new Date();
            startDate.setHours(hours, minutes, 0, 0);
            const endDate = addHours(startDate, durationHours);
            form.setValue("endTime", format(endDate, "HH:mm"));
        }
    };

    // Update end time when start time changes (only if not editing)
    useEffect(() => {
        if (selectedType === "RAID_OFFICIAL") {
            const raidDef = RAID_TYPES.find(r => r.id === raidType);
            if (raidDef) {
                form.setValue("title", `Raid : ${raidDef.short}`);
                form.setValue("maxParticipants", raidDef.max); // toujours figé au max du raid
                form.clearErrors("title");
            }
        } else if (!initialData && startTime) {
            const config = TYPE_CONFIG[selectedType];
            if (config) {
                updateEndTime(startTime, config.preset.defaultDuration);
            }
        }
    }, [startTime, selectedType, initialData, raidType]);

    const handleFormSubmit = async (values: EventFormValues) => {
        setSubmitting(true);
        try {
            // Build proper dates using local time components (NOT ISO string — avoids UTC misinterpretation)
            const [startHours, startMinutes] = values.startTime.split(":").map(Number);
            const [endHours, endMinutes] = values.endTime.split(":").map(Number);
            const startDate = new Date(values.date);
            startDate.setHours(startHours, startMinutes, 0, 0);
            const endDate = new Date(values.date);
            endDate.setHours(endHours, endMinutes, 0, 0);

            // If end time is before start time, assume next day
            if (endDate <= startDate) {
                endDate.setDate(endDate.getDate() + 1);
            }

            const raidDef = RAID_TYPES.find(r => r.id === raidType);
            const submissionData = {
                title: values.title,
                description: values.description,
                type: values.type,
                startDate,
                endDate,
                maxParticipants: values.maxParticipants || null,
                publishOnDiscord: values.publishOnDiscord,
                mentionRoleIds: values.mentionRoleIds || [],
                missionIds: values.type === "SESSION_MISSIONS" ? selectedMissions : [],
                metadata: values.type === "RAID_OFFICIAL" ? {
                    raidType,
                    raidLabel: raidDef?.label,
                    raidMin: raidDef?.min,
                    raidMax: raidDef?.max,
                    raidCaptain: raidCaptain.trim() || null,
                    openToExternal,
                    allowedRoleIds: openToExternal ? [] : allowedRoleIds,
                } : undefined,
            };

            await onSubmit(submissionData);
        } catch (error) {
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleNextStep = async () => {
        if (isRaid && creatorRaidEligibility !== null && !creatorRaidEligibility.isEligible) {
            return;
        }
        // Trigger validation for step 1 fields before proceeding
        const fieldsToValidate: (keyof EventFormValues)[] = ["title", "type", "date", "startTime", "endTime", "description"];
        const isValid = await form.trigger(fieldsToValidate);
        
        if (isValid) {
            setStep(2);
        }
    };

    const handleMissionSelect = (ids: string[], titles: string[]) => {
        setSelectedMissions(ids);
        
        if (selectedType === "SESSION_MISSIONS") {
            let newTitle = "";
            if (titles.length === 0) {
                newTitle = ""; // Let user type or keep empty
            } else if (titles.length === 1) {
                newTitle = `Mission : ${titles[0]}`;
            } else if (titles.length === 2) {
                newTitle = `Missions : ${titles[0]} & ${titles[1]}`;
            } else {
                newTitle = `Session Missions : ${titles[0]} + ${titles.length - 1} autres`;
            }
            
            if (newTitle) {
                form.setValue("title", newTitle);
                form.clearErrors("title");
            }
        }
    };

    const currentConfig = TYPE_CONFIG[selectedType] || TYPE_CONFIG.EVENT_GUILD;

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-5">
                {step === 1 && (
                    <div className="space-y-5">
                            {/* ============ TYPE SELECTOR (4 types) ============ */}
                            <div className="space-y-3">
                    <FormLabel className="text-sm font-medium text-foreground">
                        Type d'événement
                    </FormLabel>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                        {EVENT_TYPES.filter(t => t !== "RAID_OFFICIAL" || canManageRaid).map((type) => {
                            const config = TYPE_CONFIG[type];
                            const picto = calendarEventTheme(type).picto;
                            const isSelected = selectedType === type;

                            return (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => handleTypeChange(type)}
                                    className={cn(
                                        "relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-colors",
                                        isSelected
                                            ? cn(config.bg, config.border)
                                            : "bg-surface/50 border-border hover:border-border hover:bg-elevated/50"
                                    )}
                                >
                                    <div className={cn(
                                        "h-10 w-10 rounded-[4px] flex items-center justify-center transition-colors",
                                        isSelected ? config.bg : "bg-elevated"
                                    )}>
                                        <DofusUiIcon name={picto} size={20} />
                                    </div>
                                    <span className={cn(
                                        "text-caption font-medium text-center leading-tight",
                                        isSelected ? config.text : "text-muted-foreground"
                                    )}>
                                        {config.shortLabel}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Preset badge */}
                    {currentConfig.preset.maxParticipants && selectedType !== "RAID_OFFICIAL" && (
                        <div className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg text-xs",
                            currentConfig.bg, currentConfig.border, "border"
                        )}>
                            <Info className={cn("h-3.5 w-3.5", currentConfig.text)} />
                            <span className="text-muted-foreground">
                                <span className={currentConfig.text}>Preset :</span> {currentConfig.preset.maxParticipants} places
                            </span>
                        </div>
                    )}

                    {/* ========== RAID SPECIFIC PANEL ========== */}
                    {selectedType === "RAID_OFFICIAL" && (
                        <div className="space-y-4 p-4 rounded-lg border border-danger/25 bg-danger/5">
                            <div className="flex items-center gap-2 mb-1">
                                <DofusUiIcon name="dungeon" size={16} />
                                <span className="text-xs font-black text-danger uppercase tracking-wider">Options Raid 3.6</span>
                            </div>

                            {/* Raid Subtype */}
                            <div className="space-y-2">
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Type de Raid</span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {RAID_TYPES.map(rt => (
                                        <button
                                            key={rt.id}
                                            type="button"
                                            onClick={() => handleRaidTypeChange(rt.id as "jardin" | "gigalodon")}
                                            aria-pressed={raidType === rt.id}
                                            className={cn(
                                                "group flex items-stretch gap-3 p-2.5 rounded-xl border-2 text-left transition-all",
                                                raidType === rt.id
                                                    ? "border-danger/50 bg-danger/5"
                                                    : "border-border bg-surface/50 hover:border-danger/30"
                                            )}
                                        >
                                            {/* Illustration SigilOS affichée ENTIÈRE : cadre 72×96 (ratio
                                                3:4 de l'image) + `object-contain` — rien n'est rogné. */}
                                            {rt.image && (
                                                <div className="relative shrink-0 h-24 w-[72px] overflow-hidden rounded-lg border border-border/60 bg-background/60">
                                                    <img 
                                                        src={rt.image} 
                                                        alt={rt.label}
                                                        className={cn(
                                                            "h-full w-full object-contain transition-transform duration-300",
                                                            raidType === rt.id ? "scale-[1.03]" : "scale-100 group-hover:scale-[1.03]"
                                                        )}
                                                    />
                                                    {/* Color Overlay for contrast */}
                                                    <div className={cn(
                                                        "pointer-events-none absolute inset-0 bg-gradient-to-t from-background/60 via-background/5 to-transparent",
                                                        raidType === rt.id ? "opacity-0" : "opacity-100"
                                                    )} />
                                                    
                                                    {/* Selection state */}
                                                    {raidType === rt.id && (
                                                        <div className="absolute inset-0 bg-danger/10" />
                                                    )}
                                                </div>
                                            )}

                                            <div className="relative flex min-w-0 flex-col justify-center">
                                                <DofusUiIcon name="boss" size={28} className="mb-1.5" />
                                                <span className="text-label font-black leading-tight uppercase tracking-tight text-foreground">{rt.short}</span>
                                                <span className={cn(
                                                    "text-caption font-bold uppercase tracking-widest mt-0.5",
                                                    raidType === rt.id ? "text-danger" : "text-muted-foreground"
                                                )}>{rt.min}–{rt.max} joueurs</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Captain */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                    <Crown className="h-3.5 w-3.5 text-warning" />
                                    Capitaine du Raid
                                </label>
                                <input
                                    type="text"
                                    placeholder="Pseudo Dofus du capitaine..."
                                    value={raidCaptain}
                                    onChange={e => setRaidCaptain(e.target.value)}
                                    className="w-full h-10 px-3 rounded-lg bg-background border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-danger/50"
                                />
                            </div>

                            {/* Open to external */}
                            <button
                                type="button"
                                onClick={() => setOpenToExternal(v => !v)}
                                className={cn(
                                    "w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all",
                                    openToExternal
                                        ? "bg-success/10 border-success/40"
                                        : "bg-surface/50 border-border"
                                )}
                            >
                                <div className="flex items-center gap-2.5">
                                    {openToExternal
                                        ? <Globe className="h-4 w-4 text-success" />
                                        : <Lock className="h-4 w-4 text-muted-foreground" />}
                                    <div className="text-left">
                                        <p className={cn(
                                            "text-xs font-black uppercase tracking-wider",
                                            openToExternal ? "text-success" : "text-muted-foreground"
                                        )}>
                                            {openToExternal ? "Ouvert aux extérieurs" : "Guilde uniquement"}
                                        </p>
                                        <p className="text-caption text-muted-foreground">
                                            {openToExternal ? "Joueurs hors guilde autorisés" : "Réservé aux membres"}
                                        </p>
                                    </div>
                                </div>
                                <div className={cn(
                                    "w-10 h-5 rounded-full transition-all relative",
                                    openToExternal ? "bg-success" : "bg-muted"
                                )}>
                                    <div className={cn(
                                        "absolute top-0.5 w-4 h-4 rounded-full bg-background shadow transition-all",
                                        openToExternal ? "left-5" : "left-0.5"
                                    )} />
                                </div>
                            </button>

                            {/* Role Restrict Selector when Guilde Uniquement */}
                            {!openToExternal && (
                                <div className="space-y-2 p-3 rounded-xl bg-background/80 border border-border animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div className="flex items-center justify-between">
                                        <label className="text-caption font-black text-foreground uppercase tracking-wider flex items-center gap-1.5">
                                            <Shield className="h-3.5 w-3.5 text-danger" />
                                            Rôles autorisés à s'inscrire
                                        </label>
                                        <span className="text-caption text-muted-foreground font-bold">
                                            {allowedRoleIds.length === 0 ? "Tous les membres (par défaut)" : `${allowedRoleIds.length} rôle(s) sélectionné(s)`}
                                        </span>
                                    </div>

                                    {isLoadingRoles ? (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                                            <Loader2 className="h-3.5 w-3.5 animate-spin text-danger" />
                                            Chargement des rôles Discord...
                                        </div>
                                    ) : whitelistedRoleIds.length > 0 && whitelistedRoles.length === 0 ? (
                                        <div className="flex flex-col gap-2 py-2">
                                            <p className="text-xs text-warning font-bold flex items-center gap-1.5">
                                                <AlertTriangle className="h-3 w-3" />
                                                Rôles whitelistés introuvables
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Les rôles configurés par l'admin ne sont plus disponibles sur ce serveur Discord.
                                                Tous les membres de la guilde peuvent s'inscrire par défaut.
                                            </p>
                                        </div>
                                    ) : whitelistedRoles.length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                            {whitelistedRoles.map(role => {
                                                const isSelected = allowedRoleIds.includes(role.id);
                                                return (
                                                    <button
                                                        key={role.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setAllowedRoleIds(prev =>
                                                                isSelected ? prev.filter(id => id !== role.id) : [...prev, role.id]
                                                            );
                                                        }}
                                                        className={cn(
                                                            "px-2.5 py-1 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5",
                                                            isSelected
                                                                ? "bg-danger/20 text-danger border-danger/40"
                                                                : "bg-surface text-muted-foreground border-border hover:border-border hover:text-foreground"
                                                        )}
                                                    >
                                                        <span
                                                            className="w-2 h-2 rounded-full shrink-0"
                                                            style={{ backgroundColor: role.color || "#ef4444" }}
                                                        />
                                                        {role.name}
                                                        {isSelected && <Check className="w-3 h-3 text-danger" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground italic py-1">
                                            Aucun rôle spécifique configuré. Tous les membres de la guilde peuvent s'inscrire.
                                        </p>
                                    )}

                                    <p className="text-caption text-muted-foreground italic mt-1">
                                        {allowedRoleIds.length === 0
                                            ? "Laissez vide pour autoriser tous les membres ayant accès aux raids."
                                            : "Seuls les membres possédant l'un de ces rôles pourront s'inscrire."}
                                    </p>
                                </div>
                            )}

                            {/* Creator eligibility warning box */}
                            {creatorRaidEligibility !== null && !creatorRaidEligibility.isEligible && (
                                <div className="flex flex-col gap-3 p-3.5 rounded-xl border border-danger/30 bg-danger/30 text-danger animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div className="flex items-start gap-2.5">
                                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-danger" />
                                        <div className="text-xs leading-relaxed">
                                            <span className="font-black uppercase tracking-wide">Création de raid bloquée</span>
                                            <br />
                                            <span className="text-danger/90">
                                                Pour créer et vous inscrire à un raid, vous devez posséder au moins <strong>30 🟣 (30 000 k)</strong> dans votre bourse de Kamas Violets.
                                                Votre solde actuel est de <strong>{creatorRaidEligibility.totalDonated.toLocaleString("fr-FR")} k</strong>.
                                            </span>
                                        </div>
                                    </div>
                                    <Link
                                        href={`/dashboard/${guildId}/missions#don-kamas`}
                                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-danger hover:bg-danger text-danger-foreground text-xs font-black uppercase tracking-wide transition-all w-full sm:w-fit"
                                    >
                                        <Coins className="h-4 w-4" />
                                        Faire mon don de kamas
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ============ TITLE (Hidden for raids) ============ */}
                {selectedType !== "RAID_OFFICIAL" && (
                    <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-foreground">Titre</FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="Ex: Raid Bethel - Farm clés"
                                        {...field}
                                        className="h-11 bg-background border border-border text-foreground focus:border-warning/50"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                {/* ============ DATE & TIME (unified row) ============ */}
                <div className="space-y-2">
                    <FormLabel className="text-foreground">Date et horaires</FormLabel>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <FormField
                            control={form.control}
                            name="date"
                            render={({ field }) => (
                                <FormItem>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant="outline"
                                                    className={cn(
                                                        "h-11 w-full justify-start text-left font-normal bg-background border border-border text-foreground hover:bg-surface",
                                                        !field.value && "text-muted-foreground"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4 text-warning" />
                                                    {field.value ? format(field.value, "d MMM", { locale: fr }) : "Date"}
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0 bg-surface border-border" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={field.value}
                                                onSelect={field.onChange}
                                                disabled={(date) => isBefore(startOfDay(date), startOfDay(new Date()))}
                                                initialFocus
                                                className="bg-surface"
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="startTime"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <div className="relative">
                                            <Clock className="absolute left-3 top-3.5 h-4 w-4 text-green-500" />
                                            <Input
                                                type="time"
                                                {...field}
                                                className="h-11 pl-10 bg-background border border-border text-foreground"
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="endTime"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <div className="relative">
                                            <Clock className="absolute left-3 top-3.5 h-4 w-4 text-danger" />
                                            <Input
                                                type="time"
                                                {...field}
                                                className="h-11 pl-10 bg-background border border-border text-foreground"
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

                {/* ============ MAX PARTICIPANTS ============ */}
                <FormField
                    control={form.control}
                    name="maxParticipants"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-foreground">Places max</FormLabel>
                            <FormControl>
                                {isRaid ? (
                                    // Locked for raids — value is fixed per raid type
                                    <div className="flex items-center gap-3 h-11 pl-4 pr-5 rounded-lg border border-warning/20 bg-warning/5 w-fit">
                                        <Users className="h-4 w-4 text-warning/70 shrink-0" />
                                        <span className="text-warning font-black text-lg tabular-nums">{field.value}</span>
                                        <span className="text-caption font-bold text-warning/50 uppercase tracking-widest ml-1">places (fixe)</span>
                                    </div>
                                ) : (
                                    <div className="relative w-48">
                                        <Users className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            placeholder="∞"
                                            {...field}
                                            value={field.value || ""}
                                            onChange={(e) => {
                                                const value = e.target.value.replace(/[^0-9]/g, "");
                                                const numValue = value ? parseInt(value) : undefined;
                                                field.onChange(numValue);
                                            }}
                                            className="h-11 pl-10 bg-background border border-border text-foreground"
                                        />
                                    </div>
                                )}
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* ============ DESCRIPTION ============ */}
                {selectedType !== "SESSION_MISSIONS" && (
                    <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-foreground">Description</FormLabel>
                                <FormControl>
                                    <Textarea
                                        placeholder="Détails, objectifs, pré-requis..."
                                        className="min-h-[70px] bg-background border border-border text-foreground resize-none"
                                        {...field}
                                        value={field.value || ""}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                {/* ============ MISSION PICKER (Conditional) ============ */}
                {selectedType === "SESSION_MISSIONS" && (
                    <div className="pt-2 animate-in fade-in slide-in-from-top-4 duration-300">
                        <MissionPicker
                            guildId={guildId}
                            selectedIds={selectedMissions}
                            onSelect={handleMissionSelect}
                        />
                    </div>
                )}

                {/* ============ NEXT BUTTON ============ */}
                <Button
                    type="button"
                    onClick={handleNextStep}
                    disabled={isRaid && creatorRaidEligibility !== null && !creatorRaidEligibility.isEligible}
                    className={cn(
                        "w-full h-12 font-bold text-base transition-all mt-4",
                        isRaid && creatorRaidEligibility !== null && !creatorRaidEligibility.isEligible
                            ? "bg-elevated border border-border text-muted-foreground cursor-not-allowed"
                            : "bg-warning hover:bg-warning text-warning-foreground"
                    )}
                >
                    {isRaid && creatorRaidEligibility !== null && !creatorRaidEligibility.isEligible ? (
                        <>
                            <Lock className="mr-2 h-5 w-5" />
                            Suivant (Don de Kamas requis)
                        </>
                    ) : (
                        "Suivant"
                    )}
                </Button>
            </div>
        )}

        {step === 2 && (
            <div className="space-y-6">
                {/* Header Recap */}
                <div className="flex items-center gap-4 bg-surface rounded-3xl p-5 border border-border relative overflow-hidden">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border relative z-10 bg-background border-border">
                        {currentConfig && <DofusUiIcon name={calendarEventTheme(selectedType).picto} size={24} />}
                    </div>
                    <div className="flex-1 min-w-0 relative z-10">
                        <p className="font-black text-foreground text-lg tracking-tight truncate leading-tight">
                            {form.watch("title") || currentConfig.shortLabel}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-caption font-black bg-warning/10 text-warning px-1.5 py-0.5 rounded border border-warning/20">
                                {format(form.watch("date"), "d MMM", { locale: fr })}
                            </span>
                            <span className="text-caption font-medium text-muted-foreground truncate">
                                {form.watch("startTime")} - {form.watch("endTime")}
                            </span>
                        </div>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setStep(1)} className="h-9 px-4 rounded-xl text-xs font-black text-muted-foreground hover:text-foreground bg-surface hover:bg-surface shrink-0 relative z-10">
                        RETOUR
                    </Button>
                </div>

                {/* ============ PUBLISH OPTION ============ */}
                <FormField
                    control={form.control}
                    name="publishOnDiscord"
                    render={({ field }) => (
                        <FormItem className="space-y-3">
                            <div className="flex flex-row items-center justify-between rounded-lg border border-border bg-surface p-4">
                                <div className="space-y-0.5">
                                    <FormLabel className="text-base text-foreground flex items-center gap-2">
                                        Publier sur Discord
                                    </FormLabel>
                                    <div className="text-sm text-muted-foreground">
                                        Envoie l'annonce sur le serveur.
                                    </div>
                                    {field.value && canPublishForType && (
                                        <div className="flex items-center gap-1 mt-2 animate-in fade-in">
                                            <Hash className="w-3.5 h-3.5 text-info/80" />
                                            <span className="text-caption text-info/90 font-bold uppercase tracking-widest">
                                                Sera posté dans #{targetChannelName}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <FormControl>
                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            disabled={!canPublishForType}
                                        />
                                    </div>
                                </FormControl>
                            </div>
                            {!canPublishForType && (
                                <p className="text-caption text-warning/80 font-bold uppercase tracking-tight italic px-2">
                                    {isRaid
                                        ? "⚠️ Salon Discord raid non configuré par l'admin. Publication impossible."
                                        : "⚠️ Salon Discord calendrier non configuré par l'admin. Publication impossible."}
                                </p>
                            )}
                        </FormItem>
                    )}
                />

                {/* ============ DISCORD ROLE MENTION (Conditional) ============ */}
                {form.watch("publishOnDiscord") && discordRoles.length > 0 && (
                    <FormField
                        control={form.control}
                        name="mentionRoleIds"
                        render={({ field }) => (
                            <FormItem className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-warning/8 border border-warning/20">
                                    <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                                    <p className="text-caption text-warning/80 font-medium leading-relaxed">
                                        <span className="font-bold text-warning">Aucun ping par défaut.</span> Sans sélection, personne ne sera notifié. Choisissez un ou plusieurs rôles pour que ton événement soit visible.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 mb-1 ml-1">
                                    <Hash className="h-3.5 w-3.5 text-info" />
                                    <span className="text-caption font-black text-info/80 uppercase tracking-widest">Mentionner un rôle (Ping)</span>
                                </div>
                                <Popover open={roleOpen} onOpenChange={setRoleOpen}>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={roleOpen}
                                                className="h-14 bg-background/50 border-border text-sm font-bold rounded-2xl justify-between group/role w-full hover:bg-background px-4"
                                            >
                                                <div className="flex items-center gap-3 truncate">
                                                    {field.value && field.value.length > 0 ? (
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            {field.value.slice(0, 3).map((id: string) => {
                                                                const role = discordRoles.find(r => r.id === id);
                                                                if (!role) return null;
                                                                const roleColor = role.color === "#000000" ? "#9ca3af" : (role.color || "#9ca3af");
                                                                return (
                                                                    <div 
                                                                        key={id} 
                                                                        className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg border transition-all"
                                                                        style={{ 
                                                                            backgroundColor: `${roleColor}15`, 
                                                                            borderColor: `${roleColor}40`,
                                                                            color: roleColor 
                                                                        }}
                                                                    >
                                                                        <div 
                                                                            className="w-1.5 h-1.5 rounded-full shrink-0 " 
                                                                            style={{ backgroundColor: roleColor }} 
                                                                        />
                                                                        <span className="text-caption font-bold uppercase truncate max-w-[80px]">{role.name}</span>
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                field.onChange(field.value?.filter((rid: string) => rid !== id));
                                                                            }}
                                                                            className="ml-0.5 hover:bg-elevated rounded-full p-0.5 transition-colors"
                                                                        >
                                                                            <X className="h-2.5 w-2.5" />
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })}
                                                            {field.value.length > 3 && (
                                                                <span className="text-caption font-bold text-muted-foreground uppercase tracking-wide px-1.5">
                                                                    +{field.value.length - 3} rôles
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground italic">Aucun ping (recommandé si petit besoin)</span>
                                                    )}
                                                </div>
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-background border border-border rounded-2xl overflow-hidden" align="center" sideOffset={8}>
                                        <Command className="bg-transparent text-foreground">
                                            <CommandInput placeholder="Rechercher un rôle..." className="h-12 border-none focus:ring-0 text-sm" />
                                            <CommandList className="max-h-[320px] premium-scrollbar p-2">
                                                <CommandEmpty>Aucun rôle.</CommandEmpty>
                                                <CommandGroup>
                                                    <CommandItem
                                                        onSelect={() => {
                                                            field.onChange([]);
                                                        }}
                                                        className="text-muted-foreground italic focus:bg-surface cursor-pointer text-xs py-3 px-3 rounded-xl flex items-center justify-between group"
                                                    >
                                                        <span>Aucun ping</span>
                                                        {(!field.value || field.value.length === 0) && <Check className="h-4 w-4 text-warning" />}
                                                    </CommandItem>
                                                    {pingAllowedRoles.map((role) => (
                                                        <CommandItem
                                                            key={role.id}
                                                            value={role.name}
                                                            onSelect={() => {
                                                                const current = field.value || [];
                                                                const next = current.includes(role.id)
                                                                    ? current.filter(id => id !== role.id)
                                                                    : [...current, role.id];
                                                                field.onChange(next);
                                                            }}
                                                            className="focus:bg-surface cursor-pointer text-xs py-3 px-3 rounded-xl flex items-center justify-between group"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div 
                                                                    className="w-3 h-3 rounded-full shrink-0" 
                                                                    style={{ backgroundColor: role.color === "#000000" ? "#9ca3af" : (role.color || "#9ca3af") }} 
                                                                />
                                                                <span className="font-bold text-foreground group-hover:text-foreground transition-colors uppercase tracking-tight">{role.name}</span>
                                                            </div>
                                                            {field.value?.includes(role.id) && <Check className="h-4 w-4 text-warning" />}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                                <PingEstimate guildId={guildId} roleIds={field.value || []} className="ml-1" />
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                {/* ============ SUBMIT ============ */}
                <div className="flex items-center gap-3 mt-4">
                    <Button
                        type="submit"
                        disabled={submitting || (isRaid && creatorRaidEligibility !== null && !creatorRaidEligibility.isEligible)}
                        className={cn(
                            "w-full h-12 font-bold text-base transition-all",
                            isRaid && creatorRaidEligibility !== null && !creatorRaidEligibility.isEligible
                                ? "bg-elevated border border-border text-muted-foreground cursor-not-allowed"
                                : "bg-warning hover:bg-warning text-warning-foreground"
                        )}
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Création...
                            </>
                        ) : isRaid && creatorRaidEligibility !== null && !creatorRaidEligibility.isEligible ? (
                            <>
                                <Lock className="mr-2 h-5 w-5" />
                                Création bloquée
                            </>
                        ) : (
                            <>
                                {currentConfig && <DofusUiIcon name={calendarEventTheme(selectedType).picto} size={20} className="mr-2" />}
                                {initialData ? "Enregistrer" : "Créer l'événement"}
                            </>
                        )}
                    </Button>
                </div>
            </div>
        )}
    </form>
</Form>
    );
}

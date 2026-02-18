"use client";

/**
 * EventForm V3 - Fixed Date Handling + 4 Types
 * Types: RAID_OFFICIAL, EVENT_GUILD, SESSION_MISSIONS, SORTIE_FARM
 */

import { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parse, addHours, isBefore } from "date-fns";
import { fr } from "date-fns/locale";
import {
    Calendar as CalendarIcon,
    Clock,
    Loader2,
    Users,
    Swords,
    PartyPopper,
    Target,
    Wheat,
    Info,
    AlertTriangle,
    Diamond
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

// ============================================
// 4 EVENT TYPES (Almanax removed)
// ============================================

interface TypeConfig {
    label: string;
    shortLabel: string;
    icon: React.ElementType;
    gradient: string;
    bg: string;
    border: string;
    text: string;
    preset: {
        defaultDuration: number;
        maxParticipants?: number;
    };
}

const TYPE_CONFIG: Record<string, TypeConfig> = {
    RAID_OFFICIAL: {
        label: "Raid Officiel 3.6",
        shortLabel: "Raid 3.6",
        icon: Swords,
        gradient: "from-red-600 to-rose-600",
        bg: "bg-red-500/10",
        border: "border-red-500/30",
        text: "text-red-400",
        preset: { defaultDuration: 3, maxParticipants: 12 }
    },
    EVENT_GUILD: {
        label: "Event Guilde (Mini-jeux)",
        shortLabel: "Event Guilde",
        icon: PartyPopper,
        gradient: "from-purple-600 to-fuchsia-600",
        bg: "bg-purple-500/10",
        border: "border-purple-500/30",
        text: "text-purple-400",
        preset: { defaultDuration: 2 }
    },
    SESSION_MISSIONS: {
        label: "Missions Guilde",
        shortLabel: "Missions Guilde",
        icon: Target,
        gradient: "from-amber-600 to-orange-600",
        bg: "bg-amber-500/10",
        border: "border-amber-500/30",
        text: "text-amber-400",
        preset: { defaultDuration: 4, maxParticipants: 8 }
    },
    SORTIE_FARM: {
        label: "Sortie Farm / Drop",
        shortLabel: "Sortie Farm",
        icon: Wheat,
        gradient: "from-emerald-600 to-green-600",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/30",
        text: "text-emerald-400",
        preset: { defaultDuration: 2 }
    },
    OTHERS: {
        label: "Autres activités",
        shortLabel: "Autres",
        icon: Diamond,
        gradient: "from-slate-600 to-zinc-600",
        bg: "bg-slate-500/10",
        border: "border-slate-500/30",
        text: "text-slate-400",
        preset: { defaultDuration: 2 }
    },
};

const EVENT_TYPES = Object.keys(TYPE_CONFIG);

// ============================================
// ZOD SCHEMA with better date validation
// ============================================

const eventFormSchema = z.object({
    title: z.string().min(3, "Le titre doit faire au moins 3 caractères").max(100),
    description: z.string().max(2000).optional(),
    type: z.string(),
    date: z.date({ required_error: "Date requise" }),
    startTime: z.string().min(5, "Heure requise"),
    endTime: z.string().min(5, "Heure requise"),
    maxParticipants: z.coerce.number().min(1).optional().nullable(),
    publishOnDiscord: z.boolean().optional(),
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

interface EventFormProps {
    initialData?: any;
    onSubmit: (data: any) => Promise<void>;
}

export function EventForm({ initialData, onSubmit }: EventFormProps) {
    const [submitting, setSubmitting] = useState(false);
    // Fallback to EVENT_GUILD for unknown types
    const validType = initialData?.type && TYPE_CONFIG[initialData.type] ? initialData.type : "EVENT_GUILD";
    const [selectedType, setSelectedType] = useState<string>(validType);

    const form = useForm<EventFormValues>({
        resolver: zodResolver(eventFormSchema),
        defaultValues: initialData ? {
            title: initialData.title || "",
            description: initialData.description || "",
            type: validType,
            date: new Date(initialData.startDate),
            startTime: format(new Date(initialData.startDate), "HH:mm"),
            endTime: format(new Date(initialData.endDate), "HH:mm"),
            maxParticipants: initialData.maxParticipants || undefined,
            publishOnDiscord: false, // Default to false when editing
        } : {
            title: "",
            description: "",
            type: "EVENT_GUILD",
            date: new Date(),
            startTime: "20:00",
            endTime: "22:00",
            maxParticipants: undefined,
            publishOnDiscord: true,
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
        if (!initialData && startTime) {
            const config = TYPE_CONFIG[selectedType];
            if (config) {
                updateEndTime(startTime, config.preset.defaultDuration);
            }
        }
    }, [startTime, selectedType, initialData]);

    const handleFormSubmit = async (values: EventFormValues) => {
        setSubmitting(true);
        try {
            // Build proper dates
            const dateStr = format(values.date, "yyyy-MM-dd");
            const startDate = new Date(`${dateStr}T${values.startTime}:00`);
            const endDate = new Date(`${dateStr}T${values.endTime}:00`);

            // If end time is before start time, assume next day
            if (endDate <= startDate) {
                endDate.setDate(endDate.getDate() + 1);
            }

            const submissionData = {
                title: values.title,
                description: values.description,
                type: values.type,
                startDate,
                endDate,
                maxParticipants: values.maxParticipants || null,
                publishOnDiscord: values.publishOnDiscord,
            };

            await onSubmit(submissionData);
        } catch (error) {
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    const currentConfig = TYPE_CONFIG[selectedType] || TYPE_CONFIG.EVENT_GUILD;

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-5">
                {/* ============ TYPE SELECTOR (4 types) ============ */}
                <div className="space-y-3">
                    <FormLabel className="text-sm font-medium text-zinc-300">
                        Type d'événement
                    </FormLabel>
                    <div className="grid grid-cols-5 gap-2">
                        {EVENT_TYPES.map((type) => {
                            const config = TYPE_CONFIG[type];
                            const Icon = config.icon;
                            const isSelected = selectedType === type;

                            return (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => handleTypeChange(type)}
                                    className={cn(
                                        "relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all",
                                        isSelected
                                            ? cn(config.bg, config.border, "ring-2 ring-offset-2 ring-offset-zinc-900", config.border.replace("border-", "ring-"))
                                            : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50"
                                    )}
                                >
                                    <div className={cn(
                                        "h-10 w-10 rounded-lg flex items-center justify-center transition-all",
                                        isSelected
                                            ? cn("bg-gradient-to-br", config.gradient, "shadow-lg")
                                            : "bg-zinc-800"
                                    )}>
                                        <Icon className={cn(
                                            "h-5 w-5 transition-colors",
                                            isSelected ? "text-white" : "text-zinc-400"
                                        )} />
                                    </div>
                                    <span className={cn(
                                        "text-[11px] font-medium text-center leading-tight",
                                        isSelected ? config.text : "text-zinc-400"
                                    )}>
                                        {config.shortLabel}
                                    </span>
                                    {isSelected && (
                                        <div className={cn(
                                            "absolute -top-1 -right-1 h-3 w-3 rounded-full",
                                            "bg-gradient-to-br", config.gradient
                                        )} />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Preset badge */}
                    {currentConfig.preset.maxParticipants && (
                        <div className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg text-xs",
                            currentConfig.bg, currentConfig.border, "border"
                        )}>
                            <Info className={cn("h-3.5 w-3.5", currentConfig.text)} />
                            <span className="text-zinc-400">
                                <span className={currentConfig.text}>Preset :</span> {currentConfig.preset.maxParticipants} places
                            </span>
                        </div>
                    )}
                </div>

                {/* ============ TITLE ============ */}
                <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-zinc-300">Titre</FormLabel>
                            <FormControl>
                                <Input
                                    placeholder="Ex: Raid Bethel - Farm clés"
                                    {...field}
                                    className="h-11 bg-zinc-900/50 border-zinc-800 text-zinc-100 focus:border-amber-500/50"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* ============ DATE & TIME (unified row) ============ */}
                <div className="space-y-2">
                    <FormLabel className="text-zinc-300">Date et horaires</FormLabel>
                    <div className="grid grid-cols-3 gap-3">
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
                                                        "h-11 w-full justify-start text-left font-normal bg-zinc-900/50 border-zinc-800 text-zinc-100 hover:bg-zinc-800/80",
                                                        !field.value && "text-muted-foreground"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4 text-amber-500" />
                                                    {field.value ? format(field.value, "d MMM", { locale: fr }) : "Date"}
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={field.value}
                                                onSelect={field.onChange}
                                                disabled={(date) => date < new Date() && date.toDateString() !== new Date().toDateString()}
                                                initialFocus
                                                className="bg-zinc-900"
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
                                                className="h-11 pl-10 bg-zinc-900/50 border-zinc-800 text-zinc-100"
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
                                            <Clock className="absolute left-3 top-3.5 h-4 w-4 text-red-400" />
                                            <Input
                                                type="time"
                                                {...field}
                                                className="h-11 pl-10 bg-zinc-900/50 border-zinc-800 text-zinc-100"
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
                            <FormLabel className="text-zinc-300">Places max</FormLabel>
                            <FormControl>
                                <div className="relative w-48">
                                    <Users className="absolute left-3 top-3.5 h-4 w-4 text-zinc-500" />
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

                                            // Strict limit for Raids
                                            if (selectedType === "RAID_OFFICIAL" && numValue && numValue > 16) {
                                                field.onChange(16);
                                                return;
                                            }

                                            field.onChange(numValue);
                                        }}
                                        className="h-11 pl-10 bg-zinc-900/50 border-zinc-800 text-zinc-100"
                                    />
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* ============ PUBLISH OPTION ============ */}
                <FormField
                    control={form.control}
                    name="publishOnDiscord"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border bg-background/50 p-4">
                            <div className="space-y-0.5">
                                <FormLabel className="text-base text-zinc-100">
                                    Publier sur Discord
                                </FormLabel>
                                <div className="text-sm text-zinc-400">
                                    Envoie immédiatement l'annonce dans le canal configuré.
                                </div>
                            </div>
                            <FormControl>
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </div>
                            </FormControl>
                        </FormItem>
                    )}
                />

                {/* ============ DESCRIPTION ============ */}
                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-zinc-300">Description</FormLabel>
                            <FormControl>
                                <Textarea
                                    placeholder="Détails, objectifs, pré-requis..."
                                    className="min-h-[70px] bg-zinc-900/50 border-zinc-800 text-zinc-100 resize-none"
                                    {...field}
                                    value={field.value || ""}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* ============ SUBMIT ============ */}
                <Button
                    type="submit"
                    disabled={submitting}
                    className={cn(
                        "w-full h-12 font-bold text-base transition-all",
                        "bg-gradient-to-r from-amber-500 to-orange-500",
                        "hover:from-amber-400 hover:to-orange-400",
                        "shadow-lg shadow-amber-500/20",
                        "text-zinc-950"
                    )}
                >
                    {submitting ? (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Création...
                        </>
                    ) : (
                        <>
                            {currentConfig && <currentConfig.icon className="mr-2 h-5 w-5" />}
                            {initialData ? "Enregistrer" : "Créer l'événement"}
                        </>
                    )}
                </Button>
            </form>
        </Form>
    );
}

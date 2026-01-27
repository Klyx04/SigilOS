"use client";

import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock, Loader2 } from "lucide-react";
import {
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const eventFormSchema = z.object({
    title: z.string().min(3, "Le titre doit faire au moins 3 caractères").max(100),
    description: z.string().max(1000).optional(),
    type: z.enum(["GUILD_MISSION", "SONGES_RUN", "DUNGEON_FARM", "SOCIAL", "OFFICIAL_RESET"]),
    startDate: z.date({ required_error: "Date de début requise" }),
    startTime: z.string().min(5, "Heure requise"),
    endDate: z.date({ required_error: "Date de fin requise" }),
    endTime: z.string().min(5, "Heure requise"),
    location: z.string().max(100).optional(),
    maxAttendees: z.any().optional(),
});

type EventFormValues = z.infer<typeof eventFormSchema>;

interface EventFormProps {
    initialData?: any;
    onSubmit: (data: any) => Promise<void>;
}

export function EventForm({ initialData, onSubmit }: EventFormProps) {
    const [submitting, setSubmitting] = useState(false);

    const form = useForm<EventFormValues>({
        resolver: zodResolver(eventFormSchema),
        defaultValues: initialData ? {
            ...initialData,
            startTime: format(new Date(initialData.startDate), "HH:mm"),
            endTime: format(new Date(initialData.endDate), "HH:mm"),
            maxAttendees: initialData.maxAttendees?.toString() || "",
        } : {
            title: "",
            description: "",
            type: "SOCIAL",
            startDate: new Date(),
            startTime: "20:00",
            endDate: new Date(),
            endTime: "22:00",
            location: "",
            maxAttendees: "",
        },
    });

    const handleFormSubmit = async (values: any) => {
        setSubmitting(true);
        try {
            // Combine date and time
            const startStr = `${format(values.startDate as Date, "yyyy-MM-dd", { locale: fr })}T${values.startTime}:00`;
            const endStr = `${format(values.endDate as Date, "yyyy-MM-dd", { locale: fr })}T${values.endTime}:00`;

            const submissionData = {
                title: values.title,
                description: values.description,
                type: values.type,
                startDate: new Date(startStr),
                endDate: new Date(endStr),
                location: values.location,
                maxAttendees: values.maxAttendees === "" || values.maxAttendees === null || values.maxAttendees === undefined
                    ? null
                    : Number(values.maxAttendees),
            };

            await onSubmit(submissionData);
        } catch (error) {
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <DialogContent className="bg-zinc-950 border-zinc-800 sm:max-w-[500px]">
            <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-amber-500">
                    {initialData ? "Modifier l'événement" : "Nouvel événement"}
                </DialogTitle>
                <DialogDescription className="text-zinc-400">
                    Planifiez une activité pour la guilde
                </DialogDescription>
            </DialogHeader>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4">
                    <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-zinc-300">Titre</FormLabel>
                                <FormControl>
                                    <Input placeholder="Ex: Farm DJ Merkator" {...field} className="bg-zinc-900 border-zinc-800 text-zinc-100" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-zinc-300">Type</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100">
                                                <SelectValue placeholder="Social" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                                            <SelectItem value="SOCIAL">Social / Évent</SelectItem>
                                            <SelectItem value="GUILD_MISSION">Mission de Guilde</SelectItem>
                                            <SelectItem value="SONGES_RUN">Run Songes</SelectItem>
                                            <SelectItem value="DUNGEON_FARM">Farm Donjon</SelectItem>
                                            <SelectItem value="OFFICIAL_RESET">Reset Hebdo</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="maxAttendees"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-zinc-300">Places Max</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="Illimité" {...field} value={field.value || ""} className="bg-zinc-900 border-zinc-800 text-zinc-100" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="startDate"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-zinc-300">Date de début</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn(
                                                        "w-full pl-3 text-left font-normal bg-zinc-900 border-zinc-800 text-zinc-100 hover:bg-zinc-800",
                                                        !field.value && "text-muted-foreground"
                                                    )}
                                                >
                                                    {field.value ? (
                                                        format(field.value, "PPP", { locale: fr })
                                                    ) : (
                                                        <span>Choisir</span>
                                                    )}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={field.value}
                                                onSelect={field.onChange}
                                                initialFocus
                                                className="bg-zinc-900 text-zinc-100"
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
                                    <FormLabel className="text-zinc-300">Heure</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Input type="time" {...field} className="bg-zinc-900 border-zinc-800 text-zinc-100" />
                                            <Clock className="absolute right-3 top-2.5 h-4 w-4 text-zinc-500" />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <FormField
                        control={form.control}
                        name="location"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-zinc-300">Lieu (Optionnel)</FormLabel>
                                <FormControl>
                                    <Input placeholder="Ex: Salon Vocal Discord" {...field} value={field.value || ""} className="bg-zinc-900 border-zinc-800 text-zinc-100" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-zinc-300">Description</FormLabel>
                                <FormControl>
                                    <Textarea
                                        placeholder="Détails de l'expédition..."
                                        className="bg-zinc-900 border-zinc-800 text-zinc-100 resize-none h-20"
                                        {...field}
                                        value={field.value || ""}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <DialogFooter className="pt-4">
                        <Button
                            type="submit"
                            disabled={submitting}
                            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold"
                        >
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {initialData ? "Enregistrer" : "Créer l'événement"}
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    );
}

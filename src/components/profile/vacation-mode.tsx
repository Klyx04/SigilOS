"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Palmtree, Bell, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { sendVacationNotification } from "@/server/actions/profile-actions";

interface VacationModeProps {
    vacationStart?: Date | null;
    vacationEnd?: Date | null;
    vacationNotify?: boolean;
    onSave?: (data: { start: Date | null; end: Date | null; notify: boolean; noEndDate: boolean }) => void;
    readOnly?: boolean;
    guildId?: string;
    pseudo?: string;
    profileId?: string;
}

export function VacationMode({
    vacationStart,
    vacationEnd,
    vacationNotify = false,
    onSave,
    readOnly = false,
    guildId,
    pseudo,
    profileId,
}: VacationModeProps) {
    const [startDate, setStartDate] = useState<Date | undefined>(vacationStart ?? undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(vacationEnd ?? undefined);
    const [notify, setNotify] = useState(vacationNotify);
    const [noEndDate, setNoEndDate] = useState(!vacationEnd && !!vacationStart);
    const [isSending, setIsSending] = useState(false);

    const now = new Date();
    const isOnVacation = vacationStart && vacationStart <= now && (!vacationEnd || vacationEnd >= now);

    const handleSave = () => {
        onSave?.({
            start: startDate ?? null,
            end: noEndDate ? null : (endDate ?? null),
            notify,
            noEndDate,
        });
    };

    const handleClear = () => {
        setStartDate(undefined);
        setEndDate(undefined);
        setNotify(false);
        setNoEndDate(false);
        onSave?.({ start: null, end: null, notify: false, noEndDate: false });
    };

    const handleSendNotification = async () => {
        if (!guildId || !pseudo || !profileId) return;

        setIsSending(true);
        try {
            const result = await sendVacationNotification({
                guildId,
                pseudo,
                profileId,
                startDate: startDate?.toISOString() ?? null,
                endDate: noEndDate ? null : (endDate?.toISOString() ?? null),
            });

            if (result.success) {
                toast.success("Notification envoyée sur Discord !");
            } else {
                toast.error(result.error || "Erreur lors de l'envoi");
            }
        } catch {
            toast.error("Erreur de connexion");
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="p-6 bg-zinc-900/60 rounded-2xl border border-white/5">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Palmtree className="w-5 h-5 text-cyan-400" />
                    <h3 className="text-sm font-medium text-zinc-400">Mode Vacances</h3>
                </div>
                {isOnVacation && (
                    <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
                        Actif
                    </Badge>
                )}
            </div>

            {readOnly ? (
                // Read-only display
                <div className="space-y-2">
                    {isOnVacation ? (
                        <>
                            <p className="text-sm text-zinc-300">
                                En vacances depuis le{" "}
                                <span className="font-medium">
                                    {format(vacationStart!, "d MMMM yyyy", { locale: fr })}
                                </span>
                            </p>
                            {vacationEnd ? (
                                <p className="text-sm text-zinc-300">
                                    Retour prévu le{" "}
                                    <span className="font-medium">
                                        {format(vacationEnd, "d MMMM yyyy", { locale: fr })}
                                    </span>
                                </p>
                            ) : (
                                <p className="text-sm text-zinc-500">Pas de date de retour prévue</p>
                            )}
                        </>
                    ) : (
                        <p className="text-sm text-zinc-500">Pas de vacances prévues</p>
                    )}
                </div>
            ) : (
                // Editable mode
                <div className="space-y-4">
                    {/* Start Date */}
                    <div className="space-y-2">
                        <Label>Date de début</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !startDate && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {startDate ? format(startDate, "PPP", { locale: fr }) : "Sélectionner"}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={startDate}
                                    onSelect={setStartDate}
                                    locale={fr}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* No End Date Toggle */}
                    <div className="flex items-center space-x-2">
                        <Switch
                            id="no-end-date"
                            checked={noEndDate}
                            onCheckedChange={setNoEndDate}
                        />
                        <Label htmlFor="no-end-date" className="text-sm text-zinc-400">
                            Pas de date de retour prévue
                        </Label>
                    </div>

                    {/* End Date */}
                    {!noEndDate && (
                        <div className="space-y-2">
                            <Label>Date de retour</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !endDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {endDate ? format(endDate, "PPP", { locale: fr }) : "Sélectionner"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={endDate}
                                        onSelect={setEndDate}
                                        locale={fr}
                                        disabled={(date) => startDate ? date < startDate : false}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                        <Button onClick={handleSave} className="flex-1">
                            Enregistrer
                        </Button>
                        {(startDate || endDate) && (
                            <Button variant="outline" onClick={handleClear}>
                                Effacer
                            </Button>
                        )}
                    </div>

                    {/* Discord Notification Button */}
                    {startDate && guildId && profileId && (
                        <Button
                            variant="outline"
                            onClick={handleSendNotification}
                            disabled={isSending}
                            className="w-full mt-2 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                        >
                            {isSending ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Bell className="w-4 h-4 mr-2" />
                            )}
                            Notifier sur Discord
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

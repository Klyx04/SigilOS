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
import { Input } from "@/components/ui/input";
import { sendVacationNotification } from "@/server/actions/profile-actions";

interface VacationModeProps {
    vacationStart?: Date | null;
    vacationEnd?: Date | null;
    vacationNotify?: boolean;
    vacationReason?: string | null;
    onSave?: (data: { start: Date | null; end: Date | null; notify: boolean; noEndDate: boolean; reason: string | null }) => void;
    readOnly?: boolean;
    guildId?: string;
    pseudo?: string;
    profileId?: string;
    hasAbsenceChannel?: boolean;
}

export function VacationMode({
    vacationStart,
    vacationEnd,
    vacationNotify = false,
    vacationReason,
    onSave,
    readOnly = false,
    guildId,
    pseudo,
    profileId,
    hasAbsenceChannel = false,
}: VacationModeProps) {
    const [startDate, setStartDate] = useState<Date | undefined>(vacationStart ?? undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(vacationEnd ?? undefined);
    const [notify, setNotify] = useState(vacationNotify);
    const [reason, setReason] = useState(vacationReason || "");
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
            reason: reason || null,
        });
    };

    const handleClear = () => {
        setStartDate(undefined);
        setEndDate(undefined);
        setNotify(false);
        setNoEndDate(false);
        setReason("");
        onSave?.({ start: null, end: null, notify: false, noEndDate: false, reason: null });
    };

    const handleQuickPreset = (days: number) => {
        const start = new Date();
        const end = new Date();
        end.setDate(end.getDate() + days);
        setStartDate(start);
        setEndDate(end);
        setNoEndDate(false);
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
                reason: reason || null,
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
        <div className="p-4 bg-black/20 backdrop-blur-md rounded-xl border border-white/10">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Palmtree className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-medium text-zinc-400">Mode Vacances</h3>
                </div>
                {isOnVacation && (
                    <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 px-1.5 py-0 h-5 text-[10px]">
                        Actif
                    </Badge>
                )}
            </div>

            {readOnly ? (
                // Read-only display
                <div className="space-y-1">
                    {isOnVacation ? (
                        <>
                            <p className="text-sm text-zinc-300 flex items-center gap-2">
                                <span className="text-zinc-500 text-xs w-16">Départ :</span>
                                <span className="font-medium">
                                    {format(vacationStart!, "d MMM yyyy", { locale: fr })}
                                </span>
                            </p>
                            {vacationEnd ? (
                                <p className="text-sm text-zinc-300 flex items-center gap-2">
                                    <span className="text-zinc-500 text-xs w-16">Retour :</span>
                                    <span className="font-medium">
                                        {format(vacationEnd, "d MMM yyyy", { locale: fr })}
                                    </span>
                                </p>
                            ) : (
                                <p className="text-xs text-zinc-500 italic">Pas de date de retour prévue</p>
                            )}
                            {vacationReason && (
                                <p className="text-xs text-zinc-400 italic mt-1 break-words bg-black/20 p-2 rounded border border-white/5">Motif: {vacationReason}</p>
                            )}
                        </>
                    ) : (
                        <p className="text-xs text-zinc-500 italic">Pas de vacances prévues</p>
                    )}
                </div>
            ) : (
                // Editable mode
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        {/* Start Date */}
                        <div className="space-y-1">
                            <Label className="text-xs text-zinc-500">Début</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className={cn(
                                            "w-full justify-start text-left font-normal h-8 text-xs",
                                            !startDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-3 w-3" />
                                        {startDate ? format(startDate, "P", { locale: fr }) : "Choisir"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={startDate}
                                        onSelect={setStartDate}
                                        locale={fr}
                                        disabled={(date) => {
                                            const today = new Date();
                                            today.setHours(0, 0, 0, 0);
                                            return date < today;
                                        }}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* End Date */}
                        <div className="space-y-1">
                            <Label className="text-xs text-zinc-500">Retour</Label>
                            {noEndDate ? (
                                <div className="h-8 flex items-center text-xs text-zinc-600 italic border border-transparent px-3">
                                    Indéterminé
                                </div>
                            ) : (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className={cn(
                                                "w-full justify-start text-left font-normal h-8 text-xs",
                                                !endDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-3 w-3" />
                                            {endDate ? format(endDate, "P", { locale: fr }) : "Choisir"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={endDate}
                                            onSelect={setEndDate}
                                            locale={fr}
                                            disabled={(date) => {
                                                const today = new Date();
                                                today.setHours(0, 0, 0, 0);
                                                if (date < today) return true;
                                                if (startDate && date < startDate) return true;
                                                return false;
                                            }}
                                        />
                                    </PopoverContent>
                                </Popover>
                            )}
                        </div>
                    </div>

                    {/* No End Date Toggle */}
                    <div className="flex items-center space-x-2">
                        <Switch
                            id="no-end-date"
                            checked={noEndDate}
                            onCheckedChange={setNoEndDate}
                            className="scale-75 origin-left"
                        />
                        <Label htmlFor="no-end-date" className="text-xs text-zinc-400">
                            Durée indéterminée
                        </Label>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex items-center gap-1.5 pt-1">
                        <Button variant="outline" size="sm" onClick={() => handleQuickPreset(2)} className="h-6 text-[10px] px-2 border-white/10 hover:bg-white/10">Weekend</Button>
                        <Button variant="outline" size="sm" onClick={() => handleQuickPreset(7)} className="h-6 text-[10px] px-2 border-white/10 hover:bg-white/10">1 Semaine</Button>
                        <Button variant="outline" size="sm" onClick={() => handleQuickPreset(30)} className="h-6 text-[10px] px-2 border-white/10 hover:bg-white/10">1 Mois</Button>
                    </div>

                    {/* Reason */}
                    <div className="space-y-1">
                        <Label className="text-xs text-zinc-500">Motif (Optionnel)</Label>
                        <Input 
                            value={reason} 
                            onChange={(e) => setReason(e.target.value)} 
                            placeholder="Ex: Déplacement pro, Vacances d'été..." 
                            className="h-8 text-xs bg-white/5 border-white/10"
                        />
                    </div>

                    {isOnVacation && (
                        <div className="pt-2">
                            <Button onClick={handleClear} size="sm" className="w-full h-8 text-xs bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30">
                                Je suis de retour !
                            </Button>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 border-t border-white/5 pt-2">
                        <Button onClick={handleSave} size="sm" className="flex-1 h-7 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold">
                            Enregistrer
                        </Button>
                        {(startDate || endDate) && (
                            <Button variant="ghost" size="sm" onClick={handleClear} className="h-7 text-xs">
                                Effacer
                            </Button>
                        )}
                    </div>

                    {/* Discord Notification Button */}
                    {startDate && guildId && profileId && (
                        hasAbsenceChannel ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleSendNotification}
                                disabled={isSending}
                                className="w-full h-7 text-xs border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300"
                            >
                                {isSending ? (
                                    <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                                ) : (
                                    <Bell className="w-3 h-3 mr-2" />
                                )}
                                Notifier sur Discord
                            </Button>
                        ) : (
                            <div className="w-full h-7 flex items-center justify-center text-[10px] text-zinc-500 italic bg-black/20 rounded border border-white/5">
                                Salon Discord non configuré
                            </div>
                        )
                    )}
                </div>
            )}
        </div>
    );
}

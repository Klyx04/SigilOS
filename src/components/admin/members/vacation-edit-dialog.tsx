"use client";

import { useState } from "react";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { VacationMode } from "@/components/profile/vacation-mode";
import { updateVacationMode } from "@/server/actions/profile-actions";
import { toast } from "sonner";
import { CalendarClock, Palmtree } from "lucide-react";

interface VacationEditDialogProps {
    guildId: string;
    profileId: string;
    userId: string;
    memberName: string;
    initialVacationStart: string | null;
    initialVacationEnd: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: (start: string | null, end: string | null) => void;
}

export function VacationEditDialog({
    guildId,
    profileId,
    userId,
    memberName,
    initialVacationStart,
    initialVacationEnd,
    open,
    onOpenChange,
    onSuccess
}: VacationEditDialogProps) {
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async (data: { start: Date | null; end: Date | null; notify: boolean; noEndDate: boolean }) => {
        setIsSaving(true);
        try {
            const startStr = data.start?.toISOString() ?? null;
            const endStr = data.noEndDate ? null : (data.end?.toISOString() ?? null);
            
            const res = await updateVacationMode({
                guildId,
                vacationStart: startStr,
                vacationEnd: endStr,
                vacationNotify: data.notify,
                targetUserId: userId
            });

            if (res.success) {
                toast.success("Dates de vacances mises à jour !");
                onSuccess?.(startStr, endStr);
                onOpenChange(false);
            } else {
                toast.error(res.error || "Une erreur est survenue");
            }
        } catch (error) {
            toast.error("Erreur de communication avec le serveur");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="gap-0 overflow-hidden rounded-lg border-border bg-background p-0 sm:max-w-[425px]">
                <div className="p-5 pb-2">
                    <DialogHeader>
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-info/30 bg-info/10">
                            <Palmtree className="h-5 w-5 text-info" aria-hidden="true" />
                        </div>
                        <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                            <CalendarClock className="h-4 w-4 text-info" aria-hidden="true" />
                            Éditer les <span className="text-info">vacances</span>
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Modifiez les dates de vacances pour <span className="font-semibold text-foreground">{memberName}</span>.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="px-5 py-3">
                    <VacationMode 
                        vacationStart={initialVacationStart ? new Date(initialVacationStart) : null}
                        vacationEnd={initialVacationEnd ? new Date(initialVacationEnd) : null}
                        readOnly={false}
                        onSave={handleSave}
                        guildId={guildId}
                        pseudo={memberName}
                        profileId={profileId}
                    />
                </div>

                <div className="flex justify-end border-t border-border bg-surface/40 px-5 py-3">
                    <Button 
                        variant="ghost" 
                        onClick={() => onOpenChange(false)}
                        className="text-caption font-semibold text-muted-foreground hover:text-foreground"
                    >
                        Fermer
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

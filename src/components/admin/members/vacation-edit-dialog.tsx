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
import { Palmtree } from "lucide-react";

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
            <DialogContent className="sm:max-w-[425px] bg-zinc-950 border-white/10 text-white rounded-[24px] overflow-hidden p-0">
                <div className="p-6 pb-2">
                    <DialogHeader>
                        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4">
                            <Palmtree className="w-6 h-6 text-cyan-400" />
                        </div>
                        <DialogTitle className="text-xl font-black tracking-tight uppercase italic">
                            Éditer <span className="text-cyan-400">Vacances</span>
                        </DialogTitle>
                        <DialogDescription className="text-zinc-500 italic">
                            Modifiez les dates de vacances pour <span className="text-white font-bold">{memberName}</span>.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="px-6 py-4">
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

                <div className="px-6 py-4 bg-white/5 flex justify-end">
                    <Button 
                        variant="ghost" 
                        onClick={() => onOpenChange(false)}
                        className="font-bold text-zinc-500 hover:text-white uppercase text-caption tracking-widest"
                    >
                        Fermer
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

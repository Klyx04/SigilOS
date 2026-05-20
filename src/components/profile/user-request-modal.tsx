"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { sendUserRequest } from "@/server/actions/user-request-actions";
import { Hammer, Sparkles, Shield, Loader2, Send } from "lucide-react";
import { DOFUS_JOBS, getOrder } from "@/lib/dofus-assets";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface UserRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    targetUserId: string;
    targetName: string;
    guildId: string;
    capabilities: {
        jobs: string[];
        alignment?: string | null;
        alignmentOrder?: string | null;
        legendaryCrafts: any[];
    };
}

export function UserRequestModal({
    isOpen,
    onClose,
    targetUserId,
    targetName,
    guildId,
    capabilities,
}: UserRequestModalProps) {
    const [type, setType] = useState<"job" | "order" | "legendary">("job");
    const [value, setValue] = useState<string>("");
    const [message, setMessage] = useState("");
    const [isPending, setIsPending] = useState(false);

    const handleSubmit = async () => {
        if (!value) {
            toast.error("Veuillez sélectionner une option");
            return;
        }

        setIsPending(true);
        try {
            const res = await sendUserRequest(guildId, targetUserId, {
                type,
                value,
                message,
            });

            if (res.success) {
                toast.success("Demande envoyée avec succès !");
                onClose();
            } else {
                toast.error(res.error || "Erreur lors de l'envoi");
            }
        } catch (error) {
            toast.error("Une erreur est survenue");
        } finally {
            setIsPending(false);
        }
    };

    const orderData = capabilities.alignment && capabilities.alignmentOrder 
        ? getOrder(capabilities.alignment, capabilities.alignmentOrder) 
        : null;



    return (
        <Dialog open={isOpen} onOpenChange={(val) => {
            if (!val) onClose();
        }}>
            <DialogContent className="sm:max-w-[500px] bg-zinc-900 border-white/10 shadow-2xl text-white">
                <DialogHeader className="pt-4">
                    <DialogTitle className="text-xl font-bold">
                        Solliciter {targetName}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* TYPE SELECTION */}
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { id: "job", label: "Métier", icon: Hammer },
                            { id: "order", label: "Ordre", icon: Shield, disabled: !orderData },
                            { id: "legendary", label: "Légendaire", icon: Sparkles, disabled: (capabilities.legendaryCrafts || []).length === 0 },
                        ].map((t) => (
                            <button
                                key={t.id}
                                disabled={t.disabled}
                                onClick={() => {
                                    setType(t.id as any);
                                    setValue("");
                                }}
                                className={cn(
                                    "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                                    type === t.id 
                                        ? "bg-indigo-500/20 border-indigo-500/50" 
                                        : "bg-black/20 border-white/5",
                                    t.disabled && "opacity-20 cursor-not-allowed"
                                )}
                            >
                                <t.icon className="w-5 h-5" />
                                <span className="text-[10px] font-bold uppercase">{t.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* VALUE SELECTION */}
                    <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-zinc-500">Objet de la demande</Label>
                        <Select value={value} onValueChange={setValue}>
                            <SelectTrigger className="bg-black/40 border-white/10 h-10 w-full">
                                <SelectValue placeholder="Choisir..." />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-white/10">
                                {type === "job" && (capabilities.jobs || []).map(jobId => {
                                    const job = Object.values(DOFUS_JOBS).flat().find(j => j.id === jobId);
                                    return (
                                        <SelectItem key={jobId} value={jobId}>
                                            <div className="flex items-center gap-2">
                                                {job?.icon && <img src={job.icon} alt="" className="w-4 h-4 object-contain" />}
                                                <span>{job?.name || jobId}</span>
                                            </div>
                                        </SelectItem>
                                    );
                                })}
                                {type === "order" && orderData && (
                                    <SelectItem value={orderData.id}>
                                        <div className="flex items-center gap-2">
                                            <img src={orderData.icon} alt="" className="w-4 h-4 object-contain" />
                                            <span>{orderData.name}</span>
                                        </div>
                                    </SelectItem>
                                )}
                                {type === "legendary" && (capabilities.legendaryCrafts || []).map(item => (
                                    <SelectItem key={item.id} value={item.id}>
                                        <div className="flex items-center gap-2">
                                            {item.imageUrl && <img src={item.imageUrl} alt="" className="w-4 h-4 object-contain" />}
                                            <span>{item.name}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* MESSAGE */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center ml-1">
                            <Label className="text-[10px] uppercase font-bold text-zinc-500">Message</Label>
                            <span className={cn("text-[9px] font-bold", message.length > 450 ? "text-amber-500" : "text-zinc-600")}>
                                {message.length} / 500
                            </span>
                        </div>
                        <Textarea
                            placeholder="Détaillez votre demande..."
                            className="bg-black/40 border-white/10 min-h-[80px]"
                            value={message}
                            onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                            maxLength={500}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        onClick={handleSubmit}
                        disabled={isPending || !value}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white w-full h-10"
                    >
                        {isPending ? "Envoi..." : "Envoyer"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


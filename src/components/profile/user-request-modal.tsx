"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { sendUserRequest } from "@/server/actions/user-request-actions";
import { Hammer, Sparkles, Shield, Loader2, Send, Check, ArrowRight } from "lucide-react";
import { DOFUS_JOBS, getOrder } from "@/lib/dofus-assets";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

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

type RequestType = "job" | "order" | "legendary";

const TYPE_CONFIG: Record<RequestType, {
    icon: typeof Hammer;
    label: string;
    gradient: string;
    border: string;
    glow: string;
    badge: string;
}> = {
    job: {
        icon: Hammer,
        label: "Métier",
        gradient: "from-amber-500/20 via-amber-600/5 to-transparent",
        border: "border-amber-500/40",
        glow: "shadow-amber-500/20",
        badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    },
    order: {
        icon: Shield,
        label: "Ordre",
        gradient: "from-indigo-500/20 via-indigo-600/5 to-transparent",
        border: "border-indigo-500/40",
        glow: "shadow-indigo-500/20",
        badge: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    },
    legendary: {
        icon: Sparkles,
        label: "Légendaire",
        gradient: "from-purple-500/20 via-purple-600/5 to-transparent",
        border: "border-purple-500/40",
        glow: "shadow-purple-500/20",
        badge: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    },
};

function TypeCard({ type, current, onClick, disabled, jobsCount, hasLegendary }: {
    type: RequestType;
    current: RequestType;
    onClick: () => void;
    disabled?: boolean;
    jobsCount?: number;
    hasLegendary?: boolean;
}) {
    const cfg = TYPE_CONFIG[type];
    const Icon = cfg.icon;
    const isActive = type === current;

    // Show availability badge
    let availability: string | null = null;
    if (type === "job") availability = jobsCount ? `${jobsCount} métier${jobsCount > 1 ? "s" : ""}` : "Aucun";
    if (type === "legendary") availability = hasLegendary ? "Disponible" : "Aucun";
    if (type === "order") availability = "Disponible";

    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={cn(
                "relative group flex flex-col items-center gap-2.5 p-4 rounded-2xl border-2 transition-all duration-300 outline-none",
                isActive
                    ? [cfg.border, cfg.glow, "bg-zinc-900/80 scale-[1.02]"].join(" ")
                    : "border-zinc-800/40 bg-zinc-900/30 hover:border-zinc-700/60 hover:bg-zinc-900/50",
                disabled && "opacity-25 cursor-not-allowed pointer-events-none"
            )}
        >
            {/* Active glow background */}
            {isActive && (
                <div className={cn("absolute inset-0 rounded-2xl opacity-30 transition-opacity", cfg.gradient)} />
            )}

            {/* Icon */}
            <div className={cn(
                "relative z-10 w-11 h-11 rounded-xl flex items-center justify-center border-2 transition-all duration-300",
                isActive
                    ? [cfg.border, "bg-zinc-800/80"].join(" ")
                    : "border-zinc-700/30 bg-zinc-800/40 group-hover:border-zinc-600/50"
            )}>
                <Icon className={cn(
                    "w-5 h-5 transition-all duration-300",
                    isActive ? "scale-110" : "text-zinc-400 group-hover:text-zinc-200"
                )} />
            </div>

            {/* Label */}
            <span className={cn(
                "relative z-10 text-caption font-black uppercase tracking-widest transition-colors duration-300",
                isActive ? "text-white" : "text-zinc-400 group-hover:text-zinc-200"
            )}>
                {cfg.label}
            </span>

            {/* Availability badge */}
            {availability && (
                <span className={cn(
                    "relative z-10 text-caption font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                    type === "job" && jobsCount
                        ? "bg-amber-500/10 text-amber-400/70 border-amber-500/20"
                        : type === "legendary" && hasLegendary
                            ? "bg-purple-500/10 text-purple-400/70 border-purple-500/20"
                            : type === "order"
                                ? "bg-indigo-500/10 text-indigo-400/70 border-indigo-500/20"
                                : "bg-zinc-800/60 text-zinc-600 border-zinc-700/30"
                )}>
                    {availability}
                </span>
            )}

            {/* Active checkmark */}
            {isActive && (
                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/40 z-20">
                    <Check className="w-3 h-3 text-white" />
                </div>
            )}
        </button>
    );
}

function ValueCard({ label, icon, isSelected, onClick }: {
    label: string;
    icon?: string | null;
    isSelected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "flex items-center gap-3 w-full px-4 py-3 rounded-xl border transition-all duration-200 text-left group",
                isSelected
                    ? "bg-emerald-500/10 border-emerald-500/40 shadow-sm shadow-emerald-500/10"
                    : "bg-zinc-900/50 border-zinc-800/30 hover:border-zinc-700/50 hover:bg-zinc-900/80"
            )}
        >
            {icon && (
                <div className="w-9 h-9 rounded-lg bg-zinc-800/80 border border-zinc-700/40 flex items-center justify-center shrink-0 overflow-hidden">
                    <img src={icon} alt="" className="w-6 h-6 object-contain" />
                </div>
            )}
            <span className={cn(
                "flex-1 text-sm font-bold transition-colors",
                isSelected ? "text-emerald-300" : "text-zinc-300 group-hover:text-white"
            )}>
                {label}
            </span>
            {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
            {!isSelected && <ArrowRight className="w-3.5 h-3.5 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />}
        </button>
    );
}

export function UserRequestModal({
    isOpen,
    onClose,
    targetUserId,
    targetName,
    guildId,
    capabilities,
}: UserRequestModalProps) {
    const [type, setType] = useState<RequestType>("job");
    const [value, setValue] = useState<string>("");
    const [step, setStep] = useState<"type" | "value" | "message">("type");
    const [message, setMessage] = useState("");
    const [isPending, setIsPending] = useState(false);

    const orderData = capabilities.alignment && capabilities.alignmentOrder
        ? getOrder(capabilities.alignment, capabilities.alignmentOrder)
        : null;

    const jobs = (capabilities.jobs || []);
    const legendaryItems = (capabilities.legendaryCrafts || []);

    const handleSubmit = async () => {
        if (!value) {
            toast.error("Veuillez sélectionner une option");
            return;
        }
        setIsPending(true);
        try {
            const res = await sendUserRequest(guildId, targetUserId, { type, value, message });
            if (res.success) {
                toast.success("Demande envoyée avec succès !");
                onClose();
            } else {
                toast.error(res.error || "Erreur lors de l'envoi");
            }
        } catch {
            toast.error("Une erreur est survenue");
        } finally {
            setIsPending(false);
        }
    };

    const resetModal = () => {
        setType("job");
        setValue("");
        setStep("type");
        setMessage("");
    };

    // Get current type config for styling
    const activeCfg = TYPE_CONFIG[type];

    return (
        <Dialog open={isOpen} onOpenChange={(val) => {
            if (!val) { resetModal(); onClose(); }
        }}>
            <DialogContent className="sm:max-w-[520px] bg-zinc-950 border-zinc-800/60 shadow-2xl text-white p-0 gap-0 overflow-hidden rounded-3xl">
                {/* Header with gradient accent */}
                <div className="relative overflow-hidden">
                    <div className={cn(
                        "absolute inset-0 opacity-20",
                        type === "job" ? "bg-gradient-to-br from-amber-500/30 via-transparent to-transparent" :
                        type === "order" ? "bg-gradient-to-br from-indigo-500/30 via-transparent to-transparent" :
                        "bg-gradient-to-br from-purple-500/30 via-transparent to-transparent"
                    )} />
                    <DialogHeader className="relative p-6 pb-4 border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center border",
                                type === "job" ? "bg-amber-500/10 border-amber-500/30" :
                                type === "order" ? "bg-indigo-500/10 border-indigo-500/30" :
                                "bg-purple-500/10 border-purple-500/30"
                            )}>
                                <Send className={cn(
                                    "w-4 h-4",
                                    type === "job" ? "text-amber-400" :
                                    type === "order" ? "text-indigo-400" :
                                    "text-purple-400"
                                )} />
                            </div>
                            <div>
                                <DialogTitle className="text-base font-black tracking-wide">
                                    Solliciter <span className="text-emerald-400">{targetName}</span>
                                </DialogTitle>
                                <p className="text-caption text-zinc-500 font-medium mt-0.5">
                                    Envoyez une demande de service à ce membre
                                </p>
                            </div>
                        </div>

                        {/* Step indicator */}
                        <div className="flex items-center gap-2 mt-4">
                            {(["type", "value", "message"] as const).map((s, i) => {
                                const idx = ["type", "value", "message"].indexOf(step);
                                const isDone = i <= idx;
                                return (
                                    <div key={s} className="flex items-center gap-2 flex-1">
                                        <div className={cn(
                                            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-caption font-black uppercase tracking-widest border transition-all",
                                            isDone
                                                ? [activeCfg.border, activeCfg.badge, "shadow-sm"].join(" ")
                                                : "border-zinc-800 text-zinc-600 bg-zinc-900/50"
                                        )}>
                                            <span className={cn(
                                                "w-3.5 h-3.5 rounded-full flex items-center justify-center text-caption font-black",
                                                isDone ? "bg-current" : "bg-zinc-700"
                                            )}>
                                                {isDone ? "✓" : i + 1}
                                            </span>
                                            <span className="hidden sm:inline">
                                                {s === "type" ? "Type" : s === "value" ? "Objet" : "Message"}
                                            </span>
                                        </div>
                                        {i < 2 && <div className={cn(
                                            "flex-1 h-px",
                                            isDone ? "bg-current opacity-30" : "bg-zinc-800"
                                        )} />}
                                    </div>
                                );
                            })}
                        </div>
                    </DialogHeader>
                </div>

                <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto scrollbar-thin">
                    <AnimatePresence mode="wait">
                        {step === "type" && (
                            <motion.div
                                key="step-type"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-4"
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-1 h-1 rounded-full bg-amber-400/60" />
                                    <Label className="text-caption uppercase font-black text-zinc-500 tracking-widest">
                                        Choisissez le type de service
                                    </Label>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <TypeCard
                                        type="job"
                                        current={type}
                                        onClick={() => { setType("job"); setValue(""); }}
                                        jobsCount={jobs.length}
                                    />
                                    <TypeCard
                                        type="order"
                                        current={type}
                                        onClick={() => { setType("order"); setValue(""); }}
                                        disabled={!orderData}
                                    />
                                    <TypeCard
                                        type="legendary"
                                        current={type}
                                        onClick={() => { setType("legendary"); setValue(""); }}
                                        disabled={legendaryItems.length === 0}
                                        hasLegendary={legendaryItems.length > 0}
                                    />
                                </div>

                                {type === "order" && !orderData && (
                                    <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/40">
                                        <p className="text-caption text-zinc-500 font-medium text-center">
                                            Ce membre n'a pas d'ordre configuré sur son profil
                                        </p>
                                    </div>
                                )}

                                {((type === "job" && jobs.length > 0) || (type === "legendary" && legendaryItems.length > 0) || (type === "order" && orderData)) && (
                                    <Button
                                        onClick={() => setStep("value")}
                                        className={cn(
                                            "w-full h-11 rounded-xl font-black text-caption uppercase tracking-widest shadow-lg transition-all",
                                            type === "job" ? "bg-amber-600 hover:bg-amber-500 shadow-amber-600/30" :
                                            type === "order" ? "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30" :
                                            "bg-purple-600 hover:bg-purple-500 shadow-purple-600/30"
                                        )}
                                    >
                                        Suivant
                                        <ArrowRight className="w-3.5 h-3.5 ml-2" />
                                    </Button>
                                )}
                            </motion.div>
                        )}

                        {step === "value" && (
                            <motion.div
                                key="step-value"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-3"
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-1 h-1 rounded-full" style={{
                                        backgroundColor: type === "job" ? "#f59e0b" : type === "order" ? "#6366f1" : "#a855f7"
                                    }} />
                                    <Label className="text-caption uppercase font-black text-zinc-500 tracking-widest">
                                        {type === "job" ? "Métier recherché" : type === "order" ? "Ordre d'alignement" : "Légendaire à crafter"}
                                    </Label>
                                </div>

                                <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin">
                                    {type === "job" && jobs.map(jobId => {
                                        const job = Object.values(DOFUS_JOBS).flat().find(j => j.id === jobId);
                                        if (!job) return null;
                                        return (
                                            <ValueCard
                                                key={jobId}
                                                label={job.name}
                                                icon={job.icon}
                                                isSelected={value === jobId}
                                                onClick={() => setValue(value === jobId ? "" : jobId)}
                                            />
                                        );
                                    })}
                                    {type === "order" && orderData && (
                                        <ValueCard
                                            label={orderData.name}
                                            icon={orderData.icon}
                                            isSelected={value === orderData.id}
                                            onClick={() => setValue(value === orderData.id ? "" : orderData.id)}
                                        />
                                    )}
                                    {type === "legendary" && legendaryItems.map((item: any) => (
                                        <ValueCard
                                            key={item.id}
                                            label={item.name}
                                            icon={item.imageUrl}
                                            isSelected={value === item.id}
                                            onClick={() => setValue(value === item.id ? "" : item.id)}
                                        />
                                    ))}
                                </div>

                                {!value && (
                                    <p className="text-caption text-zinc-600 text-center font-medium">
                                        Sélectionnez un élément ci-dessus
                                    </p>
                                )}

                                <div className="flex items-center gap-2 pt-1">
                                    <Button
                                        variant="ghost"
                                        onClick={() => setStep("type")}
                                        className="text-zinc-500 hover:text-zinc-300 text-caption font-black uppercase tracking-widest h-9"
                                    >
                                        ← Retour
                                    </Button>
                                    <Button
                                        onClick={() => setStep("message")}
                                        disabled={!value}
                                        className={cn(
                                            "flex-1 h-10 rounded-xl font-black text-caption uppercase tracking-widest shadow-lg transition-all",
                                            type === "job" ? "bg-amber-600 hover:bg-amber-500 shadow-amber-600/30" :
                                            type === "order" ? "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30" :
                                            "bg-purple-600 hover:bg-purple-500 shadow-purple-600/30"
                                        )}
                                    >
                                        Suivant
                                        <ArrowRight className="w-3.5 h-3.5 ml-2" />
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                        {step === "message" && (
                            <motion.div
                                key="step-message"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-4"
                            >
                                {/* Selected item recap */}
                                <div className={cn(
                                    "flex items-center gap-3 p-3 rounded-xl border",
                                    type === "job" ? "bg-amber-500/5 border-amber-500/20" :
                                    type === "order" ? "bg-indigo-500/5 border-indigo-500/20" :
                                    "bg-purple-500/5 border-purple-500/20"
                                )}>
                                    {(() => {
                                        let icon = "";
                                        let label = "";
                                        if (type === "job") {
                                            const job = Object.values(DOFUS_JOBS).flat().find(j => j.id === value);
                                            icon = job?.icon || "";
                                            label = job?.name || value;
                                        } else if (type === "order" && orderData) {
                                            icon = orderData.icon;
                                            label = orderData.name;
                                        } else if (type === "legendary") {
                                            const item = legendaryItems.find((i: any) => i.id === value);
                                            icon = item?.imageUrl;
                                            label = item?.name || value;
                                        }
                                        return (
                                            <>
                                                {icon && <img src={icon} alt="" className="w-8 h-8 object-contain shrink-0" />}
                                                <div>
                                                    <p className="text-caption font-black uppercase tracking-widest text-zinc-500">Objet de la demande</p>
                                                    <p className="text-sm font-bold text-white">{label}</p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    onClick={() => setStep("value")}
                                                    className="ml-auto text-caption text-zinc-500 hover:text-zinc-300 font-black uppercase tracking-widest h-7 px-2"
                                                >
                                                    Modifier
                                                </Button>
                                            </>
                                        );
                                    })()}
                                </div>

                                {/* Message */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-caption uppercase font-black text-zinc-500 tracking-widest flex items-center gap-2">
                                            <span className="w-1 h-1 rounded-full bg-zinc-600" />
                                            Message (optionnel)
                                        </Label>
                                        <span className={cn(
                                            "text-caption font-bold transition-colors",
                                            message.length > 450 ? "text-amber-500" : "text-zinc-600"
                                        )}>
                                            {message.length} / 500
                                        </span>
                                    </div>
                                    <Textarea
                                        placeholder="Ajoutez un message personnalisé à votre demande..."
                                        className="bg-zinc-900/60 border-zinc-800/50 focus-visible:border-emerald-500/30 focus-visible:ring-emerald-500/10 min-h-[90px] rounded-xl text-sm placeholder:text-zinc-600 resize-none"
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                                        maxLength={500}
                                    />
                                </div>

                                <div className="flex items-center gap-2 pt-1">
                                    <Button
                                        variant="ghost"
                                        onClick={() => setStep("value")}
                                        className="text-zinc-500 hover:text-zinc-300 text-caption font-black uppercase tracking-widest h-9"
                                    >
                                        ← Retour
                                    </Button>
                                    <Button
                                        onClick={handleSubmit}
                                        disabled={isPending}
                                        className="flex-1 h-11 rounded-xl font-black text-caption uppercase tracking-widest bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        {isPending ? (
                                            <span className="flex items-center gap-2">
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                Envoi en cours...
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-2">
                                                <Send className="w-3.5 h-3.5" />
                                                Envoyer la demande
                                            </span>
                                        )}
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <DialogFooter className="p-4 border-t border-white/5">
                    <Button
                        variant="ghost"
                        onClick={() => { resetModal(); onClose(); }}
                        disabled={isPending}
                        className="text-zinc-600 hover:text-zinc-400 text-caption font-black uppercase tracking-widest h-8 w-full"
                    >
                        Annuler
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
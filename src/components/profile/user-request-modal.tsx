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
import { Hammer, Sparkles, Shield, Loader2, Send, Check, ArrowRight, Handshake } from "lucide-react";
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
        services?: any[];
    };
}

type RequestType = "job" | "order" | "legendary" | "service";

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
        gradient: "from-warning/20 via-warning/5 to-transparent",
        border: "border-warning/40",
        glow: "shadow-amber-500/20",
        badge: "bg-warning/15 text-warning border-warning/30",
    },
    order: {
        icon: Shield,
        label: "Ordre",
        gradient: "from-info/20 via-info/5 to-transparent",
        border: "border-info/40",
        glow: "shadow-indigo-500/20",
        badge: "bg-info/15 text-info border-info/30",
    },
    legendary: {
        icon: Sparkles,
        label: "Légendaire",
        gradient: "from-info/20 via-info/5 to-transparent",
        border: "border-info/40",
        glow: "shadow-purple-500/20",
        badge: "bg-info/15 text-info border-info/30",
    },
    service: {
        icon: Handshake,
        label: "Service",
        gradient: "from-success/20 via-success/5 to-transparent",
        border: "border-success/40",
        glow: "shadow-emerald-500/20",
        badge: "bg-success/15 text-success border-success/30",
    },
};

function TypeCard({ type, current, onClick, disabled, jobsCount, hasLegendary, servicesCount }: {
    type: RequestType;
    current: RequestType;
    onClick: () => void;
    disabled?: boolean;
    jobsCount?: number;
    hasLegendary?: boolean;
    servicesCount?: number;
}) {
    const cfg = TYPE_CONFIG[type];
    const Icon = cfg.icon;
    const isActive = type === current;

    // Show availability badge
    let availability: string | null = null;
    if (type === "job") availability = jobsCount ? `${jobsCount} métier${jobsCount > 1 ? "s" : ""}` : "Aucun";
    if (type === "legendary") availability = hasLegendary ? "Disponible" : "Aucun";
    if (type === "order") availability = "Disponible";
    if (type === "service") availability = servicesCount ? `${servicesCount} service${servicesCount > 1 ? "s" : ""}` : "Aucun";

    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={cn(
                "relative group flex flex-col items-center gap-2.5 p-4 rounded-2xl border-2 transition-all duration-300 outline-none",
                isActive
                    ? [cfg.border, cfg.glow, "bg-surface/80 scale-[1.02]"].join(" ")
                    : "border-border/40 bg-surface/30 hover:border-border/60 hover:bg-surface/50",
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
                    ? [cfg.border, "bg-elevated/80"].join(" ")
                    : "border-border/30 bg-elevated/40 group-hover:border-border/50"
            )}>
                <Icon className={cn(
                    "w-5 h-5 transition-all duration-300",
                    isActive ? "scale-110" : "text-muted-foreground group-hover:text-foreground"
                )} />
            </div>

            {/* Label */}
            <span className={cn(
                "relative z-10 text-caption font-black uppercase tracking-widest transition-colors duration-300",
                isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
            )}>
                {cfg.label}
            </span>

            {/* Availability badge */}
            {availability && (
                <span className={cn(
                    "relative z-10 text-caption font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                    type === "job" && jobsCount
                        ? "bg-warning/10 text-warning/70 border-warning/20"
                        : type === "legendary" && hasLegendary
                            ? "bg-info/10 text-info/70 border-info/20"
                            : type === "order"
                                ? "bg-info/10 text-info/70 border-info/20"
                                : type === "service" && servicesCount
                                    ? "bg-success/10 text-success/70 border-success/20"
                                    : "bg-elevated/60 text-muted-foreground border-border/30"
                )}>
                    {availability}
                </span>
            )}

            {/* Active checkmark */}
            {isActive && (
                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-success flex items-center justify-center shadow-lg shadow-emerald-500/40 z-20">
                    <Check className="w-3 h-3 text-foreground" />
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
                    ? "bg-success/10 border-success/40 shadow-sm shadow-emerald-500/10"
                    : "bg-surface/50 border-border/30 hover:border-border/50 hover:bg-surface/80"
            )}
        >
            {icon && (
                <div className="w-9 h-9 rounded-lg bg-elevated/80 border border-border/40 flex items-center justify-center shrink-0 overflow-hidden">
                    <img src={icon} alt="" className="w-6 h-6 object-contain" />
                </div>
            )}
            <span className={cn(
                "flex-1 text-sm font-bold transition-colors",
                isSelected ? "text-success" : "text-foreground group-hover:text-foreground"
            )}>
                {label}
            </span>
            {isSelected && <Check className="w-4 h-4 text-success shrink-0" />}
            {!isSelected && <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />}
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
    const services = (capabilities.services || []);

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
            <DialogContent className="sm:max-w-[520px] bg-background border-border/60 shadow-2xl text-foreground p-0 gap-0 overflow-hidden rounded-3xl">
                {/* Header with gradient accent */}
                <div className="relative overflow-hidden">
                    <div className={cn(
                        "absolute inset-0 opacity-20",
                        type === "job" ? "bg-gradient-to-br from-warning/30 via-transparent to-transparent" :
                        type === "order" ? "bg-gradient-to-br from-info/30 via-transparent to-transparent" :
                        type === "legendary" ? "bg-gradient-to-br from-info/30 via-transparent to-transparent" :
                        "bg-gradient-to-br from-success/30 via-transparent to-transparent"
                    )} />
                    <DialogHeader className="relative p-6 pb-4 border-b border-border">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center border",
                                type === "job" ? "bg-warning/10 border-warning/30" :
                                type === "order" ? "bg-info/10 border-info/30" :
                                type === "legendary" ? "bg-info/10 border-info/30" :
                                "bg-success/10 border-success/30"
                            )}>
                                <Send className={cn(
                                    "w-4 h-4",
                                    type === "job" ? "text-warning" :
                                    type === "order" ? "text-info" :
                                    type === "legendary" ? "text-info" :
                                    "text-success"
                                )} />
                            </div>
                            <div>
                                <DialogTitle className="text-base font-black tracking-wide">
                                    Solliciter <span className="text-success">{targetName}</span>
                                </DialogTitle>
                                <p className="text-caption text-muted-foreground font-medium mt-0.5">
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
                                                : "border-border text-muted-foreground bg-surface/50"
                                        )}>
                                            <span className={cn(
                                                "w-3.5 h-3.5 rounded-full flex items-center justify-center text-caption font-black",
                                                isDone ? "bg-current" : "bg-muted"
                                            )}>
                                                {isDone ? "✓" : i + 1}
                                            </span>
                                            <span className="hidden sm:inline">
                                                {s === "type" ? "Type" : s === "value" ? "Objet" : "Message"}
                                            </span>
                                        </div>
                                        {i < 2 && <div className={cn(
                                            "flex-1 h-px",
                                            isDone ? "bg-current opacity-30" : "bg-elevated"
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
                                    <div className="w-1 h-1 rounded-full bg-warning/60" />
                                    <Label className="text-caption uppercase font-black text-muted-foreground tracking-widest">
                                        Choisissez le type de service
                                    </Label>
                                </div>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
                                    <TypeCard
                                        type="service"
                                        current={type}
                                        onClick={() => { setType("service"); setValue(""); }}
                                        disabled={services.length === 0}
                                        servicesCount={services.length}
                                    />
                                </div>

                                {type === "order" && !orderData && (
                                    <div className="p-3 rounded-xl bg-surface/60 border border-border/40">
                                        <p className="text-caption text-muted-foreground font-medium text-center">
                                            Ce membre n'a pas d'ordre configuré sur son profil
                                        </p>
                                    </div>
                                )}

                                {((type === "job" && jobs.length > 0) || (type === "legendary" && legendaryItems.length > 0) || (type === "order" && orderData) || (type === "service" && services.length > 0)) && (
                                    <Button
                                        onClick={() => setStep("value")}
                                        className={cn(
                                            "w-full h-11 rounded-xl font-black text-caption uppercase tracking-widest transition-colors",
                                            type === "job" ? "bg-warning/15 hover:bg-warning/25 text-warning border border-warning/25" :
                                            type === "order" ? "bg-info/15 hover:bg-info/25 text-info border border-info/25" :
                                            type === "legendary" ? "bg-info/15 hover:bg-info/25 text-info border border-info/25" :
                                            "bg-success/15 hover:bg-success/25 text-success border border-success/25"
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
                                        backgroundColor: type === "job" ? "#f59e0b" : type === "order" ? "#6366f1" : type === "legendary" ? "#a855f7" : "#10b981"
                                    }} />
                                    <Label className="text-caption uppercase font-black text-muted-foreground tracking-widest">
                                        {type === "job" ? "Métier recherché" : type === "order" ? "Ordre d'alignement" : type === "legendary" ? "Légendaire à crafter" : "Service demandé"}
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
                                    {type === "service" && services.map((svc: any) => (
                                        <ValueCard
                                            key={svc.id}
                                            label={svc.title}
                                            icon={svc.imageUrl}
                                            isSelected={value === svc.id}
                                            onClick={() => setValue(value === svc.id ? "" : svc.id)}
                                        />
                                    ))}
                                </div>

                                {!value && (
                                    <p className="text-caption text-muted-foreground text-center font-medium">
                                        Sélectionnez un élément ci-dessus
                                    </p>
                                )}

                                <div className="flex items-center gap-2 pt-1">
                                    <Button
                                        variant="ghost"
                                        onClick={() => setStep("type")}
                                        className="text-muted-foreground hover:text-foreground text-caption font-black uppercase tracking-widest h-9"
                                    >
                                        ← Retour
                                    </Button>
                                    <Button
                                        onClick={() => setStep("message")}
                                        disabled={!value}
                                        className={cn(
                                            "flex-1 h-10 rounded-xl font-black text-caption uppercase tracking-widest transition-colors",
                                            type === "job" ? "bg-warning/15 hover:bg-warning/25 text-warning border border-warning/25" :
                                            type === "order" ? "bg-info/15 hover:bg-info/25 text-info border border-info/25" :
                                            type === "legendary" ? "bg-info/15 hover:bg-info/25 text-info border border-info/25" :
                                            "bg-success/15 hover:bg-success/25 text-success border border-success/25"
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
                                    type === "job" ? "bg-warning/5 border-warning/20" :
                                    type === "order" ? "bg-info/5 border-info/20" :
                                    type === "legendary" ? "bg-info/5 border-info/20" :
                                    "bg-success/5 border-success/20"
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
                                        } else if (type === "service") {
                                            const svc = services.find((s: any) => s.id === value);
                                            icon = svc?.imageUrl;
                                            label = svc?.title || value;
                                        }
                                        return (
                                            <>
                                                {icon && <img src={icon} alt="" className="w-8 h-8 object-contain shrink-0" />}
                                                <div>
                                                    <p className="text-caption font-black uppercase tracking-widest text-muted-foreground">Objet de la demande</p>
                                                    <p className="text-sm font-bold text-foreground">{label}</p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    onClick={() => setStep("value")}
                                                    className="ml-auto text-caption text-muted-foreground hover:text-foreground font-black uppercase tracking-widest h-7 px-2"
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
                                        <Label className="text-caption uppercase font-black text-muted-foreground tracking-widest flex items-center gap-2">
                                            <span className="w-1 h-1 rounded-full bg-muted" />
                                            Message (optionnel)
                                        </Label>
                                        <span className={cn(
                                            "text-caption font-bold transition-colors",
                                            message.length > 450 ? "text-warning" : "text-muted-foreground"
                                        )}>
                                            {message.length} / 500
                                        </span>
                                    </div>
                                    <Textarea
                                        placeholder="Ajoutez un message personnalisé à votre demande..."
                                        className="bg-surface/60 border-border/50 focus-visible:border-success/30 focus-visible:ring-success/10 min-h-[90px] rounded-xl text-sm placeholder:text-muted-foreground resize-none"
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                                        maxLength={500}
                                    />
                                </div>

                                <div className="flex items-center gap-2 pt-1">
                                    <Button
                                        variant="ghost"
                                        onClick={() => setStep("value")}
                                        className="text-muted-foreground hover:text-foreground text-caption font-black uppercase tracking-widest h-9"
                                    >
                                        ← Retour
                                    </Button>
                                    <Button
                                        onClick={handleSubmit}
                                        disabled={isPending}
                                        className="flex-1 h-11 rounded-xl font-black text-caption uppercase tracking-widest bg-success hover:bg-success text-success-foreground shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
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

                <DialogFooter className="p-4 border-t border-border">
                    <Button
                        variant="ghost"
                        onClick={() => { resetModal(); onClose(); }}
                        disabled={isPending}
                        className="text-muted-foreground hover:text-muted-foreground text-caption font-black uppercase tracking-widest h-8 w-full"
                    >
                        Annuler
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
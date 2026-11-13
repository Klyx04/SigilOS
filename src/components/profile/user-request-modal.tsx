"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { sendUserRequest } from "@/server/actions/user-request-actions";
import { Hammer, Sparkles, Shield, Loader2, Send, Check, ArrowRight, ArrowLeft, Handshake, Search, BellRing } from "lucide-react";
import { getOrder, getJob, getAlignment } from "@/lib/dofus-assets";
import { normalizeMetiers, type MetierEntry } from "@/lib/metiers";
import { cn } from "@/lib/utils";

interface LegendaryCraftItem {
    id: string;
    name: string;
    imageUrl?: string | null;
}

interface ServiceItem {
    id: string;
    title: string;
    description?: string | null;
    imageUrl?: string | null;
    dofusItemIconUrl?: string | null;
}

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
        legendaryCrafts: unknown[];
        services?: unknown[];
    };
}

type RequestType = "job" | "order" | "legendary" | "service";
type ModalStep = "type" | "value" | "message";

const STEPS: { id: ModalStep; label: string }[] = [
    { id: "type", label: "Type" },
    { id: "value", label: "Objet" },
    { id: "message", label: "Message" },
];

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
    const [step, setStep] = useState<ModalStep>("type");
    const [message, setMessage] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [isPending, setIsPending] = useState(false);

    // Normalize capabilities
    const normalizedJobs = useMemo<MetierEntry[]>(() => {
        return normalizeMetiers(capabilities.jobs || []);
    }, [capabilities.jobs]);

    const orderData = useMemo(() => {
        if (!capabilities.alignment || !capabilities.alignmentOrder) return null;
        return getOrder(capabilities.alignment, capabilities.alignmentOrder);
    }, [capabilities.alignment, capabilities.alignmentOrder]);

    const alignmentData = useMemo(() => {
        if (!capabilities.alignment) return null;
        return getAlignment(capabilities.alignment);
    }, [capabilities.alignment]);

    const legendaryItems = useMemo<LegendaryCraftItem[]>(() => {
        return (capabilities.legendaryCrafts || []) as LegendaryCraftItem[];
    }, [capabilities.legendaryCrafts]);

    const services = useMemo<ServiceItem[]>(() => {
        return (capabilities.services || []) as ServiceItem[];
    }, [capabilities.services]);

    // Availability checks
    const hasJobs = normalizedJobs.length > 0;
    const hasOrder = !!orderData;
    const hasLegendary = legendaryItems.length > 0;
    const hasServices = services.length > 0;

    const isTypeAvailable = (t: RequestType) => {
        switch (t) {
            case "job": return hasJobs;
            case "order": return hasOrder;
            case "legendary": return hasLegendary;
            case "service": return hasServices;
        }
    };

    const resetModal = () => {
        setType("job");
        setValue("");
        setStep("type");
        setMessage("");
        setSearchQuery("");
    };

    const handleClose = () => {
        resetModal();
        onClose();
    };

    const handleSelectType = (selected: RequestType) => {
        if (!isTypeAvailable(selected)) return;
        setType(selected);
        setValue("");
        setSearchQuery("");
    };

    const handleSubmit = async () => {
        if (!value) {
            toast.error("Veuillez sélectionner un élément");
            return;
        }
        setIsPending(true);
        try {
            const res = await sendUserRequest(guildId, targetUserId, { type, value, message });
            if (res.success) {
                toast.success("Demande envoyée avec succès !");
                handleClose();
            } else {
                toast.error(res.error || "Erreur lors de l'envoi de la demande");
            }
        } catch {
            toast.error("Une erreur inattendue est survenue");
        } finally {
            setIsPending(false);
        }
    };

    const currentStepIndex = STEPS.findIndex(s => s.id === step);
    const canProceedFromType = isTypeAvailable(type);

    // Filtered items for Step 2
    const filteredJobs = useMemo(() => {
        if (!searchQuery.trim()) return normalizedJobs;
        const q = searchQuery.toLowerCase();
        return normalizedJobs.filter(j => j.name.toLowerCase().includes(q));
    }, [normalizedJobs, searchQuery]);

    const filteredLegendary = useMemo(() => {
        if (!searchQuery.trim()) return legendaryItems;
        const q = searchQuery.toLowerCase();
        return legendaryItems.filter(i => (i.name || "").toLowerCase().includes(q));
    }, [legendaryItems, searchQuery]);

    const filteredServices = useMemo(() => {
        if (!searchQuery.trim()) return services;
        const q = searchQuery.toLowerCase();
        return services.filter(s =>
            (s.title || "").toLowerCase().includes(q) ||
            (s.description || "").toLowerCase().includes(q)
        );
    }, [services, searchQuery]);

    // Recap data for step 3
    const recapData = useMemo(() => {
        if (type === "job") {
            const j = normalizedJobs.find(item => item.id === value) || getJob(value);
            const level = j && "level" in j ? j.level : 200;
            return {
                title: j?.name || value,
                subtitle: `Métier d'artisanat · Niveau ${level}`,
                icon: getJob(value)?.icon || "",
            };
        }
        if (type === "order" && orderData) {
            return {
                title: orderData.name,
                subtitle: `Alignement ${alignmentData?.name || ""}`,
                icon: orderData.icon || "",
            };
        }
        if (type === "legendary") {
            const item = legendaryItems.find(i => i.id === value);
            return {
                title: item?.name || value,
                subtitle: "Équipement légendaire",
                icon: item?.imageUrl || "",
            };
        }
        const svc = services.find(s => s.id === value);
        return {
            title: svc?.title || value,
            subtitle: "Service de guilde",
            icon: svc?.imageUrl || svc?.dofusItemIconUrl || "",
        };
    }, [type, value, normalizedJobs, orderData, alignmentData, legendaryItems, services]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
            <DialogContent className="sm:max-w-[540px] max-w-[calc(100vw-1.5rem)] bg-surface border border-border-strong text-foreground shadow-2xl rounded-2xl overflow-hidden p-0 gap-0">
                {/* Subtle top brand accent line */}
                <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-accent to-transparent" />

                {/* Header */}
                <div className="p-6 pb-4 border-b border-border bg-background/40">
                    <DialogHeader className="text-left space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                            <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                                Demande d&apos;artisanat & entraide
                            </span>
                        </div>
                        <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
                            Solliciter <span className="text-accent">{targetName}</span>
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                            Envoyez une demande ciblée (craft, alignement, service) directement à ce membre sur Discord.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Stepper bar */}
                    <div className="grid grid-cols-3 gap-2 mt-5 p-1 rounded-xl bg-background/80 border border-border">
                        {STEPS.map((s, idx) => {
                            const isCurrent = s.id === step;
                            const isPast = idx < currentStepIndex;
                            return (
                                <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => {
                                        if (isPast) {
                                            setStep(s.id);
                                        }
                                    }}
                                    disabled={!isPast}
                                    className={cn(
                                        "flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all select-none",
                                        isCurrent && "bg-accent/15 text-accent border border-accent/30 shadow-xs",
                                        isPast && "text-foreground hover:bg-surface/90 cursor-pointer",
                                        !isCurrent && !isPast && "text-muted-foreground/50 cursor-not-allowed"
                                    )}
                                >
                                    <span className={cn(
                                        "w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                                        isCurrent && "bg-accent text-accent-foreground",
                                        isPast && "bg-surface border border-border-strong text-accent",
                                        !isCurrent && !isPast && "bg-muted/40 text-muted-foreground/60"
                                    )}>
                                        {isPast ? <Check className="w-2.5 h-2.5" /> : idx + 1}
                                    </span>
                                    <span className="truncate">{s.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Body Content */}
                <div className="p-6 min-h-[300px] max-h-[60vh] overflow-y-auto scrollbar-thin">
                    {/* STEP 1: TYPE SELECTION */}
                    {step === "type" && (
                        <div className="space-y-4 animate-in fade-in duration-200">
                            <div>
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Type d&apos;intervention
                                </h3>
                                <p className="text-sm font-medium text-foreground mt-0.5">
                                    Quel type de service souhaitez-vous solliciter ?
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Métier */}
                                <button
                                    type="button"
                                    disabled={!hasJobs}
                                    onClick={() => handleSelectType("job")}
                                    className={cn(
                                        "flex flex-col p-4 rounded-xl border text-left transition-all duration-150 group relative cursor-pointer",
                                        type === "job" && hasJobs
                                            ? "border-accent bg-accent/[0.08] ring-1 ring-accent/30 shadow-xs"
                                            : "border-border bg-surface/60 hover:bg-elevated hover:border-border-strong",
                                        !hasJobs && "opacity-40 cursor-not-allowed bg-surface/20 border-border/30"
                                    )}
                                >
                                    <div className="flex items-center justify-between w-full mb-3">
                                        <div className={cn(
                                            "w-9 h-9 rounded-lg flex items-center justify-center border transition-colors",
                                            type === "job" && hasJobs
                                                ? "bg-accent text-accent-foreground border-accent"
                                                : "bg-surface border-border text-foreground group-hover:border-border-strong"
                                        )}>
                                            <Hammer className="w-4 h-4" />
                                        </div>
                                        <span className={cn(
                                            "text-[11px] font-semibold px-2 py-0.5 rounded-full border",
                                            hasJobs
                                                ? "bg-accent/10 text-accent border-accent/25"
                                                : "bg-muted/40 text-muted-foreground border-transparent"
                                        )}>
                                            {hasJobs ? `${normalizedJobs.length} métier${normalizedJobs.length > 1 ? "s" : ""}` : "Aucun"}
                                        </span>
                                    </div>
                                    <div className="text-sm font-bold text-foreground">Métier d&apos;artisanat</div>
                                    <div className="text-xs text-muted-foreground mt-0.5">Craft, récolte ou forgemagie</div>
                                </button>

                                {/* Ordre */}
                                <button
                                    type="button"
                                    disabled={!hasOrder}
                                    onClick={() => handleSelectType("order")}
                                    className={cn(
                                        "flex flex-col p-4 rounded-xl border text-left transition-all duration-150 group relative cursor-pointer",
                                        type === "order" && hasOrder
                                            ? "border-accent bg-accent/[0.08] ring-1 ring-accent/30 shadow-xs"
                                            : "border-border bg-surface/60 hover:bg-elevated hover:border-border-strong",
                                        !hasOrder && "opacity-40 cursor-not-allowed bg-surface/20 border-border/30"
                                    )}
                                >
                                    <div className="flex items-center justify-between w-full mb-3">
                                        <div className={cn(
                                            "w-9 h-9 rounded-lg flex items-center justify-center border transition-colors",
                                            type === "order" && hasOrder
                                                ? "bg-accent text-accent-foreground border-accent"
                                                : "bg-surface border-border text-foreground group-hover:border-border-strong"
                                        )}>
                                            <Shield className="w-4 h-4" />
                                        </div>
                                        <span className={cn(
                                            "text-[11px] font-semibold px-2 py-0.5 rounded-full border",
                                            hasOrder
                                                ? "bg-accent/10 text-accent border-accent/25"
                                                : "bg-muted/40 text-muted-foreground border-transparent"
                                        )}>
                                            {hasOrder ? "Disponible" : "Non configuré"}
                                        </span>
                                    </div>
                                    <div className="text-sm font-bold text-foreground">Ordre d&apos;alignement</div>
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                        {orderData?.name || "Bénédictions & dons"}
                                    </div>
                                </button>

                                {/* Légendaire */}
                                <button
                                    type="button"
                                    disabled={!hasLegendary}
                                    onClick={() => handleSelectType("legendary")}
                                    className={cn(
                                        "flex flex-col p-4 rounded-xl border text-left transition-all duration-150 group relative cursor-pointer",
                                        type === "legendary" && hasLegendary
                                            ? "border-accent bg-accent/[0.08] ring-1 ring-accent/30 shadow-xs"
                                            : "border-border bg-surface/60 hover:bg-elevated hover:border-border-strong",
                                        !hasLegendary && "opacity-40 cursor-not-allowed bg-surface/20 border-border/30"
                                    )}
                                >
                                    <div className="flex items-center justify-between w-full mb-3">
                                        <div className={cn(
                                            "w-9 h-9 rounded-lg flex items-center justify-center border transition-colors",
                                            type === "legendary" && hasLegendary
                                                ? "bg-accent text-accent-foreground border-accent"
                                                : "bg-surface border-border text-foreground group-hover:border-border-strong"
                                        )}>
                                            <Sparkles className="w-4 h-4" />
                                        </div>
                                        <span className={cn(
                                            "text-[11px] font-semibold px-2 py-0.5 rounded-full border",
                                            hasLegendary
                                                ? "bg-accent/10 text-accent border-accent/25"
                                                : "bg-muted/40 text-muted-foreground border-transparent"
                                        )}>
                                            {hasLegendary ? `${legendaryItems.length} craft${legendaryItems.length > 1 ? "s" : ""}` : "Aucun craft"}
                                        </span>
                                    </div>
                                    <div className="text-sm font-bold text-foreground">Artisanat légendaire</div>
                                    <div className="text-xs text-muted-foreground mt-0.5">Équipements & runes rares</div>
                                </button>

                                {/* Service */}
                                <button
                                    type="button"
                                    disabled={!hasServices}
                                    onClick={() => handleSelectType("service")}
                                    className={cn(
                                        "flex flex-col p-4 rounded-xl border text-left transition-all duration-150 group relative cursor-pointer",
                                        type === "service" && hasServices
                                            ? "border-accent bg-accent/[0.08] ring-1 ring-accent/30 shadow-xs"
                                            : "border-border bg-surface/60 hover:bg-elevated hover:border-border-strong",
                                        !hasServices && "opacity-40 cursor-not-allowed bg-surface/20 border-border/30"
                                    )}
                                >
                                    <div className="flex items-center justify-between w-full mb-3">
                                        <div className={cn(
                                            "w-9 h-9 rounded-lg flex items-center justify-center border transition-colors",
                                            type === "service" && hasServices
                                                ? "bg-accent text-accent-foreground border-accent"
                                                : "bg-surface border-border text-foreground group-hover:border-border-strong"
                                        )}>
                                            <Handshake className="w-4 h-4" />
                                        </div>
                                        <span className={cn(
                                            "text-[11px] font-semibold px-2 py-0.5 rounded-full border",
                                            hasServices
                                                ? "bg-accent/10 text-accent border-accent/25"
                                                : "bg-muted/40 text-muted-foreground border-transparent"
                                        )}>
                                            {hasServices ? `${services.length} service${services.length > 1 ? "s" : ""}` : "Aucun service"}
                                        </span>
                                    </div>
                                    <div className="text-sm font-bold text-foreground">Service de guilde</div>
                                    <div className="text-xs text-muted-foreground mt-0.5">Aide donjons, passages, quêtes</div>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: OBJECT SELECTION */}
                    {step === "value" && (
                        <div className="space-y-4 animate-in fade-in duration-200">
                            <div>
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    {type === "job" && "Sélection du métier"}
                                    {type === "order" && "Bénédiction d'ordre"}
                                    {type === "legendary" && "Sélection du craft légendaire"}
                                    {type === "service" && "Sélection du service"}
                                </h3>
                                <p className="text-sm font-medium text-foreground mt-0.5">
                                    Choisissez l&apos;élément concerné par votre demande :
                                </p>
                            </div>

                            {/* Search bar if multiple items */}
                            {(type === "job" && normalizedJobs.length > 4) || (type === "legendary" && legendaryItems.length > 4) || (type === "service" && services.length > 4) ? (
                                <div className="relative">
                                    <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                                    <Input
                                        placeholder="Filtrer les options..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9 h-9 rounded-xl bg-background/70 border-border text-xs focus-visible:ring-accent/20 focus-visible:border-accent"
                                    />
                                </div>
                            ) : null}

                            {/* Options List */}
                            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin">
                                {/* Jobs */}
                                {type === "job" && filteredJobs.map((j) => {
                                    const jobMeta = getJob(j.id);
                                    const isSelected = value === j.id;
                                    return (
                                        <button
                                            key={j.id}
                                            type="button"
                                            onClick={() => setValue(isSelected ? "" : j.id)}
                                            className={cn(
                                                "w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left group cursor-pointer",
                                                isSelected
                                                    ? "border-accent bg-accent/[0.08] ring-1 ring-accent/30 shadow-xs"
                                                    : "border-border bg-surface/50 hover:bg-elevated hover:border-border-strong"
                                            )}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-9 h-9 rounded-lg bg-background/80 border border-border p-1.5 flex items-center justify-center shrink-0">
                                                    {jobMeta?.icon ? (
                                                        <Image src={jobMeta.icon} alt="" width={24} height={24} className="w-6 h-6 object-contain" />
                                                    ) : (
                                                        <Hammer className="w-4 h-4 text-muted-foreground" />
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-semibold text-foreground truncate">{j.name}</div>
                                                    <div className="text-xs text-muted-foreground">Niveau {j.level}</div>
                                                </div>
                                            </div>
                                            <div className={cn(
                                                "w-5 h-5 rounded-full flex items-center justify-center border transition-colors shrink-0",
                                                isSelected
                                                    ? "bg-accent border-accent text-accent-foreground"
                                                    : "border-border group-hover:border-border-strong"
                                            )}>
                                                {isSelected && <Check className="w-3 h-3" />}
                                            </div>
                                        </button>
                                    );
                                })}

                                {/* Order */}
                                {type === "order" && orderData && (
                                    <button
                                        type="button"
                                        onClick={() => setValue(orderData.id)}
                                        className={cn(
                                            "w-full flex items-center justify-between p-3.5 rounded-xl border transition-all text-left group cursor-pointer",
                                            value === orderData.id
                                                ? "border-accent bg-accent/[0.08] ring-1 ring-accent/30 shadow-xs"
                                                : "border-border bg-surface/50 hover:bg-elevated hover:border-border-strong"
                                        )}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-lg bg-background/80 border border-border p-1.5 flex items-center justify-center shrink-0">
                                                {orderData.icon ? (
                                                    <Image src={orderData.icon} alt="" width={28} height={28} className="w-7 h-7 object-contain" />
                                                ) : (
                                                    <Shield className="w-5 h-5 text-accent" />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-sm font-semibold text-foreground truncate">{orderData.name}</div>
                                                <div className="text-xs text-muted-foreground">Alignement {alignmentData?.name || "Bonta/Brâkmar"}</div>
                                            </div>
                                        </div>
                                        <div className={cn(
                                            "w-5 h-5 rounded-full flex items-center justify-center border transition-colors shrink-0",
                                            value === orderData.id
                                                ? "bg-accent border-accent text-accent-foreground"
                                                : "border-border group-hover:border-border-strong"
                                        )}>
                                            {value === orderData.id && <Check className="w-3 h-3" />}
                                        </div>
                                    </button>
                                )}

                                {/* Legendary items */}
                                {type === "legendary" && filteredLegendary.map((item) => {
                                    const isSelected = value === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setValue(isSelected ? "" : item.id)}
                                            className={cn(
                                                "w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left group cursor-pointer",
                                                isSelected
                                                    ? "border-accent bg-accent/[0.08] ring-1 ring-accent/30 shadow-xs"
                                                    : "border-border bg-surface/50 hover:bg-elevated hover:border-border-strong"
                                            )}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-9 h-9 rounded-lg bg-background/80 border border-border p-1 flex items-center justify-center shrink-0 overflow-hidden">
                                                    {item.imageUrl ? (
                                                        <Image src={item.imageUrl} alt="" width={28} height={28} className="w-7 h-7 object-contain" />
                                                    ) : (
                                                        <Sparkles className="w-4 h-4 text-accent" />
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-semibold text-foreground truncate">{item.name}</div>
                                                    <div className="text-xs text-muted-foreground">Craft légendaire</div>
                                                </div>
                                            </div>
                                            <div className={cn(
                                                "w-5 h-5 rounded-full flex items-center justify-center border transition-colors shrink-0",
                                                isSelected
                                                    ? "bg-accent border-accent text-accent-foreground"
                                                    : "border-border group-hover:border-border-strong"
                                            )}>
                                                {isSelected && <Check className="w-3 h-3" />}
                                            </div>
                                        </button>
                                    );
                                })}

                                {/* Services */}
                                {type === "service" && filteredServices.map((svc) => {
                                    const isSelected = value === svc.id;
                                    const icon = svc.imageUrl || svc.dofusItemIconUrl;
                                    return (
                                        <button
                                            key={svc.id}
                                            type="button"
                                            onClick={() => setValue(isSelected ? "" : svc.id)}
                                            className={cn(
                                                "w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left group cursor-pointer",
                                                isSelected
                                                    ? "border-accent bg-accent/[0.08] ring-1 ring-accent/30 shadow-xs"
                                                    : "border-border bg-surface/50 hover:bg-elevated hover:border-border-strong"
                                            )}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-9 h-9 rounded-lg bg-background/80 border border-border p-1 flex items-center justify-center shrink-0 overflow-hidden">
                                                    {icon ? (
                                                        <Image src={icon} alt="" width={28} height={28} className="w-7 h-7 object-contain" />
                                                    ) : (
                                                        <Handshake className="w-4 h-4 text-accent" />
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-semibold text-foreground truncate">{svc.title}</div>
                                                    {svc.description && (
                                                        <div className="text-xs text-muted-foreground truncate">{svc.description}</div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className={cn(
                                                "w-5 h-5 rounded-full flex items-center justify-center border transition-colors shrink-0",
                                                isSelected
                                                    ? "bg-accent border-accent text-accent-foreground"
                                                    : "border-border group-hover:border-border-strong"
                                            )}>
                                                {isSelected && <Check className="w-3 h-3" />}
                                            </div>
                                        </button>
                                    );
                                })}

                                {((type === "job" && filteredJobs.length === 0) ||
                                    (type === "legendary" && filteredLegendary.length === 0) ||
                                    (type === "service" && filteredServices.length === 0)) && (
                                        <div className="p-6 text-center text-xs text-muted-foreground">
                                            Aucun élément ne correspond à votre recherche.
                                        </div>
                                    )}
                            </div>
                        </div>
                    )}

                    {/* STEP 3: MESSAGE & CONFIRMATION */}
                    {step === "message" && (
                        <div className="space-y-4 animate-in fade-in duration-200">
                            {/* Summary Card */}
                            <div className="p-3.5 rounded-xl border border-border bg-background/70 flex items-center justify-between">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-lg bg-surface border border-border p-1.5 flex items-center justify-center shrink-0">
                                        {recapData.icon ? (
                                            <Image src={recapData.icon} alt="" width={28} height={28} className="w-7 h-7 object-contain" />
                                        ) : (
                                            <Send className="w-4 h-4 text-accent" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                            {recapData.subtitle}
                                        </div>
                                        <div className="text-sm font-bold text-foreground truncate">
                                            {recapData.title}
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setStep("value")}
                                    className="text-xs text-muted-foreground hover:text-foreground h-8 px-2.5 font-semibold"
                                >
                                    Modifier
                                </Button>
                            </div>

                            {/* Discord Information Callout */}
                            <div className="p-3.5 rounded-xl bg-accent/[0.06] border border-accent/20 flex items-start gap-3 text-xs leading-relaxed">
                                <BellRing className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                                <div className="text-muted-foreground">
                                    Un ping Discord sera envoyé à <strong className="text-foreground">{targetName}</strong> dans le salon des sollicitations de la guilde avec votre message et un bouton permettant de vous répondre directement.
                                </div>
                            </div>

                            {/* Message input */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <Label className="text-xs font-semibold text-foreground">
                                        Message personnalisé <span className="text-muted-foreground font-normal">(optionnel)</span>
                                    </Label>
                                    <span className={cn(
                                        "text-[11px] font-mono",
                                        message.length > 450 ? "text-warning font-bold" : "text-muted-foreground"
                                    )}>
                                        {message.length} / 500
                                    </span>
                                </div>
                                <Textarea
                                    placeholder="Ex : Bonjour, pourrais-tu me crafter cet item ce soir ? Je fournis les ressources et le pourboire..."
                                    className="bg-background/70 border-border focus-visible:border-accent focus-visible:ring-accent/20 min-h-[95px] rounded-xl text-sm placeholder:text-muted-foreground/60 resize-none"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                                    maxLength={500}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Navigation */}
                <div className="p-4 bg-background/60 border-t border-border flex items-center justify-between">
                    {step === "type" ? (
                        <Button
                            variant="ghost"
                            onClick={handleClose}
                            className="text-xs text-muted-foreground hover:text-foreground font-semibold h-9 px-3 cursor-pointer"
                        >
                            Annuler
                        </Button>
                    ) : (
                        <Button
                            variant="ghost"
                            onClick={() => {
                                if (step === "value") setStep("type");
                                if (step === "message") setStep("value");
                            }}
                            className="text-xs text-muted-foreground hover:text-foreground font-semibold h-9 px-3 gap-1.5 cursor-pointer"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Retour
                        </Button>
                    )}

                    {step === "type" && (
                        <Button
                            onClick={() => setStep("value")}
                            disabled={!canProceedFromType}
                            className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold text-xs h-9 px-4 rounded-xl gap-1.5 cursor-pointer shadow-xs disabled:opacity-40"
                        >
                            Continuer
                            <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                    )}

                    {step === "value" && (
                        <Button
                            onClick={() => setStep("message")}
                            disabled={!value}
                            className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold text-xs h-9 px-4 rounded-xl gap-1.5 cursor-pointer shadow-xs disabled:opacity-40"
                        >
                            Continuer
                            <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                    )}

                    {step === "message" && (
                        <Button
                            onClick={handleSubmit}
                            disabled={isPending || !value}
                            className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold text-xs h-9 px-5 rounded-xl gap-2 cursor-pointer shadow-xs disabled:opacity-40"
                        >
                            {isPending ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Envoi en cours...</span>
                                </>
                            ) : (
                                <>
                                    <Send className="w-3.5 h-3.5" />
                                    <span>Envoyer la demande</span>
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

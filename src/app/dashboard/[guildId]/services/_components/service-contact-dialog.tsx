"use client";

import { useState, useTransition } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, MessageSquare, Swords, ScrollText, CheckCircle2 } from "lucide-react";
import { contactPasseurAction } from "@/server/actions/service-actions";
import { type ServiceListingWithProfile } from "@/server/actions/service-actions";
import { getAchievementIconUrl } from "@/lib/achievement-icon";
import { toast } from "sonner";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { FM_JOBS } from "./service-form";
import { getJob } from "@/lib/dofus-assets";

interface ServiceContactDialogProps {
    listing: ServiceListingWithProfile;
    guildId: string;
    isDiscordConfigured?: boolean;
}

export function ServiceContactDialog({ listing, guildId, isDiscordConfigured = false }: ServiceContactDialogProps) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState("");
    const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

    const professionsList = (listing.professions as string[] | null) || [];

    // Get icon for a specific profession name
    const getProfessionIcon = (prof: string) => {
        if (listing.category === "FORGEMAGIE") {
            const jobDef = FM_JOBS.find(j => j.name === prof);
            return jobDef?.iconUrl || null;
        } else {
            const jobDef = getJob(prof);
            return jobDef?.icon || null;
        }
    };

    // Determine the available options based on listing data
    const getAvailableOptions = () => {
        if (listing.category === "FORGEMAGIE" || listing.category === "METIER") {
            if (professionsList.length > 1) {
                return professionsList;
            }
            return [];
        }
        if (listing.priceTiers && (listing.priceTiers as any[]).length > 0) {
            return (listing.priceTiers as any[]).map(t => `${t.label} (${t.price})`);
        }
        if (listing.category === "PASSAGE_DONJON" && (listing.selectedAchievementNames as string[] | null)?.length) {
            return (listing.selectedAchievementNames as string[]).map(name => `${name}`);
        }
        if (listing.category === "PASSAGE_DONJON") {
            return ["Passage classique"];
        }
        return [];
    };

    const options = getAvailableOptions();

    const handleOpen = () => {
        setMessage("");
        setSelectedOptions([]);
        setOpen(true);
    };

    const handleOptionToggle = (option: string) => {
        setSelectedOptions(prev =>
            prev.includes(option)
                ? prev.filter(o => o !== option)
                : [...prev, option]
        );
    };

    const handleSubmit = () => {
        startTransition(async () => {
            // If no options selected, default to the first one (only if options are available)
            // or if it's a single profession, use that single profession.
            let finalOptions = selectedOptions;
            if (finalOptions.length === 0) {
                if (options.length > 0) {
                    finalOptions = [options[0]];
                } else if ((listing.category === "FORGEMAGIE" || listing.category === "METIER") && professionsList.length === 1) {
                    finalOptions = [professionsList[0]];
                }
            }
            const res = await contactPasseurAction(guildId, listing.id, finalOptions, message.trim() || null);
            if (res.success) {
                toast.success("Demande envoyée ! Le passeur a été notifié sur Discord.");
                setOpen(false);
            } else {
                toast.error(res.error || "Impossible d'envoyer la demande.");
            }
        });
    };

    const name = listing.profile.pseudoDofus || listing.profile.discordNickname || listing.profile.user?.name || "Passeur";

    // Resolve profession icon if there's exactly one profession
    const singleProfessionIcon = professionsList.length === 1 ? getProfessionIcon(professionsList[0]) : null;

    return (
        <Dialog open={open && isDiscordConfigured} onOpenChange={isDiscordConfigured ? setOpen : undefined}>
            <DialogTrigger asChild>
                <Button
                    onClick={isDiscordConfigured ? handleOpen : undefined}
                    disabled={!isDiscordConfigured}
                    className={cn(
                        "font-black uppercase tracking-wider text-caption sm:text-xs rounded-xl h-9 px-4 sm:px-5 transition-all shrink-0 w-fit",
                        isDiscordConfigured 
                            ? "bg-info hover:bg-info text-info-foreground shadow-lg shadow-cyan-900/20" 
                            : "bg-elevated text-muted-foreground border border-border/50 cursor-not-allowed opacity-60"
                    )}
                >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    {isDiscordConfigured ? "Contacter" : "Non configuré"}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg bg-background border border-border shadow-2xl rounded-3xl text-foreground p-0 gap-0 overflow-hidden backdrop-blur-xl">
                <div className="p-5 pb-4 border-b border-border bg-surface/30">
                    <DialogTitle className="text-base font-black flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-info/20 border border-info/30 flex items-center justify-center shrink-0 shadow-inner">
                            <MessageSquare className="w-4 h-4 text-info" strokeWidth={2.5} />
                        </div>
                        Contacter {name}
                    </DialogTitle>
                </div>

                <div className="p-6 space-y-6">
                    {/* Readonly Context Box */}
                    <div className="rounded-2xl border border-white/8 bg-surface p-4 space-y-3">
                        <div className="flex items-center gap-3">
                            {listing.category === "PASSAGE_DONJON" && listing.dungeonImageUrl ? (
                                <div className="relative h-10 w-10 rounded-xl shrink-0 overflow-hidden border border-info/20 shadow-inner">
                                    <Image src={listing.dungeonImageUrl} alt={listing.dungeonName || ""} fill className="object-cover" />
                                </div>
                            ) : listing.category === "PASSAGE_DONJON" ? (
                                <div className="h-10 w-10 rounded-xl shrink-0 bg-info/10 flex items-center justify-center border border-info/20 shadow-inner">
                                    <Swords className="h-5 w-5 text-info" />
                                </div>
                            ) : singleProfessionIcon ? (
                                <div className="relative h-10 w-10 rounded-xl shrink-0 bg-surface border border-border p-1.5 flex items-center justify-center shadow-inner overflow-hidden">
                                    <Image src={singleProfessionIcon} alt={professionsList[0]} fill className="object-contain p-1" />
                                </div>
                            ) : (
                                <div className="h-10 w-10 rounded-xl shrink-0 bg-violet-500/10 flex items-center justify-center border border-violet-500/20 shadow-inner">
                                    <ScrollText className="h-5 w-5 text-violet-400" />
                                </div>
                            )}
                            <div>
                                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider leading-none">Service demandé</p>
                                <p className="text-sm font-black text-foreground mt-1 leading-tight">{listing.title}</p>
                            </div>
                        </div>
                    </div>

                    {/* Options Selection */}
                    {options.length > 0 && (
                        <div className="space-y-3">
                            <Label className="text-muted-foreground text-xs font-black uppercase tracking-widest">Options du service (Sélectionnez)</Label>
                            <div className="grid grid-cols-1 gap-2.5">
                                {options.map((option) => {
                                    const isChecked = selectedOptions.includes(option);
                                    // Resolve achievement icon if category is PASSAGE_DONJON
                                    let achievementIcon: string | null = null;
                                    if (listing.category === "PASSAGE_DONJON") {
                                        const matchName = (listing.selectedAchievementNames as string[] | null)?.find(
                                            name => name === option || option.startsWith(name)
                                        );
                                        if (matchName) {
                                            const slug = matchName.toLowerCase()
                                                .normalize("NFD").replace(/[\u0300./\u036f]/g, "")
                                                .replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
                                            achievementIcon = getAchievementIconUrl(slug);
                                        }
                                    }

                                    // Resolve profession icon if category is FORGEMAGIE or METIER
                                    const professionIcon = (listing.category === "FORGEMAGIE" || listing.category === "METIER")
                                        ? getProfessionIcon(option)
                                        : null;

                                    const displayIcon = achievementIcon || professionIcon;

                                    return (
                                        <button
                                            key={option}
                                            type="button"
                                            onClick={() => handleOptionToggle(option)}
                                            className={cn(
                                                "flex items-center gap-3 justify-between rounded-xl border p-3.5 text-left transition-all duration-300",
                                                isChecked
                                                    ? "border-info/40 bg-info/5 text-info-foreground"
                                                    : "border-border bg-surface text-muted-foreground hover:border-border hover:text-foreground"
                                            )}
                                        >
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                {displayIcon && (
                                                    <div className="relative h-6 w-6 shrink-0">
                                                        <Image 
                                                            src={displayIcon} 
                                                            alt={option} 
                                                            fill 
                                                            className="object-contain"
                                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                        />
                                                    </div>
                                                )}
                                                <span className="text-xs font-bold leading-tight truncate">{option}</span>
                                            </div>
                                            <div className={cn(
                                                "h-5 w-5 rounded-lg border flex items-center justify-center transition-all shrink-0",
                                                isChecked
                                                    ? "border-info bg-info text-info-foreground"
                                                    : "border-border-strong bg-black/20"
                                            )}>
                                                {isChecked && <CheckCircle2 className="h-3.5 w-3.5 text-foreground" strokeWidth={3} />}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Custom Message */}
                    <div className="space-y-2">
                        <Label className="text-muted-foreground text-xs font-black uppercase tracking-widest">Votre message (Optionnel)</Label>
                        <Textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Ex: Salut ! Je suis dispo ce soir à 21h, j'ai mes clés. Merci !"
                            className="bg-muted/30 border-border text-foreground rounded-xl placeholder:text-muted-foreground focus:border-info/50 resize-none h-24 text-xs leading-relaxed"
                            maxLength={1000}
                        />
                    </div>
                </div>

                <div className="px-6 pb-6 flex gap-3 border-t border-border pt-5 bg-surface/30">
                    <Button
                        variant="ghost"
                        onClick={() => setOpen(false)}
                        className="flex-1 border border-border bg-surface text-foreground hover:text-foreground hover:bg-surface font-bold h-12 transition-all rounded-xl"
                    >
                        Annuler
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isPending}
                        className="flex-1 bg-info hover:bg-info text-info-foreground font-black h-12 shadow-lg shadow-cyan-900/20 rounded-xl transition-all"
                    >
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Envoyer la demande"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

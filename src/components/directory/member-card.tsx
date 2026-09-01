"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { UserProfile, User } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Hammer, Palmtree, Shield, ShieldCheck, Sparkles, Copy } from "lucide-react";
import { toast } from "sonner";
import { getClass, DOFUS_JOBS } from "@/lib/dofus-assets";
import { getDisplayName } from "@/lib/display-name";
import { metierIds } from "@/lib/metiers";
import { ClassIcon } from "@/components/shared/class-icon";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getAlignment, getOrder } from "@/lib/dofus-assets";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface ExtendedProfile extends UserProfile {
    user: User;
    displayName?: string;
    roleColor?: number;
    roleName?: string;
    isAdmin?: boolean;
    alignment: string | null;
    alignmentOrder: string | null;
    alignmentLevel: number | null;
    legendaryCrafts?: any[];
}

interface MemberCardProps {
    profile: ExtendedProfile;
    guildId: string;
}

export function MemberCard({ profile, guildId }: MemberCardProps) {
    // Client-only hydration guard: vacation/online states depend on `new Date()`, which
    // differs between SSR and client hydration. Any member right at a vacation or 2-min
    // activity boundary would render mismatched text → React #418. Gating behind `mounted`
    // makes SSR and the first client render identical, then re-renders with the client clock.
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const jobs = metierIds(profile.metiers);
    const topJobs = jobs.slice(0, 3);
    const remaining = jobs.length - 3;

    const classData = getClass(profile.classe || "");

    const altPseudos = Array.isArray(profile.altPseudos) ? (profile.altPseudos as any[]) : [];
    const alignedMules = altPseudos.filter((mule: any) => 
        mule && typeof mule === 'object' && mule.pseudo && mule.alignment && mule.alignment !== "neutre" && mule.alignmentOrder
    );


    const displayName = profile.displayName || getDisplayName(profile) || "Voyageur";

    // Role color border
    const roleColor = profile.roleColor && profile.roleColor > 0
        ? `#${profile.roleColor.toString(16).padStart(6, "0")}`
        : undefined;

    // Check if on vacation (client-only — see mounted guard above)
    const now = new Date();
    const vacationStart = profile.vacationStart ? new Date(profile.vacationStart) : null;
    const vacationEnd = profile.vacationEnd ? new Date(profile.vacationEnd) : null;
    const isOnVacation = mounted && vacationStart && vacationStart <= now && (!vacationEnd || vacationEnd >= now);
    const isUpcoming = mounted && vacationStart && vacationStart > now;

    // Format vacation dates for tooltip (client-only; static otherwise to keep SSR identical)
    const vacationTooltip = mounted && (isOnVacation || isUpcoming)
        ? `Absent du ${format(vacationStart!, "d MMM", { locale: fr })}${vacationEnd ? ` au ${format(vacationEnd, "d MMM", { locale: fr })}` : " (indéfini)"}`
        : "";

    // Check if online (last 2 minutes) — client-only
    const activeThreshold = 2 * 60 * 1000;
    const isOnline = mounted && profile.lastActivityAt && (now.getTime() - new Date(profile.lastActivityAt).getTime() < activeThreshold);

    const alignmentData = getAlignment(profile.alignment || "");
    const orderData = profile.alignment && profile.alignmentOrder ? getOrder(profile.alignment, profile.alignmentOrder) : null;

    // #60 : copie rapide du pseudo pour /w en jeu
    const handleCopyPseudo = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const pseudo = profile.pseudoDofus || profile.discordNickname || displayName;
        if (!pseudo) return;
        navigator.clipboard.writeText(`/w ${pseudo}`).then(() => {
            toast.success(`Pseudo "${pseudo}" copié (commande /w prête)`);
        }).catch(() => {
            toast.error("Impossible de copier le pseudo");
        });
    };

    return (
        <Link href={`/dashboard/${guildId}/members/${encodeURIComponent(profile.pseudoDofus || profile.id)}`}>
            <Card
                className={cn(
                    "group relative overflow-hidden cursor-pointer border transition-colors duration-200 bg-surface",
                    roleColor ? "" : "border-border hover:border-border",
                    isOnVacation && "bg-info/20 border-info/20 hover:border-info/40"
                )}
                style={roleColor ? { borderColor: `${roleColor}30` } : undefined}
            >
                {/* Top accent banner */}
                <div 
                    className="absolute top-0 left-0 w-full h-1"
                    style={roleColor ? { backgroundColor: roleColor } : { backgroundColor: "var(--muted)" }}
                />

                <CardContent className="p-6 flex flex-col items-center gap-4 relative z-10">
                    {/* Vacation Badges */}
                    {isOnVacation && (
                        <div className="absolute top-3 right-3 z-20">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Badge variant="outline" className="bg-info/10 border-info/30 text-info gap-1.5 hover:bg-info/20 transition-colors cursor-help">
                                            <Palmtree className="w-3.5 h-3.5" />
                                            <span className="text-caption font-semibold uppercase tracking-wide hidden sm:inline">En vacances</span>
                                        </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="bg-surface border-info/30 text-info">
                                        <p className="font-bold">{vacationTooltip}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    )}
                    {isUpcoming && (
                        <div className="absolute top-3 right-3 z-20">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Badge variant="outline" className="bg-warning/10 border-warning/30 text-warning gap-1.5 hover:bg-warning/20 transition-colors cursor-help">
                                            <Palmtree className="w-3.5 h-3.5" />
                                            <span className="text-caption font-semibold uppercase tracking-wide hidden sm:inline">Bientôt</span>
                                        </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="bg-surface border-warning/30 text-warning dark:text-warning">
                                        <p className="font-bold">⏳ {vacationTooltip}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    )}

                    {/* Avatar Container */}
                    <div className="relative group/avatar mt-2">
                        <Avatar
                            className="w-24 h-24 transition-colors duration-200 ring-2 ring-offset-4 ring-offset-background"
                            style={{ "--ringColor": roleColor || "rgba(255,255,255,0.1)" } as React.CSSProperties}
                        >
                            <AvatarImage src={profile.user.image || ""} className="object-cover" />
                            <AvatarFallback className="text-2xl font-black bg-surface text-muted-foreground">
                                {displayName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        
                        {/* Online Status Indicator */}
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className={cn(
                                        "absolute bottom-1 right-1 w-5 h-5 rounded-full border-[3px] border-border transition-all duration-300",
                                        isOnline ? "bg-success " : "bg-muted"
                                    )} />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="bg-surface border-border text-xs font-bold uppercase tracking-widest">
                                    {isOnline ? "En ligne récemment" : "Hors ligne"}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        {/* Alignment/Order Badge */}
                        {profile.alignment && (
                            <div className="absolute -top-1.5 -left-1.5 z-20">
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className={cn(
                                                "w-11 h-11 rounded-xl border-2 bg-surface flex items-center justify-center overflow-hidden",
                                                profile.alignment === "bontarien" ? "border-info/40" : 
                                                profile.alignment === "brakmarien" ? "border-danger/40" : 
                                                "border-border-strong"
                                            )}>
                                                {orderData ? (
                                                    <Image src={orderData.icon} alt={orderData.name} width={36} height={36} className="object-contain w-full h-full p-1" />
                                                ) : (
                                                    <Shield className={cn(
                                                        "w-5 h-5",
                                                        profile.alignment === "bontarien" ? "text-info" : 
                                                        profile.alignment === "brakmarien" ? "text-danger" : 
                                                        "text-muted-foreground"
                                                    )} />
                                                )}
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="left" className="glass-premium border-border text-caption font-black uppercase tracking-widest">
                                            <p>{alignmentData?.name}{orderData ? ` - ${orderData.name}` : ""}</p>
                                            {profile.alignmentLevel ? <p className="text-muted-foreground">Niveau {profile.alignmentLevel}</p> : null}
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        )}
                    </div>

                    {/* Name & Role */}
                    <div className="text-center space-y-2 w-full mt-2">
                        <div className="flex items-center justify-center gap-2 w-full min-w-0">
                            <h3 className="font-bold text-lg text-foreground truncate min-w-0">
                                {displayName}
                            </h3>
                            <button
                                type="button"
                                onClick={handleCopyPseudo}
                                className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-success/30 bg-success/10 text-success hover:bg-success/20 hover:text-success transition-colors shrink-0"
                                title={`Copier le pseudo pour /w ${profile.pseudoDofus || profile.discordNickname || displayName}`}
                                aria-label="Copier le pseudo"
                            >
                                <Copy className="w-3 h-3" />
                                <span className="text-caption font-semibold hidden sm:inline">Copier</span>
                            </button>
                            {profile.isAdmin && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <ShieldCheck className="w-4 h-4 text-warning shrink-0" />
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="glass-premium border-warning/30 text-warning text-caption font-semibold">
                                            Administration SigilOS
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                            {profile.legendaryCrafts && profile.legendaryCrafts.length > 0 && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Sparkles className="w-4 h-4 text-info shrink-0" />
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="glass-premium border-info/30 text-info text-caption font-semibold">
                                            Artisan Légendaire Spécialisé
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                        </div>
                            

                        
                        <div className="flex items-center justify-center gap-1.5 pt-1">
                            {classData && <ClassIcon classId={classData.id} size={18} className="opacity-80" />}
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                                {classData?.name || profile.classe || "Aventurier"}
                            </p>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="w-full h-px bg-border my-1" />

                    {/* Jobs */}
                    <div className={cn(
                        "flex flex-wrap items-center justify-center gap-2 min-h-[1.5rem]",
                        isOnVacation && "mb-2"
                    )}>
                        {jobs.length > 0 ? (
                            <>
                                {topJobs.map(job => {
                                    const jobData = Object.values(DOFUS_JOBS).flat().find(j => j.id === job);
                                    return (
                                        <Badge key={job} variant="secondary" className="bg-surface hover:bg-surface text-caption px-2.5 py-1 border-border font-black uppercase tracking-widest text-foreground transition-colors">
                                            {jobData?.icon ? (
                                                jobData.icon.startsWith("/") ? (
                                                    <Image src={jobData.icon} alt={jobData.name} width={14} height={14} className="w-3.5 h-3.5 mr-1.5 object-contain opacity-80" />
                                                ) : (
                                                    <span className="mr-1.5 opacity-80 text-caption">{jobData.icon}</span>
                                                )
                                            ) : (
                                                <Hammer className="w-3 h-3 mr-1.5 opacity-50" />
                                            )}
                                            {jobData?.name || job}
                                        </Badge>
                                    );
                                })}
                                {remaining > 0 && (
                                    <div className="w-6 h-6 rounded-full bg-surface border border-border flex items-center justify-center text-caption font-black text-muted-foreground">
                                        +{remaining}
                                    </div>
                                )}
                            </>
                        ) : (
                            <span className="text-caption text-muted-foreground uppercase tracking-widest font-bold">Aucun métier</span>
                        )}
                    </div>

                    {/* Aligned Mules */}
                    {alignedMules.length > 0 && (
                        <>
                            <div className="w-full h-px bg-border my-1" />
                            <div className="flex flex-col items-center gap-1.5 w-full">
                                <span className="text-caption font-black text-muted-foreground uppercase tracking-widest">Mules alignées</span>
                                <div className="flex flex-wrap justify-center gap-1.5">
                                    {alignedMules.map((mule: any, idx: number) => {
                                        const mCls = getClass(mule.classe || "cra");
                                        const mOrder = mule.alignment && mule.alignmentOrder ? getOrder(mule.alignment, mule.alignmentOrder) : null;
                                        return (
                                            <TooltipProvider key={mule.id || idx}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className="flex items-center gap-1.5 bg-black/40 border border-border rounded-md px-2 py-0.5 max-w-full">
                                                            {mCls && (
                                                                <div className="relative w-4.5 h-4.5 shrink-0">
                                                                    <Image 
                                                                        src={mCls.icon} 
                                                                        alt={mCls.name} 
                                                                        fill 
                                                                        className="object-contain" 
                                                                        unoptimized
                                                                    />
                                                                </div>
                                                            )}
                                                            <span className="text-caption text-foreground font-bold max-w-[70px] truncate">
                                                                {mule.pseudo}
                                                            </span>
                                                            {mOrder && (
                                                                <div className="relative w-4 h-4 shrink-0 ml-0.5">
                                                                    <Image 
                                                                        src={mOrder.icon} 
                                                                        alt={mOrder.name} 
                                                                        fill 
                                                                        className="object-contain" 
                                                                        unoptimized
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="border-border text-caption font-semibold">
                                                        <p>{mule.pseudo} (Nv. {mule.level || 200})</p>
                                                        <p className="text-muted-foreground">{mCls?.name || "Classe inconnue"} - {mOrder?.name || "Sans ordre"}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Absence details footer */}
                    {isOnVacation && (
                        <div className="w-full mt-2 pt-3 border-t border-info/10 flex flex-col items-center gap-1.5 animate-in slide-in-from-bottom-2 duration-300">
                            <span className="text-caption text-info font-bold uppercase tracking-widest flex items-center gap-1 bg-info/10 px-2 py-0.5 rounded-full border border-info/20">
                                <Palmtree className="w-3 h-3" /> Période d'absence
                            </span>
                            <span className="text-caption text-foreground font-medium whitespace-nowrap">
                                {format(vacationStart!, "d MMMM", { locale: fr })}
                                {vacationEnd ? ` au ${format(vacationEnd, "d MMMM", { locale: fr })}` : " (indéfini)"}
                            </span>
                        </div>
                    )}
                </CardContent>
            </Card>
        </Link>
    );
}

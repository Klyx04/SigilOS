"use client";

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
    const jobs = Array.isArray(profile.metiers) ? (profile.metiers as string[]) : [];
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

    // Check if on vacation
    const now = new Date();
    const vacationStart = profile.vacationStart ? new Date(profile.vacationStart) : null;
    const vacationEnd = profile.vacationEnd ? new Date(profile.vacationEnd) : null;
    const isOnVacation = vacationStart && vacationStart <= now && (!vacationEnd || vacationEnd >= now);
    const isUpcoming = vacationStart && vacationStart > now;

    // Format vacation dates for tooltip
    const vacationTooltip = (isOnVacation || isUpcoming)
        ? `Absent du ${format(vacationStart!, "d MMM", { locale: fr })}${vacationEnd ? ` au ${format(vacationEnd, "d MMM", { locale: fr })}` : " (indéfini)"}`
        : "";

    // Check if online (last 2 minutes)
    const activeThreshold = 2 * 60 * 1000;
    const isOnline = profile.lastActivityAt && (new Date().getTime() - new Date(profile.lastActivityAt).getTime() < activeThreshold);

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
                    "group relative overflow-hidden cursor-pointer border shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl bg-zinc-950/80 backdrop-blur-md",
                    roleColor ? "" : "border-white/5 hover:border-white/10",
                    isOnVacation && "bg-cyan-950/20 border-cyan-500/20 hover:border-cyan-500/40"
                )}
                style={roleColor ? { borderColor: `${roleColor}30`, boxShadow: `0 10px 40px -10px ${roleColor}15` } : undefined}
            >
                {/* Dynamic Background Glow & Top Banner */}
                <div 
                    className="absolute inset-0 opacity-20 group-hover:opacity-40 transition-opacity duration-300 pointer-events-none"
                    style={roleColor ? { background: `radial-gradient(circle at 50% 0%, ${roleColor}, transparent 70%)` } : { background: `radial-gradient(circle at 50% 0%, rgba(255,255,255,0.1), transparent 70%)` }}
                />
                <div 
                    className="absolute top-0 left-0 w-full h-1"
                    style={roleColor ? { backgroundColor: roleColor } : { background: "linear-gradient(90deg, #3f3f46, #71717a)" }}
                />

                <CardContent className="p-6 flex flex-col items-center gap-4 relative z-10">
                    {/* Vacation Badges */}
                    {isOnVacation && (
                        <div className="absolute top-3 right-3 z-20">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Badge variant="outline" className="bg-cyan-500/10 border-cyan-500/30 text-cyan-400 gap-1.5 hover:bg-cyan-500/20 transition-colors cursor-help">
                                            <Palmtree className="w-3.5 h-3.5" />
                                            <span className="text-caption font-semibold uppercase tracking-wide hidden sm:inline">En vacances</span>
                                        </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="glass-premium border-cyan-500/30 text-cyan-600 dark:text-cyan-300">
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
                                        <Badge variant="outline" className="bg-orange-500/10 border-orange-500/30 text-orange-400 gap-1.5 hover:bg-orange-500/20 transition-colors cursor-help">
                                            <Palmtree className="w-3.5 h-3.5" />
                                            <span className="text-caption font-semibold uppercase tracking-wide hidden sm:inline">Bientôt</span>
                                        </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="glass-premium border-orange-500/30 text-orange-600 dark:text-orange-300">
                                        <p className="font-bold">⏳ {vacationTooltip}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    )}

                    {/* Avatar Container */}
                    <div className="relative group/avatar mt-2">
                        <div className="absolute inset-0 rounded-full blur-md opacity-0 group-hover/avatar:opacity-50 transition-opacity duration-300"
                             style={roleColor ? { backgroundColor: roleColor } : { backgroundColor: "rgba(255,255,255,0.2)" }} />
                        
                        <Avatar
                            className="w-24 h-24 transition-all duration-300 ring-2 ring-offset-4 ring-offset-zinc-950 group-hover/avatar:scale-105"
                            style={{ "--ringColor": roleColor || "rgba(255,255,255,0.1)" } as React.CSSProperties}
                        >
                            <AvatarImage src={profile.user.image || ""} className="object-cover" />
                            <AvatarFallback className="text-2xl font-black bg-zinc-900 text-zinc-500">
                                {displayName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        
                        {/* Online Status Indicator */}
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className={cn(
                                        "absolute bottom-1 right-1 w-5 h-5 rounded-full border-[3px] border-zinc-950 transition-all duration-300",
                                        isOnline ? "bg-emerald-500 " : "bg-zinc-600"
                                    )} />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="glass-premium border-white/10 text-xs font-bold uppercase tracking-widest">
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
                                                "w-11 h-11 rounded-xl border-2 bg-zinc-950/90 shadow-2xl flex items-center justify-center overflow-hidden",
                                                profile.alignment === "bontarien" ? "border-blue-500/40" : 
                                                profile.alignment === "brakmarien" ? "border-red-500/40" : 
                                                "border-white/20"
                                            )}>
                                                {orderData ? (
                                                    <Image src={orderData.icon} alt={orderData.name} width={36} height={36} className="object-contain w-full h-full p-1" />
                                                ) : (
                                                    <Shield className={cn(
                                                        "w-5 h-5",
                                                        profile.alignment === "bontarien" ? "text-blue-400" : 
                                                        profile.alignment === "brakmarien" ? "text-red-400" : 
                                                        "text-zinc-500"
                                                    )} />
                                                )}
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="left" className="glass-premium border-white/10 text-caption font-black uppercase tracking-widest">
                                            <p>{alignmentData?.name}{orderData ? ` - ${orderData.name}` : ""}</p>
                                            {profile.alignmentLevel ? <p className="text-zinc-500">Niveau {profile.alignmentLevel}</p> : null}
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        )}
                    </div>

                    {/* Name & Role */}
                    <div className="text-center space-y-2 w-full mt-2">
                        <div className="flex items-center justify-center gap-2 w-full min-w-0">
                            <h3 className="font-bold text-lg text-white truncate min-w-0">
                                {displayName}
                            </h3>
                            <button
                                type="button"
                                onClick={handleCopyPseudo}
                                className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200 transition-colors shrink-0"
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
                                            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="glass-premium border-amber-500/30 text-amber-500 text-caption font-semibold">
                                            Administration SigilOS
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                            {profile.legendaryCrafts && profile.legendaryCrafts.length > 0 && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="glass-premium border-purple-500/30 text-purple-400 text-caption font-semibold">
                                            Artisan Légendaire Spécialisé
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                        </div>
                            

                        
                        <div className="flex items-center justify-center gap-1.5 pt-1">
                            {classData && <ClassIcon classId={classData.id} size={18} className="opacity-80" />}
                            <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">
                                {classData?.name || profile.classe || "Aventurier"}
                            </p>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-1" />

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
                                        <Badge key={job} variant="secondary" className="bg-white/[0.03] hover:bg-white/[0.08] text-caption px-2.5 py-1 border-white/5 font-black uppercase tracking-widest text-zinc-300 transition-colors">
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
                                    <div className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-caption font-black text-zinc-400">
                                        +{remaining}
                                    </div>
                                )}
                            </>
                        ) : (
                            <span className="text-caption text-zinc-600 uppercase tracking-widest font-bold">Aucun métier</span>
                        )}
                    </div>

                    {/* Aligned Mules */}
                    {alignedMules.length > 0 && (
                        <>
                            <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-1" />
                            <div className="flex flex-col items-center gap-1.5 w-full">
                                <span className="text-caption font-black text-zinc-500 uppercase tracking-widest">Mules alignées</span>
                                <div className="flex flex-wrap justify-center gap-1.5">
                                    {alignedMules.map((mule: any, idx: number) => {
                                        const mCls = getClass(mule.classe || "cra");
                                        const mOrder = mule.alignment && mule.alignmentOrder ? getOrder(mule.alignment, mule.alignmentOrder) : null;
                                        return (
                                            <TooltipProvider key={mule.id || idx}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className="flex items-center gap-1.5 bg-black/40 border border-white/5 rounded-md px-2 py-0.5 max-w-full">
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
                                                            <span className="text-caption text-zinc-300 font-bold max-w-[70px] truncate">
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
                                                    <TooltipContent side="top" className="glass-premium border-white/10 text-caption font-black uppercase tracking-widest">
                                                        <p>{mule.pseudo} (Nv. {mule.level || 200})</p>
                                                        <p className="text-zinc-500">{mCls?.name || "Classe inconnue"} - {mOrder?.name || "Sans ordre"}</p>
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
                        <div className="w-full mt-2 pt-3 border-t border-cyan-500/10 flex flex-col items-center gap-1.5 animate-in slide-in-from-bottom-2 duration-300">
                            <span className="text-caption text-cyan-400 font-bold uppercase tracking-widest flex items-center gap-1 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                                <Palmtree className="w-3 h-3" /> Période d'absence
                            </span>
                            <span className="text-caption text-zinc-300 font-black italic whitespace-nowrap">
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

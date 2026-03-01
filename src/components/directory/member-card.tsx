"use client";

import Link from "next/link";
import { UserProfile, User } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Hammer, Palmtree, ShieldCheck } from "lucide-react";
import { getClass, DOFUS_JOBS } from "@/lib/dofus-assets";
import { ClassIcon } from "@/components/shared/class-icon";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
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


    const displayName = profile.displayName || profile.pseudoDofus || profile.user.name || "Voyageur";

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

    return (
        <Link href={`/dashboard/${guildId}/members/${profile.id}`}>
            <Card
                className={cn(
                    "bg-white/[0.03] hover:bg-white/[0.08] transition-all group overflow-hidden cursor-pointer border-2 shadow-lg",
                    roleColor ? "" : "border-white/5"
                )}
                style={roleColor ? { borderColor: roleColor } : undefined}
            >
                <CardContent className="p-6 flex flex-col items-center gap-4 relative">
                    {/* Vacation Badge */}
                    {isOnVacation && (
                        <div className="absolute top-3 right-3">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Badge variant="outline" className="bg-cyan-500/10 border-cyan-500/30 text-cyan-400 gap-1.5 hover:bg-cyan-500/20 transition-colors cursor-help">
                                            <Palmtree className="w-3.5 h-3.5" />
                                            <span className="text-[10px] font-semibold uppercase tracking-wide">En vacances</span>
                                        </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="bg-zinc-900 border-cyan-500/30 text-cyan-300">
                                        <p>{vacationTooltip}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    )}
                    {isUpcoming && (
                        <div className="absolute top-3 right-3">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Badge variant="outline" className="bg-orange-500/10 border-orange-500/30 text-orange-400 gap-1.5 hover:bg-orange-500/20 transition-colors cursor-help">
                                            <Palmtree className="w-3.5 h-3.5" />
                                            <span className="text-[10px] font-semibold uppercase tracking-wide">Bientôt</span>
                                        </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="bg-zinc-900 border-orange-500/30 text-orange-300">
                                        <p>⏳ {vacationTooltip}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    )}

                    {/* Avatar */}
                    <div className="relative">
                        <Avatar
                            className={cn(
                                "w-20 h-20 border-2 transition-all",
                                isOnline && "ring-2 ring-emerald-500/20 ring-offset-2 ring-offset-black"
                            )}
                            style={roleColor ? { borderColor: roleColor } : { borderColor: "rgba(255,255,255,0.1)" }}
                        >
                            <AvatarImage src={profile.user.image || ""} />
                            <AvatarFallback className="text-xl bg-primary/10 text-primary">
                                {displayName?.[0]?.toUpperCase() ?? "?"}
                            </AvatarFallback>
                        </Avatar>
                        {isOnline && (
                            <div className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 border-2 border-zinc-950 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.6)] animate-pulse" />
                        )}
                    </div>

                    {/* Name & Class */}
                    <div className="text-center space-y-1 w-full">
                        <div className="flex items-center justify-center gap-1.5">
                            <h3 className="font-bold text-lg truncate text-white">
                                {displayName}
                            </h3>
                            {profile.isAdmin && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <ShieldCheck className="w-4 h-4 text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.4)] shrink-0" />
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="bg-zinc-900 border-purple-500/30 text-purple-200 text-[10px] font-bold uppercase tracking-wider">
                                            Administration
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                        </div>
                        <div className="flex items-center justify-center gap-1.5">
                            {classData && <ClassIcon classId={classData.id} size={20} />}
                            <p className="text-sm text-muted-foreground font-medium">
                                {classData?.name || profile.classe || "Aventurier"}
                            </p>
                        </div>
                    </div>

                    {/* Jobs */}
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-2 min-h-[1.5rem]">
                        {jobs.length > 0 ? (
                            <>
                                {topJobs.map(job => {
                                    const jobData = Object.values(DOFUS_JOBS).flat().find(j => j.id === job);
                                    return (
                                        <Badge key={job} variant="secondary" className="bg-white/5 hover:bg-white/10 text-[10px] px-2 py-0.5 border-white/5">
                                            {jobData?.icon ? (
                                                jobData.icon.startsWith("/") ? (
                                                    <Image src={jobData.icon} alt={jobData.name} width={16} height={16} className="w-4 h-4 mr-1 object-contain" />
                                                ) : (
                                                    <span className="mr-1">{jobData.icon}</span>
                                                )
                                            ) : (
                                                <Hammer className="w-3 h-3 mr-1 opacity-50" />
                                            )}
                                            <span className="ml-1">{jobData?.name || job}</span>
                                        </Badge>
                                    );
                                })}
                                {remaining > 0 && (
                                    <span className="text-xs text-muted-foreground">+{remaining}</span>
                                )}
                            </>
                        ) : (
                            <span className="text-xs text-zinc-600 italic">Aucun métier</span>
                        )}
                    </div>

                    {/* Forgemagie Badge */}

                </CardContent>
            </Card>
        </Link>
    );
}

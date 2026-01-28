"use client";

import Link from "next/link";
import { UserProfile, User } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Hammer, Palmtree, Sparkles } from "lucide-react";
import { getClass, DOFUS_JOBS, getForgemagieStatus, type ForgemagieStatusId } from "@/lib/dofus-assets";
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
    const fmStatus = profile.forgemagieStatus
        ? getForgemagieStatus(profile.forgemagieStatus)
        : null;
    const showFMBadge = fmStatus && fmStatus.id !== "UNAVAILABLE";

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

    // Format vacation dates for tooltip
    const vacationTooltip = isOnVacation
        ? `Absent du ${format(vacationStart!, "d MMM", { locale: fr })}${vacationEnd ? ` au ${format(vacationEnd, "d MMM", { locale: fr })}` : " (indéfini)"}`
        : "";

    return (
        <Link href={`/dashboard/${guildId}/members/${profile.id}`}>
            <Card
                className={cn(
                    "bg-zinc-900/40 hover:bg-zinc-900/60 transition-all group overflow-hidden cursor-pointer border-2",
                    roleColor ? "" : "border-white/5 hover:border-primary/50"
                )}
                style={roleColor ? { borderColor: roleColor } : undefined}
            >
                <CardContent className="p-6 flex flex-col items-center gap-4">
                    {/* Avatar */}
                    <div className="relative">
                        <Avatar
                            className="w-20 h-20 border-2 transition-all"
                            style={roleColor ? { borderColor: roleColor } : { borderColor: "rgba(255,255,255,0.1)" }}
                        >
                            <AvatarImage src={profile.user.image || ""} />
                            <AvatarFallback className="text-xl bg-primary/10 text-primary">
                                {displayName?.[0]?.toUpperCase() ?? "?"}
                            </AvatarFallback>
                        </Avatar>

                        {/* Vacation Indicator with Tooltip */}
                        {isOnVacation && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="absolute -bottom-1 -right-1 p-1.5 bg-cyan-500/20 rounded-full border border-cyan-500/30 cursor-help">
                                            <Palmtree className="w-3 h-3 text-cyan-400" />
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="bg-zinc-900 border-cyan-500/30 text-cyan-300">
                                        <p>🏖️ {vacationTooltip}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                    </div>

                    {/* Name & Class */}
                    <div className="text-center space-y-1 w-full">
                        <h3 className="font-bold text-lg truncate text-white">
                            {displayName}
                        </h3>
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
                    {showFMBadge && (
                        <Badge
                            variant="outline"
                            className="text-xs"
                            style={{ borderColor: fmStatus!.color + "40", color: fmStatus!.color }}
                        >
                            <Sparkles className="w-3 h-3 mr-1" />
                            FM {fmStatus!.label}
                        </Badge>
                    )}
                </CardContent>
            </Card>
        </Link>
    );
}

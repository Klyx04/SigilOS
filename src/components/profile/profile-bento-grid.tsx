"use client";

import { useState } from "react";
import { HeroHeader } from "./hero-header";
import { ClassDisplay } from "./class-display";
import { JobsGrid } from "./jobs-grid";
import { AvailabilityHeatmap } from "./availability-heatmap";
import { VacationMode } from "./vacation-mode";
import { MetamobLink } from "./metamob-link";
import { AltPseudos } from "./alt-pseudos";
import { updateUserProfile, updateAvailability, updateVacationMode, updateForgemagieStatus, updateAltPseudos } from "@/server/actions/profile-actions";
import { toast } from "sonner";
import type { AvailabilityMap, ForgemagieStatusId } from "@/lib/dofus-assets";

interface ProfileBentoGridProps {
    profile: {
        id: string;
        pseudoDofus?: string | null;
        classe?: string | null;
        classeSecondaires?: string[] | null;
        metiers?: string[] | null;
        forgemagieStatus?: string | null;
        availability?: AvailabilityMap | null;
        vacationStart?: Date | null;
        vacationEnd?: Date | null;
        vacationNotify?: boolean;
        metamobPseudo?: string | null;
        metamobVerified?: boolean;
        metamobLastSync?: Date | null;
        altPseudos?: string[] | null;
    };
    user: {
        name?: string | null;
        image?: string | null;
    };
    stats: {
        xp: number;
        weeklyXp: number;
        missionsValidated: number;
        weeklyMissions: number;
        joinedAt: Date | null;
        lastActivity: { description: string; date: Date } | null;
        isTopContributor: boolean;
    };
    guildId: string;
    discordNickname?: string | null;
    roleColor?: number;
    readOnly?: boolean;
}

export function ProfileBentoGrid({
    profile,
    user,
    stats,
    guildId,
    discordNickname,
    roleColor = 0,
    readOnly = false,
}: ProfileBentoGridProps) {
    const [localProfile, setLocalProfile] = useState(profile);

    const displayName = discordNickname || profile.pseudoDofus || user.name || "Voyageur";

    const now = new Date();
    const isOnVacation = Boolean(localProfile.vacationStart &&
        localProfile.vacationStart <= now &&
        (!localProfile.vacationEnd || localProfile.vacationEnd >= now));

    // Handlers
    const handleClassSave = async (mainClass: string, secondaryClasses: string[]) => {
        setLocalProfile(prev => ({ ...prev, classe: mainClass, classeSecondaires: secondaryClasses }));
        const res = await updateUserProfile({
            guildId,
            classe: mainClass,
            classeSecondaires: secondaryClasses,
        });
        if (res.success) {
            toast.success("Classes mises à jour");
        } else {
            toast.error(res.error || "Erreur");
        }
    };

    const handleJobsSave = async (jobs: string[]) => {
        setLocalProfile(prev => ({ ...prev, metiers: jobs }));
        const res = await updateUserProfile({
            guildId,
            metiers: jobs,
        });
        if (res.success) {
            toast.success("Métiers mis à jour");
        } else {
            toast.error(res.error || "Erreur");
        }
    };

    const handleForgemagieStatusSave = async (status: ForgemagieStatusId) => {
        setLocalProfile(prev => ({ ...prev, forgemagieStatus: status }));
        const res = await updateForgemagieStatus({ guildId, status });
        if (res.success) {
            toast.success("Statut Forgemagie mis à jour");
        } else {
            toast.error(res.error || "Erreur");
        }
    };

    const handleAvailabilitySave = async (availability: AvailabilityMap) => {
        setLocalProfile(prev => ({ ...prev, availability }));
        const res = await updateAvailability({ guildId, availability });
        if (res.success) {
            toast.success("Disponibilités mises à jour");
        } else {
            toast.error(res.error || "Erreur");
        }
    };

    const handleVacationSave = async (data: { start: Date | null; end: Date | null; notify: boolean; noEndDate: boolean }) => {
        setLocalProfile(prev => ({
            ...prev,
            vacationStart: data.start,
            vacationEnd: data.noEndDate ? null : data.end,
            vacationNotify: data.notify,
        }));
        const res = await updateVacationMode({
            guildId,
            vacationStart: data.start?.toISOString() ?? null,
            vacationEnd: data.noEndDate ? null : (data.end?.toISOString() ?? null),
            vacationNotify: data.notify,
        });
        if (res.success) {
            toast.success("Mode vacances mis à jour");
        } else {
            toast.error(res.error || "Erreur");
        }
    };

    const handleAltPseudosSave = async (altPseudos: string[]) => {
        setLocalProfile(prev => ({ ...prev, altPseudos }));
        const res = await updateAltPseudos({ guildId, altPseudos });
        if (!res.success) {
            toast.error(res.error || "Erreur");
        }
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Hero Header */}
            <HeroHeader
                avatarUrl={user.image}
                displayName={displayName}
                roleColor={roleColor}
                isTopContributor={stats.isTopContributor}
                isOnVacation={isOnVacation}
                joinedAt={stats.joinedAt}
                xp={stats.xp}
                weeklyXp={stats.weeklyXp}
                missionsValidated={stats.missionsValidated}
                weeklyMissions={stats.weeklyMissions}
            />

            {/* Main Content: 2 Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

                {/* Left Column: Combat & Vacation */}
                <div className="flex flex-col gap-6">
                    <ClassDisplay
                        mainClass={localProfile.classe}
                        secondaryClasses={localProfile.classeSecondaires || []}
                        onSave={handleClassSave}
                        readOnly={readOnly}
                    />

                    <VacationMode
                        vacationStart={localProfile.vacationStart}
                        vacationEnd={localProfile.vacationEnd}
                        vacationNotify={localProfile.vacationNotify}
                        onSave={handleVacationSave}
                        readOnly={readOnly}
                        guildId={guildId}
                        pseudo={displayName}
                        profileId={profile.id}
                    />

                    {/* Alt Pseudos Section */}
                    <AltPseudos
                        altPseudos={localProfile.altPseudos || []}
                        onSave={handleAltPseudosSave}
                        readOnly={readOnly}
                    />
                </div>

                {/* Right Column: Jobs (Taller) */}
                <JobsGrid
                    jobs={localProfile.metiers || []}
                    forgemagieStatus={(localProfile.forgemagieStatus as ForgemagieStatusId) || "UNAVAILABLE"}
                    onSaveJobs={handleJobsSave}
                    onSaveForgemagieStatus={handleForgemagieStatusSave}
                    readOnly={readOnly}
                />
            </div>

            {/* Full Width Sections */}
            <MetamobLink
                guildId={guildId}
                metamobPseudo={profile.metamobPseudo}
                metamobVerified={profile.metamobVerified}
                metamobLastSync={profile.metamobLastSync}
                readOnly={readOnly}
            />

            <AvailabilityHeatmap
                availability={localProfile.availability || {}}
                onSave={handleAvailabilitySave}
                readOnly={readOnly}
            />
        </div>
    );
}

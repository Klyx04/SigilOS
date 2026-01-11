"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Pencil, Check, X } from "lucide-react";
import { DOFUS_JOBS, JOB_CATEGORIES, getForgemagieStatus, type ForgemagieStatusId, FORGEMAGIE_STATUS, hasAnyForgemagie } from "@/lib/dofus-assets";
import { cn } from "@/lib/utils";

interface JobsGridProps {
    jobs?: string[];
    forgemagieStatus?: ForgemagieStatusId;
    onSaveJobs?: (jobs: string[]) => void;
    onSaveForgemagieStatus?: (status: ForgemagieStatusId) => void;
    readOnly?: boolean;
}

export function JobsGrid({
    jobs = [],
    forgemagieStatus = "UNAVAILABLE",
    onSaveJobs,
    onSaveForgemagieStatus,
    readOnly = false,
}: JobsGridProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedJobs, setSelectedJobs] = useState<string[]>(jobs);

    const fmStatus = getForgemagieStatus(forgemagieStatus);

    // Only show FM section if user has at least one Forgemagie job
    const userHasFMJobs = hasAnyForgemagie(jobs);

    const toggleJob = (jobId: string) => {
        if (selectedJobs.includes(jobId)) {
            setSelectedJobs(prev => prev.filter(j => j !== jobId));
        } else {
            setSelectedJobs(prev => [...prev, jobId]);
        }
    };

    const handleSave = () => {
        onSaveJobs?.(selectedJobs);
        setIsOpen(false);
    };

    const handleOpen = () => {
        setSelectedJobs(jobs);
    };

    const cycleForgemagieStatus = () => {
        // Only cycle between FREE and PAID for people with FM jobs
        if (forgemagieStatus === "FREE") {
            onSaveForgemagieStatus?.("PAID");
        } else {
            onSaveForgemagieStatus?.("FREE");
        }
    };

    return (
        <div className="p-6 bg-zinc-900/60 rounded-2xl border border-white/5 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-zinc-400">Métiers (200)</h3>
                {!readOnly && (
                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleOpen}>
                                <Pencil className="w-4 h-4" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Mes métiers niveau 200</DialogTitle>
                            </DialogHeader>

                            {Object.entries(DOFUS_JOBS).map(([category, categoryJobs]) => (
                                <div key={category} className="space-y-3 mb-6">
                                    <p className="text-sm font-medium text-zinc-400">{category}</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {categoryJobs.map(job => (
                                            <button
                                                key={job.id}
                                                onClick={() => toggleJob(job.id)}
                                                className={cn(
                                                    "p-3 rounded-lg border text-left transition-all flex items-center gap-2",
                                                    selectedJobs.includes(job.id)
                                                        ? "border-primary bg-primary/10"
                                                        : "border-white/5 hover:border-white/20"
                                                )}
                                            >
                                                <span className="text-xl">{job.icon}</span>
                                                <span className="text-sm">{job.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            <div className="flex justify-end gap-2 mt-4">
                                <DialogClose asChild>
                                    <Button variant="outline">
                                        <X className="w-4 h-4 mr-2" />
                                        Annuler
                                    </Button>
                                </DialogClose>
                                <Button onClick={handleSave}>
                                    <Check className="w-4 h-4 mr-2" />
                                    Enregistrer
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {/* Jobs Display */}
            {jobs.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-4">
                    {jobs.slice(0, 8).map(jobId => {
                        const job = Object.values(DOFUS_JOBS).flat().find(j => j.id === jobId);
                        if (!job) return null;
                        return (
                            <Badge key={jobId} variant="secondary" className="bg-white/5 border-white/10">
                                <span className="mr-1">{job.icon}</span>
                                {job.name}
                            </Badge>
                        );
                    })}
                    {jobs.length > 8 && (
                        <Badge variant="outline" className="text-zinc-500">
                            +{jobs.length - 8}
                        </Badge>
                    )}
                </div>
            ) : (
                <p className="text-zinc-500 text-sm mb-4">Aucun métier 200</p>
            )}

            {/* Forgemagie Toggle - ONLY shown if user has FM jobs */}
            {userHasFMJobs && (
                <div className="border-t border-white/5 pt-4 mt-auto">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium">Dispo Guilde</p>
                            <p className="text-xs text-zinc-500">Craft Forgemagie pour la guilde</p>
                        </div>
                        {!readOnly ? (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={cycleForgemagieStatus}
                                className="gap-2"
                                style={{ borderColor: fmStatus.color + "40", color: fmStatus.color }}
                            >
                                <span>{fmStatus.icon}</span>
                                {fmStatus.label}
                            </Button>
                        ) : (
                            <Badge
                                variant="outline"
                                style={{ borderColor: fmStatus.color + "40", color: fmStatus.color }}
                            >
                                <span className="mr-1">{fmStatus.icon}</span>
                                {fmStatus.label}
                            </Badge>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

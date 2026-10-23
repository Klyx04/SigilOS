"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import Image from "next/image";
import { Pencil, X, Hammer } from "lucide-react";
import { DOFUS_JOBS, getJob, type ForgemagieStatusId } from "@/lib/dofus-assets";
import { cn } from "@/lib/utils";
import { normalizeMetiers, metierIds, type MetierEntry } from "@/lib/metiers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface JobsGridProps {
    jobs?: string[] | MetierEntry[] | null;
    forgemagieStatus?: ForgemagieStatusId;
    onSaveJobs?: (jobs: MetierEntry[]) => void;
    onSaveForgemagieStatus?: (status: ForgemagieStatusId) => void;
    readOnly?: boolean;
}

const editTabTriggerClass = "text-xs font-bold uppercase tracking-wider h-full rounded-lg transition-all text-muted-foreground hover:text-foreground hover:bg-elevated/50 data-[state=active]:bg-warning data-[state=active]:text-warning-foreground";
const displayTabTriggerClass = "text-xs font-bold uppercase tracking-wider h-full rounded-lg transition-all text-muted-foreground hover:text-foreground hover:bg-elevated/10 data-[state=active]:bg-warning/15 data-[state=active]:text-warning data-[state=active]:border data-[state=active]:border-warning/30";

export function JobsGrid({
    jobs,
    onSaveJobs,
    readOnly = false,
}: JobsGridProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedJobs, setSelectedJobs] = useState<MetierEntry[]>(() => normalizeMetiers(jobs));

    const jobsList = normalizeMetiers(jobs);

    const toggleJob = (jobId: string) => {
        setSelectedJobs(prev => {
            if (prev.some(s => s.id === jobId)) return prev.filter(s => s.id !== jobId);
            const job = getJob(jobId);
            return [...prev, { id: jobId, name: job?.name || jobId, level: 200 }];
        });
    };

    const setJobLevel = (jobId: string, level: number) => {
        setSelectedJobs(prev => prev.map(s => (s.id === jobId ? { ...s, level: Math.max(1, Math.min(200, level)) } : s)));
    };

    const handleSave = () => {
        onSaveJobs?.(selectedJobs);
        setIsOpen(false);
    };

    const handleOpen = () => {
        setSelectedJobs(normalizeMetiers(jobs));
    };

    return (
        <div className="p-6 bg-surface rounded-2xl border border-border h-full flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-warning/15 border border-warning/30 flex items-center justify-center">
                        <Hammer className="w-4 h-4 text-warning" />
                    </div>
                    <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-foreground">
                            Métiers
                        </h3>
                        {jobsList.length > 0 && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/30">
                                {jobsList.length}
                            </span>
                        )}
                    </div>
                </div>
                {!readOnly && (
                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer" 
                                onClick={handleOpen}
                            >
                                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                                Gérer
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 bg-background border-border rounded-2xl">
                            <DialogHeader className="p-5 pb-3 border-b border-border">
                                <DialogTitle className="text-lg font-bold">Gérer vos métiers & niveaux</DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground">Cliquez sur un métier pour l'ajouter/retirer, puis ajustez son niveau (par défaut 200).</DialogDescription>
                            </DialogHeader>

                            {selectedJobs.length > 0 && (
                                <div className="px-5 pt-3 pb-1">
                                    <div className="p-3 rounded-xl border border-border bg-surface/40 flex flex-wrap items-center gap-2 max-h-36 overflow-y-auto">
                                        {selectedJobs.map(s => (
                                            <div key={s.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background border border-border text-xs">
                                                <span className="font-semibold text-foreground">{s.name}</span>
                                                <span className="text-muted-foreground text-[10px]">Niv.</span>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={200}
                                                    value={s.level}
                                                    onChange={e => setJobLevel(s.id, parseInt(e.target.value, 10) || 200)}
                                                    className="w-12 bg-surface border border-border/80 rounded px-1 py-0.5 text-xs text-center font-bold text-warning focus:outline-none focus:border-warning/50"
                                                />
                                                <button type="button" onClick={() => toggleJob(s.id)} className="text-muted-foreground hover:text-danger ml-0.5 cursor-pointer" aria-label={`Retirer ${s.name}`}>
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex-1 overflow-hidden p-5">
                                <Tabs defaultValue="Récolte" className="h-full flex flex-col">
                                    <TabsList className="grid w-full grid-cols-4 mb-4 bg-surface border border-border p-1 h-10 rounded-xl">
                                        <TabsTrigger value="Récolte" className={editTabTriggerClass}>Récolte</TabsTrigger>
                                        <TabsTrigger value="Artisanat" className={editTabTriggerClass}>Artisanat</TabsTrigger>
                                        <TabsTrigger value="Forgemagie" className={editTabTriggerClass}>Forgemagie</TabsTrigger>
                                        <TabsTrigger value="Élevage" className={editTabTriggerClass}>Élevage</TabsTrigger>
                                    </TabsList>
                                    {Object.entries(DOFUS_JOBS).map(([category, categoryJobs]) => (
                                        <TabsContent key={category} value={category} className="flex-1 overflow-hidden mt-0">
                                            <ScrollArea className="h-[46vh] pr-3">
                                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 pb-2">
                                                    {categoryJobs.map(job => {
                                                        const isSelected = selectedJobs.some(s => s.id === job.id);
                                                        return (
                                                            <button
                                                                key={job.id}
                                                                type="button"
                                                                onClick={() => toggleJob(job.id)}
                                                                className={cn(
                                                                    "group relative flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all duration-150 cursor-pointer text-center",
                                                                    isSelected
                                                                        ? "border-warning/50 bg-warning/10"
                                                                        : "border-border/60 bg-surface/30 hover:border-border hover:bg-surface/60"
                                                                )}
                                                            >
                                                                <div className="mb-1.5 transform transition-transform group-hover:scale-105 duration-200">
                                                                    {job.icon.startsWith("/") ? (
                                                                        <Image
                                                                            src={job.icon}
                                                                            alt={job.name}
                                                                            width={32}
                                                                            height={32}
                                                                            className="w-8 h-8 object-contain"
                                                                        />
                                                                    ) : (
                                                                        <span className="text-2xl">{job.icon}</span>
                                                                    )}
                                                                </div>
                                                                <span className={cn("text-[11px] font-medium leading-tight", isSelected ? "text-warning font-semibold" : "text-muted-foreground")}>
                                                                    {job.name}
                                                                </span>
                                                                {isSelected && (
                                                                    <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-warning" />
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </ScrollArea>
                                        </TabsContent>
                                    ))}
                                </Tabs>
                            </div>
                            <div className="p-4 border-t border-border bg-surface/30 flex justify-end gap-2">
                                <DialogClose asChild>
                                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">Annuler</Button>
                                </DialogClose>
                                <Button onClick={handleSave} variant="sigil" size="sm" className="px-6">
                                    Enregistrer
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {jobsList.length > 0 ? (
                <div className="flex-1">
                    <Tabs defaultValue="Récolte" className="w-full flex flex-col">
                        <TabsList className="grid w-full grid-cols-4 bg-background/50 border border-border p-1 h-10 rounded-xl mb-4">
                            <TabsTrigger value="Récolte" className={displayTabTriggerClass}>Récolte</TabsTrigger>
                            <TabsTrigger value="Artisanat" className={displayTabTriggerClass}>Artisanat</TabsTrigger>
                            <TabsTrigger value="Forgemagie" className={displayTabTriggerClass}>Forgemagie</TabsTrigger>
                            <TabsTrigger value="Élevage" className={displayTabTriggerClass}>Élevage</TabsTrigger>
                        </TabsList>

                        {Object.entries(DOFUS_JOBS).map(([category, categoryJobs]) => {
                            const activeCategoryJobs = categoryJobs.filter(job => metierIds(jobs).includes(job.id));
                            
                            return (
                                <TabsContent key={category} value={category} className="mt-0 focus-visible:outline-none">
                                    {activeCategoryJobs.length > 0 ? (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                                            {activeCategoryJobs.map(job => {
                                                const jobEntry = jobsList.find(j => j.id === job.id);
                                                return (
                                                    <div
                                                        key={job.id}
                                                        className="group relative flex flex-col items-center justify-center p-3 rounded-xl border border-border bg-surface hover:bg-elevated transition-colors duration-150 text-center"
                                                    >
                                                        <div className="mb-2 transform transition-transform duration-200 group-hover:scale-105">
                                                            {job.icon.startsWith("/") ? (
                                                                <Image
                                                                    src={job.icon}
                                                                    alt={job.name}
                                                                    width={36}
                                                                    height={36}
                                                                    className="w-9 h-9 object-contain"
                                                                />
                                                            ) : (
                                                                <span className="text-3xl">{job.icon}</span>
                                                            )}
                                                        </div>
                                                        <span className="text-xs font-semibold text-foreground leading-tight">
                                                            {job.name}
                                                        </span>
                                                        <span className="mt-1 text-[11px] font-mono font-medium text-warning">
                                                            Niv. {jobEntry?.level ?? 200}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-dashed border-border/60 bg-background/20 text-muted-foreground text-center">
                                            <p className="text-xs font-medium text-muted-foreground">Aucun métier de type {category.toLowerCase()}</p>
                                        </div>
                                    )}
                                </TabsContent>
                            );
                        })}
                    </Tabs>
                </div>
            ) : (
                <div className="p-8 text-center border border-dashed border-border rounded-xl flex-1 flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">Aucun métier renseigné</p>
                </div>
            )}
        </div>
    );
}

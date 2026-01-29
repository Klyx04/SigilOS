"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import Image from "next/image";
import { Pencil, Check, X, Hammer, Info } from "lucide-react";
import { DOFUS_JOBS, getForgemagieStatus, type ForgemagieStatusId, hasAnyForgemagie } from "@/lib/dofus-assets";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface JobsGridProps {
    jobs?: string[];
    forgemagieStatus?: ForgemagieStatusId;
    fmPriceClassic?: number | null;
    fmPriceTrans?: number | null;
    fmPriceExo?: number | null;
    onSaveJobs?: (jobs: string[]) => void;
    onSaveForgemagieStatus?: (status: ForgemagieStatusId) => void;
    onSaveForgemagiePrices?: (prices: { classic: number | null, trans: number | null, exo: number | null }) => void;
    readOnly?: boolean;
}

export function JobsGrid({
    jobs = [],
    forgemagieStatus = "UNAVAILABLE",
    fmPriceClassic = null,
    fmPriceTrans = null,
    fmPriceExo = null,
    onSaveJobs,
    onSaveForgemagieStatus,
    onSaveForgemagiePrices,
    readOnly = false,
}: JobsGridProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedJobs, setSelectedJobs] = useState<string[]>(jobs);

    const [prices, setPrices] = useState({
        classic: fmPriceClassic,
        trans: fmPriceTrans,
        exo: fmPriceExo
    });

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

    const formatKamas = (value: number | null | undefined) => {
        if (value === null || value === undefined) return "Non défini";
        if (value === 0) return "Gratuit";
        return new Intl.NumberFormat('fr-FR').format(value) + " k";
    };

    const handlePriceChange = (type: 'classic' | 'trans' | 'exo', value: string) => {
        const num = value === "" ? null : parseInt(value);
        if (num !== null && (isNaN(num) || num < 0)) return;
        setPrices(prev => ({ ...prev, [type]: num }));
    };

    const handleSavePrices = () => {
        onSaveForgemagiePrices?.(prices);
    };

    const allJobs = Object.values(DOFUS_JOBS).flat();
    const activeJobsData = allJobs.filter(j => jobs.includes(j.id));

    return (
        <div className="p-6 bg-black/20 backdrop-blur-md rounded-2xl border border-white/10 transition-all hover:border-white/20 group h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-semibold text-zinc-200">Maîtrise artisanale</h3>
                {!readOnly && (
                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={handleOpen}>
                                <Pencil className="w-4 h-4" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 bg-zinc-950 border-zinc-800">
                            <DialogHeader className="p-6 pb-2 border-b border-white/5">
                                <DialogTitle className="text-xl">Gérer vos métiers (Niveau 200)</DialogTitle>
                                <DialogDescription>Sélectionnez les métiers que vous maîtrisez au niveau maximum.</DialogDescription>
                            </DialogHeader>
                            <div className="flex-1 overflow-hidden p-6">
                                <Tabs defaultValue="Récolte" className="h-full flex flex-col">
                                    <TabsList className="grid w-full grid-cols-3 mb-6 bg-zinc-900/50">
                                        <TabsTrigger value="Récolte">Récolte</TabsTrigger>
                                        <TabsTrigger value="Artisanat">Artisanat</TabsTrigger>
                                        <TabsTrigger value="Forgemagie">Forgemagie</TabsTrigger>
                                    </TabsList>
                                    {Object.entries(DOFUS_JOBS).map(([category, categoryJobs]) => (
                                        <TabsContent key={category} value={category} className="flex-1 overflow-hidden mt-0">
                                            <ScrollArea className="h-[50vh] pr-4">
                                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 pb-4">
                                                    {categoryJobs.map(job => {
                                                        const isSelected = selectedJobs.includes(job.id);
                                                        return (
                                                            <button
                                                                key={job.id}
                                                                onClick={() => toggleJob(job.id)}
                                                                className={cn(
                                                                    "group relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-300 aspect-square",
                                                                    isSelected
                                                                        ? "border-amber-500/50 bg-amber-500/10 shadow-[0_0_15px_-5px_rgba(245,158,11,0.3)]"
                                                                        : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/60"
                                                                )}
                                                            >
                                                                <div className="mb-3 transform transition-transform group-hover:scale-110 duration-300">
                                                                    {job.icon.startsWith("/") ? (
                                                                        <Image
                                                                            src={job.icon}
                                                                            alt={job.name}
                                                                            width={48}
                                                                            height={48}
                                                                            className="w-12 h-12 object-contain drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                                                                        />
                                                                    ) : (
                                                                        <span className="text-3xl">{job.icon}</span>
                                                                    )}
                                                                </div>
                                                                <span className={cn("text-xs font-semibold uppercase tracking-wider text-center", isSelected ? "text-amber-200" : "text-zinc-500")}>
                                                                    {job.name}
                                                                </span>
                                                                {isSelected && (
                                                                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
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
                            <div className="p-6 border-t border-white/5 bg-zinc-900/30 flex justify-end gap-3">
                                <DialogClose asChild>
                                    <Button variant="ghost" className="text-zinc-400 hover:text-white">Annuler</Button>
                                </DialogClose>
                                <Button onClick={handleSave} className="px-8 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20">
                                    Enregistrer
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {jobs.length > 0 ? (
                <div className="relative overflow-hidden rounded-xl border border-white/5 bg-gradient-to-br from-zinc-900 to-black p-6 mb-6 group-hover:border-white/10 transition-colors">
                    <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-[80px] bg-amber-500/10 pointer-events-none" />
                    <div className="relative flex items-center gap-5">
                        <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-zinc-950 border border-white/10 shadow-xl shrink-0">
                            <Hammer className="w-10 h-10 text-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
                            <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/5" />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-1">Niveau 200</p>
                            <h2 className="text-3xl font-bold text-white tracking-tight">
                                {jobs.length} Métier{jobs.length > 1 ? 's' : ''}
                            </h2>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="p-8 text-center border-2 border-dashed border-zinc-800 rounded-xl mb-6 flex-1 flex items-center justify-center">
                    <p className="text-zinc-500">Aucun métier renseigné</p>
                </div>
            )}

            <div className="flex-1 content-start mb-6">
                {activeJobsData.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                        {activeJobsData.slice(0, 12).map(job => (
                            <div key={job.id} className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-900 border border-white/5 hover:border-white/10 transition-colors">
                                <span className="flex items-center justify-center">
                                    {job.icon.startsWith("/") ? (
                                        <Image src={job.icon} alt={job.name} width={20} height={20} className="w-5 h-5 object-contain" />
                                    ) : (
                                        <span className="text-base">{job.icon}</span>
                                    )}
                                </span>
                                <span className="text-xs font-medium text-zinc-300">{job.name}</span>
                            </div>
                        ))}
                        {activeJobsData.length > 12 && (
                            <Badge variant="outline" className="text-zinc-500 bg-zinc-900/50">+{activeJobsData.length - 12}</Badge>
                        )}
                    </div>
                )}
            </div>

            {userHasFMJobs && (
                <div className="border-t border-white/5 pt-4 mt-auto">
                    <div className="flex items-center gap-2 mb-3">
                        <Hammer className="w-3 h-3 text-amber-500" />
                        <p className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Tarifs Forgemagie</p>
                    </div>

                    {!readOnly ? (
                        <div className="flex flex-col gap-4">
                            <div className="grid grid-cols-1 gap-3">
                                <div className="flex items-center gap-3">
                                    <Label className="text-xs text-zinc-500 w-24 shrink-0">FM Classique</Label>
                                    <div className="relative flex-1">
                                        <Input
                                            type="number"
                                            placeholder="Gratuit"
                                            className="h-7 text-xs bg-zinc-900/50 border-zinc-800 text-right pr-6"
                                            min={0}
                                            value={prices.classic === null ? "" : prices.classic}
                                            onChange={(e) => handlePriceChange("classic", e.target.value)}
                                        />
                                        <span className="absolute right-2 top-1.5 text-[10px] text-zinc-500 font-bold">K</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Label className="text-xs text-zinc-500 w-24 shrink-0">Passage Trans</Label>
                                    <div className="relative flex-1">
                                        <Input
                                            type="number"
                                            placeholder="Gratuit"
                                            className="h-7 text-xs bg-zinc-900/50 border-zinc-800 text-right pr-6"
                                            min={0}
                                            value={prices.trans === null ? "" : prices.trans}
                                            onChange={(e) => handlePriceChange("trans", e.target.value)}
                                        />
                                        <span className="absolute right-2 top-1.5 text-[10px] text-zinc-500 font-bold">K</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Label className="text-xs text-zinc-500 w-24 shrink-0">Tenta Exo</Label>
                                    <div className="relative flex-1">
                                        <Input
                                            type="number"
                                            placeholder="Gratuit"
                                            className="h-7 text-xs bg-zinc-900/50 border-zinc-800 text-right pr-6"
                                            min={0}
                                            value={prices.exo === null ? "" : prices.exo}
                                            onChange={(e) => handlePriceChange("exo", e.target.value)}
                                        />
                                        <span className="absolute right-2 top-1.5 text-[10px] text-zinc-500 font-bold">K</span>
                                    </div>
                                </div>
                            </div>
                            <Button
                                onClick={handleSavePrices}
                                size="sm"
                                className="w-full h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                            >
                                Sauvegarder les tarifs
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3 pt-2">
                            <div className="flex justify-between items-center p-2 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                                <span className="text-zinc-400 text-sm font-medium">Classique</span>
                                <span className="font-mono text-amber-400 font-semibold text-sm">{formatKamas(fmPriceClassic)}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                                <span className="text-zinc-400 text-sm font-medium">Passage Trans</span>
                                <span className="font-mono text-cyan-400 font-semibold text-sm">{formatKamas(fmPriceTrans)}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                                <span className="text-zinc-400 text-sm font-medium">Tenta Exo</span>
                                <span className="font-mono text-purple-400 font-semibold text-sm">{formatKamas(fmPriceExo)}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

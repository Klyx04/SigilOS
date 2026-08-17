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
        <div className="p-6 bg-background/80 backdrop-blur-md rounded-3xl border border-border transition-all hover:border-warning/30 shadow-2xl group h-full flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-warning/15 border border-warning/30 flex items-center justify-center">
                        <Hammer className="w-5 h-5 text-warning" />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-foreground uppercase tracking-wider">
                            Maîtrise Artisanale
                        </h3>
                        <p className="text-caption text-muted-foreground uppercase tracking-widest font-bold">Métiers & Tarifs Forgemagie</p>
                    </div>
                </div>
                {!readOnly && (
                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-9 px-3 text-xs font-black uppercase tracking-wider text-warning hover:text-warning hover:bg-warning/10 border border-warning/20 rounded-xl transition-all cursor-pointer" 
                                onClick={handleOpen}
                            >
                                <Pencil className="w-3.5 h-3.5 mr-1.5" strokeWidth={2.5} />
                                Gérer
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 bg-background border-border">
                            <DialogHeader className="p-6 pb-2 border-b border-border">
                                <DialogTitle className="text-xl">Gérer vos métiers (Niveau 200)</DialogTitle>
                                <DialogDescription>Sélectionnez les métiers que vous maîtrisez au niveau maximum.</DialogDescription>
                            </DialogHeader>
                            <div className="flex-1 overflow-hidden p-6">
                                <Tabs defaultValue="Récolte" className="h-full flex flex-col">
                                    <TabsList className="grid w-full grid-cols-4 mb-6 bg-surface border border-border p-1 h-12 rounded-xl">
                                        <TabsTrigger 
                                            value="Récolte"
                                            className="text-xs font-extrabold uppercase tracking-wider h-full rounded-lg transition-all text-muted-foreground hover:text-foreground hover:bg-elevated/50 data-[state=active]:bg-warning data-[state=active]:text-warning-foreground data-[state=active]:font-black data-[state=active]:"
                                        >
                                            Récolte
                                        </TabsTrigger>
                                        <TabsTrigger 
                                            value="Artisanat"
                                            className="text-xs font-extrabold uppercase tracking-wider h-full rounded-lg transition-all text-muted-foreground hover:text-foreground hover:bg-elevated/50 data-[state=active]:bg-warning data-[state=active]:text-warning-foreground data-[state=active]:font-black data-[state=active]:"
                                        >
                                            Artisanat
                                        </TabsTrigger>
                                        <TabsTrigger 
                                            value="Forgemagie"
                                            className="text-xs font-extrabold uppercase tracking-wider h-full rounded-lg transition-all text-muted-foreground hover:text-foreground hover:bg-elevated/50 data-[state=active]:bg-warning data-[state=active]:text-warning-foreground data-[state=active]:font-black data-[state=active]:"
                                        >
                                            Forgemagie
                                        </TabsTrigger>
                                        <TabsTrigger 
                                            value="Élevage"
                                            className="text-xs font-extrabold uppercase tracking-wider h-full rounded-lg transition-all text-muted-foreground hover:text-foreground hover:bg-elevated/50 data-[state=active]:bg-warning data-[state=active]:text-warning-foreground data-[state=active]:font-black data-[state=active]:"
                                        >
                                            Élevage
                                        </TabsTrigger>
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
                                                                        ? "border-warning/50 bg-warning/10 "
                                                                        : "border-border bg-surface/30 hover:border-border hover:bg-surface/60"
                                                                )}
                                                            >
                                                                <div className="mb-3 transform transition-transform group- duration-300">
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
                                                                <span className={cn("text-xs font-semibold uppercase tracking-wider text-center", isSelected ? "text-warning" : "text-muted-foreground")}>
                                                                    {job.name}
                                                                </span>
                                                                {isSelected && (
                                                                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-warning " />
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
                            <div className="p-6 border-t border-border bg-surface/30 flex justify-end gap-3">
                                <DialogClose asChild>
                                    <Button variant="ghost" className="text-muted-foreground hover:text-foreground">Annuler</Button>
                                </DialogClose>
                                <Button onClick={handleSave} variant="sigil" className="px-8">
                                    Enregistrer
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {jobs.length > 0 ? (
                <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-surface to-elevated p-6 mb-6 group-hover:border-border transition-colors shadow-sm">
                    <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-[80px] bg-warning/10 pointer-events-none" />
                    <div className="relative flex items-center gap-5">
                        <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-elevated border border-border shadow-md shrink-0">
                            <Hammer className="w-10 h-10 text-warning drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
                            <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/5" />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1">Niveau 200</p>
                            <h2 className="text-3xl font-bold text-foreground tracking-tight">
                                {jobs.length} Métier{jobs.length > 1 ? 's' : ''}
                            </h2>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="p-8 text-center border-2 border-dashed border-border rounded-xl mb-6 flex-1 flex items-center justify-center">
                    <p className="text-muted-foreground">Aucun métier renseigné</p>
                </div>
            )}

            {jobs.length > 0 && (
                <div className="flex-1 mt-2 mb-6">
                    <Tabs defaultValue="Récolte" className="w-full flex flex-col">
                        <TabsList className="grid w-full grid-cols-4 bg-background/40 border border-border p-1 h-11 rounded-xl mb-6">
                            <TabsTrigger 
                                value="Récolte"
                                className="text-xs font-black uppercase tracking-wider h-full rounded-lg transition-all text-muted-foreground hover:text-foreground hover:bg-elevated/10 data-[state=active]:bg-gradient-to-br data-[state=active]:from-warning/15 data-[state=active]:to-warning/15 data-[state=active]:text-warning data-[state=active]:border data-[state=active]:border-warning/30 data-[state=active]:"
                            >
                                Récolte
                            </TabsTrigger>
                            <TabsTrigger 
                                value="Artisanat"
                                className="text-xs font-black uppercase tracking-wider h-full rounded-lg transition-all text-muted-foreground hover:text-foreground hover:bg-elevated/10 data-[state=active]:bg-gradient-to-br data-[state=active]:from-warning/15 data-[state=active]:to-warning/15 data-[state=active]:text-warning data-[state=active]:border data-[state=active]:border-warning/30 data-[state=active]:"
                            >
                                Artisanat
                            </TabsTrigger>
                            <TabsTrigger 
                                value="Forgemagie"
                                className="text-xs font-black uppercase tracking-wider h-full rounded-lg transition-all text-muted-foreground hover:text-foreground hover:bg-elevated/10 data-[state=active]:bg-gradient-to-br data-[state=active]:from-warning/15 data-[state=active]:to-warning/15 data-[state=active]:text-warning data-[state=active]:border data-[state=active]:border-warning/30 data-[state=active]:"
                            >
                                Forgemagie
                            </TabsTrigger>
                            <TabsTrigger 
                                value="Élevage"
                                className="text-xs font-black uppercase tracking-wider h-full rounded-lg transition-all text-muted-foreground hover:text-foreground hover:bg-elevated/10 data-[state=active]:bg-gradient-to-br data-[state=active]:from-warning/15 data-[state=active]:to-warning/15 data-[state=active]:text-warning data-[state=active]:border data-[state=active]:border-warning/30 data-[state=active]:"
                            >
                                Élevage
                            </TabsTrigger>
                        </TabsList>



                        {Object.entries(DOFUS_JOBS).map(([category, categoryJobs]) => {
                            const activeCategoryJobs = categoryJobs.filter(job => jobs.includes(job.id));
                            
                            return (
                                <TabsContent key={category} value={category} className="mt-0 focus-visible:outline-none">
                                    {activeCategoryJobs.length > 0 ? (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                            {activeCategoryJobs.map(job => (
                                                <div
                                                    key={job.id}
                                                    className="group relative flex flex-col items-center justify-center p-5 rounded-2xl border border-border bg-background/30 hover:border-border hover:bg-surface/10 shadow-lg aspect-square overflow-hidden transition-all duration-300"
                                                >
                                                    <div className="mb-3 transform transition-transform duration-300 group-">
                                                        {job.icon.startsWith("/") ? (
                                                            <Image
                                                                src={job.icon}
                                                                alt={job.name}
                                                                width={56}
                                                                height={56}
                                                                className="w-14 h-14 object-contain drop-shadow-[0_0_8px_rgba(0,0,0,0.3)]"
                                                            />
                                                        ) : (
                                                            <span className="text-4xl">{job.icon}</span>
                                                        )}
                                                    </div>
                                                    <span className="text-caption font-bold uppercase tracking-widest text-center text-foreground leading-tight group-hover:text-foreground transition-colors duration-300">
                                                        {job.name}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center p-12 rounded-2xl border border-dashed border-border/60 bg-background/20 text-muted-foreground text-center">
                                            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Aucun métier</p>
                                            <p className="text-caption text-muted-foreground mt-1">Vous n'avez renseigné aucun métier de type {category.toLowerCase()}.</p>
                                        </div>
                                    )}
                                </TabsContent>
                            );
                        })}
                    </Tabs>
                </div>
            )}


            {userHasFMJobs && (
                <div className="border-t border-border pt-4 mt-auto">
                    <div className="flex items-center gap-2 mb-3">
                        <Hammer className="w-3 h-3 text-warning" />
                        <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Tarifs Forgemagie</p>
                    </div>

                    {!readOnly ? (
                        <div className="flex flex-col gap-4">
                            <div className="grid grid-cols-1 gap-3">
                                <div className="flex items-center gap-3">
                                    <Label className="text-xs text-muted-foreground w-24 shrink-0">FM Classique</Label>
                                    <div className="relative flex-1">
                                        <Input
                                            type="number"
                                            placeholder="Gratuit"
                                            className="h-7 text-xs bg-surface/50 border-border text-right pr-6"
                                            min={0}
                                            value={prices.classic === null ? "" : prices.classic}
                                            onChange={(e) => handlePriceChange("classic", e.target.value)}
                                        />
                                        <span className="absolute right-2 top-1.5 text-caption text-muted-foreground font-bold">K</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Label className="text-xs text-muted-foreground w-24 shrink-0">Passage Trans</Label>
                                    <div className="relative flex-1">
                                        <Input
                                            type="number"
                                            placeholder="Gratuit"
                                            className="h-7 text-xs bg-surface/50 border-border text-right pr-6"
                                            min={0}
                                            value={prices.trans === null ? "" : prices.trans}
                                            onChange={(e) => handlePriceChange("trans", e.target.value)}
                                        />
                                        <span className="absolute right-2 top-1.5 text-caption text-muted-foreground font-bold">K</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Label className="text-xs text-muted-foreground w-24 shrink-0">Tenta Exo</Label>
                                    <div className="relative flex-1">
                                        <Input
                                            type="number"
                                            placeholder="Gratuit"
                                            className="h-7 text-xs bg-surface/50 border-border text-right pr-6"
                                            min={0}
                                            value={prices.exo === null ? "" : prices.exo}
                                            onChange={(e) => handlePriceChange("exo", e.target.value)}
                                        />
                                        <span className="absolute right-2 top-1.5 text-caption text-muted-foreground font-bold">K</span>
                                    </div>
                                </div>
                            </div>
                            <Button
                                onClick={handleSavePrices}
                                variant="sigil"
                                className="w-full h-8 text-caption"
                            >
                                Sauvegarder les tarifs
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3 pt-2">
                            <div className="flex justify-between items-center p-2 rounded-lg bg-surface border border-border hover:border-border transition-colors">
                                <span className="text-muted-foreground text-sm font-medium">Classique</span>
                                <span className="font-mono text-warning font-semibold text-sm">{formatKamas(fmPriceClassic)}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded-lg bg-surface border border-border hover:border-border transition-colors">
                                <span className="text-muted-foreground text-sm font-medium">Passage Trans</span>
                                <span className="font-mono text-info font-semibold text-sm">{formatKamas(fmPriceTrans)}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded-lg bg-surface border border-border hover:border-border transition-colors">
                                <span className="text-muted-foreground text-sm font-medium">Tenta Exo</span>
                                <span className="font-mono text-info font-semibold text-sm">{formatKamas(fmPriceExo)}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

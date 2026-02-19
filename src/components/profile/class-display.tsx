"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Pencil, Check, X, Info, Plus } from "lucide-react";
import { DOFUS_CLASSES, getClass } from "@/lib/dofus-assets";
import { cn } from "@/lib/utils";
import { ClassIcon } from "@/components/shared/class-icon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { UserCircle } from "lucide-react";
import { toast } from "sonner";

interface ClassDisplayProps {
    pseudoDofus?: string | null;
    mainClass?: string | null;
    secondaryClasses?: string[];
    onSave?: (mainClass: string, secondaryClasses: string[], pseudoDofus: string) => void;
    readOnly?: boolean;
}

export function ClassDisplay({
    pseudoDofus,
    mainClass,
    secondaryClasses = [],
    onSave,
    readOnly = false,
}: ClassDisplayProps) {
    const searchParams = useSearchParams();
    const [isOpen, setIsOpen] = useState(false);
    const [selectedMain, setSelectedMain] = useState<string>(mainClass || "");
    const [selectedSecondary, setSelectedSecondary] = useState<string[]>(secondaryClasses);
    const [localPseudo, setLocalPseudo] = useState<string>(pseudoDofus || "");

    // Auto-open if redirected with ?edit=identity
    useEffect(() => {
        if (searchParams.get("edit") === "identity") {
            setIsOpen(true);
            handleOpen();
        }
    }, [searchParams]);

    const mainClassData = getClass(mainClass || "");

    const toggleSecondary = (classId: string) => {
        if (classId === selectedMain) return;

        if (selectedSecondary.includes(classId)) {
            setSelectedSecondary(prev => prev.filter(c => c !== classId));
        } else {
            if (selectedSecondary.length >= 10) {
                toast.error("Vous ne pouvez pas sélectionner plus de 10 classes secondaires.");
                return;
            }
            setSelectedSecondary(prev => [...prev, classId]);
        }
    };

    const handleSave = () => {
        onSave?.(selectedMain, selectedSecondary, localPseudo);
        setIsOpen(false);
    };

    const handleOpen = () => {
        setSelectedMain(mainClass || "");
        setSelectedSecondary(secondaryClasses);
        setLocalPseudo(pseudoDofus || "");
    };

    return (
        <div className="p-4 bg-black/20 backdrop-blur-md rounded-xl border border-white/10 transition-all hover:border-white/20 group">
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-zinc-200 flex items-center gap-2">
                        Identité de Combat
                    </h3>
                    {!readOnly && (
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={handleOpen}>
                                <Pencil className="w-3 h-3" />
                            </Button>
                        </DialogTrigger>
                    )}
                </div>

                {/* Main Class Display - Premium Card COMPACT */}
                {mainClassData ? (
                    <div className="relative overflow-hidden rounded-lg border border-white/5 bg-gradient-to-br from-zinc-900 to-black p-4 mb-3 group-hover:border-white/10 transition-colors">
                        {/* Background Glow - Reduced blur/size */}
                        <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-[50px] opacity-15 pointer-events-none"
                            style={{ backgroundColor: mainClassData.color }}
                        />

                        <div className="relative flex items-center gap-4">
                            <div className="relative flex items-center justify-center w-14 h-14 rounded-xl bg-zinc-950 border border-white/10 shadow-lg shrink-0">
                                <ClassIcon classId={mainClassData.id} size={36} className="drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]" />
                                <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/5" />
                            </div>

                            <div className="flex-1 space-y-1.5">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest shrink-0">Pseudo en jeu</span>
                                    {pseudoDofus ? (
                                        <span className="text-lg font-black text-amber-500 italic tracking-tight drop-shadow-[0_0_8px_rgba(245,158,11,0.3)]">
                                            {pseudoDofus}
                                        </span>
                                    ) : (
                                        <span className="text-xs font-black text-amber-500/80 animate-pulse uppercase tracking-widest">
                                            Non renseigné
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-baseline gap-2">
                                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest shrink-0">Classe principale</span>
                                    <span className="text-base font-black text-white tracking-wide" style={{ textShadow: `0 0 15px ${mainClassData.color}50` }}>
                                        {mainClassData.name}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        <DialogTrigger asChild>
                            <button
                                onClick={handleOpen}
                                className="w-full p-6 text-center border-2 border-dashed border-zinc-800 hover:border-amber-500/50 hover:bg-amber-500/5 rounded-xl mb-4 transition-all group/cta relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/0 via-amber-500/0 to-amber-500/5 opacity-0 group-hover/cta:opacity-100 transition-opacity" />
                                <div className="relative z-10 flex flex-col items-center gap-2">
                                    <div className="w-10 h-10 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center group-hover/cta:scale-110 transition-transform">
                                        <Plus className="w-5 h-5 text-amber-500" />
                                    </div>
                                    <p className="text-sm font-black text-zinc-300 uppercase tracking-widest">Configurer mon Identité</p>
                                    <p className="text-xs text-zinc-500 font-bold uppercase tracking-tighter">Pseudo Dofus & Classe requis</p>
                                </div>
                            </button>
                        </DialogTrigger>
                    </div>
                )}

                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 bg-zinc-950 border-zinc-800">
                    <DialogHeader className="p-6 pb-2 border-b border-white/5">
                        <DialogTitle className="text-xl">Modifier votre profil</DialogTitle>
                        <DialogDescription>Définissez votre identité en jeu et vos spécialisations.</DialogDescription>
                    </DialogHeader>

                    <div className="px-6 pt-6">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 pl-1">
                                <UserCircle className="w-4 h-4" />
                                Pseudo Dofus Exact
                            </label>
                            <div className="relative">
                                <Input
                                    value={localPseudo}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/[^a-zA-Z\u00C0-\u017F\u00DF\u00FF\u0100-\u017F]/g, "");
                                        setLocalPseudo(val);
                                    }}
                                    placeholder="Votre pseudo en jeu..."
                                    className="bg-zinc-900/50 border-white/10 h-11 focus:ring-primary/20 pr-12 text-base"
                                    maxLength={50}
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-zinc-500">
                                    {localPseudo.length}/50
                                </div>
                            </div>
                            <p className="text-xs text-zinc-500 italic pl-1">
                                Ce pseudo doit être <strong>unique</strong> dans la guilde. Il servira pour les classements et sera lié à votre compte Metamob.
                            </p>
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded p-3 mt-2">
                                <p className="text-xs text-amber-200 flex gap-1.5 items-start">
                                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                                    Astuce : Mettez exactement le même pseudo que sur Metamob pour faciliter la liaison.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden p-6">
                        <Tabs defaultValue="main" className="h-full flex flex-col">
                            <TabsList className="grid w-full grid-cols-2 mb-6 bg-zinc-900/50">
                                <TabsTrigger value="main">Classe Principale</TabsTrigger>
                                <TabsTrigger value="secondary">Classes Secondaires ({selectedSecondary.length})</TabsTrigger>
                            </TabsList>

                            <TabsContent value="main" className="flex-1 overflow-hidden mt-0">
                                <ScrollArea className="h-[50vh] pr-4">
                                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 sm:gap-4 pb-12">
                                        {DOFUS_CLASSES.map(c => {
                                            const isSelected = selectedMain === c.id;
                                            return (
                                                <button
                                                    key={c.id}
                                                    onClick={() => setSelectedMain(c.id)}
                                                    className={cn(
                                                        "group relative flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all duration-300 aspect-square overflow-hidden",
                                                        isSelected
                                                            ? "border-white/40 shadow-[0_0_20px_-5px_rgba(255,255,255,0.2)]"
                                                            : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/60"
                                                    )}
                                                    style={isSelected ? {
                                                        borderColor: c.color,
                                                        backgroundColor: `${c.color}25`,
                                                        boxShadow: `0 0 20px -5px ${c.color}60`
                                                    } : undefined}
                                                >
                                                    <div className={cn("mb-2 transform transition-transform group-hover:scale-110 duration-300", isSelected ? "scale-110" : "")}>
                                                        <ClassIcon classId={c.id} size={36} />
                                                    </div>
                                                    <span className={cn("w-full px-1 text-[10px] sm:text-xs font-black uppercase tracking-tight sm:tracking-wider transition-colors truncate text-center", isSelected ? "text-white" : "text-zinc-500")}
                                                        style={isSelected ? { color: 'white', textShadow: `0 0 10px ${c.color}` } : undefined}
                                                    >
                                                        {c.name}
                                                    </span>

                                                    {isSelected && (
                                                        <>
                                                            <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-white flex items-center justify-center shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                                                                style={{ backgroundColor: c.color }}
                                                            >
                                                                <div className="w-1 h-1 rounded-full bg-white" />
                                                            </div>
                                                            <div className="absolute inset-0 rounded-xl ring-2 ring-inset ring-white/20" />
                                                        </>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </ScrollArea>
                            </TabsContent>

                            <TabsContent value="secondary" className="flex-1 overflow-hidden mt-0">
                                <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-3 text-sm text-blue-300">
                                    <Info className="w-5 h-5 shrink-0 mt-0.5" />
                                    <p>Sélectionnez les classes secondaires que vous jouez régulièrement. Votre classe principale ({DOFUS_CLASSES.find(c => c.id === selectedMain)?.name}) n'est pas sélectionnable ici.</p>
                                </div>
                                <ScrollArea className="h-[45vh] pr-4">
                                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 sm:gap-4 pb-12">
                                        {DOFUS_CLASSES.map(c => {
                                            const isSelected = selectedSecondary.includes(c.id);
                                            const isMain = selectedMain === c.id;
                                            const classData = getClass(c.id);

                                            return (
                                                <button
                                                    key={c.id}
                                                    onClick={() => toggleSecondary(c.id)}
                                                    disabled={isMain}
                                                    className={cn(
                                                        "group relative flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all duration-300 aspect-square overflow-hidden",
                                                        isMain ? "opacity-20 cursor-not-allowed border-zinc-900 bg-zinc-950 grayscale" : "",
                                                        !isMain && isSelected
                                                            ? "border-white/40 shadow-[0_0_20px_-5px_rgba(255,255,255,0.2)]"
                                                            : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/60"
                                                    )}
                                                    style={!isMain && isSelected && classData ? {
                                                        borderColor: classData.color,
                                                        backgroundColor: `${classData.color}25`,
                                                        boxShadow: `0 0 20px -5px ${classData.color}60`
                                                    } : undefined}
                                                >
                                                    <div className={cn("mb-2 transform transition-transform group-hover:scale-110 duration-300", isSelected ? "scale-110" : "")}>
                                                        <ClassIcon classId={c.id} size={32} />
                                                    </div>
                                                    <span className={cn("w-full px-1 text-[10px] sm:text-xs font-black uppercase tracking-tight sm:tracking-wider transition-colors truncate text-center", isSelected ? "text-white" : "text-zinc-500")}
                                                        style={isSelected && classData ? { color: 'white', textShadow: `0 0 10px ${classData.color}` } : undefined}
                                                    >
                                                        {c.name}
                                                    </span>

                                                    {isSelected && (
                                                        <>
                                                            <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-white flex items-center justify-center shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                                                                style={classData ? { backgroundColor: classData.color } : undefined}
                                                            >
                                                                <div className="w-1 h-1 rounded-full bg-white" />
                                                            </div>
                                                            <div className="absolute inset-0 rounded-xl ring-2 ring-inset ring-white/20" />
                                                        </>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </ScrollArea>
                            </TabsContent>
                        </Tabs>
                    </div>

                    <div className="p-6 border-t border-white/5 bg-zinc-900/30 flex justify-end gap-3">
                        <div className="flex-1 flex items-center">
                            {selectedSecondary.length > 0 && (
                                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest bg-zinc-950/50 px-3 py-1.5 rounded-full border border-white/5">
                                    {selectedSecondary.length} / 10 <span className="text-zinc-600">classes sélectionnées</span>
                                </p>
                            )}
                        </div>
                        <DialogClose asChild>
                            <Button variant="ghost" className="text-zinc-400 hover:text-white">
                                Annuler
                            </Button>
                        </DialogClose>
                        <Button onClick={handleSave} className="px-8 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20">
                            Confirmer les changements
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Secondary Classes - Chips */}
            {secondaryClasses.length > 0 && (
                <div className="mt-3">
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 pl-1">Classes Secondaires</p>
                    <div className="flex flex-wrap gap-1.5">
                        {secondaryClasses.map(classId => {
                            const data = getClass(classId);
                            if (!data) return null;
                            return (
                                <div
                                    key={classId}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/5 hover:border-white/10 transition-colors h-9"
                                >
                                    <ClassIcon classId={data.id} size={20} />
                                    <span className="text-sm font-medium text-zinc-200">{data.name}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

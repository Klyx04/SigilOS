"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Pencil, Check, X, Info } from "lucide-react";
import { DOFUS_CLASSES, getClass } from "@/lib/dofus-assets";
import { cn } from "@/lib/utils";
import { ClassIcon } from "@/components/shared/class-icon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ClassDisplayProps {
    mainClass?: string | null;
    secondaryClasses?: string[];
    onSave?: (mainClass: string, secondaryClasses: string[]) => void;
    readOnly?: boolean;
}

export function ClassDisplay({
    mainClass,
    secondaryClasses = [],
    onSave,
    readOnly = false,
}: ClassDisplayProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedMain, setSelectedMain] = useState<string>(mainClass || "");
    const [selectedSecondary, setSelectedSecondary] = useState<string[]>(secondaryClasses);

    const mainClassData = getClass(mainClass || "");

    const toggleSecondary = (classId: string) => {
        if (classId === selectedMain) return;

        if (selectedSecondary.includes(classId)) {
            setSelectedSecondary(prev => prev.filter(c => c !== classId));
        } else {
            setSelectedSecondary(prev => [...prev, classId]);
        }
    };

    const handleSave = () => {
        onSave?.(selectedMain, selectedSecondary);
        setIsOpen(false);
    };

    const handleOpen = () => {
        setSelectedMain(mainClass || "");
        setSelectedSecondary(secondaryClasses);
    };

    return (
        <div className="p-4 bg-black/20 backdrop-blur-md rounded-xl border border-white/10 transition-all hover:border-white/20 group">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-zinc-200 flex items-center gap-2">
                    Identité de Combat
                </h3>
                {!readOnly && (
                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={handleOpen}>
                                <Pencil className="w-3 h-3" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 bg-zinc-950 border-zinc-800">
                            {/* ... Dialog Content ... (Keep existing layout inside dialog as it is fine for modal) */}
                            <DialogHeader className="p-6 pb-2 border-b border-white/5">
                                <DialogTitle className="text-xl">Choisir votre voie</DialogTitle>
                                <DialogDescription>Définissez votre classe principale et vos spécialisations secondaires.</DialogDescription>
                            </DialogHeader>

                            <div className="flex-1 overflow-hidden p-6">
                                <Tabs defaultValue="main" className="h-full flex flex-col">
                                    <TabsList className="grid w-full grid-cols-2 mb-6 bg-zinc-900/50">
                                        <TabsTrigger value="main">Classe Principale</TabsTrigger>
                                        <TabsTrigger value="secondary">Classes Secondaires ({selectedSecondary.length})</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="main" className="flex-1 overflow-hidden mt-0">
                                        <ScrollArea className="h-[50vh] pr-4">
                                            <div className="grid grid-cols-4 sm:grid-cols-5 gap-4 pb-4">
                                                {DOFUS_CLASSES.map(c => {
                                                    const isSelected = selectedMain === c.id;
                                                    return (
                                                        <button
                                                            key={c.id}
                                                            onClick={() => setSelectedMain(c.id)}
                                                            className={cn(
                                                                "group relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-300 aspect-square",
                                                                isSelected
                                                                    ? "border-primary bg-primary/10 shadow-[0_0_20px_-5px_rgba(var(--primary),0.3)]"
                                                                    : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/60"
                                                            )}
                                                            style={isSelected ? { borderColor: c.color, backgroundColor: `${c.color}15` } : undefined}
                                                        >
                                                            <div className="mb-3 transform transition-transform group-hover:scale-110 duration-300">
                                                                <ClassIcon classId={c.id} size={40} />
                                                            </div>
                                                            <span className={cn("text-xs font-semibold uppercase tracking-wider", isSelected ? "text-white" : "text-zinc-500")}
                                                                style={isSelected ? { color: c.color } : undefined}
                                                            >
                                                                {c.name}
                                                            </span>

                                                            {isSelected && (
                                                                <div className="absolute inset-0 rounded-xl ring-2 ring-inset ring-white/10" />
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
                                            <div className="grid grid-cols-4 sm:grid-cols-5 gap-4 pb-4">
                                                {DOFUS_CLASSES.map(c => {
                                                    const isSelected = selectedSecondary.includes(c.id);
                                                    const isMain = selectedMain === c.id;

                                                    return (
                                                        <button
                                                            key={c.id}
                                                            onClick={() => toggleSecondary(c.id)}
                                                            disabled={isMain}
                                                            className={cn(
                                                                "group relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-300 aspect-square",
                                                                isMain ? "opacity-20 cursor-not-allowed border-zinc-900 bg-zinc-950 grayscale" : "",
                                                                !isMain && isSelected
                                                                    ? "border-secondary bg-secondary/10"
                                                                    : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/60"
                                                            )}
                                                        >
                                                            <div className="mb-3">
                                                                <ClassIcon classId={c.id} size={32} />
                                                            </div>
                                                            <span className={cn("text-xs font-medium", isSelected ? "text-secondary-foreground" : "text-zinc-500")}>
                                                                {c.name}
                                                            </span>

                                                            {isSelected && (
                                                                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-secondary shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
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

                        <div>
                            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest mb-0.5">Classe Principale</p>
                            <h2 className="text-xl font-bold text-white tracking-tight" style={{ textShadow: `0 0 20px ${mainClassData.color}30` }}>
                                {mainClassData.name}
                            </h2>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="p-4 text-center border-2 border-dashed border-zinc-800 rounded-lg mb-4">
                    <p className="text-xs text-zinc-500">Aucune classe principale définie</p>
                </div>
            )}

            {/* Secondary Classes - Chips */}
            {secondaryClasses.length > 0 && (
                <div>
                    <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest mb-1.5 pl-1">Classes Secondaires</p>
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

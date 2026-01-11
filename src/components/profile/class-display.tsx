"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Pencil, Check, X } from "lucide-react";
import { DOFUS_CLASSES, getClass } from "@/lib/dofus-assets";
import { cn } from "@/lib/utils";

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
        } else if (selectedSecondary.length < 3) {
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
        <div className="p-6 bg-zinc-900/60 rounded-2xl border border-white/5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-zinc-400">Classe</h3>
                {!readOnly && (
                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleOpen}>
                                <Pencil className="w-4 h-4" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>Modifier mes classes</DialogTitle>
                            </DialogHeader>

                            {/* Main Class Selection */}
                            <div className="space-y-3">
                                <p className="text-sm text-zinc-400">Classe principale</p>
                                <div className="grid grid-cols-4 gap-2">
                                    {DOFUS_CLASSES.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => setSelectedMain(c.id)}
                                            className={cn(
                                                "p-3 rounded-lg border text-center transition-all",
                                                selectedMain === c.id
                                                    ? "border-primary bg-primary/10"
                                                    : "border-white/5 hover:border-white/20"
                                            )}
                                        >
                                            <span className="text-2xl block mb-1">{c.icon}</span>
                                            <span className="text-xs">{c.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Secondary Classes */}
                            <div className="space-y-3 mt-4">
                                <p className="text-sm text-zinc-400">Classes secondaires (max 3)</p>
                                <div className="grid grid-cols-4 gap-2">
                                    {DOFUS_CLASSES.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => toggleSecondary(c.id)}
                                            disabled={c.id === selectedMain}
                                            className={cn(
                                                "p-3 rounded-lg border text-center transition-all",
                                                c.id === selectedMain && "opacity-30 cursor-not-allowed",
                                                selectedSecondary.includes(c.id)
                                                    ? "border-secondary bg-secondary/10"
                                                    : "border-white/5 hover:border-white/20"
                                            )}
                                        >
                                            <span className="text-2xl block mb-1">{c.icon}</span>
                                            <span className="text-xs">{c.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Actions */}
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

            {/* Main Class Display */}
            {mainClassData ? (
                <div className="flex items-center gap-3 mb-4">
                    <span className="text-4xl">{mainClassData.icon}</span>
                    <div>
                        <p className="text-lg font-bold" style={{ color: mainClassData.color }}>
                            {mainClassData.name}
                        </p>
                        <p className="text-xs text-zinc-500">Classe principale</p>
                    </div>
                </div>
            ) : (
                <p className="text-zinc-500 text-sm mb-4">Aucune classe sélectionnée</p>
            )}

            {/* Secondary Classes */}
            {secondaryClasses.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {secondaryClasses.map(classId => {
                        const data = getClass(classId);
                        if (!data) return null;
                        return (
                            <Badge
                                key={classId}
                                variant="secondary"
                                className="bg-white/5 border-white/10"
                            >
                                <span className="mr-1">{data.icon}</span>
                                {data.name}
                            </Badge>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

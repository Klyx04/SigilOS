"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pencil, Shield, Check, Info, Sparkles } from "lucide-react";
import { ALIGNMENTS, ORDERS, getAlignment, getOrder, getAlignmentLevelSteps } from "@/lib/dofus-assets";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";

interface AlignmentSectionProps {
    alignment?: string | null;
    alignmentOrder?: string | null;
    alignmentLevel?: number | null;
    onSave?: (data: { alignment: string | null; alignmentOrder: string | null; alignmentLevel: number }) => void;
    readOnly?: boolean;
}

export function AlignmentSection({
    alignment,
    alignmentOrder,
    alignmentLevel = 0,
    onSave,
    readOnly = false,
}: AlignmentSectionProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedAlignment, setSelectedAlignment] = useState<string | null>(alignment || "neutre");
    const [selectedOrder, setSelectedOrder] = useState<string | null>(alignmentOrder || null);
    const [localLevel, setLocalLevel] = useState<number>(alignmentLevel || 0);

    const currentAlignment = getAlignment(alignment || "neutre");
    const currentOrder = alignment && alignmentOrder ? getOrder(alignment, alignmentOrder) : null;

    const handleSave = () => {
        onSave?.({
            alignment: selectedAlignment,
            alignmentOrder: selectedOrder,
            alignmentLevel: localLevel,
        });
        setIsOpen(false);
    };

    const handleOpen = () => {
        setSelectedAlignment(alignment || "neutre");
        setSelectedOrder(alignmentOrder || null);
        setLocalLevel(alignmentLevel || 0);
    };

    // Calculate the title based on the level
    const getLevelTitle = (align: string, orderId: string, level: number) => {
        const order = getOrder(align, orderId);
        if (!order) return "";
        
        const levels = [20, 40, 60, 80, 100];
        const currentMilestone = levels.reverse().find(l => level >= l);
        return currentMilestone ? order.levels[currentMilestone] : "Apprenti";
    };

    return (
        <div className="p-4 bg-zinc-900/40 backdrop-blur-md rounded-xl border border-white/10 transition-all hover:border-white/20 group">
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-zinc-200 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-indigo-400" />
                        Alignement & Ordre
                    </h3>
                    {!readOnly && (
                        <DialogTrigger asChild>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/20 transition-all duration-300"
                                onClick={handleOpen}
                            >
                                <Pencil className="w-4 h-4" strokeWidth={2.5} />
                            </Button>
                        </DialogTrigger>
                    )}
                </div>

                <div className="relative overflow-hidden rounded-lg border border-white/5 bg-gradient-to-br from-zinc-900 to-black p-4 mb-1 transition-colors group-hover:border-white/10">
                    <div className="flex items-center gap-4">
                        <div className={cn(
                            "relative flex items-center justify-center w-16 h-16 rounded-xl border shadow-lg shrink-0 overflow-hidden",
                            alignment === "bontarien" ? "border-blue-500/30 bg-blue-500/10" : 
                            alignment === "brakmarien" ? "border-red-500/30 bg-red-500/10" : 
                            "border-white/10 bg-zinc-950"
                        )}>
                            {currentOrder ? (
                                <Image 
                                    src={currentOrder.icon} 
                                    alt={currentOrder.name} 
                                    fill 
                                    className="object-cover p-2"
                                />
                            ) : currentAlignment ? (
                                <Image 
                                    src={currentAlignment.icon} 
                                    alt={currentAlignment.name} 
                                    fill 
                                    className="object-cover scale-[1.35]"
                                />
                            ) : (
                                <Shield className="w-8 h-8 text-zinc-600" />
                            )}
                        </div>

                        <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                                <Badge 
                                    className={cn(
                                        "text-[10px] uppercase font-black tracking-widest",
                                        alignment === "bontarien" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : 
                                        alignment === "brakmarien" ? "bg-red-500/20 text-red-400 border-red-500/30" : 
                                        "bg-zinc-800 text-zinc-400 border-white/5"
                                    )}
                                >
                                    {currentAlignment?.name || "Neutre"}
                                </Badge>
                                {alignmentLevel !== null && alignmentLevel > 0 && (
                                    <span className="text-[10px] font-bold text-zinc-500">
                                        Niveau {alignmentLevel}
                                    </span>
                                )}
                            </div>

                            <h4 className="text-lg font-black text-white italic tracking-tight uppercase">
                                {currentOrder ? currentOrder.name : "Aucun ordre"}
                            </h4>

                            {alignment && alignmentOrder && (
                                <p className="text-xs font-bold text-indigo-400/80 uppercase tracking-widest">
                                    {getLevelTitle(alignment, alignmentOrder, alignmentLevel || 0)}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0 bg-zinc-950 border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
                    <DialogHeader className="p-8 pb-4 border-b border-white/5 shrink-0">
                        <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Alignement & Ordres</DialogTitle>
                        <DialogDescription className="text-base text-zinc-400">Choisissez votre camp et votre spécialisation.</DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin">
                        {/* Alignment Selection */}
                        <section className="space-y-4">
                            <h4 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Shield className="w-4 h-4" /> 1. Choisir l'Alignement
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {ALIGNMENTS.map(align => (
                                    <button
                                        key={align.id}
                                        onClick={() => {
                                            setSelectedAlignment(align.id);
                                            if (align.id === "neutre") setSelectedOrder(null);
                                        }}
                                        className={cn(
                                            "relative group flex flex-col items-center gap-4 p-6 rounded-2xl border-2 transition-all duration-500 overflow-hidden",
                                            selectedAlignment === align.id
                                                ? "border-indigo-500/50 bg-indigo-500/10"
                                                : "border-white/5 bg-zinc-900/40 hover:bg-zinc-900/60 hover:border-white/10"
                                        )}
                                    >
                                        <div className={cn(
                                            "relative w-16 h-16 rounded-full flex items-center justify-center border shadow-2xl transition-transform duration-500 group-hover:scale-110 overflow-hidden",
                                            align.id === "bontarien" ? "bg-blue-500/20 border-blue-500/30" :
                                            align.id === "brakmarien" ? "bg-red-500/20 border-red-500/30" :
                                            "bg-zinc-800 border-white/10"
                                        )}>
                                            <Image 
                                                src={align.icon} 
                                                alt={align.name} 
                                                fill 
                                                className="object-cover scale-[1.35] group-hover:scale-[1.45] transition-transform duration-500" 
                                            />
                                        </div>
                                        <span className={cn(
                                            "font-black uppercase tracking-widest text-sm italic",
                                            selectedAlignment === align.id ? "text-white" : "text-zinc-500"
                                        )}>
                                            {align.name}
                                        </span>

                                        {selectedAlignment === align.id && (
                                            <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                                                <Check className="w-4 h-4 text-white" />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </section>

                        {selectedAlignment && selectedAlignment !== "neutre" && (
                            <>
                                {/* Order Selection (Moved before level for better flow) */}
                                <section className="space-y-4">
                                    <h4 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <Sparkles className="w-4 h-4" /> 2. Choisir l'Ordre
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {(ORDERS as any)[selectedAlignment].map((order: any) => {
                                            const isSelected = selectedOrder === order.id;
                                            return (
                                                <button
                                                    key={order.id}
                                                    onClick={() => setSelectedOrder(order.id)}
                                                    className={cn(
                                                        "relative group flex flex-col items-center gap-4 p-6 rounded-2xl border-2 transition-all duration-500 h-full",
                                                        isSelected
                                                            ? "border-amber-500/50 bg-amber-500/10"
                                                            : "border-white/5 bg-zinc-900/40 hover:bg-zinc-900/60 hover:border-white/10"
                                                    )}
                                                >
                                                    <div className="relative w-20 h-20 bg-zinc-950 border border-white/10 rounded-xl overflow-hidden shadow-2xl transition-transform duration-500 group-hover:scale-105">
                                                        <Image 
                                                            src={order.icon} 
                                                            alt={order.name} 
                                                            fill 
                                                            className="object-cover p-3"
                                                        />
                                                    </div>
                                                    <div className="text-center space-y-1">
                                                        <span className={cn(
                                                            "font-black uppercase tracking-tighter text-sm block leading-tight",
                                                            isSelected ? "text-white" : "text-zinc-400"
                                                        )}>
                                                            {order.name}
                                                        </span>
                                                    </div>

                                                    {isSelected && (
                                                        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.5)]">
                                                            <Check className="w-4 h-4 text-white" />
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </section>

                                {/* Level/Tranche Selection */}
                                {selectedOrder && (
                                    <section className="space-y-4 bg-zinc-900/30 p-6 rounded-2xl border border-white/5">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                                <Info className="w-4 h-4" /> 3. Niveau d'Alignement (Tranche)
                                            </h4>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                            {getAlignmentLevelSteps(selectedOrder).map(({ level, title }) => {
                                                const isExactSelected = localLevel === level;
                                                return (
                                                    <button
                                                        key={level}
                                                        onClick={() => setLocalLevel(level)}
                                                        className={cn(
                                                            "relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-300 text-center gap-2",
                                                            isExactSelected
                                                                ? "border-amber-500 bg-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                                                                : "border-white/5 bg-zinc-950/50 hover:border-white/20 hover:bg-zinc-900"
                                                        )}
                                                    >
                                                        <span className={cn(
                                                            "text-lg font-black italic",
                                                            isExactSelected ? "text-amber-400" : "text-zinc-500"
                                                        )}>
                                                            Niv {level}
                                                        </span>
                                                        <span className={cn(
                                                            "text-[10px] uppercase font-bold leading-tight",
                                                            isExactSelected ? "text-white" : "text-zinc-600"
                                                        )}>
                                                            {title || getLevelTitle(selectedAlignment, selectedOrder, level)}
                                                        </span>
                                                        {isExactSelected && (
                                                            <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                                                                <Check className="w-3 h-3 text-white" />
                                                            </div>
                                                        )}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </section>
                                )}

                            </>
                        )}
                    </div>

                    <div className="p-6 border-t border-white/5 bg-zinc-900/40 flex justify-end gap-3 shrink-0">
                        <DialogClose asChild>
                            <Button variant="ghost" className="text-zinc-400 hover:text-white">
                                Annuler
                            </Button>
                        </DialogClose>
                        <Button 
                            onClick={handleSave} 
                            variant="sigil"
                            size="xl"
                        >
                            Enregistrer mon Ordre
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

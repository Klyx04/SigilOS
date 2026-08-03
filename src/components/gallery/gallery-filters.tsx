"use client";

import { ChevronDown, Mars, Venus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import NextImage from "next/image";
import { DOFUS_CLASSES } from "@/lib/dofus-assets";
import { DO_TAGS } from "@/lib/dofus-tags";

const ADVANCED_TAG_IDS = ["tank","soin","pp","dopou","docrit","ini","retpa","retpm","terrefeu","terreeau","terreair","feueau","feuair","eauair","multinocrit","sagesse","leveling","songes","koli1v1","koli2v2","koli3v3","perco"];

// Extract numeric icon ID from icon path (e.g. "/assets/dofus/classes/9.png" → 9)
export function getNumericClassId(cls: typeof DOFUS_CLASSES[number]): number | null {
    const match = cls.icon.match(/classes\/(\d+)\.png/);
    return match ? parseInt(match[1]) : null;
}

export function AdvancedTagFilter({
    selectedTag, onSelectTag
}: { selectedTag: string | null; onSelectTag: (id: string | null) => void }) {
    // Separate tags into categories for a better UX
    const categories = [
        {
            title: "Bi-éléments",
            tags: ["terrefeu","terreeau","terreair","feueau","feuair","eauair"]
        },
        {
            title: "Stats & Spécialités",
            tags: ["tank","soin","pp","sagesse","ini","retpa","retpm"]
        },
        {
            title: "Dommages & Modes",
            tags: ["dopou","docrit","multinocrit","leveling","songes"]
        },
        {
            title: "PvP & Autres",
            tags: ["koli1v1","koli2v2","koli3v3","perco"]
        }
    ];

    const activeInAdvanced = DO_TAGS.find(t => ADVANCED_TAG_IDS.includes(t.id) && t.id === selectedTag);

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button className={cn(
                    "h-8 px-3 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 shrink-0",
                    activeInAdvanced ? `${activeInAdvanced.className} shadow-md` : "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10"
                )}>
                    {activeInAdvanced ? activeInAdvanced.text : "Tags Avancés"}
                    <ChevronDown className="w-3 h-3 opacity-60" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[340px] bg-zinc-950/95 backdrop-blur-xl border-white/10 rounded-2xl p-4 shadow-2xl" align="start" side="bottom">
                <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
                    {categories.map(cat => (
                        <div key={cat.title} className="space-y-2.5">
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">{cat.title}</p>
                            <div className="flex flex-wrap gap-1.5">
                                {cat.tags.map(tid => {
                                    const tag = DO_TAGS.find(t => t.id === tid);
                                    if (!tag) return null;
                                    return (
                                        <button
                                            key={tag.id}
                                            onClick={() => onSelectTag(selectedTag === tag.id ? null : tag.id)}
                                            className={cn(
                                                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all border",
                                                selectedTag === tag.id ? `${tag.className} shadow-lg ring-1 ring-white/10 scale-[1.02]` : "text-zinc-400 bg-white/5 border-transparent hover:text-white hover:bg-white/10 hover:border-white/10"
                                            )}
                                        >
                                            {tag.text}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}

export function ClassFilter({
    selectedClass, onSelectClass, label = "Classe"
}: { selectedClass: string | number | null; onSelectClass: (id: string | number | null) => void; label?: string }) {
    const active = DOFUS_CLASSES.find(c => {
        const numId = getNumericClassId(c);
        return numId !== null && String(numId) === String(selectedClass);
    });
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button className={cn(
                    "h-8 px-3 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 shrink-0",
                    active ? "bg-white/10 text-white border border-white/20" : "bg-white/5 text-zinc-500 hover:text-white hover:bg-white/10"
                )}>
                    {active ? (
                        <>
                            <NextImage src={active.icon} alt={active.name} width={14} height={14} className="object-contain" />
                            {active.name}
                        </>
                    ) : label}
                    <ChevronDown className="w-3 h-3 opacity-60" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 bg-zinc-950 border-white/10 rounded-2xl p-2 shadow-2xl" align="start" side="bottom">
                <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest px-2 pt-1 pb-2">Filtrer par {label.toLowerCase()}</p>
                <div className="grid grid-cols-3 gap-1">
                    {DOFUS_CLASSES.map(cls => {
                        const numId = getNumericClassId(cls);
                        if (numId === null) return null;
                        const idStr = String(numId);
                        return (
                            <button
                                key={cls.id}
                                onClick={() => onSelectClass(String(selectedClass) === idStr ? null : idStr)}
                                className={cn(
                                    "flex flex-col items-center gap-1 p-2 rounded-xl text-[10px] font-semibold transition-all",
                                    String(selectedClass) === idStr
                                        ? "bg-white/10 text-white ring-1 ring-white/20"
                                        : "text-zinc-500 hover:text-white hover:bg-white/5"
                                )}
                            >
                                <NextImage src={cls.icon} alt={cls.name} width={24} height={24} className="object-contain" />
                                {cls.name}
                            </button>
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
}

export function GenderFilter({
    selectedGender, onSelectGender
}: { selectedGender: string | null; onSelectGender: (gender: string | null) => void }) {
    return (
        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-2xl border border-white/5">
            <button
                onClick={() => onSelectGender(selectedGender === "M" ? null : "M")}
                className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                    selectedGender === "M" ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "text-zinc-500 hover:text-blue-400 hover:bg-white/5"
                )}
                title="Sexe Masculin"
            >
                <Mars className="w-4 h-4" />
            </button>
            <button
                onClick={() => onSelectGender(selectedGender === "F" ? null : "F")}
                className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                    selectedGender === "F" ? "bg-pink-500 text-white shadow-lg shadow-pink-500/20" : "text-zinc-500 hover:text-pink-400 hover:bg-white/5"
                )}
                title="Sexe Féminin"
            >
                <Venus className="w-4 h-4" />
            </button>
        </div>
    );
}

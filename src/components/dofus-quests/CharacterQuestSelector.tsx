"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { User, Users, ChevronDown, Crown } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ClassIcon } from "@/components/shared/class-icon";
import { DofusClass } from "@/lib/songes/types";

interface CharacterQuestSelectorProps {
    mainCharacter: {
        pseudo: string;
        classe?: string | null;
    };
    mules: {
        pseudo: string;
        classe?: string | null;
        level?: number | null;
    }[];
}

export function CharacterQuestSelector({ mainCharacter, mules }: CharacterQuestSelectorProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const selectedCharacter = searchParams.get("character") || "PRINCIPAL";

    const handleSelect = (char: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (char === "PRINCIPAL") {
            params.delete("character");
        } else {
            params.set("character", char);
        }
        startTransition(() => {
            router.push(`${pathname}?${params.toString()}`);
        });
    };

    // Find class of selected character
    const selectedCharClass = selectedCharacter === "PRINCIPAL"
        ? mainCharacter.classe
        : mules.find(m => m.pseudo === selectedCharacter)?.classe;

    const currentLabel = selectedCharacter === "PRINCIPAL" 
        ? mainCharacter.pseudo
        : selectedCharacter;

    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                Personnage Actif
            </span>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button 
                        variant="outline" 
                        role="combobox"
                        aria-expanded={false}
                        className="bg-zinc-950/60 backdrop-blur-md border-white/5 hover:border-emerald-500/20 text-white justify-between min-w-[200px] transition-all rounded-xl h-10 px-3 cursor-pointer"
                        disabled={isPending}
                    >
                        <div className="flex items-center gap-2 truncate">
                            {selectedCharClass ? (
                                <ClassIcon classId={selectedCharClass as DofusClass} size={18} />
                            ) : selectedCharacter === "PRINCIPAL" ? (
                                <Crown className="w-3.5 h-3.5 text-amber-500" />
                            ) : (
                                <Users className="w-3.5 h-3.5 text-blue-400" />
                            )}
                            <span className="truncate font-bold tracking-wide text-xs">{currentLabel}</span>
                        </div>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform opacity-30 ${isPending ? 'animate-pulse' : ''}`} />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-zinc-950/95 backdrop-blur-xl border-white/5 text-white min-w-[200px] rounded-xl p-1.5 shadow-2xl z-[100]">
                    <DropdownMenuItem 
                        onClick={() => handleSelect("PRINCIPAL")}
                        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${selectedCharacter === "PRINCIPAL" ? "bg-white/5 text-emerald-400" : "hover:bg-white/5"}`}
                    >
                        <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                            {mainCharacter.classe ? (
                                <ClassIcon classId={mainCharacter.classe as DofusClass} size={16} />
                            ) : (
                                <Crown className="w-3.5 h-3.5 text-amber-500" />
                            )}
                        </div>
                        <div className="flex flex-col text-left">
                            <span className="text-xs font-bold">{mainCharacter.pseudo}</span>
                            <span className="text-[9px] text-zinc-500 font-medium uppercase tracking-widest">{mainCharacter.classe || "Principal"}</span>
                        </div>
                    </DropdownMenuItem>
                    
                    {mules.length > 0 && <div className="h-px bg-white/5 my-1" />}
                    
                    {mules.map((mule) => (
                        <DropdownMenuItem 
                            key={mule.pseudo}
                            onClick={() => handleSelect(mule.pseudo)}
                            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${selectedCharacter === mule.pseudo ? "bg-white/5 text-emerald-400" : "hover:bg-white/5"}`}
                        >
                            <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                {mule.classe ? (
                                    <ClassIcon classId={mule.classe as DofusClass} size={16} />
                                ) : (
                                    <Users className="w-3.5 h-3.5 text-blue-400" />
                                )}
                            </div>
                            <div className="flex flex-col text-left">
                                <span className="text-xs font-bold">{mule.pseudo}</span>
                                <span className="text-[9px] text-zinc-500 font-medium uppercase tracking-widest">
                                    Niv. {mule.level || 200} {mule.classe ? `• ${mule.classe}` : ""}
                                </span>
                            </div>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}


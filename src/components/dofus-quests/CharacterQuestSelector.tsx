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

    const currentLabel = selectedCharacter === "PRINCIPAL" 
        ? `${mainCharacter.pseudo}${mainCharacter.classe ? ` (${mainCharacter.classe})` : ""}`
        : selectedCharacter;

    return (
        <div className="flex flex-col gap-2">
            <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] ml-1">
                Personnage de Quête
            </span>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button 
                        variant="outline" 
                        role="combobox"
                        aria-expanded={false}
                        className="bg-zinc-900/40 backdrop-blur-md border-white/10 hover:bg-white/10 text-white justify-between min-w-[220px] transition-all rounded-xl h-11"
                        disabled={isPending}
                    >
                        <div className="flex items-center gap-2 truncate">
                            {selectedCharacter === "PRINCIPAL" ? (
                                <Crown className="w-4 h-4 text-amber-500" />
                            ) : (
                                <Users className="w-4 h-4 text-blue-400" />
                            )}
                            <span className="truncate font-semibold tracking-wide">{currentLabel}</span>
                        </div>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform opacity-30 ${isPending ? 'animate-pulse' : ''}`} />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-zinc-900/95 backdrop-blur-xl border-white/10 text-white min-w-[220px] rounded-xl p-1.5 shadow-2xl z-50">
                    <DropdownMenuItem 
                        onClick={() => handleSelect("PRINCIPAL")}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${selectedCharacter === "PRINCIPAL" ? "bg-white/10" : "hover:bg-white/5"}`}
                    >
                        <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                            <Crown className="w-4 h-4 text-amber-500" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold">{mainCharacter.pseudo}</span>
                            <span className="text-[10px] text-white/40 uppercase tracking-widest">{mainCharacter.classe || "Classe non définie"}</span>
                        </div>
                    </DropdownMenuItem>
                    
                    {mules.length > 0 && <div className="h-px bg-white/5 m-1.5" />}
                    
                    {mules.map((mule) => (
                        <DropdownMenuItem 
                            key={mule.pseudo}
                            onClick={() => handleSelect(mule.pseudo)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${selectedCharacter === mule.pseudo ? "bg-white/10" : "hover:bg-white/5"}`}
                        >
                            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                <Users className="w-4 h-4 text-blue-400" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold">{mule.pseudo}</span>
                                <span className="text-[10px] text-white/40 uppercase tracking-widest">
                                    Mule {mule.classe ? `• ${mule.classe}` : ""}
                                </span>
                            </div>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

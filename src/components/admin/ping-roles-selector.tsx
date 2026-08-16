"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, Hash, X, AlertTriangle } from "lucide-react";

interface Role {
    id: string;
    name: string;
    color: string;
}

interface PingRolesSelectorProps {
    value: string[];
    onChange: (value: string[]) => void;
    roles: Role[];
    description?: string;
}

export function PingRolesSelector({ value, onChange, roles, description = "Si la liste est vide, aucun rôle Discord ne sera disponible pour le ping dans les modales pour les membres (seuls les administrateurs verront toujours tous les rôles)." }: PingRolesSelectorProps) {
    const [open, setOpen] = useState(false);

    return (
        <div className="space-y-3">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-caption font-black text-zinc-500 uppercase tracking-widest">Liste Blanche</span>
                    {value.length > 0 && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => onChange([])}
                            className="h-6 text-caption font-black uppercase text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 px-2"
                        >
                            Tout effacer
                        </Button>
                    )}
                </div>

                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            className="w-full h-12 bg-black/20 border-white/10 justify-between px-4 hover:bg-black/30 text-zinc-400"
                        >
                            <div className="flex items-center gap-2 truncate">
                                <Hash className="w-4 h-4 text-zinc-600" />
                                {value.length > 0 
                                    ? `${value.length} rôle(s) sélectionné(s)` 
                                    : "Sélectionner les rôles autorisés..."
                                }
                            </div>
                            <ChevronsUpDown className="w-4 h-4 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-zinc-950 border-white/10" align="start">
                        <Command className="bg-transparent text-white">
                            <CommandInput placeholder="Filtrer les rôles..." className="h-11 border-none focus:ring-0" />
                            <CommandList className="max-h-[300px] premium-scrollbar">
                                <CommandEmpty>Aucun rôle trouvé.</CommandEmpty>
                                <CommandGroup className="p-1.5">
                                    {roles.map((role) => (
                                        <CommandItem
                                            key={role.id}
                                            onSelect={() => {
                                                onChange(
                                                    value.includes(role.id) 
                                                        ? value.filter(id => id !== role.id) 
                                                        : [...value, role.id]
                                                );
                                            }}
                                            className="text-white focus:bg-white/5 cursor-pointer text-xs py-2 px-3 rounded-lg flex items-center justify-between group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div 
                                                    className="w-2.5 h-2.5 rounded-full " 
                                                    style={{ 
                                                        backgroundColor: role.color === "#000000" ? "#9ca3af" : role.color,
                                                        color: role.color === "#000000" ? "#9ca3af" : role.color
                                                    }} 
                                                />
                                                <span className="font-bold">{role.name}</span>
                                            </div>
                                            {value.includes(role.id) && <Check className="h-4 w-4 text-indigo-400" />}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>

                {value.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-4">
                        {value.map(id => {
                            const role = roles.find(r => r.id === id);
                            if (!role) return null;
                            const color = role.color === "#000000" ? "#9ca3af" : role.color;
                            return (
                                <div 
                                    key={id} 
                                    className="flex items-center gap-1.5 px-2 py-0.5 rounded border text-caption font-bold uppercase tracking-tight"
                                    style={{ 
                                        backgroundColor: `${color}15`, 
                                        borderColor: `${color}30`,
                                        color: color 
                                    }}
                                >
                                    {role.name}
                                    <button 
                                        onClick={() => onChange(value.filter(rid => rid !== id))}
                                        className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                                    >
                                        <X className="w-2.5 h-2.5" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="mt-4 p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 flex items-start gap-3">
                        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-caption text-amber-400 font-black uppercase tracking-widest mb-1">Aucun rôle autorisé</p>
                            <p className="text-caption text-zinc-500 leading-relaxed italic">
                                {description}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

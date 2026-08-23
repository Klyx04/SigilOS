"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Search, UserCircle, Shield, Star, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

interface Role {
    id: string;
    name: string;
}

interface RoleSelectorProps {
    value: string | null;
    onChange: (value: string | null) => void;
    roles: Role[];
    placeholder?: string;
    className?: string;
}

export function RoleSelector({ value, onChange, roles, placeholder = "Sélectionner un rôle...", className }: RoleSelectorProps) {
    const [open, setOpen] = useState(false);

    const selectedRole = roles.find((role) => role.id === value);

    // Categorize roles
    const categories = {
        everyone: roles.filter(r => r.id === "everyone"),
        staff: roles.filter(r => r.name.toLowerCase().includes("staff") || r.name.toLowerCase().includes("admin") || r.name.toLowerCase().includes("empereur") || r.name.toLowerCase().includes("gm") || r.name.toLowerCase().includes("game master")),
        others: roles.filter(r => r.id !== "everyone" && !r.name.toLowerCase().includes("staff") && !r.name.toLowerCase().includes("admin") && !r.name.toLowerCase().includes("empereur") && !r.name.toLowerCase().includes("gm") && !r.name.toLowerCase().includes("game master"))
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        "w-full justify-between bg-black/40 border-border h-12 text-caption font-black uppercase tracking-widest rounded-xl hover:bg-surface/60 transition-all",
                        className
                    )}
                >
                    <div className="flex items-center gap-2 truncate">
                        {value === "everyone" ? (
                            <Users className="w-3.5 h-3.5 text-warning" />
                        ) : selectedRole ? (
                            <Shield className="w-3.5 h-3.5 text-info" />
                        ) : (
                            <UserCircle className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                        <span className="truncate">
                            {value === "everyone" ? "@EVERYONE" : selectedRole ? `@${selectedRole.name}` : "AUCUNE MENTION"}
                        </span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 bg-background border-border shadow-2xl rounded-2xl overflow-hidden" align="start">
                <Command className="bg-transparent">
                    <div className="flex items-center border-b border-border px-3 bg-surface">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50 text-warning" />
                        <CommandInput
                            placeholder="Rechercher un rôle..."
                            className="h-12 bg-transparent border-none focus:ring-0 text-xs font-bold uppercase tracking-widest"
                        />
                    </div>
                    <CommandList className="max-h-[350px] scrollbar-thin scrollbar-thumb-white/10">
                        <CommandEmpty className="py-6 text-center text-caption font-black uppercase tracking-[0.2em] text-muted-foreground">
                            Aucun rôle trouvé.
                        </CommandEmpty>

                        <CommandGroup>
                            <CommandItem
                                onSelect={() => {
                                    onChange(null);
                                    setOpen(false);
                                }}
                                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-surface transition-colors group"
                            >
                                <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center group-hover:border-border transition-all">
                                    <UserCircle className="w-4 h-4 text-muted-foreground" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-caption font-black uppercase tracking-widest text-foreground">Aucune Mention</span>
                                    <span className="text-caption font-bold text-muted-foreground uppercase tracking-tighter">Désactiver les pings</span>
                                </div>
                                {value === null && <Check className="ml-auto w-4 h-4 text-warning" />}
                            </CommandItem>
                        </CommandGroup>

                        {categories.everyone.length > 0 && (
                            <CommandGroup heading={<span className="text-caption font-black uppercase tracking-widest text-warning/50 px-2">Global</span>}>
                                <CommandItem
                                    onSelect={() => {
                                        onChange("everyone");
                                        setOpen(false);
                                    }}
                                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-warning/5 transition-colors group"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-warning/10 border border-warning/20 flex items-center justify-center group-hover:bg-warning/20 transition-all">
                                        <Users className="w-4 h-4 text-warning" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-caption font-black uppercase tracking-widest text-warning">@Everyone</span>
                                        <span className="text-caption font-bold text-warning/40 uppercase tracking-tighter">Attirer l&apos;attention de tous</span>
                                    </div>
                                    {value === "everyone" && <Check className="ml-auto w-4 h-4 text-warning" />}
                                </CommandItem>
                            </CommandGroup>
                        )}

                        {categories.staff.length > 0 && (
                            <CommandGroup heading={<span className="text-caption font-black uppercase tracking-widest text-info/50 px-2 mt-2">Administration</span>}>
                                {categories.staff.map((role) => (
                                    <CommandItem
                                        key={role.id}
                                        onSelect={() => {
                                            onChange(role.id);
                                            setOpen(false);
                                        }}
                                        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-surface transition-colors group"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-info/10 border border-info/20 flex items-center justify-center group-hover:bg-info/20 transition-all">
                                            <Shield className="w-4 h-4 text-info" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-caption font-black uppercase tracking-widest text-foreground">@{role.name}</span>
                                            <span className="text-caption font-bold text-muted-foreground uppercase tracking-tighter">Rôle Privilégié</span>
                                        </div>
                                        {value === role.id && <Check className="ml-auto w-4 h-4 text-info" />}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}

                        {categories.others.length > 0 && (
                            <CommandGroup heading={<span className="text-caption font-black uppercase tracking-widest text-muted-foreground/50 px-2 mt-2">Autres Rôles</span>}>
                                {categories.others.map((role) => (
                                    <CommandItem
                                        key={role.id}
                                        onSelect={() => {
                                            onChange(role.id);
                                            setOpen(false);
                                        }}
                                        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-surface transition-colors group"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center group-hover:border-border transition-all">
                                            <Star className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-caption font-black uppercase tracking-widest text-muted-foreground group-hover:text-foreground">@{role.name}</span>
                                        </div>
                                        {value === role.id && <Check className="ml-auto w-4 h-4 text-muted-foreground" />}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

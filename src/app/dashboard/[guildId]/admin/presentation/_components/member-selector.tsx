"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search, User, X } from "lucide-react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DiscordMemberOption } from "@/server/actions/presentation-actions";

interface MemberSelectorProps {
    value?: string;
    onChange: (value: string) => void;
    members: DiscordMemberOption[];
    placeholder?: string;
    className?: string;
    error?: boolean;
}

export function MemberSelector({
    value = "",
    onChange,
    members = [],
    placeholder = "Sélectionner un membre...",
    className,
    error
}: MemberSelectorProps) {
    const [open, setOpen] = React.useState(false);
    const [inputValue, setInputValue] = React.useState("");

    // Find selected member object if it matches a Discord member
    const selectedMember = members.find((member) => member.name === value);

    const handleSelect = (currentValue: string) => {
        onChange(currentValue);
        setOpen(false);
    };

    // Handle custom input when pressing enter or blurring if no match found
    const handleCustomInput = () => {
        if (!inputValue) return;

        // Only block HTML injection characters - everything else is allowed
        const hasHtmlChars = /[<>"'&]/.test(inputValue);

        if (hasHtmlChars) {
            // Block HTML injection attempts
            return;
        }

        if (inputValue !== value) {
            onChange(inputValue);
            setOpen(false);
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        "w-full justify-between bg-surface/50 border-border hover:bg-elevated hover:text-foreground",
                        !value && "text-muted-foreground",
                        error && "border-danger/50 text-danger",
                        className
                    )}
                >
                    <div className="flex items-center gap-2 truncate">
                        {selectedMember ? (
                            <>
                                <Avatar className="h-5 w-5">
                                    <AvatarImage src={selectedMember.avatar || undefined} />
                                    <AvatarFallback className="text-caption bg-surface text-foreground">
                                        {(selectedMember.name || "??").substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <span className="truncate">{selectedMember.name}</span>
                            </>
                        ) : value ? (
                            <span className="truncate">{value}</span>
                        ) : (
                            <span className="truncate">{placeholder}</span>
                        )}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[300px] p-0 bg-background border-border" align="start">
                <Command shouldFilter={false}>
                    <div className="flex items-center border-b border-border px-3" cmdk-input-wrapper="">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <input
                            className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
                            placeholder="Rechercher ou saisir un pseudo..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    handleCustomInput();
                                }
                            }}
                        />
                    </div>
                    <CommandList>
                        <CommandEmpty className="py-2 px-2 text-sm text-muted-foreground text-center">
                            {inputValue ? (
                                !/[<>"'&]/.test(inputValue) ? (
                                    <button
                                        type="button"
                                        className="w-full text-left p-3 rounded-xl hover:bg-surface text-foreground flex items-center gap-3 transition-colors border border-dashed border-border-strong"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            handleCustomInput();
                                        }}
                                    >
                                        <div className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center">
                                            <User className="h-4 w-4" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold">Utiliser "{inputValue}"</span>
                                            <span className="text-caption text-muted-foreground uppercase tracking-widest">Saisie manuelle</span>
                                        </div>
                                    </button>
                                ) : (
                                    <span className="text-danger text-xs flex items-center gap-2 justify-center py-2">
                                        <X className="h-3 w-3" />
                                        Caractères HTML interdits (&lt; &gt; " ' &amp;)
                                    </span>
                                )
                            ) : (
                                "Aucun résultat."
                            )}
                        </CommandEmpty>
                        <CommandGroup heading="Membres Discord">
                            {members
                                .filter((member) =>
                                    member.name.toLowerCase().includes(inputValue.toLowerCase())
                                )
                                .slice(0, 50) // Limit results for performance
                                .map((member) => (
                                    <CommandItem
                                        key={member.id}
                                        value={member.name}
                                        onSelect={handleSelect}
                                        className="gap-2 cursor-pointer aria-selected:bg-surface aria-selected:text-foreground"
                                    >
                                        <Avatar className="h-6 w-6">
                                            <AvatarImage src={member.avatar || undefined} />
                                            <AvatarFallback className="text-caption bg-surface text-foreground">
                                                {(member.name || "??").substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="truncate">{member.name}</span>
                                        <Check
                                            className={cn(
                                                "ml-auto h-4 w-4",
                                                value === member.name ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                    </CommandItem>
                                ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

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
import { Badge } from "@/components/ui/badge";

export type Option = {
    label: string;
    value: string;
    color?: number; // Optional color for badges
    icon?: string | null; // Optional icon URL
};

type Props = {
    options: Option[];
    selected: string[];
    onChange: (selected: string[]) => void;
    placeholder?: string;
    className?: string;
};

export function MultiSelect({
    options,
    selected,
    onChange,
    placeholder = "Select options...",
    className,
}: Props) {
    const [open, setOpen] = React.useState(false);

    const handleUnselect = (item: string) => {
        onChange(selected.filter((i) => i !== item));
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between min-h-[40px] h-auto", className)}
                >
                    <div className="flex gap-1 flex-wrap">
                        {selected.length === 0 && <span className="text-muted-foreground font-normal">{placeholder}</span>}
                        {selected.length > 0 && selected.length <= 5 && (
                            selected.map((itemValue) => {
                                const option = options.find((o) => o.value === itemValue);
                                return (
                                    <Badge
                                        variant="secondary"
                                        key={itemValue}
                                        className="mr-1 mb-1 pr-1"
                                        style={option?.color ? {
                                            borderColor: `#${option.color.toString(16).padStart(6, '0')}`,
                                            borderLeftWidth: '4px'
                                        } : {}}
                                    >
                                        {option?.icon && (
                                            <img src={option.icon} alt="" className="w-3.5 h-3.5 mr-1.5 object-contain" />
                                        )}
                                        {option?.label || itemValue}
                                        <div
                                            className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer p-0.5 hover:bg-slate-700/50"
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    handleUnselect(itemValue);
                                                    e.stopPropagation();
                                                }
                                            }}
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                            }}
                                            onClick={() => handleUnselect(itemValue)}
                                        >
                                            <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                        </div>
                                    </Badge>
                                );
                            })
                        )}
                        {selected.length > 5 && (
                            <Badge variant="secondary" className="mr-1 mb-1">
                                {selected.length} séléctionnés
                            </Badge>
                        )}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0">
                <Command>
                    <CommandInput placeholder="Rechercher..." />
                    <CommandList>
                        <CommandEmpty>Aucun résultat.</CommandEmpty>
                        <CommandGroup className="max-h-64 overflow-auto">
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.label} // Search by label
                                    onSelect={() => {
                                        onChange(
                                            selected.includes(option.value)
                                                ? selected.filter((item) => item !== option.value)
                                                : [...selected, option.value]
                                        );
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            selected.includes(option.value) ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {option.icon ? (
                                        <img src={option.icon} alt="" className="w-5 h-5 mr-2 object-contain" />
                                    ) : (
                                        <span
                                            className="w-2 h-2 rounded-full mr-2"
                                            style={{ backgroundColor: option.color ? `#${option.color.toString(16).padStart(6, '0')}` : 'gray' }}
                                        />
                                    )}
                                    {option.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { useDebounce } from "use-debounce"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

export interface ComboboxItem {
    value: string
    label: string
    subLabel?: string
}

interface AsyncComboboxProps {
    value?: string
    onSelect: (value: string) => void
    fetcher: (query: string) => Promise<ComboboxItem[]>
    placeholder?: string
    searchPlaceholder?: string
    emptyText?: string
    renderItem?: (item: ComboboxItem) => React.ReactNode
    disabled?: boolean
    className?: string
}

export function AsyncCombobox({
    value,
    onSelect,
    fetcher,
    placeholder = "Sélectionner...",
    searchPlaceholder = "Rechercher...",
    emptyText = "Aucun résultat.",
    renderItem,
    disabled = false,
    className
}: AsyncComboboxProps) {
    const [open, setOpen] = React.useState(false)
    const [inputValue, setInputValue] = React.useState("")
    const [debouncedValue] = useDebounce(inputValue, 300)
    const [items, setItems] = React.useState<ComboboxItem[]>([])
    const [loading, setLoading] = React.useState(false)
    const [selectedLabel, setSelectedLabel] = React.useState<string>("")

    // Fetch items when search changes
    React.useEffect(() => {
        let mounted = true

        const loadItems = async () => {
            setLoading(true)
            try {
                const results = await fetcher(debouncedValue)
                if (mounted) setItems(results)
            } catch (error) {
                console.error("AsyncCombobox fetch error:", error)
            } finally {
                if (mounted) setLoading(false)
            }
        }

        if (open) {
            loadItems()
        }

        return () => {
            mounted = false
        }
    }, [debouncedValue, open, fetcher])

    // Update label when value changes or items load
    React.useEffect(() => {
        if (value) {
            // Try to find label in current items
            const item = items.find(i => i.value === value)
            if (item) {
                setSelectedLabel(item.label)
            } else if (!selectedLabel) {
                // If we have a value but no label (initial load), we might want to fetch the specific item
                // For now, we'll just show the value or rely on the parent to pass the initial label 
                // effectively, this component assumes 'fetcher' returns relevant items including the selected one if hinted
                // or simplistic approach:
                // Currently do nothing, label will be empty until user searches or parent handles it.
                // IMPROVEMENT: Add an `initialLabel` prop if needed.
            }
        } else {
            setSelectedLabel("")
        }
    }, [value, items])

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("justify-between bg-zinc-950 border-zinc-800 text-zinc-300 w-full hover:bg-zinc-900 hover:text-white", className)}
                    disabled={disabled}
                >
                    {selectedLabel || value ? (selectedLabel || "Chargement...") : placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 bg-zinc-950 border-zinc-800 text-zinc-300" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder={searchPlaceholder}
                        value={inputValue}
                        onValueChange={setInputValue}
                        className="border-none focus:ring-0"
                    />
                    <CommandList>
                        {loading && (
                            <div className="flex items-center justify-center p-4">
                                <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                            </div>
                        )}
                        {!loading && items.length === 0 && (
                            <CommandEmpty>{emptyText}</CommandEmpty>
                        )}
                        {!loading && items.length > 0 && (
                            <CommandGroup>
                                {items.map((item) => (
                                    <CommandItem
                                        key={item.value}
                                        value={item.value}
                                        onSelect={(currentValue) => {
                                            onSelect(item.value)
                                            setSelectedLabel(item.label)
                                            setOpen(false)
                                        }}
                                        className="aria-selected:bg-zinc-900 aria-selected:text-white hover:bg-zinc-900 cursor-pointer"
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                value === item.value ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {renderItem ? renderItem(item) : (
                                            <div className="flex flex-col">
                                                <span>{item.label}</span>
                                                {item.subLabel && <span className="text-xs text-zinc-500">{item.subLabel}</span>}
                                            </div>
                                        )}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

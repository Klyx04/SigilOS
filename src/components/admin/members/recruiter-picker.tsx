"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Valeur sentinelle « aucun recruteur » (le registre enregistre `null`). */
export const NO_RECRUITER = "NONE";

export interface RecruiterOption {
    id: string;
    name: string;
}

/**
 * Choix du recruteur — **petite modale avec recherche de pseudo**.
 *
 * Avant : un `<Select>` natif listant tout le dashboard (une centaine d'entrées, aucune recherche,
 * on scrolle à l'aveugle). Même correction que le filtre de rôles des sondages : une modale courte,
 * un champ de recherche, et la sélection se fait au pseudo.
 * Le déclencheur, lui, reste un bouton sobre aux tokens du module (jamais une liste déroulante).
 */
export function RecruiterPicker({
    options,
    value,
    onChange,
    disabled = false,
}: {
    options: RecruiterOption[];
    value: string;
    onChange: (next: string) => void;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const selected = options.find((option) => option.id === value) ?? null;
    const label = value === NO_RECRUITER || !selected ? "Aucun recruteur" : selected.name;

    function pick(next: string) {
        onChange(next);
        setOpen(false);
    }

    return (
        <>
            <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(true)}
                disabled={disabled}
                aria-haspopup="dialog"
                aria-expanded={open}
                className="h-9 w-full justify-between gap-2 px-3 text-xs font-normal"
            >
                <span className={cn("truncate", !selected && "text-muted-foreground")}>{label}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="gap-0 p-0 sm:max-w-sm">
                    <DialogHeader className="px-4 pt-4">
                        <DialogTitle className="text-sm">Choisir le recruteur</DialogTitle>
                        <DialogDescription className="text-xs">
                            Recherchez le membre du dashboard qui a recruté cette personne.
                        </DialogDescription>
                    </DialogHeader>
                    <Command className="mt-3 border-t border-border">
                        <CommandInput placeholder="Rechercher un pseudo…" className="h-10 text-sm" />
                        <CommandList className="max-h-64">
                            <CommandEmpty className="py-6 text-xs text-muted-foreground">
                                Aucun membre trouvé.
                            </CommandEmpty>
                            <CommandGroup>
                                <CommandItem
                                    value={NO_RECRUITER}
                                    keywords={["aucun", "aucun recruteur"]}
                                    onSelect={() => pick(NO_RECRUITER)}
                                    className="text-xs"
                                >
                                    <Check
                                        className={cn(
                                            "h-3.5 w-3.5",
                                            value === NO_RECRUITER ? "opacity-100" : "opacity-0"
                                        )}
                                        aria-hidden="true"
                                    />
                                    Aucun recruteur
                                </CommandItem>
                                {options.map((option) => (
                                    <CommandItem
                                        key={option.id}
                                        value={option.id}
                                        keywords={[option.name]}
                                        onSelect={() => pick(option.id)}
                                        className="text-xs"
                                    >
                                        <Check
                                            className={cn(
                                                "h-3.5 w-3.5",
                                                value === option.id ? "opacity-100" : "opacity-0"
                                            )}
                                            aria-hidden="true"
                                        />
                                        <span className="truncate">{option.name}</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </DialogContent>
            </Dialog>
        </>
    );
}

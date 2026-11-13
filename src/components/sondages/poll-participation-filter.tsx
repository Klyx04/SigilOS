"use client";

/**
 * Sondages — **filtre de participation** : recherche de membre + rôle Discord.
 *
 * Deux contrôles **compacts** sur une seule ligne (empilés sur mobile), aucun
 * encombrement : la liste filtrée est celle des votants d'un choix **et** celle
 * des non-votants — un seul état pour les deux, donc jamais deux listes qui se
 * contredisent.
 *
 * Le sélecteur de rôle n'apparaît **que** si des rôles sont réellement
 * filtrables (`roles.length > 0`) : sans données Discord, l'écran ne montre pas
 * un contrôle inerte.
 *
 * Le rôle se choisit dans un **menu de l'application** (recherche + pastille de
 * couleur du rôle), jamais dans une `select` native : celle-ci ouvrait la liste
 * du système, ignorait le thème et alignait une vingtaine de rôles sans le
 * moindre filtre — illisible, et impossible à chercher.
 */

import { useId, useState } from "react";
import { Check, ChevronsUpDown, Search, Users, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { POLL_FILTER_CONTROL, POLL_FILTER_MENU, POLL_SLOT_COUNTER } from "@/lib/polls/ui";
import { cn } from "@/lib/utils";

export interface PollParticipationFilterProps {
    query: string;
    onQueryChange: (value: string) => void;
    roleId: string;
    onRoleChange: (value: string) => void;
    roles: { id: string; name: string; color?: string | null }[];
    /** Éléments affichés / total, pour ne jamais laisser croire à une liste vide. */
    shown: number;
    total: number;
    className?: string;
}

/** Couleur de rôle Discord : `#000000` = « aucune couleur » ⇒ pastille neutre. */
function roleDotColor(color?: string | null): string {
    return !color || color === "#000000" ? "#9ca3af" : color;
}

export function PollParticipationFilter({
    query,
    onQueryChange,
    roleId,
    onRoleChange,
    roles,
    shown,
    total,
    className,
}: PollParticipationFilterProps) {
    const [roleOpen, setRoleOpen] = useState(false);
    /** Le menu vit dans un portail : `aria-controls` doit pointer son identifiant. */
    const menuId = useId();
    const filtered = query.trim().length > 0 || roleId.length > 0;
    const selectedRole = roles.find((role) => role.id === roleId);

    /** Choisir un rôle ferme le menu : ce filtre n'est pas une sélection multiple. */
    const pickRole = (nextRoleId: string) => {
        onRoleChange(nextRoleId);
        setRoleOpen(false);
    };

    return (
        <div className={cn("flex flex-col sm:flex-row sm:items-center gap-2", className)}>
            <div className="relative w-full sm:w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <input
                    type="search"
                    value={query}
                    onChange={(event) => onQueryChange(event.target.value)}
                    placeholder="Rechercher un membre…"
                    aria-label="Rechercher un membre"
                    className={cn(POLL_FILTER_CONTROL, "w-full pl-8")}
                />
            </div>

            {roles.length > 0 && (
                <Popover open={roleOpen} onOpenChange={setRoleOpen}>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            role="combobox"
                            aria-expanded={roleOpen}
                            aria-controls={menuId}
                            aria-label="Filtrer par rôle Discord"
                            className={cn(
                                POLL_FILTER_CONTROL,
                                "flex items-center justify-between gap-2 w-full sm:w-48 cursor-pointer"
                            )}
                        >
                            <span className="flex items-center gap-2 min-w-0">
                                {selectedRole ? (
                                    <span
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: roleDotColor(selectedRole.color) }}
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <Users className="w-3.5 h-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                                )}
                                <span className="truncate">{selectedRole?.name ?? "Tous les rôles"}</span>
                            </span>
                            <ChevronsUpDown className="w-3.5 h-3.5 opacity-50 shrink-0" aria-hidden="true" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent id={menuId} align="start" className={POLL_FILTER_MENU}>
                        <Command className="bg-transparent text-foreground">
                            <CommandInput
                                placeholder="Chercher un rôle…"
                                className="h-8 text-xs"
                                autoFocus
                            />
                            <CommandList className="max-h-64">
                                <CommandEmpty className="py-3 text-caption">Aucun rôle trouvé.</CommandEmpty>
                                <CommandGroup className="p-1">
                                    <CommandItem
                                        onSelect={() => pickRole("")}
                                        className="gap-2 px-2 py-1.5 rounded-md text-xs cursor-pointer data-[selected=true]:bg-surface data-[selected=true]:text-foreground"
                                    >
                                        <Users className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
                                        <span>Tous les rôles</span>
                                        {!roleId && <Check className="ml-auto w-3.5 h-3.5 text-info" aria-hidden="true" />}
                                    </CommandItem>
                                    {roles.map((role) => (
                                        <CommandItem
                                            key={role.id}
                                            onSelect={() => pickRole(role.id)}
                                            className="gap-2 px-2 py-1.5 rounded-md text-xs cursor-pointer data-[selected=true]:bg-surface data-[selected=true]:text-foreground"
                                        >
                                            <span
                                                className="w-2 h-2 rounded-full shrink-0"
                                                style={{ backgroundColor: roleDotColor(role.color) }}
                                                aria-hidden="true"
                                            />
                                            <span className="truncate min-w-0">{role.name}</span>
                                            {roleId === role.id && (
                                                <Check className="ml-auto w-3.5 h-3.5 text-info shrink-0" aria-hidden="true" />
                                            )}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            )}

            <div className="flex items-center gap-2 sm:ml-auto">
                <span className={POLL_SLOT_COUNTER}>
                    {filtered ? `${shown} / ${total}` : `${total} membre${total > 1 ? "s" : ""}`}
                </span>
                {filtered && (
                    <button
                        type="button"
                        onClick={() => {
                            onQueryChange("");
                            onRoleChange("");
                        }}
                        title="Réinitialiser le filtre"
                        aria-label="Réinitialiser le filtre"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        </div>
    );
}

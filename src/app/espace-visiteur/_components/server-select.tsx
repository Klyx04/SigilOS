"use client";

import { GameIcon } from "@/components/shared/game-icon";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ALL_DOFUS_SERVER_ENTRIES, DOFUS_UNITY_SERVERS } from "@/lib/presentation-constants";

const GROUPS = [
    { key: "epique", label: "Serveurs Épiques" },
    { key: "monocompte", label: "Serveurs Monocompte" },
    { key: "classique", label: "Serveurs Classiques" },
    { key: "pionnierMono", label: "Pionniers monocompte" },
    { key: "pionnier", label: "Pionniers" },
] as const;

/** Sélecteur de serveur — même référentiel que la présentation de guilde. */
export function ServerSelect({
    value,
    onChange,
    disabled,
}: {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}) {
    const selected = ALL_DOFUS_SERVER_ENTRIES.find((server) => String(server.id) === value);

    return (
        <Select value={value} onValueChange={onChange} disabled={disabled}>
            <SelectTrigger className="w-full" aria-label="Serveur Dofus">
                <span className="flex items-center gap-2">
                    {selected ? <GameIcon src={selected.icon} className="h-4 w-4" /> : null}
                    <SelectValue placeholder="Choisis ton serveur" />
                </span>
            </SelectTrigger>
            <SelectContent>
                {GROUPS.map((group) => (
                    <SelectGroup key={group.key}>
                        <SelectLabel>{group.label}</SelectLabel>
                        {DOFUS_UNITY_SERVERS[group.key].map((server) => (
                            <SelectItem key={server.id} value={String(server.id)}>
                                <span className="flex items-center gap-2">
                                    <GameIcon src={server.icon} className="h-4 w-4" />
                                    {server.name}
                                </span>
                            </SelectItem>
                        ))}
                    </SelectGroup>
                ))}
            </SelectContent>
        </Select>
    );
}

"use client";

import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { DOFUS_UNITY_SERVERS } from "@/lib/presentation-constants";

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
    return (
        <Select value={value} onValueChange={onChange} disabled={disabled}>
            <SelectTrigger className="w-full" aria-label="Serveur Dofus">
                <SelectValue placeholder="Choisis ton serveur" />
            </SelectTrigger>
            <SelectContent>
                {GROUPS.map((group) => (
                    <SelectGroup key={group.key}>
                        <SelectLabel>{group.label}</SelectLabel>
                        {DOFUS_UNITY_SERVERS[group.key].map((server) => (
                            <SelectItem key={server.id} value={String(server.id)}>
                                {server.name}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                ))}
            </SelectContent>
        </Select>
    );
}

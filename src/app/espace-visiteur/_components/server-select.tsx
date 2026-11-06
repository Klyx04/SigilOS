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
            {/*
             * ⚠️ `SelectValue` rejoue le contenu de l'item sélectionné : l'icône vit **une
             * seule fois**, dans l'item. Une icône ajoutée ici s'afficherait en double
             * (mesure du 06/11/2026, capture « Serveur + Classe »).
             */}
            <SelectTrigger className="w-full" aria-label="Serveur Dofus">
                <SelectValue placeholder="Choisis ton serveur" />
            </SelectTrigger>
            <SelectContent>
                {GROUPS.map((group) => (
                    <SelectGroup key={group.key}>
                        <SelectLabel>{group.label}</SelectLabel>
                        {DOFUS_UNITY_SERVERS[group.key].map((server) => (
                            <SelectItem key={server.id} value={String(server.id)}>
                                <span className="flex items-center gap-2">
                                    <GameIcon src={server.icon} className="size-6" />
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

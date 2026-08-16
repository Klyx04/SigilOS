"use client";

import { useState, useEffect } from "react";
import { Users } from "lucide-react";
import { countPingedMembers } from "@/server/actions/user-actions";

/**
 * Badge réutilisable "👥 ~X personnes seront pingées".
 *
 * Affiche le nombre TOTAL UNIQUE de membres Discord qui seront pingés pour la
 * sélection de rôles courante. Une personne portant plusieurs rôles sélectionnés
 * n'est comptée qu'une seule fois (déduplication serveur via countPingedMembers).
 *
 * L'appel au listing des membres est déclenché à chaque changement de sélection
 * (limitée par le cache Discord existant côté serveur).
 *
 * Props :
 * - guildId : la guilde Discord
 * - roleIds : les rôles sélectionnés (mentionRoleIds)
 * - className : style supplémentaire (optionnel)
 */
export function PingEstimate({
    guildId,
    roleIds,
    className = "",
}: {
    guildId: string;
    roleIds: string[];
    className?: string;
}) {
    const [count, setCount] = useState<number | null>(null);

    useEffect(() => {
        if (roleIds.length === 0) {
            setCount(null);
            return;
        }
        let cancelled = false;
        setCount(null); // reset pendant le rechargement
        countPingedMembers(guildId, roleIds).then((res) => {
            if (cancelled) return;
            setCount(res.success && res.data ? res.data.count : null);
        });
        return () => { cancelled = true; };
    }, [guildId, roleIds]);

    if (count === null || count === 0) return null;

    return (
        <div className={`flex items-center gap-1.5 text-caption font-bold text-indigo-300/90 ${className}`}>
            <Users className="w-3.5 h-3.5 text-indigo-400/80" />
            <span>👥 {count} personne{count > 1 ? "s" : ""} seront pingées</span>
        </div>
    );
}
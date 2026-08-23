"use client";

import Image from "next/image";
import { useState } from "react";

interface DofusIconProps {
    name: string;
    size?: number;
    color?: string;
    isObtained?: boolean;
    className?: string;
}

export function DofusIcon({ 
    name, 
    size = 64, 
    color = "#6366f1", 
    isObtained = false,
    className = "" 
}: DofusIconProps) {
    const [error, setError] = useState(false);

    // 🛠️ ULTIMATE ROBUST FILENAME RESOLUTION (#88 : `Dofus_Dofus_Emeraude.png` → 400
    // car `dofus.name` = « Dofus Émeraude » ; on retire le préfixe « Dofus » quand présent)
    const normalizeName = (str: string) => {
        const n = str.trim().replace(/^Dofus\s+/i, "");
        const lower = n.toLocaleLowerCase();

        // Specific alias mappings based on filesystem audit
        if (lower === "glaces" || lower === "des glaces") return "Des_Glaces";
        if (lower === "cauchemar" || lower === "du cauchemar") return "Du_Cauchemar";
        if (lower === "scintillant" || lower === "argente scintillant" || lower === "argenté scintillant") return "Argente_Scintillant";
        if (lower === "veilleurs" || lower === "veilleur" || lower === "des veilleurs") return "Veilleur";
        if (lower === "tacheté" || lower === "tachete") return "Tachete";
        if (lower === "dofoozbz") return "Dofoozbz";
        if (lower === "dom de pin" || lower === "dom_de_pin") return "Dom_De_Pin";

        // Strip ALL accents (e.g., Ébène -> Ebene, Émeraude -> Emeraude, Argenté -> Argente)
        const deaccented = n.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return deaccented.replace(/\s+/g, "_");
    };

    const norm = normalizeName(name);
    // Dokille and Dom_De_Pin don't have "Dofus_" prefix in public/module-dofus/
    const localSrc = norm === "Dokille" || norm === "Dom_De_Pin" 
        ? `/module-dofus/${norm}.png` 
        : `/module-dofus/Dofus_${norm}.png`;
    // Fallback local (le CDN static.dofusdb.fr renvoyait 500 via /_next/image)
    const fallbackSrc = "/assets/missions/fragment.png";

    if (error) {
        return (
            <Image
                src={fallbackSrc}
                alt={name}
                width={size}
                height={size}
                className={`object-contain ${className}`}
                style={{
                    filter: isObtained
                        ? `drop-shadow(0 0 12px ${color}99)`
                        : `drop-shadow(0 0 6px ${color}44)`,
                }}
            />
        );
    }

    return (
        <Image
            src={localSrc}
            alt={name}
            width={size}
            height={size}
            className={`object-contain ${className}`}
            onError={() => setError(true)}
            style={{
                filter: isObtained
                    ? `drop-shadow(0 0 12px ${color}99)`
                    : `drop-shadow(0 0 6px ${color}44)`,
            }}
        />
    );
}

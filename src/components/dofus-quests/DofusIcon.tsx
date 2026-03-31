"use client";

import Image from "next/image";
import { useState } from "react";
import { Gem } from "lucide-react";

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
    
    // 🛠️ ULTIMATE ROBUST FILENAME RESOLUTION
    const normalizeName = (str: string) => {
        const n = str.trim();
        
        // Specific alias mappings based on filesystem audit
        if (n === "Glaces") return "Des_Glaces";
        if (n === "Cauchemar") return "Du_Cauchemar";
        if (n === "Scintillant") return "Argente_Scintillant";
        
        if (n === "Argenté" || n === "Tacheté") return n;
        
        // Strip ALL accents for other Dofus (e.g., Ébène -> Ebene, Émeraude -> Emeraude)
        return n.normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "") // Remove combining diacritics
                .replace(/\s+/g, '_');          // Spaces to underscores
    };

    const localSrc = `/module-dofus/Dofus_${normalizeName(name)}.png`;
    const fallbackSrc = "https://api.dofusdb.fr/img/items/19000.png";

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

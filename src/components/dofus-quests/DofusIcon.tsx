"use client";

import Image from "next/image";
import { useState } from "react";
import { resolveDofusLocalImage } from "@/lib/dofus-image-url";

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

    // Résolution centralisée du nom → asset local (/module-dofus/*.png).
    // Couvre le préfixe « Dofus », les accents et les alias (#88 / #206).
    const localSrc = resolveDofusLocalImage(name) ?? "/assets/missions/fragment.png";
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

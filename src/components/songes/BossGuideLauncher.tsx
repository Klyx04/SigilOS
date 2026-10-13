"use client";

import { useState } from "react";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { BossGuide } from "@/components/songes/BossGuide";
import { SONGES_ACTION_GROUP_ITEM } from "@/lib/songes/ui";

/**
 * Item du groupe d'actions de l'en-tête (`SONGES_ACTION_GROUP`) : même hauteur, même padding
 * et même graisse que « Documentation » / « Tutoriel » — jamais un bouton étranger à côté.
 */
export function BossGuideLauncher() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                title="Ouvrir le guide des boss des Songes"
                className={cn(SONGES_ACTION_GROUP_ITEM, "shrink-0")}
            >
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                Guide Boss Songes
            </button>

            <BossGuide isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </>
    );
}

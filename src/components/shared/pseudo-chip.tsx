"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/lib/clipboard";
import { ClassIcon } from "./class-icon";

interface PseudoChipProps {
    pseudo: string;
    /** Classe Dofus du joueur (id ou nom : `feca` / `Féca`). Vide ⇒ pas d'icône. */
    classe?: string | null;
    className?: string;
    nameClassName?: string;
    iconSize?: number;
}

/**
 * Pseudo d'un joueur inscrit : icône de classe Dofus + copie unitaire de `/w pseudo`.
 *
 * Constat beta du 18/09/2026 : les rosters n'affichaient pas la classe (il fallait
 * ouvrir chaque profil) et la copie des pseudos passait par un bouton **global**
 * « Pseudos » qui collait toute la liste — inutile quand on veut chuchoter à UN
 * joueur, et source de mauvaise cible (on colle 8 lignes dans Discord). Ici : un
 * geste, un pseudo, à la même place dans tous les modules (DJ, Songes,
 * Calendrier/Raid).
 */
export function PseudoChip({ pseudo, classe, className, nameClassName, iconSize = 14 }: PseudoChipProps) {
    return (
        <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
            {classe && <ClassIcon classId={classe} size={iconSize} />}
            <span className={cn("truncate", nameClassName)}>{pseudo}</span>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(`/w ${pseudo}`).then((ok) =>
                        ok
                            ? toast.success(`/w ${pseudo} copié !`, { duration: 1600 })
                            : toast.error("Impossible de copier")
                    );
                }}
                className="shrink-0 rounded p-0.5 opacity-50 transition-opacity hover:bg-foreground/10 hover:opacity-100"
                title={`Copier /w ${pseudo}`}
                aria-label={`Copier la commande /w ${pseudo}`}
            >
                <Copy className="h-3 w-3" />
            </button>
        </span>
    );
}

/**
 * Glossaire des statuts God — **source unique** des libellés et des infobulles.
 *
 * 🎯 G1 du plan `docs/plans/PLAN-REFONTE-GOD-GUILDES.md` : « c'est quoi autonome /
 * pré-approuvé / à surveiller / gelée-off » n'était expliqué nulle part dans
 * l'écran. Pire, « À surveiller » ressemblait à une sanction alors que c'est un
 * **radar** (≤ 3 profils). Les définitions de ce fichier sont celles du §2 du
 * plan, mot pour mot : elles vivent **dans l'UI** (légende dépliable + `title`
 * sur chaque badge), jamais dans un document séparé.
 *
 * Règle pure : aucun import Prisma, React ou Next — testable en unitaire et
 * importable par la console God comme par la fiche guilde.
 */

export type GodStatusId =
    | "AUTONOME"
    | "PRE_APPROUVEE"
    | "TICKET"
    | "PEU_DE_MEMBRES"
    | "GELEE"
    | "SUPPRIMEE";

export interface GodStatusEntry {
    id: GodStatusId;
    /** Libellé court affiché sur un badge ou une carte-filtre. */
    label: string;
    /** Définition complète : infobulle de badge **et** légende dépliable. */
    description: string;
}

const ENTRIES: Record<GodStatusId, GodStatusEntry> = {
    AUTONOME: {
        id: "AUTONOME",
        label: "Autonome",
        description:
            "Installation sans validation humaine : le bot a été invité ou la guilde s'est déployée en 1 clic. Modération a posteriori.",
    },
    PRE_APPROUVEE: {
        id: "PRE_APPROUVEE",
        label: "Pré-approuvée (staff)",
        description:
            "Le staff a whitelisté la guilde avant son déploiement : approbation humaine, tier BETA.",
    },
    TICKET: {
        id: "TICKET",
        label: "Ticket",
        description:
            "Guilde validée via un ticket de support : accompagnement humain, tier VIP.",
    },
    PEU_DE_MEMBRES: {
        id: "PEU_DE_MEMBRES",
        label: "Peu de membres — à vérifier",
        description:
            "Guilde active mais 3 profils ou moins : installation neuve ou abandonnée. Ce n'est pas une sanction, c'est un radar.",
    },
    GELEE: {
        id: "GELEE",
        label: "Gelée / Off",
        description:
            "Accès coupé : la guilde n'est plus proposée et ses membres sont bloqués.",
    },
    SUPPRIMEE: {
        id: "SUPPRIMEE",
        label: "Supprimée (soft-delete)",
        description:
            "La donnée reste en base, marquée supprimée jusqu'à la purge. Ce n'est pas une suppression immédiate.",
    },
};

/** Ordre d'affichage de la légende : origine, puis activité, puis accès. */
export const GOD_STATUS_GLOSSARY: readonly GodStatusEntry[] = [
    ENTRIES.AUTONOME,
    ENTRIES.PRE_APPROUVEE,
    ENTRIES.TICKET,
    ENTRIES.PEU_DE_MEMBRES,
    ENTRIES.GELEE,
    ENTRIES.SUPPRIMEE,
];

/** Entrée du glossaire — jamais `undefined` : l'identifiant est typé. */
export function godStatusEntry(id: GodStatusId): GodStatusEntry {
    return ENTRIES[id];
}

/** Libellé court (badge, carte-filtre). */
export function godStatusLabel(id: GodStatusId): string {
    return ENTRIES[id].label;
}

/**
 * Infobulle d'un badge : le libellé **et** la définition, dans une seule phrase.
 * Réutiliser cette fonction garantit qu'un badge ne peut pas raconter autre
 * chose que la légende.
 */
export function godStatusTitle(id: GodStatusId): string {
    const entry = ENTRIES[id];
    return `${entry.label} — ${entry.description}`;
}

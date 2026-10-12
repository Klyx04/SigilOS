/**
 * Référentiel Dofus du Rush Sylvestre — SOURCE UNIQUE.
 *
 * Pourquoi ce module : la même liste de Dofus existait en **cinq** copies divergentes
 * (mesuré le 08/10/2026) — `DOFUS_LIST` dans le studio God et `DOFUS_DEFS` dans
 * `RushTimelineClient`, `DofusProgressStrip`, `GuildStatusPanel` et
 * `GuideOverlayClient`. Elles ne disaient pas la même chose : `argente` valait
 * `#a1a1aa` ici et `#a8c0d6` là, `pourpre` `#a855f7` ou `#ef4444`, `ebene`
 * `#27272a`, `#52525b` ou `#6366f1`, `sylvestre` `#d4a017` ou `#39bc95`. Une
 * couleur corrigée à un endroit ne l'était donc nulle part ailleurs.
 *
 * ⚠️ `color` est la couleur **CANONIQUE** (identité du Dofus), jamais la moyenne
 * de son visuel : mesuré au `sharp` le 08/10/2026 sur les 26 `Dofus_*.png`, ces
 * icônes sont **orfévrées** — leur tracé moyen lit « or » (Pourpre = 230,146,43 ;
 * Argenté = 205,190,153 ; Ébène = 100,75,51). La moyenne sert à repérer un écart
 * (Ivoire « blanc » qui lit crème), pas à définir une couleur.
 *
 * Toutes les images sont servies **en local** (`public/`) : aucune dépendance
 * DofusDB à l'exécution (chantier U).
 */

export type RushDofusMeta = {
    id: string;
    label: string;
    /** Couleur canonique (hex). Voir l'en-tête : jamais une moyenne de visuel. */
    color: string;
    /** Chemin **interne** du visuel (`/module-dofus/…` ou `/assets/icons/…`). */
    imageUrl: string;
};

export const RUSH_DOFUS_META: RushDofusMeta[] = [
    { id: "ocre", label: "Ocre", color: "#f59e0b", imageUrl: "/assets/icons/ocre.png" },
    { id: "turquoise", label: "Turquoise", color: "#06b6d4", imageUrl: "/module-dofus/Dofus_Turquoise.png" },
    { id: "argente", label: "Argenté", color: "#a1a1aa", imageUrl: "/module-dofus/Dofus_Argente.png" },
    { id: "argente_scintillant", label: "Arg. Scintillant", color: "#c0c0c0", imageUrl: "/module-dofus/Dofus_Argente_Scintillant.png" },
    // Ébène : la valeur historique du studio God était `#27272a` (quasi noir), celle
    // des trois autres copies `#52525b`. On garde `#52525b` : une puce quasi noire
    // disparaît sur le thème sombre.
    { id: "ebene", label: "Ébène", color: "#52525b", imageUrl: "/module-dofus/Dofus_Ebene.png" },
    { id: "pourpre", label: "Pourpre", color: "#a855f7", imageUrl: "/module-dofus/Dofus_Pourpre.png" },
    { id: "ivoire", label: "Ivoire", color: "#e2e8f0", imageUrl: "/module-dofus/Dofus_Ivoire.png" },
    { id: "emeraude", label: "Émeraude", color: "#10b981", imageUrl: "/module-dofus/Dofus_Emeraude.png" },
    { id: "dolmanax", label: "Dolmanax", color: "#ef4444", imageUrl: "/module-dofus/Dofus_Dolmanax.png" },
    { id: "des_glaces", label: "Des Glaces", color: "#93c5fd", imageUrl: "/module-dofus/Dofus_Des_Glaces.png" },
    { id: "du_cauchemar", label: "Du Cauchemar", color: "#7c3aed", imageUrl: "/module-dofus/Dofus_Du_Cauchemar.png" },
    // Alias historique de l'overlay (`cauchemar`), qui lisait les deux clés.
    { id: "cauchemar", label: "Du Cauchemar", color: "#7c3aed", imageUrl: "/module-dofus/Dofus_Du_Cauchemar.png" },
    { id: "des_veilleurs", label: "Des Veilleurs", color: "#38bdf8", imageUrl: "/module-dofus/Dofus_Veilleur.png" },
    { id: "domakuro", label: "Domakuro", color: "#84cc16", imageUrl: "/module-dofus/Dofus_Domakuro.png" },
    { id: "dorigami", label: "Dorigami", color: "#f472b6", imageUrl: "/module-dofus/Dofus_Dorigami.png" },
    { id: "tachete", label: "Tacheté", color: "#c084fc", imageUrl: "/module-dofus/Dofus_Tachete.png" },
    { id: "dom_de_pin", label: "Dom de Pin", color: "#a3e635", imageUrl: "/module-dofus/Dom_De_Pin.png" },
    // Le Dofus du rush lui-même : présent dans le rail de progression
    // (`DofusProgressStrip`) et dans les œufs de l'overlay, absent du studio God.
    // Couleur : **mesurée** (tracé dominant du visuel, 112,144,48 — feuille verte) —
    // c'est le seul cas sans référence canonique ailleurs dans le dépôt.
    { id: "sylvestre", label: "Sylvestre", color: "#709030", imageUrl: "/module-dofus/Dofus_Sylvestre.png" },
    // Dofus présents dans les « œufs » de l'overlay (visuels locaux vérifiés).
    { id: "cawotte", label: "Cawotte", color: "#f59e0b", imageUrl: "/module-dofus/Dofus_Cawotte.png" },
    { id: "dokoko", label: "Dokoko", color: "#a3e635", imageUrl: "/module-dofus/Dofus_Dokoko.png" },
    { id: "vulbis", label: "Vulbis", color: "#f97316", imageUrl: "/module-dofus/Dofus_Vulbis.png" },
    { id: "abyssal", label: "Abyssal", color: "#3b82f6", imageUrl: "/module-dofus/Dofus_Abyssal.png" },
];

/** Fiches par identifiant (`dofusId`, tag `dofus_link`, `milestone.dofusId`). */
export function dofusMetaIndex(): Record<string, RushDofusMeta> {
    return RUSH_DOFUS_META.reduce<Record<string, RushDofusMeta>>((acc, d) => {
        acc[d.id] = d;
        return acc;
    }, {});
}

/** Fiche d'un Dofus par son identifiant (insensible à la casse) ; `null` sinon. */
export function getDofusMeta(id: string | null | undefined): RushDofusMeta | null {
    if (!id) return null;
    const key = id.trim().toLowerCase();
    return RUSH_DOFUS_META.find((d) => d.id === key) ?? null;
}

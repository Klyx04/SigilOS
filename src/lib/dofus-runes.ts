/**
 * Référentiel des runes de forgemagie de Dofus (assets locaux réels).
 * 
 * ⚠️ Fichier PUR (aucun fetch / aucun IO) : utilisable côté client et côté serveur.
 * Source des assets : `public/images/guides/fm/rune_*.png` (50 icônes authentiques du jeu).
 */

export interface RuneInfo {
    /** Chemin absolu local vers l'image de la rune (`/images/guides/fm/rune_...png`). */
    assetUrl: string;
    /** Nom officiel de la rune (ex. « Rune Ga Pa », « Rune Do Crit »). */
    runeName: string;
    /** Catégorie (« exo » pour PA/PM/PO/Invo hors jet, « over » pour les stats dépassées). */
    isExo: boolean;
    /** Couleur du badge sémantique associé. */
    badgeColor: "exo" | "over" | "neutral";
}

/**
 * Normalise une chaîne de stat pour faire correspondre le bon asset de rune.
 */
function normalizeStat(stat: string): string {
    return String(stat || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

/**
 * Associe une ligne de forgemagie (stat + valeur) à la vraie Rune Dofus et son asset PNG local.
 */
export function getRuneForStat(stat: string, value: number = 0): RuneInfo {
    const s = normalizeStat(stat);

    // 1. Exos majeurs (PA, PM, PO)
    if (s === "pa" || s.includes("point d'action")) {
        return {
            assetUrl: "/images/guides/fm/rune_ga_pa.png",
            runeName: "Rune Ga Pa",
            isExo: true,
            badgeColor: "exo",
        };
    }
    if (s === "pm" || s.includes("point de mouvement")) {
        return {
            assetUrl: "/images/guides/fm/rune_ga_pme.png",
            runeName: "Rune Ga Pme",
            isExo: true,
            badgeColor: "exo",
        };
    }
    if (s === "po" || s.includes("portee")) {
        return {
            assetUrl: "/images/guides/fm/rune_po.png",
            runeName: "Rune Po",
            isExo: true,
            badgeColor: "exo",
        };
    }

    // 2. Pourcentages de dommages (% Do Sorts, % Do Dist, % Do Mêlée, % Do Armes)
    if (s.includes("%") && (s.includes("sort") || s.includes("dist") || s.includes("melee") || s.includes("arme"))) {
        let name = "Rune Do %";
        if (s.includes("sort")) name = "Rune Do Sort";
        else if (s.includes("dist")) name = "Rune Do Dist";
        else if (s.includes("melee")) name = "Rune Do Mel";
        else if (s.includes("arme")) name = "Rune Do Arme";

        return {
            assetUrl: "/images/guides/fm/rune_do_per.png",
            runeName: name,
            isExo: true,
            badgeColor: "exo",
        };
    }

    // 3. Dommages Critiques / Coup Critique
    if (s.includes("do crit") || s.includes("dommage crit")) {
        return {
            assetUrl: "/images/guides/fm/rune_do_cri_pou.png",
            runeName: value > 5 ? "Rune Pa Do Crit" : "Rune Do Crit",
            isExo: false,
            badgeColor: "over",
        };
    }
    if (s.includes("crit") || s === "cc") {
        return {
            assetUrl: "/images/guides/fm/rune_cri.png",
            runeName: "Rune Cri",
            isExo: false,
            badgeColor: "over",
        };
    }

    // 4. Dommages de poussée / Ré Poussée / Ré Critique
    if (s.includes("do pou") || s.includes("poussee")) {
        return {
            assetUrl: "/images/guides/fm/rune_do_cri_pou.png",
            runeName: "Rune Do Pou",
            isExo: false,
            badgeColor: "over",
        };
    }
    if (s.includes("re pou") || s.includes("re poussee")) {
        return {
            assetUrl: "/images/guides/fm/rune_re_cri_pou.png",
            runeName: "Rune Ré Pou",
            isExo: false,
            badgeColor: "over",
        };
    }
    if (s.includes("re crit") || s.includes("re critique")) {
        return {
            assetUrl: "/images/guides/fm/rune_re_cri_pou.png",
            runeName: "Rune Ré Crit",
            isExo: false,
            badgeColor: "over",
        };
    }

    // 5. Invocations
    if (s.includes("invo")) {
        return {
            assetUrl: "/images/guides/fm/rune_invo.png",
            runeName: "Rune Invo",
            isExo: true,
            badgeColor: "exo",
        };
    }

    // 6. Caractéristiques primaires
    if (s.includes("vita") || s === "vi" || s.includes("vitalite")) {
        const url = value >= 100 ? "/images/guides/fm/rune_ra_vi.png" : value >= 30 ? "/images/guides/fm/rune_pa_vi.png" : "/images/guides/fm/rune_vi.png";
        const name = value >= 100 ? "Rune Ra Vi" : value >= 30 ? "Rune Pa Vi" : "Rune Vi";
        return { assetUrl: url, runeName: name, isExo: false, badgeColor: "over" };
    }
    if (s.includes("force") || s === "fo") {
        const url = value >= 30 ? "/images/guides/fm/rune_ra_fo.png" : value >= 10 ? "/images/guides/fm/rune_pa_fo.png" : "/images/guides/fm/rune_fo.png";
        const name = value >= 30 ? "Rune Ra Fo" : value >= 10 ? "Rune Pa Fo" : "Rune Fo";
        return { assetUrl: url, runeName: name, isExo: false, badgeColor: "over" };
    }
    if (s.includes("intel") || s.includes("ine")) {
        const url = value >= 30 ? "/images/guides/fm/rune_ra_ine.png" : value >= 10 ? "/images/guides/fm/rune_pa_ine.png" : "/images/guides/fm/rune_ine.png";
        const name = value >= 30 ? "Rune Ra Ine" : value >= 10 ? "Rune Pa Ine" : "Rune Ine";
        return { assetUrl: url, runeName: name, isExo: false, badgeColor: "over" };
    }
    if (s.includes("chance") || s.includes("cha") || s.includes("eau")) {
        const url = value >= 30 ? "/images/guides/fm/rune_ra_cha.png" : value >= 10 ? "/images/guides/fm/rune_pa_cha.png" : "/images/guides/fm/rune_cha.png";
        const name = value >= 30 ? "Rune Ra Cha" : value >= 10 ? "Rune Pa Cha" : "Rune Cha";
        return { assetUrl: url, runeName: name, isExo: false, badgeColor: "over" };
    }
    if (s.includes("agi") || s.includes("age") || s.includes("air")) {
        const url = value >= 30 ? "/images/guides/fm/rune_ra_age.png" : value >= 10 ? "/images/guides/fm/rune_pa_age.png" : "/images/guides/fm/rune_age.png";
        const name = value >= 30 ? "Rune Ra Age" : value >= 10 ? "Rune Pa Age" : "Rune Age";
        return { assetUrl: url, runeName: name, isExo: false, badgeColor: "over" };
    }
    if (s.includes("sagesse") || s === "sa") {
        const url = value >= 20 ? "/images/guides/fm/rune_ra_sa.png" : value >= 7 ? "/images/guides/fm/rune_pa_sa.png" : "/images/guides/fm/rune_sa.png";
        const name = value >= 20 ? "Rune Ra Sa" : value >= 7 ? "Rune Pa Sa" : "Rune Sa";
        return { assetUrl: url, runeName: name, isExo: false, badgeColor: "over" };
    }
    if (s.includes("puiss") || s.includes("pui")) {
        const url = value >= 15 ? "/images/guides/fm/rune_pa_pui.png" : "/images/guides/fm/rune_pui.png";
        const name = value >= 15 ? "Rune Pa Pui" : "Rune Pui";
        return { assetUrl: url, runeName: name, isExo: false, badgeColor: "over" };
    }

    // 7. Retraits / Esquives
    if (s.includes("ret") && s.includes("pa")) {
        return {
            assetUrl: value >= 3 ? "/images/guides/fm/rune_pa_ret_pa.png" : "/images/guides/fm/rune_ret_pa.png",
            runeName: value >= 3 ? "Rune Pa Ret Pa" : "Rune Ret Pa",
            isExo: false,
            badgeColor: "over",
        };
    }
    if (s.includes("ret") && s.includes("pm")) {
        return {
            assetUrl: "/images/guides/fm/rune_ret_pm.png",
            runeName: "Rune Ret PM",
            isExo: false,
            badgeColor: "over",
        };
    }
    if (s.includes("esq") && s.includes("pa")) {
        return {
            assetUrl: value >= 3 ? "/images/guides/fm/rune_pa_esq_pa.png" : "/images/guides/fm/rune_esq_pa.png",
            runeName: value >= 3 ? "Rune Pa Esq Pa" : "Rune Esq Pa",
            isExo: false,
            badgeColor: "over",
        };
    }
    if (s.includes("esq") && s.includes("pm")) {
        return {
            assetUrl: "/images/guides/fm/rune_esq_pm.png",
            runeName: "Rune Esq PM",
            isExo: false,
            badgeColor: "over",
        };
    }

    // 8. Fuite & Tacle
    if (s.includes("fuite") || s.includes("tacle")) {
        return {
            assetUrl: "/images/guides/fm/rune_fui_tac.png",
            runeName: s.includes("fuite") ? "Rune Fui" : "Rune Tac",
            isExo: false,
            badgeColor: "over",
        };
    }

    // 9. Soins
    if (s.includes("soin")) {
        return {
            assetUrl: value >= 5 ? "/images/guides/fm/rune_pa_soin.png" : "/images/guides/fm/rune_soin.png",
            runeName: value >= 5 ? "Rune Pa So" : "Rune So",
            isExo: false,
            badgeColor: "over",
        };
    }

    // 10. Résistances % et fixes
    if (s.includes("%") && s.includes("re")) {
        return {
            assetUrl: "/images/guides/fm/rune_prc_re.png",
            runeName: "Rune % Ré",
            isExo: true,
            badgeColor: "exo",
        };
    }
    if (s.includes("re")) {
        return {
            assetUrl: "/images/guides/fm/rune_re.png",
            runeName: "Rune Ré",
            isExo: false,
            badgeColor: "over",
        };
    }

    // 11. Dommages élémentaires / fixes
    if (s.includes("do ") || s.includes("dommage")) {
        return {
            assetUrl: "/images/guides/fm/rune_do_elements.png",
            runeName: "Rune Do",
            isExo: false,
            badgeColor: "over",
        };
    }

    // 12. Autres stats (Pods, Initiative, Prospection)
    if (s.includes("pod")) {
        return { assetUrl: "/images/guides/fm/rune_pod.png", runeName: "Rune Pod", isExo: false, badgeColor: "over" };
    }
    if (s.includes("ini")) {
        return { assetUrl: "/images/guides/fm/rune_ini.png", runeName: "Rune Ini", isExo: false, badgeColor: "over" };
    }
    if (s.includes("prosp") || s === "pp") {
        return { assetUrl: "/images/guides/fm/rune_prospe.png", runeName: "Rune Prospe", isExo: false, badgeColor: "over" };
    }
    if (s.includes("chasse")) {
        return { assetUrl: "/images/guides/fm/rune_chasse.png", runeName: "Rune Chasse", isExo: true, badgeColor: "exo" };
    }

    // Repli : rune générique officielle
    return {
        assetUrl: "/assets/dofus/game-icons/rune.png",
        runeName: "Rune FM",
        isExo: false,
        badgeColor: "neutral",
    };
}

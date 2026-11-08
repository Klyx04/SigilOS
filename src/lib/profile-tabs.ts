/**
 * Onglets du profil dashboard — **huit groupes** pour les sections de l'écran (lot P3 de
 * `docs/plans/PLAN-REFONTE-PROFIL-DASHBOARD.md`).
 *
 * Pourquoi une règle pure : les clés d'origine vivent à trois endroits qui cassent ensemble si la
 * fusion les oublie —
 *   ① des liens entrants (`?tab=artisanat`), lus par `page.tsx` ;
 *   ② le tutoriel (`[data-tour="profile-tab-personnages"]` dans `tour-provider.tsx`) ;
 *   ③ `SuccessSync`, qui appelle `onTabChange('overview')`.
 * `resolveProfileTab` accepte donc **une clé de groupe ou une ancienne clé** et ne renvoie jamais
 * autre chose qu'un groupe existant : un lien périmé atterrit sur « Synthèse », jamais sur un
 * onglet inexistant (contenu affiché sans onglet actif).
 */

export const PROFILE_TABS = [
    { id: "synthese", label: "Synthèse", members: ["overview", "achievements"] },
    { id: "presentation", label: "Présentation", members: ["intro"] },
    { id: "equipement", label: "Équipement", members: ["combat"] },
    { id: "skins", label: "Skins", members: ["skins"] },
    { id: "dofusdex", label: "Dofusdex", members: ["dofus"] },
    { id: "personnages", label: "Mules et métiers", members: ["mules", "metiers", "artisanat"] },
    { id: "planning", label: "Planning & services", members: ["planning", "services"] },
    { id: "reglages", label: "Réglages", members: ["settings"] },
] as const;

/**
 * Sections **retirées** de l'écran (P3-bis) dont l'ancienne clé doit continuer de répondre :
 * `?tab=activity` (le panneau « Activité & Présence » a été remplacé par « Points de Succès »
 * dans Synthèse) atterrit donc sur Synthèse au lieu d'un onglet inexistant.
 */
export const RETIRED_SECTIONS: Readonly<Record<string, ProfileTabId>> = { activity: "synthese" };

export type ProfileTabDef = (typeof PROFILE_TABS)[number];
export type ProfileTabId = ProfileTabDef["id"];
/** Une des treize clés d'origine (« sections »), dont chacune appartient à un groupe. */
export type ProfileSection = ProfileTabDef["members"][number];

export const DEFAULT_PROFILE_TAB: ProfileTabId = "synthese";

/** Vrai si la valeur est déjà une clé de groupe. */
export function isProfileTabId(value: string | null | undefined): value is ProfileTabId {
    return !!value && PROFILE_TABS.some((tab) => tab.id === value);
}

/** Groupe qui porte une section ; `null` si la clé est inconnue (jamais une supposition). */
export function profileGroupOf(section: string): ProfileTabId | null {
    const found = PROFILE_TABS.find((tab) => (tab.members as readonly string[]).includes(section));
    return found ? found.id : null;
}

/**
 * Résout une valeur d'onglet venue de l'URL, d'un ancien lien ou du tutoriel.
 * Groupe → lui-même · ancienne clé → son groupe · inconnu/absent → « Synthèse ».
 */
export function resolveProfileTab(raw: string | null | undefined): ProfileTabId {
    if (isProfileTabId(raw)) return raw;
    if (raw) {
        const group = profileGroupOf(raw) ?? RETIRED_SECTIONS[raw];
        if (group) return group;
    }
    return DEFAULT_PROFILE_TAB;
}

/**
 * Un groupe n'a de sens que s'il porte **au moins une section non vide**.
 * `isEmpty` ne décrit que les sections qui peuvent disparaître ; une section absente de la table
 * est considérée comme pleine (on ne cache pas un onglet par omission).
 */
export function isProfileGroupEmpty(
    group: ProfileTabId,
    isEmpty: Readonly<Record<string, boolean>>
): boolean {
    const def = PROFILE_TABS.find((tab) => tab.id === group);
    if (!def) return true;
    return def.members.every((section) => isEmpty[section] === true);
}

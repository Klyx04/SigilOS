/**
 * Hub « Communauté SigilOS » (`/visiteurs`) — **règles pures** (aucune I/O).
 *
 * Le hub rassemble deux lectures dans **une seule page** : les profils consentants du
 * serveur (V2e) et les succès en commun (F16 / D-V9). Ce module ne connaît ni session ni
 * base : il borne les paramètres d'URL, fabrique les liens et construit le tableau des
 * succès partagés. C'est lui que le verrou `tests/unit/visitors-hub.test.ts` protège.
 *
 * Invariants :
 *  · **deux vues** seulement (`profils`, `succes`) — une valeur inconnue retombe sur les
 *    profils, jamais une page blanche ;
 *  · **aucun champ privé** dans un membre (`id`, pseudo, classe) : pas de mules, pas de
 *    Metamob, pas de `userId` ;
 *  · le **serveur n'est pas un paramètre** : il vient du profil du lecteur, résolu côté
 *    serveur (D-V4) ;
 *  · un profil qui sort du périmètre entre deux lectures (consentement retiré) est
 *    **écarté**, jamais inventé.
 */

import { z } from "zod";

/** Les deux vues du hub. La vue « échanges » arrive avec le chantier Metamob. */
export const VISITORS_HUB_VIEWS = ["profils", "succes"] as const;
export type VisitorsHubView = (typeof VISITORS_HUB_VIEWS)[number];

/**
 * Bornes des succès en commun.
 *
 * `SHARED_SUCCES_TAKE` borne les lignes lues (succès + coches) ; `SHARED_SUCCES_VISITORS_TAKE`
 * borne les **profils** affichés dans les deux colonnes. Une page ne doit jamais charger
 * tout un serveur : au-delà, l'écran le dit (« N profils affichés au maximum »).
 */
export const SHARED_SUCCES_TAKE = 500;
export const SHARED_SUCCES_VISITORS_TAKE = 200;

/** Longueur maximale d'une recherche de donjon (nom ou boss). */
export const SHARED_SUCCES_SEARCH_MAX = 40;

/** Longueur maximale d'une clé de donjon (slug ou cuid). */
export const SHARED_SUCCES_KEY_MAX = 80;

/**
 * Membres affichés par colonne et par succès. Au-delà, l'écran dit « + N autres » :
 * une liste de 200 pseudos par succès rendrait la page illisible et coûteuse.
 */
export const SHARED_SUCCES_MEMBERS_SHOWN = 12;

export type VisitorsHubSearch = {
    vue: VisitorsHubView;
    /** Donjon sélectionné (slug ou id) — seulement dans la vue « succes ». */
    donjon: string | null;
    /** Recherche de donjon — seulement dans la vue « succes » (la vue profils a son propre `q`). */
    q: string;
};

const RAW_SEARCH_MAX = SHARED_SUCCES_SEARCH_MAX * 10;
const rawSearchSchema = z.string().max(RAW_SEARCH_MAX);
const rawKeySchema = z.string().max(SHARED_SUCCES_KEY_MAX);

/** Un slug ou un cuid de donjon plausible, borné — refuse tout le reste avant la requête. */
export function isSharedSuccesDungeonKey(value: unknown): value is string {
    return typeof value === "string" && /^[a-z0-9-]{1,80}$/i.test(value);
}

/**
 * Lit les paramètres du hub. **Fail-soft** : un `vue` inconnu retombe sur les profils, un
 * donjon invalide est ignoré. Une lecture ne doit jamais casser un deep-link.
 *
 * `q` n'est interprété que dans la vue « succes » : dans la vue profils, c'est le filtre
 * de l'annuaire (`parseVisitorDirectoryFilters`) qui le lit, avec ses propres bornes.
 */
export function parseVisitorsHubSearch(
    raw: Record<string, string | string[] | undefined> | undefined
): VisitorsHubSearch {
    const first = (value: string | string[] | undefined) =>
        Array.isArray(value) ? value[0] : value;

    const rawVue = first(raw?.vue);
    const vue: VisitorsHubView = VISITORS_HUB_VIEWS.includes(rawVue as VisitorsHubView)
        ? (rawVue as VisitorsHubView)
        : "profils";

    const rawDonjon = first(raw?.donjon);
    const donjonParsed = rawKeySchema.safeParse(
        typeof rawDonjon === "string" ? rawDonjon.trim() : rawDonjon
    );
    const donjon =
        donjonParsed.success && isSharedSuccesDungeonKey(donjonParsed.data)
            ? donjonParsed.data
            : null;

    const rawQ = first(raw?.q);
    const qParsed = rawSearchSchema.safeParse(
        typeof rawQ === "string" ? rawQ.slice(0, RAW_SEARCH_MAX) : rawQ
    );
    const q = qParsed.success ? qParsed.data.trim().slice(0, SHARED_SUCCES_SEARCH_MAX) : "";

    if (vue !== "succes") return { vue, donjon: null, q: "" };
    return { vue, donjon, q };
}

/**
 * Lien du hub. La vue profils est l'URL **par défaut** (`/visiteurs`) : pas de
 * `?vue=profils` dans la barre d'adresse. Changer de vue **efface** la recherche de
 * l'autre vue, sinon un `q` de donjon filtrerait les joueurs (et inversement).
 */
export function buildVisitorsHubHref(input: {
    vue: VisitorsHubView;
    donjon?: string | null;
    q?: string | null;
}): string {
    const params = new URLSearchParams();
    if (input.vue === "succes") {
        params.set("vue", "succes");
        if (input.donjon) params.set("donjon", input.donjon);
        if (input.q) params.set("q", input.q);
    }
    const query = params.toString();
    return query ? `/visiteurs?${query}` : "/visiteurs";
}

/** Membre affiché dans une colonne de succès — **liste blanche** de trois champs publics. */
export type SharedSuccesMember = {
    /** `PublicProfile.id` — public dans l'annuaire, sert au lien vers la fiche. */
    id: string;
    pseudo: string | null;
    /** Id de classe (`iop`, `feca`) : l'icône se résout par `getClass`. */
    classe: string | null;
};

export type SharedSuccesAchievement = {
    id: string;
    name: string;
    slug: string | null;
    points: number;
    iconUrl: string | null;
    description: string | null;
};

export type SharedSuccesRow = {
    achievement: SharedSuccesAchievement;
    done: SharedSuccesMember[];
    missing: SharedSuccesMember[];
};

export type SharedSuccesBoard = {
    rows: SharedSuccesRow[];
    /** Nombre de profils réellement inclus dans les colonnes (après borne). */
    visitorCount: number;
    /** Vrai si le serveur compte plus de profils que la borne : l'écran doit le dire. */
    capped: boolean;
};

/** Ordre d'affichage stable : pseudo (insensible à la casse), pseudos vides en dernier. */
function compareMembers(a: SharedSuccesMember, b: SharedSuccesMember): number {
    const aPseudo = (a.pseudo ?? "").trim();
    const bPseudo = (b.pseudo ?? "").trim();
    if (!aPseudo && bPseudo) return 1;
    if (aPseudo && !bPseudo) return -1;
    const byPseudo = aPseudo.localeCompare(bPseudo, "fr", { sensitivity: "base" });
    return byPseudo !== 0 ? byPseudo : a.id.localeCompare(b.id);
}

/**
 * Construit le tableau « qui a validé quoi » à partir de trois lectures **déjà filtrées**
 * par le serveur (même serveur, `showOnDirectory: true`).
 *
 * Pourquoi ne garder que les profils présents dans `visitors` : les coches et les profils
 * sont lus en deux requêtes. Si un visiteur retire son consentement entre les deux, sa
 * coche ne doit pas apparaître dans « Déjà validé » alors qu'il n'est plus dans
 * « Cherchent encore » — il serait à la fois visible et invisible. On l'écarte des deux.
 *
 * `visitorCap` est une **borne de sécurité** : la requête serveur demande `cap + 1` pour
 * savoir s'il y a plus de profils que la borne, puis on n'en rend que `cap`.
 */
export function buildSharedSuccesBoard(input: {
    achievements: ReadonlyArray<SharedSuccesAchievement>;
    doneRows: ReadonlyArray<{ achievementId: string; member: SharedSuccesMember }>;
    visitors: ReadonlyArray<SharedSuccesMember>;
    visitorCap?: number;
}): SharedSuccesBoard {
    const cap = Math.max(1, input.visitorCap ?? SHARED_SUCCES_VISITORS_TAKE);
    const capped = input.visitors.length > cap;
    const visitors = [...(capped ? input.visitors.slice(0, cap) : input.visitors)].sort(
        compareMembers
    );

    const byId = new Map(visitors.map((member) => [member.id, member]));
    const doneByAchievement = new Map<string, SharedSuccesMember[]>();

    for (const row of input.doneRows) {
        const member = byId.get(row.member.id);
        if (!member) continue;
        const list = doneByAchievement.get(row.achievementId) ?? [];
        if (!list.some((entry) => entry.id === member.id)) list.push(member);
        doneByAchievement.set(row.achievementId, list);
    }

    const rows = input.achievements.map((achievement) => {
        const done = (doneByAchievement.get(achievement.id) ?? []).sort(compareMembers);
        const doneIds = new Set(done.map((member) => member.id));
        return {
            achievement,
            done,
            missing: visitors.filter((member) => !doneIds.has(member.id)),
        };
    });

    return { rows, visitorCount: visitors.length, capped };
}

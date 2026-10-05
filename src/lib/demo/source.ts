/**
 * Démo publique — **source de démonstration** (lot S-1 du chantier `S`).
 *
 * Décision mesurée du 02/10/2026 (`docs/plans/PLAN-DEMO-PUBLIQUE.md` §3) : la démo s'appuie sur une
 * **source statique et typée**, jamais sur une guilde en base. Motifs :
 *  - zéro migration ;
 *  - **risque cron/worker nul** : une guilde absente de `GuildConfig` ne peut être ni synchronisée
 *    (`sync-members`), ni notifiée, ni purgée (`account-retention`, `guild-orphan-watch`) ;
 *  - zéro donnée personnelle (le dépôt est public) : tout est inventé, relu en PR ;
 *  - la page reste rendue **sans base**, donc prérendable.
 *
 * ⚠️ Règles non négociables (gardées par `tests/unit/demo-publique.test.ts`) :
 *  1. **aucun** identifiant Discord (snowflake), aucune invitation, aucun e-mail, aucun nom de compte
 *     (`user.image` nul, `user.name` absent — `getDisplayName` interdit le nom de compte d'autrui) ;
 *  2. **déterminisme** : aucune date calculée avec `Date.now()` (rendu serveur et client identiques) ;
 *  3. les champs sont ceux que `MemberCard` lit **réellement** (mesure §2.3 du plan) :
 *     `classe` = id de `DOFUS_CLASSES`, `metiers` = id de `DOFUS_JOBS`, `alignment` ∈ `ALIGNMENTS`,
 *     `alignmentOrder` = id d'`ORDERS`, `altPseudos` = mules `{ pseudo, classe, alignment, alignmentOrder, level }`.
 */

/** Guilde de démonstration — fictive, jamais en base. `id` n'est **pas** un snowflake Discord. */
export const DEMO_GUILD = {
    id: "guilde-demonstration",
    name: "Les Sentinelles de Djaul",
    tag: "SENT",
    server: "Draconiros",
} as const;

export interface DemoMember {
    id: string;
    /** Pseudo serveur Discord — le seul nom que `MemberCard` affiche pour un autre membre. */
    discordNickname: string;
    pseudoDofus: string;
    displayName: string;
    classe: string;
    metiers: { name: string; level: number }[];
    alignment: "neutre" | "bontarien" | "brakmarien";
    alignmentOrder: string | null;
    alignmentLevel: number | null;
    altPseudos: DemoMule[];
    legendaryCrafts: { id: string; name: string }[];
    hasLegendaryPet: boolean;
    roleName: string;
    roleColor: number;
    isAdmin: boolean;
    /** Date ISO **fixe** (règle 2) — `null` = jamais vu. */
    lastActivityAt: string | null;
    vacationStart: string | null;
    vacationEnd: string | null;
    /** Jamais de nom de compte : le dépôt est public. */
    user: { image: null };
    guildId: string;
}

export interface DemoMule {
    id: string;
    pseudo: string;
    classe: string;
    alignment: "bontarien" | "brakmarien";
    alignmentOrder: string;
    level: number;
}

/** Entrée compacte — la fabrique évite de répéter 18 fois la même forme. */
interface DemoMemberInput {
    n: string;
    classe: string;
    jobs: string[];
    align?: "neutre" | "bontarien" | "brakmarien";
    order?: string;
    alignLevel?: number;
    mules?: DemoMule[];
    mage?: boolean;
    pet?: boolean;
    role: string;
    color: number;
    admin?: boolean;
    seen?: string;
}

const MAGE_CRAFT = { id: "demo-craft-legendarite", name: "Anneau légendaire" };
const NO_USER = { image: null } as const;

function buildMember(input: DemoMemberInput, index: number): DemoMember {
    const alignment = input.align ?? "neutre";
    return {
        id: `demo-membre-${String(index + 1).padStart(2, "0")}`,
        discordNickname: input.n,
        pseudoDofus: input.n,
        displayName: input.n,
        classe: input.classe,
        metiers: input.jobs.map((name) => ({ name, level: 200 })),
        alignment,
        alignmentOrder: alignment === "neutre" ? null : (input.order ?? null),
        alignmentLevel: alignment === "neutre" ? null : (input.alignLevel ?? 20),
        altPseudos: input.mules ?? [],
        legendaryCrafts: input.mage ? [MAGE_CRAFT] : [],
        hasLegendaryPet: input.pet ?? false,
        roleName: input.role,
        roleColor: input.color,
        isAdmin: input.admin ?? false,
        lastActivityAt: input.seen ?? null,
        vacationStart: null,
        vacationEnd: null,
        user: NO_USER,
        guildId: DEMO_GUILD.id,
    };
}

/**
 * Les 8 membres de la guilde de démonstration.
 * Pseudos **entièrement inventés** (aucun ne provient d'un membre réel) ; rôles alignés sur la
 * hiérarchie Discord du produit (Meneur → Officier → Membre → Recrue).
 */
const INPUTS: DemoMemberInput[] = [
    {
        n: "Ombrelune",
        classe: "xelor",
        jobs: ["alchimiste", "paysan"],
        align: "bontarien",
        order: "vaillant",
        alignLevel: 60,
        mules: [
            {
                id: "demo-mule-01",
                pseudo: "Ombrelune-Bis",
                classe: "sram",
                alignment: "bontarien",
                alignmentOrder: "vaillant",
                level: 200,
            },
        ],
        mage: true,
        pet: true,
        role: "Meneur",
        color: 0xd9a441,
        admin: true,
        seen: "2026-09-30T20:15:00.000Z",
    },
    {
        n: "Cendrebrume",
        classe: "eniripsa",
        jobs: ["bijoutier"],
        role: "Officier",
        color: 0x62ccdd,
        seen: "2026-09-29T18:40:00.000Z",
    },
    {
        n: "Braisevive",
        classe: "iop",
        jobs: ["mineur", "bucheron"],
        align: "brakmarien",
        order: "malsain",
        alignLevel: 40,
        role: "Membre",
        color: 0x9aa4b2,
        seen: "2026-09-28T21:05:00.000Z",
    },
    {
        n: "Racinecourbe",
        classe: "sadida",
        jobs: ["pecheur"],
        role: "Membre",
        color: 0x9aa4b2,
        seen: "2026-09-27T19:30:00.000Z",
    },
    {
        n: "Sylvane",
        classe: "ecaflip",
        jobs: ["chasseur"],
        align: "bontarien",
        order: "vaillant",
        role: "Membre",
        color: 0x9aa4b2,
        seen: "2026-09-26T17:10:00.000Z",
    },
    {
        n: "Givrelame",
        classe: "feca",
        jobs: ["alchimiste"],
        role: "Membre",
        color: 0x9aa4b2,
        seen: "2026-09-25T20:45:00.000Z",
    },
    { n: "Voltbrisé", classe: "steamer", jobs: ["bucheron"], role: "Membre", color: 0x9aa4b2 },
    { n: "Pandanuit", classe: "pandawa", jobs: ["paysan"], role: "Recrue", color: 0x6b7280 },
];

export const DEMO_MEMBERS: DemoMember[] = INPUTS.map(buildMember);

/**
 * Butin légendaire du filtre d'annuaire (`legendaryItems` de `MemberDirectory`) — le filtre compare
 * `legendaryCrafts[].id`, et la source y répond.
 */
export const DEMO_LEGENDARY_ITEMS = [MAGE_CRAFT];

/** Chiffres affichés par la page — **dérivés de la source**, jamais recopiés à la main. */
export const DEMO_STATS = {
    memberCount: DEMO_MEMBERS.length,
    mageCount: DEMO_MEMBERS.filter((m) => m.legendaryCrafts.length > 0).length,
    muleCount: DEMO_MEMBERS.reduce((total, m) => total + m.altPseudos.length, 0),
    jobCount: DEMO_MEMBERS.reduce((total, m) => total + m.metiers.length, 0),
    alliedCount: DEMO_MEMBERS.filter((m) => m.alignment !== "neutre").length,
};

// =============================================================================
// DOFUS GAME DATA - Centralized Assets for Profile Module
// =============================================================================

// -----------------------------------------------------------------------------
// CLASSES
// -----------------------------------------------------------------------------
export interface DofusClass {
    id: string;
    name: string;
    icon: string;
    color: string;
}

export const DOFUS_CLASSES = [
    { id: "cra", name: "Cra", icon: "/assets/dofus/classes/9.png", color: "#4ade80" },
    { id: "ecaflip", name: "Ecaflip", icon: "/assets/dofus/classes/6.png", color: "#ec4899" },
    { id: "eliotrope", name: "Eliotrope", icon: "/assets/dofus/classes/16.png", color: "#3b82f6" },
    { id: "eniripsa", name: "Eniripsa", icon: "/assets/dofus/classes/7.png", color: "#f472b6" },
    { id: "enutrof", name: "Enutrof", icon: "/assets/dofus/classes/3.png", color: "#f59e0b" },
    { id: "feca", name: "Féca", icon: "/assets/dofus/classes/1.png", color: "#60a5fa" },
    { id: "forgelance", name: "Forgelance", icon: "/assets/dofus/classes/20.png", color: "#fcd34d" },
    { id: "huppermage", name: "Huppermage", icon: "/assets/dofus/classes/17.png", color: "#8b5cf6" },
    { id: "iop", name: "Iop", icon: "/assets/dofus/classes/8.png", color: "#ef4444" },
    { id: "osamodas", name: "Osamodas", icon: "/assets/dofus/classes/2.png", color: "#ef4444" },
    { id: "ouginak", name: "Ouginak", icon: "/assets/dofus/classes/18.png", color: "#f59e0b" },
    { id: "pandawa", name: "Pandawa", icon: "/assets/dofus/classes/12.png", color: "#16a34a" },
    { id: "roublard", name: "Roublard", icon: "/assets/dofus/classes/13.png", color: "#f97316" },
    { id: "sacrieur", name: "Sacrieur", icon: "/assets/dofus/classes/11.png", color: "#dc2626" },
    { id: "sadida", name: "Sadida", icon: "/assets/dofus/classes/10.png", color: "#22c55e" },
    { id: "sram", name: "Sram", icon: "/assets/dofus/classes/4.png", color: "#a855f7" },
    { id: "steamer", name: "Steamer", icon: "/assets/dofus/classes/15.png", color: "#06b6d4" },
    { id: "xelor", name: "Xélor", icon: "/assets/dofus/classes/5.png", color: "#6366f1" },
    { id: "zobal", name: "Zobal", icon: "/assets/dofus/classes/14.png", color: "#ef4444" },
] as const;

export type DofusClassId = typeof DOFUS_CLASSES[number]["id"];

export function getClass(id: string) {
    return DOFUS_CLASSES.find(c => c.id === id || c.name.toLowerCase() === id.toLowerCase());
}

// -----------------------------------------------------------------------------
// JOBS (MÉTIERS)
// -----------------------------------------------------------------------------

export const JOB_CATEGORIES = {
    RECOLTE: "Récolte",
    ARTISANAT: "Artisanat",
    FORGEMAGIE: "Forgemagie",
    ELEVAGE: "Élevage",
} as const;

export const DOFUS_JOBS = {
    [JOB_CATEGORIES.RECOLTE]: [
        { id: "alchimiste", name: "Alchimiste", icon: "/assets/dofus/jobs/alchimiste.png" },
        { id: "bucheron", name: "Bûcheron", icon: "/assets/dofus/jobs/bucheron.png" },
        { id: "chasseur", name: "Chasseur", icon: "/assets/dofus/jobs/chasseur.png" },
        { id: "mineur", name: "Mineur", icon: "/assets/dofus/jobs/mineur.png" },
        { id: "paysan", name: "Paysan", icon: "/assets/dofus/jobs/paysan.png" },
        { id: "pecheur", name: "Pêcheur", icon: "/assets/dofus/jobs/pecheur.png" },
    ],
    [JOB_CATEGORIES.ARTISANAT]: [
        { id: "bijoutier", name: "Bijoutier", icon: "/assets/dofus/jobs/bijoutier.png" },
        { id: "bricoleur", name: "Bricoleur", icon: "/assets/dofus/jobs/bricoleur.png" },
        { id: "cordonnier", name: "Cordonnier", icon: "/assets/dofus/jobs/cordonnier.png" },
        { id: "faconneur", name: "Façonneur", icon: "/assets/dofus/jobs/faconneur.png" },
        { id: "forgeron", name: "Forgeron", icon: "/assets/dofus/jobs/forgeron.png" },
        { id: "sculpteur", name: "Sculpteur", icon: "/assets/dofus/jobs/sculpteur.png" },
        { id: "tailleur", name: "Tailleur", icon: "/assets/dofus/jobs/tailleur.png" },
    ],
    [JOB_CATEGORIES.FORGEMAGIE]: [
        { id: "cordomage", name: "Cordomage", icon: "/assets/dofus/jobs/cordomage.png" },
        { id: "costumage", name: "Costumage", icon: "/assets/dofus/jobs/costumage.png" },
        { id: "forgemage", name: "Forgemage", icon: "/assets/dofus/jobs/forgemage.png" },
        { id: "joaillomage", name: "Joaillomage", icon: "/assets/dofus/jobs/joillomage.png" },
        { id: "sculptemage", name: "Sculptemage", icon: "/assets/dofus/jobs/sculptemage.png" },
        { id: "facomage", name: "Façomage", icon: "/assets/dofus/jobs/facomage.png" },
    ],
    [JOB_CATEGORIES.ELEVAGE]: [
        { id: "eleveur", name: "Éleveur", icon: "/assets/dofus/jobs/eleveur.png" },
    ]
} as const;

// IDs of all Forgemagie jobs for quick checking
export const FM_JOB_IDS: string[] = DOFUS_JOBS[JOB_CATEGORIES.FORGEMAGIE].map(j => j.id);

export function getJob(id: string) {
    for (const category of Object.values(DOFUS_JOBS)) {
        const job = category.find(j => j.id === id || j.name.toLowerCase() === id.toLowerCase());
        if (job) return job;
    }
    return null;
}

export function hasAnyForgemagie(jobs: string[]): boolean {
    return jobs.some(j => FM_JOB_IDS.includes(j));
}

// -----------------------------------------------------------------------------
// AVAILABILITY
// -----------------------------------------------------------------------------

export const DAYS_OF_WEEK = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"] as const;
export const RAW_TIME_SLOTS = ["matin", "midi", "soir", "nuit"] as const;
export const TIME_SLOTS = ["matin", "midi", "soir", "nuit"] as const;

export type DayOfWeek = typeof DAYS_OF_WEEK[number];
export type TimeSlot = typeof TIME_SLOTS[number];

export const TIME_SLOT_CONFIG: Record<TimeSlot, { label: string; shortLabel: string; hours: string; shortHours: string }> = {
    matin: { label: "Matin", shortLabel: "Matin", hours: "06h - 12h", shortHours: "06h-12h" },
    midi: { label: "Après-midi", shortLabel: "Aprem", hours: "12h - 18h", shortHours: "12h-18h" },
    soir: { label: "Soirée", shortLabel: "Soir", hours: "18h - 00h", shortHours: "18h-00h" },
    nuit: { label: "Nuit", shortLabel: "Nuit", hours: "00h - 06h", shortHours: "00h-06h" },
};

export type AvailabilityMap = Partial<Record<DayOfWeek, TimeSlot[]>>;

export type GlobalAvailability = {
    template?: AvailabilityMap;
    weeks?: Record<string, AvailabilityMap>; // Key format: "YYYY-W#"
    [key: string]: any; // Allow legacy properties during migration
};

/**
 * Nombre de créneaux de disponibilité remplis (format GlobalAvailability OU legacy
 * AvailabilityMap direct). Utilisé pour le rappel hebdomadaire « remplis ta semaine ».
 */
export function countAvailabilitySlots(availability: GlobalAvailability | AvailabilityMap | null | undefined): number {
    if (!availability || typeof availability !== "object") return 0;
    const template = (availability as GlobalAvailability).template ?? (availability as AvailabilityMap);
    if (!template || typeof template !== "object") return 0;
    let count = 0;
    for (const day of DAYS_OF_WEEK) {
        const slots = (template as AvailabilityMap)[day];
        if (Array.isArray(slots)) count += slots.length;
    }
    return count;
}

/** La semaine type du joueur est-elle renseignée (au moins un créneau actif) ? */
export function hasFilledAvailability(availability: GlobalAvailability | AvailabilityMap | null | undefined): boolean {
    return countAvailabilitySlots(availability) > 0;
}

// -----------------------------------------------------------------------------
// FORGEMAGIE STATUS
// -----------------------------------------------------------------------------

export const FORGEMAGIE_STATUS = {
    FREE: { id: "FREE", label: "Gratuit Guilde", color: "#22c55e", icon: "🟢" },
    PAID: { id: "PAID", label: "Payant", color: "#eab308", icon: "🟡" },
    UNAVAILABLE: { id: "UNAVAILABLE", label: "Indisponible", color: "#6b7280", icon: "🚫" },
} as const;

export type ForgemagieStatusId = keyof typeof FORGEMAGIE_STATUS;

export function getForgemagieStatus(id: string) {
    return FORGEMAGIE_STATUS[id as ForgemagieStatusId] || FORGEMAGIE_STATUS.UNAVAILABLE;
}

// -----------------------------------------------------------------------------
// ALIGNMENTS & ORDERS
// -----------------------------------------------------------------------------

export const ALIGNMENTS = [
    { id: "neutre", name: "Neutre", icon: "/ordres/neutre.png", color: "#9ca3af" },
    { id: "bontarien", name: "Bontarien", icon: "/ordres/bonta.png", color: "#60a5fa" },
    { id: "brakmarien", name: "Brakmarien", icon: "/ordres/brakmar.png", color: "#ef4444" },
] as const;

export type AlignmentId = typeof ALIGNMENTS[number]["id"];

export const ORDERS = {
    bontarien: [
        { 
            id: "vaillant", 
            name: "Ordre du Cœur Vaillant", 
            icon: "/ordres/bontarien/vaillant.png",
            levels: {
                20: "Disciple de Ménalt",
                40: "Écuyer",
                60: "Chevalier de l'Espoir",
                80: "Champion Merveilleux",
                100: "Héros Légendaire"
            }
        },
        { 
            id: "attentif", 
            name: "Ordre de l'Œil Attentif", 
            icon: "/ordres/bontarien/attentif.png",
            levels: {
                20: "Disciple de Silvosse",
                40: "Espion silencieux",
                60: "Chasseur de Renégats",
                80: "Assassin Suprême",
                100: "Maître des Illusions"
            }
        },
        { 
            id: "salvateur", 
            name: "Ordre de l'Esprit Salvateur", 
            icon: "/ordres/bontarien/salvateur.png",
            levels: {
                20: "Disciple de Jiva",
                40: "Apprenti Éclairé",
                60: "Adepte des Écrits",
                80: "Maître des Parchemins",
                100: "Gardien du Savoir"
            }
        },
    ],
    brakmarien: [
        { 
            id: "saignant", 
            name: "Ordre du Cœur Saignant", 
            icon: "/ordres/brakmarien/saignant.png",
            levels: {
                20: "Disciple de Djaul",
                40: "Surineur",
                60: "Chevalier du Désespoir",
                80: "Champion du Chaos",
                100: "Héros de l'Apocalypse"
            }
        },
        { 
            id: "putride", 
            name: "Ordre de l'Œil Putride", 
            icon: "/ordres/brakmarien/putride.png",
            levels: {
                20: "Disciple de Brumaire",
                40: "Espion Sombre",
                60: "Chasseur d'Âmes",
                80: "Psychopathe",
                100: "Maître des Ombres"
            }
        },
        { 
            id: "malsain", 
            name: "Ordre de l'Esprit Malsain", 
            icon: "/ordres/brakmarien/malsain.png",
            levels: {
                20: "Disciple d'Hécate",
                40: "Apprenti Sombre",
                60: "Adepte des Douleurs",
                80: "Maître des Sévices",
                100: "Gardien des Tortures"
            }
        },
    ]
} as const;

export type OrderId = string;

export function getAlignment(id: string) {
    return ALIGNMENTS.find(a => a.id === id);
}

export function getOrder(alignmentId: string, orderId: string) {
    return (ORDERS as any)[alignmentId]?.find((o: any) => o.id === orderId);
}

/**
 * Paliers d'alignement (tranches) par pas de 10, de 10 à 100.
 * Le titre n'existe que pour les grades officiels (20/40/60/80/100) ;
 * les paliers intermédiaires (10/30/50/70/90) affichent un label générique.
 */
export function getAlignmentLevelSteps(order: any): Array<{ level: number; title: string }> {
    const steps: Array<{ level: number; title: string }> = [];
    for (let lvl = 10; lvl <= 100; lvl += 10) {
        steps.push({ level: lvl, title: order?.levels?.[lvl] || "" });
    }
    return steps;
}

// -----------------------------------------------------------------------------
// DOFUS WORLDS & DIMENSIONS (Official Dofus / DofusDB worldMap IDs)
// -----------------------------------------------------------------------------
export const DOFUS_WORLDS = [
    { id: 1, name: "Monde des Douze" },
    { id: 2, name: "Incarnam" },
    { id: 3, name: "Souterrain d'Astrub" },
    { id: 4, name: "Labyrinthe du Minotoror" },
    { id: 5, name: "Labyrinthe du Dragon Cochon" },
    { id: 6, name: "Bibliothèque du Maître Corbac" },
    { id: 7, name: "Cavernes des Givrefoux" },
    { id: 8, name: "Canaux Méphitiques" },
    { id: 9, name: "Entrailles de Brâkmar" },
    { id: 10, name: "Village de la Canopée" },
    { id: 11, name: "Duty free" },
    { id: 12, name: "Château de Harebourg" },
    { id: 13, name: "Enutrosor" },
    { id: 14, name: "Srambad" },
    { id: 15, name: "Xélorium" },
    { id: 16, name: "Ecaflipus" },
    { id: 17, name: "Profondeurs de Sufokia" },
    { id: 18, name: "Pyramide Maudite" },
    { id: 19, name: "Mappemondes" },
    { id: 20, name: "Épaves Silencieuses" },
    { id: 21, name: "Île de Pwâk" },
    { id: 22, name: "Crocuzko" },
    { id: 24, name: "Blessures de Guerre" },
    { id: 25, name: "Royaume Corrompu" },
    { id: 26, name: "Désert de Misère" },
    { id: 27, name: "Galère de Servitude" },
    { id: 28, name: "Wukin et Wukang" },
    { id: 29, name: "Ecaflip City" },
    { id: 30, name: "Cauchemar" },
    { id: 31, name: "Galeries d'Ereboria" },
    { id: 32, name: "Caverne des Fungus" },
    { id: 33, name: "Base Abyssale" },
    { id: 34, name: "Osavora" },
    { id: 35, name: "Dimension Obscure" },
    { id: 36, name: "Sanctuaire des Dragoeufs" },
    { id: 37, name: "Gouffre du Gigalodon" },
    { id: 38, name: "Village des Brigandins" },
    { id: 40, name: "Sanctuaire des Jardins éternels" },
] as const;

export function getWorldName(worldMapId?: number | null): string {
    if (!worldMapId || worldMapId === -1 || worldMapId === 1) return "Monde des Douze";
    const found = DOFUS_WORLDS.find((w) => w.id === worldMapId);
    return found ? found.name : `Monde ${worldMapId}`;
}

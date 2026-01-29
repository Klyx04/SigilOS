// =============================================================================
// DOFUS GAME DATA - Centralized Assets for Profile Module
// =============================================================================

// -----------------------------------------------------------------------------
// CLASSES
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
    { id: "forgelance", name: "Forgelance", icon: "/assets/dofus/classes/20.png", color: "#fcd34d" }, // ID 20 confirmed
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
// JOBS (MÉTIERS) - Corrected categories per user specs
// -----------------------------------------------------------------------------

export const JOB_CATEGORIES = {
    RECOLTE: "Récolte",
    ARTISANAT: "Artisanat",
    FORGEMAGIE: "Forgemagie",
} as const;

export const DOFUS_JOBS = {
    [JOB_CATEGORIES.RECOLTE]: [
        { id: "alchimiste", name: "Alchimiste", icon: "/assets/dofus/jobs/1.png" }, // Placeholder
        { id: "bucheron", name: "Bûcheron", icon: "/assets/dofus/jobs/1.png" }, // Placeholder
        { id: "chasseur", name: "Chasseur", icon: "/assets/dofus/jobs/41.png" },
        { id: "mineur", name: "Mineur", icon: "/assets/dofus/jobs/24.png" },
        { id: "paysan", name: "Paysan", icon: "/assets/dofus/jobs/28.png" },
        { id: "pecheur", name: "Pêcheur", icon: "/assets/dofus/jobs/36.png" },
    ],
    [JOB_CATEGORIES.ARTISANAT]: [
        { id: "bijoutier", name: "Bijoutier", icon: "/assets/dofus/jobs/1.png" }, // Placeholder
        { id: "bricoleur", name: "Bricoleur", icon: "/assets/dofus/jobs/1.png" }, // Placeholder
        { id: "cordonnier", name: "Cordonnier", icon: "/assets/dofus/jobs/5.png" },
        { id: "faconneur", name: "Façonneur", icon: "/assets/dofus/jobs/1.png" }, // Placeholder
        { id: "forgeron", name: "Forgeron", icon: "/assets/dofus/jobs/1.png" }, // Placeholder
        { id: "sculpteur", name: "Sculpteur", icon: "/assets/dofus/jobs/13.png" },
        { id: "tailleur", name: "Tailleur", icon: "/assets/dofus/jobs/1.png" }, // Placeholder
    ],
    [JOB_CATEGORIES.FORGEMAGIE]: [
        { id: "cordomage", name: "Cordomage", icon: "/assets/dofus/jobs/1.png" },
        { id: "costumage", name: "Costumage", icon: "/assets/dofus/jobs/1.png" },
        { id: "forgemage", name: "Forgemage", icon: "/assets/dofus/jobs/1.png" },
        { id: "joaillomage", name: "Joaillomage", icon: "/assets/dofus/jobs/1.png" },
        { id: "sculptemage", name: "Sculptemage", icon: "/assets/dofus/jobs/1.png" },
        { id: "facomage", name: "Façomage", icon: "/assets/dofus/jobs/1.png" },
    ],
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
export type AvailabilityMap = Partial<Record<DayOfWeek, TimeSlot[]>>;

export type GlobalAvailability = {
    template?: AvailabilityMap;
    weeks?: Record<string, AvailabilityMap>; // Key format: "YYYY-W#"
    [key: string]: any; // Allow legacy properties during migration
};

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

// =============================================================================
// DOFUS GAME DATA - Centralized Assets for Profile Module
// =============================================================================

// -----------------------------------------------------------------------------
// CLASSES
// -----------------------------------------------------------------------------

export const DOFUS_CLASSES = [
    { id: "cra", name: "Cra", icon: "🏹", color: "#4ade80" },
    { id: "ecaflip", name: "Écaflip", icon: "🎲", color: "#facc15" },
    { id: "eliotrope", name: "Éliotrope", icon: "🌀", color: "#a78bfa" },
    { id: "eniripsa", name: "Eniripsa", icon: "💖", color: "#f472b6" },
    { id: "enutrof", name: "Enutrof", icon: "💰", color: "#fbbf24" },
    { id: "feca", name: "Féca", icon: "🛡️", color: "#60a5fa" },
    { id: "huppermage", name: "Huppermage", icon: "✨", color: "#c4b5fd" },
    { id: "iop", name: "Iop", icon: "⚔️", color: "#f87171" },
    { id: "osamodas", name: "Osamodas", icon: "🐉", color: "#34d399" },
    { id: "ouginak", name: "Ouginak", icon: "🐺", color: "#fb923c" },
    { id: "pandawa", name: "Pandawa", icon: "🐼", color: "#a3e635" },
    { id: "roublard", name: "Roublard", icon: "💣", color: "#94a3b8" },
    { id: "sacrieur", name: "Sacrieur", icon: "🩸", color: "#dc2626" },
    { id: "sadida", name: "Sadida", icon: "🌿", color: "#22c55e" },
    { id: "sram", name: "Sram", icon: "🗡️", color: "#6366f1" },
    { id: "steamer", name: "Steamer", icon: "⚙️", color: "#78716c" },
    { id: "xelor", name: "Xélor", icon: "⏰", color: "#06b6d4" },
    { id: "zobal", name: "Zobal", icon: "🎭", color: "#ec4899" },
    { id: "forgelance", name: "Forgelance", icon: "🔱", color: "#0ea5e9" },
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
        { id: "alchimiste", name: "Alchimiste", icon: "🧪" },
        { id: "bucheron", name: "Bûcheron", icon: "🪓" },
        { id: "chasseur", name: "Chasseur", icon: "🍖" },
        { id: "mineur", name: "Mineur", icon: "⛏️" },
        { id: "paysan", name: "Paysan", icon: "🌾" },
    ],
    [JOB_CATEGORIES.ARTISANAT]: [
        { id: "bijoutier", name: "Bijoutier", icon: "💍" },
        { id: "bricoleur", name: "Bricoleur", icon: "🔧" },
        { id: "cordonnier", name: "Cordonnier", icon: "👟" },
        { id: "faconneur", name: "Façonneur", icon: "🏺" },
        { id: "forgeron", name: "Forgeron", icon: "⚔️" },
        { id: "sculpteur", name: "Sculpteur", icon: "🪄" },
        { id: "tailleur", name: "Tailleur", icon: "🧵" },
    ],
    [JOB_CATEGORIES.FORGEMAGIE]: [
        { id: "cordomage", name: "Cordomage", icon: "👟✨" },
        { id: "costumage", name: "Costumage", icon: "👗✨" },
        { id: "forgemage", name: "Forgemage", icon: "⚔️✨" },
        { id: "joaillomage", name: "Joaillomage", icon: "💍✨" },
        { id: "sculptemage", name: "Sculptemage", icon: "🪄✨" },
        { id: "facomage", name: "Façomage", icon: "🏺✨" },
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

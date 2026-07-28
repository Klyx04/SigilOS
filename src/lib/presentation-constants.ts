// ============================================================================
// DOFUS UNITY SERVER LIST (Official servers only - no Retro, no Touch)
// ============================================================================

export const DOFUS_UNITY_SERVERS = {
    epique: [
        { name: "Ombre", id: 50 }
    ],
    monocompte: [
        { name: "Draconiros", id: 295 }
    ],
    classique: [
        { name: "Tal Kasha", id: 290 },
        { name: "Imagiro", id: 291 },
        { name: "Orukam", id: 292 },
        { name: "Tylezia", id: 293 },
        { name: "Hell Mina", id: 294 }
    ],
    pionnierMono: [
        { name: "Dakal", id: 353 },
        { name: "Mikhal", id: 354 },
        { name: "Kourial", id: 355 }
    ],
    pionnier: [
        { name: "Rafal", id: 350 },
        { name: "Brial", id: 351 },
        { name: "Salar", id: 352 }
    ],
} as const;

export const ALL_DOFUS_SERVERS = [
    ...DOFUS_UNITY_SERVERS.epique.map(s => s.name),
    ...DOFUS_UNITY_SERVERS.monocompte.map(s => s.name),
    ...DOFUS_UNITY_SERVERS.classique.map(s => s.name),
    ...DOFUS_UNITY_SERVERS.pionnierMono.map(s => s.name),
    ...DOFUS_UNITY_SERVERS.pionnier.map(s => s.name),
];

// ============================================================================
// AVAILABLE ACTIVITIES
// ============================================================================

export const AVAILABLE_ACTIVITIES = [
    { id: "economie", label: "Économie", subtitle: "Artisanat, Récolte, Commerce, Élevage" },
    { id: "pvm", label: "PVM", subtitle: "Donjons, Quêtes, Succès, Farm" },
    { id: "roleplay", label: "Roleplay", subtitle: "" },
    { id: "kolizeum", label: "Kolizéum", subtitle: "" },
    { id: "percepteur", label: "Percepteur", subtitle: "" },
    { id: "raids", label: "Raids de Guilde", subtitle: "Dungeons, Gigalodon, Sanctuaire" },
] as const;

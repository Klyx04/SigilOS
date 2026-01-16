// ============================================================================
// DOFUS UNITY SERVER LIST (Official servers only - no Retro, no Touch)
// ============================================================================

export const DOFUS_UNITY_SERVERS = {
    // New Pioneer Servers (December 2024)
    singleAccount: [
        "Dakal 1", "Dakal 2", "Dakal 3", "Dakal 4", "Dakal 5",
        "Dakal 6", "Dakal 7", "Dakal 8", "Dakal 9", "Dakal 10",
    ],
    multiAccount: [
        "Rafal 1", "Rafal 2", "Rafal 3",
        "Salar 1", "Salar 2", "Salar 3",
        "Brial 1", "Brial 2", "Brial 3",
        "Kourial 1", "Kourial 2", "Kourial 3",
        "Mikhal 1", "Mikhal 2", "Mikhal 3",
    ],
    // Legacy Servers (ported to Unity)
    legacy: [
        "Tal Kasha", "Imagiro", "Orukam", "Tylezia",
        "Hell Mina", "Draconiros", "Ombre",
    ],
} as const;

export const ALL_DOFUS_SERVERS = [
    ...DOFUS_UNITY_SERVERS.singleAccount,
    ...DOFUS_UNITY_SERVERS.multiAccount,
    ...DOFUS_UNITY_SERVERS.legacy,
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
] as const;

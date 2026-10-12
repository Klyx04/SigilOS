// ⚡ Constantes API Keys SigilOS — fichier pur (pas de "use server")
// Importable côté client ET côté serveur.

export const API_SCOPES = [
    { id: "read:members", label: "Lecture des Membres", description: "Consulter la liste des membres, pseudos Dofus, rangs et rôles" },
    { id: "read:quests", label: "Lecture des Quêtes & Dofus", description: "Consulter l'avancement global des quêtes et Dofus de la guilde" },
    { id: "read:events", label: "Lecture des Sorties", description: "Consulter les sorties donjons, songes et événements programmés" },
    { id: "read:bounties", label: "Lecture des Avis de Recherche", description: "Consulter le suivi des monstres recherchés et doplons" }
] as const;

export type ApiScope = typeof API_SCOPES[number]["id"];

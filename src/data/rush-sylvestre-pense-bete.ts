/**
 * 📋 PENSE-BÊTE — Rush Sylvestre
 * Liste des « choses à savoir / à préparer en amont » avant / pendant un rush.
 * Source : colonne « À PRÉPARER » du guide Google Sheet (streamer Laniyelle),
 * consolidée et structurée par section.
 *
 * ⚠️ Future amélioration : rendre ce contenu éditable depuis l'interface GOD
 * (onglet « Lancement » du Rush Sylvestre) — voir chantier 2026-09-03.
 */

export type RushPenseBeteItem = {
  id: string;
  label: string;
  detail?: string;
  /** Métiers requis — affichés en colonne / chips à droite (cf. feuille). */
  metiers?: string[];
  /** Variante alternative des métiers requis. */
  alternative?: string[];
};

export type RushPenseBeteSection = {
  id: string;
  title: string;
  items: RushPenseBeteItem[];
};

export const RUSH_PENSE_BETE: RushPenseBeteSection[] = [
  {
    id: "metiers",
    title: "Métiers requis",
    items: [
      {
        id: "monter-metiers",
        label: "Monter les métiers",
        detail: "Niveaux recommandés pour profiter des craft / ressources du rush.",
        metiers: ["Paysan 200", "Alchimiste 40", "Mineur 40", "Bricoleur 30", "Sculpteur 10", "Façonneur 10"],
        alternative: ["Alchimiste 200", "Paysan 100", "Mineur 40", "Bricoleur 30", "Sculpteur 10", "Façonneur 10"],
      },
    ],
  },
  {
    id: "preparatifs",
    title: "Préparatifs généraux",
    items: [
      { id: "mariage", label: "Mariage", detail: "Bonus d'XP / de stats non négligeable sur toute la durée du rush." },
      { id: "prepa-stuffs", label: "Prépa stuffs", detail: "Préparer / crafter le stuff de chaque tranche de niveau à l'avance." },
      { id: "parchottage", label: "Parchottage", detail: "Parchotter les ressources avant de les consommer." },
      { id: "sorts-communs", label: "Sorts communs", detail: "Acheter / monter les sorts utilisés à toutes les étapes." },
      { id: "portails-dimensions", label: "Chasse de portails de dimensions", detail: "Farm / repérer les portails pour les donjons de dimensions." },
    ],
  },
  {
    id: "dragons",
    title: "Dragons & préparations liées",
    items: [
      {
        id: "dragobon-shigekax",
        label: "Préparer les Dragobon et autres Shigekax et Tatouage et consommable point de guilde !",
        detail: "Tout ce qui touche aux montures / consommables de guilde à préparer en amont.",
      },
      { id: "tablettes-tontankama", label: "Préparer les tablettes de Tontankama" },
    ],
  },
  {
    id: "chasse",
    title: "Chasse & captures",
    items: [
      {
        id: "carte-cania",
        label: "Acheter Carte de Cania pour Émeraude",
        detail: "Quêtes : les bandits de Cania.",
      },
      { id: "capture-eme-raude", label: "Capture Boss Émeraude" },
      { id: "capture-boss-ocre", label: "Capture Boss de donjon pour Ocre" },
      { id: "capture-archis", label: "Capture Archis" },
    ],
  },
  {
    id: "ressources",
    title: "Ressources & stuff",
    items: [
      { id: "achat-ressources", label: "Achat ressources", detail: "Anticiper les achats HDV pour ne pas bloquer la progression." },
      { id: "clefs-donjons", label: "Achat clefs des donjons à faire plusieurs fois", detail: "Donjon dimensions." },
      { id: "brandades", label: "Préparer les Brandades", detail: "Gestion de l'initiative en combat." },
    ],
  },
  {
    id: "deplacement",
    title: "Déplacement & confort",
    items: [
      { id: "explo-merkator", label: "Explo Merkator pour TP", detail: "Téléportation rapide sur la carte." },
      { id: "ouvrir-hervual", label: "Ouvrir Hervual en avance", detail: "Pour ne pas refaire les dalles." },
      { id: "potion-tp", label: "Potion de téléportation" },
      { id: "dd-deplacement", label: "Utiliser une DD pour déplacement", detail: "Dragon / dragodinde de déplacement." },
      { id: "save-all-dj", label: "Save All DJ", detail: "Enregistrer sa position / son donjon pour ne rien reperdre." },
    ],
  },
];

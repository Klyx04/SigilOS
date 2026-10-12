export type BUILD_TAG_TYPE = "eau" | "feu" | "terre" | "air" | "multi" | "tank" | "dopou" | "pp" | "retpa" | "retpm" | "soin" | "terrefeu" | "terreeau" | "terreair" | "feueau" | "feuair" | "eauair" | "ini" | "sagesse" | "multinocrit" | "songes" | "docrit" | "leveling" | "koli1v1" | "koli2v2" | "koli3v3" | "perco";

export type DoTag = {
    id: string;
    label: string;
    /** Libellé historique avec emoji (conservé pour la recherche, ne plus l'afficher). */
    text: string;
    className: string;
    /** Vrais assets du jeu à afficher dans les filtres (aucun emoji). Absent = texte seul. */
    icons?: string[];
};

const EL = {
    terre: "/assets/module-succes/terre.png",
    feu: "/assets/module-succes/Intelligence.png",
    eau: "/assets/module-succes/eau.png",
    air: "/assets/module-succes/Agility.png",
    neutre: "/assets/module-succes/neutre.png",
};
const ST = {
    bouclier: "/assets/dofus/stats/bouclier.png",
    dommages: "/assets/dofus/stats/dommages.png",
    dmgCrit: "/assets/dofus/stats/dmgCritique.png",
    pp: "/assets/dofus/stats/pp.png",
    sagesse: "/assets/dofus/stats/sagesse.png",
    initiative: "/assets/dofus/stats/initiative.png",
    retpa: "/assets/dofus/stats/retraitPA.png",
    retpm: "/assets/dofus/stats/retraitPM.png",
    soin: "/assets/dofus/stats/soin.png",
};

export const DO_TAGS: DoTag[] = [
    { id: "eau", label: "Eau", text: "💧 Eau", className: "bg-blue-500/10 text-blue-400 border border-blue-500/20", icons: [EL.eau] },
    { id: "feu", label: "Feu", text: "🔥 Feu", className: "bg-red-500/10 text-red-400 border border-red-500/20", icons: [EL.feu] },
    { id: "terre", label: "Terre", text: "🌱 Terre", className: "bg-green-600/10 text-green-500 border border-green-600/20", icons: [EL.terre] },
    { id: "air", label: "Air", text: "💨 Air", className: "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20", icons: [EL.air] },
    { id: "multi", label: "Multi", text: "🌈 Multi", className: "bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20", icons: [EL.terre, EL.feu, EL.eau, EL.air] },
    { id: "tank", label: "Tank", text: "🛡️ Tank", className: "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20", icons: [ST.bouclier] },
    { id: "dopou", label: "Do Pou", text: "💥 Do Pou", className: "bg-orange-500/10 text-orange-400 border border-orange-500/20", icons: [ST.dommages] },
    { id: "pp", label: "PP", text: "🍀 PP", className: "bg-yellow-400/10 text-yellow-500 border border-yellow-400/20", icons: [ST.pp] },
    { id: "terrefeu", label: "Terre/Feu", text: "🌱🔥 Terre/Feu", className: "bg-orange-900/10 text-orange-400 border border-orange-600/20", icons: [EL.terre, EL.feu] },
    { id: "terreeau", label: "Terre/Eau", text: "🌱💧 Terre/Eau", className: "bg-teal-900/10 text-teal-400 border border-teal-600/20", icons: [EL.terre, EL.eau] },
    { id: "terreair", label: "Terre/Air", text: "🌱💨 Terre/Air", className: "bg-lime-900/10 text-lime-400 border border-lime-600/20", icons: [EL.terre, EL.air] },
    { id: "feueau", label: "Feu/Eau", text: "🔥💧 Feu/Eau", className: "bg-purple-900/10 text-purple-400 border border-purple-600/20", icons: [EL.feu, EL.eau] },
    { id: "feuair", label: "Feu/Air", text: "🔥💨 Feu/Air", className: "bg-rose-900/10 text-rose-400 border border-rose-600/20", icons: [EL.feu, EL.air] },
    { id: "eauair", label: "Eau/Air", text: "💧💨 Eau/Air", className: "bg-cyan-900/10 text-cyan-400 border border-cyan-600/20", icons: [EL.eau, EL.air] },
    { id: "ini", label: "Initiative", text: "⚡ Initiative", className: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20", icons: [ST.initiative] },
    { id: "retpm", label: "Retrait PM", text: "🦶 Retrait PM", className: "bg-orange-600/10 text-orange-400 border border-orange-600/20", icons: [ST.retpm] },
    { id: "retpa", label: "Retrait PA", text: "⌛ Retrait PA", className: "bg-indigo-600/10 text-indigo-400 border border-indigo-600/20", icons: [ST.retpa] },
    { id: "sagesse", label: "Sagesse", text: "🧠 Sagesse", className: "bg-blue-600/10 text-blue-300 border border-blue-600/20", icons: [ST.sagesse] },
    { id: "multinocrit", label: "Multi No Crit", text: "🌈❌ Multi No Crit", className: "bg-slate-500/10 text-slate-400 border border-slate-500/20", icons: [EL.neutre] },
    { id: "songes", label: "Songes", text: "🌙 Songes", className: "bg-violet-600/10 text-violet-400 border border-violet-600/20" },
    { id: "docrit", label: "Do Crit", text: "🎯 Do Crit", className: "bg-emerald-600/10 text-emerald-300 border border-emerald-600/20", icons: [ST.dmgCrit] },
    { id: "soin", label: "Soin", text: "💖 Soin", className: "bg-pink-600/10 text-pink-400 border border-pink-600/20", icons: [ST.soin] },
    { id: "leveling", label: "Leveling", text: "🆙 Leveling", className: "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20" },
    { id: "koli1v1", label: "Koli 1v1", text: "⚔️ Koli 1v1", className: "bg-amber-500/10 text-amber-400 border border-amber-500/20" },
    { id: "koli2v2", label: "Koli 2v2", text: "⚔️⚔️ Koli 2v2", className: "bg-orange-500/10 text-orange-300 border border-orange-500/20" },
    { id: "koli3v3", label: "Koli 3v3", text: "⚔️⚔️⚔️ Koli 3v3", className: "bg-red-500/10 text-red-300 border border-red-500/20" },
    { id: "perco", label: "Perco T5", text: "🏰 Perco T5", className: "bg-lime-500/10 text-lime-300 border border-lime-500/20" }
];

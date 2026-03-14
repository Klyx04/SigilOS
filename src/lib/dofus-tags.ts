export type BUILD_TAG_TYPE = "eau" | "feu" | "terre" | "air" | "multi" | "tank" | "dopou" | "pp" | "retpa" | "retpm" | "soin" | "terrefeu" | "terreeau" | "terreair" | "feueau" | "feuair" | "eauair" | "ini" | "sagesse" | "multinocrit" | "songes" | "docrit" | "leveling";

export const DO_TAGS = [
    { id: "eau", label: "Eau", text: "💧 Eau", className: "bg-blue-500/10 text-blue-400 border border-blue-500/20" },
    { id: "feu", label: "Feu", text: "🔥 Feu", className: "bg-red-500/10 text-red-400 border border-red-500/20" },
    { id: "terre", label: "Terre", text: "🌱 Terre", className: "bg-green-600/10 text-green-500 border border-green-600/20" },
    { id: "air", label: "Air", text: "💨 Air", className: "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20" },
    { id: "multi", label: "Multi", text: "🌈 Multi", className: "bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20" },
    { id: "tank", label: "Tank", text: "🛡️ Tank", className: "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20" },
    { id: "dopou", label: "Do Pou", text: "💥 Do Pou", className: "bg-orange-500/10 text-orange-400 border border-orange-500/20" },
    { id: "pp", label: "PP", text: "🍀 PP", className: "bg-yellow-400/10 text-yellow-500 border border-yellow-400/20" },
    { id: "terrefeu", label: "Terre/Feu", text: "🌱🔥 Terre/Feu", className: "bg-orange-900/10 text-orange-400 border border-orange-600/20" },
    { id: "terreeau", label: "Terre/Eau", text: "🌱💧 Terre/Eau", className: "bg-teal-900/10 text-teal-400 border border-teal-600/20" },
    { id: "terreair", label: "Terre/Air", text: "🌱💨 Terre/Air", className: "bg-lime-900/10 text-lime-400 border border-lime-600/20" },
    { id: "feueau", label: "Feu/Eau", text: "🔥💧 Feu/Eau", className: "bg-purple-900/10 text-purple-400 border border-purple-600/20" },
    { id: "feuair", label: "Feu/Air", text: "🔥💨 Feu/Air", className: "bg-rose-900/10 text-rose-400 border border-rose-600/20" },
    { id: "eauair", label: "Eau/Air", text: "💧💨 Eau/Air", className: "bg-cyan-900/10 text-cyan-400 border border-cyan-600/20" },
    { id: "ini", label: "Initiative", text: "⚡ Initiative", className: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20" },
    { id: "retpm", label: "Retrait PM", text: "🦶 Retrait PM", className: "bg-orange-600/10 text-orange-400 border border-orange-600/20" },
    { id: "retpa", label: "Retrait PA", text: "⌛ Retrait PA", className: "bg-indigo-600/10 text-indigo-400 border border-indigo-600/20" },
    { id: "sagesse", label: "Sagesse", text: "🧠 Sagesse", className: "bg-blue-600/10 text-blue-300 border border-blue-600/20" },
    { id: "multinocrit", label: "Multi No Crit", text: "🌈❌ Multi No Crit", className: "bg-slate-500/10 text-slate-400 border border-slate-500/20" },
    { id: "songes", label: "Songes", text: "🌙 Songes", className: "bg-violet-600/10 text-violet-400 border border-violet-600/20" },
    { id: "docrit", label: "Do Crit", text: "🎯 Do Crit", className: "bg-emerald-600/10 text-emerald-300 border border-emerald-600/20" },
    { id: "soin", label: "Soin", text: "💖 Soin", className: "bg-pink-600/10 text-pink-400 border border-pink-600/20" },
    { id: "leveling", label: "Leveling", text: "🆙 Leveling", className: "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20" }
];

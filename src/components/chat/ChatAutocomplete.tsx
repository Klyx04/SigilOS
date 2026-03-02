"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element, react-hooks/exhaustive-deps */
import React, { useEffect, useState } from "react";
import { Dice5, Sword, Shield, BookOpen, Skull, Map, UserCircle, Loader2 } from "lucide-react";

export type SlashCommandDef = {
    command: string;
    description: string;
    icon: React.ElementType;
    fetchApi?: {
        endpoint: string;
        path: string;
    };
};

export const AVAILABLE_COMMANDS: SlashCommandDef[] = [
    { command: "/roll", description: "Lancer un dé aléatoire (ex: /roll 100)", icon: Dice5 },
    { command: "/objet", description: "Chercher un objet sur DofusDB", icon: Sword, fetchApi: { endpoint: "items", path: "object" } },
    { command: "/pano", description: "Chercher une panoplie", icon: Shield, fetchApi: { endpoint: "item-sets", path: "item-sets" } },
    { command: "/classe", description: "Chercher une classe", icon: UserCircle, fetchApi: { endpoint: "breeds", path: "breeds" } },
    { command: "/quete", description: "Chercher une quête", icon: BookOpen, fetchApi: { endpoint: "quests", path: "quest" } },
    { command: "/monstre", description: "Chercher un monstre", icon: Skull, fetchApi: { endpoint: "monsters", path: "monster" } },
    { command: "/donjon", description: "Chercher un donjon", icon: Map, fetchApi: { endpoint: "dungeons", path: "dungeon" } },
];

const STATS_MAP: Record<number, string> = {
    // Primary
    125: "Vitalité", 118: "Force", 126: "Intelligence", 123: "Chance", 119: "Agilité", 124: "Sagesse", 138: "Puissance",
    // Combat
    111: "PA", 128: "PM", 117: "Portée", 115: "Critique", 178: "Soin", 112: "Dommages", 174: "Initiative", 176: "Prospection",
    // Secondary
    422: "Fuite", 423: "Tacle", 160: "Esquive PA", 161: "Esquive PM", 162: "Retrait PA", 163: "Retrait PM",
    410: "Dom. Neutre", 411: "Dom. Terre", 412: "Dom. Feu", 413: "Dom. Eau", 414: "Dom. Air",
    418: "Dom. Poussée", 419: "Res. Poussée", 420: "Dom. Critiques", 421: "Res. Critiques",
    // Resistances
    210: "% Res. Neutre", 211: "% Res. Terre", 212: "% Res. Feu", 213: "% Res. Eau", 214: "% Res. Air",
    215: "Res. Neutre", 216: "Res. Terre", 217: "Res. Feu", 218: "Res. Eau", 219: "Res. Air"
};

function formatItemStats(item: any): string {
    if (!item.effects || !Array.isArray(item.effects)) return "";
    const stats: string[] = [];
    for (const eff of item.effects) {
        const name = STATS_MAP[eff.effectId];
        if (name && (eff.from || eff.to)) {
            const val = eff.from || eff.to;
            stats.push(`+${val} ${name}`);
        }
    }
    return stats.length > 0 ? `\nStats: ${stats.join(", ")}` : "";
}

type SuggestionItem =
    | { type: "command"; data: SlashCommandDef }
    | { type: "api"; command: string; name: string; img?: string; id: number; path: string; meta?: string; stats?: string }
    | { type: "mention"; data: { type: "user" | "role"; id: string; name: string; image?: string } };

export interface ChatAutocompleteProps {
    input: string;
    onSelect: (val: string, autoSend?: boolean) => void;
    bottomOffset?: string;
    mentions?: { type: "user" | "role"; id: string; name: string; image?: string }[];
    userDisplayName?: string;
}

export function ChatAutocomplete({ input, onSelect, bottomOffset = "100%", mentions = [], userDisplayName }: ChatAutocompleteProps) {
    const [mounted, setMounted] = useState(false);
    const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        if (!input) {
            setSuggestions([]);
            return;
        }

        const parts = input.split(" ");
        const lastWord = parts[parts.length - 1];

        // 1. Mentions (@) anywhere
        if (lastWord.startsWith("@")) {
            const q = lastWord.slice(1).toLowerCase();
            const filtered = mentions.filter(m => m.name.toLowerCase().includes(q));

            setSuggestions(filtered.slice(0, 8).map(m => ({ type: "mention" as const, data: m })));
            setSelectedIndex(0);
            return;
        }

        // 2. Slash Commands (/) only at the start
        if (!input.startsWith("/")) {
            setSuggestions([]);
            return;
        }

        const baseCmd = parts[0];
        const cmdDef = AVAILABLE_COMMANDS.find(c => c.command === baseCmd);

        // Si la commande correspond et qu'on tape les arguments
        if (parts.length > 1 && cmdDef) {
            const query = parts.slice(1).join(" ");
            if (!cmdDef.fetchApi) {
                if (cmdDef.command === "/vote" && parts.length === 2 && !parts[1]) {
                    setSuggestions([{
                        type: "command",
                        data: { ...cmdDef, description: "Template: Question ? | Choix 1 | Choix 2" }
                    }]);
                    return;
                }
                setSuggestions([]);
                return;
            }
            if (query.length < 2) {
                setSuggestions([]);
                return;
            }

            // DofusDB API Debounce
            setIsLoading(true);
            const debounceTimer = setTimeout(async () => {
                try {
                    // Determine search key based on command
                    const searchKey = "slug.fr[$search]";
                    const params = new URLSearchParams({ lang: "fr" });

                    if (cmdDef.command === "/classe") {
                        params.append("$limit", "50"); // Fetch all breeds to allow local filtering
                    } else {
                        params.append(searchKey, query);
                        params.append("$limit", "5");
                    }

                    const url = `https://api.dofusdb.fr/${cmdDef.fetchApi!.endpoint}?${params.toString().replace(/%24/g, "$").replace(/%5B/g, "[").replace(/%5D/g, "]")}`;
                    const res = await fetch(url);
                    if (res.ok) {
                        const data = await res.json();
                        // DofusDB can return { data: [] } or just [] directly depending on the endpoint
                        const apiResults = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);

                        // For classes, since there are only 19, we filter locally if needed
                        let filtered = apiResults;
                        if (cmdDef.command === "/classe" && query) {
                            const lowQuery = query.toLowerCase();
                            filtered = apiResults.filter((b: any) => {
                                const fr = b.shortName?.fr?.toLowerCase() || "";
                                const en = b.shortName?.en?.toLowerCase() || "";
                                const frLong = b.name?.fr?.toLowerCase() || "";
                                const slug = b.slug?.fr?.toLowerCase() || "";
                                return fr.includes(lowQuery) || en.includes(lowQuery) || frLong.includes(lowQuery) || slug.includes(lowQuery);
                            });
                        }

                        const results: SuggestionItem[] = filtered.map((item: any) => {
                            let itemName = "Inconnu";
                            if (typeof item.name === "string") itemName = item.name;
                            else if (item.name?.fr) itemName = item.name.fr;
                            else if (item.shortName?.fr) itemName = item.shortName.fr;
                            else if (item.slug?.fr) itemName = item.slug.fr;

                            let itemImg = item.img || item.maleImg;
                            if (!itemImg && cmdDef.command === "/pano" && item.items?.[0]?.img) {
                                itemImg = item.items[0].img;
                            }

                            const itemType = item.type?.name?.fr || item.type?.name?.en || "";
                            const itemLevel = item.level ? `Niv. ${item.level}` : "";
                            const meta = [itemType, itemLevel].filter(Boolean).join(" - ");

                            return {
                                type: "api",
                                command: cmdDef.command,
                                name: itemName,
                                img: itemImg,
                                id: item?.id || item?._id || 0,
                                path: cmdDef.fetchApi!.path,
                                meta: meta ? `\n_${meta}_` : "",
                                stats: formatItemStats(item)
                            };
                        });
                        setSuggestions(results);
                        setSelectedIndex(0);
                    }
                } catch {
                    setSuggestions([]);
                } finally {
                    setIsLoading(false);
                }
            }, 400); // 400ms debounce

            return () => clearTimeout(debounceTimer);
        } else {
            // Filtrer les commandes de base
            const filtered = AVAILABLE_COMMANDS
                .filter(c => c.command.startsWith(input))
                .slice(0, 8)
                .map(c => ({ type: "command" as const, data: c }));
            setSuggestions(filtered);
            setSelectedIndex(0);
        }
    }, [input, mentions]);

    useEffect(() => {
        if (suggestions.length === 0) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % (suggestions.length || 1));
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + (suggestions.length || 1)) % (suggestions.length || 1));
            } else if (e.key === "Enter" || e.key === "Tab") {
                if (suggestions.length === 0) return;
                e.preventDefault();
                const item = suggestions[selectedIndex];
                if (item.type === "command") {
                    if (item.data.command === "/vote") {
                        onSelect("/vote Question ? | Choix 1 | Choix 2", false);
                        // We could try to set selection range here but we don't have the ref
                    } else {
                        onSelect(item.data.command + " ", false);
                    }
                } else if (item.type === "api") {
                    const imgUrl = item.img || "";
                    const imgMd = imgUrl ? `![${item.name}](${imgUrl})\n` : "";
                    const md = `! ${imgMd}**[${item.name}](https://dofusdb.fr/fr/database/${item.path}/${item.id})**${item.meta}${item.stats}`;
                    onSelect(md, true);
                } else if (item.type === "mention") {
                    const parts = input.split(" ");
                    parts.pop(); // Remove the partial `@` word
                    const prefix = parts.length > 0 ? parts.join(" ") + " " : "";
                    onSelect(`${prefix}@${item.data.name} `, false);
                }
            }
        };

        document.addEventListener("keydown", handleKeyDown, true);
        return () => document.removeEventListener("keydown", handleKeyDown, true);
    }, [suggestions, selectedIndex, onSelect]);

    if (!mounted || (suggestions.length === 0 && !isLoading)) return null;

    return (
        <div
            className="absolute left-0 right-0 z-30 mx-3 mb-2 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl shadow-black/80 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150"
            style={{ bottom: bottomOffset }}
        >
            <div className="px-3 py-1.5 bg-zinc-950/50 border-b border-white/5 flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                {isLoading ? "Recherche DofusDB..." : "Suggestions"}
                {isLoading && <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />}
            </div>

            <div className="p-1.5 max-h-[160px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {(suggestions || []).map((item, idx) => {
                    if (!item) return null;
                    const isActive = idx === selectedIndex;

                    if (item.type === "command") {
                        const Icon = item.data.icon;
                        return (
                            <button
                                key={item.data.command}
                                onClick={() => onSelect(item.data.command + " ")}
                                onMouseEnter={() => setSelectedIndex(idx)}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${isActive ? "bg-indigo-600/20 text-indigo-300" : "text-zinc-300 hover:bg-white/5"}`}
                            >
                                <div className={`p-1.5 rounded-md ${isActive ? "bg-indigo-600/30 text-indigo-400" : "bg-zinc-800 text-zinc-400"}`}>
                                    <Icon className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-semibold font-mono">{item.data.command}</span>
                                    <span className={`text-[10px] ${isActive ? "text-indigo-400/80" : "text-zinc-500"}`}>
                                        {item.data.description}
                                    </span>
                                </div>
                            </button>
                        );
                    } else if (item.type === "mention") {
                        const isRole = item.data.type === "role";
                        return (
                            <button
                                key={item.data.id}
                                onClick={() => {
                                    const parts = input.split(" ");
                                    parts.pop(); // Remove the partial `@` word
                                    const prefix = parts.length > 0 ? parts.join(" ") + " " : "";
                                    onSelect(`${prefix}@${item.data.name} `, false);
                                }}
                                onMouseEnter={() => setSelectedIndex(idx)}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${isActive ? "bg-indigo-600/20 text-indigo-300" : "text-zinc-300 hover:bg-white/5"}`}
                            >
                                <div className="w-9 h-9 shrink-0 bg-zinc-800 rounded-lg flex items-center justify-center overflow-hidden">
                                    {isRole ? (
                                        <Shield className="w-5 h-5 text-indigo-400" />
                                    ) : item.data.image ? (
                                        <img src={item.data.image} alt={item.data.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-sm font-bold text-zinc-400 text-center">{item.data.name[0]?.toUpperCase()}</span>
                                    )}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold truncate">@{item.data.name}</span>
                                    <span className={`text-[10px] ${isActive ? "text-indigo-400/80" : "text-zinc-500"}`}>
                                        {isRole ? "Rôle" : "Membre"}
                                    </span>
                                </div>
                            </button>
                        );
                    } else {
                        // API Search result
                        const Icon = AVAILABLE_COMMANDS.find(c => c.command === item.command)?.icon || Sword;
                        return (
                            <button
                                key={item.id + (item.meta || "") + idx}
                                onClick={() => {
                                    const imgMd = item.img ? `![${item.name}](${item.img})\n` : "";
                                    const sharerMd = userDisplayName ? `**${userDisplayName}** partage ` : "";
                                    const md = `! ${imgMd}${sharerMd}**[${item.name}](https://dofusdb.fr/fr/database/${item.path}/${item.id})**${item.meta}${item.stats}`;
                                    onSelect(md, true);
                                }}
                                onMouseEnter={() => setSelectedIndex(idx)}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${isActive ? "bg-indigo-600/20 text-indigo-300" : "text-zinc-300 hover:bg-white/5"}`}
                            >
                                <div className="w-9 h-9 shrink-0 bg-zinc-800 rounded-lg border border-white/5 flex items-center justify-center p-1 overflow-hidden relative">
                                    {item.img ? (
                                        <>
                                            <img
                                                src={item.img}
                                                alt={item.name}
                                                className="w-full h-full object-contain relative z-10"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                    if (e.currentTarget.nextElementSibling) {
                                                        (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block';
                                                    }
                                                }}
                                            />
                                            <Icon className="w-4 h-4 text-zinc-600 hidden" />
                                        </>
                                    ) : (
                                        <Icon className="w-4 h-4 text-zinc-600" />
                                    )}
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold truncate">{item.name}</span>
                                        {item.meta && (
                                            <span className="text-[9px] text-zinc-500 font-medium italic">
                                                {item.meta.replace("\n_", "").replace("_", "")}
                                            </span>
                                        )}
                                    </div>
                                    {item.stats && (
                                        <span className={`text-[9px] truncate tracking-tight font-medium ${isActive ? "text-indigo-400/70" : "text-zinc-600"}`}>
                                            {item.stats.replace("\nStats: ", "")}
                                        </span>
                                    )}
                                </div>
                            </button>
                        );
                    }
                })}
            </div>
        </div>
    );
}

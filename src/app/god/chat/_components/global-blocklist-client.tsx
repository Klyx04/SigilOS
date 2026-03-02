"use client";

import { useState } from "react";
import {
    Plus,
    Trash2,
    ShieldAlert,
    ShieldCheck,
    Search,
    Type,
    Code,
    AlertTriangle,
    Zap,
    BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { addGlobalBlockword, removeGlobalBlockword } from "@/server/actions/chat-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface GlobalBlocklistClientProps {
    initialData: {
        words: string[];
        baseWords: string[];
        allowedDomains: string[];
    };
}

export function GlobalBlocklistClient({ initialData }: GlobalBlocklistClientProps) {
    const [words, setWords] = useState<string[]>(initialData.words);
    const [baseWords, setBaseWords] = useState<string[]>(initialData.baseWords);
    const [domains, setDomains] = useState<string[]>(initialData.allowedDomains);

    const [activeTab, setActiveTab] = useState<"CUSTOM" | "BASE" | "DOMAIN">("CUSTOM");
    const [newWord, setNewWord] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);

    const currentList = activeTab === "CUSTOM" ? words : activeTab === "BASE" ? baseWords : domains;

    const filteredList = currentList.filter(w =>
        w.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const isRegex = (w: string) => w.startsWith("/") && w.endsWith("/") && w.length > 2;

    const handleAdd = async () => {
        const clean = newWord.trim();
        if (!clean) return;

        if (currentList.includes(clean)) {
            toast.error("Déjà présent dans cette liste");
            return;
        }

        setIsProcessing(true);
        try {
            const res = await addGlobalBlockword(clean, activeTab);
            if (res.success) {
                // If domain, we should use the hostname extracted by server for the local state update
                let actualWord = clean;
                if (activeTab === "DOMAIN") {
                    try {
                        if (actualWord.includes("://")) actualWord = new URL(actualWord).hostname;
                        else if (actualWord.includes("/")) actualWord = actualWord.split("/")[0];
                    } catch { }
                    actualWord = actualWord.toLowerCase();
                }

                if (activeTab === "CUSTOM") setWords([...words, actualWord]);
                if (activeTab === "BASE") setBaseWords([...baseWords, actualWord]);
                if (activeTab === "DOMAIN") setDomains(Array.from(new Set([...domains, actualWord])));

                setNewWord("");
                toast.success("Mise à jour effectuée");
            } else {
                toast.error(res.error || "Erreur lors de l'ajout");
            }
        } catch (error) {
            toast.error("Erreur serveur lors de l'ajout");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRemove = async (word: string) => {
        setIsProcessing(true);
        try {
            const res = await removeGlobalBlockword(word, activeTab);
            if (res.success) {
                if (activeTab === "CUSTOM") setWords(words.filter(w => w !== word));
                if (activeTab === "BASE") setBaseWords(baseWords.filter(w => w !== word));
                if (activeTab === "DOMAIN") setDomains(domains.filter(w => w !== word));
                toast.success("Élément retiré");
            } else {
                toast.error(res.error || "Erreur lors du retrait");
            }
        } catch (error) {
            toast.error("Erreur serveur lors du retrait");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="grid gap-8 md:grid-cols-12">
            {/* Control Panel */}
            <Card className="md:col-span-12 border-rose-500/20 bg-rose-500/[0.02] backdrop-blur-xl">
                <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-rose-500/10">
                    <div className="space-y-2">
                        <CardTitle className="text-3xl font-black uppercase tracking-widest flex items-center gap-4 text-white">
                            <Zap className="w-8 h-8 text-rose-500 fill-rose-500/20" />
                            Pare-feu Global
                        </CardTitle>
                        <CardDescription className="text-zinc-400 font-medium text-lg">
                            Configuration temps-réel de l'infrastructure de filtrage.
                        </CardDescription>
                    </div>

                    <div className="flex bg-zinc-950 p-1.5 rounded-2xl border border-white/5">
                        <button
                            onClick={() => setActiveTab("CUSTOM")}
                            className={cn(
                                "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                                activeTab === "CUSTOM" ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20" : "text-zinc-500 hover:text-white"
                            )}
                        >
                            Custom
                        </button>
                        <button
                            onClick={() => setActiveTab("BASE")}
                            className={cn(
                                "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                                activeTab === "BASE" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" : "text-zinc-500 hover:text-white"
                            )}
                        >
                            Base SigilOS
                        </button>
                        <button
                            onClick={() => setActiveTab("DOMAIN")}
                            className={cn(
                                "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                                activeTab === "DOMAIN" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-zinc-500 hover:text-white"
                            )}
                        >
                            Whitelist URLs
                        </button>
                    </div>
                </CardHeader>

                <CardContent className="pt-10">
                    <div className="flex flex-col gap-10">
                        {/* Search & Add */}
                        <div className="flex flex-col lg:flex-row gap-6">
                            <div className="flex-1 p-8 rounded-3xl bg-zinc-950/80 border border-white/5 shadow-2xl space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 ml-4">
                                    {activeTab === "DOMAIN" ? "Ajouter un domaine (ex: google.com)" : "Ajouter un terme ou Regex"}
                                </label>
                                <div className="flex gap-4">
                                    <Input
                                        placeholder={activeTab === "DOMAIN" ? "ex: typeshare.io" : "ex: /scam/ ou ntm"}
                                        value={newWord}
                                        onChange={(e) => setNewWord(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                                        className="bg-black/80 border-white/10 h-16 text-xl font-mono px-8 rounded-2xl focus:ring-rose-500/20 flex-1"
                                    />
                                    <Button
                                        onClick={handleAdd}
                                        disabled={isProcessing}
                                        className={cn(
                                            "h-16 px-10 font-black uppercase tracking-widest rounded-2xl shadow-lg transition-all active:scale-95",
                                            activeTab === "CUSTOM" ? "bg-rose-600 hover:bg-rose-500 shadow-rose-500/20" :
                                                activeTab === "BASE" ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20" :
                                                    "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20"
                                        )}
                                    >
                                        <Plus className="w-6 h-6" />
                                    </Button>
                                </div>
                            </div>

                            <div className="w-full lg:w-96 flex flex-col justify-end p-8 rounded-3xl bg-zinc-950/40 border border-white/5">
                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 ml-4 mb-4">Recherche rapide</label>
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                                    <Input
                                        placeholder="Filtrer la vue..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-12 bg-zinc-900 border-white/5 h-12 rounded-xl"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Results List */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between px-2">
                                <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.4em] flex items-center gap-3">
                                    {activeTab === "CUSTOM" && <Zap className="w-4 h-4 text-rose-500" />}
                                    {activeTab === "BASE" && <BookOpen className="w-4 h-4 text-emerald-500" />}
                                    {activeTab === "DOMAIN" && <ShieldCheck className="w-4 h-4 text-indigo-500" />}
                                    {activeTab} {activeTab === "DOMAIN" ? "WHITELIST" : "BLOCKLIST"} ({currentList.length})
                                </h3>
                                {activeTab === "BASE" && (
                                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-black uppercase tracking-tighter text-[9px]">SigilOS Standard</Badge>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                {filteredList.length === 0 ? (
                                    <div className="col-span-full py-24 flex flex-col items-center justify-center text-zinc-500 italic border-2 border-dashed border-white/[0.02] rounded-[40px] bg-zinc-900/40">
                                        <Search className="w-12 h-12 mb-4 opacity-5" />
                                        Aucun résultat pour cette vue
                                    </div>
                                ) : (
                                    filteredList.map((word) => (
                                        <div
                                            key={word}
                                            className={cn(
                                                "group flex items-center justify-between p-4 rounded-2xl border transition-all hover:scale-[1.02]",
                                                activeTab === "CUSTOM" ? "bg-rose-500/[0.03] border-rose-500/10 hover:border-rose-500/30" :
                                                    activeTab === "BASE" ? "bg-emerald-500/[0.03] border-emerald-500/10 hover:border-emerald-500/30" :
                                                        "bg-indigo-500/[0.03] border-indigo-500/10 hover:border-indigo-500/30"
                                            )}
                                        >
                                            <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
                                                {isRegex(word) ? (
                                                    <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 shrink-0">
                                                        <Code className="w-4 h-4" />
                                                    </div>
                                                ) : activeTab === "DOMAIN" ? (
                                                    <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 shrink-0">
                                                        <ShieldCheck className="w-4 h-4" />
                                                    </div>
                                                ) : (
                                                    <div className="p-2 rounded-lg bg-zinc-800 text-zinc-500 shrink-0">
                                                        <Type className="w-4 h-4" />
                                                    </div>
                                                )}
                                                <span className={cn(
                                                    "font-mono font-bold tracking-tight text-sm break-all",
                                                    isRegex(word) ? "text-indigo-400" : "text-zinc-200"
                                                )}>
                                                    {word}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleRemove(word)}
                                                disabled={isProcessing}
                                                className="shrink-0 opacity-0 group-hover:opacity-100 p-2 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all transform hover:rotate-6 active:scale-90"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>

                <CardFooter className="p-10 border-t border-rose-500/10 flex flex-col md:flex-row gap-8 items-start justify-between bg-rose-500/[0.01]">
                    <div className="flex gap-4 max-w-xl">
                        <AlertTriangle className="w-8 h-8 text-rose-500 shrink-0" />
                        <div className="space-y-2">
                            <p className="font-black text-rose-400 uppercase tracking-widest text-sm">Contrôle Alpha & Oméga</p>
                            <p className="text-zinc-500 text-xs font-medium leading-relaxed italic">
                                Tu modifies ici les fondations de la modération SigilOS.
                                La section **Base** écrase la liste codée en dur si elle contient des éléments.
                                La section **Whitelist** définit les seuls domaines autorisés à être partagés.
                            </p>
                        </div>
                    </div>
                </CardFooter>
            </Card>
        </div >
    );
}

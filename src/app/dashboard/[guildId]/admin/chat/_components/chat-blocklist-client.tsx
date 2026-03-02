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
    AlertCircle,
    Save
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
import { updateChatBlocklist } from "@/server/actions/chat-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ChatBlocklistClientProps {
    initialWords: string[];
    discordGuildId: string;
}

export function ChatBlocklistClient({ initialWords, discordGuildId }: ChatBlocklistClientProps) {
    const [words, setWords] = useState<string[]>(initialWords);
    const [newWord, setNewWord] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const filteredWords = words.filter(w =>
        w.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const isRegex = (w: string) => w.startsWith("/") && w.endsWith("/") && w.length > 2;

    const handleAdd = () => {
        const clean = newWord.trim();
        if (!clean) return;
        if (words.includes(clean)) {
            toast.error("Mot déjà présent");
            return;
        }
        setWords([...words, clean]);
        setNewWord("");
        toast.info("N'oubliez pas d'enregistrer les modifications");
    };

    const handleRemove = (word: string) => {
        setWords(words.filter(w => w !== word));
        toast.info("Mot retiré - Pensez à enregistrer");
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await updateChatBlocklist(discordGuildId, words);
            if (res.success) {
                toast.success("Blocklist mise à jour avec succès");
            } else {
                toast.error(res.error || "Erreur de sauvegarde");
            }
        } catch (error) {
            toast.error("Erreur serveur lors de la sauvegarde");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="grid gap-6 md:grid-cols-12">
            {/* Left — Add Word */}
            <Card className="md:col-span-4 border-white/10 bg-black/40 backdrop-blur-xl">
                <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                        <Plus className="w-5 h-5 text-indigo-400" />
                        Ajouter un mot
                    </CardTitle>
                    <CardDescription>
                        Ajoutez des mots ou des regex (/pattern/) à filtrer.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Input
                            placeholder="ex: salope ou /p[u*]te/"
                            value={newWord}
                            onChange={(e) => setNewWord(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                            className="bg-white/5 border-white/10"
                        />
                        {isRegex(newWord) && (
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300">
                                <Code className="w-4 h-4" />
                                <span>Interprété comme une Expression Régulière (Regex)</span>
                            </div>
                        )}
                    </div>
                </CardContent>
                <CardFooter>
                    <Button
                        onClick={handleAdd}
                        className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-500/20"
                    >
                        Ajouter à la liste
                    </Button>
                </CardFooter>
            </Card>

            {/* Right — List & Search */}
            <Card className="md:col-span-8 border-white/10 bg-black/40 backdrop-blur-xl">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                        <CardTitle className="text-xl flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5 text-rose-500" />
                            Liste des interdictions
                        </CardTitle>
                        <CardDescription>
                            {words.length} mots/motifs actifs (en plus des filtres plateforme de base)
                        </CardDescription>
                    </div>
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Chercher..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-white/5 border-white/10 h-9"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2 max-h-[400px] overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-white/10">
                        {filteredWords.length === 0 ? (
                            <div className="w-full py-12 flex flex-col items-center justify-center text-muted-foreground italic border-2 border-dashed border-white/5 rounded-xl bg-white/5">
                                <Search className="w-8 h-8 mb-2 opacity-20" />
                                Aucun mot trouvé
                            </div>
                        ) : (
                            filteredWords.map((word) => (
                                <Badge
                                    key={word}
                                    variant="secondary"
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 text-sm group transition-all animate-in fade-in zoom-in duration-200",
                                        isRegex(word) ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300" : "bg-white/5 border-white/10"
                                    )}
                                >
                                    {isRegex(word) ? <Code className="w-3.5 h-3.5" /> : <Type className="w-3.5 h-3.5" />}
                                    {word}
                                    <button
                                        onClick={() => handleRemove(word)}
                                        className="hover:text-rose-500 transition-colors ml-1 p-0.5"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </Badge>
                            ))
                        )}
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between border-t border-white/5 p-6 bg-white/[0.02]">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <AlertCircle className="w-4 h-4 text-amber-500/70" />
                        <span>Les modifications ne sont effectives qu'après enregistrement.</span>
                    </div>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-emerald-600 hover:bg-emerald-500 min-w-32 shadow-lg shadow-emerald-500/20"
                    >
                        {isSaving ? "Sauvegarde..." : (
                            <>
                                <Save className="w-4 h-4 mr-2" />
                                Enregistrer
                            </>
                        )}
                    </Button>
                </CardFooter>
            </Card>

            {/* Note Section */}
            <div className="md:col-span-12">
                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-sm text-amber-200/80 flex gap-4">
                    <ShieldCheck className="w-6 h-6 text-amber-500 shrink-0" />
                    <div>
                        <p className="font-semibold mb-1">Règles de filtrage automatiques</p>
                        <p className="opacity-70">
                            SigilOS applique déjà un filtrage intelligent (normalisation Unicode) qui gère les accents et le Leet Speak de base.
                            Inutile d'ajouter "enculé", "encule", "Ëñçülé" — ajouter "enculé" suffit pour bloquer toutes les variantes.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

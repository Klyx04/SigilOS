"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Unlink, ShieldAlert, Loader2, Search, User } from "lucide-react";
import { adminForceUnlink, searchMetamobPseudos } from "@/server/actions/ocre-actions";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export function MetamobUnlocker({ guildId }: { guildId: string }) {
    const [targetPseudo, setTargetPseudo] = useState("");
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Search suggestions
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (targetPseudo.length >= 2) {
                setIsSearching(true);
                const res = await searchMetamobPseudos(guildId, targetPseudo);
                if (res.success && res.data) {
                    setSuggestions(res.data);
                    setShowSuggestions(res.data.length > 0);
                }
                setIsSearching(false);
            } else {
                setSuggestions([]);
                setShowSuggestions(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [targetPseudo, guildId]);

    const handleUnlock = async () => {
        if (!targetPseudo.trim()) return;

        setIsLoading(true);
        setStatus("idle");

        try {
            const result = await adminForceUnlink({
                guildId,
                targetPseudo: targetPseudo.trim()
            });

            if (result.success) {
                toast.success(`Le compte Metamob "${targetPseudo}" a été libéré !`);
                setStatus("success");
                setTargetPseudo("");
            } else {
                toast.error(result.error || "Erreur lors du déblocage");
                setStatus("error");
            }
        } catch (e) {
            toast.error("Erreur technique");
            setStatus("error");
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <Card className="border-red-500/20 bg-red-500/5 overflow-visible">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-400">
                    <ShieldAlert className="w-5 h-5" />
                    Déblocage d'Urgence
                </CardTitle>
                <CardDescription>
                    Utilisez cet outil pour délier un compte Metamob bloqué par un ancien membre ou un profil fantôme.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 relative">
                <div className="flex gap-3 relative">
                    <div className="relative flex-1">
                        <Search className={cn(
                            "absolute left-3 top-3 h-4 w-4 text-muted-foreground",
                            isSearching && "animate-pulse"
                        )} />
                        <Input
                            placeholder="Pseudo Metamob à libérer..."
                            value={targetPseudo}
                            onChange={(e) => setTargetPseudo(e.target.value)}
                            onFocus={() => targetPseudo.length >= 2 && setShowSuggestions(true)}
                            className="pl-9 bg-black/20 border-red-500/10 focus:border-red-500/30"
                        />

                        {/* Suggestions Dropdown */}
                        {showSuggestions && suggestions.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-red-500/20 rounded-md shadow-2xl z-50 overflow-hidden">
                                {suggestions.map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => {
                                            setTargetPseudo(s);
                                            setShowSuggestions(false);
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-red-500/10 hover:text-white flex items-center gap-2"
                                    >
                                        <User className="w-3 h-3 text-red-500/50" />
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant="destructive"
                                disabled={!targetPseudo.trim() || isLoading}
                                className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20"
                            >
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
                                <span className="ml-2 hidden sm:inline">Libérer</span>
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-white">Êtes-vous sûr ?</AlertDialogTitle>
                                <AlertDialogDescription className="text-zinc-400">
                                    Cette action va <span className="text-red-400 font-bold">délier immédiatement</span> le compte Metamob "{targetPseudo}" de son utilisateur actuel sur SigilOS.
                                    <br /><br />
                                    L'utilisateur devra relier son compte manuellement s'il souhaite l'utiliser à nouveau.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-750">Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={handleUnlock} className="bg-red-600 hover:bg-red-700 text-white border-none">
                                    Confirmer le déblocage
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>

                {status === "success" && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded text-sm text-emerald-400 animate-in fade-in slide-in-from-top-1">
                        Opération réussie. Le pseudo est maintenant libre.
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

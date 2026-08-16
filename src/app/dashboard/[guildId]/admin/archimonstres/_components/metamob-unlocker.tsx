"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Unlink, ShieldAlert, Loader2, Search, User, X, AlertTriangle, ArrowRight } from "lucide-react";
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
                toast.success(`Compte "${targetPseudo}" libéré !`);
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
        <Card className="bg-zinc-950/40 border-amber-500/10 overflow-visible relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            
            <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
                        <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                        <CardTitle className="text-white font-black uppercase tracking-tighter text-base">
                            Déblocage d'Urgence
                        </CardTitle>
                        <CardDescription className="text-caption font-medium text-zinc-500">
                            Libérez un pseudo Metamob lié par erreur ou par un ancien membre.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-6 relative">
                <div className="flex flex-col sm:flex-row gap-3 relative">
                    <div className="relative flex-1">
                        <div className="relative group/input">
                            <Input
                                placeholder="Rechercher un pseudo Metamob..."
                                value={targetPseudo}
                                onChange={(e) => setTargetPseudo(e.target.value)}
                                onFocus={() => targetPseudo.length >= 2 && setShowSuggestions(true)}
                                className={cn(
                                    "pl-10 h-12 bg-black/40 border-white/5 focus:border-amber-500/30 transition-all font-mono text-sm",
                                    status === "success" && "border-emerald-500/30"
                                )}
                            />
                            <Search className={cn(
                                "absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors",
                                isSearching ? "text-amber-500 animate-pulse" : "text-zinc-600 group-focus-within/input:text-amber-500"
                            )} />
                            
                            {targetPseudo && (
                                <button 
                                    onClick={() => setTargetPseudo("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/5 rounded-full text-zinc-500 hover:text-white transition-colors"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Suggestions Dropdown (Refined) */}
                        {showSuggestions && suggestions.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                                <div className="px-3 py-2 bg-white/5 border-b border-white/5 text-caption font-black uppercase tracking-widest text-zinc-500 flex justify-between">
                                    <span>Résultats Trouvés</span>
                                    <span>{suggestions.length}</span>
                                </div>
                                <div className="max-h-48 overflow-y-auto">
                                    {suggestions.map((s) => (
                                        <button
                                            key={s}
                                            onClick={() => {
                                                setTargetPseudo(s);
                                                setShowSuggestions(false);
                                            }}
                                            className="w-full text-left px-4 py-3 text-sm text-zinc-300 hover:bg-amber-500/10 hover:text-white flex items-center justify-between group/item transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-6 h-6 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-500 group-hover/item:text-amber-400">
                                                    <User className="w-3.5 h-3.5" />
                                                </div>
                                                <span className="font-mono">{s}</span>
                                            </div>
                                            <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover/item:opacity-100 -translate-x-2 group-hover/item:translate-x-0 transition-all text-amber-500" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant="destructive"
                                disabled={!targetPseudo.trim() || isLoading}
                                className="h-12 px-6 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/20 transition-all font-black uppercase tracking-widest text-caption"
                            >
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4 mr-2" />}
                                Libérer le compte
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-zinc-950 border border-white/10 shadow-2xl">
                            <AlertDialogHeader>
                                <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
                                    <AlertTriangle className="w-6 h-6 text-red-500" />
                                </div>
                                <AlertDialogTitle className="text-white text-xl font-black tracking-tighter uppercase">Confirmation Requise</AlertDialogTitle>
                                <AlertDialogDescription className="text-zinc-400 text-sm leading-relaxed">
                                    Vous allez détacher le compte Metamob <span className="text-red-400 font-mono font-bold bg-red-500/10 px-2 py-0.5 rounded">"{targetPseudo}"</span>. 
                                    <br /><br />
                                    Cette action est <span className="text-white underline">immédiate</span>. L'utilisateur qui l'utilisait perdra l'accès à sa collection synchronisée sur SigilOS jusqu'à ce qu'il se reconnecte.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="mt-6">
                                <AlertDialogCancel className="bg-zinc-900 border-white/5 text-zinc-400 hover:bg-zinc-800 transition-colors">Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={handleUnlock} className="bg-red-600 hover:bg-red-500 text-white font-bold border-none shadow-lg shadow-red-600/20">
                                    Confirmer le déblocage
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>

                {status === "success" && (
                    <div className="flex items-center gap-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-caption text-emerald-400 font-medium animate-in slide-in-from-top-2">
                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                            <ArrowRight className="w-3 h-3" />
                        </div>
                        Opération réussie. Le pseudo est désormais libre pour une nouvelle liaison.
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

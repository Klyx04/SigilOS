"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Unlink, ShieldAlert, Loader2, Search } from "lucide-react";
import { adminForceUnlink } from "@/server/actions/ocre-actions";
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

export function MetamobUnlocker({ guildId }: { guildId: string }) {
    const [targetPseudo, setTargetPseudo] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

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
        <Card className="border-red-500/20 bg-red-500/5">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-400">
                    <ShieldAlert className="w-5 h-5" />
                    Déblocage d'Urgence
                </CardTitle>
                <CardDescription>
                    Utilisez cet outil pour délier un compte Metamob bloqué par un ancien membre ou un profil fantôme.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Pseudo Metamob à libérer..."
                            value={targetPseudo}
                            onChange={(e) => setTargetPseudo(e.target.value)}
                            className="pl-9 bg-black/20 border-red-500/10 focus:border-red-500/30"
                        />
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
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Cette action va **délier immédiatement** le compte Metamob "{targetPseudo}" de son utilisateur actuel sur SigilOS.
                                    <br /><br />
                                    L'utilisateur devra relier son compte manuellement s'il souhaite l'utiliser à nouveau.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={handleUnlock} className="bg-red-600 hover:bg-red-700">
                                    Confirmer le déblocage
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>

                {status === "success" && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded text-sm text-emerald-400">
                        Opération réussie. Le pseudo est maintenant libre.
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

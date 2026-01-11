"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, Save, Loader2, Info } from "lucide-react";
import { updateMyAchievementPoints } from "@/server/actions/ladder-actions";
import { getAchievementTier } from "@/lib/ladder-utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
    guildId: string;
};

export function AchievementsPanel({ guildId }: Props) {
    const [points, setPoints] = useState<string>("");
    const [isPending, startTransition] = useTransition();

    const handleSave = () => {
        const numPoints = parseInt(points, 10);
        if (isNaN(numPoints) || numPoints < 0) {
            toast.error("Veuillez entrer un nombre valide");
            return;
        }

        startTransition(async () => {
            const result = await updateMyAchievementPoints({
                guildId,
                points: numPoints
            });

            if (result.success) {
                toast.success("Points de succès mis à jour !");
            } else {
                toast.error(result.error || "Erreur lors de la mise à jour");
            }
        });
    };

    const previewTier = points ? getAchievementTier(parseInt(points, 10) || 0) : null;

    return (
        <Card className="bg-gradient-to-br from-amber-500/5 to-amber-500/0 border-amber-500/20">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-amber-400">
                    <Star className="h-5 w-5" />
                    Tes Points de Succès
                </CardTitle>
                <CardDescription>
                    Entre ton score de points de succès depuis ton profil Dofus pour participer au classement.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Info Box */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-200/80">
                        <p>Pour trouver tes points de succès :</p>
                        <ol className="list-decimal list-inside mt-1 space-y-1 text-xs text-blue-200/60">
                            <li>Ouvre ton profil Dofus (touche P)</li>
                            <li>Onglet &quot;Succès&quot;</li>
                            <li>Ton score est affiché en haut à droite</li>
                        </ol>
                    </div>
                </div>

                {/* Input */}
                <div className="flex items-end gap-3">
                    <div className="flex-1 space-y-2">
                        <Label htmlFor="achievement-points">Points de succès</Label>
                        <Input
                            id="achievement-points"
                            type="number"
                            min="0"
                            max="100000"
                            placeholder="Ex: 22675"
                            value={points}
                            onChange={(e) => setPoints(e.target.value)}
                            className="bg-muted/20 border-white/10"
                        />
                    </div>
                    <Button
                        onClick={handleSave}
                        disabled={isPending || !points}
                        className="bg-amber-500 hover:bg-amber-600 text-black"
                    >
                        {isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <>
                                <Save className="h-4 w-4 mr-2" />
                                Sauvegarder
                            </>
                        )}
                    </Button>
                </div>

                {/* Tier Preview */}
                {previewTier && (
                    <div className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border",
                        "bg-gradient-to-r from-muted/20 to-transparent"
                    )}>
                        <span className="text-2xl">{previewTier.icon}</span>
                        <div>
                            <p className="font-semibold" style={{ color: previewTier.color }}>
                                {previewTier.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Ton rang avec {parseInt(points, 10).toLocaleString()} points
                            </p>
                        </div>
                    </div>
                )}

                {/* Tiers Explanation */}
                <div className="pt-2 border-t border-white/5">
                    <p className="text-xs text-muted-foreground mb-2">Paliers :</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                        <span className="px-2 py-1 rounded bg-gray-500/20 text-gray-400">⚪ Novice &lt;10k</span>
                        <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400">💙 Explorateur 10k+</span>
                        <span className="px-2 py-1 rounded bg-purple-500/20 text-purple-400">💜 Aventurier 15k+</span>
                        <span className="px-2 py-1 rounded bg-orange-500/20 text-orange-400">🔶 Champion 20k+</span>
                        <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-400">👑 Légende 25k+</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

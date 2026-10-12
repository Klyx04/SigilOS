"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download, Loader2, CheckCircle2, SkipForward, AlertTriangle, Info } from "lucide-react";
import { siphonQuestsFromDofusDB } from "@/server/actions/game-data-admin-actions";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

/**
 * 🧲 #154 — « Siphonner les quêtes » : importe en masse les quêtes DofusDB dans la
 * table locale GameQuest pour qu'elles soient réutilisables dans les posts DJ/quêtes
 * (recherche locale d'abord, fallback dofusdb ensuite).
 */
export function QuestSiphonPanel() {
    const [limit, setLimit] = useState("100");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ created: number; skipped: number; errors: number } | null>(null);

    async function handleSiphon() {
        setLoading(true);
        setResult(null);
        try {
            const parsed = parseInt(limit, 10);
            const res = await siphonQuestsFromDofusDB(Number.isFinite(parsed) ? parsed : 100);
            if (res.success && res.data) {
                setResult(res.data);
                toast.success(`${res.data.created} quête(s) siphonnée(s) depuis DofusDB`);
            } else {
                toast.error(res.error || "Erreur lors du siphonnage");
            }
        } catch (e: any) {
            toast.error(e.message || "Erreur de connexion");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="bg-background/40 border border-border rounded-2xl p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <Download className="w-5 h-5 text-sky-400" />
                        Siphonner les quêtes DofusDB
                        <span className="text-caption text-sky-400/80 font-black uppercase tracking-wider">· Import initial</span>
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                        <strong className="text-foreground">Étape 1</strong> · importe EN MASSE des quêtes depuis DofusDB dans la base locale <strong className="text-foreground">GameQuest</strong>.
                        Une fois importées, elles deviennent proposables dans les posts Donjons/Quêtes (recherche locale d&apos;abord,
                        fallback DofusDB si absentes). Les doublons (par ID ou par nom) sont ignorés.
                    </p>
                    <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                        ℹ️ Cet <strong className="text-foreground">import initial</strong> (avec plafond) ne se confond pas avec le
                        suivi des <strong className="text-foreground">écarts</strong> DofusDB : celui-ci se lance depuis
                        {' '}<strong className="text-foreground">📊 Tableau</strong> (dataset « Quêtes » — nouvelles/modifiées, en
                        arrière-plan), et la synchro <strong className="text-foreground">sélective</strong> quête par quête vit dans
                        l&apos;onglet <strong className="text-foreground">🛰️ Siphons DofusDB</strong>.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Input
                        type="number"
                        min={10}
                        max={500}
                        value={limit}
                        onChange={e => setLimit(e.target.value)}
                        className="w-28 bg-black/40 border-border h-10 rounded-xl text-sm"
                        aria-label="Nombre de quêtes à siphonner"
                    />
                    <Button
                        onClick={handleSiphon}
                        disabled={loading}
                        className="bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl h-10 px-5"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        {loading ? "Siphonnage..." : "Siphonner les quêtes"}
                    </Button>
                </div>
            </div>

            {result && (
                <div className="flex flex-wrap items-center gap-2 animate-in fade-in duration-200">
                    <Badge className="bg-success/10 text-success border border-success/20 gap-1">
                        <CheckCircle2 className="w-3 h-3" /> {result.created} importée{result.created > 1 ? "s" : ""}
                    </Badge>
                    <Badge className="bg-muted/20 text-muted-foreground border border-border gap-1">
                        <SkipForward className="w-3 h-3" /> {result.skipped} déjà présente{result.skipped > 1 ? "s" : ""}
                    </Badge>
                    {result.errors > 0 && (
                        <Badge className="bg-danger/10 text-danger border border-danger/20 gap-1">
                            <AlertTriangle className="w-3 h-3" /> {result.errors} erreur{result.errors > 1 ? "s" : ""}
                        </Badge>
                    )}
                </div>
            )}

            <p className="flex items-start gap-1.5 text-caption text-muted-foreground">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-muted-foreground/70" />
                <span><strong className="text-foreground">Ici</strong> : import initial en masse (nouvelles quêtes DofusDB). <strong className="text-foreground">Panneau suivant (« Synchronisation »)</strong> : analyse puis applique les écarts sur les quêtes déjà importées.</span>
            </p>
        </div>
    );
}

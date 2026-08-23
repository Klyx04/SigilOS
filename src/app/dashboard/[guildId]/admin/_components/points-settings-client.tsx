"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Save, RotateCcw, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
    getGuildPointsConfig,
    updateGuildPointsConfig,
} from "@/server/actions/points-config-actions";
import { DEFAULT_POINTS_CONFIG, type GuildPointsConfig } from "@/lib/points-config";

type FieldKey = keyof GuildPointsConfig;
type FieldGroup = "DJ & Quêtes" | "Songes";

const FIELDS: { key: FieldKey; label: string; hint: string; group: FieldGroup }[] = [
    { key: "djQuest", label: "Quête", hint: "Post quête (sans niveau)", group: "DJ & Quêtes" },
    { key: "djLvl1_99", label: "Donjon 1-99", hint: "Bas niveau", group: "DJ & Quêtes" },
    { key: "djLvl100_149", label: "Donjon 100-149", hint: "Milieu", group: "DJ & Quêtes" },
    { key: "djLvl150_199", label: "Donjon 150-199", hint: "Haut niveau", group: "DJ & Quêtes" },
    { key: "djLvl200Plus", label: "Donjon 200+", hint: "Endgame", group: "DJ & Quêtes" },
    { key: "songesReve", label: "Rêve I / II / III", hint: "Difficulté Rêve", group: "Songes" },
    { key: "songesParadoxe", label: "Paradoxe I à IV", hint: "Difficulté Paradoxe", group: "Songes" },
    { key: "songesCauchemar", label: "Cauchemar I à III", hint: "Difficulté Cauchemar", group: "Songes" },
];

const GROUPS: FieldGroup[] = ["DJ & Quêtes", "Songes"];

export function PointsSettingsClient({ guildId }: { guildId: string }) {
    const [form, setForm] = useState<GuildPointsConfig>({ ...DEFAULT_POINTS_CONFIG });
    const [loaded, setLoaded] = useState(false);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        let mounted = true;
        getGuildPointsConfig(guildId).then((res) => {
            if (mounted && res.success && res.data) setForm(res.data);
            if (mounted) setLoaded(true);
        });
        return () => { mounted = false; };
    }, [guildId]);

    const setField = (key: FieldKey, value: string) => {
        const n = parseInt(value, 10);
        setForm((prev) => ({ ...prev, [key]: Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0 }));
    };

    const handleSave = () => {
        startTransition(async () => {
            const res = await updateGuildPointsConfig(guildId, form);
            if (res.success) toast.success("Points de contribution mis à jour !");
            else toast.error(res.error || "Erreur lors de la sauvegarde");
        });
    };

    const handleReset = () => {
        startTransition(async () => {
            const res = await updateGuildPointsConfig(guildId, { ...DEFAULT_POINTS_CONFIG });
            if (res.success) toast.success("Points réinitialisés aux valeurs par défaut.");
            else toast.error(res.error || "Erreur lors de la réinitialisation");
            setForm({ ...DEFAULT_POINTS_CONFIG });
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-caption font-black text-foreground/40 uppercase tracking-widest">
                    <Shield className="w-4 h-4 text-success" />
                    Points attribués à la clôture — réservé aux administrateurs
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        onClick={handleReset}
                        disabled={isPending}
                        className="h-10 border-border bg-surface hover:bg-surface text-foreground/70 text-caption font-black uppercase tracking-widest"
                    >
                        <RotateCcw className="w-3.5 h-3.5 mr-2" />
                        Défauts
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isPending}
                        className="h-10 bg-success hover:bg-success text-success-foreground text-caption font-black uppercase tracking-widest"
                    >
                        {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        Enregistrer
                    </Button>
                </div>
            </div>

            {!loaded ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 text-success animate-spin" />
                </div>
            ) : (
                GROUPS.map((group) => (
                    <div key={group} className="rounded-2xl border border-border bg-surface overflow-hidden">
                        <div className="px-5 py-3 border-b border-border">
                            <h3 className="text-xs font-black text-foreground uppercase tracking-widest">{group}</h3>
                        </div>
                        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {FIELDS.filter((f) => f.group === group).map((f) => (
                                <label key={f.key} className="space-y-1.5 block">
                                    <span className="flex items-center justify-between text-caption font-bold text-foreground/60 uppercase tracking-wider">
                                        {f.label}
                                        <span className="text-foreground/25 normal-case font-medium">{f.hint}</span>
                                    </span>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={form[f.key]}
                                        onChange={(e) => setField(f.key, e.target.value)}
                                        className="bg-surface border-border text-sm font-bold h-10"
                                    />
                                </label>
                            ))}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}

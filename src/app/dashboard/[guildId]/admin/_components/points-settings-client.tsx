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
                <div className="flex items-center gap-2.5 text-[10px] font-black text-white/40 uppercase tracking-widest">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    Points attribués à la clôture — réservé aux administrateurs
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        onClick={handleReset}
                        disabled={isPending}
                        className="h-10 border-white/10 bg-white/5 hover:bg-white/10 text-white/70 text-[10px] font-black uppercase tracking-widest"
                    >
                        <RotateCcw className="w-3.5 h-3.5 mr-2" />
                        Défauts
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isPending}
                        className="h-10 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest"
                    >
                        {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        Enregistrer
                    </Button>
                </div>
            </div>

            {!loaded ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
                </div>
            ) : (
                GROUPS.map((group) => (
                    <div key={group} className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
                        <div className="px-5 py-3 border-b border-white/5">
                            <h3 className="text-xs font-black text-white uppercase tracking-widest">{group}</h3>
                        </div>
                        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {FIELDS.filter((f) => f.group === group).map((f) => (
                                <label key={f.key} className="space-y-1.5 block">
                                    <span className="flex items-center justify-between text-[10px] font-bold text-white/60 uppercase tracking-wider">
                                        {f.label}
                                        <span className="text-white/25 normal-case font-medium">{f.hint}</span>
                                    </span>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={form[f.key]}
                                        onChange={(e) => setField(f.key, e.target.value)}
                                        className="bg-white/5 border-white/10 text-sm font-bold h-10"
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

"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Palette, RotateCcw, Loader2, Sparkles } from "lucide-react";
import { updateGuildAccentHue } from "@/server/actions/admin-actions";
import { useRouter } from "next/navigation";

/**
 * #5 — Couleur de guilde (teinte OKLCH 0-360°).
 * Le système impose luminosité + chroma (design system §5.2) → contraste garanti
 * dans les deux thèmes, quelle que soit la teinte choisie.
 */
const PRESETS: { hue: number | null; label: string }[] = [
    { hue: null, label: "Or Sigil (défaut)" },
    { hue: 163, label: "Émeraude" },
    { hue: 250, label: "Saphir" },
    { hue: 210, label: "Cyan" },
    { hue: 15, label: "Rubis" },
    { hue: 300, label: "Améthyste" },
    { hue: 75, label: "Ambre" },
];

/** Couleur d'accent en mode sombre pour la prévisualisation (teinte imposée). */
function previewAccent(hue: number | null): string {
    return hue == null ? "oklch(0.828 0.189 84)" : `oklch(0.72 0.15 ${hue})`;
}

export function GuildAppearanceSettingsClient({
    guildId,
    initialHue,
}: {
    guildId: string;
    initialHue: number | null;
}) {
    const [hue, setHue] = useState<number | null>(initialHue);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const save = (nextHue: number | null) => {
        startTransition(async () => {
            const res = await updateGuildAccentHue(guildId, nextHue);
            if (res.success) {
                toast.success(nextHue == null ? "Couleur de guilde réinitialisée" : "Couleur de guilde mise à jour");
                router.refresh();
            } else {
                toast.error(res.error || "Erreur de sauvegarde");
            }
        });
    };

    return (
        <div className="space-y-8">
            <div className="p-6 rounded-2xl border border-white/5 bg-zinc-900/30 space-y-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl border border-white/10 flex items-center justify-center shrink-0"
                        style={{ background: previewAccent(hue) }}>
                        <Palette className="w-5 h-5 text-black/70" />
                    </div>
                    <div className="space-y-0.5">
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">Couleur de Guilde</h3>
                        <p className="text-caption text-zinc-500 leading-normal">
                            La teinte choisie teinte le tableau de bord (boutons, navigation, focus). Le système impose
                            luminosité et saturation : le contraste reste garanti en clair ET en sombre, quelle que soit la teinte.
                        </p>
                    </div>
                </div>

                {/* Slider teinte libre */}
                <div className="space-y-2 pt-2 border-t border-white/5">
                    <div className="flex items-center justify-between">
                        <span className="text-caption font-black uppercase tracking-widest text-zinc-400">
                            Teinte personnalisée
                        </span>
                        <span className="text-caption font-mono text-zinc-500 tabular-nums">
                            {hue == null ? "défaut" : `${hue}°`}
                        </span>
                    </div>
                    <input
                        type="range"
                        min={0}
                        max={360}
                        value={hue ?? 163}
                        onChange={(e) => setHue(Number(e.target.value))}
                        aria-label="Teinte de la couleur de guilde (0-360°)"
                        className="w-full accent-emerald-500"
                    />
                    <div
                        className="h-3 rounded-full border border-white/10"
                        style={{ background: previewAccent(hue ?? 163) }}
                    />
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                    <Button
                        onClick={() => save(hue)}
                        disabled={isPending}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider"
                    >
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        Appliquer la couleur
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => { setHue(null); save(null); }}
                        disabled={isPending}
                        className="text-xs font-bold"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Revenir à l'Or Sigil
                    </Button>
                </div>
            </div>
        </div>
    );
}

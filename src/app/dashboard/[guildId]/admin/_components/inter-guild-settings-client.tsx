"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, ShieldAlert, Globe, Users, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { getInterGuildAdminState, updateInterGuildConfig } from "@/server/actions/inter-guild";
import type { InterGuildAdminState, InterGuildScope } from "@/lib/inter-guild";
import { cn } from "@/lib/utils";

interface InterGuildSettingsClientProps {
    guildId: string;
}

const SCOPE_LABELS: Record<InterGuildScope, string> = {
    OFF: "Cloisonné",
    SERVER: "Même serveur Dofus",
    GLOBAL: "Toutes les guildes",
};

const SCOPE_DESCRIPTIONS: Record<InterGuildScope, string> = {
    OFF: "Les données restent internes à la guilde.",
    SERVER: "Visible des guildes inter-guilde du même serveur Dofus.",
    GLOBAL: "Visible de toutes les guildes inter-guilde de la plateforme.",
};

export function InterGuildSettingsClient({ guildId }: InterGuildSettingsClientProps) {
    const [state, setState] = useState<InterGuildAdminState | null>(null);
    const [enabled, setEnabled] = useState(false);
    const [scopes, setScopes] = useState<Record<string, InterGuildScope>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        async function load() {
            try {
                const res = await getInterGuildAdminState(guildId);
                setState(res);
                setEnabled(res.enabled);
                const initial: Record<string, InterGuildScope> = {};
                res.modules.forEach(m => { initial[m.module] = m.currentScope; });
                setScopes(initial);
            } catch {
                toast.error("Impossible de charger la configuration inter-guilde");
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, [guildId]);

    const handleSave = () => {
        startTransition(async () => {
            const res = await updateInterGuildConfig(guildId, { enabled, modules: scopes });
            if (res.success) {
                toast.success("Configuration inter-guilde enregistrée");
                const next = await getInterGuildAdminState(guildId);
                setState(next);
            } else {
                toast.error(res.error || "Erreur lors de l'enregistrement");
            }
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
            </div>
        );
    }

    if (!state) return null;

    const godOff = !state.godGlobalEnabled;
    // Modifications non sauvegardées ? (compare la config chargée avec l'état du formulaire)
    const dirty = enabled !== state.enabled || state.modules.some(m => scopes[m.module] !== m.currentScope);

    return (
        <div className="space-y-6">
            {godOff && (
                <div className="p-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <p className="text-sm font-bold text-rose-300">Inter-Guilde coupée au niveau de la plateforme</p>
                        <p className="text-sm text-zinc-400">
                            Le contrôle God a désactivé globalement l'inter-guilde. Vos réglages sont conservés,
                            mais rien n'est visible tant que le God ne réactive pas la fonctionnalité.
                        </p>
                    </div>
                </div>
            )}

            {/* Master switch */}
            <Card className="bg-zinc-900/60 border-white/5">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base text-white">
                        <Globe className="w-4 h-4 text-emerald-400" />
                        Mode Inter-Guilde
                    </CardTitle>
                    <CardDescription className="text-sm text-zinc-500">
                        Ouvre votre guilde aux autres guildes SigilOS (opt-in bilatéral : vos membres ne sont
                        visibles que par des guildes elles aussi ouvertes). Aucun embed Discord n'est envoyé
                        aux autres serveurs — l'inscription se fait depuis le dashboard.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                        <div className="space-y-0.5">
                            <p className="text-sm font-semibold text-white">Activer l'inter-guilde</p>
                            <p className="text-xs text-zinc-500">
                                {state.peerCount > 0
                                    ? `${state.peerCount} guildes ouvertes actuellement visibles pour vous`
                                    : "Aucune guilde ouverte détectée pour le moment"}
                            </p>
                        </div>
                        <Switch checked={enabled} onCheckedChange={setEnabled} disabled={godOff} />
                    </div>

                    {enabled && state.peerCount > 0 && (
                        <div className="flex items-center gap-2 text-xs text-emerald-400">
                            <CheckCircle2 className="w-4 h-4" />
                            {state.peerCount} guilde(s) pair(s) — vous êtes connecté à l'inter-guilde.
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Scopes par module */}
            <Card className="bg-zinc-900/60 border-white/5">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base text-white">
                        <Users className="w-4 h-4 text-emerald-400" />
                        Modules ouverts
                    </CardTitle>
                    <CardDescription className="text-sm text-zinc-500">
                        Choisissez ce que votre guilde expose aux autres guildes. « Même serveur Dofus » est le
                        réglage par défaut ; la galerie de stuffs et les mini-jeux sont ouverts à toutes les guildes.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {state.modules.map(m => (
                        <div
                            key={m.module}
                            className={cn(
                                "flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border transition-colors",
                                enabled ? "border-white/10 bg-white/[0.02]" : "border-white/5 bg-white/[0.01] opacity-60"
                            )}
                        >
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white">{m.label}</p>
                                <p className="text-xs text-zinc-500 mt-0.5">
                                    {SCOPE_DESCRIPTIONS[scopes[m.module] ?? "OFF"]}
                                </p>
                            </div>
                            <select
                                value={scopes[m.module] ?? "OFF"}
                                disabled={!enabled}
                                onChange={e => setScopes(prev => ({ ...prev, [m.module]: e.target.value as InterGuildScope }))}
                                className="h-9 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
                            >
                                {(Object.keys(SCOPE_LABELS) as InterGuildScope[]).map(s => (
                                    <option key={s} value={s}>{SCOPE_LABELS[s]}</option>
                                ))}
                            </select>
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* Barre d'enregistrement sticky — toujours visible pour les admins */}
            <div className="sticky bottom-4 z-20">
                <div className={cn(
                    "flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border px-4 py-3 backdrop-blur-md",
                    dirty ? "border-emerald-500/30 bg-zinc-950/85" : "border-white/10 bg-zinc-950/70"
                )}>
                    <div className="flex items-center gap-2.5 min-w-0">
                        {dirty ? (
                            <>
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                                <p className="text-sm font-semibold text-amber-300 truncate">Modifications non enregistrées</p>
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                <p className="text-sm font-semibold text-emerald-300 truncate">Configuration enregistrée</p>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto">
                        <p className="hidden lg:block text-xs text-zinc-500">Prise en compte immédiate (cache 30 s)</p>
                        <Button
                            onClick={handleSave}
                            disabled={isPending || godOff || !dirty}
                            size="xl"
                            variant="sigil-emerald"
                            className="w-full sm:w-auto"
                        >
                            {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            {isPending ? "Enregistrement…" : "Enregistrer les changements"}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

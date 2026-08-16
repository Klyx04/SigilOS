"use client";

import { useState, useEffect } from "react";
import { getDofusConfig, updateGuildGameConfig } from "@/server/actions/admin-actions";
import { DOFUS_UNITY_SERVERS } from "@/lib/presentation-constants";
import { Button } from "@/components/ui/button";
import { Globe, Save, Loader2, CheckCircle2, Server, Target, Home, ChevronDown, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { MapViewer } from "@/components/worldmap/map-viewer";
import { DOFUS_WORLDS } from "@/lib/dofus-assets";

interface DofusSettingsClientProps {
    guildId: string;
}

export function DofusSettingsClient({ guildId }: DofusSettingsClientProps) {
    const [serverId, setServerId] = useState<string | null>(null);
    const [guildHallPosX, setGuildHallPosX] = useState<number | null>(null);
    const [guildHallPosY, setGuildHallPosY] = useState<number | null>(null);
    const [guildHallWorldId, setGuildHallWorldId] = useState<number | null>(1);

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        async function loadConfig() {
            const result = await getDofusConfig(guildId);
            if (result.success && result.data) {
                setServerId(result.data.dofusServerId);
                setGuildHallPosX(result.data.guildHallPosX);
                setGuildHallPosY(result.data.guildHallPosY);
                setGuildHallWorldId(result.data.guildHallWorldId ?? 1);
            }
            setIsLoading(false);
        }
        loadConfig();
    }, [guildId]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const result = await updateGuildGameConfig(guildId, { 
                serverId,
                guildHallPosX,
                guildHallPosY,
                guildHallWorldId
            });
            if (result.success) {
                toast.success("Configuration enregistrée");
            } else {
                toast.error(result.error || "Erreur lors de l'enregistrement");
            }
        } catch (error) {
            toast.error("Erreur inattendue");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-info/50" />
            </div>
        );
    }

    const categories = [
        { key: 'pionnierMono', label: 'Mono (Unity)', color: 'text-success' },
        { key: 'pionnier', label: 'Multi (Unity)', color: 'text-info' },
        { key: 'monocompte', label: 'Monocompte (Classic)', color: 'text-warning' },
        { key: 'classique', label: 'Classique', color: 'text-muted-foreground' },
        { key: 'epique', label: 'Épique', color: 'text-danger' },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-300">

            {/* --- ACTION BAR --- */}
            <div className="sticky top-[140px] z-20 p-4 rounded-xl bg-surface/80 border border-border backdrop-blur-md flex items-center justify-between shadow-xl">
                <div className="flex items-center gap-3">
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-info opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-info"></span>
                    </span>
                    <span className="text-sm font-medium text-foreground">Modifications non enregistrées</span>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    size="sm"
                    className="px-6 bg-info hover:bg-info text-info-foreground font-bold rounded-lg transition-all shadow-lg shadow-indigo-500/20"
                >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    SAUVEGARDER
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* --- MISSION INFO & GUILD HALL --- */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-warning/10 border border-warning/20">
                            <Target className="w-5 h-5 text-warning" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-foreground">Objectifs de Guilde</h3>
                            <p className="text-sm text-muted-foreground">Configuration du palier hebdomadaire.</p>
                        </div>
                    </div>

                    {/* Info banner: tier managed in editor */}
                    <div className="flex items-start gap-3 p-5 rounded-xl bg-info/5 border border-info/15">
                        <Target className="w-4 h-4 text-info shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <p className="text-sm text-foreground font-semibold">Palier géré dans l’éditeur de missions</p>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Le <strong className="text-foreground">palier hebdomadaire</strong> se configure directement dans
                                {" "}<strong className="text-info">Conf-Missions → toolbar</strong>.{" "}
                                Il est automatiquement sauvegardé en base à chaque publication.
                            </p>
                        </div>
                    </div>

                    {/* --- GUILD HALL --- */}
                    <div className="border border-border bg-surface/20 backdrop-blur-md rounded-2xl p-6 space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-info/10 border border-info/20">
                                <Home className="w-5 h-5 text-info" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-foreground">Hall de Guilde</h3>
                                <p className="text-sm text-muted-foreground">Position du Palais / Hall de Guilde pour les membres.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="text-caption font-black text-info uppercase tracking-wider block mb-1.5">Position X</label>
                                <input
                                    type="number"
                                    value={guildHallPosX ?? ""}
                                    onChange={(e) => setGuildHallPosX(e.target.value ? Number(e.target.value) : null)}
                                    placeholder="0"
                                    className="w-full bg-background/60 border border-border hover:border-info/30 focus:border-info rounded-xl px-3 py-2 text-sm font-bold text-foreground text-center outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-caption font-black text-info uppercase tracking-wider block mb-1.5">Position Y</label>
                                <input
                                    type="number"
                                    value={guildHallPosY ?? ""}
                                    onChange={(e) => setGuildHallPosY(e.target.value ? Number(e.target.value) : null)}
                                    placeholder="0"
                                    className="w-full bg-background/60 border border-border hover:border-info/30 focus:border-info rounded-xl px-3 py-2 text-sm font-bold text-foreground text-center outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-caption font-black text-info uppercase tracking-wider block mb-1.5">Monde</label>
                                <div className="relative">
                                    <select
                                        value={guildHallWorldId ?? 1}
                                        onChange={(e) => setGuildHallWorldId(Number(e.target.value))}
                                        className="w-full bg-background/60 hover:bg-background border border-border hover:border-info/30 focus:border-info rounded-xl pl-3 pr-8 py-2 text-xs font-bold text-foreground outline-none appearance-none transition-all cursor-pointer"
                                    >
                                        {DOFUS_WORLDS.map(world => (
                                            <option key={world.id} value={world.id} className="bg-background text-foreground">
                                                {world.name}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                                        <ChevronDown size={14} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {guildHallPosX !== null && guildHallPosY !== null ? (
                            <div className="space-y-2">
                                <span className="text-caption font-black text-info uppercase tracking-wider block">Aperçu Satellite HD</span>
                                <div className="w-full h-48 rounded-xl overflow-hidden border border-border relative">
                                    <MapViewer 
                                        initialX={guildHallPosX} 
                                        initialY={guildHallPosY} 
                                        initialZoom={6} 
                                        initialWorldId={guildHallWorldId ?? 1} 
                                        hideUI={true} 
                                    />
                                    <div className="absolute top-2 right-2 bg-black/85 border border-info/30 rounded-lg px-2.5 py-1.5 backdrop-blur-md pointer-events-none z-10 text-caption font-mono font-black text-info">
                                        [{guildHallPosX}, {guildHallPosY}]
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-8 bg-background/40 border border-dashed border-border rounded-xl text-center text-xs text-muted-foreground">
                                <MapPin className="w-8 h-8 text-muted-foreground mb-2 opacity-50" />
                                Renseignez des coordonnées pour activer l'aperçu satellite HD.
                            </div>
                        )}
                    </div>
                </div>

                {/* --- SERVER CONFIGURATION --- */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-info/10 border border-info/20">
                            <Globe className="w-5 h-5 text-info" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-foreground">Serveur de Jeu</h3>
                            <p className="text-xs text-muted-foreground">Définit le ladder et l'économie.</p>
                        </div>
                    </div>

                    <div className="space-y-6 bg-surface/40 border border-border p-5 rounded-2xl">
                        {categories.map((cat) => {
                            const servers = (DOFUS_UNITY_SERVERS[cat.key as keyof typeof DOFUS_UNITY_SERVERS] as unknown as any[]) || [];
                            if (servers.length === 0) return null;

                            return (
                                <div key={cat.key} className="space-y-3">
                                    <div className="flex items-center gap-2 px-1">
                                        <span className={cn("text-caption font-black uppercase tracking-wider", cat.color)}>
                                            {cat.label}
                                        </span>
                                        <div className="h-px flex-1 bg-surface" />
                                    </div>

                                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                                        {servers.map((server) => {
                                            const isSelected = serverId === server.id.toString();
                                            return (
                                                <button
                                                    key={server.id}
                                                    onClick={() => setServerId(server.id.toString())}
                                                    className={cn(
                                                        "relative p-2.5 rounded-xl border transition-all duration-200 text-left flex items-center gap-3",
                                                        isSelected
                                                            ? "bg-info/20 border-info/50 "
                                                            : "bg-surface/40 border-border hover:border-border hover:bg-elevated/40"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "w-7 h-7 rounded-md flex items-center justify-center shrink-0",
                                                        isSelected ? "bg-info/20 text-info" : "bg-surface text-muted-foreground"
                                                    )}>
                                                        <Server className="w-3.5 h-3.5" />
                                                    </div>
                                                    <div className="min-w-0 pr-2">
                                                        <p className={cn(
                                                            "text-xs font-bold truncate tracking-tight",
                                                            isSelected ? "text-foreground" : "text-muted-foreground"
                                                        )}>
                                                            {server.name}
                                                        </p>
                                                        <p className="text-caption text-muted-foreground font-mono scale-90 origin-left">ID:{server.id}</p>
                                                    </div>

                                                    {isSelected && (
                                                        <div className="absolute right-1 top-1">
                                                            <CheckCircle2 className="w-2.5 h-2.5 text-info" />
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Warning if no server */}
            {!serverId && (
                <div className="p-4 rounded-xl bg-warning/5 border border-warning/10 flex items-center gap-3 text-warning/80 mx-auto max-w-2xl">
                    <CheckCircle2 className="w-5 h-5 shrink-0 opacity-50" />
                    <p className="text-xs leading-snug">
                        Aucun serveur sélectionné. <strong>Draconiros</strong> sera utilisé par défaut pour les fonctionnalités de ladder.
                    </p>
                </div>
            )}
        </div>
    );
}

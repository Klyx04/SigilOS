"use client";

import { useState, useEffect } from "react";
import { getLegendaryCraftingData, syncLegendaryCrafts } from "@/server/actions/legendary-actions";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Sparkles, Hammer, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface LegendaryCraftingProps {
    guildId: string;
    profileId: string;
    metiers: string[];
    readOnly?: boolean;
}

export function LegendaryCrafting({ guildId, profileId, readOnly = false }: LegendaryCraftingProps) {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<any[]>([]);
    const [jobsAt200, setJobsAt200] = useState<string[]>([]);
    const [hasPrerequisites, setHasPrerequisites] = useState(false);

    useEffect(() => {
        fetchData();
    }, [guildId, profileId]);

    const fetchData = async () => {
        setLoading(true);
        const res = await getLegendaryCraftingData(guildId, profileId);
        if (res.success && res.data) {
            setItems(res.data.items);
            setJobsAt200(res.data.jobsAt200);
            setHasPrerequisites(!!res.data.hasLegendaryPrerequisites);
        }
        setLoading(false);
    };

    const handlePrerequisitesToggle = async (enabled: boolean) => {
        if (readOnly) return;

        setHasPrerequisites(enabled);
        
        // Optimistic update
        setItems(prev => prev.map(item => ({
            ...item,
            canCraft: enabled && item.isEligible
        })));

        const res = await syncLegendaryCrafts(guildId, enabled);
        if (!res.success) {
            toast.error(res.error || "Erreur lors de la mise à jour");
            // Rollback
            setHasPrerequisites(!enabled);
            setItems(prev => prev.map(item => ({
                ...item,
                canCraft: !enabled && item.isEligible
            })));
        } else {
            toast.success(enabled ? "Prérequis confirmés" : "Prérequis retirés");
        }
    };

    const displayItems = items.filter(item => item.isEligible);

    // Group items by jobRequired
    const groupedItems = displayItems.reduce((acc, item) => {
        const job = item.jobRequired;
        if (!acc[job]) acc[job] = [];
        acc[job].push(item);
        return acc;
    }, {} as Record<string, any[]>);

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="h-28 w-full rounded-xl bg-surface" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-warning/15 border border-warning/30 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-warning" />
                    </div>
                    <h3 className="text-base font-bold text-foreground">
                        Craft Légendaire
                    </h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                    Déclarez les objets légendaires que vous pouvez fabriquer. 
                    Niveau 200 dans le métier requis et possession des 6 Dofus primordiaux indispensables.
                </p>
                
                <div className="p-3 rounded-xl bg-surface/50 border border-border text-xs text-muted-foreground flex items-center gap-2.5">
                    <Info className="w-4 h-4 text-warning shrink-0" />
                    <p>
                        Une fois vos prérequis confirmés, les membres pourront vous solliciter depuis l'annuaire ou Discord.
                    </p>
                </div>
            </div>

            {jobsAt200.length === 0 && !readOnly && (
                <div className="p-4 bg-warning/10 border border-warning/20 rounded-xl flex items-start gap-3">
                    <Info className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-xs font-bold text-warning uppercase tracking-wider">Aucun métier 200</h4>
                        <p className="text-xs text-warning/80 mt-0.5">
                            Vous n'avez déclaré aucun métier niveau 200. Seuls les artisans de niveau maximum peuvent fabriquer des objets légendaires.
                        </p>
                    </div>
                </div>
            )}

            {jobsAt200.length > 0 && !readOnly && (
                <div className="p-4 bg-surface/50 border border-border rounded-xl">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                            <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                                Prérequis Dofus Primordiaux
                                <a 
                                    href="https://www.dofuspourlesnoobs.com/objets-legendaires.html" 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-muted-foreground hover:text-foreground transition-colors" 
                                    title="Voir les prérequis sur Dofus pour les Noobs"
                                >
                                    <Info className="w-3.5 h-3.5" />
                                </a>
                            </h4>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Confirmez que vous possédez les quêtes requises pour fabriquer des objets légendaires.
                            </p>
                        </div>
                        <Switch 
                            checked={hasPrerequisites}
                            onCheckedChange={handlePrerequisitesToggle}
                            className="data-[state=checked]:bg-warning"
                        />
                    </div>
                </div>
            )}

            {(!readOnly && !hasPrerequisites && jobsAt200.length > 0) ? (
                <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl bg-surface/20">
                    Activez vos prérequis ci-dessus pour déclarer vos objets légendaires.
                </div>
            ) : (
                <div className="space-y-6">
                    {Object.entries(groupedItems).map(([job, jobItems]: [string, any]) => (
                        <div key={job} className="space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 px-0.5">
                                <Hammer className="w-3.5 h-3.5 text-warning" /> {job}
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                {jobItems.map((item: any) => (
                                    <div 
                                        key={item.id}
                                        className={cn(
                                            "group relative p-3 rounded-xl border transition-all flex items-center gap-3",
                                            item.canCraft 
                                                ? "bg-surface/50 border-warning/30 hover:border-warning/50" 
                                                : "bg-surface/30 border-border opacity-70"
                                        )}
                                    >
                                        <div className="relative w-11 h-11 shrink-0 rounded-lg overflow-hidden bg-background/80 border border-border flex items-center justify-center p-1">
                                            {item.imageUrl ? (
                                                <img 
                                                    src={item.imageUrl.startsWith("/") ? item.imageUrl : `/api/proxy-image?url=${encodeURIComponent(item.imageUrl)}`} 
                                                    alt={item.name} 
                                                    width={36} 
                                                    height={36}
                                                    className="object-contain transition-transform duration-200 group-hover:scale-105"
                                                />
                                            ) : (
                                                <Sparkles className="w-5 h-5 text-muted-foreground" />
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <h5 className="text-xs font-semibold text-foreground truncate">
                                                {item.name}
                                            </h5>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal text-muted-foreground border-border/60">
                                                    {item.category}
                                                </Badge>
                                                {item.canCraft && (
                                                    <span className="text-[10px] font-semibold text-warning">
                                                        Disponible
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    
                    {displayItems.length === 0 && jobsAt200.length > 0 && (
                        <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl bg-surface/20">
                            Aucun objet légendaire correspondant à vos métiers.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

"use client";

import { useState, useEffect } from "react";
import { getLegendaryCraftingData, syncLegendaryCrafts } from "@/server/actions/legendary-actions";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Sparkles, Hammer, Info, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="h-32 w-full rounded-2xl bg-surface" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xl font-black uppercase tracking-tighter text-foreground">
                    <Sparkles className="w-6 h-6 text-info" />
                    Craft Légendaire
                </div>
                <p className="text-muted-foreground text-sm">
                    Déclarez les objets légendaires que vous êtes capable de fabriquer. 
                    Vous devez être **niveau 200** dans le métier correspondant et posséder les **6 Dofus primordiaux**.
                </p>
                
                <div className="mt-2 p-3 rounded-xl bg-info/10 border border-info/20 text-info/80 text-xs flex items-center gap-3">
                    <Info className="w-4 h-4 text-info shrink-0" />
                    <p>
                        Une fois vos prérequis confirmés, les membres pourront voir vos capacités depuis l'annuaire et vous taguer sur Discord pour des commandes.
                    </p>
                </div>
            </div>

            {jobsAt200.length === 0 && !readOnly && (
                <Card className="p-6 bg-warning/10 border-warning/20 rounded-2xl flex items-start gap-4">
                    <Info className="w-6 h-6 text-warning shrink-0 mt-1" />
                    <div>
                        <h4 className="text-warning font-bold uppercase text-sm tracking-widest">Aucun métier 200</h4>
                        <p className="text-warning/70 text-xs mt-1">
                            Vous n'avez déclaré aucun métier de niveau 200 dans votre profil. 
                            Seuls les artisans de niveau maximum peuvent fabriquer des objets légendaires.
                        </p>
                    </div>
                </Card>
            )}

            {jobsAt200.length > 0 && !readOnly && (
                <Card className="p-6 bg-surface/40 border-border rounded-2xl">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                            <h4 className="text-foreground font-bold uppercase tracking-widest text-sm flex items-center gap-2">
                                Prérequis <a href="https://www.dofuspourlesnoobs.com/objets-legendaires.html" target="_blank" rel="noopener noreferrer" className="text-info hover:text-info" title="Voir les prérequis sur Dofus pour les Noobs"><Info className="w-4 h-4" /></a>
                            </h4>
                            <p className="text-muted-foreground text-sm mt-1">
                                Cochez cette case pour confirmer que vous avez terminé les séries de quêtes nécessaires pour fabriquer des objets légendaires (Dofus primordiaux, etc.).
                            </p>
                        </div>
                        <Switch 
                            checked={hasPrerequisites}
                            onCheckedChange={handlePrerequisitesToggle}
                            className="data-[state=checked]:bg-info"
                        />
                    </div>
                </Card>
            )}

            {(!readOnly && !hasPrerequisites && jobsAt200.length > 0) ? (
                <div className="p-12 text-center text-muted-foreground border border-dashed border-border rounded-2xl bg-surface/20">
                    Veuillez confirmer vos prérequis ci-dessus pour déclarer vos objets légendaires.
                </div>
            ) : (
                <div className="space-y-8">
                    {Object.entries(groupedItems).map(([job, jobItems]: [string, any]) => (
                        <div key={job} className="space-y-4">
                            <h4 className="text-caption font-black uppercase text-muted-foreground tracking-[0.2em] flex items-center gap-2 px-1">
                                <Hammer className="w-3 h-3" /> {job}
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {jobItems.map((item: any) => (
                                    <Card 
                                        key={item.id}
                                        className={cn(
                                            "group relative overflow-hidden p-4 transition-all duration-300 rounded-2xl border-border bg-surface/40 backdrop-blur-md",
                                            item.canCraft ? "border-info/30 bg-info/5 " : "hover:border-border"
                                        )}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="relative w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-black/40 border border-border flex items-center justify-center p-2">
                                                {item.imageUrl ? (
                                                     <img 
                                                         src={item.imageUrl.startsWith("/") ? item.imageUrl : `/api/proxy-image?url=${encodeURIComponent(item.imageUrl)}`} 
                                                         alt={item.name} 
                                                         width={48} 
                                                         height={48}
                                                         className="object-contain group- transition-transform duration-300"
                                                     />
                                                ) : (
                                                    <Sparkles className="w-8 h-8 text-muted-foreground" />
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-foreground font-bold text-sm truncate uppercase tracking-tight leading-none">
                                                    {item.name}
                                                </h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Badge variant="outline" className="bg-surface text-caption uppercase border-none text-muted-foreground">
                                                        {item.category}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status Indicator */}
                                        {item.canCraft && (
                                            <div className="absolute top-0 right-0 p-1.5 bg-info rounded-bl-xl shadow-lg animate-in zoom-in duration-300">
                                                <Sparkles className="w-3 h-3 text-foreground" />
                                            </div>
                                        )}
                                    </Card>
                                ))}
                            </div>
                        </div>
                    ))}
                    
                    {displayItems.length === 0 && jobsAt200.length > 0 && (
                        <div className="p-12 text-center text-muted-foreground border border-dashed border-border rounded-2xl bg-surface/20">
                            Aucun objet légendaire correspondant à vos métiers n'a été trouvé.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

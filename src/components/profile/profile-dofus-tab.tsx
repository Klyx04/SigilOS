"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ShieldAlert, Loader2, ArrowRight } from "lucide-react";
import { getMemberDofusSummaryForProfile } from "@/server/actions/profile-actions";
import { cn } from "@/lib/utils";

interface DofusItemProgress {
    slug: string;
    name: string;
    color: string | null;
    imageUrl: string | null;
    isObtained: boolean;
    progressPercent: number;
}

interface CharacterProgress {
    pseudo: string;
    dofusList: DofusItemProgress[];
}

interface ProfileDofusTabProps {
    guildId: string;
    profileId: string;
    readOnly?: boolean;
}

export function ProfileDofusTab({ guildId, profileId, readOnly = false }: ProfileDofusTabProps) {
    const [loading, setLoading] = useState(true);
    const [mainChar, setMainChar] = useState<CharacterProgress | null>(null);
    const [mules, setMules] = useState<CharacterProgress[]>([]);
    const [selectedChar, setSelectedChar] = useState<string>("PRINCIPAL");

    useEffect(() => {
        let isMounted = true;
        async function fetchSummary() {
            setLoading(true);
            try {
                const res = await getMemberDofusSummaryForProfile(guildId, profileId);
                if (isMounted && res.success && res.data) {
                    setMainChar(res.data.mainCharacter);
                    setMules(res.data.mules);
                }
            } catch (e) {
                console.error("ProfileDofusTab fetch error:", e);
            } finally {
                if (isMounted) setLoading(false);
            }
        }
        fetchSummary();
        return () => { isMounted = false; };
    }, [guildId, profileId]);

    if (loading) {
        return (
            <div className="p-12 bg-card border border-border flex flex-col items-center justify-center space-y-3 rounded-2xl min-h-[40vh]">
                <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                <p className="text-xs font-medium text-muted-foreground">Chargement de la progression Dofus...</p>
            </div>
        );
    }

    const activeChar = selectedChar === "PRINCIPAL" ? mainChar : mules.find(m => m.pseudo === selectedChar);
    const list = activeChar?.dofusList || [];
    const obtainedCount = list.filter(d => d.isObtained).length;
    const inProgressCount = list.filter(d => !d.isObtained && d.progressPercent > 0).length;
    const hasAnyProgress = obtainedCount > 0 || inProgressCount > 0;

    return (
        <div className="p-6 bg-card border border-border rounded-2xl space-y-6 shadow-sm">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-warning/15 border border-warning/30 flex items-center justify-center">
                        <img src="/assets/icons/ocre.png" alt="" className="w-5 h-5 object-contain" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-foreground">Progression des Dofus</h3>
                        <p className="text-xs text-muted-foreground">Vue synthétique de l'avancement des quêtes</p>
                    </div>
                </div>

                {/* Character Switcher */}
                {mules.length > 0 && (
                    <div className="flex items-center gap-1 p-1 bg-surface border border-border rounded-xl">
                        <button
                            type="button"
                            onClick={() => setSelectedChar("PRINCIPAL")}
                            className={cn(
                                "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                                selectedChar === "PRINCIPAL" ? "bg-background text-foreground shadow-xs border border-border" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Principal ({mainChar?.pseudo || "Main"})
                        </button>
                        {mules.map(m => (
                            <button
                                key={m.pseudo}
                                type="button"
                                onClick={() => setSelectedChar(m.pseudo)}
                                className={cn(
                                    "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                                    selectedChar === m.pseudo ? "bg-background text-foreground shadow-xs border border-border" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                Mule : {m.pseudo}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Empty State */}
            {!hasAnyProgress ? (
                <div className="p-8 rounded-xl border border-dashed border-border flex flex-col items-center justify-center text-center space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-warning/10 border border-warning/20 flex items-center justify-center">
                        <ShieldAlert className="w-5 h-5 text-warning" />
                    </div>
                    <div className="space-y-1 max-w-sm">
                        <h4 className="text-sm font-semibold text-foreground">Aucune progression renseignée</h4>
                        <p className="text-xs text-muted-foreground">
                            {readOnly
                                ? "Ce membre n'a pas encore renseigné sa progression dans le module Quêtes Dofus."
                                : "Vous n'avez pas encore renseigné l'avancement de vos quêtes Dofus."}
                        </p>
                    </div>

                    {!readOnly && (
                        <Button asChild variant="outline" size="sm" className="mt-2 text-xs font-semibold rounded-lg">
                            <Link href={`/dashboard/${guildId}/quetes-dofus?tab=dofus`}>
                                Accéder au suivi Quêtes Dofus <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                            </Link>
                        </Button>
                    )}
                </div>
            ) : (
                <div className="space-y-5">
                    {/* Stats summary banner */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="p-3 bg-surface/50 border border-border rounded-xl text-center">
                            <p className="text-xs text-muted-foreground font-medium">Dofus obtenus</p>
                            <p className="text-lg font-bold text-foreground font-mono mt-0.5">{obtainedCount} / {list.length}</p>
                        </div>
                        <div className="p-3 bg-surface/50 border border-border rounded-xl text-center">
                            <p className="text-xs text-muted-foreground font-medium">En cours</p>
                            <p className="text-lg font-bold text-warning font-mono mt-0.5">{inProgressCount}</p>
                        </div>
                        <div className="p-3 bg-surface/50 border border-border rounded-xl col-span-2 sm:col-span-1 text-center">
                            <p className="text-xs text-muted-foreground font-medium">Complétion globale</p>
                            <p className="text-lg font-bold text-success font-mono mt-0.5">
                                {list.length > 0 ? Math.round((obtainedCount / list.length) * 100) : 0}%
                            </p>
                        </div>
                    </div>

                    {/* Dofus Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {list.map(item => (
                            <Link
                                key={item.slug}
                                href={`/dashboard/${guildId}/quetes-dofus/${item.slug}`}
                                className={cn(
                                    "group p-3 rounded-xl border transition-all flex items-center gap-3 relative overflow-hidden",
                                    item.isObtained
                                        ? "bg-surface/50 border-border hover:bg-surface hover:border-success/40"
                                        : item.progressPercent > 0
                                        ? "bg-surface/50 border-border hover:bg-surface hover:border-warning/40"
                                        : "bg-surface/20 border-border/60 opacity-60 hover:opacity-100 hover:border-border"
                                )}
                            >
                                <div className="w-9 h-9 rounded-lg bg-background/80 border border-border/80 flex items-center justify-center shrink-0 p-1">
                                    {item.imageUrl ? (
                                        <img
                                            src={item.imageUrl}
                                            alt={item.name}
                                            className="w-full h-full object-contain"
                                            onError={(e) => {
                                                const fallback = "/assets/missions/fragment.png";
                                                if (e.currentTarget.src !== window.location.origin + fallback) {
                                                    e.currentTarget.src = fallback;
                                                }
                                            }}
                                        />
                                    ) : (
                                        <span className="text-xs text-warning">❖</span>
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-1">
                                        <h5 className="text-xs font-semibold text-foreground truncate">{item.name}</h5>
                                        {item.isObtained ? (
                                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full border border-success/20">
                                                <CheckCircle2 className="w-2.5 h-2.5" /> Obtenu
                                            </span>
                                        ) : item.progressPercent > 0 ? (
                                            <span className="text-[11px] font-mono font-medium text-warning">
                                                {item.progressPercent}%
                                            </span>
                                        ) : (
                                            <span className="text-[11px] text-muted-foreground font-medium">Non démarré</span>
                                        )}
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="w-full h-1 bg-surface-hover rounded-full overflow-hidden mt-1.5 border border-border/40">
                                        <div
                                            className={cn(
                                                "h-full transition-all duration-300",
                                                item.isObtained ? "bg-success" : "bg-warning"
                                            )}
                                            style={{ width: `${item.isObtained ? 100 : item.progressPercent}%` }}
                                        />
                                    </div>
                                </div>

                                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            </Link>
                        ))}
                    </div>

                    {!readOnly && (
                        <div className="flex justify-end pt-1">
                            <Link
                                href={`/dashboard/${guildId}/quetes-dofus?tab=dofus`}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <span>Modifier ou mettre à jour dans Quêtes Dofus</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

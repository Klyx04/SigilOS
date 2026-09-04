"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, ExternalLink, ShieldAlert, CheckCircle2, Circle, Loader2, ArrowRight } from "lucide-react";
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
            <Card className="p-12 bg-background/60 border border-border flex flex-col items-center justify-center space-y-3 rounded-3xl min-h-[60vh]">
                <Loader2 className="w-8 h-8 text-success animate-spin" />
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Chargement de la progression Dofus...</p>
            </Card>
        );
    }

    const activeChar = selectedChar === "PRINCIPAL" ? mainChar : mules.find(m => m.pseudo === selectedChar);
    const list = activeChar?.dofusList || [];
    const obtainedCount = list.filter(d => d.isObtained).length;
    const inProgressCount = list.filter(d => !d.isObtained && d.progressPercent > 0).length;
    const hasAnyProgress = obtainedCount > 0 || inProgressCount > 0;

    return (
        <Card className="p-6 bg-background/60 border border-border rounded-3xl space-y-6 backdrop-blur-md shadow-2xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-warning/10 border border-warning/20 flex items-center justify-center">
                        <img src="/assets/icons/ocre.png" alt="" className="w-6 h-6 object-contain" />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-foreground uppercase tracking-wider">Progression des Dofus</h3>
                        <p className="text-caption text-muted-foreground uppercase tracking-widest font-bold">Vue synthétique en lecture seule</p>
                    </div>
                </div>

                {/* Character Switcher */}
                {mules.length > 0 && (
                    <div className="flex items-center gap-1.5 p-1 bg-black/60 border border-border rounded-xl">
                        <button
                            onClick={() => setSelectedChar("PRINCIPAL")}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                selectedChar === "PRINCIPAL" ? "bg-warning/20 border border-warning/30 text-warning" : "text-muted-foreground hover:text-warning-foreground"
                            )}
                        >
                            Principal ({mainChar?.pseudo || "Main"})
                        </button>
                        {mules.map(m => (
                            <button
                                key={m.pseudo}
                                onClick={() => setSelectedChar(m.pseudo)}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                    selectedChar === m.pseudo ? "bg-warning/20 border border-warning/30 text-warning" : "text-muted-foreground hover:text-warning-foreground"
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
                <div className="p-10 rounded-2xl bg-black/40 border border-border flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-warning/10 border border-warning/20 flex items-center justify-center">
                        <ShieldAlert className="w-7 h-7 text-warning" />
                    </div>
                    <div className="space-y-1 max-w-sm">
                        <h4 className="text-sm font-black text-foreground uppercase tracking-wider">Aucune progression renseignée</h4>
                        <p className="text-xs text-muted-foreground">
                            {readOnly
                                ? "Ce membre n'a pas encore renseigné sa progression dans le module Quêtes Dofus."
                                : "Vous n'avez pas encore renseigné l'avancement de vos quêtes Dofus."}
                        </p>
                    </div>

                    {!readOnly && (
                        <Button asChild variant="sigil-emerald" className="mt-2 text-sm font-semibold h-10 px-5">
                            <Link href={`/dashboard/${guildId}/quetes-dofus?tab=dofus`}>
                                Accéder au suivi Quêtes Dofus <ArrowRight className="w-3.5 h-3.5 ml-2" />
                            </Link>
                        </Button>
                    )}
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Stats summary banner */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="p-3 bg-surface/60 border border-border rounded-2xl text-center">
                            <p className="text-caption font-black text-muted-foreground uppercase">Dofus Obtenus</p>
                            <p className="text-xl font-black text-success font-mono mt-0.5">{obtainedCount} / {list.length}</p>
                        </div>
                        <div className="p-3 bg-surface/60 border border-border rounded-2xl text-center">
                            <p className="text-caption font-black text-muted-foreground uppercase">En cours</p>
                            <p className="text-xl font-black text-warning font-mono mt-0.5">{inProgressCount}</p>
                        </div>
                        <div className="p-3 bg-surface/60 border border-border rounded-2xl col-span-2 sm:col-span-1 text-center">
                            <p className="text-caption font-black text-muted-foreground uppercase">Complétion Globale</p>
                            <p className="text-xl font-black text-sky-400 font-mono mt-0.5">
                                {list.length > 0 ? Math.round((obtainedCount / list.length) * 100) : 0}%
                            </p>
                        </div>
                    </div>

                    {/* Dofus Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {list.map(item => (
                            <Link
                                key={item.slug}
                                href={`/dashboard/${guildId}/quetes-dofus/${item.slug}`}
                                className={cn(
                                    "group p-3.5 rounded-2xl border transition-all flex items-center gap-3 relative overflow-hidden",
                                    "hover:scale-[1.02] hover:shadow-lg active:scale-[0.99]",
                                    item.isObtained
                                        ? "bg-success/20 border-success/30 hover:border-success/60 hover:bg-success/25"
                                        : item.progressPercent > 0
                                        ? "bg-warning/20 border-warning/30 hover:border-warning/60 hover:bg-warning/25"
                                        : "bg-surface/40 border-border opacity-60 hover:opacity-100 hover:border-border-strong"
                                )}
                            >
                                <div className="w-10 h-10 rounded-xl bg-black/60 border border-border flex items-center justify-center shrink-0 p-1">
                                    {item.imageUrl ? (
                                        <img
                                            src={item.imageUrl}
                                            alt={item.name}
                                            className="w-full h-full object-contain"
                                            onError={(e) => {
                                                // Les icônes sont désormais locales (/module-dofus/) ; en cas
                                                // d'asset manquant, on retombe sur un placeholder plutôt que
                                                // sur le CDN dofusdb.fr.
                                                const fallback = "/assets/missions/fragment.png";
                                                if (e.currentTarget.src !== window.location.origin + fallback) {
                                                    e.currentTarget.src = fallback;
                                                }
                                            }}
                                        />
                                    ) : (
                                        <span className="text-xs font-black text-warning">❖</span>
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-1">
                                        <h5 className="text-xs font-black text-foreground truncate">{item.name}</h5>
                                        {item.isObtained ? (
                                            <span className="inline-flex items-center gap-1 text-caption font-black text-success bg-success/10 px-2 py-0.5 rounded-full border border-success/20">
                                                <CheckCircle2 className="w-2.5 h-2.5" /> Obtenu
                                            </span>
                                        ) : item.progressPercent > 0 ? (
                                            <span className="text-caption font-mono font-bold text-warning">
                                                {item.progressPercent}%
                                            </span>
                                        ) : (
                                            <span className="text-caption text-muted-foreground font-bold">Non démarré</span>
                                        )}
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden mt-2 border border-border">
                                        <div
                                            className={cn(
                                                "h-full transition-all duration-300",
                                                item.isObtained ? "bg-success" : "bg-warning"
                                            )}
                                            style={{ width: `${item.isObtained ? 100 : item.progressPercent}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Arrow hint on hover */}
                                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            </Link>
                        ))}
                    </div>

                    {!readOnly && (
                        <div className="flex justify-end pt-2">
                            <Button asChild variant="ghost" className="text-xs font-black uppercase tracking-wider text-warning hover:text-warning">
                                <Link href={`/dashboard/${guildId}/quetes-dofus?tab=dofus`}>
                                    Modifier ou mettre à jour dans Quêtes Dofus →
                                </Link>
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
}

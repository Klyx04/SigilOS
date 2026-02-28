"use client";

import { useState, useEffect } from "react";
import { getDofusbookPreview, type DofusbookPreviewData } from "@/server/actions/dofusbook-actions";
import { Loader2, ExternalLink, Zap, Shield, Heart, Eye, Users, Footprints, Wind } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface DofusbookPreviewProps {
    url: string;
    title?: string; // Nom personnalisé par l'utilisateur
    className?: string;
}

export function DofusbookPreview({ url, title, className }: DofusbookPreviewProps) {
    const [data, setData] = useState<DofusbookPreviewData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchPreview() {
            setLoading(true);
            const result = await getDofusbookPreview(url);
            if (result.success && result.data) {
                // Si l'utilisateur a donné un titre, on peut choisir de le garder ou de fusionner
                setData(result.data);
            } else {
                setError(result.error || "Erreur de chargement");
            }
            setLoading(false);
        }
        fetchPreview();
    }, [url]);

    if (loading) {
        return (
            <div className={cn("flex items-center justify-center p-8 bg-black/20 rounded-xl border border-white/5 min-h-[140px]", className)}>
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500/50" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className={cn("flex flex-col items-center justify-center p-4 bg-red-500/5 rounded-xl border border-red-500/10 text-red-400 text-xs text-center", className)}>
                <p>{error || "Impossible de charger l'aperçu"}</p>
                <a href={url} target="_blank" className="mt-2 underline flex items-center gap-1 hover:text-red-300">
                    Ouvrir sur Dofusbook <ExternalLink className="w-3 h-3" />
                </a>
            </div>
        );
    }

    // Mapping class id to my assets
    // If Dofusbook is 19 and my asset is 20 for Forgelance, I need a small bridge
    const getIconId = (id: number) => {
        if (id === 19) return 20; // Forgelance bridge
        return id;
    };

    const hasMainStats = data.stats.pa > 0 || data.stats.pm > 0 || data.stats.po > 0 || data.stats.invoc > 0;
    const hasSecondaryStats = data.stats.vit > 0 || data.stats.ini > 0;
    const hasResists = Object.values(data.resists).some(v => v !== 0);

    return (
        <div className={cn("group relative overflow-hidden bg-zinc-950/40 backdrop-blur-md border border-white/10 rounded-2xl p-4 transition-all hover:border-emerald-500/30", className)}>
            {/* Background Accent */}
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl transition-opacity group-hover:opacity-100 opacity-50 pointer-events-none" />

            <div className="flex flex-col gap-4 relative z-10">
                {/* Header: Class + Name + Level */}
                <div className="flex items-center gap-3">
                    <div className="relative w-12 h-12 shrink-0 p-1 bg-black/40 rounded-xl border border-white/5 flex items-center justify-center">
                        {data.classId > 0 ? (
                            <Image
                                src={`/assets/dofus/classes/${getIconId(data.classId)}.png`}
                                alt={data.className}
                                width={48}
                                height={48}
                                className="object-contain"
                            />
                        ) : (
                            <ExternalLink className="w-6 h-6 text-zinc-700" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-zinc-100 truncate">
                                {title || (data.id === 0 ? "Voir le build" : data.name)}
                            </h4>
                            {data.classId > 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-black border border-emerald-500/10">
                                    Lvl {data.level}
                                </span>
                            )}
                        </div>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{data.className}</p>
                    </div>
                </div>

                {/* Core Stats: PA / PM / PO / Invoc */}
                {hasMainStats && (
                    <div className="grid grid-cols-4 gap-2">
                        <StatBadge icon={<Zap className="w-3 h-3 text-indigo-400" />} label="PA" value={data.stats.pa} color="indigo" />
                        <StatBadge icon={<Footprints className="w-3 h-3 text-emerald-400" />} label="PM" value={data.stats.pm} color="emerald" />
                        <StatBadge icon={<Eye className="w-3 h-3 text-cyan-400" />} label="PO" value={data.stats.po} color="cyan" />
                        <StatBadge icon={<Users className="w-3 h-3 text-zinc-400" />} label="In" value={data.stats.invoc} color="zinc" />
                    </div>
                )}

                {/* Secondary: Vit / Ini */}
                {hasSecondaryStats && (
                    <div className="flex items-center gap-4 border-t border-white/5 pt-3">
                        {data.stats.vit > 0 && (
                            <div className="flex items-center gap-1.5">
                                <Heart className="w-3 h-3 text-rose-500" />
                                <span className="text-[11px] font-black text-rose-300">{data.stats.vit.toLocaleString()}</span>
                            </div>
                        )}
                        {data.stats.ini > 0 && (
                            <div className="flex items-center gap-1.5">
                                <Zap className="w-3 h-3 text-amber-500" />
                                <span className="text-[11px] font-black text-amber-300">{data.stats.ini.toLocaleString()}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Resistances Bloc */}
                {hasResists && (
                    <div className="grid grid-cols-5 gap-1.5 border-t border-white/5 pt-3">
                        <ResIcon value={data.resists.neutre} color="#94a3b8" title="Neutre" />
                        <ResIcon value={data.resists.terre} color="#854d0e" title="Terre" />
                        <ResIcon value={data.resists.feu} color="#dc2626" title="Feu" />
                        <ResIcon value={data.resists.eau} color="#2563eb" title="Eau" />
                        <ResIcon value={data.resists.air} color="#16a34a" title="Air" />
                    </div>
                )}

                {!hasMainStats && !hasSecondaryStats && !hasResists && (
                    <div className="py-4 text-center border-t border-white/5">
                        <p className="text-[10px] text-zinc-500 italic">Statistiques détaillées non disponibles.</p>
                    </div>
                )}

                <div className="mt-1 pt-3 border-t border-white/5 flex justify-end">
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-bold text-emerald-400/70 hover:text-emerald-400 flex items-center gap-1 transition-colors"
                    >
                        VOIR SUR DOFUSBOOK <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                </div>
            </div>
        </div>
    );
}

function StatBadge({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: number, color: string }) {
    const colors: Record<string, string> = {
        indigo: "bg-indigo-500/10 border-indigo-500/20 text-indigo-300",
        emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-300",
        cyan: "bg-cyan-500/10 border-cyan-500/20 text-cyan-300",
        zinc: "bg-zinc-500/10 border-zinc-500/20 text-zinc-300",
    };

    return (
        <div className={cn("flex flex-col items-center justify-center p-1.5 rounded-xl border transition-all", colors[color] || colors.zinc)}>
            <div className="w-4 h-4 flex items-center justify-center mb-0.5 opacity-80">{icon}</div>
            <span className="text-xs font-black">{value}</span>
            <span className="text-[8px] font-bold uppercase opacity-50 tracking-tighter">{label}</span>
        </div>
    );
}

function ResIcon({ value, color, title }: { value: number; color: string; title: string }) {
    return (
        <div className="flex flex-col items-center gap-1 group/res" title={title}>
            <div
                className="w-5 h-5 rounded-md flex items-center justify-center opacity-80"
                style={{ backgroundColor: `${color}20`, border: `1px solid ${color}40` }}
            >
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
            </div>
            <span className="text-[9px] font-black" style={{ color: value > 0 ? color : '#52525b' }}>
                {value}%
            </span>
        </div>
    );
}

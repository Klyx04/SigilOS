"use client";

import { useState, useEffect } from "react";
import { processDofusbookRawData, type DofusbookPreviewData } from "@/lib/dofusbook-utils";
import { Loader2, ExternalLink, Users } from "lucide-react";
import NextImage from "next/image";
import { cn } from "@/lib/utils";
import { DO_TAGS } from "@/components/profile/builds-card";
import { getClassColor } from "@/components/shared/class-icon";

interface DofusbookPreviewProps {
    url: string;
    title?: string;
    className?: string;
    tags?: string[];
}

export function DofusbookPreview({ url, title, className, tags = [] }: DofusbookPreviewProps) {
    const [data, setData] = useState<DofusbookPreviewData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const idMatch = url.match(/(?:equipement\/(?:[a-z]+\/)?(\d+)|d-bk\.net\/(?:fr\/)?d\/([a-zA-Z0-9]+))/i);
    const buildId = idMatch ? (idMatch[1] || idMatch[2]) : null;

    useEffect(() => {
        async function fetchPreview() {
            if (!buildId) {
                setError("URL Dofusbook invalide.");
                setLoading(false);
                return;
            }
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`/api/dofusbook/proxy/${buildId}`);
                if (response.ok) {
                    const raw = await response.json();
                    const processed = processDofusbookRawData(buildId, raw);
                    setData(processed);
                } else {
                    const errPayload = await response.json().catch(() => ({}));
                    setError(errPayload.error || `Erreur Dofusbook (${response.status})`);
                }
            } catch (err) {
                setError("Erreur de connexion.");
            } finally {
                setLoading(false);
            }
        }
        fetchPreview();
    }, [buildId]);

    if (loading) {
        return (
            <div className={cn("flex flex-col items-center justify-center p-8 bg-zinc-900/50 rounded-2xl border border-white/5 min-h-[300px]", className)}>
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500/50" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className={cn("flex flex-col items-center justify-center p-6 bg-red-500/5 rounded-2xl border border-red-500/10 text-red-400 text-xs text-center", className)}>
                <p className="font-bold">{error || "Impossible de charger l'aperçu"}</p>
                <a href={url} target="_blank" className="mt-3 px-4 py-2 bg-red-500/10 rounded-lg underline flex items-center gap-2 hover:bg-red-500/20 transition-all">
                    Ouvrir Dofusbook <ExternalLink className="w-3 h-3" />
                </a>
            </div>
        );
    }

    const getIconId = (id: number) => id === 19 ? 20 : id;

    return (
        <div className={cn("group w-full max-w-[320px] mx-auto relative overflow-hidden bg-zinc-950/80 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-5 sm:p-6 transition-all hover:border-emerald-500/50 hover:shadow-[0_0_40px_rgba(16,185,129,0.1)]", className)}>
            <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-[80px] opacity-40 pointer-events-none" />

            <div className="flex flex-col gap-6 relative z-10 h-full">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <div className="relative w-12 h-12 shrink-0 bg-black/40 rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden shadow-inner">
                        {data.classId > 0 ? (
                            <NextImage
                                src={`/assets/dofus/classes/${getIconId(data.classId)}.png`}
                                alt={data.className}
                                width={44}
                                height={44}
                                className="object-contain p-1"
                            />
                        ) : (
                            <Users className="w-6 h-6 text-zinc-700" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-black text-[14px] text-white truncate uppercase tracking-tight leading-tight" title={title || data.name}>{title || data.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-[9px] font-black text-emerald-400 uppercase tracking-tighter">
                                Lvl {data.level}
                            </span>
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest truncate">{data.className}</p>
                        </div>
                        {tags && tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                                {tags.map(tagId => {
                                    const tagDef = DO_TAGS.find(t => t.id === tagId);
                                    if (!tagDef) return null;
                                    return (
                                        <span key={tagId} className={cn("px-1.5 py-0.5 text-[9px] rounded font-medium", tagDef.className)}>
                                            {tagDef.text}
                                        </span>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Equipment Grid - Fixed Dimensions for Uniformity */}
                <div className="flex justify-center flex-1">
                    <div className="grid grid-cols-6 grid-rows-5 gap-2 bg-black/40 p-3 rounded-[2.5rem] border border-white/5 relative w-fit shadow-2xl">
                        {/* Central Class Miniature (Local Asset) */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                            {data.classId > 0 && (
                                <div className="relative w-full h-full flex items-center justify-center">
                                    {/* Color Glow */}
                                    <div
                                        className="absolute w-28 h-28 rounded-full blur-[50px] opacity-20"
                                        style={{ backgroundColor: getClassColor(data.className.normalize("NFD").replace(/[\u0300-\u036f]/g, "")) }}
                                    />

                                    <NextImage
                                        src={`/assets/dofus/classes/${getIconId(data.classId)}.png`}
                                        alt="Class Icon"
                                        width={130}
                                        height={130}
                                        className="object-contain opacity-20 group-hover:opacity-40 transition-all duration-500 saturate-[1.2] brightness-125 select-none scale-95 group-hover:scale-105"
                                    />
                                </div>
                            )}
                        </div>

                        {[
                            { s: 'am', c: 1, r: 1 }, { s: 'a1', c: 1, r: 2 }, { s: 'a2', c: 1, r: 3 }, { s: 'br', c: 1, r: 4 },
                            { s: 'ch', c: 6, r: 1 }, { s: 'ca', c: 6, r: 2 }, { s: 'ce', c: 6, r: 3 }, { s: 'bo', c: 6, r: 4 },
                            { s: 'ar', c: 3, r: 4 }, { s: 'fa', c: 4, r: 4 },
                            { s: 'd1', c: 1, r: 5 }, { s: 'd2', c: 2, r: 5 }, { s: 'd3', c: 3, r: 5 },
                            { s: 'd4', c: 4, r: 5 }, { s: 'd5', c: 5, r: 5 }, { s: 'd6', c: 6, r: 5 },
                        ].map((slot) => {
                            const item = slot.s === 'fa'
                                ? (data.items?.['fa'] || data.items?.['mo'])
                                : data.items?.[slot.s];

                            const getImageUrl = () => {
                                if (!item) return "";

                                // Force fallback for mounts (Dofusbook returns picture: '105' which 404s on DofusDB)
                                if (slot.s === 'fa' || slot.s === 'mo') {
                                    const name = item.name.toLowerCase();
                                    if (name.includes("muldo")) return "https://api.dofusdb.fr/img/items/97322.png";
                                    if (name.includes("volkorne")) return "https://api.dofusdb.fr/img/items/97273.png";
                                    if (name.includes("dragodinde")) return "https://api.dofusdb.fr/img/items/97069.png";

                                    // If familer has no picture or has the bugged '105' generic picture from DB, fallback.
                                    // Otherwise, use the valid familier picture:
                                    if (!item.picture || item.picture === 105) {
                                        return "https://api.dofusdb.fr/img/items/121164.png";
                                    }
                                }

                                if (item.picture) return `https://api.dofusdb.fr/img/items/${item.picture}.png`;
                                return `https://www.dofusbook.net/static/dist/items/105-70.webp`;
                            };

                            return (
                                <div
                                    key={slot.s}
                                    className={cn(
                                        "w-[36px] h-[36px] rounded-xl flex items-center justify-center p-1.5 relative group/slot transition-all duration-300",
                                        item ? "bg-zinc-800/80 border border-white/20 shadow-lg hover:border-emerald-500/60 hover:scale-110 z-20 hover:bg-zinc-700" : "bg-white/[0.03] border border-white/5 opacity-40 z-10"
                                    )}
                                    style={{ gridColumnStart: slot.c, gridRowStart: slot.r }}
                                >
                                    {item ? (
                                        <>
                                            <NextImage
                                                src={getImageUrl()}
                                                alt={item.name}
                                                width={40}
                                                height={40}
                                                className="object-contain drop-shadow-md"
                                                unoptimized
                                            />
                                            <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-zinc-900 border border-white/20 text-[10px] font-black text-white px-3 py-1.5 rounded-lg opacity-0 group-hover/slot:opacity-100 transition-all scale-75 group-hover/slot:scale-100 shadow-2xl z-[100] whitespace-nowrap pointer-events-none">
                                                {item.name}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Clearer Footer */}
                <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-center">
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group/btn flex items-center gap-2 px-4 py-2 bg-white/5 rounded-2xl border border-white/10 text-[10px] font-black text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/20 transition-all uppercase tracking-widest"
                    >
                        <span>Dofusbook</span>
                        <ExternalLink className="w-3 h-3 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
                    </a>
                </div>
            </div>
        </div>
    );
}

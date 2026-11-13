"use client";

import { FocusCardData } from "@/server/actions/intelligence-actions";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import Image from "next/image";

/** Focus du moment : une ligne d'action dense. Mêmes données, zéro slop. */
export function EchoDuSigil({ data }: { data: FocusCardData }) {
    if (!data) return null;

    const progress = Math.max(0, Math.min(100, Math.round(data.priority)));

    return (
        <div className="rounded-xl border border-border/80 bg-card/90 backdrop-blur-sm px-4 py-3.5 shadow-sm hover:border-border-strong transition-colors">
            <div className="flex items-center gap-4 flex-wrap">
                {data.asset && (
                    <div className="relative h-11 w-11 rounded-xl border border-border/60 bg-surface/80 p-1 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.08)]">
                        <Image
                            src={data.asset}
                            alt={data.title}
                            width={34}
                            height={34}
                            className="object-contain"
                            unoptimized
                        />
                    </div>
                )}
                <div className="flex-1 min-w-[220px]">
                    <p className="text-sm font-semibold text-foreground">{data.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{data.description}</p>
                </div>
                {data.type === "OCRE_STEP" && (
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden" aria-hidden="true">
                            <div className="h-full rounded-full bg-success" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-xs font-bold text-foreground tabular-nums">{progress} %</span>
                    </div>
                )}
                <Link
                    href={data.actionHref}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-surface hover:bg-surface/80 border border-border px-3.5 py-2 text-xs font-semibold text-foreground transition-colors shrink-0"
                >
                    {data.actionLabel}
                    <ArrowRight className="w-3.5 h-3.5" />
                </Link>
            </div>
        </div>
    );
}

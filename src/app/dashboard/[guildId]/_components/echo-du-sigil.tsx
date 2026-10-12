"use client";

import { FocusCardData } from "@/server/actions/intelligence-actions";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

/** Focus du moment : une ligne d'action dense. Mêmes données, zéro slop. */
export function EchoDuSigil({ data }: { data: FocusCardData }) {
    if (!data) return null;

    const progress = Math.max(0, Math.min(100, Math.round(data.priority)));

    return (
        <div className="rounded-xl border border-border bg-card px-4 py-3.5">
            <div className="flex items-center gap-4 flex-wrap">
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

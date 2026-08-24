"use client";

import Link from "next/link";
import { ExternalLink, Database } from "lucide-react";

export function SuccesAttributionBanner() {
    return (
        <div className="flex flex-col gap-1.5 px-3 py-2 rounded-xl border border-border/80 bg-surface/60 backdrop-blur-xs shadow-xs text-left">
            <div className="flex items-center gap-1.5">
                <Database className="w-3 h-3 text-warning shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Sources communautaires
                </span>
            </div>
            
            <div className="flex items-center gap-2">
                {/* DofusDB */}
                <Link
                    href="https://dofusdb.fr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface hover:bg-elevated border border-border/80 hover:border-warning/50 transition-all text-xs font-semibold text-foreground shadow-xs"
                    title="DofusDB — Encyclopédie, quêtes & succès"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/assets/icons/dofusdb.png"
                        alt="DofusDB"
                        className="w-3.5 h-3.5 rounded-xs object-contain shrink-0 group-hover:scale-110 transition-transform"
                    />
                    <span>DofusDB</span>
                    <ExternalLink className="w-2.5 h-2.5 text-muted-foreground group-hover:text-warning transition-colors" />
                </Link>

                {/* Dofensive */}
                <Link
                    href="https://dofensive.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface hover:bg-elevated border border-border/80 hover:border-warning/50 transition-all text-xs font-semibold text-foreground shadow-xs"
                    title="Dofensive — Fiches tactiques & sorts de boss"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/assets/icons/dofensive.ico"
                        alt="Dofensive"
                        className="w-3.5 h-3.5 rounded-xs object-contain shrink-0 group-hover:scale-110 transition-transform"
                    />
                    <span>Dofensive</span>
                    <ExternalLink className="w-2.5 h-2.5 text-muted-foreground group-hover:text-warning transition-colors" />
                </Link>
            </div>
        </div>
    );
}

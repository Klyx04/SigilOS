"use client";

import React from "react";
import { Users, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type OverlayMember = { name: string; avatar?: string; subtitle?: string };

interface RushOverlayMembersModalProps {
  title: string;
  members: OverlayMember[];
  isLightMode: boolean;
  onClose: () => void;
}

/**
 * Modale liste de membres (présence / « je suis ici » / « qui peut aider »).
 */
export function RushOverlayMembersModal({
  title,
  members,
  isLightMode,
  onClose,
}: RushOverlayMembersModalProps) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-3">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className={cn("absolute inset-0 bg-black/60 backdrop-blur-sm", isLightMode && "bg-slate-900/40")}
      />
      <div
        className={cn(
          "relative z-10 flex flex-col w-full max-w-[340px] max-h-[70vh] rounded-2xl border overflow-hidden shadow-2xl",
          isLightMode ? "bg-white border-slate-200" : "bg-[#111419] border-[#2a3646]"
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between gap-2 px-4 py-3 border-b shrink-0",
            isLightMode ? "border-slate-200" : "border-[#28303a]/70"
          )}
        >
          <div className="flex items-center gap-2">
            <Users className={cn("w-4 h-4", isLightMode ? "text-[#39bc95]" : "text-[#39bc95]")} />
            <h2 className={cn("text-sm font-bold font-serif", isLightMode ? "text-slate-900" : "text-[#f2f0e9]")}>{title}</h2>
            <span className={cn("text-[10px] font-mono font-bold tabular-nums", isLightMode ? "text-slate-400" : "text-[#6e7784]")}>
              {members.length}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              isLightMode ? "text-slate-400 hover:text-red-500 hover:bg-red-50" : "text-[#6e7784] hover:text-red-400 hover:bg-[#1c2129]"
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {members.length === 0 ? (
            <p className={cn("py-10 text-center text-xs", isLightMode ? "text-slate-400" : "text-[#6e7784]")}>
              Personne ici pour l'instant.
            </p>
          ) : (
            members.map((m, i) => (
              <div
                key={`${m.name}-${i}`}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border px-2.5 py-2",
                  isLightMode ? "bg-slate-50 border-slate-200" : "bg-[#0d1117] border-[#1e2530]"
                )}
              >
                {m.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.avatar} alt={m.name} className="w-8 h-8 rounded-full object-cover shrink-0" loading="lazy" />
                ) : (
                  <span className="w-8 h-8 rounded-full bg-[#39bc95]/20 border border-[#39bc95]/40 text-[#39bc95] flex items-center justify-center text-[11px] font-bold uppercase shrink-0">
                    {(m.name || "?").charAt(0)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className={cn("text-[12px] font-semibold truncate", isLightMode ? "text-slate-800" : "text-[#e8e4da]")}>
                    {m.name}
                  </p>
                  {m.subtitle && (
                    <p className={cn("text-[10px] truncate", isLightMode ? "text-slate-500" : "text-[#6e7784]")}>{m.subtitle}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

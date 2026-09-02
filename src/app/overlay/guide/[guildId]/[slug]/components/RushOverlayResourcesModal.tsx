"use client";

import React, { useState } from "react";
import { Package, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RushResourceAgg } from "./overlay-utils";

interface RushOverlayResourcesModalProps {
  /** Ressources « restantes » (quêtes cochées exclues). */
  resources: RushResourceAgg[];
  /** Ressources TOTALES (statique, toutes étapes). */
  allResources: RushResourceAgg[];
  isLightMode: boolean;
  onClose: () => void;
  /** Compte total (pour affichage "X / Y restantes"). */
  totalCount?: number;
}

/**
 * Modale « Ressources » — liste AGREGÉE de tous les objets nécessaires au guide,
 * sur toutes les étapes (pas seulement l'étape courante). Dédupliqué par nom,
 * quantités sommées, avec icône DofusDB + lien. Bascule « Restantes / Toutes » :
 * par défaut on ne montre que les ressources des quêtes pas encore validées
 * (décrément en direct selon les cases cochées).
 */
export function RushOverlayResourcesModal({
  resources,
  allResources,
  isLightMode,
  onClose,
  totalCount,
}: RushOverlayResourcesModalProps) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"restantes" | "toutes">("restantes");
  const list = mode === "restantes" ? resources : allResources;
  const visible = query.trim()
    ? list.filter((r) => r.name.toLowerCase().includes(query.trim().toLowerCase()))
    : list;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-3">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Fermer la liste des ressources"
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/60 backdrop-blur-sm",
          isLightMode && "bg-slate-900/40"
        )}
      />

      {/* Panneau */}
      <div
        className={cn(
          "relative z-10 flex flex-col w-full max-w-[420px] max-h-[80vh] rounded-2xl border overflow-hidden shadow-2xl",
          isLightMode ? "bg-white border-slate-200" : "bg-[#111419] border-[#2a3646]"
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "flex items-center justify-between gap-2 px-4 py-3 border-b shrink-0",
            isLightMode ? "border-slate-200" : "border-[#28303a]/70"
          )}
        >
          <div className="flex items-center gap-2">
            <Package className={cn("w-4 h-4", isLightMode ? "text-amber-600" : "text-[#d5a94e]")} />
            <h2 className={cn("text-sm font-bold font-serif", isLightMode ? "text-slate-900" : "text-[#f2f0e9]")}>
              Ressources à prévoir
            </h2>
            <span className={cn("text-[10px] font-mono tabular-nums font-bold", isLightMode ? "text-slate-400" : "text-[#6e7784]")}>
              {list.length}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              isLightMode
                ? "text-slate-400 hover:text-red-500 hover:bg-red-50"
                : "text-[#6e7784] hover:text-red-400 hover:bg-[#1c2129]"
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Bascule Restantes / Toutes */}
        <div className="flex items-center gap-1 px-4 pt-2.5 shrink-0">
          {([["restantes", "Restantes"], ["toutes", "Toutes"]] as const).map(([m, label]) => {
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors",
                  active
                    ? isLightMode
                      ? "bg-amber-100 text-amber-700 border border-amber-300"
                      : "bg-[#d5a94e]/15 text-[#d5a94e] border border-[#d5a94e]/30"
                    : isLightMode
                    ? "text-slate-400 hover:text-slate-600"
                    : "text-[#6e7784] hover:text-[#f2f0e9]"
                )}
              >
                {label}
              </button>
            );
          })}
          <span
            className={cn("ml-auto text-[10px] font-mono tabular-nums font-bold", isLightMode ? "text-slate-400" : "text-[#6e7784]")}
            title={totalCount != null ? `Total sur toutes les étapes : ${totalCount}` : undefined}
          >
            {mode === "restantes" && totalCount != null ? `${list.length} / ${totalCount}` : `${list.length}`}
          </span>
        </div>

        {/* Recherche interne */}
        <div className="px-3 pt-3 shrink-0">
          <div
            className={cn(
              "flex items-center gap-2 h-9 px-3 rounded-lg border",
              isLightMode ? "bg-white border-slate-200" : "bg-[#181c22] border-[#28303a]"
            )}
          >
            <Search className={cn("w-3.5 h-3.5", isLightMode ? "text-slate-400" : "text-[#6e7783]")} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrer un objet…"
              aria-label="Filtrer les ressources"
              className={cn(
                "flex-1 min-w-0 bg-transparent text-xs outline-none",
                isLightMode ? "text-slate-900 placeholder:text-slate-400" : "text-[#f2f0e9] placeholder:text-[#6e7784]"
              )}
            />
          </div>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {visible.length === 0 ? (
            <p className={cn("py-10 text-center text-xs", isLightMode ? "text-slate-400" : "text-[#6e7784]")}>
              Aucune ressource trouvée.
            </p>
          ) : (
            visible.map((r) => (
              <div
                key={r.key}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border px-2.5 py-2",
                  isLightMode ? "bg-slate-50 border-slate-200" : "bg-[#0d1117] border-[#1e2530]"
                )}
              >
                {/* Icône */}
                <div
                  className={cn(
                    "shrink-0 w-9 h-9 rounded-lg flex items-center justify-center border overflow-hidden",
                    isLightMode ? "bg-white border-slate-200" : "bg-[#1c2129] border-[#2c3646]"
                  )}
                >
                  {r.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.imageUrl} alt={r.name} className="w-7 h-7 object-contain" loading="lazy" />
                  ) : (
                    <Package className={cn("w-4 h-4", isLightMode ? "text-amber-400" : "text-[#d5a94e]/60")} />
                  )}
                </div>

                {/* Nom + méta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={cn("text-[12px] font-semibold truncate", isLightMode ? "text-slate-800" : "text-[#e8e4da]")}>
                      {r.name}
                    </p>
                    {(r.levels?.length ?? 0) > 0 && (
                      <span className={cn("text-[9px] font-mono", isLightMode ? "text-slate-400" : "text-[#6e7784]")}>
                        Niv. {r.levels!.join("/")}
                      </span>
                    )}
                  </div>
                  {(r.chapters?.length ?? 0) > 0 && (
                    <p className={cn("text-[9px]", isLightMode ? "text-slate-400" : "text-[#6e7784]")}>
                      Chapitre{r.chapters!.length > 1 ? "s" : ""} {Array.from(new Set(r.chapters!.map((c) => c + 1))).join(", ")}
                    </p>
                  )}
                </div>

                {/* Quantité */}
                <span className={cn("shrink-0 text-[12px] font-bold font-mono tabular-nums", isLightMode ? "text-amber-700" : "text-[#e6c16f]")}>
                  ×{r.count}
                </span>

                {/* Lien */}
                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Voir ${r.name} sur DofusDB`}
                    className={cn(
                      "shrink-0 p-1 rounded transition-colors",
                      isLightMode ? "text-slate-400 hover:text-emerald-600" : "text-[#6e7784] hover:text-[#74d6b6]"
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="https://www.google.com/s2/favicons?domain=dofusdb.fr&sz=16" alt="" className="w-3.5 h-3.5 rounded-sm" />
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

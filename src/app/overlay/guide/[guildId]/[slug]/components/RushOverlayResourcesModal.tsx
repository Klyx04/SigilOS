"use client";

import React, { useEffect, useState } from "react";
import { Package, X, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/lib/clipboard";
import type { RushResourceAgg } from "./overlay-utils";
import { ResourceImage } from "@/components/dofus-quests/ResourceImage";
import { BRAND_ICONS } from "@/lib/source-icons";

interface RushOverlayResourcesModalProps {
  /** Ressources « restantes » (quêtes cochées exclues). */
  resources: RushResourceAgg[];
  /** Ressources TOTALES (statique, toutes étapes). */
  allResources: RushResourceAgg[];
  isLightMode: boolean;
  onClose: () => void;
  /** Compte total (pour affichage "X / Y restantes"). */
  totalCount?: number;
  /**
   * `overlay` (défaut) — mini-fenêtre de jeu : sombre par nature, inchangée.
   * `site` — page publique SigilOS : couche « registre ». Le panneau est plus
   * large (58 rem max, 95 vw sur mobile), la liste passe en colonnes sur grand
   * écran, et les surfaces viennent des tokens du site au lieu de gris codés en
   * dur empilés les uns sur les autres.
   */
  theme?: "site" | "overlay";
}

/**
 * Modale « Ressources » — liste AGREGÉE de tous les objets nécessaires au guide,
 * sur toutes les étapes (pas seulement l'étape courante). Dédupliqué par nom,
 * quantités sommées, avec icône DofusDB + lien. Bascule « Restantes / Toutes » :
 * par défaut on ne montre que les ressources des quêtes pas encore validées
 * (décrément en direct selon les cases cochées — l'appelant doit donc passer
 * `aggregateRushResources(milestones, completedSeqIds)` dans `resources`).
 */
export function RushOverlayResourcesModal({
  resources,
  allResources,
  isLightMode,
  onClose,
  totalCount,
  theme = "overlay",
}: RushOverlayResourcesModalProps) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"restantes" | "toutes">("restantes");
  const list = mode === "restantes" ? resources : allResources;
  const visible = query.trim()
    ? list.filter((r) => r.name.toLowerCase().includes(query.trim().toLowerCase()))
    : list;

  const isSite = theme === "site";
  /** Site (tokens du registre) → thème clair → thème sombre de l'overlay. */
  const pick = (siteCls: string, lightCls: string, darkCls: string) =>
    isSite ? siteCls : isLightMode ? lightCls : darkCls;

  // Échap ferme la liste : même comportement que les autres modales du rush.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Fermer la liste des ressources"
        onClick={onClose}
        className={cn(
          "fixed inset-0",
          pick("bg-black/60", "bg-slate-900/50", "bg-black/70 backdrop-blur-md")
        )}
      />

      {/* Panneau */}
      <div
        className={cn(
          "relative z-10 flex flex-col w-full border overflow-hidden",
          pick(
            "max-w-[min(58rem,95vw)] max-h-[88vh] rounded-lg border-border-strong bg-background",
            "max-w-[420px] max-h-[80vh] rounded-2xl border-slate-200 bg-white shadow-2xl",
            "max-w-[420px] max-h-[80vh] rounded-2xl border-[#2a3646] bg-[#111419] shadow-2xl"
          )
        )}
      >

        {/* Header */}
        <div
          className={cn(
            "flex items-center justify-between gap-2 px-4 py-3 border-b shrink-0",
            pick("border-border", "border-slate-200", "border-[#28303a]/70")
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Package className={cn("w-4 h-4 shrink-0", pick("text-warning", "text-amber-600", "text-[#d5a94e]"))} />
            <h2
              className={cn(
                "text-sm font-bold min-w-0 truncate",
                pick("text-foreground", "font-serif text-slate-900", "font-serif text-[#f2f0e9]")
              )}
            >
              Ressources à prévoir
            </h2>
            <span
              className={cn(
                "text-[10px] font-bold tabular-nums shrink-0 whitespace-nowrap",
                pick("reg-mono text-muted-foreground", "font-mono text-slate-400", "font-mono text-[#6e7784]")
              )}
            >
              {list.length}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className={cn(
              "p-1.5 transition-colors",
              pick(
                "rounded-md text-muted-foreground hover:text-foreground hover:bg-surface",
                "rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50",
                "rounded-lg text-[#6e7784] hover:text-red-400 hover:bg-[#1c2129]"
              )
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Bascule Restantes / Toutes */}
        <div className="flex items-center gap-1.5 px-4 pt-2.5 shrink-0">
          {([["restantes", "Restantes"], ["toutes", "Toutes"]] as const).map(([m, label]) => {
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors",
                  pick(
                    active ? "reg-tag reg-tag-accent" : "reg-tag text-muted-foreground hover:text-foreground",
                    active ? "bg-amber-100 text-amber-700 border border-amber-300" : "text-slate-400 hover:text-slate-600",
                    active ? "bg-[#d5a94e]/15 text-[#d5a94e] border border-[#d5a94e]/30" : "text-[#6e7784] hover:text-[#f2f0e9]"
                  )
                )}
              >
                {label}
              </button>
            );
          })}
          <span
            className={cn(
              "ml-auto text-[10px] font-bold tabular-nums",
              pick("reg-mono text-muted-foreground", "font-mono text-slate-400", "font-mono text-[#6e7784]")
            )}
            title={totalCount != null ? `Total sur toutes les étapes : ${totalCount}` : undefined}
          >
            {mode === "restantes" && totalCount != null ? `${list.length} / ${totalCount}` : `${list.length}`}
          </span>
        </div>

        {/* Recherche interne */}
        <div className="px-3 pt-3 shrink-0">
          <div
            className={cn(
              "flex items-center gap-2 h-9 px-3 border",
              pick(
                "rounded-md border-border bg-surface",
                "rounded-lg bg-white border-slate-200",
                "rounded-lg bg-[#181c22] border-[#28303a]"
              )
            )}
          >
            <Search className={cn("w-3.5 h-3.5", pick("text-muted-foreground", "text-slate-400", "text-[#6e7783]"))} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrer un objet…"
              aria-label="Filtrer les ressources"
              className={cn(
                "flex-1 min-w-0 bg-transparent text-xs outline-none",
                pick(
                  "text-foreground placeholder:text-muted-foreground",
                  "text-slate-900 placeholder:text-slate-400",
                  "text-[#f2f0e9] placeholder:text-[#6e7784]"
                )
              )}
            />
          </div>
        </div>

        {/* Liste — une colonne sur mobile, deux à trois colonnes dès qu'il y a la place */}
        <div
          className={cn(
            "flex-1 overflow-y-auto",
            pick(
              "p-4 grid gap-1.5 md:grid-cols-2 xl:grid-cols-3 content-start",
              "p-3 space-y-1.5",
              "p-3 space-y-1.5"
            )
          )}
        >
          {visible.length === 0 ? (
            <p
              className={cn(
                "py-10 text-center text-xs",
                pick("text-muted-foreground md:col-span-2 xl:col-span-3", "text-slate-400", "text-[#6e7784]")
              )}
            >
              Aucune ressource trouvée.
            </p>
          ) : (
            visible.map((r) => (
              <div
                key={r.key}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 border",
                  pick(
                    "rounded-md border-border bg-surface",
                    "rounded-xl border-slate-200 bg-slate-50",
                    "rounded-xl border-[#1e2530] bg-[#0d1117]"
                  )
                )}
              >
                {/* Icône */}
                <div
                  className={cn(
                    "shrink-0 w-9 h-9 flex items-center justify-center border overflow-hidden",
                    pick(
                      "rounded-md border-border bg-background",
                      "rounded-lg border-slate-200 bg-white",
                      "rounded-lg border-[#2c3646] bg-[#1c2129]"
                    )
                  )}
                >
                  {r.imageUrl ? (
                    <ResourceImage id={r.id} imageUrl={r.imageUrl} alt={r.name} className="w-7 h-7 object-contain" />
                  ) : (
                    <Package className={cn("w-4 h-4", pick("text-warning", "text-amber-400", "text-[#d5a94e]/60"))} />
                  )}
                </div>

                {/* Nom + méta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => { copyToClipboard(r.name).then((ok) => { if (ok) toast.success(`Nom copié : ${r.name}`, { duration: 1600 }); }); }}
                      title={`Copier le nom « ${r.name} »`}
                      aria-label={`Copier le nom ${r.name}`}
                      className={cn(
                        "text-[12px] font-semibold truncate min-w-0 flex-1 text-left transition-colors cursor-pointer",
                        pick("text-foreground hover:text-accent", "text-slate-800 hover:text-[#e6b96b]", "text-[#e8e4da] hover:text-[#e6b96b]")
                      )}
                    >
                      {r.name}
                    </button>
                    {(r.levels?.length ?? 0) > 0 && (
                      <span className={cn("text-[9px]", pick("reg-mono text-muted-foreground", "font-mono text-slate-400", "font-mono text-[#6e7784]"))}>
                        Niv. {r.levels!.join("/")}
                      </span>
                    )}
                  </div>
                  {(r.chapters?.length ?? 0) > 0 && (
                    <p className={cn("text-[9px]", pick("text-muted-foreground", "text-slate-400", "text-[#6e7784]"))}>
                      Chapitre{r.chapters!.length > 1 ? "s" : ""} {Array.from(new Set(r.chapters!.map((c) => c + 1))).join(", ")}
                    </p>
                  )}
                </div>

                {/* Quantité — donnée de jeu : l'ocre du registre sur le site */}
                <span className={cn("shrink-0 text-[12px] font-bold tabular-nums", pick("reg-mono text-warning", "font-mono text-amber-700", "font-mono text-[#e6c16f]"))}>
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
                      pick("text-muted-foreground hover:text-accent", "text-slate-400 hover:text-emerald-600", "text-[#6e7784] hover:text-[#74d6b6]")
                    )}
                  >
                    {/* Logo DofusDB servi en local (pas de requête vers google.com/s2/favicons) */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={BRAND_ICONS.dofusdb.src} alt="" className="h-3.5 w-3.5 rounded-[3px]" loading="lazy" />
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

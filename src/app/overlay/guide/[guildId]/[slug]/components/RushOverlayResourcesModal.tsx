"use client";

import React, { useEffect, useState } from "react";
import { X, Search, Check } from "lucide-react";
import { useOverlayToast } from "@/components/rush/overlay-toast";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/lib/clipboard";
import type { RushResourceAgg } from "./overlay-utils";
import { ResourceImage } from "@/components/dofus-quests/ResourceImage";
import { BRAND_ICONS } from "@/lib/source-icons";
import { RUSH_RESOURCES_PICTO } from "@/lib/rush-guide-utils";

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
  /** Clés cochées à la MAIN (« j'ai déjà préparé cet objet »), par personnage. */
  checkedKeys?: Set<string>;
  /**
   * Coche/décoche une ressource. Sans handler, aucune case n'est affichée (l'overlay
   * public en lecture seule garde sa liste telle quelle).
   */
  onToggleCheck?: (key: string) => void;
  /**
   * Le toggle « Masquer les étapes faites » du guide PRIME sur cette modale : quand il est
   * actif, seules les ressources RESTANTES sont listées et la bascule locale
   * « Restantes / Toutes » n'est plus rendue (un seul état pour une même chose).
   */
  hideProvidedResources?: boolean;
}

const EMPTY_KEYS = new Set<string>();

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
  onClose,
  totalCount,
  theme = "overlay",
  checkedKeys,
  onToggleCheck,
  hideProvidedResources = false,
}: RushOverlayResourcesModalProps) {
  const toast = useOverlayToast();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"restantes" | "toutes">("restantes");
  const checked = checkedKeys ?? EMPTY_KEYS;
  // Le toggle du guide prime sur la bascule locale (cf. `hideProvidedResources`).
  const effectiveMode = hideProvidedResources ? "restantes" : mode;
  const list = effectiveMode === "restantes" ? resources : allResources;
  // Les ressources cochées à la main restent DANS la liste (on doit pouvoir décocher),
  // mais elles descendent en bas : ce qu'il reste à préparer se lit en premier.
  const visible = (query.trim()
    ? list.filter((r) => r.name.toLowerCase().includes(query.trim().toLowerCase()))
    : list
  )
    .slice()
    .sort((a, b) => Number(checked.has(a.key)) - Number(checked.has(b.key)));

  // Compteur : en mode « restantes », ce qu'il reste = non validé PAR LES QUÊTES et
  // non coché à la main.
  const remainingCount = resources.filter((r) => !checked.has(r.key)).length;

  const isSite = theme === "site";
  /**
   * Site (tokens du registre) → overlay (DA « Carnet de campagne »).
   * L'overlay ne peint plus avec des gris codés en dur : `.rush-overlay` porte sa
   * palette, et `.light` la décline pour le thème clair. Le thème `site` est intact.
   */
  const pick = (siteCls: string, overlayCls: string) => (isSite ? siteCls : overlayCls);

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
          pick("bg-black/60", "bg-black/70")
        )}
      />

      {/* Panneau */}
      <div
        className={cn(
          "relative z-10 flex flex-col w-full border overflow-hidden",
          pick(
            "max-w-[min(58rem,95vw)] max-h-[88vh] rounded-lg border-border-strong bg-background",
            "rush-carnet max-w-[420px] max-h-[80vh] rounded-[6px] bg-elevated"
          )
        )}
      >

        {/* Header */}
        <div
          className={cn(
            "flex items-center justify-between gap-2 px-4 py-3 border-b shrink-0",
            pick("border-border", "border-border-strong bg-surface/60")
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            {/* Picto RÉEL du jeu (source unique `RUSH_RESOURCES_PICTO`) — plus de carré
                Lucide `Package`, qui divergeait du guide interne et du public. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={RUSH_RESOURCES_PICTO} alt="" loading="lazy" className="w-4 h-4 object-contain shrink-0" />
            <h2
              className={cn(
                "text-sm font-semibold min-w-0 truncate",
                pick("text-foreground", "font-serif text-foreground")
              )}
            >
              Ressources à prévoir
            </h2>
            <span
              className={cn(
                "text-[10px] font-semibold tabular-nums shrink-0 whitespace-nowrap",
                pick("reg-mono text-muted-foreground", "font-mono text-muted-foreground")
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
                "rounded-[4px] text-muted-foreground hover:text-foreground hover:bg-surface"
              )
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Bascule Restantes / Toutes — escamotée quand le guide impose déjà « restantes » */}
        <div className="flex items-center gap-1.5 px-4 pt-2.5 shrink-0">
          {!hideProvidedResources &&
            ([["restantes", "Restantes"], ["toutes", "Toutes"]] as const).map(([m, label]) => {
            const active = effectiveMode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-[3px] border px-2.5 py-1 text-[10px] font-semibold transition-colors motion-reduce:transition-none",
                  pick(
                    active ? "reg-tag reg-tag-accent" : "reg-tag text-muted-foreground hover:text-foreground",
                    active ? "border-gold/60 bg-gold/10 text-foreground" : "border-transparent text-muted-foreground hover:bg-elevated hover:text-foreground"
                  )
                )}
              >
                {label}
              </button>
            );
          })}
          <span
            className={cn(
              "ml-auto text-[10px] font-semibold tabular-nums",
              pick("reg-mono text-muted-foreground", "font-mono text-muted-foreground")
            )}
            title={totalCount != null ? `Total sur toutes les étapes : ${totalCount}` : undefined}
          >
            {effectiveMode === "restantes" && totalCount != null ? `${remainingCount} / ${totalCount}` : `${list.length}`}
          </span>
        </div>

        {/* Recherche interne */}
        <div className="px-3 pt-3 shrink-0">
          <div
            className={cn(
              "flex items-center gap-2 h-9 px-3 border",
              pick(
                "rounded-md border-border bg-surface",
                "rush-carnet rounded-[4px] bg-surface"
              )
            )}
          >
            <Search className={cn("w-3.5 h-3.5", pick("text-muted-foreground", "text-muted-foreground"))} />
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
                  "text-foreground placeholder:text-muted-foreground"
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
              // Colonnes à largeur MINIMALE (15 rem) : un nom long passe à la ligne,
              // il n'est jamais cassé lettre par lettre par une colonne écrasée.
              "p-4 grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-1.5 content-start",
              "p-3 space-y-1.5"
            )
          )}
        >
          {visible.length === 0 ? (
            <p
              className={cn(
                "py-10 text-center text-xs",
                pick("text-muted-foreground col-span-full", "text-muted-foreground")
              )}
            >
              Aucune ressource trouvée.
            </p>
          ) : (
            visible.map((r) => {
              const isChecked = checked.has(r.key);
              return (
              <div
                key={r.key}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 border",
                  pick(
                    "rounded-md border-border bg-surface",
                    "rounded-[4px] border-border bg-surface"
                  )
                )}
              >
                {/* Case « déjà préparé » — le geste est manuel et par personnage :
                    une quête invalidée remet ses ressources à zéro (côté serveur). */}
                {onToggleCheck && (
                  <button
                    type="button"
                    onClick={() => onToggleCheck(r.key)}
                    aria-pressed={isChecked}
                    aria-label={isChecked ? `Remettre « ${r.name} » à préparer` : `Marquer « ${r.name} » comme préparé`}
                    title={isChecked ? "Déjà préparé — cliquer pour décocher" : "J'ai déjà préparé cet objet"}
                    className={cn(
                      "shrink-0 w-4 h-4 rounded-[3px] border flex items-center justify-center transition-colors",
                      isChecked
                        ? pick("border-success/70 text-success", "border-success text-success")
                        : pick("border-border-strong text-transparent hover:border-success", "border-border-strong text-transparent hover:border-success")
                    )}
                  >
                    <Check className="w-3 h-3 stroke-[3]" aria-hidden="true" />
                  </button>
                )}

                {/* Icône */}
                <div
                  className={cn(
                    "shrink-0 w-9 h-9 flex items-center justify-center border overflow-hidden",
                    pick(
                      "rounded-md border-border bg-background",
                      "rounded-[4px] border-border bg-background"
                    )
                  )}
                >
                  {r.imageUrl ? (
                    <ResourceImage id={r.id} imageUrl={r.imageUrl} alt={r.name} className="w-7 h-7 object-contain" />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={RUSH_RESOURCES_PICTO} alt="" loading="lazy" className="w-4 h-4 object-contain opacity-60" />
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
                        // Nom COMPLET : il n'est plus tronqué (retour user : « le texte est
                        // mangé ») — on passe à la ligne, l'icône et la quantité restent
                        // alignées sur la première ligne.
                        "text-[12px] font-semibold min-w-0 flex-1 text-left transition-colors cursor-pointer break-words",
                        isChecked && "line-through opacity-60",
                        pick("text-foreground hover:text-accent", "text-foreground hover:text-accent")
                      )}
                    >
                      {r.name}
                    </button>
                    {(r.levels?.length ?? 0) > 0 && (
                      <span className={cn("text-[9px]", pick("reg-mono text-muted-foreground", "font-mono text-muted-foreground"))}>
                        Niv. {r.levels!.join("/")}
                      </span>
                    )}
                  </div>
                  {(r.chapters?.length ?? 0) > 0 && (
                    <p className={cn("text-[9px]", pick("text-muted-foreground", "text-muted-foreground"))}>
                      Chapitre{r.chapters!.length > 1 ? "s" : ""} {Array.from(new Set(r.chapters!.map((c) => c + 1))).join(", ")}
                    </p>
                  )}
                </div>

                {/* Quantité — donnée de jeu : l'ocre du registre sur le site */}
                <span className={cn("shrink-0 text-[12px] font-semibold tabular-nums", pick("reg-mono text-warning", "font-mono text-gold"))}>
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
                      pick("text-muted-foreground hover:text-accent", "text-muted-foreground hover:text-accent")
                    )}
                  >
                    {/* Logo DofusDB servi en local (pas de requête vers google.com/s2/favicons) */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={BRAND_ICONS.dofusdb.src} alt="" className="h-3.5 w-3.5 rounded-[3px]" loading="lazy" />
                  </a>
                )}
              </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

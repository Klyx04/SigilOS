"use client";

import React, { useState, useEffect } from "react";
import { Sun, Moon, ExternalLink, Package, Eye, EyeOff, HelpCircle, RotateCcw, Crown, Users, Check, X, MoreVertical, Bug } from "lucide-react";
import { RushOverlayFeedbackPanel } from "./RushOverlayFeedbackPanel";
import { getClass } from "@/lib/dofus-assets";
import { cn } from "@/lib/utils";

import { toast } from "sonner";

interface RushOverlayHeaderProps {
  guideName: string;
  guideSlug: string;
  guildId?: string;
  dofusImageUrl: string;
  totalSteps: number;
  completedSteps: number;
  overallPct: number;
  isLightMode: boolean;
  onToggleTheme: () => void;
  onOpenResources: () => void;
  hideCompleted: boolean;
  onToggleHideCompleted: () => void;
  onOpenTutorial: () => void;
  /** Étape courante (ex: "Chapitre 3 · Quête X") pré-remplie dans le retour bug */
  bugContext?: string;
  /** Personnage courant affiché (pseudo + classe + main/mule) */
  character?: { pseudo: string; classe: string | null; isMain: boolean };
  /** Réinitialise toute la progression du guide */
  onResetGuide?: () => void;
  className?: string;
  /** Overlay réduit (largeur/hauteur) : masque le contenu secondaire et groupe les actions. */
  isNarrow?: boolean;
  /** Mode invité sans guilde ni compte */
  isGuest?: boolean;
  /**
   * Quête Ocre : résumé affiché en pastille sur le bouton (membre dont le compte
   * Metamob est lié, overlay INTERNE uniquement). `null`/absent ⇒ aucun bouton.
   */
  ocre?: { missing: number; percent: number } | null;
  /** Ouvre le panneau Quête Ocre. Sans ce callback, le bouton n'est jamais rendu. */
  onOpenOcre?: () => void;
}

/**
 * Header fixe de l'overlay.
 * - Nom du guide + progression explicite (N / M étapes · X%)
 * - Icône Dofus (œuf)
 * - Bascule thème Clair/Sombre
 * - Lien dashboard
 */
export function RushOverlayHeader({
  guideName,
  guideSlug,
  guildId = "public",
  dofusImageUrl,
  totalSteps,
  completedSteps,
  overallPct,
  isLightMode,
  onToggleTheme,
  onOpenResources,
  hideCompleted,
  onToggleHideCompleted,
  onOpenTutorial,
  bugContext,
  character,
  onResetGuide,
  className,
  isNarrow: isNarrowProp,
  isGuest = false,
  ocre,
  onOpenOcre,
}: RushOverlayHeaderProps) {
  // Confirmation en 2 temps du reset (évite le reset accidentel).
  const [confirmReset, setConfirmReset] = useState(false);
  // Panneau de retour intégré à l'overlay (jamais la modale dashboard).
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  // Menu « plus » : regroupe les actions secondaires quand l'overlay est étroit.
  const [moreOpen, setMoreOpen] = useState(false);
  // Détection de largeur étroite → on groupe les actions secondaires dans un menu ⋯.
  const [domNarrow, setDomNarrow] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 580px), (max-height: 640px)");
    const update = () => setDomNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  // La prop `isNarrow` (ResizeObserver du conteneur) prime sur la détection window.
  const narrow = typeof isNarrowProp === "boolean" ? isNarrowProp : domNarrow;

  // Retour / bug : le bouton vit dans le menu « ⋯ » (place libérée pour l'archimonstre),
  // et reste un bouton direct quand l'overlay est large.
  const openFeedback = () => {
    if (isGuest) {
      toast.info("Une remarque ou un bug ? Rejoignez notre Discord !", { duration: 2500 });
      return;
    }
    setFeedbackOpen(true);
  };

  // Style commun des entrées du menu « plus » (dropdown).
  const menuItemCls = cn(
    "flex items-center gap-2 w-full px-3 py-2 text-left text-[11px] font-semibold transition-colors",
    isLightMode ? "text-slate-700 hover:bg-slate-100" : "text-[#c4cad2] hover:bg-[#1f2733]"
  );

  return (
    <header
      className={cn(
        "shrink-0 flex flex-col gap-2 border-b",
        narrow ? "px-3 pt-2 pb-2" : "px-4 pt-3 pb-2.5",
        isLightMode
          ? "bg-gradient-to-b from-white to-slate-50 border-slate-200"
          : "bg-gradient-to-b from-[#131820] to-[#0b0d10] border-[#1e2530]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Gauche : branding + titre + compteur */}
        <div className="flex-1 min-w-0">
          {/* Label discret (masqué en overlay réduit pour gagner de la hauteur) */}
          {!narrow && (
            <span
              className={cn(
                "block text-[9px] font-black uppercase tracking-[0.15em] mb-0.5",
                isLightMode ? "text-[#d5a94e]" : "text-[#d5a94e]/80"
              )}
            >
              Guide de progression
            </span>
          )}

          {/* Nom du guide */}
          <h1
            className={cn(
              "text-sm font-bold leading-tight truncate",
              isLightMode ? "text-slate-900" : "text-[#f2f0e9]"
            )}
          >
            {guideName}
          </h1>

          {/* Progression explicite */}
          <p
            className={cn(
              "text-[10px] mt-0.5 tabular-nums",
              isLightMode ? "text-slate-500" : "text-[#6e7784]"
            )}
          >
            <span className={cn("font-bold", isLightMode ? "text-slate-700" : "text-[#969daa]")}>
              {completedSteps} / {totalSteps}
            </span>{" "}
            étapes ·{" "}
            <span className="font-bold text-[#39bc95]">{overallPct}%</span>
          </p>

          {/* Personnage courant (masqué en overlay réduit) */}
          {character && !narrow && (
            <div className="flex items-center gap-1.5 mt-1">
              <span className="shrink-0 w-4 h-4 flex items-center justify-center rounded-md bg-[#181d23] border border-[#2a3646]">
                {character.classe ? (
                  (() => {
                    const d = getClass(character.classe);
                    return d ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.icon} alt={d.name} className="w-3.5 h-3.5 object-contain" />
                    ) : (
                      <Users className="w-3 h-3 text-blue-400" />
                    );
                  })()
                ) : character.isMain ? (
                  <Crown className="w-3 h-3 text-amber-500" />
                ) : (
                  <Users className="w-3 h-3 text-blue-400" />
                )}
              </span>
              <span className={cn("text-[10px] font-semibold truncate", isLightMode ? "text-slate-700" : "text-[#c4cad2]")}>
                {character.pseudo}
              </span>
              <span className={cn("text-[9px] font-mono uppercase font-bold", isGuest ? "text-emerald-400" : character.isMain ? "text-amber-500" : "text-blue-400")}>
                {isGuest ? "Invité" : character.isMain ? "Main" : "Mule"}
              </span>
            </div>
          )}
        </div>

        {/* Droite : actions + œuf Dofus */}
        <div className="relative flex items-center gap-1.5 shrink-0">
          {/* Thème */}
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isLightMode ? "Passer en mode sombre" : "Passer en mode clair"}
            title={isLightMode ? "Mode Sombre" : "Mode Clair"}
            className={cn(
              "p-1.5 rounded-lg border transition-colors",
              isLightMode
                ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                : "bg-[#181d23] border-[#2a3646] text-[#d5a94e] hover:bg-[#1f2733]"
            )}
          >
            {isLightMode ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
          </button>

          {/* Ressources (toutes étapes) */}
          <button
            type="button"
            onClick={onOpenResources}
            aria-label="Voir toutes les ressources à prévoir"
            title="Ressources à prévoir"
            className={cn(
              "p-1.5 rounded-lg border transition-colors",
              isLightMode
                ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                : "bg-[#181d23] border-[#2a3646] text-[#d5a94e] hover:bg-[#1f2733]"
            )}
          >
            <Package className="w-3.5 h-3.5" />
          </button>

          {/* Quête Ocre (Metamob) — overlay interne uniquement : pastille du reste à capturer */}
          {onOpenOcre && ocre && (
            <button
              type="button"
              onClick={onOpenOcre}
              aria-label={`Quête Ocre : ${ocre.missing} cibles restantes`}
              title={`Quête Ocre · ${ocre.missing} archis / gardiens restants · ${ocre.percent}%`}
              className={cn(
                "relative p-1.5 rounded-lg border transition-colors",
                isLightMode
                  ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                  : "bg-[#181d23] border-[#2a3646] text-[#d5a94e] hover:bg-[#1f2733]"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/dofus/icons/archimonster.png"
                alt=""
                className="w-3.5 h-3.5 object-contain"
              />
              {ocre.missing > 0 ? (
                <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 rounded-full bg-[#e2726f] text-black text-[9px] font-black tabular-nums leading-[15px] text-center">
                  {ocre.missing > 99 ? "99+" : ocre.missing}
                </span>
              ) : (
                <span className="absolute -top-1 -right-1 w-[15px] h-[15px] rounded-full bg-[#39bc95] text-black grid place-items-center">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </span>
              )}
            </button>
          )}

          {/* Masquer les quêtes terminées */}
          <button
            type="button"
            onClick={onToggleHideCompleted}
            aria-label={hideCompleted ? "Afficher les quêtes terminées" : "Masquer les quêtes terminées"}
            title={hideCompleted ? "Afficher les quêtes terminées" : "Masquer les quêtes terminées"}
            className={cn(
              "p-1.5 rounded-lg border transition-colors",
              hideCompleted
                ? "bg-[#39bc95]/20 text-[#2b9f7d] border border-[#39bc95]/40"
                : "bg-[#181d23] border-[#2a3646] text-[#6e7784] hover:bg-[#1f2733]",
              isLightMode && !hideCompleted && "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200"
            )}
          >
            {hideCompleted ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>

          {/* Signaler un bug / retour — déplacé dans le menu « ⋯ » (place rendue à l'archimonstre) */}
          {!isGuest && feedbackOpen && (
            <RushOverlayFeedbackPanel
              guildId={guildId}
              sourcePage={`guide:overlay:${guideSlug}`}
              targetSlug={guideSlug}
              context={bugContext}
              isLightMode={isLightMode}
              onClose={() => setFeedbackOpen(false)}
            />
          )}

          {narrow ? (
            <>
              <button
                type="button"
                onClick={() => setMoreOpen((o) => !o)}
                aria-label="Plus d'options"
                title="Plus d'options"
                className={cn(
                  "p-1.5 rounded-lg border transition-colors",
                  isLightMode
                    ? "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200"
                    : "bg-[#181d23] border-[#2a3646] text-[#6e7784] hover:text-[#f2f0e9] hover:bg-[#1f2733]"
                )}
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
              {moreOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                  <div
                    className={cn(
                      "absolute top-full right-0 mt-1 z-50 w-48 rounded-xl border py-1 shadow-2xl overflow-hidden",
                      isLightMode ? "bg-white border-slate-200" : "bg-[#14181f] border-[#2a3646]"
                    )}
                  >
                    <button type="button" onClick={() => { setMoreOpen(false); onOpenTutorial(); }} className={menuItemCls}>
                      <HelpCircle className="w-3.5 h-3.5" /> Aide / tutoriel
                    </button>
                    <button type="button" onClick={() => { setMoreOpen(false); openFeedback(); }} className={menuItemCls}>
                      <Bug className="w-3.5 h-3.5" /> Signaler un bug
                    </button>
                    <a
                      href={isGuest ? `/guides/${guideSlug}` : `/dashboard/${guildId}/quetes-dofus/guide/${guideSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setMoreOpen(false)}
                      className={menuItemCls}
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Guide complet
                    </a>
                    <button type="button" onClick={() => { setMoreOpen(false); setConfirmReset(true); }} className={cn(menuItemCls, "hover:text-[#e2726f]")}>
                      <RotateCcw className="w-3.5 h-3.5" /> Réinitialiser
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
          {/* Tutoriel */}
          <button
            type="button"
            onClick={onOpenTutorial}
            aria-label="Aide / tutoriel de l'overlay"
            title="Comment utiliser l'overlay"
            className={cn(
              "p-1.5 rounded-lg border transition-colors",
              isLightMode
                ? "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200"
                : "bg-[#181d23] border-[#2a3646] text-[#6e7784] hover:text-[#f2f0e9] hover:bg-[#1f2733]"
            )}
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>

          {/* Signaler un bug / retour (variante large : bouton direct) */}
          <button
            type="button"
            onClick={openFeedback}
            aria-label="Signaler un bug ou faire un retour"
            title="Signaler un bug, proposer une amélioration ou un ajout"
            className={cn(
              "p-1.5 rounded-lg border transition-colors",
              isLightMode
                ? "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200"
                : "bg-[#181d23] border-[#2a3646] text-[#6e7784] hover:text-[#f2f0e9] hover:bg-[#1f2733]"
            )}
          >
            <Bug className="w-3.5 h-3.5" />
          </button>

          {/* Dashboard / Guide web */}
          <a
            href={isGuest ? `/guides/${guideSlug}` : `/dashboard/${guildId}/quetes-dofus/guide/${guideSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Ouvrir le guide complet"
            title="Ouvrir le guide complet"
            className={cn(
              "p-1.5 rounded-lg border transition-colors",
              isLightMode
                ? "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200"
                : "bg-[#181d23] border-[#2a3646] text-[#6e7784] hover:text-[#f2f0e9] hover:bg-[#1f2733]"
            )}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          {/* Réinitialiser le guide (confirmation en 2 temps) */}
          {confirmReset ? (
            <span className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-[#e2726f]/50 bg-[#e2726f]/10 text-[#e2726f]">
              <span className="text-[10px] font-bold">Reset ?</span>
              <button
                type="button"
                onClick={() => {
                  onResetGuide?.();
                  setConfirmReset(false);
                }}
                aria-label="Confirmer la réinitialisation du guide"
                className="p-0.5 rounded hover:bg-[#e2726f]/20 transition-colors"
              >
                <Check className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                aria-label="Annuler la réinitialisation"
                className="p-0.5 rounded hover:bg-[#e2726f]/20 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              aria-label="Réinitialiser le guide"
              title="Réinitialiser toute la progression du guide"
              className={cn(
                "p-1.5 rounded-lg border transition-colors",
                isLightMode
                  ? "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200"
                  : "bg-[#181d23] border-[#2a3646] text-[#6e7784] hover:text-[#e2726f] hover:bg-[#1f2733]"
              )}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
            </>
          )}

          {/* Œuf Dofus */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dofusImageUrl}
            alt="Dofus"
            className="w-9 h-9 object-contain drop-shadow-md transition-transform hover:scale-105"
          />

        </div>
      </div>

      {/* Barre de progression globale */}
      <div
        className={cn(
          "w-full h-1 rounded-full overflow-hidden",
          isLightMode ? "bg-slate-200" : "bg-[#1e2530]"
        )}
        role="progressbar"
        aria-valuenow={overallPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progression globale : ${overallPct}%`}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${overallPct}%`,
            background: "linear-gradient(90deg, #2b9f7d, #39bc95)",
          }}
        />
      </div>
    </header>
  );
}

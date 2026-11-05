"use client";

import React, { useState, useEffect } from "react";
import { Sun, Moon, ExternalLink, Eye, EyeOff, HelpCircle, RotateCcw, Crown, Users, Check, X, MoreVertical, Bug } from "lucide-react";
import { RushOverlayFeedbackPanel } from "./RushOverlayFeedbackPanel";
import { getClass } from "@/lib/dofus-assets";
import { cn } from "@/lib/utils";
import { RUSH_DOFUS_STAGE_COUNT, dofusStage } from "@/lib/rush-dofus-stage";
import { useDaTheme } from "@/components/da/da-theme";

import { useOverlayToast } from "@/components/rush/overlay-toast";

interface RushOverlayHeaderProps {
  guideName: string;
  guideSlug: string;
  guildId?: string;
  dofusImageUrl: string;
  totalSteps: number;
  completedSteps: number;
  overallPct: number;
  onToggleTheme: () => void;
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
  /**
   * Palier de densité calculé par l'hôte (`ResizeObserver` de la racine) :
   * `wide` ≥ 820 px de haut (hero 276 px + pips), `tight` = fenêtre de jeu.
   */
  density?: "wide" | "normal" | "tight";
  /** Mode invité sans guilde ni compte */
  isGuest?: boolean;
  /**
   * Quête Ocre : résumé affiché en pastille sur le bouton (membre dont le compte
   * Metamob est lié, overlay INTERNE uniquement). `null`/absent ⇒ aucun bouton.
   */
  ocre?: { missing: number; percent: number } | null;
  /** Ouvre le panneau Quête Ocre. Sans ce callback, le bouton n'est jamais rendu. */
  onOpenOcre?: () => void;
  /** Ouvre la modale d'alignement de la guilde (overlay interne uniquement). */
  onOpenAlignment?: () => void;
  /**
   * Bloc actif de la DA « Gouache Wakfu » : donne l'image d'ambiance de l'en-tête
   * et la teinte de l'accent (`data-block`). Absent ⇒ Émeraude.
   */
  block?: "emeraude" | "cauchemar" | "ocre" | "custom";
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
  onToggleTheme,
  hideCompleted,
  onToggleHideCompleted,
  onOpenTutorial,
  bugContext,
  character,
  onResetGuide,
  className,
  isNarrow: isNarrowProp,
  density,
  isGuest = false,
  ocre,
  onOpenOcre,
  onOpenAlignment,
  block = "emeraude",
}: RushOverlayHeaderProps) {
  // Thème de la DA : une seule source (`data-theme` de la racine, exposé par le
  // contexte) — plus aucune prop de thème à faire descendre.
  const da = useDaTheme();
  const light = da?.theme === "light";
  // Toaster de l'overlay quand il y en a un (PiP), global sinon.
  const toast = useOverlayToast();
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
  // Palier de densité : `wide` dès 820 px de haut (hero 276 px), `tight` en PiP.
  const level = density ?? (narrow ? "tight" : "normal");
  const compact = level === "tight";
  const roomy = level !== "tight";
  // Frise de stade du Dofus (même règle pure que partout : cinq paliers).
  const stage = dofusStage(overallPct);

  /* ── DA « Gouache Wakfu » : titre et surtitre ────────────────────────────
     « Rush Sylvestre » se scinde comme dans la maquette : le premier mot en
     surtitre espacé, le reste en grand condensé. Aucun libellé n'est réécrit :
     on ne fait que répartir les mots déjà fournis par la donnée. */
  const titleWords = guideName.trim().split(/\s+/).filter(Boolean);
  const titleLead = titleWords.length > 1 ? titleWords[0] : "Rush";
  const titleRest = titleWords.length > 1 ? titleWords.slice(1).join(" ") : guideName;
  const blockLabel =
    block === "emeraude"
      ? "Dofus Émeraude"
      : block === "cauchemar"
      ? "Dofus Cauchemar"
      : block === "ocre"
      ? "Dofus Ocre"
      : "Bloc";

  // Retour / bug : le bouton vit dans le menu « ⋯ » (place libérée pour l'archimonstre),
  // et reste un bouton direct quand l'overlay est large.
  const openFeedback = () => {
    if (isGuest) {
      toast.info("Une remarque ou un bug ? Rejoignez notre Discord !", { duration: 2500 });
      return;
    }
    setFeedbackOpen(true);
  };

  // Style commun des entrées du menu « plus » (dropdown) — DA « Grimoire ».
  const menuItemCls = cn(
    "flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-surface hover:text-foreground motion-reduce:transition-none"
  );

  // Une seule anatomie de bouton d'action, dans les deux thèmes.
  const actionBtn =
    "p-1.5 rounded-[4px] border border-border bg-elevated text-muted-foreground transition-colors hover:border-border-strong hover:bg-surface hover:text-foreground motion-reduce:transition-none";
  const actionBtnGold =
    "p-1.5 rounded-[4px] border border-border bg-elevated text-gold transition-colors hover:border-border-strong hover:bg-surface motion-reduce:transition-none";

  return (
    <header
      className={cn(
        // DA « Gouache Wakfu » : en-tête illustré — image du bloc actif, voile de
        // lisibilité, surtitre, titre condensé. La structure et les 12 actions
        // restent EXACTEMENT où elles étaient (habillage seul).
        "da-hero shrink-0",
        compact ? "px-3 pt-2 pb-2" : "px-4 pt-3 pb-2.5",
        className
      )}
      data-density={level}
    >
      <div className="da-hero-img" data-block={block ?? "emeraude"} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        {/* Gauche : branding + titre + compteur */}
        <div className="flex-1 min-w-0">
          {/* Surtitre de la DA (masqué en overlay réduit pour gagner de la hauteur) */}
          {roomy && (
            <span className="da-kicker">
              Guide de progression <b>· {blockLabel}</b>
            </span>
          )}

          {/* Titre : premier mot en surtitre espacé, le reste en grand condensé. */}
          <h1 className="da-logo">
            <span className="da-logo-a">{titleLead}</span>
            <span className="da-logo-b">{titleRest}</span>
          </h1>

          {/* Progression explicite */}
          <p className="da-meta mt-1">
            <span>
              <strong>{completedSteps}</strong> / {totalSteps} étapes
            </span>
            <span>{overallPct} %</span>
          </p>
          <div
            className="da-track"
            role="progressbar"
            aria-valuenow={overallPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progression du guide"
          >
            <i style={{ width: `${Math.max(overallPct, 2)}%` }} />
          </div>

          {/* Frise des stades du Dofus (maquette) : cinq losanges + le stade atteint.
              Palier `wide` UNIQUEMENT — en `normal` elle coûtait 22 px de hauteur
              utile pour une information que la jauge porte déjà. */}
          {level === "wide" && (
            <span className="da-stage">
              <span className="da-pips" aria-hidden="true">
                {Array.from({ length: RUSH_DOFUS_STAGE_COUNT }, (_, index) => (
                  <i key={index} data-on={index <= stage.index ? "true" : "false"} />
                ))}
              </span>
              <span>{stage.label}</span>
            </span>
          )}

          {/* Personnage courant (masqué en overlay réduit) */}
          {character && roomy && (
            <div className="flex items-center gap-1.5 mt-1">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border border-border bg-elevated">
                {character.classe ? (
                  (() => {
                    const d = getClass(character.classe);
                    return d ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.icon} alt={d.name} className="w-3.5 h-3.5 object-contain" />
                    ) : (
                      <Users className="w-3 h-3 text-muted-foreground" />
                    );
                  })()
                ) : character.isMain ? (
                  <Crown className="w-3 h-3 text-gold" />
                ) : (
                  <Users className="w-3 h-3 text-muted-foreground" />
                )}
              </span>
              <span className="truncate text-[10px] font-semibold text-foreground/90">
                {character.pseudo}
              </span>
              <span className={cn("font-mono text-[9px] font-semibold uppercase", isGuest ? "text-success" : character.isMain ? "text-gold" : "text-muted-foreground")}>
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
            aria-label={light ? "Passer en mode sombre" : "Passer en mode clair"}
            title={light ? "Mode Sombre" : "Mode Clair"}
            className={actionBtnGold}
          >
            {light ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
          </button>

          {/* Alignement de la guilde (camps + Ordres) — overlay interne uniquement */}
          {onOpenAlignment && (
            <button
              type="button"
              onClick={onOpenAlignment}
              aria-label="Alignement de la guilde"
              title="Qui est bontarien ou brâkmarien, par Ordre"
              className={actionBtn}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ordres/neutre.png" alt="" className="w-3.5 h-3.5 object-contain" />
            </button>
          )}

          {/* Quête Ocre (Metamob) — overlay interne uniquement : pastille du reste à capturer */}
          {onOpenOcre && (
            <button
              type="button"
              onClick={onOpenOcre}
              aria-label={ocre ? `Quête Ocre : ${ocre.missing} cibles restantes` : "Ouvrir la Quête Ocre (compte Metamob non lié)"}
              title={ocre ? `Quête Ocre · ${ocre.missing} archis / gardiens restants · ${ocre.percent}%` : "Quête Ocre — lier mon compte Metamob"}
              className={cn(actionBtnGold, "relative")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/dofus/icons/archimonster.png"
                alt=""
                className="w-3.5 h-3.5 object-contain"
              />
              {ocre && (ocre.missing > 0 ? (
                <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 rounded-full bg-danger text-background text-[9px] font-semibold tabular-nums leading-[15px] text-center">
                  {ocre.missing > 99 ? "99+" : ocre.missing}
                </span>
              ) : (
                <span className="absolute -top-1 -right-1 w-[15px] h-[15px] rounded-full bg-success text-background grid place-items-center">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </span>
              ))}
            </button>
          )}

          {/* Masquer les quêtes terminées */}
          <button
            type="button"
            onClick={onToggleHideCompleted}
            aria-label={hideCompleted ? "Afficher les quêtes terminées" : "Masquer les quêtes terminées"}
            title={hideCompleted ? "Afficher les quêtes terminées" : "Masquer les quêtes terminées"}
            className={cn(actionBtn, hideCompleted && "border-success/40 bg-success/10 text-success")}
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
                className={actionBtn}
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
              {moreOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                  <div
                    className="absolute top-full right-0 mt-1 z-50 w-48 overflow-hidden rounded-[6px] border border-border-strong bg-elevated py-1"
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
                    <button type="button" onClick={() => { setMoreOpen(false); setConfirmReset(true); }} className={cn(menuItemCls, "hover:text-danger")}>
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
            className={actionBtn}
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>

          {/* Signaler un bug / retour (variante large : bouton direct) */}
          <button
            type="button"
            onClick={openFeedback}
            aria-label="Signaler un bug ou faire un retour"
            title="Signaler un bug, proposer une amélioration ou un ajout"
            className={actionBtn}
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
            className={actionBtn}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          {/* Réinitialiser le guide (confirmation en 2 temps) */}
          {confirmReset ? (
            <span className="inline-flex items-center gap-1 rounded-[4px] border border-danger/50 bg-danger/10 px-2 py-1.5 text-danger">
              <span className="text-[10px] font-bold">Reset ?</span>
              <button
                type="button"
                onClick={() => {
                  onResetGuide?.();
                  setConfirmReset(false);
                }}
                aria-label="Confirmer la réinitialisation du guide"
              className="p-0.5 rounded hover:bg-danger/20 transition-colors motion-reduce:transition-none"
              >
                <Check className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                aria-label="Annuler la réinitialisation"
                className="p-0.5 rounded hover:bg-danger/20 transition-colors motion-reduce:transition-none"
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
              className={cn(actionBtn, "hover:text-danger")}
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
            className="h-9 w-9 object-contain transition-transform duration-150 ease-out hover:scale-[1.03] motion-reduce:transition-none"
          />

        </div>
      </div>

      {/* Barre de progression globale — jauge d'or 2 px, losange en bout (DA « Grimoire »). */}
      <div
        className="relative h-[2px] w-full overflow-hidden rounded-full bg-elevated"
        role="progressbar"
        aria-valuenow={overallPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progression globale : ${overallPct}%`}
      >
        <div
          className="relative h-full rounded-full bg-gold transition-[width] duration-150 ease-out motion-reduce:transition-none"
          style={{ width: `${overallPct}%` }}
        >
          {overallPct > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-[3px] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rotate-45 bg-gold"
            />
          )}
        </div>
      </div>
    </header>
  );
}

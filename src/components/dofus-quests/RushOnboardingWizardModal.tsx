"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Shield,
  Sparkles,
  ExternalLink,
  Check,
  Hammer,
  Link2,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { ALIGNMENTS, getClass, ORDERS } from "@/lib/dofus-assets";
import { getMetierIconPath } from "@/lib/rush-guide-utils";
import { normalizeAlignmentCamp } from "@/lib/rush-route";
import { normalizeOrderCode } from "@/lib/rush-order-codes";
import { MemberAvatar } from "@/components/shared/member-avatar";

/**
 * Modale d'accueil du Rush — **DA « Carnet de campagne »** (L3, 02/11/2026).
 *
 * Quatre étapes, inchangées : personnage → préparation (Metamob, alignement, métiers) →
 * avancée des membres → lancement. Seule la **forme** change : les jetons
 * `.rush-carnet-theme` (forêt / ivoire / bronze / ambre) remplacent l'ancien
 * `zinc` + `emerald` + `rounded-3xl` + `font-black`, qui ne respectait pas la DA
 * (rayons ≤ 12 px, une seule teinte d'accent, pas de `font-black`).
 *
 * Aucun accès base ici : tout vient des props (le dashboard Rush les agrège déjà).
 */

type CharacterOption = {
  id: string; // "PRINCIPAL" | mule pseudo
  name: string;
  isMule?: boolean;
  dofusClass?: string | null;
  level?: number;
};

type ActiveMember = {
  profileId: string;
  userName: string;
  userAvatar?: string;
  dofusClass?: string;
  currentMilestoneTitle?: string;
  percent: number;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  guildId: string;
  characters: CharacterOption[];
  selectedCharacter: string;
  onSelectCharacter: (charId: string) => void;
  activeMembers: ActiveMember[];
  /** Étape d'ouverture : le dashboard reprend le parcours après un changement de personnage. */
  initialStep?: 1 | 2 | 3 | 4;
  onStepChange?: (step: 1 | 2 | 3 | 4) => void;
  /** Le personnage SÉLECTIONNÉ n'a pas de classe : les 19 quêtes de classe sont masquées. */
  hasNoClassDeclared?: boolean;
  /** Préparation — liaison Metamob déjà effectuée ? */
  metamobPseudo?: string | null;
  /** Préparation — ouvre le dialog de liaison Metamob existant. */
  onOpenMetamobLink?: () => void;
  currentAlignment?: string | null;
  currentAlignmentOrder?: string | null;
  /** Préparation — réinitialise l'alignement courant (action existante). */
  onResetAlignment?: () => void;
  /** Préparation — métiers requis agrégés sur le guide (id canonique). */
  metiersRequires?: { id: string; name: string; level: number }[];
  /** Préparation — ids de métiers déjà déclarés sur le profil (slugs). */
  metiersDeclares?: string[];
  /** Préparation — déclare un métier manquant sur le profil (updateUserProfile). */
  onDeclareMetier?: (name: string, level: number) => void;
  /** Options de la modale de lancement (éditées côté GOD). */
  launchConfig?: { showMetamob: boolean; showResetAlignment: boolean; showMetiers: boolean };
  /** Réinitialise la progression d'un AUTRE personnage (id = "PRINCIPAL" | pseudo mule). */
  onResetCharacter?: (id: string) => void;
  /** id du personnage en cours de reset (pour spinner/disable). */
  resettingId?: string | null;
};

/** Panneau du carnet : filet de bronze, matière élevée, jamais d'ombre portée. */
const PANEL = "rounded-[6px] border border-border bg-elevated";
/** Bouton d'action principal : l'ambre du carnet, jamais une seconde teinte. */
const PRIMARY =
  "inline-flex items-center justify-center gap-1.5 rounded-[6px] border border-accent/60 bg-accent/15 px-4 py-2 text-xs font-semibold text-accent transition-colors hover:bg-accent/25 focus-visible:outline-2 focus-visible:outline-accent/60 disabled:opacity-50";
/** Bouton discret (précédent). */
const GHOST =
  "inline-flex items-center justify-center gap-1.5 rounded-[6px] border border-border bg-surface px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent/60";
/** Bouton de ligne (lier, déclarer). */
const SMALL_PRIMARY =
  "inline-flex shrink-0 items-center justify-center gap-1 rounded-[4px] border border-accent/60 bg-accent/15 px-2.5 py-1 text-[10px] font-semibold text-accent transition-colors hover:bg-accent/25 focus-visible:outline-2 focus-visible:outline-accent/60";
/** Bouton de ligne destructif (réinitialiser). */
const SMALL_DANGER =
  "inline-flex shrink-0 items-center justify-center rounded-[4px] border border-danger/40 px-2 py-1 text-[10px] font-semibold text-danger transition-colors hover:bg-danger/10 focus-visible:outline-2 focus-visible:outline-danger/50 disabled:opacity-50";

export function RushOnboardingWizardModal({
  isOpen,
  onClose,
  guildId,
  characters,
  selectedCharacter,
  onSelectCharacter,
  activeMembers,
  initialStep = 1,
  onStepChange,
  hasNoClassDeclared = false,
  metamobPseudo = null,
  onOpenMetamobLink,
  currentAlignment = null,
  currentAlignmentOrder = null,
  onResetAlignment,
  metiersRequires = [],
  metiersDeclares = [],
  onDeclareMetier,
  launchConfig = { showMetamob: true, showResetAlignment: true, showMetiers: true },
  onResetCharacter,
  resettingId = null,
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(initialStep);
  // L'étape est remontée au dashboard : il la mémorise le temps d'un changement de
  // personnage (le guide est remonté par `key={character}`), sinon la modale se fermait.
  const go = (next: 1 | 2 | 3 | 4) => {
    setStep(next);
    onStepChange?.(next);
  };

  if (!isOpen) return null;

  const currentSelectedChar = characters.find((c) => c.id === selectedCharacter) || characters[0];
  const uniqueActiveMembers = Array.from(
    new Map(activeMembers.map((m) => [m.profileId || m.userName, m])).values()
  );

  // Libellés lisibles : le profil peut porter « Brâkmarien » (casse, accents) et l'Ordre
  // son id court (« vaillant »). Sans normalisation, la modale afficherait des ids bruts.
  const campKey = normalizeAlignmentCamp(currentAlignment);
  const campLabel = currentAlignment
    ? ALIGNMENTS.find((a) => a.id === campKey)?.name ?? currentAlignment
    : null;
  const orderKey = normalizeOrderCode(currentAlignmentOrder);
  const orderLabel =
    campKey && orderKey
      ? ((
          (ORDERS as unknown as Record<string, Array<Record<string, unknown>>>)[campKey] ?? []
        ).find((o) => normalizeOrderCode(String(o.id)) === orderKey)?.name ?? null)
      : null;

  const stepTitle =
    step === 1
      ? "Votre personnage"
      : step === 2
        ? "Préparation"
        : step === 3
          ? "Les membres"
          : "Prêt à partir";
  const stepHint =
    step === 1
      ? "Choisissez le personnage qui portera cette progression (principal ou mule)."
      : step === 2
        ? "Metamob, alignement et métiers : ce qui se règle avant de rusher."
        : step === 3
          ? "Où en sont vos coéquipiers sur ce guide."
          : "Tout est en place, la timeline peut s'ouvrir.";

  // Portail vers `document.body` : aucun ancêtre (transform, `overflow-hidden`) ne peut
  // rogner la modale — mesuré le 02/11/2026 : dans une fenêtre basse, le pied sortait de
  // la zone visible et « Suivant » devenait inatteignable. La hauteur est en plus FIXE
  // (`92dvh` plafonnée à 42 rem) : l'en-tête et le pied sont `shrink-0`, seul le corps
  // défile — le bouton d'action est donc toujours visible.
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 8 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="rush-onboarding-title"
          className="rush-carnet-theme rush-carnet rush-carnet-frame relative flex h-[92vh] h-[92dvh] max-h-[42rem] w-full max-w-xl flex-col overflow-hidden rounded-[10px] bg-surface text-foreground"
        >
          {/* ══ EN-TÊTE — serif, filet d'or, quatre repères d'étape ══ */}
          <header className="relative shrink-0 border-b border-border-strong px-5 pb-4 pt-5">
            <div
              aria-hidden
              className="absolute inset-x-5 top-0 h-px bg-accent/40"
            />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
                  Carnet de campagne · {step}/4
                </p>
                <h2 id="rush-onboarding-title" className="mt-1 font-serif text-lg font-semibold leading-tight">
                  {stepTitle}
                </h2>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{stepHint}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 pt-1" aria-hidden>
                {[1, 2, 3, 4].map((s) => (
                  <span
                    key={s}
                    className={
                      s === step
                        ? "h-1.5 w-5 rounded-full bg-accent"
                        : s < step
                          ? "h-1.5 w-1.5 rounded-full bg-accent/50"
                          : "h-1.5 w-1.5 rounded-full bg-border"
                    }
                  />
                ))}
              </div>
            </div>
          </header>

          {/* ══ CORPS ══ */}
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">


            {/* ── ÉTAPE 1 : le personnage ───────────────────────────────────── */}
            {step === 1 && (
              <div className="space-y-3">
                {hasNoClassDeclared && (
                  <div className="flex items-start justify-between gap-2 rounded-[6px] border border-warning/40 bg-warning/10 px-3 py-2.5">
                    <p className="text-[11px] leading-relaxed text-warning">
                      Aucune classe déclarée pour{" "}
                      <span className="font-semibold">{currentSelectedChar?.name}</span> : les 19 quêtes de
                      classe restent masquées.
                    </p>
                    <Link
                      href={`/dashboard/${guildId}/profile`}
                      className="inline-flex shrink-0 items-center gap-1 rounded-[4px] border border-warning/50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-warning transition-colors hover:bg-warning/15"
                    >
                      Profil <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {characters.map((char) => {
                    const isSelected = char.id === selectedCharacter;
                    const classDef = char.dofusClass ? getClass(char.dofusClass) : null;
                    return (
                      <button
                        key={char.id}
                        type="button"
                        onClick={() => onSelectCharacter(char.id)}
                        aria-pressed={isSelected}
                        className={`flex items-center gap-2.5 rounded-[6px] border px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-accent/60 ${
                          isSelected
                            ? "border-accent/60 bg-accent/10"
                            : "border-border bg-surface hover:border-border-strong"
                        }`}
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[4px] border ${
                            isSelected ? "border-accent/40 bg-accent/10" : "border-border bg-muted"
                          }`}
                        >
                          {classDef ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={classDef.icon} alt={classDef.name} className="h-full w-full object-contain p-1" />
                          ) : char.dofusClass ? (
                            <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                              {char.dofusClass.substring(0, 3)}
                            </span>
                          ) : (
                            <User className="h-4 w-4 text-muted-foreground" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-foreground">{char.name}</span>
                          <span className="block truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                            {char.isMule ? "Mule" : "Personnage principal"}
                            {classDef && (
                              <span className="ml-1 normal-case tracking-normal">({classDef.name})</span>
                            )}
                          </span>
                        </span>
                        {isSelected && <CheckCircle className="h-4 w-4 shrink-0 text-accent" />}
                      </button>
                    );
                  })}
                </div>

                {characters.length > 1 && onResetCharacter && (
                  <div className={`${PANEL} px-3 py-2.5`}>
                    <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <RotateCcw className="h-3 w-3" /> Réinitialiser un autre personnage
                    </p>
                    <ul className="space-y-1.5">
                      {characters
                        .filter((c) => c.id !== selectedCharacter)
                        .map((c) => (
                          <li key={c.id} className="flex items-center justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-foreground">
                              <User className="h-3 w-3 shrink-0 text-muted-foreground" />
                              <span className="truncate">{c.name}</span>
                              {c.isMule && (
                                <span className="shrink-0 text-[9px] uppercase text-muted-foreground">Mule</span>
                              )}
                            </span>
                            <button
                              type="button"
                              onClick={() => onResetCharacter?.(c.id)}
                              disabled={resettingId === c.id}
                              className={SMALL_DANGER}
                            >
                              {resettingId === c.id ? "…" : "Réinitialiser"}
                            </button>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            )}


            {/* ── ÉTAPE 2 : la préparation ──────────────────────────────────── */}
            {step === 2 && (
              <div className="space-y-2.5">
                {launchConfig.showMetamob && (
                  <div className={`${PANEL} flex items-center justify-between gap-3 px-3 py-2.5`}>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Link2 className="h-4 w-4 shrink-0 text-accent" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground">Liaison Metamob</p>
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          {metamobPseudo
                            ? `Compte lié : ${metamobPseudo}`
                            : "Non lié — optionnel, mais nécessaire pour suivre l'Ocre."}
                        </p>
                      </div>
                    </div>
                    {metamobPseudo ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-[4px] border border-success/40 bg-success/10 px-2 py-1 text-[10px] font-semibold text-success">
                        <Check className="h-3 w-3" /> Lié
                      </span>
                    ) : (
                      <button type="button" onClick={onOpenMetamobLink} className={SMALL_PRIMARY}>
                        Lier
                      </button>
                    )}
                  </div>
                )}

                {launchConfig.showResetAlignment && (
                  <div className={`${PANEL} flex items-center justify-between gap-3 px-3 py-2.5`}>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <RotateCcw className="h-4 w-4 shrink-0 text-accent" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground">Réinitialiser l&apos;alignement</p>
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          {campLabel
                            ? `${campLabel}${orderLabel ? ` · ${orderLabel}` : ""}`
                            : "Aucun alignement défini."}
                        </p>
                      </div>
                    </div>
                    <button type="button" onClick={onResetAlignment} className={SMALL_DANGER}>
                      Réinitialiser
                    </button>
                  </div>
                )}

                {launchConfig.showMetiers && (
                  <div className={`${PANEL} px-3 py-2.5`}>
                    <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <Hammer className="h-3 w-3" /> Métiers requis
                    </p>
                    {metiersRequires.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">Aucun métier requis détecté sur ce guide.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {metiersRequires.map((m) => {
                          const declared = metiersDeclares.includes(m.id);
                          return (
                            <li
                              key={m.id}
                              className="flex items-center justify-between gap-2 rounded-[4px] border border-border bg-surface px-2 py-1.5"
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={getMetierIconPath(m.name)}
                                  alt=""
                                  className="h-6 w-6 shrink-0 rounded-[3px] object-contain"
                                />
                                <span className="min-w-0">
                                  <span className="block truncate text-[11px] font-semibold text-foreground">
                                    {m.name} <span className="font-mono text-muted-foreground">Niv. {m.level}</span>
                                  </span>
                                  <span className="block text-[10px] text-muted-foreground">
                                    {declared ? "Déclaré sur votre profil" : "Non déclaré"}
                                  </span>
                                </span>
                              </span>
                              {declared ? (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-label="Déclaré" />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onDeclareMetier?.(m.name, m.level)}
                                  className={SMALL_PRIMARY}
                                >
                                  Déclarer
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}


            {/* ── ÉTAPE 3 : les membres ─────────────────────────────────────── */}
            {step === 3 && (
              <div className="space-y-3">
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {uniqueActiveMembers.length > 0
                    ? `${uniqueActiveMembers.length} membre${uniqueActiveMembers.length > 1 ? "s" : ""} de guilde ${
                        uniqueActiveMembers.length > 1 ? "sont" : "est"
                      } sur ce Rush :`
                    : "Vous êtes le premier de la guilde à vous lancer sur ce Rush."}
                </p>

                {uniqueActiveMembers.length > 0 ? (
                  <ul className="max-h-60 space-y-1.5 overflow-y-auto pr-1">
                    {uniqueActiveMembers.map((m) => (
                      <li
                        key={m.profileId || m.userName}
                        className={`${PANEL} flex items-center justify-between gap-3 px-3 py-2`}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
                            <MemberAvatar
                              src={m.userAvatar}
                              name={m.userName}
                              alt={m.userName}
                              fallbackClassName="text-[10px] font-semibold text-muted-foreground"
                            />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-semibold text-foreground">{m.userName}</span>
                            <span className="block truncate text-[10px] text-muted-foreground">
                              {m.currentMilestoneTitle ? `Étape : ${m.currentMilestoneTitle}` : "En cours"}
                            </span>
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="text-xs font-semibold text-accent">{m.percent}%</span>
                          <span className="mt-1 block h-1 w-16 overflow-hidden rounded-full bg-muted">
                            <span className="block h-full rounded-full bg-accent" style={{ width: `${m.percent}%` }} />
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-[6px] border border-dashed border-border px-4 py-6 text-center">
                    <Sparkles className="mx-auto mb-2 h-7 w-7 text-accent/70" />
                    <p className="text-xs font-semibold text-foreground">Soyez le pionnier du Rush</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      Votre progression apparaîtra ici pour guider les membres de la guilde.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── ÉTAPE 4 : le départ ───────────────────────────────────────── */}
            {step === 4 && (
              <div className="space-y-4 py-2 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-accent">
                  <CheckCircle className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-semibold text-foreground">Tout est en place</h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    La timeline s&apos;ouvrira pour{" "}
                    <span className="font-semibold text-accent">{currentSelectedChar?.name}</span>.
                  </p>
                </div>
                <div className={`${PANEL} px-3 py-2.5 text-left`}>
                  <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Shield className="h-3 w-3" /> À retenir
                  </p>
                  <ul className="space-y-1 text-[11px] leading-relaxed text-muted-foreground">
                    <li>· Cochez vos quêtes une par une : la guilde voit votre avancée.</li>
                    <li>· Un donjon requis non validé verrouille sa quête — le panneau donjon le montre.</li>
                    <li>· Changer de cité ou d&apos;Ordre décoche la branche concernée (le tronc commun reste).</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* ══ PIED — un seul bouton d'action à la fois ══ */}
          <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-border-strong bg-surface/60 px-5 py-3">
            {step > 1 ? (
              <button type="button" onClick={() => go((step - 1) as 1 | 2 | 3 | 4)} className={GHOST}>
                <ArrowLeft className="h-3.5 w-3.5" /> Précédent
              </button>
            ) : (
              <span />
            )}

            {step < 4 ? (
              <button type="button" onClick={() => go((step + 1) as 1 | 2 | 3 | 4)} className={PRIMARY}>
                Suivant <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button type="button" onClick={onClose} className={PRIMARY}>
                Lancer mon Rush <Sparkles className="h-3.5 w-3.5" />
              </button>
            )}
          </footer>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}


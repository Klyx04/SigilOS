"use client";

import React, { useEffect } from "react";
import { X, HelpCircle, MousePointerClick, MousePointer2, Flag, Users, Package, ChevronsRight, Info, Handshake } from "lucide-react";

interface RushOverlayTutorialModalProps {
  /** Conservé pour les appelants : l'apparence suit les jetons de thème. */
  isLightMode: boolean;
  onClose: () => void;
}

const items = [
  { icon: MousePointerClick, c: "text-warning", title: "Cocher une quête", text: "Clique sur le cercle à gauche pour la valider. Le chapitre se valide tout seul quand tu as tout coché (et on passe au suivant)." },
  { icon: MousePointer2, c: "text-accent", title: "Ouvrir la page de la quête", text: "Clique sur le TEXTE du titre → ouvre DofusPourLesNoobs (sinon DofusDB) dans un onglet." },
  { icon: Flag, c: "text-warning", title: "« Je suis ici »", text: "Le drapeau pose un repère pour dire aux membres où tu en es. Leur avatar Discord apparaît et disparaît une fois la quête validée." },
  { icon: Handshake, c: "text-accent", title: "Qui peut t'aider", text: "La poignée de main signale les membres de la guilde capables de t'aider sur cette quête (métiers/donjons requis). Survole pour la liste ; c'est un simple indicateur, pas une obligation." },
  { icon: Info, c: "text-accent", title: "Détails d'une quête", text: "Le bouton « i » ouvre la modale : position de lancement, donjons, ressources, métiers et conseils, tout trié." },
  { icon: Users, c: "text-accent", title: "Sur ce chapitre", text: "Les avatars montrent qui est sur ce chapitre. Clique dessus pour la liste complète." },
  { icon: Package, c: "text-warning", title: "Ressources globales", text: "Le bouton Ressources du haut liste TOUTES les ressources du guide, dédupliquées, avec quantité et fiche DofusDB." },
  { icon: ChevronsRight, c: "text-muted-foreground", title: "Navigation", text: "Le sélecteur de chapitre en haut + les flèches Précédent / Suivant en bas pour circuler." },
];

export function RushOverlayTutorialModal({ onClose }: RushOverlayTutorialModalProps) {
  // Échap ferme la modale : même comportement que les autres modales du rush.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-3">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 bg-black/70"
      />
      <div className="relative z-10 flex max-h-[82vh] w-full max-w-[26rem] flex-col overflow-hidden rounded-[6px] border border-border-strong bg-elevated">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-warning" aria-hidden="true" />
            <h2 className="text-[13px] font-semibold text-foreground">Comment utiliser l'overlay</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-[4px] p-1.5 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {items.map((it, i) => (
            <div key={i} className="flex items-start gap-2.5 rounded-[4px] border border-border bg-surface px-3 py-2">
              <it.icon className={`mt-0.5 h-4 w-4 shrink-0 ${it.c}`} aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-foreground">{it.title}</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">{it.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

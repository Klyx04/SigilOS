"use client";

import React from "react";
import { X, HelpCircle, MousePointerClick, MousePointer2, Flag, Users, Package, ChevronsRight, Info, Handshake } from "lucide-react";
import { cn } from "@/lib/utils";

interface RushOverlayTutorialModalProps {
  isLightMode: boolean;
  onClose: () => void;
}

const items = [
  { icon: MousePointerClick, c: "text-[#d5a94e]", title: "Cocher une quête", text: "Clique sur le cercle à gauche pour la valider. Le chapitre se valide tout seul quand tu as tout coché (et on passe au suivant)." },
  { icon: MousePointer2, c: "text-[#39bc95]", title: "Ouvrir la page de la quête", text: "Clique sur le TEXTE du titre → ouvre DofusPourLesNoobs (sinon DofusDB) dans un onglet." },
  { icon: Flag, c: "text-[#d5a94e]", title: "« Je suis ici »", text: "Le drapeau pose un repère pour dire aux membres où tu en es. Leur avatar Discord apparaît et disparaît une fois la quête validée." },
  { icon: Handshake, c: "text-[#39bc95]", title: "Qui peut t'aider", text: "La poignée de main 🤝 = membres de la guilde capables de t'aider sur cette quête (métiers/donjons requis). Survole pour la liste ; c'est un simple indicateur, pas une obligation." },
  { icon: Info, c: "text-[#39bc95]", title: "Détails d'une quête", text: "Le bouton ⓘ ouvre une modale : position de lancement, donjons, ressources, métiers et conseils, tout trié." },
  { icon: Users, c: "text-[#39bc95]", title: "Sur ce chapitre", text: "Les avatars montrent qui est sur ce chapitre. Clique dessus pour la liste complète." },
  { icon: Package, c: "text-[#d5a94e]", title: "Ressources globales", text: "Le bouton 📦 du haut liste TOUTES les ressources du guide, dédupliquées, avec quantité et fiche DofusDB." },
  { icon: ChevronsRight, c: "text-[#8b95a0]", title: "Navigation", text: "Le sélecteur de chapitre en haut + les flèches Précédent / Suivant en bas pour circuler." },
];

export function RushOverlayTutorialModal({ isLightMode, onClose }: RushOverlayTutorialModalProps) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-3">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className={cn("absolute inset-0 bg-black/70 backdrop-blur-sm", isLightMode && "bg-slate-900/40")}
      />
      <div
        className={cn(
          "relative z-10 flex flex-col w-full max-w-[420px] max-h-[82vh] rounded-2xl border overflow-hidden shadow-2xl",
          isLightMode ? "bg-white border-slate-200" : "bg-[#111419] border-[#2a3646]"
        )}
      >
        <div className={cn("flex items-center justify-between gap-2 px-4 py-3 border-b shrink-0", isLightMode ? "border-slate-200" : "border-[#28303a]/70")}>
          <div className="flex items-center gap-2">
            <HelpCircle className={cn("w-4 h-4", isLightMode ? "text-[#d5a94e]" : "text-[#d5a94e]")} />
            <h2 className={cn("text-sm font-bold font-serif", isLightMode ? "text-slate-900" : "text-[#f2f0e9]")}>Comment utiliser l'overlay</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className={cn("p-1.5 rounded-lg transition-colors", isLightMode ? "text-slate-400 hover:text-red-500 hover:bg-red-50" : "text-[#6e7784] hover:text-red-400 hover:bg-[#1c2129]")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {items.map((it, i) => (
            <div key={i} className={cn("flex items-start gap-2.5 rounded-xl border px-3 py-2", isLightMode ? "bg-slate-50 border-slate-200" : "bg-[#0d1117] border-[#1e2530]")}>
              <it.icon className={cn("w-4 h-4 mt-0.5 shrink-0", it.c)} />
              <div className="min-w-0">
                <p className={cn("text-[11px] font-bold", isLightMode ? "text-slate-800" : "text-[#f2f0e9]")}>{it.title}</p>
                <p className={cn("text-[10px] leading-relaxed", isLightMode ? "text-slate-500" : "text-[#8b95a0]")}>{it.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

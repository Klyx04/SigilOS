"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { AccessRequestModal } from "./AccessRequestModal";
import { loginWithDiscord } from "@/server/actions/auth-actions";
const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 127.14 96.36" fill="currentColor" aria-hidden="true">
    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c2.91-27.55-13.48-51.67-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
  </svg>
);

interface DofusHeroSectionProps {
  /** Client ID Discord (serveur) pour construire l'URL d'installation du bot. */
  clientId?: string;
  /** Kill-switch God : OFF = pas de promesse d'autonomie. */
  autoOnboardingOn?: boolean;
  /** Vrai quand le visiteur est déjà connecté (label du secondaire adapté). */
  isConnected?: boolean;
}

/** Accès direct aux outils gratuits, avec les icônes officielles du jeu. */
const FREE_TOOLS = [
  { href: "/guides/rush-sylvestre", icon: "/assets/dofus/icons/quests.png", label: "Guide Rush Sylvestre" },
  { href: "/boss", icon: "/assets/dofus/icons/archimonster.png", label: "Fiches Boss & Donjons" },
  { href: "/almanax", icon: "/assets/dofus/icons/almanax.png", label: "Almanax du jour" },
];

export function DofusHeroSection({ clientId = "", autoOnboardingOn = true, isConnected = false }: DofusHeroSectionProps) {
  const [showAccessModal, setShowAccessModal] = useState(false);

  return (
    <section
      className="relative w-full overflow-hidden bg-[#08090d] text-white select-none dark"
      style={{ minHeight: "100svh" }}
    >
      {/* ── CONTENU ── */}
      <div
        className="relative z-20 flex flex-col items-center justify-center text-center max-w-5xl mx-auto"
        style={{ padding: "120px 20px 40px" }}
      >
        <p className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium text-zinc-200 mb-8 border border-white/15 bg-black/40">
          <span className="w-2 h-2 rounded-full bg-emerald-400" aria-hidden="true" />
          <span>Compagnon de guilde Dofus Unity · 100% gratuit</span>
        </p>

        <h1
          className="font-black tracking-tight leading-[1.08] mb-6 font-heading"
          style={{
            fontSize: "clamp(2.4rem, 5.5vw, 4.8rem)",
            color: "#ffffff",
          }}
        >
          Ta guilde Dofus, <span style={{ color: "#f0c040" }}>réunie</span> au même endroit.
        </h1>

        <p
          className="mb-10 max-w-2xl leading-relaxed text-zinc-200 font-normal"
          style={{
            fontSize: "clamp(1rem, 1.6vw, 1.15rem)",
          }}
        >
          Sorties donjons, quêtes, archimonstres Metamob et fiches de boss,
          synchronisés avec ton Discord. Gratuit, sans mot de passe Ankama.
        </p>

        {/* 2 actions, rien d'autre. L'overlay est déjà dans « Outils en libre accès ». */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-12 w-full justify-center">
          {autoOnboardingOn && clientId ? (
            <>
              <button
                type="button"
                onClick={() => setShowAccessModal(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl font-bold text-sm bg-[#5865F2] hover:bg-[#4752c4] text-white cursor-pointer"
              >
                <DiscordIcon className="w-4 h-4" />
                <span>Configurer SigilOS pour mon serveur Discord</span>
              </button>

              <Link
                href="/dashboard"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
              >
                <span>{isConnected ? "Voir le tableau de bord" : "Connexion Dashboard"}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </>
          ) : (
            <button
              type="button"
              onClick={() => loginWithDiscord()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
            >
              <DiscordIcon className="w-4 h-4" />
              <span>Connecter mon Discord</span>
            </button>
          )}
        </div>

        {/* Outils en libre accès : icônes du jeu, pas d'emojis */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2 mb-12">
          <span className="text-xs text-zinc-300 mr-1">Outils en libre accès :</span>
          {FREE_TOOLS.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-zinc-100 transition-colors"
            >
              <Image src={tool.icon} alt="" width={20} height={20} className="w-5 h-5 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]" />
              <span>{tool.label}</span>
            </Link>
          ))}
        </div>

        {/* Fenêtre sur le temple de guilde : affiché à taille native, donc net */}
        <div className="w-full max-w-5xl rounded-2xl overflow-hidden border border-white/10">
          <Image
            src="/assets/dofus/vista/hall-creation.webp"
            alt="Temple de guilde Dofus : création de la guilde, le lieu de ralliement"
            width={2048}
            height={1046}
            priority
            sizes="(max-width: 1024px) 100vw, 1024px"
            className="w-full h-auto block"
          />
        </div>
      </div>

      {/* Fondu de sortie vers la suite */}
      <div
        className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
        aria-hidden="true"
        style={{ background: "linear-gradient(to bottom, transparent 0%, #09090b 100%)" }}
      />

      {/* Choix : ajout direct du bot OU accompagnement via ticket Discord */}
      <AccessRequestModal
        open={showAccessModal}
        onClose={() => setShowAccessModal(false)}
        autoOnboardingOn={autoOnboardingOn}
        clientId={clientId}
      />
    </section>
  );
}

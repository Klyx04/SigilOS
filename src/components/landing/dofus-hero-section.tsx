"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ChevronRight, Sparkles, ArrowRight, Shield, Zap, Compass, Swords } from "lucide-react";
import { AccessRequestModal } from "./AccessRequestModal";
import { loginWithDiscord } from "@/server/actions/auth-actions";
import type { User } from "next-auth";

const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 127.14 96.36" fill="currentColor">
    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c2.91-27.55-13.48-51.67-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
  </svg>
);

interface DofusHeroSectionProps {
  user?: User;
  userGuilds?: { id: string; name: string; iconUrl: string | null }[];
}

export function DofusHeroSection({ user, userGuilds = [] }: DofusHeroSectionProps) {
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const dofusPrimordiaux = [
    { name: "Émeraude", src: "/module-dofus/Dofus_Emeraude.png", color: "#10b981", delay: "0s", pos: "top-24 left-[8%] md:left-[14%]" },
    { name: "Pourpre", src: "/module-dofus/Dofus_Pourpre.png", color: "#ef4444", delay: "1.2s", pos: "top-32 right-[8%] md:right-[15%]" },
    { name: "Vulbis", src: "/module-dofus/Dofus_Vulbis.png", color: "#f97316", delay: "2.4s", pos: "bottom-36 left-[10%] md:left-[18%]" },
    { name: "Ocre", src: "/module-dofus/Dofus_Ocre.png", color: "#eab308", delay: "0.8s", pos: "bottom-32 right-[10%] md:right-[17%]" },
    { name: "Turquoise", src: "/module-dofus/Dofus_Turquoise.png", color: "#06b6d4", delay: "1.8s", pos: "top-1/2 left-[3%] hidden xl:block" },
    { name: "Ébène", src: "/module-dofus/Dofus_Ebene.png", color: "#8b5cf6", delay: "3s", pos: "top-1/2 right-[3%] hidden xl:block" },
  ];

  return (
    <section
      ref={heroRef}
      className="relative w-full overflow-hidden bg-[#08090d] text-white select-none dark"
      style={{ minHeight: "100svh" }}
    >
      {/* ── AMBIANCE COSMOS DARK FANTASY ── */}
      {/* Fond dégradé radial nuit d'Amakna */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 50% 20%, #131926 0%, #0c0f17 50%, #08090d 100%)",
        }}
      />

      {/* Halo or central doux derrière le titre */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[400px] rounded-full blur-[140px] pointer-events-none opacity-20"
        style={{ background: "#d5a94e" }}
      />

      {/* Halo émeraude subtil */}
      <div
        className="absolute top-1/3 left-1/4 -translate-y-1/2 w-[500px] h-[350px] rounded-full blur-[150px] pointer-events-none opacity-15"
        style={{ background: "#10b981" }}
      />

      {/* Texture d'étoiles scintillantes discrètes */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: "radial-gradient(1px 1px at 20px 30px, #ffffff, rgba(0,0,0,0)), radial-gradient(1px 1px at 100px 150px, #f0c040, rgba(0,0,0,0)), radial-gradient(1.5px 1.5px at 220px 80px, #10b981, rgba(0,0,0,0)), radial-gradient(1px 1px at 300px 240px, #ffffff, rgba(0,0,0,0))",
          backgroundSize: "350px 350px",
          transform: `translateY(${scrollY * 0.05}px)`,
        }}
      />

      {/* ── DOFUS PRIMORDIAUX EN LÉVITATION MYSTIQUE ── */}
      {dofusPrimordiaux.map((egg) => (
        <div
          key={egg.name}
          className={`absolute pointer-events-none z-10 transition-transform ${egg.pos}`}
          style={{
            transform: `translateY(${scrollY * 0.12}px)`,
          }}
        >
          <div
            className="relative animate-float"
            style={{
              animationDelay: egg.delay,
              animationDuration: "6s",
            }}
          >
            {/* Lueur d'aura du Dofus */}
            <div
              className="absolute -inset-2 rounded-full blur-xl opacity-40 transition-opacity"
              style={{ background: egg.color }}
            />
            <img
              src={egg.src}
              alt={`Dofus ${egg.name}`}
              className="relative w-14 h-14 md:w-16 md:h-16 lg:w-20 lg:h-20 object-contain drop-shadow-[0_10px_25px_rgba(0,0,0,0.8)] filter brightness-105"
              loading="lazy"
            />
          </div>
        </div>
      ))}

      {/* ── CONTENT ── */}
      {/* ── CONTENT ── */}
      <div
        className="relative z-20 flex flex-col items-center justify-center text-center max-w-5xl mx-auto"
        style={{ minHeight: "100svh", padding: "120px 20px 90px" }}
      >
        {/* Eyebrow badge épuré */}
        <div
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold text-zinc-300 mb-8 border border-white/10 bg-white/[0.04] backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-500"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Compagnon de Guilde Dofus Unity · 100% Gratuit</span>
        </div>

        {/* H1 Gamer & Impactant */}
        <h1
          className="font-black tracking-tight leading-[1.08] mb-6 font-heading"
          style={{
            fontSize: "clamp(2.4rem, 5.5vw, 4.8rem)",
            color: "#ffffff",
            textShadow: "0 4px 30px rgba(0,0,0,0.9)",
          }}
        >
          Le Quartier Général connecté{" "}
          <span
            className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500"
            style={{
              textShadow: "0 0 40px rgba(240,192,64,0.4)",
            }}
          >
            de votre guilde
          </span>
          .
        </h1>

        {/* Subtitle direct et concret */}
        <p
          className="mb-10 max-w-2xl leading-relaxed text-zinc-300 font-normal"
          style={{
            fontSize: "clamp(1rem, 1.6vw, 1.15rem)",
            textShadow: "0 2px 10px rgba(0,0,0,0.8)",
          }}
        >
          Fini le désordre dans 50 salons et les allers-retours ALT+TAB. Sorties donjons, quêtes Dofus, archimonstres Metamob et fiches de boss tactiques synchronisés avec votre serveur Discord.
        </p>

        {/* CTA Buttons - Style Discord & Outil Gamer */}
        <div className="flex flex-col sm:flex-row items-center gap-3.5 mb-5 w-full justify-center">
          {user && userGuilds.length > 0 ? (
            <Link
              href="/dashboard"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg shadow-emerald-950/40"
            >
              <span>Accéder à mon QG</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <>
              <button
                type="button"
                onClick={() => loginWithDiscord()}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl font-bold text-sm bg-[#5865F2] hover:bg-[#4752c4] text-white transition-all shadow-lg shadow-[#5865F2]/25 cursor-pointer active:scale-95"
              >
                <DiscordIcon className="w-4 h-4" />
                <span>Installer sur mon Discord</span>
              </button>

              <Link
                href="/guides/rush-sylvestre"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm transition-all border border-white/10 hover:border-emerald-500/40 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 hover:text-white backdrop-blur-md"
              >
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Tester l'Overlay sans compte</span>
              </Link>
            </>
          )}
        </div>

        {/* Helper subtext */}
        <div className="text-xs text-zinc-400 mb-10 flex flex-wrap items-center justify-center gap-2">
          <span>⚡ Déploiement en 30 secondes · 100% Gratuit</span>
          <span className="text-zinc-600">·</span>
          <button
            type="button"
            onClick={() => setShowAccessModal(true)}
            className="text-zinc-400 hover:text-emerald-400 underline font-medium transition-colors cursor-pointer"
          >
            Besoin d'aide ou alliance ?
          </button>
        </div>

        {/* Quick tool navigation */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
          <span className="text-xs text-zinc-500 font-semibold mr-1">Outils en libre accès :</span>
          <Link
            href="/guides/rush-sylvestre"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-zinc-300 hover:text-white transition-colors"
          >
            <span>🌲</span>
            <span>Guide Rush Sylvestre</span>
          </Link>

          <Link
            href="/boss"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-zinc-300 hover:text-white transition-colors"
          >
            <span>⚔️</span>
            <span>Fiches Boss &amp; Donjons</span>
          </Link>

          <Link
            href="/almanax"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-zinc-300 hover:text-white transition-colors"
          >
            <span>📅</span>
            <span>Almanax du jour</span>
          </Link>
        </div>
      </div>

      {/* Fondu de sortie fluide vers le Bento sans aucune démarcation */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, transparent 0%, #09090b 100%)",
        }}
      />

      {/* Modale d'accès */}
      <AccessRequestModal
        open={showAccessModal}
        onClose={() => setShowAccessModal(false)}
      />
    </section>
  );
}

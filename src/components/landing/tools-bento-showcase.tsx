"use client";

import React from "react";
import Link from "next/link";
import {
  Sparkles,
  Swords,
  Calendar,
  Compass,
  ArrowRight,
  ExternalLink,
  Zap,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { loginWithDiscord } from "@/server/actions/auth-actions";
import { DiscordIcon } from "@/components/shared/icons";

export function ToolsBentoShowcase() {
  return (
    <section className="relative w-full py-20 border-b border-border overflow-hidden bg-background">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-2xl mx-auto text-center space-y-4 mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-success/10 border border-success/20 text-xs font-black uppercase tracking-widest text-success">
            <Sparkles className="w-3.5 h-3.5" /> Compagnon de Jeu 100% Gratuit
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground font-heading">
            Des outils taillés pour le jeu, <span className="text-success">sans inscription</span>.
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Profitez de nos fonctionnalités de pointe directement depuis votre navigateur ou en fenêtre flottante au-dessus de votre client Dofus Unity.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 : Overlay In-Game (Spans 2 cols) */}
          <div className="md:col-span-2 relative rounded-3xl border border-border bg-gradient-to-br from-emerald-950/20 via-surface to-background p-6 sm:p-8 flex flex-col justify-between overflow-hidden group shadow-xl hover:border-emerald-500/30 transition-all duration-300">
            <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

            <div className="space-y-4 relative z-10">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" /> 100% Gratuit & Sans Inscription
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-bold">
                  Exclusivité SigilOS
                </span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                L'Overlay Flottant par-dessus votre jeu
              </h3>

              <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
                Détachez le guide de quête en mini-fenêtre toujours au premier plan directement par-dessus votre jeu Dofus. Copiez les coordonnées <span className="font-mono font-bold text-foreground">/travel</span> en 1 clic, cochez vos étapes et prévoyez vos ressources sans jamais faire alt-tab.
              </p>

              {/* Feature Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-xs font-semibold text-zinc-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Toujours au premier plan
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-xs font-semibold text-zinc-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Copie /travel 0ms
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-xs font-semibold text-zinc-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 0 compte requis (Sauvegarde locale)
                </span>
              </div>
            </div>

            <div className="pt-8 relative z-10 flex items-center justify-between gap-4">
              <Link
                href="/guides/rush-sylvestre"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20"
              >
                <span>Essayer le Rush Sylvestre</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Card 2 : Fiches Boss Tactiques (1 col) */}
          <div className="relative rounded-3xl border border-border bg-gradient-to-br from-amber-950/20 via-surface to-background p-6 sm:p-8 flex flex-col justify-between overflow-hidden group shadow-xl hover:border-amber-500/30 transition-all duration-300">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

            <div className="space-y-4 relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider">
                <Swords className="w-3.5 h-3.5" /> Bestiaire Tactique
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                Fiches Boss & Grilles 3D
              </h3>

              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Visualisez la portée des sorts des boss sur grille isométrique, leurs résistances par grade et anticipez les mécaniques clés en combat.
              </p>
            </div>

            <div className="pt-6 relative z-10">
              <Link
                href="/boss"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-foreground font-bold text-xs border border-white/10 transition-colors w-full justify-center"
              >
                <span>Explorer les boss</span>
                <ArrowRight className="w-4 h-4 text-amber-400" />
              </Link>
            </div>
          </div>

          {/* Card 3 : Almanax du Jour (1 col) */}
          <div className="relative rounded-3xl border border-border bg-surface p-6 sm:p-8 flex flex-col justify-between overflow-hidden group shadow-xl hover:border-border transition-all duration-300">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success/10 border border-success/20 text-success text-xs font-bold uppercase tracking-wider">
                <Calendar className="w-3.5 h-3.5" /> Quotidien
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                Almanax & Prévisions
              </h3>

              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Consultez l'offrande requise du jour, les bonus du Méryde et le calendrier prévisionnel des 30 prochains jours.
              </p>
            </div>

            <div className="pt-6">
              <Link
                href="/almanax"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-foreground font-bold text-xs border border-white/10 transition-colors w-full justify-center"
              >
                <span>Voir l'Almanax du jour</span>
                <ArrowRight className="w-4 h-4 text-success" />
              </Link>
            </div>
          </div>

          {/* Card 4 : Transition Guilde / QG Discord (Spans 2 cols) */}
          <div className="md:col-span-2 relative rounded-3xl border border-border bg-gradient-to-br from-surface via-background to-surface p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-xl">
            <div className="space-y-2 max-w-md">
              <h3 className="text-xl font-bold text-foreground tracking-tight">
                Et pour votre guilde ?
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Interconnectez vos 80 membres : synchro de quêtes en direct, bot Discord pour les sorties et annuaire des métiers 200.
              </p>
            </div>

            <button
              type="button"
              onClick={() => loginWithDiscord()}
              className="inline-flex items-center gap-2.5 px-5 py-3 rounded-xl bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-[#5865F2]/25 shrink-0 cursor-pointer"
            >
              <DiscordIcon className="w-4 h-4" />
              <span>Déployer ma guilde en 1 clic</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

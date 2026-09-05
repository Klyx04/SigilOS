"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { loginWithDiscord } from "@/server/actions/auth-actions";
import { DiscordIcon } from "@/components/shared/icons";

function CardLabel({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
      <Image src={icon} alt="" width={18} height={18} className="w-[18px] h-[18px] object-contain" />
      <span>{children}</span>
    </p>
  );
}

export function ToolsBentoShowcase() {
  return (
    <section className="relative w-full py-20 border-b border-border overflow-hidden bg-background">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        {/* En-tête aligné à gauche : ce que le joueur y gagne, sans pastille */}
        <div className="max-w-2xl space-y-4 mb-12">
          <p className="text-sm font-semibold text-success">Compagnon de jeu gratuit</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground font-heading">
            Tes outils de jeu, sans inscription.
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Directement dans ton navigateur, ou en fenêtre flottante au-dessus de
            ton client Dofus Unity. Aucun compte à créer, la sauvegarde reste sur ton PC.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 : Overlay In-Game (2 cols) */}
          <div className="md:col-span-2 rounded-2xl border border-border bg-surface p-6 sm:p-8 flex flex-col justify-between">
            <div className="space-y-4">
              <CardLabel icon="/assets/dofus/icons/hourglass.png">
                Overlay · gratuit et sans inscription
              </CardLabel>

              <h3 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                Le guide de quête, flottant sur ton jeu
              </h3>

              <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
                Détache le guide en mini-fenêtre toujours au premier plan.
                Copie les coordonnées <span className="font-mono font-bold text-foreground">/travel</span> en
                1 clic, coche tes étapes et prévois tes ressources sans alt-tab.
              </p>

              <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2">
                {["Toujours au premier plan", "Copie /travel en 1 clic", "Sauvegarde locale, 0 compte"].map((item) => (
                  <li key={item} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-8">
              <Link
                href="/guides/rush-sylvestre"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm"
              >
                <span>Essayer le Rush Sylvestre</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Card 2 : Fiches Boss (1 col) */}
          <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 flex flex-col justify-between">
            <div className="space-y-4">
              <CardLabel icon="/assets/dofus/icons/archimonster.png">
                Bestiaire tactique
              </CardLabel>

              <h3 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                Fiches boss et grilles de portée
              </h3>

              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Portée des sorts sur grille isométrique, résistances par grade,
                mécaniques clés à anticiper avant le combat.
              </p>
            </div>

            <div className="pt-6">
              <Link
                href="/boss"
                className="group inline-flex items-center gap-1.5 text-sm font-semibold text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground"
              >
                <span>Explorer les boss</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>

          {/* Card 3 : Almanax (1 col) */}
          <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 flex flex-col justify-between">
            <div className="space-y-4">
              <CardLabel icon="/assets/dofus/icons/almanax.png">
                Quotidien
              </CardLabel>

              <h3 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                Almanax et prévisions
              </h3>

              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Offrande du jour, bonus du Méryde et calendrier des 30 prochains jours.
              </p>
            </div>

            <div className="pt-6">
              <Link
                href="/almanax"
                className="group inline-flex items-center gap-1.5 text-sm font-semibold text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground"
              >
                <span>Voir l&apos;Almanax du jour</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>

          {/* Card 4 : Guilde / QG Discord (2 cols) */}
          <div className="md:col-span-2 rounded-2xl border border-border bg-surface p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-2 max-w-md">
              <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Image src="/assets/dofus/icons/guild.png" alt="" width={18} height={18} className="w-[18px] h-[18px] object-contain" />
                <span>Pour ta guilde</span>
              </p>
              <h3 className="text-xl font-bold text-foreground tracking-tight">
                Et pour ta guilde ?
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Synchro de quêtes en direct, bot Discord pour les sorties,
                annuaire des métiers 200.
              </p>
            </div>

            <button
              type="button"
              onClick={() => loginWithDiscord()}
              className="inline-flex items-center gap-2.5 px-5 py-3 rounded-xl bg-[#5865F2] hover:brightness-110 text-white font-bold text-sm shrink-0 cursor-pointer"
            >
              <DiscordIcon className="w-4 h-4" />
              <span>Connecter mon Discord</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

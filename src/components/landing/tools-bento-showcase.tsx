"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { loginWithDiscord } from "@/server/actions/auth-actions";
import { buildDiscordBotInviteUrl } from "@/lib/discord-permissions";
import { DiscordIcon } from "@/components/shared/icons";

function CardLabel({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2.5 text-sm font-semibold text-muted-foreground">
      <Image src={icon} alt="" width={22} height={22} className="w-[22px] h-[22px] object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]" />
      <span>{children}</span>
    </p>
  );
}

export function ToolsBentoShowcase({ clientId = "" }: { clientId?: string }) {
  const openBotInstall = () => {
    if (!clientId) {
      void loginWithDiscord();
      return;
    }
    const inviteUrl = buildDiscordBotInviteUrl(clientId, {
      redirectUri: `${window.location.origin}/onboarding/success`,
      scope: "bot applications.commands",
    });
    if (!inviteUrl) return;
    const popup = window.open(inviteUrl, "_blank");
    if (!popup || popup.closed || typeof popup.closed === "undefined") {
      window.location.href = inviteUrl;
    }
  };

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

              <div className="flex items-start justify-between gap-4">
                <h3 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                  Le guide de quête, flottant sur ton jeu
                </h3>
                <Image
                  src="/module-dofus/Dofus_Sylvestre.png"
                  alt="Dofus Sylvestre"
                  width={72}
                  height={72}
                  className="w-16 h-16 sm:w-[72px] sm:h-[72px] object-contain shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
                />
              </div>

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

              <div className="flex items-start justify-between gap-3">
                <h3 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                  Fiches boss et grilles de portée
                </h3>
                <Image
                  src="/game-data/monsters/blop.webp"
                  alt="Blop, monstre iconique de Dofus"
                  width={64}
                  height={64}
                  className="w-14 h-14 sm:w-16 sm:h-16 object-contain shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
                />
              </div>

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
                <Image src="/assets/dofus/icons/guild.png" alt="" width={22} height={22} className="w-[22px] h-[22px] object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]" />
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

            <div className="flex flex-col items-stretch gap-3 shrink-0 sm:min-w-[320px]">
              <button
                type="button"
                onClick={openBotInstall}
                className="inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold text-sm shrink-0 cursor-pointer"
              >
                <DiscordIcon className="w-4 h-4" />
                <span>Configurer SigilOS pour mon serveur Discord</span>
              </button>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shrink-0"
              >
                <span>Voir le tableau de bord</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

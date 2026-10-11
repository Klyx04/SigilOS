"use client";

import { PictureInPicture2 } from "lucide-react";
import { useBossOverlay } from "@/hooks/use-boss-overlay";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

interface BossOverlayButtonProps {
  /** Guilde ciblée par l'overlay (`"public"` sur les pages ouvertes). */
  guildId?: string;
  /** Boss transmis à l'overlay au premier affichage (facultatif). */
  monsterName?: string;
  dungeonName?: string;
  className?: string;
}

/**
 * Bouton unique d'ouverture de l'overlay Bestiaire & Boss (mini-fenêtre PiP).
 *
 * Une seule source de vérité pour l'icône, le libellé et l'état « déjà ouvert »,
 * partagée par toutes les surfaces publiques (fiche de boss, catalogue `/boss`).
 * Sans `monsterName`, l'overlay s'ouvre sur son écran de recherche.
 */
export function BossOverlayButton({
  guildId = "public",
  monsterName,
  dungeonName,
  className,
}: BossOverlayButtonProps) {
  const { openBossOverlay, isOpen } = useBossOverlay(guildId);
  const { t, locale } = useI18n();

  return (
    <button
      type="button"
      onClick={() =>
        openBossOverlay(monsterName ? { monsterName, dungeonName } : undefined)
      }
      title={
        locale === "en"
          ? "Opens a detachable mini-window over your Dofus game"
          : "Ouvre une mini-fenêtre détachable par-dessus votre jeu Dofus"
      }
      aria-pressed={isOpen}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition-all duration-150",
        isOpen
          ? "border-warning bg-warning/20 text-warning ring-1 ring-warning/40"
          : "border-warning/40 bg-warning/10 text-warning hover:border-warning/70 hover:bg-warning/20",
        className
      )}
    >
      <PictureInPicture2 className="h-4 w-4 shrink-0" />
      <span>{t.bossPage.overlayButton}</span>
      {isOpen && (
        <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
      )}
    </button>
  );
}

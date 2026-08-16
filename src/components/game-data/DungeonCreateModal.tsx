"use client";

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Swords, ExternalLink, Info } from "lucide-react";
import { siteConfig } from "@/config/site-config";

interface DungeonCreateModalProps {
  guildId: string;
  isOpen: boolean;
  onClose: () => void;
  name: string;
  dofusdbId: number | null;
  isAdmin: boolean;
  onCreated: (dungeonId: string) => void;
}

/**
 * Modale « Donjon non peuplé » (chantier #93).
 * La création de donjon par n'importe quel membre est retirée :
 * on renvoie vers le Discord SigilOS pour une demande d'ajout couverte
 * par la base de données de jeu (god / game-data uniquement).
 */
export function DungeonCreateModal({
  isOpen,
  onClose,
  name,
}: DungeonCreateModalProps) {

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-lg bg-background border border-border rounded-2xl text-foreground max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-border bg-surface/40">
          <DialogTitle className="text-xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-elevated border border-border flex items-center justify-center shrink-0">
              <Swords className="w-5 h-5 text-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg text-foreground leading-none">
                Donjon non couvert
              </span>
              <span className="text-caption text-muted-foreground font-semibold mt-1">
                Base de données de jeu
              </span>
            </div>
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-2">
            Le donjon <strong className="text-foreground">{name}</strong> n'existe pas encore dans les données de jeu de SigilOS.
          </DialogDescription>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="flex flex-col gap-4 rounded-xl bg-surface/50 border border-border p-4">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-sm space-y-1.5 leading-relaxed">
                <p className="font-semibold text-foreground">Ce donjon n'est pas encore couvert par SigilOS.</p>
                <p className="text-muted-foreground">
                  Faites une demande d'ajout sur le serveur Discord SigilOS : il sera référencé dans la base de données de jeu, puis apparaîtra automatiquement ici pour toute la guilde.
                </p>
              </div>
            </div>

            <a
              href={siteConfig.links.discord}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-success hover:bg-success text-success-foreground text-sm font-semibold transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Demander l'ajout sur Discord
            </a>
          </div>

          <div className="space-y-1.5">
            <label className="text-caption font-semibold text-muted-foreground uppercase tracking-widest block ml-1">Nom du Donjon</label>
            <input
              type="text"
              value={name}
              disabled
              className="w-full bg-surface/50 border border-border rounded-xl px-4 py-3 text-sm text-muted-foreground cursor-not-allowed"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="h-11 px-6 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground bg-surface hover:bg-surface transition-colors"
            >
              Fermer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
      <DialogContent className="w-[95vw] max-w-lg bg-zinc-950 border border-white/10 rounded-2xl text-white max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-white/5 bg-zinc-900/40">
          <DialogTitle className="text-xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-white/10 flex items-center justify-center shrink-0">
              <Swords className="w-5 h-5 text-zinc-300" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg text-white leading-none">
                Donjon non couvert
              </span>
              <span className="text-caption text-zinc-500 font-semibold mt-1">
                Base de données de jeu
              </span>
            </div>
          </DialogTitle>
          <DialogDescription className="text-sm text-zinc-400 mt-2">
            Le donjon <strong className="text-zinc-200">{name}</strong> n'existe pas encore dans les données de jeu de SigilOS.
          </DialogDescription>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="flex flex-col gap-4 rounded-xl bg-zinc-900/50 border border-white/10 p-4">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-zinc-400 shrink-0 mt-0.5" />
              <div className="text-sm space-y-1.5 leading-relaxed">
                <p className="font-semibold text-zinc-100">Ce donjon n'est pas encore couvert par SigilOS.</p>
                <p className="text-zinc-400">
                  Faites une demande d'ajout sur le serveur Discord SigilOS : il sera référencé dans la base de données de jeu, puis apparaîtra automatiquement ici pour toute la guilde.
                </p>
              </div>
            </div>

            <a
              href={siteConfig.links.discord}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Demander l'ajout sur Discord
            </a>
          </div>

          <div className="space-y-1.5">
            <label className="text-caption font-semibold text-zinc-500 uppercase tracking-widest block ml-1">Nom du Donjon</label>
            <input
              type="text"
              value={name}
              disabled
              className="w-full bg-zinc-900/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-zinc-400 cursor-not-allowed"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-white/5 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="h-11 px-6 rounded-xl text-sm font-semibold text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
            >
              Fermer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

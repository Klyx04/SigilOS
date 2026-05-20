"use client";

import { useState, useEffect, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ShieldAlert, Swords, Trophy, Link, FileText, Image, Star, Plus } from "lucide-react";
import { createDungeonAction } from "@/server/actions/game-data-actions";

interface DungeonCreateModalProps {
  guildId: string;
  isOpen: boolean;
  onClose: () => void;
  name: string;
  dofusdbId: number | null;
  isAdmin: boolean;
  onCreated: (dungeonId: string) => void;
}

export function DungeonCreateModal({
  guildId,
  isOpen,
  onClose,
  name,
  dofusdbId,
  isAdmin,
  onCreated
}: DungeonCreateModalProps) {
  const [bossName, setBossName] = useState("");
  const [level, setLevel] = useState<number>(200);
  const [dpnlUrl, setDpnlUrl] = useState("");
  const [dofuspourlesnoobsUrl, setDofuspourlesnoobsUrl] = useState("");
  const [dofensiveUrl, setDofensiveUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isPending, startTransition] = useTransition();

  // Pre-populate fields on open
  useEffect(() => {
    if (isOpen) {
      setBossName(name || "");
      setLevel(200);
      setDpnlUrl("");
      setDofuspourlesnoobsUrl("");
      setDofensiveUrl("");
      setImageUrl("");
    }
  }, [isOpen, name]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error("Seuls les administrateurs peuvent créer un donjon.");
      return;
    }

    if (!bossName.trim()) {
      toast.error("Le nom du boss est requis.");
      return;
    }

    if (!level || level < 1 || level > 200) {
      toast.error("Le niveau doit être compris entre 1 et 200.");
      return;
    }

    startTransition(async () => {
      const res = await createDungeonAction(guildId, {
        name,
        bossName: bossName.trim(),
        level: Number(level),
        dofusdbId,
        dpnlUrl: dpnlUrl.trim() || null,
        dofuspourlesnoobsUrl: dofuspourlesnoobsUrl.trim() || null,
        dofensiveUrl: dofensiveUrl.trim() || null,
        imageUrl: imageUrl.trim() || null
      });

      if (res.success && res.data) {
        toast.success(`Le donjon ${name} a été créé avec succès !`);
        onCreated(res.data.id);
        onClose();
      } else {
        toast.error(res.error || "Une erreur est survenue lors de la création.");
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-lg bg-zinc-950 border border-white/10 shadow-2xl rounded-2xl text-white max-h-[90vh] overflow-y-auto p-0 gap-0 premium-scrollbar">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-white/5 bg-zinc-900/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 blur-3xl rounded-full -mr-16 -mt-16" />
          <DialogTitle className="text-xl font-black flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shadow-lg shadow-rose-900/10 shrink-0">
              <Swords className="w-5 h-5 text-rose-500" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl tracking-tight text-white leading-none">
                Donjon Non Peuplé
              </span>
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
                Base de données de jeu
              </span>
            </div>
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400 mt-2">
            Le donjon <strong className="text-rose-400">{name}</strong> n'existe pas encore dans les données de SigilOS.
          </DialogDescription>
        </div>

        {/* Content / Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {!isAdmin && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3 text-amber-200/90">
              <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold uppercase tracking-wider">Mode Consultation Uniquement</p>
                <p>Ce donjon n'a pas encore été importé. Seuls les officiers et administrateurs peuvent le peupler.</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {/* Dungeon Name (Read-only) */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block ml-1">Nom du Donjon</label>
              <input
                type="text"
                value={name}
                disabled
                className="w-full bg-zinc-900/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-zinc-400 cursor-not-allowed"
              />
            </div>

            {/* DofusDB ID (Read-only / optional) */}
            {dofusdbId && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block ml-1">ID DofusDB</label>
                <input
                  type="text"
                  value={dofusdbId}
                  disabled
                  className="w-full bg-zinc-900/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-zinc-400 cursor-not-allowed font-mono"
                />
              </div>
            )}

            {/* Boss Name */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block ml-1">Nom du Gardien (Boss) *</label>
              <div className="relative group">
                <Swords className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-rose-500 transition-colors" />
                <input
                  type="text"
                  value={bossName}
                  onChange={(e) => setBossName(e.target.value)}
                  disabled={!isAdmin}
                  required
                  placeholder="Ex: Kardorim"
                  className="w-full bg-zinc-900 border border-white/5 rounded-xl pl-11 pr-4 py-3.5 text-sm text-white focus:outline-none focus:border-rose-500/50 focus:ring-4 focus:ring-rose-500/5 transition-all placeholder:text-zinc-600 disabled:opacity-50"
                />
              </div>
            </div>

            {/* Level */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block ml-1">Niveau du Donjon (1-200) *</label>
              <div className="relative group">
                <Trophy className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-rose-500 transition-colors" />
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={level}
                  onChange={(e) => setLevel(parseInt(e.target.value) || 200)}
                  disabled={!isAdmin}
                  required
                  className="w-full bg-zinc-900 border border-white/5 rounded-xl pl-11 pr-4 py-3.5 text-sm text-white focus:outline-none focus:border-rose-500/50 focus:ring-4 focus:ring-rose-500/5 transition-all disabled:opacity-50"
                />
              </div>
            </div>

            {/* Image URL */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block ml-1">URL de l'image (Optionnel)</label>
              <div className="relative group">
                <Image className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-rose-500 transition-colors" />
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  disabled={!isAdmin}
                  placeholder="https://..."
                  className="w-full bg-zinc-900 border border-white/5 rounded-xl pl-11 pr-4 py-3.5 text-sm text-white focus:outline-none focus:border-rose-500/50 focus:ring-4 focus:ring-rose-500/5 transition-all placeholder:text-zinc-600 disabled:opacity-50"
                />
              </div>
            </div>

            {/* DPNL URL */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block ml-1">Lien Dofus pour les Noobs (Optionnel)</label>
              <div className="relative group">
                <Link className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-rose-500 transition-colors" />
                <input
                  type="url"
                  value={dofuspourlesnoobsUrl}
                  onChange={(e) => setDofuspourlesnoobsUrl(e.target.value)}
                  disabled={!isAdmin}
                  placeholder="https://www.dofuspourlesnoobs.com/..."
                  className="w-full bg-zinc-900 border border-white/5 rounded-xl pl-11 pr-4 py-3.5 text-sm text-white focus:outline-none focus:border-rose-500/50 focus:ring-4 focus:ring-rose-500/5 transition-all placeholder:text-zinc-600 disabled:opacity-50"
                />
              </div>
            </div>

            {/* Dofensive URL */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block ml-1">Lien Dofensive (Optionnel)</label>
              <div className="relative group">
                <Link className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-rose-500 transition-colors" />
                <input
                  type="url"
                  value={dofensiveUrl}
                  onChange={(e) => setDofensiveUrl(e.target.value)}
                  disabled={!isAdmin}
                  placeholder="https://dofensive.com/..."
                  className="w-full bg-zinc-900 border border-white/5 rounded-xl pl-11 pr-4 py-3.5 text-sm text-white focus:outline-none focus:border-rose-500/50 focus:ring-4 focus:ring-rose-500/5 transition-all placeholder:text-zinc-600 disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-white/5 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="h-11 px-6 rounded-xl text-xs font-black text-zinc-500 hover:text-white bg-white/5 hover:bg-white/10 uppercase tracking-wider"
            >
              Fermer
            </Button>
            {isAdmin && (
              <Button
                type="submit"
                disabled={isPending}
                className="h-11 px-6 rounded-xl text-xs font-black bg-rose-500 hover:bg-rose-400 text-zinc-950 shadow-lg shadow-rose-900/20 uppercase tracking-wider flex items-center gap-2"
              >
                {isPending ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 text-zinc-950" />
                )}
                {isPending ? "Création..." : "Créer le donjon"}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GuildAlignmentPanel, type AlignmentMember } from "./GuildAlignmentPanel";

/**
 * Modale « Alignement de la guilde » (enveloppe dashboard).
 *
 * Remplace le renvoi au profil personnel : un clic sur le bloc d'alignement ouvre
 * désormais la vue de **toute la guilde** (camps → Ordres → tranches).
 * L'overlay PiP utilise le MÊME panneau avec une enveloppe sans portail.
 */
export function GuildAlignmentModal({
  open,
  onOpenChange,
  members,
  onChangeAlignment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: AlignmentMember[];
  onChangeAlignment?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden rounded-xl border border-border bg-background p-0 text-foreground">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle className="text-sm font-semibold text-foreground">
            Alignement de la guilde
          </DialogTitle>
          <DialogDescription className="text-[11px] text-muted-foreground">
            Qui est Bontarien, qui est Brâkmarien — et à quel Ordre.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[min(70vh,26rem)]">
          <GuildAlignmentPanel members={members} onChangeAlignment={onChangeAlignment} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

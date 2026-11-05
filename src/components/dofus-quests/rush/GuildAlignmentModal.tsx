"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDaTheme } from "@/components/da/da-theme";
import { daScopeProps } from "@/lib/da-scope";
import { GuildAlignmentPanel, type AlignmentMember } from "./GuildAlignmentPanel";

/**
 * Modale « Alignement de la guilde » (enveloppe dashboard).
 *
 * Remplace le renvoi au profil personnel : un clic sur le bloc d'alignement ouvre
 * désormais la vue de **toute la guilde** (camps → Ordres → tranches).
 * L'overlay PiP utilise le MÊME panneau avec une enveloppe sans portail.
 *
 * DA « Gouache Wakfu » (05/11/2026) : Radix porte ce contenu dans `document.body`,
 * donc hors de la coque `data-da`. `daScopeProps` repose la portée sur le nœud
 * portailé (`.da-portal` rétablit la passerelle de jetons dans `globals.css`) et
 * `daScopeProps(useDaTheme())` la laisse VIDE hors d'une surface de la DA : la
 * modale n'est jamais repeinte sur un écran non migré.
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
  const daScope = daScopeProps(useDaTheme());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        {...daScope}
        overlayClassName="da-modal-scrim"
        className="da-modal da-portal max-w-md gap-0 p-0"
      >
        <DialogHeader className="da-modal-head">
          <DialogTitle className="da-modal-title">Alignement de la guilde</DialogTitle>
          <DialogDescription className="da-modal-sub">
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

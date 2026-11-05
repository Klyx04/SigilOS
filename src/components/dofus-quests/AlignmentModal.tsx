"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDaTheme } from "@/components/da/da-theme";
import { daScopeProps } from "@/lib/da-scope";
import { AlignmentChoiceForm } from "./rush/AlignmentChoiceForm";

/**
 * Enveloppe `Dialog` (dashboard) du choix **cité → Ordre → tranche**.
 *
 * Le formulaire vit dans `AlignmentChoiceForm` : l'overlay PiP réutilise EXACTEMENT la
 * même logique avec une enveloppe sans portail (un `Dialog` Radix s'ouvrirait dans la
 * fenêtre principale, donc invisible depuis la fenêtre épinglée).
 *
 * Persistance : `updateUserProfile` (perso principal) ou `updateMuleAlignment` (mule),
 * via le formulaire partagé.
 *
 * DA « Gouache Wakfu » (05/11/2026) : portée reposée sur le nœud portailé, et
 * laissée vide hors d'une surface de la DA (le profil personnel monte aussi cette
 * modale — il garde exactement son habillage produit).
 */
export default function AlignmentModal({
  open,
  onOpenChange,
  guildId,
  mulePseudo,
  alignment,
  alignmentOrder,
  alignmentLevel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guildId: string;
  mulePseudo?: string | null;
  alignment?: string | null;
  alignmentOrder?: string | null;
  alignmentLevel?: number;
}) {
  const close = () => onOpenChange(false);
  const daScope = daScopeProps(useDaTheme());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        {...daScope}
        overlayClassName="da-modal-scrim"
        className="da-modal da-portal max-w-md max-h-[85vh] gap-0 p-0"
      >
        <DialogHeader className="da-modal-head">
          <DialogTitle className="da-modal-title">Alignement &amp; Ordre</DialogTitle>
        </DialogHeader>
        <div className="da-modal-body">
          <AlignmentChoiceForm
            guildId={guildId}
            mulePseudo={mulePseudo}
            alignment={alignment}
            alignmentOrder={alignmentOrder}
            onSaved={close}
            onCancel={close}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

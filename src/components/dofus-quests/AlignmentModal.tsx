"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-xl border border-border bg-background p-5 text-foreground">
        <DialogHeader className="mb-3">
          <DialogTitle className="text-sm font-semibold text-foreground">
            Alignement & Ordre
          </DialogTitle>
        </DialogHeader>
        <AlignmentChoiceForm
          guildId={guildId}
          mulePseudo={mulePseudo}
          alignment={alignment}
          alignmentOrder={alignmentOrder}
          onSaved={close}
          onCancel={close}
        />
      </DialogContent>
    </Dialog>
  );
}

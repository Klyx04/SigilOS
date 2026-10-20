"use client";

import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { GuildAlignmentPanel, type AlignmentMember } from "@/components/dofus-quests/rush/GuildAlignmentPanel";
import { AlignmentChoiceForm } from "@/components/dofus-quests/rush/AlignmentChoiceForm";

/**
 * Modale « Alignement » de l'overlay (Vue interne).
 *
 * ⚠️ PiP : **aucun portail**. Un `Dialog` Radix rendrait son contenu dans le
 * `document.body` de la fenêtre principale — invisible depuis la fenêtre épinglée.
 * On réutilise donc le panneau (`GuildAlignmentPanel`) et le formulaire
 * (`AlignmentChoiceForm`) du dashboard, avec cette enveloppe locale.
 */
export function RushOverlayAlignmentModal({
  guildId,
  members,
  selfAlignment,
  selfOrder,
  selfLevel,
  mulePseudo,
  onClose,
}: {
  guildId: string;
  members: AlignmentMember[];
  selfAlignment?: string | null;
  selfOrder?: string | null;
  selfLevel?: number | null;
  mulePseudo?: string | null;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"list" | "edit">("list");
  const rootRef = useRef<HTMLDivElement>(null);

  // Échap : sur le document qui PORTE la modale (PiP), comme les autres modales du rush.
  useEffect(() => {
    const win = rootRef.current?.ownerDocument.defaultView ?? (typeof window === "undefined" ? null : window);
    if (!win) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    win.addEventListener("keydown", onKey);
    return () => win.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div ref={rootRef} className="absolute inset-0 z-50 flex items-center justify-center p-2 sm:p-3">
      <button
        type="button"
        aria-label="Fermer l'alignement de la guilde"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />

      <div className="relative z-10 flex h-full max-h-full w-full max-w-[26rem] flex-col overflow-hidden rounded-[6px] border border-border-strong bg-elevated">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ordres/neutre.png" alt="" className="h-5 w-5 shrink-0 object-contain" />
            <div className="min-w-0">
              <h2 className="truncate text-[13px] font-semibold text-foreground">
                {mode === "edit" ? "Mon alignement" : "Alignement de la guilde"}
              </h2>
              <p className="truncate text-[10px] text-muted-foreground">
                {mode === "edit"
                  ? "Cité, Ordre et tranche"
                  : "Qui est bontarien ou brâkmarien, par Ordre"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="shrink-0 rounded-[4px] p-1.5 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {mode === "edit" ? (
            <AlignmentChoiceForm
              guildId={guildId}
              mulePseudo={mulePseudo}
              alignment={selfAlignment}
              alignmentOrder={selfOrder}
              alignmentLevel={selfLevel ?? 0}
              onSaved={() => setMode("list")}
              onCancel={() => setMode("list")}
              className="px-3 py-3"
            />
          ) : (
            <GuildAlignmentPanel members={members} onChangeAlignment={() => setMode("edit")} />
          )}
        </div>
      </div>
    </div>
  );
}

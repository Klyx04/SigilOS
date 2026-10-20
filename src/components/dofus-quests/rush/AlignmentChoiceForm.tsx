"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ALIGNMENTS, ORDERS } from "@/lib/dofus-assets";
import { updateUserProfile, updateMuleAlignment } from "@/server/actions/profile-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Choix **cité → Ordre → tranche**, sans aucune enveloppe (ni `Dialog`, ni portail).
 *
 * Une seule implémentation pour le dashboard (`AlignmentModal`) et l'overlay
 * (`RushOverlayAlignmentModal`) : en fenêtre Picture-in-Picture, un `Dialog` Radix
 * porterait son portail sur le `document.body` de la fenêtre PRINCIPALE — le
 * formulaire serait invisible. Ici, tout est rendu dans le conteneur appelant.
 */
export function AlignmentChoiceForm({
  guildId,
  mulePseudo,
  alignment,
  alignmentOrder,
  onSaved,
  onCancel,
  className,
}: {
  guildId: string;
  mulePseudo?: string | null;
  alignment?: string | null;
  alignmentOrder?: string | null;
  onSaved?: () => void;
  onCancel?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const [camp, setCamp] = useState<string | null>(alignment && alignment !== "neutre" ? alignment : null);
  const [order, setOrder] = useState<string | null>(alignmentOrder ?? null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Resynchronise à chaque ouverture (props serveur fraîches).
  useEffect(() => {
    setCamp(alignment && alignment !== "neutre" ? alignment : null);
    setOrder(alignmentOrder ?? null);
    setMessage(null);
  }, [alignment, alignmentOrder]);

  const orders = camp
    ? (ORDERS as unknown as Record<string, Array<Record<string, unknown>>>)[camp] || []
    : [];

  const opt = (active: boolean) =>
    cn(
      "rounded-[4px] border px-2 py-1.5 text-[11px] font-semibold transition-colors",
      active
        ? "border-accent/60 bg-accent/10 text-foreground"
        : "border-border bg-surface text-muted-foreground hover:text-foreground"
    );

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      // Logique jeu : changer de CITÉ réinitialise les quêtes d'alignement.
      // Les autres quêtes (communes, prérequis, donjons) gardent leur avancement.
      const campChanged = (camp ?? "neutre") !== (alignment ?? "neutre");
      if (campChanged) {
        const { resetAlignmentProgress } = await import("@/server/actions/optimized-guide-actions");
        const reset = await resetAlignmentProgress(guildId, mulePseudo ?? undefined);
        if (!reset.success) {
          setMessage(reset.error || "Réinitialisation impossible");
          return;
        }
      }

      const payload = {
        alignment: camp ?? "neutre",
        alignmentOrder: camp ? (order ?? null) : null,
      };
      const res = mulePseudo
        ? await updateMuleAlignment({ guildId, pseudo: mulePseudo, ...payload })
        : await updateUserProfile({ guildId, ...payload });
      if (res.success) {
        toast.success("Alignement mis à jour");
        router.refresh();
        onSaved?.();
      } else {
        setMessage(res.error || "Erreur de mise à jour");
      }
    } catch {
      setMessage("Erreur de mise à jour");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Alignement
        </p>
        <div className="grid grid-cols-3 gap-1">
          {ALIGNMENTS.map((alg) => {
            const active = (alg.id === "neutre" && !camp) || alg.id === camp;
            return (
              <button
                key={alg.id}
                type="button"
                onClick={() => {
                  setCamp(alg.id === "neutre" ? null : alg.id);
                  setOrder(null);
                }}
                aria-pressed={active}
                className={cn(opt(active), "flex items-center gap-1.5")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={alg.icon} alt="" className="h-4 w-4 object-contain" />
                <span className="truncate">{alg.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {camp && (
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Ordre
          </p>
          <div className="space-y-1">
            {orders.map((ord) => (
              <button
                key={String(ord.id)}
                type="button"
                onClick={() => {
                  setOrder(String(ord.id));
                }}
                aria-pressed={order === ord.id}
                className={cn(opt(order === ord.id), "flex w-full items-center gap-2 text-left")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={String(ord.icon)} alt="" className="h-4 w-4 object-contain" />
                <span className="truncate">{String(ord.name)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {message && <p className="text-[11px] text-danger">{message}</p>}

      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-[4px] border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            Annuler
          </button>
        )}
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-[4px] border border-accent/50 bg-accent/15 px-2.5 py-1.5 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/25 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-3 w-3 animate-spin" />}
          Enregistrer
        </button>
      </div>
    </div>
  );
}

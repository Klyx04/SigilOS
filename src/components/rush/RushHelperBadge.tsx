"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Handshake, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getSequenceHelpers } from "@/server/actions/optimized-guide-actions";
import { getRequiredMetiers, getRequiredDungeons } from "@/lib/rush-helpers";
import type { RushSequence } from "@/types/rush-guide-types";

type Helper = {
  profile: { profileId: string; name?: string; avatar?: string };
  reasons: string[];
  uncertain?: boolean;
};

/**
 * S4 « qui peut aider » — badge membre, purement INFORMATIF.
 * - `full`    (dashboard) : chip « N peut / N peuvent aider » + liste dépliable.
 * - `compact` (overlay)   : chip « 🤝 N » avec tooltip décrivant qui/résumé.
 * Chargement lazy (on-demand) via `getSequenceHelpers` ; aucun rendu si aucune
 * contrainte métier/donjon.
 *
 * Aucun lien vers le membre : le bouton [Inviter] et la modale « choix du salon »
 * ont été retirés le 20/09/2026 (demande user). Le badge sert à savoir **qui**
 * peut aider, pas à solliciter quelqu'un depuis le guide.
 */
export function RushHelperBadge({
  guildId,
  seq,
  variant = "full",
  className = "",
}: {
  guildId: string;
  seq: RushSequence;
  variant?: "full" | "compact";
  className?: string;
}) {
  const hasNeeds = getRequiredMetiers(seq).length > 0 || getRequiredDungeons(seq).length > 0;
  const [helpers, setHelpers] = useState<Helper[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!hasNeeds || loaded) return;
    setLoading(true);
    try {
      const res: any = await getSequenceHelpers(guildId, seq.id);
      if (res?.success) {
        const definite = (res.helpers || []).map((h: any) => ({ ...h, uncertain: false })) as Helper[];
        const uncertain = (res.uncertainHelpers || []).map((h: any) => ({ ...h, uncertain: true })) as Helper[];
        setHelpers([...definite, ...uncertain]);
      }
    } catch {
      // fail-closed : badge silencieux en cas d'erreur réseau
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [guildId, seq.id, hasNeeds, loaded]);

  useEffect(() => {
    load();
  }, [load]);

  if (!hasNeeds) return null;

  if (variant === "compact") {
    const count = helpers.length;
    const tooltip = loading
      ? "Recherche des membres qui peuvent t'aider…"
      : count
        ? `${count} membre${count > 1 ? "s" : ""} ${count > 1 ? "peuvent" : "peut"} aider :\n` +
          helpers
            .map((h) => `• ${h.profile.name || "Membre"} — ${h.reasons.join(", ")}${h.uncertain ? " (à confirmer)" : ""}`)
            .join("\n")
        : "Aucun membre ne peut t'aider sur cette quête pour l'instant.";
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 h-[18px] px-1.5 rounded border border-warning/30 bg-warning/10 text-[10px] font-bold text-warning shrink-0",
          className
        )}
        title={tooltip}
        aria-label={tooltip}
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Handshake className="w-3 h-3" />}
        <span className="tabular-nums">{count > 0 ? count : "?"}</span>
      </span>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border shrink-0 transition-colors",
            "border-warning/30 bg-warning/10 text-warning hover:bg-warning/15 text-[10px] font-bold",
            className
          )}
          title="Qui peut aider sur cette quête ?"
        >
          {loading ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Handshake className="w-2.5 h-2.5" />}
          {loading ? "…" : `${helpers.length} ${helpers.length > 1 ? "peuvent" : "peut"} aider`}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 max-h-80 overflow-y-auto bg-background border border-border text-foreground">
        {helpers.length === 0 ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">
            {loading ? "Recherche…" : "Aucun membre ne correspond pour l'instant."}
          </div>
        ) : (
          helpers.map((h) => (
            <div key={h.profile.profileId} className="flex items-start gap-2 px-3 py-2 hover:bg-elevated">
              {h.profile.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={h.profile.avatar} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
              ) : (
                <span className="w-6 h-6 rounded-full bg-elevated flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                  {(h.profile.name || "?").charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-foreground truncate">
                  {h.profile.name || "Membre"}
                  {h.uncertain && (
                    <span className="ml-1.5 text-[9px] font-bold text-warning bg-warning/10 border border-warning/30 px-1 py-0.5 rounded align-middle">
                      à confirmer
                    </span>
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground leading-snug">{h.reasons.join(" · ")}</p>
              </div>
            </div>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

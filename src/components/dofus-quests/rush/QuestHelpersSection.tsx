"use client";

import { useState, useEffect } from "react";
import { Handshake, Loader2 } from "lucide-react";
import { getSequenceHelpers } from "@/server/actions/optimized-guide-actions";
import { getRequiredMetiers, getRequiredDungeons } from "@/lib/rush-helpers";
import type { RushSequence } from "@/types/rush-guide-types";

type Helper = {
  profile: { profileId: string; name?: string; avatar?: string };
  reasons: string[];
  uncertain?: boolean;
};

/**
 * « Qui peut aider » pour la modale détail d'une quête — pseudos clairs
 * des membres capables d'aider (métiers/donjons requis).
 * Guild-only : ne rien rendre sans guildId (overlay public, landing).
 * Chargement lazy, fail-closed (silencieux en cas d'erreur).
 */
export function QuestHelpersSection({ guildId, seq }: { guildId: string; seq: RushSequence }) {
  const hasNeeds = getRequiredMetiers(seq).length > 0 || getRequiredDungeons(seq).length > 0;
  const [helpers, setHelpers] = useState<Helper[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasNeeds) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res: any = await getSequenceHelpers(guildId, seq.id);
        if (!cancelled && res?.success) {
          const definite = (res.helpers || []).map((h: any) => ({ ...h, uncertain: false })) as Helper[];
          const uncertain = (res.uncertainHelpers || []).map((h: any) => ({ ...h, uncertain: true })) as Helper[];
          setHelpers([...definite, ...uncertain]);
        }
      } catch {
        // fail-closed : section discrète en cas d'erreur réseau
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [guildId, seq.id, hasNeeds]);

  if (!hasNeeds) return null;

  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
        <Handshake className="h-3 w-3" aria-hidden="true" /> Qui peut aider
      </p>
      {loading ? (
        <div className="flex items-center gap-2 text-caption text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> Recherche des membres…
        </div>
      ) : helpers.length === 0 ? (
        <p className="text-caption text-muted-foreground">Aucun membre ne correspond pour l'instant.</p>
      ) : (
        <div className="space-y-1">
          {helpers.map((h) => (
            <div key={h.profile.profileId} className="flex items-center gap-2.5 rounded-[4px] border border-border bg-surface px-2.5 py-1.5">
              {h.profile.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={h.profile.avatar} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-elevated text-[10px] font-semibold text-muted-foreground">
                  {(h.profile.name || "?").charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-foreground">
                  {h.profile.name || "Membre"}
                  {h.uncertain && (
                    <span className="ml-1.5 rounded-[3px] border border-warning/40 bg-warning/10 px-1 py-0.5 align-middle text-[11px] font-medium text-warning">
                      à confirmer
                    </span>
                  )}
                </p>
                {h.reasons.length > 0 && (
                  <p className="truncate text-[11px] leading-snug text-muted-foreground">{h.reasons.join(" · ")}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

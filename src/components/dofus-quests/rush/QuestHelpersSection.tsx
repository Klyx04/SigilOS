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
      <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
        <Handshake className="w-3 h-3" /> Qui peut aider
      </p>
      {loading ? (
        <div className="flex items-center gap-2 text-caption text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" /> Recherche des membres…
        </div>
      ) : helpers.length === 0 ? (
        <p className="text-caption text-muted-foreground">Aucun membre ne correspond pour l'instant.</p>
      ) : (
        <div className="space-y-1">
          {helpers.map((h) => (
            <div key={h.profile.profileId} className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-2.5 py-1.5">
              {h.profile.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={h.profile.avatar} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
              ) : (
                <span className="w-6 h-6 rounded-full bg-elevated flex items-center justify-center text-[10px] font-black text-muted-foreground shrink-0">
                  {(h.profile.name || "?").charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground truncate">
                  {h.profile.name || "Membre"}
                  {h.uncertain && (
                    <span className="ml-1.5 text-[9px] font-bold text-warning bg-warning/10 border border-warning/30 px-1 py-0.5 rounded align-middle">
                      à confirmer
                    </span>
                  )}
                </p>
                {h.reasons.length > 0 && (
                  <p className="text-[10px] text-muted-foreground leading-snug truncate">{h.reasons.join(" · ")}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

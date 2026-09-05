"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Handshake, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getSequenceHelpers, inviteHelperForSequence, listRushTextChannels } from "@/server/actions/optimized-guide-actions";
import { getRequiredMetiers, getRequiredDungeons } from "@/lib/rush-helpers";
import type { RushSequence } from "@/types/rush-guide-types";

type Helper = {
  profile: { profileId: string; name?: string; avatar?: string };
  reasons: string[];
  uncertain?: boolean;
};

/**
 * S4 « qui peut aider » — badge membre.
 * - `full`    (dashboard) : chip + liste dépliable « X peut aider » + bouton [Inviter].
 * - `compact` (overlay)   : chip « 🤝 N » avec tooltip décrivant qui/résumé.
 * Chargement lazy (on-demand) via `getSequenceHelpers` ; aucun rendu si aucune
 * contrainte métier/donjon.
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

  // Invitation
  const [inviteTarget, setInviteTarget] = useState<Helper | null>(null);
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  const [channelId, setChannelId] = useState("");
  const [sending, setSending] = useState(false);

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

  async function openInvite(h: Helper) {
    setInviteTarget(h);
    setChannelId("");
    try {
      const res = await listRushTextChannels(guildId);
      if (res?.success) setChannels((res.channels as { id: string; name: string }[]) || []);
    } catch {
      setChannels([]);
    }
  }

  async function sendInvite(h: Helper) {
    if (!channelId) return;
    setSending(true);
    try {
      const res = await inviteHelperForSequence(guildId, seq.id, h.profile.profileId, channelId);
      if (res?.success) {
        toast.success(`Invitation envoyée à ${h.profile.name} !`);
        setInviteTarget(null);
        setChannelId("");
      } else {
        toast.error(res?.error || "Échec de l'invitation");
      }
    } catch {
      toast.error("Échec de l'invitation");
    } finally {
      setSending(false);
    }
  }

  if (!hasNeeds) return null;

  if (variant === "compact") {
    const count = helpers.length;
    const tooltip = loading
      ? "Recherche des membres qui peuvent t'aider…"
      : count
        ? `${count} membre${count > 1 ? "s" : ""} peut/puvent aider :\n` +
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
    <>
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
            {loading ? "…" : `${helpers.length} peut aider`}
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
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[10px] font-bold shrink-0 border-warning/40 text-warning hover:bg-warning/10"
                  onClick={() => openInvite(h)}
                >
                  Inviter
                </Button>
              </div>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!inviteTarget} onOpenChange={(o) => !o && setInviteTarget(null)}>
        <DialogContent className="sm:max-w-md bg-background border border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-black">
              <Send className="w-4 h-4 text-warning" /> Inviter {inviteTarget?.profile.name || "ce membre"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-caption text-muted-foreground">
              Choisis un salon pour ping <b className="text-foreground">{inviteTarget?.profile.name}</b> et demander
              son aide sur cette quête.
            </p>
            <select
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              className="w-full bg-elevated border border-border rounded-lg px-2.5 py-2 text-xs text-foreground focus:outline-none"
            >
              <option value="">— Choisir un salon —</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.name}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setInviteTarget(null)}>
              Annuler
            </Button>
            <Button
              size="sm"
              disabled={!channelId || sending}
              className="bg-warning hover:bg-warning/90 text-warning-foreground"
              onClick={() => sendInvite(inviteTarget!)}
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

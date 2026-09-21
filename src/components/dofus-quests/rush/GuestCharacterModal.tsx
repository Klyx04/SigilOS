"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { UserRound, Check, Eraser } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDofusPseudo } from "@/lib/utils";
import { DOFUS_CLASSES, getDofusServerImage } from "@/lib/dofus-assets";
import { DOFUS_UNITY_SERVERS } from "@/lib/presentation-constants";
import { PSEUDO_MAX_LENGTH, pseudoError } from "@/lib/pseudo-validation";
import type { GuestCharacter } from "@/lib/guest-progress";

interface GuestCharacterModalProps {
  open: boolean;
  onClose: () => void;
  /** Personnage actuellement déclaré (brouillon de départ). */
  initial: GuestCharacter | null;
  onSubmit: (character: GuestCharacter) => void;
  /** Retire le personnage déclaré (retour à la progression du navigateur). */
  onRemove?: () => void;
  locale?: "fr" | "en";
}

/**
 * Modale « Mon personnage » du guide public.
 *
 * Le choix vivait dans un panneau replié au milieu de la page (trois `<select>`) :
 * le user ne le voyait pas. Ici, tout est visuel et en un écran :
 *   · **classes** — les 20 pictos du jeu, cliquables ;
 *   · **serveurs** — les vignettes officielles des serveurs Unity ;
 *   · **pseudo** — normalisé à la saisie (`formatDofusPseudo`, comme le profil
 *     interne) et VALIDÉ par la même règle que le Zod du profil (`pseudoError`) :
 *     1ʳᵉ lettre majuscule, 2 à 20 caractères, pas de chiffres.
 *
 * Rien n'est écrit avant « Enregistrer » : l'appelant persiste (localStorage ici,
 * base côté guilde) et c'est lui qui coupe la progression par personnage.
 */
export function GuestCharacterModal({
  open,
  onClose,
  initial,
  onSubmit,
  onRemove,
  locale = "fr",
}: GuestCharacterModalProps) {
  const en = locale === "en";
  const [classId, setClassId] = useState<string | null>(null);
  const [serverId, setServerId] = useState<number | null>(null);
  const [pseudo, setPseudo] = useState("");

  // Le brouillon repart du personnage déclaré à CHAQUE ouverture (jamais d'un
  // état laissé par une saisie abandonnée).
  useEffect(() => {
    if (!open) return;
    setClassId(initial?.classId ?? null);
    setServerId(initial?.serverId ?? null);
    setPseudo(initial?.pseudo ?? "");
  }, [open, initial]);

  const pseudoErr = pseudoError(pseudo);
  // Un personnage a un NOM : la classe + le pseudo valide sont exigés, le serveur
  // reste facultatif (il ne sert qu'à distinguer deux persos homonymes).
  const canSave = !!classId && pseudo.trim().length > 0 && !pseudoErr;

  const servers = useMemo(
    () =>
      Object.values(DOFUS_UNITY_SERVERS)
        .flat()
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, "fr")),
    []
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[90vh] w-[95vw] max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-background p-0">
        {/* En-tête */}
        <div className="shrink-0 border-b border-border p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[4px] border border-border bg-surface">
              <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-sm font-semibold text-foreground">
                {en ? "My character" : "Mon personnage"}
              </DialogTitle>
              <p className="text-[11px] text-muted-foreground">
                {en
                  ? "Progress is saved PER character (class, nickname, server)."
                  : "La progression est enregistrée PAR personnage (classe, pseudo, serveur)."}
              </p>
            </div>
          </div>
        </div>

        {/* Corps */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
          {/* Classes */}
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {en ? "Class" : "Classe"}
            </h3>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5 md:grid-cols-7">
              {DOFUS_CLASSES.map((c) => {
                const active = classId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setClassId(c.id)}
                    aria-pressed={active}
                    title={c.name}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-[4px] border px-1 py-2 transition-colors cursor-pointer",
                      active
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border bg-surface text-muted-foreground hover:border-foreground/25 hover:text-foreground"
                    )}
                  >
                    {/* Picto de classe du jeu, posé NU. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.icon} alt="" className="h-8 w-8 object-contain" loading="lazy" />
                    <span className="w-full truncate text-center text-[10px] font-medium">{c.name}</span>
                  </button>
                );
              })}
            </div>
          </section>
          {/* Serveurs */}
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {en ? "Server (optional)" : "Serveur (facultatif)"}
            </h3>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4">
              {servers.map((s) => {
                const active = serverId === s.id;
                const image = getDofusServerImage(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setServerId(active ? null : s.id)}
                    aria-pressed={active}
                    title={s.name}
                    className={cn(
                      "flex items-center gap-2 rounded-[4px] border px-2 py-1.5 transition-colors cursor-pointer",
                      active
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border bg-surface text-muted-foreground hover:border-foreground/25 hover:text-foreground"
                    )}
                  >
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={image}
                        alt=""
                        className="h-6 w-6 shrink-0 rounded-[3px] border border-border object-cover"
                        loading="lazy"
                      />
                    ) : null}
                    <span className="min-w-0 flex-1 truncate text-left text-[11px] font-medium">{s.name}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Pseudo — même règle que le profil interne (Zod partagé). */}
          <section>
            <label
              htmlFor="guest-character-pseudo"
              className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {en ? "Character nickname" : "Nom du personnage"}
            </label>
            <input
              id="guest-character-pseudo"
              type="text"
              value={pseudo}
              onChange={(e) => setPseudo(formatDofusPseudo(e.target.value))}
              placeholder={en ? "e.g. Cra-Zar" : "ex. Cra-Zar"}
              maxLength={PSEUDO_MAX_LENGTH}
              aria-invalid={!!pseudoErr}
              className={cn(
                "h-10 w-full rounded-[4px] border bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none",
                pseudoErr ? "border-danger focus:border-danger" : "border-border focus:border-accent"
              )}
            />
            {pseudoErr ? (
              <p className="mt-1 text-[11px] font-medium text-danger">{pseudoErr}</p>
            ) : (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {en
                  ? "First letter capital, 2 to 20 characters, no digits (e.g. Iop, Cra-Zar)."
                  : "Première lettre en majuscule, 2 à 20 caractères, sans chiffre (ex. Iop, Cra-Zar)."}
              </p>
            )}
          </section>
        </div>

        {/* Pied */}
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border p-3">
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="mr-auto inline-flex items-center gap-1.5 rounded-[4px] border border-border px-3 py-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
              title={en ? "Back to browser progress (no character)" : "Revenir à la progression du navigateur (sans personnage)"}
            >
              <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
              {en ? "Remove" : "Retirer"}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-[4px] border border-border px-3 py-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
          >
            {en ? "Cancel" : "Annuler"}
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => onSubmit({ classId, pseudo: pseudo.trim() || null, serverId })}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[4px] px-3.5 py-2 text-[11px] font-semibold transition-colors",
              canSave
                ? "bg-accent text-accent-foreground hover:opacity-90 cursor-pointer"
                : "cursor-not-allowed border border-border text-muted-foreground opacity-60"
            )}
            title={canSave ? undefined : en ? "Pick a class and a valid nickname" : "Choisis une classe et un pseudo valide"}
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            {en ? "Save" : "Enregistrer"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

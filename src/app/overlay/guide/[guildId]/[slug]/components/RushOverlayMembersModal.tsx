"use client";

import React, { useEffect, useRef } from "react";
import { Users, X } from "lucide-react";

export type OverlayMember = { name: string; avatar?: string; subtitle?: string };

interface RushOverlayMembersModalProps {
  title: string;
  members: OverlayMember[];
  /**
   * Membres **réellement connectés** (présence WebSocket) — groupe affiché en premier.
   * Un membre de la base qui a un jour touché le guide n'est PAS en ligne : il reste dans
   * `members` (position connue), jamais dans ce groupe (retour user 08/10/2026 : « le badge
   * annonçait en ligne des gens qui ne l'étaient pas »).
   */
  liveMembers?: OverlayMember[];
  /** Conservé pour les appelants : l'apparence suit les jetons de thème. */
  isLightMode: boolean;
  onClose: () => void;
}

/**
 * Modale liste de membres (présence / « je suis ici » / « qui peut aider »).
 * Même grammaire que les autres modales du rush : rayon 6 px, filets, jetons de
 * thème — l'overlay pose `.light` sur sa racine en thème clair.
 */
export function RushOverlayMembersModal({
  title,
  members,
  liveMembers = [],
  onClose,
}: RushOverlayMembersModalProps) {
  // Échap ferme la modale — sur la fenêtre du document qui la PORTE : dans une fenêtre
  // Document Picture-in-Picture, le `window` de l'onglet ne reçoit aucun événement.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const win =
      rootRef.current?.ownerDocument.defaultView ??
      (typeof window === "undefined" ? null : window);
    if (!win) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    win.addEventListener("keydown", onKey);
    return () => win.removeEventListener("keydown", onKey);
  }, [onClose]);

  const empty = liveMembers.length === 0 && members.length === 0;

  return (
    <div ref={rootRef} className="absolute inset-0 z-50 flex items-center justify-center p-3">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div className="relative z-10 flex max-h-[min(70vh,22rem)] w-full max-w-[21rem] flex-col overflow-hidden rounded-[6px] border border-border-strong bg-elevated">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <Users className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            <h2 className="min-w-0 truncate text-[13px] font-semibold text-foreground">{title}</h2>
            <span className="shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground">
              {members.length}
            </span>
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

        {/* Liste DÉFILANTE : `min-h-0` est indispensable dans un flex en hauteur bornée,
            sinon le contenu déborde au lieu de défiler — la modale était coupée dans une
            fenêtre PiP réduite (retour user 21/09/2026 : « mini modale scrollable »). */}
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {empty ? (
            <p className="py-8 text-center text-[12px] text-muted-foreground">
              Personne ici pour l'instant.
            </p>
          ) : (
            <>
              {liveMembers.length > 0 && (
                <p className="px-1.5 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  En ligne maintenant ({liveMembers.length})
                </p>
              )}
              {liveMembers.map((m, i) => (
                <MemberRow key={`live-${m.name}-${i}`} member={m} online />
              ))}
              {members.length > 0 && (
                <p className="px-1.5 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {title} ({members.length})
                </p>
              )}
              {members.map((m, i) => (
                <MemberRow key={`${m.name}-${i}`} member={m} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Une ligne de membre : pastille d'état, avatar (ou initiale), nom, précision. */
function MemberRow({ member, online = false }: { member: OverlayMember; online?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[4px] border border-border bg-surface px-2.5 py-2">
      <span className="relative flex shrink-0 items-center">
        {member.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.avatar}
            alt={member.name}
            className="h-8 w-8 shrink-0 rounded-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-accent/40 bg-accent/15 text-[12px] font-semibold text-accent">
            {(member.name || "?").charAt(0)}
          </span>
        )}
        {online && (
          <span
            aria-hidden="true"
            className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-success"
          />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold text-foreground">{member.name}</p>
        {member.subtitle && (
          <p className="truncate text-[11px] text-muted-foreground">{member.subtitle}</p>
        )}
      </div>
    </div>
  );
}

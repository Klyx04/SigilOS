"use client";

/**
 * Aperçu de la route **telle que la voit le joueur** (G3).
 *
 * Mêmes jalons que le guide, passés par la règle unique `resolveRushRoute` — **aucun
 * second filtre** ici. Lecture seule : rien n'est publié, aucune écriture.
 *
 * Déplacé du studio en E2c (12/11/2026) : il appartient à l'onglet Branches, pas au
 * monolithe. Le câblage est inchangé (`rush-route-tooling` : `resolveRushRoute(milestones…`).
 */

import { useMemo, useState } from "react";
import { resolveRushRoute } from "@/lib/rush-route";
import { orderCodesForCamp } from "@/lib/rush-order-codes";
import { RushClassSelect } from "@/components/god/rush-editor/fields/RushClassSelect";
import type { RushMilestone } from "@/types/rush-guide-types";

export function RushRoutePreview({ milestones }: { milestones: RushMilestone[] }) {
  const [camp, setCamp] = useState("");
  const [order, setOrder] = useState("");
  const [classId, setClassId] = useState("");

  const visible = useMemo(
    () => resolveRushRoute(milestones, {
      camp: camp || null,
      order: order || null,
      playerClass: classId || null,
    }),
    [milestones, camp, order, classId],
  );
  const total = useMemo(() => milestones.reduce((n, m) => n + m.sequences.length, 0), [milestones]);
  const shown = useMemo(() => visible.reduce((n, m) => n + m.sequences.length, 0), [visible]);
  const blocks = useMemo(() => visible.filter((m) => m.sequences.length > 0), [visible]);

  const fieldClass = "w-full bg-background/80 border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none";

  return (
    <section className="rounded-xl border border-border bg-surface p-4 space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">Aperçu de la route</h2>
          <p className="text-caption text-muted-foreground">
            Ce que verra le joueur — calculé par <code>resolveRushRoute</code>, rien n&apos;est publié.
          </p>
        </div>
        <span className="text-caption font-semibold tabular-nums text-muted-foreground">{shown} / {total} quêtes</span>
      </header>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div>
          <label htmlFor="preview-camp" className="text-caption text-muted-foreground mb-1 block">Cité</label>
          <select
            id="preview-camp"
            value={camp}
            onChange={(e) => { setCamp(e.target.value); setOrder(""); }}
            className={fieldClass}
          >
            <option value="">— Aucune —</option>
            <option value="bontarien">Bontarien</option>
            <option value="brakmarien">Brakmarien</option>
          </select>
        </div>
        <div>
          <label htmlFor="preview-order" className="text-caption text-muted-foreground mb-1 block">Ordre</label>
          <select
            id="preview-order"
            value={order}
            disabled={!camp}
            onChange={(e) => setOrder(e.target.value)}
            className={`${fieldClass} disabled:opacity-40`}
          >
            <option value="">— Aucun —</option>
            {orderCodesForCamp(camp).map((o) => (
              <option key={o.code} value={o.code}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="preview-class" className="text-caption text-muted-foreground mb-1 block">Classe</label>
          <RushClassSelect id="preview-class" value={classId} onChange={setClassId} className={fieldClass} />
        </div>
      </div>
      {!camp && !order && !classId && (
        <p className="text-caption text-muted-foreground">
          Sans choix, le guide est complet : la route ne filtre que ce qui est déclaré.
        </p>
      )}
      <div className="space-y-1">
        {blocks.map((m) => (
          <details key={m.id} className="rounded-lg border border-border bg-elevated">
            <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-xs text-foreground">
              <span className="truncate">{m.title}</span>
              <span className="shrink-0 text-muted-foreground">{m.sequences.length} quête{m.sequences.length !== 1 ? "s" : ""}</span>
            </summary>
            <ul className="space-y-0.5 px-3 pb-2 text-caption text-muted-foreground">
              {m.sequences.map((s) => <li key={s.id} className="truncate">{s.subGuideName}</li>)}
            </ul>
          </details>
        ))}
        {blocks.length === 0 && <p className="text-caption text-muted-foreground">Aucune quête sur cette route.</p>}
      </div>
    </section>
  );
}

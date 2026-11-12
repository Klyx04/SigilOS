"use client";

/**
 * Onglet **Branches** — cockpit de la route (E2c, 12/11/2026).
 *
 * 🎯 Ce que l'écran remplace : la vue **lecture seule** de S4-1. Mesure du 12/11/2026 :
 * le panneau ne recevait que `view`, `classView` et `milestones` — donc **aucun geste**
 * n'était possible : il disait ce qui manquait sans pouvoir y aller. Ici, chaque
 * emplacement est un **bouton** :
 *   · une quête **s'ouvre** dans l'inspecteur de l'onglet Contenu (`onOpenQuest`) ;
 *   · un emplacement **vide** pré-remplit le formulaire de création avec la cité,
 *     l'Ordre, le palier et la classe du dit emplacement (`onCreateQuest`).
 *
 * 🛡️ Aucune règle métier n'est réécrite : la vue vient de `buildRushBranches` et
 * `buildRushClassBranches` (règles pures verrouillées), l'écriture passe par les actions
 * existantes du studio (`upsertRushSequence`). Le seul calcul local est un **index
 * quête → bloc**, nécessaire pour naviguer : le DTO de branche ne porte pas le bloc
 * d'accueil, et le deviner côté serveur aurait dupliqué la règle de sélection.
 */

import { useMemo } from "react";
import { AlertTriangle, ArrowUpRight, Plus } from "lucide-react";
import {
  countMissingOrderSlots,
  type RushBranchesView,
  type RushBranchOrder,
  type RushBranchSequence,
  type RushClassBranchesView,
} from "@/lib/rush-branches";
import { RushRoutePreview } from "@/components/god/rush-editor/panels/RushRoutePreview";
import type { RushMilestone } from "@/types/rush-guide-types";

/** Ce qu'un emplacement vide demande : le bloc d'accueil + la route à pré-remplir. */
export type RushQuestRouteTarget = {
  blockId: string;
  alignReq: string;
  alignOrderCode: string;
  alignLevelReq: string;
  classReq: string;
  /** Libellé du geste (« Disciple de Ménalt · Cœur Vaillant ») — pour le titre de l'aperçu. */
  label: string;
};

type BlockRef = { id: string; title: string };

/** Les blocs qui peuvent **accueillir** une quête : ni bandeau, ni bloc d'info. */
function isQuestHost(block: RushMilestone): boolean {
  return block.type !== "SEPARATEUR" && block.type !== "INFO";
}

export function RushBranchesCockpit({
  view, classView, milestones, onOpenQuest, onCreateQuest,
}: {
  view?: RushBranchesView;
  classView?: RushClassBranchesView;
  milestones: RushMilestone[];
  onOpenQuest: (blockId: string, questId: string) => void;
  onCreateQuest: (target: RushQuestRouteTarget) => void;
}) {
  /** Index quête → bloc d'accueil (le DTO de branche ne le porte pas). */
  const questBlock = useMemo(() => {
    const map = new Map<string, BlockRef>();
    for (const block of milestones) {
      for (const seq of block.sequences ?? []) map.set(seq.id, { id: block.id, title: block.title });
    }
    return map;
  }, [milestones]);

  const hostBlocks = useMemo(() => milestones.filter(isQuestHost), [milestones]);

  /** Premier bloc connu parmi ces séquences (un emplacement rempli sert de repère). */
  const blockFor = (sequences: RushBranchSequence[]): BlockRef | null => {
    for (const seq of sequences) {
      const hit = questBlock.get(seq.id);
      if (hit) return hit;
    }
    return null;
  };

  const ordreBlock = (camp: RushBranchesView["camps"][number], order: RushBranchOrder): BlockRef | null => {
    // ① une quête du même Ordre (un emplacement rempli) ② une quête du même camp ③ le 1ᵉʳ bloc
    const sameOrder = order.slots.flatMap((s) => s.sequences);
    const sameCamp = camp.orders.flatMap((o) => o.slots.flatMap((s) => s.sequences));
    return blockFor(sameOrder) ?? blockFor(sameCamp) ?? (hostBlocks[0] ?? null);
  };

  const classBlock = (): BlockRef | null => {
    if (classView) {
      for (const c of classView.classes) {
        const hit = blockFor(c.sequences);
        if (hit) return hit;
      }
    }
    return hostBlocks[0] ?? null;
  };

  if (!view) {
    return (
      <p className="px-4 py-8 text-sm text-muted-foreground">
        Vue Branches indisponible : le guide n&apos;a pas pu être chargé.
      </p>
    );
  }

  const missingSlots = countMissingOrderSlots(view);
  const orphans = view.orphans;
  const unlevelled = view.camps.flatMap((c) => c.orders.flatMap((o) => o.unlevelled));
  const unknownClasses = classView ? classView.unknown : [];
  const misplaced = classView ? classView.misplaced : [];
  const problems = orphans.length + unlevelled.length + unknownClasses.length + misplaced.length;

  const openQuest = (seq: RushBranchSequence) => {
    const hit = questBlock.get(seq.id);
    if (hit) onOpenQuest(hit.id, seq.id);
  };

  const createIn = (block: BlockRef | null, values: Omit<RushQuestRouteTarget, "blockId">) => {
    if (!block) return;
    onCreateQuest({ blockId: block.id, ...values });
  };

  return (
    <div className="space-y-6 px-3 py-4" data-rush-branches-cockpit>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">Route et embranchements</h2>
          <p className="text-caption text-muted-foreground">
            Chaque emplacement est un geste : une quête s&apos;ouvre, un vide se crée pré-rempli.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-caption">
          <span className="rounded-lg border border-border bg-surface px-2 py-1 tabular-nums text-muted-foreground">
            {view.camps.reduce((n, c) => n + c.present, 0)} quêtes de cité
          </span>
          <span className="rounded-lg border border-border bg-surface px-2 py-1 tabular-nums text-muted-foreground">
            {missingSlots} emplacement{missingSlots > 1 ? "s" : ""} d&apos;Ordre vide{missingSlots > 1 ? "s" : ""}
          </span>
          {classView && (
            <span className="rounded-lg border border-border bg-surface px-2 py-1 tabular-nums text-muted-foreground">
              classes {classView.present} / {classView.target}
            </span>
          )}
        </div>
      </header>

      <RushRoutePreview milestones={milestones} />

      {/* Étage 1 — les deux cités (cibles mesurées 100 / 102). */}
      <section className="grid gap-3 md:grid-cols-2" aria-label="Séries de cité">
        {view.camps.map((camp) => {
          const pct = Math.min(100, Math.round((camp.present / camp.target) * 100));
          const done = camp.missing === 0;
          return (
            <div key={camp.camp} className="rounded-xl border border-border bg-surface p-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={camp.camp === "bontarien" ? "/ordres/bonta.png" : "/ordres/brakmar.png"}
                    alt=""
                    aria-hidden="true"
                    className="h-6 w-6 object-contain"
                    loading="lazy"
                  />
                  <h3 className="text-sm font-semibold text-foreground">{camp.label}</h3>
                </div>
                <span className={`text-caption font-semibold tabular-nums ${done ? "text-success" : "text-warning"}`}>
                  {camp.present} / {camp.target}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${done ? "bg-success" : "bg-warning"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-caption text-muted-foreground">
                {done
                  ? `Série complète${camp.beyondMirror > 0 ? ` (${camp.beyondMirror} position(s) hors miroir)` : ""}.`
                  : `${camp.missing} quête(s) de cité manquante(s)`}
              </p>
            </div>
          );
        })}
      </section>

      {/* Étage 2 — 3 Ordres × 5 paliers, par cité. */}
      <section className="space-y-3" aria-label="Quêtes d'Ordre">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">Ordres — 3 par cité, 5 paliers</h2>
          <span className="text-caption text-muted-foreground">
            Cible 20 / 40 / 60 / 80 / 100 — le rang N exige le rang N−1 (calculé)
          </span>
        </header>
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {view.camps.map((camp) =>
            camp.orders.map((order) => {
              const provider = ordreBlock(camp, order);
              return (
                <div key={`${camp.camp}-${order.id}`} className="rounded-xl border border-border bg-surface p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={order.icon} alt="" aria-hidden="true" className="h-4 w-4 object-contain" loading="lazy" />
                      <h3 className="truncate text-xs font-semibold text-foreground">{order.name}</h3>
                    </div>
                    <span className={`shrink-0 text-caption tabular-nums ${order.missing === 0 ? "text-success" : "text-muted-foreground"}`}>
                      {order.slots.length - order.missing} / {order.slots.length}
                    </span>
                  </div>

                  <ul className="space-y-1">
                    {order.slots.map((slot) => (
                      <li key={slot.level} className="flex items-start gap-2 rounded-lg border border-border bg-elevated px-2 py-1.5">
                        <span className="w-7 shrink-0 pt-0.5 text-caption font-semibold tabular-nums text-muted-foreground">
                          {slot.level}
                        </span>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="truncate text-caption text-muted-foreground" title={slot.label}>{slot.label}</p>
                          {slot.sequences.length === 0 ? (
                            <button
                              type="button"
                              onClick={() => createIn(provider, {
                                alignReq: camp.camp,
                                alignOrderCode: order.id,
                                alignLevelReq: String(slot.level),
                                classReq: "",
                                label: `${slot.label} · ${order.name}`,
                              })}
                              disabled={!provider}
                              aria-label={`Créer la quête « ${slot.label} » de l'Ordre ${order.name} (${camp.label})`}
                              title={provider ? `Créer dans « ${provider.title} »` : "Aucun bloc d'accueil"}
                              className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-1.5 py-0.5 text-caption text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-40"
                            >
                              <Plus className="h-3 w-3" aria-hidden /> Créer
                            </button>
                          ) : (
                            slot.sequences.map((seq) => (
                              <button
                                key={seq.id}
                                type="button"
                                onClick={() => openQuest(seq)}
                                aria-label={`Ouvrir la quête ${seq.subGuideName}`}
                                title={questBlock.get(seq.id) ? `Bloc : ${questBlock.get(seq.id)?.title}` : undefined}
                                className="flex w-full items-center gap-1 truncate text-left text-xs text-foreground hover:underline"
                              >
                                <ArrowUpRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                                <span className="truncate">{seq.subGuideName}</span>
                              </button>
                            ))
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>

                  {order.unlevelled.length > 0 && (
                    <p className="text-caption text-warning">
                      {order.unlevelled.length} sans palier :{" "}
                      {order.unlevelled.map((s) => (
                        <button key={s.id} type="button" onClick={() => openQuest(s)} className="underline hover:text-foreground">
                          {s.subGuideName}
                        </button>
                      ))}
                    </p>
                  )}
                </div>
              );
            }),
          )}
        </div>
      </section>

      {/* Étage 3 — 19 classes, un emplacement par classe. */}
      <section className="space-y-3" aria-label="Quêtes de classe">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">Classes — 19 variantes</h2>
          <span className="text-caption text-muted-foreground">
            {classView ? `${classView.present} / ${classView.target} · ${classView.missing} manque(s)` : "vue indisponible"}
          </span>
        </header>
        {classView && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {classView.classes.map((c) => {
              const provider = classBlock();
              return (
                <div key={c.id} className="rounded-lg border border-border bg-surface p-2 space-y-1">
                  <div className="flex items-center gap-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.icon} alt="" aria-hidden="true" loading="lazy" className="h-4 w-4 object-contain" />
                    <span className="truncate text-caption font-semibold text-foreground">{c.name}</span>
                  </div>
                  {c.sequences.length === 0 ? (
                    <div className="space-y-1">
                      <p className="text-caption text-muted-foreground">— manque —</p>
                      <button
                        type="button"
                        onClick={() => createIn(provider, {
                          alignReq: "",
                          alignOrderCode: "",
                          alignLevelReq: "",
                          classReq: c.id,
                          label: `Quête de classe · ${c.name}`,
                        })}
                        disabled={!provider}
                        aria-label={`Créer la quête de classe ${c.name}`}
                        title={provider ? `Créer dans « ${provider.title} »` : "Aucun bloc d'accueil"}
                        className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-1.5 py-0.5 text-caption text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-40"
                      >
                        <Plus className="h-3 w-3" aria-hidden /> Créer
                      </button>
                    </div>
                  ) : (
                    c.sequences.map((seq) => (
                      <button
                        key={seq.id}
                        type="button"
                        onClick={() => openQuest(seq)}
                        aria-label={`Ouvrir la quête ${seq.subGuideName}`}
                        className="block w-full truncate text-left text-caption text-foreground hover:underline"
                      >
                        {seq.subGuideName}
                      </button>
                    ))
                  )}
                  {c.sequences.length > 1 && (
                    <p className="text-caption text-warning">{c.sequences.length} quêtes (doublon)</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Problèmes — nommés, cliquables, jamais rattachés d'office. */}
      {problems > 0 && (
        <section className="rounded-xl border border-warning/30 bg-warning/5 p-4 space-y-2" aria-label="Problèmes de route">
          <p className="flex items-center gap-2 text-caption font-semibold uppercase tracking-wide text-warning">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> {problems} problème{problems > 1 ? "s" : ""} de route
          </p>
          {orphans.length > 0 && (
            <p className="text-caption text-muted-foreground">
              Cité ou Ordre non reconnu :{" "}
              {orphans.slice(0, 12).map((s) => (
                <button key={s.id} type="button" onClick={() => openQuest(s)} className="underline hover:text-foreground">
                  {s.subGuideName}
                </button>
              ))}
            </p>
          )}
          {unlevelled.length > 0 && (
            <p className="text-caption text-muted-foreground">
              Quête d&apos;Ordre sans palier (la chaîne des rangs est cassée) :{" "}
              {unlevelled.slice(0, 12).map((s) => (
                <button key={s.id} type="button" onClick={() => openQuest(s)} className="underline hover:text-foreground">
                  {s.subGuideName}
                </button>
              ))}
            </p>
          )}
          {unknownClasses.length > 0 && (
            <p className="text-caption text-muted-foreground">
              Classe inconnue (masquée par la route) :{" "}
              {unknownClasses.slice(0, 12).map((s) => (
                <button key={s.id} type="button" onClick={() => openQuest(s)} className="underline hover:text-foreground">
                  {s.subGuideName} ({s.classReq})
                </button>
              ))}
            </p>
          )}
          {misplaced.length > 0 && (
            <p className="text-caption text-muted-foreground">
              Quête de classe portant aussi une cité/un Ordre :{" "}
              {misplaced.slice(0, 12).map((s) => (
                <button key={s.id} type="button" onClick={() => openQuest(s)} className="underline hover:text-foreground">
                  {s.subGuideName}
                </button>
              ))}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

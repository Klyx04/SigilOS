"use client";

import React from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ClipboardList, Hammer } from "lucide-react";
import { useDaTheme } from "@/components/da/da-theme";
import { daScopeProps } from "@/lib/da-scope";
import { RUSH_PENSE_BETE, type RushPenseBeteSection } from "@/data/rush-sylvestre-pense-bete";

interface RushPenseBeteModalProps {
  open: boolean;
  onClose: () => void;
  /** Sections du pense-bête — fournies par la config GOD. Fallback sur la valeur statique. */
  sections?: RushPenseBeteSection[];
  /** Clé de persistance par guide — gardée pour compat (contenu édité côté GOD). */
  storageKey?: string;
}

/**
 * 📋 Pense-bête du Rush — liste **en lecture seule** les « choses à savoir / à
 * préparer » en amont (métiers, prépa stuffs, captures, déplacement…).
 * Le contenu est édité côté GOD (onglet « Lancement »). Aucune interaction user.
 *
 * DA « Gouache Wakfu » (05/11/2026) : la modale était la seule du Rush encore
 * peinte **en dur** (`bg-zinc-950`, `#e6b96b`, `amber-500`, `rounded-3xl`) — donc
 * ni thémée, ni réversible. Elle ne garde que des jetons sémantiques : la
 * passerelle `[data-da].da-portal` les fait pointer sur `--da-*` dans le Rush, et
 * ils restent neutres partout ailleurs. L'ambre d'exigence passe par `--warning`,
 * que la DA remappe sur `--da-amber-ink` (sémantique fixe, cf. skill).
 */
export function RushPenseBeteModal({ open, onClose, sections }: RushPenseBeteModalProps) {
  const list = sections ?? RUSH_PENSE_BETE;
  const daScope = daScopeProps(useDaTheme());

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        {...daScope}
        overlayClassName="da-modal-scrim"
        className="da-modal da-portal max-w-2xl w-[94vw] max-h-[86vh] gap-0 p-0"
      >
        {/* Header */}
        <div className="da-modal-head">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-[6px] border border-warning/30 bg-warning/10">
              <ClipboardList className="size-5 text-warning" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="da-modal-title">Pense-bête</DialogTitle>
              <p className="da-modal-sub mt-0.5">
                Les choses à savoir / à préparer en amont pour le Rush Sylvestre.
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="da-modal-body custom-scrollbar">
          {list.map((section) => (
            <div key={section.id} className="mt-5 first:mt-0">
              <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-warning">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-warning/70" />
                {section.title}
              </h3>

              <div className="space-y-1.5">
                {section.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex w-full items-start gap-3 rounded-[6px] border border-border bg-surface px-3 py-2.5 text-left"
                  >
                    {/* Puce */}
                    <span aria-hidden="true" className="mt-1 size-1.5 shrink-0 rounded-full bg-warning/80" />

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold leading-tight text-foreground">
                        {item.label}
                      </span>
                      {item.detail && (
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">{item.detail}</span>
                      )}

                      {/* Métiers requis (chips) */}
                      {item.metiers && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {item.metiers.map((m) => (
                            <span
                              key={m}
                              className="inline-flex items-center rounded-[4px] border border-border bg-elevated px-1.5 py-0.5 text-[10px] font-bold text-foreground/90"
                            >
                              <Hammer className="mr-1 size-3 text-warning/80" aria-hidden="true" />
                              {m}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Alternative */}
                      {item.alternative && (
                        <div className="mt-1.5 flex items-start gap-1.5 text-[10px] text-muted-foreground">
                          <span className="shrink-0 font-bold uppercase tracking-wide">Alternative</span>
                          <span className="flex flex-wrap gap-1">
                            {item.alternative.map((m) => (
                              <span
                                key={m}
                                className="inline-flex items-center rounded-[4px] border border-border/60 px-1.5 py-0.5"
                              >
                                {m}
                              </span>
                            ))}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

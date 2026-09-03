"use client";

import React from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ClipboardList, Hammer } from "lucide-react";
import { RUSH_PENSE_BETE } from "@/data/rush-sylvestre-pense-bete";

interface RushPenseBeteModalProps {
  open: boolean;
  onClose: () => void;
  /** Clé de persistance par guide — gardée pour compat (contenu édité côté GOD). */
  storageKey?: string;
}

/**
 * 📋 Pense-bête du Rush — liste **en lecture seule** les « choses à savoir / à
 * préparer » en amont (métiers, prépa stuffs, captures, déplacement…).
 * Le contenu est édité côté GOD (onglet « Lancement »). Aucune interaction user.
 */
export function RushPenseBeteModal({ open, onClose }: RushPenseBeteModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl w-[94vw] max-h-[86vh] flex flex-col bg-zinc-950 border-zinc-800 rounded-3xl p-0 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <ClipboardList className="w-5 h-5 text-[#e6b96b]" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-black uppercase tracking-[0.14em] text-white flex items-center gap-2">
                Pense-bête
              </DialogTitle>
              <p className="text-caption text-zinc-400 font-medium">
                Les choses à savoir / à préparer en amont pour le Rush Sylvestre.
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 custom-scrollbar">
          {RUSH_PENSE_BETE.map((section) => (
            <div key={section.id} className="mt-5">
              <h3 className="text-[10px] font-black uppercase tracking-[0.16em] text-[#e6b96b] mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#e6b96b]/70" />
                {section.title}
              </h3>

              <div className="space-y-1.5">
                {section.items.map((item) => (
                  <div
                    key={item.id}
                    className="w-full flex items-start gap-3 text-left px-3 py-2.5 rounded-xl border border-white/10 bg-[#121821]"
                  >
                    {/* Puce */}
                    <span className="mt-1 shrink-0 w-[6px] h-[6px] rounded-full bg-[#e6b96b]/80" />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <span className="block text-[13px] font-semibold leading-tight text-zinc-100">
                        {item.label}
                      </span>
                      {item.detail && (
                        <span className="block text-[11px] text-zinc-400 mt-0.5">{item.detail}</span>
                      )}

                      {/* Métiers requis (chips) */}
                      {item.metiers && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {item.metiers.map((m) => (
                            <span
                              key={m}
                              className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-[#1c2129] border border-white/10 text-zinc-300"
                            >
                              <Hammer className="w-3 h-3 mr-1 text-[#e6b96b]/70" />
                              {m}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Alternative */}
                      {item.alternative && (
                        <div className="flex items-start gap-1.5 mt-1.5 text-[10px] text-zinc-500">
                          <span className="font-bold uppercase tracking-wide shrink-0">Alternative</span>
                          <span className="flex flex-wrap gap-1">
                            {item.alternative.map((m) => (
                              <span
                                key={m}
                                className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-white/5 border border-white/5 text-zinc-400"
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

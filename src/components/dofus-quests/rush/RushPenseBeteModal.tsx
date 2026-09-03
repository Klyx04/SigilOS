"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { ClipboardList, Check, X } from "lucide-react";
import { RUSH_PENSE_BETE } from "@/data/rush-sylvestre-pense-bete";
import { cn } from "@/lib/utils";

interface RushPenseBeteModalProps {
  open: boolean;
  onClose: () => void;
  /** Clé de persistance par guide (ex: `rush-sylvestre-pense-bete`). */
  storageKey?: string;
}

/**
 * 📋 Pense-bête du Rush — liste les « choses à savoir / à préparer » en amont.
 * Cases à cocher persistées en localStorage (par guide). Reprend la colonne
 * « À PRÉPARER » de la feuille Google (métiers / prépa stuffs / captures…).
 */
export function RushPenseBeteModal({
  open,
  onClose,
  storageKey = "rush-sylvestre-pense-bete",
}: RushPenseBeteModalProps) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  // Chargement + écoute des changements inter-onglets (localStorage).
  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem(storageKey);
        setChecked(raw ? (JSON.parse(raw) as Record<string, boolean>) : {});
      } catch {
        setChecked({});
      }
    };
    load();
    window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, [storageKey]);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* quota / privacy — on ignore */
      }
      return next;
    });
  };

  const totalItems = RUSH_PENSE_BETE.flatMap((s) => s.items).length;
  const doneCount = RUSH_PENSE_BETE.flatMap((s) => s.items).filter((i) => checked[i.id]).length;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl w-[94vw] max-h-[86vh] flex flex-col bg-zinc-950 border-zinc-800 rounded-3xl p-0 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-white/5 shrink-0">
          <div className="flex items-start justify-between gap-3">
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
            <DialogClose
              aria-label="Fermer"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </DialogClose>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2 mt-4">
            <div className="flex-1 h-1.5 rounded-full bg-zinc-800/80 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#d5a94e] to-[#e6c16f] transition-all duration-300"
                style={{ width: totalItems > 0 ? `${Math.round((doneCount / totalItems) * 100)}%` : "0%" }}
              />
            </div>
            <span className="text-[10px] font-mono tabular-nums font-bold text-zinc-400">
              {doneCount} / {totalItems}
            </span>
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
                {section.items.map((item) => {
                  const isDone = !!checked[item.id];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggle(item.id)}
                      className={cn(
                        "w-full flex items-start gap-3 text-left px-3 py-2.5 rounded-xl border transition-all",
                        isDone
                          ? "border-[#56d4ad]/30 bg-[#56d4ad]/5"
                          : "border-white/10 bg-[#121821] hover:border-[#e6b96b]/40 hover:bg-[#161d27]"
                      )}
                    >
                      {/* Checkbox */}
                      <span
                        className={cn(
                          "mt-0.5 shrink-0 w-[18px] h-[18px] rounded-md border flex items-center justify-center transition-all",
                          isDone
                            ? "bg-[#56d4ad] border-[#56d4ad] text-[#07120d]"
                            : "border-zinc-600 text-transparent"
                        )}
                      >
                        <Check className="w-3 h-3" strokeWidth={3} />
                      </span>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <span
                          className={cn(
                            "block text-[13px] font-semibold leading-tight",
                            isDone ? "text-zinc-400 line-through decoration-[#56d4ad]/40" : "text-zinc-100"
                          )}
                        >
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
                                <HammerIcon />
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
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Petite icône métier (marteau) — inline pour éviter un import lourd. */
function HammerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3 h-3 mr-1 text-[#e6b96b]/70" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9" />
      <path d="m18 15 4-4" />
      <path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5" />
    </svg>
  );
}


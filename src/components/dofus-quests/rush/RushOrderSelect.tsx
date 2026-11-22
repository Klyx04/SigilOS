"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RushOrderOption } from "@/lib/rush-alignment-filter";

/**
 * Selecteur « Mon ordre » — bouton + liste avec les ICONES des Ordres.
 *
 * Un `<select>` natif ne peut pas afficher d image : ce composant le remplace sur les
 * trois surfaces (interne, public, overlay). « Tous » retire le filtre d Ordre.
 */
export function RushOrderSelect({
  options,
  value,
  onChange,
  className,
}: {
  options: RushOrderOption[];
  value: string | null;
  onChange: (orderId: string | null) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (options.length === 0) return null;
  const selected = options.find((o) => o.id === value) ?? null;

  return (
    <div ref={ref} className={cn("relative inline-flex items-center gap-1.5 text-[11px] text-muted-foreground", className)}>
      <span>Mon ordre</span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-[4px] border border-border bg-surface px-1.5 py-0.5 text-[11px] text-foreground transition-colors hover:border-border-strong"
      >
        {selected?.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={selected.icon} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" />
        ) : null}
        <span className="max-w-[11rem] truncate">{selected?.name ?? "Tous"}</span>
        <ChevronDown className="h-3 w-3 shrink-0" aria-hidden="true" />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Choisir mon Ordre"
          className="absolute left-0 top-full z-50 mt-1 w-60 rounded-[6px] border border-border-strong bg-elevated p-1"
        >
          <li>
            <button
              type="button"
              role="option"
              aria-selected={value === null}
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-[4px] px-1.5 py-1 text-left text-[11px] text-foreground transition-colors hover:bg-surface"
            >
              <span className="grid h-3.5 w-3.5 shrink-0 place-items-center">
                {value === null ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
              </span>
              Tous
            </button>
          </li>
          {options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                role="option"
                aria-selected={value === option.id}
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-[4px] px-1.5 py-1 text-left text-[11px] text-foreground transition-colors hover:bg-surface"
              >
                <span className="grid h-3.5 w-3.5 shrink-0 place-items-center">
                  {value === option.id ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
                </span>
                {option.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={option.icon} alt="" className="h-4 w-4 shrink-0 object-contain" />
                ) : null}
                <span className="min-w-0 truncate">{option.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
"use client";

/**
 * Menu déroulant des filtres publics — **une seule implémentation** pour toutes les surfaces
 * (catalogue `/boss`, filtre « familles » des monstres…).
 *
 * Remplace un `<select>` natif, dont le panneau est celui du système d'exploitation : il jurait
 * avec le registre « landing » (constat user du 11/10/2026 : « les filtres et ces dropdown sont
 * inaméliorables niveau UI/UX landing actuel »). Ici, le panneau est rendu par le design system
 * (tokens `border` / `surface` / `elevated`), se ferme au clic extérieur et à `Échap`, et sait
 * défiler une longue liste (familles de monstres).
 */
import { Fragment, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterDropdownOption {
    value: string;
    label: string;
    /**
     * Asset **local** du dépôt (picto officiel du jeu) affiché dans l'entrée et dans le
     * déclencheur quand l'option est sélectionnée. `null`/absent = entrée sans picto.
     * Les sprites de monstres passent par le proxy d'assets (`/api/assets-dofus/...`).
     */
    icon?: string | null;
    /**
     * Regroupement d'affichage (`super-famille`…) : un intitulé est rendu **une fois** avant
     * la première option du groupe. `null`/absent = option sans groupe (ex. « Toutes »).
     */
    group?: string | null;
}

export function FilterDropdown({
    value,
    onChange,
    options,
    ariaLabel,
    align = "left",
}: {
    value: string;
    onChange: (value: string) => void;
    options: FilterDropdownOption[];
    ariaLabel: string;
    align?: "left" | "right";
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

    const current = options.find((o) => o.value === value);

    /** Picto d'une entrée : asset du dépôt ou sprite par le proxy (jamais de 404 affiché). */
    const optionIcon = (icon?: string | null) =>
        icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={icon}
                alt=""
                className="h-4 w-4 shrink-0 object-contain"
                loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }}
            />
        ) : null;

    return (
        <div ref={ref} className="relative shrink-0">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={ariaLabel}
                className="inline-flex h-10 w-full items-center justify-between gap-2.5 rounded-xl border border-border bg-background/60 pl-3.5 pr-3 text-xs font-bold text-foreground transition-colors hover:border-border-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto cursor-pointer"
            >
                <span className="flex min-w-0 items-center gap-2">
                    {optionIcon(current?.icon)}
                    <span className="max-w-[14rem] truncate">{current?.label ?? ariaLabel}</span>
                </span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
            </button>
            {open && (
                <div
                    role="listbox"
                    aria-label={ariaLabel}
                    className={cn(
                        "absolute z-50 mt-2 max-h-72 min-w-full w-max max-w-[280px] overflow-y-auto rounded-xl border border-border-strong bg-elevated p-1 shadow-2xl",
                        align === "right" ? "right-0" : "left-0"
                    )}
                >
                    {options.map((o, index) => {
                        const showGroup = !!o.group && o.group !== options[index - 1]?.group;
                        return (
                            <Fragment key={o.value}>
                                {showGroup ? (
                                    <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                        {o.group}
                                    </p>
                                ) : null}
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={o.value === value}
                                    onClick={() => {
                                        onChange(o.value);
                                        setOpen(false);
                                    }}
                                    className={cn(
                                        "flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold whitespace-nowrap transition-colors",
                                        o.value === value
                                            ? "bg-foreground/10 text-foreground"
                                            : "text-muted-foreground hover:bg-surface hover:text-foreground"
                                    )}
                                >
                                    {optionIcon(o.icon)}
                                    <span className="truncate">{o.label}</span>
                                </button>
                            </Fragment>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

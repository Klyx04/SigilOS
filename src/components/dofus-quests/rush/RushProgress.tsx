"use client";

import React from "react";
import { formatProgressLabel } from "@/lib/rush-guide-utils";
import { cn } from "@/lib/utils";

interface RushProgressProps {
  value: number;
  total: number;
  unit?: "étapes" | "quêtes" | "jalons" | "blocs";
  label?: string;
  className?: string;
  showPercent?: boolean;
}

export function RushProgress({
  value,
  total,
  unit = "étapes",
  label,
  className,
  showPercent = true,
}: RushProgressProps) {
  const percentage = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const progressText = formatProgressLabel(value, total, unit);

  return (
    <div className={cn("flex flex-col gap-1.5 w-full", className)}>
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span className="font-semibold text-zinc-300">
          {label ? `${label} : ` : ""}
          <span className="text-zinc-200">{progressText}</span>
        </span>
        {showPercent && (
          <span className="font-mono font-bold text-emerald-400">{percentage}%</span>
        )}
      </div>
      <div className="w-full h-2 rounded-full bg-zinc-800/80 overflow-hidden border border-white/5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

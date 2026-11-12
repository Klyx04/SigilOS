"use client";

import { useState } from "react";

import { GameIcon } from "@/components/shared/game-icon";
import { safeImageUrl } from "@/lib/security";
import { cn } from "@/lib/utils";

/**
 * Portrait d'un monstre ou d'un donjon — **asset réel** (local ou proxifié), avec un
 * repli d'erreur Dofus (`question-mark`) et `alt` porté par le nom voisin.
 */
export function RushPortrait({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const safe = safeImageUrl(src ?? "");
  if (!safe || failed) {
    return (
      <GameIcon
        src="/assets/dofus/game-icons/question-mark.png"
        className={cn("h-8 w-8 shrink-0 opacity-70", className)}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={safe}
      alt={alt ?? ""}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("h-8 w-8 shrink-0 object-contain", className)}
    />
  );
}
"use client";

import { useEffect, useState } from "react";
import { resolveItemImage, getItemImageFallback } from "@/lib/rush-guide-utils";

interface ResourceImageProps {
  id?: string | number | null;
  imageUrl?: string | null;
  alt?: string;
  className?: string;
  loading?: "lazy" | "eager";
}

/**
 * Image d'item LOCAL-FIRST (autonome) :
 * - Sert le WebP siphonné localement en STATIQUE (`/uploads/assets-dofus/items/{id}.webp`)
 *   → 0 appel proxy, 0 dépendance externe DofusDB.
 * - Si le fichier local est absent, bascule en `onError` sur le proxy
 *   `/api/assets-dofus/items/{id}` qui siphonne à la volée depuis DofusDB
 *   (auto-healing + placeholder, jamais de 404 rouge).
 */
export function ResourceImage({
  id,
  imageUrl,
  alt = "",
  className,
  loading = "lazy",
}: ResourceImageProps) {
  const primary = resolveItemImage(id, imageUrl);
  const fallback = getItemImageFallback(id, imageUrl);
  const [src, setSrc] = useState(primary);

  // Resynchronise si la source primaire change (id / imageUrl).
  useEffect(() => {
    setSrc(primary);
  }, [primary]);

  // Une `<img src="">` fait avertir React (« le navigateur peut re-télécharger
  // toute la page ») et n'apporte rien : quand aucune source n'est résolue, on ne
  // rend RIEN — la plaque d'icône garde son fond. C'était la source de 14 erreurs
  // console sur la page publique du guide.
  if (!src) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={loading}
      className={className}
      onError={() => {
        if (fallback && src !== fallback) setSrc(fallback);
      }}
    />
  );
}

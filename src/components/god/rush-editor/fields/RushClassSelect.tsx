"use client";

/**
 * Sélecteur de **classe** du guide Rush — champ **partagé**.
 *
 * 🎯 Extrait du studio en E2 (`REFONTE-EDITEUR-RUSH.md` §3) : une seule écriture du
 * `<select>` des 19 classes, donc l'aperçu de route et les formulaires ne peuvent plus
 * diverger. Une valeur **inconnue** (ancien id `osa`, libellé « Féca ») reste visible et
 * **nommée** : la route la masque (fail-closed) et l'écran Branches la signale — on ne la
 * fond jamais dans « Aucune », sinon l'auteur croit avoir corrigé la donnée.
 */

import { DOFUS_CLASSES } from "@/lib/dofus-assets";

export function RushClassSelect({
  id, value, onChange, className, disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  const known = DOFUS_CLASSES.some((c) => c.id === value);
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={className ?? "w-full bg-background/80 border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none disabled:opacity-40"}
    >
      <option value="">— Aucune —</option>
      {DOFUS_CLASSES.map((c) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
      {value && !known && <option value={value}>Valeur inconnue : {value}</option>}
    </select>
  );
}

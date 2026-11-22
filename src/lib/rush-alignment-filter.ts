/**
 * Filtre d alignement des blocs — SOURCE UNIQUE des trois surfaces (interne, public, overlay).
 *
 * Regles :
 *  - on garde le camp du joueur et le tronc commun ; SI le filtre viderait le bloc (bloc
 *    entierement dedie a l autre camp), on rend la liste d origine : jamais un bloc vide ;
 *  - l Ordre se reconnait par le NOM de la serie (normalise) ou par le CODE normalise —
 *    les deux formats coexistent en base ; un Ordre sans correspondance ne vide rien.
 */
import { ORDERS } from "@/lib/dofus-assets";
import { normalizeAlignmentCamp, type RushAlignmentCamp } from "@/lib/rush-route";
import { normalizeOrderCode } from "@/lib/rush-order-codes";
import type { RushAlignmentSeriesMap } from "@/lib/rush-alignment-series";

export type RushOrderOption = { id: string; name: string; icon?: string | null };
export type RushAlignmentProfile = { camp: RushAlignmentCamp | null; orderId?: string | null };

/** Ordres du camp, avec leur icone (catalogue partage). */
export function orderOptionsFor(camp: RushAlignmentCamp | null | undefined): RushOrderOption[] {
  if (!camp) return [];
  const list = (ORDERS as unknown as Record<string, RushOrderOption[]>)[camp] ?? [];
  return list.map((o) => ({ id: o.id, name: o.name, icon: o.icon ?? null }));
}

/** Nom d Ordre normalise (« Ordre du Coeur Saignant » -> « coeur saignant »). */
export function normalizeOrderLabel(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^ordre\s+(?:du\s+|de\s+la\s+|des\s+|de\s+|d[\u2019\u0027])?/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Cle d Ordre utilisable : absente du catalogue du camp = ignoree. */
export function resolveOrderKey(
  orderKey: string | null | undefined,
  options: RushOrderOption[]
): string | null {
  return orderKey && options.some((o) => o.id === orderKey) ? orderKey : null;
}

export function filterAlignmentSequences<
  T extends { id: string; alignReq?: string | null; alignOrderCode?: string | null },
>(
  sequences: readonly T[],
  series: RushAlignmentSeriesMap,
  profile: RushAlignmentProfile,
  orderKey?: string | null
): T[] {
  const campFiltered = sequences.filter((seq) => {
    if (!profile.camp) return true;
    const camp = seq.alignReq ? normalizeAlignmentCamp(seq.alignReq) : null;
    return camp === null || camp === profile.camp;
  });
  const campSafe = campFiltered.length > 0 ? campFiltered : [...sequences];

  const key = resolveOrderKey(orderKey, orderOptionsFor(profile.camp));
  if (!key) return campSafe;
  const selected = orderOptionsFor(profile.camp).find((o) => o.id === key) ?? null;
  if (!selected) return campSafe;

  const want = normalizeOrderLabel(selected.name);
  const wantCode = normalizeOrderCode(selected.id);
  const matched = campSafe.filter((seq) => {
    const entry = series.get(seq.id);
    if (!entry || entry.kind !== "ordre") return true;
    return (
      normalizeOrderLabel(entry.orderName) === want ||
      (!!seq.alignOrderCode && normalizeOrderCode(seq.alignOrderCode) === wantCode)
    );
  });
  return matched.length > 0 ? matched : campSafe;
}
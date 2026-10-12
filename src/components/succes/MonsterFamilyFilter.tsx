"use client";

/**
 * 2ᵉ niveau de filtre des monstres normaux : les **familles** (races) réellement présentes,
 * avec leur poids et le **sprite officiel** du jeu comme picto.
 *
 * 🎯 Demandes user (11/10/2026) : « un vrai 2ᵉ niveau de filtre intelligemment pour les
 * monstres normaux : quête, alignement, etc. tout ce qui est dispo, avec de vrais assets » ;
 * « les filtres et ces dropdown sont inaméliorables niveau UI/UX landing actuel » (1ᵉʳ jet à
 * `<select>` natif : panneau du système d'exploitation) ; puis « supprime les 1ᵉʳ filtres à
 * l'intérieur, garde le dropdown » et « affiche des assets dans le dropdown de filtre ».
 *
 * ⇒ **Un seul `FilterDropdown`** (design system, jamais un `<select>`), chaque entrée portant
 * le sprite réel d'un monstre de la famille (proxy d'assets, chargé à l'ouverture du panneau)
 * et regroupée par **super-famille officielle** (« Créatures de quête », « Créatures
 * Archimonstres », « Créatures des raids »…).
 *
 * Ce qui existe réellement dans les données locales le permet sans rien inventer : le
 * référentiel `monster-races.json` (264 races + 35 super-races, siphon DofusDB) couvre **toutes**
 * les races du bestiaire — les deux familles les plus peuplées sont « Monstres de quête »
 * (2 274) et « Monstres de quête d'alignement » (341), puis Archimonstres, Invocations de
 * monstre, Blops, Kwaks, Tofus… Aucune catégorie n'est fabriquée ; une race sans libellé réel
 * n'est pas proposée (les monstres concernés restent trouvables par la recherche et le niveau).
 */
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getNormalMonsterFamilies } from "@/server/actions/game-data-actions";
import type { MonsterFamilyFacet } from "@/lib/monster-fiche";
import { monsterSpriteUrl } from "@/lib/monster-fiche";
import { FilterDropdown } from "@/components/ui/filter-dropdown";

export function MonsterFamilyFilter({
    value,
    onChange,
    locale = "fr",
    className = "",
}: {
    /** `raceId` sélectionné, `null` = toutes les familles. */
    value: number | null;
    onChange: (familyId: number | null) => void;
    locale?: "fr" | "en";
    className?: string;
}) {
    const fr = locale !== "en";
    const [families, setFamilies] = useState<MonsterFamilyFacet[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        getNormalMonsterFamilies()
            .then((res) => {
                if (!cancelled && res.success && Array.isArray(res.data)) setFamilies(res.data);
            })
            .catch(() => {})
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    // Réserve la place pendant le chargement : aucun saut de mise en page.
    if (loading && families.length === 0) return <div className={cn("h-9", className)} aria-hidden />;
    if (families.length === 0) return null;

    // Menu déroulant : **toutes** les familles, regroupées par super-famille officielle
    // (« Créatures de quête », « Créatures Archimonstres », « Créatures des raids »…) puis par
    // poids décroissant. Chaque entrée porte le **sprite officiel** d'un monstre de la famille
    // (proxy d'assets, chargé à l'ouverture du panneau).
    const grouped = [...families].sort(
        (a, b) =>
            String(a.superRaceName ?? "").localeCompare(String(b.superRaceName ?? ""), "fr") ||
            b.count - a.count ||
            a.name.localeCompare(b.name, "fr")
    );

    return (
        <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
            <FilterDropdown
                value={value !== null ? String(value) : ""}
                onChange={(next) => onChange(next === "" ? null : Number(next))}
                ariaLabel={fr ? "Toutes les familles" : "All families"}
                options={[
                    {
                        value: "",
                        label: fr ? `Toutes les familles (${families.length})` : `All families (${families.length})`,
                    },
                    ...grouped.map((family) => ({
                        value: String(family.raceId),
                        label: `${family.name} — ${family.count}`,
                        icon: monsterSpriteUrl(family.sampleMonsterId),
                        group: family.superRaceName ?? (fr ? "Autres créatures" : "Other creatures"),
                    })),
                ]}
            />
        </div>
    );
}

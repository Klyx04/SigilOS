/**
 * Quêtes de **classe** du guide Rush — mapping **questDbId DofusDB → id de classe**.
 *
 * Source : export God / Tougli (`export-god-classes.json`, 19 branches). La base locale
 * portait un défaut mesuré le 05/11/2026 : les **19** séquences avaient toutes
 * `classReq = "cra"` (l'import avait recopié la classe de la première). Cette table est
 * la source stable utilisée par le split d'un bloc de classe ; elle ne dépend d'aucune
 * donnée de session et ne doit jamais être déduite du nom de la quête.
 */
export const RUSH_CLASS_QUESTS: Readonly<Record<number, string>> = {
    1963: "feca",
    1964: "osamodas",
    1965: "enutrof",
    1966: "sram",
    1967: "xelor",
    1968: "ecaflip",
    1969: "eniripsa",
    1970: "iop",
    1971: "cra",
    1972: "sadida",
    1973: "sacrieur",
    1974: "pandawa",
    704: "roublard",
    716: "zobal",
    938: "steamer",
    1615: "eliotrope",
    1677: "huppermage",
    1841: "ouginak",
    2470: "forgelance",
};

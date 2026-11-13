/**
 * Classification et calcul des **effets de sort Dofus** pour la simulation tactique.
 *
 * Module PUR (aucun IO, aucun React) : utilisable côté client ET côté serveur.
 *
 * Ce module parse les libellés d'effets (`effectDetails[].label`) pour détecter et typer
 * les effets qui ont un impact visuel sur la grille tactique :
 *
 * ── Effets positionnels ───────────────────────────────────────────────────────
 *   push        Repousse N cases (direction caster→cible, s'arrête aux obstacles)
 *   pull        Attire N cases (direction cible→caster, s'arrête aux obstacles)
 *   tp_caster   Téléporte la cible sur la case du lanceur
 *   tp_target   Téléporte le lanceur sur la case de la cible
 *   swap        Échange de place caster ↔ cible
 *   tp_random   Téléportation aléatoire (case inconnue — affichage spécial « ? »)
 *   tp_cell     Téléporte sur la case visée (sort de type Mot d'Arak, Mot de Fuite…)
 *
 * ── États / conditions ───────────────────────────────────────────────────────
 *   gravity     Pesanteur (empêche les déplacements non-marchés, annule tp/push)
 *   stasis      Stase (maintien en place)
 *   muddy       Empêche les déplacements
 *   state       État générique (durée connue ou non)
 *
 * ── Altérations de caractéristiques ─────────────────────────────────────────
 *   ap_loss     Retrait de PA
 *   mp_loss     Retrait de PM
 *   ap_gain     Gain de PA
 *   mp_gain     Gain de PM
 *   range_loss  Retrait de PO
 *   range_gain  Gain de PO
 *   res_loss    Retrait de résistances (élément ou général)
 *   res_gain    Gain de résistances
 *
 * ── Soins / Invocations ──────────────────────────────────────────────────────
 *   heal        Soin (HP)
 *   shield      Bouclier (armure)
 *   invoc       Invocation
 *
 * ── Autre ───────────────────────────────────────────────────────────────────
 *   unknown     Effet non reconnu par les patterns actuels
 *
 * Règle : on **détecte**, on n'invente pas. Si un libellé ne correspond à aucun pattern,
 * l'effet est classé `unknown` et son libellé brut est conservé.
 */

import { cleanDofusText } from "@/lib/dofus-spells";
import { computePushDestination, type DofusPos, CellState } from "@/lib/dofus-grid";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SpellEffectKind =
    | "push"
    | "pull"
    | "tp_caster"
    | "tp_target"
    | "swap"
    | "tp_random"
    | "tp_cell"
    | "tp_symmetric"
    | "glyph"
    | "trap"
    | "gravity"
    | "stasis"
    | "muddy"
    | "state"
    | "ap_loss"
    | "mp_loss"
    | "ap_gain"
    | "mp_gain"
    | "range_loss"
    | "range_gain"
    | "res_loss"
    | "res_gain"
    | "heal"
    | "shield"
    | "invoc"
    | "unknown";

/** Couleur d'affichage par famille d'effet (badge SVG). */
export const EFFECT_KIND_COLOR: Record<SpellEffectKind, { bg: string; text: string; border: string }> = {
    push:       { bg: "rgba(251,191,36,0.18)",  text: "#fde68a", border: "#fbbf24" },
    pull:       { bg: "rgba(96,165,250,0.18)",   text: "#bfdbfe", border: "#60a5fa" },
    tp_caster:  { bg: "rgba(167,139,250,0.2)",   text: "#ddd6fe", border: "#a78bfa" },
    tp_target:  { bg: "rgba(167,139,250,0.2)",   text: "#ddd6fe", border: "#a78bfa" },
    swap:       { bg: "rgba(52,211,153,0.18)",   text: "#a7f3d0", border: "#34d399" },
    tp_random:  { bg: "rgba(156,163,175,0.18)",  text: "#e5e7eb", border: "#9ca3af" },
    tp_cell:    { bg: "rgba(167,139,250,0.2)",   text: "#ddd6fe", border: "#a78bfa" },
    tp_symmetric: { bg: "rgba(167,139,250,0.2)", text: "#ddd6fe", border: "#a78bfa" },
    gravity:    { bg: "rgba(239,68,68,0.18)",    text: "#fca5a5", border: "#ef4444" },
    glyph:      { bg: "rgba(45,212,191,0.18)",   text: "#99f6e4", border: "#2dd4bf" },
    trap:       { bg: "rgba(244,114,182,0.18)",  text: "#fbcfe8", border: "#f472b6" },
    stasis:     { bg: "rgba(239,68,68,0.15)",    text: "#fca5a5", border: "#f87171" },
    muddy:      { bg: "rgba(180,83,9,0.2)",      text: "#fcd34d", border: "#d97706" },
    state:      { bg: "rgba(139,92,246,0.15)",   text: "#c4b5fd", border: "#8b5cf6" },
    ap_loss:    { bg: "rgba(239,68,68,0.15)",    text: "#fca5a5", border: "#ef4444" },
    mp_loss:    { bg: "rgba(239,68,68,0.15)",    text: "#fca5a5", border: "#ef4444" },
    ap_gain:    { bg: "rgba(52,211,153,0.15)",   text: "#6ee7b7", border: "#10b981" },
    mp_gain:    { bg: "rgba(52,211,153,0.15)",   text: "#6ee7b7", border: "#10b981" },
    range_loss: { bg: "rgba(239,68,68,0.15)",    text: "#fca5a5", border: "#ef4444" },
    range_gain: { bg: "rgba(52,211,153,0.15)",   text: "#6ee7b7", border: "#10b981" },
    res_loss:   { bg: "rgba(239,68,68,0.15)",    text: "#fca5a5", border: "#ef4444" },
    res_gain:   { bg: "rgba(52,211,153,0.15)",   text: "#6ee7b7", border: "#10b981" },
    heal:       { bg: "rgba(52,211,153,0.18)",   text: "#6ee7b7", border: "#34d399" },
    shield:     { bg: "rgba(148,163,184,0.18)",  text: "#cbd5e1", border: "#94a3b8" },
    invoc:      { bg: "rgba(249,115,22,0.15)",   text: "#fed7aa", border: "#f97316" },
    unknown:    { bg: "rgba(75,85,99,0.15)",     text: "#9ca3af", border: "#4b5563" },
};

/** Icône emoji/unicode associée à chaque famille d'effet. */
export const EFFECT_KIND_ICON: Record<SpellEffectKind, string> = {
    push:       "↗",
    pull:       "↙",
    tp_caster:  "⟶",
    tp_target:  "⟵",
    swap:       "⇄",
    tp_random:  "?",
    tp_cell:    "⟶",
    tp_symmetric: "⇋",
    gravity:    "⚓",
    glyph:      "▣",
    trap:       "⚠",
    stasis:     "🔒",
    muddy:      "🪨",
    state:      "✦",
    ap_loss:    "−PA",
    mp_loss:    "−PM",
    ap_gain:    "+PA",
    mp_gain:    "+PM",
    range_loss: "−PO",
    range_gain: "+PO",
    res_loss:   "−%",
    res_gain:   "+%",
    heal:       "♥",
    shield:     "🛡",
    invoc:      "👾",
    unknown:    "•",
};

/** Un effet classifié extrait d'une ligne `effectDetails`. */
export interface ClassifiedEffect {
    kind: SpellEffectKind;
    /** Libellé nettoyé (conservé tel quel depuis Dofensive). */
    label: string;
    /** Distance de déplacement, si applicable (push/pull en cases). */
    distance?: number;
    /** Durée textuelle (« 2 tours », « infini »…). */
    duration?: string | null;
    /** Valeur numérique si le retrait/gain est chiffré (ex. 3 PA). */
    value?: number;
    /** Élément concerné pour résistances/dégâts (« feu », « eau »…). */
    element?: string;
}

// ─── Patterns de détection ────────────────────────────────────────────────────

const PATTERNS: { pattern: RegExp; kind: SpellEffectKind; extract?: (m: RegExpMatchArray) => Partial<ClassifiedEffect> }[] = [
    // Déplacement — Poussée / Attirance
    { pattern: /repousse\s+de\s+(\d+)\s+case/i,       kind: "push",      extract: m => ({ distance: +m[1] }) },
    { pattern: /attire\s+de\s+(\d+)\s+case/i,         kind: "pull",      extract: m => ({ distance: +m[1] }) },
    { pattern: /d[ée]place\s+de\s+(\d+)\s+case/i,     kind: "push",      extract: m => ({ distance: +m[1] }) },
    // Téléportation
    // ⚠️ AVANT les motifs génériques (« téléporté sur la case du lanceur », « téléporte le
    // lanceur ») : Rafale dit « Téléporte les cibles **symétriquement par rapport au centre** ».
    { pattern: /t[ée]l[ée]porte[^.]*sym[ée]triquement/i, kind: "tp_symmetric" },
    { pattern: /t[ée]l[ée]porte\s+sur\s+la\s+case\s+du\s+lanceur/i, kind: "tp_caster" },
    { pattern: /t[ée]l[ée]porte\s+le\s+lanceur\s+sur\s+sa\s+case/i, kind: "tp_target" },
    { pattern: /t[ée]l[ée]porte\s+le\s+lanceur/i,    kind: "tp_target" },
    { pattern: /[ée]change\s+de\s+place|transpose\s+avec\s+le\s+lanceur|permute/i, kind: "swap" },
    { pattern: /t[ée]l[ée]port(?:e|ation)\s+al[ée]atoire|t[ée]l[ée]porte\s+al[ée]/i, kind: "tp_random" },
    { pattern: /t[ée]l[ée]port(?:e|ation)|mot\s+de\s+(fuite|passage|transposition)|mot\s+d['']arak/i, kind: "tp_cell" },
    { pattern: /d[ée]placement\s+de\s+(\d+)\s+case/i, kind: "push",      extract: m => ({ distance: +m[1] }) },
    // États positionnels / conditions
    { pattern: /pesanteur/i,      kind: "gravity" },
    // Glyphes & pièges **posés au sol** : leur zone inflige des dégâts à chaque tour. On les
    // identifie (badge + note) sans calculer un chiffre par tour qui n'est pas dans la donnée.
    { pattern: /glyphe/i,         kind: "glyph" },
    { pattern: /pi[eè]ge/i,       kind: "trap" },
    { pattern: /stase/i,          kind: "stasis" },
    { pattern: /embourbement|embourbe/i, kind: "muddy" },
    // PA / PM / PO
    { pattern: /retire\s+(\d+)\s+pa\b/i,              kind: "ap_loss",   extract: m => ({ value: +m[1] }) },
    { pattern: /retire\s+(\d+)\s+pm\b/i,              kind: "mp_loss",   extract: m => ({ value: +m[1] }) },
    { pattern: /retire\s+(\d+)\s+po\b/i,              kind: "range_loss",extract: m => ({ value: +m[1] }) },
    { pattern: /retrait\s+de\s+(\d+)\s+pa/i,          kind: "ap_loss",   extract: m => ({ value: +m[1] }) },
    { pattern: /retrait\s+de\s+(\d+)\s+pm/i,          kind: "mp_loss",   extract: m => ({ value: +m[1] }) },
    { pattern: /retrait\s+de\s+(\d+)\s+po/i,          kind: "range_loss",extract: m => ({ value: +m[1] }) },
    { pattern: /(\d+)\s+pa/i,                         kind: "ap_loss",   extract: m => ({ value: +m[1] }) },
    { pattern: /(\d+)\s+pm/i,                         kind: "mp_loss",   extract: m => ({ value: +m[1] }) },
    { pattern: /ajoute\s+(\d+)\s+pa/i,                kind: "ap_gain",   extract: m => ({ value: +m[1] }) },
    { pattern: /ajoute\s+(\d+)\s+pm/i,                kind: "mp_gain",   extract: m => ({ value: +m[1] }) },
    // Résistances
    { pattern: /retrait\s+.*r[eé]sistance/i,          kind: "res_loss" },
    { pattern: /bonus\s+.*r[eé]sistance|r[eé]sistance\s+.*\+/i, kind: "res_gain" },
    // Soins / Boucliers
    { pattern: /soigne|soin\s+de|r[eé]g[eé]n[eè]re\s+(\d+)/i, kind: "heal" },
    { pattern: /bouclier|armure/i,                    kind: "shield" },
    // Invocation
    { pattern: /invoque|invocation/i,                 kind: "invoc" },
    // État générique (en dernier pour ne pas écraser les patterns précédents)
    { pattern: /(?:applique|inf\w*|pose)\s+l['']?[ée]tat|[ée]tat\s+\w/i, kind: "state" },
];

// ─── Fonctions publiques ──────────────────────────────────────────────────────

/**
 * Classifie les effets d'un sort à partir de ses `effectDetails` (ou libellés bruts).
 * Retourne uniquement les effets qui ont un impact visuel sur la grille (positionnels + altérations).
 * Les effets non reconnus sont classés `unknown` mais conservés pour un affichage générique.
 */
export function classifySpellEffects(
    effectDetails?: Array<{
        label?: string;
        damage?: unknown;
        pushDistance?: number | null;
        duration?: string | null;
    }> | string[] | null | undefined
): ClassifiedEffect[] {
    if (!effectDetails || effectDetails.length === 0) return [];

    const out: ClassifiedEffect[] = [];
    const seenKinds = new Set<string>();

    for (const raw of effectDetails) {
        const label = cleanDofusText(
            typeof raw === "string" ? raw : (raw as { label?: string }).label ?? ""
        );
        if (!label) continue;

        const duration = typeof raw === "object" && raw !== null && "duration" in raw
            ? (raw as { duration?: string | null }).duration ?? null
            : null;

        // Poussée explicite depuis pushDistance
        const pushDist = typeof raw === "object" && raw !== null && "pushDistance" in raw
            ? (raw as { pushDistance?: number | null }).pushDistance ?? null
            : null;

        if (pushDist && pushDist > 0) {
            const key = `push:${pushDist}`;
            if (!seenKinds.has(key)) {
                seenKinds.add(key);
                out.push({ kind: "push", label, distance: pushDist, duration });
            }
            continue;
        }

        // Recherche pattern
        let matched = false;
        for (const { pattern, kind, extract } of PATTERNS) {
            const m = label.match(pattern);
            if (m) {
                const extra = extract ? extract(m) : {};
                const key = `${kind}:${extra.distance ?? extra.value ?? ""}`;
                if (!seenKinds.has(key)) {
                    seenKinds.add(key);
                    out.push({ kind, label, duration, ...extra });
                }
                matched = true;
                break;
            }
        }
        if (!matched) {
            // Effet non classifié — on le garde pour l'affichage générique uniquement si
            // c'est un effet "utile" (pas de dégâts → pas de doublon avec le panneau dégâts)
            const hasDamage = typeof raw === "object" && raw !== null && "damage" in raw
                ? !!(raw as { damage?: unknown }).damage
                : false;
            if (!hasDamage) {
                out.push({ kind: "unknown", label, duration });
            }
        }
    }

    return out;
}

// ─── Calcul des destinations positionnelles ───────────────────────────────────

export interface PositionalResult {
    kind: Extract<SpellEffectKind, "push" | "pull" | "tp_caster" | "tp_target" | "swap" | "tp_random" | "tp_cell" | "tp_symmetric">;
    /** Case source (position actuelle de la cible). */
    from: DofusPos;
    /** Case de destination calculée. */
    dest: DofusPos;
    /** Cases réellement parcourues (pertinent pour push/pull, 0 sinon). */
    actualCases: number;
    /** Poussée bloquée avant la distance prévue ? */
    blocked: boolean;
    /** Distance prévue (push/pull). */
    expectedDistance?: number;
}

/**
 * Calcule la destination d'un effet positionnel pour une cible donnée.
 * Retourne `null` si l'effet n'implique pas de déplacement calculable
 * (ex. `tp_random` — destination inconnue par définition).
 */
export function computePositionalEffect(opts: {
    effect: ClassifiedEffect;
    caster: DofusPos;
    target: DofusPos;
    /** Case visée par le sort (peut différer de la position de la cible). */
    anchor: DofusPos;
    cols: number;
    rows: number;
    isRealMap: boolean;
    isBlocked: (x: number, y: number) => boolean;
}): PositionalResult | null {
    const { effect, caster, target, anchor, cols, rows, isRealMap, isBlocked } = opts;

    switch (effect.kind) {
        case "push": {
            const dist = effect.distance ?? 1;
            const { dest, actualCases } = computePushDestination({
                caster,
                target,
                pushDistance: dist,
                cols,
                rows,
                isRealMap,
                isBlocked,
            });
            return { kind: "push", from: target, dest, actualCases, blocked: actualCases < dist, expectedDistance: dist };
        }
        case "pull": {
            // Attirance : direction opposée à la poussée (cible→caster)
            const dist = effect.distance ?? 1;
            // Inverser caster et target : on pousse depuis la cible vers le caster
            const { dest, actualCases } = computePushDestination({
                caster: target,   // origine fictive (côté opposé)
                target,
                pushDistance: dist,
                cols,
                rows,
                isRealMap,
                // Pour l'attirance, on pousse vers le caster — donc on réutilise computePushDestination
                // avec caster comme destination plutôt que comme source. On simule en inversant :
                // on pousse depuis un point fictif opposé au caster, à travers la cible, vers le caster.
                isBlocked,
            });
            // Recalcul correct de l'attirance : direction cible → caster
            const { dest: pullDest, actualCases: pullCases } = computePushDestination({
                caster: { x: target.x * 2 - caster.x, y: target.y * 2 - caster.y }, // miroir du caster
                target,
                pushDistance: dist,
                cols,
                rows,
                isRealMap,
                isBlocked,
            });
            void dest; void actualCases; // variables du premier calcul ignorées
            return { kind: "pull", from: target, dest: pullDest, actualCases: pullCases, blocked: pullCases < dist, expectedDistance: dist };
        }
        case "tp_symmetric": {
            // Téléportation **symétrique par rapport au centre** de la zone (Rafale) : la cible
            // va de l'autre côté de la case visée, à distance égale. Hors plateau ⇒ bloqué.
            const dest = { x: 2 * anchor.x - target.x, y: 2 * anchor.y - target.y };
            const inGrid = dest.x >= 0 && dest.x < cols && dest.y >= 0 && dest.y < rows;
            return {
                kind: "tp_symmetric",
                from: target,
                dest: inGrid ? dest : target,
                actualCases: 0,
                blocked: !inGrid,
            };
        }
        case "tp_caster":
            // La cible se téléporte sur la case du lanceur
            return { kind: "tp_caster", from: target, dest: caster, actualCases: 0, blocked: false };
        case "tp_target":
            // Le lanceur se téléporte sur la case de la cible (la cible ne bouge pas)
            return { kind: "tp_target", from: caster, dest: target, actualCases: 0, blocked: false };
        case "swap":
            // Échange : caster va sur la case de la cible, cible va sur la case du caster
            return { kind: "swap", from: target, dest: caster, actualCases: 0, blocked: false };
        case "tp_random":
            // Destination inconnue
            return null;
        case "tp_cell":
            // Téléportation sur la case visée (anchor)
            return { kind: "tp_cell", from: target, dest: anchor, actualCases: 0, blocked: false };
        default:
            return null;
    }
}

/**
 * Libellé court pour un effet classifié, affiché dans les badges SVG de la grille tactique.
 * Règle : au plus 10 caractères pour tenir dans un badge 60 px.
 */
export function effectShortLabel(effect: ClassifiedEffect): string {
    switch (effect.kind) {
        case "push":       return `↗ ${effect.distance ?? "?"}c`;
        case "pull":       return `↙ ${effect.distance ?? "?"}c`;
        case "tp_caster":  return "⟶ Lanceur";
        case "tp_target":  return "⟵ Cible";
        case "swap":       return "⇄ Swap";
        case "tp_random":  return "? TP";
        case "tp_cell":    return "⟶ Case";
        case "tp_symmetric": return "⇋ Symétrie";
        case "gravity":    return "⚓ Pesant.";
        case "glyph":      return "▣ Glyphe";
        case "trap":       return "⚠ Piège";
        case "stasis":     return "🔒 Stase";
        case "muddy":      return "🪨 Embourb.";
        case "ap_loss":    return `−${effect.value ?? "?"}PA`;
        case "mp_loss":    return `−${effect.value ?? "?"}PM`;
        case "ap_gain":    return `+${effect.value ?? "?"}PA`;
        case "mp_gain":    return `+${effect.value ?? "?"}PM`;
        case "range_loss": return `−${effect.value ?? "?"}PO`;
        case "range_gain": return `+${effect.value ?? "?"}PO`;
        case "res_loss":   return "−Rés.";
        case "res_gain":   return "+Rés.";
        case "heal":       return "♥ Soin";
        case "shield":     return "🛡 Armure";
        case "invoc":      return "👾 Invoc.";
        case "state": {
            // Extraire le nom de l'état depuis le libellé (max 8 car.)
            const m = effect.label.match(/[ée]tat\s+([A-Za-zÀ-ÿ\s\-]{2,15})/i);
            const name = m ? m[1].trim().slice(0, 8) : "État";
            return `✦ ${name}`;
        }
        default: {
            // Tronque le label brut
            const clean = effect.label.slice(0, 9);
            return clean.length < effect.label.length ? clean + "…" : clean;
        }
    }
}

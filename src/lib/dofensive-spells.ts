/**
 * Types + fusion des sorts Dofensive — module client-safe (PAS un server action).
 *
 * Les données de combat Dofensive (`/spells/{id}`, par grade) sont la source de
 * vérité pour la simulation : AP, portée, LdV, ligne/diagonale, cooldown, max cast
 * et zone AoE. Ce module est importé par les composants clients pour fusionner ces
 * données avec les sorts DofusDB (images/descriptions) sans passer par un server action.
 */

export type DofensiveZoneShape =
    | "Cercle"
    | "Croix"
    | "Ligne"
    | "Cône"
    | "Perpend"
    | "Rectangle"
    | "Point"
    | "Inconnue";

export interface DofensiveSpellZone {
    shape: DofensiveZoneShape;
    size: number;
    range: number;
}

/** Effet Dofensive structuré (durée, déclencheurs, masques d'affectation). */
export interface DofensiveSpellEffect {
    /** Effet principal formaté (ex. « État Invulnérable », « -10 Fuite »). */
    label: string;
    /** Durée formatée : « infini », « pour N tour(s) », ou null (instantané). */
    duration: string | null;
    /** Déclencheurs (ex. « L'effet est déclenché lorsque la cible reçoit des dommages d'une invocation »). */
    triggers: string[];
    /** Masques d'affectation (ex. « Affecte le lanceur (même en-dehors de la zone d'effet) »). */
    masks: string[];
    /**
     * **Jet de dégâts numérique** (déjà calculé par les caractéristiques du monstre) — c'est la
     * donnée de la prévisu sur la grille : `null` pour un effet qui n'inflige pas de dommages
     * élémentaires (soin, état, poussée, %…). Jamais de chiffre inventé.
     */
    damage?: { element: string; min: number; max: number } | null;
    /** Distance de **poussée** (cases) quand l'effet pousse — affichée telle quelle, aucun dégât calculé. */
    pushDistance?: number | null;
}

export interface DofensiveSpellCombat {
    id: number;
    name: string;
    /**
     * Nom anglais (i18n). DofusDB le fournit dans la fusion ; la payload combat
     * Dofensive ne le porte pas toujours — voir `docs/reference/I18N_GUIDE.md`.
     */
    nameEn?: string;
    /** Icône officielle Dofensive (CDN) — distincte par sort, contrairement à DofusDB. */
    imageUrl?: string;
    apCost: number;
    minRange: number;
    range: number;
    castTestLos: boolean;
    castInLine: boolean;
    castInDiagonal: boolean;
    /** Probabilité de coup critique (%). */
    criticalChance: number;
    /** Nombre de lancers par tour. */
    maxCastPerTurn: number;
    /** Nombre de lancers par cible. */
    maxCastPerTarget: number;
    /** Cooldown (tours). */
    minCastInterval: number;
    /** Description Dofensive du sort (ex. « Ce sort est lancé une seule fois par l'ennemi lorsqu'il rejoint le combat. »). */
    description?: string;
    /** Grade/Niveau Dofensive du level utilisé (« Niv. X »). */
    grade?: number;
    /** Effets résumés (texte FR formaté) — lignes « label (durée) » + déclencheurs. */
    effects: string[];
    /** Version structurée des effets (durées, déclencheurs, masques) pour l'affichage détaillé. */
    effectDetails?: DofensiveSpellEffect[];
    /** Effets critiques formatés (lignes) — section « Effets critiques ». */
    criticalEffects?: string[];
    /** false si le sort n'a aucun effet critique (« Aucun effet critique »). */
    hasCriticalEffects?: boolean;
    zone: DofensiveSpellZone | null;
}

export interface DofensiveMergedSpell extends Omit<DofensiveSpellCombat, "zone"> {
    zone?: DofensiveSpellZone;
    imageUrl?: string;
    description?: string;
    /**
     * Nom anglais (DofusDB) — i18n : `locale === "en" ? (spell.nameEn || spell.name) : spell.name`
     * (voir `docs/reference/I18N_GUIDE.md`). Aligné sur `SpellData` (grilles de sorts).
     */
    nameEn?: string;
}

/**
 * Grade de monstre réellement utilisé (`Grades[gradeLevel - 1]`, repli sur le **dernier** grade —
 * même convention que `pickMonsterDamageStats` et que la sélection du niveau de sort).
 */
export function pickMonsterGrade(grades: any, gradeLevel?: number): any | null {
    const list: any[] = Array.isArray(grades) ? grades : [];
    if (list.length === 0) return null;
    const idx = typeof gradeLevel === "number" && gradeLevel >= 1 && gradeLevel <= list.length
        ? gradeLevel - 1
        : list.length - 1;
    return list[idx] ?? null;
}

/**
 * **Niveau de sort** à utiliser pour un monstre.
 *
 * 🔍 Mesure du 22/09/2026 (`Ancrépulsion`, monstre `Armécréante` 5979) : le jeu fixe le niveau du
 * sort **par grade de monstre** — payload Dofensive `Grades[].SpellGrades = {"15143":1,"15144":1,
 * "15150":1}` — et **non** « le dernier niveau du sort ». Le sort `15144` a 3 niveaux :
 *   · `Grade 1` (id 45397) → « Attire de 1 case » + **« 61 à 70 dommages Terre »** ;
 *   · `Grade 3` (id 45475) → « Repousse de 3 cases (sans dommages) » — **aucun dégât**.
 * Prendre le dernier niveau affichait donc un sort qui **ne tape pas**, alors que le monstre le
 * lance au niveau 1 : toute la fiche (mécaniques, prévisu, simulation) était fausse.
 *
 * Repli **documenté** : payload sans `SpellGrades` (donnée absente) ⇒ dernier niveau, comportement
 * historique — jamais un niveau inventé. `null` = aucun niveau exploitable.
 */
export function pickSpellLevelForMonster<T extends { Grade?: number | null }>(
    levels: T[],
    spellId: number,
    grade: any
): T | null {
    const list = (Array.isArray(levels) ? levels : []).filter(Boolean) as T[];
    if (list.length === 0) return null;
    const map = grade?.SpellGrades ?? null;
    const wanted = Number(map ? map[String(spellId)] ?? map[spellId] : NaN);
    if (Number.isFinite(wanted) && wanted >= 1) {
        const byGrade = list.find((l) => Number(l?.Grade) === wanted);
        if (byGrade) return byGrade;
        if (wanted <= list.length) return list[wanted - 1];
    }
    return list[list.length - 1];
}

/**
 * **Version de FORME du payload de sorts stocké** (`MonsterStat.stats.spells`).
 *
 * 🔍 Cause racine mesurée le 22/09/2026 (retour user : « les estimations de dégâts ne marchent pas du
 * tout ») — la lecture locale sert volontairement une ligne **périmée** (`stale-while-offline`), mais
 * rien ne signalait qu'un payload écrit par une version ANTÉRIEURE du code n'a plus la forme attendue :
 *   · `SELECT count(*) … WHERE effectDetails[].damage ? 'max'` → **0 ligne sur 256** portait le jet ;
 *   · l'option « Dégâts estimés » était donc désactivée partout (« Aucun dégât ») alors que le code de
 *     lecture était juste : **la donnée servie** ne portait pas le champ.
 *
 * ⇒ Toute écriture (`persistMonsterStat`) estampille cette version ; toute lecture qui découvre une
 * forme antérieure (ou absente) la traite comme **à rafraîchir depuis la source** — jamais comme une
 * absence (la règle `stale-while-offline` reste entière : on sert la ligne si la source ne répond pas).
 *
 *   · **v1** = historique (aucun champ de jet) ;
 *   · **v2** = lot 3a « prévisu de dégâts » (`effectDetails[].damage` + `.pushDistance`).
 */
export const COMBAT_SPELLS_PAYLOAD_VERSION = 2;

/** `true` quand le payload stocké n'a pas (ou plus) la forme attendue par le code courant. */
export function isCombatSpellsPayloadOutdated(payloadVersion: unknown): boolean {
    const version = Number(payloadVersion);
    return !Number.isFinite(version) || version < COMBAT_SPELLS_PAYLOAD_VERSION;
}

/**
 * Fusionne les sorts DofusDB (images/descriptions) avec les données de combat
 * Dofensive (AP/portée/LoS/ligne/diagonale/cooldown/zone). Les champs de combat
 * Dofensive PRIMENT (source de vérité combat) ; les sorts présents uniquement chez
 * l'une des deux sources sont conservés. Jamais d'écrasement destructif.
 */
export function mergeDofensiveSpells(
    dbSpells: Array<{ id: number; name?: string; nameEn?: string; imageUrl?: string; description?: string }> = [],
    dofensiveSpells: DofensiveSpellCombat[] = []
): DofensiveMergedSpell[] {
    const dbMap = new Map<number, { name?: string; nameEn?: string; imageUrl?: string; description?: string }>();
    for (const s of dbSpells) {
        const sid = Number(s?.id);
        if (Number.isFinite(sid) && sid > 0) dbMap.set(sid, s);
    }

    const merged: DofensiveMergedSpell[] = [];
    const seen = new Set<number>();
    for (const ds of dofensiveSpells) {
        const db = dbMap.get(ds.id);
        merged.push({
            ...ds,
            name: db?.name || ds.name,
            nameEn: db?.nameEn || ds.nameEn,
            imageUrl: ds.imageUrl || db?.imageUrl, // icône Dofensive préférée (distincte par sort)
            // Description Dofensive prioritaire (contexte de combat du sort), DofusDB en fallback.
            description: ds.description || db?.description,
            zone: ds.zone ?? undefined,
        });
        seen.add(ds.id);
    }
    // Sorts DofusDB non couverts par Dofensive (ex. sorts invoqués/déclenchés) : on les garde tels quels.
    for (const db of dbSpells) {
        const sid = Number(db?.id);
        if (Number.isFinite(sid) && sid > 0 && !seen.has(sid)) {
            merged.push(db as unknown as DofensiveMergedSpell);
        }
    }
    return merged;
}

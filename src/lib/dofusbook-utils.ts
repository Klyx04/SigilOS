import { resolveDofusStatTheme } from "@/lib/dofus-stats-theme";

export type DofusbookItemEffect = {
    code: string;
    min: number;
    max: number;
    /** Meilleur jet (max des bornes, comme pour les stats). */
    value: number;
};

export type DofusbookItem = {
    /**
     * Id **interne Dofusbook** (ex. 1621 = « Anneau Poli »).
     * ⚠️ Ce n'est PAS un id de jeu : ne jamais le passer à `dofusbookItemIconUrl()`
     * (voir `dofusbookItemIconId()`).
     */
    id: number;
    name: string;
    /** Id d'icône DofusDB (`iconId`, ex. 9143 = « Anneau Poli ») → `/img/items/{picture}.png`. */
    picture: number;
    /** Id Ankama / DofusDB de l'item (ex. 8879 = « Anneau Poli ») → `/items/{official}`.
     *  ⚠️ Ne pas l'utiliser pour une icône (voir `dofusbookItemIconId()`). */
    official: number;
    /** Niveau et type quand Dofusbook les expose (repli : 0 / ""). */
    level?: number;
    typeName?: string;
    /** Effets au meilleur jet (pour la modale interne, sans appel réseau). */
    effects?: DofusbookItemEffect[];
};

/**
 * Icône d'item 100 % interne : proxy auto-siphon (jamais de hotlink Dofusbook/DofusDB côté client).
 *
 * ⚠️ `iconId` doit être l'id d'icône DofusDB (`item.picture`), pas un id d'item :
 * `/img/items/{id}.png` est un **namespace d'icônes** (un id d'item peut y répondre 200
 * avec l'image d'un AUTRE objet) — voir `dofusbookItemIconId()`.
 */
/**
 * Codes courts des **bonus de panoplie / effets d'items Dofusbook** → libellé FR compact.
 *
 * 📌 Source de vérité : `cloths[].effects[].name` du payload brut Dofusbook. Les codes
 * réellement observés en production (builds de la galerie) sont :
 * `ag cc ch daf dc def dff dnf dtf epa epm fo fu in ii pa pm po pu rap rc rep rfp rtp ta vi`.
 * Les libellés des codes ambigus sont ancrés sur le référentiel officiel DofusDB
 * (`/characteristics`, lu le 18/09/2026) :
 *   · `78` Fuite, `79` Tacle, `27`/`28` Esquive PA/PM, `82`/`83` Retrait PA/PM,
 *   · `85` Poussée (fixe) → `rp`, `87` Critiques (fixe) → `rc` (dégâts critiques subis).
 *
 * ⚠️ Un code inconnu reste affiché tel quel (jamais un libellé inventé) ; l'icône, elle,
 * est résolue séparément par `resolveDofusStatTheme()`.
 */
export const DOFUSBOOK_STAT_LABELS: Record<string, string> = {
    pa: "PA", pm: "PM", po: "PO", vi: "Vitalité", vit: "Vitalité",
    fo: "Force", in: "Intelligence", ch: "Chance", ag: "Agilité",
    sa: "Sagesse", pu: "Puissance", rnp: "% Ré Neutre", rtp: "% Ré Terre",
    rfp: "% Ré Feu", rep: "% Ré Eau", rap: "% Ré Air", ini: "Initiative", ii: "Initiative",
    cc: "% Critique", pp: "Prospection", invo: "Invocation", ic: "Invocation", so: "Soin",
    dnf: "Do Neutre", dtf: "Do Terre", dff: "Do Feu", def: "Do Eau",
    daf: "Do Air", df: "Dommages", dmg: "Dommages", dc: "Do Crit.", dp: "Do Pouss.",
    da: "% Do Armes", ds: "% Do Sorts", dm: "% Do Mêlée", di: "% Do Dist.", dd: "% Do Dist.",
    // Résistances « fixes » (les variantes `%` sont ci-dessus)
    rn: "Ré Neutre", rt: "Ré Terre", rf: "Ré Feu", re: "Ré Eau", ra: "Ré Air",
    // Utilitaires de combat
    fu: "Fuite", ta: "Tacle", epa: "Esquive PA", epm: "Esquive PM",
    rpa: "Retrait PA", rpm: "Retrait PM", pod: "Pods",
    // Réductions de dégâts subis (référentiel 85 / 87)
    rp: "Ré Pouss.", rc: "Ré Crit.",
};

/**
 * Version de la clé d'URL des icônes d'items (voir `dofusbookItemIconUrl`).
 *
 * 🐛 Historique (symptôme : panneau d'équipement avec des slots « vides » en forme d'épée) :
 * le proxy renvoyait un placeholder SVG avec `Cache-Control: max-age=86400` → un échec de
 * siphonnage TRANSITOIRE restait figé jusqu'à 24 h dans le cache du navigateur, alors que le
 * serveur servait ensuite le vrai WebP. Le placeholder est désormais `no-store`, mais une
 * réponse DÉJÀ en cache ne se répare pas toute seule : incrémenter cette version change la
 * clé d'URL et contourne les entrées figées (un seul rechargement, puis cache 1 an à nouveau).
 */
export const DOFUSBOOK_ITEM_ICON_URL_VERSION = 2;

export function dofusbookItemIconUrl(iconId: number): string {
    return `/api/assets-dofus/items/${iconId}?v=${DOFUSBOOK_ITEM_ICON_URL_VERSION}`;
}

/**
 * IconId DofusDB (`item.picture`) à passer à `dofusbookItemIconUrl()` pour l'icône d'un item.
 *
 * 🐛 Bug corrigé (galerie / fiche perso « affichent de mauvais items ») : le code utilisait
 * `item.id`, l'id **interne Dofusbook** (ex. 1621 = « Anneau Poli »), absent de DofusDB →
 * 404 sur `/img/items/1621.png`, puis l'auto-healing du proxy retombait sur `/items/1621` =
 * **« Bottes de Maîtrise »** ⇒ icônes d'autres objets (hache, bottes, « Purée pique-fêle »…).
 *
 * ⚠️ Ne PAS utiliser `official` (id Ankama) non plus : `/img/items/{official}.png` répond
 * 200 dans ~1/3 des cas avec l'icône d'un **autre** item (collision de namespace, invisible
 * côté proxy). Seul `picture` = `iconId` DofusDB cible exactement la bonne image (vérifié
 * 30/30 sur les builds réels, cf. `item.img` renvoyé par DofusDB = `/img/items/{picture}.png`).
 *
 * Retourne `null` si `picture` est absent (vieux cache / schéma changé) → pas d'icône plutôt
 * qu'une fausse icône.
 */
export function dofusbookItemIconId(item?: Pick<DofusbookItem, "picture"> | null): number | null {
    const iconId = Number(item?.picture ?? 0);
    return Number.isInteger(iconId) && iconId > 0 ? iconId : null;
}

/**
 * Message unique (UI + serveur) quand Dofusbook refuse les appels **serveur**
 * (challenge anti-bot Cloudflare) — cf. `isDofusbookBlockResponse()`.
 */
export const DOFUSBOOK_BLOCKED_MESSAGE =
    "Dofusbook bloque les requêtes serveur (challenge Cloudflare) — les dernières données connues sont conservées.";

/**
 * Détecte une réponse de **blocage anti-bot** Dofusbook / Cloudflare renvoyée à la place
 * du JSON de build (page « Attention Required! », 403/429, ou 5xx type 520).
 *
 * Sert à : (1) arrêter immédiatement les tentatives (et ne PAS retomber sur un appel
 * direct depuis le VPS — on protège son IP de tout flag) ; (2) afficher un message clair ;
 * (3) ouvrir un disjoncteur Redis pour ne plus marteler Dofusbook.
 *
 * NB : 404 (build inexistant, JSON `stuff/not-found`) et 401 (mauvais secret côté worker)
 * ne sont PAS des blocages.
 */
export function isDofusbookBlockResponse(status: number, contentType?: string | null, body?: string | null): boolean {
    if (status === 401 || status === 404) return false;
    if (status === 403 || status === 429) return true;
    if (status >= 500) return true;
    // 200/3xx avec une page HTML de challenge (au lieu du JSON attendu)
    const isHtml = (contentType || "").toLowerCase().includes("text/html");
    const looksLikeChallenge = !!body && /Attention Required|Just a moment|cf-mitigated|Enable JavaScript and cookies/i.test(body);
    return isHtml && looksLikeChallenge;
}

/** Taille maximale acceptée pour un payload brut de build fourni par un client (~2 Mo). */
export const DOFUSBOOK_RAW_MAX_CHARS = 2 * 1024 * 1024;

/**
 * Valide (forme + taille) un payload brut Dofusbook **fourni par le client** (bake
 * navigateur) avant de le parser avec `processDofusbookRawData` et de le stocker :
 * le navigateur est une entrée NON fiable.
 */
export function isUsableDofusbookRawPayload(raw: unknown): boolean {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
    const stuff = (raw as { stuff?: unknown }).stuff;
    if (!stuff || typeof stuff !== "object" || Array.isArray(stuff)) return false;
    const slots = (stuff as { stuffItem?: unknown }).stuffItem;
    if (!slots || typeof slots !== "object" || Array.isArray(slots)) return false;
    const items = (raw as { items?: unknown }).items;
    if (items !== undefined && !Array.isArray(items)) return false;
    try {
        return JSON.stringify(raw).length <= DOFUSBOOK_RAW_MAX_CHARS;
    } catch {
        return false;
    }
}

/** Meilleur jet d'un effet Dofusbook (`min`/`max`/`value`), comme `sumEffect`. */
export function dofusbookBestRoll(e: any): number {
    const minVal = e?.min !== undefined && e?.min !== null ? Number(e.min) : undefined;
    const maxVal = e?.max !== undefined && e?.max !== null ? Number(e.max) : undefined;
    let val = Number(e?.value) || 0;
    if (minVal !== undefined && maxVal !== undefined) val = Math.max(minVal, maxVal);
    else if (maxVal !== undefined) val = maxVal;
    else if (minVal !== undefined) val = minVal;
    return val;
}

function toDofusbookItemEffects(raw: any): DofusbookItemEffect[] | undefined {
    const list = raw?.effects || raw?.stats;
    if (!Array.isArray(list) || list.length === 0) return undefined;
    const out: DofusbookItemEffect[] = [];
    for (const e of list) {
        const code = String(e?.name || "").toLowerCase();
        if (!code) continue;
        const min = Number(e?.min ?? e?.value ?? 0) || 0;
        const max = Number(e?.max ?? e?.value ?? min) || 0;
        out.push({ code, min, max, value: dofusbookBestRoll(e) });
    }
    return out.length > 0 ? out : undefined;
}

function toDofusbookItem(raw: any): DofusbookItem | null {
    if (!raw || raw.id == null) return null;
    return {
        id: Number(raw.id),
        name: String(raw.name || "Équipement"),
        picture: Number(raw.picture ?? 0),
        official: Number(raw.official ?? 0),
        level: Number(raw.level ?? raw.item_level ?? 0) || undefined,
        typeName: typeof raw.type === "string" ? raw.type : typeof raw.typeName === "string" ? raw.typeName : undefined,
        effects: toDofusbookItemEffects(raw),
    };
}

export type DofusbookPreviewData = {
    /** Version de forme des données (2 = items avec effets/niveau/type pour la modale interne). */
    v: number;
    id: number;
    name: string;
    level: number;
    className: string;
    classId: number;
    stats: {
        pa: number;
        pm: number;
        po: number;
        vit: number;
        ini: number;
        pp: number;
        cc: number;
        invo: number;
        so: number;
        retpa?: number;
        retpm?: number;
        tacle?: number;
        fuite?: number;
    };
    /** Character real stats = items + capital + scrolls */
    elements: {
        fo: number;   // Force
        in: number;   // Intelligence
        ch: number;   // Chance
        ag: number;   // Agilité
        sa: number;   // Sagesse
        pu: number;   // Puissance
    };
    resists: {
        neutre: number;
        terre: number;
        feu: number;
        eau: number;
        air: number;
    };
    damages?: {
        neutre: number;
        terre: number;
        feu: number;
        eau: number;
        air: number;
        general: number;
        critique: number;
        poussee: number;
        armes: number;
        sorts: number;
        melee: number;
        distance: number;
    };
    items?: Record<string, DofusbookItem | null>;
    cloths?: {
        name: string;
        count: number;
        total: number;
        clothItems?: DofusbookItem[]; // items belonging to this set (equipped ones)
        bonuses?: Record<string, number>;
    }[];
    thumbnail?: string;
    smithmagic?: any;
    /**
     * PV donnés par le **niveau** (`50 + 5 × niveau`, soit 1050 au niveau 200).
     *
     * ⚠️ Ils sont **inclus** dans `stats.vit` (total de PV du personnage) mais **exclus**
     * de `characteristics.vi.total` : Dofusbook présente la Vitalité *caractéristique*
     * (équipement + capital + parchotage), sans le socle de niveau (relevé du 18/09/2026 :
     * 3150 affiché alors que le personnage a 4200 PV).
     */
    levelHp?: number;
    /**
     * Détail par caractéristique primaire (`vi sa fo in ch ag pu`), tel que Dofusbook
     * le présente dans son panneau `+` / `Base` / `Parcho`.
     */
    characteristics?: Partial<Record<DofusbookCharacteristicKey, DofusbookCharacteristic>>;
};

/** Caractéristiques primaires capitalisables/parchotables — ordre d'affichage Dofusbook. */
export const DOFUSBOOK_CHARACTERISTIC_CODES = ["vi", "sa", "fo", "in", "ch", "ag", "pu"] as const;

export type DofusbookCharacteristicKey = (typeof DOFUSBOOK_CHARACTERISTIC_CODES)[number];

/**
 * Répartition d'une caractéristique primaire, telle que Dofusbook la détaille :
 *   · `total`  = caractéristique affichée = `items + base + scroll` ;
 *   · `items`  = apport de l'**équipement** (items, bonus de panoplie, forgemagie) ;
 *   · `base`   = points investis **à la main** (payload `base_*`) ;
 *   · `scroll` = **parchotage** (payload `scroll_*`) ;
 *   · `power`  = `total + Puissance`, la valeur **effective** au calcul des dommages
 *                (colonne ⚡ de Dofusbook). Calculée par `dofusbookCharacteristicRows()`,
 *                donc **absente** de la donnée brute et pour Vitalité/Sagesse/Puissance.
 */
export type DofusbookCharacteristic = {
    total: number;
    items: number;
    base: number;
    scroll: number;
    power?: number;
};

/** Ligne prête à l'affichage : libellé/icône officiels résolus + texte de détail. */
export type DofusbookCharacteristicRow = DofusbookCharacteristic & {
    key: DofusbookCharacteristicKey;
    label: string;
    asset: string;
    color: string;
    /** Détail lisible au survol, ex. « Force : 365 (équipement) + 95 (base) + 100 (parcho) = 560 ». */
    breakdown: string;
};

/** Éléments sur lesquels la Puissance se cumule (colonne ⚡ de Dofusbook). */
const DOFUSBOOK_POWERED_CHARACTERISTICS: readonly DofusbookCharacteristicKey[] = ["fo", "in", "ch", "ag"];

const formatSigned = (value: number) => (value < 0 ? `− ${Math.abs(value)}` : `+ ${value}`);

/**
 * Lignes « caractéristiques primaires » de la modale (Total / ⚡ / Base / Parcho),
 * dans l'ordre Dofusbook, avec les icônes officielles.
 *
 * Renvoie `[]` quand la donnée n'existe pas (préview en cache au format antérieur) :
 * l'appelant n'affiche rien plutôt que des zéros inventés — un clic sur
 * « Actualiser » régénère le détail depuis le payload brut.
 */
export function dofusbookCharacteristicRows(
    data: DofusbookPreviewData | null | undefined
): DofusbookCharacteristicRow[] {
    const values = data?.characteristics;
    if (!values) return [];

    const power = Number(values.pu?.total) || 0;
    const levelHp = Number(data?.levelHp) || 0;

    return DOFUSBOOK_CHARACTERISTIC_CODES.flatMap((key) => {
        const value = values[key];
        if (!value) return [];

        // Les 7 codes sont cartographiés dans `dofus-stats-theme` (garde-fou : jamais
        // d'icône cassée, on saute la ligne si un thème venait à disparaître).
        const theme = resolveDofusStatTheme(null, null, key);
        if (!theme) return [];

        const isPowered = DOFUSBOOK_POWERED_CHARACTERISTICS.includes(key);
        const effective = isPowered && power !== 0 ? value.total + power : undefined;
        const isVitality = key === "vi";

        const breakdown = [
            `${theme.label} : ${value.items} (équipement) + ${value.base} (base) + ${value.scroll} (parcho) = ${value.total}`,
            effective != null ? `${value.total} + ${power} Puissance ⇒ ${effective}` : null,
            isVitality && levelHp !== 0
                ? `socle de niveau ${formatSigned(levelHp)} PV ⇒ ${value.total + levelHp} PV`
                : null,
        ]
            .filter((part): part is string => !!part)
            .join(" · ");

        return [{
            key,
            label: theme.label,
            asset: theme.asset,
            color: theme.color,
            breakdown,
            ...value,
            ...(effective != null ? { power: effective } : {}),
        }];
    });
}

export function getClassName(id: number): string {
    const classes: Record<number, string> = {
        1: "Féca", 2: "Osamodas", 3: "Enutrof", 4: "Sram", 5: "Xélor",
        6: "Écaflip", 7: "Éniripsa", 8: "Iop", 9: "Crâ", 10: "Sadida",
        11: "Sacrieur", 12: "Pandawa", 13: "Roublard", 14: "Zobal", 15: "Steamer",
        16: "Éliotrope", 17: "Huppermage", 18: "Ouginak", 19: "Forgelance"
    };
    return classes[id] || "Inconnu";
}

/** Normalisation insensible aux accents/casse pour comparer des noms de classe. */
function stripAccents(s: string): string {
    return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Canonise un identifiant de classe vers la numérotation Dofusbook (1-19).
 * Deux numérotations coexistent : Dofusbook (`character_class`, liens galerie,
 * `getClassSpells`) compte Forgelance = 19, tandis que les icônes
 * `/assets/dofus/classes/*.png` + DofusDB (`breedId`) comptent Forgelance = 20
 * (d'où le filtre galerie qui envoyait "20" pour des builds stockés "19" → 0 résultat).
 * Accepte aussi les slugs/noms legacy ("cra", "Forgelance"). Retourne 0 si inconnu.
 */
export function canonicalClassId(value: unknown): number {
    if (typeof value === "number" && Number.isInteger(value)) {
        if (value >= 1 && value <= 19) return value;
        if (value === 20) return 19; // breed DofusDB → ordre Dofusbook
        return 0;
    }
    if (typeof value === "string") {
        const t = value.trim();
        if (/^\d+$/.test(t)) return canonicalClassId(Number(t));
        const norm = stripAccents(t).toLowerCase();
        for (let id = 1; id <= 19; id++) {
            const name = stripAccents(getClassName(id)).toLowerCase();
            if (name === norm) return id;
        }
        return 0;
    }
    return 0;
}

export function processDofusbookRawData(id: string, raw: any): DofusbookPreviewData {
    const level = raw.stuff?.character_level || 200;

    // ⚔️ 1. Base Stats
    let pa = level >= 100 ? 7 : 6;
    let pm = 3;
    let po = 0;
    // Base life: 1050 at level 200 (Dofus 2 formula: 50 + level*5)
    // Conservé à part : le socle de PV du niveau n'appartient à aucune des trois colonnes
    // Dofusbook (`équipement` / `base` / `parcho`) — voir `characteristics` plus bas.
    const levelHp = 50 + (level * 5);
    let vit = levelHp;
    let ini = level * 5; // Rough base initiative approximation
    let pp = 100;
    let cc = 0;
    let invo = 1;
    let so = 0;
    let retpa = 0, retpm = 0, tacle = 0, fuite = 0;
    let resN = 0, resT = 0, resF = 0, resE = 0, resA = 0;

    // Damages
    let dn = 0, dt = 0, df = 0, de = 0, da = 0, dom = 0;
    let dc = 0, dp = 0, do_armes = 0, do_sorts = 0, do_melee = 0, do_dist = 0;

    // Element stats from items only (capital/scroll added later)
    let el_fo = 0, el_in = 0, el_ch = 0, el_ag = 0, el_sa = 0, el_pu = 0;

    const stuffItemsSlots = raw.stuff?.stuffItem || {};
    const itemsList: any[] = raw.items || [];
    const itemsMap: Record<string, DofusbookItem | null> = {};
    const stuffFmItem = raw.stuff?.stuffFmItem || raw.stuffFmItem || {};

    // Sums item effects into our running stats
    const sumEffect = (e: any) => {
        const name = (e.name || "").toLowerCase();
        // Dofusbook items feature both min and max property bounds.
        // Selecting the best roll means selecting Math.max(min, max).
        // This naturally accommodates penalties (e.g., -5 to -4% means the best roll is -4%).
        const minVal = e.min !== undefined && e.min !== null ? Number(e.min) : undefined;
        const maxVal = e.max !== undefined && e.max !== null ? Number(e.max) : undefined;
        
        let val = Number(e.value) || 0;
        if (minVal !== undefined && maxVal !== undefined) {
            val = Math.max(minVal, maxVal);
        } else if (maxVal !== undefined) {
            val = maxVal;
        } else if (minVal !== undefined) {
            val = minVal;
        }

        if (val === 0 && name !== 'invo' && name !== 'po') return;

        switch (name) {
            // Action / movement
            case 'pa':  pa  += val; break;
            case 'pm':  pm  += val; break;
            case 'po':  po  += val; break;
            // Life
            case 'vi':
            case 'vit': vit += val; break;
            // Element stats (items contribution — for real-stats panel)
            case 'fo':  el_fo += val; break;
            case 'in':
                if (name === 'in') el_in += val; // 'in' is intel
                break;
            case 'ch':  el_ch += val; break;
            case 'ag':  el_ag += val; break;
            case 'sa':  el_sa += val; break;
            case 'pu':  el_pu += val; break;
            // Resistances % (actual Dofusbook API stat names)
            case 'rnp': resN += val; break;  // résistance neutre %
            case 'rtp': resT += val; break;  // résistance terre %
            case 'rfp': resF += val; break;  // résistance feu %
            case 'rep': resE += val; break;  // résistance eau %
            case 'rap': resA += val; break;  // résistance air %
            // Damages
            case 'dnf': dn += val; break;
            case 'dtf': dt += val; break;
            case 'dff': df += val; break;
            case 'def': de += val; break;
            case 'daf': da += val; break;
            case 'df':  dom += val; break;
            case 'dc':  dc += val; break;
            case 'dp':  dp += val; break;
            // % Damages
            case 'da':  do_armes += val; break;
            case 'ds':  do_sorts += val; break;
            case 'dm':  do_melee += val; break;
            case 'di':  do_dist += val; break;
            case 'dd':  do_dist += val; break;  // DofusBook uses 'dd' for % Do Dist.
            // Secondary
            case 'ini': ini += val; break;
            case 'cc': cc += val; break;
            case 'pp': pp += val; break;
            case 'invo': invo += val; break;
            case 'so': so += val; break;
            // Retrait / esquive / tacle / fuite (Dofusbook: rpa, rpm, epa, epm, ta, fu)
            case 'rpa': retpa += val; break;
            case 'rpm': retpm += val; break;
            case 'ta': tacle += val; break;
            case 'fu': fuite += val; break;
        }
    };

    // 🔍 2. Sum effects from all equipped items
    Object.entries(stuffItemsSlots).forEach(([slot, itemId]) => {
        const item = itemsList.find(i => Number(i.id) === Number(itemId));
        if (item) {
            itemsMap[slot] = toDofusbookItem(item);
            // Mod: Only add base effect if that stat hasn't been FM'd (overridden in stuffFmItem)
            const fmItemOverrides = (stuffFmItem && typeof stuffFmItem === 'object') ? (stuffFmItem as any)[slot] : null;

            const effects = item.effects || item.stats || [];
            if (Array.isArray(effects)) {
                effects.forEach(e => {
                    const name = (e.name || "").toLowerCase();
                    if (fmItemOverrides && fmItemOverrides[name] !== undefined) {
                        return; // Ignore this base stat, it's overwritten by FM
                    }
                    sumEffect(e);
                });
            }
        } else {
            itemsMap[slot] = null;
        }
    });

    // 🔗 3. Panoplie Bonuses
    const activeCloths: { name: string; count: number; total: number; clothItems?: DofusbookItem[]; bonuses?: Record<string, number> }[] = [];
    if (Array.isArray(raw.cloths)) {
        raw.cloths.forEach((cloth: any) => {
            const clothItemIds = new Set((cloth.items || []).map((i: any) => Number(i.id)));
            const equippedCount = Object.values(stuffItemsSlots).filter(
                id => clothItemIds.has(Number(id))
            ).length;

            const total = cloth.count_item || cloth.items?.length || 0;
            const clothName = cloth.name || "Panoplie inconnue";

            // Apply ALL cumulative bonuses up to equippedCount
            // Dofus pano bonuses are cumulative: 3 pieces = 2-piece bonus + 3-piece bonus
            const bonuses = (cloth.effects || []).filter(
                (e: any) => Number(e.count) <= equippedCount
            );
            
            const clothBonuses: Record<string, number> = {};
            bonuses.forEach((e: any) => {
                sumEffect(e);
                const name = (e.name || "").toLowerCase();
                const val = Number(e.value) || Math.max(Number(e.min) || 0, Number(e.max) || 0);
                if (val !== 0 && name !== 'invo' && name !== 'po') {
                    clothBonuses[name] = (clothBonuses[name] || 0) + val;
                } else if (val !== 0) {
                    clothBonuses[name] = (clothBonuses[name] || 0) + val;
                }
            });

            if (equippedCount > 1) {
                // Collect the actually-equipped items from this cloth
                // (repli sur la donnée brute de la panoplie si l'item n'est pas dans `items`).
                const equippedClothItems: DofusbookItem[] = (cloth.items || [])
                    .filter((ci: any) => Object.values(stuffItemsSlots).some(id => Number(id) === Number(ci.id)))
                    .map((ci: any) => toDofusbookItem(itemsList.find((i: any) => Number(i.id) === Number(ci.id)) ?? ci))
                    .filter((v: DofusbookItem | null): v is DofusbookItem => !!v);

                activeCloths.push({ name: clothName, count: equippedCount, total, clothItems: equippedClothItems, bonuses: clothBonuses });
            }
        });
    }

    // 👤 4. Character Capital + Scroll (parchos/capitaux)
    // These are stored in raw.stuffStats or raw.stuff.stuffCarac
    const carac = raw.stuffStats || raw.stuff?.stuffCarac;
    // Capital/points à la main et parchotage, conservés **séparément** des totaux :
    // ce sont les colonnes `Base` et `Parcho` du détail affiché dans la modale.
    const capital: Record<DofusbookCharacteristicKey, number> = { vi: 0, sa: 0, fo: 0, in: 0, ch: 0, ag: 0, pu: 0 };
    const scrollPoints: Record<DofusbookCharacteristicKey, number> = { vi: 0, sa: 0, fo: 0, in: 0, ch: 0, ag: 0, pu: 0 };
    if (carac && !Array.isArray(carac)) {
        const base   = (k: string) => Number(carac[`base_${k}`])   || 0;
        const scroll = (k: string) => Number(carac[`scroll_${k}`]) || 0;

        DOFUSBOOK_CHARACTERISTIC_CODES.forEach((key) => {
            capital[key] = base(key);
            scrollPoints[key] = scroll(key);
        });

        vit   += capital.vi + scrollPoints.vi;
        el_fo += capital.fo + scrollPoints.fo;
        el_in += capital.in + scrollPoints.in;
        el_ch += capital.ch + scrollPoints.ch;
        el_ag += capital.ag + scrollPoints.ag;
        el_sa += capital.sa + scrollPoints.sa;
        el_pu += capital.pu + scrollPoints.pu;
        ini   += base('ini') + scroll('ini');
    }
    
    // Add Chance / 10 to Prospection
    pp += Math.floor(el_ch / 10);

    // 🔧 5. Forgemagie — two possible sources:
    //   A. stuffFm.fm  = global FM applied to character stats (shown as "+1 PA" next to stat)
    //   B. stuffFmItem = per-item exo FM (shown in "Exo / Over des items" section)
    //      Structure: { "itemId": { pa: 1, pm: 1, ... } } or flat { pa: 1, pm: 1 }

    // A. Global FM
    const fmGlobal = raw.stuff?.stuffFm?.fm || raw.stuffFm?.fm || {};
    pa    += Number(fmGlobal.pa)  || 0;
    pm    += Number(fmGlobal.pm)  || 0;
    po    += Number(fmGlobal.po)  || 0;
    vit   += Number(fmGlobal.vi)  || Number(fmGlobal.vit) || 0;
    el_fo += Number(fmGlobal.fo)  || 0;
    el_in += Number(fmGlobal.in)  || 0;
    el_ch += Number(fmGlobal.ch)  || 0;
    el_ag += Number(fmGlobal.ag)  || 0;
    el_pu += Number(fmGlobal.pu)  || 0;
    ini   += Number(fmGlobal.ini) || 0;
    cc    += Number(fmGlobal.cc)  || 0;
    pp    += Number(fmGlobal.pp)  || 0;
    invo  += Number(fmGlobal.invo)|| 0;
    so    += Number(fmGlobal.so)  || 0;
    retpa += Number(fmGlobal.rpa) || 0;
    retpm += Number(fmGlobal.rpm) || 0;
    tacle += Number(fmGlobal.ta)  || 0;
    fuite += Number(fmGlobal.fu)  || 0;
    dn    += Number(fmGlobal.dnf) || 0;
    dt    += Number(fmGlobal.dtf) || 0;
    df    += Number(fmGlobal.dff) || 0;
    de    += Number(fmGlobal.def) || 0;
    da    += Number(fmGlobal.daf) || 0;
    dom   += Number(fmGlobal.df)  || 0;
    dc    += Number(fmGlobal.dc)  || 0;
    dp    += Number(fmGlobal.dp)  || 0;
    do_armes += Number(fmGlobal.da) || 0;
    do_sorts += Number(fmGlobal.ds) || 0;
    do_melee += Number(fmGlobal.dm) || 0;
    do_dist  += Number(fmGlobal.di) || Number(fmGlobal.dd) || 0;

    // B. Per-item exo FM — path: raw.stuff.stuffFmItem (NOT raw.stuff.stuffFm.fmItem!)
    // We already skipped the base values in sumEffect, so now we just blindly ADD every fm value 
    // exactly as they are defined on the FM item object.
    if (stuffFmItem && typeof stuffFmItem === 'object') {
        Object.values(stuffFmItem).forEach((fmStats: any) => {
            if (!fmStats || typeof fmStats !== 'object') return;
            pa    += Number(fmStats.pa)  || 0;
            pm    += Number(fmStats.pm)  || 0;
            po    += Number(fmStats.po)  || 0;
            vit   += Number(fmStats.vi)  || Number(fmStats.vit) || 0;
            el_fo += Number(fmStats.fo)  || 0;
            el_in += Number(fmStats.in)  || 0;
            el_ch += Number(fmStats.ch)  || 0;
            el_ag += Number(fmStats.ag)  || 0;
            el_pu += Number(fmStats.pu)  || 0;
            resN  += Number(fmStats.rnp) || 0;
            resT  += Number(fmStats.rtp) || 0;
            resF  += Number(fmStats.rfp) || 0;
            resE  += Number(fmStats.rep) || 0;
            resA  += Number(fmStats.rap) || 0;
            ini   += Number(fmStats.ini) || 0;
            cc    += Number(fmStats.cc)  || 0;
            pp    += Number(fmStats.pp)  || 0;
            invo  += Number(fmStats.invo)|| 0;
            so    += Number(fmStats.so)  || 0;
            retpa += Number(fmStats.rpa) || 0;
            retpm += Number(fmStats.rpm) || 0;
            tacle += Number(fmStats.ta)  || 0;
            fuite += Number(fmStats.fu)  || 0;
            dn    += Number(fmStats.dnf) || 0;
            dt    += Number(fmStats.dtf) || 0;
            df    += Number(fmStats.dff) || 0;
            de    += Number(fmStats.def) || 0;
            da    += Number(fmStats.daf) || 0;
            dom   += Number(fmStats.df)  || 0;
            dc    += Number(fmStats.dc)  || 0;
            dp    += Number(fmStats.dp)  || 0;
            do_armes += Number(fmStats.da) || 0;
            do_sorts += Number(fmStats.ds) || 0;
            do_melee += Number(fmStats.dm) || 0;
            do_dist  += Number(fmStats.di) || Number(fmStats.dd) || 0;
        });
    }

    // 🔧 6. Extract true Exo/Over for the FM Panel
    // We compare stuffFmItem (full modified stats) with the base item effects
    const computedSmithmagic: Record<string, Record<string, number>> = {};
    if (stuffFmItem && typeof stuffFmItem === 'object') {
        Object.entries(stuffFmItem).forEach(([slot, fmStats]: [string, any]) => {
            if (!fmStats || typeof fmStats !== 'object') return;
            const itemId = stuffItemsSlots[slot];
            const item = itemsList.find(i => Number(i.id) === Number(itemId));
            
            const diff: Record<string, number> = {};
            const baseStats: Record<string, number> = {};
            
            // Gather max base stats
            if (item && Array.isArray(item.effects)) {
                item.effects.forEach((e: any) => {
                    const name = (e.name || "").toLowerCase();
                    const minVal = e.min !== undefined && e.min !== null ? Number(e.min) : undefined;
                    const maxVal = e.max !== undefined && e.max !== null ? Number(e.max) : undefined;
                    let val = Number(e.value) || 0;
                    if (minVal !== undefined && maxVal !== undefined) val = Math.max(minVal, maxVal);
                    else if (maxVal !== undefined) val = maxVal;
                    else if (minVal !== undefined) val = minVal;
                    
                    baseStats[name] = (baseStats[name] || 0) + val;
                });
            }

            // Compare FM stats to base stats
            for (const [stat, val] of Object.entries(fmStats)) {
                const fmVal = Number(val) || 0;
                const baseVal = baseStats[stat.toLowerCase()] || 0;
                const exo = fmVal - baseVal;
                if (exo !== 0) {
                    diff[stat.toLowerCase()] = exo;
                }
            }

            if (Object.keys(diff).length > 0) {
                computedSmithmagic[slot] = diff;
            }
        });
    }

    const numericIdMatch = id?.match(/^(\d+)/);
    const numericId = numericIdMatch ? numericIdMatch[1] : id;
    
    const thumbnail = numericId 
        ? `https://static.dofusbook.net/equipement/render/${numericId}.png`
        : undefined;

    // Robust class resolution: Dofusbook may omit or return an out-of-range
    // `character_class` (shared builds, partial responses). Never let it produce a
    // misleading "Inconnu" label — expose a validated classId (or 0) and let the
    // caller fall back to the selected class / name-based guess.
    const rawClassId = Number(raw.stuff?.character_class);
    const validClassId = Number.isFinite(rawClassId) && rawClassId >= 1 && rawClassId <= 19 ? rawClassId : null;

    /**
     * 📊 Détail « équipement / base / parchotage » par caractéristique primaire
     * (colonnes `+` / `Base` / `Parcho` du panneau Dofusbook).
     *
     * `items` est obtenu par **soustraction** (`total − capital − parchotage`) : c'est
     * exactement ce que Dofusbook agrège dans sa colonne « + » (items, bonus de panoplie,
     * forgemagie globale et exo), sans avoir à tracer une seconde somme.
     * ⚠️ Vitalité : `total` est la **caractéristique** — le socle de PV de niveau
     * (`levelHp`, inclus dans `stats.vit`) n'est pas une des trois colonnes.
     */
    const characteristicTotals: Record<DofusbookCharacteristicKey, number> = {
        vi: vit - levelHp,
        sa: el_sa,
        fo: el_fo,
        in: el_in,
        ch: el_ch,
        ag: el_ag,
        pu: el_pu,
    };
    const characteristics = DOFUSBOOK_CHARACTERISTIC_CODES.reduce(
        (acc, key) => {
            const total = characteristicTotals[key];
            acc[key] = {
                total,
                items: total - capital[key] - scrollPoints[key],
                base: capital[key],
                scroll: scrollPoints[key],
            };
            return acc;
        },
        {} as Record<DofusbookCharacteristicKey, DofusbookCharacteristic>
    );

    return {
        v: 2,
        id: parseInt(id) || 0,
        name: raw.stuff?.name || "Sans nom",
        level,
        classId: validClassId ?? 0,
        className: validClassId ? getClassName(validClassId) : "",
        stats: { pa, pm, po, vit, ini, pp, cc, invo, so, retpa, retpm, tacle, fuite },
        elements: { fo: el_fo, in: el_in, ch: el_ch, ag: el_ag, sa: el_sa, pu: el_pu },
        resists: { neutre: resN, terre: resT, feu: resF, eau: resE, air: resA },
        damages: { neutre: dn, terre: dt, feu: df, eau: de, air: da, general: dom, critique: dc, poussee: dp, armes: do_armes, sorts: do_sorts, melee: do_melee, distance: do_dist },
        items: itemsMap,
        cloths: activeCloths,
        thumbnail,
        smithmagic: computedSmithmagic,
        levelHp,
        characteristics
    };
}

// =============================================================================
// PROGRESSION INVITÉ (guide public) — clés de stockage local PAR PERSONNAGE
// =============================================================================
// Le guide public s'utilise sans compte : la progression vit dans le localStorage
// du navigateur. Un visiteur peut y déclarer SON personnage (classe, pseudo,
// serveur — les trois sont facultatifs) : chaque personnage garde alors sa propre
// progression (étapes cochées, blocs terminés, repère « Je suis ici »), et
// l'overlay détaché lit EXACTEMENT les mêmes clés.
//
// Sans personnage déclaré, les clés restent celles d'origine
// (`sigil_guest_<slug>_completed_ms`…) : aucun visiteur déjà en cours de rush ne
// perd quoi que ce soit, et aucune migration n'est nécessaire.
//
// Ce module est PUR (aucun React, aucun accès serveur) : il est testé unitairement
// dans `tests/unit/guest-progress.test.ts`. Les accès `localStorage` sont gardés
// par `typeof localStorage === "undefined"` pour rester inoffensifs au SSR.

export type GuestCharacter = {
  /** Identifiant de classe (`DOFUS_CLASSES[].id`), ex. « iop ». */
  classId: string | null;
  /** Pseudo en jeu (24 caractères max), ex. « MonIop ». */
  pseudo: string | null;
  /** Identifiant de serveur Unity (`DOFUS_UNITY_SERVERS`), ex. 295 (Draconiros). */
  serverId: number | null;
};

export type GuestProgressSnapshot = {
  completedIds: Set<string>;
  completedStepsByMs: Map<string, Set<string>>;
  bookmarksByMs: Map<string, string>;
};

/** Les trois clés d'un emplacement de progression. */
const PROGRESS_SUFFIXES = ["completed_ms", "steps", "bookmarks"] as const;

/** Au moins un champ renseigné ? (sinon c'est « pas de personnage ») */
export function hasGuestCharacter(c: GuestCharacter | null | undefined): c is GuestCharacter {
  return !!c && !!(c.classId || (c.pseudo ?? "").trim() || c.serverId);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

/**
 * Emplacement de progression du personnage : pseudo (à défaut, classe) + serveur.
 * Deux visiteurs qui déclarent le même pseudo sur le même serveur partagent donc
 * la progression — c'est voulu : c'est le même personnage sur ce navigateur.
 */
export function guestCharacterSlot(character: GuestCharacter | null | undefined): string | null {
  if (!hasGuestCharacter(character)) return null;
  const who = slugify(character.pseudo || "") || slugify(character.classId || "") || "perso";
  return character.serverId ? `${who}-${character.serverId}` : who;
}

/**
 * Préfixe des trois clés de progression. Sans personnage → préfixe historique
 * (`sigil_guest_<slug>_`), donc rétro-compatible.
 */
export function guestProgressPrefix(slug: string, character?: GuestCharacter | null): string {
  const slot = guestCharacterSlot(character);
  return slot ? `sigil_guest_${slug}_c_${slot}_` : `sigil_guest_${slug}_`;
}

/** Clé de stockage du personnage lui-même (un seul personnage « actif »). */
export function guestCharacterStorageKey(slug: string): string {
  return `sigil_guest_${slug}_character`;
}

export function readGuestCharacter(slug: string): GuestCharacter | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(guestCharacterStorageKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GuestCharacter>;
    const pseudo = typeof parsed.pseudo === "string" ? parsed.pseudo.trim().slice(0, 24) : "";
    const character: GuestCharacter = {
      classId: typeof parsed.classId === "string" && parsed.classId ? parsed.classId : null,
      pseudo: pseudo || null,
      serverId:
        typeof parsed.serverId === "number" && Number.isFinite(parsed.serverId) ? parsed.serverId : null,
    };
    return hasGuestCharacter(character) ? character : null;
  } catch {
    return null;
  }
}

export function writeGuestCharacter(slug: string, character: GuestCharacter | null): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (!hasGuestCharacter(character)) localStorage.removeItem(guestCharacterStorageKey(slug));
    else localStorage.setItem(guestCharacterStorageKey(slug), JSON.stringify(character));
  } catch {
    /* stockage plein / navigation privée : on garde l'état en mémoire */
  }
}

/** L'emplacement de ce personnage porte-t-il déjà quelque chose ? */
export function guestProgressExists(slug: string, character?: GuestCharacter | null): boolean {
  if (typeof localStorage === "undefined") return false;
  const prefix = guestProgressPrefix(slug, character);
  try {
    return PROGRESS_SUFFIXES.some((suffix) => localStorage.getItem(`${prefix}${suffix}`) !== null);
  } catch {
    return false;
  }
}

/**
 * Adoption : le visiteur a coché des étapes SANS avoir déclaré de personnage, puis
 * en déclare un. On RECOPIE ses trois clés vers l'emplacement du personnage (jamais
 * de déplacement : les clés d'origine restent en place) et seulement si la cible est
 * vide — un personnage qui a déjà sa progression n'est jamais écrasé.
 * Retourne `true` si une adoption a eu lieu.
 */
export function adoptAnonymousGuestProgress(slug: string, character: GuestCharacter | null): boolean {
  if (typeof localStorage === "undefined" || !hasGuestCharacter(character)) return false;
  const from = guestProgressPrefix(slug, null);
  const to = guestProgressPrefix(slug, character);
  if (from === to || guestProgressExists(slug, character)) return false;
  let adopted = false;
  try {
    for (const suffix of PROGRESS_SUFFIXES) {
      const value = localStorage.getItem(`${from}${suffix}`);
      if (value === null) continue;
      localStorage.setItem(`${to}${suffix}`, value);
      adopted = true;
    }
  } catch {
    /* fail-soft : au pire, le personnage démarre vierge */
  }
  return adopted;
}

/** Lit les trois structures de progression d'un emplacement (vide si rien/SSR). */
export function readGuestProgress(slug: string, character?: GuestCharacter | null): GuestProgressSnapshot {
  const empty: GuestProgressSnapshot = {
    completedIds: new Set<string>(),
    completedStepsByMs: new Map<string, Set<string>>(),
    bookmarksByMs: new Map<string, string>(),
  };
  if (typeof localStorage === "undefined") return empty;
  const prefix = guestProgressPrefix(slug, character);
  try {
    const rawIds = localStorage.getItem(`${prefix}completed_ms`);
    if (rawIds) empty.completedIds = new Set(JSON.parse(rawIds) as string[]);
    const rawSteps = localStorage.getItem(`${prefix}steps`);
    if (rawSteps) {
      for (const [msId, ids] of Object.entries(JSON.parse(rawSteps) as Record<string, string[]>)) {
        empty.completedStepsByMs.set(msId, new Set(ids));
      }
    }
    const rawBookmarks = localStorage.getItem(`${prefix}bookmarks`);
    if (rawBookmarks) {
      empty.bookmarksByMs = new Map(Object.entries(JSON.parse(rawBookmarks) as Record<string, string>));
    }
  } catch {
    return empty;
  }
  return empty;
}

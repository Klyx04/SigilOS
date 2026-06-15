/**
 * Ganymède HTML Parser
 * Extrait les entités structurées (donjons, références guides, positions, quêtes, monstres)
 * depuis le web_text HTML brut des étapes Ganymède.
 */

export interface ParsedGuideRef {
  guideId: number;
  guideName: string;
  stepNumber: number;
  label: string;
}

export interface ParsedDungeon {
  dofusDbId: number;
  name: string;
  imageUrl?: string;
}

export interface ParsedItem {
  dofusDbId: number;
  name: string;
  type: "item" | "resource" | "equipment";
  imageUrl?: string;
}

export interface ParsedSequenceBlock {
  type: "guide_ref";
  ref: ParsedGuideRef;
  action: "start" | "resume" | "finish";
  stepFrom?: number;
  stepTo?: number;
  note?: string;
}

export interface ParsedStepEntities {
  guideRefs: ParsedGuideRef[];
  dungeons: ParsedDungeon[];
  items: ParsedItem[];
  sequences: ParsedSequenceBlock[];
  hasCheckboxes: boolean;
  plainText: string;
  colorSections: { color: string; text: string }[];
}

/**
 * Parse le HTML d'une étape GP0 pour extraire les entités enrichies.
 */
export function parseGanymedeHtml(htmlText: string): ParsedStepEntities {
  const entities: ParsedStepEntities = {
    guideRefs: [],
    dungeons: [],
    items: [],
    sequences: [],
    hasCheckboxes: false,
    plainText: "",
    colorSections: [],
  };

  if (!htmlText) return entities;

  // --- Extraire les références de guides ---
  const guideRefRegex = /<span[^>]*data-type="guide-step"[^>]*guideid="(\d+)"[^>]*stepnumber="(\d+)"[^>]*guidename="([^"]*)"[^>]*label="([^"]*)"[^>]*>.*?<\/span>/gs;
  let match: RegExpExecArray | null;
  while ((match = guideRefRegex.exec(htmlText)) !== null) {
    entities.guideRefs.push({
      guideId: parseInt(match[1]),
      guideName: match[3],
      stepNumber: parseInt(match[2]),
      label: match[4],
    });
  }

  // --- Extraire les donjons ---
  const dungeonRegex = /<span[^>]*class="tag-dungeon"[^>]*dofusdbid="(\d+)"[^>]*name="([^"]*)"[^>]*(?:imageurl="([^"]*)")?[^>]*>/g;
  while ((match = dungeonRegex.exec(htmlText)) !== null) {
    const m = match;
    const existing = entities.dungeons.find(d => d.dofusDbId === parseInt(m[1]));
    if (!existing) {
      entities.dungeons.push({
        dofusDbId: parseInt(m[1]),
        name: m[2],
        imageUrl: m[3] || undefined,
      });
    }
  }

  // --- Extraire les items DofusDB ---
  const itemRegex = /<span[^>]*class="tag-item"[^>]*dofusdbid="(\d+)"[^>]*name="([^"]*)"[^>]*type="([^"]*)"[^>]*(?:imageurl="([^"]*)")?[^>]*>/g;
  while ((match = itemRegex.exec(htmlText)) !== null) {
    const m = match;
    const existing = entities.items.find(i => i.dofusDbId === parseInt(m[1]));
    if (!existing) {
      entities.items.push({
        dofusDbId: parseInt(m[1]),
        name: m[2],
        type: (m[3] as any) || "item",
        imageUrl: m[4] || undefined,
      });
    }
  }

  // --- Detect checkboxes / task lists ---
  entities.hasCheckboxes = htmlText.includes('data-type="taskList"') || htmlText.includes('data-type="taskItem"');

  // --- Parse les séquences (blocs checkbox avec références guides) ---
  const taskItemRegex = /<li[^>]*data-type="taskItem"[^>]*>(.*?)<\/li>/gs;
  while ((match = taskItemRegex.exec(htmlText)) !== null) {
    const itemHtml = match[1];
    
    // Détecter l'action (Commencez, Reprenez, Terminez...)
    const plain = stripHtml(itemHtml);
    let action: ParsedSequenceBlock["action"] = "start";
    if (/repren/i.test(plain)) action = "resume";
    else if (/termin/i.test(plain)) action = "finish";

    // Extraire la référence de guide dans ce bloc
    const guideInBlock = guideRefRegex.exec(itemHtml);
    if (guideInBlock) {
      guideRefRegex.lastIndex = 0; // reset pour la prochaine itération
      // Extraire les numéros d'étape mentionnés
      const stepNums = extractStepNumbers(plain);
      entities.sequences.push({
        type: "guide_ref",
        ref: {
          guideId: parseInt(guideInBlock[1]),
          guideName: guideInBlock[3],
          stepNumber: parseInt(guideInBlock[2]),
          label: guideInBlock[4],
        },
        action,
        stepFrom: stepNums[0],
        stepTo: stepNums[1],
      });
    }
  }

  // --- Plain text ---
  entities.plainText = stripHtml(htmlText).replace(/\s+/g, " ").trim();

  return entities;
}

/**
 * Parse les étapes d'un sous-guide (GP1, GP2...) et enrichit chaque step
 * avec les entités extraites de son web_text.
 */
export function parseSubGuideSteps(rawSteps: any[]): any[] {
  return rawSteps.map((step, idx) => {
    const entities = parseGanymedeHtml(step.web_text ?? "");
    return {
      id: step.id,
      stepNumber: idx + 1,
      name: step.name ?? null,
      map: step.map ?? null,
      pos_x: step.pos_x ?? 0,
      pos_y: step.pos_y ?? 0,
      web_text: step.web_text ?? "",
      // Entités enrichies
      dungeons: entities.dungeons,
      items: entities.items,
      guideRefs: entities.guideRefs,
      hasCheckboxes: entities.hasCheckboxes,
      plainText: entities.plainText,
    };
  });
}

/**
 * Parse les étapes d'un guide complet (GP0) pour extraire les milestones structurés.
 */
export function parseGP0Milestones(rawSteps: any[]): {
  title: string;
  type: string;
  isOptional: boolean;
  accentColor: string;
  chapter: number;
  chapterLabel: string;
  order: number;
  sequences: {
    subGuideRef: string;
    subGuideName: string;
    subGuideId: number;
    action: string;
    stepFrom?: number;
    stepTo?: number;
    note?: string;
    isOptional: boolean;
  }[];
  dungeons: ParsedDungeon[];
  rawHtml: string;
}[] {
  const milestones: ReturnType<typeof parseGP0Milestones> = [];
  let chapterCounter = 0;
  let lastChapterLabel = "Chapitre 1";

  rawSteps.forEach((step, idx) => {
    const entities = parseGanymedeHtml(step.web_text ?? "");
    const plain = entities.plainText;

    // Extraire le titre de l'objectif (texte rouge = "Objectifs : ...")
    const objectiveMatch = (step.web_text ?? "").match(
      /color:\s*rgb\(250,\s*0,\s*0\)[^>]*>[^<]*Objectifs?[^<]*<\/span>([^<]*)/i
    );
    const title = objectiveMatch
      ? stripHtml(objectiveMatch[1]).trim() || `Étape ${idx + 1}`
      : `Étape ${idx + 1}`;

    // Déterminer si c'est un Dofus (recherche dans le texte)
    const isDofus = /dofus/i.test(plain);
    const isDungeon = entities.dungeons.length > 0;
    const isBonus = /bonus|optionnel/i.test(plain);
    
    // Chapitre auto-détecté via les gros sauts (heuristique simple)
    if (idx === 0 || (idx > 0 && entities.guideRefs.some(r => r.guideName.includes("GP") && parseInt(r.guideName.replace(/[^0-9]/g, "")) > chapterCounter))) {
      const gpMatch = entities.guideRefs[0]?.guideName.match(/GP(\d+)/i);
      if (gpMatch) {
        chapterCounter = parseInt(gpMatch[1]);
        lastChapterLabel = entities.guideRefs[0]?.guideName.replace(/^\[GP\d+\]\s*/, "") ?? lastChapterLabel;
      }
    }

    // Couleur dynamique selon le type
    const accentColor = isDofus
      ? "#f59e0b"
      : isDungeon
      ? "#8b5cf6"
      : isBonus
      ? "#a855f7"
      : "#10b981";

    // Construire les séquences depuis les entités extraites
    const sequences = entities.sequences.map((seq, seqIdx) => {
      const refLabel = seq.ref.label || seq.ref.guideName;
      const gpRefMatch = refLabel.match(/\[(GP\d+)\]/i);
      const subGuideRef = gpRefMatch ? gpRefMatch[1].toUpperCase() : `GP${seq.ref.guideId}`;

      return {
        subGuideRef,
        subGuideName: seq.ref.guideName,
        subGuideId: seq.ref.guideId,
        action: seq.action,
        stepFrom: seq.stepFrom,
        stepTo: seq.stepTo,
        isOptional: isBonus,
        order: seqIdx + 1,
      };
    });

    milestones.push({
      title: title || `Étape ${idx + 1}`,
      type: isDofus ? "DOFUS" : isDungeon ? "DONJON" : isBonus ? "PREREQUIS" : "QUETE_SERIE",
      isOptional: isBonus,
      accentColor,
      chapter: Math.max(1, chapterCounter),
      chapterLabel: lastChapterLabel,
      order: idx + 1,
      sequences,
      dungeons: entities.dungeons,
      rawHtml: step.web_text ?? "",
    });
  });

  return milestones;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  if (!html) return "";
  let clean = html;
  // Preserve image alt or title attributes as text before stripping HTML tags
  clean = clean.replace(/<img[^>]+alt=["']([^"']+)["'][^>]*>/gi, " $1 ");
  clean = clean.replace(/<img[^>]+title=["']([^"']+)["'][^>]*>/gi, " $1 ");
  
  // Standard strip and basic entities
  clean = clean.replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&oelig;/g, "œ")
    .replace(/&Oelig;/g, "Œ")
    .replace(/&eacute;/g, "é")
    .replace(/&Eacute;/g, "É")
    .replace(/&agrave;/g, "à")
    .replace(/&Agrave;/g, "À")
    .replace(/&egrave;/g, "è")
    .replace(/&Egrave;/g, "È")
    .replace(/&ugrave;/g, "ù")
    .replace(/&acirc;/g, "â")
    .replace(/&ecirc;/g, "ê")
    .replace(/&icirc;/g, "î")
    .replace(/&ocirc;/g, "ô")
    .replace(/&ucirc;/g, "û")
    .replace(/&ccedil;/g, "ç")
    .replace(/&#\d+;/g, "");
    
  return clean.replace(/\s+/g, " ").trim();
}

function extractStepNumbers(text: string): [number | undefined, number | undefined] {
  // Ignorer les numéros de guide (ex: [GP1], GP2) pour ne pas les confondre avec des étapes
  const cleanText = text.replace(/\[?GP\d+\]?/gi, "");
  const nums = cleanText.match(/\d+/g)?.map(Number) ?? [];
  if (nums.length === 0) return [undefined, undefined];
  if (nums.length === 1) return [nums[0], undefined];
  // Trouver le plus petit et le plus grand dans un contexte "étape X à Y"
  const etapePattern = /(?:étape|step|ǸtapeǸ?)\s*(\d+).*?(?:à|jusqu|to)\s*(?:l')?(?:étape\s*)?(\d+)/i;
  const m = cleanText.match(etapePattern);
  if (m) return [parseInt(m[1]), parseInt(m[2])];
  return [nums[0], nums[nums.length - 1] !== nums[0] ? nums[nums.length - 1] : undefined];
}

/**
 * Normalise les chemins d'images et force referrerpolicy="no-referrer" pour contourner le hotlinking
 */
export function fixBrokenImages(html: string | null): string {
  if (!html) return "";
  const parts = html.split(/(<[^>]+>)/g);
  const processed = parts.map(part => {
    if (part.startsWith('<') && part.toLowerCase().startsWith('<img')) {
      let tagContent = part;
      // Force referrerpolicy="no-referrer" to bypass hotlinking protection on imgur/dofuspourlesnoobs
      if (!/referrerpolicy=/i.test(tagContent)) {
        tagContent = tagContent.replace(/<img/i, '<img referrerpolicy="no-referrer"');
      }
      return tagContent.replace(/src=["']?([^"']+)["']?/i, (match, src) => {
        const lowerSrc = src.toLowerCase();
        let targetSrc = src;

        if (lowerSrc === 'quest' || lowerSrc.includes('icon_quest.png')) {
          targetSrc = "https://ganymede-app.com/images/icon_quest.png";
        } else if (lowerSrc === 'dungeon' || lowerSrc.includes('icon_dungeon.png')) {
          targetSrc = "https://ganymede-app.com/images/icon_dungeon.png";
        } else if (lowerSrc === 'guidestep' || lowerSrc.includes('guides.png')) {
          targetSrc = "https://ganymede-app.com/images/texteditor/guides.png";
        } else if (lowerSrc === 'monster' || lowerSrc.includes('icon_monster.png')) {
          targetSrc = "https://ganymede-app.com/images/icon_monster.png";
        } else if (lowerSrc.includes('gyazo.com/0a5cd701d47079078cad5f59fe91e700')) {
          targetSrc = "https://ganymede-app.com/images/ganymede-logo.webp";
        }

        // Proxy external hosts known to block hotlinking
        const targetLower = targetSrc.toLowerCase();
        if (
          targetLower.includes("imgur.com") ||
          targetLower.includes("dofuspourlesnoobs.com") ||
          targetLower.includes("dofusbook.net") ||
          targetLower.includes("d-bk.net") ||
          targetLower.includes("ankama.com")
        ) {
          return `src="/api/proxy-image?url=${encodeURIComponent(targetSrc)}"`;
        }

        return `src="${targetSrc}"`;
      });
    }
    return part;
  });
  return processed.join("");
}


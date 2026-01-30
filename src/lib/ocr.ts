/**
 * OCR Service for Dofus Screenshot Analysis
 * Uses Tesseract.js for text recognition
 * 
 * SMART VALIDATION: Validates screenshots against specific mission requirements
 * 
 * NOTE: Tesseract.js is dynamically imported to avoid Next.js App Router issues
 */

import sharp from "sharp";
import { MissionCategory } from "@prisma/client";

// --- Types ---

export type MissionPayload = {
    // DONJON
    dungeonName?: string;
    bossName?: string;
    // REGULATION
    monsterName?: string;
    quantity?: number;

    // ANOMALIE
    type?: "ZONE" | "BOSS";
    levelRange?: string;
    // SONGES
    difficulty?: string;        // "Rêve", "Paradoxe", "Cauchemar"
    songesLevel?: string;       // "I", "II", "III", "IV" (Roman numeral)
    palier?: number;            // Target floor/palier (1, 2, 3, 4, 5)
    tier?: number;              // Alias for palier (used in Songes mission forms)
    level?: string | number;
    // EXPEDITION
    mode?: string;
    // EVENT
    description?: string;
    title?: string;
    // ENRICHED (passed from upload route)
    missionTitle?: string;      // Full mission title for auto-extraction
};

export type OcrValidation = {
    isValid: boolean;           // Did the screenshot match the mission?
    score: number;              // 0-100 confidence score
    categoryMatch: boolean;     // Does it match the mission category?
    contentMatch: boolean;      // Does it contain mission-specific content?
    victoryDetected: boolean;   // Was victory/completion detected?
    matchedElements: string[];  // List of matched elements
    missingElements: string[];  // What was expected but not found
    rawText: string;            // Full OCR text for debugging
    confidence: number;         // Tesseract confidence
};

// --- Base Patterns ---

const VICTORY_PATTERNS = [
    /victoire/i,
    /a remporté le combat/i,
    /combat terminé/i,
    /vous avez gagné/i,
    /fin du combat/i,
    /mission\s*validée/i,
    /quête\s*terminée/i,
    /succès\s*déverrouillé/i,
    /étape\s*de\s*mission/i,
];

const DUNGEON_PATTERNS = [
    /donjon/i,
    /salle\s*\d+/i,
    /boss\s*vaincu/i,
    /terminé/i,
];

const ANOMALY_PATTERNS = [
    /anomalie/i,
    /élixir\s*uchronique/i,
    /uchronique/i,
    /dimension\s*parallèle/i,
    /distorsion/i,
];

const SONGES_PATTERNS = [
    /songes?\s*infinis?/i,
    /étage\s*\d+/i,
    /rêve/i,
    /paradoxe/i,
    /cauchemar/i,
    /puits\s*des\s*songes/i,
];

const EXPEDITION_PATTERNS = [
    /expédition/i,
    /bravoure/i,
    /audace/i,
    /guilde/i,
];

const COMBAT_PATTERNS = [
    /tour\s*\d+/i,
    /lance\s+/i,
    /subit\s*\d+/i,
    /perd\s*\d+\s*pv/i,
    /points?\s*de\s*vie/i,
];

// --- Main Analysis Function ---

// --- Color Analysis ---

/**
 * Detect Green Validation Indicator (Dofus UI)
 * Scans the EDGES/BORDERS of the card to detect the green validation veil
 * Avoids the center where difficulty icons (red/purple/blue) are located
 */
async function detectGreenCheckmark(buffer: Buffer): Promise<boolean> {
    try {
        const image = sharp(buffer);
        const { width, height } = await image.metadata();

        if (!width || !height) return false;

        const rawBuffer = await image
            .ensureAlpha()
            .raw()
            .toBuffer();

        let greenPixelCount = 0;
        let sampledPixels = 0;

        // Define edge margins (15% of each dimension)
        const marginX = Math.floor(width * 0.15);
        const marginY = Math.floor(height * 0.15);

        // Scan only edge regions (top, bottom, left, right strips)
        // This avoids the center where difficulty icons are
        for (let y = 0; y < height; y += 2) {
            for (let x = 0; x < width; x += 2) {
                // Check if pixel is in edge region
                const isTopEdge = y < marginY;
                const isBottomEdge = y > height - marginY;
                const isLeftEdge = x < marginX;
                const isRightEdge = x > width - marginX;

                if (isTopEdge || isBottomEdge || isLeftEdge || isRightEdge) {
                    const i = (y * width + x) * 4;
                    const r = rawBuffer[i];
                    const g = rawBuffer[i + 1];
                    const b = rawBuffer[i + 2];

                    sampledPixels++;

                    // TEAL/TURQUOISE Detection (Dofus validated card indicator)
                    // Relaxed: g>100, b>100, both dominate red by 1.1x
                    const isBrightTeal = g > 100 && b > 100 && g > r * 1.1 && b > r * 1.1 && Math.abs(g - b) < 80;

                    // Muted Teal/Green (darker shades on card borders - very relaxed)
                    const isMutedTeal = g > 50 && b > 50 && g > r && b > r && Math.abs(g - b) < 60;

                    // GREEN Detection (validation veil - very relaxed for subtle greens)
                    // Just needs green to be dominant channel
                    const isGreenDominant = g > 60 && g > r && g > b;

                    // Also catch any cyan-ish color
                    const isCyanish = (g + b) > (r * 2.5) && g > 50 && b > 50;

                    if (isBrightTeal || isMutedTeal || isGreenDominant || isCyanish) {
                        greenPixelCount++;
                    }
                }
            }
        }

        const validationColorRatio = sampledPixels > 0 ? greenPixelCount / sampledPixels : 0;
        console.log(`[OCR] Validation Color Ratio (Edges): ${(validationColorRatio * 100).toFixed(2)}% (${greenPixelCount}/${sampledPixels})`);

        // Require at least 0.5% green coverage in edge regions (relaxed from 1%)
        return validationColorRatio > 0.005;
    } catch (e) {
        console.error("[OCR] Color analysis failed:", e);
        return false;
    }
}

// --- Main Analysis Function ---

/**
 * Analyze a screenshot and validate it against a specific mission
 */
export async function analyzeMissionScreenshot(
    imageBuffer: Buffer,
    missionCategory: MissionCategory,
    missionPayload: MissionPayload
): Promise<OcrValidation> {
    try {
        console.log(`[OCR] Starting analysis for ${missionCategory} mission...`);

        // Parallel execution: Text + Color
        const [ocrResult, hasGreenCheck] = await Promise.all([
            (async () => {
                try {
                    const Tesseract = await import("tesseract.js");
                    // Optimize specifically for Tesseract (Grayscale + Contrast)
                    const optimizedBuffer = await sharp(imageBuffer)
                        .grayscale()
                        .linear(1.1, 0)
                        .resize({ width: 2000, withoutEnlargement: true })
                        .toFormat('png')
                        .toBuffer();

                    return await Tesseract.default.recognize(optimizedBuffer, "fra", {
                        gzip: true,
                        langPath: "https://tessdata.projectnaptha.com/4.0.0_best",
                    });
                } catch (e) {
                    console.error("[OCR] Tesseract Error:", e);
                    return null;
                }
            })(),
            detectGreenCheckmark(imageBuffer)
        ]);

        let rawText = "";
        let confidence = 0;

        if (ocrResult) {
            rawText = ocrResult.data.text;
            confidence = ocrResult.data.confidence;
            console.log(`[OCR] Text extracted (${rawText.length} chars), confidence: ${confidence}%`);
        } else {
            // Fallback if OCR fails but maybe color check passed? 
            // Ideally we need both implies OCR is partial? 
            // Let's stick to standard flow
        }

        console.log(`[OCR] Raw Text Preview: ${rawText.substring(0, 100).replace(/\n/g, ' ')}...`);

        const textLower = rawText.toLowerCase();

        // Validate based on mission type
        const validation = validateByCategory(
            missionCategory,
            missionPayload,
            textLower,
            rawText
        );

        // Add Color Validation to Result
        if (hasGreenCheck) {
            validation.matchedElements.push("Indicateur visuel vert (Validation)");
        } else if (!validation.victoryDetected) {
            // Only report "Missing visual" if we also missed victory text
            validation.missingElements.push("Preuve visuelle (Vert) ou Texte de victoire manquants");
        }

        // --- STRICT VALIDATION LOGIC ---
        // Valid if:
        // 1. Victory Text + Content Match (Classic proof)
        // 2. OR: Green Visual + Content Match (Monster Name OR Level)
        // NOTE: Category Match alone is NOT sufficient! Must verify specific content.

        const isClassicVictory = validation.victoryDetected && validation.contentMatch;
        // STRICT: Green Check + CONTENT (not just category)
        const isCheckedCard = hasGreenCheck && validation.contentMatch;

        const isLogicValid = isClassicVictory || isCheckedCard;

        // Calculate final score
        const score = calculateScore(validation, confidence, hasGreenCheck);

        // Force isValid if logic passes and score is decent
        const isValid = isLogicValid && score >= 60;

        return {
            ...validation,
            score,
            rawText,
            confidence,
            isValid
        };

    } catch (error) {
        console.error("[OCR] Error:", error);
        return {
            isValid: false,
            score: 0,
            categoryMatch: false,
            contentMatch: false,
            victoryDetected: false,
            matchedElements: [],
            missingElements: ["OCR processing failed", (error as any)?.message],
            rawText: "",
            confidence: 0,
        };
    }
}

// ... patterns remain same ...

// --- Score Calculation Update ---

function calculateScore(
    validation: Omit<OcrValidation, "score" | "rawText" | "confidence" | "isValid">,
    ocrConfidence: number,
    hasGreenCheck: boolean = false
): number {
    let score = 0;

    // Victory or Green Check is worth 30 points
    if (validation.victoryDetected || hasGreenCheck) score += 30;

    // Category match is worth 25 points
    if (validation.categoryMatch) score += 25;

    // Content match is worth 35 points
    if (validation.contentMatch) score += 35;

    // Each matched element adds points (up to 10 extra)
    const extraPoints = Math.min(validation.matchedElements.length * 2, 10);
    score += extraPoints;

    // Penalize for missing elements
    const penalty = Math.min(validation.missingElements.length * 5, 20);
    score = Math.max(0, score - penalty);

    // Factor in OCR confidence
    // Smart adjustment: If we have solid logic proofs, trust them
    if (ocrConfidence < 50) {
        if (validation.victoryDetected || hasGreenCheck) {
            // Strong visual proof -> Minimal penalty even if text confidence is low
            // ONLY boost if we also have CONTENT match (not just category!)
            if (hasGreenCheck && validation.contentMatch) {
                score = Math.max(score, 75);
            }
            score = Math.round(score * 0.95);
        } else {
            // Weak proof -> Full penalty
            score = Math.round(score * (ocrConfidence / 100));
        }
    } else {
        // High confidence, ONLY boost if we have CONTENT match
        if (hasGreenCheck && validation.contentMatch) {
            score = Math.max(score, 80);
        }
    }

    return Math.min(100, Math.max(0, score));
}

// --- Category-Specific Validation ---

function validateByCategory(
    category: MissionCategory,
    payload: MissionPayload,
    textLower: string,
    rawText: string
): Omit<OcrValidation, "score" | "rawText" | "confidence" | "isValid"> {
    const matchedElements: string[] = [];
    const missingElements: string[] = [];

    // Check victory first (required for all mission types)
    const victoryDetected = VICTORY_PATTERNS.some(p => p.test(rawText));
    if (victoryDetected) {
        matchedElements.push("Victoire détectée");
    } else {
        missingElements.push("Victoire non détectée");
    }

    // Check combat context
    const hasCombatContext = COMBAT_PATTERNS.some(p => p.test(rawText));
    if (hasCombatContext) {
        matchedElements.push("Contexte de combat");
    }

    let categoryMatch = false;
    let contentMatch = false;

    switch (category) {
        case "DONJON":
            ({ categoryMatch, contentMatch } = validateDonjon(
                payload, textLower, rawText, matchedElements, missingElements
            ));
            break;

        case "REGULATION":
            ({ categoryMatch, contentMatch } = validateRegulation(
                payload, textLower, rawText, matchedElements, missingElements
            ));
            break;

        case "ANOMALIE":
            ({ categoryMatch, contentMatch } = validateAnomalie(
                payload, textLower, rawText, matchedElements, missingElements
            ));
            break;

        case "SONGES":
            ({ categoryMatch, contentMatch } = validateSonges(
                payload, textLower, rawText, matchedElements, missingElements
            ));
            break;

        case "EXPEDITION":
            ({ categoryMatch, contentMatch } = validateExpedition(
                payload, textLower, rawText, matchedElements, missingElements
            ));
            break;

        case "EVENT":
            // Events are more flexible - just need victory
            categoryMatch = true;
            contentMatch = victoryDetected;
            if (payload.description) {
                const keywords = extractKeywords(payload.description);
                const foundKeyword = keywords.some(k => textLower.includes(k.toLowerCase()));
                if (foundKeyword) {
                    matchedElements.push("Mots-clés événement trouvés");
                    contentMatch = true;
                }
            }
            break;
    }

    return {
        categoryMatch,
        contentMatch,
        victoryDetected,
        matchedElements,
        missingElements,
    };
}

// --- Dungeon Validation ---

function validateDonjon(
    payload: MissionPayload,
    textLower: string,
    rawText: string,
    matched: string[],
    missing: string[]
): { categoryMatch: boolean; contentMatch: boolean } {
    let categoryMatch = false;
    let contentMatch = false;

    // Check for dungeon context
    if (DUNGEON_PATTERNS.some(p => p.test(textLower))) {
        categoryMatch = true;
        matched.push("Contexte donjon");
    } else {
        missing.push("Contexte donjon non détecté");
    }

    // Check for boss name
    if (payload.bossName) {
        const bossNameNormalized = normalizeText(payload.bossName);
        if (textLower.includes(bossNameNormalized)) {
            contentMatch = true;
            matched.push(`Boss "${payload.bossName}" détecté`);
        } else {
            missing.push(`Boss "${payload.bossName}" non trouvé`);
        }
    }

    // Check for dungeon name
    if (payload.dungeonName) {
        const dungeonNormalized = normalizeText(payload.dungeonName);
        if (textLower.includes(dungeonNormalized)) {
            contentMatch = true;
            matched.push(`Donjon "${payload.dungeonName}" détecté`);
        } else if (!payload.bossName) {
            missing.push(`Donjon "${payload.dungeonName}" non trouvé`);
        }
    }

    // Check for Level (Strong indicator for all mission types)
    if (payload.level) {
        const expectedLevel = parseInt(payload.level.toString());
        const levelMatch = rawText.match(/niv(?:eau|\.)?\s*(\d+)/i);
        if (levelMatch && parseInt(levelMatch[1]) === expectedLevel) {
            matched.push(`Niveau ${expectedLevel} confirmé`);
            contentMatch = true;
        }
    }

    // Check description keywords if provided
    if (payload.description) {
        const keywords = extractKeywords(payload.description);
        const foundKeyword = keywords.some(k => textLower.includes(k.toLowerCase()));
        if (foundKeyword) {
            matched.push("Description correspondante");
            contentMatch = true;
        }
    }

    return { categoryMatch, contentMatch };
}

// --- Regulation Validation ---

function validateRegulation(
    payload: MissionPayload,
    textLower: string,
    rawText: string,
    matched: string[],
    missing: string[]
): { categoryMatch: boolean; contentMatch: boolean } {
    const categoryMatch = true; // Regulation doesn't need specific category markers
    let contentMatch = false;

    // Check for monster name
    if (payload.monsterName) {
        const monsterNormalized = normalizeText(payload.monsterName);
        if (textLower.includes(monsterNormalized)) {
            contentMatch = true;
            matched.push(`Monstre "${payload.monsterName}" détecté`);
        } else {
            // Don't fail immediately, check level
            missing.push(`Monstre "${payload.monsterName}" non trouvé`);
        }
    }

    // Check for Level (Strong indicator)
    if (payload.level) {
        const expectedLevel = parseInt(payload.level.toString());
        // Look for "Niv. 140" or "Niveau 140"
        const levelMatch = rawText.match(/niv(?:eau|\.)?\s*(\d+)/i);
        if (levelMatch && parseInt(levelMatch[1]) === expectedLevel) {
            matched.push(`Niveau ${expectedLevel} confirmé`);
            contentMatch = true; // Trust level match as content match
        }
    }

    // For regulation, combat context is important
    if (COMBAT_PATTERNS.some(p => p.test(textLower))) {
        matched.push("Combat contre monstres");
    }

    // Check description keywords if provided
    if (payload.description) {
        const keywords = extractKeywords(payload.description);
        const foundKeyword = keywords.some(k => textLower.includes(k.toLowerCase()));
        if (foundKeyword) {
            matched.push("Description correspondante");
            contentMatch = true;
        }
    }

    return { categoryMatch, contentMatch };
}

// --- Anomalie Validation ---

function validateAnomalie(
    payload: MissionPayload,
    textLower: string,
    rawText: string,
    matched: string[],
    missing: string[]
): { categoryMatch: boolean; contentMatch: boolean } {
    let categoryMatch = false;
    let contentMatch = false;

    // Must detect anomaly/uchronique context
    if (ANOMALY_PATTERNS.some(p => p.test(rawText))) {
        categoryMatch = true;
        contentMatch = true;
        matched.push("Contexte Anomalie/Uchronique détecté");
    } else {
        missing.push("Élixir Uchronique ou Anomalie non détecté");
    }

    // Check level range if specified
    if (payload.levelRange) {
        const levelMatch = rawText.match(/niveau\s*(\d+)/i);
        if (levelMatch) {
            matched.push(`Niveau ${levelMatch[1]} détecté`);
        }
    }

    // For BOSS type, need victory
    if (payload.type === "BOSS") {
        missing.push("Gardien d'anomalie requis");
    }

    return { categoryMatch, contentMatch };
}

// --- Songes Validation ---

function validateSonges(
    payload: MissionPayload,
    textLower: string,
    rawText: string,
    matched: string[],
    missing: string[]
): { categoryMatch: boolean; contentMatch: boolean } {
    let categoryMatch = false;
    let contentMatch = false;

    // Must detect Songes Infinis context
    if (SONGES_PATTERNS.some(p => p.test(rawText))) {
        categoryMatch = true;
        matched.push("Contexte Songes Infinis détecté");
    } else {
        missing.push("Songes Infinis non détecté");
    }

    // Auto-extract difficulty + level from mission title if not provided in payload
    let expectedDifficulty = payload.difficulty;
    let expectedLevel = payload.songesLevel;
    // tier is the actual field used in Songes mission forms (palier is alias)
    let expectedPalier = payload.palier || payload.tier;

    if (payload.missionTitle) {
        const titleLower = payload.missionTitle.toLowerCase();

        // Extract difficulty + level: "Cauchemar II", "Paradoxe III", "Rêve I"
        const songesMatch = payload.missionTitle.match(/(Rêve|Paradoxe|Cauchemar)\s*(I{1,4}|IV)/i);
        if (songesMatch) {
            expectedDifficulty = expectedDifficulty || songesMatch[1];
            expectedLevel = expectedLevel || songesMatch[2].toUpperCase();
        }

        // Extract palier: "Palier 3" or "palier 2"
        const palierMatch = payload.missionTitle.match(/palier\s*(\d+)/i);
        if (palierMatch) {
            expectedPalier = expectedPalier || parseInt(palierMatch[1]);
        }
    }

    // Check for difficulty + level combo (e.g., "Cauchemar II", "Paradoxe III", "Rêve I")
    // OCR often misreads Roman numerals: II → I!, Il, 11, l1
    if (expectedDifficulty && expectedLevel) {
        const diffLower = expectedDifficulty.toLowerCase();

        // Build fuzzy patterns for Roman numerals
        const romanFuzzy: Record<string, string[]> = {
            'I': ['i', '1', 'l', '|'],
            'II': ['ii', 'i!', 'il', '11', 'l1', '1l', 'll'],
            'III': ['iii', 'i!!', 'ill', '111', 'lll', 'iil', 'i1i'],
            'IV': ['iv', '1v', 'lv']
        };

        const levelVariants = romanFuzzy[expectedLevel.toUpperCase()] || [expectedLevel.toLowerCase()];

        // Try all variants of the level - MUST use word boundary to prevent 'I' matching 'III'
        let levelFound = false;
        for (const variant of levelVariants) {
            // Word boundary \b ensures 'paradoxe i' doesn't match 'paradoxe iii'
            const pattern = new RegExp(`${diffLower}\\s*${variant}\\b`, 'i');
            if (pattern.test(textLower)) {
                levelFound = true;
                break;
            }
        }

        if (levelFound) {
            contentMatch = true;
            matched.push(`Songes "${expectedDifficulty} ${expectedLevel}" détecté`);
        } else {
            // Check if at least difficulty is present
            if (textLower.includes(diffLower)) {
                matched.push(`Difficulté "${expectedDifficulty}" trouvée (niveau non confirmé)`);
            }
            missing.push(`Niveau "${expectedDifficulty} ${expectedLevel}" non trouvé`);
            contentMatch = false;
        }
    } else if (expectedDifficulty) {
        // Fallback: just check difficulty
        const diffLower = expectedDifficulty.toLowerCase();
        if (textLower.includes(diffLower)) {
            contentMatch = true;
            matched.push(`Difficulté "${expectedDifficulty}" détectée`);
        } else {
            missing.push(`Difficulté "${expectedDifficulty}" non trouvée`);
        }
    }

    // Check for Palier/Floor number - WITH OCR TOLERANCE
    if (expectedPalier) {
        // OCR often misreads "Palier" as "Pole", "Polie", "Polier", etc.
        // Also match "Palier X" or just the number near similar words
        const palierVariants = ['palier', 'pole', 'polie', 'polier', 'pallier', 'pallie', 'étage'];

        let palierMatched = false;
        for (const variant of palierVariants) {
            // Match variant + number with word boundary to avoid "2" matching "21"
            const pattern = new RegExp(`${variant}[\\s.:]*${expectedPalier}\\b`, 'i');
            if (pattern.test(rawText)) {
                palierMatched = true;
                break;
            }
        }

        // Correct Songes palier stage names (from Dofus)
        const stageNames: Record<number, string[]> = {
            1: ["pensées oniriques", "oniriques", "pensées", "onirique"],
            2: ["balades fantastiques", "fantastiques", "balade", "fantastiqu"],
            3: ["espaces imaginaires", "imaginaires", "espaces", "imaginair"],
            4: ["concepts brumeux", "brumeux", "concepts", "brumeu"],
            5: ["abstractions chimériques", "chimériques", "abstractions", "chimérique", "abstraction"]
        };

        const stageKeywords = stageNames[expectedPalier] || [];
        const stageNameMatched = stageKeywords.some(kw => textLower.includes(kw.toLowerCase()));

        if (palierMatched || stageNameMatched) {
            matched.push(`Palier ${expectedPalier} confirmé`);
            // Palier match is good, keep contentMatch status
        } else {
            missing.push(`Palier ${expectedPalier} non trouvé`);
            contentMatch = false; // STRICT: Wrong palier = no content match
        }
    }

    // Fallback: detect any palier mentioned in proof for logging (only valid 1-5)
    const stageMatch = rawText.match(/(?:palier|pole|polier)\s*([1-5])\b/i);
    if (stageMatch) {
        const detectedPalier = parseInt(stageMatch[1]);
        if (detectedPalier >= 1 && detectedPalier <= 5) {
            matched.push(`Palier ${detectedPalier} détecté dans preuve`);
        }
    }

    return { categoryMatch, contentMatch };
}

// Helper to convert numbers to Roman numerals
function numberToRoman(num: number): string {
    const romanNumerals: [number, string][] = [
        [4, 'IV'], [3, 'III'], [2, 'II'], [1, 'I']
    ];
    for (const [value, numeral] of romanNumerals) {
        if (num === value) return numeral;
    }
    return num.toString();
}

// --- Expedition Validation ---

function validateExpedition(
    payload: MissionPayload,
    textLower: string,
    rawText: string,
    matched: string[],
    missing: string[]
): { categoryMatch: boolean; contentMatch: boolean } {
    let categoryMatch = false;
    let contentMatch = false;

    // Check for expedition context
    if (EXPEDITION_PATTERNS.some(p => p.test(rawText))) {
        categoryMatch = true;
        matched.push("Contexte Expédition détecté");
    } else {
        missing.push("Expédition non détectée");
    }

    // Check mode (Bravoure/Audace)
    if (payload.mode && payload.mode !== "AUCUN") {
        const modeNormalized = payload.mode.toLowerCase();
        if (textLower.includes(modeNormalized)) {
            contentMatch = true;
            matched.push(`Mode "${payload.mode}" détecté`);
        } else {
            missing.push(`Mode "${payload.mode}" non trouvé`);
        }
    }

    // Check boss name
    if (payload.bossName) {
        const bossNormalized = normalizeText(payload.bossName);
        if (textLower.includes(bossNormalized)) {
            contentMatch = true;
            matched.push(`Boss "${payload.bossName}" détecté`);
        } else {
            missing.push(`Boss "${payload.bossName}" non trouvé`);
        }
    }

    return { categoryMatch, contentMatch };
}

// --- Score Calculation ---



// --- Helpers ---

function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[^a-z0-9\s]/g, "")     // Remove special chars
        .trim();
}

function extractKeywords(text: string): string[] {
    // Extract meaningful words (ignore short words)
    return text
        .split(/\s+/)
        .filter(word => word.length > 3)
        .slice(0, 5);
}

// --- Legacy function for backwards compatibility ---

export async function analyzeScreenshot(
    imageBuffer: Buffer,
    _missionCategory?: string
): Promise<{
    score: number;
    matches: { category: string; patterns: string[] }[];
    rawText: string;
    confidence: number;
}> {
    try {
        // Dynamically import Tesseract
        const Tesseract = await import("tesseract.js");
        const result = await Tesseract.default.recognize(imageBuffer, "fra");
        const rawText = result.data.text;
        const confidence = result.data.confidence;

        const matches: { category: string; patterns: string[] }[] = [];

        if (VICTORY_PATTERNS.some(p => p.test(rawText))) {
            matches.push({ category: "victory", patterns: ["Victoire"] });
        }
        if (COMBAT_PATTERNS.some(p => p.test(rawText))) {
            matches.push({ category: "combat", patterns: ["Combat"] });
        }

        return {
            score: matches.length > 0 ? 50 : 0,
            matches,
            rawText,
            confidence,
        };
    } catch {
        return {
            score: 0,
            matches: [],
            rawText: "",
            confidence: 0,
        };
    }
}

/**
 * Check if a validation result should trigger auto-validation
 */
export function shouldAutoValidate(validation: OcrValidation): boolean {
    const threshold = parseInt(process.env.OCR_AUTO_VALIDATE_THRESHOLD || "70", 10);
    return validation.isValid && validation.score >= threshold;
}

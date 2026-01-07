/**
 * OCR Service for Dofus Screenshot Analysis
 * Uses Tesseract.js for text recognition
 * 
 * SMART VALIDATION: Validates screenshots against specific mission requirements
 * 
 * NOTE: Tesseract.js is dynamically imported to avoid Next.js App Router issues
 */

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
    difficulty?: string;
    level?: string;
    // EXPEDITION
    mode?: string;
    // EVENT
    description?: string;
    title?: string;
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

        let rawText = "";
        let confidence = 0;

        try {
            // Dynamically import Tesseract to avoid Next.js App Router module issues
            const Tesseract = await import("tesseract.js");

            // Try to run OCR with Tesseract
            const result = await Tesseract.default.recognize(imageBuffer, "fra", {
                logger: (m: any) => {
                    if (m.status === "recognizing text") {
                        console.log(`[OCR] Progress: ${Math.round((m.progress || 0) * 100)}%`);
                    }
                },
            });

            rawText = result.data.text;
            confidence = result.data.confidence;
            console.log(`[OCR] Text extracted (${rawText.length} chars), confidence: ${confidence}%`);
        } catch (ocrError) {
            // Tesseract failed (common in Next.js server environment)
            console.warn("[OCR] Tesseract failed, using fallback mode:", ocrError);
            console.log("[OCR] Image uploaded successfully but OCR unavailable - manual validation required");

            // Return a result that requires manual validation
            return {
                isValid: false,
                score: 0,
                categoryMatch: false,
                contentMatch: false,
                victoryDetected: false,
                matchedElements: [],
                missingElements: ["OCR indisponible - validation manuelle requise"],
                rawText: "",
                confidence: 0,
            };
        }

        const textLower = rawText.toLowerCase();

        // Validate based on mission type
        const validation = validateByCategory(
            missionCategory,
            missionPayload,
            textLower,
            rawText
        );

        // Calculate final score
        const score = calculateScore(validation, confidence);

        return {
            ...validation,
            score,
            rawText,
            confidence,
            isValid: score >= 70 && validation.victoryDetected && validation.categoryMatch,
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
            missingElements: ["OCR processing failed"],
            rawText: "",
            confidence: 0,
        };
    }
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
                payload, textLower, matchedElements, missingElements
            ));
            break;

        case "REGULATION":
            ({ categoryMatch, contentMatch } = validateRegulation(
                payload, textLower, matchedElements, missingElements
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
            // Only report missing if we don't have boss name
            missing.push(`Donjon "${payload.dungeonName}" non trouvé`);
        }
    }

    return { categoryMatch, contentMatch };
}

// --- Regulation Validation ---

function validateRegulation(
    payload: MissionPayload,
    textLower: string,
    matched: string[],
    missing: string[]
): { categoryMatch: boolean; contentMatch: boolean } {
    let categoryMatch = true; // Regulation doesn't need specific category markers
    let contentMatch = false;

    // Check for monster name
    if (payload.monsterName) {
        const monsterNormalized = normalizeText(payload.monsterName);
        if (textLower.includes(monsterNormalized)) {
            contentMatch = true;
            matched.push(`Monstre "${payload.monsterName}" détecté`);
        } else {
            missing.push(`Monstre "${payload.monsterName}" non trouvé`);
        }
    }

    // For regulation, combat context is important
    if (COMBAT_PATTERNS.some(p => p.test(textLower))) {
        matched.push("Combat contre monstres");
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

    // Check difficulty
    if (payload.difficulty) {
        const diffLower = payload.difficulty.toLowerCase();
        if (textLower.includes(diffLower)) {
            contentMatch = true;
            matched.push(`Difficulté "${payload.difficulty}" détectée`);
        } else {
            missing.push(`Difficulté "${payload.difficulty}" non trouvée`);
        }
    }

    // Check floor/stage
    const stageMatch = rawText.match(/étage\s*(\d+)/i);
    if (stageMatch) {
        matched.push(`Étage ${stageMatch[1]} détecté`);
        contentMatch = true;
    }

    return { categoryMatch, contentMatch };
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

function calculateScore(
    validation: Omit<OcrValidation, "score" | "rawText" | "confidence" | "isValid">,
    ocrConfidence: number
): number {
    let score = 0;

    // Victory is worth 30 points
    if (validation.victoryDetected) score += 30;

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

    // Factor in OCR confidence (if very low, reduce score)
    if (ocrConfidence < 50) {
        score = score * (ocrConfidence / 100);
    }

    return Math.round(Math.min(100, Math.max(0, score)));
}

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
        // Return empty result if Tesseract fails
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
    const threshold = parseInt(process.env.OCR_AUTO_VALIDATE_THRESHOLD || "95", 10);
    return validation.isValid && validation.score >= threshold;
}

/**
 * OCR Service for Dofus Screenshot Analysis
 * Uses Tesseract.js for text recognition
 */

import Tesseract from "tesseract.js";

// Dofus-specific patterns to detect in combat logs
const DOFUS_PATTERNS = {
    // Victory patterns
    victory: [
        /victoire/i,
        /a remporté le combat/i,
        /combat terminé/i,
        /vous avez gagné/i,
    ],
    // XP patterns
    xp: [
        /\+\s*\d+\s*points?\s*d['']expérience/i,
        /\d+\s*xp/i,
        /expérience\s*:\s*\d+/i,
    ],
    // Loot patterns
    loot: [
        /butin\s*récupéré/i,
        /vous avez obtenu/i,
        /\+\s*\d+\s*kamas?/i,
        /drop\s*:/i,
    ],
    // Dungeon patterns
    dungeon: [
        /donjon\s*terminé/i,
        /boss\s*vaincu/i,
        /vous avez terminé le donjon/i,
        /salle\s*\d+/i,
    ],
    // Anomaly patterns (Elixir Uchronique)
    anomaly: [
        /anomalie/i,
        /élixir\s*uchronique/i,
        /uchronique/i,
        /dimension\s*parallèle/i,
    ],
    // Combat log markers
    combat: [
        /tour\s*\d+/i,
        /passe\s*son\s*tour/i,
        /lance\s*/i,
        /subit\s*\d+\s*dégâts/i,
        /perd\s*\d+\s*pv/i,
        /récupère\s*\d+\s*pv/i,
    ],
    // Songes Infinis patterns
    songes: [
        /songes?\s*infinis?/i,
        /étage\s*\d+/i,
        /rêve/i,
        /paradoxe/i,
        /cauchemar/i,
    ],
    // Expedition patterns
    expedition: [
        /expédition/i,
        /bravoure/i,
        /audace/i,
        /contract\s*de\s*guilde/i,
    ],
};

export type OcrResult = {
    score: number; // 0-100 confidence score
    matches: {
        category: string;
        patterns: string[];
    }[];
    rawText: string;
    confidence: number; // Tesseract confidence
};

/**
 * Analyze an image for Dofus combat log patterns
 * @param imageBuffer - The image buffer to analyze
 * @param missionCategory - Optional: The mission category to prioritize patterns for
 */
export async function analyzeScreenshot(
    imageBuffer: Buffer,
    missionCategory?: string
): Promise<OcrResult> {
    try {
        // Run OCR with French language
        const result = await Tesseract.recognize(imageBuffer, "fra", {
            logger: (m) => {
                if (m.status === "recognizing text") {
                    console.log(`[OCR] Progress: ${Math.round((m.progress || 0) * 100)}%`);
                }
            },
        });

        const rawText = result.data.text;
        const confidence = result.data.confidence;

        // Find matching patterns
        const matches: OcrResult["matches"] = [];
        let totalPatterns = 0;
        let matchedPatterns = 0;

        for (const [category, patterns] of Object.entries(DOFUS_PATTERNS)) {
            const categoryMatches: string[] = [];

            for (const pattern of patterns) {
                totalPatterns++;
                const match = rawText.match(pattern);
                if (match) {
                    matchedPatterns++;
                    categoryMatches.push(match[0]);
                }
            }

            if (categoryMatches.length > 0) {
                matches.push({ category, patterns: categoryMatches });
            }
        }

        // Calculate score
        // Base score from pattern matching
        let score = (matchedPatterns / Math.min(totalPatterns, 10)) * 100;

        // Bonus for category-specific matches
        if (missionCategory) {
            const categoryKey = missionCategory.toLowerCase();
            const categoryMatch = matches.find(
                (m) => m.category.toLowerCase() === categoryKey
            );
            if (categoryMatch) {
                score = Math.min(100, score * 1.2); // 20% bonus
            }
        }

        // Victory or dungeon completion is a strong indicator
        const hasVictory = matches.some((m) => m.category === "victory");
        const hasDungeon = matches.some((m) => m.category === "dungeon");
        if (hasVictory || hasDungeon) {
            score = Math.min(100, score * 1.3); // 30% bonus
        }

        // Tesseract confidence factor
        score = score * (confidence / 100);

        return {
            score: Math.round(Math.min(100, Math.max(0, score))),
            matches,
            rawText,
            confidence,
        };
    } catch (error) {
        console.error("[OCR] Error:", error);
        return {
            score: 0,
            matches: [],
            rawText: "",
            confidence: 0,
        };
    }
}

/**
 * Check if a score meets the auto-validation threshold
 */
export function shouldAutoValidate(score: number): boolean {
    const threshold = parseInt(process.env.OCR_AUTO_VALIDATE_THRESHOLD || "95", 10);
    return score >= threshold;
}

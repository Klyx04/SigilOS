/**
 * LLM-based OCR Service using Google Gemini API
 * 
 * Uses Gemini 1.5 Flash for smart image analysis:
 * - Fast cloud-based inference (no local GPU needed)
 * - Excellent OCR capabilities for game screenshots
 * - Built-in content moderation
 * - Rate limit fallback to manual validation
 * 
 * @module lib/llm-ocr
 */

import { createHash } from 'crypto';
import sharp from 'sharp';

// =============================================================================
// TYPES
// =============================================================================

export interface OcrResult {
    success: boolean;

    // Extracted text content
    text: string;

    // Confidence score (0-100)
    confidence: number;

    // Did the model detect victory indicators?
    isVictory: boolean;

    // Content moderation flags
    moderation: {
        isAppropriate: boolean;
        reason?: string;
    };

    // Raw model response for debugging
    rawResponse?: string;

    // Error message if failed
    error?: string;
}

export interface OcrRequest {
    // Base64 encoded image data
    imageBase64: string;

    // MIME type (image/png, image/jpeg, image/webp)
    mimeType: string;

    // Optional context hint for better accuracy
    context?: 'mission' | 'achievement' | 'ladder';
}

// =============================================================================
// MISSION CROSS-VALIDATION TYPES
// =============================================================================

/**
 * Structured data extracted from a mission screenshot for cross-validation
 */
export interface ExtractedMissionData {
    // Common fields
    rank?: number;        // Rang 1-4
    level?: number;       // Niv. 180-200

    // REGULATION
    monsterName?: string; // "Brikoléreux"

    // ANOMALIE
    anomalieType?: 'ZONE' | 'BOSS';

    // SONGES
    songeDifficulty?: 'Rêve' | 'Paradoxe' | 'Cauchemar';
    songeLevel?: 'I' | 'II' | 'III' | 'IV';
    songeTier?: number;   // Palier 1-5

    // EXPEDITION
    dungeonName?: string;
    expeditionMode?: 'bravoure' | 'audace' | 'aucun';

    // Raw text for debugging
    rawText: string;
}

/**
 * Result of matching OCR content against expected mission payload
 */
export interface MissionMatchResult {
    isMatch: boolean;
    matchScore: number;     // 0-100
    matchedFields: string[]; // ["monsterName", "rank"]
    mismatchedFields: string[];
    reason?: string;
}

// =============================================================================
// CONFIGURATION & ENVIROMENT
// =============================================================================

const OCR_SPACE_API_KEY = process.env.OCR_SPACE_API_KEY || 'helloworld';
const OCR_SPACE_URL = 'https://api.ocr.space/parse/image';
const AUTO_VALIDATE_THRESHOLD = parseInt(process.env.OCR_AUTO_VALIDATE_THRESHOLD || '70', 10);

// Default timeout for OCR calls
const OCR_TIMEOUT_MS = 30000;

/**
 * Interface for OCR.space response
 */
interface OcrSpaceResponse {
    ParsedResults?: Array<{
        ParsedText: string;
        ErrorMessage?: string;
        ErrorDetails?: string;
    }>;
    IsErroredOnProcessing: boolean;
    ErrorMessage?: string[];
    ErrorDetails?: string;
    ProcessingTimeInMilliseconds?: string;
}


// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Call OCR.space API
 */
async function callOcrSpace(
    imageBase64: string,
    language: string = 'fre'
): Promise<string> {
    if (!OCR_SPACE_API_KEY) {
        throw new Error('OCR_SPACE_API_KEY is not configured');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);

    try {
        console.log('[LLM-OCR] Sending request to OCR.space:', {
            imageSize: imageBase64.length,
            language
        });

        // OCR.space expects base64 with data URI prefix or a multipart upload
        const formData = new URLSearchParams();
        formData.append('apikey', OCR_SPACE_API_KEY);
        formData.append('base64Image', `data:image/jpeg;base64,${imageBase64}`);
        formData.append('language', language);
        formData.append('isOverlayRequired', 'false');
        formData.append('OCREngine', '2'); // Engine 2 is usually better for numbers/tables

        const response = await fetch(OCR_SPACE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData,
            signal: controller.signal,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OCR.space API error: ${response.status} - ${errorText}`);
        }

        const result: OcrSpaceResponse = await response.json();

        if (result.IsErroredOnProcessing) {
            throw new Error(`OCR.space processing error: ${result.ErrorMessage?.join(', ') || 'Unknown error'}`);
        }

        const text = result.ParsedResults?.[0]?.ParsedText || '';
        console.log('[LLM-OCR] OCR.space extraction successful (length:', text.length, ')');

        return text;

    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Check if OCR service is configured
 */
export async function checkOcrHealth(): Promise<{
    available: boolean;
    error?: string;
}> {
    if (!OCR_SPACE_API_KEY || OCR_SPACE_API_KEY === 'helloworld') {
        return {
            available: false,
            error: 'OCR_SPACE_API_KEY not configured or using demo key',
        };
    }

    return {
        available: true,
    };
}

// =============================================================================
// MAIN OCR FUNCTION
// =============================================================================

/**
 * Analyze an image using Qwen2-VL vision model
 * 
 * @param request - Image data and context
 * @returns OCR result with text, confidence, and moderation flags
 */
export async function analyzeImage(request: OcrRequest): Promise<OcrResult> {
    // DEV MODE: Skip OCR when Ollama is not available
    const skipOcr = process.env.DEV_SKIP_OCR === 'true';
    if (skipOcr) {
        console.log('[LLM-OCR] DEV_SKIP_OCR enabled - returning mock result for manual validation');
        return {
            success: true,
            text: '[DEV MODE] OCR skipped - manual validation required',
            confidence: 0, // Low confidence forces manual validation
            isVictory: false,
            moderation: { isAppropriate: true },
            rawResponse: 'DEV_SKIP_OCR',
        };
    }

    try {
        // Optimize image (resize & compress) to reduce API payload
        const optimizedImage = await optimizeImage(request.imageBase64);

        // Call OCR.space instead of Gemini
        console.log('[LLM-OCR] Calling OCR.space with context:', request.context);
        const response = await callOcrSpace(optimizedImage, 'fre');

        console.log('[LLM-OCR] Raw text (first 500 chars):', response.substring(0, 500));

        // Parse the text response
        const parsed = parseModelResponse(response);

        console.log('[LLM-OCR] Parsed result:', {
            extractedText: parsed.extractedText.substring(0, 100),
            confidence: parsed.confidence,
            isVictory: parsed.isVictory
        });

        return {
            success: true,
            text: parsed.extractedText,
            confidence: parsed.confidence,
            isVictory: parsed.isVictory,
            moderation: {
                isAppropriate: parsed.isAppropriate,
                reason: parsed.inappropriateReason || undefined,
            },
            rawResponse: response,
        };

    } catch (error) {
        console.error('[LLM-OCR] Analysis failed:', error);

        // CONNECTION ERROR: Fallback to manual validation
        const isConnectionError = error instanceof Error &&
            (error.message.includes('ECONNREFUSED') ||
                error.message.includes('fetch failed') ||
                error.name === 'AbortError' ||
                error.message.includes('aborted') ||
                error.message.includes('timeout'));

        if (isConnectionError) {
            console.warn('[LLM-OCR] OCR Service unreachable - falling back to manual validation');
            return {
                success: true,
                text: '[OCR indisponible] Validation manuelle requise',
                confidence: 0,
                isVictory: false,
                moderation: { isAppropriate: true },
                error: 'OCR service unreachable - manual validation required',
            };
        }

        return {
            success: false,
            text: '',
            confidence: 0,
            isVictory: false,
            moderation: { isAppropriate: true },
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}


// =============================================================================
// RESPONSE PARSING
// =============================================================================

interface ParsedModelResponse {
    extractedText: string;
    isVictory: boolean;
    victoryIndicators: string[];
    confidence: number;
    isAppropriate: boolean;
    inappropriateReason: string | null;
}

function parseModelResponse(rawResponse: string): ParsedModelResponse {
    const text = rawResponse.toLowerCase();

    // 1. EXTRACT SCORE (Dofus Success Points)
    // Goal: Handle "7 704", "15000", and "7 7049" (where 9 is a trophy)

    // Clean text: replace commas/dots often read as thousand separators by spaces
    const cleanRaw = rawResponse.replace(/[,]/g, ' ').replace(/\./g, ' ');

    // Find all digit groups
    const digitGroups = cleanRaw.match(/\d+/g) || [];

    const candidates: number[] = [];

    // Case A: Number is split by space (e.g., "7 704")
    for (let i = 0; i < digitGroups.length - 1; i++) {
        const combined = digitGroups[i] + digitGroups[i + 1];
        const val = parseInt(combined, 10);
        if (val > 0 && val < 300000) candidates.push(val);
    }

    // Case B: Simple numbers
    digitGroups.forEach(g => {
        const val = parseInt(g, 10);
        if (val > 0) candidates.push(val);
    });

    // Case C: Full string of digits (ignoring everything else)
    const allDigits = rawResponse.replace(/[^\d]/g, '');
    if (allDigits) candidates.push(parseInt(allDigits, 10));

    // Filter and sanitize candidates based on Dofus max score (~23,000)
    const MAX_DOFUS_SCORE = 24000;

    let bestScore = 0;
    candidates.forEach(score => {
        let s = score;

        // TROPHY ICON FIX: if score is > MAX and ends with a digit, 
        // it's likely the trophy icon was read as a digit (e.g., 7704 + 🏆(9) = 77049)
        if (s > MAX_DOFUS_SCORE && s < MAX_DOFUS_SCORE * 10) {
            const truncated = Math.floor(s / 10);
            if (truncated > 0 && truncated <= MAX_DOFUS_SCORE) {
                s = truncated;
            }
        }

        if (s > 0 && s <= MAX_DOFUS_SCORE) {
            if (s > bestScore) bestScore = s;
        }
    });

    // 2. DETECT VICTORY (Missions)
    const victoryKeywords = [
        'success', 'succes', 'succès',
        'victory', 'victoire',
        'unlocked', 'déverrouillé',
        'achieved', 'accompli',
        'terminé', 'valide', 'validé'
    ];
    const foundIndicators = victoryKeywords.filter(kw => text.includes(kw));
    let isVictory = foundIndicators.length > 0;

    // 3. CALC CONFIDENCE
    let confidence = 0;

    // Base confidence if we found a plausible score
    if (bestScore > 0) {
        confidence += 40; // Base score (not enough for auto-validate)
    }

    // Context Keywords (Dofus UI elements)
    // Finding these proves it's likely a real screenshot and not MS Paint
    const contextKeywords = [
        // UI Headers
        'success', 'succes', 'succès', 'points', 'total',
        'niveau', 'level', 'rang', 'rank', 'compte', 'account',
        'serveur', 'server', 'xp', 'kamas', 'ladder',
        // Classes
        'feca', 'osamodas', 'enutrof', 'sram', 'xelor', 'ecaflip',
        'eniripsa', 'iop', 'cra', 'sadida', 'sacrieur', 'pandawa',
        'roublard', 'zobal', 'steamer', 'eliotrope', 'huppermage', 'ouginak', 'forgelance',
        // Servers
        'draconiros', 'tal kasha', 'hell mina', 'imagiro',
        'orukam', 'tylezia', 'ombre', 'shadow',
        // Missions - General
        'rang', 'rank', 'niv', 'niveau', 'level', 'vaincre', 'monstres',
        // Missions - Types
        'anomalie', 'gardien', 'donjon', 'zone', // Anom
        'régulation', 'regulation', 'brikoléreux', 'sanguinaires', // Regulation
        'expédition', 'expedition', 'bravoure', 'audace', // Expedition
        'songe', 'dream', 'rêve', 'reve', 'paradoxe', 'cauchemar', // Songes
        'palier', 'pensées', 'pensees', 'balades', 'espaces', 'concepts', 'abstractions' // Songes Paliers
    ];

    const foundContext = contextKeywords.filter(kw => text.includes(kw));
    const hasContext = foundContext.length > 0;

    // Detect if valid Mission Context specifically (Rang/Niv/Vaincre...)
    // To avoid confusing "1000 XP" with "1000 Success Points"
    const missionSpecificKeywords = [
        'rang', 'rank', 'niv', 'niveau', 'level', 'vaincre', 'monstres',
        'anomalie', 'gardien', 'donjon', 'zone',
        'régulation', 'regulation',
        'expédition', 'expedition',
        'songe', 'dream', 'rêve', 'reve', 'paradoxe', 'cauchemar',
        'palier'
    ];
    const hasMissionContext = missionSpecificKeywords.some(kw => text.includes(kw));

    // Extract Mission Details for Manual Review (Rang/Niv)
    const rankMatch = text.match(/rang\s*(\d+)/i);
    const levelMatch = text.match(/niv\.?\s*(\d+)/i);
    let extraInfo = "";
    if (rankMatch) extraInfo += ` | Rang: ${rankMatch[1]}`;
    if (levelMatch) extraInfo += ` | Niv: ${levelMatch[1]}`;

    // Songes Specifics (Difficulty & Floor)
    // Matches: "Paradoxe III", "Rêve I", etc.
    const songeDiffMatch = text.match(/(rêve|reve|paradoxe|cauchemar)\s*(i{1,3}|iv|v)\b/i);
    if (songeDiffMatch) extraInfo += ` | Diff: ${songeDiffMatch[1]} ${songeDiffMatch[2].toUpperCase()}`;

    const songeFloorMatch = text.match(/palier\s*(\d+|i{1,3}|iv|v)/i);
    if (songeFloorMatch) extraInfo += ` | Palier: ${songeFloorMatch[1]}`;

    // Expedition Specifics (Mode)
    if (text.includes('bravoure')) extraInfo += ` | Mode: Bravoure`;
    else if (text.includes('audace')) extraInfo += ` | Mode: Audace`;

    // Victory keywords are decent indicators (Keep generic ones like "Terminé")
    if (isVictory) {
        confidence += 30;
    }

    // Boost confidence if we find Mission Keywords
    // NOTE: We do NOT validate based on 'Progression' (0/50) as it's unreliable.
    // If we identify it's a valid Mission Screenshot, we give high confidence 
    // to confirm it's a Dofus image, but Validation might still depend on human review 
    // unless we find explicit "Success" text.
    if ((bestScore > 0 || hasContext) && hasContext) {
        confidence += 50;
        // 40 (Base) + 50 = 90 (High Confidence it's a Mission Image)
        // But is it COMPLETED? Hard to say without the checkmark color.
        // We will return it as "High Confidence Image" and let the Server Action decided 
        // if it auto-validates based on this confidence.
    }

    const finalConfidence = Math.min(100, confidence);

    // DETERMINING VICTORY STATUS
    // 1. If it's a Mission (hasMissionContext):
    //    - We IGNORE bestScore (could be XP/Kamas).
    //    - We rely ONLY on explicit victory keywords (Terminé, Validé...) or Manual Review.
    // 2. If it's NOT a Mission (Standard Success Sheet):
    //    - We accept bestScore > 0 as a victory indicator (Success Points).
    let finalIsVictory = isVictory;
    if (!hasMissionContext && bestScore > 0) {
        finalIsVictory = true;
    }

    return {
        extractedText: (bestScore > 0 ? `Points: ${bestScore}\n` : '') +
            `Brut: ${rawResponse}\n` +
            (extraInfo ? `Detected: ${extraInfo}` : ''),
        isVictory: finalIsVictory,
        victoryIndicators: foundIndicators,
        confidence: finalConfidence,
        isAppropriate: true,
        inappropriateReason: null,
    };
}

// =============================================================================
// IMAGE HASHING (Anti-Duplicate)
// =============================================================================

/**
 * Generate SHA-256 hash of image data for duplicate detection
 */
export function hashImage(imageBase64: string): string {
    return createHash('sha256').update(imageBase64).digest('hex');
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Check if the OCR result meets auto-validation criteria
 */
export function shouldAutoValidate(result: OcrResult): {
    autoValidate: boolean;
    reason: string;
} {
    // Content moderation check first
    if (!result.moderation.isAppropriate) {
        return {
            autoValidate: false,
            reason: `Contenu inapproprié détecté: ${result.moderation.reason || 'Non spécifié'}`
        };
    }

    // Check if OCR succeeded
    if (!result.success) {
        return { autoValidate: false, reason: 'Échec de l\'analyse de l\'image' };
    }

    // Check confidence threshold
    if (result.confidence < AUTO_VALIDATE_THRESHOLD) {
        return {
            autoValidate: false,
            reason: `Score de confiance insuffisant (${result.confidence}% < ${AUTO_VALIDATE_THRESHOLD}%)`
        };
    }

    // Check for victory indicators
    if (!result.isVictory) {
        return {
            autoValidate: false,
            reason: 'Aucun indicateur de victoire détecté'
        };
    }

    return {
        autoValidate: true,
        reason: `Auto-validé avec ${result.confidence}% de confiance`
    };
}

export function getAutoValidateThreshold(): number {
    return AUTO_VALIDATE_THRESHOLD;
}

/**
 * Optimize image for Ollama (Resize & Compress)
 * - Resize to max 1024x1024 (Moondream works well with this resolution)
 * - Convert to JPEG (smaller payload than PNG/WebP)
 * - Remove metadata
 */
async function optimizeImage(base64Image: string): Promise<string> {
    try {
        // Remove data URL prefix if present
        const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        const originalSize = buffer.length;

        // Process with sharp
        const optimizedBuffer = await sharp(buffer)
            .resize({
                width: 1024,
                height: 1024,
                fit: 'inside', // Maintain aspect ratio
                withoutEnlargement: true // Don't upscale small images
            })
            .jpeg({
                quality: 80, // Good balance of quality/size
                mozjpeg: true // Better compression
            })
            .toBuffer();

        const newSize = optimizedBuffer.length;
        const reduction = Math.round((1 - newSize / originalSize) * 100);

        console.log(`[LLM-OCR] Image optimized: ${Math.round(originalSize / 1024)}KB -> ${Math.round(newSize / 1024)}KB (-${reduction}%)`);

        return optimizedBuffer.toString('base64');
    } catch (error) {
        console.warn('[LLM-OCR] Image optimization failed, using original:', error);
        return base64Image; // Fallback to original if sharp fails
    }
}

// =============================================================================
// MISSION CROSS-VALIDATION (Anti-Fraud)
// =============================================================================

/**
 * Extract structured mission data from raw OCR text
 */
export function extractMissionDetails(rawText: string): ExtractedMissionData {
    const text = rawText.toLowerCase();

    const result: ExtractedMissionData = {
        rawText: rawText
    };

    // --- COMMON FIELDS ---
    // Rang (1-4)
    const rankMatch = text.match(/rang\s*(\d+)/i);
    if (rankMatch) result.rank = parseInt(rankMatch[1], 10);

    // Niveau (50-200)
    const levelMatch = text.match(/niv\.?\s*(\d+)/i);
    if (levelMatch) result.level = parseInt(levelMatch[1], 10);

    // --- REGULATION ---
    // Look for monster names (usually after "Vaincre 50" or before "sur leur territoire")
    const monsterMatch = rawText.match(/vaincre\s+\d+\s+(?:monstres\s+de\s+)?([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[a-zà-ÿ]+)?)/i);
    if (monsterMatch) result.monsterName = monsterMatch[1].trim();

    // Alternative: Look for known monster patterns (capitalized word after number)
    if (!result.monsterName) {
        const altMonsterMatch = rawText.match(/50\s+([A-ZÀ-Ÿ][a-zà-ÿ]+)/);
        if (altMonsterMatch) result.monsterName = altMonsterMatch[1].trim();
    }

    // --- ANOMALIE ---
    if (text.includes('anomalie')) {
        if (text.includes('boss') || text.includes('gardien')) {
            result.anomalieType = 'BOSS';
        } else if (text.includes('zone') || text.includes('monstres')) {
            result.anomalieType = 'ZONE';
        }
    }

    // --- SONGES ---
    // Difficulty + Level (Paradoxe III, Rêve I, etc.)
    const songeDiffMatch = text.match(/(rêve|reve|paradoxe|cauchemar)\s*(i{1,3}|iv)/i);
    if (songeDiffMatch) {
        const diffMap: Record<string, 'Rêve' | 'Paradoxe' | 'Cauchemar'> = {
            'rêve': 'Rêve', 'reve': 'Rêve',
            'paradoxe': 'Paradoxe',
            'cauchemar': 'Cauchemar'
        };
        result.songeDifficulty = diffMap[songeDiffMatch[1].toLowerCase()];
        result.songeLevel = songeDiffMatch[2].toUpperCase() as 'I' | 'II' | 'III' | 'IV';
    }

    // Palier/Tier (1-5)
    const palierMatch = text.match(/palier\s*(\d+|[iv]+)/i);
    if (palierMatch) {
        const val = palierMatch[1];
        if (/^\d+$/.test(val)) {
            result.songeTier = parseInt(val, 10);
        } else {
            // Roman numeral conversion
            const romanMap: Record<string, number> = { 'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5 };
            result.songeTier = romanMap[val.toLowerCase()] || undefined;
        }
    }

    // --- EXPEDITION ---
    // Mode (Bravoure / Audace / Aucun)
    if (text.includes('bravoure')) {
        result.expeditionMode = 'bravoure';
    } else if (text.includes('audace')) {
        result.expeditionMode = 'audace';
    }

    // Dungeon name (usually capitalized multi-word after expedition context)
    const dungeonMatch = rawText.match(/(?:expédition|expedition)\s+(?:en\s+)?([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+)*)/i);
    if (dungeonMatch) result.dungeonName = dungeonMatch[1].trim();

    return result;
}

/**
 * Compare extracted mission data against expected payload
 * Returns match score and details
 */
export function matchMissionContent(
    extracted: ExtractedMissionData,
    category: 'DONJON' | 'REGULATION' | 'ANOMALIE' | 'SONGES' | 'EXPEDITION' | 'EVENT',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: any
): MissionMatchResult {
    const matched: string[] = [];
    const mismatched: string[] = [];

    // EVENT = Always Manual Validation
    if (category === 'EVENT') {
        return {
            isMatch: false,
            matchScore: 0,
            matchedFields: [],
            mismatchedFields: ['event'],
            reason: 'Les missions Événement requièrent une validation manuelle'
        };
    }

    // Helper: fuzzy string match (basic Levenshtein tolerance)
    const fuzzyMatch = (a?: string, b?: string, tolerance = 3): boolean => {
        if (!a || !b) return false;
        a = a.toLowerCase().trim();
        b = b.toLowerCase().trim();
        if (a === b) return true;
        if (a.includes(b) || b.includes(a)) return true;
        // Simple Levenshtein check (for typos)
        if (Math.abs(a.length - b.length) <= tolerance) {
            let diff = 0;
            const minLen = Math.min(a.length, b.length);
            for (let i = 0; i < minLen; i++) {
                if (a[i] !== b[i]) diff++;
            }
            return diff <= tolerance;
        }
        return false;
    };

    // --- REGULATION ---
    if (category === 'REGULATION') {
        if (payload.monsterName && extracted.monsterName) {
            if (fuzzyMatch(extracted.monsterName, payload.monsterName)) {
                matched.push('monsterName');
            } else {
                mismatched.push('monsterName');
            }
        }
    }

    // --- ANOMALIE ---
    if (category === 'ANOMALIE') {
        if (payload.type && extracted.anomalieType) {
            if (extracted.anomalieType === payload.type) {
                matched.push('anomalieType');
            } else {
                mismatched.push('anomalieType');
            }
        }
        // Level range check
        if (payload.levelRange && extracted.level) {
            const expectedMin = parseInt(payload.levelRange.replace('+', ''), 10);
            if (extracted.level >= expectedMin) {
                matched.push('levelRange');
            } else {
                mismatched.push('levelRange');
            }
        }
    }

    // --- SONGES ---
    if (category === 'SONGES') {
        // Difficulty (Rêve / Paradoxe / Cauchemar)
        if (payload.difficulty && extracted.songeDifficulty) {
            if (fuzzyMatch(extracted.songeDifficulty, payload.difficulty)) {
                matched.push('songeDifficulty');
            } else {
                mismatched.push('songeDifficulty');
            }
        }
        // Level (I-IV)
        if (payload.level && extracted.songeLevel) {
            if (extracted.songeLevel === payload.level) {
                matched.push('songeLevel');
            } else {
                mismatched.push('songeLevel');
            }
        }
        // Tier/Palier (1-5)
        if (payload.tier && extracted.songeTier) {
            if (extracted.songeTier === payload.tier) {
                matched.push('songeTier');
            } else {
                mismatched.push('songeTier');
            }
        }
    }

    // --- EXPEDITION ---
    if (category === 'EXPEDITION') {
        // Mode
        if (payload.mode && extracted.expeditionMode) {
            if (extracted.expeditionMode === payload.mode) {
                matched.push('expeditionMode');
            } else {
                mismatched.push('expeditionMode');
            }
        }
        // Dungeon name
        if (payload.dungeonName && extracted.dungeonName) {
            if (fuzzyMatch(extracted.dungeonName, payload.dungeonName)) {
                matched.push('dungeonName');
            } else {
                mismatched.push('dungeonName');
            }
        }
    }

    // --- DONJON ---
    if (category === 'DONJON') {
        if (payload.bossName && extracted.dungeonName) {
            if (fuzzyMatch(extracted.dungeonName, payload.bossName) ||
                fuzzyMatch(extracted.dungeonName, payload.dungeonName)) {
                matched.push('dungeonName');
            } else {
                mismatched.push('dungeonName');
            }
        }
    }

    // --- RANK CHECK (All types) ---
    // Note: Rank in DB is `tier` (1-4), OCR extracts `rank`
    if (payload.tier && extracted.rank) {
        if (extracted.rank === payload.tier) {
            matched.push('rank');
        } else {
            // Rank mismatch is a strong fraud indicator
            mismatched.push('rank');
        }
    }

    // Calculate score
    const totalFields = matched.length + mismatched.length;
    const matchScore = totalFields > 0 ? Math.round((matched.length / totalFields) * 100) : 0;

    // Determine if it's a valid match
    // We consider it a match if no critical fields are mismatched
    const isMatch = mismatched.length === 0 && matched.length > 0;

    return {
        isMatch,
        matchScore,
        matchedFields: matched,
        mismatchedFields: mismatched,
        reason: mismatched.length > 0
            ? `Incohérence détectée: ${mismatched.join(', ')}`
            : matched.length > 0
                ? `Match validé: ${matched.join(', ')}`
                : 'Aucun champ comparable détecté'
    };
}

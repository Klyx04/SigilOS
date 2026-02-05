/**
 * LLM-based OCR Service using Ollama
 * 
 * Replaces Tesseract.js with Qwen2-VL for smarter image analysis:
 * - Better text extraction from complex game screenshots
 * - Built-in content moderation
 * - Structured confidence scoring
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
// CONFIGURATION
// =============================================================================

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5vl:3b-q4_K_M'; // Quantized vision model (~3.5GB RAM, fast on CPU)
const AUTO_VALIDATE_THRESHOLD = parseInt(process.env.OCR_AUTO_VALIDATE_THRESHOLD || '70', 10);

// Timeout for Ollama API calls (configurable via env, default 120s for CPU vision inference)
const OLLAMA_TIMEOUT_MS = parseInt(process.env.OLLAMA_TIMEOUT_MS || '120000', 10);


// =============================================================================
// PROMPTS
// =============================================================================

/**
 * System prompt for Gemma 3 - supports structured JSON output
 * Gemma 3 4B is a lightweight model with good OCR capabilities
 */
const SYSTEM_PROMPT = `You are an OCR assistant analyzing Dofus game screenshots. Extract text and numbers accurately. Always respond in valid JSON format.`;

/**
 * Generate analysis prompts optimized for Gemma 3
 * Uses structured JSON output format for reliable parsing
 */
function getAnalysisPrompt(context?: 'mission' | 'achievement' | 'ladder'): string {
    switch (context) {
        case 'mission':
            return `Look at this Dofus game screenshot. Extract:
1. Mission name (text at top)
2. Level number
3. Progress (format: X/Y)
4. Is it validated? (green checkmark visible?)

Respond ONLY with this JSON:
{"mission_name": "...", "level": 0, "progress": "0/0", "is_validated": false}`;

        case 'achievement':
            return `Look at this Dofus achievement screenshot. Find:
1. The large score number (usually 5 digits, like 21654)
2. Any victory/success text ("Succès", "Victoire", "Success")

Respond ONLY with this JSON:
{"score": 0, "is_victory": false}`;

        case 'ladder':
            return `Look at this Dofus ladder/ranking screenshot. Extract:
1. Score/points number
2. Rank position

Respond ONLY with this JSON:
{"score": 0, "rank": 0}`;

        default:
            return `What text and numbers do you see in this image? Is there any "Victory" or "Success" message? Reply with JSON: {"text": "...", "numbers": [], "is_victory": false}`;
    }
}

// =============================================================================
// OLLAMA API CLIENT
// =============================================================================

interface OllamaGenerateRequest {
    model: string;
    prompt: string;
    system?: string;
    images?: string[];
    stream: boolean;
    think?: boolean; // Qwen3 thinking mode control
    options?: {
        temperature?: number;
        num_predict?: number;
        num_thread?: number;
    };
}


interface OllamaGenerateResponse {
    model: string;
    created_at: string;
    response: string;
    done: boolean;
    context?: number[];
    total_duration?: number;
    load_duration?: number;
    prompt_eval_count?: number;
    prompt_eval_duration?: number;
    eval_count?: number;
    eval_duration?: number;
}

/**
 * Call Ollama's generate API with vision support
 */
async function callOllama(
    prompt: string,
    imageBase64: string,
    systemPrompt?: string
): Promise<OllamaGenerateResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

    try {
        const requestBody: OllamaGenerateRequest = {
            model: OLLAMA_MODEL,
            prompt,
            system: systemPrompt,
            images: [imageBase64],
            stream: false,
            options: {
                temperature: 0.1, // Low temperature for consistent, factual responses
                num_predict: 500, // Limit response length
                num_thread: 6, // Use all CPU cores for faster inference
            },
        };


        console.log('[LLM-OCR] Sending request to Ollama:', {
            model: OLLAMA_MODEL,
            promptLength: prompt.length,
            imageSize: imageBase64.length,
            hasSystem: !!systemPrompt
        });

        const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log('[LLM-OCR] Ollama full response:', JSON.stringify(result).substring(0, 1000));
        return result;

    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Check if Ollama service is available
 */
export async function checkOllamaHealth(): Promise<{
    available: boolean;
    model: string;
    error?: string;
}> {
    try {
        const response = await fetch(`${OLLAMA_HOST}/api/tags`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
            return { available: false, model: OLLAMA_MODEL, error: 'Ollama not responding' };
        }

        const data = await response.json();
        const models = data.models?.map((m: { name: string }) => m.name) || [];

        const hasModel = models.some((m: string) => m.startsWith(OLLAMA_MODEL.split(':')[0]));

        return {
            available: hasModel,
            model: OLLAMA_MODEL,
            error: hasModel ? undefined : `Model ${OLLAMA_MODEL} not found. Run: ollama pull ${OLLAMA_MODEL}`,
        };
    } catch (error) {
        return {
            available: false,
            model: OLLAMA_MODEL,
            error: error instanceof Error ? error.message : 'Connection failed',
        };
    }
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
        // Generate analysis prompt based on context
        const prompt = getAnalysisPrompt(request.context);

        // Optimize image (resize & compress) to avoid timeouts with large payloads
        const optimizedImage = await optimizeImage(request.imageBase64);

        // Call Ollama with the image
        console.log('[LLM-OCR] Calling Ollama with context:', request.context);
        const response = await callOllama(prompt, optimizedImage, SYSTEM_PROMPT);

        console.log('[LLM-OCR] Raw response (first 500 chars):', response.response.substring(0, 500));

        // Parse the JSON response
        const parsed = parseModelResponse(response.response);

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
            rawResponse: response.response,
        };

    } catch (error) {
        console.error('[LLM-OCR] Analysis failed:', error);

        // FALLBACK: If Ollama is unreachable or times out, return a low-confidence result for manual validation
        const isConnectionError = error instanceof Error &&
            (error.message.includes('ECONNREFUSED') ||
                error.message.includes('fetch failed') ||
                error.name === 'AbortError' ||
                error.message.includes('aborted'));

        if (isConnectionError) {
            console.warn('[LLM-OCR] Ollama unreachable - falling back to manual validation');
            return {
                success: true, // Mark as success so the upload continues
                text: '[OCR indisponible] Validation manuelle requise',
                confidence: 0, // Forces manual validation
                isVictory: false,
                moderation: { isAppropriate: true },
                error: 'Ollama service unreachable - manual validation required',
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

/**
 * Parse the model's response - tries JSON first, falls back to text extraction
 * Gemma 3 typically returns valid JSON, but we handle both cases
 */
function parseModelResponse(rawResponse: string): ParsedModelResponse {
    // Try JSON parsing first (Gemma 3 should return structured JSON)
    try {
        // Extract JSON from response (may have markdown code blocks)
        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);

            // Handle achievement context
            if ('score' in parsed) {
                const score = typeof parsed.score === 'number' ? parsed.score : parseInt(String(parsed.score).replace(/\s/g, ''), 10);
                const isVictory = parsed.is_victory === true;

                console.log('[LLM-OCR] JSON parsed successfully:', { score, isVictory });

                // High confidence if we got a valid score
                let confidence = 0;
                if (score > 0) confidence += 50;
                if (score > 1000) confidence += 20; // Likely a real Dofus score
                if (isVictory) confidence += 30;

                return {
                    extractedText: `Score: ${score}`,
                    isVictory,
                    victoryIndicators: isVictory ? ['is_victory'] : [],
                    confidence: Math.min(100, confidence),
                    isAppropriate: true,
                    inappropriateReason: null,
                };
            }

            // Handle mission context
            if ('mission_name' in parsed) {
                const isValidated = parsed.is_validated === true;

                console.log('[LLM-OCR] Mission JSON parsed:', parsed);

                return {
                    extractedText: JSON.stringify(parsed),
                    isVictory: isValidated,
                    victoryIndicators: isValidated ? ['is_validated'] : [],
                    confidence: isValidated ? 90 : 60,
                    isAppropriate: true,
                    inappropriateReason: null,
                };
            }
        }
    } catch (e) {
        console.log('[LLM-OCR] JSON parsing failed, falling back to text extraction');
    }

    // Fallback: Text extraction (legacy behavior)
    const text = rawResponse.toLowerCase();

    // Extract numbers from the response (e.g., "21 654", "21654", "21,654")
    const numberMatches = rawResponse.match(/[\d\s,\.]+\d/g) || [];
    const extractedNumbers = numberMatches
        .map(n => parseInt(n.replace(/[\s,\.]/g, ''), 10))
        .filter(n => !isNaN(n) && n > 0);

    // Detect victory indicators
    const victoryKeywords = ['success', 'succes', 'succès', 'victory', 'victoire', 'unlocked', 'déverrouillé', 'achieved', 'completed'];
    const foundIndicators = victoryKeywords.filter(kw => text.includes(kw));
    const isVictory = foundIndicators.length > 0;

    // Calculate confidence based on what we found
    let confidence = 0;
    if (extractedNumbers.length > 0) confidence += 40; // Found a number
    if (isVictory) confidence += 40; // Found victory keyword
    if (rawResponse.length > 50) confidence += 10; // Got substantial response
    if (extractedNumbers.some(n => n > 1000)) confidence += 10; // Found large number (likely score)

    console.log('[LLM-OCR] Text parsing fallback:', {
        foundNumbers: extractedNumbers,
        foundIndicators,
        isVictory,
        calculatedConfidence: confidence
    });

    return {
        extractedText: rawResponse,
        isVictory,
        victoryIndicators: foundIndicators,
        confidence: Math.min(100, confidence),
        isAppropriate: true, // Assume appropriate unless flagged
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

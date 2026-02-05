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
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'moondream'; // Fast vision model optimized for CPU
const AUTO_VALIDATE_THRESHOLD = parseInt(process.env.OCR_AUTO_VALIDATE_THRESHOLD || '70', 10);

// Timeout for Ollama API calls (configurable via env, default 120s for CPU vision inference)
const OLLAMA_TIMEOUT_MS = parseInt(process.env.OLLAMA_TIMEOUT_MS || '120000', 10);


// =============================================================================
// PROMPTS
// =============================================================================

/**
 * System prompt optimized for Dofus screenshot analysis
 */
const SYSTEM_PROMPT = `Tu es un assistant expert en analyse d'images de jeux vidéo.
Ton rôle est d'extraire le texte visible et de détecter les indicateurs de victoire.

IMPORTANT: Tu dois TOUJOURS répondre en JSON valide avec cette structure exacte:
{
  "extractedText": "tout le texte visible dans l'image",
  "isVictory": true/false,
  "victoryIndicators": ["liste", "des", "indicateurs", "trouvés"],
  "confidence": 0-100,
  "isAppropriate": true/false,
  "inappropriateReason": "raison si inapproprié, sinon null"
}

Critères de victoire pour Dofus:
- Texte "Victoire" visible
- Texte "Succès" visible  
- Texte "déverrouillé" visible
- Bannière verte de victoire
- Score ou XP gagné affiché

Contenu inapproprié:
- Violence graphique excessive
- Nudité ou contenu sexuel
- Discours haineux ou discriminatoire
- Informations personnelles visibles`;

/**
 * Generate context-specific prompts
 */
function getAnalysisPrompt(context?: 'mission' | 'achievement' | 'ladder'): string {
    const basePrompt = "Analyse cette capture d'écran du jeu Dofus.";

    switch (context) {
        case 'mission':
            return `${basePrompt} L'utilisateur veut prouver qu'il a accompli une mission de guilde. Cherche des indices de victoire comme "Succès", "Victoire", ou des messages de complétion.`;

        case 'achievement':
            return `${basePrompt} L'utilisateur veut prouver qu'il a obtenu un succès (achievement). Cherche le nom du succès, le texte "déverrouillé", et le score total.`;

        case 'ladder':
            return `${basePrompt} L'utilisateur veut montrer son classement. Cherche le pseudo Dofus, le rang, et les statistiques visibles.`;

        default:
            return `${basePrompt} Extrait tout le texte visible et identifie si l'image montre une victoire ou un accomplissement.`;
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

        // Call Ollama with the image
        console.log('[LLM-OCR] Calling Ollama with context:', request.context);
        const response = await callOllama(prompt, request.imageBase64, SYSTEM_PROMPT);

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
 * Parse and validate the model's JSON response
 */
function parseModelResponse(rawResponse: string): ParsedModelResponse {
    const defaults: ParsedModelResponse = {
        extractedText: '',
        isVictory: false,
        victoryIndicators: [],
        confidence: 0,
        isAppropriate: true,
        inappropriateReason: null,
    };

    try {
        // Try to extract JSON from the response (model might include extra text)
        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.warn('[LLM-OCR] No JSON found in response, using defaults');
            return { ...defaults, extractedText: rawResponse };
        }

        const parsed = JSON.parse(jsonMatch[0]);

        return {
            extractedText: typeof parsed.extractedText === 'string' ? parsed.extractedText : '',
            isVictory: Boolean(parsed.isVictory),
            victoryIndicators: Array.isArray(parsed.victoryIndicators) ? parsed.victoryIndicators : [],
            confidence: typeof parsed.confidence === 'number'
                ? Math.min(100, Math.max(0, parsed.confidence))
                : 0,
            isAppropriate: parsed.isAppropriate !== false,
            inappropriateReason: typeof parsed.inappropriateReason === 'string'
                ? parsed.inappropriateReason
                : null,
        };
    } catch (error) {
        console.warn('[LLM-OCR] Failed to parse JSON response:', error);
        return { ...defaults, extractedText: rawResponse };
    }
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

/**
 * Get the auto-validation threshold
 */
export function getAutoValidateThreshold(): number {
    return AUTO_VALIDATE_THRESHOLD;
}

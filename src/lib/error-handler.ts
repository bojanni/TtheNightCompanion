import { toast } from 'sonner';
import { SkipAIError, AbortAIError } from './ai-service';

/**
 * Error mapping for common error patterns to user-friendly messages
 */
const ERROR_MESSAGES: Record<string, string> = {
    // Network errors
    'fetch failed': 'Unable to connect to the server. Please check your connection.',
    'network error': 'Network error. Please check your internet connection.',
    'failed to fetch': 'Unable to reach the server. Please try again.',

    // Database errors
    'duplicate': 'This item already exists.',
    'unique constraint': 'This item already exists.',
    'foreign key': 'Cannot delete this item as it is being used elsewhere.',
    'not found': 'Item not found.',

    // Validation errors
    'required': 'Please fill in all required fields.',
    'invalid': 'The provided data is invalid.',
    'validation': 'Please check your inputs and try again.',

    // Authentication errors
    'unauthorized': 'You are not authorized to perform this action.',
    'forbidden': 'Access denied.',
    'session expired': 'Your session has expired. Please sign in again.',

    // File/JSON errors
    'invalid json': 'Invalid file format. Please select a valid backup file.',
    'syntaxerror': 'Invalid file format. Please select a valid backup file.',
    'parse error': 'Unable to read the file. Please check the file format.',

    // Backend API mappings
    'dit item bestaat al': 'Dit item bestaat al.',
    'item is in gebruik': 'Dit item is in gebruik en kan niet verwijderd worden.',
    'verplicht veld': 'Vul alle verplichte velden in.',
    'niet gevonden': 'Het item kon niet worden gevonden.',
};

/**
 * Convert technical error messages to user-friendly messages
 */
export function getUserFriendlyError(error: unknown): string {
    if (typeof error === 'string') {
        const lowerError = error.toLowerCase();

        // Check for known error patterns
        for (const [pattern, message] of Object.entries(ERROR_MESSAGES)) {
            if (lowerError.includes(pattern)) {
                return message;
            }
        }

        return error;
    }

    if (error instanceof Error) {
        const lowerMessage = error.message.toLowerCase();

        // Check for known error patterns
        for (const [pattern, message] of Object.entries(ERROR_MESSAGES)) {
            if (lowerMessage.includes(pattern)) {
                return message;
            }
        }

        return error.message;
    }

    return 'An unexpected error occurred. Please try again.';
}

/**
 * Handle errors with toast notifications and console logging
 */
export function handleError(
    error: unknown,
    context: string,
    metadata?: Record<string, unknown>
) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const userMessage = getUserFriendlyError(error);

    // Show user-friendly toast
    toast.error(userMessage);

    // Log technical details for debugging
    console.error(`[${context}]`, errorMessage, metadata || {});
}

/**
 * Handle fetch API responses consistently, throwing an Error on non-ok status
 */
export async function handleApiResponse<T>(response: Response): Promise<T> {
    if (response.ok) {
        return response.json();
    }

    let errData: { error?: string, message?: string } = {};
    try {
        errData = await response.json();
    } catch {
        // Fallback if response is not JSON
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    throw new Error(errData.error || errData.message || 'Onbekende fout');
}

/**
 * Show success toast with optional message
 */
export function showSuccess(message: string) {
    toast.success(message);
}

/**
 * Show info toast with optional message
 */
export function showInfo(message: string) {
    toast.info(message);
}

/**
 * Show warning toast with optional message
 */
export function showWarning(message: string) {
    toast.warning(message);
}

/**
 * Show loading toast - returns toast ID for dismissal
 */
export function showLoading(message: string) {
    return toast.loading(message);
}

/**
 * Dismiss a specific toast by ID
 */
export function dismissToast(toastId: string | number) {
    toast.dismiss(toastId);
}

/**
 * Handle AI-specific errors with richer feedback
 */
export function handleAIError(error: unknown) {
    // Handle timeout-related errors silently or with appropriate message
    if (error instanceof SkipAIError) {
        toast.info('Generation Skipped', {
            description: 'AI generation was skipped. You can continue without AI assistance.',
            duration: 3000,
        });
        return;
    }

    if (error instanceof AbortAIError) {
        toast.info('Generation Cancelled', {
            description: 'AI generation was cancelled.',
            duration: 3000,
        });
        return;
    }

    const message = error instanceof Error ? error.message : String(error);
    const lowerMsg = message.toLowerCase();

    // 0. Generic Upstream Provider Errors
    if (lowerMsg.includes('provider returned error')) {
        toast.error('AI Provider Issues', {
            description: 'The upstream AI provider is reporting errors. This often happens with free models on OpenRouter. Please try a different model.',
            duration: 8000,
        });
        return;
    }

    // 1. Rate Limits / Quotas
    // 1. Rate Limits / Quotas
    if (lowerMsg.includes('rate limit') || lowerMsg.includes('429') || lowerMsg.includes('quota')) {
        toast.error('AI Service Busy or Limit Reached', {
            description: 'The AI provider is currently overloaded. Please try again later, or switch to a different model in settings.',
            duration: 8000,
        });
        return;
    }

    // 2. Authentication / API Key Issues
    if (lowerMsg.includes('401') || lowerMsg.includes('unauthorized') || lowerMsg.includes('invalid api key') || lowerMsg.includes('invalid_api_key')) {
        toast.error('Authentication Failed', {
            description: 'Your API key appears to be invalid or expired. Please check your key in Settings > Cloud Providers.',
            duration: 8000,
        });
        return;
    }

    // 3. Model Not Found / Access
    if (lowerMsg.includes('404') || lowerMsg.includes('model not found') || lowerMsg.includes('does not exist')) {
        toast.error('Model Unavailable', {
            description: 'The selected AI model is currently unavailable or deprecated. Please select a different model in Settings.',
            duration: 6000,
        });
        return;
    }

    // 4. Content Safety / Policy
    if (lowerMsg.includes('safety') || lowerMsg.includes('policy') || lowerMsg.includes('content filter') || lowerMsg.includes('harmful')) {
        toast.error('Content Filter Triggered', {
            description: 'The AI provider blocked the request due to safety filters. Please modify your prompt to be less explicit or graphic.',
            duration: 6000,
        });
        return;
    }

    // 5. Context Length
    if (lowerMsg.includes('context length') || lowerMsg.includes('token limit') || lowerMsg.includes('too long')) {
        toast.error('Prompt Too Long', {
            description: 'The input is too long for this model. Please reduce the length of your prompt or context.',
            duration: 6000,
        });
        return;
    }

    // 6. Server Errors
    if (lowerMsg.includes('500') || lowerMsg.includes('503') || lowerMsg.includes('service unavailable') || lowerMsg.includes('bad gateway')) {
        toast.error('AI Service Error', {
            description: 'The AI provider is experiencing server issues. Please try again in a few moments.',
            duration: 5000,
        });
        return;
    }

    // 7. Local LLM Specific
    if (lowerMsg.includes('connection refused') || lowerMsg.includes('fetch failed') && lowerMsg.includes('localhost')) {
        toast.error('Local AI Disconnected', {
            description: 'Could not connect to Local LLM. Ensure Ollama or LM Studio is running and the server is active.',
            duration: 6000,
        });
        return;
    }

    // Check for specific provider errors if not caught above
    // Check for specific provider errors if not caught above
    if (lowerMsg.includes('openrouter')) {
        let cleanMsg = message.replace(/OpenRouter Provider Error:/gi, '').trim();
        // Remove generic "Error:" prefix if present
        cleanMsg = cleanMsg.replace(/^Error:\s*/i, '');
        // Remove trailing parenthetical errors if they are just tech noise
        cleanMsg = cleanMsg.replace(/\(Error:.*\)$/i, '').trim();

        // If the message is still very generic, give a hint
        if (cleanMsg.toLowerCase() === 'provider returned error') {
            cleanMsg = 'The AI provider (OpenRouter) encountered an upstream error. Please try a different model.';
        }

        toast.error('AI Provider Error', {
            description: cleanMsg,
            duration: 6000,
        });
        return;
    }

    // Default error fallback
    toast.error('AI Generation Failed', {
        description: message.length < 100 ? message : 'An unexpected error occurred. Check the console for details.',
        duration: 5000
    });
    console.error('Unhandled AI Error:', error);
}

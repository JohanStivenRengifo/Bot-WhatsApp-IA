import { useState, useCallback } from 'react';

export interface SuggestedResponse {
    type: 'professional' | 'empathetic' | 'proactive';
    text: string;
}

export interface AISuggestionsResponse {
    analysis: string;
    suggestions: SuggestedResponse[];
    generatedAt: string;
    model: string;
}

export interface UseAISuggestionsReturn {
    suggestions: AISuggestionsResponse | null;
    isLoading: boolean;
    error: string | null;
    isSuccess: boolean;
    generateSuggestions: (conversationId: string, messages: any[], customerInfo?: any) => Promise<void>;
    clearSuggestions: () => void;
    retryCount: number;
}

const API_BASE_URL = '/api/conversation-enhancement';

export const useAISuggestions = (): UseAISuggestionsReturn => {
    const [suggestions, setSuggestions] = useState<AISuggestionsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);
    const [retryCount, setRetryCount] = useState(0);

    const generateSuggestions = useCallback(async (
        conversationId: string,
        messages: any[],
        customerInfo?: any
    ) => {
        setIsLoading(true);
        setError(null);
        setIsSuccess(false);

        try {
            const response = await fetch(`${API_BASE_URL}/ai/suggested-responses`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    conversationId,
                    messages,
                    customerInfo
                }),
            });

            if (!response.ok) {
                let errorMessage = `Error ${response.status}: ${response.statusText}`;

                // Try to get more specific error from response
                try {
                    const errorData = await response.json();
                    if (errorData.error) {
                        errorMessage = errorData.error;
                    }
                } catch (e) {
                    // Use default error message if can't parse JSON
                }

                throw new Error(errorMessage);
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Error al generar respuestas sugeridas');
            }

            setSuggestions(data.data);
            setIsSuccess(true);
            setRetryCount(0);
            console.log('🤖 Respuestas sugeridas generadas:', data.data);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
            setError(errorMessage);
            setRetryCount(prev => prev + 1);
            console.error('Error generating AI suggestions:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const clearSuggestions = useCallback(() => {
        setSuggestions(null);
        setError(null);
        setIsSuccess(false);
        setRetryCount(0);
    }, []);

    return {
        suggestions,
        isLoading,
        error,
        isSuccess,
        generateSuggestions,
        clearSuggestions,
        retryCount,
    };
};

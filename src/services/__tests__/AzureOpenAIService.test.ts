import { AzureOpenAIService } from '../AzureOpenAIService';

// Mock the config to avoid Azure OpenAI dependencies in tests
jest.mock('../../config', () => ({
    config: {
        azureOpenAI: {
            endpoint: 'https://test.openai.azure.com',
            apiKey: 'test-key',
            deploymentName: 'test-deployment',
            modelName: 'gpt-4',
            apiVersion: '2024-02-15-preview'
        }
    }
}));

// Mock the Azure OpenAI client
jest.mock('openai', () => ({
    AzureOpenAI: jest.fn().mockImplementation(() => ({
        chat: {
            completions: {
                create: jest.fn()
            }
        }
    }))
}));

describe('AzureOpenAIService', () => {
    let service: AzureOpenAIService;
    let mockClient: any;

    beforeEach(() => {
        const { AzureOpenAI } = require('openai');
        mockClient = new AzureOpenAI();
        service = new AzureOpenAIService();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('generateSuggestedResponses', () => {
        it('should generate suggested responses successfully', async () => {
            const mockResponse = {
                choices: [{
                    message: {
                        content: JSON.stringify({
                            analysis: 'Cliente pregunta sobre planes de internet',
                            suggestions: [
                                { type: 'professional', text: 'Tenemos varios planes disponibles para ti' },
                                { type: 'empathetic', text: 'Entiendo que buscas el mejor plan para tus necesidades' },
                                { type: 'proactive', text: '¿Te gustaría que revisemos qué plan se ajusta mejor a tu uso?' }
                            ]
                        })
                    }
                }],
                model: 'gpt-4'
            };

            mockClient.chat.completions.create.mockResolvedValue(mockResponse);

            const messages = [
                { content: 'Hola, necesito información sobre sus planes de internet', fromAgent: false }
            ];

            const result = await service.generateSuggestedResponses(messages);

            expect(result.success).toBe(true);
            expect(result.message).toBeDefined();
            expect(result.modelUsed).toBe('gpt-4');

            const parsedResponse = JSON.parse(result.message);
            expect(parsedResponse.analysis).toBeDefined();
            expect(parsedResponse.suggestions).toHaveLength(3);
            expect(parsedResponse.suggestions[0].type).toBe('professional');
            expect(parsedResponse.suggestions[1].type).toBe('empathetic');
            expect(parsedResponse.suggestions[2].type).toBe('proactive');
        });

        it('should handle API errors gracefully', async () => {
            mockClient.chat.completions.create.mockRejectedValue(new Error('API Error'));

            const messages = [
                { content: 'Test message', fromAgent: false }
            ];

            const result = await service.generateSuggestedResponses(messages);

            expect(result.success).toBe(false);
            expect(result.error).toBe('API Error');
            expect(result.message).toBe('');
        });

        it('should handle empty response', async () => {
            const mockResponse = {
                choices: [{}],
                model: 'gpt-4'
            };

            mockClient.chat.completions.create.mockResolvedValue(mockResponse);

            const messages = [
                { content: 'Test message', fromAgent: false }
            ];

            const result = await service.generateSuggestedResponses(messages);

            expect(result.success).toBe(false);
            expect(result.error).toBe('No content in response');
        });

        it('should include customer info in the prompt when provided', async () => {
            const mockResponse = {
                choices: [{
                    message: {
                        content: JSON.stringify({
                            analysis: 'Cliente existente con plan básico consulta sobre upgrade',
                            suggestions: [
                                { type: 'professional', text: 'Puedo ayudarte a mejorar tu plan actual' },
                                { type: 'empathetic', text: 'Veo que tienes nuestro plan básico, entiendo que necesitas más velocidad' },
                                { type: 'proactive', text: 'Te recomiendo nuestro plan de 100 Mbps con descuento por ser cliente actual' }
                            ]
                        })
                    }
                }],
                model: 'gpt-4'
            };

            mockClient.chat.completions.create.mockResolvedValue(mockResponse);

            const messages = [
                { content: 'Mi internet está muy lento', fromAgent: false }
            ];

            const customerInfo = {
                name: 'Juan Pérez',
                phone: '123456789',
                currentPlan: '30 Mbps'
            };

            const result = await service.generateSuggestedResponses(messages, customerInfo);

            expect(result.success).toBe(true);
            expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    messages: expect.arrayContaining([
                        expect.objectContaining({
                            role: 'user',
                            content: expect.stringContaining('Juan Pérez')
                        })
                    ])
                })
            );
        });
    });
});

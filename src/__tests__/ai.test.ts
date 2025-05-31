import { AIRouter } from '../services/ai/AIRouter';
import { User } from '../interfaces';

describe('AI Router', () => {
  let aiRouter: AIRouter;
  let mockUser: User;

  beforeEach(() => {
    aiRouter = new AIRouter();
    mockUser = {
      phoneNumber: '+1234567890',
      authenticated: true,
      acceptedPrivacyPolicy: true,
      customerId: 'test-customer-123'
    };
  });

  describe('Configuration', () => {
    it('should have correct default configuration', () => {
      const config = aiRouter.getCurrentConfiguration();
      expect(config.primary).toBe('openai');
      expect(config.fallback).toBe('gemini');
      expect(config.available).toContain('openai');
      expect(config.available).toContain('gemini');
    });
  });

  describe('Service Status', () => {
    it('should return status for all services', async () => {
      const status = await aiRouter.getServiceStatus();
      expect(status).toHaveProperty('openai');
      expect(status).toHaveProperty('gemini');
      expect(typeof status.openai).toBe('boolean');
      expect(typeof status.gemini).toBe('boolean');
    });
  });

  describe('AI Response', () => {
    it('should return a default response when services fail', async () => {
      // This test assumes both services will fail due to missing/invalid API keys
      const response = await aiRouter.getAIResponse('Hola', mockUser);
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
      // Should contain fallback message indicators
      expect(
        response.includes('menu') || 
        response.includes('agente') || 
        response.includes('soporte')
      ).toBe(true);
    });

    it('should handle empty messages gracefully', async () => {
      const response = await aiRouter.getAIResponse('', mockUser);
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    });
  });
});
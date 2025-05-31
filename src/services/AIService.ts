import { User } from '../interfaces';
import { AIRouter } from './ai/AIRouter';

export class AIService {
    private aiRouter: AIRouter;

    constructor() {
        this.aiRouter = new AIRouter();
    }

    async getAIResponse(message: string, user: User): Promise<string> {
        return await this.aiRouter.getAIResponse(message, user);
    }

    async getServiceStatus(): Promise<{ [key: string]: boolean }> {
        return await this.aiRouter.getServiceStatus();
    }

    getCurrentConfiguration(): { primary: string; fallback: string; available: string[] } {
        return this.aiRouter.getCurrentConfiguration();
    }
}
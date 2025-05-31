import { User } from './User';

export interface AIResponse {
    success: boolean;
    message: string;
    service: string;
    error?: string;
}

export interface IAIService {
    name: string;
    isAvailable(): Promise<boolean>;
    generateResponse(message: string, user: User): Promise<AIResponse>;
}
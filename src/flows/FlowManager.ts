import { User, SessionData } from '../interfaces';
import { ConversationFlow } from './ConversationFlow';

/**
 * Clase que administra los flujos de conversación
 */
export class ConversationFlowManager {
    private flows: ConversationFlow[] = [];

    /**
     * Registra un nuevo flujo en el administrador
     */
    registerFlow(flow: ConversationFlow): void {
        this.flows.push(flow);
        console.log(`Flujo de conversación registrado: ${flow.name}`);
    }

    /**
     * Procesa un mensaje a través de los flujos registrados
     * @returns true si el mensaje fue manejado por algún flujo, false en caso contrario
     */
    async processMessage(user: User, message: string, session: SessionData): Promise<boolean> {
        // Verificar cada flujo en orden
        for (const flow of this.flows) {
            try {
                // Comprobar si el flujo puede manejar este mensaje
                if (await flow.canHandle(user, message, session)) {
                    console.log(`Mensaje manejado por flujo: ${flow.name}`);
                    // Si el flujo puede manejar el mensaje, procesarlo
                    return await flow.handle(user, message, session);
                }
            } catch (error) {
                console.error(`Error en flujo ${flow.name}:`, error);
                // Continuar con el siguiente flujo en caso de error
            }
        }

        // Ningún flujo pudo manejar el mensaje
        return false;
    }
}

import fs from 'fs';
import { config } from '../config';
import { OpenAIService } from './ai/OpenAIService';
import { GeminiService } from './ai/GeminiService';
import { ImageMetadata } from './ImageStorageService';

export interface PaymentValidationResult {
    isValid: boolean;
    confidence: number;
    extractedData: {
        amount?: number;
        date?: string;
        accountNumber?: string;
        bank?: string;
        referenceNumber?: string;
        paymentMethod?: string;
    };
    validationDetails: {
        hasValidAmount: boolean;
        hasCurrentDate: boolean;
        hasValidAccount: boolean;
        hasValidBank: boolean;
        imageQuality: 'excellent' | 'good' | 'fair' | 'poor';
    };
    errors: string[];
    suggestions: string[];
}

export class PaymentValidationService {
    private openAIService: OpenAIService;
    private geminiService: GeminiService;

    // Datos válidos de cuentas bancarias
    private static readonly VALID_ACCOUNTS = [
        {
            bank: 'BANCOLOMBIA',
            account: '26100006596',
            nit: '901707684',
            holder: 'Conecta2 Telecomunicaciones',
            types: ['CORRESPONSAL BANCOLOMBIA', 'APP', 'AHORROS']
        },
        {
            bank: 'NEQUI',
            account: '3242156679',
            types: ['NEQUI']
        },
        {
            bank: 'DAVIVIENDA',
            account: '0488403242917',
            types: ['AHORROS']
        }
    ];

    private static readonly BANCOLOMBIA_CONVENIO = '94375';

    constructor() {
        this.openAIService = new OpenAIService();
        this.geminiService = new GeminiService();
    }

    /**
     * Valida un comprobante de pago usando IA
     */
    async validatePaymentReceipt(imageMetadata: ImageMetadata): Promise<PaymentValidationResult> {
        try {
            console.log(`🔍 Iniciando validación de comprobante: ${imageMetadata.originalName}`);

            // Verificar que el archivo existe
            if (!fs.existsSync(imageMetadata.localPath)) {
                throw new Error('Archivo de imagen no encontrado');
            }

            // Intentar análisis con OpenAI primero, luego Gemini como fallback
            let analysisResult: any;
            let usedService = '';

            try {
                analysisResult = await this.analyzeImageWithOpenAI(imageMetadata);
                usedService = 'OpenAI';
            } catch (openAIError) {
                console.log('⚠️ OpenAI falló, intentando con Gemini...');
                try {
                    analysisResult = await this.analyzeImageWithGemini(imageMetadata);
                    usedService = 'Gemini';
                } catch (geminiError) {
                    console.error('❌ Ambos servicios de IA fallaron');
                    throw new Error('No se pudo analizar la imagen con ningún servicio de IA');
                }
            }

            console.log(`✅ Análisis completado con ${usedService}`);

            // Procesar y validar los resultados
            return this.processAnalysisResults(analysisResult);

        } catch (error) {
            console.error('Error validando comprobante:', error);
            return {
                isValid: false,
                confidence: 0,
                extractedData: {},
                validationDetails: {
                    hasValidAmount: false,
                    hasCurrentDate: false,
                    hasValidAccount: false,
                    hasValidBank: false,
                    imageQuality: 'poor'
                },
                errors: [`Error procesando imagen: ${error instanceof Error ? error.message : 'Error desconocido'}`],
                suggestions: [
                    'Envía una imagen más clara del comprobante',
                    'Asegúrate de que toda la información esté visible',
                    'Intenta con mejor iluminación'
                ]
            };
        }
    }    /**
     * Analiza la imagen usando OpenAI Vision
     */
    private async analyzeImageWithOpenAI(imageMetadata: ImageMetadata): Promise<any> {
        if (!config.ai.openai.apiKey) {
            throw new Error('OpenAI API key no configurada');
        }

        // Convertir imagen a base64
        const imageBuffer = fs.readFileSync(imageMetadata.localPath);
        const base64Image = imageBuffer.toString('base64');
        const dataUrl = `data:${imageMetadata.mimeType};base64,${base64Image}`;

        const prompt = this.buildAnalysisPrompt();

        const response = await this.openAIService.analyzeImage(dataUrl, prompt);

        if (!response.success) {
            throw new Error(response.error || 'Error analizando imagen con OpenAI');
        }

        // Parsear la respuesta JSON
        try {
            return JSON.parse(response.message);
        } catch (parseError) {
            console.error('Error parseando respuesta de OpenAI:', response.message);
            throw new Error('Respuesta de OpenAI no válida');
        }
    }    /**
     * Analiza la imagen usando Gemini Vision
     */
    private async analyzeImageWithGemini(imageMetadata: ImageMetadata): Promise<any> {
        if (!config.ai.gemini.apiKey) {
            throw new Error('Gemini API key no configurada');
        }

        // Convertir imagen a base64
        const imageBuffer = fs.readFileSync(imageMetadata.localPath);
        const base64Image = imageBuffer.toString('base64');
        const dataUrl = `data:${imageMetadata.mimeType};base64,${base64Image}`;

        const prompt = this.buildAnalysisPrompt();

        const response = await this.geminiService.analyzeImage(dataUrl, prompt);

        if (!response.success) {
            throw new Error(response.error || 'Error analizando imagen con Gemini');
        }

        // Parsear la respuesta JSON
        try {
            return JSON.parse(response.message);
        } catch (parseError) {
            console.error('Error parseando respuesta de Gemini:', response.message);
            throw new Error('Respuesta de Gemini no válida');
        }
    }

    /**
     * Construye el prompt para análisis de imagen
     */
    private buildAnalysisPrompt(): string {
        return `
Analiza esta imagen de comprobante de pago y extrae la siguiente información:

1. MONTO: Cantidad pagada (número)
2. FECHA: Fecha de la transacción (formato DD/MM/YYYY)
3. NÚMERO DE CUENTA: Cuenta destino del pago
4. BANCO: Nombre del banco o entidad financiera
5. NÚMERO DE REFERENCIA: Código de transacción o referencia
6. MÉTODO DE PAGO: Tipo de transacción (transferencia, depósito, etc.)

CUENTAS VÁLIDAS PARA VERIFICAR:
- BANCOLOMBIA: Cuenta 26100006596, Convenio 94375
- NEQUI: 3242156679
- DAVIVIENDA: 0488403242917

Responde SOLO con un JSON con esta estructura:
{
  "amount": numero_o_null,
  "date": "DD/MM/YYYY"_o_null,
  "accountNumber": "numero"_o_null,
  "bank": "nombre_banco"_o_null,
  "referenceNumber": "referencia"_o_null,
  "paymentMethod": "metodo"_o_null,
  "confidence": 0.0_a_1.0,
  "imageQuality": "excellent|good|fair|poor"
}

Si no puedes leer claramente algún dato, usa null.
`;
    }

    /**
     * Procesa los resultados del análisis de IA
     */
    private processAnalysisResults(analysisResult: any): PaymentValidationResult {
        const errors: string[] = [];
        const suggestions: string[] = [];
        const extractedData = {
            amount: analysisResult.amount,
            date: analysisResult.date,
            accountNumber: analysisResult.accountNumber,
            bank: analysisResult.bank,
            referenceNumber: analysisResult.referenceNumber,
            paymentMethod: analysisResult.paymentMethod
        };

        // Validar monto
        const hasValidAmount = this.validateAmount(extractedData.amount, errors, suggestions);

        // Validar fecha
        const hasCurrentDate = this.validateDate(extractedData.date, errors, suggestions);

        // Validar cuenta bancaria
        const hasValidAccount = this.validateAccount(
            extractedData.accountNumber,
            extractedData.bank,
            errors,
            suggestions
        );

        // Validar banco
        const hasValidBank = this.validateBank(extractedData.bank, errors, suggestions);

        // Determinar si el pago es válido
        const isValid = hasValidAmount && hasCurrentDate && hasValidAccount && hasValidBank;

        // Calcular confianza total
        const confidence = this.calculateConfidence(
            analysisResult.confidence || 0.5,
            hasValidAmount,
            hasCurrentDate,
            hasValidAccount,
            hasValidBank
        );

        return {
            isValid,
            confidence,
            extractedData,
            validationDetails: {
                hasValidAmount,
                hasCurrentDate,
                hasValidAccount,
                hasValidBank,
                imageQuality: analysisResult.imageQuality || 'fair'
            },
            errors,
            suggestions
        };
    }

    /**
     * Valida el monto del pago
     */
    private validateAmount(amount: number | null, errors: string[], suggestions: string[]): boolean {
        if (!amount || amount <= 0) {
            errors.push('No se pudo detectar un monto válido');
            suggestions.push('Asegúrate de que el monto esté claramente visible');
            return false;
        }

        if (amount < 1000) {
            errors.push('El monto parece muy bajo para un pago de servicios');
            suggestions.push('Verifica que el monto mostrado sea correcto');
        }

        return true;
    }

    /**
     * Valida la fecha del pago
     */
    private validateDate(dateString: string | null, errors: string[], suggestions: string[]): boolean {
        if (!dateString) {
            errors.push('No se pudo detectar la fecha del pago');
            suggestions.push('Asegúrate de que la fecha esté claramente visible');
            return false;
        }

        try {
            const paymentDate = this.parseDate(dateString);
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            const paymentMonth = paymentDate.getMonth();
            const paymentYear = paymentDate.getFullYear();

            // Verificar que sea del mes actual
            if (paymentMonth !== currentMonth || paymentYear !== currentYear) {
                errors.push(`El pago debe ser del mes actual (${this.getMonthName(currentMonth)} ${currentYear})`);
                suggestions.push('Solo se aceptan pagos del mes en curso');
                return false;
            }

            // Verificar que no sea futuro
            if (paymentDate > now) {
                errors.push('La fecha del pago no puede ser futura');
                suggestions.push('Verifica que la fecha mostrada sea correcta');
                return false;
            }

            return true;
        } catch (error) {
            errors.push('Formato de fecha inválido');
            suggestions.push('La fecha debe estar en formato DD/MM/YYYY');
            return false;
        }
    }

    /**
     * Valida la cuenta bancaria
     */
    private validateAccount(
        accountNumber: string | null,
        bank: string | null,
        errors: string[],
        suggestions: string[]
    ): boolean {
        if (!accountNumber) {
            errors.push('No se pudo detectar el número de cuenta');
            suggestions.push('Asegúrate de que el número de cuenta esté visible');
            return false;
        }

        const normalizedAccount = accountNumber.replace(/\D/g, ''); // Solo números
        const foundAccount = PaymentValidationService.VALID_ACCOUNTS.find(
            account => account.account === normalizedAccount
        );

        if (!foundAccount) {
            errors.push('Número de cuenta no válido para Conecta2 Telecomunicaciones');
            suggestions.push('Verifica que hayas pagado a una de nuestras cuentas oficiales');
            return false;
        }

        return true;
    }

    /**
     * Valida el banco
     */
    private validateBank(bank: string | null, errors: string[], suggestions: string[]): boolean {
        if (!bank) {
            errors.push('No se pudo detectar el banco');
            suggestions.push('Asegúrate de que el nombre del banco esté visible');
            return false;
        }

        const normalizedBank = bank.toUpperCase();
        const validBanks = PaymentValidationService.VALID_ACCOUNTS.map(account => account.bank);

        const isValidBank = validBanks.some(validBank =>
            normalizedBank.includes(validBank) || validBank.includes(normalizedBank)
        );

        if (!isValidBank) {
            errors.push('Banco no reconocido como válido para pagos');
            suggestions.push('Verifica que el pago se haya realizado a través de nuestros bancos autorizados');
            return false;
        }

        return true;
    }

    /**
     * Calcula la confianza total de la validación
     */
    private calculateConfidence(
        aiConfidence: number,
        hasValidAmount: boolean,
        hasCurrentDate: boolean,
        hasValidAccount: boolean,
        hasValidBank: boolean
    ): number {
        let confidence = aiConfidence * 0.4; // 40% confianza de IA

        if (hasValidAmount) confidence += 0.2;
        if (hasCurrentDate) confidence += 0.15;
        if (hasValidAccount) confidence += 0.15;
        if (hasValidBank) confidence += 0.1;

        return Math.min(confidence, 1.0);
    }

    /**
     * Parsea una fecha en formato DD/MM/YYYY
     */
    private parseDate(dateString: string): Date {
        const parts = dateString.split('/');
        if (parts.length !== 3) {
            throw new Error('Formato de fecha inválido');
        }

        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Los meses en JS son 0-indexados
        const year = parseInt(parts[2], 10);

        return new Date(year, month, day);
    }

    /**
     * Obtiene el nombre del mes
     */
    private getMonthName(monthIndex: number): string {
        const months = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        return months[monthIndex];
    }

    /**
     * Formatea información de cuentas válidas para mostrar al usuario
     */
    static getValidAccountsInfo(): string {
        return `
💳 **CUENTAS AUTORIZADAS PARA PAGOS:**

📱 **CORRESPONSAL BANCOLOMBIA** o **APP**
• Convenio: ${PaymentValidationService.BANCOLOMBIA_CONVENIO} + TU CÓDIGO USUARIO

🏦 **BANCOLOMBIA AHORROS**
• Cuenta: ${PaymentValidationService.VALID_ACCOUNTS[0].account}
• NIT: ${PaymentValidationService.VALID_ACCOUNTS[0].nit}
• Titular: ${PaymentValidationService.VALID_ACCOUNTS[0].holder}

💜 **NEQUI**
• Número: ${PaymentValidationService.VALID_ACCOUNTS[1].account}

🏛️ **DAVIVIENDA AHORROS**
• Cuenta: ${PaymentValidationService.VALID_ACCOUNTS[2].account}

⚠️ **IMPORTANTE:** Solo se aceptan pagos del mes actual.
`;
    }
}

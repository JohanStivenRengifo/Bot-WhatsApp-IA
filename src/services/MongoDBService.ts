import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import { config } from '../config';

export class MongoDBService {
    private static instance: MongoDBService;
    private client: MongoClient;
    private db: Db;

    private constructor() {
        if (!config.MONGODB_URI) {
            throw new Error('MONGODB_URI no está configurada');
        }

        this.client = new MongoClient(config.MONGODB_URI);
        this.db = this.client.db(config.MONGODB_DB_NAME);
    }

    public static getInstance(): MongoDBService {
        if (!MongoDBService.instance) {
            MongoDBService.instance = new MongoDBService();
        }
        return MongoDBService.instance;
    }

    public async connect(): Promise<void> {
        try {
            await this.client.connect();
            console.log('✅ Conectado a MongoDB');
            await this.initializeCollections();
        } catch (error) {
            console.error('❌ Error conectando a MongoDB:', error);
            throw error;
        }
    }

    public async disconnect(): Promise<void> {
        await this.client.close();
        console.log('MongoDB desconectado');
    }

    public getDb(): Db {
        return this.db;
    }

    public getCollection(name: string): Collection {
        return this.db.collection(name);
    }

    // Método para insertar un documento
    public async insertOne(collectionName: string, document: any): Promise<any> {
        const collection = this.getCollection(collectionName);
        const result = await collection.insertOne({
            ...document,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        return { ...document, _id: result.insertedId };
    }

    // Método para encontrar documentos
    public async find(collectionName: string, filter: any = {}, options: any = {}): Promise<any[]> {
        const collection = this.getCollection(collectionName);
        return await collection.find(filter, options).toArray();
    }

    // Método para encontrar un documento
    public async findOne(collectionName: string, filter: any): Promise<any> {
        const collection = this.getCollection(collectionName);
        return await collection.findOne(filter);
    }

    // Método para actualizar un documento
    public async updateOne(collectionName: string, filter: any, update: any): Promise<any> {
        const collection = this.getCollection(collectionName);
        const result = await collection.updateOne(
            filter,
            {
                $set: {
                    ...update,
                    updatedAt: new Date()
                }
            }
        );
        return result;
    }

    // Método para actualizar múltiples documentos
    public async updateMany(collectionName: string, filter: any, update: any): Promise<any> {
        const collection = this.getCollection(collectionName);
        const result = await collection.updateMany(
            filter,
            {
                $set: {
                    ...update,
                    updatedAt: new Date()
                }
            }
        );
        return result;
    }

    // Método para eliminar un documento
    public async deleteOne(collectionName: string, filter: any): Promise<any> {
        const collection = this.getCollection(collectionName);
        return await collection.deleteOne(filter);
    }

    // Método para eliminar múltiples documentos
    public async deleteMany(collectionName: string, filter: any): Promise<any> {
        const collection = this.getCollection(collectionName);
        return await collection.deleteMany(filter);
    }

    // Método para contar documentos
    public async countDocuments(collectionName: string, filter: any = {}): Promise<number> {
        const collection = this.getCollection(collectionName);
        return await collection.countDocuments(filter);
    }

    // Método para agregaciones
    public async aggregate(collectionName: string, pipeline: any[]): Promise<any[]> {
        const collection = this.getCollection(collectionName);
        return await collection.aggregate(pipeline).toArray();
    }

    // Método para transacciones
    public async withTransaction<T>(callback: (session: any) => Promise<T>): Promise<T> {
        const session = this.client.startSession();
        try {
            let result: T;
            await session.withTransaction(async () => {
                result = await callback(session);
            });
            return result!;
        } finally {
            await session.endSession();
        }
    }    // Inicializar colecciones e índices
    private async initializeCollections(): Promise<void> {
        try {
            console.log('✅ Colecciones MongoDB listas para usar');
        } catch (error) {
            console.error('❌ Error inicializando colecciones:', error);
        }
    }    // Helper para convertir ObjectId a string
    public static objectIdToString(obj: any): any {
        if (obj === null || obj === undefined) {
            return obj;
        }

        if (obj instanceof ObjectId) {
            return obj.toString();
        }

        // Convertir fechas a strings ISO
        if (obj instanceof Date) {
            return obj.toISOString();
        }

        if (Array.isArray(obj)) {
            return obj.map(item => MongoDBService.objectIdToString(item));
        }

        if (typeof obj === 'object') {
            const result: any = {};
            for (const key in obj) {
                if (key === '_id' && obj[key] instanceof ObjectId) {
                    result.id = obj[key].toString();
                } else if (obj[key] instanceof Date) {
                    result[key] = obj[key].toISOString();
                } else {
                    result[key] = MongoDBService.objectIdToString(obj[key]);
                }
            }
            return result;
        }

        return obj;
    }

    // Helper para convertir string a ObjectId
    public static stringToObjectId(id: string): ObjectId {
        return new ObjectId(id);
    }
}

export default MongoDBService;

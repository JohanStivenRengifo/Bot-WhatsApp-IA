// @types/ping.d.ts
declare module 'ping' {
    export interface PingConfig {
        timeout?: number;
        extra?: string[];
    }

    export interface PingResponse {
        host: string;
        alive: boolean;
        time?: number;
        output?: string;
    }

    export const promise: {
    probe(host: string, config?: PingConfig): Promise<PingResponse>;
};
}

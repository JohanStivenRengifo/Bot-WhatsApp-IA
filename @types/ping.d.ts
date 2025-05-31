declare module 'ping' {
    export interface PingConfig {
        numeric?: boolean;
        timeout?: number;
        min_reply?: number;
        v6?: boolean;
        sourceAddr?: string;
        extra?: string[];
    }

    export interface PingResponse {
        host: string;
        alive: boolean;
        output?: string;
        time?: number;
        min?: string;
        max?: string;
        avg?: string;
        stddev?: string;
        packetLoss?: string;
    }

    export namespace promise {
        function probe(host: string, config?: PingConfig): Promise<PingResponse>;
    }

    export namespace sys {
        function probe(host: string, callback: (isAlive: boolean, error: Error) => void): void;
    }
}
import crypto from 'crypto';

interface AuthAttempt {
    phoneNumber: string;
    attempts: number;
    lastAttempt: Date;
    blockedUntil?: Date;
}

interface RateLimitEntry {
    phoneNumber: string;
    requests: number;
    windowStart: Date;
}

interface UserSession {
    phoneNumber: string;
    sessionId: string;
    createdAt: Date;
    lastActivity: Date;
    expiresAt: Date;
    isActive: boolean;
}

export class SecurityService {
    private authAttempts: Map<string, AuthAttempt> = new Map();
    private rateLimits: Map<string, RateLimitEntry> = new Map();
    private userSessions: Map<string, UserSession> = new Map();
    
    // Configuration
    private readonly MAX_AUTH_ATTEMPTS = 3;
    private readonly BLOCK_DURATION_MINUTES = 15;
    private readonly RATE_LIMIT_WINDOW_MINUTES = 1;
    private readonly RATE_LIMIT_MAX_REQUESTS = 10;
    private readonly SESSION_DURATION_HOURS = 2;
    private readonly ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';

    constructor() {
        // Clean up expired entries every 5 minutes
        setInterval(() => {
            this.cleanupExpiredEntries();
        }, 5 * 60 * 1000);
    }

    // Authentication attempt tracking
    recordAuthAttempt(phoneNumber: string, success: boolean): boolean {
        const now = new Date();
        let attempt = this.authAttempts.get(phoneNumber);

        if (!attempt) {
            attempt = {
                phoneNumber,
                attempts: 0,
                lastAttempt: now
            };
        }

        // Check if user is currently blocked
        if (attempt.blockedUntil && now < attempt.blockedUntil) {
            return false; // Still blocked
        }

        if (success) {
            // Reset attempts on successful authentication
            this.authAttempts.delete(phoneNumber);
            return true;
        } else {
            // Increment failed attempts
            attempt.attempts++;
            attempt.lastAttempt = now;

            if (attempt.attempts >= this.MAX_AUTH_ATTEMPTS) {
                // Block user
                attempt.blockedUntil = new Date(now.getTime() + this.BLOCK_DURATION_MINUTES * 60 * 1000);
                console.warn(`🔒 User ${phoneNumber} blocked for ${this.BLOCK_DURATION_MINUTES} minutes due to failed auth attempts`);
            }

            this.authAttempts.set(phoneNumber, attempt);
            return attempt.attempts < this.MAX_AUTH_ATTEMPTS;
        }
    }

    isUserBlocked(phoneNumber: string): { blocked: boolean; remainingTime?: number } {
        const attempt = this.authAttempts.get(phoneNumber);
        
        if (!attempt || !attempt.blockedUntil) {
            return { blocked: false };
        }

        const now = new Date();
        if (now >= attempt.blockedUntil) {
            // Block expired, clean up
            this.authAttempts.delete(phoneNumber);
            return { blocked: false };
        }

        const remainingTime = Math.ceil((attempt.blockedUntil.getTime() - now.getTime()) / (60 * 1000));
        return { blocked: true, remainingTime };
    }

    getRemainingAuthAttempts(phoneNumber: string): number {
        const attempt = this.authAttempts.get(phoneNumber);
        if (!attempt) return this.MAX_AUTH_ATTEMPTS;
        
        return Math.max(0, this.MAX_AUTH_ATTEMPTS - attempt.attempts);
    }

    // Rate limiting
    checkRateLimit(phoneNumber: string): { allowed: boolean; remainingRequests?: number; resetTime?: Date } {
        const now = new Date();
        let rateLimit = this.rateLimits.get(phoneNumber);

        if (!rateLimit) {
            rateLimit = {
                phoneNumber,
                requests: 1,
                windowStart: now
            };
            this.rateLimits.set(phoneNumber, rateLimit);
            return { allowed: true, remainingRequests: this.RATE_LIMIT_MAX_REQUESTS - 1 };
        }

        // Check if window has expired
        const windowExpiry = new Date(rateLimit.windowStart.getTime() + this.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
        if (now >= windowExpiry) {
            // Reset window
            rateLimit.requests = 1;
            rateLimit.windowStart = now;
            this.rateLimits.set(phoneNumber, rateLimit);
            return { allowed: true, remainingRequests: this.RATE_LIMIT_MAX_REQUESTS - 1 };
        }

        // Check if limit exceeded
        if (rateLimit.requests >= this.RATE_LIMIT_MAX_REQUESTS) {
            return { 
                allowed: false, 
                remainingRequests: 0,
                resetTime: windowExpiry
            };
        }

        // Increment requests
        rateLimit.requests++;
        this.rateLimits.set(phoneNumber, rateLimit);
        
        return { 
            allowed: true, 
            remainingRequests: this.RATE_LIMIT_MAX_REQUESTS - rateLimit.requests 
        };
    }

    // Session management
    createSession(phoneNumber: string): string {
        const sessionId = this.generateSessionId();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + this.SESSION_DURATION_HOURS * 60 * 60 * 1000);

        const session: UserSession = {
            phoneNumber,
            sessionId,
            createdAt: now,
            lastActivity: now,
            expiresAt,
            isActive: true
        };

        this.userSessions.set(phoneNumber, session);
        console.log(`✅ Session created for ${phoneNumber}, expires at ${expiresAt.toISOString()}`);
        
        return sessionId;
    }

    validateSession(phoneNumber: string): { valid: boolean; remainingTime?: number } {
        const session = this.userSessions.get(phoneNumber);
        
        if (!session || !session.isActive) {
            return { valid: false };
        }

        const now = new Date();
        if (now >= session.expiresAt) {
            // Session expired
            this.invalidateSession(phoneNumber);
            return { valid: false };
        }

        // Update last activity
        session.lastActivity = now;
        this.userSessions.set(phoneNumber, session);

        const remainingTime = Math.ceil((session.expiresAt.getTime() - now.getTime()) / (60 * 1000));
        return { valid: true, remainingTime };
    }

    invalidateSession(phoneNumber: string): void {
        const session = this.userSessions.get(phoneNumber);
        if (session) {
            session.isActive = false;
            console.log(`🔒 Session invalidated for ${phoneNumber}`);
        }
    }

    extendSession(phoneNumber: string): boolean {
        const session = this.userSessions.get(phoneNumber);
        if (!session || !session.isActive) {
            return false;
        }

        const now = new Date();
        session.expiresAt = new Date(now.getTime() + this.SESSION_DURATION_HOURS * 60 * 60 * 1000);
        session.lastActivity = now;
        this.userSessions.set(phoneNumber, session);
        
        console.log(`🔄 Session extended for ${phoneNumber}, new expiry: ${session.expiresAt.toISOString()}`);
        return true;
    }

    // Data encryption
    encryptSensitiveData(data: string): string {
        try {
            const algorithm = 'aes-256-cbc';
            const key = crypto.scryptSync(this.ENCRYPTION_KEY, 'salt', 32);
            const iv = crypto.randomBytes(16);
            
            const cipher = crypto.createCipheriv(algorithm, key, iv);
            let encrypted = cipher.update(data, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            return iv.toString('hex') + ':' + encrypted;
        } catch (error) {
            console.error('Encryption error:', error);
            return data; // Return original data if encryption fails
        }
    }

    decryptSensitiveData(encryptedData: string): string {
        try {
            const algorithm = 'aes-256-cbc';
            const key = crypto.scryptSync(this.ENCRYPTION_KEY, 'salt', 32);
            
            const parts = encryptedData.split(':');
            if (parts.length !== 2) {
                throw new Error('Invalid encrypted data format');
            }
            
            const iv = Buffer.from(parts[0], 'hex');
            const encrypted = parts[1];
            
            const decipher = crypto.createDecipheriv(algorithm, key, iv);
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            console.error('Decryption error:', error);
            return encryptedData; // Return encrypted data if decryption fails
        }
    }

    // Security monitoring
    getSecurityStats(): {
        blockedUsers: number;
        activeSessions: number;
        rateLimitedUsers: number;
        totalAuthAttempts: number;
    } {
        const now = new Date();
        
        const blockedUsers = Array.from(this.authAttempts.values())
            .filter(attempt => attempt.blockedUntil && now < attempt.blockedUntil).length;
        
        const activeSessions = Array.from(this.userSessions.values())
            .filter(session => session.isActive && now < session.expiresAt).length;
        
        const rateLimitedUsers = Array.from(this.rateLimits.values())
            .filter(limit => {
                const windowExpiry = new Date(limit.windowStart.getTime() + this.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
                return now < windowExpiry && limit.requests >= this.RATE_LIMIT_MAX_REQUESTS;
            }).length;

        return {
            blockedUsers,
            activeSessions,
            rateLimitedUsers,
            totalAuthAttempts: this.authAttempts.size
        };
    }

    // Cleanup expired entries
    private cleanupExpiredEntries(): void {
        const now = new Date();
        let cleaned = 0;

        // Clean up expired auth attempts
        for (const [phoneNumber, attempt] of this.authAttempts.entries()) {
            if (attempt.blockedUntil && now >= attempt.blockedUntil) {
                this.authAttempts.delete(phoneNumber);
                cleaned++;
            }
        }

        // Clean up expired rate limits
        for (const [phoneNumber, limit] of this.rateLimits.entries()) {
            const windowExpiry = new Date(limit.windowStart.getTime() + this.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
            if (now >= windowExpiry) {
                this.rateLimits.delete(phoneNumber);
                cleaned++;
            }
        }

        // Clean up expired sessions
        for (const [phoneNumber, session] of this.userSessions.entries()) {
            if (!session.isActive || now >= session.expiresAt) {
                this.userSessions.delete(phoneNumber);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`🧹 Cleaned up ${cleaned} expired security entries`);
        }
    }

    private generateSessionId(): string {
        return crypto.randomBytes(32).toString('hex');
    }
}
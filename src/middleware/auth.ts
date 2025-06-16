import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { CRMUser } from '../interfaces/CRM';

// Extender el objeto Request para incluir el usuario autenticado
declare global {
    namespace Express {
        interface Request {
            user?: CRMUser;
        }
    }
}

export interface JWTPayload {
    id: string;
    email: string;
    role: 'admin' | 'supervisor' | 'agent';
    iat?: number;
    exp?: number;
}

/**
 * Middleware para autenticar tokens JWT
 */
export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        res.status(401).json({
            error: 'Token de acceso requerido'
        });
        return;
    }

    try {
        const decoded = jwt.verify(token, config.JWT_SECRET) as JWTPayload;

        // Crear objeto de usuario simplificado para req.user
        req.user = {
            id: decoded.id,
            username: '', // Se podría obtener de base de datos si es necesario
            email: decoded.email,
            role: decoded.role,
            isActive: true,
            permissions: getRolePermissions(decoded.role),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            res.status(401).json({
                error: 'Token expirado'
            });
            return;
        } else if (error instanceof jwt.JsonWebTokenError) {
            res.status(401).json({
                error: 'Token inválido'
            });
            return;
        } else {
            res.status(500).json({
                error: 'Error verificando token'
            });
            return;
        }
    }
};

/**
 * Middleware para requerir roles específicos
 */
export const requireRole = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({
                error: 'Usuario no autenticado'
            });
            return;
        } if (!roles.includes(req.user.role)) {
            res.status(403).json({
                error: 'Permisos insuficientes'
            });
            return;
        }

        next();
    };
};

/**
 * Middleware para requerir permisos específicos
 */
export const requirePermission = (permission: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Usuario no autenticado'
            });
        }

        if (!req.user.permissions.includes(permission)) {
            return res.status(403).json({
                error: `Permiso requerido: ${permission}`
            });
        }

        next();
    };
};

/**
 * Generar token JWT para un usuario
 */
export const generateToken = (user: { id: string; email: string; role: string }): string => {
    const payload: JWTPayload = {
        id: user.id,
        email: user.email,
        role: user.role as 'admin' | 'supervisor' | 'agent'
    };

    return jwt.sign(payload, config.JWT_SECRET, {
        expiresIn: '24h' // Token válido por 24 horas
    });
};

/**
 * Obtener permisos basados en el rol
 */
function getRolePermissions(role: string): string[] {
    const permissions: Record<string, string[]> = {
        admin: [
            'users:read',
            'users:create',
            'users:update',
            'users:delete',
            'conversations:read',
            'conversations:update',
            'conversations:assign',
            'messages:read',
            'messages:send',
            'handover:accept',
            'handover:return',
            'tickets:read',
            'tickets:create',
            'tickets:update',
            'dashboard:read',
            'metrics:read',
            'system:read',
            'system:control',
            'bot:control'
        ],
        supervisor: [
            'users:read',
            'conversations:read',
            'conversations:update',
            'conversations:assign',
            'messages:read',
            'messages:send',
            'handover:accept',
            'handover:return',
            'tickets:read',
            'tickets:create',
            'tickets:update',
            'dashboard:read',
            'metrics:read',
            'system:read',
            'bot:control'
        ],
        agent: [
            'conversations:read',
            'conversations:update',
            'messages:read',
            'messages:send',
            'handover:accept',
            'handover:return',
            'tickets:read',
            'tickets:create'
        ]
    };

    return permissions[role] || [];
}

/**
 * Verificar si un token es válido sin lanzar error
 */
export const verifyToken = (token: string): JWTPayload | null => {
    try {
        return jwt.verify(token, config.JWT_SECRET) as JWTPayload;
    } catch (error) {
        return null;
    }
};

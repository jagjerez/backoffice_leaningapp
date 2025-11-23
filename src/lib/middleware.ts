import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, TokenPayload } from './auth';

export interface AuthenticatedRequest extends NextRequest {
  user?: TokenPayload;
}

export function requireAuth(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      );
    }

    const authReq = req as AuthenticatedRequest;
    authReq.user = payload;
    
    return handler(authReq);
  };
}

export function requireAdmin(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
) {
  return requireAuth(async (req: AuthenticatedRequest) => {
    if (req.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acceso denegado. Se requiere rol de administrador.' },
        { status: 403 }
      );
    }
    
    return handler(req);
  });
}


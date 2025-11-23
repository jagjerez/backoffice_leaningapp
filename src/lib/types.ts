import { TokenPayload } from './auth';
import { NextRequest } from 'next/server';

export interface AuthenticatedRequest extends NextRequest {
  user?: TokenPayload;
}

export interface PrismaWhereClause {
  nativeLanguageId?: string;
  learningLanguageId?: string;
  difficulty?: string;
  cefrLevel?: string;
  category?: string;
}

export interface ErrorResponse {
  error: string;
}


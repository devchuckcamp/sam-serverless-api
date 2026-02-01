import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { AuthContext, JWTClaims, Scope } from '../types/auth';
import { ForbiddenError, UnauthorizedError } from './errors';
import { logger } from './logger';

const isLocal = process.env.AWS_SAM_LOCAL === 'true' || process.env.IS_LOCAL === 'true';

function extractClaimsFromAuthHeader(event: APIGatewayProxyEventV2WithJWTAuthorizer): JWTClaims | null {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  if (!authHeader) return null;

  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payloadPart = parts[1];
    if (!payloadPart) return null;

    const payload = Buffer.from(payloadPart, 'base64').toString('utf-8');
    return JSON.parse(payload) as JWTClaims;
  } catch {
    logger.warn('Failed to decode JWT from Authorization header');
    return null;
  }
}

export function extractAuthContext(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): AuthContext {
  let claims = event.requestContext.authorizer?.jwt?.claims;

  // Local development: extract claims directly from Authorization header
  if (!claims && isLocal) {
    const localClaims = extractClaimsFromAuthHeader(event);
    if (localClaims) {
      logger.info('Using JWT claims from Authorization header (local dev mode)');
      claims = localClaims as unknown as typeof claims;
    }
  }

  if (!claims) {
    logger.error('No JWT claims found in request context');
    throw new UnauthorizedError('Missing authentication token');
  }

  const jwtClaims = claims as unknown as JWTClaims;
  const userId = jwtClaims.sub;
  const username = jwtClaims['cognito:username'] || userId;
  const clinicId = jwtClaims['custom:clinicId'];

  if (!userId) {
    logger.error('No user ID (sub) in JWT claims');
    throw new UnauthorizedError('Invalid token: missing user identifier');
  }

  if (!clinicId) {
    logger.error('No clinic ID in JWT claims');
    throw new UnauthorizedError('Invalid token: missing clinic identifier');
  }

  const scopes = parseScopes(jwtClaims);

  const authContext: AuthContext = {
    userId,
    username,
    clinicId,
    scopes,
    rawClaims: jwtClaims,
  };

  logger.setContext({
    userId,
    clinicId,
  });

  return authContext;
}

function parseScopes(claims: JWTClaims): Scope[] {
  const scopes: Scope[] = [];
  const groups = claims['cognito:groups'] ?? [];
  const scopeString = claims.scope ?? '';

  const scopeValues = scopeString.split(' ').filter(Boolean);
  const allScopeStrings = [...groups, ...scopeValues];

  for (const scopeStr of allScopeStrings) {
    if (Object.values(Scope).includes(scopeStr as Scope)) {
      scopes.push(scopeStr as Scope);
    }
  }

  // Clinical staff: doctors, clinicians, nurses - can read/write notes and attachments
  const hasClinicalAccess =
    groups.includes('admin') ||
    groups.includes('clinician') ||
    groups.includes('doctor') ||
    groups.includes('nurse');

  if (hasClinicalAccess) {
    if (!scopes.includes(Scope.NOTES_READ)) {
      scopes.push(Scope.NOTES_READ);
    }
    if (!scopes.includes(Scope.NOTES_WRITE)) {
      scopes.push(Scope.NOTES_WRITE);
    }
    if (!scopes.includes(Scope.ATTACHMENTS_WRITE)) {
      scopes.push(Scope.ATTACHMENTS_WRITE);
    }
  }

  // Only admins can delete notes
  if (groups.includes('admin')) {
    if (!scopes.includes(Scope.NOTES_DELETE)) {
      scopes.push(Scope.NOTES_DELETE);
    }
  }

  // Receptionists: read-only access to notes and attachments
  if (groups.includes('receptionist')) {
    if (!scopes.includes(Scope.NOTES_READ)) {
      scopes.push(Scope.NOTES_READ);
    }
  }

  return scopes;
}

export function requireScopes(auth: AuthContext, ...requiredScopes: Scope[]): void {
  for (const scope of requiredScopes) {
    if (!auth.scopes.includes(scope)) {
      logger.warn('Missing required scope', {
        userId: auth.userId,
        clinicId: auth.clinicId,
        requiredScope: scope,
        userScopes: auth.scopes.join(','),
      });
      throw new ForbiddenError(`Missing required permission: ${scope}`);
    }
  }
}

export function assertClinicAccess(auth: AuthContext, resourceClinicId: string): void {
  if (auth.clinicId !== resourceClinicId) {
    logger.warn('Clinic access violation attempt', {
      userId: auth.userId,
      userClinicId: auth.clinicId,
      targetClinicId: resourceClinicId,
    });
    throw new ForbiddenError('Access denied: resource belongs to different clinic');
  }
}

export function hasScope(auth: AuthContext, scope: Scope): boolean {
  return auth.scopes.includes(scope);
}

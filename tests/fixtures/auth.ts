import { AuthContext, Scope, JWTClaims } from '../../src/types/auth';

export function createMockAuthContext(overrides?: Partial<AuthContext>): AuthContext {
  const defaultClaims: JWTClaims = {
    sub: 'user-123',
    'custom:clinicId': 'clinic-abc',
    'cognito:groups': ['clinician'],
    scope: 'notes:read notes:write',
    iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test',
    aud: 'test-client-id',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  };

  return {
    userId: 'user-123',
    username: 'dr-smith',
    clinicId: 'clinic-abc',
    scopes: [Scope.NOTES_READ, Scope.NOTES_WRITE, Scope.ATTACHMENTS_WRITE],
    rawClaims: defaultClaims,
    ...overrides,
  };
}

export function createAdminAuthContext(overrides?: Partial<AuthContext>): AuthContext {
  const base = createMockAuthContext(overrides);
  return {
    ...base,
    scopes: [
      Scope.NOTES_READ,
      Scope.NOTES_WRITE,
      Scope.NOTES_DELETE,
      Scope.ATTACHMENTS_WRITE,
    ],
    ...overrides,
  };
}

export function createReadOnlyAuthContext(overrides?: Partial<AuthContext>): AuthContext {
  const base = createMockAuthContext(overrides);
  return {
    ...base,
    scopes: [Scope.NOTES_READ],
    ...overrides,
  };
}

export function createMockJWTClaims(overrides?: Partial<JWTClaims>): JWTClaims {
  return {
    sub: 'user-123',
    'custom:clinicId': 'clinic-abc',
    'cognito:groups': ['clinician'],
    scope: 'notes:read notes:write',
    iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test',
    aud: 'test-client-id',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

export function createMockAPIGatewayEvent(claims: JWTClaims) {
  return {
    requestContext: {
      authorizer: {
        jwt: {
          claims,
        },
      },
    },
  };
}

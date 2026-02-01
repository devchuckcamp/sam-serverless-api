import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { extractAuthContext, requireScopes, assertClinicAccess, hasScope } from '../../../src/lib/auth';
import { Scope, JWTClaims } from '../../../src/types/auth';
import { ForbiddenError, UnauthorizedError } from '../../../src/lib/errors';
import { createMockJWTClaims, createMockAuthContext } from '../../fixtures/auth';

describe('extractAuthContext', () => {
  function createMockEvent(claims?: JWTClaims): APIGatewayProxyEventV2WithJWTAuthorizer {
    return {
      requestContext: {
        authorizer: claims ? { jwt: { claims: claims as unknown as Record<string, unknown> } } : undefined,
      },
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;
  }

  it('should extract auth context from valid JWT claims', () => {
    const claims = createMockJWTClaims();
    const event = createMockEvent(claims);

    const result = extractAuthContext(event);

    expect(result.userId).toBe('user-123');
    expect(result.clinicId).toBe('clinic-abc');
    expect(result.scopes).toContain(Scope.NOTES_READ);
    expect(result.scopes).toContain(Scope.NOTES_WRITE);
  });

  it('should throw UnauthorizedError when no claims present', () => {
    const event = createMockEvent();

    expect(() => extractAuthContext(event)).toThrow(UnauthorizedError);
  });

  it('should throw UnauthorizedError when user ID (sub) is missing', () => {
    const claims = createMockJWTClaims();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (claims as any).sub = undefined;
    const event = createMockEvent(claims);

    expect(() => extractAuthContext(event)).toThrow(UnauthorizedError);
  });

  it('should throw UnauthorizedError when clinic ID is missing', () => {
    const claims = createMockJWTClaims();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (claims as any)['custom:clinicId'] = undefined;
    const event = createMockEvent(claims);

    expect(() => extractAuthContext(event)).toThrow(UnauthorizedError);
  });

  it('should grant full permissions to admin group', () => {
    const claims = createMockJWTClaims({ 'cognito:groups': ['admin'] });
    const event = createMockEvent(claims);

    const result = extractAuthContext(event);

    expect(result.scopes).toContain(Scope.NOTES_READ);
    expect(result.scopes).toContain(Scope.NOTES_WRITE);
    expect(result.scopes).toContain(Scope.NOTES_DELETE);
    expect(result.scopes).toContain(Scope.ATTACHMENTS_WRITE);
  });

  it('should grant read/write permissions to clinician group', () => {
    const claims = createMockJWTClaims({ 'cognito:groups': ['clinician'], scope: '' });
    const event = createMockEvent(claims);

    const result = extractAuthContext(event);

    expect(result.scopes).toContain(Scope.NOTES_READ);
    expect(result.scopes).toContain(Scope.NOTES_WRITE);
    expect(result.scopes).toContain(Scope.ATTACHMENTS_WRITE);
    expect(result.scopes).not.toContain(Scope.NOTES_DELETE);
  });

  it('should parse scopes from scope string', () => {
    const claims = createMockJWTClaims({
      'cognito:groups': [],
      scope: 'notes:read notes:write attachments:write',
    });
    const event = createMockEvent(claims);

    const result = extractAuthContext(event);

    expect(result.scopes).toContain(Scope.NOTES_READ);
    expect(result.scopes).toContain(Scope.NOTES_WRITE);
    expect(result.scopes).toContain(Scope.ATTACHMENTS_WRITE);
  });
});

describe('requireScopes', () => {
  it('should not throw when user has required scope', () => {
    const auth = createMockAuthContext({ scopes: [Scope.NOTES_READ] });

    expect(() => requireScopes(auth, Scope.NOTES_READ)).not.toThrow();
  });

  it('should not throw when user has all required scopes', () => {
    const auth = createMockAuthContext({
      scopes: [Scope.NOTES_READ, Scope.NOTES_WRITE],
    });

    expect(() => requireScopes(auth, Scope.NOTES_READ, Scope.NOTES_WRITE)).not.toThrow();
  });

  it('should throw ForbiddenError when user lacks required scope', () => {
    const auth = createMockAuthContext({ scopes: [Scope.NOTES_READ] });

    expect(() => requireScopes(auth, Scope.NOTES_DELETE)).toThrow(ForbiddenError);
  });

  it('should throw ForbiddenError when user lacks one of multiple required scopes', () => {
    const auth = createMockAuthContext({ scopes: [Scope.NOTES_READ] });

    expect(() => requireScopes(auth, Scope.NOTES_READ, Scope.NOTES_WRITE)).toThrow(ForbiddenError);
  });
});

describe('assertClinicAccess', () => {
  it('should not throw when clinic IDs match', () => {
    const auth = createMockAuthContext({ clinicId: 'clinic-abc' });

    expect(() => assertClinicAccess(auth, 'clinic-abc')).not.toThrow();
  });

  it('should throw ForbiddenError when clinic IDs do not match', () => {
    const auth = createMockAuthContext({ clinicId: 'clinic-abc' });

    expect(() => assertClinicAccess(auth, 'clinic-xyz')).toThrow(ForbiddenError);
  });
});

describe('hasScope', () => {
  it('should return true when user has scope', () => {
    const auth = createMockAuthContext({ scopes: [Scope.NOTES_READ] });

    expect(hasScope(auth, Scope.NOTES_READ)).toBe(true);
  });

  it('should return false when user lacks scope', () => {
    const auth = createMockAuthContext({ scopes: [Scope.NOTES_READ] });

    expect(hasScope(auth, Scope.NOTES_DELETE)).toBe(false);
  });
});

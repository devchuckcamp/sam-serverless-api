export enum Scope {
  NOTES_READ = 'notes:read',
  NOTES_WRITE = 'notes:write',
  NOTES_DELETE = 'notes:delete',
  ATTACHMENTS_WRITE = 'attachments:write',
}

export interface JWTClaims {
  sub: string;
  'cognito:username'?: string;
  'cognito:groups'?: string[];
  'custom:clinicId'?: string;
  scope?: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
}

export interface AuthContext {
  userId: string;
  username: string;
  clinicId: string;
  scopes: Scope[];
  rawClaims: JWTClaims;
}
